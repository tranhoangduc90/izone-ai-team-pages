import { startReadingPracticeJournal } from '../shared/reading-practice-journal.mjs?v=20261117-rp-cloud-r1';
import { SpeakingDurableOutbox } from '../speaking-homework/journal/speaking-durable-outbox.mjs?v=20261117-cloud-r1';
import { createRecorder, fetchTransport } from '../speaking-homework/journal/recorder.mjs?v=20261117-speaking-cloud-r1';

const collectorDb = 'izone-reading-practice-journal-v1';
const cloudDb = 'izone-reading-practice-journal-cloud-v1';
const cloudUrl = 'https://izone-reading-practice-journal-ingress.tranhoangduc90.workers.dev/api/reading-practice/journal-events';
const scopeDigest = /^[a-f0-9]{64}$/;
const contextIntervalMs = 60_000;
const routeLeaseMs = 75_000;

class PracticeOutbox extends SpeakingDurableOutbox {
  async nextBatch(options) {
    // Leave room for the archive envelope and signed provider metadata.
    const batch = await super.nextBatch({ ...options, maxBytes: Math.min(options.maxBytes, 30 * 1024) });
    if (batch && batch.auth?.expiresAt <= Date.now()) {
      await this.blockContext(batch.bindingId, batch.auth.ticketId);
      return null;
    }
    return batch;
  }

  async expiringContexts(until) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['contexts', 'events']);
      const after = this.scanAfter;
      const contexts = tx.objectStore('contexts').openCursor(after ? IDBKeyRange.lowerBound(after, true) : undefined);
      const events = tx.objectStore('events').index('context');
      const pending = new Map();
      tx.oncomplete = () => resolve(pending);
      tx.onabort = () => reject(new Error('READING_PRACTICE_CONTEXTS_UNAVAILABLE'));
      contexts.onsuccess = () => {
        const cursor = contexts.result;
        if (!cursor) { this.scanAfter = undefined; return; }
        if (pending.size >= 16) return;
        this.scanAfter = cursor.key;
        const { id, binding, auth, blocked } = cursor.value;
        if (id.startsWith('latest:') || !scopeDigest.test(binding) || !auth?.ticket || !auth.ticketId ||
            pending.has(binding) || (!blocked && auth.expiresAt > until)) {
          cursor.continue();
          return;
        }
        const count = events.count(id);
        count.onsuccess = () => {
          if (count.result) pending.set(binding, auth);
          cursor.continue();
        };
      };
    });
  }
}

export function startReadingPracticeJournalRoute(endpoint, { contextHeaders, cloudEndpoint = cloudUrl } = {}) {
  const contextUrl = new URL('journal-context', new URL(endpoint, location.href));
  const legacyBox = new PracticeOutbox({ name: collectorDb, maxBytes: 2 * 1024 * 1024 });
  const cloudBox = new PracticeOutbox({ name: cloudDb, maxBytes: 2 * 1024 * 1024 });
  const legacy = startReadingPracticeJournal(endpoint, { outbox: legacyBox, recorderFactory: createRecorder, durableBatches: true });
  const sendCloud = fetchTransport(cloudEndpoint, (url, options) => fetch(url, { ...options, redirect: 'error' }));
  const cloud = startReadingPracticeJournal(cloudEndpoint, {
    outbox: cloudBox, recorderFactory: createRecorder, durableBatches: true, async send(body, options) {
      const reply = await sendCloud(body, options);
      const stable = JSON.stringify([body.bindingId, body.events.map(event => event.id).sort()]);
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable));
      const batchId = Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
      if (reply?.batchId !== batchId || !scopeDigest.test(reply.contentSha256 || '') ||
          typeof reply.messageId !== 'string' || !/^\d+$/.test(reply.messageId)) throw new Error('JOURNAL_ARCHIVE_ACK_INVALID');
      return reply;
    },
  });
  let current;

  async function contexts(channel, lane, bindingIds, previousCloudGrants) {
    const headers = contextHeaders();
    if (!headers.Authorization || current !== channel) return [];
    const response = await fetch(contextUrl, {
      method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ lane, bindingIds, ...(previousCloudGrants ? { previousCloudGrants } : {}) }),
    });
    if (!response.ok || current !== channel) return [];
    const body = await response.json();
    return Array.isArray(body.grants) ? body.grants : [];
  }

  const validGrant = (grant, lane) => grant?.archiveLane === lane && scopeDigest.test(grant.bindingId) &&
    typeof grant.ticket === 'string' && typeof grant.ticketId === 'string' &&
    Number.isSafeInteger(grant.issuedAt) && Number.isSafeInteger(grant.expiresAt) && grant.expiresAt > Date.now();

  async function recover(channel, box, bridge, lane) {
    const pending = await box.expiringContexts(Date.now() + 15_000);
    if (!pending.size || current !== channel) return;
    const proof = lane === 'cloud'
      ? [...pending.values()].map(({ ticket, ticketId, issuedAt }) => ({ ticket, ticketId, issuedAt }))
      : undefined;
    const grants = await contexts(channel, lane, [...pending.keys()], proof);
    if (current !== channel) return;
    for (const grant of grants) {
      if (!pending.has(grant?.bindingId) || !validGrant(grant, lane)) continue;
      const { bindingId, ticket, ticketId, issuedAt, expiresAt } = grant;
      await box.renewBinding(bindingId, { ticket, ticketId, issuedAt, expiresAt, ...(lane === 'cloud' ? { archiveLane: lane } : {}) });
    }
    bridge.flush({ force: true });
  }

  async function refresh(channel) {
    if (!channel || channel.checking || current !== channel) return;
    channel.checking = true;
    try {
      const grants = await contexts(channel, 'preferred', []).catch(() => null);
      if (current !== channel) return;
      const match = grants?.find(grant => validGrant(grant, 'cloud') && grant.bindingId === channel.scope.bindingId &&
        grant.studentRef === channel.scope.studentRef && grant.classCode === channel.scope.classCode &&
        grant.attemptId === channel.scope.attemptId && grant.attemptNo === channel.scope.attemptNo);
      if (match) {
        if (channel.grant?.expiresAt > Date.now() + routeLeaseMs) {
          channel.routeUntil = Date.now() + routeLeaseMs;
        } else {
          channel.cloud = cloud.bind(match);
          channel.grant = match;
          channel.routeUntil = channel.cloud ? Date.now() + routeLeaseMs : 0;
        }
        cloud.flush({ force: true });
      } else if (grants) {
        channel.routeUntil = 0;
        channel.cloud = null;
        channel.grant = null;
        cloud.clear();
      }
      await Promise.allSettled([
        recover(channel, legacyBox, legacy, 'collector'),
        recover(channel, cloudBox, cloud, 'cloud'),
      ]);
    } finally {
      channel.checking = false;
    }
  }

  const onRefresh = () => { void refresh(current).catch(() => {}); };
  const timer = setInterval(onRefresh, contextIntervalMs);
  addEventListener('online', onRefresh);
  const clear = () => { current = undefined; legacy.clear(); cloud.clear(); };
  return {
    bind(scope) {
      const fallback = legacy.bind(scope);
      if (!fallback) return null;
      if (current?.scope.bindingId === scope.bindingId) {
        current.legacy = fallback;
        return current.api;
      }
      cloud.clear();
      const channel = { scope, legacy: fallback, routeUntil: 0 };
      current = channel;
      const active = () => Date.now() < channel.routeUntil ? channel.cloud ?? channel.legacy : channel.legacy;
      channel.api = Object.fromEntries(['control', 'checkpoint', 'timer', 'restore', 'visibility', 'dialog', 'environment']
        .map(method => [method, (...args) => active()[method](...args)]));
      onRefresh();
      return channel.api;
    },
    clear,
    async stop() {
      clearInterval(timer);
      removeEventListener('online', onRefresh);
      clear();
      await Promise.allSettled([legacy.stop(), cloud.stop()]);
    },
  };
}
