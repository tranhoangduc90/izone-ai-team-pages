import {API,BUILD,PRODUCT,SLUG,CONTENT_VERSION,CONTENT_HASH,DURATION_MS} from './config.mjs';
import {DurableStore} from './storage.mjs';
import {Telemetry} from './telemetry.mjs';
import {prepareOffline} from './offline.mjs';
import {mountNativeReading,nativeLayout,nativeAnnotations} from './native-ui.mjs';
const $=id=>document.getElementById(id),text=(id,value)=>$(id).textContent=value,show=(id,v=true)=>$(id).hidden=!v;
const storage=await new DurableStore().open();let state=await storage.get('current'),preparation=await storage.get('preparation'),roster,content,layoutReady=false,ready=false,busy=false,syncing=false,retryAt=0,failures=0,releaseOwner,ownerHeld=false,baseElapsed=0,baseMono=performance.now(),sealing=false;
const tabId=crypto.randomUUID(),ownerId=state?.identity?.ownerId||preparation?.ownerId||crypto.randomUUID();
const journal=new Telemetry({tabId,ownerId});
journal.snapshot=()=>({controllerStateBefore:state?.phase||'initialization',elapsedExamMs:state?.elapsedMs??0,timerRemainingMs:DURATION_MS-(state?.elapsedMs??0),savedRevision:state?.revision??0,startedAt:state?.startedAt||null});
const persist=()=>storage.put('current',state);
function note(message){text('notice',message);show('notice');}
async function acquireOwner(){if(ownerHeld)return;if(!navigator.locks)throw Object.assign(Error(),{code:'READING_OWNER_CONFLICT'});await new Promise((resolve,reject)=>{navigator.locks.request('reading-retake:'+state.identity.attemptId,{ifAvailable:true},async lock=>{if(!lock)return reject(Object.assign(Error(),{code:'READING_OWNER_CONFLICT'}));ownerHeld=true;resolve();await new Promise(r=>releaseOwner=r);ownerHeld=false;}).catch(reject);});}
function clock(){if(state?.phase==='playing')state.elapsedMs=Math.min(DURATION_MS,Math.max(state.elapsedMs||0,baseElapsed+performance.now()-baseMono));return state?.elapsedMs||0;}
function checkpoint(){clock();if(state)state.wallAt=Date.now();}
function drawClock(){const remaining=Math.max(0,DURATION_MS-clock()),seconds=Math.ceil(remaining/1000);text('reading-clock',String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'));$('reading-clock').classList.toggle('is-urgent',remaining<=600000);}
function showExam(){show('lobby',false);show('exam');show('readingView');show('identityView');$('page-shell').classList.remove('cbt-bootstrap-shell');text('learner',state.name);drawClock();}
function saveFailure(){note('Không lưu được bài trên thiết bị. Hãy giữ nguyên trang, không tải lại và liên hệ giảng viên.');journal.emit('local_save_failed',{errorCode:'LOCAL_PERSIST_FAILED'});state.storageFailed=true;}
function viewState(){const nodes=[...document.querySelectorAll('#readingView .cbt-reading-passage,#readingView .cbt-reading-questions')];return nodes.map(e=>e.scrollTop);}
function captureUi(){if(!state||!ready)return;state.scroll=viewState();}
async function renderContent(){
 const ui=state?.ui||{flags:{reading:{}},activeSection:{reading:0},fontSize:{reading:100}};
 mountNativeReading({content,grid:$('readingQuestions'),form:$('readingView'),heading:$('exam-heading'),uiState:ui,onUiState:value=>{if(state){state.ui=structuredClone(value);void persist().catch(saveFailure);}}});
 await nativeLayout(content.controls);layoutReady=true;
 if(state)for(const field of document.querySelectorAll('#readingView [data-question]')){field.value=state.answers?.[field.dataset.question]||'';field.dispatchEvent(new Event('input',{bubbles:true}));}
 $('readingView').addEventListener('submit',e=>e.preventDefault());
 $('readingView').addEventListener('input',e=>{const n=e.target.dataset.question;if(!n||state?.phase!=='playing')return;if(clock()>=DURATION_MS){void seal('deadline');return;}state.answers[n]=e.target.value;void queueDraft();});
 $('prepare').disabled=!$('student').value;
}
function snapshot(status){return {operationId:crypto.randomUUID(),generation:state.identity.generation,revision:++state.revision,tabId,ownerId,answers:{...state.answers},ui:state.ui,scroll:state.scroll,annotations:state.annotationRaw||null,status,startedAt:state.startedAt,elapsedMs:Math.min(DURATION_MS,clock()),sealedAt:status==='submitted'?new Date().toISOString():null,submitReason:state.submitReason||null};}
function validReceipt(v,p){return v?.ok===true&&v.persisted===true&&v.attemptId===state.identity.attemptId&&v.studentRef===state.identity.studentRef&&v.classCode===state.identity.classCode&&v.generation===state.identity.generation&&v.operationId===p.operationId&&v.revision===p.revision&&v.status===p.status&&typeof v.receiptId==='string';}
async function synchronize(force=false){
 if(!state?.pending||syncing||state.needsTeacher||!force&&performance.now()<retryAt)return;syncing=true;const pending=structuredClone(state.pending);
 try{
  let r;if(state.uncertainOperation===pending.operationId){r=await journal.request('/operation-status',{operationId:pending.operationId});if(!r.value.persisted)r=null;}
  if(!r)r=await journal.request('/snapshot',pending);
  if(!validReceipt(r.value,pending)){journal.decision(r.requestId,pending.operationId,false,{errorCode:'API_CONTRACT_MISMATCH'});throw Object.assign(Error(),{code:'API_CONTRACT_MISMATCH'});}
  const same=state.pending?.operationId===pending.operationId;journal.decision(r.requestId,pending.operationId,same,{revisionSent:pending.revision,revisionReceived:r.value.revision,reason:same?'receipt_verified':'newer_local_revision'});
  journal.serverAckedElapsedMs=r.value.serverAckedElapsedMs;journal.serverAckedAt=r.value.serverNow;
  state.ackedRevision=Math.max(state.ackedRevision||0,r.value.revision);if(same){state.pending=null;state.uncertainOperation=null;}
  if(pending.status==='submitted'){state.serverConfirmed=true;state.receipt=r.value.receiptId;state.rawScore=r.value.rawScore;}
  await persist();failures=0;text('local-status',state.pending?'Đã lưu trên thiết bị · đang gửi thay đổi mới':'Đã lưu lên máy chủ');if(state.phase==='submitted')renderFinished();
 }catch(e){state.uncertainOperation=pending.operationId;retryAt=performance.now()+Math.min(60000,2000*2**Math.min(5,failures++));if(['READING_GENERATION_STALE','READING_OWNER_CONFLICT','ATTEMPT_LOCKED','PERMIT_INVALID'].includes(e.code)){state.needsTeacher=true;note('Lượt trên máy chủ đã thay đổi. Bài trên thiết bị vẫn được giữ. Hãy liên hệ giảng viên để đối soát; hệ thống không ghi đè hoặc tự reset bài.');}await persist().catch(saveFailure);text('local-status','Đã lưu trên thiết bị · chờ đồng bộ');if(state.phase==='submitted')renderFinished();}
 finally{syncing=false;}
}
async function queueDraft(){if(state?.phase!=='playing')return;checkpoint();state.pending=snapshot('draft');try{await persist();text('local-status','Đã lưu trên thiết bị'+(navigator.onLine?'':' · mất mạng'));void synchronize();}catch{saveFailure();}}
function renderFinished(){show('lobby',false);show('exam',false);show('readingView',false);show('identityView',false);show('finished');$('page-shell').classList.add('cbt-bootstrap-shell');
 if(state.phase==='technical_stop'){text('finish-title','Cần giảng viên hỗ trợ');text('finish-message','Bài đã lưu được giữ nguyên. Mốc giờ chưa thể phục hồi an toàn. Hãy liên hệ giảng viên; hệ thống không tự cấp lại 40 phút.');show('new-attempt');return;}
 text('finish-title',state.serverConfirmed?'Đã nộp thành công':'Bài đã khóa · chờ đồng bộ');text('finish-message',state.serverConfirmed?'Máy chủ đã nhận bài Reading'+(Number.isInteger(state.rawScore)?' · '+state.rawScore+'/26 câu đúng.':'.')+' Điểm Term Test 1 Reading được đồng bộ riêng; giảng viên theo dõi trạng thái ghi điểm.':'Bài đã được khóa và lưu trên thiết bị. Hệ thống sẽ gửi lại khi kết nối được máy chủ. Hãy giữ dữ liệu trình duyệt này; nếu đã đóng trang, mở lại cùng trình duyệt để đồng bộ.');text('receipt',state.receipt?'Biên nhận: '+state.receipt:'Chưa có biên nhận máy chủ.');show('sync-now',!state.serverConfirmed);show('new-attempt',!!state.needsTeacher);
}
async function seal(reason){
 if(state?.phase!=='playing'||sealing)return;sealing=true;checkpoint();captureUi();if(reason==='deadline')state.elapsedMs=DURATION_MS;state.submitReason=reason;state.phase='submitted';state.sealed=snapshot('submitted');state.pending=structuredClone(state.sealed);$('readingView').inert=true;$('confirm-submit').close();
 try{await persist();journal.emit('submission_sealed',{operationId:state.sealed.operationId,revisionSent:state.sealed.revision,elapsedExamMs:state.elapsedMs,submitReason:reason});renderFinished();void synchronize(true);}catch{state.storageFailed=true;note('Không xác nhận được lưu bền trên thiết bị. Giữ nguyên trang và liên hệ giảng viên.');renderFinished();text('finish-message','Bài chưa gửi thành công; bộ nhớ thiết bị đang lỗi. Hãy giữ nguyên trang, không tải lại và liên hệ giảng viên.');}finally{sealing=false;}
}
async function prepare(){
 if(busy||!layoutReady||(!$('student').value&&!state?.permit))return;busy=true;$('prepare').disabled=true;show('retry',false);
 try{
  if(!state?.permit){const studentRef=$('student').value;if(preparation?.studentRef!==studentRef)preparation={studentRef,ownerId,operationId:crypto.randomUUID()};await storage.put('preparation',preparation);const r=await journal.request('/prepare',{classCode:'IC2311',studentRef,ownerId,tabId,operationId:preparation.operationId},{permit:null});
   if(r.value.identity.contentVersion!==CONTENT_VERSION||r.value.identity.contentHash!==CONTENT_HASH)throw Object.assign(Error(),{code:'CONTENT_MISMATCH'});
   state={permit:r.value.permit,identity:r.value.identity,name:roster.students.find(s=>s.studentRef===studentRef).name,phase:'prepared',revision:r.value.revision,answers:Object.fromEntries(Array.from({length:26},(_,i)=>[i+1,''])),elapsedMs:0,pending:null,serverConfirmed:false,clockOffset:Date.parse(r.value.serverNow)-Date.now(),ui:{flags:{reading:{}},activeSection:{reading:0},fontSize:{reading:100}}};await persist();
  }
  await acquireOwner();if(!journal.permit)journal.bind(state.identity,state.permit);$('student').disabled=true;
  await prepareOffline({journal,onProgress:(n,total)=>{$('download').value=n/total;text('prepare-status','Đang tải và xác minh '+n+'/'+total+' tài nguyên…');}});
  await document.fonts.ready;if([...document.querySelectorAll('link[data-native-style]')].some(link=>!link.sheet))throw Object.assign(Error(),{code:'CACHE_INCOMPLETE'});
  await nativeAnnotations({content,identity:state.identity,storage,onError:saveFailure,onChange:raw=>{if(state?.phase==='playing'){state.annotationRaw=raw;void queueDraft();}}});state.offlineReady=true;await persist();ready=true;text('prepare-status','Sẵn sàng trên thiết bị. Bạn có thể bắt đầu và làm hết bài dù mất mạng.');$('download-step').dataset.state='complete';$('start-step').dataset.state='active';$('start').disabled=false;journal.emit('app_ready',{phase:'ready'});
 }catch(e){text('prepare-status','Chưa sẵn sàng ('+(e.code||'CACHE_UNAVAILABLE')+'). Bạn chưa nên bắt đầu. Kết nối mạng và thử lại; nếu vẫn lỗi, liên hệ giảng viên.');show('retry');}
 finally{busy=false;$('prepare').disabled=ready||!$('student').value;}
}
$('student').onchange=()=>{$('prepare').disabled=!layoutReady||!$('student').value;};$('prepare').onclick=prepare;$('retry').onclick=prepare;
$('start').onclick=async()=>{if(!ready||busy||state?.phase!=='prepared')return;busy=true;try{state.phase='playing';state.startedAt=new Date(Date.now()+(state.clockOffset||0)).toISOString();state.elapsedMs=0;state.wallAt=Date.now();baseElapsed=0;baseMono=performance.now();state.ui??={flags:{reading:{}},activeSection:{reading:0},fontSize:{reading:100}};await persist();showExam();journal.emit('exam_started',{phase:'playing',startedAt:state.startedAt});await queueDraft();}catch{saveFailure();}finally{busy=false;}};
$('submit').onclick=()=>{if(state?.phase!=='playing')return;if(clock()>=DURATION_MS)return void seal('deadline');text('confirm-text','Bạn đã nhập '+Object.values(state.answers).filter(v=>v.trim()).length+'/26 câu. Xác nhận nộp và khóa bài?');$('confirm-submit').showModal();};$('cancel-submit').onclick=()=>$('confirm-submit').close();$('accept-submit').onclick=()=>void seal('manual');$('sync-now').onclick=()=>void synchronize(true);
$('new-attempt').onclick=async()=>{if(busy)return;busy=true;try{state.replacement??={ownerId:crypto.randomUUID(),operationId:crypto.randomUUID()};await persist();const r=await journal.request('/prepare',{classCode:'IC2311',studentRef:state.identity.studentRef,...state.replacement,tabId},{permit:null});if(r.value.identity.generation<=state.identity.generation)throw Error();await storage.put('attempt:'+state.identity.attemptId,state);await storage.put('current',{permit:r.value.permit,identity:r.value.identity,name:state.name,phase:'prepared',revision:0,answers:{},elapsedMs:0,clockOffset:Date.parse(r.value.serverNow)-Date.now()});location.reload();}catch{note('Chưa có lượt mới được giảng viên xác nhận. Bài hiện tại vẫn được giữ.');}finally{busy=false;}};
addEventListener('online',()=>{retryAt=0;void synchronize(true);});
addEventListener('pagehide',()=>{if(state){checkpoint();captureUi();void persist().catch(()=>{});journal.emit('page_departed',{phase:state.phase});}releaseOwner?.();});
setInterval(()=>{if(state?.phase==='playing'){drawClock();if(clock()>=DURATION_MS)void seal('deadline');else{checkpoint();captureUi();void persist().catch(saveFailure);}}void synchronize();},1000);
setInterval(()=>{if(state?.phase==='playing')void queueDraft();},10000);
try{
 content=await fetch('content.json').then(r=>{if(!r.ok)throw Error();return r.json();});const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(content))))].map(n=>n.toString(16).padStart(2,'0')).join('');if(content.contentVersion!==CONTENT_VERSION||sha!==CONTENT_HASH)throw Error('CONTENT_MISMATCH');
 if(state?.permit){await acquireOwner();journal.bind(state.identity,state.permit);roster={students:[{studentRef:state.identity.studentRef,name:state.name}]};}
 else{const r=await journal.request('/roster',null,{permit:null,method:'GET'});roster=r.value;if(roster.contentHash!==CONTENT_HASH||roster.classCode!=='IC2311')throw Error('CONTENT_MISMATCH');}
 $('student').replaceChildren(new Option('Chọn tên của bạn',''));for(const s of roster.students)$('student').add(new Option(s.name,s.studentRef));if(state)$('student').value=state.identity.studentRef;await renderContent();
 if(state?.phase==='submitted'||state?.phase==='technical_stop'){renderFinished();void synchronize(true);}
 else if(state?.phase==='playing'){
  const gap=Date.now()-state.wallAt;if(!Number.isFinite(gap)||gap< -2000){state.phase='technical_stop';state.pending=snapshot('technical_stop');await persist();renderFinished();journal.emit('restore_failed',{errorCode:'CLOCK_INVALID'});void synchronize(true);}
  else{state.elapsedMs=Math.min(DURATION_MS,(state.elapsedMs||0)+Math.max(0,gap));baseElapsed=state.elapsedMs;baseMono=performance.now();ready=true;await nativeAnnotations({content,identity:state.identity,storage,onError:saveFailure,onChange:raw=>{if(state?.phase==='playing'){state.annotationRaw=raw;void queueDraft();}}});showExam();await new Promise(requestAnimationFrame);document.querySelectorAll('#readingView .cbt-reading-passage,#readingView .cbt-reading-questions').forEach((e,i)=>e.scrollTop=state.scroll?.[i]||0);journal.emit('attempt_restored',{phase:'playing',elapsedExamMs:state.elapsedMs});if(state.elapsedMs>=DURATION_MS)await seal('deadline');}
 }else if(state?.permit)await prepare();
}catch(e){text('identity-status',e.code==='READING_OWNER_CONFLICT'?'Bài này đang mở ở tab khác. Hãy quay lại tab đó để tiếp tục.':'Chưa tải đủ bài hoặc danh sách học viên. Hãy kết nối mạng và thử tải lại. Dữ liệu đã lưu được giữ nguyên.');journal.emit('startup_failed',{errorCode:e.code||'CONTENT_MISMATCH'});}
