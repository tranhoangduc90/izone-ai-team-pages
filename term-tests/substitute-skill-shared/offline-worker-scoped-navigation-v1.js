'use strict';
const scope=new URL(self.registration.scope);
const entry=new URL('index.html',scope);
const testId=scope.pathname.split('/').filter(Boolean).at(-1);
const build=new URL(self.location.href).searchParams.get('build');
const cacheName='substitute-skill:'+testId+':'+build;

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 const navigation=request.mode==='navigate';
 const ownEntry=navigation&&(url.pathname===scope.pathname||url.pathname===entry.pathname);
 // The verified manifest stores the entry without query. Keep the original
 // URL for navigation and for the controller's class and DEMO checks.
 const candidate=ownEntry?entry.href:url.href;
 event.respondWith((async()=>{
  const cache=await caches.open(cacheName);
  if(navigation||request.cache==='reload'||url.searchParams.has('issue611Build')){
   try{return await fetch(request);}
   catch{return await cache.match(candidate)||Response.error();}
  }
  return await cache.match(candidate)||fetch(request);
 })());
});
