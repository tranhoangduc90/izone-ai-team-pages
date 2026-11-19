const leaseMs = 120_000;
const loaded = new Set();
const lost = () => Object.assign(new Error('Phiếu đã mở lại ở tab khác. Bản đã lưu vẫn còn trên máy.'),
  {code:'PAPER_TAB_SCOPE_BUSY'});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function transact(db, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || lost());
    tx.onerror = () => reject(tx.error || lost());
    work(tx.objectStore('records'), value => { result = value; });
  });
}

export async function acquirePaperLock(store, name, {wait = false} = {}) {
  if (navigator.locks?.request) {
    return new Promise((resolve, reject) => {
      navigator.locks.request(name, wait ? {} : {ifAvailable:true}, lock => {
        if (!lock) { resolve(null); return; }
        return new Promise(release => resolve({put:store.put.bind(store),release}));
      }).catch(reject);
    });
  }
  const db = store.db;
  if (!db) return null;
  const leaseKey = '@pretest-paper-lock:' + name;
  const proof = crypto.randomUUID();
  const reloading = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  let tabId;
  try {
    tabId = sessionStorage.getItem(leaseKey) || crypto.randomUUID();
    sessionStorage.setItem(leaseKey, tabId);
  } catch { tabId = null; }
  const alter = mode => transact(db, (records, done) => {
    const request = records.get(leaseKey);
    request.onsuccess = () => {
      const held = request.result;
      const now = Date.now();
      if (mode === 'take' && held?.expiresAt > now && !(reloading && !loaded.has(leaseKey) && tabId && held.tabId === tabId)) return done(false);
      if (mode !== 'take' && held?.proof !== proof) return done(false);
      if (mode === 'take') loaded.add(leaseKey);
      if (mode === 'drop') records.delete(leaseKey);
      else records.put({proof,tabId,expiresAt:now+leaseMs},leaseKey);
      done(true);
    };
  });
  const until = performance.now() + (wait ? 15_000 : 0);
  while (!await alter('take')) {
    if (performance.now() >= until) return null;
    await pause(100);
  }
  const heartbeat = setInterval(() => { void alter('renew').catch(() => {}); }, 15_000);
  return {
    async put(key, value) {
      // Check the lease and save the authoritative record in the same IndexedDB transaction.
      const saved = await transact(db, (records, done) => {
        const owner = records.get(leaseKey);
        owner.onsuccess = () => {
          if (owner.result?.proof !== proof) return done(null);
          const previous = records.get(key);
          previous.onsuccess = () => {
            const copy = {...value,_revision:Math.max(store.revision,previous.result?._revision||0)+1};
            records.put({proof,tabId,expiresAt:Date.now()+leaseMs},leaseKey);
            records.put(copy,key);
            done(copy);
          };
        };
      });
      if (!saved) throw lost();
      store.revision = Math.max(store.revision, saved._revision);
    },
    async release() {
      clearInterval(heartbeat);
      await alter('drop').catch(() => {});
    }
  };
}
