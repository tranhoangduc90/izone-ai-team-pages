/* Prototype đầy đủ bài luyện nén: nhận đề riêng tư qua máy chủ localhost.
   Chỉ lưu nháp trên thiết bị; chấm và danh tính đều là mô phỏng có nhãn rõ.
   Không gọi Google, AI, n8n hoặc API production. Lỗi lưu/tải luôn được hiện ra. */
'use strict';
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const explanation = document.querySelector('#explanation-dialog');
const query = new URLSearchParams(location.search);
const serverClient=window.ReadingServerClient;
const serverMode=!!serverClient;
const teacher = query.get('teacher') === '1';
const storageKey = 'izone:reading-skills67:materials-mi:prototype:v1';
let content, fixture, state, history = [], scenario = query.get('scenario') || 'current';
let mobilePane = 'passage', activeQuestion = 1, lastTrigger = null, explanationIndex = 0;
let scale = 100, generalNotesOpen = false, toastTimer, storageAvailable = true;
let latestServerAttempt=null;
const panePositions = {passage: 0, questions: 0};
const statusNames = {correct: 'Đúng', partial: 'Đúng một phần', incorrect: 'Cần sửa', blank: 'Bỏ trống'};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHtml;
function newState(){ return {id:crypto.randomUUID(), answers:{}, flags:[], annotations:[], notes:'', status:'draft', savedAt:null}; }
function readStorage(){
  try {const stored=JSON.parse(localStorage.getItem(storageKey)||'null');history=stored?.history||[];return stored?.draft||newState();}
  catch {storageAvailable=false;return newState();}
}
let originalDraft = readStorage();
function toast(text){const t=document.querySelector('#toast');t.textContent=text;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,4300);}
function persist(){
  if(teacher)return false;
  if(serverMode)return serverClient.schedule(state);
  if(state.status==='draft')promoteDraft();
  state.savedAt=new Date().toISOString();
  try {
    if(state.isSample)localStorage.setItem(storageKey+':sample',JSON.stringify(state));
    else originalDraft=structuredClone(state);
    localStorage.setItem(storageKey,JSON.stringify({draft:originalDraft,history}));storageAvailable=true;
  }
  catch {storageAvailable=false;}
  updateProgress();return storageAvailable;
}
function promoteDraft(){
  scenario=state.isSample?'sample-current':'current';
  const url=new URL(location.href);if(state.isSample)url.searchParams.set('scenario','sample-current');else url.searchParams.delete('scenario');window.history.replaceState(null,'',url);
  const picker=document.querySelector('#scenario');if(picker)picker.value=state.isSample?'draft':'current';
}
function normalize(value){return String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();}
function filled(target){const v=normalize(state.answers[target.id]);return !!v&&!content.blankValues.map(normalize).includes(v)&&!content.dropdownPlaceholders.map(normalize).includes(v);}
function completed(){if(serverMode&&state?.serverAttempt)return state.serverAttempt.completeness.filled_cells;if(serverMode&&state?.status==='draft'&&serverClient.state.status==='saved'&&serverClient.state.completeness)return serverClient.state.completeness.filled_cells;return content.targets.filter(filled).length;}
function timeLabel(iso){return iso?new Date(iso).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'chưa lưu';}
function isResult(){return state.status==='review';}
function writable(){return !teacher&&state?.status==='draft';}
window.ReadingInteractionBridge={current:()=>state,scope:()=>content?.version+':'+state?.id,writable,save:persist,showPane:setMobilePane,closeGeneralNotes:()=>{generalNotesOpen=false;document.querySelector('#notes-panel')?.setAttribute('hidden','');}};
function feedbackHtml(id){
  if(!isResult())return '';
  const f=state.feedback?.[id];if(!f)return '';
  return `<div class="feedback ${e(f.status)}" data-feedback="${e(id)}"><div class="feedback-head"><strong>${e(statusNames[f.status])}</strong><button data-explain="${e(id)}">Xem giải thích</button></div><p>${e(f.reason)}</p></div>`;
}
function field(id,label,kind){
  const value=state.answers[id]||'';
  const dom='answer-'+id.replaceAll('.','-');
  return `<div class="answer-field ${kind==='paragraph'?'field-paragraph':''}" data-field="${e(id)}"><label for="${dom}">${e(label)}<span class="field-indicator" data-indicator="${e(id)}">${value?'Đã điền':'Chưa điền'}</span></label><textarea id="${dom}" data-target="${e(id)}" rows="${kind==='radar'?2:3}" placeholder="${kind==='radar'?'Tự xác định loại thông tin, đối tượng và đặc điểm…':'Viết bản nén của bạn…'}" ${writable()?'':'readonly'}>${e(value)}</textarea>${feedbackHtml(id)}</div>`;
}
function paragraphHtml(p){return `<section class="passage-block" id="paragraph-${p.id}"><div class="paragraph-heading"><span class="paragraph-letter cbt-paragraph-label">${p.id}</span><h3>ĐOẠN ${p.id}</h3></div><div class="passage-text cbt-reading-passage" data-annotation-root-key="materials-paragraph-${p.id}" data-question-numbers="1 2 3 4">${p.text.split('\n\n').map(t=>`<p>${e(t)}</p>`).join('')}</div>${field(p.target,`Nén cấp 1 đoạn ${p.id}`,'paragraph')}</section>`;}
function questionHtml(q){
  const flagged=state.flags.includes(q.number),val=state.answers[q.targets.section]||'';
  return `<section class="question-block" id="question-${q.number}" data-question-number="${q.number}"><div class="question-top"><span class="question-number cbt-question-number">${q.number}</span><p class="question-text cbt-reading-questions" data-annotation-root-key="materials-question-${q.number}" data-question-number="${q.number}">${e(q.text)}</p><button class="flag-button" data-flag="${q.number}" aria-label="Đánh dấu câu ${q.number}" aria-pressed="${flagged}" ${writable()?'':'disabled'}>⚑</button></div><div class="answer-field"><label for="answer-${q.targets.radar.replaceAll('.','-')}">Nén thông tin câu hỏi</label><p class="syntax">Theo cú pháp <strong>[PHÂN LOẠI THÔNG TIN] Đối tượng : Đặc điểm</strong></p><div class="source-hint"><strong>Gợi ý từ đề</strong>\n${e(q.hint)}</div></div>${field(q.targets.radar,'Bản nén của bạn','radar')}${field(q.targets.evidence_l1,'Nén cấp 1 câu chứa thông tin trong bài đọc','evidence')}<div class="selection-field"><label for="answer-${q.targets.section.replaceAll('.','-')}">Đáp án (tên đoạn văn)</label><select id="answer-${q.targets.section.replaceAll('.','-')}" data-target="${e(q.targets.section)}" ${writable()?'':'disabled'}><option value="">Nhấn để chọn</option>${'ABCDEFGH'.split('').map(l=>`<option value="${l}" ${val===l?'selected':''}>Đoạn ${l}</option>`).join('')}</select></div><button class="quiet jump-selected" data-view-selected="${q.number}" ${val?'':'hidden'}>Xem đoạn đã chọn ↗</button>${feedbackHtml(q.targets.section)}</section>`;
}
function summaryHtml(){
  if(!isResult())return '';
  const sections=content.targets.filter(t=>t.kind==='section');
  const correct=sections.filter(t=>state.feedback?.[t.id]?.status==='correct').length;
  return `<div class="result-summary"><div><strong>${correct}/4</strong><p>Matching Information</p></div><div><strong>16 phần nén</strong><p>Phản hồi riêng dưới từng ô</p><small>Không quy đổi band IELTS</small></div></div>`;
}
function render(){
  if(!content)return;
  if(scenario==='entry'){renderEntry();return;}
  app.innerHTML=`<div class="lesson-head"><div><h1>${e(content.title)}</h1><div class="lesson-meta"><span>Matching Information · Câu 1–4</span><span>Nén cấp 1</span><span>8 đoạn đọc</span></div></div><div class="learner"><strong>Học viên minh họa</strong><span>· Lớp 6.0–7.0</span><button class="quiet" data-action="identity">Đổi người</button></div></div>${teacher?'<div class="notice teacher-notice"><strong>Giảng viên · Chỉ xem bản minh họa.</strong> Chưa kiểm đăng nhập hoặc quyền lớp thật. Nháp lưu lúc '+timeLabel(state.savedAt)+'.</div>':''}${isResult()?'<div class="notice result-note"><strong>Phản hồi mô phỏng để duyệt giao diện.</strong> Bài minh họa riêng; chưa gọi AI, ghi Docs hoặc tính điểm thật.</div>':''}${state.status==='waiting'?'<div class="notice waiting-card"><span class="spinner"></span><span><strong>Đang chờ chấm · Mô phỏng</strong><br>Bản gửi được giữ riêng. <button class="quiet" data-action="show-result">Xem kết quả mô phỏng →</button></span></div>':''}<div class="mobile-tabs" role="tablist" aria-label="Vùng làm bài"><button role="tab" id="tab-passage" aria-controls="pane-passage" aria-selected="${mobilePane==='passage'}" data-pane="passage">Bài đọc & nén đoạn</button><button role="tab" id="tab-questions" aria-controls="pane-questions" aria-selected="${mobilePane==='questions'}" data-pane="questions">Câu hỏi 1–4</button></div><div class="study-grid"><section class="study-pane ${mobilePane==='passage'?'active':''}" id="pane-passage" aria-label="Bài đọc và nén đoạn"><div class="pane-heading"><div><h2>Bài đọc & nén đoạn</h2><small>Đọc từng đoạn, tự viết bản nén</small></div><nav class="pane-jumps" aria-label="Chuyển đoạn">${content.paragraphs.map(p=>`<button data-paragraph="${p.id}" aria-label="Đến đoạn ${p.id}">${p.id}</button>`).join('')}</nav></div><div class="pane-scroll" id="scroll-passage"><button class="mobile-return" data-action="return-question" hidden>← Về câu đang làm</button><div class="source-intro"><h2>${e(content.title)}</h2><p>${e(content.subtitle)}</p></div>${content.paragraphs.map(paragraphHtml).join('')}</div></section><section class="study-pane ${mobilePane==='questions'?'active':''}" id="pane-questions" aria-label="Câu hỏi Matching Information"><div class="pane-heading"><div><h2>Matching Information</h2><small>Nén câu hỏi · tìm thông tin · chọn đoạn</small></div><nav class="pane-jumps" aria-label="Chuyển câu hỏi">${content.questions.map(q=>`<button data-question="${q.number}" class="${state.flags.includes(q.number)?'flagged':''}" aria-label="Đến câu ${q.number}">${q.number}</button>`).join('')}</nav></div><div class="pane-scroll" id="scroll-questions">${summaryHtml()}<p class="question-instruction">${e(content.instruction)}</p>${content.questions.map(questionHtml).join('')}<p class="minimum-note">Bài có 20 phần trả lời. Bạn có thể đổi qua lại giữa câu hỏi và bài đọc.</p></div></section></div><footer class="study-footer"><div class="progress-area"><div class="progress-label" id="progress-label"></div><div class="progress-track"><span id="progress-bar"></span></div></div><span class="save-state" id="save-state" aria-live="polite"></span><div class="footer-tools"><div class="font-control"><button class="quiet" data-font="-10" aria-label="Giảm cỡ chữ">A−</button><span id="font-scale">${scale}%</span><button class="quiet" data-font="10" aria-label="Tăng cỡ chữ">A+</button></div><button class="quiet notes-button" data-action="notes">Ghi chú</button><button class="quiet history-button" data-action="history">Lịch sử</button><button class="quiet" data-action="review">Rà soát</button>${teacher?'<span class="quiet">Chỉ xem</span>':isResult()?'<button class="primary" data-action="edit">Sửa bài</button>':state.status==='waiting'?'<button class="secondary" data-action="show-result">Xem mẫu</button>':'<button class="primary" id="grade-button" data-action="grade">Chấm bài</button>'}</div></footer><aside id="notes-panel" class="general-notes" hidden><header><strong>Ghi chú của bạn</strong><button class="close-button" data-action="close-notes" aria-label="Đóng ghi chú">×</button></header><div class="homework-notes"><label for="general-note">Chọn chữ trong bài đọc hoặc câu hỏi để Highlight / Note.</label><textarea id="general-note" placeholder="Ghi chú chung cho bài…" ${writable()?'':'readonly'}>${e(state.notes||'')}</textarea></div></aside>`;
  app.removeAttribute('aria-busy');
  document.querySelector('#scenario').value=scenario==='sample-current'?'draft':scenario;
  updateProgress();
  if(serverMode)adaptServerScreen();
  document.querySelectorAll('textarea[data-target]').forEach(autoGrow);
  requestAnimationFrame(()=>window.ReadingAnnotations?.install());
}
function autoGrow(input){input.style.height='auto';input.style.height=Math.max(80,input.scrollHeight+2)+'px';}
function updateProgress(){
  if(!content||!state)return;
  const count=completed();
  const label=document.querySelector('#progress-label');if(label)label.textContent=`Đã điền ${count}/20 phần`;
  const bar=document.querySelector('#progress-bar');if(bar)bar.style.width=(count/20*100)+'%';
  const save=document.querySelector('#save-state');if(save)save.textContent=storageAvailable?(state.savedAt?`Đã lưu trên thiết bị · ${timeLabel(state.savedAt)}`:'Lưu tự động trên thiết bị'):'Chưa lưu được · Giữ trang đang mở';
  const grade=document.querySelector('#grade-button');if(grade)grade.setAttribute('aria-description',count<16?`Cần thêm ${16-count} phần để đủ điều kiện chấm`:'Đã đủ 16 phần để chấm');
  content.targets.forEach(t=>{const el=document.querySelector('[data-indicator="'+t.id+'"]');if(el)el.textContent=filled(t)?'Đã điền':'Chưa điền';});
  if(serverMode)adaptServerSave();
}
function setMobilePane(pane){
  const mobile=matchMedia('(max-width:800px), (max-width:1000px) and (max-height:500px)').matches;
  if(mobile&&mobilePane!==pane){panePositions[mobilePane]=scrollY;mobilePane=pane;}
  document.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.pane===pane)));
  document.querySelectorAll('.study-pane').forEach(p=>p.classList.toggle('active',p.id==='pane-'+pane));
  if(mobile)scrollTo({top:panePositions[pane]||0,behavior:'instant'});
}
function jumpTo(kind,value){
  const pane=kind==='paragraph'?'passage':'questions';
  if(kind==='question')activeQuestion=Number(value);
  setMobilePane(pane);
  const target=document.querySelector('#'+kind+'-'+value);
  requestAnimationFrame(()=>{target?.scrollIntoView({block:'start',behavior:'instant'});target?.classList.remove('highlight-arrival');requestAnimationFrame(()=>target?.classList.add('highlight-arrival'));});
}
function jumpField(id){const t=content.targets.find(t=>t.id===id);if(!t)return;jumpTo(t.kind==='paragraph'?'paragraph':'question',t.paragraph||t.question);setTimeout(()=>document.querySelector('[data-target="'+id+'"]')?.focus({preventScroll:true}),40);}
function showModal(title,body,actions=''){
  lastTrigger=document.activeElement;
  modal.innerHTML=`<div class="dialog-top"><h2 id="modal-title">${e(title)}</h2><button class="close-button" data-close-modal aria-label="Đóng">×</button></div>${body}${actions?'<div class="dialog-actions">'+actions+'</div>':''}`;
  modal.showModal();
}
function closeModal(){modal.close();}
function focusHistoryDestination(){
  if(document.documentElement.dataset.izoneTheme!=='master170'||document.body.dataset.m170Product!=='materials'||document.activeElement!==document.body)return;
  const heading=app.querySelector('h1');if(!heading)return;
  heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'nearest',behavior:'instant'});
}
function review(){
  const groups=[['Nén thông tin câu hỏi','radar'],['Nén câu chứa thông tin','evidence_l1'],['Đáp án Matching Information','section'],['Nén các đoạn A–H','paragraph']];
  showModal('Rà soát bài làm',`<p>Đã điền <strong>${completed()}/20 phần</strong>. ${completed()<16?'Cần thêm '+(16-completed())+' phần để đủ 80%.':'Đã đủ khối lượng để chấm; phần bỏ trống vẫn được giữ.'}</p><div class="review-groups">${groups.map(([label,kind])=>`<div class="review-group"><h3>${label}</h3><div class="review-items">${content.targets.filter(t=>t.kind===kind).map(t=>`<button data-jump-field="${t.id}" class="${filled(t)?'filled':''} ${state.flags.includes(t.question)?'flagged':''}" data-status="${filled(t)?'✓':'Trống'}" aria-label="${e(t.label)}">${t.paragraph||t.question}</button>`).join('')}</div></div>`).join('')}</div><p class="minimum-note">Chữ được tô là phần đã điền, chưa phải kết quả đúng. ⚑ là câu bạn muốn xem lại.</p>`,writable()?'<button class="primary" data-action="grade">Chấm bài</button>':'');
}
function grade(){
  if(serverMode)return serverGrade();
  closeModal();
  if(completed()<16){review();return;}
  persist();
  showModal('Xem luồng chấm trong prototype',`<p>Bạn đã điền ${completed()}/20 phần. Bộ chấm thật chưa được nối ở chặng này.</p><p>Để xem trạng thái chờ và phản hồi, prototype sẽ mở <strong>một bài làm minh họa riêng</strong>. Bài bạn vừa nhập vẫn được lưu trên thiết bị.</p>`, '<button class="secondary" data-close-modal>Tiếp tục bài của tôi</button><button class="primary" data-action="simulate">Xem mô phỏng chấm</button>');
}
async function getFixture(){if(!fixture){const r=await fetch('/__prototype__/review');if(!r.ok)throw Error('Không tải được phản hồi minh họa');fixture=await r.json();}return fixture;}
async function changeScenario(next){
  if(state&&writable()&&state.savedAt)persist();
  scenario=next;
  const nextUrl=new URL(location.href);if(next==='current')nextUrl.searchParams.delete('scenario');else nextUrl.searchParams.set('scenario',next);window.history.replaceState(null,'',nextUrl);
  if(next==='current')state=structuredClone(originalDraft);
  else if(next==='empty'||next==='entry')state=newState();
  else {
    const f=await getFixture();state=newState();state.isSample=true;state.answers=structuredClone(f.answers);state.savedAt=new Date().toISOString();
    if(next==='draft'){for(const t of content.targets.slice(-4))state.answers[t.id]='';state.flags=[4];}
    if(next==='waiting')state.status='waiting';
    if(next==='review'){state.status='review';state.feedback=structuredClone(f.feedback);}
  }
  panePositions.passage=0;panePositions.questions=0;render();scrollTo(0,0);
}
function renderEntry(){
  app.innerHTML=`<section class="entry"><div><p class="eyebrow">READING 67 · LUYỆN KỸ NĂNG</p><h1>${e(content.title)}</h1><p>Đọc để hiểu ý. Nén để giữ điều cốt lõi.</p><small>Matching Information · Câu 1–4<br>8 đoạn đọc · 20 phần trả lời</small></div><div class="entry-card"><h2>Bài luyện của bạn</h2><p>Học viên minh họa · Lớp 6.0–7.0</p><ol><li>Nén cấp 1 các đoạn A–H.</li><li>Nén thông tin của từng câu hỏi.</li><li>Tìm và nén câu chứa thông tin.</li><li>Chọn đoạn A–H cho câu 1–4.</li></ol><p class="minimum-note">Đổi qua lại tự do. Đủ 16/20 phần để chấm. Bài luyện không có đồng hồ đếm ngược.</p><button class="primary" data-action="start">Bắt đầu làm bài</button><button class="quiet" data-action="history">Xem lịch sử minh họa</button></div></section>`;app.removeAttribute('aria-busy');
}
function explanationFor(id,trigger){
  explanationIndex=content.targets.findIndex(t=>t.id===id);if(explanationIndex<0)return;
  const t=content.targets[explanationIndex],f=state.feedback?.[id];if(!f)return;
  const opening=!explanation.open;
  if(opening)lastTrigger=trigger||document.activeElement;
  const q=content.questions.find(q=>q.number===t.question);
  const section=t.paragraph||fixture.answers[q?.targets.section]||'A';
  const p=content.paragraphs.find(p=>p.id===section);
  const radar=t.kind==='radar';
  explanation.innerHTML=`<div class="explanation-dialog-shell"><header class="explanation-dialog-header"><div><p class="kicker">PHẢN HỒI MÔ PHỎNG</p><h2 id="explanation-dialog-title">${e(t.label)}</h2></div><button class="explanation-dialog-close" data-close-explanation aria-label="Đóng giải thích">×</button></header><div class="explanation-dialog-columns"><section class="explanation-dialog-passage"><div class="explanation-dialog-pane-head"><strong>Nguồn đối chiếu</strong><span>${radar?'Câu hỏi '+q.number:'Đoạn '+section}</span></div><div class="explanation-dialog-passage-scroll">${q?'<h3>Câu '+q.number+'</h3><div class="evidence-box">'+e(q.text)+'</div>':''}<h3 style="font-size:14px;margin-top:22px">${e(content.title)}</h3>${content.paragraphs.map(pp=>`<div class="popup-paragraph ${pp.id===section&&!radar?'explanation-active-paragraph':''}" data-popup-paragraph="${pp.id}"><strong>${pp.id}</strong>${pp.text.split('\n\n').map(s=>'<p>'+e(s)+'</p>').join('')}</div>`).join('')}</div></section><section class="explanation-dialog-detail"><div class="explanation-dialog-detail-scroll"><div class="notice">Ví dụ để duyệt cách đọc nhận xét. Chưa có kết quả AI thật.</div><div class="explanation-dialog-answer"><span>Kết quả minh họa</span><strong>${e(statusNames[f.status])}</strong></div><h3>Bài làm minh họa</h3><div class="answer-copy">${e(state.answers[id]||'Chưa trả lời')}</div><h3>Vì sao?</h3><p>${e(f.reason)}</p><h3>Mẫu đối chiếu từ bộ chấm đang dùng</h3><div class="evidence-box">${e(f.modelAnswer)}</div><h3>Bước nên sửa / kiểm lại</h3><p>${e(f.nextStep)}</p><p class="minimum-note">Màu nền là lớp trình bày của prototype, không phải màu gốc của tài liệu.</p><div class="dialog-stepper"><button class="secondary" data-explain-offset="-1" ${explanationIndex===0?'disabled':''}>← Phần trước</button><span>${explanationIndex+1}/20</span><button class="secondary" data-explain-offset="1" ${explanationIndex===19?'disabled':''}>Phần sau →</button></div></div></section></div></div>`;
  if(serverMode){
    explanation.querySelector('.kicker').textContent='PHẢN HỒI READ 67';
    explanation.querySelector('.notice').textContent='Kết quả thật của bản đã gửi #'+state.serverAttempt.draftRevision+'. Bài đang chỉnh được lưu thành nháp riêng.';
    explanation.querySelector('.explanation-dialog-answer span').textContent='Kết quả bộ chấm';
    for(const h of explanation.querySelectorAll('h3'))if(h.textContent==='Bài làm minh họa')h.textContent='Bài bạn đã gửi';
    explanation.querySelector('.minimum-note').textContent='Màu nền là lớp trình bày giúp đối chiếu nguồn và bản nén.';
  }
  if(opening)explanation.showModal();
  explanation.querySelector('[data-close-explanation]').focus({preventScroll:true});
  requestAnimationFrame(()=>{if(!radar){const el=explanation.querySelector('[data-popup-paragraph="'+section+'"]');const scroll=explanation.querySelector('.explanation-dialog-passage-scroll');if(el)scroll.scrollTop=el.offsetTop-scroll.offsetTop-12;}});
}
function historyModal(){
  if(serverMode){serverHistoryModal();return;}
  const items=[...history];
  if(isResult())items.push({id:'current-sample',title:'Bài làm minh họa · Phản hồi mẫu',createdAt:state.savedAt,answers:state.answers,feedback:state.feedback});
  showModal('Lịch sử trên thiết bị',`<p>Chỉ có dữ liệu của bản xem giao diện trên trình duyệt này.</p><div class="history-list">${items.length?items.map((s,i)=>`<div class="history-row"><div><strong>${e(s.title||'Lần làm '+(i+1))}</strong><small>${e(timeLabel(s.createdAt))} · ${s.feedback?'Có phản hồi mô phỏng':'Nháp lưu trên thiết bị'}</small></div><button class="secondary" data-history="${i}">Xem lại</button></div>`).join(''):'<p>Chưa có lượt lưu trong lịch sử. Bài đang làm vẫn được giữ riêng.</p>'}</div><div class="dialog-actions"><button class="secondary" data-close-modal>Đóng</button>${teacher?'':'<button class="primary" data-action="reset">Làm lại từ đầu</button>'}</div>`);
  modal._historyItems=items;
}
function toggleNotes(){generalNotesOpen=!generalNotesOpen;document.querySelector('#notes-panel').hidden=!generalNotesOpen;window.ReadingAnnotations?.refreshNotes();if(generalNotesOpen)document.querySelector('#general-note')?.focus();}
async function action(name){
  if(serverMode&&['identity','edit','reset','confirm-reset','server-return-draft'].includes(name)){await serverAction(name);return;}
  if(name==='review')review();
  if(name==='grade')grade();
  if(name==='simulate'){closeModal();await changeScenario('waiting');}
  if(name==='show-result')await changeScenario('review');
  if(name==='notes')toggleNotes();
  if(name==='close-notes'){generalNotesOpen=false;document.querySelector('#notes-panel').hidden=true;}
  if(name==='history')historyModal();
  if(name==='start'){scenario='current';state=structuredClone(originalDraft);render();}
  if(name==='identity')showModal('Danh tính minh họa','<p>Chặng 1 dùng một học viên mẫu để duyệt giao diện. Nhận diện và đổi người thật sẽ được nối ở chặng tích hợp.</p>','<button class="primary" data-close-modal>Quay lại bài</button>');
  if(name==='return-question'){document.querySelector('.mobile-return').hidden=true;jumpTo('question',activeQuestion);}
  if(name==='edit'){history.push({id:state.id,title:'Phản hồi minh họa trước khi sửa',createdAt:state.savedAt,answers:structuredClone(state.answers),feedback:structuredClone(state.feedback)});state.status='draft';delete state.feedback;promoteDraft();persist();render();toast('Đang sửa bản minh họa riêng. Bài bạn tự nhập được giữ ở Bài đang làm.');}
  if(name==='reset'){closeModal();showModal('Làm lại từ đầu?','<p>Bản đang làm được đưa vào lịch sử trên thiết bị. Một bản trống mới sẽ được mở; không xóa kết quả cũ.</p>','<button class="secondary" data-close-modal>Giữ bài hiện tại</button><button class="primary" data-action="confirm-reset">Tạo lượt mới</button>');}
  if(name==='confirm-reset'){closeModal();history.push({id:state.id,title:'Bản trước khi làm lại',createdAt:state.savedAt,answers:structuredClone(state.answers),feedback:state.feedback});state=newState();scenario='current';persist();originalDraft=structuredClone(state);render();}
}
document.addEventListener('input',event=>{
  const target=event.target;
  if(target.matches('[data-target]')&&writable()){promoteDraft();state.answers[target.dataset.target]=target.value;if(target.tagName==='TEXTAREA')autoGrow(target);persist();}
  if(target.id==='general-note'&&writable()){state.notes=target.value;persist();}
});
document.addEventListener('change',async event=>{
  if(event.target.id==='scenario'){try{await changeScenario(event.target.value);}catch(err){toast(err.message);}}
  if(event.target.matches('select[data-target]')&&writable()){promoteDraft();state.answers[event.target.dataset.target]=event.target.value;persist();const q=content.questions.find(q=>q.targets.section===event.target.dataset.target);const link=document.querySelector('[data-view-selected="'+q.number+'"]');link.hidden=!event.target.value;}
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  try{
    if(button.dataset.action)await action(button.dataset.action);
    if(button.hasAttribute('data-close-modal'))closeModal();
    if(button.hasAttribute('data-close-explanation'))explanation.close();
    if(button.dataset.pane)setMobilePane(button.dataset.pane);
    if(button.dataset.paragraph)jumpTo('paragraph',button.dataset.paragraph);
    if(button.dataset.question)jumpTo('question',button.dataset.question);
    if(button.dataset.flag&&writable()){const n=Number(button.dataset.flag);state.flags=state.flags.includes(n)?state.flags.filter(x=>x!==n):[...state.flags,n];button.setAttribute('aria-pressed',String(state.flags.includes(n)));document.querySelector('[data-question="'+n+'"]')?.classList.toggle('flagged',state.flags.includes(n));persist();}
    if(button.dataset.font){scale=Math.max(90,Math.min(120,scale+Number(button.dataset.font)));document.documentElement.style.setProperty('--reading-scale',scale/100);document.querySelector('#font-scale').textContent=scale+'%';document.querySelectorAll('textarea[data-target]').forEach(autoGrow);}
    if(button.dataset.jumpField){closeModal();jumpField(button.dataset.jumpField);}
    if(button.dataset.viewSelected){activeQuestion=Number(button.dataset.viewSelected);const q=content.questions.find(q=>q.number===activeQuestion);const p=state.answers[q.targets.section];if(p){jumpTo('paragraph',p);document.querySelector('.mobile-return').hidden=false;}}
    if(button.dataset.explain)explanationFor(button.dataset.explain,button);
    if(button.dataset.explainOffset){explanationIndex+=Number(button.dataset.explainOffset);explanationFor(content.targets[explanationIndex].id);}
    if(button.dataset.history){const snapshot=modal._historyItems[Number(button.dataset.history)];closeModal();state={...newState(),isSample:!!snapshot.feedback,answers:structuredClone(snapshot.answers),feedback:snapshot.feedback,status:snapshot.feedback?'review':'history',savedAt:snapshot.createdAt};render();focusHistoryDestination();}
    if(button.dataset.serverAttempt){closeModal();const attempt=await serverClient.getAttempt(button.dataset.serverAttempt);trackServerAttempt(attempt);focusHistoryDestination();}
    if(button.dataset.serverArchive){const archived=modal._serverArchives[Number(button.dataset.serverArchive)];closeModal();serverClient.stopPoll();state={...newState(),...structuredClone(archived.body),status:'history',savedAt:archived.savedAt,archived};render();focusHistoryDestination();}
    if(button.dataset.previewPerson)await serverClient.changePerson(button.dataset.previewPerson);
    if(button.id==='teacher'){
      if(serverMode&&serverClient.identity){
        const target=new URL('./',location.href),person=serverClient.identity;
        target.searchParams.set('server','1');target.searchParams.set('teacher','1');target.searchParams.set('classId',person.courseId);target.searchParams.set('studentRef',person.ownerId);
        if(state.serverAttempt)target.searchParams.set('attemptId',state.serverAttempt.attemptId);
        window.open(target.href,'_blank','noopener');
      }else if(serverMode)window.open('teacher.html','_blank','noopener');
      else window.open(location.pathname+'?teacher=1&scenario=draft','_blank','noopener');
    }
  }catch(err){toast('Chưa thực hiện được: '+err.message);}
});
for(const dialog of [modal,explanation]){
  let pressedOutside=false;
  function outside(ev){const r=dialog.getBoundingClientRect();return ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom;}
  dialog.addEventListener('pointerdown',ev=>pressedOutside=ev.target===dialog&&outside(ev));
  dialog.addEventListener('pointerup',ev=>{if(pressedOutside&&ev.target===dialog&&outside(ev))dialog.close();pressedOutside=false;});
  dialog.addEventListener('close',()=>{
    if(document.documentElement.dataset.izoneTheme==='master170'&&document.body.dataset.m170Product==='materials'&&document.activeElement!==document.body&&!dialog.contains(document.activeElement))return;
    lastTrigger?.focus({preventScroll:true});
  });
}
document.addEventListener('focusin',event=>{const q=event.target.closest('.question-block');if(q)activeQuestion=Number(q.dataset.questionNumber);});
window.addEventListener('online',()=>{if(serverMode){serverClient.flush().catch(()=>{});toast('Đã có mạng. Đang thử lưu phần chưa gửi lên máy chủ.');}else toast('Đã có mạng. Prototype vẫn lưu bài trên thiết bị.');});
window.addEventListener('offline',()=>toast('Đang ngoại tuyến. Bản đang viết được giữ trên thiết bị.'));
async function bootstrap(){
  try{
    if(serverMode){
      const loaded=await serverClient.initialize();content=loaded.content;scenario='current';state={...newState(),...loaded.draft.body,id:'draft-'+loaded.identity.ownerId,status:'draft',savedAt:loaded.draft.savedAt};render();
      if(loaded.restored){toast('Đã khôi phục bản chưa gửi từ thiết bị; đang lưu lên máy chủ.');serverClient.flush().catch(()=>{});}
      const requested=query.get('attemptId')||query.get('attempt')||(loaded.config?.demo&&query.get('demoReview')==='1'&&query.get('view')!=='draft'?loaded.history.find(a=>a.status==='done')?.attemptId:null);
      const pending=loaded.history.find(a=>['queued','processing'].includes(a.status));
      if(requested||(!teacher&&pending&&!loaded.restored))trackServerAttempt(await serverClient.getAttempt(requested||pending.attemptId));
      return;
    }
    const response=await fetch('/__prototype__/content');if(!response.ok)throw Error('Không đọc được đề riêng tư.');content=await response.json();
    if(scenario==='sample-current'){const saved=localStorage.getItem(storageKey+':sample');if(saved){state=JSON.parse(saved);render();}else await changeScenario('draft');}
    else if(['draft','waiting','review','empty','entry'].includes(scenario))await changeScenario(scenario);else{scenario='current';state=structuredClone(originalDraft);render();}
  }catch(err){app.innerHTML='<section class="notice" style="margin-top:30px"><h2>Chưa mở được bài</h2><p>'+e(err.message)+'</p><p>'+(serverMode?'Kiểm tra tài khoản, quyền lớp hoặc kết nối rồi tải lại trang.':'Hãy mở bằng máy chủ prototype trên máy này, rồi tải lại trang.')+'</p></section>';app.removeAttribute('aria-busy');}
}
bootstrap();

// Nhánh máy chủ thật giữ renderer chặng 1, thay nguồn nháp/lượt/phản hồi.
function adaptServerSave(){
  const target=document.querySelector('#save-state');if(!target)return;
  const saved=serverClient.state;
  target.textContent=saved.conflict?'Xung đột bản lưu · Bài trên máy vẫn được giữ':saved.status==='saving'?'Đang lưu lên máy chủ…':saved.status==='dirty'?'Có thay đổi chưa lưu máy chủ':saved.status==='error'?'Chưa lưu máy chủ · Giữ bản trên thiết bị':saved.savedAt?'Đã lưu máy chủ · '+timeLabel(saved.savedAt):'Chưa nhập bài · Máy chủ sẵn sàng';
  target.dataset.saveStatus=saved.status;
  if(!teacher&&saved.homework&&saved.homework.status!=='not_started'){
    let notice=document.querySelector('.homework-sync');if(!notice){notice=document.createElement('div');notice.className='notice homework-sync';notice.setAttribute('role','status');document.querySelector('.lesson-head')?.after(notice);}
    const h=saved.homework,blocked=h.status==='blocked'||h.jobs?.some(j=>j.status==='blocked'),missing=h.jobs?.some(j=>j.errorCode==='HOMEWORK_NOT_FOUND');
    notice.textContent=blocked?'Bài đã được giữ trên máy chủ. Chưa đồng bộ được Homework; giảng viên cần kiểm tra.':h.status==='verified'&&h.cta==='verified'?'Đã cập nhật trạng thái và link vào Homework.':missing?'Bài đã lưu. Chưa có Homework cá nhân đúng mã; hệ thống sẽ nối khi được giao.':h.status==='unavailable'?'Chưa kiểm được trạng thái đồng bộ Homework. Xem trạng thái lưu bài ở thanh trên.':'Bài đã lưu. Đang đồng bộ trạng thái vào Homework.';
  }
  if(state.archived)target.textContent='Nháp cũ · Lưu lúc '+timeLabel(state.savedAt)+' · Chỉ xem';
}
function adaptServerScreen(){
  const strip=document.querySelector('.prototype-strip');strip.querySelector('span').innerHTML='<strong>BẢN THỬ · BỘ CHẤM THẬT</strong> · Nháp và phản hồi lưu máy chủ';strip.querySelector('label').hidden=true;
  const config=serverClient.access?.config;
  if(config)strip.querySelector('span').innerHTML='<strong>'+(config.demo?'DEMO · TÀI KHOẢN GIẢ':'BẢN THỬ · NHẬN DIỆN HỌC VIÊN')+'</strong> · '+(teacher?'Giảng viên chỉ xem · ':'')+'Nháp và phản hồi lưu máy chủ';
  const learner=document.querySelector('.learner');if(learner)learner.innerHTML='<strong>'+e(serverClient.identity.name)+'</strong><span>· '+e(serverClient.identity.className)+'</span>'+(teacher?'':'<button class="quiet" data-action="identity">'+(config?'Đổi người học':'Đổi người thử')+'</button>');
  const teacherNotice=document.querySelector('.teacher-notice');if(teacherNotice)teacherNotice.textContent='Giảng viên · Chỉ xem bài đã lưu. Lưu lúc '+timeLabel(state.savedAt)+'. Không nộp hoặc chấm thay học viên.';
  const result=document.querySelector('.result-note');if(result)result.textContent='Phản hồi Read 67 thật · Bản gửi #'+(state.serverAttempt?.draftRevision||'')+'. Bài được chấm đúng phiên bản đã gửi; sửa tiếp dùng nháp riêng.';
  if(result){
    const f=Object.values(state.feedback||{}),counts={correct:0,partial:0,incorrect:0,blank:0};f.forEach(v=>{if(v.status in counts)counts[v.status]++;});
    const problem=content.targets.find(t=>state.feedback[t.id]?.status!=='correct');
    result.innerHTML='<strong>Đã có bài chấm · Lượt làm '+(state.serverAttempt?.runNo||1)+'</strong><span> '+counts.correct+' đúng · '+counts.partial+' đúng một phần · '+counts.incorrect+' cần sửa · '+counts.blank+' bỏ trống</span>'+(problem?'<button class="quiet" data-jump-field="'+problem.id+'">Xem phần cần sửa ↓</button>':'')+(state.serverAttempt?.fromCache?'<small> Bài không đổi — dùng lại kết quả đã lưu.</small>':'');
  }
  const waiting=document.querySelector('.waiting-card');if(waiting)waiting.innerHTML='<span class="spinner"></span><span><strong>'+(latestServerAttempt?.status==='processing'?'Đang chấm bằng Read 67':'Đã nhận bài · Đang chờ chấm')+'</strong><br>Nhận xét sẽ được lưu trên máy chủ. <button class="quiet" data-action="server-return-draft">Tiếp tục chỉnh nháp →</button></span>';
  if(state.status==='waiting')document.querySelector('.footer-tools [data-action="show-result"]')?.setAttribute('hidden','');
  if(teacher){document.querySelector('.footer-tools [data-action="edit"]')?.remove();document.querySelector('#grade-button')?.remove();}
  else if(state.status==='draft'){const b=document.querySelector('#grade-button');if(b)b.textContent=serverClient.initialHistory?.attempts?.some(a=>a.status==='done')?'Chấm lại bản sửa':'Nộp bài để chấm';}
  if(state.status==='grading-error'){
    const notice=document.createElement('div');notice.className='notice server-error';notice.textContent='Chưa có phản hồi hoàn tất. '+(state.serverAttempt?.errorCode==='AI_OUTCOME_UNKNOWN'?'Chưa rõ kết quả gọi AI; cần đối chiếu trước khi gọi lại.':'Bộ chấm trả lỗi: '+(state.serverAttempt?.errorCode||'CHƯA XÁC ĐỊNH'));
    notice.dataset.state=(state.serverAttempt?.status==='needs_review'||state.serverAttempt?.errorCode==='AI_OUTCOME_UNKNOWN')?'attention':'error';
    document.querySelector('.lesson-head').after(notice);const b=document.querySelector('#grade-button');if(b){b.textContent='Quay lại nháp';b.dataset.action='server-return-draft';}
  }
  adaptServerSave();
}
async function serverGrade(){
  if(teacher||!writable())return;
  closeModal();
  const button=document.querySelector('#grade-button');if(button)button.disabled=true;
  try{await serverClient.flush();if(completed()<16){if(button)button.disabled=false;review();return;}trackServerAttempt(await serverClient.submit());}catch(error){toast('Chưa gửi chấm: '+error.message);if(button)button.disabled=false;}
}
// Reload hoặc lịch sử nối lại đúng job; phản hồi muộn chỉ nhắc khi đang sửa nháp.
function trackServerAttempt(attempt){
  showServerAttempt(attempt);serverClient.stopPoll();
  if(!['queued','processing'].includes(attempt.status))return;
  serverClient.poll(attempt.attemptId,value=>{
    if(value.status==='connection_error'){toast('Chưa đọc được tiến độ. Bản gửi vẫn giữ trên máy chủ; đang kết nối lại.');return;}
    latestServerAttempt=value;
    if(state.serverAttempt?.attemptId===value.attemptId&&state.status!=='draft')showServerAttempt(value);
    else if(value.status==='done')toast('Đã có phản hồi cho bản đã gửi. Mở Lịch sử để xem; nháp đang sửa được giữ.');
  });
}
function showServerAttempt(attempt){
  latestServerAttempt=attempt;
  state={...newState(),...attempt.snapshot,id:attempt.attemptId,serverAttempt:attempt,savedAt:attempt.createdAt,status:attempt.status==='done'?'review':['failed','needs_review'].includes(attempt.status)?'grading-error':'waiting'};
  if(attempt.result){state.feedback=attempt.result.feedback;fixture={answers:Object.fromEntries(content.targets.map(t=>[t.id,attempt.result.feedback[t.id]?.modelAnswer||'']))};}
  render();
}
async function serverHistoryModal(){
  try{const data=await serverClient.historyDetail(),attempts=data.attempts,archives=data.archives||[];
    const rows=attempts.map(a=>'<div class="history-row"><div><strong>Lượt '+(a.runNo||1)+' · Bản gửi #'+a.draftRevision+'</strong><small>'+new Date(a.createdAt).toLocaleString('vi-VN')+' · '+e(({done:'Đã có phản hồi',queued:'Đang chờ chấm',processing:'Đang chấm',failed:'Chấm lỗi',needs_review:'Cần đối chiếu'})[a.status]||a.status)+'</small></div><button class="secondary" data-server-attempt="'+a.attemptId+'">Xem</button></div>').join('');
    const drafts=archives.map((a,i)=>'<div class="history-row"><div><strong>Nháp trước khi làm lại · Lượt '+a.runNo+'</strong><small>'+new Date(a.savedAt).toLocaleString('vi-VN')+' · Chỉ xem</small></div><button class="secondary" data-server-archive="'+i+'">Xem nháp</button></div>').join('');
    showModal('Lịch sử đã lưu trên máy chủ',(data.firstCompleted?'<p>Lần hoàn thành đầu: lượt '+data.firstCompleted.runNo+' · '+new Date(data.firstCompleted.finishedAt).toLocaleString('vi-VN')+'</p>':'<p>Chưa có lần hoàn thành. Nháp hiện tại vẫn được lưu riêng.</p>')+'<div class="history-list">'+rows+drafts+'</div>','<button class="secondary" data-close-modal>Đóng</button><button class="primary" data-action="server-return-draft">Về nháp hiện tại</button>'+(!teacher?'<button class="secondary" data-action="reset">Làm lại từ đầu</button>':''));modal._serverArchives=archives;
  }catch(error){toast(error.message);}
}
async function serverAction(name){
  if(teacher&&name!=='server-return-draft')return;
  if(name==='identity'&&serverClient.access?.config){await serverClient.changeIdentity();return;}
  if(name==='identity'){showModal('Chọn học viên thử','<p>Đây là hai tài khoản thử cục bộ để kiểm nháp và phản hồi riêng. Chưa dùng đăng nhập hoặc roster production.</p>','<button class="secondary" data-preview-person="A">Học viên thử A</button><button class="primary" data-preview-person="B">Học viên thử B</button>');return;}
  if(name==='reset'){closeModal();showModal('Mở nháp trống mới?','<p>Giữ toàn bộ lượt đã gửi và phản hồi trên máy chủ. Nháp hiện tại sẽ được thay bằng bản trống sau khi lưu.</p>','<button class="secondary" data-close-modal>Giữ nháp</button><button class="primary" data-action="confirm-reset">Mở nháp trống</button>');return;}
  closeModal();
  if(name==='confirm-reset')await serverClient.reset();
  else await serverClient.flush();
  const draft=await serverClient.getDraft();scenario='current';state={...newState(),...draft.body,id:'draft-'+serverClient.identity.ownerId,status:'draft',savedAt:draft.savedAt};render();
  focusHistoryDestination();
  if(name==='edit')toast('Đang chỉnh nháp trên máy chủ. Bản đã chấm và phản hồi vẫn giữ riêng.');
}
window.addEventListener('reading67:server-state',()=>{if(serverMode&&content&&state)updateProgress();});
window.addEventListener('reading67:access-warning',event=>toast(event.detail));
