const BUILD='reading-retake-20261106-v1',CACHE='reading-retake:'+BUILD,BASE=new URL('./',self.location).href;
const REVIEW = new URL('../ic2311-retake-review/?skill=reading', BASE).href;
const API = 'https://ducizone.ddns.net/api/reading-retake/v1/';

function savedAttempt() {
  return new Promise(resolve => {
    const request = indexedDB.open('izone-reading-retake-v1', 1);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      try {
        const transaction = db.transaction('records');
        const row = transaction.objectStore('records').get('current');
        row.onsuccess = () => resolve(row.result ?? null);
        row.onerror = () => resolve(null);
        transaction.oncomplete = transaction.onabort = () => db.close();
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

function isExam(url) {
  const value = new URL(url);
  return (value.origin + value.pathname === BASE || value.origin + value.pathname === BASE + 'index.html') &&
    value.searchParams.get('result') !== '0';
}

function isConfirmed(state) {
  return state?.phase === 'submitted' && state.serverConfirmed === true && !state.pending &&
    typeof state.receipt === 'string' && state.permit && state.identity?.classCode === 'IC2311';
}

async function openResult(clientId, waitForReceipt = false) {
  const client = await self.clients.get(clientId);
  if (!client || !isExam(client.url) || self.navigator.onLine === false) return;
  let attempt = await savedAttempt();
  if (attempt?.phase !== 'submitted') return;
  const id = attempt.identity?.attemptId;
  for (let retry = 0; waitForReceipt && !isConfirmed(attempt) && retry < 20; retry++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    attempt = await savedAttempt();
    if (attempt?.identity?.attemptId !== id || attempt.phase !== 'submitted') return;
  }
  if (isConfirmed(attempt)) {
    const latest = await self.clients.get(clientId);
    if (latest && isExam(latest.url)) await latest.navigate(REVIEW).catch(() => {});
  }
}

// The exam shell and verification protocol are still the v1 bundle. This update
// only routes a locally confirmed submission to the independent results page.
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  await self.clients.claim();
  if (isConfirmed(await savedAttempt())) {
    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.allSettled(clients.map(client => openResult(client.id)));
  }
})()));
self.addEventListener('message',e=>{if(e.data?.type==='VERIFY')e.waitUntil((async()=>{const c=await caches.open(CACHE),ok=e.data.build===BUILD&&(await Promise.all(e.data.paths.map(p=>c.match(p)))).every(Boolean);e.ports[0]?.postMessage({ok,build:BUILD});})());if(e.data?.type==='ACTIVATE_WHEN_IDLE')self.skipWaiting();});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if (e.request.method === 'POST' && [API + 'snapshot', API + 'operation-status'].includes(u.href)) {
   e.waitUntil(openResult(e.clientId, true).catch(() => {}));
   return;
 }
 if(e.request.method!=='GET'||!u.href.startsWith(BASE)||u.pathname.includes('/teacher'))return;
 e.respondWith((async()=>{
   if (e.request.mode === 'navigate' && isExam(u.href) && self.navigator.onLine !== false && isConfirmed(await savedAttempt())) {
     return Response.redirect(REVIEW, 302);
   }
   const cache=await caches.open(CACHE);
   const key=e.request.mode==='navigate'?BASE+'index.html':u.href;
   const hit=await cache.match(key);
   return hit||fetch(e.request);
 })());
});
