import {journalRecorderCache} from '../term-test-1-k56-computer-based/journal-recorder-cache-v1.mjs';
import { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } from './offline-assets-student-cache-v2-preview-verified-v1-confirmed-departure-v1-listening-recovery-v1-durable-journal-v1-resume-ready-v1-online-media-v1.mjs';

const build='term2-k67-cbt-shell-v1';
const base=new URL('./',self.location.href);
const cacheName=build+'-parallel-'+ASSET_BUILD_ID;
const entry='index-student-cache-v2-preview-verified-v1-confirmed-departure-v1-listening-recovery-v1-durable-journal-v1-resume-ready-v1-online-media-v1.html';
const assetsByPath=new Set(ASSETS.map(asset=>new URL(asset,base).pathname));
const url=asset=>new URL(asset,base);

async function verify(response,asset) {
  if (!response?.ok) throw Error('Thiếu tài nguyên '+asset);
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()));
  const digest=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  if (digest!==ASSET_HASHES[asset]) throw Error('Tài nguyên chưa khớp bản bài thi '+asset);
  return response;
}

const journal=journalRecorderCache({assets:ASSETS,assetBuildId:ASSET_BUILD_ID,url,verify});

self.addEventListener('install', event=>event.waitUntil((async()=>{
  const cache=await caches.open(cacheName);
  const required=journal.requiredAssets;
  for (let index=0;index<required.length;index+=6) {
    await Promise.all(required.slice(index,index+6).map(async asset=>{
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
      for (const asset of journal.requiredAssets) await verify(await cache.match(url(asset)),asset);
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
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached)return cached;
    if(journal.handles(target.pathname))return (await journal.get(cache)) ?? new Response(null,{status:503});
    return fetch(request);
  })());
});
