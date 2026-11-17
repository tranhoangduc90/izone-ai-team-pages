// Mỗi sự kiện có scope bất biến. Chỉ giữ vé ghi log giới hạn scope, không giữ token thi.
export class IndexedOutbox {
  constructor({ indexedDB = globalThis.indexedDB, name = 'izone-exam-journal-v1', maxBytes = 16 * 1024 * 1024 } = {}) {
    this.maxBytes = maxBytes;
    this.ready = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(new Error('OUTBOX_UNAVAILABLE')); return; }
      const request = indexedDB.open(name, 2);
      request.onupgradeneeded = () => {
        const db = request.result, events = db.objectStoreNames.contains('events') ? request.transaction.objectStore('events')
          : db.createObjectStore('events', { keyPath: 'id' });
        if (!events.indexNames.contains('binding')) events.createIndex('binding', 'binding');
        if (!events.indexNames.contains('context')) events.createIndex('context', 'contextId');
        if (!events.indexNames.contains('queued')) events.createIndex('queued', 'queuedAt');
        if (!db.objectStoreNames.contains('usage')) db.createObjectStore('usage');
        if (!db.objectStoreNames.contains('contexts')) db.createObjectStore('contexts', { keyPath:'id' });
      };
      request.onsuccess = () => { this.db = request.result; this.db.onversionchange = () => this.db.close(); resolve(); };
      request.onerror = () => reject(new Error('OUTBOX_UNAVAILABLE'));
      request.onblocked = () => reject(new Error('OUTBOX_BLOCKED'));
    });
    // The recorder reports readiness failures; opening the module alone never raises an unhandled rejection.
    this.ready.catch(() => {});
  }
  async transaction(callback) {
    await this.ready;
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = this.db.transaction(['events', 'usage', 'contexts'], 'readwrite', { durability: 'strict' }); }
      catch { tx = this.db.transaction(['events', 'usage', 'contexts'], 'readwrite'); }
      let result, failure;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || new Error('OUTBOX_WRITE_FAILED'));
      tx.onerror = () => {};
      try { callback(tx, value => { result = value; }, error => { failure = error; tx.abort(); }); }
      catch (error) { failure = error; tx.abort(); }
    });
  }
  async put(binding, event, auth) {
    await this.putMany([{binding,event,auth}]);return true;
  }
  async putMany(rows) {
    if(!Array.isArray(rows)||rows.length<1||rows.length>32)throw new Error('OUTBOX_BATCH_INVALID');
    return this.transaction((tx, done, fail) => {
      let index=0;
      const insertRow=({binding,event,auth})=>{
      const events = tx.objectStore('events'),usage = tx.objectStore('usage'),contexts = tx.objectStore('contexts');
      const latest = contexts.get('latest:' + binding);
      latest.onsuccess = () => {
      const effectiveAuth = latest.result?.binding === binding ? latest.result.auth : auth;
      const contextId = effectiveAuth?.ticket && /^[0-9a-f-]{36}$/i.test(effectiveAuth.ticketId || '') ? effectiveAuth.ticketId : '';
      if (effectiveAuth?.ticket && !contextId) {fail(new Error('OUTBOX_CONTEXT_INVALID'));return;}
      const bytes = new TextEncoder().encode(JSON.stringify(event)).length + binding.length + contextId.length;
      const old = events.get(event.id);
      old.onsuccess = () => {
        if (old.result) {
          if (old.result.binding !== binding || JSON.stringify(old.result.event) !== JSON.stringify(event))
            fail(new Error('OUTBOX_ID_CONFLICT'));
          else next();
          return;
        }
        const read = usage.get('bytes');
        read.onsuccess = () => {
          const used = read.result || 0;
          if (used + bytes > this.maxBytes) { fail(new Error('OUTBOX_BUDGET_REACHED')); return; }
          const insert = (contextBytes = 0) => {
            if (used + bytes + contextBytes > this.maxBytes) { fail(new Error('OUTBOX_BUDGET_REACHED')); return; }
            events.add({ id: event.id, binding, bytes, event,contextId,queuedAt:Date.now() });
            usage.put(used + bytes + contextBytes, 'bytes'); next();
          };
          if (!contextId) { insert(); return; }
          const context = contexts.get(contextId);
          context.onsuccess = () => {
            if (context.result) {
              if (context.result.binding !== binding || JSON.stringify(context.result.auth) !== JSON.stringify(effectiveAuth)) { fail(new Error('OUTBOX_CONTEXT_CONFLICT')); return; }
              insert();
            } else {
              const contextBytes = new TextEncoder().encode(JSON.stringify(effectiveAuth)).length + binding.length + contextId.length;
              if (used + bytes + contextBytes > this.maxBytes) { fail(new Error('OUTBOX_BUDGET_REACHED')); return; }
              contexts.add({ id:contextId,binding,auth:effectiveAuth,bytes:contextBytes }); insert(contextBytes);
            }
          };
        };
      };
      };
      };
      function next(){if(index===rows.length){done(rows.length);return;}insertRow(rows[index++]);}
      next();
    });
  }
  async renewBinding(binding,auth) {
    if (!/^[a-f0-9]{64}$/.test(binding) || !/^[a-f0-9-]{36}$/i.test(auth?.ticketId || '') || typeof auth.ticket !== 'string') throw new Error('OUTBOX_CONTEXT_INVALID');
    return this.transaction((tx,done,fail) => {
      const contexts = tx.objectStore('contexts'),events = tx.objectStore('events'),usage = tx.objectStore('usage'),read = usage.get('bytes');
      read.onsuccess = () => {
        let used = read.result || 0,moved = 0;const allContexts = contexts.openCursor();
        allContexts.onsuccess = () => {
          const cursor = allContexts.result;
          if (cursor) {
            if (cursor.value.binding === binding) {used -= cursor.value.bytes || 0;cursor.delete();}
            cursor.continue();return;
          }
          const contextBytes = new TextEncoder().encode(JSON.stringify(auth)).length + binding.length + auth.ticketId.length;
          const latestBytes = contextBytes + 7;
          if (used + contextBytes + latestBytes > this.maxBytes) {fail(new Error('OUTBOX_BUDGET_REACHED'));return;}
          contexts.put({id:auth.ticketId,binding,auth,bytes:contextBytes});
          contexts.put({id:'latest:' + binding,binding,auth,bytes:latestBytes});used += contextBytes + latestBytes;
          const rows = events.index('binding').openCursor(binding);
          rows.onsuccess = () => {
            const row = rows.result;
            if (!row) {if (used > this.maxBytes) {fail(new Error('OUTBOX_BUDGET_REACHED'));return;}usage.put(Math.max(0,used),'bytes');done({moved});return;}
            const value = row.value,delta = auth.ticketId.length - (value.contextId || '').length;
            used += delta;value.bytes += delta;value.contextId = auth.ticketId;row.update(value);moved++;row.continue();
          };
        };
      };
    });
  }
  async blockContext(binding,contextId) {
    return this.transaction((tx,done) => {
      const contexts = tx.objectStore('contexts'),read = contexts.get(contextId);
      read.onsuccess = () => {if (read.result?.binding === binding) contexts.put({...read.result,blocked:true});done(true);};
    });
  }
  async nextBatch({ maxCount = 100,maxBytes = 256 * 1024 } = {}) {
    await this.ready;
    return new Promise((resolve,reject) => {
      const tx = this.db.transaction(['events','contexts']), events = tx.objectStore('events');
      let result = null;
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(new Error('OUTBOX_READ_FAILED'));
      const first = tx.objectStore('contexts').openCursor();
      first.onsuccess = () => {
        const cursor = first.result; if (!cursor) return;
        if (cursor.value.id.startsWith('latest:') || cursor.value.blocked) {cursor.continue();return;}
        const count = events.index('context').count(cursor.value.id);
        count.onsuccess = () => {
          if (count.result === 0) {cursor.continue();return;}
          result = { bindingId:cursor.value.binding,auth:cursor.value.auth,events:[] };
          let bytes = 0; const rows = events.index('context').openCursor(cursor.value.id);
          rows.onsuccess = () => {
            const row = rows.result; if (!row || result.events.length >= maxCount || bytes + row.value.bytes > maxBytes) return;
            if (row.value.binding !== result.bindingId) {tx.abort();return;}
            result.events.push(row.value.event); bytes += row.value.bytes; row.continue();
          };
        };
      };
      tx.onabort = () => reject(new Error('OUTBOX_CONTEXT_INVALID'));
    });
  }
  async list(binding, { maxCount = 100, maxBytes = 256 * 1024 } = {}) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const result = []; let bytes = 0;
      const tx = this.db.transaction('events'), request = tx.objectStore('events').index('binding').openCursor(binding);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(new Error('OUTBOX_READ_FAILED'));
      request.onsuccess = () => {
        const cursor = request.result; if (!cursor) return;
        if (result.length >= maxCount || bytes + cursor.value.bytes > maxBytes) return;
        result.push(cursor.value.event); bytes += cursor.value.bytes; cursor.continue();
      };
    });
  }
  async acknowledge(binding, ids) {
    return this.transaction((tx, done, fail) => {
      const events = tx.objectStore('events'), usage = tx.objectStore('usage'), read = usage.get('bytes');
      read.onsuccess = () => {
        const unique = [...new Set(ids)]; let used = read.result || 0, remaining = unique.length;
        if (!remaining) { done(0); return; }
        for (const id of unique) {
          const row = events.get(id);
          row.onsuccess = () => {
            if (row.result) {
              if (row.result.binding !== binding) { fail(new Error('OUTBOX_BINDING_MISMATCH')); return; }
              used -= row.result.bytes; events.delete(id);
              if (row.result.contextId) {
                const contextId = row.result.contextId, count = events.index('context').count(contextId);
                count.onsuccess = () => {
                  if (count.result !== 0) return;
                  const contexts = tx.objectStore('contexts'), context = contexts.get(contextId);
                  context.onsuccess = () => { if (context.result) { used -= context.result.bytes; contexts.delete(contextId); usage.put(Math.max(0,used),'bytes'); } };
                };
              }
            }
            if (--remaining === 0) { usage.put(Math.max(0, used), 'bytes'); done(ids.length); }
          };
        }
      };
    });
  }
  async size() {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('usage'), read = tx.objectStore('usage').get('bytes');
      tx.oncomplete = () => resolve(read.result || 0); tx.onerror = () => reject(new Error('OUTBOX_READ_FAILED'));
    });
  }
  async close() { await this.ready; this.db.close(); }
}
