import {createTestStateObserver} from '/izone-ai-team-pages/progress-log/releases/600267baf72debe3/shared/test-state-observer.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const failure=(code,status=503)=>Object.assign(Error('Chưa đọc được bản lưu mới. Bản đang xem vẫn được giữ.'),{code,status});

// Hai store vẫn tự kiểm quyền và phát metadata. Giao diện gộp các tín hiệu thành
// tối đa một read đang chạy mỗi loại danh sách/chi tiết; metadata không xếp hàng body.
export function createSpeakingTeacherTracker({scope,stores,loadStudents,loadDetail,onStudents,onDetail,onDocs=()=>{},onError,onUnavailable=()=>{},onSynchronized=()=>{},onUnsupported=()=>{},
 isCurrent=()=>true,observerFactory=createTestStateObserver,fetcher=fetch,interval=30000,coalesceMs=100,gatherMs=250,setTimer=setTimeout,clearTimer=clearTimeout}){
 const fullUnit=scope.unitId||null,legacy=typeof fullUnit==='string'&&fullUnit.startsWith('legacy_'),rawUnit=fullUnit?(legacy?fullUnit.slice(7):fullUnit).toLowerCase():null;
 const binding={classId:scope.classId,classCode:scope.classCode,code:scope.code,unitId:rawUnit?(legacy?'legacy_':'')+rawUnit:null},selectedStore=rawUnit?(legacy?'legacy':'independent'):null;
 if(!binding.classId||!binding.classCode||!binding.code||(rawUnit&&!uuid(rawUnit))||!Array.isArray(stores)||stores.length!==2
  ||new Set(stores.map(store=>store.id)).size!==2||stores.some(store=>!['independent','legacy'].includes(store.id)||!store.url||typeof store.poll!=='function')
  ||![loadStudents,onStudents,onError].every(fn=>typeof fn==='function')||(rawUnit&&![loadDetail,onDetail].every(fn=>typeof fn==='function'))
  ||![interval,coalesceMs,gatherMs].every(value=>Number.isFinite(value)&&value>0))throw Error('SPEAKING_TEACHER_TRACKER_OPTIONS_INVALID');
 let closed=false,docsRevision=null;const latest=new Map(),available=new Map(stores.map(store=>[store.id,false])),observers=[],controller=new AbortController();
 const stats={frames:0,studentReads:0,detailReads:0,docsUpdates:0};let students,detail;
 const timer=(fn,delay)=>{const value=setTimer(fn,delay);value?.unref?.();return value;};
 function current(){if(closed)return false;if(!isCurrent()){close();return false;}return true;}
 function close(){if(closed)return;closed=true;controller.abort();students?.close();detail?.close();for(const observer of observers)observer.close();}
 function unsupported(){if(!current())return;close();onUnsupported();}
 function unavailable(store,error){if(!current())return;available.set(store,false);onUnavailable(error);}
 function report(error){if(!current())return;if([401,403,423].includes(error.status)){close();onError(error);}else onError(error);}
 function synchronized(){if(current()&&latest.size===2&&[...available.values()].every(Boolean)&&students.clean()&&(!detail||detail.clean()))onSynchronized();}
 function lane(load,validate,apply,stat){
  let wanted=null,applied=null,running=false,pendingTimer=null,timerKind=null,failures=0,deadline=null;
  const cancel=()=>{clearTimer(pendingTimer);pendingTimer=null;timerKind=null;};
  function schedule(delay,kind){if(!current()||pendingTimer||running)return;timerKind=kind;pendingTimer=timer(()=>{pendingTimer=null;timerKind=null;void drain();},delay);}
  async function drain(){
   if(!current()||running||!wanted||wanted===applied)return;running=true;const desired=wanted,requestController=new AbortController();let timedOut=false;
   deadline=timer(()=>{timedOut=true;requestController.abort();},15000);
   try{
    stats[stat]++;const value=await load({signal:AbortSignal.any([controller.signal,requestController.signal])});if(!current())return;
    if(!validate(value))throw failure('TEACHER_SCOPE_CHANGED',409);
    // Không có revision stamp trong DTO native. Mỗi lane áp response theo thứ
    // tự read, rồi đọc bù wanted mới; không bỏ mọi kết quả khi lớp đang ghi dày.
    await apply(value);if(!current())return;applied=desired;failures=0;
   }catch(error){
    if(!current()||controller.signal.aborted)return;
    if(timedOut)error=failure('SPEAKING_TEACHER_READ_TIMEOUT');
    if([404,405,409].includes(error.status)){onUnavailable(error);unsupported();return;}
    report(error);if(closed)return;failures=Math.min(2,failures+1);
    const retryAfter=Number.isFinite(error.retryAfterMs)?Math.max(0,Math.min(error.retryAfterMs,2147483647)):0;
    // running còn true: đặt timer ở finally, metadata không được phá backoff.
    timerKind='error';pendingTimer=timer(()=>{pendingTimer=null;timerKind=null;void drain();},Math.max(failures===1?interval:Math.max(interval,60000),retryAfter));
   }finally{
    clearTimer(deadline);deadline=null;running=false;
    if(current()){if(wanted!==applied&&!pendingTimer)schedule(coalesceMs,'coalesce');synchronized();}
   }
  }
  return{want(signature,delay=coalesceMs){
   wanted=signature;if(wanted===applied){cancel();synchronized();return;}
   if(!pendingTimer&&!running)schedule(delay,'coalesce');
  },clean:()=>!running&&(!wanted||wanted===applied),close(){cancel();clearTimer(deadline);},snapshot:()=>({running,pending:Boolean(pendingTimer),backoff:timerKind==='error'})};
 }
 students=lane(loadStudents,value=>value?.assignment?.code===binding.code&&value.class?.classId===binding.classId&&value.class?.classCode===binding.classCode&&Array.isArray(value.students),onStudents,'studentReads');
 if(rawUnit)detail=lane(loadDetail,value=>String(value?.id||'').toLowerCase()===binding.unitId&&value.assignment?.code===binding.code&&value.student?.classCode===binding.classCode&&Array.isArray(value.links)&&Array.isArray(value.processing),onDetail,'detailReads');
 function state(store,value){
  if(!current())return;const selected=store===selectedStore,expectedUnit=selected?rawUnit:null,previous=latest.get(store);
  if(value?.kind!=='speaking-teacher-state-v1'||value.classId!==binding.classId||value.code!==binding.code||(value.unitId||null)!==expectedUnit||!hash(value.classRevision)
   ||(selected?(!hash(value.unitContentRevision)||!hash(value.unitDocsRevision)||!value.unitDocs||!Array.isArray(value.unitDocs.docsJobs)||!Object.hasOwn(value.unitDocs,'docsProgress'))
    :(value.unitContentRevision!==null||value.unitDocsRevision!==null||value.unitDocs!==null))
   ||typeof value.revision!=='string'||typeof value.epoch!=='string'||!Number.isSafeInteger(value.sequence)||value.sequence<1){unavailable(store,failure('SPEAKING_TEACHER_STATE_INVALID'));unsupported();return;}
  if(previous?.epoch===value.epoch&&value.sequence<=previous.sequence){
   if(value.sequence===previous.sequence&&value.revision===previous.revision){available.set(store,true);synchronized();}return;
  }
  latest.set(store,value);available.set(store,true);stats.frames++;
  if(selected&&value.unitDocsRevision!==docsRevision){docsRevision=value.unitDocsRevision;stats.docsUpdates++;onDocs({unitId:binding.unitId,...value.unitDocs});if(!current())return;}
  const classSignature=JSON.stringify(['independent','legacy'].map(id=>latest.get(id)?.classRevision||null));
  students.want(classSignature,latest.size===2?coalesceMs:gatherMs);if(selected)detail.want(value.unitContentRevision);synchronized();
 }
 try{for(const store of stores){
  let pollFailures=0;
  const observer=observerFactory({url:store.url,fetcher,poll:async options=>{
   try{const value=await store.poll(options);pollFailures=0;return value;}
   catch(error){pollFailures=Math.min(2,pollFailures+1);error.retryAfterMs=Math.max(error.retryAfterMs||0,pollFailures===1?interval:Math.max(interval,60000));throw error;}
  },onState:value=>state(store.id,value),onUnavailable:error=>unavailable(store.id,error),onUnsupported:unsupported,
  onRevoked:value=>report(Object.assign(failure(value.code||'ACCESS_DENIED',value.status||403),value)),
  pollInterval:interval,pollErrorInterval:interval,reconnectInterval:15000,maxReconnectDelay:60000,initialPollDelay:1000,reconnectGraceMs:1000,unsupportedStatuses:[409],setTimer,clearTimer});
  if(closed){observer.close();break;}observers.push(observer);
 }}catch(error){close();throw error;}
 return{close,snapshot(){return{...stats,closed,students:students.snapshot(),detail:detail?.snapshot(),transport:observers.map(observer=>observer.snapshot?.())};}};
}
