const LATEST_VERIFIED_CACHE='substitute-test-2-k67-verified-shell-journey-20261127-v2';
const CACHE='substitute-test-2-k67-verified-shell-journey-20261127-v3';
const PRIOR_VERIFIED_CACHE='substitute-test-2-k67-verified-shell-20261110-listening-observations-v1-media-review-audio-20261126-v1';
const PRIOR_MEDIA_CACHE='substitute-test-2-k67-shell-20261110-listening-observations-v1-media-review-20261125-v5';
const LAST_RELEASE_CACHE='substitute-test-2-k67-shell-20261110-listening-observations-v1';
const SHELL=new URL('./',self.location.href);
const PINNED_ASSETS={"./":"43e382927517cd4c36e50e280737f9a54dc00a57a45c7f24012b01a8f59fdc4a","../substitute-shared/audio-lobby-20261127-v2.js":"39e8be8de68334ce0eb83deb560344b4abd36c25e4863b615a619ffc551ba5af","../substitute-shared/exam-view-release-player-v1.js":"1416f2ee48208c30cb5bb7ef9d10c0a1248e42b112b6269602c94480d8f3b910","../substitute-shared/exam-timing-t4-listening-clock-v1.js?v=20261014-exam-source-v1&resilience=20261027-v1&eof=20261107-v1&order=20261107-v1&offline=20261107-v2&r2=20261107-v1&eofLog=20261108-v1&continuity=20261110-listening-observations-v1&submission=20261112-v1&startGuard=20261113-v1&eofTrace=20261114-v1":"e8249c72955a9716ee6f9aea5bc1716828dc55018243643edb8a2346c5fc3066","../substitute-assignment-full/assignment-browser-journey-v2.mjs?v=preparation-recovery-20261125":"9a20e33ac444c78758f16bca8fc7e5aad881ff7002e3d2727ffe66d7dd7609c4","../substitute-assignment-full/assignment-student-entry-journey-v2.mjs?v=preparation-recovery-20261125":"4067fcf09edbd76e99c3173d6e1ead29629127babce2110a52678bc283a92782","../substitute-k67-shared/app-first-frame-v1-substitute-review-v1.js":"85f04e421620b7894a935bcf20af23c081c30e2ae1aa46a974b60a4721f19abc","../substitute-k67-shared/app-first-frame-v1-substitute-review-v1.js?v=20261022-listening-recovery-v1&journal=20261024-startup-v2&ej=20261024-production-r1&recovery=20261026-v1&resilience=20261027-v1&status=20261103-t5r1&diagnostics=20261105-v2&sub_trace=20261105-v1&writingSubmit=20261105-v1&blankWriting=20261107-v1&order=20261107-v1&offline=20261107-v2&eofLog=20261108-v1&uiRestore=20261108-v2&handoff=20261108-v1&resultAnchor=20261108-v1&readingHandoff=20261108-v1&continuity=20261110-listening-observations-v1&submission=20261113-capacity-v1&startTrace=20261114-v4&peer=20261125-v4&departure=20261125-v2":"85f04e421620b7894a935bcf20af23c081c30e2ae1aa46a974b60a4721f19abc","../substitute-k67-shared/app-first-frame-v1-substitute-review-v1.js?v=20261022-listening-recovery-v1&journal=20261024-startup-v2&ej=20261024-production-r1&recovery=20261026-v1&resilience=20261027-v1&status=20261103-t5r1&diagnostics=20261105-v2&sub_trace=20261105-v1&writingSubmit=20261105-v1&order=20261107-v1&offline=20261107-v2&eofLog=20261108-v1&uiRestore=20261108-v2&handoff=20261108-v1&resultAnchor=20261108-v1&readingHandoff=20261108-v1&continuity=20261110-listening-observations-v1&submission=20261113-capacity-v1&startTrace=20261114-v4&peer=20261125-v4&departure=20261125-v2":"85f04e421620b7894a935bcf20af23c081c30e2ae1aa46a974b60a4721f19abc","../substitute-shared/media-entry-audio-recovery-v1.js?v=audio-recovery-20261126":"6213db6636a3a17a39d1a4d4a6deb0cdcc36e2b771d5ea40617450ec02b4ade3","bootstrap-journey-20261127-v3.js?v=journey-20261127-v3":"766dfbaca503bb8d2fba12dff807f7e0631e2cd3b94c2818e77619f0bf79033f"};
const pinnedUrls=new Set(Object.keys(PINNED_ASSETS).map(path=>new URL(path,SHELL).href));
async function cacheVerifiedRelease(cache){
 for(const [path,expected] of Object.entries(PINNED_ASSETS)){
  const request=new Request(new URL(path,SHELL),{cache:'reload'});
  const response=await fetch(request);
  if(!response.ok)throw Error('ASSET_UNAVAILABLE');
  const bytes=await response.clone().arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(digest!==expected)throw Error('ASSET_MISMATCH');
  await cache.put(request,response);
 }
}
async function tellCacheDecision(event,outcome){
 try{
  const client=event.clientId?await self.clients.get(event.clientId):null;
  client?.postMessage({type:'SUBSTITUTE_SHELL_CACHE_DECISION',outcome,workerRevision:'media-review-audio-20261127-v1'});
 }catch{}
}

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cacheVerifiedRelease).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(self.clients.claim());
});
self.addEventListener('message',event=>{
 if(event.data?.type!=='PRECACHE'||!Array.isArray(event.data.urls))return;
 const urls=event.data.urls.filter(value=>{try{const url=new URL(value,SHELL);return url.origin===SHELL.origin&&
  !/\.(?:mp3|wav|m4a|enc)$/i.test(url.pathname);}catch{return false;}}).slice(0,80);
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const results=await Promise.allSettled(urls.map(async url=>{
   const request=new Request(new URL(url,SHELL),{cache:'reload'});
   if(!pinnedUrls.has(request.url))return cache.add(request);
   if(!await cache.match(request))throw Error('ASSET_UNAVAILABLE');
  }));
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
  if(event.request.mode!=='navigate'&&pinnedUrls.has(url.href)){
   return (await cache.match(event.request))||Response.error();
  }
  const isEntryNavigation=event.request.mode==='navigate'&&
   (url.pathname===SHELL.pathname||url.pathname===SHELL.pathname+'index.html');
  try{const response=await fetch(event.request);
   if(response.ok&&!isEntryNavigation&&!pinnedUrls.has(url.href))void cache.put(event.request,response.clone());
   return response;
  }catch(error){
   // An earlier release can leave an exact class-query response behind.
   if(isEntryNavigation){
    const verifiedShell=await cache.match(SHELL.href);
    if(verifiedShell){void tellCacheDecision(event,'cached_shell');return verifiedShell;}
   }
   const exact=await cache.match(event.request)||await caches.match(event.request,{cacheName:LATEST_VERIFIED_CACHE})||await caches.match(event.request,{cacheName:PRIOR_VERIFIED_CACHE})||await caches.match(event.request,{cacheName:PRIOR_MEDIA_CACHE})||await caches.match(event.request,{cacheName:LAST_RELEASE_CACHE});
   const cached=exact||await cache.match(event.request,{ignoreSearch:true})||await caches.match(event.request,{cacheName:LAST_RELEASE_CACHE,ignoreSearch:true});
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
