import {BUILD} from './config.mjs';
export async function prepareOffline({onProgress=()=>{},journal}){
 if(!('serviceWorker' in navigator)||!('caches' in window))throw Object.assign(Error(),{code:'CACHE_UNAVAILABLE'});
 let registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href));
 if(!registration)registration=await navigator.serviceWorker.register('sw.js',{scope:'./'});
 await Promise.race([navigator.serviceWorker.ready,new Promise((_,r)=>setTimeout(()=>r(Object.assign(Error(),{code:'CACHE_UNAVAILABLE'})),15000))]);
 if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Object.assign(Error(),{code:'CACHE_UNAVAILABLE'})),10000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);resolve();},{once:true});});
 const {assets,build}=await fetch('asset-manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Object.assign(Error(),{code:'CONTENT_HTTP_ERROR',httpStatus:r.status});return r.json();});
 if(build!==BUILD)throw Object.assign(Error(),{code:'CONTENT_MISMATCH'});
 const name='reading-retake:'+BUILD,cache=await caches.open(name);await cache.put(new URL('asset-manifest.json',location.href),new Response(JSON.stringify({assets,build}),{headers:{'Content-Type':'application/json'}}));let done=0;
 for(const a of assets){const u=new URL(a.path,location.href);let r=await cache.match(u);if(!r){const requestId=crypto.randomUUID();journal?.emit('asset_request_sent',{requestId,assetId:a.id,phase:'preparing'});try{r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Object.assign(Error(),{code:'CONTENT_HTTP_ERROR',httpStatus:r.status});journal?.emit('asset_response_received',{requestId,assetId:a.id,httpStatus:r.status});}catch(e){journal?.emit('asset_request_failed',{requestId,assetId:a.id,errorCode:e.code||'NETWORK_UNREACHABLE',httpStatus:e.httpStatus??null});throw e;}}
  const bytes=await r.clone().arrayBuffer(),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(sha!==a.sha256)throw Object.assign(Error(),{code:'ASSET_HASH_MISMATCH'});await cache.put(u,r);onProgress(++done,assets.length);
 }
 const channel=new MessageChannel();await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Object.assign(Error(),{code:'CACHE_INCOMPLETE'})),5000);channel.port1.onmessage=e=>{clearTimeout(t);e.data?.build===BUILD&&e.data?.ok?resolve():reject(Object.assign(Error(),{code:'CACHE_INCOMPLETE'}));};navigator.serviceWorker.controller.postMessage({type:'VERIFY',build:BUILD,paths:assets.map(a=>new URL(a.path,location.href).href)},[channel.port2]);});
 return {build,assets:assets.length};
}
