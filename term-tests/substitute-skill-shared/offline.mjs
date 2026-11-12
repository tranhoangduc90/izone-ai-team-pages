export async function prepareWritingOffline(){
 if(!('serviceWorker'in navigator)||!('caches'in window))throw Object.assign(Error(),{code:'CACHE_UNAVAILABLE'});
 const r=await fetch('asset-manifest.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('CACHE_UNAVAILABLE');const manifest=await r.json();
 if(manifest.testId!==document.body.dataset.test||!/^issue611-[a-f0-9]{16}$/.test(manifest.build)||!Array.isArray(manifest.assets))throw Error('CACHE_UNAVAILABLE');
 const cache=await caches.open('substitute-skill:'+manifest.testId+':'+manifest.build);
 const hashOf=async response=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 for(const asset of manifest.assets){const url=new URL(asset.path,location.href);if(url.origin!==location.origin)throw Error('CACHE_UNAVAILABLE');let response=await cache.match(url);if(!response||await hashOf(response)!==asset.sha256){const fresh=new URL(url);fresh.searchParams.set('issue611Build',manifest.build);response=await fetch(fresh,{cache:'reload',signal:AbortSignal.timeout(12000)});}if(!response.ok)throw Error('CACHE_UNAVAILABLE');if(await hashOf(response)!==asset.sha256)throw Error('CACHE_CONTENT_MISMATCH');await cache.put(url,response);}
 const workerUrl=new URL('sw.js',location.href);workerUrl.searchParams.set('build',manifest.build);const previous=navigator.serviceWorker.controller?.scriptURL;
 await navigator.serviceWorker.register(workerUrl,{scope:'./',updateViaCache:'none'});
 const controlled=()=>navigator.serviceWorker.controller?.scriptURL===workerUrl.href;
 if(!controlled())await new Promise((resolve,reject)=>{const changed=()=>{if(controlled()){clearTimeout(t);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();}},t=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(Error('CACHE_UNAVAILABLE'));},15000);navigator.serviceWorker.addEventListener('controllerchange',changed);changed();});
 return {build:manifest.build,updated:previous!==workerUrl.href};
}
