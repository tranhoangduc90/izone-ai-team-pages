'use strict';
const testId=new URL(self.registration.scope).pathname.split('/').filter(Boolean).at(-1),build=new URL(self.location.href).searchParams.get('build'),cacheName='substitute-skill:'+testId+':'+build;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 // Chỉ tài sản tĩnh đã kiểm hash; không cache roster, permit, bài nộp hoặc API.
 event.respondWith((async()=>{const cache=await caches.open(cacheName);if(event.request.mode==='navigate'&&url.pathname.endsWith('/'))url.pathname+='index.html';if(event.request.mode==='navigate'||event.request.cache==='reload'||url.searchParams.has('issue611Build')){try{return await fetch(event.request);}catch{return await cache.match(url.href)||Response.error();}}return await cache.match(url.href)||fetch(event.request);})());
});
