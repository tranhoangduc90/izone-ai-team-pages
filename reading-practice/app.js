(() => {
'use strict';
// Nhận bài từ API sau bắt đầu. Nháp giữ trên máy; điểm, lượt và thời gian do máy chủ xác nhận.
const CODE='67-practice-reading_matching_heading_mcq',FULL_TIME=1200000,TAB=crypto.randomUUID();
const app=document.querySelector('#app'),modal=document.querySelector('#modal');
const API=window.READING_CONFIG.apiBase.replace(/\/$/,'');
const MEMORY='reading-practice67-identity';
const docId=new URLSearchParams(location.search).get('documentId')||'entry';
const SESSION=`reading-practice67-session:${docId}`,ENTRY=`reading-practice67-entry:${docId}`;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,style='',extra='')=>`<button type="button" class="button ${style}" data-action="${action}" ${extra}>${label}</button>`;
const textBtn=(label,action,extra='')=>`<button type="button" class="text-button" data-action="${action}" ${extra}>${label}</button>`;
const dateLabel=date=>new Date(date).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
const timeLabel=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const normal=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const KEY=Object.fromEntries(Array.from({length:13},(_,i)=>[i+14,[]]));
let PASSAGE={},HEADINGS=[],MCQ=[],SUMMARY=[],STUDENTS=[],identity,entryInfo,entryToken='',sessionToken='';
let db={students:{}},studentId='',route='',routeParams=new URLSearchParams(),lastTick=0,lastSave=0;
let saveError=false,simulatedOffline=false,toastTimeout,modalAction=null,fontSize=17,lease=null,queue=Promise.resolve(),debounce,networkFailed=false,busy=false,ready=false;
let activeMs=0,leaseBaseline=0,lastPulse=0,checkpointKey='',pendingOperation=null,pulsePending=false,activating=false;
const resultCache=new Map();
const student=()=>({name:identity?.name});
const record=()=>db.students[studentId];
const current=()=>record()?.attempts.at(-1);
const countAnswered=a=>Object.values(a?.answers||{}).filter(v=>String(v).trim()).length;
const resultFor=(a,start,end)=>a.result.rows.filter(r=>r.number>=start&&r.number<=end&&r.state==='correct').length;
const isOnline=()=>navigator.onLine&&!networkFailed;
function notify(message){const t=document.querySelector('#toast');t.textContent=message;t.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.hidden=true,4000);}
function footer(){return '<footer class="page-footer">IZONE · Reading Homework · Buổi 7</footer>';}
function completionCopy(a){const first=record()?.firstCompleted;return a.no===1?'Hoàn thành ngay từ lần đầu.':first&&first!==a.no?`Kết quả lượt luyện lại số ${a.no} · Lần hoàn thành đầu tiên: lượt ${first}.`:`Hoàn thành sau ${a.no-1} lần reset · Kết quả của lần làm bài số ${a.no}.`;}
function identityBar(){return `<div class="identity-bar"><span><strong>${escape(identity?.name)}</strong> <span>· Lớp ${escape(identity?.classCode)}</span></span>${textBtn('Đổi người học','change-student')}</div>`;}
function cacheKey(){return `reading-practice67-draft:${identity?.bindingId}`;}
function snapshot(){const a=current();return{answers:a.answers,flags:a.flags,notes:a.notes,annotations:a.annotations,scroll:a.scroll,activeQuestion:a.activeQuestion,tab:a.tab,mobilePane:a.mobilePane||'passage',notesOpen:!!a.notesOpen,highlighted:a.highlighted,sequence:a.sequence,activeMs:Math.round(activeMs)};}
function persist(schedule=true){
 if(!current())return true;
 try{current().sequence++;localStorage.setItem(cacheKey(),JSON.stringify({attemptId:current().id,lease,snapshot:snapshot(),remainingMs:current().remainingMs,pendingOperation}));lastSave=performance.now();
  if(schedule&&route==='exercise'&&current().status==='running'){clearTimeout(debounce);debounce=setTimeout(()=>sendPulse(),500);}return true;
 }catch{saveError=true;lastTick=0;if(current())current().status='paused';showStorageError();return false;}
}
function showStorageError(){app.innerHTML=`<section class="notice-panel card card-pad"><h1>Chưa lưu được bài trên thiết bị</h1><p>Đồng hồ đã dừng. Giữ nguyên tab và cho phép trình duyệt lưu dữ liệu để bảo toàn phần vừa nhập.</p>${btn('Thử lưu lại','retry-save')}</section>`;}
function apply(response,{preserve=false}={}){
 identity=response.identity;studentId=identity.studentRef;checkpointKey=cacheKey();
 const local=current();db.students[studentId]={attempts:response.attempts,events:response.events,firstCompleted:response.firstCompleted};
 const a=current();if(preserve&&local&&a?.id===local.id&&a.status==='running'&&local.sequence>=a.sequence){Object.assign(a,snapshotFrom(local));a.remainingMs=Math.min(local.remainingMs,a.remainingMs);a.owner=TAB;}
 if(response.definition){({passage:PASSAGE,headings:HEADINGS,mcq:MCQ,summary:SUMMARY}=response.definition);}
 if(response.lease){lease=response.lease;activeMs=0;leaseBaseline=a.usedMs;a.owner=TAB;pendingOperation=null;}
 return a;
}
function snapshotFrom(a){return{answers:a.answers,flags:a.flags,notes:a.notes,annotations:a.annotations,scroll:a.scroll,activeQuestion:a.activeQuestion,tab:a.tab,mobilePane:a.mobilePane,notesOpen:a.notesOpen,highlighted:a.highlighted,sequence:a.sequence};}
async function request(path,body,teacher=false,keepalive=false){
 const token=teacher?sessionStorage.getItem('reading-teacher-token'):sessionToken;
 let response;try{response=await fetch(`${API}${path}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000),keepalive});}
 catch{networkFailed=true;throw Object.assign(new Error('Chưa kết nối được máy chủ. Bài đã tạm dừng; bản nháp được giữ trên thiết bị.'),{code:'NETWORK'});}
 const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error.message),{code:value.error.code});networkFailed=false;return value;
}
function serial(fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}
function consumeTime(){const a=current();if(!a||a.status!=='running'||a.owner!==TAB||!lastTick)return;const now=performance.now(),delta=now-lastTick;activeMs+=delta;a.remainingMs=Math.max(0,FULL_TIME-leaseBaseline-activeMs);lastTick=now;}
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
  }catch(e){stopLocal(e.code);notify(e.message);}
 }).finally(()=>pulsePending=false);
}
function savedStatus(text){const el=document.querySelector('.autosave-status');if(el)el.textContent=text;}
function stopLocal(reason){consumeTime();rememberScroll();lastTick=0;clearTimeout(debounce);if(current()){current().status='paused';current().pauseReason=reason;persist(false);}closeModal();if(!saveError)navigate('resume');}
function tick(){if(current()?.status!=='running'||route!=='exercise')return;if(document.hidden||!navigator.onLine){pause(document.hidden?'hidden':'offline');return;}consumeTime();updateProgress();if(performance.now()-lastSave>900)persist(false);if(current().remainingMs<=0){finish('timeout');return;}if(performance.now()-lastPulse>4500)sendPulse();}
async function perform(action,payload){
 if(busy||activating)return;busy=true;clearTimeout(debounce);
 const op=pendingOperation?.action===action?pendingOperation:{action,payload:{operationId:crypto.randomUUID(),...payload}};pendingOperation=op;
 try{sessionStorage.setItem(`reading-operation:${identity.bindingId}`,JSON.stringify(op));persist(false);
 await serial(async()=>{const response=await request(`/${action}`,op.payload);pendingOperation=null;sessionStorage.removeItem(`reading-operation:${identity.bindingId}`);apply(response);persist(false);lastPulse=performance.now();
  if(current()?.status==='submitted'){lastTick=0;await loadResult(current().no);}else if(response.lease){
   // Đề mở sau ACK tạo lượt. Gửi mốc kích hoạt cùng lúc mở đề, không chờ thêm ACK để chạy giờ.
   const id=current().id,proof=lease;current().status='running';lastTick=performance.now();activating=true;busy=false;navigate('exercise');
   try{const activated=await request('/activate',{attemptId:id,lease:proof});if(current()?.id===id&&lease?.id===proof.id&&current().status==='running'&&route==='exercise')apply(activated,{preserve:true});}finally{setActivating(false);}
  }else{lastTick=0;current().status='paused';lease=null;navigate('resume');}
 });}catch(e){stopLocal(e.code);notify(e.message);}finally{busy=false;}
}
function begin(){if(current()?.status==='submitted'){loadResult(current().no);return;}if(current())return resume();perform('begin',{owner:TAB});}
function resume(){
 if(!navigator.onLine){notify('Khôi phục kết nối trước khi tiếp tục.');return;}
 if(pendingOperation){perform(pendingOperation.action,pendingOperation.payload);return;}
 const a=current();if(!a)return begin();
 let recovery;
 try{const local=JSON.parse(localStorage.getItem(cacheKey()));if(local?.attemptId===a.id&&local.lease&&local.snapshot.sequence>=a.sequence)recovery={snapshot:local.snapshot,lease:local.lease};}catch{}
 perform('resume',{attemptId:a.id,owner:TAB,...(recovery?{recovery}:{})});
}
function pause(reason='manual',shouldRender=true){
 const a=current();if(!a||a.status!=='running'||a.owner!==TAB)return;
 consumeTime();rememberScroll();persist(false);const input={attemptId:a.id,lease,snapshot:snapshot()};
 a.status='paused';a.pauseReason=reason;lastTick=0;clearTimeout(debounce);closeModal();
 if(navigator.onLine)serial(async()=>{try{const response=await request('/pause',input,false,true);if(current()?.id===input.attemptId&&lease?.id===input.lease.id){apply(response,{preserve:true});persist(false);if(current().status==='submitted')await loadResult(current().no);}}catch(e){notify(e.message);}});
 if(shouldRender&&!saveError)navigate('resume');
}
function finish(method){if(busy||activating||!current()||!['running','paused'].includes(current().status))return;consumeTime();rememberScroll();lastTick=0;persist(false);perform('submit',{attemptId:current().id,lease,snapshot:snapshot(),method});}
function reset(){if(busy||activating)return;consumeTime();rememberScroll();lastTick=0;const a=current();perform('reset',{attemptId:a.id,owner:TAB,...(['running','paused'].includes(a.status)&&lease?{lease,snapshot:snapshot()}:{} )});}
async function loadResult(no){
 const a=record()?.attempts.find(a=>a.no===+no);if(!a)return;
 if(a.status==='submitted'&&!resultCache.has(a.id)){try{const response=await request(`/result/${a.id}`);resultCache.set(a.id,response);apply(response);MCQ=response.definition.mcq;}catch(e){notify(e.message);return;}}
 navigate(`result?attempt=${no}`);
}
function docsNotice(a){const e=record()?.events.findLast(e=>e.attempt===a.no&&e.type==='completed'),verified=e?.docs==='verified';return `<div class="note ${verified?'success':'warning'}">${verified?'✓ Đã cập nhật tình trạng trong tài liệu bài tập.':e?.docs==='blocked'?'Bài đã nộp. Chưa cập nhật được Docs; giảng viên cần kiểm tra ô trạng thái.':'Bài đã nộp và được lưu trên máy chủ. Đang cập nhật tình trạng trong Docs.'} <a href="${escape(identity.documentUrl)}" target="_blank" rel="noopener noreferrer">Mở tài liệu ↗</a></div>`;}
function docs(){app.innerHTML=hero('BUỔI 7 · READING HOMEWORK','The steam car','Cambridge IELTS 18 · Test 3 · Passage 2 · 13 câu · 20 phút')+`<section class="card card-pad"><h2>Làm bài thực chiến</h2><p>Chọn đúng lớp và tên trước khi bắt đầu. Bài đang làm được lưu để bạn tiếp tục bằng thời gian còn lại.</p>${btn('Mở bài Reading →','open-assignment')}${identity?`<p><a target="_blank" rel="noopener noreferrer" href="${escape(identity.documentUrl)}">Mở tài liệu bài tập ↗</a></p>`:''}</section>`+footer();}
function login(){
 const selected=(()=>{try{return JSON.parse(localStorage.getItem(MEMORY))?.studentId;}catch{return '';}})();
 app.innerHTML=`<div class="login-layout"><section><span class="kicker">BUỔI 7 · READING HOMEWORK</span><h1>The steam car</h1><p class="login-copy">Luyện trọn một passage trong 20 phút.<br>Đọc kỹ, chốt ý và chọn đáp án.</p><ul class="login-tasks"><li><span>01</span><div><strong>Chuẩn bị</strong><p>Nhắc nhanh cách làm Headings và MCQ.</p></div></li><li><span>02</span><div><strong>Làm bài</strong><p>13 câu · Tự lưu · Có thể tiếp tục lần đang làm.</p></div></li><li><span>03</span><div><strong>Xem kết quả</strong><p>Điểm, đáp án và số lần làm bài.</p></div></li></ul></section><section class="card login-card"><h2>Bạn học lớp nào?</h2><p class="muted">Chọn đúng lớp và tên trước khi bắt đầu.</p><form id="login-form"><label for="class-select">Lớp</label><select id="class-select" required><option value="">Chọn lớp của bạn</option><option value="${escape(entryInfo?.classCode)}" ${selected?'selected':''}>${escape(entryInfo?.classCode)}</option></select><label for="student-select">Học viên</label><select id="student-select" required ${selected?'':'disabled'}><option value="">Chọn tên của bạn</option>${STUDENTS.map(s=>`<option value="${escape(s.id)}" ${s.id===selected?'selected':''}>${escape(s.name)}</option>`).join('')}</select><label class="check-line"><input id="remember-student" type="checkbox" checked> Ghi nhớ tôi trên thiết bị này</label><p class="memory-help">Lần sau sẽ chọn sẵn lớp và tên của bạn.<br>Bỏ tick nếu bạn đang dùng thiết bị chung.</p><button class="button full" id="login-submit" ${selected?'':'disabled'}><span>Mở bài Reading</span><span>→</span></button><p class="form-error" role="status" id="login-error"></p></form></section></div>`;
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
}
async function teacherScreen(){
 const submissionId=new URLSearchParams(location.hash.slice(1)).get('submission')||routeParams.get('submission');
 if(!submissionId){app.innerHTML='<section class="card card-pad"><h1>Mở bài từ link kết quả</h1><p>Giảng viên mở link trong tài liệu homework của học viên.</p></section>';return;}
 try{const response=await request(`/teacher/result/${encodeURIComponent(submissionId)}`,undefined,true);apply(response);resultCache.set(response.attempt.id,response);MCQ=response.definition.mcq;
  const a=response.attempt;app.innerHTML='<div class="teacher-banner">Giảng viên xem bài · Chỉ xem</div>'+hero('BUỔI 7 · KẾT QUẢ READING','The steam car',`${escape(identity.name)} · ${escape(identity.classCode)} · Lần làm ${a.no}`)+`<section class="card card-pad"><h2>${a.finalScore}/13 câu đúng</h2><p>${completionCopy(a)}</p><p>Bắt đầu: ${dateLabel(a.startedAt)} · Nộp bài: ${dateLabel(a.completedAt)}</p><p>${a.method==='timeout'?'Hệ thống thu bài khi hết giờ':'Học viên chủ động nộp bài'} · ${a.no-1} lần reset trước lượt này</p></section>`+teacherHistory(response,a)+resultTable(a)+`<section class="card card-pad"><h3>Ghi chú học viên</h3><p style="white-space:pre-wrap">${escape(a.notes||'Chưa có ghi chú.')}</p></section>`+footer();
 }catch(e){if(e.code!=='TEACHER_LOGIN_REQUIRED'){app.innerHTML=`<section class="card card-pad"><h1>Chưa mở được kết quả</h1><p>${escape(e.message)}</p></section>`;return;}
  app.innerHTML=hero('BUỔI 7 · GIẢNG VIÊN','Đăng nhập để xem kết quả','Dùng tài khoản Google đã có quyền lớp.')+'<section class="card card-pad"><div id="google-signin"></div><p id="teacher-error" role="status"></p></section>';
  const config=await request('/config');if(!config.googleClientId){document.querySelector('#teacher-error').textContent='Chưa cấu hình đăng nhập Google.';return;}
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=()=>{google.accounts.id.initialize({client_id:config.googleClientId,callback:async response=>{try{const result=await request('/teacher/login',{credential:response.credential},true);sessionStorage.setItem('reading-teacher-token',result.token);teacherScreen();}catch(e){document.querySelector('#teacher-error').textContent=e.message;}}});google.accounts.id.renderButton(document.querySelector('#google-signin'),{theme:'outline',size:'large',text:'signin_with'});};document.head.append(script);
 }
}
function teacherHistory(response,selected){
 return '<section class="section"><h2>Lịch sử làm bài</h2><p class="small muted">Lần hoàn thành đầu tiên: '+(response.firstCompleted||'Chưa có')+'</p><div class="history">'+response.attempts.map(a=>a.status==='submitted'?`<button type="button" data-action="teacher-result" data-submission="${a.submissionId}" class="${a.id===selected.id?'selected':''}">Lần ${a.no}<span>${a.finalScore}/13 · Đã nộp</span></button>`:`<details class="card card-pad"><summary>Lần ${a.no} · ${a.status==='reset'?'Đã reset':'Chưa nộp'} · ${countAnswered(a)}/13 đã nhập</summary><p>Bắt đầu: ${dateLabel(a.startedAt)} · Còn ${timeLabel(a.remainingMs)}</p><div class="table-wrap"><table><thead><tr><th>Câu</th><th>Bài làm đã lưu</th></tr></thead><tbody>${Object.keys(KEY).map(n=>`<tr><td>${n}</td><td>${escape(a.answers[n]||'—')}</td></tr>`).join('')}</tbody></table></div><p style="white-space:pre-wrap">${escape(a.notes||'Chưa có ghi chú.')}</p></details>`).join('')+'</div></section>';
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
  }

function requestReset() {
    const n=current()?.no;
    openModal('Làm lại từ đầu?',`<p>Bạn sẽ bắt đầu <strong>lần làm bài số ${n+1}</strong> với đủ 20 phút. Đáp án lần hiện tại sẽ không chuyển sang lần mới.</p><p>Lịch sử lần ${n} vẫn được giữ. Kết quả và tài liệu bài tập sẽ ghi rõ số lần reset.</p>`,'Reset và bắt đầu lại',reset,'red');
  }

function requestSubmit() {
    const blank=13-countAnswered(current());
    openModal('Nộp bài Reading?',`<p>Bạn đã trả lời <strong>${13-blank}/13 câu</strong>${blank?` và còn <strong>${blank} câu trống</strong>`:''}.</p><p>Sau khi nộp, bạn có thể xem điểm, đáp án và bằng chứng. Muốn làm tiếp một lượt mới, hãy dùng Reset.</p>`,'Nộp bài',()=>finish('manual'));
  }

function hero(kicker,title,copy) { return `<section class="hero"><div><span class="kicker">${kicker}</span><h1>${title}</h1><p class="hero-copy">${copy}</p></div><span class="lesson-index" aria-hidden="true">07</span></section>`; }

function prep() {
    const a=current();
    app.innerHTML=hero('BUỔI 7 · CHUẨN BỊ LÀM BÀI','The steam car','Dành 20 phút tập trung cho một passage. Nhớ lại cách làm trước khi bắt đầu.')+identityBar()+`<div class="meta-row section"><span><strong>Cam 18 · Test 3 · Passage 2</strong></span><span>13 câu · 14–26</span><span>20 phút</span></div><section class="card"><div class="section-heading"><h2><span class="step-number">01</span>Nhắc nhanh phương pháp</h2><span class="pill">Đọc trong 30 giây</span></div><div class="method-grid"><section><h3>Matching Headings</h3><ul><li><strong>Đọc đoạn trước</strong>, chưa nhìn headings.</li><li>Nén từng câu → nối mạch → chốt <strong>ý bao trùm</strong>.</li><li>Mới đối chiếu heading; tránh ý chỉ đúng một chi tiết.</li></ul></section><section><h3>Multiple Choice</h3><ul><li><strong>Đọc câu hỏi, định vị</strong>; chưa nhìn A–D.</li><li>Tự nén ý: hỏi chi tiết giữ chi tiết, hỏi ý chính tìm mạch.</li><li>Mới mở A–D, chọn ý khớp; không bám từ giống nhau.</li></ul></section></div></section><div class="prep-bottom"><section><h3>Trước khi bắt đầu</h3><p class="muted">Đáp án được lưu khi bạn thao tác. Nếu đóng bài, chuyển sang tab khác hoặc mất mạng, đồng hồ dừng; khi quay lại, bạn dùng tiếp thời gian còn lại.</p><p class="small muted">Summary Completion: điền <strong>ONE WORD AND/OR A NUMBER</strong> từ passage, rồi kiểm giới hạn từ và ngữ pháp.</p><p class="small muted">Reset tạo một lần làm bài mới. Kết quả và trạng thái nộp bài sẽ ghi rõ số lần làm.</p></section><section class="start-panel"><span class="kicker">${a?.status==='submitted'?'BẠN ĐÃ CÓ KẾT QUẢ':'SẴN SÀNG LÀM BÀI'}</span><h3>${a?.status==='submitted'?`Lần ${a.no} · ${a.finalScore}/13 câu đúng`:'20 phút · 13 câu'}</h3><p class="small muted">${a?.status==='submitted'?'Bạn có thể xem lại kết quả hoặc reset để thử một lượt mới.':'Khi nhấn bắt đầu, tài liệu bài tập sẽ ghi nhận lần làm đầu tiên.'}</p>${a?.status==='submitted'?btn('Xem kết quả →','show-result')+textBtn('Reset và làm lại từ đầu','request-reset'):btn('Bắt đầu làm bài →','begin')}</section></div>`+footer();
  }

function resumeScreen() {
    const a=current(); if(!a) { navigate('prep'); return; }
    const offline=!isOnline(), conflict=a.pauseReason==='conflict';
    app.innerHTML=hero('BUỔI 7 · TIẾP TỤC BÀI READING',offline?'Bài đang tạm dừng':conflict?'Bài vừa được mở ở tab khác':'Bạn còn thời gian để làm tiếp',offline?'Đáp án đã được giữ trên thiết bị. Khôi phục kết nối rồi tiếp tục đúng chỗ đang dừng.':'Thời gian không trôi khi bạn rời màn làm bài. Tiếp tục lần hiện tại hoặc reset để bắt đầu lại.')+identityBar()+`<section class="card resume-card"><div><span class="kicker">LẦN LÀM BÀI SỐ ${a.no}</span><div class="remaining-big">${timeLabel(a.remainingMs)}</div><p class="muted">Thời gian còn lại</p><div class="resume-stats"><div><strong>${countAnswered(a)}/13</strong><span>Đã trả lời</span></div><div><strong>${a.flags.length}</strong><span>Câu đánh dấu</span></div><div><strong>${a.no-1}</strong><span>Lần reset</span></div></div><span class="pill good">✓ Đã giữ bản nháp</span></div><div><h2>${offline?'Kết nối đang tạm ngắt':'Sẵn sàng tiếp tục?'}</h2><p class="muted">${conflict?'Tiếp tục tại đây sẽ chuyển quyền làm bài về tab này. Tab kia sẽ tạm dừng.':'Bạn sẽ quay lại phần câu hỏi đã mở, với toàn bộ đáp án và ghi chú.'}</p>${offline?`<div class="note warning">Đồng hồ đã dừng. Trong lúc mất mạng, vùng đề và câu hỏi được đóng lại.</div>${btn('Kiểm tra kết nối','check-network','outline')}`:btn(`Tiếp tục lần ${a.no} →`,'resume','full')}<div style="margin-top:16px">${textBtn('Reset và làm lại từ đầu','request-reset',offline?'disabled':'')}</div></div></section>`+footer();
  }

function exercise() {
    const a=current(); if(!a || a.status!=='running' || a.owner!==TAB || !lease || lease.id!==a.leaseId) { navigate(a?.status==='submitted'?`result?attempt=${a.no}`:'resume'); return; }
    app.innerHTML=`<header class="topbar"><a class="design-brand" href="#docs">IZONE</a><h1>Reading Homework · Buổi 7</h1><details class="identity-options homework-options"><summary><span class="homework-student">${escape(student()?.name)} · </span>Lần ${a.no}</summary><div class="identity-options-body"><p>${escape(student()?.name)} · Lớp ${escape(identity?.classCode)}</p>${textBtn('Tạm dừng','pause')}${textBtn('Reset bài','request-reset')}${textBtn('Tô đoạn đang chọn','highlight')}<a href="#docs">Xem tài liệu bài tập ↗</a></div></details></header>
    <div class="page-shell"><section id="readingView" class="panel test-panel cbt-test-form" data-design-pane="${a.mobilePane||'passage'}" aria-label="Bài Reading"><div class="cbt-semantic-stage questions-grid"><div class="cbt-semantic-pane"><div class="cbt-toolbar"><div class="cbt-test-heading"><div><h2>Reading - 13 câu</h2></div><div class="cbt-toolbar-controls"><nav class="cbt-part-nav" aria-label="Passage"><button type="button" class="cbt-part-button is-active" data-action="jump" data-question="14">Passage 2 · Q14–26</button></nav><div class="cbt-text-size"><button type="button" class="cbt-tool-button" data-action="font-down" aria-label="Giảm cỡ chữ">A−</button><strong id="font-percent">${Math.round(fontSize/17*100)}%</strong><button type="button" class="cbt-tool-button" data-action="font-up" aria-label="Tăng cỡ chữ">A+</button></div><button type="button" class="cbt-tool-button" data-action="notes">Notes</button></div><div class="cbt-heading-actions"><div id="timer" class="cbt-reading-clock">Còn <strong>${timeLabel(a.remainingMs)}</strong><span>/ 20 phút</span></div><span class="answer-count" id="answered-progress"></span><span class="autosave-status" data-status="saved">Đã lưu trên thiết bị</span><button type="button" class="button button-primary cbt-heading-submit" data-action="request-submit">Nộp bài Reading</button></div></div><nav class="reading-view-switch" aria-label="Vùng Reading"><button type="button" data-action="mobile-pane" data-pane="passage" aria-pressed="${(a.mobilePane||'passage')==='passage'}">Bài đọc</button><button type="button" data-action="mobile-pane" data-pane="questions" aria-pressed="${a.mobilePane==='questions'}">Câu hỏi</button></nav></div><div class="cbt-content-viewport" data-font-size="${Math.round(fontSize/17*100)}"><section class="cbt-reading-section"><article class="cbt-reading-passage" id="passage-scroll" aria-label="Bài đọc"><header class="cbt-passage-header"><span>PASSAGE 2</span><h3>The steam car</h3></header><div class="cbt-passage-body"><p class="passage-subtitle">The successes and failures of the Doble brothers and their steam cars</p>${Object.entries(PASSAGE).map(([letter,text])=>`<div id="paragraph-${letter}" class="cbt-passage-paragraph paragraph ${a.highlighted.includes(letter)?'highlighted':''}" data-paragraph="${letter}"><span class="cbt-paragraph-label">${letter}</span><p>${escape(text)}</p></div>`).join('')}</div></article><article class="cbt-reading-questions" id="question-scroll" aria-label="Câu hỏi"></article></section></div></div></div><div class="cbt-question-nav-wrap"><div class="cbt-review-bar"><span id="review-count"></span><button type="button" class="cbt-review-open" data-action="review">Rà soát bài</button></div><nav class="cbt-question-nav" aria-label="Đi đến câu hỏi">${Object.keys(KEY).map(n=>`<button type="button" class="cbt-question-button" data-action="jump" data-question="${n}" aria-label="Câu ${n}">${n}</button>`).join('')}</nav><p class="cbt-nav-legend">Navy đậm: đang chọn · Navy nhạt: đã trả lời · Gạch vàng: cần xem lại</p><aside id="review-panel" class="cbt-review-panel" hidden></aside></div></section></div><aside class="cbt-note-panel" id="notes-panel" hidden><header><strong>Ghi chú cá nhân</strong><button type="button" class="cbt-review-close" data-action="notes" aria-label="Đóng ghi chú">×</button></header><div class="homework-notes"><label for="notes">Tự lưu cùng lần làm bài</label><textarea id="notes" placeholder="Nén ý, từ khóa hoặc điểm cần kiểm lại…">${escape(a.notes)}</textarea></div></aside><footer class="reading-demo-footer">IZONE · Reading Homework · Buổi 7</footer>`;
    renderQuestions(); updateProgress(); setActivating(activating);
    document.querySelector('#passage-scroll').scrollTop=a.scroll?.passage || 0;
    document.querySelector('#notes-panel').hidden=!a.notesOpen;
  }

function flag(n) { return `<button type="button" class="cbt-flag-button flag ${current().flags.includes(+n)?'is-flagged':''}" data-action="flag" data-question="${n}" aria-label="Đánh dấu câu ${n}" aria-pressed="${current().flags.includes(+n)}">⚑</button>`; }

function renderQuestions() {
    const a=current(), pane=document.querySelector('#question-scroll'); if (!pane) return;
    const group=(title,instruction,content)=>`<section class="design-question-group"><header class="cbt-subsection-heading"><h4>${title}</h4>${instruction}</header><div class="design-question-content">${content}</div></section>`;
    const headings=`<div class="cbt-matching-layout cbt-answer-first-matching-layout"><section class="cbt-matching-questions"><h4>Paragraphs</h4>${Object.keys(PASSAGE).map((letter,i)=>{const n=14+i;return `<div id="q-${n}"><label for="answer-${n}">Paragraph ${letter}</label><span class="cbt-select-answer" data-question-number="${n}"><span class="cbt-blank-number">${n}</span><span data-answer-slot><select class="cbt-answer-select" id="answer-${n}" data-answer="${n}" aria-label="Câu ${n} Paragraph ${letter}"><option value="">Nhấn để chọn</option>${HEADINGS.map(([roman])=>`<option value="${roman}" ${a.answers[n]===roman?'selected':''}>${roman}</option>`).join('')}</select></span>${flag(n)}</span></div>`;}).join('')}</section><aside class="cbt-option-bank"><h4>List of Headings</h4>${HEADINGS.map(([n,text])=>`<div><strong>${n}</strong><span>${escape(text)}</span></div>`).join('')}</aside></div>`;
    const mcq=MCQ.map(q=>`<article class="cbt-question-card" id="q-${q.n}" data-question-number="${q.n}" role="group" aria-labelledby="stem-${q.n}"><div class="cbt-question-heading"><span class="cbt-question-number">${q.n}</span><p id="stem-${q.n}">${escape(q.text)}</p>${flag(q.n)}</div><div class="cbt-choice-list">${q.options.map((text,i)=>{const letter='ABCD'[i];return `<label class="cbt-choice"><input type="radio" name="answer-${q.n}" value="${letter}" data-answer="${q.n}" ${a.answers[q.n]===letter?'checked':''}><span class="cbt-choice-letter">${letter}</span><span>${escape(text)}</span></label>`;}).join('')}</div></article>`).join('');
    const input=n=>`<span class="cbt-inline-answer" id="q-${n}" data-question-number="${n}"><span class="cbt-blank-number">${n}</span><span data-answer-slot><input type="text" class="cbt-answer-input" id="answer-${n}" data-answer="${n}" value="${escape(a.answers[n] || '')}" placeholder="Nhập đáp án" aria-label="Câu ${n}" autocomplete="off" spellcheck="false" maxlength="80"></span>${flag(n)}</span>`;
    const summary='<section class="cbt-notes-card"><h4>The Model E</h4><div class="cbt-summary-text"><p>'+SUMMARY.map(s=>s.question?input(s.question):escape(s.text).replace(/\n\n/g,'</p><p>')).join('')+'</p></div></section>';
    pane.innerHTML=`<header class="cbt-section-intro"><p class="cbt-kicker">QUESTIONS 14–26</p><h3>Reading Passage 2</h3></header>`+
      group('Questions 14–20','<p>Reading Passage 2 has seven paragraphs, A–G.</p><p>Choose the correct heading for each paragraph from the list below.</p><p>Write the correct number, <strong>i–viii</strong>, in boxes 14–20.</p>',headings)+
      group('Questions 21–23','<p>Choose the correct letter, <strong>A, B, C or D</strong>.</p><p>Write the correct letter in boxes 21–23.</p>',mcq)+
      group('Questions 24–26','<p>Complete the summary below.</p><p>Choose <strong>ONE WORD AND/OR A NUMBER</strong> from the passage for each answer.</p><p>Write your answers in boxes 24–26.</p>',summary);
    pane.scrollTop=a.scroll?.questions.all || 0;
    window.ReadingAnnotations?.install();
  }

function updateProgress() {
    const a=current(); if(!a) return;
    const timer=document.querySelector('#timer');
    if(timer) { timer.querySelector('strong').textContent=timeLabel(a.remainingMs); timer.classList.toggle('is-warning',a.remainingMs<60000); }
    const progress=document.querySelector('#answered-progress'); if(progress) progress.textContent=`${countAnswered(a)}/13 đã nhập`;
    const reviewCount=document.querySelector('#review-count'); if(reviewCount)reviewCount.textContent=`${13-countAnswered(a)} chưa làm · ${a.flags.length} đã đánh dấu`;
    document.querySelectorAll('.cbt-question-button').forEach(b=>{
      const n=+b.dataset.question;
      b.classList.toggle('is-answered',!!normal(a.answers[n])); b.classList.toggle('is-flagged',a.flags.includes(n)); b.classList.toggle('is-active',a.activeQuestion===n);
      b.setAttribute('aria-current',a.activeQuestion===n?'true':'false');
      b.setAttribute('aria-label',`Câu ${n}${normal(a.answers[n])?', đã trả lời':', chưa trả lời'}${a.flags.includes(n)?', đã đánh dấu':''}`);
    });
    document.querySelectorAll('[data-question-number]').forEach(el=>{const n=+el.dataset.questionNumber;el.classList.toggle('is-answered',!!normal(a.answers[n]));el.classList.toggle('is-active',a.activeQuestion===n);el.classList.toggle('is-flagged',a.flags.includes(n));});
    document.querySelectorAll('.cbt-flag-button').forEach(el=>{const selected=a.flags.includes(+el.dataset.question);el.classList.toggle('is-flagged',selected);el.setAttribute('aria-pressed',String(selected));});
  }

function switchTab(tab) { jump(tab==='headings'?14:tab==='mcq'?21:24); }

function jump(n) {
    const a=current(); a.activeQuestion=n; a.tab=n<21?'headings':n<24?'mcq':'summary';
    if(matchMedia('(max-width:980px)').matches)setMobilePane('questions');
    const el=document.querySelector(`#q-${n}`), scroll=document.querySelector('#question-scroll');
    if(el&&scroll)scroll.scrollTo({top:el.getBoundingClientRect().top-scroll.getBoundingClientRect().top+scroll.scrollTop-16,behavior:'auto'});
    document.querySelector(`[data-answer="${n}"]`)?.focus({preventScroll:true});
    if(n<=20) spotParagraph('ABCDEFG'[n-14]);
    rememberScroll();persist(); updateProgress();
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
    panel.innerHTML=`<header><strong>Rà soát bài · ${countAnswered(a)}/13 đã nhập</strong><button type="button" class="cbt-review-close" data-action="close-review" aria-label="Đóng rà soát">×</button></header><nav class="cbt-review-filters">${[['all','Tất cả'],['blank','Chưa trả lời'],['flagged','Đã đánh dấu']].map(([key,label])=>`<button type="button" class="cbt-review-filter ${filter===key?'is-active':''}" data-action="review-filter" data-filter="${key}">${label}</button>`).join('')}</nav><div class="cbt-review-grid">${rows.map(n=>`<button type="button" data-action="review-jump" data-question="${n}" class="cbt-review-question ${normal(a.answers[n])?'is-answered':''} ${a.flags.includes(+n)?'is-flagged':''}" aria-label="Câu ${n}">${n}</button>`).join('')}</div>${rows.length?'':'<p class="cbt-review-empty">Không có câu nào trong nhóm này.</p>'}`;panel.hidden=false;
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
    return `<article class="explanation-question evidence" data-explanation-question="${n}" aria-label="Giải thích câu ${n}">${e.prompt?`<div class="explanation-prompt">${explanationRuns(e.prompt.runs)}</div>`:''}<div class="explanation-body"><section class="explanation-analysis">${analysis}</section><aside class="explanation-evidence"><h4>Bằng chứng · Đoạn ${e.paragraph}</h4><blockquote>${explanationParagraphs(evidence)}</blockquote><p class="explanation-evidence-hint">Từ cùng màu liên kết ý trong câu hỏi với bằng chứng; chữ đỏ giữ phần đối chiếu trong tài liệu.</p></aside></div></article>`;
  }

function toggleExplanation(number,button) {
    const row=document.getElementById(`explanation-${number}`);
    if(!row)return;
    row.hidden=!row.hidden;
    button.setAttribute('aria-expanded',String(!row.hidden));
    button.textContent=row.hidden?'Xem giải thích':'Ẩn giải thích';
  }

function resultTable(a) {
    const data=resultCache.get(a.id)?.explanations;
    return `<section class="card section answer-explanations" aria-labelledby="explanations-title"><div class="section-heading"><h2 id="explanations-title">Đáp án và giải thích</h2><span class="pill">13 câu</span></div><div class="table-wrap detail-table-wrap"><table class="result-table detail-table"><thead><tr><th scope="col">Câu</th><th scope="col">Bài làm</th><th scope="col">Đáp án đúng</th><th scope="col">Kết quả</th><th scope="col">Giải thích</th></tr></thead><tbody>${Object.keys(KEY).map(n=>{
      const row=a.result.rows.find(r=>r.number===+n),correct=row.state==='correct',blank=row.state==='blank';
      const state=correct?'correct':blank?'blank':'incorrect';
      const answers=resultCache.get(a.id).key[n];const key=n>=21&&n<=23?answers[0].toUpperCase():answers.join(' / ');
      return `<tr class="detail-row detail-row-${state}" data-result-question="${n}"><td>${String(n).padStart(2,'0')}.</td><td data-label="Bài làm">${escape(a.answers[n]||'—')}</td><td data-label="Đáp án đúng">${key}</td><td class="${correct?'mark-good':blank?'muted':'mark-bad'}"><span class="detail-result-cell result-${state}"><span class="detail-result-icon" aria-hidden="true">${correct?'✓':blank?'–':'✕'}</span>${correct?'Đúng':blank?'Bỏ trống':'Sai'}</span></td><td><button type="button" class="explanation-button" data-action="explanation-toggle" data-question="${n}" aria-expanded="false" aria-controls="explanation-${n}">Xem giải thích</button></td></tr><tr class="inline-explanation-row" id="explanation-${n}" hidden><td colspan="5">${explanationContent(data?.entries?.[n])}</td></tr>`;
    }).join('')}</tbody></table></div>${data?.source?.url?`<div class="explanation-source"><a href="${escape(data.source.url)}" target="_blank" rel="noopener noreferrer">Tài liệu giải thích ↗</a></div>`:''}</section>`;
  }

function attemptHistory(rec,selected,teacher=false,id=studentId) {
    return `<div class="history">${rec.attempts.map(a=>`<button type="button" data-action="${teacher?'teacher-attempt':'result-attempt'}" data-student="${id}" data-attempt="${a.no}" class="${a.no===selected?'selected':''}">Lần ${a.no}<span>${a.status==='submitted'?`${a.finalScore}/13 · Đã nộp`:a.status==='reset'?'Đã reset':`Đang làm · ${countAnswered(a)}/13`}</span></button>`).join('')}</div>`;
  }

function resultScreen() {
    const rec=record(); const a=rec?.attempts.find(a=>a.no===+(routeParams.get('attempt') || current()?.no));
    if(!a) { navigate('prep'); return; }
    const submitted=a.status==='submitted';
    app.innerHTML=hero(submitted?'BUỔI 7 · KẾT QUẢ READING':'BUỔI 7 · LỊCH SỬ LÀM BÀI',submitted?'Bạn đã hoàn thành passage':`Lần ${a.no} đã ${a.status==='reset'?'reset':'tạm dừng'}`,submitted?completionCopy(a):'Bài này chưa được nộp. Đáp án đúng chỉ mở sau khi hoàn thành.')+identityBar()+`<div class="meta-row section"><span>Lần làm bài <strong>${a.no}</strong></span><span>${submitted?(a.method==='timeout'?'Hệ thống thu bài khi hết giờ':'Bạn chủ động nộp bài'):'Chưa nộp bài'}</span><span>Đã làm <strong>${timeLabel(FULL_TIME-a.remainingMs)}</strong></span></div>${submitted?`<section class="result-summary"><div class="score-box"><strong>${a.finalScore}<span>/13</span></strong><small>Số câu trả lời đúng<br>Điểm của riêng passage này</small></div><div class="score-details"><h2>The steam car</h2><p class="small muted">Cambridge 18 · Test 3 · Passage 2 · Câu 14–26</p><div class="type-scores"><div><strong>${resultFor(a,14,20)}/7</strong><span>Matching Headings</span></div><div><strong>${resultFor(a,21,23)}/3</strong><span>Multiple Choice</span></div><div><strong>${resultFor(a,24,26)}/3</strong><span>Summary Completion</span></div></div></div></section>${docsNotice(a)}`:`<div class="note">${countAnswered(a)}/13 câu đã trả lời. ${a.status==='reset'?'Lần này được lưu trong lịch sử nhưng không có điểm hoàn thành.':'Bạn có thể tiếp tục bằng thời gian còn lại.'}</div>`}<div class="actions section">${current()?.status==='paused'?btn('Tiếp tục lần đang làm','resume'):''}${btn('Reset và làm lại từ đầu','request-reset','outline')}${textBtn('Về tài liệu bài tập','show-docs')}</div><section class="section"><h3>Lịch sử làm bài</h3>${attemptHistory(rec,a.no)}</section>${submitted?resultTable(a):''}`+footer();
  }
// Các thao tác chỉ ghi khi tab đang giữ lượt làm. Chọn chữ dùng adapter nguyên bản của Term Test.
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
 const a=current(),n=+target.dataset.question;
 const actions={
  'open-assignment':()=>navigate('login'),'show-docs':()=>identity?window.open(identity.documentUrl,'_blank','noopener'):navigate('docs'),
  'change-student':()=>{pause('identity',false);sessionStorage.removeItem(SESSION);sessionToken='';studentId='';navigate('login');},
  begin,resume,pause:()=>pause(),'request-reset':requestReset,'request-submit':requestSubmit,'show-result':()=>loadResult(a.no),
  'close-modal':closeModal,'confirm-modal':()=>{const fn=modalAction;closeModal();fn?.();},
  tab:()=>switchTab(target.dataset.tab),jump:()=>jump(n),
  flag:()=>{if(!writable())return;a.flags=a.flags.includes(n)?a.flags.filter(x=>x!==n):[...a.flags,n];persist();updateProgress();},
  review:()=>review(),'review-filter':()=>review(target.dataset.filter),'close-review':()=>document.querySelector('#review-panel').hidden=true,
  'review-jump':()=>{document.querySelector('#review-panel').hidden=true;jump(n);},'mobile-pane':()=>setMobilePane(target.dataset.pane),
  notes:()=>{window.ReadingAnnotations?.closeNotePanel();window.ReadingAnnotations?.refreshNotes();const p=document.querySelector('#notes-panel');p.hidden=!p.hidden;a.notesOpen=!p.hidden;persist();if(!p.hidden)document.querySelector('#notes').focus();},
  'font-up':()=>changeFont(10),'font-down':()=>changeFont(-10),'explanation-toggle':()=>toggleExplanation(n,target),
  highlight:()=>{if(!writable())return;const letter=document.querySelector('.paragraph.spot')?.dataset.paragraph;if(!letter)return;a.highlighted=a.highlighted.includes(letter)?a.highlighted.filter(x=>x!==letter):[...a.highlighted,letter];persist();document.querySelector(`#paragraph-${letter}`).classList.toggle('highlighted',a.highlighted.includes(letter));},
  'result-attempt':()=>loadResult(target.dataset.attempt),'check-network':async()=>{try{await request('/state');networkFailed=false;render();notify('Đã kết nối. Nhấn Tiếp tục để làm bài.');}catch(e){notify(e.message);}},
  'teacher-result':()=>{location.hash=`submission=${target.dataset.submission}`;},
  'retry-save':()=>{saveError=false;if(persist(false))render();}
 };
 actions[target.dataset.action]?.();document.querySelector('.homework-options[open]')?.removeAttribute('open');
});
function writable(){return route==='exercise'&&current()?.status==='running'&&current()?.owner===TAB&&!saveError&&!busy;}
document.addEventListener('click',event=>{const p=event.target.closest('[data-paragraph]');if(p)document.querySelectorAll('.paragraph').forEach(el=>el.classList.toggle('spot',el===p));});
document.addEventListener('change',event=>{
 const input=event.target;
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
  const response=await request('/login',{entryToken,studentRef:id,classCode});sessionToken=response.token;sessionStorage.setItem(SESSION,sessionToken);apply(response);
  if(document.querySelector('#remember-student').checked)localStorage.setItem(MEMORY,JSON.stringify({studentId:id,classCode}));else localStorage.removeItem(MEMORY);
  recoverLocal();navigate(['running','paused'].includes(current()?.status)?'resume':'prep');
 }catch(e){document.querySelector('#login-error').textContent=e.message;}finally{button.disabled=false;}
});
function recoverLocal(){
 const a=current();pendingOperation=JSON.parse(sessionStorage.getItem(`reading-operation:${identity.bindingId}`)||'null');if(!a||!['running','paused'].includes(a.status))return;
 try{const local=JSON.parse(localStorage.getItem(cacheKey()));
  if(local?.attemptId===a.id&&local.lease?.id===a.leaseId&&local.snapshot.sequence>=a.sequence){Object.assign(a,local.snapshot);a.remainingMs=Math.min(a.remainingMs,local.remainingMs);lease=local.lease;activeMs=local.snapshot.activeMs;pendingOperation=pendingOperation||local.pendingOperation||null;}
  else{lease=null;activeMs=0;}
  a.status='paused';a.owner=null;
 }catch{saveError=true;showStorageError();}
}
window.addEventListener('hashchange',()=>{if(location.pathname.endsWith('/teacher.html')){route='teacher';teacherScreen();}else render();});
window.addEventListener('offline',()=>pause('offline'));
window.addEventListener('online',()=>{networkFailed=false;if(route==='resume')render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('hidden');});
window.addEventListener('pagehide',()=>pause('closed',false));
window.addEventListener('beforeunload',()=>pause('closed',false));
window.addEventListener('storage',event=>{
 if(event.key!==checkpointKey||!event.newValue||!current())return;
 try{const fresh=JSON.parse(event.newValue);if(fresh.attemptId!==current().id||fresh.lease?.id!==lease?.id){lastTick=0;current().status='paused';current().pauseReason='conflict';lease=null;navigate('resume');}}catch{}
});
modal.addEventListener('cancel',()=>modalAction=null);
window.ReadingInteractionBridge={current,scope:()=>`${identity?.bindingId}:${current()?.id||''}`,writable,
 save:()=>{if(!writable())return false;consumeTime();return persist();},showPane:setMobilePane,
 closeGeneralNotes:()=>{const panel=document.querySelector('#notes-panel');if(panel)panel.hidden=true;if(current())current().notesOpen=false;}};
setInterval(tick,250);
async function bootstrap(){
 app.innerHTML='<section class="card card-pad"><h1>Đang mở bài Reading…</h1><p>Kiểm tra link bài tập và bản lưu gần nhất.</p></section>';
 try{
  if(location.pathname.endsWith('/teacher.html')){ready=true;route='teacher';await teacherScreen();return;}
  const entry=new URLSearchParams(location.hash.split('?')[1]).get('entry');
  if(entry){sessionStorage.setItem(ENTRY,entry);history.replaceState(null,'',location.pathname+location.search+'#login');}
  entryToken=entry||sessionStorage.getItem(ENTRY)||'';sessionToken=sessionStorage.getItem(SESSION)||'';
  if(sessionToken){try{const response=await request('/state');apply(response);recoverLocal();}catch(e){if(e.code==='UNAUTHORIZED'){sessionToken='';sessionStorage.removeItem(SESSION);}else throw e;}}
  if(entryToken){entryInfo=await request('/open',{entryToken});STUDENTS=entryInfo.students;
   if(sessionToken&&identity.bindingId!==entryInfo.bindingId){sessionToken='';studentId='';identity=null;sessionStorage.removeItem(SESSION);}}
  if(!sessionToken&&!entryToken)throw new Error('Hãy mở bài bằng nút CTA trong bản Homework của bạn.');
  ready=true;
  if(sessionToken)navigate(['running','paused'].includes(current()?.status)?'resume':'prep');else navigate('login');
 }catch(e){app.innerHTML=`<section class="card card-pad"><h1>Chưa mở được bài Reading</h1><p>${escape(e.message)}</p><p>Giữ nguyên link và thử tải lại khi kết nối ổn định.</p></section>`;}
}
bootstrap();

})();
