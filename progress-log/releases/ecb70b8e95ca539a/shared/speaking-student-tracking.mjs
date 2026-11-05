import {createTestStateObserver} from '/izone-ai-team-pages/progress-log/releases/ecb70b8e95ca539a/shared/test-state-observer.mjs';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const failure=(code,status=503)=>Object.assign(Error(code),{code,status});

// Theo dõi metadata của đúng phiên; chỉ tải open+Doctor khi nội dung đổi.
// Docs có callback riêng, không gửi lại bài và không tự nộp/chấm thay người học.
export function createSpeakingStudentTracker({base,identity,unitId=null,onView,onDocs,onError,onUnavailable=()=>{},onUnsupported=()=>{},onSynchronized=()=>{},
 isCurrent=()=>true,readEpoch=()=>0,canRead=()=>true,fetcher=fetch,observerFactory=createTestStateObserver,setTimer=setTimeout,clearTimer=clearTimeout}){
 if(!base||typeof identity?.accessToken!=='string'||!/^[A-Za-z0-9_-]{32,200}$/.test(identity.accessToken)
  ||!uuid.test(identity.studentRef||'')||(unitId&&!uuid.test(unitId))||![onView,onDocs,onError].every(fn=>typeof fn==='function'))throw Error('SPEAKING_TRACKER_OPTIONS_INVALID');
 const binding={accessToken:identity.accessToken,studentRef:identity.studentRef.toLowerCase()},root=base.replace(/\/$/,'');
 let boundUnit=unitId?.toLowerCase()||null,closed=false,observer,latest=null,pending=null,loading=false,retry=null,retryIsError=false,contentRevision=null,docsRevision=null,epoch=null,sequence=0,pollFailures=0,viewFailures=0;
 const controller=new AbortController(),stats={frames:0,views:0,docs:0};
 const body=()=>({...binding,...(boundUnit?{unitId:boundUnit}:{})});
 function current(){if(closed)return false;if(!isCurrent()){close();return false;}return true;}
 function close(){if(closed)return;closed=true;clearTimer(retry);controller.abort();observer?.close();pending=null;}
 function unsupported(){if(closed)return;close();onUnsupported();}
 function report(error){if(!current())return;if([401,403,423].includes(error.status)){close();onError(error);}else onError(error);}
 async function request(path,{signal=controller.signal}={}){
  const requestController=new AbortController(),abort=()=>requestController.abort();
  if(signal.aborted)requestController.abort();else signal.addEventListener('abort',abort,{once:true});
  const timeout=setTimer(abort,20000);timeout?.unref?.();
  try{
  const response=await fetcher(root+'/observation/student/'+path,{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(body()),signal:requestController.signal});
  const data=await response.json();
  if(!response.ok||data.ok!==true){const error=failure(data.error||'STATE_UNAVAILABLE',response.status);error.message=data.message||'Chưa đọc được trạng thái mới. Bài đã lưu vẫn được giữ.';
   const wait=response.headers.get('retry-after');error.retryAfterMs=wait&&/^\d+$/.test(wait)?Number(wait)*1000:Math.max(0,Date.parse(wait)-Date.now())||0;throw error;}
  return data;
  }finally{clearTimer(timeout);signal.removeEventListener('abort',abort);}
 }
 function schedule(delay=4000,error=false){if(closed||retry)return;retryIsError=error;retry=setTimer(()=>{retry=null;retryIsError=false;void drain();},delay);retry?.unref?.();}
 async function drain(){
  if(!current()||loading||!pending)return;loading=true;
  try{while(pending&&current()){
   const desired=pending;pending=null;if(desired.contentRevision===contentRevision){onSynchronized();continue;}
   if(!canRead()){pending=latest;schedule();return;}
   const readVersion=readEpoch();
   try{
    stats.views++;const {view}=await request('view');if(!current())return;
    if(view?.kind!=='speaking-student-view-v1'||view.unitId!==boundUnit||!view.open||!view.doctor||!hash(view.contentRevision))throw failure('SPEAKING_VIEW_INVALID');
    viewFailures=0;
    if(readVersion!==readEpoch()||latest.contentRevision!==desired.contentRevision||view.contentRevision!==desired.contentRevision){pending=latest;schedule();return;}
    if(await onView(view)===false){pending=latest;schedule();return;}if(!current())return;
    contentRevision=view.contentRevision;onSynchronized();
   }catch(error){
    if(!current()||controller.signal.aborted)return;
    if([404,405,409].includes(error.status)){unsupported();return;}
    report(error);if(closed)return;pending??=latest;viewFailures=Math.min(2,viewFailures+1);
    const retryAfter=Number.isFinite(error.retryAfterMs)?Math.max(0,Math.min(error.retryAfterMs,2147483647)):0;
    schedule(Math.max(viewFailures===1?30000:60000,retryAfter),true);return;
   }
  }}finally{loading=false;if(pending&&!closed&&!retry)void drain();}
 }
 function state(value){
  if(!current())return;
  if(value?.kind!=='speaking-student-state-v1'||!uuid.test(value.unitId||'')||value.studentRef!==binding.studentRef
   ||(boundUnit&&value.unitId!==boundUnit)||!hash(value.contentRevision)||!hash(value.docsRevision)
   ||!Array.isArray(value.docsJobs)||!Object.hasOwn(value,'docsProgress')||typeof value.epoch!=='string'||!Number.isSafeInteger(value.sequence)||value.sequence<1){
    report(failure('SPEAKING_STATE_INVALID'));unsupported();return;
  }
  if(value.epoch===epoch&&value.sequence<=sequence)return;epoch=value.epoch;sequence=value.sequence;
  boundUnit=value.unitId;latest=value;pending=value;stats.frames++;
  if(value.docsRevision!==docsRevision){onDocs(value);if(!current())return;docsRevision=value.docsRevision;stats.docs++;}
  if(retry&&retryIsError&&value.contentRevision!==contentRevision)return;
  clearTimer(retry);retry=null;retryIsError=false;void drain();
 }
 observer=observerFactory({url:root+'/observation/student/events',
  fetcher:(url,options)=>fetcher(url,{...options,method:'POST',headers:{...options.headers,'content-type':'application/json'},body:JSON.stringify(body())}),
  poll:async options=>{try{const data=await request('status',options);pollFailures=0;return data.state;}
   catch(error){error.retryAfterMs=Math.max(error.retryAfterMs||0,Math.min(15000*2**Math.min(2,++pollFailures),60000));throw error;}},
  onState:state,onUnavailable,onUnsupported:unsupported,onRevoked:value=>report(Object.assign(failure(value.code,value.status),value)),
  pollInterval:15000,pollErrorInterval:30000,reconnectInterval:15000,maxReconnectDelay:60000,unsupportedStatuses:[409],
  initialPollDelay:1000,reconnectGraceMs:1000,setTimer,clearTimer});
 return{close,snapshot(){return{...stats,closed,unitId:boundUnit,loading,transport:observer?.snapshot?.()};}};
}
