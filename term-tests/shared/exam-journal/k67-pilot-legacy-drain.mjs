import { IndexedOutbox } from './outbox.mjs';
import { createK67PilotFlush } from './k67-pilot-browser-transport.mjs';
import { fetchTransport } from './recorder.mjs?v=20261109-term1-writing-v1';
import { sendSealedBatch } from './sealed-batch.mjs';

// Open only an existing store under the same product endpoint. Fresh authority
// always comes from the current attempt, including when the legacy row is expired.
export function createK67LegacyDrain(options) {
  const name = 'izone-exam-journal-v2:' + options.target.origin + options.target.pathname;
  const toCollector = fetchTransport(options.target.href + '/journal-collector-sealed', options.fetcher);
  let legacy, send, busy = false, closed = false, nextCheck = 0;

  async function flush(settings = {}) {
    if (settings.keepalive || busy || closed || globalThis.navigator?.onLine === false
      || !options.getCurrent()) return { status: 'deferred', acknowledgedCount: 0 };
    const proof = options.getProof();
    if (!proof.examSessionToken && !proof.attemptToken) return { status: 'no_identity', acknowledgedCount: 0 };
    busy = true;
    try {
      if (!send) {
        if (performance.now() < nextCheck || typeof globalThis.indexedDB?.databases !== 'function') {
          return { status: 'deferred', acknowledgedCount: 0 };
        }
        nextCheck = performance.now() + 30_000;
        const databases = await indexedDB.databases();
        if (closed || !databases.some(database => database.name === name)) return { status: 'ok', acknowledgedCount: 0 };
        legacy = new IndexedOutbox({ name });
        await legacy.ready;
        if (closed) { await legacy.close(); return { status: 'deferred', acknowledgedCount: 0 }; }
        send = createK67PilotFlush({ ...options, outbox: legacy });
      }
      const current = options.getCurrent();
      const recent = await send(settings);
      if (recent.acknowledgedCount || recent.status !== 'ok' || current !== options.getCurrent()) return recent;
      const original = await legacy.nextBatch({ maxCount: 40, maxBytes: 96 * 1024 });
      if (!original?.events.length || !options.getCurrent() || original.bindingId === options.getCurrent().bindingId) return recent;
      const { bindingId, auth } = original;
      if (auth.expiresAt <= Date.now()) {
        await legacy.blockContext(bindingId, auth.ticketId);
        options.onHealth({ status: 'degraded', errorCode: 'LEGACY_SCOPE_REAUTHORIZATION_REQUIRED', pendingScopeId: bindingId });
        return recent;
      }
      const usable = () => !closed && current === options.getCurrent() && auth.expiresAt > Date.now();
      // A still valid ticket may append only to its original scope at the old collector.
      // An expired ticket for another scope never gets a replacement here.
      const count = await sendSealedBatch(legacy, bindingId, auth, (body, request) => {
        if (request.destination !== 'collector-v1' || !usable()) throw Error('LEGACY_SCOPE_CHANGED');
        return toCollector(body, request);
      }, usable, { destination: 'collector-v1' });
      return { ...recent, acknowledgedCount: count };
    } catch {
      options.onHealth({ status: 'degraded', errorCode: 'LEGACY_OUTBOX_DRAIN_FAILED' });
      return { status: 'degraded', acknowledgedCount: 0 };
    } finally { busy = false; }
  }

  return { flush, async close() { closed = true; if (legacy) await legacy.close(); } };
}
