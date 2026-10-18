import {createTestStudentIdentity} from '../../shared/test-student-identity.js?v=20261018-identity-v1';
import {createStudentIdentityMemory} from '../../shared/student-identity.js?v=20261018-identity-v1';
import {migrateLegacyStudentIdentity,requestLegacyStudentIdentity} from '../../shared/student-identity-migration.js?v=20261018-identity-v1';
import {reading,writing} from './practice-content.js';
import {createWebChecks} from './web-checks.js';

// Bài làm quen dùng phiên/API riêng. Bộ nhớ chỉ giữ nháp và token thử; khóa audio chỉ ở RAM.
// Lưu/nộp phải được server đọc lại. Lỗi mạng giữ nháp, không báo thành công hoặc tự mở bài thi.
const app=document.getElementById('app');
const apiBase=window.TERM_TEST_APP_CONFIG.API_BASE_URL.replace(/\/$/,'');
const api=apiBase+'/api/k67-readiness/v1';
const classCode=(new URLSearchParams(location.search).get('class')||'').trim().toUpperCase();
const legacyStorageKey=`izone:k67-readiness:v1:${apiBase}:${classCode}`;
const navigationType=performance.getEntriesByType('navigation')[0]?.type;
const identityMemory=createStudentIdentityMemory();
// Danh sách Làm quen lấy mapping.student_mapping_review.public_id, khác mã roster
// Term/Mini. Dùng nguồn Mapping để nhận và ghi đúng danh tính của danh sách này.
const sharedIdentity=createTestStudentIdentity({product:'k67-readiness',classCode,
  memory:identityMemory,legacyKeys:{state:legacyStorageKey},getStorages:()=>[localStorage],requestIdentity:requestLegacyStudentIdentity});
async function requestK67Identity(input){
  // Chỉ quy đổi mã người học K67; không mở bài thi, cấp audio hoặc lấy token bài khác.
  const response=await fetch(apiBase+'/api/term-tests/term-test-1/student-identity',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),
    cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error('Chưa kiểm được danh tính chung.');return response.json();
}
async function resolveRememberedStudent(){
  const before=identityMemory.read();
  if(before.status==='empty'&&before.revision===null){
    // Nguồn chung có thể không biết UUID riêng K67. Chỉ thử nguồn K67 khi đã
    // xác nhận không tìm thấy; vẫn đối chiếu toàn bộ tên cũ để phát hiện nhiều người.
    const migrated=await migrateLegacyStudentIdentity({memory:identityMemory,requestIdentity:async input=>{
      const value=await requestLegacyStudentIdentity(input);
      return value?.ok&&value.status==='missing'&&input.studentRef?requestK67Identity(input):value;
    }});
    if(['legacy_conflict','legacy_unresolved'].includes(migrated.status))return{status:migrated.status};
  }
  return sharedIdentity.resolveRemembered();
}
let storageKey='',loginVersion=0;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let roster=[],session=null,token='',local={},audio=null,audioUrl='',scope=null,epoch=0,abort=new AbortController();
let cacheState='not_checked',heard=0,revision=0,ackRevision=0,saveQueue=Promise.resolve(),saveTimer,progressTimer,unlock;
let sampleReady=false,busy=false,serverAvailable=false,unloading=false,sessionUnlock,readOnly=false;
let activeSkill='',practiceRevision=0,practiceAck=0,practiceQueue=Promise.resolve();
let diagnostics,playerChecks,checkTimer,checkRevision=0,checkQueue=Promise.resolve(),checksOpen=false,checkSyncState='pending';
function startChecks(){
  clearTimeout(checkTimer);diagnostics?.dispose();checkRevision=session?.checkRevision||0;checkQueue=Promise.resolve();checkSyncState='pending';
  diagnostics=createWebChecks({onChange:()=>{diagnostics?.paint();clearTimeout(checkTimer);if(sessionUnlock)checkTimer=setTimeout(flushChecks,1500);},
    onRisk:()=>{const yes=app.querySelector('[name=heard][value=yes]');if(yes)yes.checked=false;updateSubmit();}});
}
function checksPanel(){let html=diagnostics.html();
  if(session?.checkUpdatedAt&&session.checkReport?.runId!==diagnostics.report().runId)html=html.replace('<p id="checkSaved"','<p class="readiness-muted">Máy chủ còn kết quả kiểm của lần trước. Các mục phía trên là lượt đang mở; không dùng nhãn đạt cũ để bỏ kiểm lại sau tải lại.</p><p id="checkSaved"');
  const savedText=checkSyncState==='failed'?'Chưa xác nhận đồng bộ được kết quả kiểm. Trạng thái lưu/nộp bài thử được ghi riêng.':checkSyncState==='saved'?'Đã ghi và đọc lại kết quả kiểm trên máy chủ. Đây là quan sát từ web, không phải chứng nhận máy.':'';
  html=html.replace('id="checkSaved" class="readiness-muted" role="status"></p>',`id="checkSaved" class="readiness-muted" role="status">${savedText}</p>`);
  return html.replace('id="webChecks"','id="webChecks"'+(checksOpen?'':' hidden'));}
function flushChecks(){
  if(!session||!sessionUnlock||readOnly)return Promise.resolve(false);
  clearTimeout(checkTimer);checkRevision=Math.max(checkRevision,session.checkRevision||0)+1;
  const owner=diagnostics,generation=epoch,snapshot={token,revision:checkRevision,report:diagnostics.report()};
  checkQueue=checkQueue.catch(()=>false).then(async()=>{
    if(diagnostics!==owner||epoch!==generation)return false;
    try{const r=await request('/checks',snapshot);if(diagnostics!==owner||epoch!==generation)return false;
      checkRevision=Math.max(checkRevision,r.session.checkRevision||0);
      if(r.session.checkRevision!==snapshot.revision||r.session.checkReport?.runId!==snapshot.report.runId)throw Error('CHECK_CONFLICT');
      session={...session,checkReport:r.session.checkReport,checkRevision:r.session.checkRevision,checkUpdatedAt:r.session.checkUpdatedAt};
      checkSyncState='saved';
      const n=document.getElementById('checkSaved');if(n)n.textContent='Đã ghi và đọc lại kết quả kiểm trên máy chủ. Đây là quan sát từ web, không phải chứng nhận máy.';return true;
    }catch{if(diagnostics===owner){checkSyncState='failed';const n=document.getElementById('checkSaved');if(n)n.textContent='Chưa xác nhận đồng bộ được kết quả kiểm. Việc lưu/nộp bài thử vẫn có trạng thái riêng.';}return false;}
  });return checkQueue;
}
const fields=()=>Object.fromEntries([...app.querySelectorAll('input[data-answer]')].map(n=>[n.dataset.answer,n.value]));
const initialAnswers=()=>session?.answers||{};
function readLocal(key=storageKey){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return{};}}
function bindStudent(studentRef,options={}){
  const previous=sharedIdentity.current().studentRef===studentRef?local:{};
  const binding=sharedIdentity.select({ref:studentRef},options);
  storageKey=binding.keys.state;local=Object.keys(binding.state).length?binding.state:previous;
}
function persist(patch={}){
  local={...local,...patch};
  try{localStorage.setItem(storageKey,JSON.stringify(local));return localStorage.getItem(storageKey)===JSON.stringify(local);}
  catch{return false;}
}
function notice(text,error=false){const n=document.getElementById('notice');if(n){n.textContent=text;n.dataset.error=String(error);n.hidden=!text;}}
function status(text){const n=document.getElementById('saveStatus');if(n)n.textContent=text;}
async function request(path,body){
  const began=performance.now();
  try{
  const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(10000)]);
  const response=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal});
  const result=await response.json();
  if(!response.ok||!result.ok){const e=new Error(result.message||'Chưa xử lý được yêu cầu.');e.code=result.error;throw e;}
  if(path!=='/checks')diagnostics?.network(performance.now()-began);
  return result;
  }catch(e){if(path!=='/checks')diagnostics?.network(0,false);throw e;}
}
function header(exercise=false,controls=''){return `<header class="readiness-header" tabindex="0" aria-label="Tiêu đề và điều khiển bài làm quen">
  <h1>${exercise?'Listening thử':activeSkill?skillLabel(activeSkill)+' thử':'Làm quen K67'}</h1>
  <span class="readiness-person">${escape(session?.studentName||'')} · ${escape(classCode)}</span>
  ${exercise?'<button id="play" class="button button-primary" type="button" disabled>Đang tải audio…</button><span id="audioTime">0:00</span><label class="volume">Âm lượng <input id="volume" type="range" min="0.1" max="1" step="0.1" value="0.7"></label><button id="soundIssue" class="button button-secondary" type="button">Tôi không nghe rõ</button><button id="submit" class="button button-primary" type="button" disabled>Nộp bài thử</button>':''}
  ${controls}${session?`<button id="webCheckToggle" class="button button-secondary" type="button" aria-expanded="${checksOpen}">Kiểm thiết bị</button>`:''}<button id="change" class="button button-secondary" type="button">Đổi người học</button>
  </header><div id="notice" class="readiness-status" role="status" hidden></div>`;}
function bindChange(){document.getElementById('change')?.addEventListener('click',()=>changePerson());
  document.getElementById('webCheckToggle')?.addEventListener('click',()=>{checksOpen=!checksOpen;const n=document.getElementById('webChecks');if(n)n.hidden=!checksOpen;document.getElementById('webCheckToggle').setAttribute('aria-expanded',String(checksOpen));});}
function stop(){playerChecks?.expectedPause();audio?.pause();diagnostics?.detach();unlock?.();unlock=null;sessionUnlock?.();sessionUnlock=null;clearTimeout(saveTimer);clearTimeout(checkTimer);clearInterval(progressTimer);if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl='';audio=null;sampleReady=false;}
async function changePerson(retry=false){
  if(busy)return;
  if(!retry&&session&&(!session.submittedAt||activeSkill&&!session.practice[activeSkill].submittedAt)&&!confirm('Rời lượt làm quen này để đổi người học? Nháp sẽ được giữ riêng theo từng người.'))return;
  busy=true;
  try{
    // Giữ nháp đúng chủ trước khi rời. Không xóa phiên/nháp của người trước.
    if(session){
      if(activeSkill)persistPractice();else if(!session.submittedAt)persistDraft();
      const durable=persist();
      const synced=activeSkill?await savePractice():session.submittedAt||await saveDraft();
      if(!durable&&!synced){notice('Chưa giữ được bản nháp. Hãy lưu lại hoặc khôi phục mạng trước khi đổi người học.',true);return;}
    }
    if(!retry){
      const forgotten=await sharedIdentity.forget();
      if(forgotten.status!=='empty'){notice('Chưa bỏ được danh tính đã nhớ. Hãy thử đổi người học lại; bài và nháp vẫn được giữ.',true);return;}
    }
  }finally{busy=false;}
  loginVersion++;sharedIdentity.invalidate();
  stop();epoch++;abort.abort();abort=new AbortController();session=null;token='';local={};revision=ackRevision=heard=0;saveQueue=Promise.resolve();readOnly=false;
  activeSkill='';practiceQueue=Promise.resolve();
  checksOpen=false;startChecks();
  if(retry){
    // Làm lại chỉ mở lượt mới của cùng người; bản gốc vẫn giữ để khôi phục khi cần.
    const binding=sharedIdentity.current();
    if(binding.studentRef)persist({token:'',pending:undefined,studentRef:binding.studentRef});
  }
  storageKey='';
  if(!roster.length)await initialize(false);else renderLogin();
}
function renderLogin(message=''){
  app.innerHTML=`<main class="readiness-shell">${header()}<section class="readiness-card cbt-bootstrap-card">
    <div class="cbt-lobby-header"><span class="cbt-lobby-badge">Bài làm quen trước thi</span><h2>Kiểm tra âm thanh trên máy của bạn</h2><p>Bài thử có nội dung riêng. Kết quả không tính vào điểm thi.</p></div>
    <div class="cbt-bootstrap-identity"><strong>Lớp ${escape(classCode)}</strong><label>Họ và tên<select id="student"><option value="">Nhấn để chọn</option>${roster.map(s=>`<option value="${escape(s.ref)}">${escape(s.name)}</option>`).join('')}</select></label>
    <label class="readiness-check"><input id="remember" type="checkbox" checked>Ghi nhớ tôi trên thiết bị này</label>
    <p id="memoryStatus" class="readiness-muted">Chỉ ghi nhớ trên thiết bị cá nhân. Bạn vẫn cần xác nhận trước khi vào bài làm quen.</p></div>
    <div class="readiness-actions"><button id="confirmPerson" class="button button-primary" type="button" disabled>Xác nhận và vào bài làm quen</button><button id="retryRoster" class="button button-secondary" type="button">Tải lại danh sách</button></div>
    <p class="readiness-muted">Chưa có tên trong danh sách? Hãy trao đổi với giảng viên.</p></section></main>`;
  bindChange();
  const picker=document.getElementById('student'),confirmButton=document.getElementById('confirmPerson');
  const version=++loginVersion;let changed=false;
  if(sharedIdentity.read().status==='unavailable')document.getElementById('memoryStatus').textContent='Trình duyệt không ghi nhớ được. Bạn vẫn có thể chọn tên và vào bài.';
  resolveRememberedStudent().then(selected=>{
    if(version!==loginVersion||changed||busy||session||!picker.isConnected)return;
    const snapshot=selected.resolution?.snapshot;
    if(snapshot?.status==='ok'&&snapshot.revision!==sharedIdentity.read().revision)return;
    const candidate=roster.filter(s=>s.ref===selected.student?.ref);
    if(selected.status==='unique'&&candidate.length===1){
      picker.value=candidate[0].ref;confirmButton.disabled=false;
      document.getElementById('memoryStatus').textContent='Đã chọn sẵn tên của bạn từ đăng nhập chung. Hãy xác nhận trước khi vào bài làm quen.';
    }
  }).catch(()=>{if(version===loginVersion&&picker.isConnected&&!changed)document.getElementById('memoryStatus').textContent='Chưa kiểm được danh tính chung. Bạn vẫn có thể chọn tên và xác nhận.';});
  confirmButton.disabled=!picker.value;
  picker.addEventListener('change',()=>{changed=true;confirmButton.disabled=!picker.value;});
  confirmButton.addEventListener('click',()=>openSession(picker.value,document.getElementById('remember').checked));
  document.getElementById('retryRoster').addEventListener('click',()=>initialize(true));
  if(message)notice(message,true);
}
async function openSession(studentRef,remember){
  if(busy||!roster.some(s=>s.ref===studentRef))return;busy=true;const generation=epoch;
  document.getElementById('confirmPerson').disabled=true;document.getElementById('student').disabled=true;notice('Đang xác nhận người học…');
  try{
    // Chụp lựa chọn trước khi chờ API; kết quả đến muộn không ghi đè người ở tab khác.
    bindStudent(studentRef,{remember});
    if(local.token){
      token=local.token;const restored=await request('/session',{token});if(generation!==epoch)return;
      checkSessionOwner(restored.session,studentRef);session=restored.session;
      const remembered=await sharedIdentity.prepared(studentRef);if(generation!==epoch)return;
      await renderRestored();showMemoryResult(remembered);return;
    }
    if(local.pending?.studentRef!==studentRef)persist({studentRef,pending:{studentRef,requestId:crypto.randomUUID(),openingProof:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')}});
    const r=await request('/sessions',{classCode,...local.pending});if(generation!==epoch)return;
    checkSessionOwner(r.session,studentRef);
    token=r.token;session=r.session;local={};const durable=persist({token,studentRef:session.studentRef});startChecks();diagnostics.set('session','pass','RESPONDED');
    const remembered=await sharedIdentity.prepared(studentRef);if(generation!==epoch)return;
    renderDevice();showMemoryResult(remembered);if(!durable)notice('Không lưu được phiên trên máy. Tải lại có thể phải vào lại bài làm quen.',true);
  }catch(e){if(generation===epoch){
    if(['READINESS_SESSION_EXPIRED','READINESS_SESSION_REQUIRED'].includes(e.code))persist({token:'',pending:undefined});
    session=null;token='';renderLogin();notice(e.message+' Bạn có thể nhấn xác nhận để thử lại.',true);}}
  finally{busy=false;}
}
function checkSessionOwner(value,studentRef){
  if(value?.studentRef!==studentRef||value.classCode!==classCode)throw new Error('Danh tính bản lưu không khớp phiên. Hãy chọn lại người học.');
}
function showMemoryResult(result){
  // Lỗi ghi nhớ không cản phiên đã được máy chủ xác nhận, cũng không tự đổi người khác.
  if(!['ok','empty'].includes(result.status))notice('Đã xác nhận người học; chưa cập nhật được ghi nhớ chung. Nháp vẫn gắn với người đang mở.',true);
}
async function renderRestored(){
  if(session.submittedAt){if(['reading','writing'].includes(local.activeSkill))await renderPractice(local.activeSkill,true);else renderResult();}
  else if(session.sameComputer===null)renderDevice();else{renderExercise();await prepareAudio();}
}
function renderDevice(){
  app.innerHTML=`<main class="readiness-shell">${header()}${checksPanel()}<section class="readiness-card"><h2>Xác nhận máy và tai nghe</h2>
  <p>Hãy đeo tai nghe, chọn đúng đầu ra và chỉnh âm lượng thoải mái. Đóng ứng dụng gọi/họp không cần thiết.</p>
  <label class="readiness-check"><input id="sameComputer" type="checkbox">Tôi đang dùng đúng máy sẽ dùng để thi.</label>
  <label class="readiness-check"><input id="sameHeadphones" type="checkbox">Tôi đang dùng đúng tai nghe sẽ dùng để thi.</label>
  <p class="readiness-muted">Nếu đang dùng thiết bị khác, bạn vẫn có thể làm quen. Bạn cần kiểm lại trên máy và tai nghe thi.</p>
  <button id="deviceContinue" class="button button-primary" type="button">Xác nhận và kiểm âm thanh</button></section></main>`;
  bindChange();document.getElementById('deviceContinue').addEventListener('click',async()=>{
    if(busy)return;busy=true;const generation=epoch;document.getElementById('deviceContinue').disabled=true;
    try{const r=await request('/device',{token,sameComputer:document.getElementById('sameComputer').checked,sameHeadphones:document.getElementById('sameHeadphones').checked});
      if(generation!==epoch)return;session=r.session;renderExercise();await prepareAudio();}
    catch(e){notice(e.message,true);document.getElementById('deviceContinue')?.removeAttribute('disabled');}finally{busy=false;}
  });
}
function renderExercise(){
  app.innerHTML=`<main class="readiness-shell">${header(true)}${checksPanel()}<div class="readiness-layout"><section class="readiness-card"><h2>Nghe và thử thao tác</h2>
    <p>Đây là thông báo về một câu lạc bộ tưởng tượng. Nghe rồi điền vài thông tin để thử nhập, sửa và lưu đáp án.</p>
    <p>Bạn có thể dừng và nghe lại trong bài làm quen. Bài thi thật áp dụng quy định riêng.</p>
    <p id="checks" role="status">Đang kiểm audio, bản lưu và khả năng khôi phục…</p><p id="saveStatus" class="readiness-muted" role="status">Đang lấy bản nháp từ máy chủ…</p>
    <fieldset id="hearing"><legend>Bạn có nghe rõ toàn bộ đoạn thử qua đúng tai nghe không?</legend><label><input type="radio" name="heard" value="yes"> Có, tôi nghe rõ</label><br><label><input type="radio" name="heard" value="no"> Tôi không nghe rõ</label></fieldset>
    </section><section class="readiness-card"><h2>Đáp án thử</h2>
    ${['What colour is the welcome card?','Where is the club meeting?','What day is the next meeting?','What should visitors bring?'].map((q,i)=>`<label class="readiness-question">${i+1}. ${q}<input data-answer="${i+1}" id="answer${i+1}" maxlength="120" autocomplete="off" value="${escape(initialAnswers()[i+1]||'')}"></label>`).join('')}
    <p class="readiness-muted">Đáp án không dùng để đánh giá năng lực hoặc tính điểm thi.</p></section></div></main>`;
  bindChange();revision=ackRevision=session.revision;heard=session.heardSeconds||0;
  if(local.studentRef===session.studentRef&&local.revision>session.revision&&local.answers){
    revision=local.revision;for(const [number,value]of Object.entries(local.answers)){const n=document.getElementById('answer'+number);if(n)n.value=value;}heard=Math.max(heard,local.heardSeconds||0);
  }
  status(revision>ackRevision?'Có nháp trên máy đang chờ đồng bộ.':'Đã đọc lại bản nháp từ máy chủ.');
  for(const input of app.querySelectorAll('[data-answer]'))input.addEventListener('input',()=>{
    revision++;persistDraft();status('Đang chờ lưu…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveDraft(),450);
  });
  document.getElementById('play').addEventListener('click',()=>togglePlayback());
  document.getElementById('soundIssue').addEventListener('click',()=>{
    playerChecks?.expectedPause();const repeated=diagnostics.issue();
    audio?.pause();const n=app.querySelector('[name=heard][value=no]');n.checked=true;updateSubmit();
    notice((repeated?'Bạn đã báo không nghe rõ nhiều lần. Hãy trao đổi với giảng viên để đổi thiết bị hoặc hình thức phù hợp. ':'')+'Hãy kiểm âm lượng Windows và âm lượng riêng của trình duyệt, chọn đúng loa/tai nghe rồi nghe lại. Nếu vẫn lỗi, trao đổi với giảng viên qua chat hoặc trực tiếp.',true);
  });
  document.getElementById('volume').addEventListener('input',e=>{if(audio)audio.volume=Number(e.target.value);});
  app.querySelectorAll('[name=heard]').forEach(n=>n.addEventListener('change',updateSubmit));
  document.getElementById('submit').addEventListener('click',submit);
}
function persistDraft(){if(!readOnly)persist({token,studentRef:session.studentRef,answers:fields(),revision,heardSeconds:heard});}
function saveDraft(){
  if(!session||session.submittedAt||!sampleReady||readOnly)return Promise.resolve(false);
  const generation=epoch,expectedToken=token,snapshot={token,revision:Math.max(1,revision),answers:fields(),heardSeconds:heard,cacheState};
  revision=Math.max(1,revision);persistDraft();
  saveQueue=saveQueue.catch(()=>false).then(async()=>{
    if(epoch!==generation||token!==expectedToken)return false;
    try{
      const r=await request('/draft',snapshot);if(epoch!==generation||token!==expectedToken)return false;
      if(r.session.revision>snapshot.revision||JSON.stringify(r.session.answers)!==JSON.stringify(snapshot.answers))throw new Error('Bản nháp đã đổi ở tab khác. Hãy tải lại trước khi tiếp tục.');
      ackRevision=Math.max(ackRevision,r.session.revision);session={...session,...r.session};serverAvailable=true;
      diagnostics.set('draftSync','pass','READBACK_OK');
      status(ackRevision===revision?'Đã lưu và đọc lại đáp án trên máy chủ.':'Đang lưu thay đổi mới…');updateSubmit();return true;
    }catch(e){if(epoch===generation){diagnostics.set('draftSync','fail','FAILED');serverAvailable=false;status('Chưa đồng bộ. Nháp hiện giữ trên máy; hãy thử lại khi có mạng.');notice(e.message,true);updateSubmit();}return false;}
  });return saveQueue;
}
async function prepareAudio(){
  const generation=epoch,expectedToken=token;
  try{
    if(!sessionUnlock){
      const acquired=await new Promise((resolve,reject)=>{
        if(!navigator.locks?.request){resolve(false);return;}
        navigator.locks.request('k67-readiness-session:'+token,{ifAvailable:true},async lock=>{
          if(!lock){resolve(false);return;}const released=new Promise(done=>{sessionUnlock=done;});resolve(true);await released;
        }).catch(reject);
      });
      if(!acquired){diagnostics.set('environment','fail',navigator.locks?.request?'OWNER_CONFLICT':'CORE_MISSING');readOnly=true;for(const n of app.querySelectorAll('input, #play, #submit'))n.disabled=true;
        notice(navigator.locks?.request?'Lượt làm quen đang mở ở tab khác. Hãy dùng tab đó, hoặc đóng tab đó rồi tải lại trang này.':'Trình duyệt thiếu tính năng bảo vệ tab. Hãy dùng Chrome/Edge cập nhật hoặc trao đổi với giảng viên.',true);return;}
    }
    flushChecks();
    await diagnostics.checkFormat();if(generation!==epoch)return;
    const access=await request('/audio-access',{token});if(generation!==epoch)return;
    scope={apiBase:api,slug:'readiness-listening-v1',examSessionToken:token,generation:0};
    let encrypted;
    try{encrypted=await window.K67_AUDIO_STORE.get(scope,access.manifest,access.serverNow);}catch{}
    if(!encrypted){const response=await fetch(api+'/audio',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(30000)])});
      if(!response.ok)throw new Error('Chưa tải được audio thử. Hãy kiểm kết nối và thử lại.');encrypted=await response.blob();}
    if(encrypted.size!==access.manifest.encryptedByteLength)throw new Error('Audio thử tải chưa đủ.');
    try{await window.K67_AUDIO_STORE.put(scope,access.manifest,encrypted,access.expiresAt,access.serverNow);cacheState='saved';}catch{cacheState='unavailable';}
    const bytes=new Uint8Array(await encrypted.arrayBuffer());if(new TextDecoder().decode(bytes.subarray(0,5))!=='IZTT1')throw new Error('Bản audio thử không đúng định dạng.');
    const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(access.audioKey),c=>c.charCodeAt(0)),'AES-GCM',false,['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(5,17)},key,bytes.subarray(17));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',plain)),n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!==access.manifest.sha256)throw new Error('Audio thử không khớp phiên bản.');
    if(generation!==epoch||expectedToken!==token)return;
    audioUrl=URL.createObjectURL(new Blob([plain],{type:access.mime}));audio=new Audio(audioUrl);audio.volume=0.7;sampleReady=true;serverAvailable=true;
    diagnostics.set('audio','pass','VERIFIED');diagnostics.set('cache',cacheState==='saved'?'pass':'warn',cacheState==='saved'?'READBACK_OK':'UNAVAILABLE');
    playerChecks=diagnostics.attach(audio);
    const player=audio,active=()=>epoch===generation&&audio===player;
    player.addEventListener('loadedmetadata',()=>{if(!active())return;if(heard>0&&heard<player.duration-0.3)player.currentTime=heard;updateTime();});
    player.addEventListener('timeupdate',()=>{if(!active())return;heard=Math.max(heard,player.currentTime);updateTime();});
    player.addEventListener('play',()=>{if(!active())return;document.getElementById('play').textContent='Dừng nghe';notice('');});
    player.addEventListener('pause',()=>{if(!active())return;unlock?.();unlock=null;document.getElementById('play')&&(document.getElementById('play').textContent='Nghe tiếp');heard=Math.max(heard,player.currentTime);if(!busy){revision++;persistDraft();saveDraft();}});
    player.addEventListener('ended',()=>{if(!active())return;heard=player.duration;revision++;persistDraft();saveDraft();updateTime();});
    player.addEventListener('error',()=>{if(active())notice('Không phát được audio thử. Hãy tải lại hoặc trao đổi với giảng viên.',true);});
    document.getElementById('play').disabled=false;document.getElementById('play').textContent=heard?'Nghe tiếp':'Bắt đầu nghe thử';
    document.getElementById('checks').textContent=cacheState==='saved'?'Đã tải đủ, kiểm toàn vẹn và đọc lại bản audio mã hóa trên máy.':'Audio đã sẵn sàng trong bộ nhớ. Chưa lưu được bản bền; tải lại có thể cần tải audio lại.';
    revision++;await saveDraft();progressTimer=setInterval(()=>{if(audio&&!audio.paused&&!busy){revision++;persistDraft();saveDraft();}},5000);
  }catch(e){if(generation!==epoch)return;
    // Bản mã tải hỏng vẫn có thể có checksum cache hợp lệ. Bỏ đúng bản của phiên thử để lần sau tải mới.
    if(scope)try{await window.K67_AUDIO_STORE.remove(scope);}catch{}
    cacheState='not_checked';
    diagnostics.set('audio','fail','FAILED');
    diagnostics.set('cache','unknown','UNAVAILABLE');
    const message=e.name==='OperationError'?'Audio thử bị hỏng hoặc không giải mã được.':e.message;
    notice(message+' Nhấn tải lại audio để thử lại.',true);
    const button=document.getElementById('play');if(button){button.textContent='Tải lại audio';button.disabled=false;}
  }
}
async function togglePlayback(){
  if(!sampleReady){if(!busy){busy=true;try{await prepareAudio();}finally{busy=false;}}return;}
  if(!audio.paused){playerChecks?.expectedPause();audio.pause();return;}
  const generation=epoch;
  // Web Locks chỉ khóa các tab làm quen; quan sát khóa K67 hiện có để tránh nghe chồng bài thật.
  if(!navigator.locks?.request){notice('Trình duyệt chưa hỗ trợ bảo vệ nhiều tab. Hãy dùng Chrome hoặc Edge đã cập nhật.',true);return;}
  const held=(await navigator.locks.query()).held||[];
  if(held.some(l=>l.name.startsWith('k67-audio:'))){notice('Có phiên thi K67 đang mở ở tab khác. Hãy hoàn thành hoặc đóng phiên đó trước khi nghe bài làm quen.',true);return;}
  navigator.locks.request('k67-readiness-audio:'+apiBase,{ifAvailable:true},async lock=>{
    if(!lock){notice('Bài làm quen đang phát ở tab khác. Hãy dừng bên đó rồi thử lại.',true);return;}
    if(generation!==epoch)return;
    try{const released=new Promise(resolve=>{unlock=resolve;});await audio.play();diagnostics.holdWake();await released;}
    catch(e){diagnostics.set('playback','fail',e.name==='NotAllowedError'?'BLOCKED':'ERROR');unlock?.();unlock=null;notice('Trình duyệt chưa phát được tiếng. Hãy kiểm âm lượng/đầu ra rồi bấm nghe lại.',true);}
  }).catch(()=>notice('Chưa giữ được quyền phát. Hãy thử lại.',true));
}
function updateTime(){const n=document.getElementById('audioTime');if(n)n.textContent=`${Math.floor((audio?.currentTime||heard)/60)}:${String(Math.floor((audio?.currentTime||heard)%60)).padStart(2,'0')}`;updateSubmit();}
function updateSubmit(){const b=document.getElementById('submit'),choice=app.querySelector('[name=heard]:checked');
  const finished=audio?.duration&&heard>=audio.duration-0.5;
  if(choice?.value==='yes'){
    if(audio?.muted||audio?.volume===0){choice.checked=false;diagnostics?.set('hearing','warn','RECONFIRM');}
    else if(finished)diagnostics?.hearing(true);else diagnostics?.set('hearing','pending','PENDING');
  }else if(choice?.value==='no')diagnostics?.hearing(false);
  if(b)b.disabled=busy||readOnly||!sampleReady||!choice?.checked||(choice.value==='yes'&&!finished);}
async function submit(){
  if(busy)return;busy=true;heard=Math.max(heard,audio?.currentTime||0);playerChecks?.expectedPause();audio?.pause();clearTimeout(saveTimer);revision++;const generation=epoch;
  for(const n of app.querySelectorAll('input,#play,#change,#soundIssue'))n.disabled=true;
  updateSubmit();notice('Đang lưu bản cuối trước khi nộp…');
  try{
    if(!await saveDraft())throw new Error('Chưa lưu được bản cuối; bài chưa được nộp.');
    await flushChecks();
    const r=await request('/submit',{token,revision:ackRevision,heardConfirmed:app.querySelector('[name=heard]:checked')?.value==='yes'});
    if(generation!==epoch)return;session=r.session;renderResult();
  }catch(e){
    if(generation!==epoch)return;
    // Phản hồi nộp bị mất có thể đã ghi xong. Đọc lại trước khi yêu cầu người học nộp lại.
    try{const restored=await request('/session',{token});if(generation!==epoch)return;
      if(restored.session.submittedAt){session=restored.session;renderResult();return;}
    }catch{}
    if(generation===epoch)notice(e.message+' Giữ nguyên trang và thử nộp lại khi có mạng.',true);
  }
  finally{busy=false;for(const n of app.querySelectorAll('input,#play,#change,#soundIssue'))n.disabled=readOnly;updateSubmit();}
}
function renderResult(){
  activeSkill='';persist({activeSkill:''});
  stop();persist({token,studentRef:session.studentRef,revision:session.revision,answers:session.answers});
  const rightDevice=session.sameComputer&&session.sameHeadphones;
  app.innerHTML=`<main class="readiness-shell">${header(false,`<button id="openReading" class="button button-secondary" type="button">${practiceAction('reading')}</button><button id="openWriting" class="button button-secondary" type="button">${practiceAction('writing')}</button><button id="retryExercise" class="button button-secondary" type="button">Làm lại bài thử</button>`)}${checksPanel()}<section class="readiness-card"><h2>Đã nộp bài làm quen</h2><div class="readiness-result">
    <p><strong>Âm thanh:</strong> ${session.heardConfirmed?'Bạn xác nhận đã nghe rõ đoạn thử.':'Bạn chưa nghe rõ. Hãy kiểm đầu ra/tai nghe và trao đổi với giảng viên qua chat hoặc trực tiếp.'}</p>
    <p><strong>Thiết bị:</strong> ${rightDevice?'Bạn xác nhận đang dùng đúng máy và tai nghe thi.':'Bạn làm quen trên thiết bị khác; cần kiểm lại trên máy và tai nghe thi.'}</p>
    <p><strong>Lưu/nộp:</strong> Đã đọc lại bài nộp từ máy chủ.</p><p><strong>Audio sau tải lại:</strong> ${session.cacheState==='saved'?'Đã lưu bản mã trên máy; khi vào lại vẫn cần mạng để xác thực.':'Chưa có bản lưu bền; có thể cần tải audio lại.'}</p>
    ${['reading','writing'].map(skill=>`<p><strong>${skillLabel(skill)}:</strong> ${practiceState(skill)}</p>`).join('')}</div>
    <h3>Đáp án bạn đã nộp</h3><div class="readiness-answers">${[1,2,3,4].map(i=>`${i}. ${escape(session.answers[i]||'(chưa nhập)')}`).join('\n')}</div>
    <p class="readiness-muted">Không tính điểm thi. Kết quả này chỉ phản ánh lượt kiểm vừa rồi; không bảo đảm thiết bị không phát sinh gián đoạn sau đó.</p>
    <p class="readiness-muted">Reading và Writing là tùy chọn. Bạn có thể làm tiếp hoặc xem lại bằng nút trên tiêu đề.</p></section></main>`;
  bindChange();document.getElementById('retryExercise').addEventListener('click',()=>changePerson(true));
  document.getElementById('openReading').addEventListener('click',()=>renderPractice('reading'));
  document.getElementById('openWriting').addEventListener('click',()=>renderPractice('writing'));
}
const skillLabel=skill=>skill==='reading'?'Reading':'Writing';
function practiceAction(skill){const p=session.practice[skill];return (p.submittedAt?'Xem lại ':p.revision?'Tiếp tục ':'Thử ')+skillLabel(skill);}
function practiceState(skill){const p=session.practice[skill];return p.submittedAt?'Đã nộp và đọc lại trên máy chủ.':p.revision?'Đã lưu nháp, chưa nộp.':'Chưa thử (tùy chọn).';}
function practiceFields(){return activeSkill==='writing'?{text:document.getElementById('writingText')?.value||''}:fields();}
function persistPractice(){
  if(!activeSkill||readOnly||session.practice[activeSkill].submittedAt)return;
  persist({activeSkill,practiceDrafts:{...local.practiceDrafts,[activeSkill]:{revision:practiceRevision,data:practiceFields()}}});
}
function wordCount(){const text=document.getElementById('writingText')?.value.trim()||'';const n=document.getElementById('wordCount');if(n)n.textContent=String(text?text.split(/\s+/u).length:0);}
async function renderPractice(skill,restoring=false){
  if(busy&&!restoring)return;
  stop();activeSkill=skill;readOnly=false;const generation=++epoch;practiceQueue=Promise.resolve();
  const p=session.practice[skill],draft=local.practiceDrafts?.[skill];
  const useLocal=!p.submittedAt&&draft?.revision>p.revision;
  const data=useLocal?draft.data:p.data;
  practiceRevision=useLocal?draft.revision:p.revision;practiceAck=p.revision;persist({activeSkill:skill});
  const controls=`<button id="practiceSave" class="button button-secondary" type="button" disabled>Lưu nháp</button><button id="practiceSubmit" class="button button-primary" type="button" disabled>Nộp ${skillLabel(skill)} thử</button><button id="practiceResult" class="button button-secondary" type="button">Kết quả</button>`;
  app.innerHTML=`<main class="readiness-shell">${header(false,controls)}${checksPanel()}<div class="readiness-layout"><section class="readiness-card readiness-passage"><h2>${escape(skill==='reading'?reading.title:writing.title)}</h2>
    ${skill==='reading'?reading.paragraphs.map(text=>`<p>${escape(text)}</p>`).join(''):`<p>${escape(writing.prompt)}</p>`}
    <p class="readiness-muted">${skill==='reading'?'Gợi ý khoảng 2 phút. Đọc bên trái, điền câu trả lời bên phải.':'Gợi ý 1–2 phút. Viết 2–3 câu để thử gõ, sửa, lưu và nộp.'} Không tự thu bài, không tính điểm.</p></section>
    <section class="readiness-card"><h2>${p.submittedAt?'Xem lại bài đã nộp':skill==='reading'?'Đáp án Reading thử':'Bài viết thử'}</h2>
    ${skill==='reading'?reading.questions.map((q,i)=>`<label class="readiness-question">${i+1}. ${escape(q)}<input data-answer="${i+1}" id="answer${i+1}" maxlength="120" autocomplete="off" value="${escape(data[i+1]||'')}" disabled></label>`).join(''):`<label for="writingText">Bài viết của bạn</label><textarea id="writingText" class="writing-editor readiness-editor" maxlength="12000" spellcheck="false" disabled>${escape(data.text||'')}</textarea><div class="writing-editor-meta">Số từ: <strong id="wordCount">0</strong> · Tối đa 12.000 ký tự</div>`}
    <p id="saveStatus" class="readiness-muted" role="status">${p.submittedAt?'Đã đọc lại bài nộp từ máy chủ.':'Đang kiểm quyền sửa của tab…'}</p></section></div></main>`;
  bindChange();wordCount();
  document.getElementById('practiceResult').addEventListener('click',async()=>{
    if(busy)return;busy=true;
    if(!p.submittedAt&&!readOnly){clearTimeout(saveTimer);await savePractice();}
    busy=false;if(epoch===generation)renderResult();
  });
  if(p.submittedAt){document.getElementById('practiceSave').hidden=true;document.getElementById('practiceSubmit').hidden=true;return;}
  try{
    const acquired=await new Promise((resolve,reject)=>{
      if(!navigator.locks?.request){resolve(false);return;}
      navigator.locks.request('k67-readiness-session:'+token,{ifAvailable:true},async lock=>{
        if(!lock){resolve(false);return;}
        if(epoch!==generation){resolve(false);return;}
        const released=new Promise(done=>{sessionUnlock=done;});resolve(true);await released;
      }).catch(reject);
    });
    if(epoch!==generation)return;
    if(!acquired){readOnly=true;notice('Lượt làm quen đang mở ở tab khác. Hãy dùng tab đó, hoặc đóng tab đó rồi tải lại trang này.',true);return;}
    for(const n of app.querySelectorAll('[data-answer],#writingText,#practiceSave,#practiceSubmit'))n.disabled=false;
    status(useLocal?'Có nháp trên máy đang chờ đồng bộ.':'Đã đọc lại bản nháp từ máy chủ.');
    for(const n of app.querySelectorAll('[data-answer],#writingText'))n.addEventListener('input',()=>{
      practiceRevision++;persistPractice();wordCount();status('Đang chờ lưu…');clearTimeout(saveTimer);saveTimer=setTimeout(savePractice,450);
    });
    document.getElementById('practiceSave').addEventListener('click',savePractice);
    document.getElementById('practiceSubmit').addEventListener('click',submitPractice);
    if(useLocal)await savePractice();
  }catch(e){if(epoch===generation)notice(e.message,true);}
}
function savePractice(){
  if(!activeSkill||readOnly||!sessionUnlock||session.practice[activeSkill].submittedAt)return Promise.resolve(false);
  const skill=activeSkill,generation=epoch,snapshot={token,revision:Math.max(1,practiceRevision),data:practiceFields()};
  practiceRevision=snapshot.revision;persistPractice();
  practiceQueue=practiceQueue.catch(()=>false).then(async()=>{
    if(epoch!==generation)return false;
    try{
      const r=await request('/practice/'+skill+'/draft',snapshot);if(epoch!==generation)return false;
      const saved=r.session.practice[skill];
      if(saved.revision!==snapshot.revision||JSON.stringify(saved.data)!==JSON.stringify(snapshot.data))throw new Error('Bản nháp đã đổi ở tab khác. Hãy tải lại trước khi tiếp tục.');
      session=r.session;practiceAck=saved.revision;
      status(practiceAck===practiceRevision?'Đã lưu và đọc lại bản nháp trên máy chủ.':'Đang lưu thay đổi mới…');notice('');return true;
    }catch(e){if(epoch===generation){status('Chưa đồng bộ. Nháp hiện giữ trên máy; hãy thử lại khi có mạng.');notice(e.message,true);}return false;}
  });return practiceQueue;
}
async function submitPractice(){
  if(busy||readOnly)return;busy=true;clearTimeout(saveTimer);const generation=epoch,skill=activeSkill;
  for(const n of app.querySelectorAll('input,textarea,button'))n.disabled=true;
  try{
    if(!await savePractice())throw new Error('Chưa lưu được bản cuối; phần này chưa được nộp.');
    const r=await request('/practice/'+skill+'/submit',{token,revision:practiceAck});
    if(epoch!==generation)return;session=r.session;renderResult();
  }catch(e){
    if(epoch!==generation)return;
    try{const r=await request('/session',{token});if(epoch!==generation)return;if(r.session.practice[skill].submittedAt){session=r.session;renderResult();return;}}catch{}
    notice(e.message+' Giữ nguyên trang và thử lại khi có mạng.',true);
  }finally{busy=false;for(const n of app.querySelectorAll('input,textarea,button'))n.disabled=readOnly;}
}
async function initialize(resume=true){
  const generation=epoch;loginVersion++;
  try{
    if(!classCode)throw new Error('Link chưa có lớp. Hãy dùng link làm quen giảng viên gửi.');
    const pinned=sharedIdentity.current();
    if(resume&&pinned.studentRef){storageKey=pinned.keys.state;local=pinned.state;}
    else if(resume&&!history.state?.izoneStudentProductStateV1?.cleared&&['reload','back_forward'].includes(navigationType)){
      const old=readLocal(legacyStorageKey);
      if(old.token&&/^[0-9a-f-]{36}$/i.test(old.studentRef||''))bindStudent(old.studentRef);
      else{storageKey='';local={};}
    }else{storageKey='';local={};}
    if(resume&&local.token){
      token=local.token;const restored=await request('/session',{token});if(generation!==epoch)return;
      checkSessionOwner(restored.session,local.studentRef);session=restored.session;
      // Khôi phục tab không xuất lại danh tính A vào bộ nhớ chung đang là B hoặc đã quên.
      await renderRestored();return;
    }
    const response=await fetch(api+'/roster?class='+encodeURIComponent(classCode),{cache:'no-store',signal:AbortSignal.timeout(10000)}),r=await response.json();
    if(!response.ok||!r.ok)throw new Error(r.message||'Chưa tải được danh sách.');
    if(generation!==epoch)return;roster=r.students;
    renderLogin();
  }catch(e){if(generation===epoch){
    token='';session=null;
    if(['READINESS_SESSION_EXPIRED','READINESS_SESSION_REQUIRED'].includes(e.code)){
      // Chỉ bỏ quyền thử đã bị server từ chối. Lỗi mạng giữ token/nháp để còn khôi phục.
      persist({token:'',pending:undefined});
      try{await initialize(false);if(generation===epoch)notice('Phiên làm quen cũ không còn hiệu lực. Hãy chọn đúng tên và xác nhận để mở lượt mới. Bài thi thật không bị thay đổi.',true);}
      catch{if(generation===epoch)renderLogin('Phiên làm quen cũ không còn hiệu lực. Hãy tải lại danh sách khi có mạng.');}
    }else renderLogin(e.message+' Giữ nguyên trang và tải lại danh sách khi có mạng.');
  }}
}
window.addEventListener('pagehide',()=>{unloading=true;if(activeSkill)persistPractice();else if(session&&!session.submittedAt)persistDraft();stop();abort.abort();});
window.addEventListener('pageshow',event=>{if(event.persisted||unloading)location.reload();});
window.addEventListener('online',()=>{if(activeSkill)savePractice();else if(session&&!session.submittedAt&&sampleReady)saveDraft();});
if(!window.K67_READINESS_BOOT_ERROR){
  startChecks();
  window.dispatchEvent(new Event('k67-readiness-started'));
  await initialize();
}
