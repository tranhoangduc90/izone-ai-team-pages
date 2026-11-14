// Dùng adapter ghi chú thuần; không khởi tạo pane hoặc controller Reading.
import {nativeAnnotations} from './native-reading.mjs';
import {nativeVisibility,updateNativeShell,audioProgress} from './native-shell.mjs';
import {portalStatus} from './portal-status.mjs';
import {mountNativeWriting} from './native-writing.mjs';
import {renderCompleteWritingResult} from './writing-result.mjs';
import {DurableStore} from './storage.mjs';
import {prepareWritingOffline} from './offline.mjs';
const $=id=>document.getElementById(id),text=(id,v)=>{const e=$(id);e.textContent=v;if(id==='notice')e.hidden=!v;},show=(id,v=true)=>nativeVisibility(id,v);
const testId=document.body.dataset.test,REAL_API='https://ducizone.ddns.net/substitute-teacher-api/skill-makeup/v1/tests/'+testId;
let transientNotice=false,stateEpoch=0;let storage,state,content,roster=[],ui,busy=false,syncing=false,saveTimer,pollTimer,releaseOwner,baseMono=performance.now(),baseNow=Date.now(),contentMounted=false,ownerHeld=false;
const earlySubmissions=[];
let submissionJournal,submissionJournalLoading=false;
function emitSubmission(action,fields={}) {
 const identity=state?.identity;
 if(!identity||identity.classCode==='DEMO')return;
 if(submissionJournal){submissionJournal.emit(action,fields);return;}
 if(earlySubmissions.length<24)earlySubmissions.push([identity,action,fields]);
 if(submissionJournalLoading)return;
 submissionJournalLoading=true;
 void import('./submission-journal-v1.mjs').then(({createSubmissionJournal})=>{
  submissionJournal=createSubmissionJournal({endpoint:REAL_API,build:'substitute-skill-rw-journal-v1',
   getIdentity:()=>state?.identity?.classCode==='DEMO'?null:state?.identity,section:'writing'});
  for(const [owner,event,data] of earlySubmissions.splice(0)){
   if(owner.attemptId===state?.identity?.attemptId&&owner.generation===state.identity.generation)
    submissionJournal.emit(event,data);
  }
 }).catch(()=>{earlySubmissions.length=0;}).finally(()=>{submissionJournalLoading=false;});
}
const fail=e=>{transientNotice=!['ALREADY_SUBMITTED','ATTEMPT_ALREADY_ACTIVE','SKILL_GENERATION_STALE','LOCAL_PERSIST_FAILED','SKILL_TEST_UNAVAILABLE','SKILL_INTAKE_CLOSED','OWNER_BUSY'].includes(e.code);text('notice',({ALREADY_SUBMITTED:'Bạn đã nộp bài này. Hãy liên hệ giảng viên nếu cần kiểm tra.',ATTEMPT_ALREADY_ACTIVE:'Bạn đang có một lượt thi. Hãy dùng trình duyệt đang làm hoặc nhờ giảng viên cấp lại.',SKILL_GENERATION_STALE:'Giảng viên đã cấp lại lượt. Bài trên thiết bị được giữ để đối soát.',LOCAL_PERSIST_FAILED:'Không lưu được trên thiết bị. Giữ nguyên trang và liên hệ giảng viên.',SKILL_TEST_UNAVAILABLE:'Bài chưa mở hoặc đang tạm đóng.',SKILL_INTAKE_CLOSED:'Bài đang tạm đóng nhận lượt mới. Hãy liên hệ giảng viên.',OWNER_BUSY:'Bài đang được mở ở tab khác. Hãy quay lại tab đó.'}[e.code]||'Chưa kết nối được hệ thống. Bài trên thiết bị vẫn được giữ. Hãy thử lại khi có mạng.'));if(e.code==='SKILL_GENERATION_STALE'){freeze();show('replace-attempt');}};
async function api(action,payload,method='POST'){
 const r=await fetch(((state?.identity?.classCode||state?.classCode||$('class').value)==='DEMO'?REAL_API.replace('/v1/tests/','/v1/demo/tests/'):REAL_API)+'/'+action,{method,cache:'no-store',credentials:'omit',headers:method==='POST'?{'Content-Type':'application/json'}:{},body:method==='POST'?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(12000)});
 const v=await r.json();if(!r.ok)throw Object.assign(Error(),{code:v.code,status:r.status});if(transientNotice){text('notice','');transientNotice=false;}return v;
}

const personKey=(c,r)=>testId+':person:'+encodeURIComponent(c)+':'+encodeURIComponent(r);
async function retainPerson(){if(state?.prepareOperation)await storage.put(personKey(state.identity?.classCode||state.classCode,state.identity?.studentRef||state.studentRef),structuredClone(state));}
async function restorePerson(c,r){const saved=await storage.get(personKey(c,r));if(saved?.prepareOperation){state=saved;content=saved.content;}}
async function leaveCurrent({reset=false,abandon=false}={}){
 stateEpoch++;clearTimeout(saveTimer);freeze();
 if(abandon){await storage.put(testId+':history:'+(state.identity?.attemptId||state.prepareOperation),structuredClone(state));await storage.put(personKey(state.identity?.classCode||state.classCode,state.identity?.studentRef||state.studentRef),{});}else if(!reset)await retainPerson();
 const saved=state;state={};
 if(reset){await storage.put(personKey('DEMO',saved?.identity?.studentRef||saved?.studentRef||'demo'),{});}
 await storage.put(testId,{});ownerHeld=false;releaseOwner?.();if(reset)localStorage.setItem('substitute-skill-demo-reset:'+testId,JSON.stringify({attemptId:saved?.identity?.attemptId,nonce:crypto.randomUUID()}));
 const url=new URL(location.href);if(reset)url.searchParams.set('class','DEMO');else url.searchParams.delete('class');location.replace(url.href);
}

const persist=()=>{if(!ownerHeld)throw Object.assign(Error(),{code:'OWNER_BUSY'});state.savedAt=Date.now();return storage.put(testId,state);};
function now(){const n=baseNow+performance.now()-baseMono;return Math.max(n,state?.lastTime||0);}
function anchor(value){baseNow=value.serverNow;baseMono=performance.now();}
function payload(){return {...state.identity,revision:state.revision,capturedAt:Math.min(now(),state.deadlineAt??Infinity),snapshot:{tasks:content.writing.tasks.map(t=>({taskNumber:t.taskNumber,essay:state.native.drafts.writing[t.id]||'',outline:state.outlines?.[t.id]||''}))}};}
async function own(){if(ownerHeld)return;if(!navigator.locks)throw Object.assign(Error(),{code:'OWNER_BUSY'});await new Promise((resolve,reject)=>navigator.locks.request('substitute-skill:'+testId,{ifAvailable:true},async lock=>{if(!lock)return reject(Object.assign(Error(),{code:'OWNER_BUSY'}));ownerHeld=true;resolve();await new Promise(r=>releaseOwner=r);}).catch(reject));}
function freeze(){ui?.disable();$('submit').disabled=true;}
const current=(epoch,id)=>ownerHeld&&epoch===stateEpoch&&state?.identity?.attemptId===id;
function resultView(v=state.lastServer||{}){
 show('lobby',false);show('exam',false);show('finished');const received=!!v.receipt,ready=received&&!!v.result;document.body.classList.toggle('writing-result-ready',ready);
 text('receipt',received?'Mã biên nhận: '+v.receipt.receiptId:'Bản nộp đã lưu trên thiết bị · đang chờ biên nhận');
 show('change-person',received);show('check-result',false);show('retry-send',false);
 text('grading-status',ready?'':!received?'Bài đã lưu trên thiết bị · đang gửi tới hệ thống.':v.gradingState==='review_required'?'Đã nhận bài · phần chấm cần giảng viên kiểm tra. Bạn không cần nộp lại.':v.gradingState==='waiting_confirmation'?'Đã nhận bài · đang xác minh kết quả chấm. Bạn không cần nộp lại.':v.gradingState==='processing'?'Đã nhận bài · đang chấm.':'Đã nhận bài · đang chờ chấm.');
 if($('result-progress-note'))text('result-progress-note',ready?'':received?'Kết quả và nhận xét sẽ tự hiển thị tại đây khi chấm xong.':'Hệ thống sẽ tự kiểm tra biên nhận và gửi tiếp khi kết nối trở lại. Bạn hãy giữ trang trên thiết bị này.');
 if($('result-summary'))show('result-summary',ready);if($('feedback-title'))show('feedback-title',ready);show('portal-status',ready);
 if(!ready){updateNativeShell(state,content,v,()=>persist());return;}
 text('portal-status',portalStatus(v));
 if($('score-value')){text('score-value',Number(v.result.score).toFixed(1));text('score-max',' / '+v.result.max);}else text('score','Writing: '+v.result.score+' / '+v.result.max);
 if($('result-meta')){const labels=(v.result.tasks||[]).map(t=>'Task '+t.taskNumber).join(' và '),name=document.querySelector('.skill-bar h1')?.textContent?.replace(/^Writing\s*·\s*/,'')||'';text('result-meta',[labels,name].filter(Boolean).join(' · '));}
 const key=JSON.stringify(v.result);if($('feedback').dataset.result!==key){renderCompleteWritingResult($('feedback'),v.result,{writingConfig:content?.writing,drafts:state.native?.drafts?.writing});$('feedback').dataset.result=key;}
 updateNativeShell(state,content,v,()=>persist());
}
async function check(){if(!ownerHeld||!state?.identity||syncing||busy)return;const epoch=stateEpoch,id=state.identity.attemptId;try{const v=await api('status',state.identity);if(!current(epoch,id))return;anchor(v);state.lastServer=v;if(v.receipt){if(state.sealed&&v.receipt.operationId!==state.sealed.operationId)throw Object.assign(Error(),{code:'SUBMISSION_CONFLICT'});state.phase='submitted';state.sealed=null;await persist();if(current(epoch,id))resultView(v);}else if(state.phase==='submitted'||state.sealed)resultView(v);}catch(e){if(current(epoch,id))fail(e);}}
async function synchronize(){
 if(!ownerHeld||syncing||!state?.identity||busy)return;syncing=true;const epoch=stateEpoch,id=state.identity.attemptId;
 try{
  if(state.sealed){const operationId=state.sealed.operationId;emitSubmission('receipt_lookup',{operationId});const previous=await api('receipt',state.identity);if(!current(epoch,id))return;anchor(previous);let v=previous;if(!previous.receipt){
   emitSubmission('receipt_missing',{operationId});emitSubmission('submit_requested',{operationId});
   try{v=await api('submit',state.sealed);}catch(error){if(current(epoch,id))emitSubmission('submit_failed',{operationId,code:error.code,http:error.status});throw error;}
  }if(!current(epoch,id))return;if(v.receipt?.operationId!==state.sealed.operationId)throw Object.assign(Error(),{code:'SUBMISSION_CONFLICT'});emitSubmission('receipt_observed',{operationId,receiptId:v.receipt.receiptId});state.lastServer=v;state.phase='submitted';state.sealed=null;await persist();if(current(epoch,id))resultView(v);}
  else if(state.phase==='draft'&&state.pending){const p=structuredClone(state.pending);await api('snapshot',p);if(!current(epoch,id))return;if(state.pending?.revision===p.revision)state.pending=null;await persist();if(current(epoch,id))ui?.saveStatus(state.pending?'Đã lưu trên thiết bị · chờ đồng bộ':'Đã lưu trên hệ thống');}
 }catch(e){if(current(epoch,id)){ui?.saveStatus('Đã lưu trên thiết bị · chờ kết nối');fail(e);}}
 finally{syncing=false;}
}
async function changed(){if(state.phase!=='draft'||!ownerHeld)return;state.revision++;state.lastTime=now();if(state.lastTime>=state.deadlineAt)return seal(true);state.pending=payload();try{await persist();ui.saveStatus('Đã lưu trên thiết bị');clearTimeout(saveTimer);saveTimer=setTimeout(synchronize,900);}catch(e){freeze();fail(e);}}
function mount(){if(contentMounted)return;contentMounted=true;ui=mountNativeWriting({writingConfig:content.writing,elements:{writingWorkspace:$('writingWorkspace'),writingTaskTabs:$('writingTaskTabs'),previousWritingTask:$('previousWritingTask'),nextWritingTask:$('nextWritingTask'),writingTaskPosition:$('writingTaskPosition')},state:state.native,onChange:()=>void changed(),onLayout:()=>{if(state){updateNativeShell(state,content,undefined,()=>persist());void persist().catch(fail);}}});}
const annotationLoaders={
 'substitute-test-1-k56':()=>import('../substitute-test-1-k56-computer-based/annotations.js'),
 'substitute-test-2-k56':()=>import('../substitute-test-2-k56-computer-based/annotations.js'),
 'substitute-test-1-k67':()=>import('../substitute-test-1-k67-computer-based/annotations.js'),
 'substitute-test-2-k67':()=>import('../substitute-test-2-k67-computer-based/annotations.js')
};
function displayExam(){show('lobby',false);show('exam');show('finished',false);text('learner',state.name+' · '+state.identity.classCode);mount();updateNativeShell(state,content,undefined,()=>persist());const e=stateEpoch,id=state.identity.attemptId,load=annotationLoaders[content.sourceSlug];if(!load)throw Error('NATIVE_SOURCE_INVALID');void nativeAnnotations({content,identity:state.identity,storage,load,onError:error=>{if(current(e,id))fail(error);}}).catch(error=>{if(current(e,id))fail(error);});}
async function seal(automatic=false){
 if(busy||state.phase!=='draft'||!ownerHeld)return;busy=true;clearTimeout(saveTimer);
 try{const p=payload();if(!automatic&&p.snapshot.tasks.some(t=>!t.essay.trim())){text('notice','Bạn chưa viết đủ các Task. Hãy kiểm tra trước khi nộp.');return;}state.revision++;p.revision=state.revision;state.sealed={...p,operationId:crypto.randomUUID(),automatic};
 const details={operationId:state.sealed.operationId,revision:state.revision,automatic,deadlineAt:state.deadlineAt};
 for(const task of p.snapshot.tasks)if([1,2].includes(task.taskNumber))details['task'+task.taskNumber+'Length']=task.essay.length;
 emitSubmission('seal_created',details);state.pending=null;
 try{await persist();emitSubmission('seal_saved',details);}catch(error){emitSubmission('seal_save_failed',{...details,code:error.code});throw error;}
 freeze();resultView({...state.lastServer,receipt:null});busy=false;void synchronize();}catch(e){freeze();fail(e);}finally{busy=false;}
}
function tick(){if(state?.phase!=='draft'||state.sealed||!ownerHeld)return;const remaining=Math.max(0,state.deadlineAt-now()),seconds=Math.ceil(remaining/1000);text('writing-clock',String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'));if(!remaining)void seal(true);}
async function prepare(){if(busy)return;busy=true;try{
 const learner=roster.find(r=>r.studentRef===$('student').value)||state?.prepareOperation&&{name:state.name,studentRef:state.studentRef};if(!learner)return;
 if(!state?.prepareOperation)await restorePerson($('class').value,learner.studentRef);if(state?.sealed||state?.phase==='submitted'){resultView();busy=false;await synchronize();await check();return;}state??={prepareOperation:crypto.randomUUID(),classCode:$('class').value,studentRef:learner.studentRef,name:learner.name};await persist();
 const v=state.identity?await api('status',state.identity):await api('prepare',{classCode:state.classCode,studentRef:state.studentRef,operationId:state.prepareOperation});state.identity=v.identity;emitSubmission('owner_acquired');state.phase=v.status;state.revision=Math.max(state.revision||0,v.revision);state.lastServer=v;state.deadlineAt=v.deadlineAt;state.startedAt=v.startedAt;await persist();
 content=await api('content',state.identity);if(content.skill!=='writing'||content.testId!==testId||content.contentHash!==state.identity.contentHash)throw Error('CONTENT_MISMATCH');emitSubmission('content_verified');state.content=content;state.native??={drafts:{writing:{}},writingLayout:{activeTask:null,splits:{}},writingRevision:0};await persist();anchor(v);if(v.status==='submitted'){resultView(v);return;}if(v.status==='draft'){displayExam();tick();return;}text('prepare-status','Đang lưu đề và giao diện để phục hồi khi mất mạng…');const offline=await prepareWritingOffline();state.offlineBuild=offline.build;await persist();if(offline.updated){location.reload();return;}text('prepare-status','Đã sẵn sàng · '+content.durationMinutes+' phút · '+content.writing.tasks.map(t=>t.label).join(', '));$('start').disabled=false;show('identity-form',false);show('ready');
 }catch(e){fail(e);}finally{busy=false;updateNativeShell(state,content,undefined,()=>persist());}}
async function start(){if(busy)return;busy=true;try{await own();emitSubmission('start_requested');const v=await api('start',state.identity);emitSubmission('start_confirmed',{startedAt:v.startedAt,deadlineAt:v.deadlineAt});anchor(v);state.phase=v.status;state.deadlineAt=v.deadlineAt;state.lastServer=v;state.startedAt=v.startedAt;await persist();displayExam();tick();}catch(e){fail(e);}finally{busy=false;}}
$('prepare').onclick=()=>{$('confirm-name').textContent=roster.find(r=>r.studentRef===$('student').value)?.name||'';$('confirm-identity').showModal();};
$('confirm-yes').onclick=()=>{$('confirm-identity').close();void prepare();};$('confirm-no').onclick=()=>$('confirm-identity').close();$('start').onclick=start;
$('submit').onclick=()=>$('confirm-submit').showModal();$('cancel-submit').onclick=()=>$('confirm-submit').close();$('accept-submit').onclick=()=>{$('confirm-submit').close();void seal(false);};
// Kiểm trạng thái/biên nhận bằng các vòng đọc nền; không yêu cầu học viên bấm.
$('class').onchange=async()=>{const code=$('class').value;$('prepare').disabled=true;$('student').replaceChildren(new Option(code?'Chọn họ tên':'Chọn lớp trước',''));if(!code)return;try{const r=await api('roster?class='+encodeURIComponent(code),null,'GET');if($('class').value!==code)return;roster=r.students;for(const s of roster)$('student').add(new Option(s.name,s.studentRef));if(!roster.length)text('notice','Không còn học viên đủ điều kiện trong lớp này.');}catch(e){fail(e);}};
$('student').onchange=()=>$('prepare').disabled=!$('student').value;
async function loadClasses(){const r=await api('classes',null,'GET');$('class').replaceChildren(new Option('Chọn lớp',''));$('student').replaceChildren(new Option('Chọn họ tên',''));for(const c of r.classes)$('class').add(new Option(c.code,c.code));if(r.demo?.available)$('class').add(new Option('DEMO · Chỉ kiểm tra, không gửi Portal','DEMO'));text('prepare-status','Chọn lớp, họ tên và xác nhận đúng người trước khi làm bài.');const hinted=new URL(location.href).searchParams.get('class');if(hinted&&[...$('class').options].some(o=>o.value===hinted)){$('class').value=hinted;$('class').dispatchEvent(new Event('change'));}}
async function archiveCurrent(){await leaveCurrent({abandon:true});}
$('replace-attempt').onclick=async()=>{if(!ownerHeld||busy)return;busy=true;try{if(state.identity)await api('status',state.identity);else await api('prepare',{classCode:state.classCode,studentRef:state.studentRef,operationId:state.prepareOperation});text('notice','Chưa xác nhận lượt đã được cấp lại.');}catch(e){if(e.code==='SKILL_GENERATION_STALE'){try{await archiveCurrent();}catch(error){fail(error);}}else fail(e);}finally{busy=false;}};
$('change-person').onclick=()=>{if(state?.lastServer?.receipt)$('confirm-change-person').showModal();};$('cancel-change-person').onclick=()=>$('confirm-change-person').close();$('accept-change-person').onclick=async()=>{if(!ownerHeld||busy||!state?.lastServer?.receipt)return;busy=true;try{const v=await api('receipt',state.identity);if(!v.receipt)throw Error();await archiveCurrent();}catch(e){fail(e);}finally{busy=false;}};
addEventListener('visibilitychange',()=>{if(!document.hidden&&state?.phase==='submitted')void check();});
addEventListener('online',()=>{if(ownerHeld){void synchronize();void check();}});addEventListener('pagehide',()=>{if(ownerHeld&&state&&storage){state.lastTime=now();void persist().catch(()=>{});}releaseOwner?.();ownerHeld=false;});addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
try{
 await own();storage=await new DurableStore().open();state=await storage.get(testId);try{const reset=JSON.parse(localStorage.getItem('substitute-skill-demo-reset:'+testId)||'null');if(reset?.attemptId&&state?.identity?.classCode==='DEMO'&&state.identity.attemptId===reset.attemptId){state=null;await storage.put(testId,{});}}catch{}content=state?.content;
 if(state?.identity){
  if(state.sealed||state.phase==='submitted'){resultView(state.lastServer||{});await synchronize();await check();}
  else if(state.phase==='draft'){
   baseNow=Math.max(state.lastTime||state.lastServer?.serverNow||0,(state.lastTime||state.lastServer?.serverNow||0)+Math.max(0,Date.now()-(state.savedAt||Date.now())));baseMono=performance.now();
   displayExam();tick();
   try{const v=await api('status',state.identity);anchor(v);if(v.status==='submitted'){state.phase='submitted';state.lastServer=v;await persist();resultView(v);}else if(v.status==='draft'){state.deadlineAt=v.deadlineAt;tick();}else throw Object.assign(Error(),{code:'SKILL_GENERATION_STALE'});}catch(e){if(e.status&&e.status<500)freeze();fail(e);}
  }
  else await prepare();
 }else if(state?.prepareOperation)await prepare();else{state=null;await loadClasses();}
}catch(e){fail(e);}
setInterval(tick,250);setInterval(()=>{if(state?.phase==='draft'&&ownerHeld&&!state.sealed){state.lastTime=now();void persist().catch(fail);}if(state?.sealed)void synchronize();},5000);pollTimer=setInterval(()=>{if(state?.phase==='submitted')void check();},15000);

addEventListener('skill-demo-reset',async()=>{if(busy||syncing)return;const actual=state?.identity?.classCode||state?.classCode||$('class').value;if(actual!=='DEMO')return;busy=true;try{if(state?.identity){state.resetOperation??=crypto.randomUUID();await persist();await api('reset',{...state.identity,operationId:state.resetOperation});}if(state?.prepareOperation)await storage.put(testId+':demo-history:'+(state.identity?.attemptId||state.prepareOperation),structuredClone(state));await leaveCurrent({reset:true});}catch(e){fail(e);}finally{busy=false;}});
addEventListener('storage',event=>{if(event.key==='substitute-skill-demo-reset:'+testId&&(!state?.identity||state.identity.classCode==='DEMO')){stateEpoch++;clearTimeout(saveTimer);ownerHeld=false;releaseOwner?.();state={};freeze();show('exam',false);show('finished',false);show('result-ready',false);show('lobby');$('lobby').querySelectorAll('button,input,select').forEach(e=>e.disabled=true);updateNativeShell(state,null,{},()=>{});$('reset-demo').hidden=true;text('notice','Lượt DEMO đã được reset ở tab khác. Tiếp tục tại tab vừa reset; tải lại tab này khi cần kiểm tra.');}});
function requestChangePerson(){if(busy||syncing)return;if(!state?.identity){void leaveCurrent().catch(fail);return;}const d=$('confirm-change-person');d.querySelector('p').textContent='Bài làm và thời gian của người hiện tại vẫn được giữ. Bạn có thể chọn lại người này để tiếp tục đúng lượt cũ.';d.showModal();}
$('change-person').onclick=requestChangePerson;
$('accept-change-person').onclick=async()=>{if(busy||syncing)return;busy=true;try{await leaveCurrent();}catch(e){fail(e);}finally{busy=false;}};
addEventListener('skill-change-person',requestChangePerson);
