import { startHomeworkJournal } from '../shared/reading-homework-journal.mjs?v=20261117-rh-route-r1';
import { SpeakingDurableOutbox as SealedOutbox } from '../speaking-homework/journal/speaking-durable-outbox.mjs?v=20261117-cloud-r1';
import { createRecorder } from '../speaking-homework/journal/recorder.mjs?v=20261117-speaking-cloud-r1';

class ReadingOutbox extends SealedOutbox {
  async expiredBindings(before, skip) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['contexts', 'events']);
      const contexts = tx.objectStore('contexts').openCursor();
      const events = tx.objectStore('events').index('context');
      const pending = new Set();
      tx.oncomplete = () => resolve([...pending]);
      tx.onabort = () => reject(new Error('READING_OUTBOX_CONTEXTS_UNAVAILABLE'));
      contexts.onsuccess = () => {
        const cursor = contexts.result;
        if (!cursor || pending.size >= 16) return;
        const { id, binding, auth, blocked } = cursor.value;
        if (id.startsWith('latest:') || pending.has(binding) || skip.has(binding)
          || !blocked && auth?.expiresAt > before) {
          cursor.continue();
          return;
        }
        const read = events.count(id);
        read.onsuccess = () => {
          if (read.result > 0) pending.add(binding);
          cursor.continue();
        };
      };
    });
  }
}

export function startReadingHomeworkJournal(endpoint) {
  const contextEndpoint = new URL('journal-context', new URL(endpoint, location.href));
  const cloudEndpoint = 'https://izone-reading-journal-ingress.tranhoangduc90.workers.dev/api/reading-skills67/journal-events';
  async function contexts(bindingIds, lane) {
    const response = await fetch(contextEndpoint, {
      method: 'POST', credentials: 'include', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5_000),
      headers: { 'Content-Type': 'application/json', ...window.Reading67Access?.headers },
      body: JSON.stringify({ bindingIds, ...(lane === 'collector' ? {} : { lane }) }),
    });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body.contexts) ? body.contexts : [];
  }
  const collector = startHomeworkJournal(endpoint, 'reading-homework', {
    Outbox: ReadingOutbox, recorderFactory: createRecorder, durableBatches: true,
    recoverContexts: async ids => (await contexts(ids, 'collector')).filter(value => value?.archiveLane !== 'cloud'),
  });
  const cloud = startHomeworkJournal(cloudEndpoint, 'reading-homework', {
    Outbox: ReadingOutbox, recorderFactory: createRecorder, durableBatches: true,
    outboxName: 'izone-reading-homework-journal-cloud-v1',
    recoverContexts: async ids => (await contexts(ids, 'cloud')).filter(value => value?.archiveLane === 'cloud'),
  });
  let current = null;
  let stopped = false;
  async function refreshRoute(channel) {
    if (!channel || stopped || channel.checking) return;
    channel.checking = true;
    try {
      const grants = await contexts([channel.bindingId], 'preferred').catch(() => []);
      if (stopped || channel !== current) return;
      const grant = grants.find(value => value?.bindingId === channel.bindingId && value.archiveLane === 'cloud');
      channel.cloud = grant ? cloud.bind(grant) : null;
      channel.routeExpiresAt = channel.cloud ? Date.now() + 75_000 : 0;
    } finally {
      channel.checking = false;
    }
  }
  const refresh = () => { void refreshRoute(current).catch(() => {}); };
  const timer = setInterval(refresh, 60_000);
  addEventListener('online', refresh);
  return {
    bind(context) {
      if (stopped) return null;
      const legacy = collector.bind(context);
      if (!legacy) return null;
      const { bindingId } = context;
      const channel = current?.bindingId === bindingId ? current : { bindingId, routeExpiresAt: 0 };
      if (channel !== current) {
        current = channel;
        cloud.recoverFor(bindingId);
        refresh();
      }
      const active = () => Date.now() < channel.routeExpiresAt ? channel.cloud ?? legacy : legacy;
      return {
        queued: (...args) => active().queued(...args),
        begin: (...args) => active().begin(...args),
        observe: (...args) => active().observe(...args),
      };
    },
    stop() {
      stopped = true;
      current = null;
      clearInterval(timer);
      removeEventListener('online', refresh);
      collector.stop();
      cloud.stop();
    },
  };
}
