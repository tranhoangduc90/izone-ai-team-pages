import {createPendingPoller} from './pending-poller.js';
import {createSpeakingStudentTracker} from '../shared/speaking-student-tracking.mjs?v=20261102-speaking1';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const decimal=value=>/^\d+$/.test(String(value??''))?String(value).replace(/^0+(?=\d)/,''):null;
const less=(a,b)=>a!==null&&b!==null&&(a.length<b.length||(a.length===b.length&&a<b));

// Giữ poller cũ cho backend/tab cũ và khi không hỗ trợ stream. Chỉ đăng ký khi
// có việc chờ; tab ẩn vẫn giữ nhịp60giây native, idle không tạo polling/SSE mới.
export function createSpeakingLivePoller({refresh,hasSession,isPending,onError,getContext,onView,onDocs,readEpoch=()=>0,isBusy=()=>false,
 trackerFactory=createSpeakingStudentTracker,nativePollerFactory=createPendingPoller,documentObject=document}){
 const native=nativePollerFactory({refresh,hasSession,isPending,onError});
 let tracker=null,key=null,supported=false,blocked=false,revoked=false,expected=false,progress=null,progressDocument=null,intent=0;
 const contextKey=context=>JSON.stringify([context.base,context.identity.accessToken,context.identity.studentRef,context.unitId||null]);
 const close=()=>{tracker?.close();tracker=null;};
 function context(){
  const value=getContext(),next=contextKey(value);
  if(key!==next){close();native.stop();key=next;blocked=false;revoked=false;supported=false;progress=null;progressDocument=value.documentId||null;}
  return value;
 }
 function record(value,documentId){
  if(progressDocument!==documentId){progressDocument=documentId;progress=null;}
  if(progress&&value&&(less(decimal(value.sequence),decimal(progress.sequence))||less(decimal(value.applied_sequence),decimal(progress.applied_sequence))))return false;
  if(!value&&progress)return false;progress=value;return true;
 }
 function synchronize(deferLegacyStart=false){
  if(!hasSession()){close();native.stop();return;}
  const selected=context();
  if(revoked){close();native.stop();return;}
  const pending=expected||isPending();
  if(!pending){close();native.stop();return;}
  if(!supported||blocked||documentObject.hidden){close();if(expected)native.expect();else native.update();return;}
  native.stop();if(tracker||(deferLegacyStart&&selected.base.endsWith('/api/speaking-homework')))return;
  const binding=key;
  const current=()=>hasSession()&&key===binding&&contextKey(getContext())===binding;
  tracker=trackerFactory({base:selected.base,identity:selected.identity,unitId:uuid.test(selected.unitId||'')?selected.unitId:null,readEpoch:()=>JSON.stringify([readEpoch(),intent]),isCurrent:current,canRead:()=>!isBusy(),
   onView:async view=>{if(!current()||isBusy())return false;return onView(view);},
   onDocs:value=>{if(current()&&record(value.docsProgress,value.documentId||null))onDocs(value);},
   onSynchronized:()=>{if(current())synchronize();},
   onError:error=>{if(!current())return;if([401,403,423].includes(error.status)){revoked=true;close();native.stop();}onError(error);},
   onUnavailable:error=>{if(current())onError(error);},
   // Metadata cuối có thể vừa xóa cờ pending trước khi view trả409. Giữ một
   // lượt đọc native để nhận trọn nội dung cuối, rồi settled sẽ cho nghỉ.
   onUnsupported:()=>{if(!current())return;blocked=true;expected=true;close();native.expect();}});
 }
 const visibility=()=>synchronize();documentObject.addEventListener('visibilitychange',visibility);
 return{
  observed(data){
   const selected=context();
   supported=data.capabilities?.studentStateStream===true&&data.capabilities?.studentCombinedView===true;
   record(data.docsProgress||null,data.documentId||data.assignment?.documentId||selected.documentId||null);synchronize();
  },
  acceptDocs(value,documentId){const selected=context();return record(value,documentId??selected.documentId??null);},
  // Legacy shares an IP limit with the save, so open a new stream after its native readback.
  expect(){intent++;expected=true;synchronize(true);},retry(){intent++;expected=true;if(supported&&!blocked&&!documentObject.hidden)synchronize();else native.retry();},
  update(){synchronize();},settled(){expected=false;if(!supported||blocked||documentObject.hidden)native.settled();synchronize();},
  stop(){close();native.stop();key=null;supported=false;blocked=false;revoked=false;expected=false;progress=null;progressDocument=null;},
  dispose(){this.stop();documentObject.removeEventListener('visibilitychange',visibility);},
  snapshot(){return{supported,blocked,revoked,expected,tracking:Boolean(tracker),transport:tracker?.snapshot?.()};}
 };
}
