import {createTestStateObserver} from '../../shared/test-state-observer.mjs?v=20261101-tsto1';
const md5=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);

// Trạng thái nhỏ chỉ báo nội dung/quyền đổi; API gốc vẫn tải và kiểm chủ dữ liệu.
// Lượt đọc lỗi không được xác nhận revision mới hoặc xóa nội dung đang xem.
export function createTermTeacherTracker({scope,url,poll,loadContent,onError,onUnavailable=()=>{},onSynchronized=()=>{},onUnsupported=()=>{},
 initialState=null,isCurrent=()=>true,observerFactory=createTestStateObserver,interval=30000,setTimer=setTimeout,clearTimer=clearTimeout}){
 const binding={className:scope.className,testSlug:scope.testSlug,studentRef:scope.studentRef||null};
 if(!binding.className||!binding.testSlug||![poll,loadContent,onError,isCurrent].every(fn=>typeof fn==='function'))throw Error('TERM_TEACHER_TRACKER_OPTIONS_INVALID');
 const valid=value=>value?.kind==='term-teacher-state-v1'&&value.className===binding.className&&value.testSlug===binding.testSlug
  &&value.studentRef===binding.studentRef&&Number.isInteger(value.definitionVersion)&&value.definitionVersion>0
  &&md5(value.contentRevision)&&md5(value.accessRevision);
 const signature=value=>JSON.stringify([value.definitionVersion,value.contentRevision,value.accessRevision]);
 if(initialState!==null&&!valid(initialState))throw Error('TERM_TEACHER_STATE_INVALID');
 let closed=false,running=false,available=false,pending=null,retryTimer=null,observer,applied=initialState?signature(initialState):null;
 const controller=new AbortController(),stats={frames:0,contentReads:0};
 function close(){if(closed)return;closed=true;clearTimer(retryTimer);controller.abort();observer?.close();pending=null;}
 function current(){if(closed)return false;if(!isCurrent()){close();return false;}return true;}
 function unsupported(){close();onUnsupported();}
 function unavailable(value){if(!current())return;available=false;onUnavailable(value);}
 function report(error){if(!current()||controller.signal.aborted)return;if([401,403,423].includes(error.status))close();onError(error);}
 async function drain(){
  if(!current()||running||!pending)return;running=true;
  try{while(pending&&current()){
   const value=pending;pending=null;
   try{
    const next=signature(value);
    if(next!==applied){stats.contentReads++;await loadContent({signal:controller.signal,state:value});if(!current())return;applied=next;}
    if(available&&!pending)onSynchronized(value);
   }catch(error){
    if(!current()||controller.signal.aborted)return;report(error);if(closed)return;
    pending??=value;retryTimer=setTimer(()=>{retryTimer=null;void drain();},interval);retryTimer?.unref?.();return;
   }
  }}finally{running=false;if(pending&&!closed&&!retryTimer)void drain();}
 }
 function state(value){
  if(!current())return;
  if(!valid(value)){unavailable({code:'TERM_TEACHER_STATE_INVALID',status:503});unsupported();return;}
  stats.frames++;available=true;pending=value;clearTimer(retryTimer);retryTimer=null;void drain();
 }
 observer=observerFactory({url,poll,onState:state,onUnavailable:unavailable,onUnsupported:unsupported,
  onRevoked:value=>report(Object.assign(Error('Phiên hoặc quyền xem lớp đã thay đổi.'),value)),
  pollInterval:interval,pollErrorInterval:interval,stallMs:30000,initialPollDelay:1000,reconnectGraceMs:1000});
 return{close,snapshot(){return{...stats,closed,running,transport:observer?.snapshot?.()};}};
}

// Giao diện cũ vẫn đọc đầy đủ mỗi30giây khi API chưa công bố hỗ trợ trạng thái gọn.
// Lần vào/đổi lớp/chủ động làm mới đọc metadata trước, rồi đọc nội dung để không
// bỏ sót thay đổi giữa snapshot đầu và lúc bắt đầu nhận SSE.
export function createTermTeacherDashboardTracking({current,request,loadContent,onError,onUnavailable=()=>{},onSynchronized=()=>{},trackerFactory=createTermTeacherTracker}){
 let active=null,opening=null;const unsupported=new Set();
 const key=scope=>JSON.stringify([scope.generation,scope.apiBase,scope.className,scope.testSlug,scope.studentRef||null]);
 function close(){active?.tracker.close();active=null;opening?.controller.abort();opening=null;}
 async function load(options={}){
  const scope=current();if(!scope)return;
  const id=key(scope),isCurrent=()=>{const value=current();return Boolean(value&&key(value)===id);};
  if(!scope.enabled||unsupported.has(id)){close();return loadContent(options);}
  if(active?.id===id&&options.quiet)return;
  if(opening?.id===id)return opening.promise;
  close();const controller=new AbortController(),entry={id,controller,promise:null};opening=entry;
  const params=new URLSearchParams({class:scope.className,test:scope.testSlug});if(scope.studentRef)params.set('student',scope.studentRef);
  const path='/api/term-tests/teacher/state?'+params;
  entry.promise=Promise.resolve().then(async()=>{
   let initialState=null;
   try{initialState=(await request(path,{signal:controller.signal,isCurrent})).state;}
   catch(error){
    if(!isCurrent()||controller.signal.aborted)return;
    if([401,403,423].includes(error.status))throw error;
    if([404,405].includes(error.status))unsupported.add(id);else onUnavailable(error);
   }
   if(!isCurrent()||controller.signal.aborted)return;
   await loadContent(options);if(!isCurrent()||controller.signal.aborted||unsupported.has(id))return;
   const tracker=trackerFactory({scope,url:scope.apiBase+'/api/term-tests/teacher/state/stream?'+params,
    initialState,isCurrent,poll:async({signal})=>(await request(path,{signal,isCurrent})).state,
    loadContent:input=>loadContent({quiet:true,...input}),onError,onUnavailable,onSynchronized,
    onUnsupported(){unsupported.add(id);if(active?.id===id)active=null;if(isCurrent())void loadContent({quiet:true}).catch(onError);}});
   if(!isCurrent()||controller.signal.aborted){tracker.close();return;}active={id,tracker};
  }).finally(()=>{if(opening===entry)opening=null;});
  return entry.promise;
 }
 return{load,close,snapshot:()=>active?.tracker.snapshot()||null};
}
