import { IndexedOutbox } from './outbox.mjs';
import { createRecorder, fetchTransport } from './recorder.mjs?v=20261023-v1';

export function createPretestPaperLegacyDrain({ name, target, fetcher, getCurrent, onHealth }) {
  let outbox, recorder, pending, lastTicket, nextCheck = 0, closed = false;

  async function drain() {
    if (!recorder) {
      if (typeof indexedDB.databases !== 'function' || performance.now() < nextCheck) return;
      nextCheck = performance.now() + 30_000;
      const databases = await indexedDB.databases();
      if (closed || !databases.some(database => database.name === name)) return;
      outbox = new IndexedOutbox({ name });
      recorder = createRecorder({
        outbox, context: getCurrent, build: 'pretest-paper-legacy-drain-v1',
        transport: fetchTransport(target.href + '/journal-events', fetcher),
        onHealth: ({status, errorCode}) => { if (errorCode) onHealth({status, errorCode, legacyOutbox: true}); }
      });
    }
    const current = getCurrent();
    if (current && current.auth.ticketId !== lastTicket) {
      await outbox.renewBinding(current.bindingId, current.auth);
      lastTicket = current.auth.ticketId;
    }
    return recorder.flush();
  }

  return {
    flush() {
      if (closed || !getCurrent() || navigator.onLine === false) return;
      return pending ??= drain().catch(() => {
        onHealth({ status: 'degraded', errorCode: 'PRETEST_PAPER_LEGACY_DRAIN_FAILED' });
      }).finally(() => { pending = undefined; });
    },
    async close() {
      closed = true;
      await pending;
      recorder?.stop();
      await outbox?.close();
    }
  };
}
