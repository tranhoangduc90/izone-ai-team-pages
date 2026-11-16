import { IndexedOutbox } from '../term-tests/shared/exam-journal/outbox.mjs?v=20261117-speaking-cloud-r1';

const prefix = 'speaking-sealed:';
const totalKey = 'speaking-seal-bytes';
const sealKey = (binding, lane) => prefix + binding + (lane === undefined ? '' : ':' + lane);

function removeSeal(usage, key, bytes) {
  const total = usage.get(totalKey);
  total.onsuccess = () => {
    usage.delete(key);
    usage.put(Math.max(0, (total.result ?? 0) - bytes), totalKey);
  };
}

// Legacy tabs can leave snapshots behind after ACKing all their original rows.
// Reclaim those snapshots when space is needed, without dropping a partial batch.
function reclaimSeals(usage, events, done) {
  const cursorRequest = usage.openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
  let reclaimed = 0;
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) { done(reclaimed); return; }
    const seal = cursor.value;
    const reads = seal.events.map(event => events.getKey(event.id));
    reads.at(-1).onsuccess = () => {
      if (reads.every(read => read.result === undefined)) {
        cursor.delete();
        reclaimed += seal.bytes;
      }
      cursor.continue();
    };
  };
}

export class SpeakingDurableOutbox extends IndexedOutbox {
  acknowledge(binding, ids) {
    return super.acknowledge(binding, ids, (usage, acknowledged) => {
      for (const lane of [undefined, 'cloud', 'collector']) {
        const key = sealKey(binding, lane);
        const sealed = usage.get(key);
        sealed.onsuccess = () => {
          const seal = sealed.result;
          if (seal?.events.length === acknowledged.size && seal.events.every(event => acknowledged.has(event.id))) {
            removeSeal(usage, key, seal.bytes);
          }
        };
      }
    });
  }

  nextBatch({ maxCount = 100, maxBytes = 256 * 1024 } = {}) {
    const maxSnapshotBytes = this.maxBytes;
    return this.transaction((tx, done, fail) => {
      const events = tx.objectStore('events');
      const contexts = tx.objectStore('contexts');
      const usage = tx.objectStore('usage');
      const candidates = contexts.openCursor();
      let budgetReached = false;
      let reclaimed = false;
      candidates.onsuccess = () => {
        const context = candidates.result;
        if (!context) {
          if (budgetReached) fail(new Error('SPEAKING_SEAL_BUDGET_REACHED'));
          else done(null);
          return;
        }
        const { id, binding, auth, blocked } = context.value;
        if (id.startsWith('latest:') || blocked) { context.continue(); return; }
        const count = events.index('context').count(id);
        count.onsuccess = () => {
          if (count.result === 0) { context.continue(); return; }
          const lane = auth?.archiveLane;
          if (lane !== undefined && lane !== 'cloud' && lane !== 'collector') {
            fail(new Error('SPEAKING_OUTBOX_ROUTE_INVALID'));
            return;
          }
          const key = sealKey(binding, lane);
          const sealed = usage.get(key);
          sealed.onsuccess = () => {
            if (sealed.result) { done({ bindingId: binding, auth, events: sealed.result.events }); return; }
            if (lane === undefined) { available(new Set()); return; }
            const other = usage.get(sealKey(binding, lane === 'cloud' ? 'collector' : 'cloud'));
            other.onsuccess = () => available(new Set(other.result?.events.map(event => event.id)));
          };
          function available(reserved) {
            const total = usage.get(totalKey);
            total.onsuccess = () => {
              const used = total.result ?? 0;
              if (!reclaimed && used + maxBytes + 128 > maxSnapshotBytes) {
                reclaimed = true;
                reclaimSeals(usage, events, bytes => {
                  usage.put(used - bytes, totalKey);
                  select(used - bytes, reserved);
                });
              } else select(used, reserved);
            };
          }
          function select(used, reserved) {
            const cursorRequest = events.index('context').openCursor(id);
            const selected = [];
            let bytes = 0;
            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;
              if (cursor && reserved.has(cursor.value.id)) { cursor.continue(); return; }
              if (cursor && selected.length < maxCount && bytes + cursor.value.bytes <= maxBytes &&
                  used + bytes + cursor.value.bytes + 128 <= maxSnapshotBytes) {
                if (cursor.value.binding !== binding) { fail(new Error('OUTBOX_CONTEXT_INVALID')); return; }
                selected.push(cursor.value.event);
                bytes += cursor.value.bytes;
                cursor.continue();
                return;
              }
              if (selected.length === 0) {
                if (cursor) budgetReached = true;
                context.continue();
                return;
              }
              // Store the exact packet as well as the source rows so an older
              // tab can delete some ACKed rows without changing this retry.
              const snapshotBytes = bytes + 128;
              usage.put({ events: selected, bytes: snapshotBytes }, key);
              usage.put(used + snapshotBytes, totalKey);
              done({ bindingId: binding, auth, events: selected });
            };
          }
        };
      };
    });
  }
}
