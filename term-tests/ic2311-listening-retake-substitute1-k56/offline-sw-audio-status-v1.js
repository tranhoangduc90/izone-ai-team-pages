const CACHE='ic2311-listening-retake-shell-20261110-k56-picker-v1-20261111-audio-status-v1-20261112-submission-reconciliation-20261114-retake-log-v1';
const PREVIOUS_CACHES=['ic2311-listening-retake-shell-20261110-k56-picker-v1-20261111-audio-status-v1-20261112-submission-reconciliation','ic2311-listening-retake-shell-20261110-k56-picker-v1-20261111-audio-status-v1','ic2311-listening-retake-shell-20261110-k56-picker-v1'];
const shell=new URL('./',self.location.href);
const project=new URL('../../',shell);
const preparedMarker=new URL('offline-sw-audio-status-v1.js?shell-prepared=1',shell);
const isStatic=url=>url.origin===shell.origin&&url.pathname.startsWith(project.pathname)&&
 /\.(?:m?js|css|png|svg|woff2?|webp)$/.test(url.pathname)&&!url.pathname.includes('/api/');
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.add(new Request(shell.href,{cache:'reload'}))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('message',event=>{
 if(event.data?.type!=='PREPARE_LISTENING_SHELL'||!event.ports?.[0]||!Array.isArray(event.data.urls))return;
 const urls=[...new Set(event.data.urls)].slice(0,96).filter(value=>{
  try{return isStatic(new URL(value));}catch{return false;}
 });
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const results=await Promise.allSettled(urls.map(url=>cache.add(new Request(url,{cache:'reload'}))));
  const ok=urls.length>0&&results.every(result=>result.status==='fulfilled');
  if(ok)await cache.put(preparedMarker,new Response('ready'));
  event.ports[0].postMessage({ok});
 }).catch(()=>event.ports[0].postMessage({ok:false})));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==shell.origin)return;
 const entry=request.mode==='navigate'&&(url.pathname===shell.pathname||url.pathname===shell.pathname+'index.html');
 if(!entry&&!isStatic(url))return;
 event.respondWith(fetch(request).catch(async error=>{
  const cache=await caches.open(CACHE);
  if(entry&&!await cache.match(preparedMarker)){
   for(const cacheName of PREVIOUS_CACHES){
    if(cacheName===PREVIOUS_CACHES[0]&&!await caches.match(preparedMarker,{cacheName}))continue;
    const previousEntry=await caches.match(shell.href,{cacheName});
    if(previousEntry)return previousEntry;
   }
  }
  const cached=await cache.match(entry?shell.href:request);
  if(cached)return cached;
  // Match the exact original asset URL for tabs opened before the update.
  if(!entry){
   for(const cacheName of PREVIOUS_CACHES){
    const previous=await caches.match(request,{cacheName});
    if(previous)return previous;
   }
  }
  throw error;
 }));
});
