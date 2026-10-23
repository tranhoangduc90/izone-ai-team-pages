import {ASSETS} from './catalog.mjs';
import {downloadAudio} from './chunks.mjs';
import {decodeBase64url,keyContext,sha256} from './protocol.mjs';
import {WORKER_ORIGIN,SUBSTITUTE_ASSETS,REVIEW_ASSETS} from './config.mjs';

const memory=new Map(),breakers=new Map(),TTL=86400000;
let cacheUnavailable=false;
const safeOrigins=['https://izone-audio-delivery-stage.tranhoangduc90.workers.dev','https://izone-audio-delivery.tranhoangduc90.workers.dev'];
function denied(){throw Object.assign(Error('ACCESS_DENIED'),{accessDenied:true});}
function breaker(origin,now=Date.now()){
  let until=breakers.get(origin)||0;
  try{until=Math.max(until,Number(sessionStorage.getItem('audio-source:'+origin))||0);}catch{}
  return until>now;
}
function openBreaker(origin){const until=Date.now()+600000;breakers.set(origin,until);try{sessionStorage.setItem('audio-source:'+origin,String(until));}catch{}}
function db(run){return new Promise((resolve,reject)=>{
  if(cacheUnavailable){reject(Error('CACHE_UNAVAILABLE'));return;}
  let connection,transaction,settled=false;const timer=setTimeout(()=>{try{transaction?.abort();}catch{}done(Error('CACHE_TIMEOUT'));},1500);
  const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);connection?.close();if(error){cacheUnavailable=true;reject(error);}else resolve(value);};
  try{
    const r=indexedDB.open('izone-public-audio-512-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('parts',{keyPath:'id'});
    r.onerror=r.onblocked=()=>done(Error('CACHE_UNAVAILABLE'));
    r.onsuccess=()=>{connection=r.result;if(settled){connection.close();return;}try{transaction=connection.transaction('parts','readwrite');let result;run(transaction.objectStore('parts'),v=>result=v);transaction.oncomplete=()=>done(null,result);transaction.onerror=transaction.onabort=()=>done(Error('CACHE_FAILED'));}catch(e){done(e);}};
  }catch(e){done(e);}
});}
async function readParts(a){
  const parts=new Map();
  for(let i=0;i<a.chunks.length;i++){
    const id=a.sha256+':524288:'+i;let r=memory.get(id);
    if(!r)try{r=await db((s,out)=>{const q=s.get(id);q.onsuccess=()=>out(q.result);});}catch{}
    if(r?.expiresAt>Date.now()&&r.bytes instanceof Uint8Array&&r.bytes.byteLength===a.chunks[i].byteLength&&await sha256(r.bytes)===a.chunks[i].sha256)parts.set(id,r.bytes);
    else memory.delete(id);
  }
  return parts;
}
function save(id,bytes){const r={id,bytes,expiresAt:Date.now()+TTL};memory.set(id,r);void db(s=>{s.put(r);const q=s.openCursor();q.onsuccess=()=>{const c=q.result;if(c){if(c.value.expiresAt<=Date.now())c.delete();c.continue();}};}).catch(()=>{});}

// Input: an MP3 manifest returned after native API authorization, or one of the
// four already-public Substitute URLs. Output: verified Blob for the old player.
// Never forwards options.headers/cookies to Worker/Pages or modifies exam state.
export async function downloadPreferred(m,options={}){
  if(m?.cloudflare?.version!==1||m.cloudflare.policy!=='public-mp3-v1')return null;
  const a=Object.values(ASSETS).find(x=>x.sha256===m.sha256&&x.url===m.url&&x.byteLength===m.byteLength);
  if(!a||m.envelopeVersion!=='MP3')throw Error('AUDIO_CATALOG_MISMATCH');
  if(!safeOrigins.includes(WORKER_ORIGIN))throw Error('AUDIO_ORIGIN_DENIED');
  const parts=options.parts||await readParts(a),fetchImpl=options.fetchImpl||fetch;
  options.signal?.throwIfAborted();
  const id=crypto.randomUUID();
  const context={product:'public-mp3-v1',classId:'public',testId:a.id,owner:'public',sid:id,generation:1,purpose:'audio.public',assetHash:a.sha256,downloadId:id};
  let ticket='',key=new Uint8Array(32),disablePrimary=breaker(WORKER_ORIGIN);
  async function issue(){
    const controller=new AbortController(),abort=()=>controller.abort(options.signal?.reason),timer=setTimeout(()=>controller.abort(),5000);
    options.signal?.addEventListener('abort',abort,{once:true});
    try{
      options.signal?.throwIfAborted();
      const r=await fetchImpl(WORKER_ORIGIN+'/access/'+a.id+'/'+id,{credentials:'omit',cache:'no-store',signal:controller.signal});
      if([401,403].includes(r.status)){
        const text=await r.text();if(!/\b(?:Error\s*(?:code[: ]*)?|error code:\s*)1027\b/i.test(text.slice(0,16000)))denied();
        throw Error('WORKER_QUOTA_1027');
      }
      if(!r.ok)throw Error('ACCESS_SOURCE_'+r.status);
      const value=await r.json();
      if(value.policy!=='public-mp3-v1'||value.version!==1||keyContext(value.context)!==keyContext(context)||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=Date.now()||value.expiresAt>Date.now()+610000)denied();
      const nextKey=decodeBase64url(value.key);
      if(nextKey.length!==32||typeof value.ticket!=='string'||value.ticket.length>4096)denied();
      return {...value,rawKey:nextKey};
    }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
  }
  if(!disablePrimary&&parts.size<a.chunks.length)try{const access=await issue();ticket=access.ticket;key=access.rawKey;}catch(error){options.signal?.throwIfAborted();if(error.accessDenied)throw error;disablePrimary=true;openBreaker(WORKER_ORIGIN);options.onEvent?.({source:'primary-error',reason:error.name==='AbortError'?'ACCESS_TIMEOUT':error.message});}
  const manifest={version:1,chunkSize:524288,sha256:a.sha256,byteLength:a.byteLength,chunks:a.chunks,context,ticket,primaryUrl:WORKER_ORIGIN+'/parts/'+a.id,fallbackUrl:a.url};
  const result=await downloadAudio(manifest,{
    key,parts,signal:options.signal,fetchImpl,disablePrimary,
    primaryRetries:1,primaryTimeoutMs:15000,fallbackTimeoutMs:30000,
    onProgress:options.onProgress,onEvent:options.onEvent,onVerifiedPart:save,
    onPrimaryFailure:()=>openBreaker(WORKER_ORIGIN),
    refresh:async()=>{const access=await issue();if(!access.rawKey.every((n,i)=>n===key[i]))denied();return access.ticket;}
  });
  return result.blob;
}

export async function downloadSubstitute(source,options={}){
  let u;try{u=new URL(source,typeof location==='undefined'?'https://tranhoangduc90.github.io':location.href);}catch{return null;}
  const a=Object.values(ASSETS).find(x=>x.url===u.href&&x.id.startsWith('substitute-'));
  if(!a||!SUBSTITUTE_ASSETS.includes(a.id))return null;
  return downloadPreferred({...a,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}},options);
}

export async function downloadReview(url,hash,options={}){
  const a=Object.values(ASSETS).find(x=>x.url===url&&x.sha256===hash);
  if(!a||!REVIEW_ASSETS.includes(a.id))return null;
  return downloadPreferred({...a,envelopeVersion:'MP3',cloudflare:{version:1,policy:'public-mp3-v1'}},options);
}
