export function registerExamShell({build,assets,hashes,assetBuildId}){
 const base=new URL('./',self.location.href),cacheName=build+'-'+assetBuildId;
 const url=asset=>new URL(asset,base).href;
 const paths=new Set(assets.map(asset=>new URL(asset,base).pathname));
 const entry='index-confirmed-departure-v2.html';
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
   const request=new URL(url(asset));
   request.searchParams.set('examBuild',assetBuildId);
   await cache.put(url(asset),await verify(await fetch(request,{cache:'reload'}),asset));
  }));
  // V5 and this release share identical bytes at every common asset URL.
  const previous=build+'-83de55ff1fa228efa2e77671adf3518ad1e71b48f59e2e055a1655759558263e';
  const preceding=build+'-404d6ea5492fa9df10a5aad8221ddcd058d54ea29a82a02440642b5868c3b825';
  if(await caches.has(previous)||await caches.has(preceding))await self.skipWaiting();
 })()));
 self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
 self.addEventListener('message',event=>{
  const port=event.ports[0];
  if(event.data?.type==='SHELL_VERSION')port?.postMessage({build,assetBuildId});
  if(event.data?.type==='ACTIVATE')event.waitUntil((async()=>{
   const others=(await self.clients.matchAll({type:'window',includeUncontrolled:true}))
    .filter(client=>client.id!==event.source?.id&&client.url.startsWith(base.href));
   if(others.length){port?.postMessage({ok:false,error:'Bài đang mở ở tab khác. Hãy giữ tab đang làm.'});return;}
   await self.skipWaiting();port?.postMessage({ok:true});
  })());
  if(event.data?.type==='PREPARE')event.waitUntil((async()=>{
   try{
    const cache=await caches.open(cacheName);
    for(const asset of assets)await verify(await cache.match(url(asset)),asset);
    port?.postMessage({ok:true,build,assetBuildId});
   }catch(error){port?.postMessage({ok:false,error:error.message});}
  })());
 });
 self.addEventListener('fetch',event=>{
  const request=event.request,target=new URL(request.url);
  if(request.method!=='GET'||target.origin!==base.origin)return;
  const navigation=request.mode==='navigate' && (target.pathname===base.pathname || target.pathname===new URL('index.html',base).pathname);
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
   }
   return fetch(request);
  })());
 });
}
