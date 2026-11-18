const encoder = new TextEncoder();
const storageByDestination = Object.freeze({ 'collector-v1': 'collector', 'pubsub-v1': 'pubsub' });
const originalDestination = 'collector-v1';

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

async function sha(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonical(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Read-only selection followed by compare-and-store. A concurrent tab can win the
// transaction, in which case both tabs use the winner's immutable record.
async function reserve(outbox, binding, key, destination, selectBatch) {
  const ready = await outbox.list(binding, { maxCount: 40, maxBytes: 96 * 1024 });
  const plan = selectBatch ? selectBatch(ready) : { destination, count: ready.length };
  if (!Number.isSafeInteger(plan.count) || plan.count < 0 || plan.count > ready.length
    || (ready.length && plan.count === 0) || !Object.hasOwn(storageByDestination, plan.destination)
    || (plan.pilotId !== undefined && (plan.destination !== 'pubsub-v1' || typeof plan.pilotId !== 'string'
      || !/^[A-Za-z0-9_-]{1,40}$/.test(plan.pilotId)))) {
    throw Error('INVALID_JOURNAL_BATCH_SELECTION');
  }
  const events = ready.slice(0, plan.count);
  const ids = events.map(event => event.id).sort();
  const batch = events.length ? {
    batchId: await sha([binding, ids]), eventPayloadSha256: await sha(events), events, ids, destination: plan.destination,
    ...(plan.pilotId ? { pilotId: plan.pilotId } : {})
  } : null;
  const bytes = batch ? encoder.encode(JSON.stringify(batch)).length + key.length + 32 : 0;
  return outbox.transaction((tx, done, fail) => {
    const usage = tx.objectStore('usage');
    const existing = usage.get(key);
    existing.onsuccess = () => {
      if (existing.result || !batch) { done(existing.result ?? null); return; }
      const store = tx.objectStore('events');
      let pending = events.length;
      let changed = false;
      for (const event of events) {
        const request = store.get(event.id);
        request.onsuccess = () => {
          const row = request.result;
          if (!row || row.binding !== binding || canonical(row.event) !== canonical(event)) changed = true;
          if (--pending) return;
          if (changed) { done(null); return; }
          const used = usage.get('bytes');
          used.onsuccess = () => {
            if ((used.result || 0) + bytes > outbox.maxBytes) { fail(Error('OUTBOX_BATCH_BUDGET_REACHED')); return; }
            const record = { ...batch, bytes };
            usage.put(record, key);
            usage.put((used.result || 0) + bytes, 'bytes');
            done(record);
          };
        };
      }
    };
  });
}

function settle(outbox, binding, key, batch) {
  return outbox.transaction((tx, done, fail) => {
    const usage = tx.objectStore('usage');
    const current = usage.get(key);
    current.onsuccess = () => {
      if (!current.result || current.result.batchId !== batch.batchId) { done(false); return; }
      if (current.result.eventPayloadSha256 !== batch.eventPayloadSha256) { fail(Error('SEALED_BATCH_HASH_CHANGED')); return; }
      if ((current.result.destination ?? originalDestination) !== (batch.destination ?? originalDestination)) {
        fail(Error('SEALED_BATCH_DESTINATION_CHANGED')); return;
      }
      if (current.result.pilotId !== batch.pilotId) { fail(Error('SEALED_BATCH_PILOT_CHANGED')); return; }
      const events = tx.objectStore('events');
      const contexts = tx.objectStore('contexts');
      let pending = batch.ids.length;
      let eventBytes = 0;
      const candidateContexts = new Set();
      function finish() {
        const used = usage.get('bytes');
        used.onsuccess = () => {
          usage.put(Math.max(0, (used.result || 0) - eventBytes - current.result.bytes), 'bytes');
          usage.delete(key);
          done(true);
        };
      }
      function cleanContexts() {
        let left = candidateContexts.size;
        if (!left) { finish(); return; }
        const next = () => { if (--left === 0) finish(); };
        for (const id of candidateContexts) {
          const count = events.index('context').count(id);
          count.onsuccess = () => {
            if (count.result !== 0) { next(); return; }
            const row = contexts.get(id);
            row.onsuccess = () => {
              if (row.result?.binding === binding) { eventBytes += row.result.bytes; contexts.delete(id); }
              next();
            };
          };
        }
      }
      for (const id of batch.ids) {
        const row = events.get(id);
        row.onsuccess = () => {
          if (row.result) {
            if (row.result.binding !== binding) { fail(Error('SEALED_BATCH_SCOPE_MISMATCH')); return; }
            eventBytes += row.result.bytes;
            events.delete(id);
            if (row.result.contextId) candidateContexts.add(row.result.contextId);
          }
          if (--pending === 0) cleanContexts();
        };
      }
    };
  });
}

function retainPriorGrant(outbox, key, batch, proof) {
  if (!Number.isSafeInteger(proof?.issuedAt) || typeof proof.ticket !== 'string'
      || proof.ticket.length === 0 || proof.ticket.length > 8192) throw Error('INVALID_SEALED_GRANT');
  const priorGrant = { issuedAt: proof.issuedAt, ticket: proof.ticket };
  return outbox.transaction((tx, done) => {
    const usage = tx.objectStore('usage');
    const current = usage.get(key);
    current.onsuccess = () => {
      const saved = current.result;
      if (!saved || saved.batchId !== batch.batchId
          || saved.eventPayloadSha256 !== batch.eventPayloadSha256
          || saved.destination !== 'pubsub-v1' || saved.pilotId !== batch.pilotId || saved.priorGrant) {
        done(false);
        return;
      }
      const used = usage.get('bytes');
      used.onsuccess = () => {
        const growth = encoder.encode(JSON.stringify({priorGrant})).length;
        const total = (used.result || 0) + growth;
        if (total > outbox.maxBytes) { done(false); return; }
        usage.put({ ...saved, priorGrant, bytes: saved.bytes + growth }, key);
        usage.put(total, 'bytes');
        done(true);
      };
    };
  });
}

export async function sendSealedBatch(outbox, binding, auth, send, usable, { keepalive = false, destination = originalDestination,
  selectBatch } = {}) {
  if (!Object.hasOwn(storageByDestination, destination)) throw Error('UNKNOWN_JOURNAL_DESTINATION');
  const key = 'sealed-batch-v1:' + binding;
  const batch = await reserve(outbox, binding, key, destination, selectBatch);
  if (!batch || !usable()) return 0;
  const pinnedDestination = batch.destination ?? originalDestination;
  if (!Object.hasOwn(storageByDestination, pinnedDestination)) throw Error('UNKNOWN_JOURNAL_DESTINATION');
  const { batchId, eventPayloadSha256, events, ids } = batch;
  const body = { schemaVersion: 1, bindingId: binding, auth, batchId, eventPayloadSha256, events };
  if (keepalive && encoder.encode(JSON.stringify(body)).length > 60 * 1024) return 0;
  const ack = await send(body, { keepalive, destination: pinnedDestination,
    ...(batch.pilotId ? { pilotId: batch.pilotId, priorGrant: batch.priorGrant,
      retainPriorGrant: proof => retainPriorGrant(outbox, key, batch, proof) } : {}) });
  const exact = ack?.ok === true && ack.persisted === true && ack.storage === storageByDestination[pinnedDestination] && ack.scopeId === binding
    && ack.batchId === batchId && ack.eventPayloadSha256 === eventPayloadSha256
    && (pinnedDestination !== 'pubsub-v1' || typeof ack.messageId === 'string' && /^\d+$/.test(ack.messageId))
    && Array.isArray(ack.acknowledgedIds) && canonical([...ack.acknowledgedIds].sort()) === canonical(ids);
  if (!exact) throw Error('SEALED_BATCH_ACK_MISMATCH');
  await settle(outbox, binding, key, batch);
  return ids.length;
}
