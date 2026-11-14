const CACHE='substitute-test-1-k56-shell-20261110-listening-observations-v1';
const SHELL=new URL('./',self.location.href);
async function tellCacheDecision(event,outcome){
 try{
  const client=event.clientId?await self.clients.get(event.clientId):null;
  client?.postMessage({type:'SUBSTITUTE_SHELL_CACHE_DECISION',outcome,workerRevision:'20261114-v1'});
 }catch{}
}

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.add(SHELL.href)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('substitute-test-1-k56-shell-')&&key!==CACHE)
  .map(key=>caches.delete(key)))),self.clients.claim()]));
});
self.addEventListener('message',event=>{
 if(event.data?.type!=='PRECACHE'||!Array.isArray(event.data.urls))return;
 const urls=event.data.urls.filter(value=>{try{const url=new URL(value,SHELL);return url.origin===SHELL.origin&&
  !/\.(?:mp3|wav|m4a|enc)$/i.test(url.pathname);}catch{return false;}}).slice(0,80);
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const results=await Promise.allSettled(urls.map(url=>cache.add(new Request(url,{cache:'reload'}))));
  event.source?.postMessage({type:'PRECACHE_RESULT',ok:results.every(result=>result.status==='fulfilled'),
   cached:results.filter(result=>result.status==='fulfilled').length,total:results.length});
 }));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==SHELL.origin||event.request.method!=='GET'||/\.(?:mp3|wav|m4a|enc)$/i.test(url.pathname)
  ||url.pathname.includes('/api/')||url.pathname.includes('/webhook/'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const response=await fetch(event.request);
   if(response.ok)void cache.put(event.request,response.clone());
   return response;
  }catch(error){
   const exact=await cache.match(event.request);
   const cached=exact||await cache.match(event.request,{ignoreSearch:true});
   if(cached){
    void tellCacheDecision(event,exact?'cached_exact':'cached_other_revision');
    return cached;
   }
   if(event.request.mode==='navigate'){
    const shell=await cache.match(SHELL.href);
    void tellCacheDecision(event,shell?'cached_shell':'cache_miss');
    return shell;
   }
   throw error;
  }
 })());
});
