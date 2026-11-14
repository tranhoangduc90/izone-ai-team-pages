import { createRecorder, fetchTransport } from '../shared/exam-journal/recorder.mjs?v=20261109-term1-writing-v1';
import { IndexedOutbox } from '../shared/exam-journal/outbox.mjs';

const signalName = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : undefined;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : undefined;
const measured = (value, scale = 1) => Number.isFinite(value) && value >= 0 ? Math.round(value * scale) : undefined;
const flag = value => typeof value === 'boolean' ? value : undefined;
const scopeKey = identity => identity ? `${identity.attemptId}:${identity.generation}` : '';

export function createListeningJournal({ endpoint, build, getIdentity, getMedia }) {
  let binding, owner = '', connecting, nextTry = 0, flushTimer;
  const queued = [];
  const outbox = new IndexedOutbox({ name: `substitute-skill-listening:${endpoint}` });
  const recorder = createRecorder({ outbox, context: () => binding, transport: fetchTransport(endpoint + '/journal-events'), build,
    onHealth: health => {
      if (health.pendingReauthorization && health.expiredBindingId === binding?.bindingId) { binding = null; nextTry = 0; }
    } });

  function scope() {
    const identity = getIdentity();
    const key = scopeKey(identity);
    if (owner !== key) { owner = key; binding = null; queued.length = 0; nextTry = 0; }
    return identity;
  }

  function schedule() {
    flushTimer ??= setTimeout(() => { flushTimer = undefined; void flush().catch(() => {}); }, 750);
  }

  async function flush(options) {
    const identity = scope();
    if (!identity) return;
    if (!binding && !connecting && Date.now() >= nextTry) {
      const key = owner;
      connecting = (async () => {
        try {
          const response = await fetch(endpoint + '/journal-context', { method: 'POST', credentials: 'omit', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity), signal: AbortSignal.timeout(1500) });
          const ticket = await response.json();
          if (!response.ok || ticket.ok !== true || !/^[a-f0-9]{64}$/.test(ticket.bindingId) ||
              !ticket.ticket || !ticket.ticketId || scopeKey(getIdentity()) !== key || key !== owner) return;
          const auth = { ticket: ticket.ticket, ticketId: ticket.ticketId, issuedAt: ticket.issuedAt, expiresAt: ticket.expiresAt };
          binding = { bindingId: ticket.bindingId, auth };
          void outbox.renewBinding(binding.bindingId, auth).catch(() => {});
          for (const event of queued.splice(0)) recorder.record(event.type, event.data);
          schedule();
        } catch { /* Keep the latest observations queued until the route is reachable. */ }
        finally { nextTry = Date.now() + 5000; connecting = null; }
      })();
    }
    if (binding || options?.keepalive) await recorder.flush(options);
  }

  function emit(action, detail = {}) {
    try {
      if (!scope()) return;
      const media = detail.audioAfter || detail.audioBefore || getMedia() || {};
      const checkpointState = {
        skillListeningObservationVersion: 1,
        positionMs: measured(detail.positionMs) ?? measured(media.playerCurrentTime, 1000),
        durationMs: measured(detail.elapsedMs), ageMs: measured(detail.ageMs ?? media.lastAdvanceAgeMs),
        paused: flag(media.paused), muted: flag(media.muted), volume: measured(media.volume, 1000),
        rate: measured(media.playbackRate, 1000), ended: flag(media.ended), readyState: measured(media.readyState),
        mediaErrorCode: measured(media.mediaErrorCode), visibility: signalName(document.visibilityState), online: navigator.onLine,
        phase: signalName(detail.phase ?? media.controllerStateBefore),
        source: signalName(detail.assetId ?? media.sourceKind), requestId: uuid(detail.requestId), commandId: uuid(detail.commandId),
        nativeReason: signalName(detail.nativeReason), mediaReason: signalName(detail.mediaReason ?? detail.reason),
        operationId: uuid(detail.operationId), receiptId: uuid(detail.receiptId), http: measured(detail.http),
        audioEndedAtMs: measured(detail.audioEndedAtMs), deadlineAtMs: measured(detail.deadlineAtMs), revision: measured(detail.revision),
        automatic: flag(detail.automatic), persisted: flag(detail.persisted)
      };
      const type = /^(receipt|submit|seal)_/.test(action) ? 'submission_observed' :
        /^(owner|start)_/.test(action) ? 'state_observed' : 'audio_observed';
      const event = { type, data: { section: 'listening', cause: 'substitute_skill_listening', action,
        reasonCode: signalName(detail.errorCode ?? detail.code), operationStatus: signalName(detail.outcome), checkpointState } };
      if (binding) recorder.record(type, event.data);
      else { queued.push(event); if (queued.length > 48) queued.shift(); }
      schedule();
    } catch { /* The product owns media, timer and submission decisions. */ }
  }

  window.addEventListener('online', () => { nextTry = 0; void flush().catch(() => {}); });
  window.addEventListener('pagehide', () => { void flush({ force: true, keepalive: true }).catch(() => {}); });
  setInterval(() => { void flush().catch(() => {}); }, 5000);
  return { emit, flush };
}
