const cacheName='izone-alias-listening-recovery-v1';

export function playbackCheckpoint(identity,assetHash,position,limit){
  if(!identity?.attemptId||!Number.isInteger(identity.generation)||identity.audioHash!==assetHash||
     !Number.isFinite(position)||position<0||position>=limit)return null;
  return {attemptId:identity.attemptId,generation:identity.generation,assetHash,position};
}

export function checkpointPosition(saved,identity,audio){
  const scoped=playbackCheckpoint(identity,audio.hash,saved?.position,audio.seconds);
  if(scoped&&saved.attemptId===scoped.attemptId&&saved.generation===scoped.generation&&saved.assetHash===scoped.assetHash)
    return scoped.position;
}

function cacheKey(slug,hash){
  return new URL('./verified-local-audio/'+encodeURIComponent(slug)+'/'+hash,location.href);
}

export async function storeRecoveryAudio(slug,asset){
  const cache=await caches.open(cacheName);
  await cache.put(cacheKey(slug,asset.hash),new Response(asset.blob));
}

export async function readRecoveryAudio(slug,audio){
  const cache=await caches.open(cacheName);
  const key=cacheKey(slug,audio.hash);
  const response=await cache.match(key);
  if(!response)return null;
  const blob=await response.blob();
  if(blob.size===audio.bytes){
    const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    const hex=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(hex===audio.hash)return {blob,hash:hex,size:blob.size,source:'verified_recovery_cache'};
  }
  await cache.delete(key);
  return null;
}
