import {IndexedOutbox} from '../term-tests/shared/exam-journal/outbox.mjs?v=20261105-diagnostics-v2';
import {createRecorder,fetchTransport,viewportSnapshot} from '../term-tests/shared/exam-journal/recorder.mjs?v=20261105-diagnostics-v2';

const bounded=(value,max=600000,min=0)=>Math.min(max,Math.max(min,Math.round(Number.isFinite(value)?value:0)));
function packet(event){
 const {id,pageVisitId,sequence,occurredAt,elapsedMs,build,type,data}=event;
 const base={id,pageVisitId,sequence,occurredAt,elapsedMs,build,dataSchemaVersion:1};
 if(type==='sequence_gap')return{...base,kind:'capture.health',traceId:id,data:{state:'sequence_gap',lostCount:data.lostCount}};
 if(type==='storage_degraded')return{...base,kind:'capture.health',traceId:id,data:{state:'memory_only'}};
 const {kind,traceId,requestId,fields}=data;
 return{...base,kind,traceId,...(requestId?{requestId}:{}),data:fields};
}

// Đếm request hoàn tất; pendingRequests là số đang chờ tại lúc tổng kết.
// Callback đến muộn giữ nguyên window/người/lượt đã bắt đầu, không đọc scope mới.
export function createCheckpointWindow({emit,now=()=>performance.now()}){
 const pending=new Set();let bucket;
 const reset=()=>bucket={started:now(),requests:0,confirmed:0,rejected:0,unknown:0,firstSequence:Infinity,lastSequence:0,maxRequestMs:0};
 reset();
 return{
  begin(sequence){
   if(!bucket.requests&&!pending.size)reset();
   sequence=bounded(sequence,Number.MAX_SAFE_INTEGER);const request={sequence,started:now()};pending.add(request);let finished=false;
   return phase=>{
    if(finished)return false;finished=true;pending.delete(request);
    bucket.requests++;bucket[['confirmed','rejected'].includes(phase)?phase:'unknown']++;
    bucket.firstSequence=Math.min(bucket.firstSequence,sequence);bucket.lastSequence=Math.max(bucket.lastSequence,sequence);
    bucket.maxRequestMs=Math.max(bucket.maxRequestMs,bounded(now()-request.started));return true;
   };
  },
  flush(force=false){
   if(!bucket.requests&&!pending.size||!force&&now()-bucket.started<60000)return false;
   const sequences=[...pending].map(row=>row.sequence),first=Math.min(bucket.firstSequence,...sequences),last=Math.max(bucket.lastSequence,...sequences);
   emit({requests:bucket.requests,confirmed:bucket.confirmed,rejected:bucket.rejected,unknown:bucket.unknown,
    pendingRequests:pending.size,firstSequence:first,lastSequence:last,durationMs:bounded(now()-bucket.started),maxRequestMs:bucket.maxRequestMs});
   reset();return true;
  },
  get pending(){return pending.size;},
 };
}

function environment(){
 const v=viewportSnapshot(window),ua=navigator.userAgent;
 const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Other';
 const version=({Edge:/Edg\/(\d+)/,Firefox:/Firefox\/(\d+)/,Chrome:/Chrome\/(\d+)/,Safari:/Version\/(\d+)/}[browser])?.exec(ua);
 const platform=/Android/.test(ua)?'Android':/iPhone|iPad|iPod/.test(ua)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1?'iOS':/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Other';
 return{viewportWidth:bounded(v.width,20000),viewportHeight:bounded(v.height,20000),screenWidth:bounded(screen.width,20000),screenHeight:bounded(screen.height,20000),
  dprPermille:bounded(v.dpr*1000,16000),visualScalePermille:bounded((v.visualScale||1)*1000,20000),
  coarsePointer:matchMedia('(pointer:coarse)').matches,hidden:document.hidden,online:navigator.onLine,
  browser,browserMajor:bounded(Number(version?.[1]||0),999),platform};
}

export function startReadingPracticeJournal(endpoint){
 const outbox=new IndexedOutbox({name:'izone-reading-practice-journal-v1',maxBytes:2*1024*1024}),send=fetchTransport(endpoint);
 let active=null,current=null,stopped=false,resizeTimer;const channels=new Set();
 const recorder=createRecorder({outbox,context:()=>active,build:'reading-practice-journal-20261105',
  transport:(body,options)=>send({...body,events:body.events.map(packet)},options)});
 const summarize=force=>{for(const channel of channels){channel.window.flush(force);if(channel!==current&&!channel.window.pending)channels.delete(channel);}};
 const flush=options=>{void recorder.flush(options).catch(()=>{});};
 const online=()=>{try{current?.api.environment();}catch{}flush({force:true});};
 const pagehide=()=>{summarize(true);flush({force:true,keepalive:true});};
 const resize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{try{current?.api.environment();}catch{}},400);};
 const timer=setInterval(()=>{summarize(false);flush();},12000);
 addEventListener('online',online);addEventListener('pagehide',pagehide);addEventListener('resize',resize);globalThis.visualViewport?.addEventListener('resize',resize);
 function retire(){if(current){current.window.flush(true);if(!current.window.pending)channels.delete(current);}current=null;active=null;}
 return{
  bind(context){
   if(stopped||!/^[a-f0-9]{64}$/.test(context?.bindingId||'')||typeof context.ticket!=='string'
    ||!/^[a-f0-9-]{36}$/i.test(context.ticketId||'')||!Number.isSafeInteger(context.expiresAt)||context.expiresAt<=Date.now())return null;
   const {bindingId,ticket,ticketId,issuedAt,expiresAt}=context;
   if(current?.captured.bindingId===bindingId){current.captured.auth={ticket,ticketId,issuedAt,expiresAt};active=current.captured;}
   else{
    retire();const captured={bindingId,auth:{ticket,ticketId,issuedAt,expiresAt}},channel={captured};let lastEnvironment='';
    const emit=(kind,fields,traceId,requestId)=>recorder.record('reading_diagnostic',{kind,traceId:traceId||crypto.randomUUID(),...(requestId?{requestId}:{}),fields},captured);
    channel.window=createCheckpointWindow({emit:fields=>emit('checkpoint.summary',fields)});
    channel.api={
     control(fields,traceId,requestId){if(fields.action!=='checkpoint')channel.window.flush(true);return emit('control.exchange',fields,traceId,requestId);},
     checkpoint(sequence){const finish=channel.window.begin(sequence);return phase=>{if(!finish(phase))return;if(channel!==current){channel.window.flush(true);if(!channel.window.pending)channels.delete(channel);}};},
     timer(fields){if(fields.state!=='running')channel.window.flush(true);return emit('timer.state',fields);},
     restore:fields=>emit('draft.restore',fields),visibility:fields=>emit('page.visibility',fields),dialog:fields=>emit('ui.dialog',fields),
     environment(){const fields=environment(),encoded=JSON.stringify(fields);if(encoded===lastEnvironment)return;lastEnvironment=encoded;emit('ui.context',fields);},
    };
    current=channel;active=captured;channels.add(channel);channel.api.environment();
   }
   void outbox.renewBinding(bindingId,active.auth).catch(()=>{});return current.api;
  },
  clear(){retire();},
  async stop(){
   if(stopped)return;stopped=true;clearInterval(timer);clearTimeout(resizeTimer);
   removeEventListener('online',online);removeEventListener('pagehide',pagehide);removeEventListener('resize',resize);globalThis.visualViewport?.removeEventListener('resize',resize);
   summarize(true);try{await recorder.flush({force:true,keepalive:true});}finally{await recorder.stop();await recorder.idle();await outbox.close();}
  },
 };
}
