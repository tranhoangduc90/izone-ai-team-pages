(async () => {
'use strict';
const AuthoredUI=await import('./authored-ui.js?v=20261029-notes-document1');
const {fetchListeningAudio,clearListeningAudioMemory}=await import('./audio-delivery.mjs?v=20261026-review-fast1&journal=20261024-audio-v1&audio=20261028-part-rescue-v1');
let AUTHORED_DEF=null;
// Nhận bài từ API sau bắt đầu. Nháp giữ trên máy; điểm, lượt và thời gian do máy chủ xác nhận.
let CODE='67-practice-listening_mcq_flowchart',FULL_TIME=579207;const TAB=crypto.randomUUID();
let AUDIO_DURATION=459.207, REVIEW_TIME=120000;const audio=document.querySelector('#listening-audio');
let audioBlob='',audioBlobAttempt='',seekingAudio=false,playbackGeneration=0,audioStarted=false,audioFetchController=null;
const app=document.querySelector('#app'),modal=document.querySelector('#modal');
const API=window.LISTENING_CONFIG.apiBase.replace(/\/$/,'');
const MEMORY='listening-practice67-identity';
const entryQuery=new URLSearchParams(location.search),requestedLesson=entryQuery.get('lesson')||entryQuery.get('assignmentCode')||CODE;
const docId=entryQuery.get('documentId')||`lesson:${requestedLesson}`;
let sharedEntry=false,CLASSES=[],selectedClassId='',rosterGeneration=0;
const SESSION=`listening-practice67-session:${docId}`,ENTRY=`listening-practice67-entry:${docId}`;
const {createCourseStudentIdentity,requestMappingStudentIdentity}=await import('../shared/course-student-identity.js?v=20261018-identity-v1');
const courseIdentity=createCourseStudentIdentity({product:'listening-practice',entry:docId,requestIdentity:requestMappingStudentIdentity});
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,style='',extra='')=>`<button type="button" class="button ${style}" data-action="${action}" ${extra}>${label}</button>`;
const textBtn=(label,action,extra='')=>`<button type="button" class="text-button" data-action="${action}" ${extra}>${label}</button>`;
const dateLabel=date=>new Date(date).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
const timeLabel=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const normal=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
let KEY=Object.fromEntries(Array.from({length:10},(_,i)=>[i+21,[]]));
let LESSON=null;
const total=()=>Object.keys(KEY).length;
function setAuthoredLesson(lesson){
 if(!lesson?.authored)return;
 LESSON=lesson;document.body.classList.toggle('listening-full-test',Boolean(lesson.parts?.length));CODE=lesson.code;FULL_TIME=lesson.totalMs;AUDIO_DURATION=lesson.audioMs/1000;REVIEW_TIME=lesson.reviewMs;
 KEY=Object.fromEntries(lesson.questionIds.map(n=>[n,[]]));document.body.dataset.teacherCode=CODE;
 document.title=`Listening thực chiến · Buổi ${lesson.lesson} · ${lesson.title}`;
 document.querySelectorAll('[data-lesson-title]').forEach(el=>el.textContent=`Listening thực chiến · Buổi ${lesson.lesson}`);
 const heading=document.querySelector('.topbar h1');if(heading)heading.textContent=`Listening thực chiến · Buổi ${lesson.lesson}`;
}
function questionPane(n){
 const part=AuthoredUI.partForQuestion(LESSON||{},n);
 if(part)return part.splitAfter!==undefined&&n<=part.splitAfter?'passage':'questions';
 if(LESSON&&AuthoredUI.isNoteDocument(LESSON.groups))return 'questions';
 return LESSON?(LESSON.groups.length>1&&n<=LESSON.groups[0].end?'passage':'questions'):n<=25?'passage':'questions';
}
function audioScope(){return LESSON?.parts?.length?'Listening · 4 part':`Listening Part ${LESSON?.part||3}`;}
let PASSAGE={},HEADINGS=[],MCQ=[],BANK=[],FLOW=[],SUMMARY=[],STUDENTS=[],identity,entryInfo,entryToken='',sessionToken='';
let db={students:{}},studentId='',route='',routeParams=new URLSearchParams(),lastTick=0,lastSave=0;
let saveError=false,simulatedOffline=false,toastTimeout,modalAction=null,fontSize=17,lease=null,queue=Promise.resolve(),debounce,networkFailed=false,busy=false,ready=false;
let activeMs=0,leaseBaseline=0,lastPulse=0,checkpointKey='',pendingOperation=null,pulsePending=false,activating=false;
const resultCache=new Map();
let teacherGoogleScript,teacherResultGeneration=0;
const legacyTeacherToken=()=>{try{return sessionStorage.getItem('listening-teacher-token')||'';}catch{return '';}};
const student=()=>({name:identity?.name});
const record=()=>db.students[studentId];
const current=()=>record()?.attempts.at(-1);
const countAnswered=a=>Object.values(a?.answers||{}).filter(v=>String(v).trim()).length;
const resultFor=(a,start,end)=>a.result.rows.filter(r=>r.number>=start&&r.number<=end&&r.state==='correct').length;
const isOnline=()=>navigator.onLine&&!networkFailed;
function notify(message){const t=document.querySelector('#toast');t.textContent=message;t.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.hidden=true,4000);}
function footer(){return `<footer class="page-footer">IZONE · Listening thực chiến · Buổi ${LESSON?.lesson||8}</footer>`;}
courseIdentity.subscribe(()=>{if(identity)notify('Người đã nhớ ở tab khác vừa đổi. Bài tại đây vẫn giữ nguyên người và nháp.');});
async function loginSelected(id,classCode,{selection=null,remember=true}={}){
 const context=selection?courseIdentity.automaticContext(selection):courseIdentity.prepare(id,sharedEntry?CLASSES.find(c=>c.id===classCode)?.classCode:classCode);
 const response=sharedEntry?await request('/shared-login',{code:LESSON.code,classId:classCode,studentRef:id}):await request('/login',{entryToken,studentRef:id,classCode});
 const expectedClass=sharedEntry?CLASSES.find(c=>c.id===classCode)?.classCode:classCode;
 if(selection&&!courseIdentity.isCurrent(selection))throw new Error('Người đã nhớ vừa đổi. Chưa dùng phản hồi cũ; hãy mở lại bài.');
 if(!response.token||response.identity?.studentRef!==id||response.identity.classCode!==expectedClass
   ||(entryInfo?.bindingId&&response.identity.bindingId!==entryInfo.bindingId))throw new Error('Phiên trả về chưa khớp người và bài; chưa mở bài của người khác.');
 sessionToken=response.token;try{sessionStorage.setItem(SESSION,sessionToken);}catch{}
 apply(response);recoverLocal();
 courseIdentity.pin(id);
 await courseIdentity.commit(context,{automatic:Boolean(selection),remember}).then(remembered=>{
  if(['missing','ambiguous'].includes(remembered.status))notify('Bài đã mở đúng người. Hồ sơ chưa đối chiếu được với danh tính chung; chưa ghi nhớ cho bài tiếp theo.');
  else if(!['ok','empty'].includes(remembered.status))notify('Bài đã mở đúng người; trình duyệt chưa nhớ được cho bài tiếp theo.');
 }).catch(()=>notify('Bài đã mở đúng người; trình duyệt chưa nhớ được cho bài tiếp theo.'));
 navigate(['running','paused'].includes(current()?.status)?'resume':'prep');
}
async function autoLoginRemembered(){
 if(sessionToken)return true;
 let selected;
 if(sharedEntry&&!selectedClassId){
  selected=await courseIdentity.resolve({allowedClassCodes:CLASSES.map(c=>c.classCode)});
  if(selected.status!=='unique')return false;
  selectedClassId=CLASSES.find(c=>c.classCode===selected.alias.classCode)?.id||'';
  if(!selectedClassId)return false;
  STUDENTS=(await request(`/library/${encodeURIComponent(requestedLesson)}/classes/${encodeURIComponent(selectedClassId)}`)).students;
 }
 const classCode=sharedEntry?CLASSES.find(c=>c.id===selectedClassId)?.classCode:entryInfo?.classCode;
 if(selected){
  // Kết quả vừa xác minh vẫn thuộc lượt mở này, không cache quyền qua lượt sau.
  if(!courseIdentity.isCurrent(selected)||!STUDENTS.some(s=>(s.id||s.studentRef)===selected.alias.studentRef))return false;
 }else selected=await courseIdentity.resolve({classCode,studentRefs:STUDENTS.map(s=>s.id||s.studentRef),expectedRef:sharedEntry?'':entryInfo?.selectedStudentRef});
 if(selected.status==='wrong_owner'){notify('Link bài thuộc người khác với người đã nhớ. Hãy kiểm tra link hoặc dùng Đổi người học.');return false;}
 if(selected.status!=='unique')return false;
 await loginSelected(selected.alias.studentRef,sharedEntry?selectedClassId:classCode,{selection:selected});return true;
}
async function changeStudent(){
 if(current()&&!persist(false))return;
 pause('identity',false);await queue;
 if((await courseIdentity.forget()).status!=='empty'){notify('Chưa đổi được người học. Bài và nháp vẫn được giữ.');return;}
 try{sessionStorage.removeItem(SESSION);}catch{}
 window.ListeningReview?.reset();clearListeningAudioMemory();resultCache.clear();
 sessionToken='';studentId='';identity=null;navigate('login');
}
function completionCopy(a){const first=record()?.firstCompleted;return a.no===1?'Hoàn thành ngay từ lần đầu.':first&&first!==a.no?`Kết quả lượt luyện lại số ${a.no} · Lần hoàn thành đầu tiên: lượt ${first}.`:`Hoàn thành sau ${a.no-1} lần reset · Kết quả của lần làm bài số ${a.no}.`;}
function identityBar(){return `<div class="identity-bar"><span><strong>${escape(identity?.name)}</strong> <span>· Lớp ${escape(identity?.classCode)}</span></span>${textBtn('Đổi người học','change-student')}</div>`;}
function cacheKey(){return `listening-practice67-draft:${identity?.bindingId}`;}
function snapshot(){const a=current();return{phase:a.phase||'listening',audioPosition:a.audioPosition||0,answers:a.answers,flags:a.flags,notes:a.notes,annotations:a.annotations,scroll:a.scroll,activeQuestion:a.activeQuestion,tab:a.tab,mobilePane:a.mobilePane||'passage',notesOpen:!!a.notesOpen,highlighted:a.highlighted,sequence:a.sequence,activeMs:Math.round(activeMs)};}
function persist(schedule=true){
 if(!current())return true;
 try{current().sequence++;localStorage.setItem(cacheKey(),JSON.stringify({attemptId:current().id,lease,snapshot:snapshot(),remainingMs:current().remainingMs,pendingOperation}));lastSave=performance.now();
  if(schedule&&route==='exercise'&&current().status==='running'){clearTimeout(debounce);debounce=setTimeout(()=>sendPulse(),500);}return true;
 }catch{stopAudio();saveError=true;lastTick=0;if(current())current().status='paused';showStorageError();return false;}
}
function showStorageError(){app.innerHTML=`<section class="notice-panel card card-pad"><h1>Chưa lưu được bài trên thiết bị</h1><p>Đồng hồ đã dừng. Giữ nguyên tab và cho phép trình duyệt lưu dữ liệu để bảo toàn phần vừa nhập.</p>${btn('Thử lưu lại','retry-save')}</section>`;}
function apply(response,{preserve=false}={}){
 setAuthoredLesson(response.lesson);
 identity=response.identity;studentId=identity.studentRef;checkpointKey=cacheKey();
 const local=current();db.students[studentId]={attempts:response.attempts,events:response.events,firstCompleted:response.firstCompleted};
 const a=current();if(preserve&&local&&a?.id===local.id&&['running','paused'].includes(a.status)&&local.sequence>=a.sequence){Object.assign(a,snapshotFrom(local));a.remainingMs=Math.min(local.remainingMs,a.remainingMs);a.owner=TAB;}
 if(response.definition){AUTHORED_DEF=response.definition;({mcq:MCQ,bank:BANK,flow:FLOW}=response.definition);PASSAGE={loaded:true};}
 if(response.lease){lease=response.lease;activeMs=0;leaseBaseline=a.usedMs;a.owner=TAB;pendingOperation=null;}
 return a;
}
function snapshotFrom(a){return{phase:a.phase,audioPosition:a.audioPosition,answers:a.answers,flags:a.flags,notes:a.notes,annotations:a.annotations,scroll:a.scroll,activeQuestion:a.activeQuestion,tab:a.tab,mobilePane:a.mobilePane,notesOpen:a.notesOpen,highlighted:a.highlighted,sequence:a.sequence};}
async function request(path,body,teacher=false,keepalive=false){
 const token=teacher?legacyTeacherToken():sessionToken;
 let response;try{
  let options={method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000),keepalive};
  if(teacher){const {teacherSessionRequestOptions}=await import('../shared/teacher-session-client.js?startup=20261026-v2');options=teacherSessionRequestOptions({...options,cache:'no-store'});}
  response=await fetch(`${API}${path}`,options);}
 catch{networkFailed=true;throw Object.assign(new Error('Chưa kết nối được máy chủ. Bài đã tạm dừng; bản nháp được giữ trên thiết bị.'),{code:'NETWORK'});}
 const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error.message),{code:value.error.code,httpStatus:response.status});networkFailed=false;return value;
}
function serial(fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}
function setActivating(value){activating=value;document.querySelectorAll('[data-action="request-reset"],[data-action="request-submit"]').forEach(button=>button.disabled=value||!isOnline());}
async function sendPulse(){
 if(route!=='exercise'||current()?.status!=='running'||busy||pulsePending||activating)return;
 pulsePending=true;lastPulse=performance.now();
 clearTimeout(debounce);
 return serial(async()=>{
  if(route!=='exercise'||current()?.status!=='running')return;
  consumeTime();rememberScroll();persist(false);
  const id=current().id,proof=lease,draft=snapshot();
  try{const response=await request('/pulse',{attemptId:id,lease:proof,snapshot:draft});
   if(current()?.id!==id||lease?.id!==proof.id)return;
   if(response.attempts.at(-1)?.status!=='submitted'&&(current().status!=='running'||route!=='exercise'))return;
   apply(response,{preserve:true});activeMs=Math.max(activeMs,current().usedMs-leaseBaseline);savedStatus('Đã lưu trên máy chủ');
   if(current().status==='submitted'){lastTick=0;await loadResult(current().no);}
  }catch(e){stopLocal(e.code,e.message);notify(e.message);}
 }).finally(()=>pulsePending=false);
}
function savedStatus(text){const el=document.querySelector('.autosave-status');if(el)el.textContent=text;}
let recoveryNotice='';
function stopLocal(reason,message=''){recoveryNotice=message;consumeTime();stopAudio();setActivating(false);rememberScroll();lastTick=0;clearTimeout(debounce);if(current()){current().status='paused';current().pauseReason=reason;persist(false);}closeModal();if(!saveError)navigate('resume');}
function tick(){if(current()?.status!=='running'||route!=='exercise')return;if(document.hidden||!navigator.onLine){pause(document.hidden?'hidden':'offline');return;}consumeTime();updateProgress();if(performance.now()-lastSave>900)persist(false);if(current().remainingMs<=0){finish('timeout');return;}if(performance.now()-lastPulse>4500)sendPulse();}
function clearPendingOperation(){
 pendingOperation=null;sessionStorage.removeItem(`listening-operation:${identity.bindingId}`);
}
async function perform(action,payload){
 if(busy||activating)return;busy=true;clearTimeout(debounce);
 const op=pendingOperation?.action===action?pendingOperation:{action,payload:{operationId:crypto.randomUUID(),...payload}};pendingOperation=op;
 try{sessionStorage.setItem(`listening-operation:${identity.bindingId}`,JSON.stringify(op));persist(false);
 await serial(async()=>{const response=await request(`/${action}`,op.payload);clearPendingOperation();apply(response,{preserve:!!response.attempts.at(-1)?.progressRecovery});persist(false);lastPulse=performance.now();
  if(current()?.status==='submitted'){lastTick=0;await loadResult(current().no);}else if(response.lease){
   // Đề mở sau ACK tạo lượt. Gửi mốc kích hoạt cùng lúc mở đề, không chờ thêm ACK để chạy giờ.
   const id=current().id,proof=lease;current().status='running';lastTick=0;activating=true;busy=false;navigate('exercise');
   await startPlayback(id,proof);

  }else{lastTick=0;current().status='paused';if(!current().progressRecovery)lease=null;navigate('resume');if(current().progressRecovery)notify(current().progressRecovery.message);}
 });}catch(e){if(e.httpStatus>=400&&e.httpStatus<500)clearPendingOperation();stopLocal(e.code,e.message);notify(e.message);}finally{busy=false;}
}

// Giữ tiến độ nghe và giờ rà trong lượt; tải audio qua API có kiểm chủ bài.
function stopAudio(){playbackGeneration++;audioStarted=false;audioFetchController?.abort();audioFetchController=null;audio.pause();}
function consumeTime(){
 const a=current();if(!a||a.status!=='running'||a.owner!==TAB||!lastTick)return;
 const now=performance.now();
 if(a.phase==='listening'){
  if(!seekingAudio&&!audio.paused){const position=Math.min(AUDIO_DURATION,audio.currentTime);activeMs+=Math.max(0,position-(a.audioPosition||0))*1000;a.audioPosition=position;}
 }else activeMs+=now-lastTick;
 a.remainingMs=Math.max(0,FULL_TIME-leaseBaseline-activeMs);a.reviewRemainingMs=a.phase==='review'?a.remainingMs:REVIEW_TIME;lastTick=now;
}
function audioToolbar(a) {
    return `<section class="listening-audio-bar" aria-label="${audioScope()}"><div class="audio-heading"><strong id="audio-phase">${a.phase==='review'?'Rà bài trong 2 phút':`${audioScope()} · Nghe một lượt`}</strong><span id="audio-position">${timeLabel((a.audioPosition||0)*1000)} / ${timeLabel(AUDIO_DURATION*1000)}</span></div><progress id="audio-progress" max="${AUDIO_DURATION}" value="${a.audioPosition||0}" aria-label="Tiến độ nghe"></progress><div class="audio-controls"><span id="audio-status" role="status">${a.phase==='review'?'Audio đã kết thúc':'Đang chuẩn bị audio…'}</span><label>Âm lượng <input id="audio-volume" type="range" min="0" max="1" step="0.05" value="${audio.volume}" aria-label="Âm lượng"></label><button type="button" class="cbt-tool-button" data-action="audio-play" id="audio-play" hidden>Phát audio để tiếp tục</button></div></section>`;
  }
function updateAudioToolbar() {
    const a=current(),progress=document.querySelector('#audio-progress');if(!a||!progress)return;
    progress.value=a.audioPosition||0;
    document.querySelector('#audio-phase').textContent=a.phase==='review'?'Rà bài trong 2 phút':`${audioScope()} · Nghe một lượt`;
    document.querySelector('#audio-position').textContent=timeLabel((a.audioPosition||0)*1000)+' / '+timeLabel(AUDIO_DURATION*1000);
    if(a.phase==='review')document.querySelector('#audio-status').textContent='Audio đã kết thúc · kiểm tra đáp án rồi nộp';
  }

async function startPlayback(id,proof){
 const generation=++playbackGeneration;audioStarted=false;seekingAudio=true;
 const a=current();
 if(a.phase==='listening'){
  if(audioBlobAttempt!==id){
   // A multipart download can exceed 20 seconds while each part is healthy.
   // Keep its budget separate from the exam clock; pause/reset/identity change
   // cancels through stopAudio, and each network part has its own timeout.
   const controller=audioFetchController=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
   let blob;
   try{blob=await fetchListeningAudio(`${API}/audio/${id}`,{headers:{Authorization:`Bearer ${sessionToken}`},signal:controller.signal});}
   finally{clearTimeout(timer);if(audioFetchController===controller)audioFetchController=null;}
   if(generation!==playbackGeneration||current()?.id!==id)return;
   if(audioBlob)URL.revokeObjectURL(audioBlob);audioBlob=URL.createObjectURL(blob);audioBlobAttempt=id;audio.src=audioBlob;
  }
  if(audio.readyState===0)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(new Error('Audio chưa sẵn sàng.'));},10000);const done=()=>{cleanup();resolve();};const error=()=>{cleanup();reject(new Error('Không giải mã được audio.'));};const cleanup=()=>{clearTimeout(timer);audio.removeEventListener('loadedmetadata',done);audio.removeEventListener('error',error);};audio.addEventListener('loadedmetadata',done);audio.addEventListener('error',error);audio.load();});
  if(generation!==playbackGeneration||current()?.id!==id||current()?.status!=='running')return;
  audio.currentTime=Math.min(a.audioPosition||0,AUDIO_DURATION);audio.playbackRate=1;seekingAudio=false;
 }
 const activated=await request('/activate',{attemptId:id,lease:proof});
 if(generation!==playbackGeneration||current()?.id!==id||lease?.id!==proof.id||current()?.status!=='running'||route!=='exercise')return;
 apply(activated,{preserve:true});
 if(a.phase==='listening'){
  try{await audio.play();}catch(e){if(e.name==='NotAllowedError'){setActivating(false);const status=document.querySelector('#audio-status'),button=document.querySelector('#audio-play');if(status)status.textContent='Nhấn Phát audio để bắt đầu';if(button)button.hidden=false;return;}throw e;}
 }
 if(generation!==playbackGeneration||current()?.id!==id||current()?.status!=='running'||route!=='exercise'){audio.pause();return;}
 lastTick=performance.now();setActivating(false);document.querySelector('#audio-play').hidden=true;
 if(a.phase==='listening')document.querySelector('#audio-status').textContent='Đang nghe · tốc độ gốc';
}
function audioFinished(){const a=current();if(a?.status!=='running'||a.owner!==TAB||a.phase!=='listening')return;consumeTime();a.audioPosition=AUDIO_DURATION;activeMs=Math.max(activeMs,AUDIO_DURATION*1000-leaseBaseline);a.phase='review';a.reviewRemainingMs=REVIEW_TIME;lastTick=performance.now();persist(false);updateProgress();sendPulse();}
audio.addEventListener('ended',audioFinished);
audio.addEventListener('playing',()=>{audioStarted=true;});
audio.addEventListener('waiting',()=>{if(audioStarted&&current()?.status==='running')pause('audio-buffering');});
audio.addEventListener('error',()=>{if(current()?.status==='running')pause('audio-error');});
document.addEventListener('input',e=>{if(e.target.id==='audio-volume')audio.volume=Number(e.target.value);});

function begin(){if(current()?.status==='submitted'){loadResult(current().no);return;}if(current())return resume();perform('begin',{owner:TAB});}
function resume(){
 if(!navigator.onLine){notify('Khôi phục kết nối trước khi tiếp tục.');return;}
 // Tiếp tục luôn giữ lượt hiện tại; không phát lại Reset cũ khi trạng thái kết quả chưa rõ.
 if(pendingOperation?.action==='reset')clearPendingOperation();
 if(pendingOperation){perform(pendingOperation.action,pendingOperation.payload);return;}
 const a=current();if(!a)return begin();
 let recovery;
 try{const local=JSON.parse(localStorage.getItem(cacheKey()));if(local?.attemptId===a.id&&local.lease&&local.snapshot.sequence>=a.sequence)recovery={snapshot:local.snapshot,lease:local.lease};}catch{}
 perform('resume',{attemptId:a.id,owner:TAB,...(recovery?{recovery}:{})});
}
function pause(reason='manual',shouldRender=true){
 const a=current();if(!a||a.status!=='running'||a.owner!==TAB)return;
 consumeTime();stopAudio();setActivating(false);rememberScroll();persist(false);const input={attemptId:a.id,lease,snapshot:snapshot()};
 a.status='paused';a.pauseReason=reason;lastTick=0;clearTimeout(debounce);closeModal();
 if(navigator.onLine)serial(async()=>{try{
  if(current()?.id!==input.attemptId||lease?.id!==input.lease.id)return;
  // Pulse trước đó có thể đã ACK trong hàng đợi; gửi nháp mới nhất cùng đúng lease.
  input.snapshot=snapshot();const response=await request('/pause',input,false,true);
  if(current()?.id===input.attemptId&&lease?.id===input.lease.id){apply(response,{preserve:true});persist(false);if(current().status==='submitted')await loadResult(current().no);else if(current().progressRecovery&&shouldRender)navigate('resume');}
 }catch(e){notify(e.message);}});
 if(shouldRender&&!saveError)navigate('resume');
}
function finish(method){if(busy||activating||!current()||!['running','paused'].includes(current().status))return;consumeTime();rememberScroll();stopAudio();lastTick=0;persist(false);perform('submit',{attemptId:current().id,lease,snapshot:snapshot(),method});}
function reset(){if(busy||activating)return;consumeTime();stopAudio();rememberScroll();lastTick=0;const a=current();perform('reset',{attemptId:a.id,owner:TAB,...(['running','paused'].includes(a.status)&&lease?{lease,snapshot:snapshot()}:{} )});}
async function loadResult(no){
 const a=record()?.attempts.find(a=>a.no===+no);if(!a)return;
 if(a.status==='submitted'&&!resultCache.has(a.id)){const owner=identity?.bindingId,token=sessionToken;try{const response=await request(`/result/${a.id}`);if(owner!==identity?.bindingId||token!==sessionToken)return;resultCache.set(a.id,response);apply(response);MCQ=response.definition.mcq;}catch(e){if(owner===identity?.bindingId&&token===sessionToken)notify(e.message);return;}}
 navigate(`result?attempt=${no}`);
}
function docsNotice(a){const e=record()?.events.findLast(e=>e.attempt===a.no&&e.type==='completed'),verified=e?.docs==='verified';return `<div class="note ${verified?'success':'warning'}">${verified?'✓ Đã cập nhật tình trạng trong tài liệu bài tập.':e?.docs==='blocked'?'Bài đã nộp. Chưa cập nhật được Docs; giảng viên cần kiểm tra ô trạng thái.':'Bài đã nộp và được lưu trên máy chủ. Đang cập nhật tình trạng trong Docs.'} ${identity.documentUrl?`<a href="${escape(identity.documentUrl)}" target="_blank" rel="noopener noreferrer">Mở tài liệu ↗</a>`:''}</div>`;}
function docs(){app.innerHTML=hero('BUỔI 8 · LISTENING THỰC CHIẾN','Science experiment for Year 12 students',LESSON?`${escape(AuthoredUI.sourceLabel(LESSON))} · ${total()} câu`:'Cambridge IELTS 19 · Test 3 · Listening Part 3 · 10 câu')+`<section class="card card-pad"><h2>Làm bài thực chiến</h2><p>Chọn đúng lớp và tên trước khi bắt đầu. Bài đang làm được lưu để bạn tiếp tục bằng thời gian còn lại.</p>${btn('Mở bài Listening →','open-assignment')}${identity?.documentUrl?`<p><a target="_blank" rel="noopener noreferrer" href="${escape(identity.documentUrl)}">Mở tài liệu bài tập ↗</a></p>`:''}</section>`+footer();}
function login(){
 const selected='';
 const classOptions=sharedEntry?CLASSES.map(c=>`<option value="${escape(c.id)}" ${c.id===selectedClassId?'selected':''}>${escape(c.classCode)}</option>`).join(''):`<option value="${escape(entryInfo?.classCode)}" ${selected?'selected':''}>${escape(entryInfo?.classCode)}</option>`;
 app.innerHTML=`<div class="login-layout"><section><span class="kicker">BUỔI ${LESSON?.lesson||8} · LISTENING THỰC CHIẾN</span><h1>${escape(LESSON?.title||'Science experiment for Year 12 students')}</h1><p class="login-copy">Nghe một lượt ở tốc độ gốc.<br>${total()} câu và ${REVIEW_TIME/60000} phút rà bài sau audio.</p><ul class="login-tasks"><li><span>01</span><div><strong>Chuẩn bị</strong><p>${LESSON?escape(LESSON.groups.map(g=>g.label).join(' · ')):'Nhắc nhanh MCQ và Flow-chart completion.'}</p></div></li><li><span>02</span><div><strong>Làm bài</strong><p>${total()} câu · Tự lưu · Có thể tiếp tục lần đang làm.</p></div></li><li><span>03</span><div><strong>Xem kết quả</strong><p>Điểm, đáp án và số lần làm bài.</p></div></li></ul></section><section class="card login-card"><h2>Bạn học lớp nào?</h2><p class="muted">Chọn đúng lớp và tên trước khi bắt đầu.</p><form id="login-form"><label for="class-select">Lớp</label><select id="class-select" required><option value="">Chọn lớp của bạn</option>${classOptions}</select><label for="student-select">Học viên</label><select id="student-select" required ${(sharedEntry?selectedClassId:selected)?'':'disabled'}><option value="">Chọn tên của bạn</option>${STUDENTS.map(s=>`<option value="${escape(s.id)}" ${s.id===selected?'selected':''}>${escape(s.name)}</option>`).join('')}</select><label class="check-line"><input id="remember-student" type="checkbox" checked> Ghi nhớ tôi trên thiết bị này</label><p class="memory-help">Lần sau sẽ chọn sẵn lớp và tên của bạn.<br>Bỏ tick nếu bạn đang dùng thiết bị chung.</p><button class="button full" id="login-submit" ${selected?'':'disabled'}><span>Mở bài Listening</span><span>→</span></button><p class="form-error" role="status" id="login-error"></p></form></section></div>`;
}
// Đổi lớp chỉ cập nhật danh sách tương ứng; bỏ phản hồi cũ nếu học viên đã chọn lớp khác.
async function selectSharedClass(classId){
 const generation=++rosterGeneration;selectedClassId=classId;STUDENTS=[];
 const select=document.querySelector('#student-select'),button=document.querySelector('#login-submit');
 select.disabled=true;select.innerHTML='<option value="">'+(classId?'Đang tải danh sách…':'Chọn tên của bạn')+'</option>';button.disabled=true;
 if(!classId)return;
 try{
  const roster=await request(`/library/${encodeURIComponent(requestedLesson)}/classes/${encodeURIComponent(classId)}`);
  if(generation!==rosterGeneration||document.querySelector('#class-select')?.value!==classId)return;
  STUDENTS=roster.students;select.innerHTML='<option value="">Chọn tên của bạn</option>'+STUDENTS.map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('');select.disabled=false;
  try{await autoLoginRemembered();}catch(error){notify(error.message);}
 }catch(error){if(generation===rosterGeneration){select.innerHTML='<option value="">Chưa tải được danh sách</option>';notify(error.message);}}
}

function navigate(hash){if(route==='exercise'&&hash.split('?')[0]!=='exercise'&&current()?.status==='running')pause('leave',false);if(saveError)return;if(location.hash.slice(1)===hash)render();else location.hash=hash;}
function render(){
 if(saveError)return showStorageError();if(!ready)return;
 const [name,query]=location.hash.slice(1).split('?');const next=name||'login';
 if(route==='exercise'&&next!=='exercise'&&current()?.status==='running')pause('leave',false);
 route=next;routeParams=new URLSearchParams(query||'');document.body.classList.toggle('reading',route==='exercise');document.body.classList.toggle('cbt-mode',route==='exercise');closeModal();
 if(!['login','docs','teacher'].includes(route)&&!studentId)return navigate('login');
 if(route==='prep'&&['running','paused'].includes(current()?.status))return navigate('resume');
 if(route==='exercise'&&!Object.keys(PASSAGE).length)return navigate('resume');
 if(route==='result'){const a=record()?.attempts.find(x=>x.no===+(routeParams.get('attempt')||current()?.no));if(a?.status==='submitted'&&!resultCache.has(a.id)){loadResult(a.no);return;}}
 ({docs,login,prep,resume:resumeScreen,exercise,result:resultScreen,teacher:teacherScreen}[route]||login)();if(route!=='exercise')window.scrollTo(0,0);
 if(route==='resume'&&current()?.progressRecovery){const note=document.createElement('p');note.className='note warning';note.textContent=current().progressRecovery.message;app.querySelector('.resume-card>div:last-child')?.prepend(note);}
 if(route==='login'&&!app.querySelector('[data-action="change-student"]'))app.insertAdjacentHTML('beforeend',textBtn('Đổi người học','change-student'));
}
async function teacherScreen(afterLogin=false){
 const generation=++teacherResultGeneration;window.ListeningReview?.reset();
 const submissionId=new URLSearchParams(location.hash.slice(1)).get('submission')||routeParams.get('submission');
 if(!submissionId){app.innerHTML='<section class="card card-pad"><h1>Mở bài từ link kết quả</h1><p>Giảng viên mở link trong tài liệu homework của học viên.</p></section>';return;}
 try{const response=await request(`/teacher/result/${encodeURIComponent(submissionId)}`,undefined,true);
  if(generation!==teacherResultGeneration)return;
  apply(response);resultCache.set(response.attempt.id,response);MCQ=response.definition.mcq;
  const a=response.attempt;app.innerHTML='<div class="teacher-banner">Giảng viên xem bài · Chỉ xem '+textBtn('Đăng xuất','teacher-logout')+'</div>'+hero('BUỔI 8 · KẾT QUẢ LISTENING','Science experiment for Year 12 students',`${escape(identity.name)} · ${escape(identity.classCode)} · Lần làm ${a.no}`)+`<section class="card card-pad"><h2>${a.finalScore}/${total()} câu đúng</h2><p>${completionCopy(a)}</p><p>Bắt đầu: ${dateLabel(a.startedAt)} · Nộp bài: ${dateLabel(a.completedAt)}</p><p>${a.method==='timeout'?'Hệ thống thu bài khi hết giờ':'Học viên chủ động nộp bài'} · ${a.no-1} lần reset trước lượt này</p></section>`+teacherHistory(response,a)+resultTable(a)+`<section class="card card-pad"><h3>Ghi chú học viên</h3><p style="white-space:pre-wrap">${escape(a.notes||'Chưa có ghi chú.')}</p></section>`+footer();
  warmReviewResult(a,response);
 }catch(e){if(generation!==teacherResultGeneration)return;if(e.code!=='TEACHER_LOGIN_REQUIRED'){app.innerHTML=`<section class="card card-pad"><h1>Chưa mở được kết quả</h1><p>${escape(e.message)}</p>${e.code==='ACCESS_DENIED'?btn('Đăng xuất và đổi tài khoản','teacher-logout'):''}</section>`;return;}
  app.innerHTML=hero('BUỔI 8 · GIẢNG VIÊN','Đăng nhập để xem kết quả','Dùng tài khoản Google đã có quyền lớp.')+'<section class="card card-pad"><label class="teacher-login-remember"><input id="teacher-remember" type="checkbox" checked> Tự đăng nhập Google trên thiết bị này</label><div id="google-signin"></div><p id="teacher-error" role="status"></p></section>';
  if(afterLogin)document.querySelector('#teacher-error').textContent='Trình duyệt chưa giữ được phiên. Hãy cho phép cookie cho trang này rồi đăng nhập lại.';
  const config=await request('/config');if(!config.googleClientId){document.querySelector('#teacher-error').textContent='Chưa cấu hình đăng nhập Google.';return;}
  try{
   if(!window.google?.accounts?.id){
    teacherGoogleScript ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>{teacherGoogleScript=null;reject(new Error('Không tải được đăng nhập Google. Hãy tải lại trang để thử lại.'));};document.head.append(script);});
    await teacherGoogleScript;
   }
   google.accounts.id.initialize({client_id:config.googleClientId,callback:async response=>{try{
    await request('/teacher/login',{credential:response.credential,remember:document.querySelector('#teacher-remember').checked},true);
    try{sessionStorage.removeItem('listening-teacher-token');}catch{}
    await teacherScreen(true);
   }catch(error){const status=document.querySelector('#teacher-error');if(status)status.textContent=error.message;}}});
   google.accounts.id.renderButton(document.querySelector('#google-signin'),{theme:'outline',size:'large',text:'signin_with'});
  }catch(error){document.querySelector('#teacher-error').textContent=error.message;}
 }
}
async function teacherLogout(){
 teacherResultGeneration++;window.ListeningReview?.reset();clearListeningAudioMemory();
 try{
  await request('/teacher/logout',{},true);
  try{sessionStorage.removeItem('listening-teacher-token');localStorage.setItem('listening-teacher-logout',crypto.randomUUID());}catch{}
  window.google?.accounts?.id?.disableAutoSelect();window.ListeningReview?.reset();resultCache.clear();db={students:{}};identity=null;
  await teacherScreen();
 }catch(error){notify(error.message);}
}
function teacherHistory(response,selected){
 return '<section class="section"><h2>Lịch sử làm bài</h2><p class="small muted">Lần hoàn thành đầu tiên: '+(response.firstCompleted||'Chưa có')+'</p><div class="history">'+response.attempts.map(a=>a.status==='submitted'?`<button type="button" data-action="teacher-result" data-submission="${a.submissionId}" class="${a.id===selected.id?'selected':''}">Lần ${a.no}<span>${a.finalScore}/${total()} · Đã nộp</span></button>`:`<details class="card card-pad"><summary>Lần ${a.no} · ${a.status==='reset'?'Đã reset':'Chưa nộp'} · ${countAnswered(a)}/${total()} đã nhập</summary><p>Bắt đầu: ${dateLabel(a.startedAt)} · Còn ${timeLabel(a.remainingMs)}</p><div class="table-wrap"><table><thead><tr><th>Câu</th><th>Bài làm đã lưu</th></tr></thead><tbody>${Object.keys(KEY).map(n=>`<tr><td>${n}</td><td>${escape(a.answers[n]||'—')}</td></tr>`).join('')}</tbody></table></div><p style="white-space:pre-wrap">${escape(a.notes||'Chưa có ghi chú.')}</p></details>`).join('')+'</div></section>';
}

function openModal(title,body,confirmLabel,confirm,style='') {
    closeModal(); modalAction=confirm;
    modal.innerHTML=`<h2 id="modal-title">${title}</h2>${body}<div class="actions">${btn('Quay lại','close-modal','outline')}${btn(confirmLabel,'confirm-modal',style)}</div>`;
    modal.showModal(); modal.querySelector('[data-action="close-modal"]').focus();
  }

function closeModal() { if (modal.open) modal.close(); modalAction=null; }

function rememberScroll() {
    const a=current(); if(!a || route!=='exercise' || a.owner!==TAB)return;
    a.scroll ||= {passage:0,questions:{}};
    const passage=document.querySelector('#passage-scroll'),questions=document.querySelector('#question-scroll');
    if(passage)a.scroll.passage=passage.scrollTop;
    if(questions)a.scroll.questions.all=questions.scrollTop;
    const part=document.querySelector('#readingView')?.dataset.listeningPart;if(LESSON?.parts?.length&&part){a.scroll.questions[part+'-left']=passage?.scrollTop||0;a.scroll.questions[part+'-right']=questions?.scrollTop||0;}
  }

function requestReset() {
    const n=current()?.no;
    openModal('Làm lại từ đầu?',`<p>Bạn sẽ bắt đầu <strong>lần làm bài số ${n+1}</strong> với audio từ đầu và 2 phút rà bài. Đáp án lần hiện tại sẽ không chuyển sang lần mới.</p><p>Lịch sử lần ${n} vẫn được giữ. Kết quả và tài liệu bài tập sẽ ghi rõ số lần reset.</p>`,'Reset và bắt đầu lại',reset,'red');
  }

function requestSubmit() {
    const blank=total()-countAnswered(current());
    openModal('Nộp bài Listening?',`<p>Bạn đã trả lời <strong>${total()-blank}/${total()} câu</strong>${blank?` và còn <strong>${blank} câu trống</strong>`:''}.</p><p>Sau khi nộp, bạn có thể xem điểm, đáp án và bằng chứng. Muốn làm tiếp một lượt mới, hãy dùng Reset.</p>`,'Nộp bài',()=>finish('manual'));
  }

function hero(kicker,title,copy) { if(LESSON){kicker=kicker.replace('BUỔI 8',`BUỔI ${LESSON.lesson}`);if(title==='Science experiment for Year 12 students')title=escape(LESSON.title);copy=copy.replace('10 câu',`${total()} câu`);}return `<section class="hero"><div><span class="kicker">${kicker}</span><h1>${title}</h1><p class="hero-copy">${copy}</p></div><span class="lesson-index" aria-hidden="true">${LESSON?String(LESSON.lesson).padStart(2,'0'):'07'}</span></section>`; }

function prep() {
    const a=current();
    if(LESSON){app.innerHTML=hero(`BUỔI ${LESSON.lesson} · CHUẨN BỊ LÀM BÀI`,escape(LESSON.title),'Nghe một lượt ở tốc độ gốc; sau audio có thời gian rà bài.')+identityBar()+AuthoredUI.prepHtml({...LESSON,groups:AUTHORED_DEF?.groups||LESSON.groups},a,'listening',btn,textBtn)+footer();return;}
    app.innerHTML=hero('BUỔI 8 · CHUẨN BỊ LÀM BÀI','Science experiment for Year 12 students','Nghe một lượt ở tốc độ gốc. Khoảng đọc đề nằm sẵn trong audio; sau audio có 2 phút rà bài.')+identityBar()+`<div class="meta-row section"><span><strong>Cam 19 · Test 3 · Part 3</strong></span><span>10 câu · 21–30</span><span>Audio 7:39 + rà bài 2:00</span></div><section class="card"><div class="section-heading"><h2><span class="step-number">01</span>Nhắc nhanh phương pháp</h2></div><div class="method-grid"><section><h3>Multiple Choice</h3><ul><li>Đọc câu hỏi, xác định kịch bản audio</li><li>Đọc A-C: đọc hiểu + đào sâu ý nghĩa (dịch tiếng Việt / paraphrase tiếng Anh / tưởng tượng hình ảnh / so sánh các phương án với nhau...)</li><li>Nghe audio: để ý thái độ người nói, nhận định rõ ít nhất 2/3 option trong A B C</li></ul></section><section><h3>Flow-chart completion</h3><ul><li>Đọc các bước và ngân hàng A–H.</li><li>Đoán loại từ, ý nghĩa cần điền; gạch từ khóa.</li><li>Nghe theo trình tự, đối chiếu ý rồi chọn chữ cái.</li></ul></section></div></section><div class="prep-bottom"><section><h3>Trước khi bắt đầu</h3><p class="muted">Kiểm âm lượng và dùng tai nghe. Mỗi lượt nghe một lần, không tua hoặc đổi tốc độ.</p><p class="small muted">Đóng bài, chuyển tab, mất mạng hoặc audio bị đứng: bài tạm dừng và giữ vị trí nghe. Nhấn Tiếp tục để quay lại.</p><p class="small muted">Reset tạo lượt mới, audio về đầu; lịch sử và số lần làm vẫn được giữ.</p></section><section class="start-panel"><span class="kicker">${a?.status==='submitted'?'BẠN ĐÃ CÓ KẾT QUẢ':'SẴN SÀNG LÀM BÀI'}</span><h3>${a?.status==='submitted'?`Lần ${a.no} · ${a.finalScore}/${total()} câu đúng`:'10 câu · Nghe một lượt'}</h3><p class="small muted">Khi nhấn Bắt đầu, tài liệu bài tập ghi nhận lần làm và audio được phát.</p>${a?.status==='submitted'?btn('Xem kết quả →','show-result')+textBtn('Reset và làm lại từ đầu','request-reset'):btn('Bắt đầu làm bài →','begin')}</section></div>`+footer();
  }
function resumeScreen() {
    const a=current(); if(!a) { navigate('prep'); return; }
    const offline=!isOnline(), conflict=a.pauseReason==='conflict';
    app.innerHTML=hero('BUỔI 8 · TIẾP TỤC BÀI LISTENING',offline?'Bài đang tạm dừng':conflict?'Bài vừa được mở ở tab khác':'Bạn còn thời gian để làm tiếp',offline?'Đáp án đã được giữ trên thiết bị. Khôi phục kết nối rồi tiếp tục đúng chỗ đang dừng.':'Thời gian không trôi khi bạn rời màn làm bài. Tiếp tục lần hiện tại hoặc reset để bắt đầu lại.')+identityBar()+`<p id="listening-recovery-notice" class="m170-recovery-notice" role="status" ${recoveryNotice?'':'hidden'}>${escape(recoveryNotice)}</p><section class="card resume-card"><div><span class="kicker">LẦN LÀM BÀI SỐ ${a.no}</span><div class="remaining-big">${timeLabel(a.remainingMs)}</div><p class="muted">Thời gian còn lại</p><div class="resume-stats"><div><strong>${countAnswered(a)}/${total()}</strong><span>Đã trả lời</span></div><div><strong>${a.flags.length}</strong><span>Câu đánh dấu</span></div><div><strong>${a.no-1}</strong><span>Lần reset</span></div></div><span class="pill good">✓ Đã giữ bản nháp</span></div><div><h2>${offline?'Kết nối đang tạm ngắt':'Sẵn sàng tiếp tục?'}</h2><p class="muted">${conflict?'Tiếp tục tại đây sẽ chuyển quyền làm bài về tab này. Tab kia sẽ tạm dừng.':'Bạn sẽ quay lại phần câu hỏi đã mở, với toàn bộ đáp án và ghi chú.'}</p>${offline?`<div class="note warning">Đồng hồ đã dừng. Trong lúc mất mạng, vùng đề và câu hỏi được đóng lại.</div>${btn('Kiểm tra kết nối','check-network','outline')}`:btn(`Tiếp tục lần ${a.no} →`,'resume','full')}<div style="margin-top:16px">${textBtn('Reset và làm lại từ đầu','request-reset',offline?'disabled':'')}</div></div></section>`+footer();
  }

function exercise() {
    const a=current(); if(!a || a.status!=='running') { navigate(a?.status==='submitted'?`result?attempt=${a.no}`:'resume'); return; }
    recoveryNotice='';
    app.innerHTML=`<header class="topbar"><a class="design-brand" href="#docs"><img class="m170-logo" src="../shared/master170/assets/izone-logo-color.png" alt="IZONE — IELTS chiến lược" width="145" height="48"></a><h1>Listening thực chiến · Buổi ${LESSON?.lesson||8}</h1><details class="identity-options homework-options"><summary><span class="homework-student">${escape(student()?.name)} · </span>Lần ${a.no}</summary><div class="identity-options-body"><p>${escape(student()?.name)} · Lớp ${escape(identity?.classCode)}</p>${textBtn('Tạm dừng','pause')}${textBtn('Reset bài','request-reset')}<a href="#docs">Xem tài liệu bài tập ↗</a></div></details></header>
    <div class="page-shell"><section id="readingView" class="panel test-panel cbt-test-form" data-design-pane="${a.mobilePane||'passage'}" aria-label="Bài Listening"><div class="cbt-semantic-stage questions-grid"><div class="cbt-semantic-pane"><div class="cbt-toolbar"><div class="cbt-test-heading"><div><h2>Listening - ${total()} câu</h2></div><div class="cbt-toolbar-controls"><nav class="cbt-part-nav" aria-label="Chuyển part Listening">${AuthoredUI.partNavHtml(LESSON,a.activeQuestion)}</nav><div class="cbt-text-size"><button type="button" class="cbt-tool-button" data-action="font-down" aria-label="Giảm cỡ chữ">A−</button><strong id="font-percent">${Math.round(fontSize/17*100)}%</strong><button type="button" class="cbt-tool-button" data-action="font-up" aria-label="Tăng cỡ chữ">A+</button></div><button type="button" class="cbt-tool-button" data-action="notes">Notes</button>${LESSON?.parts?.length?'<button type="button" class="cbt-tool-button" data-action="review">Rà soát bài</button>':''}</div><div class="cbt-heading-actions"><div id="timer" class="cbt-reading-clock">Còn <strong>${timeLabel(a.remainingMs)}</strong><span>/ audio + 2 phút rà bài</span></div><span class="answer-count" id="answered-progress"></span><span class="autosave-status" data-status="saved">Đã giữ trên thiết bị</span><button type="button" class="button button-primary cbt-heading-submit" data-action="request-submit">Nộp bài Listening</button></div></div><nav class="reading-view-switch" aria-label="Vùng Reading"><button type="button" data-action="mobile-pane" data-pane="passage" aria-pressed="${(a.mobilePane||'passage')==='passage'}">${LESSON?(LESSON.groups.length>1?'Nhóm đầu':'Hướng dẫn'):'Câu 21–25'}</button><button type="button" data-action="mobile-pane" data-pane="questions" aria-pressed="${a.mobilePane==='questions'}">${LESSON?'Câu hỏi':'Câu 26–30'}</button></nav></div>${audioToolbar(a)}<div class="cbt-content-viewport" data-font-size="${Math.round(fontSize/17*100)}"><section class="cbt-reading-section"><article class="cbt-reading-passage" id="passage-scroll" aria-label="Câu 21–25"></article><article class="cbt-reading-questions" id="question-scroll" aria-label="Câu 26–30"></article></section></div></div></div><div class="cbt-question-nav-wrap">${LESSON?.parts?.length?'':'<div class="cbt-review-bar"><span id="review-count"></span><button type="button" class="cbt-review-open" data-action="review">Rà soát bài</button></div>'}<nav class="cbt-question-nav" aria-label="Đi đến câu hỏi">${Object.keys(KEY).map(n=>`<button type="button" class="cbt-question-button" data-action="jump" data-question="${n}" aria-label="Câu ${n}">${n}</button>`).join('')}</nav><p class="cbt-nav-legend">Navy đậm: đang chọn · Navy nhạt: đã trả lời · Gạch vàng: cần xem lại</p><aside id="review-panel" class="cbt-review-panel" hidden></aside></div></section></div><aside class="cbt-note-panel" id="notes-panel" hidden><header><strong>Ghi chú cá nhân</strong><button type="button" class="cbt-review-close" data-action="notes" aria-label="Đóng ghi chú">×</button></header><div class="homework-notes"><label for="notes">Tự lưu cùng lần làm bài</label><textarea id="notes" placeholder="Nén ý, từ khóa hoặc điểm cần kiểm lại…">${escape(a.notes)}</textarea></div></aside><footer class="reading-demo-footer">IZONE · Listening thực chiến · Buổi ${LESSON?.lesson||8}</footer>`;
    renderQuestions(); updateProgress();setActivating(activating);

    document.querySelector('#passage-scroll').scrollTop=a.scroll?.passage || 0;
    document.querySelector('#notes-panel').hidden=!a.notesOpen;
  }
function flag(n) { return `<button type="button" class="cbt-flag-button flag ${current().flags.includes(+n)?'is-flagged':''}" data-action="flag" data-question="${n}" aria-label="Đánh dấu câu ${n}" aria-pressed="${current().flags.includes(+n)}">⚑</button>`; }


function authoredQuestions(){
 const a=current(),part=AuthoredUI.partForQuestion(LESSON,a.activeQuestion);
 const groups=part?AUTHORED_DEF.groups.filter(g=>g.start>=part.start&&g.end<=part.end):AUTHORED_DEF.groups;
 const write=(n,value)=>{if(!writable())return;a.answers[n]=value;if(LESSON.parts?.length)a.activeQuestion=+n;persist();updateProgress();};
 const left=document.querySelector('#passage-scroll'),right=document.querySelector('#question-scroll'),view=document.querySelector('#readingView');
 if(left.parentElement===right)right.before(left);
 if(LESSON.audioMs!==undefined){
  const single=Boolean(part&&part.splitAfter===undefined);
  view.classList.toggle('listening-single-part',single);view.dataset.listeningPart=part?.id||'single';
  if(part){left.dataset.annotationRootKey=`listening-${part.id}-left`;right.dataset.annotationRootKey=`listening-${part.id}-right`;}
  const leftGroups=part?(single?[]:groups.filter(g=>g.end<=part.splitAfter)):groups.length>1?groups.slice(0,1):[];
  const rightGroups=part?(single?groups:groups.filter(g=>g.start>part.splitAfter)):groups.length>1?groups.slice(1):groups;
  if(part)view.querySelector('.cbt-test-heading h2').textContent=part.title;
  left.innerHTML=leftGroups.length?AuthoredUI.groupsHtml(leftGroups,a,flag,{practiceLayout:Boolean(part)}):`<header class="cbt-passage-header"><h3>${escape(part?.title||LESSON.title)}</h3><p>${escape(groups[0].instruction)}</p></header>`;
  right.innerHTML=AuthoredUI.groupsHtml(rightGroups,a,flag,{documentNotes:single,practiceLayout:Boolean(part)});
  const notesDocument=!part&&AuthoredUI.mountNoteDocument(view,groups,LESSON.title);
  left.setAttribute('aria-label',part?`${part.title} · Nhóm đầu`:'Nhóm câu đầu');right.setAttribute('aria-label',part?`${part.title} · Câu hỏi`:'Câu hỏi');
  if(part){left.scrollTop=a.scroll?.questions[part.id+'-left']||0;right.scrollTop=a.scroll?.questions[part.id+'-right']||0;}
  if(single||notesDocument)setMobilePane('questions');
 }else{
  left.innerHTML=`<header class="cbt-passage-header"><h3>${escape(LESSON.title)}</h3></header><div class="cbt-passage-body">${Object.entries(AUTHORED_DEF.passage).map(([id,text])=>`<div class="cbt-passage-paragraph paragraph" data-paragraph="${escape(id)}" id="paragraph-${escape(id)}"><span class="cbt-paragraph-label">${escape(id)}</span><p>${escape(text)}</p></div>`).join('')}</div>`;
  right.innerHTML=AuthoredUI.groupsHtml(groups,a,flag);
 }
 AuthoredUI.bindMultiple(view,write);window.ReadingAnnotations?.install();
}

function renderQuestions() {
 if(LESSON?.authored)return authoredQuestions();
    const a=current(),left=document.querySelector('#passage-scroll'),right=document.querySelector('#question-scroll');if(!left||!right)return;
    const group=(title,instruction,content)=>`<section class="design-question-group"><header class="cbt-subsection-heading"><h4>${title}</h4>${instruction}</header><div class="design-question-content">${content}</div></section>`;
    const mcq=MCQ.map(q=>`<article class="cbt-question-card" id="q-${q.n}" data-question-number="${q.n}" role="group" aria-labelledby="stem-${q.n}"><div class="cbt-question-heading"><span class="cbt-question-number">${q.n}</span><p id="stem-${q.n}">${escape(q.text)}</p>${flag(q.n)}</div><div class="cbt-choice-list">${q.options.map((text,i)=>{const letter='ABC'[i];return `<label class="cbt-choice"><input type="radio" name="answer-${q.n}" value="${letter}" data-answer="${q.n}" ${a.answers[q.n]===letter?'checked':''}><span class="cbt-choice-letter">${letter}</span><span>${escape(text)}</span></label>`;}).join('')}</div></article>`).join('');
    const slot=n=>`<span class="cbt-select-answer" data-question-number="${n}"><span class="cbt-blank-number">${n}</span><span data-answer-slot><select class="cbt-answer-select" data-answer="${n}" id="answer-${n}" aria-label="Câu ${n}"><option value="">Nhấn để chọn</option>${BANK.map(([letter])=>`<option value="${letter}" ${a.answers[n]===letter?'selected':''}>${letter}</option>`).join('')}</select></span>${flag(n)}</span>`;
    const bank=`<aside class="cbt-option-bank listening-bank"><h4>Options A–H</h4>${BANK.map(([letter,word])=>`<div><strong>${letter}</strong><span>${word}</span></div>`).join('')}</aside>`;
    const flow=`${bank}<section class="listening-flow" aria-label="Science experiment procedure">${FLOW.map(([n,text,suffix],i)=>`<div class="flow-step" id="q-${n}" data-question-number="${n}"><p>${escape(text)} ${slot(n)}${suffix}</p></div>${i<4?'<div class="flow-arrow" aria-hidden="true">↓</div>':''}`).join('')}</section>`;
    left.innerHTML=group('Questions 21–25','<p>Choose the correct letter, <strong>A, B or C</strong>.</p><p>Science experiment for Year 12 students</p>',mcq);
    right.innerHTML=group('Questions 26–30','<p>Complete the flowchart below.</p><p>Choose <strong>FIVE answers</strong> from the box and write the correct letter, <strong>A–H</strong>, next to Questions 26–30.</p>',flow);
    right.scrollTop=a.scroll?.questions.all||0;window.ReadingAnnotations?.install();
  }
function updateProgress() {
    const a=current(); if(!a) return;
    const timer=document.querySelector('#timer');
    if(timer) { timer.querySelector('strong').textContent=a.phase==='listening'?timeLabel((AUDIO_DURATION-(a.audioPosition||0))*1000):timeLabel(a.reviewRemainingMs??a.remainingMs);updateAudioToolbar(); timer.classList.toggle('is-warning',a.remainingMs<60000); }
    document.querySelectorAll('button[data-listening-part]').forEach(button=>{const p=AuthoredUI.partForQuestion(LESSON||{},a.activeQuestion),selected=p?button.dataset.listeningPart===p.id:true;button.classList.toggle('is-active',selected);button.setAttribute('aria-pressed',String(selected));});
    const progress=document.querySelector('#answered-progress'); if(progress) progress.textContent=`${countAnswered(a)}/${total()} đã nhập`;
    const reviewCount=document.querySelector('#review-count'); if(reviewCount)reviewCount.textContent=`${total()-countAnswered(a)} chưa làm · ${a.flags.length} đã đánh dấu`;
    document.querySelectorAll('.cbt-question-button').forEach(b=>{
      const n=+b.dataset.question;
      b.classList.toggle('is-answered',!!normal(a.answers[n])); b.classList.toggle('is-flagged',a.flags.includes(n)); b.classList.toggle('is-active',a.activeQuestion===n);
      b.setAttribute('aria-current',a.activeQuestion===n?'true':'false');
      b.setAttribute('aria-label',`Câu ${n}${normal(a.answers[n])?', đã trả lời':', chưa trả lời'}${a.flags.includes(n)?', đã đánh dấu':''}`);
    });
    document.querySelectorAll('[data-question-number]').forEach(el=>{const n=+el.dataset.questionNumber;el.classList.toggle('is-answered',!!normal(a.answers[n]));el.classList.toggle('is-active',a.activeQuestion===n);el.classList.toggle('is-flagged',a.flags.includes(n));});
    document.querySelectorAll('.cbt-flag-button').forEach(el=>{const selected=a.flags.includes(+el.dataset.question);el.classList.toggle('is-flagged',selected);el.setAttribute('aria-pressed',String(selected));});
    revealActiveQuestion();
  }

function revealActiveQuestion(force=false){
    if(!LESSON?.parts?.length)return;
    const nav=document.querySelector('.cbt-question-nav'),n=String(current()?.activeQuestion||'');
    if(!nav||(!force&&nav.dataset.activeQuestion===n))return;
    nav.dataset.activeQuestion=n;
    const button=nav.querySelector(`[data-question="${n}"]`);if(!button||nav.scrollWidth<=nav.clientWidth+1)return;
    const box=nav.getBoundingClientRect(),item=button.getBoundingClientRect();
    // Chỉ cuộn hàng số khi đổi câu/đổi kích thước; timer không kéo vùng người dùng đang đọc.
    if(item.left<box.left)nav.scrollLeft-=box.left-item.left;
    else if(item.right>box.right)nav.scrollLeft+=item.right-box.right;
}
window.addEventListener('resize',()=>revealActiveQuestion(true));

function switchTab(tab) { jump(tab==='headings'?14:tab==='mcq'?21:24); }

function jump(n) {
    const a=current();rememberScroll();a.activeQuestion=n;a.tab=LESSON?LESSON.groups.find(g=>n>=g.start&&n<=g.end).kind:n<=25?'mcq':'flowchart';
    const part=AuthoredUI.partForQuestion(LESSON||{},n);if(part&&document.querySelector('#readingView')?.dataset.listeningPart!==part.id)renderQuestions();
    const pane=questionPane(n);
    if(matchMedia('(max-width:980px)').matches)setMobilePane(pane);
    const el=document.querySelector(`#q-${n}`),scroll=document.querySelector(pane==='passage'?'#passage-scroll':'#question-scroll');
    if(el&&scroll)scroll.scrollTo({top:el.getBoundingClientRect().top-scroll.getBoundingClientRect().top+scroll.scrollTop-16,behavior:'auto'});
    document.querySelector(`[data-answer="${n}"], [data-authored-pair^="${n},"], [data-authored-pair$=",${n}"]`)?.focus({preventScroll:true});rememberScroll();persist();updateProgress();
  }
function spotParagraph(letter) {
    document.querySelectorAll('.paragraph').forEach(p=>p.classList.toggle('spot',p.dataset.paragraph===letter));
    const p=document.querySelector(`#paragraph-${letter}`), scroll=document.querySelector('#passage-scroll');
    if(p && scroll) scroll.scrollTo({top:p.getBoundingClientRect().top-scroll.getBoundingClientRect().top+scroll.scrollTop-16,behavior:'auto'});
  }

function setMobilePane(pane) {
    current().mobilePane=pane;
    document.querySelector('#readingView').dataset.designPane=pane;
    document.querySelectorAll('.reading-view-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pane===pane)));
    persist();
  }

function changeFont(delta) {
    const percent=Math.min(120,Math.max(90,Math.round(fontSize/17*100)+delta));fontSize=17*percent/100;
    document.querySelector('.cbt-content-viewport').dataset.fontSize=percent;
    document.querySelector('#font-percent').textContent=percent+'%';
  }

function review(filter='all') {
    const a=current(), panel=document.querySelector('#review-panel');if(!panel)return;
    const rows=Object.keys(KEY).filter(n=>filter==='blank'?!normal(a.answers[n]):filter==='flagged'?a.flags.includes(+n):true);
    panel.innerHTML=`<header><strong>Rà soát bài · ${countAnswered(a)}/${total()} đã nhập</strong><button type="button" class="cbt-review-close" data-action="close-review" aria-label="Đóng rà soát">×</button></header><nav class="cbt-review-filters">${[['all','Tất cả'],['blank','Chưa trả lời'],['flagged','Đã đánh dấu']].map(([key,label])=>`<button type="button" class="cbt-review-filter ${filter===key?'is-active':''}" data-action="review-filter" data-filter="${key}">${label}</button>`).join('')}</nav><div class="cbt-review-grid">${rows.map(n=>`<button type="button" data-action="review-jump" data-question="${n}" class="cbt-review-question ${normal(a.answers[n])?'is-answered':''} ${a.flags.includes(+n)?'is-flagged':''}" aria-label="Câu ${n}">${n}</button>`).join('')}</div>${rows.length?'':'<p class="cbt-review-empty">Không có câu nào trong nhóm này.</p>'}`;panel.hidden=false;
  }
  // Dữ liệu vào là lời giải đã gắn đúng số câu từ tab t.0; chỉ dựng sau nộp bài.
  // Giữ đoạn văn, gạch đầu dòng, từ nhấn mạnh; escape mọi chữ lấy từ tài liệu.

function explanationRuns(runs) {
    return runs.map(run=>{
      let text=escape(run.text.replace(/\n$/, ''));
      if(run.bold)text=`<strong>${text}</strong>`;
      // Mã RGB nguồn giữ riêng nền/chữ; chỉ cho phép mã hex trước khi dựng CSS.
      const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:null;
      const background=color(run.background),foreground=color(run.foreground);
      if(background||foreground){
        const tag=background&&background!=='#ffffff'?'mark':'span';
        const style=[background?`background-color:${background}`:'',foreground?`color:${foreground}`:''].filter(Boolean).join(';');
        text=`<${tag} data-source-background="${background||''}" data-source-foreground="${foreground||''}" style="${style}">${text}</${tag}>`;
      }
      return text;
    }).join('');
  }

function explanationParagraphs(paragraphs) {
    return paragraphs.map(p=>`<p class="${p.bullet?'explanation-bullet':''}">${explanationRuns(p.runs)}</p>`).join('');
  }
  // Lời giải nằm ngay dưới hàng kết quả, giữ mọi đoạn chữ và màu từ Docs.

function explanationContent(e) {
 if(LESSON?.authored)return AuthoredUI.analysisHtml(e,explanationParagraphs);
    if(!e)return '<p class="note warning">Chưa tải được phần giải thích. Hãy tải lại trang.</p>';
    const n=e.number,answer=e.answer.join(' / ');
      let analysis='',evidence=e.evidence;
      if(e.kind==='mcq'){
        evidence=e.options.find(o=>o.correct).evidence;
        analysis=`<h4>Đối chiếu từng phương án</h4><div class="explanation-options">${e.options.map(o=>{
          const optionText=MCQ.find(q=>q.n===n).options['ABCD'.indexOf(o.letter)];
          return `<section class="explanation-option ${o.correct?'is-correct':''}" data-option="${o.letter}"><header><span class="cbt-choice-letter">${o.letter}</span><strong>${o.label?explanationRuns(o.label.runs):escape(optionText)}</strong><span class="option-verdict">${o.correct?'Đáp án đúng':'Loại'}</span></header><div class="explanation-option-body"><span class="explanation-reason-label">${o.verdict}</span>${explanationParagraphs(o.reason)}${!o.correct&&o.evidence.length?`<details class="explanation-option-evidence"><summary>Xem trích dẫn</summary><blockquote>${explanationParagraphs(o.evidence)}</blockquote></details>`:''}</div></section>`;
        }).join('')}</div>`;
      }else{
        analysis=`<h4>${e.kind==='headings'?`Vì sao chọn heading ${answer}?`:'Từ loại và ý nghĩa cần điền'}</h4>${e.heading?`<div class="explanation-heading-text">${explanationParagraphs([e.heading])}</div>`:''}${explanationParagraphs(e.reason)}${e.kind==='summary'?'<p class="explanation-word-limit">Giới hạn: <strong>ONE WORD AND/OR A NUMBER</strong>.</p>':''}`;
      }
    return `<article class="explanation-question evidence" data-explanation-question="${n}" aria-label="Giải thích câu ${n}">${e.prompt?`<div class="explanation-prompt">${explanationRuns(e.prompt.runs)}</div>`:''}<div class="explanation-body"><section class="explanation-analysis">${analysis}</section><aside class="explanation-evidence"><h4>Bằng chứng · ${e.paragraph}</h4><blockquote>${explanationParagraphs(evidence)}</blockquote><p class="explanation-evidence-hint">Từ cùng màu liên kết ý trong câu hỏi với bằng chứng; chữ đỏ giữ phần đối chiếu trong tài liệu.</p></aside></div></article>`;
  }

function reviewContext(attempt,data){return {attempt,data,owner:identity?.bindingId||identity?.studentRef,
 role:location.pathname.endsWith('/teacher.html')?'teacher':'student',
 token:location.pathname.endsWith('/teacher.html')?legacyTeacherToken():sessionToken};}
function warmReviewResult(attempt,data){window.ListeningReview?.warm(reviewContext(attempt,data));}
// Chỉ thay điểm mở lời giải; lấy đúng lượt đang xem, giữ mọi luồng làm bài gốc.
function toggleExplanation(number,button) {
 const id=button.closest('[data-attempt-id]')?.dataset.attemptId;
 const data=resultCache.get(id),attempt=record()?.attempts.find(a=>a.id===id)||data?.attempt;
 if(!data||!attempt)return;
 if(!data.review){
  const row=document.getElementById(`explanation-${number}`);if(!row)return;
  row.hidden=!row.hidden;button.setAttribute('aria-expanded',String(!row.hidden));
  button.textContent=row.hidden?'Xem giải thích':'Ẩn giải thích';return;
 }
 window.ListeningReview.open({...reviewContext(attempt,data),number,trigger:button,
  renderParagraphs:explanationParagraphs,renderContent:explanationContent,
 });
}

function resultTable(a) {
    const data=resultCache.get(a.id)?.explanations;
    return `<section class="card section answer-explanations" data-attempt-id="${escape(a.id)}" aria-labelledby="explanations-title"><div class="section-heading"><h2 id="explanations-title">Đáp án và giải thích</h2><span class="pill">${total()} câu</span></div><div class="table-wrap detail-table-wrap"><table class="result-table detail-table"><thead><tr><th scope="col">Câu</th><th scope="col">Bài làm</th><th scope="col">Đáp án đúng</th><th scope="col">Kết quả</th><th scope="col">Giải thích</th></tr></thead><tbody>${Object.keys(KEY).map(n=>{
      const row=a.result.rows.find(r=>r.number===+n),correct=row.state==='correct',blank=row.state==='blank';
      const state=correct?'correct':blank?'blank':'incorrect';
      const answers=resultCache.get(a.id).key[n];const key=LESSON?answers.join(' / '):n>=21&&n<=23?answers[0].toUpperCase():answers.join(' / ');
      return `<tr class="detail-row detail-row-${state}" data-result-question="${n}"><td>${String(n).padStart(2,'0')}.</td><td data-label="Bài làm">${escape(a.answers[n]||'—')}</td><td data-label="Đáp án đúng">${key}</td><td class="${correct?'mark-good':blank?'muted':'mark-bad'}"><span class="detail-result-cell result-${state}"><span class="detail-result-icon" aria-hidden="true">${correct?'✓':blank?'–':'✕'}</span>${correct?'Đúng':blank?'Bỏ trống':'Sai'}</span></td><td><button type="button" class="explanation-button" data-action="explanation-toggle" data-question="${n}" aria-haspopup="dialog">Xem giải thích</button></td></tr><tr class="inline-explanation-row" id="explanation-${n}" hidden><td colspan="5">${explanationContent(data?.entries?.[n])}</td></tr>`;
    }).join('')}</tbody></table></div></section>`;
  }

function attemptHistory(rec,selected,teacher=false,id=studentId) {
    return `<div class="history">${rec.attempts.map(a=>`<button type="button" data-action="${teacher?'teacher-attempt':'result-attempt'}" data-student="${id}" data-attempt="${a.no}" class="${a.no===selected?'selected':''}">Lần ${a.no}<span>${a.status==='submitted'?`${a.finalScore}/${total()} · Đã nộp`:a.status==='reset'?'Đã reset':`Đang làm · ${countAnswered(a)}/${total()}`}</span></button>`).join('')}</div>`;
  }

function resultScreen() {
    const rec=record(); const a=rec?.attempts.find(a=>a.no===+(routeParams.get('attempt') || current()?.no));
    if(!a) { navigate('prep'); return; }
    const submitted=a.status==='submitted';
    app.innerHTML=hero(submitted?'BUỔI 8 · KẾT QUẢ LISTENING':'BUỔI 8 · LỊCH SỬ LÀM BÀI',submitted?'Bạn đã hoàn thành bài nghe':`Lần ${a.no} đã ${a.status==='reset'?'reset':'tạm dừng'}`,submitted?completionCopy(a):'Bài này chưa được nộp. Đáp án đúng chỉ mở sau khi hoàn thành.')+identityBar()+`<div class="meta-row section"><span>Lần làm bài <strong>${a.no}</strong></span><span>${submitted?(a.method==='timeout'?'Hệ thống thu bài khi hết giờ':'Bạn chủ động nộp bài'):'Chưa nộp bài'}</span><span>Đã làm <strong>${timeLabel(FULL_TIME-a.remainingMs)}</strong></span></div>${submitted?`<section class="result-summary"><div class="score-box"><strong>${a.finalScore}<span>/${total()}</span></strong><small>Số câu trả lời đúng<br>${LESSON?.parts?.length?'Điểm toàn bài Listening':`Điểm của riêng Listening Part ${LESSON?.part||3}`}</small></div><div class="score-details"><h2>${escape(LESSON?.title||'Science experiment for Year 12 students')}</h2><p class="small muted">${LESSON?escape(AuthoredUI.sourceLabel(LESSON))+` · Câu ${LESSON.questionIds[0]}–${LESSON.questionIds.at(-1)}`:'Cambridge 19 · Test 3 · Part 3 · Câu 21–30'}</p><div class="type-scores">${(LESSON?.parts?.map(p=>({...p,label:p.title.split(' · ')[0]}))||LESSON?.groups||[{start:21,end:25,label:'Multiple Choice'},{start:26,end:30,label:'Flow-chart completion'}]).map(g=>`<div><strong>${resultFor(a,g.start,g.end)}/${g.end-g.start+1}</strong><span>${escape(g.label)}</span></div>`).join('')}</div></div></section>${docsNotice(a)}`:`<div class="note">${countAnswered(a)}/${total()} câu đã trả lời. ${a.status==='reset'?'Lần này được lưu trong lịch sử nhưng không có điểm hoàn thành.':'Bạn có thể tiếp tục bằng thời gian còn lại.'}</div>`}<div class="actions section">${current()?.status==='paused'?btn('Tiếp tục lần đang làm','resume'):''}${btn('Reset và làm lại từ đầu','request-reset','outline')}${textBtn('Về tài liệu bài tập','show-docs')}</div><section class="section"><h3>Lịch sử làm bài</h3>${attemptHistory(rec,a.no)}</section>${submitted?resultTable(a):''}`+footer();
    if(submitted)warmReviewResult(a,resultCache.get(a.id));
  }
// Các thao tác chỉ ghi khi tab đang giữ lượt làm. Chọn chữ dùng adapter nguyên bản của Term Test.
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
 const a=current(),n=+target.dataset.question;
 const actions={
  'open-assignment':()=>navigate('login'),'show-docs':()=>identity?.documentUrl?window.open(identity.documentUrl,'_blank','noopener'):navigate('docs'),
  'change-student':changeStudent,
  begin,resume,pause:()=>pause(),'request-reset':requestReset,'request-submit':requestSubmit,'show-result':()=>loadResult(a.no),
  'close-modal':closeModal,'confirm-modal':()=>{const fn=modalAction;closeModal();fn?.();},
  tab:()=>switchTab(target.dataset.tab),jump:()=>jump(n),
  flag:()=>{if(!writable())return;a.flags=a.flags.includes(n)?a.flags.filter(x=>x!==n):[...a.flags,n];persist();updateProgress();},
  review:()=>review(),'review-filter':()=>review(target.dataset.filter),'close-review':()=>document.querySelector('#review-panel').hidden=true,
  'review-jump':()=>{document.querySelector('#review-panel').hidden=true;jump(n);},'mobile-pane':()=>setMobilePane(target.dataset.pane),
  notes:()=>{window.ReadingAnnotations?.closeNotePanel();window.ReadingAnnotations?.refreshNotes();const p=document.querySelector('#notes-panel');p.hidden=!p.hidden;a.notesOpen=!p.hidden;persist();if(!p.hidden)document.querySelector('#notes').focus();},
  'audio-play':()=>startPlayback(current().id,lease).catch(e=>{stopLocal('audio-error',e.message);notify(e.message);}),
  'font-up':()=>changeFont(10),'font-down':()=>changeFont(-10),'explanation-toggle':()=>toggleExplanation(n,target),
  highlight:()=>{if(!writable())return;const letter=document.querySelector('.paragraph.spot')?.dataset.paragraph;if(!letter)return;a.highlighted=a.highlighted.includes(letter)?a.highlighted.filter(x=>x!==letter):[...a.highlighted,letter];persist();document.querySelector(`#paragraph-${letter}`).classList.toggle('highlighted',a.highlighted.includes(letter));},
  'result-attempt':()=>loadResult(target.dataset.attempt),'check-network':async()=>{try{await request('/state');networkFailed=false;render();notify('Đã kết nối. Nhấn Tiếp tục để làm bài.');}catch(e){notify(e.message);}},
  'teacher-logout':teacherLogout,
  'teacher-result':()=>{location.hash=`submission=${target.dataset.submission}`;},
  'retry-save':()=>{saveError=false;if(persist(false))render();}
 };
 actions[target.dataset.action]?.();document.querySelector('.homework-options[open]')?.removeAttribute('open');
});
function writable(){return route==='exercise'&&current()?.status==='running'&&current()?.owner===TAB&&!saveError&&!busy;}
document.addEventListener('click',event=>{const p=event.target.closest('[data-paragraph]');if(p)document.querySelectorAll('.paragraph').forEach(el=>el.classList.toggle('spot',el===p));});
document.addEventListener('change',event=>{
 const input=event.target;
 if(input.id==='class-select'&&sharedEntry){selectSharedClass(input.value);return;}
 if(input.id==='class-select'){const select=document.querySelector('#student-select');select.disabled=!input.value;select.value='';document.querySelector('#login-submit').disabled=true;}
 if(input.id==='student-select')document.querySelector('#login-submit').disabled=!input.value;
 if(input.dataset.answer&&input.type!=='text')saveAnswer(input);
});
document.addEventListener('input',event=>{const input=event.target;if(input.dataset.answer&&input.type==='text')saveAnswer(input);if(input.id==='notes'&&writable()){current().notes=input.value;consumeTime();persist();}});
document.addEventListener('focusin',event=>{const n=event.target.dataset?.answer;if(n&&writable()){current().activeQuestion=+n;persist();updateProgress();}});
document.addEventListener('scroll',event=>{if(['passage-scroll','question-scroll'].includes(event.target.id))rememberScroll();},true);
function saveAnswer(input){if(!writable())return;current().answers[input.dataset.answer]=input.value;consumeTime();persist();savedStatus('Đã giữ trên thiết bị · đang lưu');updateProgress();}
document.addEventListener('submit',async event=>{
 if(event.target.id!=='login-form')return;event.preventDefault();const button=document.querySelector('#login-submit');button.disabled=true;
 try{const id=document.querySelector('#student-select').value,classCode=document.querySelector('#class-select').value;
  await loginSelected(id,classCode,{remember:document.querySelector('#remember-student').checked});
 }catch(e){const error=document.querySelector('#login-error');if(error)error.textContent=e.message;else notify(e.message);}finally{button.disabled=false;}
});
function recoverLocal(){
 const a=current();try{pendingOperation=JSON.parse(sessionStorage.getItem(`listening-operation:${identity.bindingId}`)||'null');}catch{pendingOperation=null;}if(!a||!['running','paused'].includes(a.status))return;
 try{const local=JSON.parse(localStorage.getItem(cacheKey()));
  if(local?.attemptId===a.id&&local.lease?.id===a.leaseId&&local.snapshot.sequence>=a.sequence){Object.assign(a,local.snapshot);a.remainingMs=Math.min(a.remainingMs,local.remainingMs);lease=local.lease;activeMs=local.snapshot.activeMs;pendingOperation=pendingOperation||local.pendingOperation||null;}
  else{lease=null;activeMs=0;}
  a.status='paused';a.owner=null;
 }catch{saveError=true;showStorageError();}
}
window.addEventListener('hashchange',()=>{window.ListeningReview?.reset();if(location.pathname.endsWith('/teacher.html')){route='teacher';teacherScreen();}else render();});
window.addEventListener('offline',()=>pause('offline'));
window.addEventListener('online',()=>{networkFailed=false;if(route==='resume')render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('hidden');});
window.addEventListener('pagehide',()=>pause('closed',false));
window.addEventListener('beforeunload',()=>pause('closed',false));
window.addEventListener('storage',event=>{
 if(['listening-teacher-logout','izone:teacher-sso-logout'].includes(event.key)&&location.pathname.endsWith('/teacher.html')){
  teacherResultGeneration++;clearListeningAudioMemory();
  try{sessionStorage.removeItem('listening-teacher-token');}catch{}
  window.ListeningReview?.reset();resultCache.clear();db={students:{}};identity=null;app.replaceChildren();teacherScreen();return;
 }

 if(event.key!==checkpointKey||!event.newValue||!current())return;
 try{const fresh=JSON.parse(event.newValue);if(fresh.attemptId!==current().id||fresh.lease?.id!==lease?.id){stopAudio();setActivating(false);lastTick=0;current().status='paused';current().pauseReason='conflict';lease=null;navigate('resume');}}catch{}
});
modal.addEventListener('cancel',()=>modalAction=null);
window.ReadingInteractionBridge={current,questionIds:()=>LESSON.questionIds,scope:()=>`${identity?.bindingId}:${current()?.id||''}`,writable,
 save:()=>{if(!writable())return false;consumeTime();return persist();},showPane:setMobilePane,
 closeGeneralNotes:()=>{const panel=document.querySelector('#notes-panel');if(panel)panel.hidden=true;if(current())current().notesOpen=false;}};
window.dispatchEvent(new Event('reading-interaction-ready'));
setInterval(tick,250);
async function bootstrap(){
 app.innerHTML='<section class="card card-pad"><h1>Đang mở bài Listening…</h1><p>Kiểm tra link bài tập và bản lưu gần nhất.</p></section>';
 try{
  if(location.pathname.endsWith('/teacher.html')){ready=true;route='teacher';await teacherScreen();return;}
  const entry=new URLSearchParams(location.hash.split('?')[1]).get('entry');
  if(entry){try{sessionStorage.setItem(ENTRY,entry);}catch{}history.replaceState(history.state,'',location.pathname+location.search+'#login');}
  try{entryToken=entry||sessionStorage.getItem(ENTRY)||'';sessionToken=courseIdentity.canRestoreSession()?sessionStorage.getItem(SESSION)||'':'';}catch{entryToken=entry||'';sessionToken='';}
  sharedEntry=!entryToken&&!entryQuery.has('documentId');
  // Hai bước chỉ đọc chạy song song; vẫn kiểm phiên và link trước khi hiện bài.
  const [savedState,openedEntry]=await Promise.allSettled([
   sessionToken?request('/state'):Promise.resolve(null),
   entryToken?request('/open',{entryToken}):Promise.resolve(null)
  ]);
  if(sessionToken){try{if(savedState.status==='rejected')throw savedState.reason;apply(savedState.value);recoverLocal();}catch(e){if(e.code==='UNAUTHORIZED'){sessionToken='';sessionStorage.removeItem(SESSION);}else throw e;}}
  if(entryToken){if(openedEntry.status==='rejected')throw openedEntry.reason;entryInfo=openedEntry.value;STUDENTS=entryInfo.students;setAuthoredLesson(entryInfo.lesson);
   if(sessionToken&&identity.bindingId!==entryInfo.bindingId){sessionToken='';studentId='';identity=null;sessionStorage.removeItem(SESSION);}}
  if(sharedEntry){
   if(sessionToken&&identity?.entryMode!=='shared'){sessionToken='';studentId='';identity=null;sessionStorage.removeItem(SESSION);}
   let catalog;
   try{catalog=await request(`/library/${encodeURIComponent(requestedLesson)}`);}catch(e){if(e.code!=='LESSON_NOT_OPEN'||!sessionToken)throw e;}
   if(catalog){CLASSES=catalog.classes;entryInfo=catalog;setAuthoredLesson(catalog.lesson);}
   let memory={};try{memory=JSON.parse(localStorage.getItem(MEMORY))||{};}catch{}
   selectedClassId=CLASSES.find(c=>c.classCode===(identity?.classCode||(courseIdentity.read().status==='ok'?'':memory.classCode)))?.id||'';
   if(selectedClassId){const roster=await request(`/library/${encodeURIComponent(requestedLesson)}/classes/${encodeURIComponent(selectedClassId)}`);STUDENTS=roster.students;}
  }
  if(!sharedEntry&&!sessionToken&&!entryToken)throw new Error('Hãy mở bài bằng nút CTA trong bản Homework của bạn.');
  ready=true;
  if(sessionToken){courseIdentity.pin(identity.studentRef);navigate(['running','paused'].includes(current()?.status)?'resume':'prep');}
  else{let automatic=false;try{automatic=await autoLoginRemembered();}catch(e){notify(e.message);}if(!automatic)navigate('login');}
 }catch(e){app.innerHTML=`<section class="card card-pad"><h1>Chưa mở được bài Listening</h1><p>${escape(e.message)}</p><p>Giữ nguyên link và thử tải lại khi kết nối ổn định.</p></section>`;}
}
bootstrap();

})();
