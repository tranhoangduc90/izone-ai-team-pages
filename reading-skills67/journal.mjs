import { startHomeworkJournal } from '../shared/reading-homework-journal.mjs?v=20261117-rh-renew-r1';
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
  return startHomeworkJournal(endpoint, 'reading-homework', {
    Outbox: ReadingOutbox, recorderFactory: createRecorder, durableBatches: true,
    async recoverContexts(bindingIds) {
      const response = await fetch(contextEndpoint, {
        method: 'POST', credentials: 'include', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5_000),
        headers: { 'Content-Type': 'application/json', ...window.Reading67Access?.headers },
        body: JSON.stringify({ bindingIds }),
      });
      if (!response.ok) return [];
      const body = await response.json();
      return Array.isArray(body.contexts) ? body.contexts : [];
    },
  });
}
