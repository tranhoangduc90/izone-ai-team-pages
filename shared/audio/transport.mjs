// BEGIN optional exam journal audio entry
// Copied into native loaders by wire-audio.mjs: no static logger dependency or awaited import.
function startJournalAudioCapture(metadata,bootstrapUrl){
 try{
  const win=globalThis.window,slug=win?.TERM_TEST_CONFIG?.slug;
  if(win?.TERM_TEST_APP_CONFIG?.EXAM_JOURNAL_ENABLED!==true||!slug||!Array.from(['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56','substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']).includes(slug))return null;
  const meta={assetId:metadata?.assetId||slug,sha256:metadata?.sha256,byteLength:metadata?.byteLength,transportRevision:metadata?.transportRevision,startedAt:new Date().toISOString()};
  let observer=null,queue=[],held=0,lost=0,failed=false;
  const budgetKey=Symbol.for('izone.examJournal.audioPreloadBudget.v1'),budget=win[budgetKey]||(win[budgetKey]={bytes:0,streams:0});
  const health=code=>{win.EXAM_JOURNAL_AUDIO_HEALTH={status:'gap',errorCode:code,lostCount:lost,observedAt:new Date().toISOString()};};
  const safeReason=value=>{
   const text=typeof value==='string'?value:'';
   return /^(?:ACCESS_DENIED|ACCESS_TIMEOUT|WORKER_QUOTA_1027|PRIMARY_CIRCUIT_OPEN|PRIMARY_HASH_MISMATCH|FALLBACK_HASH_MISMATCH|WHOLE_HASH_MISMATCH|ENVELOPE_INVALID|AUDIO_CATALOG_MISMATCH|AUDIO_ORIGIN_DENIED|CACHE_UNAVAILABLE|CACHE_TIMEOUT|CACHE_FAILED|AUDIO_EMPTY|AbortError|OperationError|TypeError)$/.test(text)||/^(?:PRIMARY_HTTP|FALLBACK_HTTP|ACCESS_SOURCE|AUDIO_HTTP)_[1-5]\d{2}$/.test(text)?text:'AUDIO_SOURCE_ERROR';
  };
  const invoke=(method,data)=>{try{const work=observer?.[method]?.(data);if(work?.catch)void work.catch(()=>health('JOURNAL_AUDIO_OBSERVER_UNAVAILABLE'));}catch{health('JOURNAL_AUDIO_OBSERVER_UNAVAILABLE');}};
  const call=(method,row)=>{try{
   if(failed)return;const data={observedAt:new Date().toISOString()};
   if(method==='event'){
    if(!['cloudflare','pages','cache','cache-error','primary-error','legacy-vps','legacy-pages'].includes(row?.source))return;
    data.source=row.source;
    for(const field of ['index','status','wireBytes'])if(Number.isSafeInteger(row[field])&&row[field]>=0&&row[field]<=512*1024*1024)data[field]=row[field];
    if(row.source==='primary-error'||row.source==='cache-error')data.reason=safeReason(row.reason);
   }else if(method==='complete'){
    data.verified=row?.verified===true;data.byteLength=Number.isSafeInteger(row?.byteLength)?row.byteLength:null;
   }else data.message=safeReason(row?.name==='AbortError'?'AbortError':row?.message||row?.name);
   if(observer){invoke(method,data);return;}
   const size=JSON.stringify(data).length*2;
   if(queue.length>=256||budget.bytes+size>256*1024){lost++;health('JOURNAL_AUDIO_PRELOAD_BUDGET');return;}
   queue.push([method,data]);held+=size;budget.bytes+=size;
  }catch{health('JOURNAL_AUDIO_OBSERVER_UNAVAILABLE');}};
  if(typeof win.EXAM_JOURNAL_AUDIO_TRANSFER==='function')observer=win.EXAM_JOURNAL_AUDIO_TRANSFER(meta);
  if(!observer){
   if(budget.streams>=8){health('JOURNAL_AUDIO_PRELOAD_QUEUE_FULL');return null;}budget.streams++;
   const classCodeHint=(new URL(win.location.href).searchParams.get('class')||'').trim().toUpperCase();
   void import(bootstrapUrl).then(({connectAudioCapture})=>{
    observer=connectAudioCapture(meta,{classCodeHint});
    if(!observer){health('JOURNAL_AUDIO_PRELOAD_UNAVAILABLE');return;}
    if(lost)invoke('event',{source:'observation-gap',lostCount:lost});
    for(const [method,data]of queue)invoke(method,data);
   }).catch(()=>health('JOURNAL_AUDIO_PRELOAD_UNAVAILABLE')).finally(()=>{failed=!observer;budget.bytes-=held;held=0;queue=[];budget.streams--;});
  }
  return{event:row=>call('event',row),complete:row=>call('complete',row),fail:row=>call('fail',row)};
 }catch{return null;}
}
// END optional exam journal audio entry
import {ASSETS} from './catalog.mjs?v=20261031-horton1';
import {downloadAudio} from './chunks.mjs?v=20261028-part-rescue-v1';
import {decodeBase64url,keyContext,sha256} from './protocol.mjs';
import {WORKER_ORIGIN,SUBSTITUTE_ASSETS,REVIEW_ASSETS} from './config.mjs?v=20261026-term1-replay1';

const memory=new Map(),breakers=new Map(),TTL=86400000;
let cacheUnavailable=false,completeAudio=null;
const safeOrigins=['https://izone-audio-delivery-stage.tranhoangduc90.workers.dev','https://izone-audio-delivery.tranhoangduc90.workers.dev'];
function denied(){throw Object.assign(Error('ACCESS_DENIED'),{accessDenied:true,userMessage:'Chưa xác nhận được quyền tải audio. Giữ trang và báo giáo viên để kiểm tra phiên; bài làm được giữ nguyên.'});}
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
  const journal=startJournalAudioCapture({assetId:a?.id,sha256:m.sha256,byteLength:m.byteLength,transportRevision:'20261024-cf512-1'},new URL('../../term-tests/shared/exam-journal/bootstrap-capture.mjs?v=20261024-audio-v1&resilience=20261027-v1',import.meta.url).href);
  const onEvent=row=>{journal?.event(row);try{globalThis.window?.dispatchEvent(new CustomEvent('term-test:audio-source',{detail:{source:row.source,index:row.index,scope:row.scope}}));}catch{}try{const work=options.onEvent?.(row);if(work?.catch)void work.catch(()=>{});}catch{}};
  try{
  if(!a||m.envelopeVersion!=='MP3')throw Error('AUDIO_CATALOG_MISMATCH');
  if(!safeOrigins.includes(WORKER_ORIGIN))throw Error('AUDIO_ORIGIN_DENIED');
  options.signal?.throwIfAborted();
  onEvent({source:'transfer-start'});
  if(completeAudio?.expiresAt<=Date.now())completeAudio=null;
  // One immutable verified public file, never a grant or session key. A caller
  // supplying its own parts collection still needs that collection populated.
  if(!options.parts&&completeAudio?.sha256===a.sha256){
    onEvent({source:'cache',wireBytes:0});
    options.onProgress?.({loaded:a.byteLength,total:a.byteLength,complete:true});
    journal?.complete({byteLength:a.byteLength,verified:true});return completeAudio.blob;
  }
  const parts=options.parts||await readParts(a),fetchImpl=options.fetchImpl||fetch;
  if(cacheUnavailable)onEvent({source:'cache-error',reason:'CACHE_UNAVAILABLE'});
  options.signal?.throwIfAborted();
  const id=crypto.randomUUID();
  const context={product:'public-mp3-v1',classId:'public',testId:a.id,owner:'public',sid:id,generation:1,purpose:'audio.public',assetHash:a.sha256,downloadId:id};
  let ticket='',key=new Uint8Array(32),disablePrimary=breaker(WORKER_ORIGIN);
  if(disablePrimary)onEvent({source:'primary-error',reason:'PRIMARY_CIRCUIT_OPEN'});
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
      // The issuer checks the signed expiry on every part request. Comparing its
      // epoch with Windows time rejects valid tickets on otherwise authorized
      // devices. Keep scope/key validation here; EXPIRED renews once in chunks.
      if(value.policy!=='public-mp3-v1'||value.version!==1||keyContext(value.context)!==keyContext(context)||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=0)denied();
      const nextKey=decodeBase64url(value.key);
      if(nextKey.length!==32||typeof value.ticket!=='string'||value.ticket.length>4096)denied();
      return {...value,rawKey:nextKey};
    }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
  }
  if(!disablePrimary&&parts.size<a.chunks.length)try{const access=await issue();ticket=access.ticket;key=access.rawKey;}catch(error){options.signal?.throwIfAborted();if(error.accessDenied)throw error;disablePrimary=true;openBreaker(WORKER_ORIGIN);onEvent({source:'primary-error',reason:error.name==='AbortError'?'ACCESS_TIMEOUT':error.message});}
  // A manual retry still passes native authorization and the same access/scope
  // checks above. It changes source only, never the session, key or deadline.
  if(options.preferFallback===true||globalThis.window?.IZONE_AUDIO_PREFER_FALLBACK===true)disablePrimary=true;
  const manifest={version:1,chunkSize:524288,sha256:a.sha256,byteLength:a.byteLength,chunks:a.chunks,context,ticket,primaryUrl:WORKER_ORIGIN+'/parts/'+a.id,fallbackUrl:a.url};
  const result=await downloadAudio(manifest,{
    key,parts,signal:options.signal,fetchImpl,disablePrimary,
    primaryRetries:1,primaryTimeoutMs:6000,fallbackTimeoutMs:30000,concurrency:options.concurrency??4,
    onProgress:options.onProgress,onEvent,onVerifiedPart:save,
    onPrimaryFailure:()=>openBreaker(WORKER_ORIGIN),
    refresh:async()=>{const access=await issue();if(!access.rawKey.every((n,i)=>n===key[i]))denied();return access.ticket;}
  });
  options.signal?.throwIfAborted();
  if(!options.parts)completeAudio={sha256:a.sha256,blob:result.blob,expiresAt:Date.now()+TTL};
  journal?.complete({byteLength:result.blob.size,verified:true});return result.blob;
  }catch(error){journal?.fail(error);throw error;}
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
