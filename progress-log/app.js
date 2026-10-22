import {contentTitle,skillsLabel,sessionHeading,sessionState} from './session-presentation.js';
import {pilotEntry} from './pilot-entry.js?rev=20261022-official-v2';
import {renderSessionReview} from './session-review.js?rev=20261022-reading-slots';
import {buildDropdownFlowchart} from './dropdown-flowchart.js?rev=20261010-v1';
import {buildCompactExercises} from './compact-exercises.js?rev=20261019-quoted-notes-v1';
import {commentPanel,paintJourneyComments,createCommentPoller,bindDialogDismiss} from './session-comments.js?rev=20261007-comments-v2';
import {observeSubmissionWindow, windowCanSubmit, submissionWindowMessage} from './submission-window.js?rev=20261022-official-v2';
import {createCourseStudentIdentity,requestMappingStudentIdentity} from '../shared/course-student-identity.js?v=20261018-identity-v1';
import {keywordSelection} from './thuy-live/keyword-selection.js';
import {renderThuyLearner} from './thuy-live/learner-view.js?rev=20261022-reading-slots';
import {comparisonTable} from './thuy-live/comparison-table.js?rev=20261022-parity-v1';
import {questionPresentation,buildKeywordGroup} from './thuy-live/question-presentation.js?rev=20261022-parity-v1';
import {legacyFeedbackForView} from './thuy-live/feedback-policy.js';
import { allowedGroup, memoryKey, officialStudent, readMemory, resolveRememberedStudent,
  writeMemory } from '../shared/student-memory.js?v=20260905-memory-v3';

/*
 * Dữ liệu nhận vào: token phiếu trong URL fragment, danh sách lớp và FormDefinitionV1 từ API.
 * Xử lý: học viên xác nhận tên, trả lời từng checkpoint, lưu draft có revision và nộp idempotent.
 * Kết quả: màn hình xác nhận server đã nhận bài và trạng thái điểm danh; token không nằm trong query/log GitHub Pages.
 * Khi lỗi: câu trả lời vẫn ở sessionStorage của tab này, thông báo rõ và không tự coi là đã điểm danh.
 */

const config = window.PROGRESS_LOG_CONFIG || {};
const THUY_UI=location.pathname.endsWith('/thuy.html')||new URLSearchParams(location.search).get('presentation')==='thuy';
const thuySkills=THUY_UI?await import('./thuy-live/course-skills.js?rev=20261022-parity-v2'):null;
if(THUY_UI){document.body.classList.add('thuy-live','thuy-student');const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./thuy-live/styles.css?rev=20261022-choice-font',import.meta.url);document.head.append(css);}
const AUTOSAVE_IDLE_MIN_MS = 5_000;
const AUTOSAVE_IDLE_MAX_MS = 12_000;
const AUTOSAVE_FORCE_MIN_MS = 25_000;
const AUTOSAVE_FORCE_MAX_MS = 45_000;
const state = {
  publicToken: '',
  assignment: null,
  selectedStudent: null,
  attempt: null,
  responses: {},
  checkpointIndex: 0,
  changeVersion: 0,
  savedVersion: 0,
  idleTimer: 0,
  maxTimer: 0,
  saveChain: Promise.resolve(),
  checkpointSubmissions: new Map(),
  submissionPayload: null,
  submitting: false,
  confirmedStudent: null,
  startingAttempt: false,
  journeyReturnView: 'confirmView',
  journeyLoading: false,
  journeyOnly: false
};

const viewIds = ['identityView', 'confirmView', 'formView', 'resultView', 'journeyLoadingView', 'journeyView', 'journeyDetailView', 'errorView'];
const elements = Object.fromEntries([
  'notice', ...viewIds, 'brandLabel', 'sessionLabel', 'assignmentTitle', 'classLabel', 'studentSelect',
  'chooseStudentButton', 'rememberStudentRow', 'rememberStudent', 'rememberStudentStatus', 'changeRememberedStudent',
  'confirmName', 'confirmContext', 'confirmButton', 'journeyButton', 'backToNamesButton',
  'studentNameLabel', 'formContextLabel', 'saveState', 'progressBar', 'reflectionForm',
  'checkpointLabel', 'checkpointTitle', 'checkpointInstructions', 'questionList', 'previousButton',
  'nextButton', 'submitButton', 'resultTitle', 'attendanceResult', 'completenessResult',
  'journeyResultButton', 'journeyStudentName', 'journeyClassName', 'attendedCount', 'submittedCount',
  'reportCount', 'journeyStatus', 'journeySessions', 'journeyReports', 'journeyReportList', 'journeyBackButton',
  'journeyLoadingStatus', 'journeyRetryButton', 'journeyLoadingBackButton', 'journeySpinner',
  'journeyAssignedCount', 'journeyPlanCount', 'journeyCorrectCount', 'journeyIncorrectCount', 'journeyListTitle', 'journeySummaryButton', 'journeySummaryDialog', 'journeySummaryContent',
  'journeyDetailContent', 'journeyDetailStatus', 'journeyDetailBackButton', 'journeyDetailRetryButton',
  'gradedResults', 'gradedSummary', 'gradedItemList',
  'errorTitle', 'errorMessage', 'retryButton'
].map(id => [id, document.getElementById(id)]));

const studentMemory = {
  key: '', storage: null, group: null, busy: false, preference: true, enabled: false, installed: false
};
let courseIdentity=null;

async function applyCommonStudentMemory(){
  if(!courseIdentity||studentMemory.busy||state.attempt)return;
  const own=courseIdentity.getPinned();
  let selected,selection=null;
  if(own?.studentRef)selected=state.assignment.roster.find(s=>s.studentRef===own.studentRef);
  else{
    selection=await courseIdentity.resolve({studentRefs:state.assignment.roster.filter(officialStudent).map(s=>s.studentRef)});
    if(selection.status!=='unique')return;
    selected=state.assignment.roster.find(s=>s.studentRef===selection.alias.studentRef);
  }
  if(!selected){memoryStatus('Người của tab này chưa có quyền trong phiếu. Danh tính và bài cũ được giữ.');return;}
  state.selectedStudent=state.confirmedStudent=selected;elements.studentSelect.value=selected.studentRef;
  studentMemory.busy=true;state.automaticSelection=selection;
  if(state.journeyOnly||!windowCanSubmit(observedWindow,performance.now())){
    await openIntegratedJourney('confirmView');
    if(state.journeyData?.student?.studentRef===selected.studentRef&&!elements.journeyView.hidden){
      if(selection)void courseIdentity.commit(courseIdentity.automaticContext(selection),{automatic:true});
      courseIdentity.pin(selected.studentRef);
    }
  }else await startAttempt({selection,pinned:Boolean(own)});
}
async function changeProgressStudent(){
  if(!courseIdentity)return clearRememberedSelection();
  if(state.startingAttempt||state.submitting){setNotice('Hãy chờ mở hoặc nộp phiếu xong trước khi đổi người.');return;}
  if(state.attempt&&!state.submissionPayload){
    if(storeLocalDraft()===false)return;
    await flushDraft();
    if(state.savedVersion!==state.changeVersion){setNotice('Chưa lưu xong nháp. Phiếu vẫn giữ nguyên người.','error');return;}
  }
  if((await courseIdentity.forget()).status!=='empty'){setNotice('Chưa bỏ được ghi nhớ. Phiếu và nháp vẫn được giữ.','error');return;}
  clearSaveTimers();state.journeyGeneration=(state.journeyGeneration||0)+1;state.journeyController?.abort();
  state.journeyDetailGeneration=(state.journeyDetailGeneration||0)+1;state.journeyDetailController?.abort();
  Object.assign(state,{selectedStudent:null,confirmedStudent:null,attempt:null,responses:{},changeVersion:0,savedVersion:0,
    thuyReadOnly:null,thuyExpanded:new Set(),thuyFinalId:null,thuyCompletionError:'',thuyComments:null,
    submissionPayload:null,automaticSelection:null,journeyData:null,journeyLoading:false,checkpointSubmissions:new Map(),saveChain:Promise.resolve()});
  studentMemory.busy=false;elements.studentSelect.value='';elements.chooseStudentButton.disabled=true;
  syncStudentMemoryControls();showView('identityView');setNotice('Đã bỏ ghi nhớ. Hãy chọn người học.');
}

function progressRosterGroup() {
  if (!state.assignment) return null;
  return {
    classRef: state.assignment.class?.classRef || state.assignment.class?.classId || state.assignment.class?.id || state.assignment.class?.name || '',
    className: state.assignment.class?.name || '',
    students: state.assignment.roster || []
  };
}

function memoryStatus(message = '') {
  elements.rememberStudentStatus.textContent = message;
}

function syncStudentMemoryControls() {
  if(courseIdentity){
    elements.rememberStudentRow.hidden=false;elements.changeRememberedStudent.hidden=true;
    elements.rememberStudent.disabled=courseIdentity.read().status==='unavailable'||Boolean(state.selectedStudent&&!officialStudent(state.selectedStudent));
    elements.rememberStudent.checked=studentMemory.preference;
    if(!elements.rememberStudentStatus.textContent)memoryStatus('Lần sau trình duyệt tự nhận bạn và mở đúng phiếu. Bỏ tick nếu dùng máy chung.');
    return;
  }
  const selected = state.selectedStudent;
  const nonOfficial = Boolean(selected) && !officialStudent(selected);
  elements.rememberStudentRow.hidden = !studentMemory.enabled;
  elements.rememberStudent.disabled = !studentMemory.storage || nonOfficial;
  elements.rememberStudent.checked = studentMemory.preference && !nonOfficial;
  const remembered = readMemory(studentMemory.storage, studentMemory.key);
  elements.changeRememberedStudent.hidden = !studentMemory.enabled || (!selected && !remembered.studentRef);
  if (!studentMemory.enabled) return;
  if (!studentMemory.storage) memoryStatus('Trình duyệt chưa lưu được lựa chọn. Bạn vẫn có thể chọn và làm phiếu.');
  else if (nonOfficial) memoryStatus('Hồ sơ này chỉ dùng trong phiếu hiện tại và không được ghi nhớ.');
  else if (!elements.rememberStudentStatus.textContent) memoryStatus('Bỏ tick nếu dùng máy chung. Bạn vẫn cần xác nhận tên trước khi mở phiếu.');
}

function applyStudentMemory() {
  if (!studentMemory.enabled || studentMemory.busy || state.attempt) return;
  const remembered = readMemory(studentMemory.storage, studentMemory.key);
  const match = resolveRememberedStudent([studentMemory.group], remembered.studentRef, '', config.STUDENT_MEMORY);
  state.selectedStudent = match?.student || null;
  elements.studentSelect.value = match?.studentRef || '';
  elements.chooseStudentButton.disabled = !state.selectedStudent;
  if (match) memoryStatus('Đã chọn sẵn tên của bạn. Kiểm tra trước khi tiếp tục.');
  else if (remembered.studentRef) memoryStatus('Tên đã nhớ không còn phù hợp với danh sách phiếu này. Hãy chọn lại.');
  else if (remembered.status === 'unavailable') memoryStatus('Trình duyệt chưa đọc được ghi nhớ. Bạn vẫn có thể chọn và làm phiếu.');
  else memoryStatus('Bỏ tick nếu dùng máy chung. Hãy chọn đúng tên trước khi mở phiếu.');
  syncStudentMemoryControls();
}

function clearRememberedSelection() {
  if (studentMemory.busy || state.attempt) return false;
  if (!writeMemory(studentMemory.storage, studentMemory.key, '')) {
    memoryStatus('Không thể xóa ghi nhớ trong trình duyệt. Hãy kiểm tra cài đặt lưu dữ liệu.');
    return false;
  }
  state.selectedStudent = null;
  elements.studentSelect.value = '';
  elements.chooseStudentButton.disabled = true;
  memoryStatus('Đã quên lựa chọn trên thiết bị này. Hãy chọn người học.');
  syncStudentMemoryControls();
  elements.studentSelect.focus();
  return true;
}

function installStudentMemory() {
  if(!config.DEMO_MODE&&!['DEMO-56','DEMO-67'].includes(state.assignment.courseCode)){
    courseIdentity=createCourseStudentIdentity({product:'progress-log',entry:state.assignment.assignmentId,requestIdentity:requestMappingStudentIdentity});
    studentMemory.enabled=true;
    if(!studentMemory.installed){
      elements.rememberStudent.addEventListener('change',()=>{studentMemory.preference=elements.rememberStudent.checked;});
      const change=elements.changeRememberedStudent.cloneNode(true);change.id='progressLogChangeStudent';change.hidden=false;
      change.textContent='Đổi người học';change.addEventListener('click',()=>void changeProgressStudent());
      document.querySelector('.topbar').append(change);studentMemory.installed=true;
    }
    courseIdentity.subscribe(()=>{if(state.attempt||state.confirmedStudent)setNotice('Người đã nhớ vừa đổi ở tab khác. Phiếu này vẫn giữ nguyên người và câu trả lời.');});
    syncStudentMemoryControls();return;
  }
  studentMemory.group = progressRosterGroup();
  studentMemory.enabled = Boolean(config.STUDENT_MEMORY?.enabled && allowedGroup(studentMemory.group, config.STUDENT_MEMORY));
  if (!studentMemory.enabled) {
    elements.rememberStudentRow.hidden = true;
    elements.changeRememberedStudent.hidden = true;
    return;
  }
  studentMemory.key = memoryKey(config.API_BASE_URL, location.href);
  try { studentMemory.storage = window.localStorage; } catch { studentMemory.storage = null; }
  if (!studentMemory.installed) {
    elements.rememberStudent.addEventListener('change', () => { studentMemory.preference = elements.rememberStudent.checked; });
    elements.changeRememberedStudent.addEventListener('click', clearRememberedSelection);
    window.addEventListener('storage', event => {
      if (event.storageArea !== studentMemory.storage || (event.key !== studentMemory.key && event.key !== null)) return;
      if (studentMemory.busy || state.attempt || state.submitting) {
        setNotice('Lựa chọn ghi nhớ đã đổi ở tab khác. Phiếu đang mở vẫn thuộc người học hiện tại.', '');
        return;
      }
      applyStudentMemory();
    });
    studentMemory.installed = true;
  }
  applyStudentMemory();
}

let commentPoller=null;
function showView(id) {
  for (const viewId of viewIds) elements[viewId].hidden = viewId !== id;
  commentPoller?.refresh();
  if(THUY_UI){document.querySelector('#thuyGreeting')?.remove();const name=state.attempt?.identity.studentName||state.thuyReadOnly?.student.name;if(name){const greeting=document.createElement('h1');greeting.id='thuyGreeting';greeting.textContent='Xin chào, '+name;document.querySelector('main').prepend(greeting);}}
}

function setNotice(message = '', kind = '') {
  elements.notice.textContent = message;
  elements.notice.className = `notice${kind ? ` ${kind}` : ''}`;
}

let observedWindow = null;
function updateSubmissionWindow(value) {
  observedWindow = observeSubmissionWindow(value, performance.now());
  renderSubmissionWindow();
}

function renderSubmissionWindow() {
  const now = performance.now();
  const host = document.getElementById('submissionWindowNotice');
  if(THUY_UI){
    if(host){host.textContent=submissionWindowMessage(observedWindow,now);host.hidden=!host.textContent;}
    const open=windowCanSubmit(observedWindow,now);
    elements.confirmButton.hidden=!open;
    for(const button of document.querySelectorAll('[data-thuy-submit]'))button.disabled=state.submitting||!open;
    if(!open)for(const control of elements.questionList.querySelectorAll('input,textarea,select,button.keyword-word'))control.disabled=true;
    if(state.thuyWindowOpen!==undefined&&state.thuyWindowOpen!==open&&!elements.formView.hidden){state.thuyWindowOpen=open;renderCheckpoint();}
    else state.thuyWindowOpen=open;
    return;
  }
  // Bài đã chốt: nút chỉ mở biên nhận đã lưu, kể cả phiếu vừa hết hạn.
  if (state.submissionPayload) {
    if (host) host.hidden = true;
    elements.submitButton.disabled = false;
    return;
  }
  if (host) {
    host.textContent = submissionWindowMessage(observedWindow, now);
    host.hidden = !host.textContent;
  }
  if (!windowCanSubmit(observedWindow, now)) {
    state.journeyOnly = true;
    elements.confirmButton.hidden = true;
    elements.submitButton.disabled = true;
    elements.nextButton.disabled = !state.checkpointSubmissions.has(currentBlock()?.blockId);
  }
}

// Trang mở sẵn cập nhật bằng đồng hồ máy chủ; khi mất mạng giữ hạn đã biết và draft.
setInterval(renderSubmissionWindow, 1000);
setInterval(async () => {
  if (!state.assignment?.definition || state.submitting || state.journeyOnly) return;
  try {
    const payload = await apiRequest('/assignments/open', { body: { publicToken: state.publicToken },
      signal: AbortSignal.timeout(7000) });
    updateSubmissionWindow(payload.assignment.submissionWindow);
    if(THUY_UI&&JSON.stringify(state.assignment.blockReleases)!==JSON.stringify(payload.assignment.blockReleases)){
      state.assignment.blockReleases=payload.assignment.blockReleases||[];
      if(!elements.formView.hidden)renderCheckpoint();
    }
  } catch { /* Lỗi mạng không xóa draft hoặc thay hạn đã nhận. Backend vẫn kiểm khi nộp. */ }
}, 15000);

function fail(title, message) {
  elements.errorTitle.textContent = title;
  elements.errorMessage.textContent = message;
  setNotice('', '');
  showView('errorView');
}

function readPublicToken() {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = fragment.get('assignment') || '';
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(token) ? token : '';
}

async function apiRequest(path, { method = 'POST', body, signal } = {}) {
  if (!config.API_BASE_URL) throw new Error('Trang chưa được cấu hình địa chỉ API.');
  const response = await fetch(`${config.API_BASE_URL}/api/learning${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(config.DEMO_MODE ? { 'x-progress-log-demo': '1' } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.message || `Hệ thống trả về mã ${response.status}.`);
    error.code = payload?.error || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return payload;
}

function draftStorageKey() {
  return state.assignment && state.selectedStudent
    ? `progress-log:draft:${state.assignment.assignmentId}:${state.selectedStudent.studentRef}`
    : '';
}
const learnerStorage=()=>THUY_UI?localStorage:sessionStorage;

function storeLocalDraft() {
  if (state.submissionPayload) return true;
  const key = draftStorageKey();
  if (!key) return true;
  const payload = {
    definitionHash: state.assignment.definitionHash,
    serverRevisionAtChange: state.attempt?.draftRevision || 0,
    responses: state.responses,
    expiresAt: Date.now() + (THUY_UI?30*24:12) * 60 * 60 * 1000
  };
  try{learnerStorage().setItem(key,JSON.stringify(payload));return true;}
  catch{setNotice('Trình duyệt chưa giữ được nháp. Đừng đóng trang; hãy lưu lên máy chủ hoặc sao chép câu trả lời.','error');return false;}
}

function readLocalDraft(serverRevision) {
  const key = draftStorageKey();
  if (!key) return null;
  try {
    const value = JSON.parse(learnerStorage().getItem(key) || 'null');
    if (!value || value.expiresAt < Date.now() || value.definitionHash !== state.assignment.definitionHash) {
      learnerStorage().removeItem(key);
      return null;
    }
    if (!Number.isInteger(value.serverRevisionAtChange) || value.serverRevisionAtChange < serverRevision) return null;
    return value.responses && typeof value.responses === 'object' && !Array.isArray(value.responses)
      ? value.responses
      : null;
  } catch {
    try{learnerStorage().removeItem(key);}catch{}
    return null;
  }
}

function clearLocalDraft() {
  const key = draftStorageKey();
  if (key) try{learnerStorage().removeItem(key);}catch{}
}

// Chỉ giữ mã lượt đã nộp trong tab, tách theo dịch vụ/phiếu/học viên/version.
// Khi tải lại vẫn xác nhận tên và đọc máy chủ; không lưu đáp án hoặc tự mở lượt mới nếu đọc lỗi.
function submittedAttemptKey(studentRef) {
  return `progress-log:submitted:${config.API_BASE_URL}:${state.assignment.assignmentId}:${studentRef}`;
}

function readSubmittedAttempt(studentRef) {
  try {
    const saved = JSON.parse(learnerStorage().getItem(submittedAttemptKey(studentRef)) || 'null');
    if (saved?.definitionHash !== state.assignment.definitionHash
      || saved?.attempt?.identity?.studentRef !== studentRef
      || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(saved.attempt.attemptToken)) return null;
    return saved.attempt;
  } catch { return null; }
}

function rememberSubmittedAttempt() {
  const attempt = state.attempt;
  if (!attempt?.identity?.studentRef) return;
  try {
    learnerStorage().setItem(submittedAttemptKey(attempt.identity.studentRef), JSON.stringify({
      definitionHash: state.assignment.definitionHash,
      attempt: { attemptToken: attempt.attemptToken, draftRevision: attempt.draftRevision, identity: attempt.identity,
        ...(THUY_UI?{checkpointSubmissions:[...state.checkpointSubmissions.values()]}:{}) }
    }));
  } catch { /* Trình duyệt chặn lưu: màn chữa hiện tại vẫn hoạt động. */ }
}

function setSaveState(label, kind = '') {
  elements.saveState.textContent = label;
  elements.saveState.className = `save-state${kind ? ` ${kind}` : ''}`;
  const retry=document.querySelector('#thuyRetrySave');if(retry)retry.hidden=!label.startsWith('Chưa lưu');
}

function randomDelay(minimum, maximum) {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function scheduleSave() {
  storeLocalDraft();
  setSaveState('Đang ghi nhận…');
  window.clearTimeout(state.idleTimer);
  state.idleTimer = window.setTimeout(
    () => void flushDraft(),
    randomDelay(AUTOSAVE_IDLE_MIN_MS, AUTOSAVE_IDLE_MAX_MS)
  );
  if (!state.maxTimer) {
    state.maxTimer = window.setTimeout(
      () => void flushDraft(),
      randomDelay(AUTOSAVE_FORCE_MIN_MS, AUTOSAVE_FORCE_MAX_MS)
    );
  }
}

function clearSaveTimers() {
  window.clearTimeout(state.idleTimer);
  window.clearTimeout(state.maxTimer);
  state.idleTimer = 0;
  state.maxTimer = 0;
}

function flushDraft() {
  clearSaveTimers();
  if (state.submissionPayload) return state.saveChain;
  if (!state.attempt || state.savedVersion === state.changeVersion) return state.saveChain;
  const requestedVersion = state.changeVersion;
  state.saveChain = state.saveChain.then(async () => {
    const revision = state.attempt.draftRevision + 1;
    const payload = await apiRequest('/attempts/draft', {
      method: 'PATCH',
      body: {
        attemptToken: state.attempt.attemptToken,
        revision,
        definitionHash: state.assignment.definitionHash,
        responses: state.responses
      }
    });
    state.attempt.draftRevision = Number(payload.draft.revision);
    state.savedVersion = requestedVersion;
    setSaveState(state.savedVersion === state.changeVersion ? 'Đã lưu' : 'Có thay đổi mới', 'saved');
    if (state.savedVersion !== state.changeVersion) scheduleSave();
  }).catch(error => {
    setSaveState('Chưa lưu — vẫn còn trên máy');
    setNotice(error.message, 'error');
  });
  return state.saveChain;
}

function allBlocks() {
  return state.assignment?.definition?.blocks || [];
}

function allItems() {
  return allBlocks().flatMap(block => block.items || []);
}

function currentBlock() {
  return allBlocks()[state.checkpointIndex];
}

function displayStudent(student) {
  return student.discriminator ? `${student.name} · ${student.discriminator}` : student.name;
}

function responseFor(item) {
  return state.responses[item.itemVersionId] ?? '';
}

function itemIsVisible(item) {
  const dependencyId = item.interactionConfig?.visibleWhenItemVersionId;
  if (!dependencyId) return true;
  const selected = state.responses[dependencyId];
  return Array.isArray(selected)
    ? selected.includes(item.interactionConfig.visibleWhenValue)
    : selected === item.interactionConfig.visibleWhenValue;
}

function itemIsRequired(_item) {
  // Giữ metadata câu hỏi để báo cáo; Progress Log cho phép nộp mọi câu trống.
  return false;
}

function responseIsPresent(item, value) {
  if (item?.layoutType === 'numbered_short_texts') {
    const expected = Number(item.interactionConfig?.responseCount || 0);
    return Array.isArray(value)
      && value.length === expected
      && value.every(entry => String(entry || '').trim().length > 0);
  }
  if (Array.isArray(value)) return value.some(entry => String(entry || '').trim().length > 0);
  if (value && typeof value === 'object') {
    return Number.isInteger(value.correct) && Number.isInteger(value.total) && value.total > 0;
  }
  return String(value ?? '').trim().length > 0;
}

function recordResponse(itemId, value) {
  if(THUY_UI&&(state.thuyReadOnly||state.submissionPayload||allBlocks().some(b=>b.items.some(i=>i.itemVersionId===itemId)&&state.checkpointSubmissions.has(b.blockId))))return;
  if (value === undefined || (Array.isArray(value) && value.length === 0)) delete state.responses[itemId];
  else state.responses[itemId] = value;
  state.changeVersion += 1;
  scheduleSave();
}

const SENTENCE_COMPLETION_LAYOUTS = Object.freeze({
  '56000000-0000-4000-8400-000000000004': [
    { title: 'Task Response:', parts: ['Yêu cầu người viết phải trả lời đúng ', ' và ', '.'] },
    { title: 'Coherence and Cohesion:', parts: ['Đảm bảo sự liên kết về ', ' (Coherence) và liên kết về ', ' (Cohesion).'] },
    { title: 'Lexical Resource:', parts: ['Sử dụng từ vựng đảm bảo tính ', ' và ', '.'] },
    { title: 'Grammatical Range and Accuracy:', parts: ['Sử dụng cấu trúc ngữ pháp đảm bảo tính ', ' và ', '.'] }
  ],
  '56000000-0000-4000-8400-000000000006': [
    { title: '', parts: ['', ' và ', '.'] }
  ]
});

const sentenceMeasureContext = document.createElement('canvas').getContext('2d');

function resizeSentenceBlank(control) {
  const sentence = control.closest('.sentence-text, .reasoning-chain');
  const availableWidth = Math.max(90, (sentence?.clientWidth || 420) - 8);
  if (sentenceMeasureContext) {
    sentenceMeasureContext.font = window.getComputedStyle(control).font;
    const textWidth = sentenceMeasureContext.measureText(control.value || ' ').width;
    control.style.width = `${Math.min(availableWidth, Math.max(108, Math.ceil(textWidth) + 24))}px`;
  }
  control.style.height = 'auto';
  control.style.height = `${Math.max(30, control.scrollHeight)}px`;
}

function buildSentenceCompletion(item) {
  const templates = item.interactionConfig?.sentenceLines || SENTENCE_COMPLETION_LAYOUTS[item.itemVersionId];
  const expected = Number(item.interactionConfig?.responseCount || 0);
  if (!templates || templates.reduce((count, line) => count + line.parts.length - 1, 0) !== expected) return null;
  const existing = Array.isArray(responseFor(item)) ? responseFor(item) : [];
  const group = document.createElement('div');
  group.className = 'sentence-group';
  let slot = 0;
  for (const [rowIndex, template] of templates.entries()) {
    const row = document.createElement('div');
    row.className = 'sentence-row';
    if (templates.length > 1 && !item.interactionConfig?.sentenceLines) {
      const marker = document.createElement('span');
      marker.className = 'sentence-index';
      marker.textContent = `${rowIndex + 1}.`;
      row.append(marker);
    }
    const sentence = document.createElement('p');
    sentence.className = 'sentence-text';
    if (template.title) {
      const title = document.createElement('strong');
      title.textContent = `${template.title} `;
      sentence.append(title);
    }
    sentence.append(document.createTextNode(template.parts[0]));
    for (let part = 1; part < template.parts.length; part += 1) {
      const input = document.createElement('textarea');
      input.className = 'sentence-blank';
      input.rows = 1;
      input.maxLength = 2_000;
      input.required = itemIsRequired(item);
      input.value = existing[slot] || '';
      input.setAttribute('aria-label', item.interactionConfig.responseLabels?.[slot] || `${item.prompt} — ô ${slot + 1}`);
      input.addEventListener('input', event => {
        if (!event.isComposing) input.value = input.value.replace(/\s*[\r\n]+\s*/g, ' ');
        resizeSentenceBlank(input);
        recordResponse(item.itemVersionId, [...group.querySelectorAll('textarea')].map(control => control.value));
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
      });
      sentence.append(input, document.createTextNode(template.parts[part]));
      slot += 1;
    }
    row.append(sentence);
    group.append(row);
  }
  return group;
}

// Nhận câu điền một từ: đặt ô ngay tại dấu chấm, giữ đáp án là chuỗi đơn để lưu/chấm như cũ.
// Dùng cùng ô tự giãn của khóa 56; câu không có đúng một chỗ trống giữ cách nhập hiện hành.
function buildSingleSentenceCompletion(item, label) {
  if (item.interactionType !== 'short_text' || item.pedagogicalTypeCode !== 'sentence_completion') return false;
  const parts = item.prompt.split(/\.{3,}|…+/u);
  if (parts.length !== 2) return false;
  const required = label.querySelector('.required');
  const input = document.createElement('textarea');
  input.className = 'sentence-blank';
  input.rows = 1;
  input.maxLength = 2_000;
  input.required = itemIsRequired(item);
  input.value = String(responseFor(item));
  input.setAttribute('aria-label', item.prompt);
  input.addEventListener('input', event => {
    if (!event.isComposing) input.value = input.value.replace(/\s*[\r\n]+\s*/g, ' ');
    resizeSentenceBlank(input);
    recordResponse(item.itemVersionId, input.value);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
  });
  label.classList.add('sentence-text');
  label.replaceChildren(document.createTextNode(parts[0]), input, document.createTextNode(parts[1]));
  if (required) label.append(required);
  return true;
}

function buildReasoningChain(item) {
  const config = item.interactionConfig || {};
  const chain = document.createElement('div');
  chain.className = 'reasoning-chain';
  const before = document.createElement('div');
  before.className = 'reasoning-chain-node';
  before.textContent = config.beforeText;
  const firstArrow = document.createElement('span');
  firstArrow.className = 'reasoning-chain-arrow';
  firstArrow.setAttribute('aria-hidden', 'true');
  firstArrow.textContent = '→';
  const input = document.createElement('textarea');
  input.className = 'sentence-blank reasoning-chain-input';
  input.rows = 1;
  input.maxLength = 2_000;
  input.required = itemIsRequired(item);
  input.value = String(responseFor(item));
  input.placeholder = 'Điền mắt xích còn thiếu';
  input.setAttribute('aria-label', item.prompt);
  input.addEventListener('input', event => {
    if (!event.isComposing) input.value = input.value.replace(/\s*[\r\n]+\s*/g, ' ');
    resizeSentenceBlank(input);
    recordResponse(item.itemVersionId, input.value);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
  });
  const secondArrow = firstArrow.cloneNode(true);
  const after = document.createElement('div');
  after.className = 'reasoning-chain-node';
  after.textContent = config.afterText;
  chain.append(before, firstArrow, input, secondArrow, after);
  return chain;
}

function refreshConditionalQuestions() {
  const block = currentBlock();
  if (!block) return;
  const items=THUY_UI?allBlocks().flatMap(part=>part.items):block.items;
  let removedHiddenAnswer = false;
  for (const item of items.filter(candidate => candidate.layoutType === 'conditional_other_text')) {
    const visible = itemIsVisible(item);
    const wrapper = elements.questionList.querySelector(`[data-item-version-id="${item.itemVersionId}"]`);
    if (wrapper) {
      wrapper.hidden = !visible;
      const requiredNow = false;
      for (const control of wrapper.querySelectorAll('input, textarea, select')) {
        control.required = requiredNow;
      }
      const marker = wrapper.querySelector('.required');
      if (marker) marker.hidden = !requiredNow;
    }
    if (!visible && Object.hasOwn(state.responses, item.itemVersionId)
      && !(THUY_UI&&(state.thuyReadOnly||state.submissionPayload||allBlocks().some(part=>part.items.includes(item)&&state.checkpointSubmissions.has(part.blockId))))) {
      delete state.responses[item.itemVersionId];
      removedHiddenAnswer = true;
    }
  }
  if (removedHiddenAnswer) {
    state.changeVersion += 1;
    scheduleSave();
  }
}

function buildChoice(item, option, inputType, optionIndex) {
  const label = document.createElement('label');
  label.className = 'choice';
  const input = document.createElement('input');
  input.type = inputType;
  input.name = item.itemVersionId;
  input.value = option.id;
  input.checked = inputType === 'radio'
    ? responseFor(item) === option.id
    : Array.isArray(responseFor(item)) && responseFor(item).includes(option.id);
  input.addEventListener('change', () => {
    if (inputType === 'radio') recordResponse(item.itemVersionId, input.value);
    else {
      const selected = [...label.parentElement.querySelectorAll('input:checked')].map(node => node.value);
      recordResponse(item.itemVersionId, selected);
    }
    for (const choice of label.parentElement.querySelectorAll('.choice')) {
      const checked = choice.querySelector('input').checked;
      choice.classList.toggle('selected', checked);
      choice.querySelector('.choice-key').textContent = checked ? '✓' : choice.dataset.key;
    }
    refreshConditionalQuestions();
  });
  const key = document.createElement('span');
  key.className = 'choice-key';
  label.dataset.key = /^[A-Z]$/.test(option.id) ? option.id : String.fromCharCode(65 + optionIndex);
  key.textContent = input.checked ? '✓' : label.dataset.key;
  label.classList.toggle('selected', input.checked);
  const text = document.createElement('span');
  text.className = 'choice-text';
  text.textContent = option.label;
  label.append(input, key, text);
  return label;
}

function buildSpeakingIssueChecklist(item, questionLabel) {
  const choices = document.createElement('div');
  choices.className = 'choice-list speaking-checklist';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-labelledby', questionLabel.id);
  const parentBlock=THUY_UI?allBlocks().find(block=>block.items.includes(item)):currentBlock();
  const children = parentBlock.items.filter(candidate =>
    candidate.layoutType === 'inline_option_text'
    && candidate.interactionConfig.visibleWhenItemVersionId === item.itemVersionId);
  let selected = Array.isArray(responseFor(item)) ? [...responseFor(item)] : [];
  const controls = [];
  const sync = () => {
    for (const control of controls) {
      const checked = selected.includes(control.option.id);
      control.checkbox.checked = checked;
      control.card.classList.toggle('selected', checked);
      control.label.classList.toggle('selected', checked);
      control.key.textContent = checked ? '✓' : control.card.dataset.key;
      if (control.textarea) {
        control.textarea.required = false;
        control.textarea.disabled = !checked && selected.length >= item.interactionConfig.maxSelections;
        if (!checked && control.textarea.value) {
          control.textarea.value = '';
          recordResponse(control.child.itemVersionId, undefined);
        }
      }
    }
  };
  const setSelection = next => {
    selected = next;
    recordResponse(item.itemVersionId, selected.length ? selected : undefined);
    sync();
  };
  for (const [index, option] of item.options.entries()) {
    const card = document.createElement('div');
    card.className = 'speaking-option';
    card.dataset.key = String(index + 1);
    const label = document.createElement('label');
    label.className = 'choice';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = item.itemVersionId;
    checkbox.value = option.id;
    const key = document.createElement('span');
    key.className = 'choice-key';
    const title = document.createElement('span');
    title.className = 'choice-text';
    title.textContent = option.label;
    label.append(checkbox, key, title);
    card.append(label);
    const child = children.find(candidate => candidate.interactionConfig.visibleWhenValue === option.id);
    let textarea = null;
    if (child) {
      const field = document.createElement('div');
      field.className = 'speaking-inline-field';
      field.dataset.itemVersionId = child.itemVersionId;
      textarea = document.createElement('textarea');
      textarea.rows = 2;
      textarea.maxLength = 2_000;
      textarea.placeholder = option.id === 'OTHER' ? 'Nêu rõ vấn đề khác…' : 'Em hãy nêu cụ thể…';
      textarea.value = String(responseFor(child));
      textarea.setAttribute('aria-label', child.prompt);
      field.append(textarea);
      card.append(field);
      textarea.addEventListener('input', () => {
        if (textarea.value.trim() && !selected.includes(option.id)) {
          if (selected.length >= item.interactionConfig.maxSelections) {
            textarea.value = '';
            setNotice('Em chỉ được chọn tối đa 2 mục. Hãy bỏ một mục trước khi nhập thêm.', 'error');
            return;
          }
          setSelection([...selected.filter(id => id !== item.interactionConfig.exclusiveOptionId), option.id]);
        }
        recordResponse(child.itemVersionId, textarea.value || undefined);
      });
    }
    controls.push({ option, card, label, checkbox, key, child, textarea });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (option.id === item.interactionConfig.exclusiveOptionId) {
          setSelection([option.id]);
        } else {
          const otherSelections = selected.filter(id => id !== item.interactionConfig.exclusiveOptionId);
          if (otherSelections.length >= item.interactionConfig.maxSelections) {
            setNotice('Em chỉ được chọn tối đa 2 mục. Hãy bỏ một mục trước khi chọn thêm.', 'error');
            sync();
            return;
          }
          setSelection([...otherSelections, option.id]);
        }
      } else {
        setSelection(selected.filter(id => id !== option.id));
      }
      setNotice('');
    });
    choices.append(card);
  }
  sync();
  return choices;
}

function buildQuestion(item) {
  const wrapper = document.createElement('div');
  wrapper.className = `question ${item.layoutType || 'plain_prompt'}`;
  if (item.layoutType === 'matching_heading_dropdown' && item.graderType === 'unordered_group_slot') {
    wrapper.classList.add('answer-option-dropdown');
  }
  wrapper.dataset.itemVersionId = item.itemVersionId;
  wrapper.hidden = !itemIsVisible(item);
  const number = document.createElement('span');
  number.className = 'question-number';
  const presentation=THUY_UI?questionPresentation(item):null;
  number.textContent = presentation?'Câu '+presentation.number:item.displayNumber || String(item.position);
  const content = document.createElement('div');
  content.className = 'question-content';
  const label = document.createElement('h3');
  label.id = `question-${item.itemVersionId}`;
  label.textContent = presentation?presentation.title:item.prompt;
  if (itemIsRequired(item)) {
    const required = document.createElement('span');
    required.className = 'required';
    required.textContent = ' *';
    required.hidden = !itemIsRequired(item);
    label.append(required);
  }
  wrapper.append(number, content);
  content.append(label);
  if(item.interactionConfig?.hintText){
    const hint=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p');
    summary.textContent='Xem gợi ý';text.textContent=item.interactionConfig.hintText;hint.append(summary,text);content.append(hint);
  }
  if (item.helpText) {
    const help = document.createElement('p');
    help.className = 'help';
    help.textContent = item.helpText;
    content.append(help);
  }
  // Matching Information chỉ cần chọn đoạn; giữ nguyên ID và giá trị để nháp/bài cũ đọc được.
  if (THUY_UI && item.pedagogicalTypeCode === 'matching_information'
    && item.interactionType === 'single_choice' && item.skillCodes?.includes('reading')) {
    wrapper.classList.add('matching-information');
    const select = document.createElement('select');
    select.className = 'matching-information-select';
    select.setAttribute('aria-label', `Câu ${item.displayNumber || item.position}: chọn đoạn văn`);
    const placeholder = document.createElement('option');
    placeholder.value = '';placeholder.textContent = 'Chọn đoạn';select.append(placeholder);
    for (const option of item.options) {
      const choice = document.createElement('option');choice.value = option.id;choice.textContent = option.label;select.append(choice);
    }
    select.value = String(responseFor(item) || '');
    select.addEventListener('change', () => recordResponse(item.itemVersionId, select.value || undefined));
    content.append(select);
    return wrapper;
  }
  if (buildSingleSentenceCompletion(item, label)) return wrapper;
  if(item.layoutType==='keyword_selection'&&item.interactionType==='multi_choice_group'){
    content.append(keywordSelection(item,responseFor(item),recordResponse));return wrapper;
  }
  if(item.layoutType==='matching_pairs'){
    const existing=Array.isArray(responseFor(item))?responseFor(item):[],group=document.createElement('div');
    group.className='numbered-text-group';
    item.interactionConfig.matchingPrompts.forEach((prompt,index)=>{
      const row=document.createElement('label'),text=document.createElement('span'),select=document.createElement('select');
      text.textContent=prompt;const empty=document.createElement('option');empty.value='';empty.textContent='Chọn vế phải';select.append(empty);
      for(const option of item.options){const choice=document.createElement('option');choice.value=option.id;choice.textContent=option.label;select.append(choice);}
      select.value=existing[index]||'';select.setAttribute('aria-label','Ghép cặp '+(index+1)+': '+prompt);
      select.addEventListener('change',()=>recordResponse(item.itemVersionId,[...group.querySelectorAll('select')].map(s=>s.value)));
      row.append(text,select);group.append(row);
    });content.append(group);
  } else if (item.interactionType === 'number_score') {
    const score = responseFor(item);
    const config = item.interactionConfig || {};
    const row = document.createElement('div');
    row.className = 'number-score';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(config.min ?? 0);
    input.max = String(config.max);
    input.step = String(config.step ?? 1);
    input.required = itemIsRequired(item);
    input.value = score && typeof score === 'object' ? String(score.correct) : '';
    input.setAttribute('aria-label', item.prompt);
    input.addEventListener('input', () => {
      if (input.value === '') recordResponse(item.itemVersionId, undefined);
      else recordResponse(item.itemVersionId, { correct: Number(input.value), total: Number(config.max) });
    });
    const total = document.createElement('b');
    total.textContent = `/ ${config.max} ${config.unit || ''}`.trim();
    row.append(input, total);
    content.append(row);
  } else if (item.layoutType === 'reasoning_chain_completion') {
    content.append(buildReasoningChain(item));
  } else if (item.layoutType === 'numbered_short_texts') {
    const sentence = buildSentenceCompletion(item);
    if (sentence) {
      content.append(sentence);
      return wrapper;
    }
    const count = Number(item.interactionConfig?.responseCount || 0);
    const labels = item.interactionConfig?.responseLabels || [];
    const existing = Array.isArray(responseFor(item)) ? responseFor(item) : [];
    const group = document.createElement('div');
    group.className = 'numbered-text-group';
    for (let index = 0; index < count; index += 1) {
      const row = document.createElement('label');
      row.className = 'numbered-text-row';
      const marker = document.createElement('span');
      marker.textContent = `${index + 1}.`;
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 2_000;
      input.required = itemIsRequired(item);
      input.value = existing[index] || '';
      input.setAttribute('aria-label', labels[index] || `${item.prompt} — ý ${index + 1}`);
      input.placeholder = labels[index] || `Ý ${index + 1}`;
      input.addEventListener('input', () => {
        const values = [...group.querySelectorAll('input')].map(control => control.value);
        recordResponse(item.itemVersionId, values);
      });
      row.append(marker, input);
      group.append(row);
    }
    content.append(group);
  } else if (item.layoutType === 'speaking_issue_checklist') {
    content.append(buildSpeakingIssueChecklist(item, label));
  } else if (item.layoutType === 'matching_heading_dropdown'
    && item.interactionType === 'single_choice') {
    const select = document.createElement('select');
    select.className = 'matching-heading-select';
    select.required = itemIsRequired(item);
    select.setAttribute('aria-labelledby', label.id);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = item.graderType === 'unordered_group_slot' ? 'Chọn' : 'Chọn heading';
    select.append(placeholder);
    for (const option of item.options) {
      const choice = document.createElement('option');
      choice.value = option.id;
      choice.textContent = option.id + '. ' + option.label;
      select.append(choice);
    }
    select.value = String(responseFor(item) || '');
    const preview = document.createElement('p');
    preview.className = 'heading-choice-preview';
    const showSelection = () => {
      const selected = item.options.find(option => option.id === select.value);
      preview.textContent = selected ? selected.id + '. ' + selected.label : '';
      preview.hidden = !selected;
    };
    showSelection();
    select.addEventListener('change', () => {
      recordResponse(item.itemVersionId, select.value || undefined);
      showSelection();
    });
    content.append(select, preview);
  } else if (item.interactionType === 'short_text' || item.interactionType === 'long_text') {
    const input = document.createElement(item.interactionType === 'long_text' ? 'textarea' : 'input');
    if (input instanceof HTMLInputElement) input.type = 'text';
    input.value = String(responseFor(item));
    input.maxLength = item.interactionType === 'long_text' ? 12_000 : 2_000;
    input.required = itemIsRequired(item);
    input.setAttribute('aria-label', item.prompt);
    input.addEventListener('input', () => recordResponse(item.itemVersionId, input.value));
    content.append(input);
  } else {
    const choices = document.createElement('div');
    choices.className = 'choice-list';
    choices.setAttribute('role', item.interactionType === 'single_choice' ? 'radiogroup' : 'group');
    choices.setAttribute('aria-labelledby', label.id);
    const inputType = item.interactionType === 'multi_choice_group' && item.graderType !== 'unordered_group_slot'
      ? 'checkbox'
      : 'radio';
    choices.append(...item.options.map((option, index) => buildChoice(item, option, inputType, index)));
    content.append(choices);
  }
  return wrapper;
}

function buildCheckpointQuestions(items) {
  if(THUY_UI){
    const comparison=items.filter(i=>i.groupId==='comparison-reading'&&i.layoutType==='numbered_short_texts');
    if(comparison.length===2)return [comparisonTable(comparison,{valueFor:responseFor,onChange:recordResponse,resizeInput:resizeSentenceBlank}),...buildCheckpointQuestions(items.filter(i=>!comparison.includes(i)))];
  }
  const compact = buildCompactExercises(items, {
    valueFor: responseFor, requiredFor: itemIsRequired, onChange: recordResponse, resizeInput: resizeSentenceBlank
  });
  if (compact) return compact;
  const flowchart = buildDropdownFlowchart(items, {
    valueFor: responseFor, requiredFor: itemIsRequired, onChange: recordResponse
  });
  if (flowchart) return flowchart;
  const questions = [];
  for (let index = 0; index < items.length; index += 1) {
    const first = items[index];
    if(THUY_UI){const keywordGroup=buildKeywordGroup(items.slice(index),buildQuestion);if(keywordGroup){questions.push(keywordGroup.element);index+=keywordGroup.count-1;continue;}}
    const group = [first];
    // Chỉ gộp các ô chọn cùng nhóm và nguyên văn câu hỏi/lựa chọn giống nhau.
    // Mỗi ô vẫn dùng item riêng để giữ nháp, required và phản hồi chấm hiện hành.
    if (first.layoutType === 'matching_heading_dropdown'
      && first.interactionType === 'single_choice'
      && first.graderType === 'unordered_group_slot' && first.groupId) {
      while (index + group.length < items.length) {
        const next = items[index + group.length];
        if (next.groupId !== first.groupId || next.layoutType !== first.layoutType
          || next.interactionType !== first.interactionType || next.graderType !== first.graderType
          || next.prompt !== first.prompt || next.helpText !== first.helpText
          || JSON.stringify(next.options) !== JSON.stringify(first.options)) break;
        group.push(next);
      }
    }
    if (group.length === 1) {
      questions.push(buildQuestion(first));
      continue;
    }
    const section = document.createElement('div');
    section.className = 'answer-dropdown-group';
    const heading = document.createElement('h3');
    heading.id = `answer-group-${first.itemVersionId}`;
    heading.textContent = first.prompt;
    section.setAttribute('role', 'group');
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading);
    if (first.helpText) {
      const help = document.createElement('p');
      help.className = 'help';
      help.textContent = first.helpText;
      section.append(help);
    }
    for (const item of group) {
      const row = buildQuestion(item);
      row.classList.add('answer-dropdown-row');
      const content = row.querySelector('.question-content');
      content.querySelector('h3').remove();
      content.querySelector('.help')?.remove();
      const number = row.querySelector('.question-number');
      number.id = `answer-number-${item.itemVersionId}`;
      row.querySelector('select').setAttribute('aria-labelledby', `${heading.id} ${number.id}`);
      section.append(row);
    }
    questions.push(section);
    index += group.length - 1;
  }
  return questions;
}

function blockIsComplete(block) {
  return block.items.every(item => {
    if (!itemIsRequired(item)) return true;
    const value = responseFor(item);
    return responseIsPresent(item, value);
  });
}

function releaseFor(block) {
  return (state.assignment.blockReleases || []).find(item => item.blockId === block.blockId) || null;
}

function blockIsOpen(block) {
  const release = releaseFor(block);
  return !release || release.status === 'open';
}

function showCheckpointFeedback(block) {
  const result = state.checkpointSubmissions.get(block.blockId)?.result;
  if (!result || result.answerRelease !== 'released' || !result.summary?.maxScore) return;
  const score = document.createElement('p');
  score.className = 'checkpoint-score';
  const correct = result.items.filter(item => item.verdict === 'correct').length;
  const total = result.items.filter(item => item.maxScore > 0).length;
  score.textContent = `${block.title.split(' · ')[0]}: ${correct}/${total} câu đúng`;
  elements.questionList.prepend(score);
  for (const item of result.items) {
    if (!item.expectedAnswer) continue;
    const question = [...elements.questionList.querySelectorAll('[data-item-version-id]')]
      .find(node => node.dataset.itemVersionId === item.itemVersionId);
    if (!question) continue;
    // Notes có ô nhập riêng từng câu: hiện chữa bài bằng kết quả máy chủ, không chấm ở trình duyệt.
    if (question.classList.contains('compact-exercise-answer')) {
      const feedback = document.createElement('p');
      feedback.className = 'heading-feedback ' + (item.verdict === 'correct' ? 'is-correct' : 'is-incorrect');
      const source = block.items.find(candidate => candidate.itemVersionId === item.itemVersionId);
      feedback.textContent = `Câu ${source.displayNumber}: ${item.verdict === 'correct' ? 'Đúng' : 'Sai'}. Đáp án đúng: ${answerLabel(source, item.expectedAnswer)}`;
      question.append(feedback);
      continue;
    }
    const dropdown = question.querySelector('.matching-heading-select');
    if (dropdown) {
      dropdown.value = String(item.rawAnswer || '');
      const feedback = document.createElement('p');
      feedback.className = 'heading-feedback ' + (item.verdict === 'correct' ? 'is-correct' : 'is-incorrect');
      feedback.textContent = (item.verdict === 'correct' ? 'Em chọn đúng.' : 'Em chọn sai.')
        + ' Đáp án đúng: ' + answerLabel(block.items.find(candidate =>
          candidate.itemVersionId === item.itemVersionId), item.expectedAnswer);
      if (question.classList.contains('flowchart-answer')) {
        feedback.textContent = `Câu ${block.items.find(candidate => candidate.itemVersionId === item.itemVersionId).displayNumber}: ` + feedback.textContent;
        question.closest('.flowchart-stage').querySelector('.flowchart-feedback').append(feedback);
      } else question.querySelector('.question-content').append(feedback);
      continue;
    }
    for (const choice of question.querySelectorAll('.choice')) {
      const input = choice.querySelector('input');
      const selected = input.value === item.rawAnswer;
      const expected = input.value === item.expectedAnswer;
      input.checked = selected;
      choice.classList.toggle('selected', selected);
      choice.classList.toggle('feedback-correct', expected);
      choice.classList.toggle('feedback-incorrect', selected && !expected);
      choice.querySelector('.choice-key').textContent = expected ? '✓' : selected ? '✕' : choice.dataset.key;
      if (expected || selected) {
        const feedback = document.createElement('span');
        feedback.className = 'choice-feedback';
        feedback.textContent = expected ? (selected ? 'Em chọn đúng' : 'Đáp án đúng') : 'Em chọn sai';
        choice.append(feedback);
      }
    }
  }
}

function answerLabel(item, answer) {
  const selected = Array.isArray(answer) ? answer : [answer];
  return selected.map((value,index) => {
    const option = item.options?.find(candidate => candidate.id === value);
    const label=option ? `${option.id}. ${option.label}` : String(value ?? '—');
    return item.layoutType==='matching_pairs'?`${item.interactionConfig.matchingPrompts[index]} → ${label}`:label;
  }).join(', ');
}

function renderFinalFeedback(result) {
  const scored = result?.answerRelease === 'released'
    ? (result.items || []).filter(item => item.maxScore > 0 && item.expectedAnswer != null)
    : [];
  elements.gradedResults.hidden = scored.length === 0;
  elements.gradedItemList.replaceChildren();
  if (!scored.length) return;
  const correct = scored.filter(item => item.verdict === 'correct').length;
  elements.gradedSummary.textContent = `${correct}/${scored.length} câu đúng`;
  for (const grade of scored) {
    const block = allBlocks().find(candidate => candidate.items.some(item => item.itemVersionId === grade.itemVersionId));
    const item = block?.items.find(candidate => candidate.itemVersionId === grade.itemVersionId);
    if (!item) continue;
    const card = document.createElement('article');
    card.className = `graded-item ${grade.verdict === 'correct' ? 'is-correct' : 'is-incorrect'}`;
    const heading = document.createElement('h3');
    heading.textContent = `Phần ${block.checkpoint} · Câu ${item.displayNumber || item.position}: ${grade.verdict === 'correct' ? 'Đúng' : 'Sai'}`;
    const prompt = document.createElement('p');
    prompt.textContent = item.prompt;
    const chosen = document.createElement('p');
    chosen.textContent = `Em chọn: ${answerLabel(item, grade.rawAnswer)}`;
    const expected = document.createElement('p');
    expected.textContent = `Đáp án đúng: ${answerLabel(item, grade.expectedAnswer)}`;
    card.append(heading, prompt, chosen, expected);
    elements.gradedItemList.append(card);
  }
}

function renderCheckpoint() {
  if(THUY_UI){
    renderThuyLearner({state,elements,blocks:allBlocks(),buildQuestions:buildCheckpointQuestions,
      canSubmit:!state.thuyReadOnly&&windowCanSubmit(observedWindow,performance.now()),releaseFor,onSubmit:index=>void submitThuyPart(index),
      onRetry:()=>void completeThuyForm(),onJourney:()=>void openIntegratedJourney('formView'),onRefresh:renderCheckpoint});
    const comments=document.createElement('div');comments.id='thuyComments';const comment=commentPanel(state.thuyComments?.find(n=>n.sessionNumber===state.assignment.sessionNumber));if(comment)comments.append(comment);elements.questionList.append(comments);
    refreshConditionalQuestions();renderSubmissionWindow();
    window.requestAnimationFrame(()=>{for(const control of elements.questionList.querySelectorAll('.sentence-blank'))resizeSentenceBlank(control);});return;
  }
  const blocks = allBlocks();
  const block = currentBlock();
  if (!block) return;
  const minutes = Number(state.assignment?.definition?.estimatedMinutes || 0);
  elements.checkpointLabel.textContent = `PHẦN ${state.checkpointIndex + 1}/${blocks.length}${minutes ? ` · ${minutes} PHÚT` : ''}`;
  elements.checkpointTitle.textContent = block.title;
  elements.checkpointInstructions.textContent = block.instructions || '';
  elements.checkpointInstructions.hidden = !block.instructions;
  elements.questionList.replaceChildren(...buildCheckpointQuestions(block.items
    .filter(item => item.layoutType !== 'inline_option_text')));
  refreshConditionalQuestions();
  window.requestAnimationFrame(() => {
    for (const control of elements.questionList.querySelectorAll('.sentence-blank')) resizeSentenceBlank(control);
  });
  if (state.checkpointSubmissions.has(block.blockId)) {
    for (const control of elements.questionList.querySelectorAll('input, textarea, select')) control.disabled = true;
    showCheckpointFeedback(block);
  }
  elements.previousButton.hidden = state.checkpointIndex === 0 || Boolean(state.submissionPayload);
  elements.nextButton.hidden = state.checkpointIndex === blocks.length - 1;
  elements.submitButton.hidden = state.checkpointIndex !== blocks.length - 1;
  elements.submitButton.textContent = state.submissionPayload
    ? 'Xem xác nhận điểm danh' : 'Nộp phiếu';
  const nextBlock = blocks[state.checkpointIndex + 1];
  if (nextBlock && state.checkpointSubmissions.has(block.blockId) && !blockIsOpen(nextBlock)) {
    elements.nextButton.textContent = 'Kiểm tra phần tiếp theo';
  } else if (state.checkpointSubmissions.has(block.blockId)) {
    elements.nextButton.textContent = 'Tiếp tục phần tiếp theo';
  } else {
    elements.nextButton.textContent = 'Nộp phần và tiếp tục';
  }
  elements.progressBar.style.width = `${((state.checkpointIndex + 1) / blocks.length) * 100}%`;
  const participation = document.getElementById('participationState');
  if (participation) {
    participation.textContent = participationNotice();
    participation.hidden = !participation.textContent;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderSubmissionWindow();
}

async function refreshBlockReleases() {
  const payload = await apiRequest('/assignments/open', { body: { publicToken: state.publicToken } });
  state.assignment.blockReleases = payload.assignment.blockReleases || [];
  updateSubmissionWindow(payload.assignment.submissionWindow);
}

// Nộp từng phần độc lập; hoàn tất tự động chỉ sau khi máy chủ đã nhận mọi phần.
async function submitThuyPart(index){
  if(state.submitting||!state.attempt||state.submissionPayload)return;
  state.checkpointIndex=index;state.submitting=true;renderCheckpoint();
  try{
    await refreshBlockReleases();
    await flushDraft();
    if(state.savedVersion!==state.changeVersion)throw Error('Chưa lưu xong nháp. Bấm Thử lưu lại rồi nộp phần.');
    await submitCurrentCheckpoint();
    setNotice(participationNotice());
    if(allBlocks().every(b=>state.checkpointSubmissions.has(b.blockId)))await completeThuyForm();
  }catch(error){setNotice(error.message+' '+participationNotice(),'error');}
  finally{state.submitting=false;renderCheckpoint();}
}
async function completeThuyForm(){
  if(state.submissionPayload||!allBlocks().every(b=>state.checkpointSubmissions.has(b.blockId)))return;
  state.submitting=true;state.thuyCompletionError='';
  try{
    state.thuyFinalId??=crypto.randomUUID();
    const payload=await apiRequest('/attempts/submit',{body:{attemptToken:state.attempt.attemptToken,
      submissionId:state.thuyFinalId,definitionHash:state.assignment.definitionHash,
      draftRevision:state.attempt.draftRevision,responses:state.responses}});
    showSubmittedOutcome(payload);
  }catch(error){
    try{const saved=await apiRequest('/attempts/result',{body:{attemptToken:state.attempt.attemptToken}});showSubmittedOutcome(saved);}
    catch{state.thuyCompletionError='Các phần đã được nhận; chưa xác nhận hoàn tất phiếu. '+error.message;}
  }finally{state.submitting=false;renderCheckpoint();}
}
async function submitCurrentCheckpoint() {
  if (!windowCanSubmit(observedWindow, performance.now())) {
    const error = new Error('Phiếu đã khóa nhận bài. Câu trả lời đang làm vẫn được giữ lại.');
    error.code = 'ASSIGNMENT_CLOSED';
    throw error;
  }
  const block = currentBlock();
  if (!blockIsOpen(block)) throw new Error('Phần này chưa được giảng viên mở.');
  await flushDraft();
  const payload = await apiRequest('/attempts/checkpoints/submit', {
    body: {
      attemptToken: state.attempt.attemptToken,
      checkpointSubmissionId: crypto.randomUUID(),
      blockId: block.blockId,
      checkpoint: block.checkpoint,
      draftRevision: state.attempt.draftRevision,
      definitionHash: state.assignment.definitionHash,
      responses: state.responses,
      idempotencyKey: `checkpoint:${state.attempt.attemptToken}:${block.blockId}:v1`
    }
  });
  state.checkpointSubmissions.set(block.blockId, payload.checkpointSubmission);
  if (payload.checkpointSubmission.attendance) state.attempt.attendance = payload.checkpointSubmission.attendance;
  return payload.checkpointSubmission;
}

function participationNotice() {
  if (!state.attempt?.attendance?.status) return '';
  if (config.DEMO_MODE || ['DEMO-56', 'DEMO-67'].includes(state.assignment?.courseCode)) {
    return 'Bản dùng thử đã ghi nhận tham gia. Không ghi điểm danh lớp thật.';
  }
  return ['self_confirmed', 'teacher_confirmed'].includes(state.attempt.attendance.status)
    ? 'Đã ghi nhận tham gia trong Progress Log; xem trạng thái đồng bộ Portal ở giảng viên.'
    : 'Điểm danh được giữ theo điều chỉnh của giảng viên.';
}

async function continueToNextCheckpoint() {
  if (!validateCurrentBlock() || state.submitting) return;
  const block = currentBlock();
  const nextBlock = allBlocks()[state.checkpointIndex + 1];
  state.submitting = true;
  elements.nextButton.disabled = true;
  try {
    let justSubmitted = false;
    if (!state.checkpointSubmissions.has(block.blockId)) {
      setNotice('Đang ghi nhận phần này…');
      await submitCurrentCheckpoint();
      justSubmitted = true;
    }
    await refreshBlockReleases();
    if (justSubmitted && state.checkpointSubmissions.get(block.blockId)?.result?.answerRelease === 'released') {
      setNotice(participationNotice() + ' ' + (blockIsOpen(nextBlock)
        ? 'Phần này đã được chấm. Xem kết quả rồi bấm “Tiếp tục phần tiếp theo”.'
        : 'Phần này đã được chấm. Xem kết quả và chờ giảng viên mở phần tiếp theo.'));
      renderCheckpoint();
      return;
    }
    if (!blockIsOpen(nextBlock)) {
      setNotice(participationNotice() + ' Phần này đã được ghi nhận. Hãy chờ giảng viên mở phần tiếp theo.');
      renderCheckpoint();
      return;
    }
    state.checkpointIndex += 1;
    setNotice(participationNotice() + ' Phần trước đã được ghi nhận.');
    renderCheckpoint();
  } catch (error) {
    setNotice(error.message, 'error');
    if (state.checkpointSubmissions.has(block.blockId)) renderCheckpoint();
  } finally {
    state.submitting = false;
    elements.nextButton.disabled = false;
  }
}

function validateCurrentBlock() {
  const invalidControl = elements.questionList.querySelector('textarea:invalid, input:invalid, select:invalid');
  if (!invalidControl) return true;
  setNotice('Có dữ liệu chưa đúng định dạng hoặc vượt giới hạn. Bạn có thể để trống câu chưa làm.', 'error');
  const firstEmpty = invalidControl || elements.questionList.querySelector('textarea, input, select');
  firstEmpty?.reportValidity?.();
  firstEmpty?.focus();
  return false;
}

// Nhận Journey đã lọc theo lớp và học viên; tạo DOM an toàn, không đưa nội dung học viên vào HTML.
// Khi chưa có dữ liệu hoặc request lỗi, phiếu hiện tại vẫn giữ nguyên và học viên có thể quay lại.
function journeyText(tag, value, className = '') {
  const node = document.createElement(tag);
  node.textContent = String(value ?? '');
  if (className) node.className = className;
  return node;
}

function journeyPortalMessage(status) {
  if (status === 'complete') return 'Luồng điểm danh Portal đã xử lý; kết quả thực tế cần được đối chiếu trên Portal.';
  if (status === 'review_required') return 'Portal báo điểm danh cần giảng viên kiểm tra.';
  if (status === 'failed') return 'Đồng bộ Portal chưa thành công; giảng viên cần kiểm tra.';
  if (['queued', 'processing', 'retry_wait'].includes(status)) return 'Yêu cầu điểm danh đang chờ đồng bộ sang Portal.';
  return 'Chưa có trạng thái đồng bộ Portal để đối chiếu.';
}

function renderIntegratedJourney(journey) {
  elements.journeyStudentName.textContent = 'Chào '+journey.student.name+', đây là hành trình học của em';
  elements.journeyClassName.textContent = journey.class.name;
  elements.attendedCount.textContent = journey.summary.attendedSessions;
  elements.submittedCount.textContent = journey.summary.submittedComplete;
  elements.reportCount.textContent = journey.summary.availableReports;
  if(elements.journeyAssignedCount) {
    elements.journeyAssignedCount.textContent=(journey.sessions||[]).filter(s=>s.assignmentId).length;
    elements.journeyPlanCount.textContent='Trong kế hoạch '+journey.summary.totalSessions+' buổi';
    elements.journeyCorrectCount.textContent=(journey.sessions||[]).reduce((n,s)=>n+(s.quizSummary?.correct||0),0);
    elements.journeyIncorrectCount.textContent=(journey.sessions||[]).reduce((n,s)=>n+(s.quizSummary?.incorrect||0),0);
    elements.journeyListTitle.textContent=journey.summary.totalSessions+' buổi học, từng bước rõ ràng';
  }
  state.journeyData = journey;
  const sessions = (journey.sessions || []).map(session => {
    const status = sessionState(session, {assignmentId:session.assignmentId,
      status:session.completeness==='complete'?'complete':session.testResult?'test_result':session.completeness==='incomplete'?'incomplete':session.conflict?'needs_review':'not_submitted'},
      session.assignmentId?{title:session.title,status:session.assignmentStatus}:null);
    if(session.completeness==='incomplete')Object.assign(status,{kind:'complete',label:'Đã nộp · còn câu trống',canLearn:false});
    const completed = ['complete','incomplete'].includes(session.completeness)||Boolean(session.sessionComment?.noteText);
    const learn = !completed&&status.canLearn && /^[0-9a-f-]{36}$/iu.test(session.publicToken||'');
    const item = document.createElement(learn?'a':completed?'button':'article');
    item.dataset.sessionNumber=String(session.sessionNumber);
    item.className = 'studentSessionCard session-'+status.kind;
    if (learn) {
      item.href=(THUY_UI?'./thuy.html':'./index.html')+'#assignment='+encodeURIComponent(session.publicToken);
      item.addEventListener('click',event=>{
        if(new URL(item.href).pathname===window.location.pathname){event.preventDefault();window.location.hash='assignment='+encodeURIComponent(session.publicToken);window.location.reload();}
      });
    }
    if (completed) {item.type='button';item.addEventListener('click',()=>void openStudentJourneyDetail(session));}
    const heading = document.createElement('div'); heading.className='studentSessionTop';
    const number='BUỔI '+String(session.sessionNumber).padStart(2,'0');
    const date=/^\d{4}-\d{2}-\d{2}$/u.test(session.sessionDate||'')?session.sessionDate.split('-').reverse().join('/'):'Chưa xác nhận ngày';
    heading.append(journeyText('b',number),journeyText('span',date));
    const title=contentTitle(session,{title:session.assignmentId||session.sessionKind==='test'?session.title:''});
    const bottom=document.createElement('div');bottom.className='studentSessionBottom';
    bottom.append(journeyText('i',status.label));
    if(session.quizSummary?.graded>0)bottom.append(journeyText('b',session.quizSummary.correct+'/'+session.quizSummary.graded));
    item.append(heading,journeyText('strong',title),journeyText('small',skillsLabel(title)||'Trong kế hoạch khóa học'),bottom);
    if(THUY_UI&&session.sessionNumber===state.assignment.sessionNumber)item.append(journeyText('small','Đang xem','badge blue'));
    const comment=commentPanel(session.sessionComment);if(comment)item.append(comment);
    if(session.testResult){
      const result=journeyText('div','', 'sessionTestScore');
      for(const skill of ['listening','reading','writing']){
        const score=session.testResult[skill];if(!score)continue;
        result.append(journeyText('small',skill==='writing'?'Writing: '+(score.status==='ready'?score.score:score.status==='pending'?'đã nộp, đang chờ điểm':'chưa có bài nộp')
          :skill[0].toUpperCase()+skill.slice(1)+': '+score.correct+'/'+score.total));
      }
      item.append(result);
    }
    return item;
  });
  elements.journeySessions.replaceChildren(...(sessions.length ? sessions
    : [journeyText('p', 'Chưa có buổi học nào được ghi nhận.', 'muted')]));
  paintJourneyComments(elements.journeyView,elements.journeySessions,journey.sessions,session=>void openStudentJourneyDetail(session));
  const reports = (journey.reports || []).map(report => {
    const item = document.createElement('article');
    item.className = 'history-report';
    item.append(journeyText('b', `Tổng kết đến buổi ${report.toSessionNumber}`),
      journeyText('p', report.systemOutput?.progress?.[0]?.text
        || report.systemMarkdown || 'Chưa có nội dung tổng kết.'));
    if (report.humanNote) item.append(journeyText('p', report.humanNote));
    return item;
  });
  elements.journeyReports.hidden = reports.length === 0;
  elements.journeyReportList.replaceChildren(...reports);
  const inferredCount = (journey.sessions || []).filter(session => session.dataOrigin === 'inferred_gap'
    || (!session.dataOrigin && !session.assignmentId && session.sessionKind !== 'test')).length;
  elements.journeyStatus.textContent = journey.coverage?.planOutdated
    ? 'Kế hoạch ' + journey.coverage.plannedSessions + ' buổi cần được giảng viên kiểm lại: '
      + 'đã có dữ liệu đến buổi ' + journey.coverage.knownThroughSession + '.'
    : journey.coverage?.schedule === 'teacher_confirmed'
      ? 'Giảng viên đã xác nhận kế hoạch ' + journey.coverage.plannedSessions
        + ' buổi. Ngày học chỉ hiện ở buổi đã được xác nhận. '
        + (journey.coverage.testResults === 'connected'
          ? 'Kết quả Test tự cập nhật khi bài hoàn tất; điểm Writing có thể đến sau.'
          : journey.coverage.testResults === 'temporarily_unavailable'
            ? 'Nguồn kết quả Test tạm thời chưa đọc được.'
            : 'Chưa ghép nguồn kết quả Test cho lớp.')
    : sessions.length
      ? 'Có dữ liệu đến buổi ' + (journey.coverage?.knownThroughSession || sessions.at(-1).sessionNumber)
        + '. ' + inferredCount + ' ô buổi chưa có nguồn xác nhận; lịch đầy đủ và điểm Test chưa được nối vào Journey.'
      : 'Chưa có dữ liệu buổi học trong Journey; lịch lớp và kết quả Test chưa được nối.';
  if (journey.scheduleStatus === 'needs_review') {
    elements.journeyStatus.textContent += ' Có điểm danh cần đối soát; giữ nguyên buổi đã ghi. Giảng viên cần kiểm tra.';
  } else if (journey.scheduleStatus === 'temporarily_unavailable') {
    elements.journeyStatus.textContent += ' Chưa đọc được lịch Portal hiện hành; đang giữ dữ liệu đã lưu.';
  }
}

function renderPersonSkillsForStudent(root,overview,forms,person){
  state.thuyStudentCourse=thuySkills.buildSkillCourse(overview,forms);
  thuySkills.renderPersonSkills(root,state.thuyStudentCourse,person,{history:false});
}
async function loadThuyStudentSkills(journey,{signal,current}){
  let root=elements.journeyView.querySelector('#thuyStudentSkills');
  if(!root){root=document.createElement('section');root.id='thuyStudentSkills';elements.journeyView.querySelector('.studentJourney').before(root);}
  root.textContent='Đang đọc kết quả bốn kỹ năng…';
  const records=new Map(),finals=journey.sessions.filter(session=>['complete','incomplete'].includes(session.completeness));
  try{
    for(let offset=0;offset<finals.length;offset+=3){
      const details=await Promise.all(finals.slice(offset,offset+3).map(async session=>{
        const {detail}=await apiRequest('/student/course-session-detail',{body:{publicToken:state.publicToken,studentRef:journey.student.studentRef,identityConfirmed:true,sessionNumber:session.sessionNumber},signal});
        if(detail.student?.studentRef!==journey.student.studentRef||String(detail.classId)!==String(journey.class.classId)||detail.sessionNumber!==session.sessionNumber)throw Error('Chi tiết chưa khớp người, lớp và buổi.');return detail;
      }));if(!current())return;for(const detail of details)records.set(detail.sessionNumber,detail);
    }
    if(!current())return;
    const person={...journey.student,externalTests:journey.externalTests||[],cells:journey.sessions.map(session=>({...session,status:session.completeness,testResult:session.testResult}))};
    const overview={classId:journey.class.classId,sessions:journey.sessions,students:[person]};
    const forms=journey.sessions.map(session=>{
      const source=records.get(session.sessionNumber),detail=source?legacyFeedbackForView(source):null,definition=detail?.definition||{blocks:[]};
      const student={...journey.student,submissionId:detail?.submissionId,sessionComment:session.sessionComment,teacherSessionFeedback:detail?.teacherSessionFeedback};
      return {sessionNumber:session.sessionNumber,definition,dashboard:{students:[student]},live:{students:[{studentRef:person.studentRef,submissionId:detail?.submissionId,finalResponses:detail?.responses||{}}]}};
    });
    renderPersonSkillsForStudent(root,overview,forms,person);
  }catch(error){if(current()){root.textContent='Chưa đọc đủ kết quả kỹ năng: '+(signal.aborted?'Hết thời gian chờ.':error.message)+' Lịch sử bên dưới vẫn xem được.';}}
}

// Cập nhật nhãn tại đầu phút theo đồng hồ Việt Nam; không đọc/ghi API để mở khóa.
function scheduleJourneyClock() {
  clearTimeout(state.journeyClock);
  if (!state.journeyData || elements.journeyView?.hidden !== false) return;
  state.journeyClock = setTimeout(() => {
    if (elements.journeyView?.hidden === false) renderIntegratedJourney(state.journeyData);
    scheduleJourneyClock();
  }, 60_000 - Date.now() % 60_000 + 20);
}

async function openStudentJourneyDetail(session) {
  state.journeyDetailController?.abort();
  const generation = (state.journeyDetailGeneration || 0) + 1;
  state.journeyDetailGeneration = generation;state.journeyDetailSession = session;
  const controller = new AbortController();state.journeyDetailController = controller;
  const studentRef = state.journeyData?.student.studentRef, publicToken = state.publicToken;
  const classId = state.assignment.class.id;
  const current=()=>generation===state.journeyDetailGeneration&&publicToken===state.publicToken
    &&studentRef===state.journeyData?.student.studentRef&&elements.journeyDetailView.hidden===false;
  const timer=setTimeout(()=>controller.abort(),15_000);
  elements.journeyDetailContent.replaceChildren();elements.journeyDetailRetryButton.hidden=true;
  elements.journeyDetailStatus.textContent='Đang tải toàn bộ bài làm…';showView('journeyDetailView');
  try {
    const payload=await apiRequest('/student/course-session-detail', {body:{publicToken,studentRef,
      identityConfirmed:true,sessionNumber:session.sessionNumber},signal:controller.signal});
    if (!current()) return;
    const detail=payload.detail;
    if (detail.student?.studentRef!==studentRef||String(detail.classId)!==String(classId)
      ||detail.sessionNumber!==session.sessionNumber) throw new Error('Dữ liệu bài làm không khớp học viên và buổi đã chọn.');
    renderSessionReview(elements.journeyDetailContent,THUY_UI?legacyFeedbackForView(detail):detail,{session});elements.journeyDetailStatus.textContent='Bài đã nộp · chỉ để xem lại.';
  } catch(error) {
    if (!current()) return;
    elements.journeyDetailStatus.textContent='Chưa đọc được bài làm: '+(controller.signal.aborted?'Quá thời gian chờ; bạn có thể thử lại.':error.message);
    elements.journeyDetailRetryButton.hidden=false;
  } finally {clearTimeout(timer);}
}
function backToJourneyList() {
  state.journeyDetailGeneration=(state.journeyDetailGeneration||0)+1;state.journeyDetailController?.abort();
  elements.journeyDetailContent.replaceChildren();showView('journeyView');scheduleJourneyClock();
}

async function openIntegratedJourney(returnView) {
  if (state.journeyLoading || !state.assignment) return;
  const activeStudent=()=>THUY_UI?(state.attempt?.identity?.studentRef||state.thuyReadOnly?.student?.studentRef||state.confirmedStudent?.studentRef)
    :returnView==='resultView'?state.attempt?.identity?.studentRef:state.confirmedStudent?.studentRef;
  const studentRef = activeStudent();
  if (!studentRef) return;
  const assignment = state.assignment;
  const publicToken = state.publicToken;
  const generation = (state.journeyGeneration || 0) + 1;
  state.journeyGeneration = generation;
  const controller = new AbortController();
  state.journeyController = controller;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
  const current = () => generation === state.journeyGeneration
    && assignment === state.assignment && publicToken === state.publicToken
    && studentRef === activeStudent();
  state.journeyLoading = true;
  state.journeyReturnView = returnView;
  elements.journeyButton.disabled = true;
  elements.journeyResultButton.disabled = true;
  elements.journeyButton.textContent = elements.journeyResultButton.textContent = 'Đang tải hành trình…';
  elements.journeyLoadingView.setAttribute('aria-busy', 'true');
  elements.journeyLoadingStatus.textContent = 'Đang tải hành trình…';
  elements.journeySpinner.hidden = false;
  elements.journeyRetryButton.hidden = true;
  showView('journeyLoadingView');
  setNotice('Đang tải hành trình…');
  try {
    const payload = await apiRequest('/student/course-journey', {
      body: { publicToken, studentRef, identityConfirmed: true }, signal: controller.signal
    });
    if (!current()) return;
    const journey = payload.journey;
    if(state.automaticSelection&&courseIdentity&&!courseIdentity.isCurrent(state.automaticSelection))throw new Error('Người đã nhớ vừa đổi; chưa dùng phản hồi cũ.');
    if (journey.student?.studentRef !== studentRef
      || journey.class?.classId !== assignment.class.id) {
      throw new Error('Dữ liệu trả về không khớp người học và lớp đã chọn.');
    }
    renderIntegratedJourney(journey);
    showView('journeyView');
    scheduleJourneyClock();
    setNotice('Hành trình của bạn đã được cập nhật.');
    if(THUY_UI)await loadThuyStudentSkills(journey,{signal:controller.signal,current});
  } catch (error) {
    if (!current()) return;
    const message = timedOut ? 'Kết nối mất nhiều thời gian. Bạn có thể thử lại.' : error.message;
    elements.journeyLoadingStatus.textContent = `Chưa tải được hành trình: ${message}`;
    elements.journeyRetryButton.hidden = false;
    setNotice(`Chưa tải được hành trình: ${message}`, 'error');
  } finally {
    clearTimeout(timeout);
    if (generation === state.journeyGeneration) {
      state.journeyLoading = false;
      state.journeyController = null;
      elements.journeyLoadingView.setAttribute('aria-busy', 'false');
      elements.journeySpinner.hidden = true;
      elements.journeyButton.disabled = false;
      elements.journeyResultButton.disabled = false;
      elements.journeyButton.textContent = elements.journeyResultButton.textContent = 'Xem hành trình của em';
    }
  }
}

// Hủy lượt đọc khi quay về; câu trả lời và danh tính của phiếu giữ nguyên.
function backFromJourney() {
  clearTimeout(state.journeyClock);state.journeyData=null;
  state.journeyDetailGeneration=(state.journeyDetailGeneration||0)+1;state.journeyDetailController?.abort();
  state.journeyGeneration = (state.journeyGeneration || 0) + 1;
  state.journeyController?.abort();
  state.journeyController = null;
  state.journeyLoading = false;
  elements.journeyButton.disabled = elements.journeyResultButton.disabled = false;
  elements.journeyButton.textContent = elements.journeyResultButton.textContent = 'Xem hành trình của em';
  showView(state.journeyReturnView);
  setNotice('Bạn có thể tiếp tục với Progress Log.');
}

async function openAssignment() {
  state.publicToken = readPublicToken();
  if (!state.publicToken) {
    fail('Đường dẫn chưa đúng', 'Đây là địa chỉ trang chung, chưa có mã phiếu. Hãy nhờ giảng viên chọn phiếu trong dashboard rồi bấm “Sao chép link” để gửi đường dẫn đầy đủ.');
    return;
  }
  try {
    setNotice('Đang mở phiếu…');
    let assignment;
    state.journeyOnly = false;
    try {
      const payload = await apiRequest('/assignments/open', { body: { publicToken: state.publicToken } });
      assignment = payload.assignment;
    } catch (error) {
      if (error.status !== 404) throw error;
      const payload = await apiRequest('/student/journey-context', {
        body: { publicToken: state.publicToken }
      });
      assignment = payload.assignment;
      state.journeyOnly = true;
    }
    state.assignment = assignment;
    const nextEntry=!config.DEMO_MODE&&config.THUY_PILOT_CLASS_IDS?.includes(String(assignment.class.id))&&pilotEntry(location.href,assignment.class.id);
    if(nextEntry){location.replace(nextEntry);return;}
    updateSubmissionWindow(assignment.submissionWindow);
    const courseCode = String(state.assignment.courseCode || '').trim();
    elements.brandLabel.textContent = /^\d{2,3}$/.test(courseCode)
      ? `Progress Log · Khóa ${courseCode}`
      : 'Progress Log · IZONE';
    elements.sessionLabel.textContent = `BUỔI ${state.assignment.sessionNumber}`;
    elements.assignmentTitle.textContent = contentTitle(state.assignment,state.assignment);
    elements.classLabel.textContent = state.assignment.class.name;
    const options = state.assignment.roster.map(student => {
      const option = document.createElement('option');
      option.value = student.studentRef;
      option.textContent = displayStudent(student);
      return option;
    });
    elements.studentSelect.replaceChildren(new Option('Chọn tên của bạn', ''), ...options);
    elements.chooseStudentButton.disabled = true;
    installStudentMemory();
    const legacyDemo = ['DEMO-56', 'DEMO-67'].includes(courseCode);
    setNotice(state.journeyOnly
      ? 'Phiếu buổi này đã đóng. Chọn đúng tên để xem hành trình.'
      : config.DEMO_MODE
      ? 'Chọn một học viên mẫu để thử. Có thể làm lại bằng nút phía trên.'
      : legacyDemo
      ? 'Mỗi tên demo dùng để nộp một lượt. Nếu tên đã hoàn tất, hãy chọn tên demo khác.'
      : 'Chọn đúng tên để bắt đầu.');
    showView('identityView');
    if(courseIdentity)try{await applyCommonStudentMemory();}catch(error){setNotice('Chưa kiểm được người đã nhớ. Bạn vẫn có thể chọn tên. '+error.message,'error');}
  } catch (error) {
    fail('Phiếu chưa sẵn sàng', error.message);
  }
}

async function startAttempt({selection=null,pinned=false}={}) {
  try {
    if (!state.confirmedStudent || state.startingAttempt || state.journeyOnly) return;
    state.startingAttempt = true;
    const chosenStudent=state.confirmedStudent;
    const identityContext=courseIdentity&&!pinned?(selection?courseIdentity.automaticContext(selection):courseIdentity.prepare(chosenStudent.studentRef,'')):null;
    elements.confirmButton.disabled = true;
    elements.backToNamesButton.disabled = true;
    setNotice('Đang mở phần ghi nhận…');
    if(THUY_UI&&!config.DEMO_MODE){
      // Đọc bài đã nộp trên thiết bị khác trước; đường đọc này không tạo lượt hay điểm danh.
      let previous;
      try{previous=await apiRequest('/student/course-session-detail',{body:{publicToken:state.publicToken,
        studentRef:chosenStudent.studentRef,identityConfirmed:true,sessionNumber:state.assignment.sessionNumber}});}
      catch(error){if(error.code!=='JOURNEY_SUBMISSION_NOT_READY')throw error;}
      const detail=previous?.detail;
      if(detail?.submissionId){
        if(detail.student.studentRef!==chosenStudent.studentRef||String(detail.classId)!==String(state.assignment.class.id)
          ||detail.sessionNumber!==state.assignment.sessionNumber)throw Error('Bài đã nộp chưa khớp người, lớp và buổi.');
        state.thuyReadOnly=detail;state.responses=detail.responses||{};state.checkpointSubmissions=new Map();
        if(courseIdentity){if(!pinned)await courseIdentity.commit(identityContext,{automatic:Boolean(selection),remember:elements.rememberStudent.checked&&officialStudent(chosenStudent)});courseIdentity.pin(chosenStudent.studentRef);}
        elements.studentNameLabel.textContent=chosenStudent.name;elements.formContextLabel.textContent=state.assignment.class.name+' · Buổi '+state.assignment.sessionNumber;
        state.confirmedStudent=null;renderCheckpoint();showView('formView');setSaveState('Bài đã nộp · Chỉ đọc','saved');setNotice('Đã mở lại bài đã nộp. Không tạo lượt làm mới.');return;
      }
    }
    const remembered = readSubmittedAttempt(state.confirmedStudent.studentRef);
    const savedOutcome = remembered ? await apiRequest('/attempts/result', {
      body: { attemptToken: remembered.attemptToken }, signal: AbortSignal.timeout(15000)
    }) : null;
    if (remembered && !savedOutcome?.receipt) throw new Error('Chưa đọc lại được bài đã nộp. Hãy thử lại.');
    const payload = remembered ? { attempt: remembered } : await apiRequest('/attempts/start', {
      body: {
        publicToken: state.publicToken,
        studentRef: state.confirmedStudent.studentRef,
        clientIdempotencyKey: crypto.randomUUID(),
        identityConfirmed: true
      }
    });
    if(selection&&courseIdentity&&!courseIdentity.isCurrent(selection))throw new Error('Người đã nhớ vừa đổi. Phiếu chưa nhận phản hồi cũ; hãy chọn lại tên.');
    const opened=payload.attempt;
    if(courseIdentity&&(opened?.identity?.studentRef!==chosenStudent.studentRef
      ||String(opened.identity.classId)!==String(state.assignment.class.id||state.assignment.class.classId)
      ||Number(opened.identity.sessionNumber)!==Number(state.assignment.sessionNumber)
      ||(opened.assignmentId&&opened.assignmentId!==state.assignment.assignmentId)))throw new Error('Phiên trả về chưa khớp người, lớp và buổi. Phiếu cũ được giữ.');
    state.attempt = opened;
    if(courseIdentity){
      if(!pinned)await courseIdentity.commit(identityContext,{automatic:Boolean(selection),remember:elements.rememberStudent.checked&&officialStudent(chosenStudent)})
        .then(result=>{if(!['ok','empty'].includes(result.status))setNotice('Phiếu mở đúng người; trình duyệt chưa nhớ được cho bài khác.');}).catch(()=>{});
      courseIdentity.pin(chosenStudent.studentRef);
    }
    state.checkpointSubmissions = new Map(
      (state.attempt.checkpointSubmissions || []).map(item => [item.blockId, item])
    );
    state.responses = readLocalDraft(state.attempt.draftRevision) || state.attempt.draft || {};
    state.changeVersion = THUY_UI&&JSON.stringify(state.responses)!==JSON.stringify(state.attempt.draft||{})?1:0;
    state.savedVersion = 0;
    elements.studentNameLabel.textContent = state.attempt.identity.studentName;
    elements.formContextLabel.textContent = state.attempt.identity.className+' · '+sessionHeading({sessionNumber:state.attempt.identity.sessionNumber},state.assignment);
    setSaveState(state.attempt.draftRevision ? 'Đã khôi phục bản lưu' : 'Chưa có thay đổi', state.attempt.draftRevision ? 'saved' : '');
    setNotice('Bạn có thể điền mỗi phần ngay sau hoạt động tương ứng.');
    state.checkpointIndex = 0;
    const eligible = officialStudent(state.confirmedStudent) && allowedGroup(studentMemory.group || {}, config.STUDENT_MEMORY);
    if (!courseIdentity && studentMemory.enabled && !writeMemory(studentMemory.storage, studentMemory.key,
      elements.rememberStudent.checked && eligible ? state.confirmedStudent.studentRef : '')) {
      setNotice('Đã mở phiếu, nhưng trình duyệt chưa lưu được lựa chọn. Lần sau bạn có thể cần chọn lại.', 'error');
    }
    state.confirmedStudent = null;
    renderCheckpoint();
    showView('formView');
    if(THUY_UI&&state.changeVersion)scheduleSave();
    // Khôi phục bài đã chốt bằng đường đọc; không gửi lại checkpoint hoặc điểm danh.
    if (savedOutcome) {
      showSubmittedOutcome(savedOutcome);
    } else if (allBlocks().every(block => state.checkpointSubmissions.has(block.blockId))) {
      try {
        const saved = await apiRequest('/attempts/result', { body: { attemptToken: state.attempt.attemptToken } });
        if (saved.receipt) showSubmittedOutcome(saved);
      } catch (error) {
        if(THUY_UI&&error.code==='RESULT_NOT_READY')await completeThuyForm();
        else if (error.code !== 'RESULT_NOT_READY') setNotice(error.message, 'error');
      }
    }
  } catch (error) {
    setNotice(error.message, 'error');
    if(courseIdentity&&state.confirmedStudent&&!state.attempt)showView('confirmView');
    elements.confirmButton.disabled = false;
    elements.backToNamesButton.disabled = false;
  } finally {
    state.startingAttempt = false;
    studentMemory.busy = Boolean(state.confirmedStudent && !state.attempt);
    syncStudentMemoryControls();
  }
}

// Nhận bài và biên nhận đã được máy chủ chốt; chữa phần cuối bằng renderer hiện có.
// Điểm danh đã ghi nhận trước màn chữa; nút tiếp theo chỉ đổi màn, không nộp lần nữa.
function showSubmittedOutcome(payload) {
  state.submissionPayload = payload;
  rememberSubmittedAttempt();
  state.submitting = false;
  clearSaveTimers();
  clearLocalDraft();
  if (payload.submissionWindow) updateSubmissionWindow(payload.submissionWindow);
  if(THUY_UI){
    for(const item of payload.result?.items||[])state.responses[item.itemVersionId]=item.rawAnswer;
    setSaveState('Đã nộp phiếu','saved');renderCheckpoint();showView('formView');setNotice('Đã nhận đủ các phần. Bạn có thể xem lại bài làm.');return;
  }
  const block = allBlocks().at(-1);
  const result = payload.result;
  const items = (result?.items || []).filter(item => block?.items.some(question => question.itemVersionId === item.itemVersionId));
  if (result?.answerRelease !== 'released' || !items.some(item => item.maxScore > 0 && item.expectedAnswer != null)) {
    showSubmissionReceipt(payload);
    return;
  }
  for (const item of result.items) state.responses[item.itemVersionId] = item.rawAnswer;
  state.checkpointSubmissions.set(block.blockId, {
    ...state.checkpointSubmissions.get(block.blockId), blockId: block.blockId, result: { ...result, items }
  });
  state.checkpointIndex = allBlocks().length - 1;
  setSaveState('Đã nộp phiếu', 'saved');
  renderCheckpoint();
  showView('formView');
  const isDemo = config.DEMO_MODE || ['DEMO-56', 'DEMO-67'].includes(state.assignment.courseCode);
  setNotice((isDemo ? 'Bản dùng thử đã nhận phiếu. Không ghi điểm danh lớp thật.'
    : 'Đã nhận phiếu trong Progress Log.')
    + ' Xem đúng/sai rồi bấm “Xem xác nhận điểm danh”.');
}

function showSubmissionReceipt(payload) {
  clearLocalDraft();
  const receipt = payload.receipt;
  if (payload.submissionWindow) updateSubmissionWindow(payload.submissionWindow);
  const isDemo = config.DEMO_MODE || ['DEMO-56', 'DEMO-67'].includes(state.assignment.courseCode);
  elements.resultTitle.textContent = isDemo
    ? 'Bản dùng thử đã nhận phiếu. Không ghi điểm danh lớp thật.' : receipt.message;
  elements.attendanceResult.textContent = isDemo ? 'Chỉ ghi nhận trong bản dùng thử'
    : ['self_confirmed', 'teacher_confirmed'].includes(receipt.attendanceStatus)
      ? 'Đã ghi nhận tham gia; xem trạng thái Portal ở giảng viên' : 'Giữ theo trạng thái giảng viên xác nhận';
  elements.completenessResult.textContent = receipt.completeness === 'complete' ? 'Đã nộp phiếu · đủ câu trả lời' : 'Đã nộp phiếu · còn mục chưa trả lời đủ';
  renderFinalFeedback(payload.result);
  setNotice('Đã nhận phiếu. Bạn có thể đóng trang này.');
  showView('resultView');
}

async function submitForm(event) {
  event.preventDefault();
  if (state.submissionPayload) {
    showSubmissionReceipt(state.submissionPayload);
    return;
  }
  if (!windowCanSubmit(observedWindow, performance.now())) {
    setNotice('Phiếu đã khóa nhận bài. Câu trả lời đang làm vẫn được giữ lại.', 'error');
    return;
  }
  if (!validateCurrentBlock() || state.submitting) return;
  state.submitting = true;
  elements.submitButton.disabled = true;
  setNotice('Đang nộp phiếu…');
  clearSaveTimers();
  try {
    if (!state.checkpointSubmissions.has(currentBlock().blockId)) {
      await submitCurrentCheckpoint();
    }
    await flushDraft();
    const payload = await apiRequest('/attempts/submit', {
      body: {
        attemptToken: state.attempt.attemptToken,
        submissionId: crypto.randomUUID(),
        definitionHash: state.assignment.definitionHash,
        draftRevision: state.attempt.draftRevision,
        responses: state.responses
      }
    });
    showSubmittedOutcome(payload);
  } catch (error) {
    // Lệnh nộp có thể đã lưu trước khi mạng đứt. Đọc biên nhận cũ, không tạo bài mới.
    if (state.attempt?.attemptToken) {
      try {
        const saved = await apiRequest('/attempts/result', { body: { attemptToken: state.attempt.attemptToken },
          signal: AbortSignal.timeout(7000) });
        showSubmittedOutcome(saved);
        return;
      } catch { /* Chưa có biên nhận: giữ draft và hiển thị lỗi gốc. */ }
    }
    state.submitting = false;
    elements.submitButton.disabled = false;
    if (error.code === 'ASSIGNMENT_CLOSED') {
      updateSubmissionWindow({ ...observedWindow, canSubmit: false, reason: 'assignment_closed' });
    }
    setNotice(`${error.message} ${participationNotice() || 'Chưa có xác nhận điểm danh.'}`, 'error');
    if (state.checkpointSubmissions.has(currentBlock().blockId)) renderCheckpoint();
  }
}

elements.studentSelect.addEventListener('change', () => {
  if (studentMemory.busy) return;
  courseIdentity?.invalidate();state.automaticSelection=null;
  state.selectedStudent = state.assignment.roster.find(student => student.studentRef === elements.studentSelect.value) || null;
  elements.chooseStudentButton.disabled = !state.selectedStudent;
  memoryStatus('');
  syncStudentMemoryControls();
});

elements.chooseStudentButton.addEventListener('click', () => {
  if (!state.selectedStudent) return;
  state.confirmedStudent = state.selectedStudent;
  studentMemory.busy = true;
  elements.confirmName.textContent = displayStudent(state.confirmedStudent);
  elements.confirmContext.textContent = state.assignment.class.name+" · "+sessionHeading(state.assignment,state.assignment);
  elements.confirmButton.disabled = false;
  elements.confirmButton.hidden = state.journeyOnly;
  setNotice('Kiểm tra kỹ trước khi xác nhận.');
  showView('confirmView');
});

elements.backToNamesButton.addEventListener('click', () => {
  if (elements.backToNamesButton.disabled) return;
  state.confirmedStudent = null;
  state.startingAttempt = false;
  studentMemory.busy = false;
  showView('identityView');
  syncStudentMemoryControls();
});
elements.confirmButton.addEventListener('click', () => void startAttempt());
elements.journeyButton.addEventListener('click', () => void openIntegratedJourney('confirmView'));
elements.journeyResultButton.addEventListener('click', () => void openIntegratedJourney('resultView'));
elements.journeyBackButton.addEventListener('click', backFromJourney);
elements.journeyLoadingBackButton.addEventListener('click', backFromJourney);
elements.journeyRetryButton.addEventListener('click', () => void openIntegratedJourney(state.journeyReturnView));
elements.previousButton.addEventListener('click', () => {
  state.checkpointIndex = Math.max(0, state.checkpointIndex - 1);
  setNotice('');
  renderCheckpoint();
});
elements.nextButton.addEventListener('click', () => void continueToNextCheckpoint());
elements.reflectionForm.addEventListener('submit', event => void submitForm(event));
window.addEventListener('resize', () => {
  for (const control of elements.questionList.querySelectorAll('.sentence-blank')) resizeSentenceBlank(control);
});
elements.retryButton.addEventListener('click', () => void openAssignment());
document.querySelector('#thuyRetrySave')?.addEventListener('click',()=>void flushDraft());
document.querySelector('#thuyLessonNav')?.addEventListener('click',()=>{
  if(state.journeyData)backFromJourney();else showView(state.attempt||state.thuyReadOnly?'formView':'identityView');
});
document.querySelector('#thuyJourneyNav')?.addEventListener('click',()=>{
  if(!state.selectedStudent&&!state.attempt&&!state.thuyReadOnly){setNotice('Chọn đúng tên để xem kết quả học tập.');return;}
  void openIntegratedJourney(state.attempt||state.thuyReadOnly?'formView':'confirmView');
});
window.addEventListener('pagehide', () => {
  storeLocalDraft();
  clearSaveTimers();
});

commentPoller=createCommentPoller({request:apiRequest,context:()=>{
  if(config.DEMO_MODE)return null;
  if(THUY_UI&&!elements.formView.hidden){
    if(state.attempt?.attemptToken)return {attemptToken:state.attempt.attemptToken};
    if(state.thuyReadOnly)return {publicToken:state.publicToken,studentRef:state.thuyReadOnly.student.studentRef,identityConfirmed:true};
  }
  if(!elements.resultView.hidden&&state.attempt?.attemptToken)return {attemptToken:state.attempt.attemptToken};
  if((!elements.journeyView.hidden||!elements.journeyDetailView.hidden)&&state.journeyData)
    return {publicToken:state.publicToken,studentRef:state.journeyData.student.studentRef,identityConfirmed:true};
  return null;
},onData:(data,context)=>{
  const person=context.studentRef||state.attempt?.identity?.studentRef;
  if(data.studentRef!==person||String(data.classId)!==String(state.assignment?.class.id))return;
  const byNumber=new Map(data.comments.map(note=>[note.sessionNumber,note]));
  if(THUY_UI){state.thuyComments=data.comments;const host=document.querySelector('#thuyComments'),note=commentPanel(byNumber.get(state.assignment.sessionNumber));if(host)host.replaceChildren(...(note?[note]:[]));}
  if(state.journeyData?.student.studentRef===person){state.journeyData.sessions=state.journeyData.sessions.map(session=>({...session,sessionComment:byNumber.get(session.sessionNumber)||null}));
    if(THUY_UI&&state.thuyStudentCourse?.people[0]?.studentRef===person){
      for(const session of state.thuyStudentCourse.sessions){const student=session.students[0],note=byNumber.get(session.number);student.publishedFeedback=note?.visibility==='visible'?note.noteText:'';}
      const root=elements.journeyView.querySelector('#thuyStudentSkills');if(root&&!elements.journeyView.hidden)thuySkills.renderPersonSkills(root,state.thuyStudentCourse,state.thuyStudentCourse.people[0],{history:false});
    }
    if(!elements.journeyView.hidden)renderIntegratedJourney(state.journeyData);}
  if(!elements.journeyDetailView.hidden){elements.journeyDetailContent.querySelectorAll('[data-session-comment]').forEach(box=>box.remove());
    const panel=commentPanel(byNumber.get(state.journeyDetailSession?.sessionNumber));if(panel)elements.journeyDetailContent.append(panel);}
  elements.resultView.querySelectorAll('[data-session-comment]').forEach(box=>box.remove());
  const receipt=commentPanel(byNumber.get(state.assignment.sessionNumber));if(receipt)elements.resultView.append(receipt);
}});
bindDialogDismiss(elements.journeySummaryDialog);
void openAssignment();

elements.journeyDetailBackButton.addEventListener('click',backToJourneyList);
elements.journeyDetailRetryButton.addEventListener('click',()=>void openStudentJourneyDetail(state.journeyDetailSession));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!elements.journeyDetailView.hidden)backToJourneyList();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.journeyData&&!elements.journeyView.hidden)renderIntegratedJourney(state.journeyData);});

elements.journeySummaryButton.addEventListener('click',()=>{
  const table=document.createElement('table'),head=document.createElement('tr');
  for(const label of ['Buổi học','Tình trạng','Đúng','Sai'])head.append(journeyText('th',label));
  const thead=document.createElement('thead');thead.append(head);table.append(thead);const body=document.createElement('tbody');
  for(const session of state.journeyData.sessions.filter(s=>s.assignmentId)){
    const row=document.createElement('tr'),name=document.createElement('td');
    if(['complete','incomplete'].includes(session.completeness)){const button=journeyText('button',sessionHeading(session,session),'button text-button');button.type='button';button.addEventListener('click',()=>{elements.journeySummaryDialog.close();void openStudentJourneyDetail(session);});name.append(button);}
    else name.textContent=sessionHeading(session,session);
    row.append(name,journeyText('td',session.completeness==='complete'?'Đã nộp đủ câu':session.completeness==='incomplete'?'Đã nộp · còn câu trống':'Chưa nộp phiếu cuối'),journeyText('td',session.quizSummary?.graded?session.quizSummary.correct:'—'),journeyText('td',session.quizSummary?.graded?session.quizSummary.incorrect:'—'));body.append(row);
  }
  table.append(body);elements.journeySummaryContent.replaceChildren(table);elements.journeySummaryDialog.showModal();
});
