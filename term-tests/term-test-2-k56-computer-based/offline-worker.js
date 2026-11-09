// Chỉ giữ tài nguyên công khai của đúng build; không cache API hoặc bài làm.
import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets.mjs?v=20261107-k56-r2-v1&demoOffline=20261110-v1';
const BUILD='term2-offline-20261106-v1',CACHE=BUILD+'-'+ASSET_BUILD_ID,base=new URL('.',self.location.href);
const url=value=>new URL(value,base).href;
const paths=new Set(ASSETS.map(x=>new URL(x,base).pathname));
async function verified(response,asset){
 if(!response?.ok)throw Error('Thiếu tài nguyên '+asset);
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==ASSET_HASHES[asset])throw Error('Tài nguyên chưa khớp build '+asset);
 return response;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Ghi theo lô nhỏ để không dồn hàng trăm request lên mạng của lớp.
 for(let i=0;i<ASSETS.length;i+=6)await Promise.all(ASSETS.slice(i,i+6).map(async asset=>{
  const source=new URL(url(asset));source.searchParams.set('term2Build',ASSET_BUILD_ID);
  const response=await verified(await fetch(source,{cache:'reload'}),asset);await cache.put(url(asset),response);
 }));
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 const port=event.ports[0];
 if(event.data?.type==='ACTIVATE')event.waitUntil((async()=>{
  const others=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.id!==event.source?.id&&c.url.startsWith(base.href));
  if(others.length){port?.postMessage({ok:false,error:'Bài đang mở ở tab khác. Hãy giữ tab đang làm.'});return;}
  await self.skipWaiting();port?.postMessage({ok:true});
 })());
 if(event.data?.type==='PREPARE')event.waitUntil((async()=>{
  try{const cache=await caches.open(CACHE);for(const asset of ASSETS)await verified(await cache.match(url(asset)),asset);
   port?.postMessage({ok:true,build:BUILD,assetBuildId:ASSET_BUILD_ID});
  }catch(e){port?.postMessage({ok:false,error:e.message});}
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,u=new URL(request.url);if(request.method!=='GET'||u.origin!==base.origin)return;
 const navigation=request.mode==='navigate'&&u.pathname.startsWith(base.pathname);
 if(!navigation&&!paths.has(u.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),found=await cache.match(navigation?url('index.html'):request,{ignoreSearch:true});
  if(found)return found;
  // Không giả response thành công khi cache thiếu.
  return fetch(request);
 })());
});
