// Scope-specific cache contains only public, digest-checked shell assets.
export function registerExamShell({build,assets,hashes,assetBuildId}){
 const base=new URL('./',self.location.href),cacheName=build+'-'+assetBuildId;
 const url=asset=>new URL(asset,base).href;
 const paths=new Set(assets.map(asset=>new URL(asset,base).pathname));
 async function verify(response,asset){
  if(!response?.ok)throw Error('Thiếu tài nguyên '+asset);
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()));
  const digest=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==hashes[asset])throw Error('Tài nguyên chưa khớp bản bài thi '+asset);
  return response;
 }
 self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(cacheName);
  for(let i=0;i<assets.length;i+=6)await Promise.all(assets.slice(i,i+6).map(async asset=>{
   const request=new URL(url(asset));request.searchParams.set('examBuild',assetBuildId);
   await cache.put(url(asset),await verify(await fetch(request,{cache:'reload'}),asset));
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
   try{const cache=await caches.open(cacheName);for(const asset of assets)await verify(await cache.match(url(asset)),asset);
    port?.postMessage({ok:true,build,assetBuildId});
   }catch(error){port?.postMessage({ok:false,error:error.message});}
  })());
 });
 self.addEventListener('fetch',event=>{
  const request=event.request,target=new URL(request.url);
  if(request.method!=='GET'||target.origin!==base.origin)return;
  const navigation=request.mode==='navigate'&&target.pathname.startsWith(base.pathname);
  if(!navigation&&!paths.has(target.pathname))return;
  event.respondWith((async()=>{
   const cache=await caches.open(cacheName);
   return await cache.match(navigation?url('index.html'):request,{ignoreSearch:true})||fetch(request);
  })());
 });
}
