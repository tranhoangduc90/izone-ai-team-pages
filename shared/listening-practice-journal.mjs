import {IndexedOutbox} from '../term-tests/shared/exam-journal/outbox.mjs?v=20261105-diagnostics-v2';
import {createRecorder,fetchTransport} from '../term-tests/shared/exam-journal/recorder.mjs?v=20261105-diagnostics-v2';

function packet(event){
 const {id,pageVisitId,sequence,occurredAt,elapsedMs,build,type,data}=event;
 const base={id,pageVisitId,sequence,occurredAt,elapsedMs,build,dataSchemaVersion:1};
 if(type==='sequence_gap')return{...base,kind:'capture.health',traceId:id,data:{state:'sequence_gap',lostCount:data.lostCount}};
 if(type==='storage_degraded')return{...base,kind:'capture.health',traceId:id,data:{state:'memory_only'}};
 const {kind,traceId,requestId,fields}=data;
 return{...base,kind,traceId,...(requestId?{requestId}:{}),data:fields};
}

// Explicit semantic observations only; no DOM, input, fetch interception or content capture.
export function startListeningPracticeJournal(endpoint){
 const outbox=new IndexedOutbox({name:'izone-listening-practice-journal-v1',maxBytes:2*1024*1024});
 const send=fetchTransport(endpoint);let active=null,stopped=false;
 const recorder=createRecorder({outbox,context:()=>active,build:'listening-practice-journal-20261105',
  transport:(body,options)=>send({...body,events:body.events.map(packet)},options)});
 const flush=options=>{void recorder.flush(options).catch(()=>{});};
 const online=()=>flush({force:true}),pagehide=()=>flush({force:true,keepalive:true});
 const timer=setInterval(()=>flush(),12000);
 addEventListener('online',online);addEventListener('pagehide',pagehide);
 return{
  bind(context){
   if(stopped||!/^[a-f0-9]{64}$/.test(context?.bindingId||'')||typeof context.ticket!=='string'
    ||!/^[a-f0-9-]{36}$/i.test(context.ticketId||'')||!Number.isSafeInteger(context.expiresAt)||context.expiresAt<=Date.now())return null;
   const {bindingId,ticket,ticketId,issuedAt,expiresAt}=context,captured={bindingId,auth:{ticket,ticketId,issuedAt,expiresAt}};
   active=captured;void outbox.renewBinding(bindingId,captured.auth).catch(()=>{});
   const emit=(kind,fields,traceId,requestId)=>recorder.record('listening_diagnostic',{
    kind,traceId:traceId||crypto.randomUUID(),...(requestId?{requestId}:{}),fields,
   },captured);
   return{
    control:(fields,traceId,requestId)=>emit('control.exchange',fields,traceId,requestId),
    audio:(fields,traceId)=>emit('audio.state',fields,traceId),
    visibility:fields=>emit('page.visibility',fields),
   };
  },
  stop(){
   if(stopped)return;stopped=true;clearInterval(timer);removeEventListener('online',online);removeEventListener('pagehide',pagehide);
   // The ticket frozen in each row keeps pending observations with their old owner/attempt.
   void recorder.flush({force:true,keepalive:true}).catch(()=>{}).finally(async()=>{
    await recorder.stop();await recorder.idle();await outbox.close();
   }).catch(()=>{});
  },
 };
}
