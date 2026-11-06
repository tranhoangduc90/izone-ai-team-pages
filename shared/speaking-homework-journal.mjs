import {IndexedOutbox} from '../term-tests/shared/exam-journal/outbox.mjs?v=20261105-diagnostics-v2';
import {createRecorder,fetchTransport,viewportSnapshot} from '../term-tests/shared/exam-journal/recorder.mjs?v=20261105-diagnostics-v2';

export const speakingJournalEnabled=true;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const bounded=(value,max=600000)=>Math.min(max,Math.max(0,Math.round(Number.isFinite(value)?value:0)));
const routes={'/open':'open','/doctor/list':'doctor_list','/checks/request':'check_main','/doctor/practice/request':'check_practice',
 '/doctor/practice/extra/request':'check_extra','/finish':'finish','/observation/student/status':'observe_status','/observation/student/view':'observe_view','/observation/student/events':'observe_stream'};
const readRoute=route=>['open','doctor_list','observe_status','observe_view','observe_stream','other'].includes(route);
const states=new Set(['pending','processing','accepted','rejected','submitted','complete','failed','verified','blocked','unknown']);

// Raw body values are used only as bounded RAM retry keys, never in an emitted record/outbox.
export function createSpeakingRequestWindow({emit,now=()=>performance.now(),makeId=()=>crypto.randomUUID(),coverage='poster_only'}){
 const pending=new Set(),operations=new Map(),seen=new Map();let bucket;
 const reset=()=>bucket={started:now(),operations:0,requests:0,retries:0,polls:0,streamConnections:0,headerOnlyRequests:0,unclassifiedRequests:0};reset();
 const safeEmit=(...args)=>{try{return emit(...args);}catch{return null;}};
 function state(phase,data){
  const value={phase,...data},key=phase+':'+(data.linkId||''),signature=JSON.stringify(value);
  if(seen.get(key)===signature)return;seen.set(key,signature);if(seen.size>128)seen.delete(seen.keys().next().value);
  safeEmit('client.state',value);
 }
 function observe({open,docs,error}={}){
  if(open||docs)seen.delete('observer_error:');
  if(open){
   state('snapshot',{state:open.status==='submitted'?'submitted':'pending',acceptedMainCount:bounded((open.links||[]).filter(row=>row.check_status==='accepted').length,1000),
    acceptedPracticeCount:bounded((open.practiceLinks||[]).filter(row=>row.status==='accepted').length,1000),...(uuid(open.receipt?.id)?{receiptId:open.receipt.id}:{})});
   docs??=open.docsProgress;
   const doctor=open.processing?.analyze_homework?.status;if(doctor)state('doctor_observed',{state:doctor==='done'?'complete':states.has(doctor)?doctor:'unknown'});
  }
  if(docs)state('docs_observed',{state:states.has(docs.status)?docs.status:'unknown'});
  if(error){
   const code=error.name==='SyntaxError'?'BODY_PARSE_FAILED':error.code==='SPEAKING_VIEW_INVALID'?'INVALID_VIEW':error.code==='SPEAKING_STATE_INVALID'?'INVALID_STATE':
    ['STATE_UNAVAILABLE','SOURCE_UNAVAILABLE'].includes(error.code)?'UNAVAILABLE':'OTHER';
   state('observer_error',{state:'unknown',errorCode:code,...(Number.isInteger(error.status)&&error.status>=100&&error.status<=599?{httpStatus:error.status}:{})});
  }
 }
 return{
  begin(path,body={}){
   const route=routes[path]||'other',read=readRoute(route),started=now(),requestId=makeId();
   const short=value=>typeof value==='string'?value.slice(0,120):null;
   const key=read||typeof body.url==='string'&&body.url.length>500?null:JSON.stringify([route,short(body.part),
    Number.isSafeInteger(body.slot)&&body.slot<=1000?body.slot:null,short(body.exerciseId),typeof body.url==='string'?body.url:null,
    body.manualSubmit===true,Array.isArray(body.voiceConfirmedParts)?body.voiceConfirmedParts.slice(0,2).map(short):[]]);
   let operation=key&&operations.get(key);
   if(operation&&started-operation.at<=300000)bucket.retries++;else{operation={id:makeId(),at:started};if(!read)bucket.operations++;}
   if(key){operations.set(key,operation);if(operations.size>64)operations.delete(operations.keys().next().value);}
   const marker={};pending.add(marker);let done=false;
   return{requestId,traceId:operation.id,finish({response,data,error,phase='body'}={}){
    if(done)return;done=true;pending.delete(marker);bucket.requests++;if(route==='observe_stream')bucket.streamConnections++;else if(read)bucket.polls++;
    if(phase==='headers')bucket.headerOnlyRequests++;if(route==='other')bucket.unclassifiedRequests++;
    const httpStatus=response?.status,validStatus=Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599;
    const ok=response?.ok===true&&data?.ok===true;
    const outcome=ok?'ok':validStatus?(response.ok?'invalid_response':'http_error'):
     error?.name==='TimeoutError'?'timeout':error?.name==='AbortError'?'aborted':'network_error';
    if(key&&(ok||[400,401,403,404,409,422].includes(httpStatus))&&operations.get(key)===operation)operations.delete(key);
    let shared;try{shared=response?.headers?.get('x-exam-journal-request-id');}catch{}
    if(!read||!ok)safeEmit('client.request',{route,outcome,phase,durationMs:bounded(now()-started),...(validStatus?{httpStatus}:{}),
     serverRequestIdObserved:uuid(shared),...(uuid(data?.check?.id)?{linkId:data.check.id}:{}),...(uuid(data?.receipt?.id)?{receiptId:data.receipt.id}:{})},operation.id,uuid(shared)?shared:requestId);
    if(!ok)return;
    if(route==='open')observe({open:data});
    if(route.startsWith('check_'))state('check_observed',{state:states.has(data.check?.status)?data.check.status:'unknown',...(uuid(data.check?.id)?{linkId:data.check.id}:{})});
    if(route==='finish'&&uuid(data.receipt?.id))state('submitted',{state:'submitted',receiptId:data.receipt.id});
   }};
  },
  flush(force=false){
   if(!bucket.requests&&!bucket.operations&&!pending.size||!force&&now()-bucket.started<60000)return false;
   const {started,...counts}=bucket;safeEmit('performance.summary',{...counts,pendingRequests:pending.size,durationMs:bounded(now()-started),coverage});reset();return true;
  },observe,get pending(){return pending.size;},
 };
}

function packet(event){
 const {id,pageVisitId,sequence,occurredAt,elapsedMs,build,type,data}=event,base={id,pageVisitId,sequence,occurredAt,elapsedMs,build,dataSchemaVersion:1};
 if(type==='sequence_gap')return{...base,kind:'capture.health',traceId:id,data:{state:'sequence_gap',lostCount:data.lostCount}};
 if(type==='storage_degraded')return{...base,kind:'capture.health',traceId:id,data:{state:'memory_only'}};
 return{...base,kind:data.kind,traceId:data.traceId,...(data.requestId?{requestId:data.requestId}:{}),data:data.fields};
}
function environment(env){
 const v=viewportSnapshot(env),ua=env.navigator.userAgent;
 const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Other';
 const version=({Edge:/Edg\/(\d+)/,Firefox:/Firefox\/(\d+)/,Chrome:/Chrome\/(\d+)/,Safari:/Version\/(\d+)/}[browser])?.exec(ua);
 const platform=/Android/.test(ua)?'Android':/iPhone|iPad|iPod/.test(ua)||env.navigator.platform==='MacIntel'&&env.navigator.maxTouchPoints>1?'iOS':/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Other';
 return{viewportWidth:bounded(v.width,20000),viewportHeight:bounded(v.height,20000),screenWidth:bounded(env.screen.width,20000),screenHeight:bounded(env.screen.height,20000),
  dprPermille:bounded(v.dpr*1000,16000),visualScalePermille:bounded((v.visualScale||1)*1000,20000),coarsePointer:env.matchMedia('(pointer:coarse)').matches,
  hidden:env.document.hidden,online:env.navigator.onLine,browser,browserMajor:bounded(Number(version?.[1]||0),999),platform};
}

export function startSpeakingHomeworkJournal({enabled=speakingJournalEnabled,...options}={}){
 let active;
 return{
  opened(input){
   if(!enabled||!input.independent){active?.reset();return;}
   try{active??=startEnabledSpeakingJournal(options);active.opened(input);}catch{}
  },
  reset(){try{active?.reset();}catch{}},observe(input){try{active?.observe(input);}catch{}},
  begin(...args){try{return active?.begin(...args)||null;}catch{return null;}},
  fetch(input,options){return active?active.fetch(input,options):globalThis.fetch(input,options);},
  async stop(){try{await active?.stop();}catch{}},
 };
}
function startEnabledSpeakingJournal({env=globalThis,fetcher=globalThis.fetch}={}){
 if(typeof env.addEventListener!=='function'||typeof env.document?.addEventListener!=='function'||typeof env.MutationObserver!=='function')throw Error('SPEAKING_LOG_BROWSER_UNAVAILABLE');
 let current=null,endpoint,stopped=false,resizeTimer;const channels=new Set();
 const outbox=new IndexedOutbox({name:'izone-speaking-webapp-journal-v1',maxBytes:2*1024*1024});
 const recorder=createRecorder({outbox,context:()=>current?.captured,build:'speaking-webapp-journal-20261106',transport:(body,options)=>{
  if(!endpoint)throw Error('SPEAKING_LOG_ENDPOINT_UNAVAILABLE');
  return fetchTransport(endpoint+'/journal-events')({...body,events:body.events.map(packet)},options);
 }});
 function emit(channel,kind,fields,traceId,requestId){
  if(stopped)return;const row={kind,fields,traceId:traceId||crypto.randomUUID(),...(requestId?{requestId}:{})};
  if(!channel.captured){
   const pending={...row,at:performance.now()};
   if(kind==='client.state')channel.beforeContext.set(fields.phase,pending);
   else if(kind==='client.request'){if(channel.beforeRequests.length<32)channel.beforeRequests.push(pending);else channel.lost++;}
   return;
  }
  recorder.record('speaking_diagnostic',row,channel.captured);
 }
 function contextual(channel){
  try{const fields=environment(env),signature=JSON.stringify(fields);if(signature===channel.environment)return;channel.environment=signature;emit(channel,'ui.context',fields);}catch{}
 }
 function makeChannel(apiBase,identity,unitId){
  const channel={apiBase,unitId,identity:{accessToken:identity.accessToken,studentRef:identity.studentRef},nextTry:0,beforeContext:new Map(),beforeRequests:[],lost:0};
  channel.window=createSpeakingRequestWindow({emit:(...args)=>emit(channel,...args),coverage:'session_http'});return channel;
 }
 function select(channel){
  if(current?.captured)current.window.flush(true);current=channel;channels.add(channel);lastGuide=undefined;
  if(channels.size>16){const old=channels.values().next().value;if(old.captured)old.window.flush(true);channels.delete(old);}
 }
 function ensure(channel){
  if(stopped||channel.loading||channel.captured?.auth.expiresAt>Date.now()+60000||Date.now()<channel.nextTry)return;
  channel.loading=true;channel.nextTry=Date.now()+5000;
  void(async()=>{try{
   const response=await fetcher(channel.apiBase+'/journal-context',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(channel.identity),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
   if(!response.ok)return;const value=(await response.json()).journalContext;
   if(stopped||!/^[a-f0-9]{64}$/.test(value?.bindingId||'')||!uuid(value.ticketId)||typeof value.ticket!=='string'||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=Date.now())return;
   const {bindingId,ticket,ticketId,issuedAt,expiresAt}=value;
   let target=channel;
   if(channel.captured&&channel.captured.bindingId!==bindingId){
    // A native class/profile rebinding creates a new capture channel; old callbacks keep the old scope.
    if(current!==channel)return;target=makeChannel(channel.apiBase,channel.identity,channel.unitId);select(target);
   }
   target.captured={bindingId,auth:{ticket,ticketId,issuedAt,expiresAt}};
   for(const row of [...target.beforeContext.values(),...target.beforeRequests])emit(target,row.kind,{...row.fields,observedBeforeContext:true,observationDelayMs:bounded(performance.now()-row.at)},row.traceId,row.requestId);
   target.beforeContext.clear();target.beforeRequests=[];
   if(target.lost){emit(target,'capture.health',{state:'sequence_gap',lostCount:target.lost});target.lost=0;}
   try{await outbox.renewBinding(bindingId,target.captured.auth);}catch{}
   if(target===current){contextual(target);dialog();}else target.window.flush(true);
  }catch{}finally{channel.loading=false;}})();
 }
 const flush=options=>{void recorder.flush(options).catch(()=>{});};
 function summarize(force){for(const channel of channels)if(channel.captured)channel.window.flush(force);}
 const pagehide=()=>{summarize(true);flush({force:true,keepalive:true});};
 const online=()=>{if(current){contextual(current);ensure(current);}flush({force:true});};
 const visibility=()=>{if(current){emit(current,'page.visibility',{hidden:env.document.hidden,online:env.navigator.onLine});contextual(current);}if(env.document.hidden)pagehide();};
 const resize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(current)contextual(current);},400);};
 const timer=setInterval(()=>{summarize(false);if(current)ensure(current);flush();},12000);
 env.addEventListener('pagehide',pagehide);env.addEventListener('online',online);env.addEventListener('resize',resize);env.document.addEventListener('visibilitychange',visibility);
 env.visualViewport?.addEventListener('resize',resize);
 const guide=env.document.getElementById('share-guide-dialog');let observer,lastGuide;
 function dialog(){
  if(!current)return;try{const rect=guide?.getBoundingClientRect(),present=Boolean(guide?.isConnected),opened=Boolean(guide?.open),signature=String(opened);
   if(signature===lastGuide)return;lastGuide=signature;
   emit(current,'ui.dialog',{component:'share_guide',state:opened?'opened':'closed',present,inViewport:Boolean(opened&&present&&rect.width>0&&rect.height>0&&rect.right>0&&rect.bottom>0&&rect.left<env.innerWidth&&rect.top<env.innerHeight),width:bounded(rect?.width,20000),height:bounded(rect?.height,20000)});
  }catch{}
 }
 if(guide){observer=new env.MutationObserver(dialog);observer.observe(guide,{attributes:true,attributeFilter:['open']});}
 return{
  opened({apiBase,identity,independent,unitId}){
   if(stopped)return;
   if(!independent||!uuid(unitId)||!uuid(identity?.studentRef)||typeof identity.accessToken!=='string'||!/^[A-Za-z0-9_-]{32,200}$/.test(identity.accessToken)
    ||!apiBase.endsWith('/api/speaking-homework-independent')||endpoint&&endpoint!==apiBase){this.reset();return;}
   endpoint??=apiBase;
   if(current?.apiBase===apiBase&&current.unitId===unitId&&current.identity.accessToken===identity.accessToken&&current.identity.studentRef===identity.studentRef){ensure(current);return;}
   const channel=makeChannel(apiBase,identity,unitId);select(channel);ensure(channel);
  },
  reset(){if(current?.captured)current.window.flush(true);current=null;},
  observe(input){try{if(current&&(input.open?.workUnitId||input.unitId)===current.unitId)current.window.observe(input);}catch{}},
  async fetch(input,options){
   let capture;
   try{if(typeof input==='string'&&input.startsWith(endpoint+'/observation/student/')&&typeof options?.body==='string'&&options.body.length<=2048)
    capture=this.begin('/observation/student/'+new URL(input).pathname.split('/').at(-1),JSON.parse(options.body));}catch{}
   if(!capture)return fetcher(input,options);
   const headers=new Headers(options.headers);for(const [key,value]of Object.entries(capture.headers))headers.set(key,value);
   let response,error;try{response=await fetcher(input,{...options,headers});return response;}
   catch(value){error=value;throw value;}finally{capture.finish({response,data:{ok:response?.ok===true},error,phase:'headers'});}
  },
  begin(path,body){
   try{const channel=current;if(stopped||!channel||body.accessToken!==channel.identity.accessToken||body.studentRef!==channel.identity.studentRef)return null;
    ensure(channel);const capture=channel.window.begin(path,body);
    return{headers:channel.captured?{'x-exam-journal-request-id':capture.requestId}:{},finish(value){
     try{capture.finish(value);if(channel!==current&&channel.captured)channel.window.flush(true);}catch{}
    }};
   }catch{return null;}
  },
  async stop(){
   if(stopped)return;summarize(true);clearInterval(timer);clearTimeout(resizeTimer);observer?.disconnect();
   env.removeEventListener('pagehide',pagehide);env.removeEventListener('online',online);env.removeEventListener('resize',resize);env.document.removeEventListener('visibilitychange',visibility);env.visualViewport?.removeEventListener('resize',resize);
   stopped=true;try{await recorder.flush({force:true,keepalive:true});}finally{await recorder.stop();await recorder.idle();await outbox.close();}
  },
 };
}
