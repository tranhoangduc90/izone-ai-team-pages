/** Observe compact metadata; fetch native content only for changed, still-bound scopes. */
import {createTestStateObserver} from './test-state-observer.mjs?v=20261101-tsto1';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function createPracticeTeacherTracker({scope,url,poll,loadStudents,loadDetail,onStudents,onDetail,onError,onUnavailable=()=>{},onSynchronized=()=>{},onUnsupported=()=>{},observerFactory=createTestStateObserver,interval=30000,setTimer=setTimeout,clearTimer=clearTimeout}){
 const binding={classId:scope.classId,code:scope.code,unitId:scope.unitId||null};
 if(!binding.classId||!binding.code||![poll,loadStudents,onStudents,onError].every(fn=>typeof fn==='function')||binding.unitId&&![loadDetail,onDetail].every(fn=>typeof fn==='function'))throw Error('TEACHER_TRACKER_OPTIONS_INVALID');
 let closed=false,running=false,available=false,pending=null,retryTimer=null,observer,controller=new AbortController(),classRevision=null,unitRevision=null;
 const stats={frames:0,studentReads:0,detailReads:0};
 function close(){if(closed)return;closed=true;clearTimer(retryTimer);controller.abort();observer?.close();pending=null;}
 function unsupported(){close();onUnsupported();}
 function unavailable(value){available=false;onUnavailable(value);}
 function report(error){if(closed||controller.signal.aborted)return;if([401,403,423].includes(error.status)){close();onError(error);}else onError(error);}
 async function drain(){
  if(closed||running||!pending)return;running=true;
  try{while(pending&&!closed){
   const value=pending;pending=null;
   try{
    if(value.classRevision!==classRevision){
     stats.studentReads++;const students=await loadStudents({signal:controller.signal});if(closed)return;
     if(students.code!==binding.code||students.class?.classId!==binding.classId||!Array.isArray(students.students))throw Object.assign(Error('TEACHER_SCOPE_CHANGED'),{code:'TEACHER_SCOPE_CHANGED',status:409});
     await onStudents(students);if(closed)return;classRevision=value.classRevision;
    }
    if(binding.unitId&&value.unitRevision!==unitRevision){
     stats.detailReads++;const detail=await loadDetail({signal:controller.signal});if(closed)return;
     if(detail.id!==binding.unitId||detail.classId!==binding.classId||detail.code!==binding.code)throw Object.assign(Error('TEACHER_SCOPE_CHANGED'),{code:'TEACHER_SCOPE_CHANGED',status:409});
     await onDetail(detail);if(closed)return;unitRevision=value.unitRevision;
    }
    if(available&&!pending)onSynchronized();
   }catch(error){
    if(closed||controller.signal.aborted)return;
    if(error.code==='TEACHER_SCOPE_CHANGED'){onUnavailable(error);unsupported();return;}
    report(error);if(closed)return;
    pending??=value;retryTimer=setTimer(()=>{retryTimer=null;void drain();},interval);retryTimer?.unref?.();return;
   }
  }}finally{running=false;if(pending&&!closed&&!retryTimer)void drain();}
 }
 function state(value){
  if(closed)return;
  if(value.kind!=='practice-teacher-state-v1'||value.classId!==binding.classId||value.code!==binding.code||(value.unitId||null)!==binding.unitId||!hash(value.classRevision)||(binding.unitId?!hash(value.unitRevision):value.unitRevision!==null)){
   unavailable({code:'TEACHER_STATE_INVALID',status:503});unsupported();return;
  }
  stats.frames++;available=true;pending=value;clearTimer(retryTimer);retryTimer=null;void drain();
 }
 observer=observerFactory({url,poll,onState:state,onUnavailable:unavailable,onUnsupported:unsupported,onRevoked:value=>report(Object.assign(Error('Không còn quyền xem bài. Hãy kiểm tra lại tài khoản và lớp.'),value)),pollInterval:interval,pollErrorInterval:interval,initialPollDelay:1000,reconnectGraceMs:1000});
 return{close,snapshot(){return{...stats,closed,running,transport:observer?.snapshot?.()};}};
}
