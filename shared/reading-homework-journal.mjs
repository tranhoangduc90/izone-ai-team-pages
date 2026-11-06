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

export function startHomeworkJournal(endpoint, product, {fetcher = globalThis.fetch} = {}) {
  if (!['reading-homework', 'listening-homework'].includes(product)) throw Error('JOURNAL_PRODUCT_DENIED');
  const outbox = new IndexedOutbox({ name: 'izone-' + product + '-journal-v1', maxBytes: 2 * 1024 * 1024 });
  const send = fetchTransport(endpoint, fetcher);
  let active = null, stopped = false;
  const recorder = createRecorder({
    outbox, context: () => active, build: product + '-journal-20261105',
    transport: (body, options) => send({ ...body, events: body.events.map(packet) }, options),
  });
  const flush = options => { void recorder.flush(options).catch(() => {}); };
  const online = () => flush({ force: true });
  const pagehide = () => flush({ force: true, keepalive: true });
  const timer = setInterval(() => flush(), 12_000);
  addEventListener('online', online);
  addEventListener('pagehide', pagehide);

  function bind(context) {
    if (stopped || !/^[a-f0-9]{64}$/.test(context?.bindingId || '') || typeof context.ticket !== 'string'
      || !/^[a-f0-9-]{36}$/i.test(context.ticketId || '') || !Number.isSafeInteger(context.expiresAt)
      || context.expiresAt <= Date.now()) return null;
    const { bindingId, ticket, ticketId, issuedAt, expiresAt } = context;
    const captured = { bindingId, auth: { ticket, ticketId, issuedAt, expiresAt } };
    active = captured;
    void outbox.renewBinding(bindingId, captured.auth).catch(() => {});
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
