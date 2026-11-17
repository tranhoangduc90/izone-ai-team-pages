import { IndexedOutbox } from '../term-tests/shared/exam-journal/outbox.mjs?v=20261105-diagnostics-v2';
import { createRecorder, fetchTransport } from '../term-tests/shared/exam-journal/recorder.mjs?v=20261105-diagnostics-v2';

const semanticFields = {
  'submit.gate': ['phase', 'validCount', 'totalCount', 'requiredCount', 'minimumPermille', 'allowed'],
  'audio.state': ['phase', 'positionMs', 'bufferedMs', 'volumePermille', 'muted', 'paused', 'readyState', 'networkState', 'ratePermille', 'tabHidden', 'errorCode'],
  'audio.transfer': ['phase', 'assetId', 'expectedHash', 'byteLength', 'source', 'verified', 'errorCode', 'durationMs'],
};
function selectFields(kind, fields) {
  return Object.fromEntries((semanticFields[kind] || []).flatMap(key => {
    const value = fields?.[key];
    if (typeof value === 'boolean' || Number.isSafeInteger(value)) return [[key, value]];
    if (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value)) return [[key, value]];
    return [];
  }));
}

function packet(event) {
  const { id, pageVisitId, sequence, occurredAt, elapsedMs, build, type, data } = event;
  const base = { id, pageVisitId, sequence, occurredAt, elapsedMs, build, dataSchemaVersion: 1 };
  if (type === 'sequence_gap') return {
    ...base, kind: 'capture.health', traceId: id, data: { state: 'sequence_gap', lostCount: data.lostCount },
  };
  if (type === 'storage_degraded') return {
    ...base, kind: 'capture.health', traceId: id, data: { state: 'memory_only' },
  };
  const { kind, traceId, requestId, phase, revision, baseRevision, httpStatus, durationMs, errorCode } = data;
  return {
    ...base, kind, traceId, ...(requestId === undefined ? {} : { requestId }),
    data: data.fields ? selectFields(kind, data.fields)
      : Object.fromEntries(Object.entries({ phase, revision, baseRevision, httpStatus, durationMs, errorCode })
        .filter(([, value]) => value !== undefined)),
  };
}

export function startReadingHomeworkJournal(endpoint) {
  return startHomeworkJournal(endpoint, 'reading-homework');
}

export function startHomeworkJournal(endpoint, product, {
  fetcher = globalThis.fetch, Outbox = IndexedOutbox, recorderFactory = createRecorder, durableBatches = false, recoverContexts, outboxName,
} = {}) {
  if (!['reading-homework', 'listening-homework'].includes(product)) throw Error('JOURNAL_PRODUCT_DENIED');
  const outbox = new Outbox({ name: outboxName ?? 'izone-' + product + '-journal-v1', maxBytes: 2 * 1024 * 1024 });
  const send = fetchTransport(endpoint, fetcher);
  let active = null, recoveryAnchor = null, stopped = false;
  const recorder = recorderFactory({
    outbox, durableBatches, context: () => active,
    build: product + (durableBatches ? '-journal-20261117' : '-journal-20261105'),
    transport: (body, options) => send({ ...body, events: body.events.map(packet) }, options),
  });
  const declinedUntil = new Map();
  let recovering = false, nextRecovery = 0;
  const authFrom = ({ ticket, ticketId, issuedAt, expiresAt }) => ({ ticket, ticketId, issuedAt, expiresAt });
  const valid = context => /^[a-f0-9]{64}$/.test(context?.bindingId || '') && typeof context.ticket === 'string'
    && /^[a-f0-9-]{36}$/i.test(context.ticketId || '') && Number.isSafeInteger(context.expiresAt) && context.expiresAt > Date.now();
  async function renewPending() {
    const now = Date.now();
    if (!recoverContexts || recovering || stopped || !recoveryAnchor || now < nextRecovery) return;
    recovering = true;
    nextRecovery = now + 12_000;
    try {
      const boundAtStart = recoveryAnchor;
      for (const [id, until] of declinedUntil) if (until <= now) declinedUntil.delete(id);
      const ids = await outbox.expiredBindings(now + 60_000, new Set(declinedUntil.keys()));
      if (!ids.length || stopped || recoveryAnchor !== boundAtStart) return;
      const issued = await recoverContexts(ids);
      if (stopped || recoveryAnchor !== boundAtStart) return;
      const updated = new Set();
      for (const context of issued) {
        if (stopped || recoveryAnchor !== boundAtStart) return;
        if (!valid(context) || !ids.includes(context.bindingId) || updated.has(context.bindingId)) continue;
        const auth = authFrom(context);
        await outbox.renewBinding(context.bindingId, auth);
        if (recoveryAnchor === boundAtStart && active?.bindingId === context.bindingId) active.auth = auth;
        updated.add(context.bindingId);
      }
      for (const id of ids) if (!updated.has(id)) declinedUntil.set(id, now + 60_000);
      if (updated.size) await recorder.flush({ force: true });
    } catch {
      // Recovery uses the native API opportunistically. Outbox data stays in
      // place if the request, grant, or local write cannot be proven.
    } finally { recovering = false; }
  }
  const flush = options => {
    if (!options?.keepalive) void renewPending();
    void recorder.flush(options).catch(() => {});
  };
  const online = () => flush({ force: true });
  const pagehide = () => flush({ force: true, keepalive: true });
  const timer = setInterval(() => flush(), 12_000);
  addEventListener('online', online);
  addEventListener('pagehide', pagehide);

  function bind(context) {
    if (stopped || !valid(context)) return null;
    const { bindingId } = context;
    const captured = { bindingId, auth: authFrom(context) };
    active = captured;
    recoveryAnchor = captured;
    void outbox.renewBinding(bindingId, captured.auth).then(renewPending).catch(() => {});
    const emit = data => recorder.record('homework_exchange', data, captured);
    return {
      queued(traceId, baseRevision) {
        emit({ kind: 'draft.exchange', traceId, phase: 'local_queued', baseRevision });
      },
      begin({ kind, traceId, revision, baseRevision }) {
        const requestId = crypto.randomUUID(), started = performance.now();
        const identity = { kind, traceId, requestId, revision, baseRevision };
        emit({ ...identity, phase: 'sent' });
        return (phase, httpStatus, nativeRevision, errorCode) => {
          emit({ ...identity, phase, httpStatus, revision: nativeRevision ?? revision,
            ...(typeof errorCode === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(errorCode) ? { errorCode } : {}),
            durationMs: Math.min(600_000, Math.max(0, Math.round(performance.now() - started))) });
        };
      },
      observe(kind, fields, traceId = crypto.randomUUID()) {
        if (semanticFields[kind]) emit({ kind, fields: selectFields(kind, fields), traceId });
      },
    };
  }

  return {
    bind,
    recoverFor(bindingId) {
      active = null;
      recoveryAnchor = { bindingId };
      void renewPending();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      removeEventListener('online', online);
      removeEventListener('pagehide', pagehide);
      // The old ticket stays with each durable event when the learner changes.
      void recorder.flush({ force: true, keepalive: true }).catch(() => {}).finally(async () => {
        await recorder.stop();
        await recorder.idle();
        await outbox.close();
      }).catch(() => {});
    },
  };
}
