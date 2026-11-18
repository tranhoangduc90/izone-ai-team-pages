// Routing for DEMO only; the original real-attempt fetch handler remains the fallback.
(() => {
 const scope=new URL('./',self.location.href),origin=scope.origin;
 self.routeSubstituteDemoFetch=(event,legacyFetch)=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==origin)return legacyFetch(event);
  const legacy=()=>{let response;legacyFetch({request:event.request,clientId:event.clientId,resultingClientId:event.resultingClientId,respondWith:value=>{response=value;},waitUntil:value=>event.waitUntil(value)});return response??fetch(event.request);};
  event.respondWith((async()=>{
   const url=new URL(event.request.url),navigation=event.request.mode==='navigate';
   const client=event.clientId?await self.clients.get(event.clientId):null;
   const page=navigation?url:client?new URL(client.url):null;
   if(!page||!page.href.startsWith(scope.href)||page.searchParams.get('class')!=='DEMO')return legacy();
   try{return await fetch(event.request);}catch(error){
    const names=(await caches.keys()).filter(name=>name.startsWith('substitute-skill-demo:'));
    for(const name of names.reverse()){
     const cache=await caches.open(name),marker=await cache.match(new URL('demo-asset-manifest.json',scope));
     if(!marker)continue;const manifest=await marker.json();if(manifest.scope!==scope.href)continue;
     const cached=await cache.match(navigation?new URL('./',scope):event.request);
     if(cached)return cached;
    }
    throw error;
   }
  })());
 };
})();
