// Metadata only. Never copy the transport manifest, URL, ticket, key or Error wholesale.
const assetIds=new Set(['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56',
 'substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67','listening-8','listening-10']);
const revisions=new Set(['20261024-cf512-1','20261023-cf512-1','legacy-iztt1','legacy-mp3-pages','20261111-audio-milestones-v2']);
const milestoneSources={first_byte:new Set(['cloudflare','pages','r2-direct','legacy-vps','legacy-pages']),verification_started:new Set(['verified_file']),
 source_switch_started:new Set(['pages']),retry_started:new Set(['cloudflare','pages','r2-direct'])};
const sources=new Set(['cloudflare','pages','cache','cache-error','primary-error','legacy-vps','legacy-pages','observation-gap']);
const bytes=value=>Number.isSafeInteger(value)&&value>=0&&value<=512*1024*1024?value:null;
const instant=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():new Date().toISOString();
function errorCode(value){
 const text=typeof value==='string'?value:'';
 if(['ACCESS_DENIED','ACCESS_TIMEOUT','WORKER_QUOTA_1027','PRIMARY_CIRCUIT_OPEN','PRIMARY_HASH_MISMATCH','FALLBACK_HASH_MISMATCH','WHOLE_HASH_MISMATCH','ENVELOPE_INVALID','AUDIO_CATALOG_MISMATCH','AUDIO_ORIGIN_DENIED','CACHE_UNAVAILABLE','CACHE_TIMEOUT','CACHE_FAILED','AUDIO_EMPTY'].includes(text))return text;
 if(/^(?:PRIMARY_HTTP|FALLBACK_HTTP|ACCESS_SOURCE|AUDIO_HTTP)_[1-5]\d{2}$/.test(text))return text;
 if(text==='AbortError')return'AUDIO_ABORTED';if(text==='OperationError')return'AUDIO_CRYPTO_ERROR';if(text==='TypeError')return'AUDIO_NETWORK_ERROR';
 return'AUDIO_SOURCE_ERROR';
}
export function createAudioTransferObserver({metadata,record,onHealth=()=>{}}){
 if(!metadata||!assetIds.has(metadata.assetId)||typeof record!=='function')return null;
 const base={telemetryVersion:metadata.telemetryVersion===2?2:1,assetId:metadata.assetId,assetSha256:/^[a-f0-9]{64}$/.test(metadata.sha256||'')?metadata.sha256:'unknown',expectedByteLength:bytes(metadata.byteLength),
  transportRevision:revisions.has(metadata.transportRevision)?metadata.transportRevision:'unknown',startedAt:instant(metadata.startedAt)};
 let closed=false;
 const emit=detail=>{try{const pending=record({action:'audio_delivery',section:'listening',checkpointState:{...base,observedAt:new Date().toISOString(),...detail}});if(pending?.catch)void pending.catch(()=>{});}catch{try{onHealth({status:'degraded',errorCode:'JOURNAL_AUDIO_OBSERVER_UNAVAILABLE'});}catch{}}};
 emit({phase:'started',source:'unselected',observedAt:base.startedAt});
 return{
  event(row){
   try{
    const milestone=base.telemetryVersion===2&&Object.hasOwn(milestoneSources,row?.phase)&&milestoneSources[row.phase].has(row.source);
    if(closed||(!milestone&&!sources.has(row?.source)))return;
    const detail={phase:milestone?row.phase:row.source==='observation-gap'?'gap':row.source==='cache-error'?'cache_degraded':row.source==='primary-error'?'source_error':row.source==='cache'?'cached_part_verified':'part_received',source:row.source,observedAt:instant(row.observedAt)};
    if(row.source==='observation-gap')detail.lostCount=Number.isSafeInteger(row.lostCount)&&row.lostCount>0?row.lostCount:1;
    if(Number.isSafeInteger(row.index)&&row.index>=0&&row.index<8192)detail.chunkIndex=row.index;
    if(Number.isSafeInteger(row.status)&&row.status>=100&&row.status<=599)detail.httpStatus=row.status;
    if(bytes(row.wireBytes)!==null)detail.wireBytes=row.wireBytes;
    if(row.source==='primary-error'||row.source==='cache-error')detail.errorCode=errorCode(row.reason);
    emit(detail);
   }catch{try{onHealth({status:'degraded',errorCode:'JOURNAL_AUDIO_OBSERVER_UNAVAILABLE'});}catch{}}
  },
  complete(result){try{if(closed)return;closed=true;
   const verified=base.expectedByteLength>0&&result?.verified===true&&result?.byteLength===base.expectedByteLength;
   emit({phase:'complete',source:verified?'verified_file':'native_loader_returned',verified,byteLength:bytes(result?.byteLength),observedAt:instant(result?.observedAt),...(verified?{}:{errorCode:'AUDIO_LENGTH_OR_VERIFICATION_UNKNOWN'})});
   }catch{}},
  fail(error){try{if(closed)return;closed=true;emit({phase:'failed',source:'unresolved',observedAt:instant(error?.observedAt),errorCode:errorCode(error?.name==='AbortError'?'AbortError':error?.message||error?.name)});}catch{}}
 };
}
