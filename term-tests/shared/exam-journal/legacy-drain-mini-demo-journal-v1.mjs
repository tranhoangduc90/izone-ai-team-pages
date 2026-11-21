import { IndexedOutbox } from './outbox.mjs';
import { fetchTransport } from './recorder.mjs?v=20261109-term1-writing-v1';
import { sendSealedBatch } from './sealed-batch.mjs';

export function createMiniDemoLegacyDrain({ target, fetcher, getCurrent, getProof, onHealth }) {
  const name = 'izone-exam-journal-v2:' + target.origin + target.pathname;
  const sendCollector = fetchTransport(target.href + '/journal-collector-sealed', fetcher);
  let legacy, busy = false, closed = false, nextCheck = 0;

  async function flush({ keepalive = false } = {}) {
    if (keepalive || busy || closed || globalThis.navigator?.onLine === false) return { acknowledgedCount: 0 };
    const current = getCurrent();
    const proof = getProof();
    if (!current || !(proof.examSessionToken || proof.attemptToken)) return { acknowledgedCount: 0 };
    const usable = () => !closed && current === getCurrent();
    busy = true;
    try {
      if (!legacy) {
        if (performance.now() < nextCheck || typeof globalThis.indexedDB?.databases !== 'function') return { acknowledgedCount: 0 };
        nextCheck = performance.now() + 30_000;
        const databases = await indexedDB.databases();
        if (!usable() || !databases.some(database => database.name === name)) return { acknowledgedCount: 0 };
        legacy = new IndexedOutbox({ name });
      }
      const original = await legacy.nextBatch({ maxCount: 40, maxBytes: 96 * 1024 });
      if (!original?.events.length || !usable()) return { acknowledgedCount: 0 };
      const { bindingId } = original;
      const auth = original.auth.expiresAt > Date.now() ? original.auth : bindingId === current.bindingId ? current.auth : null;
      if (!auth || auth.expiresAt <= Date.now()) {
        await legacy.blockContext(bindingId, original.auth.ticketId);
        onHealth({ status: 'degraded', errorCode: 'LEGACY_SCOPE_REAUTHORIZATION_REQUIRED', pendingScopeId: bindingId });
        return { acknowledgedCount: 0 };
      }
      // This outbox predates the DEMO Worker. Its sealed batches stay on Collector.
      const canSend = () => usable() && auth.expiresAt > Date.now();
      const acknowledgedCount = await sendSealedBatch(legacy, bindingId, auth, (body, request) => {
        if (request.destination !== 'collector-v1' || !canSend()) throw Error('LEGACY_SCOPE_CHANGED');
        return sendCollector(body, request);
      }, canSend);
      return { acknowledgedCount };
    } catch {
      onHealth({ status: 'degraded', errorCode: 'LEGACY_OUTBOX_DRAIN_FAILED' });
      return { acknowledgedCount: 0 };
    } finally { busy = false; }
  }

  return { flush, async close() { closed = true; if (legacy) await legacy.close(); } };
}
