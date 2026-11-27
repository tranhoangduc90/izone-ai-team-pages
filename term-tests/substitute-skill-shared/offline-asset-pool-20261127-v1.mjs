const failure=code=>Object.assign(new Error(code),{code});
const digest=async response=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');

// Cache only verified bytes. A valid hit needs one hash and no write. Limit the
// number of simultaneous files so a whole class does not flood the asset host.
export async function cacheVerifiedAssets({cache,assets,base=location.href,signal,fetchAsset,onProgress=()=>{},integrityCode='CACHE_CONTENT_MISMATCH'}){
  const own=new AbortController(),combined=signal?AbortSignal.any([signal,own.signal]):own.signal;
  const origin=new URL(base).origin,seen=new Map();
  const jobs=assets.map(asset=>{
    const url=new URL(asset.path,base);
    if(url.origin!==origin||!/^[a-f0-9]{64}$/.test(asset.sha256))throw failure('CACHE_UNAVAILABLE');
    if(seen.has(url.href)&&seen.get(url.href)!==asset.sha256)throw failure('CACHE_CONTENT_MISMATCH');
    seen.set(url.href,asset.sha256);return {asset,url};
  });
  let cursor=0,done=0,hits=0,writes=0;
  async function worker(){
    while(cursor<jobs.length){
      combined.throwIfAborted();const {asset,url}=jobs[cursor++];
      let response=await cache.match(url);combined.throwIfAborted();
      let valid=response?.ok&&await digest(response)===asset.sha256;combined.throwIfAborted();
      if(valid)hits++;
      else{
        response=await fetchAsset(asset,url,combined);combined.throwIfAborted();
        if(!response?.ok)throw failure('CACHE_UNAVAILABLE');
        if(await digest(response)!==asset.sha256)throw failure(integrityCode);
        combined.throwIfAborted();await cache.put(url,response);combined.throwIfAborted();writes++;
      }
      onProgress(++done,jobs.length);
    }
  }
  try{await Promise.all(Array.from({length:Math.min(4,jobs.length)},worker));combined.throwIfAborted();return {assets:done,hits,writes};}
  catch(error){own.abort(error);throw error;}
}
