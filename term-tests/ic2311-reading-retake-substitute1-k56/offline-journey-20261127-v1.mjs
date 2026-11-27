import {cacheVerifiedAssets} from '../substitute-skill-shared/offline-asset-pool-20261127-v1.mjs';
import {BUILD} from './config-journey-20261127-v1.mjs?v=departure-20261125-v2';
export async function prepareOffline({onProgress=()=>{},journal,signal}){
 if(!('serviceWorker' in navigator)||!('caches' in window))throw Object.assign(Error(),{code:'CACHE_UNAVAILABLE'});
 const workerUrl=new URL('sw-journey-20261127-v1.js?v='+BUILD,location.href);
 const registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href));
 if(navigator.onLine||!registration)await navigator.serviceWorker.register(workerUrl,{scope:'./'});
 const controlled=()=>navigator.serviceWorker.controller?.scriptURL===workerUrl.href;
 if(!controlled())await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',onChange);reject(Object.assign(Error(),{code:'CACHE_UNAVAILABLE'}));},15000);
  function onChange(){if(controlled()){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',onChange);resolve();}}
  navigator.serviceWorker.addEventListener('controllerchange',onChange);onChange();
 });
 const {assets,build}=await fetch('asset-manifest-journey-20261127-v1.json',{cache:'no-store',signal}).then(r=>{if(!r.ok)throw Object.assign(Error(),{code:'CONTENT_HTTP_ERROR',httpStatus:r.status});return r.json();});
 if(build!==BUILD)throw Object.assign(Error(),{code:'CONTENT_MISMATCH'});
 const name='reading-retake:'+BUILD,cache=await caches.open(name);await cache.put(new URL('asset-manifest-journey-20261127-v1.json',location.href),new Response(JSON.stringify({assets,build}),{headers:{'Content-Type':'application/json'}}));
 await cacheVerifiedAssets({cache,assets,signal,base:location.href,integrityCode:'ASSET_HASH_MISMATCH',onProgress,fetchAsset:async(asset,url,requestSignal)=>{const r=await fetch(url,{cache:'no-store',signal:requestSignal});if(!r.ok)throw Object.assign(Error(),{code:'CONTENT_HTTP_ERROR'});return r;}});
 signal?.throwIfAborted();
 const channel=new MessageChannel();await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Object.assign(Error(),{code:'CACHE_INCOMPLETE'})),5000);channel.port1.onmessage=e=>{clearTimeout(t);e.data?.build===BUILD&&e.data?.ok?resolve():reject(Object.assign(Error(),{code:'CACHE_INCOMPLETE'}));};navigator.serviceWorker.controller.postMessage({type:'VERIFY',build:BUILD,paths:assets.map(a=>new URL(a.path,location.href).href)},[channel.port2]);});
 return {build,assets:assets.length};
}
