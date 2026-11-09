const CACHE='ic2311-listening-retake-shell-20261110-v1';
const shell=new URL('./',self.location.href);
const project=new URL('../../',shell);
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
  event.ports[0].postMessage({ok:urls.length>0&&results.every(result=>result.status==='fulfilled')});
 }).catch(()=>event.ports[0].postMessage({ok:false})));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==shell.origin)return;
 const entry=request.mode==='navigate'&&(url.pathname===shell.pathname||url.pathname===shell.pathname+'index.html');
 if(!entry&&!isStatic(url))return;
 event.respondWith(fetch(request).catch(async error=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(entry?shell.href:request);
  if(cached)return cached;
  throw error;
 }));
});
