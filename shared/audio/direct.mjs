import {ASSETS} from './catalog.mjs?v=20261107-r2-direct1';
import {createDirectCache} from './direct-cache.mjs?v=20261107-r2-direct1';
const ORIGIN='https://e340869dcc6ff285504947407d148104.r2.cloudflarestorage.com';
const PREFIX='/izone-audio-r2-lab-20261023/';
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
const denied=()=>Object.assign(Error('ACCESS_DENIED'),{accessDenied:true,status:403});
export const DIRECT_POLICY='r2-direct-v1';
export function supportsDirect(){return !!(globalThis.crypto?.subtle&&globalThis.ReadableStream&&globalThis.AbortController);}
export function directAsset(manifest,termSlug){
 const candidates=termSlug===undefined
  ? Object.values(ASSETS).filter(x=>/^(homework-|listening-)/.test(x.id))
  : ['term-test-1-k56','term-test-2-k56'].filter(slug=>slug===termSlug).map(slug=>ASSETS[slug]);
 const asset=candidates.find(x=>x.sha256===manifest?.sha256&&x.byteLength===manifest?.byteLength&&x.url===manifest?.url);
 if(!asset||manifest.envelopeVersion!=='MP3')throw Error('AUDIO_MANIFEST_DENIED');
 return asset;
}
function validate(grant,asset){
 if(grant?.version!==1||grant.policy!==DIRECT_POLICY||grant.method!=='GET'||grant.sha256!==asset.sha256||grant.byteLength!==asset.byteLength||grant.validForSeconds!==600||grant.fallback!=='public-pages')throw Error('AUDIO_GRANT_DENIED');
 let u;try{u=new URL(grant.url);}catch{throw Error('AUDIO_GRANT_DENIED');}
 if(u.origin!==ORIGIN||u.pathname!==PREFIX+asset.key||u.hash||u.username||u.password||u.href.length>4096)throw Error('AUDIO_GRANT_DENIED');
}
export function validateDirectGrant(manifest,grant){validate(grant,directAsset(manifest));}
// Receives a native-authorized immutable manifest and ephemeral GET descriptor.
// Never starts/changes an attempt; every renewal goes through the caller's native API.
export async function downloadDirect(manifest,initialGrant,options={}){
 const asset=directAsset(manifest,options.termSlug);validate(initialGrant,asset);
 const cache=options.cache||createDirectCache(),fetcher=options.fetchImpl||fetch;
 const outer=options.signal,overall=new AbortController(),overallTimer=setTimeout(()=>overall.abort(),options.totalTimeoutMs??120000);
 const abortOuter=()=>overall.abort(outer.reason);outer?.addEventListener('abort',abortOuter,{once:true});if(outer?.aborted)abortOuter();
 const signal=overall.signal,buffers=[],events=[],maxAttempts=3;
 let offset=0,grant=initialGrant,renewed=false,fallback=options.preferFallback===true,receivedAt=performance.now();
 const event=e=>{events.push(e);options.onEvent?.(e);};
 const progress=()=>options.onProgress?.({loaded:offset,total:asset.byteLength,complete:offset===asset.byteLength});
 async function renew(){
  signal.throwIfAborted();if(renewed||!options.refresh)return false;renewed=true;
  let value;try{value=await options.refresh({signal});}catch(e){e.accessDenied=true;throw e;}
  signal.throwIfAborted();
  if(value?.manifest&&value?.download){const fresh=directAsset(value.manifest,options.termSlug);if(fresh.sha256!==asset.sha256)throw denied();grant=value.download;validate(grant,asset);receivedAt=performance.now();return true;}
  // A valid native response may turn the direct flag off. Only same-file public fallback is allowed.
  if(value?.manifest&&directAsset(value.manifest,options.termSlug).sha256===asset.sha256&&!value.download){fallback=true;return true;}
  throw denied();
 }
 try{
  for(let i=0;i<asset.chunks.length;i++){
   signal.throwIfAborted();const bytes=await cache.get(asset,i),expected=asset.chunks[i];
   if(!bytes||bytes.length!==expected.byteLength||await digest(bytes)!==expected.sha256)break;
   buffers.push(bytes);offset+=bytes.length;
  }
  if(offset)event({source:'cache',wireBytes:0});progress();
  for(let attempt=0;offset<asset.byteLength&&attempt<maxAttempts;attempt++){
   signal.throwIfAborted();if(!fallback&&performance.now()-receivedAt>420000)await renew();
   const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal.addEventListener('abort',abort,{once:true});let idle;
   const arm=()=>{clearTimeout(idle);idle=setTimeout(()=>controller.abort(),options.idleTimeoutMs??15000);};
   const source=fallback?'pages':'r2-direct';let reader;
   try{
    arm();const r=await fetcher(fallback?asset.url:grant.url,{method:'GET',headers:offset?{Range:`bytes=${offset}-`}:{},credentials:'omit',cache:'no-store',signal:controller.signal,referrerPolicy:'no-referrer'});
    event({source,status:r.status,wireBytes:0});
    if(!r.ok){await r.body?.cancel();if(!fallback&&[401,403].includes(r.status)&&await renew())continue;throw Error('AUDIO_SOURCE_'+r.status);}
    if(offset&&r.status===200){buffers.length=0;offset=0;}
    if(r.status===206){const p=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(r.headers.get('Content-Range')||'');if(!p||+p[1]!==offset||+p[2]!==asset.byteLength-1||+p[3]!==asset.byteLength)throw Error('AUDIO_RANGE_DENIED');}
    else if(r.status!==200)throw Error('AUDIO_RANGE_DENIED');
    reader=r.body.getReader();let pending=new Uint8Array();
    for(;;){
     signal.throwIfAborted();arm();const {done,value}=await reader.read();if(done)break;
     event({source,wireBytes:value.length});
     if(offset+pending.length+value.length>asset.byteLength)throw Error('AUDIO_SIZE_MISMATCH');
     const next=new Uint8Array(pending.length+value.length);next.set(pending);next.set(value,pending.length);pending=next;
     while(offset<asset.byteLength&&pending.length>=asset.chunks[buffers.length].byteLength){
      const index=buffers.length,expected=asset.chunks[index],bytes=pending.slice(0,expected.byteLength);pending=pending.slice(expected.byteLength);
      if(await digest(bytes)!==expected.sha256)throw Error('AUDIO_HASH_MISMATCH');
      signal.throwIfAborted();buffers.push(bytes);offset+=bytes.length;
      const durable=await cache.put(asset,index,bytes);if(!durable)event({source:'cache-error',reason:'CACHE_UNAVAILABLE'});
      options.onVerifiedPart?.(index);progress();
     }
    }
    if(offset!==asset.byteLength)throw Error('AUDIO_TRUNCATED');
   }catch(e){
    signal.throwIfAborted();if(e.accessDenied||['AUDIO_RANGE_DENIED','AUDIO_SIZE_MISMATCH','AUDIO_GRANT_DENIED','AUDIO_MANIFEST_DENIED'].includes(e.message))throw e;
    event({source:'source-error',reason:e.name==='AbortError'?'AUDIO_IDLE_TIMEOUT':e.message});
    if(attempt===maxAttempts-1)throw e;
    if(fallback){continue;}
    if(!renewed&&options.refresh){await renew();}else fallback=true;
    if(e.message==='AUDIO_HASH_MISMATCH')fallback=true;
   }finally{clearTimeout(idle);await reader?.cancel().catch(()=>{});controller.abort();signal.removeEventListener('abort',abort);}
  }
  signal.throwIfAborted();if(offset!==asset.byteLength)throw Error('AUDIO_INCOMPLETE');
  const blob=new Blob(buffers,{type:'audio/mpeg'});if(blob.size!==asset.byteLength||await digest(await blob.arrayBuffer())!==asset.sha256)throw Error('AUDIO_WHOLE_HASH_MISMATCH');
  signal.throwIfAborted();return blob;
 }finally{clearTimeout(overallTimer);outer?.removeEventListener('abort',abortOuter);}
}
