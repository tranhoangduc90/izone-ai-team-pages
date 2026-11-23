import { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } from './offline-assets-student-cache-v2-preview-verified-v1.mjs';

const build='term1-k67-cbt-shell-v1';
const base=new URL('./',self.location.href);
const cacheName=build+'-parallel-'+ASSET_BUILD_ID;
const entry='index-student-cache-v2-preview-verified-v1.html';
const assetsByPath=new Set(ASSETS.map(asset=>new URL(asset,base).pathname));
const url=asset=>new URL(asset,base);

async function verify(response,asset) {
  if (!response?.ok) throw Error('Thiếu tài nguyên '+asset);
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()));
  const digest=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  if (digest!==ASSET_HASHES[asset]) throw Error('Tài nguyên chưa khớp bản bài thi '+asset);
  return response;
}

self.addEventListener('install', event=>event.waitUntil((async()=>{
  const cache=await caches.open(cacheName);
  for (let index=0;index<ASSETS.length;index+=6) {
    await Promise.all(ASSETS.slice(index,index+6).map(async asset=>{
      const request=url(asset);
      request.searchParams.set('examBuild',ASSET_BUILD_ID);
      const response=await verify(await fetch(request,{cache:'reload'}),asset);
      await cache.put(url(asset),response);
    }));
  }
  // The verified cache includes the previous client's paths and bytes.
  // Those tabs can keep working when this worker takes control.
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  const port=event.ports[0];
  if (event.data?.type==='ACTIVATE') {
    event.waitUntil(self.skipWaiting().then(()=>port?.postMessage({ok:true})));
  }
  if (event.data?.type==='PREPARE') event.waitUntil((async()=>{
    try {
      const cache=await caches.open(cacheName);
      for (const asset of ASSETS) await verify(await cache.match(url(asset)),asset);
      port?.postMessage({ok:true,build,assetBuildId:ASSET_BUILD_ID});
    } catch (error) { port?.postMessage({ok:false,error:error.message}); }
  })());
});

self.addEventListener('fetch',event=>{
  const {request}=event;
  const target=new URL(request.url);
  if (request.method!=='GET' || target.origin!==base.origin) return;
  const navigation=request.mode==='navigate' && target.pathname.startsWith(base.pathname);
  if (!navigation && !assetsByPath.has(target.pathname)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName);
    if (navigation) {
      try {
        const online=await fetch(request,{cache:'no-store',signal:AbortSignal.timeout(4000)});
        if (online.ok) return online;
      } catch { /* A verified document is ready for offline reload. */ }
      return await cache.match(url(entry)) || Response.error();
    }
    return await cache.match(request,{ignoreSearch:true}) || fetch(request);
  })());
});
