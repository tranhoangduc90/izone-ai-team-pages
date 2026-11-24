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

function applyDeparture(record, {payload, departure, clock}) {
  const bundle=record?.package;
  if(!record?.ready || !bundle || !record.activatedAt || record.clockInvalid ||
    bundle.examSessionToken!==payload.examSessionToken || bundle.generation!==payload.generation ||
    departure.action!=='native_pagehide' || departure.section!==payload.section) return null;
  const order=bundle.continuationSection?[bundle.continuationSection]
    :bundle.examMode==='read_first'?['reading','listening']:['listening','reading'];
  const section=order.find(skill=>!record.sections[skill]?.operationId);
  const active=record.sections[section];
  const preceding=order[order.indexOf(section)-1];
  if(!active || section!==payload.section || active.startedAt!==payload.startedAt ||
      (preceding?record.sections[preceding].operationId:null)!==payload.previousOperationId ||
      payload.revision<(record.revisions[section]||0))return null;
  active.operationId=payload.operationId;
  record.pending.push(payload);
  record.drafts[section]=payload.answers;
  record.revisions[section]=payload.revision;
  record.departure={...departure,recoveredFromIntent:true};
  if(!record.clock || clock.wall>=record.clock.wall)record.clock=clock;
  return record;
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
  const intentKey=leaseKey+':departure';
  let committedDeparture;
  const readIntent=()=>{
    try{return JSON.parse(localStorage.getItem(intentKey)||'null');}catch{return null;}
  };
  function clearIntent(owner,operationId){
    try{
      const pending=readIntent();
      if(pending?.proof===owner&&pending.payload?.operationId===operationId)localStorage.removeItem(intentKey);
    }catch{}
  }
  const alter = async mode => {
    let transferred;
    const result=await transact(db, (records, done) => {
      const request = records.get(leaseKey);
      request.onsuccess = () => {
        const held = request.result;
        const now = Date.now();
        if (mode !== 'take' && held?.proof !== proof) return done(false);
        const own=()=>{
          if(mode==='take')loaded.add(leaseKey);
          if(mode==='drop')records.delete(leaseKey);
          else records.put({proof,tabId,expiresAt:now+leaseMs},leaseKey);
          done(true);
        };
        if (mode==='take') {
          const stillHeld=held?.expiresAt>now && !(reloading&&!loaded.has(leaseKey)&&tabId&&held.tabId===tabId);
          const intent=readIntent();
          if(held?.proof && intent?.proof===held.proof &&
            name.endsWith(':'+intent.key) && intent.payload?.operationId && intent.departure && intent.clock){
            const saved=records.get(intent.key);
            saved.onsuccess=()=>{
              const current=saved.result;
              const next=applyDeparture(current,intent);
              const committed=current?.sections?.[intent.payload.section]?.operationId===intent.payload.operationId
                && current.package?.examSessionToken===intent.payload.examSessionToken
                && current.package?.generation===intent.payload.generation;
              if(next){
                next._revision=Math.max(store.revision,next._revision||0)+1;
                records.put(next,intent.key);
              }
              transferred=intent;
              if(!next&&!committed&&stillHeld){done(false);return;}
              own();
            };
            return;
          }
          if(stillHeld)return done(false);
          if(intent?.proof&&intent.payload?.operationId)transferred=intent;
        }
        own();
      };
    });
    if(transferred)clearIntent(transferred.proof,transferred.payload.operationId);
    return result;
  };
  const until = performance.now() + (wait ? 15_000 : 0);
  while (!await alter('take')) {
    if (performance.now() >= until) return null;
    await pause(100);
  }
  const heartbeat = setInterval(() => { void alter('renew').catch(() => {}); }, 15_000);
  return {
    stageDeparture(key, intent) {
      try {
        // Pagehide can end before IndexedDB fires. The next lease verifies and applies this operation once.
        const raw=JSON.stringify({key,proof,...intent});
        localStorage.setItem(intentKey,raw);
        return localStorage.getItem(intentKey)===raw;
      }catch{return false;}
    },
    markDepartureCommitted(operationId){committedDeparture=operationId;},
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
      if(committedDeparture || readIntent()?.proof!==proof){
        await alter('drop').catch(() => {});
        if(committedDeparture)clearIntent(proof,committedDeparture);
      }
    }
  };
}
