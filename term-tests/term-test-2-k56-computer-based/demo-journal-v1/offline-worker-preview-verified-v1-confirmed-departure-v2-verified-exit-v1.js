import {journalRecorderCache} from '../../term-test-1-k56-computer-based/journal-recorder-cache-v1.mjs';
import { ASSETS, ASSET_HASHES, ASSET_BUILD_ID } from './offline-assets-preview-verified-v1-confirmed-departure-v2-verified-exit-v1.mjs';
import { ASSET_HASHES as PRIOR_HASHES, ASSET_BUILD_ID as PRIOR_BUILD } from './offline-assets-preview-verified-v1.mjs';

export function registerDemoExamShell({build,assets,hashes,assetBuildId}){
 const scope=new URL('./',self.location.href);
 const base=new URL('../',scope),cacheName=build+'-demo-journal-'+assetBuildId;
 const url=asset=>new URL(asset,base).href;
 const paths=new Set(assets.map(asset=>new URL(asset,base).pathname));
 const entry='demo-journal-v1/index-preview-verified-v1-confirmed-departure-v2-verified-exit-v1.html';
 async function verify(response,asset){
  if(!response?.ok)throw Error('Thiếu tài nguyên '+asset);
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()));
  const digest=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==hashes[asset])throw Error('Tài nguyên chưa khớp bản bài thi '+asset);
  return response;
 }
 const journal=journalRecorderCache({assets,assetBuildId,url,verify});
 self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(cacheName);
  const priorName=build+'-demo-journal-'+PRIOR_BUILD;
  const prior=await caches.has(priorName)?await caches.open(priorName):null;
  const required=journal.requiredAssets;
  for(let i=0;i<required.length;i+=6)await Promise.all(required.slice(i,i+6).map(async asset=>{
   if (prior && PRIOR_HASHES[asset]===hashes[asset]) {
    try {
     const reused=await verify(await prior.match(url(asset)),asset);
     await cache.put(url(asset),reused);
     return;
    } catch { /* A missing or corrupt old copy needs a verified download. */ }
   }
   const request=new URL(url(asset));
   request.searchParams.set('examBuild',assetBuildId);
   await cache.put(url(asset),await verify(await fetch(request,{cache:'reload'}),asset));
  }));
 })()));
 self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
 self.addEventListener('message',event=>{
  const port=event.ports[0];
  if(event.data?.type==='ACTIVATE')event.waitUntil((async()=>{
   const others=(await self.clients.matchAll({type:'window',includeUncontrolled:true}))
    .filter(client=>client.id!==event.source?.id&&client.url.startsWith(scope.href));
   if(others.length){port?.postMessage({ok:false,error:'Bài đang mở ở tab khác. Hãy giữ tab đang làm.'});return;}
   await self.skipWaiting();port?.postMessage({ok:true});
  })());
  if(event.data?.type==='PREPARE')event.waitUntil((async()=>{
   try{
    const cache=await caches.open(cacheName);
    for(const asset of journal.requiredAssets)await verify(await cache.match(url(asset)),asset);
    port?.postMessage({ok:true,build,assetBuildId});
   }catch(error){port?.postMessage({ok:false,error:error.message});}
  })());
 });
 self.addEventListener('fetch',event=>{
  const request=event.request,target=new URL(request.url);
  if(request.method!=='GET'||target.origin!==base.origin)return;
  const navigation=request.mode==='navigate'&&target.pathname.startsWith(scope.pathname);
  if(!navigation&&!paths.has(target.pathname))return;
  event.respondWith((async()=>{
   const cache=await caches.open(cacheName);
   if(navigation){
    try{
     const current=await fetch(request,{cache:'no-store',signal:AbortSignal.timeout(4000)});
     if(current.ok)return current;
    }catch{/* A verified shell remains available when the network fails. */}
    const cached=await cache.match(url(entry));
    if(cached)return cached;
   }else{
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached)return cached;
    if(journal.handles(target.pathname))return (await journal.get(cache)) ?? new Response(null,{status:503});
   }
   return fetch(request);
  })());
 });
}

registerDemoExamShell({build:'term2-offline-20261106-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});
