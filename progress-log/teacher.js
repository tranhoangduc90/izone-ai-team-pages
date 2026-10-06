import {renderClassAnalytics,renderStudentClassSummary} from './class-analytics-view.js';
import {contentTitle,sessionHeading} from './session-presentation.js';
import {observeSubmissionWindow, submissionWindowMessage} from './submission-window.js';
/*
 * Dữ liệu nhận vào: phiên đăng nhập ứng dụng, lớp được phân quyền và thư viện câu hỏi từ backend.
 * Xử lý: giảng viên chọn 2–3 câu, gán checkpoint, phát hành form bất biến và xem trạng thái nộp/điểm danh.
 * Kết quả: một link lớp để gửi cho học viên; mọi override điểm danh có lý do và operation ID riêng.
 * Khi lỗi: giao diện giữ dữ liệu đang chọn, không giả vờ đã lưu và hiện thông báo để thử lại.
 */
import { createTeacherLoginPreference } from '../shared/teacher-login-preference.js?rev=20260918-v1';
import { createTeacherSessionClient, teacherSessionRequestOptions } from '../shared/teacher-session-client.js?rev=20260920-v1';
import { renderCourseOverview, renderQuestionAnalytics, renderSessionDetail } from './teacher-course-overview.js?rev=20261003';
import {createFormDraftEditor} from './teacher-form-editor.js?rev=20261001-authoring-v1';

const config = window.PROGRESS_LOG_CONFIG || {};
const sessionClient = createTeacherSessionClient({
  apiBaseUrl: config.API_BASE_URL,
  sessionPath: '/api/auth/session'
});
const loginPreference = createTeacherLoginPreference(() => window.localStorage);
const state = {
  authenticated: false,
  authGeneration: 0,
  reviewer: null,
  classes: [],
  assignments: [],
  library: [],
  dashboard: null,
  liveByStudent: new Map(),
  dashboardGeneration: 0,
  dashboardLoading: 0,
  liveLoadingFor: '',
  overview: null,
  overviewGeneration: 0,
  overviewController: null,
  analyticsGeneration: 0,
  detailGeneration: 0,
  detailController: null,
  detailTarget: null,
  journeyPlan: null,
  journeyPlanAssignmentId: '',
  journeyPlanGeneration: 0,
  journeyPlanDirty: false,
  journeyPlanDrafts:new Map(),
  journeyPlanConflict:null,
  journeyPlanDateDraft: new Map(),
  journeyTestSourceDraft: new Map(),
  journeyErpSchedule: null,
  journeyErpScheduleAssignmentId: '',
  journeyErpScheduleGeneration: 0,
  journeyTestSources: null,
  journeyTestSourcesAssignmentId: '',
  journeyTestSourcesGeneration: 0,
  attendanceStudent: null,
  attendanceOperationId: null,
  reportStudent: null,
  studentJourneyLink: '',
  draftStudent: null,
  draftJourneyLink: '',
  feedbackOperationId: null
};

const elements = Object.fromEntries([
  'teacherName', 'teacherNotice', 'teacherAccessView', 'googleSignInButton', 'rememberTeacherLogin', 'teacherWorkspace', 'teacherLogoutButton',
  'createTab', 'dashboardTab', 'createPanel', 'dashboardPanel', 'publishForm', 'teacherClassSelect',
  'overviewTab', 'overviewPanel', 'overviewClassSelect', 'overviewFilter', 'overviewStatus', 'courseOverview', 'courseAnalytics', 'courseAnalyticsStatus',
  'refreshOverviewButton', 'openClassOverviewButton', 'questionAnalyticsStatus', 'questionAnalytics',
  'scoresTab', 'insightTab', 'scoresPanel', 'insightPanel',
  'journeyDetailDialog', 'journeyDetailStatus', 'journeyDetailContent', 'retryJourneyDetailButton',
  'journeyPlanSection', 'overviewPlanHost', 'dashboardPlanHost',
  'sessionNumber', 'formTitle', 'skillFilter', 'questionLibrary', 'publishButton', 'publishResult', 'rosterCount',
  'studentLink', 'copyLinkButton', 'assignmentSelect', 'dashboardTitle', 'refreshDashboardButton',
  'journeyPlanForm', 'journeyPlanConflict', 'journeyPlanTotal', 'journeyPlanTests', 'journeyPlanDates', 'journeyPlanStatus', 'saveJourneyPlanButton', 'reloadJourneyPlanButton',
  'loadJourneyErpScheduleButton', 'journeyErpScheduleStatus', 'journeyPlanDatesDetails',
  'loadJourneyTestSourcesButton', 'journeyTestSourcesStatus', 'journeyPlanTestSources',
  'previewStudentButton', 'openStudentFormButton', 'copyCurrentLinkButton', 'liveUpdatedAt',
  'blockControls', 'classInsights', 'dashboardSummary', 'studentList', 'attendanceDialog', 'attendanceForm', 'attendanceStudentName',
  'attendanceStatus', 'attendanceReason', 'attendanceSyncHint', 'saveAttendanceButton', 'reportDialog', 'reportStudentName',
  'reportScope', 'reportSystemContent', 'reportHumanNote', 'saveTeacherNoteButton', 'reportDeliveryStatus',
  'markReportDeliveredButton', 'copyStudentJourneyLinkButton', 'studentJourneyLinkStatus',
  'draftDialog', 'draftStudentName', 'draftStatus', 'draftAnswers',
  'draftSpeakingFeedback', 'draftFeedbackStatus', 'sendDraftFeedbackButton',
  'draftJourneyLinkStatus', 'copyDraftJourneyLinkButton'
].map(id => [id, document.getElementById(id)]));

const formEditor=createFormDraftEditor({host:document.getElementById('formDraftEditor'),apiRequest,
  onPublished:published=>{
    state.assignments.unshift({assignment_id:published.assignmentId,public_token:published.publicToken,
      class_id:published.classId,class_name:state.classes.find(row=>String(row.class_id)===String(published.classId))?.class_name||'',
      session_number:published.sessionNumber,title:published.title,status:'published'});
    refreshAssignmentSelect(published.assignmentId);
  }});

function setNotice(message, kind = '') {
  elements.teacherNotice.textContent = message;
  elements.teacherNotice.className = `notice${kind ? ` ${kind}` : ''}`;
}

async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  if (!config.API_BASE_URL) throw new Error('Chưa cấu hình địa chỉ API.');
  if (!state.authenticated) throw new Error('Bạn chưa đăng nhập Google.');
  const generation = state.authGeneration;
  const response = await fetch(`${config.API_BASE_URL}/api/learning${path}`, teacherSessionRequestOptions({
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store', signal
  }));
  const payload = await response.json().catch(() => null);
  if (generation !== state.authGeneration) throw new Error('Lượt đăng nhập đã thay đổi.');
  if (!response.ok || !payload?.ok) {
    const message = response.status === 401
      ? 'Phiên đăng nhập đã hết hạn; hãy đăng nhập lại.'
      : payload?.message || `Hệ thống trả về mã ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    if (response.status === 401 || (response.status === 403 && !path.startsWith('/teacher/form-drafts'))) {
      clearTeacherLogin();
      setNotice(message, 'error');
    }
    throw error;
  }
  return payload;
}

function fillSelect(select, items, valueKey, labelBuilder) {
  const options = items.map(item => {
    const option = document.createElement('option');
    option.value = item[valueKey];
    option.textContent = labelBuilder(item);
    return option;
  });
  select.replaceChildren(...options);
}

function switchPanel(panel) {
  const creating = panel === 'create';
  elements.createPanel.hidden = !creating;
  elements.dashboardPanel.hidden = panel !== 'dashboard';
  elements.overviewPanel.hidden = panel !== 'overview';
  elements.createTab.classList.toggle('active', creating);
  elements.dashboardTab.classList.toggle('active', panel === 'dashboard');
  elements.overviewTab.classList.toggle('active', panel === 'overview');
  (panel==='overview'?elements.overviewPlanHost:elements.dashboardPlanHost).append(elements.journeyPlanSection);
  if (panel === 'dashboard' && elements.assignmentSelect.value) void loadDashboard();
  if (panel === 'overview') { void loadCourseOverview();void loadJourneyPlan(); }
}

function paintCourseOverview() {
  if (!state.overview) return;
  renderCourseOverview(elements.courseOverview,state.overview,{filter:elements.overviewFilter.value,
    onOpen:(student,cell)=>void openJourneyDetail({classId:state.overview.classId,
      studentRef:student.studentRef,sessionNumber:cell.sessionNumber})});
}

async function loadCourseOverview() {
  const classId=elements.overviewClassSelect.value;
  state.overviewController?.abort();
  const generation=++state.overviewGeneration;
  state.overview=null;
  elements.courseOverview.replaceChildren();elements.courseAnalytics.replaceChildren();elements.courseAnalyticsStatus.textContent='';
  if (!classId) { elements.overviewStatus.textContent='Chưa có lớp được cấp quyền.';return; }
  const controller=new AbortController();state.overviewController=controller;
  const timer=setTimeout(()=>controller.abort(),15000);
  elements.overviewStatus.textContent='Đang tải hành trình lớp…';
  elements.courseOverview.setAttribute('aria-busy','true');
  try {
    const payload=await apiRequest('/teacher/classes/'+encodeURIComponent(classId)+'/overview',{signal:controller.signal});
    if (generation!==state.overviewGeneration || classId!==elements.overviewClassSelect.value) return;
    if (String(payload.overview.classId)!==classId) throw new Error('Dữ liệu trả về không khớp lớp đã chọn.');
    state.overview=payload.overview;
    const counts=state.overview.counts;
    elements.overviewStatus.textContent=state.overview.className+' · '+counts.currentStudents+' học viên hiện hành · '
      +state.overview.totalSessions+' buổi · '+counts.complete+' phiếu nộp đủ'
      +(state.overview.testCoverage==='temporarily_unavailable'?' · Chưa đọc được nguồn Test.':'')
      +(state.overview.planOutdated?' · Kế hoạch cần giảng viên xác nhận lại.':'');
    if(state.overview.rosterCoverage==='mapping_unverified') elements.overviewStatus.textContent+=' · Danh sách chưa được đối chiếu snapshot ERP mới nhất.';
    if(state.overview.scheduleStatus==='needs_review') elements.overviewStatus.textContent+=' · Có điểm danh cần đối soát; giữ nguyên đích đã ghi.';
    if(state.overview.scheduleStatus==='temporarily_unavailable') elements.overviewStatus.textContent+=' · Chưa đọc được lịch hiện hành; đang giữ dữ liệu đã lưu.';
    paintCourseOverview();
    await loadClassBasicAnalytics(classId,generation,controller.signal);
  } catch(error) {
    if (generation===state.overviewGeneration) elements.overviewStatus.textContent='Chưa tải được hành trình: '
      +(controller.signal.aborted?'Thời gian chờ đã hết. Hãy làm mới để thử lại.':error.message);
  } finally {
    clearTimeout(timer);
    if(generation===state.overviewGeneration) elements.courseOverview.setAttribute('aria-busy','false');
  }
}

// Chỉ đọc các phiếu của lớp, tối đa ba request cùng lúc; không xử lý hàng chờ AI.
async function loadClassBasicAnalytics(classId,generation,signal) {
  elements.courseAnalyticsStatus.textContent='Đang đọc kết quả từ các Progress Log đã có…';
  const forms=[],assignments=state.assignments.filter(a=>String(a.class_id)===String(classId)&&['published','closed'].includes(a.status));
  try {
    for(let offset=0;offset<assignments.length;offset+=3){
      const rows=await Promise.all(assignments.slice(offset,offset+3).map(async a=>{
        const data=await apiRequest('/teacher/assignments/'+encodeURIComponent(a.assignment_id)+'/question-analytics',{signal});
        if(data.analytics.assignmentId!==a.assignment_id)throw Error('Thống kê không khớp phiếu của lớp.');
        return {id:a.assignment_id,sessionNumber:Number(a.session_number),title:a.title,analytics:data.analytics};
      }));
      if(generation!==state.overviewGeneration||classId!==elements.overviewClassSelect.value)return;forms.push(...rows);
    }
    const course={classId,className:state.overview.className,overview:state.overview,assignments:forms};
    const onOpen=(studentRef,sessionNumber)=>void openJourneyDetail({classId,studentRef,sessionNumber});
    renderClassAnalytics(elements.courseAnalytics,course,{onOpen,onSummary:person=>{
      state.detailController?.abort();state.detailGeneration++;state.detailTarget=null;
      elements.retryJourneyDetailButton.hidden=true;elements.journeyDetailStatus.textContent='Kết quả từ '+forms.length+' phiếu đã có · chỉ đọc.';
      renderStudentClassSummary(elements.journeyDetailContent,course,person,{onOpen});
      if(!elements.journeyDetailDialog.open)elements.journeyDetailDialog.showModal();
    }});
    elements.courseAnalyticsStatus.textContent='Đã đọc '+forms.length+' Progress Log của '+course.className+'. Buổi chưa có phiếu là bình thường.';
  } catch(error) {
    if(generation===state.overviewGeneration&&classId===elements.overviewClassSelect.value)elements.courseAnalyticsStatus.textContent='Chưa đọc được thống kê lớp: '+(signal.aborted?'Quá thời gian chờ; hãy làm mới để thử lại.':error.message);
  }
}

async function openJourneyDetail(target) {
  state.detailController?.abort();
  const generation=++state.detailGeneration;
  state.detailTarget=target;
  const controller=new AbortController();state.detailController=controller;
  const timer=setTimeout(()=>controller.abort(),15000);
  elements.journeyDetailContent.replaceChildren();
  elements.retryJourneyDetailButton.hidden=true;
  elements.journeyDetailStatus.textContent='Đang tải buổi học…';
  if (!elements.journeyDetailDialog.open) elements.journeyDetailDialog.showModal();
  try {
    const path='/teacher/classes/'+encodeURIComponent(target.classId)+'/sessions/'+target.sessionNumber
      +'/students/'+encodeURIComponent(target.studentRef);
    const payload=await apiRequest(path,{signal:controller.signal});
    if(generation!==state.detailGeneration||!elements.journeyDetailDialog.open) return;
    const detail=payload.detail;
    if(String(detail.classId)!==String(target.classId)||detail.student.studentRef!==target.studentRef
      ||detail.sessionNumber!==target.sessionNumber) throw new Error('Dữ liệu buổi học không khớp học viên đã chọn.');
    renderSessionDetail(elements.journeyDetailContent,detail,{session:state.overview?.sessions.find(s=>s.sessionNumber===target.sessionNumber)||{}});
    elements.journeyDetailStatus.textContent='Bản dữ liệu hiện hành; chi tiết chỉ để xem lại.';
  } catch(error) {
    if(generation===state.detailGeneration&&elements.journeyDetailDialog.open) {
      elements.journeyDetailStatus.textContent='Chưa đọc được buổi học: '+(controller.signal.aborted?'Thời gian chờ đã hết.':error.message);
      elements.retryJourneyDetailButton.hidden=false;
    }
  } finally { clearTimeout(timer); }
}

async function loadQuestionAnalytics(assignmentId) {
  const generation=++state.analyticsGeneration;
  state.analyticsController?.abort();const controller=new AbortController();state.analyticsController=controller;
  const timer=setTimeout(()=>controller.abort(),15_000);
  elements.questionAnalytics.replaceChildren();
  elements.questionAnalyticsStatus.textContent='Đang đọc bài nộp và kết quả chấm…';
  try {
    const payload=await apiRequest('/teacher/assignments/'+encodeURIComponent(assignmentId)+'/question-analytics',{signal:controller.signal});
    if(generation!==state.analyticsGeneration||elements.assignmentSelect.value!==assignmentId) return;
    if(payload.analytics.assignmentId!==assignmentId) throw new Error('Thống kê không khớp phiếu.');
    const assignment=state.assignments.find(item=>item.assignment_id===assignmentId);
    renderQuestionAnalytics(elements.questionAnalytics,payload.analytics,{onStudent:student=>void openJourneyDetail({
      classId:String(assignment.class_id),sessionNumber:Number(assignment.session_number),studentRef:student.studentRef})});
    elements.questionAnalyticsStatus.textContent=payload.analytics.submittedCount+'/'+payload.analytics.rosterCount
      +' học viên có bài nộp hiện hành. Mỗi học viên chỉ được đếm một lần.';
  } catch(error) {
    if(generation===state.analyticsGeneration) elements.questionAnalyticsStatus.textContent='Chưa đọc được thống kê: '+(error.name==='AbortError'?'Quá thời gian chờ; hãy làm mới phiếu.':error.message);
  }finally{clearTimeout(timer);}
}

function buildLibraryRow(item, index) {
  const row = document.createElement('label');
  row.className = 'library-row';
  row.dataset.skills = (item.skillCodes || []).join(' ');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = item.id;
  checkbox.checked = index < 2;
  checkbox.dataset.libraryId = item.id;
  const copy = document.createElement('span');
  copy.className = 'library-copy';
  const title = document.createElement('b');
  title.textContent = item.title;
  const prompt = document.createElement('small');
  const skills = (item.skillCodes || []).join(', ');
  prompt.textContent = skills ? `${skills} · ${item.prompt}` : item.prompt;
  copy.append(title, prompt);
  const checkpoint = document.createElement('select');
  checkpoint.setAttribute('aria-label', `Thời điểm cho câu ${item.title}`);
  checkpoint.dataset.checkpointFor = item.id;
  checkpoint.append(...[1, 2, 3].map(number => {
    const option = document.createElement('option');
    option.value = String(number);
    option.textContent = `Lần ${number}`;
    option.selected = number === Math.min(index + 1, 2);
    return option;
  }));
  row.append(checkbox, copy, checkpoint);
  return row;
}

function renderLibrary() {
  const skill = elements.skillFilter.value;
  if (!elements.questionLibrary.childElementCount) {
    elements.questionLibrary.replaceChildren(...state.library.map(buildLibraryRow));
  }
  for (const row of elements.questionLibrary.children) {
    row.hidden = Boolean(skill && !row.dataset.skills.split(' ').includes(skill));
    if (row.hidden) row.querySelector('input[type="checkbox"]').checked = false;
  }
}

function releaseLabel(status) {
  return { locked: 'Chưa mở', open: 'Đang mở', closed: 'Đã đóng' }[status] || status;
}

function buildBlockControl(release) {
  const row = document.createElement('div');
  row.className = 'block-control';
  const copy = document.createElement('div');
  const title = document.createElement('b');
  title.textContent = `Phần ${release.checkpoint}`;
  const status = document.createElement('small');
  status.textContent = releaseLabel(release.status);
  copy.append(title, status);
  const select = document.createElement('select');
  for (const [value, label] of [['locked', 'Chưa mở'], ['open', 'Mở cho học viên'], ['closed', 'Đóng phần']]) {
    const option = new Option(label, value, false, value === release.status);
    select.append(option);
  }
  select.setAttribute('aria-label', `Trạng thái phần ${release.checkpoint}`);
  select.addEventListener('change', () => void setBlockRelease(release, select));
  row.append(copy, select);
  return row;
}

async function setBlockRelease(release, select) {
  select.disabled = true;
  try {
    await apiRequest('/teacher/blocks/release', {
      method: 'POST',
      body: {
        assignmentId: state.dashboard.assignmentId,
        blockId: release.blockId,
        status: select.value,
        operationId: crypto.randomUUID()
      }
    });
    await loadDashboard();
  } catch (error) {
    select.value = release.status;
    setNotice(error.message, 'error');
  } finally {
    select.disabled = false;
  }
}

function renderClassInsights(insights) {
  if (!insights.length) {
    const empty = document.createElement('p');
    empty.className = 'muted compact';
    empty.textContent = 'Chưa có đủ dữ liệu để kết luận ở cấp lớp.';
    elements.classInsights.replaceChildren(empty);
    return;
  }
  elements.classInsights.replaceChildren(...insights.map(insight => {
    const card = document.createElement('article');
    const title = document.createElement('b');
    title.textContent = insight.title;
    const summary = document.createElement('p');
    summary.textContent = insight.summary;
    const count = document.createElement('small');
    count.textContent = `${insight.affectedCount} học viên liên quan`;
    card.append(title, summary, count);
    return card;
  }));
}

function studentLink(publicToken) {
  const url = new URL('./', window.location.href);
  url.search = '';
  url.hash = new URLSearchParams({ assignment: publicToken }).toString();
  return url.toString();
}

function selectedLibraryItems() {
  return [...elements.questionLibrary.querySelectorAll('input[type="checkbox"]:checked')].map(input => {
    const checkpoint = elements.questionLibrary.querySelector(`[data-checkpoint-for="${input.dataset.libraryId}"]`);
    return {
      libraryItemId: input.dataset.libraryId,
      checkpoint: Number(checkpoint.value),
      required: true
    };
  });
}

function assignmentLabel(item) {
  const originalTitle = String(item.title || '').trim();
  const prefix = originalTitle.match(/^Buổi\s+(\d+)(?=\s|[-–—:·]|$)/iu);
  const title = prefix && Number(prefix[1]) === Number(item.session_number)
    ? originalTitle.slice(prefix[0].length).replace(/^[\s:·–—-]+/u, '').trim()
    : originalTitle;
  const className = String(item.class_name || '').trim();
  const sessionLabel = `Buổi ${item.session_number}`;
  const shortTitle = title.split(/\s*·\s*/u).filter(part => {
    const label = part.trim().toLocaleLowerCase('vi');
    return label !== className.toLocaleLowerCase('vi') && label !== sessionLabel.toLocaleLowerCase('vi');
  }).join(' · ');
  return [className, sessionLabel, shortTitle].filter(Boolean).join(' · ');
}

function refreshAssignmentSelect(selectedId = '') {
  if (!state.assignments.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Chưa có phiếu nào';
    elements.assignmentSelect.replaceChildren(option);
    return;
  }
  fillSelect(elements.assignmentSelect, state.assignments, 'assignment_id', assignmentLabel);
  elements.assignmentSelect.value = selectedId || state.assignments[0].assignment_id;
}

async function loadWorkspace() {
  const generation = state.authGeneration;
  setNotice('Đang tải lớp và thư viện câu hỏi…');
  const [options, library] = await Promise.all([
    apiRequest('/teacher/options'),
    apiRequest('/teacher/question-library')
  ]);
  if (generation !== state.authGeneration) return;
  state.reviewer = options.reviewer;
  // Chỉ đưa lớp có mã ERP hợp lệ vào bộ chọn; lớp thử mã âm không thuộc API lớp thật.
  state.classes = (options.classes || []).filter(item => /^[1-9]\d{0,17}$/u.test(String(item.class_id)));
  state.assignments = options.assignments || [];
  state.library = library.items || [];
  formEditor.setWorkspace({classes:state.classes,assignments:state.assignments});
  elements.teacherName.textContent = state.reviewer.name || state.reviewer.email;
  fillSelect(elements.teacherClassSelect, state.classes, 'class_id', item => item.class_name);
  fillSelect(elements.overviewClassSelect, state.classes, 'class_id', item => item.class_name);
  refreshAssignmentSelect();
  renderLibrary();
  elements.teacherAccessView.hidden = true;
  elements.teacherWorkspace.hidden = false;
  switchPanel('dashboard');
  setNotice(state.classes.length ? 'Sẵn sàng.' : 'Tài khoản chưa được cấp lớp nào.', state.classes.length ? '' : 'error');
}

async function publishReflection(event) {
  event.preventDefault();
  const items = selectedLibraryItems();
  if (items.length < 2 || items.length > 3) {
    setNotice('Hãy chọn từ 2 đến 3 câu hỏi.', 'error');
    return;
  }
  elements.publishButton.disabled = true;
  setNotice('Đang chốt version và roster của lớp…');
  try {
    const payload = await apiRequest('/teacher/reflection-forms/publish', {
      method: 'POST',
      body: {
        title: elements.formTitle.value.trim(),
        courseCode: '',
        classId: elements.teacherClassSelect.value,
        sessionNumber: Number(elements.sessionNumber.value),
        opensAt: null,
        closesAt: null,
        items
      }
    });
    const published = payload.published;
    elements.studentLink.value = studentLink(published.publicToken);
    elements.rosterCount.textContent = `${published.rosterCount} học viên`;
    elements.publishResult.hidden = false;
    state.assignments.unshift({
      assignment_id: published.assignmentId,
      public_token: published.publicToken,
      class_id: elements.teacherClassSelect.value,
      class_name: elements.teacherClassSelect.selectedOptions[0]?.textContent || '',
      session_number: Number(elements.sessionNumber.value),
      title: elements.formTitle.value.trim(),
      status: 'published'
    });
    refreshAssignmentSelect(published.assignmentId);
    setNotice('Đã tạo phiếu. Sao chép đúng một link để gửi cho lớp.');
  } catch (error) {
    setNotice(error.message, 'error');
  } finally {
    elements.publishButton.disabled = false;
  }
}

function attendanceLabel(status) {
  return {
    self_confirmed: 'Tự động điểm danh',
    teacher_confirmed: 'GV xác nhận',
    pending_teacher: 'Chờ GV',
    not_eligible: 'Chưa đủ điều kiện'
  }[status] || 'Chưa nộp';
}

function formatSavedAt(value) {
  if (!value) return 'chưa có bản lưu';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function definitionItems() {
  return state.dashboard?.definition?.blocks?.flatMap(block => block.items || []) || [];
}

function answerText(item, value) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => `${index + 1}. ${String(entry || '').trim() || '—'}`).join('\n');
  }
  if (value && typeof value === 'object') return `${value.correct ?? '—'} / ${value.total ?? '—'}`;
  const option = item.options?.find(candidate => candidate.id === value);
  return option ? option.label : String(value || '').trim() || '—';
}

function itemApplies(item, responses) {
  if (item.layoutType !== 'conditional_other_text') return true;
  const dependencyId = item.interactionConfig?.visibleWhenItemVersionId;
  return Boolean(dependencyId && responses?.[dependencyId] === item.interactionConfig.visibleWhenValue);
}

function verdictLabel(verdict) {
  return {
    correct: 'Đúng', incorrect: 'Chưa đúng', partial: 'Đúng một phần', pending: 'Đang chấm',
    manual_review: 'Cần xem', ungraded: 'Không chấm điểm'
  }[verdict] || '';
}

function openDraft(student) {
  const live = state.liveByStudent.get(student.studentRef);
  if (!live) return;
  state.draftStudent = student;
  state.draftJourneyLink = '';
  state.feedbackOperationId = crypto.randomUUID();
  elements.draftJourneyLinkStatus.textContent = 'Link cá nhân chỉ gửi đúng học viên. Tạo mới sẽ thay link cũ.';
  elements.copyDraftJourneyLinkButton.textContent = 'Tạo và sao chép link';
  elements.draftSpeakingFeedback.value = student.teacherSessionFeedback?.noteText || '';
  elements.draftFeedbackStatus.textContent = student.teacherSessionFeedback
    ? `Đã gửi nhận xét · bản ${student.teacherSessionFeedback.revision}. Chỉnh sửa rồi gửi lại để cập nhật.`
    : 'Chưa gửi nhận xét.';
  const responses = live.submissionId ? live.finalResponses : live.draftResponses;
  const resultByItem = new Map((live.gradingResult?.items || []).map(item => [item.itemVersionId, item]));
  elements.draftStudentName.textContent = student.discriminator
    ? `${student.name} · ${student.discriminator}`
    : student.name;
  elements.draftStatus.textContent = live.submissionId
    ? `Đã nộp lúc ${formatSavedAt(live.submittedAt)} · đây là bản cuối.`
    : `Bản lưu số ${live.draftRevision || 0} · lưu lúc ${formatSavedAt(live.draftUpdatedAt)}. Nội dung có thể chậm hơn thao tác gõ vài giây.`;
  const cards = definitionItems().filter(item => itemApplies(item, responses)).map(item => {
    const card = document.createElement('article');
    const heading = document.createElement('b');
    heading.textContent = item.layoutType === 'conditional_other_text'
      ? item.prompt
      : `Câu ${item.displayNumber || item.position}. ${item.prompt}`;
    const answer = document.createElement('p');
    answer.textContent = answerText(item, responses?.[item.itemVersionId]);
    const result = resultByItem.get(item.itemVersionId);
    if (result && result.verdict !== 'ungraded') {
      const verdict = document.createElement('small');
      verdict.className = `draft-verdict ${result.verdict}`;
      verdict.textContent = verdictLabel(result.verdict);
      card.append(heading, answer, verdict);
    } else {
      card.append(heading, answer);
    }
    return card;
  });
  elements.draftAnswers.replaceChildren(...cards);
  elements.draftDialog.showModal();
}

function buildSummary(students) {
  const counts = [
    ['Đã nộp đủ', students.filter(item => item.completeness === 'complete').length],
    ['Nộp thiếu', students.filter(item => item.completeness === 'incomplete').length],
    ['Chưa nộp', students.filter(item => !item.submissionId).length]
  ];
  return counts.map(([label, value]) => {
    const card = document.createElement('div');
    card.className = 'summary-item';
    const number = document.createElement('b');
    number.textContent = String(value);
    const text = document.createElement('small');
    text.textContent = label;
    card.append(number, text);
    return card;
  });
}

function openAttendance(student) {
  state.attendanceStudent = student;
  state.attendanceOperationId = crypto.randomUUID();
  elements.attendanceStudentName.textContent = student.discriminator
    ? `${student.name} · ${student.discriminator}`
    : student.name;
  elements.attendanceStatus.value = student.attendanceStatus || 'teacher_confirmed';
  updateAttendanceSyncHint();
  elements.attendanceReason.value = student.attendanceReason || '';
  elements.attendanceDialog.showModal();
}

function updateAttendanceSyncHint() {
  elements.attendanceSyncHint.textContent = elements.attendanceStatus.value === 'teacher_confirmed'
    ? 'Có mặt: Progress Log sẽ gửi yêu cầu ghi Portal sau khi lưu. Nếu Portal đã có trạng thái khác, hệ thống dừng để kiểm tra, không tự ghi đè.'
    : 'Trạng thái này chỉ được lưu trong Progress Log; chưa thay đổi điểm danh trên Portal.';
}

function addReportSection(container, title, values) {
  if (!Array.isArray(values) || !values.length) return;
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('ul');
  for (const value of values) {
    const item = document.createElement('li');
    item.textContent = typeof value === 'string' ? value : value?.text || '';
    if (item.textContent) list.append(item);
  }
  if (list.childElementCount) section.append(heading, list);
  container.append(section);
}

function openReport(student) {
  const report = student.latestReport;
  if (!report) return;
  const output = report.systemOutput || {};
  state.reportStudent = student;
  state.studentJourneyLink = '';
  elements.studentJourneyLinkStatus.textContent = 'Mỗi lần tạo mới sẽ thay link cũ của học viên này.';
  elements.reportStudentName.textContent = student.discriminator
    ? `${student.name} · ${student.discriminator}`
    : student.name;
  elements.reportScope.textContent = `Buổi ${report.fromSessionNumber}–${report.toSessionNumber}`;
  elements.reportSystemContent.replaceChildren();
  addReportSection(elements.reportSystemContent, 'Điều đã tiến bộ', output.progress);
  addReportSection(elements.reportSystemContent, 'Điều còn lặp lại', output.recurringIssues);
  if (output.nextAction?.text) addReportSection(elements.reportSystemContent, 'Một việc tiếp theo', [output.nextAction]);
  if (!elements.reportSystemContent.childElementCount) {
    const fallback = document.createElement('p');
    fallback.textContent = report.systemMarkdown || 'Hệ thống chưa có đủ dữ liệu để kết luận.';
    elements.reportSystemContent.append(fallback);
  }
  elements.reportHumanNote.value = report.humanNote || '';
  const sent = report.delivery?.status === 'sent';
  elements.reportDeliveryStatus.textContent = sent
    ? `Đã xác nhận gửi lúc ${new Date(report.delivery.sentAt).toLocaleString('vi-VN')}.`
    : 'Chưa xác nhận đã gửi.';
  elements.markReportDeliveredButton.hidden = sent;
  elements.markReportDeliveredButton.disabled = !elements.reportHumanNote.value.trim();
  elements.reportDialog.showModal();
}

function newStudentJourneyToken() {
  return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
}

function studentJourneyUrl(accessToken) {
  const url = new URL('journey.html', window.location.href);
  url.hash = new URLSearchParams({ access: accessToken }).toString();
  return url.toString();
}

async function copyStudentJourneyLink() {
  const student = state.reportStudent;
  if (!student || !state.dashboard?.assignmentId) return;
  elements.copyStudentJourneyLinkButton.disabled = true;
  try {
    if (!state.studentJourneyLink) {
      const accessToken = newStudentJourneyToken();
      const payload = await apiRequest('/teacher/student-progress-links', {
        method: 'POST',
        body: {
          assignmentId: state.dashboard.assignmentId,
          studentRef: student.studentRef,
          accessToken,
          expiresInDays: 90,
          operationId: crypto.randomUUID()
        }
      });
      if (payload.link.studentRef !== student.studentRef) {
        throw new Error('Link trả về không khớp học viên; hệ thống đã dừng sao chép.');
      }
      state.studentJourneyLink = studentJourneyUrl(accessToken);
    }
    await navigator.clipboard.writeText(state.studentJourneyLink);
    elements.studentJourneyLinkStatus.textContent = 'Đã sao chép link cá nhân, có hiệu lực trong 90 ngày.';
    elements.copyStudentJourneyLinkButton.textContent = 'Sao chép lại';
  } catch (error) {
    elements.studentJourneyLinkStatus.textContent = state.studentJourneyLink
      ? `Không sao chép tự động được. Link: ${state.studentJourneyLink}`
      : error.message;
  } finally {
    elements.copyStudentJourneyLinkButton.disabled = false;
  }
}

async function sendDraftFeedback() {
  const student = state.draftStudent;
  const assignmentId = state.dashboard?.assignmentId;
  const noteText = elements.draftSpeakingFeedback.value.trim();
  if (!student || !assignmentId || !elements.draftDialog.open) return;
  if (noteText && noteText === student.teacherSessionFeedback?.noteText) {
    elements.draftFeedbackStatus.textContent = 'Nhận xét này đã được gửi.';
    return;
  }
  if (!noteText || noteText.length > 500) {
    elements.draftFeedbackStatus.textContent = 'Hãy viết nhận xét từ 1 đến 500 ký tự.';
    return;
  }
  elements.sendDraftFeedbackButton.disabled = true;
  elements.draftSpeakingFeedback.disabled = true;
  elements.draftFeedbackStatus.textContent = 'Đang gửi nhận xét…';
  try {
    const payload = await apiRequest('/teacher/session-feedback', {
      method: 'PUT',
      body: {
        assignmentId, studentRef: student.studentRef, noteText,
        expectedRevision: Number(student.teacherSessionFeedback?.revision || 0),
        operationId: state.feedbackOperationId
      }
    });
    if (payload.feedback?.studentRef !== student.studentRef || payload.feedback.noteText !== noteText) {
      throw new Error('Nhận xét lưu không khớp học viên; hãy tải lại trước khi gửi tiếp.');
    }
    student.teacherSessionFeedback = payload.feedback;
    if (state.draftStudent !== student || state.dashboard?.assignmentId !== assignmentId
      || !elements.draftDialog.open) return;
    state.feedbackOperationId = crypto.randomUUID();
    elements.draftFeedbackStatus.textContent = `Đã gửi đến tổng hợp của học viên · bản ${payload.feedback.revision}.`;
  } catch (error) {
    elements.draftFeedbackStatus.textContent = `Chưa xác nhận đã gửi: ${error.message}`;
  } finally {
    elements.sendDraftFeedbackButton.disabled = false;
    elements.draftSpeakingFeedback.disabled = false;
  }
}

async function copyDraftJourneyLink() {
  const student = state.draftStudent;
  if (!student || !state.dashboard?.assignmentId) return;
  elements.copyDraftJourneyLinkButton.disabled = true;
  try {
    const assignmentId = state.dashboard.assignmentId;
    if (!state.draftJourneyLink) {
      const accessToken = newStudentJourneyToken();
      const payload = await apiRequest('/teacher/student-progress-links', {
        method: 'POST',
        body: {
          assignmentId: state.dashboard.assignmentId, studentRef: student.studentRef,
          accessToken, expiresInDays: 90, operationId: crypto.randomUUID()
        }
      });
      if (payload.link.studentRef !== student.studentRef) {
        throw new Error('Link trả về không khớp học viên; hệ thống đã dừng sao chép.');
      }
      if (state.draftStudent !== student || state.dashboard?.assignmentId !== assignmentId
        || !elements.draftDialog.open) return;
      state.draftJourneyLink = studentJourneyUrl(accessToken);
    }
    if (state.draftStudent !== student || state.dashboard?.assignmentId !== assignmentId
      || !elements.draftDialog.open) return;
    await navigator.clipboard.writeText(state.draftJourneyLink);
    elements.draftJourneyLinkStatus.textContent = 'Đã sao chép link cá nhân, có hiệu lực trong 90 ngày.';
    elements.copyDraftJourneyLinkButton.textContent = 'Sao chép lại';
  } catch (error) {
    elements.draftJourneyLinkStatus.textContent = state.draftJourneyLink
      ? `Không sao chép tự động được. Link: ${state.draftJourneyLink}` : error.message;
  } finally {
    elements.copyDraftJourneyLinkButton.disabled = false;
  }
}

async function saveTeacherHumanNote() {
  const student = state.reportStudent;
  const report = student?.latestReport;
  const noteText = elements.reportHumanNote.value.trim();
  if (!student || !report || !noteText) {
    setNotice('Hãy viết một lời nhắn thật, ngắn gọn trước khi gửi tổng kết.', 'error');
    return;
  }
  elements.saveTeacherNoteButton.disabled = true;
  try {
    await apiRequest('/teacher/reports/human-note', {
      method: 'PUT',
      body: {
        reportId: report.reportId,
        assignmentId: state.dashboard.assignmentId,
        studentRef: student.studentRef,
        noteText
      }
    });
    report.humanNote = noteText;
    elements.markReportDeliveredButton.disabled = false;
    setNotice('Đã lưu lời nhắn thật của giảng viên.');
  } catch (error) {
    setNotice(error.message, 'error');
  } finally {
    elements.saveTeacherNoteButton.disabled = false;
  }
}

async function markReportDelivered() {
  const student = state.reportStudent;
  const report = student?.latestReport;
  if (!student || !report) return;
  elements.markReportDeliveredButton.disabled = true;
  try {
    await apiRequest('/teacher/reports/delivery', {
      method: 'POST',
      body: {
        reportId: report.reportId,
        assignmentId: state.dashboard.assignmentId,
        studentRef: student.studentRef,
        operationId: crypto.randomUUID()
      }
    });
    elements.reportDeliveryStatus.textContent = 'Đã xác nhận gửi.';
    elements.markReportDeliveredButton.hidden = true;
    await loadDashboard();
  } catch (error) {
    setNotice(error.message, 'error');
  } finally {
    elements.markReportDeliveredButton.disabled = false;
  }
}

function buildStudentRow(student) {
  const live = state.liveByStudent.get(student.studentRef);
  const row = document.createElement('div');
  row.className = 'student-row';
  const copy = document.createElement('div');
  copy.className = 'student-copy';
  const name = document.createElement('b');
  name.textContent = student.discriminator ? `${student.name} · ${student.discriminator}` : student.name;
  const detail = document.createElement('small');
  const submissionText = student.submissionId
    ? (student.completeness === 'complete' ? 'Đã nộp đủ' : 'Đã nộp nhưng còn thiếu')
    : 'Chưa nộp';
  detail.textContent = submissionText;
  if (!student.submissionId && student.checkpoints?.length) {
    detail.textContent = `Đã nộp ${student.checkpoints.length} phần · chưa nộp phiếu cuối`;
  } else if (!student.submissionId && live?.draftRevision > 0) {
    detail.textContent = `Đang nhập · bản lưu ${live.draftRevision} lúc ${formatSavedAt(live.draftUpdatedAt)}`;
  }
  copy.append(name, detail);
  const blocks = state.dashboard?.definition?.blocks || [];
  const listeningBlock = blocks.find(block => (block.items || []).some(item =>
    (item.skillCodes || []).includes('listening') && item.maxScore > 0));
  const listeningScore = (student.checkpointScores || []).find(score =>
    score.blockId === listeningBlock?.blockId);
  if (listeningScore) {
    const score = document.createElement('span');
    score.className = 'student-listening-score';
    score.textContent = `Listening ${listeningScore.correct}/${listeningScore.total} câu đúng`;
    copy.insertBefore(score, detail);
  }
  if (blocks.length) {
    const progress = document.createElement('div');
    progress.className = 'student-block-progress';
    for (const [index, block] of blocks.entries()) {
      const submitted = (student.submissionId && student.completeness === 'complete')
        || (student.checkpoints || []).some(item => item.blockId === block.blockId);
      const draftAnswers = live?.draftResponses || {};
      const typing = (block.items || []).some(item => {
        const answer = draftAnswers[item.itemVersionId];
        return Array.isArray(answer)
          ? answer.some(value => String(value ?? '').trim())
          : answer !== undefined && String(answer ?? '').trim();
      });
      const release = (state.dashboard.blockReleases || []).find(item => item.blockId === block.blockId);
      const stateLabel = submitted ? 'Đã nộp' : typing ? 'Đang nhập' : release?.status === 'locked' ? 'Chưa mở' : 'Chưa nộp';
      const chip = document.createElement('span');
      chip.className = `block-progress-pill ${submitted ? 'submitted' : typing ? 'typing' : ''}`;
      chip.textContent = `Phần ${index + 1}: ${stateLabel}`;
      progress.append(chip);
    }
    copy.append(progress);
  }
  if (['self_confirmed', 'teacher_confirmed'].includes(student.attendanceStatus)) {
    const portal = document.createElement('small');
    portal.className = `portal-sync-status${student.portalSync?.status === 'complete' ? ' complete' : ''}`;
    portal.textContent = {
      complete: student.portalSync?.readbackAt ? 'Portal: đã đối chiếu Có mặt' : 'Portal: trạng thái cũ cần đối chiếu',
      queued: 'Portal: đang chờ đồng bộ',
      processing: 'Portal: đang đồng bộ',
      retry_wait: 'Portal: đang thử lại',
      review_required: 'Portal: cần đối soát buổi điểm danh',
      failed: 'Portal: đồng bộ lỗi'
    }[student.portalSync?.status] || 'Portal: chưa có xác nhận đồng bộ';
    if (student.portalSync?.reviewRequired) portal.textContent = student.portalSync.reviewReason === 'write_outcome_unknown'
      ? 'Portal: chưa xác định kết quả lần ghi trước; cần đối soát, chưa ghi lại.'
      : 'Portal: cần đối soát buổi điểm danh; giữ nguyên đích đã ghi.';
    if (student.portalSync?.targetSessionId) portal.textContent += ` · Buổi ERP ${student.portalSync.targetSessionId}`;
    copy.append(portal);
  }
  const status = document.createElement('span');
  status.className = `status-pill${['self_confirmed', 'teacher_confirmed'].includes(student.attendanceStatus) ? ' good' : ''}`;
  status.textContent = attendanceLabel(student.attendanceStatus);
  const actions = document.createElement('div');
  actions.className = 'student-actions';
  if (live?.attemptId) {
    const draftButton = document.createElement('button');
    draftButton.className = 'button draft-button';
    draftButton.type = 'button';
    draftButton.textContent = live.submissionId ? 'Xem bài nộp' : 'Xem đang gõ';
    draftButton.addEventListener('click', () => openDraft(student));
    actions.append(draftButton);
  }
  if (student.latestReport) {
    const reportButton = document.createElement('button');
    reportButton.className = 'button report-button';
    reportButton.type = 'button';
    reportButton.textContent = 'Xem tổng kết';
    reportButton.addEventListener('click', () => openReport(student));
    actions.append(reportButton);
  }
  const attendanceButton = document.createElement('button');
  attendanceButton.className = 'button';
  attendanceButton.type = 'button';
  attendanceButton.textContent = 'Điều chỉnh';
  attendanceButton.addEventListener('click', () => openAttendance(student));
  actions.append(attendanceButton);
  row.append(copy, status, actions);
  return row;
}

function renderStudentList() {
  elements.studentList.replaceChildren(...(state.dashboard?.students || []).map(buildStudentRow));
}

async function loadLiveDrafts({ quiet = false } = {}) {
  const assignmentId = state.dashboard?.assignmentId;
  if (!assignmentId || state.liveLoadingFor === assignmentId) return;
  const generation = state.dashboardGeneration;
  state.liveLoadingFor = assignmentId;
  try {
    const payload = await apiRequest(`/teacher/live-drafts?assignment=${encodeURIComponent(assignmentId)}`);
    if (generation !== state.dashboardGeneration || payload.live.assignmentId !== assignmentId) return;
    state.liveByStudent = new Map((payload.live.students || []).map(student => [student.studentRef, student]));
    elements.liveUpdatedAt.textContent = `Tự cập nhật mỗi 8 giây · bản lưu lúc ${formatSavedAt(payload.live.generatedAt)}`;
    renderStudentList();
  } catch (error) {
    if (!quiet) setNotice(`Chưa tải được bản nháp: ${error.message}`, 'error');
  } finally {
    if (state.liveLoadingFor === assignmentId) state.liveLoadingFor = '';
  }
}

function currentJourneyPlanDates() {
  const dates = new Map(state.journeyPlanDateDraft || []);
  for (const select of elements.journeyPlanDates.querySelectorAll('select[data-erp-for-session]')) {
    const number = Number(select.dataset.erpForSession);
    if (select.dataset.date) dates.set(number, {
      sessionNumber: number, date: select.dataset.date,
      ...(select.value ? { erpSessionId: select.value } : {})
    });
    else dates.delete(number);
  }
  state.journeyPlanDateDraft = dates;
  return [...dates].sort(([left], [right]) => left - right)
    .map(([, item]) => item);
}

function journeyErpLabel(item) {
  const [year, month, day] = item.date.split('-');
  const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  if (item.statusCode === 2) return 'Buổi đã hủy · ' + day + '/' + month + '/' + year;
  return 'Buổi ERP ' + (item.numberSource === 'proposal' ? 'dự kiến ' : '')
    + item.erpSessionNumber + ' · ' + (weekday ? 'T' + (weekday + 1) : 'CN')
    + ' ' + day + '/' + month + '/' + year;
}

// Chỉ tạo đề xuất trên màn hình. Lịch lệch số dòng/mốc hoặc trạng thái chưa rõ cần người dạy ghép.
function proposeJourneyPlanDates(total, draft, schedule) {
  const dates = new Map(draft.map(item => [item.sessionNumber, { ...item }]));
  const sessions = (schedule.sessions || []).filter(item => item.proposalEligible);
  const used = new Set(draft.map(item => item.erpSessionId).filter(Boolean));
  const ambiguous = schedule.ambiguous || sessions.length !== Number(total)
    || new Set(sessions.map(item => item.erpSessionId)).size !== sessions.length
    || draft.some(item => item.erpSessionId
      && sessions.find(s => s.erpSessionId === item.erpSessionId)?.erpSessionNumber !== item.sessionNumber);
  if (ambiguous) return {dates:[...dates.values()],added:0,message:'Lịch hoặc mốc đã chốt cần đối chiếu; hãy chọn từng buổi ERP.'};
  let added = 0;
  sessions.forEach(item => {
    const number = item.erpSessionNumber;
    if (dates.has(number) || used.has(item.erpSessionId) || !item.proposalEligible) return;
    dates.set(number,{sessionNumber:number,date:item.date,erpSessionId:item.erpSessionId});
    used.add(item.erpSessionId); added += 1;
  });
  return {dates:[...dates.values()].sort((a,b)=>a.sessionNumber-b.sessionNumber),added,
    message:added ? 'Đã đề xuất ' + added + ' buổi; chưa lưu, giảng viên cần xác nhận.' : 'Giữ nguyên các buổi đã chọn.'};
}

function renderJourneyPlanDateInputs(totalSessions, sessionDates) {
  const total = Math.min(100, Math.max(1, Number(totalSessions) || 1));
  const dates = new Map(sessionDates.map(item => [item.sessionNumber, item]));
  const tests = new Set(elements.journeyPlanTests.value.split(/[\s,;]+/).map(Number));
  const available = state.journeyErpScheduleAssignmentId === currentJourneyContext()
    ? state.journeyErpSchedule : null;
  const rows = Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const label = document.createElement('label');
    const title = document.createElement('span');
    title.textContent = sessionHeading({sessionNumber:number,sessionKind:tests.has(number)?'test':'lesson'},(state.assignments||[]).find(a=>String(a.class_id)===String(state.journeyPlan?.classId||state.dashboard?.classId||elements.overviewClassSelect?.value)&&Number(a.session_number)===number));
    const saved = dates.get(number);
    const select = document.createElement('select');
    select.dataset.erpForSession = String(number);
    select.dataset.date = saved?.date || '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Chưa chọn buổi ERP';
    select.append(empty);
    if (saved?.erpSessionId && !available?.sessions.some(item => item.erpSessionId === saved.erpSessionId)) {
      const missing = document.createElement('option');
      missing.value = saved.erpSessionId;
      missing.textContent = 'Buổi đã chốt · cần đối chiếu lại';
      select.append(missing);
    }
    for (const item of available?.sessions || []) {
      const option = document.createElement('option');
      option.value = item.erpSessionId;
      option.textContent = journeyErpLabel(item);
      select.append(option);
    }
    select.value = saved?.erpSessionId || '';
    label.append(title, select);
    const source = available?.sessions.find(item => item.erpSessionId === saved?.erpSessionId);
    const prior = state.journeyPlan?.sessionDates?.find(item => item.sessionNumber === number);
    if (prior?.erpSessionId && available?.assignmentSessionNumbers?.includes(number)) {
      select.disabled = true;
      const lock = document.createElement('small');
      lock.textContent = 'Đã có phiếu · giữ ánh xạ đã chốt';
      label.append(lock);
    }
    if (saved?.date && (!source || source.date !== saved.date)) {
      const note = document.createElement('small');
      note.textContent = 'Ngày đã giữ: ' + saved.date + ' · cần đối chiếu lại';
      label.append(note);
      if (source && !available.assignmentSessionNumbers?.includes(number)) {
        const accept = document.createElement('button');
        accept.type = 'button'; accept.className = 'button text-button';
        accept.textContent = 'Dùng ngày ERP mới (chưa lưu)';
        accept.addEventListener('click', () => {
          onJourneyPlanDateChange({target:select});
          renderJourneyPlanDateInputs(total, currentJourneyPlanDates());
        });
        label.append(accept);
      }
    } else if (saved && (!prior || prior.erpSessionId !== saved.erpSessionId || prior.date !== saved.date)) {
      const note = document.createElement('small'); note.textContent = 'Đề xuất/chỉnh sửa · chưa xác nhận'; label.append(note);
    }
    return label;
  });
  elements.journeyPlanDates.replaceChildren(...rows);
}

function currentJourneyTestSources() {
  const draft = new Map(state.journeyTestSourceDraft || []);
  for (const select of elements.journeyPlanTestSources.querySelectorAll('select[data-test-session]')) {
    const number = Number(select.dataset.testSession);
    if (select.value) draft.set(number, select.value);
    else draft.delete(number);
  }
  state.journeyTestSourceDraft = draft;
  return [...draft].sort(([left], [right]) => left - right)
    .map(([sessionNumber, testSlug]) => ({ sessionNumber, testSlug }));
}

function renderJourneyTestSourceInputs(testSources) {
  const numbers = [...new Set(elements.journeyPlanTests.value.split(/[\s,;]+/)
    .map(Number).filter(number => Number.isInteger(number) && number > 0))].sort((a, b) => a - b);
  const byNumber = new Map(testSources.map(item => [item.sessionNumber, item.testSlug]));
  const available = state.journeyTestSourcesAssignmentId === currentJourneyContext()
    ? state.journeyTestSources : null;
  const rows = numbers.map(number => {
    const label = document.createElement('label');
    const title = document.createElement('span');
    title.textContent = 'Buổi Test ' + number;
    const select = document.createElement('select');
    select.dataset.testSession = String(number);
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Chưa ghép bài Test';
    select.append(empty);
    const selected = byNumber.get(number) || '';
    if (selected && !available?.tests.some(item => item.testSlug === selected)) {
      const missing = document.createElement('option');
      missing.value = selected;
      missing.textContent = selected + ' · cần đối chiếu lại';
      select.append(missing);
    }
    for (const item of available?.tests || []) {
      const option = document.createElement('option');
      option.value = item.testSlug;
      const evidence = item.classEvidence === 'result'
        ? item.studentsWithResult + ' học viên có kết quả'
        : item.classEvidence === 'roster'
          ? 'đã có danh sách lớp, chưa có kết quả'
          : 'chưa có dấu hiệu của lớp này';
      option.textContent = item.title + ' · ' + evidence;
      select.append(option);
    }
    select.value = selected;
    label.append(title, select);
    return label;
  });
  elements.journeyPlanTestSources.replaceChildren(...rows);
}

function currentJourneyContext() {
  return elements.overviewPanel && !elements.overviewPanel.hidden
    ? (elements.overviewClassSelect.value?'class:'+elements.overviewClassSelect.value:'')
    : elements.assignmentSelect.value;
}

function journeyContextQuery(context) {
  return context.startsWith('class:')?'classId='+encodeURIComponent(context.slice(6))
    :'assignment='+encodeURIComponent(context);
}

function journeyContextBody(context) {
  return context.startsWith('class:')?{classId:context.slice(6)}:{assignmentId:context};
}

async function loadJourneyErpSchedule() {
  const assignmentId = currentJourneyContext();
  if (!assignmentId || !state.journeyPlan || state.journeyPlanAssignmentId !== assignmentId) return;
  const generation = ++state.journeyErpScheduleGeneration;
  state.journeyErpScheduleController?.abort();
  const controller = new AbortController();
  state.journeyErpScheduleController = controller;
  const timeout = setTimeout(() => controller.abort(), 20_000);
  elements.loadJourneyErpScheduleButton.disabled = true;
  elements.journeyErpScheduleStatus.textContent = 'Đang đọc lịch ERP…';
  try {
    const payload = await apiRequest('/teacher/erp-schedule?' + journeyContextQuery(assignmentId), {signal:controller.signal});
    if (generation !== state.journeyErpScheduleGeneration
      || currentJourneyContext() !== assignmentId) return;
    if(String(payload.schedule.classId)!==String(state.journeyPlan.classId))throw new Error('Lịch ERP không khớp lớp đang mở.');
    const draft = currentJourneyPlanDates();
    state.journeyErpSchedule = payload.schedule;
    state.journeyErpScheduleAssignmentId = assignmentId;
    if (!state.journeyPlan.totalSessions && !state.journeyPlanDirty && payload.schedule.sessions.length) {
      elements.journeyPlanTotal.value = Math.max(state.journeyPlan.highestKnownSession,
        payload.schedule.sessions.filter(item => item.proposalEligible).length);
    }
    const proposal = proposeJourneyPlanDates(elements.journeyPlanTotal.value, draft, payload.schedule);
    state.journeyPlanDateDraft = new Map(proposal.dates.map(item=>[item.sessionNumber,item]));
    if (proposal.added) state.journeyPlanDirty = true;
    renderJourneyPlanDateInputs(elements.journeyPlanTotal.value, proposal.dates);
    const byId = new Map(payload.schedule.sessions.map(item => [item.erpSessionId, item]));
    const changed = draft.filter(item => item.erpSessionId
      && byId.get(item.erpSessionId)?.date !== item.date).length;
    elements.journeyErpScheduleStatus.textContent = 'Đã đọc ' + payload.schedule.sessions.length
      + ' buổi ERP. ' + proposal.message
      + (changed ? ' Có ' + changed + ' buổi cần đối chiếu lại vì dòng ERP thiếu hoặc ngày đã đổi.' : '');
  } catch (error) {
    if (generation !== state.journeyErpScheduleGeneration
      || currentJourneyContext() !== assignmentId) return;
    state.journeyErpSchedule = null;
    elements.journeyErpScheduleStatus.textContent = (error.name === 'AbortError' ? 'Đọc lịch quá thời gian chờ.' : error.message)
      + ' Bản chỉnh vẫn được giữ; hãy đọc lại lịch trước khi xác nhận.';
  } finally {
    clearTimeout(timeout);
    if (generation === state.journeyErpScheduleGeneration) elements.loadJourneyErpScheduleButton.disabled = false;
  }
}

async function loadJourneyTestSources() {
  const assignmentId = currentJourneyContext();
  if (!assignmentId || !state.journeyPlan || state.journeyPlanAssignmentId !== assignmentId) return;
  const generation = ++state.journeyTestSourcesGeneration;
  elements.loadJourneyTestSourcesButton.disabled = true;
  elements.journeyTestSourcesStatus.textContent = 'Đang đọc nguồn Test…';
  try {
    const payload = await apiRequest('/teacher/test-sources?' + journeyContextQuery(assignmentId));
    if (generation !== state.journeyTestSourcesGeneration
      || currentJourneyContext() !== assignmentId) return;
    const draft = currentJourneyTestSources();
    state.journeyTestSources = payload.sources;
    state.journeyTestSourcesAssignmentId = assignmentId;
    renderJourneyTestSourceInputs(draft);
    elements.journeyTestSourcesStatus.textContent = 'Có ' + payload.sources.tests.length
      + ' bài Test có thể ghép. Bài chưa có kết quả cần giảng viên kiểm đúng nguồn của lớp trước khi chọn.';
  } catch (error) {
    if (generation !== state.journeyTestSourcesGeneration
      || currentJourneyContext() !== assignmentId) return;
    elements.journeyTestSourcesStatus.textContent = 'Chưa đọc được nguồn Test: ' + error.message;
  } finally {
    if (generation === state.journeyTestSourcesGeneration) elements.loadJourneyTestSourcesButton.disabled = false;
  }
}

function onJourneyPlanDateInput(event) {
  if (!event.target?.matches?.('select[data-erp-for-session]')) return;
}

function onJourneyPlanDateChange(event) {
  if (!event.target?.matches?.('select[data-erp-for-session]')) return;
  const selected = state.journeyErpSchedule?.sessions.find(item => item.erpSessionId === event.target.value);
  if (selected) {
    event.target.dataset.date = selected.date;
  } else if (!event.target.value) {
    event.target.dataset.date = '';
  }
  state.journeyPlanDirty = true;
  elements.journeyPlanStatus.textContent = 'Có thay đổi chưa lưu.';
}

function renderJourneyPlan(plan) {
  const assignmentId = currentJourneyContext();
  if (state.journeyPlanAssignmentId !== assignmentId) {
    state.journeyErpSchedule = null;
    state.journeyErpScheduleAssignmentId = '';
    state.journeyErpScheduleGeneration += 1;
    state.journeyTestSources = null;
    state.journeyTestSourcesAssignmentId = '';
    state.journeyTestSourcesGeneration += 1;
  }
  state.journeyPlan = plan;
  state.journeyPlanAssignmentId = assignmentId;
  state.journeyPlanDirty = false;
  state.journeyPlanConflict=null;elements.journeyPlanConflict.hidden=true;elements.journeyPlanConflict.replaceChildren();
  elements.journeyPlanTotal.value = plan.totalSessions || Math.max(plan.highestKnownSession, 1);
  elements.journeyPlanTests.value = plan.testSessionNumbers.join(', ');
  state.journeyPlanDateDraft = new Map((plan.sessionDates || []).map(item => [item.sessionNumber, item]));
  state.journeyTestSourceDraft = new Map((plan.testSources || []).map(item => [item.sessionNumber, item.testSlug]));
  renderJourneyPlanDateInputs(elements.journeyPlanTotal.value, plan.sessionDates || []);
  renderJourneyTestSourceInputs(plan.testSources || []);
  elements.journeyErpScheduleStatus.textContent = 'Chưa đối chiếu lại lịch ERP.';
  elements.journeyTestSourcesStatus.textContent = 'Chưa đọc nguồn Test.';
  elements.journeyPlanForm.hidden = false;
  elements.journeyPlanStatus.textContent = plan.revision
    ? 'Đã xác nhận ' + plan.totalSessions + ' buổi · sửa lần ' + plan.revision
    : 'Chưa xác nhận; Journey chỉ hiện các mốc đã có bằng chứng.';
}

async function loadJourneyPlan({ force = false } = {}) {
  const assignmentId = currentJourneyContext();
  if (!assignmentId || (state.journeyPlanDirty && !force
    && state.journeyPlanAssignmentId === assignmentId)) return;
  if(state.journeyPlan&&state.journeyPlanDirty)cacheJourneyPlanDraft();
  const generation = ++state.journeyPlanGeneration;
  const classId=assignmentId.startsWith('class:')?assignmentId.slice(6):String(state.assignments.find(row=>row.assignment_id===assignmentId)?.class_id||'');
  const cached=state.journeyPlanDrafts.get(classId);
  if(cached&&!force){
    renderJourneyPlan(cached.plan);elements.journeyPlanTotal.value=cached.total;elements.journeyPlanTests.value=cached.tests;
    state.journeyPlanDateDraft=new Map(cached.dates.map(row=>[row.sessionNumber,row]));
    state.journeyTestSourceDraft=new Map(cached.testSources.map(row=>[row.sessionNumber,row.testSlug]));
    state.journeyErpSchedule=cached.schedule;state.journeyErpScheduleAssignmentId=assignmentId;
    state.journeyTestSources=cached.sources;state.journeyTestSourcesAssignmentId=assignmentId;state.journeyPlanDirty=true;
    renderJourneyPlanDateInputs(cached.total,cached.dates);renderJourneyTestSourceInputs(cached.testSources);
    elements.journeyPlanStatus.textContent='Đã khôi phục phần chỉnh chưa lưu của lớp này trong phiên.';
    if(elements.journeyPlanDatesDetails.open)void loadJourneyErpSchedule();return;
  }
  if(force)state.journeyPlanDrafts.delete(classId);
  if (state.journeyPlanAssignmentId !== assignmentId) {
    elements.journeyPlanForm.hidden = true;
    elements.journeyPlanStatus.textContent = 'Đang tải kế hoạch lớp…';
  }
  try {
    const payload = await apiRequest('/teacher/journey-plan?' + journeyContextQuery(assignmentId));
    if (generation !== state.journeyPlanGeneration || currentJourneyContext() !== assignmentId) return;
    renderJourneyPlan(payload.plan);
    if (elements.journeyPlanDatesDetails.open) void loadJourneyErpSchedule();
  } catch (error) {
    if (generation !== state.journeyPlanGeneration || currentJourneyContext() !== assignmentId) return;
    elements.journeyPlanForm.hidden = true;
    elements.journeyPlanStatus.textContent = 'Chưa tải được kế hoạch: ' + error.message;
  }
}

// Giữ bản chỉnh theo ID lớp khi chuyển phiếu/tab/lớp; chỉ ở bộ nhớ phiên, xóa khi đăng xuất.
function cacheJourneyPlanDraft() {
  if(!state.journeyPlan||!state.journeyPlanDirty)return;
  state.journeyPlanDrafts.set(String(state.journeyPlan.classId),structuredClone({plan:state.journeyPlan,
    total:elements.journeyPlanTotal.value,tests:elements.journeyPlanTests.value,dates:currentJourneyPlanDates(),
    testSources:currentJourneyTestSources(),schedule:state.journeyErpSchedule,sources:state.journeyTestSources}));
}

function showJourneyPlanConflict(latest) {
  state.journeyPlanConflict=latest;const host=elements.journeyPlanConflict;host.replaceChildren();host.hidden=false;
  const heading=document.createElement('h3');heading.textContent='Đối chiếu kế hoạch mới nhất';host.append(heading);
  const info=document.createElement('p');info.textContent='Máy chủ: bản '+latest.revision+' · '+latest.totalSessions+' buổi · Test '+latest.testSessionNumbers.join(', ')+'. Phần đang chỉnh vẫn được giữ.';host.append(info);
  const local=new Map(currentJourneyPlanDates().map(row=>[row.sessionNumber,row]));
  const current=new Map((latest.sessionDates||[]).map(row=>[row.sessionNumber,row]));
  for(const number of new Set([...local.keys(),...current.keys()])){
    const left=local.get(number),right=current.get(number);
    if(left?.date===right?.date&&left?.erpSessionId===right?.erpSessionId)continue;
    const line=document.createElement('p');line.textContent='Buổi '+number+' · đang chỉnh: '+(left?.date||'chưa chọn')+' · máy chủ: '+(right?.date||'chưa chọn');host.append(line);
  }
  const use=document.createElement('button');use.type='button';use.className='button';use.textContent='Dùng kế hoạch máy chủ';
  use.addEventListener('click',()=>{
    if(!window.confirm('Bỏ phần chỉnh chưa lưu để dùng kế hoạch máy chủ vừa đối chiếu?'))return;
    state.journeyPlanDrafts.delete(String(latest.classId));renderJourneyPlan(latest);void loadJourneyErpSchedule();
  });
  const keep=document.createElement('button');keep.type='button';keep.className='button';keep.textContent='Giữ phần chỉnh để xác nhận lại';
  keep.addEventListener('click',()=>{
    if(!window.confirm('Giữ phần đang chỉnh và dùng phiên bản máy chủ vừa đối chiếu làm căn cứ lưu tiếp?'))return;
    state.journeyPlan=latest;state.journeyPlanConflict=null;host.hidden=true;state.journeyPlanDirty=true;
    cacheJourneyPlanDraft();elements.journeyPlanStatus.textContent='Đã đối chiếu bản '+latest.revision+'. Đọc lại lịch ERP trước khi xác nhận.';void loadJourneyErpSchedule();
  });host.append(use,keep);
}

async function saveJourneyPlan(event) {
  event.preventDefault();
  const plan = state.journeyPlan;
  if (!plan || state.journeyPlanAssignmentId !== currentJourneyContext()) return;
  const raw = elements.journeyPlanTests.value.trim();
  if (raw && !/^\d+(?:[\s,;]+\d+)*$/.test(raw)) {
    elements.journeyPlanTests.setCustomValidity('Nhập số buổi Test, cách nhau bằng dấu phẩy.');
    elements.journeyPlanTests.reportValidity();
    return;
  }
  const testSessionNumbers = raw ? [...new Set(raw.split(/[\s,;]+/).map(Number))]
    .sort((a, b) => a - b) : [];
  const totalSessions = Number(elements.journeyPlanTotal.value);
  if (!Number.isInteger(totalSessions) || totalSessions < plan.highestKnownSession
    || testSessionNumbers.some(number => number < 1 || number > totalSessions)) {
    elements.journeyPlanStatus.textContent = 'Tổng số buổi phải bao gồm mọi mốc đã có dữ liệu và mọi buổi Test.';
    return;
  }
  const sessionDates = currentJourneyPlanDates();
  const testSources = currentJourneyTestSources()
    .filter(item => testSessionNumbers.includes(item.sessionNumber));
  if (!state.journeyErpSchedule?.fingerprint || state.journeyErpScheduleAssignmentId !== currentJourneyContext()) {
    elements.journeyPlanStatus.textContent = 'Hãy đọc lịch ERP trước khi xác nhận; bản chỉnh vẫn được giữ.';
    return;
  }
  if (state.journeyErpScheduleAssignmentId === currentJourneyContext()) {
    const byId = new Map((state.journeyErpSchedule?.sessions || [])
      .map(item => [item.erpSessionId, item.date]));
    if (sessionDates.some(item => item.erpSessionId && byId.get(item.erpSessionId) !== item.date)) {
      elements.journeyPlanStatus.textContent = 'Có ngày đã ghép không khớp lịch ERP. Hãy đối chiếu lại buổi đã chọn.';
      return;
    }
  }
  if (sessionDates.some(item => item.sessionNumber > totalSessions)) {
    elements.journeyPlanStatus.textContent = 'Còn ngày đã nhập ở buổi ngoài tổng số buổi. Hãy tăng tổng số buổi hoặc xóa ngày đó trước khi lưu.';
    return;
  }
  const assignmentId = state.journeyPlanAssignmentId;
  elements.saveJourneyPlanButton.disabled = true;
  try {
    const payload = await apiRequest('/teacher/journey-plan', {
      method: 'PUT',
      body: { ...journeyContextBody(assignmentId), totalSessions,
        testSessionNumbers, testSources, sessionDates, expectedRevision: plan.revision,
        expectedScheduleFingerprint: state.journeyErpSchedule.fingerprint }
    });
    if (currentJourneyContext() !== assignmentId) return;
    state.journeyPlanDrafts.delete(String(plan.classId));
    renderJourneyPlan(payload.plan);
    setNotice('Đã xác nhận kế hoạch buổi học cho cả lớp.');
  } catch (error) {
    if (currentJourneyContext() !== assignmentId) return;
    elements.journeyPlanStatus.textContent = 'Chưa lưu: ' + error.message;
    if (error.status === 409) {
      cacheJourneyPlanDraft();setNotice('Kế hoạch lớp đã thay đổi. Bản chỉnh vẫn được giữ; đối chiếu bản mới trước khi xác nhận.', 'error');
      try{const latest=await apiRequest('/teacher/journey-plan?'+journeyContextQuery(assignmentId));
        if(currentJourneyContext()===assignmentId)showJourneyPlanConflict(latest.plan);
      }catch{elements.journeyPlanStatus.textContent='Chưa đọc được bản mới; phần chỉnh vẫn còn. Hãy thử đọc lại sau.';}
    }
  } finally {
    elements.saveJourneyPlanButton.disabled = false;
  }
}

async function loadDashboard({ quiet = false } = {}) {
  const assignmentId = elements.assignmentSelect.value;
  if (!assignmentId) {
    state.dashboardGeneration += 1;
    state.liveByStudent.clear();
    elements.dashboardTitle.textContent = 'Chưa có phiếu để theo dõi';
    elements.dashboardSummary.replaceChildren();
    elements.studentList.replaceChildren();
    return;
  }
  if (!quiet) setNotice('Đang tải tình hình lớp…');
  state.dashboardLoading += 1;
  try {
    state.dashboardGeneration += 1;
    const generation = state.dashboardGeneration;
    const payload = await apiRequest(`/teacher/dashboard?assignment=${encodeURIComponent(assignmentId)}`);
    if (generation !== state.dashboardGeneration) return;
    const previousAssignmentId = state.dashboard?.assignmentId;
    state.dashboard = payload.dashboard;
    const deadlineHost = document.getElementById('teacherSubmissionWindow');
    if (deadlineHost) {
      deadlineHost.textContent = submissionWindowMessage(observeSubmissionWindow(state.dashboard.submissionWindow, performance.now()), performance.now());
      deadlineHost.hidden = !deadlineHost.textContent;
    }
    if (previousAssignmentId !== assignmentId) {
      state.liveByStudent.clear();
      void loadJourneyPlan();
    }
    elements.dashboardTitle.textContent = state.dashboard.className+' · '+sessionHeading(state.dashboard,{title:state.dashboard.title||state.dashboard.definition?.title});
    elements.dashboardSummary.replaceChildren(...buildSummary(state.dashboard.students));
    elements.blockControls.replaceChildren(...state.dashboard.blockReleases.map(buildBlockControl));
    renderClassInsights(state.dashboard.classInsights || []);
    if (!quiet) void loadQuestionAnalytics(assignmentId);
    renderStudentList();
    if (!quiet) setNotice(`Đã cập nhật ${state.dashboard.students.length} học viên.`);
    await loadLiveDrafts({ quiet: true });
  } catch (error) {
    setNotice(`Chưa cập nhật được tình hình lớp: ${error.message}`, 'error');
  } finally {
    state.dashboardLoading -= 1;
  }
}

async function saveAttendance(event) {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') {
    elements.attendanceDialog.close();
    return;
  }
  if (!state.attendanceStudent || !elements.attendanceReason.reportValidity()) return;
  elements.saveAttendanceButton.disabled = true;
  try {
    const response = await apiRequest('/teacher/attendance/override', {
      method: 'POST',
      body: {
        assignmentId: state.dashboard.assignmentId,
        studentRef: state.attendanceStudent.studentRef,
        status: elements.attendanceStatus.value,
        reason: elements.attendanceReason.value.trim(),
        operationId: state.attendanceOperationId
      }
    });
    elements.attendanceDialog.close();
    state.attendanceOperationId = null;
    await loadDashboard();
    setNotice(response.attendance.portalSyncQueued
      ? 'Đã lưu xác nhận. Portal đang được đồng bộ; xem trạng thái trong danh sách học viên.'
      : 'Đã lưu trong Progress Log. Trạng thái này không tự thay đổi Portal.');
  } catch (error) {
    setNotice(error.message, 'error');
  } finally {
    elements.saveAttendanceButton.disabled = false;
  }
}

async function copyStudentLink() {
  try {
    await navigator.clipboard.writeText(elements.studentLink.value);
    elements.copyLinkButton.textContent = 'Đã sao chép';
    window.setTimeout(() => { elements.copyLinkButton.textContent = 'Sao chép'; }, 1_500);
  } catch {
    elements.studentLink.select();
    setNotice('Trình duyệt chưa cho sao chép tự động; link đã được chọn để bạn sao chép.', 'error');
  }
}

function currentStudentLink() {
  return state.dashboard?.publicToken ? studentLink(state.dashboard.publicToken) : '';
}

function openCurrentStudentForm() {
  const link = currentStudentLink();
  if (link) window.open(link, '_blank', 'noopener,noreferrer');
}

async function previewAsStudent() {
  const assignmentId = state.dashboard?.assignmentId;
  if (!assignmentId) return;
  const tab = window.open('about:blank', '_blank');
  elements.previewStudentButton.disabled = true;
  try {
    const payload = await apiRequest('/teacher/demo-grants', {
      method: 'POST', body: { assignmentId }
    });
    const url = new URL('./demo/', window.location.href);
    url.hash = new URLSearchParams({ grant: payload.grant }).toString();
    if (tab) { tab.opener = null; tab.location.replace(url.toString()); }
    else window.location.assign(url.toString());
  } catch (error) {
    if (tab) tab.close();
    setNotice(error.message, 'error');
  } finally {
    elements.previewStudentButton.disabled = false;
  }
}

async function copyCurrentStudentLink() {
  const link = currentStudentLink();
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    elements.copyCurrentLinkButton.textContent = 'Đã sao chép';
    window.setTimeout(() => { elements.copyCurrentLinkButton.textContent = 'Sao chép link'; }, 1_500);
  } catch {
    setNotice(`Không sao chép tự động được. Link học viên: ${link}`, 'error');
  }
}

function initializeGoogle(attempt = 0) {
  if (!config.GOOGLE_CLIENT_ID) {
    setNotice('Chưa cấu hình Google Client ID.', 'error');
    return;
  }
  if (!window.google?.accounts?.id) {
    if (attempt < 30) window.setTimeout(() => initializeGoogle(attempt + 1), 200);
    else setNotice('Không tải được nút đăng nhập Google.', 'error');
    return;
  }
  window.google.accounts.id.initialize({
    client_id: config.GOOGLE_CLIENT_ID,
    auto_select: loginPreference.read(),
    callback: async response => {
      if (!response.credential) return;
      state.authGeneration += 1;
      clearTeacherLogin();
      try {
        await sessionClient.login(response.credential);
        state.authenticated = true;
        await loadWorkspace();
      } catch (error) {
        if (state.authGeneration) setNotice(error.message, 'error');
      }
    }
  });
  window.google.accounts.id.renderButton(elements.googleSignInButton, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi'
  });
  if (loginPreference.read() && !state.authenticated) {
    window.google.accounts.id.prompt();
  }
}

function clearTeacherLogin() {
  formEditor.clear();
  state.journeyPlanDrafts.clear();state.journeyPlanConflict=null;elements.journeyPlanConflict.hidden=true;
  state.analyticsController?.abort();state.journeyErpScheduleController?.abort();
  state.overviewGeneration+=1;state.analyticsGeneration+=1;state.detailGeneration+=1;
  state.overviewController?.abort();state.detailController?.abort();
  state.overview=null;state.detailTarget=null;
  elements.courseOverview.replaceChildren();elements.questionAnalytics.replaceChildren();elements.courseAnalytics.replaceChildren();elements.courseAnalyticsStatus.textContent="";elements.journeyDetailContent.replaceChildren();
  if(elements.journeyDetailDialog.open) elements.journeyDetailDialog.close();
  state.authGeneration += 1;
  state.authenticated = false;
  state.reviewer = null;
  state.classes = [];
  state.assignments = [];
  state.library = [];
  state.dashboard = null;
  state.liveByStudent.clear();
  state.journeyPlan = null;
  state.journeyPlanAssignmentId = '';
  state.journeyPlanGeneration += 1;
  state.journeyPlanDirty = false;
  state.journeyPlanDateDraft = new Map();
  state.journeyTestSourceDraft = new Map();
  state.journeyErpSchedule = null;
  state.journeyErpScheduleAssignmentId = '';
  state.journeyErpScheduleGeneration += 1;
  state.journeyTestSources = null;
  state.journeyTestSourcesAssignmentId = '';
  state.journeyTestSourcesGeneration += 1;
  elements.journeyPlanForm.hidden = true;
  elements.teacherName.textContent = 'Chưa đăng nhập';
  elements.teacherAccessView.hidden = false;
  elements.teacherWorkspace.hidden = true;
  for (const id of ['studentList', 'questionLibrary', 'classInsights', 'dashboardSummary', 'draftAnswers']) elements[id].replaceChildren();
  for (const id of ['attendanceDialog', 'reportDialog', 'draftDialog']) if (elements[id].open) elements[id].close();
}

elements.createTab.addEventListener('click', () => switchPanel('create'));
elements.dashboardTab.addEventListener('click', () => switchPanel('dashboard'));
elements.overviewTab.addEventListener('click',()=>switchPanel('overview'));
elements.overviewClassSelect.addEventListener('change',()=>{void loadCourseOverview();void loadJourneyPlan();});
elements.overviewFilter.addEventListener('change',paintCourseOverview);
elements.refreshOverviewButton.addEventListener('click',()=>void loadCourseOverview());
elements.openClassOverviewButton.addEventListener('click',()=>{
  const assignment=state.assignments.find(item=>item.assignment_id===elements.assignmentSelect.value);
  if(assignment) elements.overviewClassSelect.value=String(assignment.class_id);
  switchPanel('overview');
});
elements.retryJourneyDetailButton.addEventListener('click',()=>{
  if(state.detailTarget) void openJourneyDetail(state.detailTarget);
});
elements.journeyDetailDialog.addEventListener('close',()=>{
  state.detailGeneration+=1;state.detailController?.abort();state.detailTarget=null;
  elements.journeyDetailContent.replaceChildren();
});
elements.publishForm.addEventListener('submit', event => void publishReflection(event));
elements.copyLinkButton.addEventListener('click', () => void copyStudentLink());
elements.assignmentSelect.addEventListener('change', () => void loadDashboard());
elements.journeyPlanForm.addEventListener('submit', event => void saveJourneyPlan(event));
elements.loadJourneyErpScheduleButton.addEventListener('click', () => void loadJourneyErpSchedule());
elements.loadJourneyTestSourcesButton.addEventListener('click', () => void loadJourneyTestSources());
elements.reloadJourneyPlanButton.addEventListener('click', () => {
  if (state.journeyPlanDirty && !window.confirm('Bỏ thay đổi chưa lưu và tải kế hoạch mới nhất?')) return;
  state.journeyPlanDirty = false;
  void loadJourneyPlan({ force: true });
});
for (const id of ['journeyPlanTotal', 'journeyPlanTests']) {
  elements[id].addEventListener('input', () => {
    state.journeyPlanDirty = true;
    elements.journeyPlanStatus.textContent = 'Có thay đổi chưa lưu.';
    elements.journeyPlanTests.setCustomValidity('');
    renderJourneyPlanDateInputs(elements.journeyPlanTotal.value, currentJourneyPlanDates());
    renderJourneyTestSourceInputs(currentJourneyTestSources());
  });
}
elements.journeyPlanDates.addEventListener('input', event => {
  onJourneyPlanDateInput(event);
  state.journeyPlanDirty = true;
  elements.journeyPlanStatus.textContent = 'Có thay đổi chưa lưu.';
});
elements.journeyPlanDates.addEventListener('change', onJourneyPlanDateChange);
elements.journeyPlanDatesDetails.addEventListener('toggle', () => {
  if (elements.journeyPlanDatesDetails.open) void loadJourneyErpSchedule();
});
elements.journeyPlanTestSources.addEventListener('change', () => {
  state.journeyPlanDirty = true;
  elements.journeyPlanStatus.textContent = 'Có thay đổi chưa lưu.';
});
// Chỉ chuyển vùng hiển thị của thống kê; dữ liệu và bộ đọc bài giữ nguyên.
function switchInsightTab(scores, focus = false) {
  elements.scoresPanel.hidden = !scores;
  elements.insightPanel.hidden = scores;
  for (const [button, selected] of [[elements.scoresTab, scores], [elements.insightTab, !scores]]) {
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (focus && selected) button.focus();
  }
}
elements.scoresTab.addEventListener('click', () => switchInsightTab(true));
elements.insightTab.addEventListener('click', () => switchInsightTab(false));
for (const button of [elements.scoresTab, elements.insightTab]) {
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    switchInsightTab(event.key === 'Home' || (event.key !== 'End' && button === elements.insightTab), true);
  });
}
elements.refreshDashboardButton.addEventListener('click', () => {
  void loadDashboard();
  if (!state.journeyPlanDirty) void loadJourneyPlan({ force: true });
});
elements.openStudentFormButton.addEventListener('click', openCurrentStudentForm);
elements.previewStudentButton.addEventListener('click', () => void previewAsStudent());
elements.copyCurrentLinkButton.addEventListener('click', () => void copyCurrentStudentLink());
elements.attendanceForm.addEventListener('submit', event => void saveAttendance(event));
elements.attendanceStatus.addEventListener('change', updateAttendanceSyncHint);
elements.attendanceStatus.addEventListener('change', () => { state.attendanceOperationId = crypto.randomUUID(); });
elements.attendanceReason.addEventListener('input', () => { state.attendanceOperationId = crypto.randomUUID(); });
elements.skillFilter.addEventListener('change', renderLibrary);
elements.markReportDeliveredButton.addEventListener('click', () => void markReportDelivered());
elements.saveTeacherNoteButton.addEventListener('click', () => void saveTeacherHumanNote());
elements.copyStudentJourneyLinkButton.addEventListener('click', () => void copyStudentJourneyLink());
elements.sendDraftFeedbackButton.addEventListener('click', () => void sendDraftFeedback());
elements.copyDraftJourneyLinkButton.addEventListener('click', () => void copyDraftJourneyLink());
elements.draftSpeakingFeedback.addEventListener('input', () => { state.feedbackOperationId = crypto.randomUUID(); });
elements.rememberTeacherLogin.checked = loginPreference.read();
elements.rememberTeacherLogin.addEventListener('change', () => {
  if (loginPreference.set(elements.rememberTeacherLogin.checked)) return;
  elements.rememberTeacherLogin.checked = loginPreference.read();
  setNotice('Trình duyệt chưa lưu được lựa chọn tự đăng nhập.', 'error');
});
elements.teacherLogoutButton.addEventListener('click', async () => {
  if(!formEditor.confirmDiscard())return;
  try { await sessionClient.logout(); } catch { /* Vẫn xóa dữ liệu hiển thị trên máy dùng chung. */ }
  clearTeacherLogin();
  window.google?.accounts?.id?.disableAutoSelect();
  const forgotten = loginPreference.set(false);
  elements.rememberTeacherLogin.checked = !forgotten;
  setNotice(forgotten ? 'Đã đăng xuất.' : 'Đã đăng xuất, nhưng trình duyệt chưa xóa được lựa chọn tự đăng nhập.', forgotten ? '' : 'error');
});

async function initializeAuthentication() {
  try {
    const restored = await sessionClient.restore();
    if (restored) {
      state.authenticated = true;
      await loadWorkspace();
    }
  } catch (error) {
    clearTeacherLogin();
    setNotice(`Không thể khôi phục phiên: ${error.message}`, 'error');
  } finally {
    initializeGoogle();
  }
}

void initializeAuthentication();

window.setInterval(() => {
  if (!state.authenticated || !state.dashboard || document.hidden || elements.dashboardPanel.hidden || state.dashboardLoading
    || elements.attendanceDialog.open || elements.reportDialog.open || elements.draftDialog.open) return;
  void loadDashboard({ quiet: true });
}, 8_000);
