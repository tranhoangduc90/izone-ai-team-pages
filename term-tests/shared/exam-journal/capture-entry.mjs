// Copied into native loaders by wire-audio.mjs: no static logger dependency or awaited import.
export function startJournalAudioCapture(metadata,bootstrapUrl){
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
