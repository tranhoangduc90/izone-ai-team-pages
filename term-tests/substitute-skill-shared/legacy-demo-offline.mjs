import {legacyProfile} from './class-directory.mjs';

export async function prepareLegacyDemoOffline(){
 const profile=legacyProfile();if(!profile||document.body.dataset.test!==profile.testId||document.getElementById('class').value!=='DEMO')throw Error('DEMO_OFFLINE_SCOPE_INVALID');
 const response=await fetch('demo-asset-manifest.json',{cache:'no-store'});if(!response.ok)throw Error('CACHE_UNAVAILABLE');
 const manifest=await response.json(),scope=new URL('./',location.href).href;
 if(manifest.testId!==profile.testId||!/^issue611-[a-f0-9]{16}$/.test(manifest.build)||!new URL(scope).pathname.endsWith(manifest.scopePath)||!Array.isArray(manifest.assets))throw Error('CACHE_UNAVAILABLE');
 const cache=await caches.open('substitute-skill-demo:'+profile.testId+':'+manifest.build);
 for(const asset of manifest.assets){
  const url=new URL(asset.path,location.href);if(url.origin!==location.origin)throw Error('CACHE_UNAVAILABLE');
  let value=await cache.match(url);const hash=async r=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  if(!value||await hash(value)!==asset.sha256)value=await fetch(url,{cache:'reload'});
  if(!value.ok||await hash(value)!==asset.sha256)throw Error('CACHE_CONTENT_MISMATCH');await cache.put(url,value);
 }
 await cache.put(new URL('demo-asset-manifest.json',scope),new Response(JSON.stringify({...manifest,scope}),{headers:{'content-type':'application/json'}}));
 const worker=new URL(profile.skill==='reading'?'sw.js':'offline-sw-listening-report-v1.js',scope);worker.searchParams.set('parity','20261118');
 await navigator.serviceWorker.register(worker,{scope:'./',updateViaCache:'none'});
 // Never force a waiting worker over an active real attempt.
 if(navigator.serviceWorker.controller?.scriptURL!==worker.href)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',ready);reject(Error('CACHE_UNAVAILABLE'));},15000);const ready=()=>{if(navigator.serviceWorker.controller?.scriptURL===worker.href){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',ready);resolve();}};navigator.serviceWorker.addEventListener('controllerchange',ready);ready();});
 return {build:manifest.build,updated:false};
}
