const BUILD='reading-retake-20261106-v1',CACHE='reading-retake:'+BUILD,BASE=new URL('./',self.location).href;
self.addEventListener('install',e=>{if(!self.registration.active)e.waitUntil(self.skipWaiting());});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{if(e.data?.type==='VERIFY')e.waitUntil((async()=>{const c=await caches.open(CACHE),ok=e.data.build===BUILD&&(await Promise.all(e.data.paths.map(p=>c.match(p)))).every(Boolean);e.ports[0]?.postMessage({ok,build:BUILD});})());if(e.data?.type==='ACTIVATE_WHEN_IDLE')self.skipWaiting();});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||!u.href.startsWith(BASE)||u.pathname.includes('/teacher'))return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);const key=e.request.mode==='navigate'?BASE+'index.html':u.href;const hit=await cache.match(key);return hit||fetch(e.request);})());
});
