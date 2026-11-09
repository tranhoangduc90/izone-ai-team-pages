import runtime from './runtime-config.js';
import {frontendConfiguration,createOnlineAccess} from './online-access.js';
import {setupRichReview} from './rich-review.js';
import {basicSubmissionError} from './submission-check.js';
import {vietnameseWritingError} from './submission-language.js';
import { accountIdentity, loginViewHtml, studentHomeHtml, docsViewHtml, studentViewHtml, teacherListHtml, teacherReviewHtml, operatorViewHtml, operatorLibraryHtml, operatorReviewHtml } from './views.js';
import { setupLoginForm } from './login-form.js';
import { draftKey, loadBackup, saveBackup, flushBackups, listBackups } from './drafts.js';
import { setupFeedbackCards } from './feedback-cards.js';
import { feedbackTabsHtml, setupFeedbackTabs, teacherCommentsHtml } from './feedback-tabs.js';
import {feedbackBlockHtml,feedbackInlineHtml,overallFeedback} from './feedback-format.js';
import {setupSourceVersions} from './source-versions.js';
import { setupTeacherComments } from './teacher-comments.js';
import { setupTeacherFilters } from './teacher-filters.js';
import { setupStudentFilters } from './student-filters.js';
import { setupHandoutPreview } from './handout-preview.js';
import {handoutReadOnlyHtml,setupReadOnlyHandout} from './handout-view.js';
import {setupStudentAlignment,alignmentTeacherQueueHtml,alignmentTeacherViewHtml} from './handout-alignment.js';
import {setWriting67Scope} from './master170-writing67.js';
import {setupSplitPanes} from './split-panes.js';
import {languageCards} from './language-cards.js';
import {setupReviewHighlights} from './review-highlights.js';
import {initialRevisionText,shouldRestoreRevisionBackup} from './revision-draft.js';
import {highlightHtml} from './text-highlights.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => crypto.randomUUID();
const events = { received: 'Đã nhận bài · đang xử lý', ai_ready: 'AI xong · chờ GV', returned: 'GV đã trả bài', revision_received: 'HV đã nộp bản sửa' };
const deliveryLabel = value => ({ delivered: 'Đã cập nhật', failed: 'Cần thử lại', pending: 'Đang chờ' })[value] || value;
const date = value => value ? new Date(Number(value)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
let me, csrf, assignments = [], model, generation = 0, saveTimer, working = false, teacherView;
let frontend,onlineAccess,changingAccess=false;
function setRoute(params={}){const u=onlineAccess?onlineAccess.routeUrl(params):new URL('.',import.meta.url);if(!onlineAccess)u.search=new URLSearchParams(params).toString();history.replaceState(history.state,'',u);}
async function completeOnlineSession(session){me=session.person;csrf=session.csrf;await home();}
async function changeOnlineAccess(){
  if(changingAccess)return;changingAccess=true;
  try{await preserveLocalWork();clearTimeout(saveTimer);generation++;me=null;csrf=null;model=null;teacherView=null;onlineAccess.invalidate();account();void loginView().catch(showPageError);}finally{changingAccess=false;}
}
const teacherFilterStates = new Map();
const studentFilterStates = new Map();
let teacherCommentsEditor;
let studentAlignment,handoutEditor,richReview;
let reviewHighlights,reviewToolbarObserver;
function clearTeacherComments() { richReview?.destroy();richReview=null;teacherCommentsEditor?.destroy(); teacherCommentsEditor = null; reviewHighlights?.destroy(); reviewHighlights=null;reviewToolbarObserver?.disconnect(); }
const sessionChannel = new BroadcastChannel('homework-writing-5667-local-session');
sessionChannel.onmessage = async e => {
  if(onlineAccess)return;
  if (!me || !e.data || !['login', 'logout'].includes(e.data.action)) return;
  if ((e.data.action === 'logout' && e.data.personId === me.id) || (e.data.action === 'login' && e.data.personId !== me.id)) {
    await preserveLocalWork();
    clearTimeout(saveTimer); generation++; me = null; csrf = null; model = null; teacherView = null;
    loginView().catch(showPageError);
  }
};
async function preserveLocalWork(){const results=await Promise.allSettled([persist(),model&&handoutEditor?.backup(),teacherView&&me&&reviewDirty()?saveBackup(draftKey(me.id,teacherView.id,'teacher-review'),{version:teacherView.version,result:collectTeacherReview()}):Promise.resolve()]);if(results.some(r=>r.status==='rejected'))notice('Chưa lưu được bản sao vào bộ nhớ bền. Nội dung vẫn được giữ trong tab này.');}
 const notice = message => { $('#notice').textContent = message; clearTimeout(notice.timer); notice.timer = setTimeout(() => { $('#notice').textContent = ''; }, 5500); };
async function api(url, body, method = body === undefined ? 'GET' : 'POST') {
  const actor=me?.id,stamp=onlineAccess?.stamp();
  let r;
  try { r = await fetch((frontend?.apiBase||'/api') + url, { method,keepalive:url==='/session/logout',credentials:onlineAccess?'include':'same-origin', headers: { 'Content-Type': 'application/json', ...(!onlineAccess?{'X-HW-Local':'1'}:onlineAccess.headers()), ...(me ? { 'X-HW-Person': me.id } : {}), ...(csrf ? { 'X-HW-Csrf': csrf } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { if(actor!==me?.id||onlineAccess&&!onlineAccess.isCurrent(stamp))throw Object.assign(Error('Phiên đã đổi; chưa dùng phản hồi cũ.'),{stale:true,handled:true});throw Object.assign(Error('Mất kết nối với Homework. Nội dung chưa xác nhận vẫn được giữ trên thiết bị nếu lưu dự phòng thành công.'), { network: true }); }
  const data = await r.json();
  if(actor!==me?.id||onlineAccess&&!onlineAccess.isCurrent(stamp))throw Object.assign(Error('Phiên đã đổi; chưa dùng phản hồi cũ.'),{stale:true,handled:true});
  if (!r.ok) {
    if(onlineAccess&&me&&(r.status===401||['STUDENT_ACCESS_DENIED','GOOGLE_OWNER_MISMATCH','HOMEWORK_ENTRY_NOT_FOUND','HOMEWORK_ENTRY_OWNER_MISMATCH','HOMEWORK_ENTRY_CHANGED','TEACHER_ACCESS_DENIED','HOMEWORK_ACCOUNT_NOT_BOUND','TEACHER_NOT_ASSIGNED'].includes(data.code))){void changeOnlineAccess().catch(showPageError);throw Object.assign(Error(data.message||'Quyền vào bài đã thay đổi.'),{status:r.status,...data,handled:true});}
    if (r.status === 401 && me) { await preserveLocalWork();clearTimeout(saveTimer); generation++; me = null; csrf = null; model = null; teacherView = null; loginView().catch(showPageError); }
    throw Object.assign(Error(data.message || 'Chưa xử lý được yêu cầu.'), { status: r.status, ...data });
  }
  return data;
}
function account() {
  setWriting67Scope(me ? [me.classId] : []);
  clearTimeout(notice.timer); $('#notice').textContent = '';
  $('#account').innerHTML = me ? `<span class="account-name" title="${esc(accountIdentity(me))}">${esc(accountIdentity(me))}</span><button class="text-button" id="logout">Đăng xuất</button>` : '';
  if (me) $('#logout').onclick = async () => {
    if (!mayLeaveReview()) return;
    clearTimeout(saveTimer);
    try { await Promise.all([preserveLocalWork(),api('/session/logout', {})]);if(onlineAccess)await onlineAccess.afterLogout();else sessionChannel.postMessage({ action: 'logout', personId: me.id }); generation++; me = null; csrf = null; model = null; teacherView = null; await loginView({forceChoose:true}); }
    catch (e) { notice(e.message); }
  };
}
async function loginView(options={}) {
  clearTeacherComments();
  if(onlineAccess){account();try{await completeOnlineSession(await onlineAccess.open($('#app'),options));}catch(e){if(!e.stale)onlineAccess.showError($('#app'),e);}return;}
  account(); const people = await api('/demo/people');
  $('#app').innerHTML = loginViewHtml(people);
  setupLoginForm(people);
  $('#login').onclick = async () => {
    $('#login').disabled = true;
    try { const r = await api('/session/login', { personId: $('#profile').value, remembered: true }); me = r.person; csrf = r.csrf; sessionChannel.postMessage({ action: 'login', personId: me.id }); await home(); }
    catch (e) { $('#login-error').innerHTML = `<p class="error-panel">${esc(e.message)}</p>`; $('#login').disabled = false; }
  };
}
async function home() {
  clearTeacherComments();
  generation++; model = null; teacherView = null; account();
  $('#app').innerHTML = '<p class="loading">Đang mở không gian của bạn…</p>';
  try {
    if(new URLSearchParams(location.search).get('view')==='handout'){const q=new URLSearchParams(location.search);q.delete('view');setRoute(Object.fromEntries(q));}
    if (me.role === 'student') {
      assignments = await api('/assignments');
      const query = new URLSearchParams(location.search);
      if (query.get('view') === 'docs-debug') return docsView();
      if (query.get('submission')) {
        const submission = query.get('submission');
        const owned = await api('/student/submissions/' + encodeURIComponent(submission));
        return openStudent(owned.assignment.id, { resultSubmissionId: submission });
      }
      return query.get('assignment')&&query.get('view')!=='assignments' ? openStudent(query.get('assignment')) : studentHome();
    }
    if (me.role === 'teacher') {
      const id = new URLSearchParams(location.search).get('submission');
      return id ? openReview(id) : teacherList();
    }
    return operatorLibrary();
  } catch (e) { showPageError(e); }
}
async function studentHome() {
  clearTimeout(saveTimer); await flushBackups(); const gen = ++generation;
  const rows = await api('/student/home');
  if (gen !== generation) return;
  model = null; setRoute({});
  $('#app').innerHTML = studentHomeHtml(rows, me);
  $('#refresh-home').onclick = () => studentHome().catch(showPageError);
  if (!studentFilterStates.has(me.id)) studentFilterStates.set(me.id, {});
  setupStudentFilters($('#app'), {rows,state:studentFilterStates.get(me.id),onOpen:id=>openStudent(id).catch(showPageError)});
}
async function studentWorkspace(){
  if(working)return;
  const actor=me?.id,gen=generation,assertCurrent=()=>{if(actor!==me?.id||gen!==generation)throw Object.assign(Error('Phiên đã đổi; chưa dùng phản hồi cũ.'),{stale:true,handled:true});};
  if(model&&!locked())await saveDraft();await preserveLocalWork();assertCurrent();
  if(onlineAccess?.personal){const session=await onlineAccess.workspace();assertCurrent();me=session.person;csrf=session.csrf;account();}
  return studentHome();
}
function standaloneHandout(){
  const query=new URLSearchParams(location.search),student=me.role==='student';
  const id=query.get(student?'assignment':'submission');
  if(!id||!['student','teacher'].includes(me.role))throw Error('Link handout không phù hợp với tài khoản đang đăng nhập.');
  const gen=++generation;model=null;teacherView=null;
  $('#app').innerHTML=`<button type="button" id="back-handout" class="text-button back">← Về bài Writing</button><section class="card standalone-handout">${handoutReadOnlyHtml()}</section>`;
  $('#back-handout').onclick=()=>{setRoute(student?{assignment:id}:{submission:id});home();};
  const viewer=setupReadOnlyHandout($('.handout-reader'),{
    ...(student?{assignmentId:id}:{submissionId:id}),isCurrent:()=>generation===gen,
    loadHandout:()=>api(student?'/student/assignments/'+encodeURIComponent(id)+'/handout':'/teacher/submissions/'+encodeURIComponent(id)+'/handout?kind='+handoutKind)
  });
  return viewer.reload();
}
function showPageError(e) {
  if(e.handled||e.stale)return;
  if(onlineAccess&&!me){onlineAccess.showError($('#app'),e);return;}
  $('#app').innerHTML = `<section class="card"><h1>Chưa mở được bài</h1><p>${esc(e.message)}</p><button id="home">Về danh sách</button></section>`;
  if(!me){$('#home').textContent='Thử lại';$('#home').onclick=()=>start().catch(showPageError);}else $('#home').onclick = () => { setRoute({}); home(); };
}
async function openStudent(id, { resultSubmissionId = null } = {}) {
  clearTimeout(saveTimer); await flushBackups(); const gen = ++generation;
  const state = await api('/student/assignments/' + encodeURIComponent(id));
  if (gen !== generation) return;
  setWriting67Scope([state.assignment.classId]);
  const resultRoute = resultSubmissionId && state.submission?.id === resultSubmissionId ? resultSubmissionId : null;
  const showResult = resultRoute && state.publication;
  setRoute({assignment:id,...(resultRoute?{submission:resultRoute}:{})});
  const kind = state.publication ? 'revision' : 'original';
  const server = kind === 'revision' ? state.revisionDraft : state.draft;
  const revisionRound=state.revisionRound?.number||1;
  const storageKey = draftKey(me.id,id,kind==='revision'&&revisionRound>1?'revision:'+revisionRound:kind);
  let backup, backupError, otherBackups = [];
  try { backup = await loadBackup(storageKey); otherBackups = await listBackups(storageKey); } catch { backupError = true; }
  if (gen !== generation) return;
  model = { id, kind, state, storageKey, revisionRound, text: kind==='revision'?initialRevisionText(state):server.text, baseRevision: server.revision,
    resultSubmissionId: resultRoute,
    handoutMode:showResult?'feedback':model?.id===id?model.handoutMode:'handout',
    lastSavedText: server.text, history: [], pendingSave: null, pendingSubmit: null, conflict: null, saving: null, backupError, otherBackups };
  if (backup) {
    model.history = backup.history || [];
  }
  if (backup && (kind!=='revision'||shouldRestoreRevisionBackup(state,backup))) {
    model.pendingSubmit = backup.pendingSubmit;
    if(kind==='revision'&&!server.text.trim()&&backup.baseRevision===server.revision&&backup.revisionPrefillVersion===2)model.text=backup.text;
    if (backup.text !== server.text && (backup.text !== backup.lastSavedText || backup.pendingSave)) {
      model.text = backup.text; model.baseRevision = backup.baseRevision; model.lastSavedText = backup.lastSavedText;
      model.pendingSave = backup.pendingSave;
      if (server.revision !== backup.baseRevision && backup.lastSavedText !== server.text) model.conflict = server;
      else model.baseRevision = server.revision;
    }
  }
  if (state.revision&&!state.revisionEditable) model.text = state.revision.text;
  else if (kind === 'original' && state.submission) model.text = state.submission.text;
  renderStudent();
  if(showResult)$('#approved-feedback')?.focus();
  if(kind==='revision'&&!locked()&&model.text!==model.lastSavedText){const current=model;await persist();if(gen===generation&&model===current)setSaveStatus(backup?'Đã giữ bản sửa trên thiết bị · chưa đồng bộ':'Đã mở bản sửa từ bài đã nộp · chưa lưu lên hệ thống');}
  if (model.pendingSubmit && !state.submission && kind === 'original') await recoverReceipt();
}
function locked() { return model.kind === 'original' ? !!model.state.submission : (model.state.features?.revisionRounds?!model.state.revisionEditable:!!model.state.revision); }
function persist() {
  if (!model) return Promise.resolve();
  const current = model;
  return saveBackup(model.storageKey, { text: model.text, baseRevision: model.baseRevision, lastSavedText: model.lastSavedText,
    history: model.history, pendingSave: model.pendingSave, pendingSubmit: model.pendingSubmit,revisionRound:model.revisionRound,revisionInitialized:model.kind==='revision',revisionPrefillVersion:model.kind==='revision'?2:null }).catch(() => {
      current.backupError = true; if (model === current) setSaveStatus('Chưa lưu dự phòng được trên thiết bị. Hãy lưu máy chủ hoặc giữ một bản sao.', true);
    });
}
function setSaveStatus(text, error = false) { const e = $('#save-status'); if (e) { e.textContent = text; e.className = error ? 'error-text' : ''; } }
function renderStudent() {
  const { state, text } = model, a = state.assignment;
  $('#app').innerHTML = studentViewHtml({ me, model, assignments, isLocked: locked(), feedback: state.publication ? resultHtml(state.publication.result, true) : '', delivery: state.submission ? deliveryHtml(state.deliveries) : '' });
  const alignmentModel=model,alignmentGeneration=generation;
  studentAlignment=setupStudentAlignment({panel:$('#handout-check-panel'),api,assignmentId:model.id,kind:model.kind,revisionRound:model.revisionRound,isCurrent:()=>generation===alignmentGeneration&&model===alignmentModel});
  if(state.assignment.handoutRequired&&!locked())studentAlignment.draw(model.kind==='revision'?state.revisionHandoutCheck:state.handoutCheck);
  const handoutModel=model, handoutPerson=me.id;
  handoutEditor=setupHandoutPreview($('#app'),{assignment:a,person:me,initialMode:handoutModel.handoutMode,
    onModeChange:mode=>{handoutModel.handoutMode=mode;},
    loadHandout:()=>api('/student/assignments/'+encodeURIComponent(a.id)+'/handout'),
    saveHandout:body=>api('/student/assignments/'+encodeURIComponent(a.id)+'/handout',body,'PUT'),
    onHandoutChange:()=>{handoutModel.pendingSubmit=null;studentAlignment.draw(null);void persist();},
    isCurrent:()=>model===handoutModel && me?.id===handoutPerson});
  setupSplitPanes($('#app'));
  if (state.publication) {
    setupPublicationHistory($('#app'),state,'student',state.submission.id,generation);
    const feedbackKey = 'hw5667:feedback-card:' + JSON.stringify([me.id, model.id, state.publication.id, state.publication.review_version]);
    setupFeedbackCards($('#approved-feedback'), { storageKey: feedbackKey });
    setupFeedbackTabs($('#approved-feedback'), { storageKey: feedbackKey + ':tab' });
    $('.study-context').tabIndex = 0;
    $('.editor-card').tabIndex = 0;
    $('.editor-card').setAttribute('aria-label', 'Đề bài và bài làm của em');
  }
  $('#refresh').onclick = () => openStudent(model.id, { resultSubmissionId: model.resultSubmissionId }).catch(showPageError);
  $('#student-home').onclick = () => studentWorkspace().catch(editorError);
  if (!locked()) {
    $('#essay').oninput = () => { const current = model; current.text = $('#essay').value;studentAlignment?.draw(null); $('#essay').removeAttribute('aria-invalid'); if($('#editor-error').dataset.errorCode==='SUBMISSION_INVALID')$('#editor-error').replaceChildren(); $('#word-count').textContent = wordCount(current.text) + ' từ'; persist().then(() => { if (model === current && !current.backupError) setSaveStatus('Đã lưu trên thiết bị này · chờ đồng bộ'); }); clearTimeout(saveTimer); saveTimer = setTimeout(() => saveDraft().catch(editorError), 1500); };
    $('#save').onclick = () => saveDraft().catch(editorError);
    $('#submit').onclick = () => submitDraft().catch(editorError);
    if(onlineAccess)$('#sample')?.closest('.demo-tool').remove();else $('#sample').onclick = () => { $('#essay').value = 'People is interested in learning together. Students can share their ideas and support each other.'; $('#essay').dispatchEvent(new Event('input')); };
  }
  if (model.conflict) showConflict();
  const backups = [...model.otherBackups.map(b => ({ text: b.text })), ...model.history.flatMap(h => [{ text: h.text }, { text: h.serverText }])]
    .filter((b, i, all) => b.text && b.text !== model.text && all.findIndex(x => x.text === b.text) === i);
  if (backups.length) {
    const panel = document.createElement('details'); panel.className = 'block';
    panel.innerHTML = `<summary>Bản dự phòng từ tab khác và xung đột · ${backups.length}</summary>${backups.map((b, i) => `<article class="conflict"><pre>${esc(b.text)}</pre>${!locked() ? `<button data-restore-backup="${i}">Đưa bản này vào ô viết</button>` : ''}</article>`).join('')}`;
    $('.editor-card').append(panel);
    panel.querySelectorAll('[data-restore-backup]').forEach(b => b.onclick = async () => {
      model.history.push({ text: model.text, at: Date.now() }); model.text = backups[Number(b.dataset.restoreBackup)].text;
      $('#essay').value = model.text; await persist(); setSaveStatus('Đã khôi phục bản dự phòng · chưa lưu lên hệ thống');
    });
  }
}
const wordCount = text => text.trim() ? text.trim().split(/\s+/).length : 0;
function deliveryHtml(rows) {
  return `<details class="block"><summary>Trạng thái Docs và email mô phỏng</summary><ul class="delivery-list">${rows.map(r => `<li><span>${esc(events[r.event])}<small> · ${r.channel === 'docs' ? 'Docs giả' : 'Email GV giả'}</small></span><span>${esc(deliveryLabel(r.status))}</span></li>`).join('')}</ul></details>`;
}
function marked(text, ranges, field) {
  let out = '', at = 0;
  for (const h of ranges || []) {
    const r = h[field]; if (!r || r.start < at || r.end > text.length || r.end <= r.start) continue;
    out += esc(text.slice(at, r.start)) + '<mark>' + esc(text.slice(r.start, r.end)) + '</mark>'; at = r.end;
  }
  return out + esc(text.slice(at));
}
function resultHtml(result,useCards=false) {
  if(useCards)return feedbackTabsHtml(result,{esc,marked});
  result={...result,feedback:overallFeedback(result.feedback)};
  const ranges=key=>result.teacherHighlights?.[key]?.ranges||[];
  return `<h3>Nhận xét chung</h3>${feedbackBlockHtml(result.feedback,ranges('feedback'))}${result.trcc?`<h3>Ý và mạch bài · TR/CC</h3>${feedbackBlockHtml(result.trcc,ranges('trcc'))}`:''}<h3>Nhận xét về ngôn ngữ</h3>${languageCards(result).map(card=>`<article class="sentence"><h4>Câu ${esc(card.item)}${card.correctionCount>1?' · Sửa '+(card.correctionIndex+1):''}</h4><div class="sentence-comparison"><div class="original"><small>Câu gốc</small><div>${marked(card.original_text,card.highlights,'original')}</div></div><div class="revised"><small>Gợi ý đã duyệt</small><div>${ranges('card:'+card.id+':revised').length?highlightHtml(card.revised_text,ranges('card:'+card.id+':revised')):marked(card.revised_text,card.revisedHighlights,'revised')}</div></div></div>${feedbackBlockHtml(card.explanation,ranges('card:'+card.id+':explanation'))}</article>`).join('')}${teacherCommentsHtml(result.teacherComments,esc,result.teacherHighlights)}`;
}

function editorError(e) {
  const panel=$('#editor-error');if(!panel)return;
  panel.dataset.errorCode=e.code||'';const progress=$('#submit-progress');if(progress)progress.textContent='';
  panel.innerHTML = `<div class="error-panel"><strong>${esc(e.message)}</strong>${e.details?.errors ? '<ul>' + e.details.errors.map(x => `<li>${esc(x.message)}</li>`).join('') + '</ul>' : ''}</div>`;
  if(e.code==='SUBMISSION_INVALID'){panel.tabIndex=-1;panel.focus({preventScroll:true});panel.scrollIntoView({block:'nearest'});$('#essay')?.setAttribute('aria-invalid','true');}
}
function showConflict() {
  const current = model.conflict;
  $('#conflict').innerHTML = `<section class="conflict"><h3>Có bản lưu từ tab khác</h3><p>Bản đang gõ vẫn ở ô viết. Bản trên hệ thống (phiên bản ${current.revision}) ở dưới để em đối chiếu.</p><pre>${esc(current.text)}</pre><div class="actions"><button id="use-server">Dùng bản trên hệ thống</button><button id="keep-local">Giữ bản đang gõ và lưu</button></div><small>Cả hai nội dung được giữ trong lịch sử dự phòng trên thiết bị.</small></section>`;
  const resolve = async keepLocal => {
    model.history.push({ text: model.text, serverText: current.text, at: Date.now() });
    model.baseRevision = current.revision; model.lastSavedText = current.text; model.pendingSave = null; model.conflict = null;
    if (!keepLocal) { model.text = current.text; $('#essay').value = current.text; }
    await persist(); $('#conflict').innerHTML = ''; if (keepLocal) await saveDraft(); else setSaveStatus('Đã dùng bản trên hệ thống · bản ' + current.revision);
  };
  $('#use-server').onclick = () => resolve(false).catch(editorError); $('#keep-local').onclick = () => resolve(true).catch(editorError);
}
async function saveDraft() {
  clearTimeout(saveTimer); const m = model, gen = generation;
  if (m.conflict) { showConflict(); throw Error('Hãy chọn bản muốn giữ sau khi đối chiếu.'); }
  if (locked()) return;
  if (m.saving) { await m.saving; return saveDraft(); }
  if (m.text === m.lastSavedText && !m.pendingSave) return;
  const payload = m.pendingSave || { kind: m.kind, revisionRound:m.revisionRound,text: m.text, expectedRevision: m.baseRevision, clientMutationId: uid() };
  m.pendingSave = payload; await persist(); setSaveStatus('Đang lưu lên hệ thống…');
  m.saving = (async () => {
    try {
      const r = await api('/student/assignments/' + encodeURIComponent(m.id) + '/draft', payload, 'PUT');
      if (gen !== generation) return;
      m.baseRevision = r.revision; m.lastSavedText = payload.text; m.pendingSave = null; await persist();
      setSaveStatus(m.text === payload.text ? 'Đã lưu nháp trên hệ thống · bản ' + r.revision : 'Đã lưu bản trước · đang giữ thay đổi mới trên thiết bị');
    } catch (e) {
      if (gen !== generation) return;
      if (e.code === 'DRAFT_CONFLICT') { m.conflict = e.details.current; m.pendingSave = null; showConflict(); }
      setSaveStatus('Chưa xác nhận lưu máy chủ. Nội dung đang gõ vẫn được giữ.', true); throw e;
    } finally { m.saving = null; }
  })();
  await m.saving;
  if (gen === generation && m.text !== m.lastSavedText) await saveDraft();
}
async function recoverReceipt() {
  const m = model, gen = generation;
  try {
    const receipt = await api('/student/receipts/' + encodeURIComponent(m.pendingSubmit.idempotencyKey));
    if (gen !== generation) return;
    m.pendingSubmit = null; await persist(); notice('Đã tìm lại biên nhận nộp bài.'); await openStudent(receipt.assignmentId);
  } catch (e) { if (gen === generation) setSaveStatus(e.status === 404 ? 'Chưa tìm thấy biên nhận. Em có thể bấm Nộp để thử lại đúng yêu cầu.' : 'Chưa xác nhận được kết quả nộp. Hãy kết nối lại rồi kiểm tra trạng thái.', true); }
}
async function submitDraft() {
  if (working) return; working = true;
  const gen = generation;
  const button = $('#submit'); button.disabled = true;
  try {
    await handoutEditor?.flush();await saveDraft(); if (gen !== generation || !model) return; const m = model;
    const directError=vietnameseWritingError(m.text)||basicSubmissionError(m.text);
    if(directError)throw Object.assign(Error('Bài chưa được nhận.'),{code:'SUBMISSION_INVALID',details:{errors:[directError]}});
    if (m.text !== m.lastSavedText) throw Error('Hãy lưu hết nội dung trước khi nộp.');
    let handoutCheckId=m.pendingSubmit?.draftRevision===m.baseRevision?m.pendingSubmit.handoutCheckId:null;
    if(m.state.assignment.handoutRequired&&!handoutCheckId){
      const revision=m.baseRevision,text=m.text,handoutHash=handoutEditor?.fingerprint;
      const result=await studentAlignment.run({draftRevision:revision,text,unchanged:()=>model===m&&m.text===text&&m.baseRevision===revision&&handoutEditor?.fingerprint===handoutHash&&!handoutEditor?.isDirty()});
      if(!result||gen!==generation||model!==m)return;handoutCheckId=result.id;
    }
    if (!m.pendingSubmit || m.pendingSubmit.draftRevision !== m.baseRevision) m.pendingSubmit = { draftRevision: m.baseRevision,revisionRound:m.revisionRound, idempotencyKey: uid() };
    if(handoutCheckId)m.pendingSubmit.handoutCheckId=handoutCheckId;
    await persist();
    await api('/student/assignments/' + encodeURIComponent(m.id) + (m.kind === 'revision' ? '/revision' : '/submit'), m.pendingSubmit);
    if (gen !== generation || model !== m) return;
    m.pendingSubmit = null; await persist(); notice(m.kind === 'revision' ? 'Đã nhận bản sửa của em.' : 'Đã nhận bài hợp lệ và xếp hàng chấm.'); await openStudent(m.id);
  } catch (e) {
    if(['SUBMISSION_INVALID','HANDOUT_CHECK_REQUIRED','HANDOUT_CHECK_STALE'].includes(e.code)&&gen===generation&&model){model.pendingSubmit=null;await persist();}
    if (e.network) e.message = 'Chưa xác nhận được kết quả nộp. Em giữ nguyên nội dung và dùng Cập nhật trạng thái để tra lại biên nhận.';
    throw e;
  } finally { working = false; if (document.contains(button)) button.disabled = false; }
}

async function docsView() {
  clearTimeout(saveTimer); await flushBackups(); const gen = ++generation; model = null;
  setRoute({view:'docs-debug'});
  const states = [];
  for (const a of assignments) states.push(await api('/student/assignments/' + encodeURIComponent(a.id)));
  if (gen !== generation) return;
  $('#app').innerHTML = docsViewHtml(states, me, events);
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openStudent(b.dataset.open).catch(showPageError));
  $('#docs-refresh').onclick = () => docsView().catch(showPageError);
}
async function teacherList() {
  clearTeacherComments();
  const gen = ++generation; teacherView = null;
  setRoute({});
  const [rows,scopes,alignmentRows]=await Promise.all([api('/teacher/submissions?includeUnsubmitted=1'),api('/assignments?homeOnly=1'),api('/teacher/handout-checks')]);
  if (gen !== generation) return;
  setWriting67Scope(scopes.map(a => a.classId));
  $('#app').innerHTML = teacherListHtml(rows, me, scopes);
  $('#app').insertAdjacentHTML('beforeend',alignmentTeacherQueueHtml(alignmentRows));
  document.querySelectorAll('[data-alignment-review]').forEach(b=>b.onclick=()=>openAlignmentReview(b.dataset.alignmentReview).catch(showPageError));
  if (!teacherFilterStates.has(me.id)) teacherFilterStates.set(me.id, {});
  const filters = teacherFilterStates.get(me.id);
  const onOpen = id => { filters.scrollY = scrollY; filters.selectedId = id; openReview(id).catch(showPageError); };
  setupTeacherFilters($('#app'), { rows, assignments: scopes, state: filters, onOpen });
  $('#refresh-teacher').onclick = () => teacherList().catch(showPageError);
  requestAnimationFrame(() => {
    if (gen !== generation) return;
    window.scrollTo(0, filters.scrollY || 0);
    const selected = [...document.querySelectorAll('#teacher-queue [data-review]')].find(b => b.dataset.review === filters.selectedId);
    selected?.focus({ preventScroll: true });
  });
}
async function openAlignmentReview(id){
 clearTeacherComments();const gen=++generation;teacherView=null;const data=await api('/teacher/handout-checks/'+encodeURIComponent(id));if(gen!==generation)return;
 $('#app').innerHTML=alignmentTeacherViewHtml(data);$('#back-alignment-list').onclick=()=>teacherList().catch(showPageError);
 setupSplitPanes($('#app'));
 // Đây là kết quả đọc của GV; các nút yêu cầu xem lại chỉ dành cho màn HV.
 $('#alignment-teacher-result').querySelectorAll('button').forEach(b=>b.remove());
 for(const [selector,decision]of [['#alignment-allow','allow'],['#alignment-revise','revise']])$(selector).onclick=async()=>{
  const message=$('#alignment-teacher-message').value;if(!message.trim()){$('#alignment-teacher-error').textContent='GV cần ghi lý do để học viên biết.';return;}
  $('#alignment-allow').disabled=true;$('#alignment-revise').disabled=true;
  try{await api('/teacher/handout-checks/'+encodeURIComponent(id)+'/decision',{expectedVersion:data.check.version,decision,message});if(gen===generation){await teacherList();notice('Đã lưu xác nhận đối chiếu handout.');}}
  catch(e){if(gen===generation){$('#alignment-teacher-error').textContent=e.message;$('#alignment-allow').disabled=false;$('#alignment-revise').disabled=false;}}
 };
}
async function openReview(id,{editPublished=false}={}) {
  clearTeacherComments();
  const gen = ++generation; const data = await api('/teacher/submissions/' + encodeURIComponent(id));
  if (gen !== generation) return;
  setWriting67Scope([data.assignment.classId]);
  const editing=!!data.review&&(!data.publication||editPublished);data.editingReview=editing;
  teacherView = { id, data, version: data.review?.version, result: structuredClone(data.review?.result) };
  if(editing){const backup=await loadBackup(draftKey(me.id,id,'teacher-review')).catch(()=>null);if(gen!==generation)return;if(backup?.version===data.review.version&&backup.result)data.review.result=backup.result;}
  setRoute({submission:id});
  $('#app').innerHTML = teacherReviewHtml(data, data.publication ? resultHtml(data.publication.result, true) : '', editing ? feedbackTabsHtml(data.review.result, { esc, marked, editable: true }) : '');
  setupSplitPanes($('#app'));
  const reviewRoot = $('.review-column'), reviewKey = 'hw5667:teacher-view:' + JSON.stringify([me.id, id]);
  let selectedRevisionId=data.revision?.id;let handoutKind='original';try{handoutKind=sessionStorage.getItem(reviewKey+':handout-kind')||'original';}catch{}
  const handout=setupReadOnlyHandout($('#source-panel-handout .handout-reader'),{
    assignmentId:data.assignment.id,submissionId:id,isCurrent:()=>gen===generation,
    loadHandout:()=>api('/teacher/submissions/'+encodeURIComponent(id)+'/handout?kind='+handoutKind+(handoutKind==='revision'&&selectedRevisionId?'&revisionId='+encodeURIComponent(selectedRevisionId):''))
  });
  setupSourceVersions($('#app'),{storageKey:reviewKey+':source:'+String(data.revision?.id||'no-revision'),onSelect:value=>{if(value!=='handout'){handoutKind=value;try{sessionStorage.setItem(reviewKey+':handout-kind',value);}catch{}}if(value==='handout')void handout.reload();}});
  setupFeedbackCards(reviewRoot, { storageKey: reviewKey + ':card' });
  setupFeedbackTabs(reviewRoot, { storageKey: reviewKey + ':tab' });
  if (editing) teacherCommentsEditor = setupTeacherComments($('#app'), {
    sourceText: data.submission.text, comments: data.review.result.teacherComments || [],
    onDirty: () => { $('#review-status').textContent = 'Có chỉnh sửa chưa lưu · HV chưa thấy nội dung này.'; },
    onSave: async () => { await saveTeacherReview(); return { dirty: reviewDirty() }; }
  });
  if(editing){
    reviewHighlights=setupReviewHighlights($('.review-form'),data.review.result.teacherHighlights,()=>{$('#review-status').textContent='Có chỉnh sửa chưa lưu · HV chưa thấy nội dung này.';});
    const toolbar=$('.review-toolbar'),form=$('.review-form');
    richReview=setupRichReview($('.review-form'));
    reviewToolbarObserver=new ResizeObserver(()=>form.style.setProperty('--review-toolbar-height',toolbar.getBoundingClientRect().height+'px'));
    reviewToolbarObserver.observe(toolbar);
  }
  for (const [selector, label] of [['.source-column', 'Bài gốc và bản sửa của học viên'], ['.review-column', 'Phản hồi và chỉnh sửa của giảng viên']]) {
    const panel = $(selector); panel.tabIndex = 0; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', label);
  }
  $('#back-teacher').onclick = () => { if (mayLeaveReview()) teacherList().catch(showPageError); };
  if ($('#reload-review')) $('#reload-review').onclick = () => openReview(id).catch(showPageError);
  if($('#edit-published-review'))$('#edit-published-review').onclick=()=>openReview(id,{editPublished:true}).catch(showPageError);
  if($('#cancel-published-edit'))$('#cancel-published-edit').onclick=()=>{if(mayLeaveReview())void openReview(id);};
  if($('#open-revision-round')){
    const payload={expectedRound:data.revisionRound.number,idempotencyKey:uid()};
    $('#open-revision-round').onclick=async()=>{const button=$('#open-revision-round');button.disabled=true;try{await api('/teacher/submissions/'+encodeURIComponent(id)+'/revision-rounds',payload);await openReview(id);notice('Đã mở lượt sửa tiếp theo cho học viên.');}catch(e){notice(e.message);if(button.isConnected)button.disabled=false;}};
  }
  if($('#revision-history'))$('#revision-history').onchange=async event=>{
    const wanted=event.target.value;try{const revision=await api('/teacher/submissions/'+encodeURIComponent(id)+'/revisions/'+encodeURIComponent(wanted));if(gen!==generation||$('#revision-history')?.value!==wanted)return;
      selectedRevisionId=revision.id;$('.student-revision').textContent=revision.text;$('#revision-source-note').textContent='Lượt '+revision.round_number+' · Nhận lúc '+new Date(revision.created_ms).toLocaleString('vi-VN');
    }catch(e){notice(e.message);}
  };
  setupPublicationHistory($('#app'),data,'teacher',id,gen);
  if ($('#save-review')) {
    document.querySelectorAll('.review-form textarea').forEach(field => field.addEventListener('input', () => {
      $('#review-status').textContent = reviewDirty() ? 'Có chỉnh sửa chưa lưu · HV chưa thấy nội dung này.' : 'Đang xem bản nhận xét ' + teacherView.version + ' · chưa trả cho HV.';
    }));
    $('#save-review').onclick = () => saveTeacherReview().catch(reviewError);
    $('#approve').onclick = async () => {
      if (working) return; working = true; $('#approve').disabled = true;const publishingForm=$('.review-form');publishingForm.inert=true;
      try { if(teacherView.saving)await teacherView.saving;const result=collectTeacherReview(),fp=JSON.stringify(result);if(!teacherView.pendingPublish||teacherView.pendingPublish.fp!==fp)teacherView.pendingPublish={fp,expectedVersion:teacherView.version,result,expectedPublicationVersion:data.publication?.publication_version||0,idempotencyKey:uid()};await api('/teacher/submissions/' + encodeURIComponent(id) + '/publish', teacherView.pendingPublish); notice('Đã công bố đúng bản GV duyệt cho HV.'); await openReview(id); }
      catch (e) { reviewError(e); } finally { publishingForm.inert=false;working = false; if ($('#approve')) $('#approve').disabled = false; }
    };
  }
}
function setupPublicationHistory(root,data,role,id,gen){
  const select=root.querySelector('#publication-history');if(!select)return;
  const target=root.querySelector('#publication-history-content');let request=0;
  select.onchange=async()=>{
    const wanted=select.value,at=++request;if(!wanted){target.innerHTML='';return;}
    try{const value=await api('/'+role+'/submissions/'+encodeURIComponent(id)+'/publications/'+encodeURIComponent(wanted));if(gen!==generation||at!==request||!target.isConnected)return;
      target.innerHTML='<h3>Bản đã trả '+value.publication_version+'</h3>'+resultHtml(value.result,true);
      // Mỗi snapshot là một vùng độc lập, kể cả quan hệ ARIA giữa tab và panel.
      const ids=new Map();target.querySelectorAll('[id]').forEach(element=>{const old=element.id,next='history-'+value.publication_version+'-'+old;ids.set(old,next);element.id=next;});
      for(const attribute of ['aria-controls','aria-labelledby'])target.querySelectorAll('['+attribute+']').forEach(element=>element.setAttribute(attribute,element.getAttribute(attribute).split(/\s+/).map(id=>ids.get(id)||id).join(' ')));
      setupFeedbackCards(target);setupFeedbackTabs(target);
    }catch(e){if(gen===generation&&at===request)target.textContent=e.message;}
  };
}
function reviewDirty() {
  if (!teacherView || !$('#review-feedback')) return false;
  return JSON.stringify(collectTeacherReview())!==JSON.stringify(teacherView.result);
}
function collectTeacherReview(){
  const result=structuredClone(teacherView.result);
  result.feedback=$('#review-feedback').value;result.trcc=$('#review-trcc').value;
  const comments=teacherCommentsEditor?.collect()||[];
  if(comments.length||'teacherComments'in result)result.teacherComments=comments;
  const cards=languageCards(result).map(card=>({id:card.id,revised_text:card.revised_text,explanation:card.explanation}));
  document.querySelectorAll('[data-revised]').forEach(e=>{cards.find(c=>c.id===e.dataset.cardKey).revised_text=e.value;});
  document.querySelectorAll('[data-explanation]').forEach(e=>{cards.find(c=>c.id===e.dataset.cardKey).explanation=e.value;});
  const defaults=languageCards(result).map(card=>({id:card.id,revised_text:card.revised_text,explanation:card.explanation}));
  if(result.languageCards||JSON.stringify(cards)!==JSON.stringify(defaults))result.languageCards=cards;
  const highlights=reviewHighlights?.collect()||{};
  if(Object.keys(highlights).length||result.teacherHighlights)result.teacherHighlights=highlights;
  return result;
}
function mayLeaveReview() {
  return !reviewDirty() || confirm('Phản hồi chưa được lưu. Bạn muốn rời bài và bỏ các chỉnh sửa?');
}
function reviewError(e) { if ($('#review-error')) $('#review-error').innerHTML = `<div class="error-panel">${esc(e.message)} Nội dung đang chỉnh vẫn ở đây; tải lại sau khi giữ một bản sao nếu có xung đột.</div>`; }
async function saveTeacherReview() {
  if (teacherView?.saving) { await teacherView.saving; return saveTeacherReview(); }
  const view = teacherView, gen = generation, result = collectTeacherReview();
  if (JSON.stringify(result) === JSON.stringify(view.result)) return;
  view.saving = api('/teacher/submissions/' + encodeURIComponent(view.id) + '/review', { expectedVersion: view.version, result }, 'PUT');
  try {
    const saved = await view.saving;
    if (gen !== generation || teacherView !== view) throw Error('Phiên hoặc bài đang mở đã đổi. Bản lưu chỉ thuộc bài trước.');
    view.version = saved.version; view.result = saved.result; teacherCommentsEditor?.commit(saved.result.teacherComments || []);
    $('#review-status').textContent = reviewDirty() ? 'Đã lưu bản trước; còn chỉnh sửa mới chưa lưu.' : 'Đã lưu bản nhận xét ' + saved.version + ' · chưa trả cho HV.';
  } finally { view.saving = null; }
}
async function operatorView() {
  const gen = ++generation; const data = await api('/operator/overview');
  if (gen !== generation) return;
  $('#app').innerHTML = operatorViewHtml(data, events);
  const back = document.createElement('button'); back.className = 'text-button back'; back.textContent = '← Tất cả bài học viên';
  back.onclick = () => operatorLibrary().catch(showPageError); $('#app').prepend(back);
  $('#ops-refresh').onclick = () => operatorView().catch(showPageError);
  $('#set-fault').onclick = async () => {
    try { const r = await api('/operator/fault', { name: $('#fault-name').value, remaining: Number($('#fault-count').value) }); $('#fault-feedback').textContent = 'Đã đặt ' + r.remaining + ' lượt lỗi cho ' + r.name + '.'; }
    catch (e) { notice(e.message); }
  };
  document.querySelectorAll('[data-retry]').forEach(b => b.onclick = async () => {
    try { await api('/operator/' + b.dataset.type + '/' + encodeURIComponent(b.dataset.retry) + '/retry', {}); await operatorView(); notice('Đã xếp lại đúng bước lỗi.'); }
    catch (e) { notice(e.message); }
  });
}
async function operatorLibrary() {
  const gen = ++generation; model = null; teacherView = null;
  const data = await api('/operator/library'); if (gen !== generation) return;
  setRoute({}); $('#app').innerHTML = operatorLibraryHtml(data);
  if (!teacherFilterStates.has(me.id)) teacherFilterStates.set(me.id, {});
  setupTeacherFilters($('#app'), { rows: data.submissions, assignments: data.assignments, classIds: data.classes, state: teacherFilterStates.get(me.id), onOpen: id => openOperatorReview(id).catch(showPageError) });
  $('#refresh-operator-library').onclick = () => operatorLibrary().catch(showPageError);
  $('#open-ops').onclick = () => operatorView().catch(showPageError);
}
async function openOperatorReview(id) {
  const gen = ++generation; const data = await api('/operator/submissions/' + encodeURIComponent(id));
  if (gen !== generation) return;
  const result = data.publication?.result || data.review?.result || data.ai;
  $('#app').innerHTML = operatorReviewHtml(data, result ? resultHtml(result) : '', data.ai ? resultHtml(data.ai) : '');
  setupSplitPanes($('#app'));
  $('#operator-back').onclick = () => operatorLibrary().catch(showPageError);
  for (const selector of ['.source-column', '.review-column']) { const panel = $(selector); panel.tabIndex = 0; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', selector === '.source-column' ? 'Bài học viên' : 'Phản hồi bài viết'); }
}
let polling = false;
setInterval(() => { if (me) api('/session').catch(() => {}); }, 15000);
setInterval(async () => {
  if (polling || !me || me.role !== 'student' || !model || !locked()) return;
  polling = true; const gen = generation, id = model.id;
  try {
    const state = await api('/student/assignments/' + encodeURIComponent(id));
    if (gen !== generation) return;
    if (!!state.publication !== !!model.state.publication || state.publication?.id!==model.state.publication?.id || state.revisionRound?.number!==model.state.revisionRound?.number || state.submission?.status !== model.state.submission?.status) await openStudent(id);
  } catch { /* Giữ màn hiện tại khi mất mạng; không biến thành thành công. */ }
  finally { polling = false; }
}, 5000);
window.addEventListener('beforeunload', e => {
  const dirtyDraft = model && !locked() && (model.text !== model.lastSavedText || model.pendingSubmit);
  if (dirtyDraft || reviewDirty()) { if (dirtyDraft) persist(); e.preventDefault(); e.returnValue = ''; }
});
async function start() {
  frontend=frontendConfiguration(runtime);
  if(frontend.mode==='online'){onlineAccess=createOnlineAccess(frontend,{onWarning:message=>requestAnimationFrame(()=>notice(message)),onTeacherChanged:changeOnlineAccess,onReady:session=>completeOnlineSession(session).catch(showPageError)});$('.brand').onclick=async e=>{e.preventDefault();try{if(me?.role==='student')await studentWorkspace();else if(me&&mayLeaveReview()){await preserveLocalWork();setRoute({});await home();}else if(!me)await loginView();}catch(error){if(model)editorError(error);else showPageError(error);}};await loginView();return;}
  try { const session = await api('/session'); me = session.person; csrf = session.csrf; await home(); }
  catch (e) { if (e.status === 401) await loginView(); else showPageError(e); }
}
start().catch(showPageError);
