import {cacheVerifiedAssets} from './offline-asset-pool-20261127-v1.mjs';
export const PREPARATION_RELEASE='skills-journey-20261127-v1';

export async function prepareWritingOffline({signal=AbortSignal.timeout(10000)}={}){
  if(document.body.dataset.legacyDemo==='true'){
    const {prepareLegacyDemoOffline}=await import('./legacy-demo-offline.mjs');
    signal.throwIfAborted();return prepareLegacyDemoOffline({signal});
  }
  if(!('serviceWorker' in navigator)||!('caches' in window))throw Object.assign(Error(),{code:'CACHE_UNAVAILABLE'});
  const response=await fetch('asset-manifest.json',{cache:'no-store',signal});signal.throwIfAborted();
  if(!response.ok)throw Error('CACHE_UNAVAILABLE');
  const manifest=await response.json();signal.throwIfAborted();
  if(manifest.testId!==document.body.dataset.test||!/^issue611-[a-f0-9]{16}$/.test(manifest.build)||
      manifest.preparationRelease!==PREPARATION_RELEASE||!Array.isArray(manifest.assets))throw Error('CACHE_UNAVAILABLE');
  const cache=await caches.open('substitute-skill:'+manifest.testId+':'+manifest.build);signal.throwIfAborted();
  await cacheVerifiedAssets({cache,assets:manifest.assets,base:location.href,signal,
    fetchAsset:(_asset,url,requestSignal)=>{const fresh=new URL(url);fresh.searchParams.set('issue611Build',manifest.build);
      return fetch(fresh,{cache:'reload',signal:requestSignal});}});
  signal.throwIfAborted();
  const workerUrl=new URL('sw.js',location.href);workerUrl.searchParams.set('build',manifest.build);
  await navigator.serviceWorker.register(workerUrl,{scope:'./',updateViaCache:'none'});signal.throwIfAborted();
  const controlled=()=>navigator.serviceWorker.controller?.scriptURL===workerUrl.href;
  if(!controlled())await new Promise((resolve,reject)=>{
    const cleanup=()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);signal.removeEventListener('abort',aborted);};
    const changed=()=>{if(controlled()){cleanup();resolve();}};
    const aborted=()=>{cleanup();reject(signal.reason);};
    navigator.serviceWorker.addEventListener('controllerchange',changed);signal.addEventListener('abort',aborted,{once:true});
    if(signal.aborted)aborted();else changed();
  });
  signal.throwIfAborted();
  // New immutable controller URLs and this HTML marker identify the same release.
  // An old open page must reload; a first installation of this page need not.
  return {build:manifest.build,updated:document.body.dataset.preparationRelease!==PREPARATION_RELEASE};
}
