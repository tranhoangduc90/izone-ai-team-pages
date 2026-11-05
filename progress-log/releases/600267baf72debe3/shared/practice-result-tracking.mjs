import {createTestStateObserver} from '/izone-ai-team-pages/progress-log/releases/600267baf72debe3/shared/test-state-observer.mjs';
const revision=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
const keys=['bindingId','studentRef','assignmentId','attemptId','code'];
/** Native result content and Docs progress have separate revisions; only content changes need a full read. */
export function createPracticeResultTracker({scope,url,headers,poll,loadResult,initialResult=null,onResult,onProgress,onError,onUnavailable=()=>{},onSynchronized=()=>{},onUnsupported=()=>{},observerFactory=createTestStateObserver,interval=30000,setTimer=setTimeout,clearTimer=clearTimeout}){
 const binding={...scope};if(keys.some(key=>!binding[key])||!Number.isInteger(binding.attemptNo)||![poll,loadResult,onResult,onProgress,onError].every(fn=>typeof fn==='function'))throw Error('RESULT_TRACKER_OPTIONS_INVALID');
 let closed=false,running=false,available=false,pending=null,retryTimer=null,observer,content=null,latest=null,watermark=null,errorVersion=0,firstResult=initialResult;const controller=new AbortController(),stats={frames:0,resultReads:0};
 function close(){if(closed)return;closed=true;clearTimer(retryTimer);controller.abort();observer?.close();pending=null;}
 function unavailable(value){if(closed)return;errorVersion++;available=false;onUnavailable(value);}
 function unsupported(){close();onUnsupported();}
 function report(error){if(closed||controller.signal.aborted)return;error.status??=error.httpStatus;if([401,403,423].includes(error.status))close();onError(error);}
 const currentLatest=value=>JSON.stringify([value.latestAttemptId,value.latestStatus]);
 async function drain(){
  if(closed||running||!pending)return;running=true;
  try{while(pending&&!closed){let value=pending;pending=null;
   try{
    if(watermark&&value.epoch!==watermark.epoch){
     const fresh=await poll({signal:controller.signal});if(closed)return;if(!valid(fresh))throw Object.assign(Error('RESULT_STATE_INVALID'),{code:'RESULT_STATE_INVALID',status:503});
     value=fresh;watermark={epoch:fresh.epoch,sequence:fresh.sequence};
    }
    if(value.resultRevision!==content||currentLatest(value)!==latest){
     const cached=firstResult;firstResult=null;
     let result=cached?.resultRevision===value.resultRevision&&JSON.stringify([cached.attempts?.at(-1)?.id,cached.attempts?.at(-1)?.status])===currentLatest(value)?cached:null;
     if(!result){stats.resultReads++;result=await loadResult({signal:controller.signal,expectedRevision:value.resultRevision});}if(closed)return;
     if(!result.identity||['bindingId','studentRef','assignmentId'].some(key=>result.identity[key]!==binding[key])||result.attempt?.id!==binding.attemptId||result.attempt?.status!=='submitted'||result.resultCode!==binding.code)throw Object.assign(Error('RESULT_SCOPE_CHANGED'),{code:'RESULT_SCOPE_CHANGED',status:403});
     const errors=errorVersion,fresh=await poll({signal:controller.signal});if(closed)return;
     if(!valid(fresh))throw Object.assign(Error('RESULT_STATE_INVALID'),{code:'RESULT_STATE_INVALID',status:503});
     watermark={epoch:fresh.epoch,sequence:fresh.sequence};
     value=pending&&pending.epoch===fresh.epoch&&pending.sequence>fresh.sequence?pending:fresh;pending=null;
     watermark={epoch:value.epoch,sequence:value.sequence};
     if(result.resultRevision!==value.resultRevision||result.attempts?.at(-1)?.id!==value.latestAttemptId||result.attempts?.at(-1)?.status!==value.latestStatus){pending=value;throw Object.assign(Error('RESULT_REVISION_CHANGED'),{code:'RESULT_REVISION_CHANGED',status:409});}
     await onResult(result);if(closed)return;content=value.resultRevision;latest=currentLatest(value);if(errors===errorVersion)available=true;
    }
    if(available&&!pending){await onProgress(value);if(!closed&&available&&!pending)onSynchronized();}
   }catch(error){
    if(closed||controller.signal.aborted)return;report(error);if(closed)return;
    pending??=value;retryTimer=setTimer(()=>{retryTimer=null;void drain();},interval);retryTimer?.unref?.();return;
   }
  }}finally{running=false;if(pending&&!closed&&!retryTimer)void drain();}
 }
 function valid(value){return value?.kind==='practice-student-state-v1'&&!keys.some(key=>value[key]!==binding[key])&&value.attemptNo===binding.attemptNo&&revision(value.resultRevision)&&typeof value.epoch==='string'&&Number.isSafeInteger(value.sequence)&&value.sequence>0&&value.identity&&!['bindingId','studentRef','assignmentId'].some(key=>value.identity[key]!==binding[key])&&Array.isArray(value.events)&&!value.events.some(event=>!event||event.attempt!==binding.attemptNo||!Number.isInteger(event.sequence)||typeof event.docs!=='string');}
 function state(value){
  if(closed||watermark?.epoch===value?.epoch&&value.sequence<=watermark.sequence)return;
  if(!valid(value)){
   unavailable({code:'RESULT_STATE_INVALID',status:503});unsupported();return;
  }
  stats.frames++;available=true;pending=value;clearTimer(retryTimer);retryTimer=null;void drain();
 }
 observer=observerFactory({url,headers,poll,onState:state,onUnavailable:unavailable,onUnsupported:unsupported,onRevoked:value=>report(Object.assign(Error('Không còn quyền xem kết quả. Hãy mở lại bài.'),value)),pollInterval:interval,pollErrorInterval:interval,initialPollDelay:1000,reconnectGraceMs:1000});
 return{close,snapshot:()=>({...stats,closed,running,transport:observer?.snapshot?.()})};
}
