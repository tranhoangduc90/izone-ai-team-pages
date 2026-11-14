import { createRecorder, fetchTransport } from '../shared/exam-journal/recorder.mjs?v=20261109-term1-writing-v1';
import { IndexedOutbox } from '../shared/exam-journal/outbox.mjs';

const signalName = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : undefined;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : undefined;
const measured = (value, scale = 1) => Number.isFinite(value) && value >= 0 ? Math.round(value * scale) : undefined;
const flag = value => typeof value === 'boolean' ? value : undefined;
const scopeKey = identity => identity ? `${identity.attemptId}:${identity.generation}` : '';

export function createSubmissionJournal({ endpoint, build, getIdentity, section }) {
  let binding, owner = '', connecting, nextTry = 0, flushTimer;
  const queued = [];
  const outbox = new IndexedOutbox({ name: `substitute-skill-submission:${endpoint}` });
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
      const checkpointState = {
        skillSubmissionObservationVersion:1,
        operationId:uuid(detail.operationId),receiptId:uuid(detail.receiptId),http:measured(detail.http),
        revision:measured(detail.revision),automatic:flag(detail.automatic),
        startedAtMs:measured(detail.startedAt),deadlineAtMs:measured(detail.deadlineAt),
        task1Length:measured(detail.task1Length),task2Length:measured(detail.task2Length),
        answeredCount:measured(detail.answeredCount)
      };
      const type = /^(receipt|submit|seal)_/.test(action) ? 'submission_observed' : 'state_observed';
      const event = {type, data:{section,cause:'substitute_skill_submission',action,
        reasonCode:signalName(detail.code),checkpointState}};
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
