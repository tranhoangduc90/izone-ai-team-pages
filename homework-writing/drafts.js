import runtime from './runtime-config.js';
let database;
const volatileBackups=new Map();
let tail = Promise.resolve();
let tabId;try{tabId=sessionStorage.getItem('hw5667-tab')||crypto.randomUUID();sessionStorage.setItem('hw5667-tab',tabId);}catch{tabId=crypto.randomUUID();}
function open() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('homework-writing-5667-local-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export const draftKey = (person, assignment, kind) => [runtime.mode==='online'?'hw5667-online:'+encodeURIComponent(runtime.apiBase):'hw5667-local', person, assignment, kind].join(':');
export async function loadBackup(key) {
  await tail;if(volatileBackups.has(key))return structuredClone(volatileBackups.get(key));const db = await open();
  const get = k => new Promise((resolve, reject) => { const r = db.transaction('drafts').objectStore('drafts').get(k); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  return await get(key + ':tab:' + tabId) || await get(key);
}
export async function listBackups(key) {
  await tail; const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').openCursor(); const rows = [];
    request.onsuccess = () => { const c = request.result; if (!c) return resolve(rows);
      if (String(c.key).startsWith(key + ':tab:') && c.key !== key + ':tab:' + tabId) rows.push(c.value);
      c.continue(); };
    request.onerror = () => reject(request.error);
  });
}
export function saveBackup(key, value) {
  const snapshot = structuredClone(value);
  volatileBackups.set(key,snapshot);
  const run = async () => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(snapshot, key);
      tx.objectStore('drafts').put(snapshot, key + ':tab:' + tabId);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  };
  const next = tail.then(run, run); tail = next.catch(() => {}); return next;
}
export const flushBackups = () => tail;
