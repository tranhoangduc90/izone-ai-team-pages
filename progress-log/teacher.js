import {renderClassAnalytics,renderStudentClassSummary} from './class-analytics-view.js?rev=20261007-comments';
import {commentPanel,bindDialogDismiss} from './session-comments.js?rev=20261007-comments';
import {commentEditor,journeyLinkManager,openStudentJourney,clearCommentDrafts} from './teacher-session-comments.js?rev=20261028-thuy-v1';
import {contentTitle,sessionHeading} from './session-presentation.js';
import {createTeacherLiveUpdates,paintConnection} from './teacher-live-updates.js?rev=20261023-read-recovery-v2';
import {readLearningResponse} from './api-response.js?rev=20261023-read-recovery-v2';
import {renderTeacherClassPortal} from './teacher-class-portal.js?rev=20261023-live-v1';
import {observeSubmissionWindow, submissionWindowMessage} from './submission-window.js?rev=20261022-official-v2';
/*
 * Dữ liệu nhận vào: phiên đăng nhập ứng dụng, lớp được phân quyền và thư viện câu hỏi từ backend.
 * Xử lý: giảng viên chọn 2–3 câu, gán checkpoint, phát hành form bất biến và xem trạng thái nộp/điểm danh.
 * Kết quả: một link lớp để gửi cho học viên; mọi override điểm danh có lý do và operation ID riêng.
 * Khi lỗi: giao diện giữ dữ liệu đang chọn, không giả vờ đã lưu và hiện thông báo để thử lại.
 */
import { createTeacherLoginPreference } from '../shared/teacher-login-preference.js?rev=20260918-v1';
import { createTeacherAuthState } from '../shared/teacher-auth-state.js?v=20261026-startup1';
import { createTeacherSessionClient, teacherSessionRequestOptions } from '../shared/teacher-session-client.js?rev=20261026-startup1&startup=20261026-v2';
import { renderCourseOverview, renderQuestionAnalytics, renderSessionDetail } from './teacher-course-overview.js?rev=20261030-the20-v1';
import {createFormDraftEditor} from './teacher-form-editor.js?rev=20261030-personal-assign-v1';
import {resolveTeacherAssignment} from './teacher-entry-context.js?rev=20261019-v1';
import {renderThuyRoster,showThuyDetail,mountThuyTeacherLayout} from './thuy-live/teacher-view.js?rev=20261030-the17-19-v1';
import {keywordSelection} from './thuy-live/keyword-selection.js';
import {renderThuyAnalytics} from './thuy-live/question-analytics.js?rev=20261030-the17-19-v1';
import {legacyFeedbackForView} from './thuy-live/feedback-policy.js';
import {mountAssignmentManagement} from './thuy-live/assignment-management.js?rev=20261030-the20-v1';

const config = window.PROGRESS_LOG_CONFIG || {};
// Link chung luôn dùng preset đã duyệt; giữ tham số cũ chỉ cho đường tương thích được chỉ định rõ.
const THUY_UI=new URLSearchParams(location.search).get('presentation')!=='legacy';
const thuySkills=THUY_UI?await import('./thuy-live/course-skills.js?rev=20261030-the20-v1'):null;
if(THUY_UI)document.body.classList.add('thuy-live','thuy-teacher');
const sessionClient = createTeacherSessionClient({
  apiBaseUrl: config.API_BASE_URL,
  sessionPath: '/api/auth/session', sharedProduct: 'mapping'
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
const authView = createTeacherAuthState({panel:elements.teacherAccessView,notice:elements.teacherNotice,badge:elements.teacherName,retry:initializeAuthentication});

const classPortal=document.createElement('section');classPortal.id='teacherClassPortal';classPortal.hidden=true;elements.teacherWorkspace.prepend(classPortal);
const thuyLayout=THUY_UI?mountThuyTeacherLayout(elements,{onMode:showThuyMode,onHome:()=>{
  if(state.activePanel==='create'&&['dashboard','overview'].includes(state.classPanel))switchPanel(state.classPanel,{returning:true});else showClassPortal();
},onClass:classId=>{
  elements.overviewClassSelect.value=elements.teacherClassSelect.value=classId;
  refreshAssignmentSelect();for(const dialog of [elements.draftDialog,elements.journeyDetailDialog])if(dialog.open)dialog.close();
  if(!elements.overviewPanel.hidden)void loadCourseOverview();else void loadDashboard();
}}):null;
const connectionHost=document.getElementById('teacherConnectionStatus');
const liveUpdates=createTeacherLiveUpdates({
  read:async({assignmentId,after,force,signal})=>(await apiRequest('/teacher/assignments/'+encodeURIComponent(assignmentId)+'/live-updates?after='+after+'&force='+(force?'1':'0'),{signal})).update,
  apply:applyLiveUpdate,url:id=>config.API_BASE_URL+'/api/learning/teacher/assignments/'+encodeURIComponent(id)+'/events',
  active:()=>state.authenticated&&!document.hidden&&!elements.dashboardPanel.hidden,
  onState:value=>paintConnection(connectionHost,elements.refreshDashboardButton,value),
  onAccessDenied:error=>{if(error.status===401)clearTeacherLogin();else showClassPortal();setNotice(error.message||'Quyền xem phiếu đã thay đổi.','error');}
});
const managementHost=THUY_UI?document.createElement('div'):null;
if(managementHost){managementHost.className='thuy-assignment-actions';managementHost.hidden=true;}
const assignmentManagement=THUY_UI?mountAssignmentManagement({host:managementHost,getContext:()=>state.dashboard||{
  classId:thuyLayout.classes.value,className:state.classes.find(c=>String(c.class_id)===thuyLayout.classes.value)?.class_name||''},
  request:apiRequest,onChanged:async(context,action)=>{
    if(action==='withdraw'){history.replaceState(null,'',location.pathname+location.search);await loadWorkspace();if(thuyLayout){thuyLayout.classes.value=String(context.classId);elements.overviewClassSelect.value=String(context.classId);refreshAssignmentSelect();}await loadDashboard();
      setNotice('Đã thu hồi và giữ lịch sử. Vào Kho bài tập để giao phiếu thay thế cho buổi '+context.sessionNumber+'.');}
    else if(state.dashboard?.assignmentId===context.assignmentId)await loadDashboard();
  }}):null;
function showThuyMode(mode){
  state.thuyMode=mode;
  thuyLayout.setMode(mode);
  for(const button of document.querySelectorAll('[data-thuy-mode]'))button.setAttribute('aria-pressed',String(button.dataset.thuyMode===mode));
  renderStudentList();
}

function showClassPortal(){
  liveUpdates.stop();state.dashboardGeneration++;state.analyticsGeneration++;state.analyticsController?.abort();
  for(const dialog of [elements.draftDialog,elements.journeyDetailDialog])if(dialog.open)dialog.close();
  history.replaceState(null,'',location.pathname+location.search);
  renderTeacherClassPortal(classPortal,{classes:state.classes,assignments:state.assignments,onOpen:openClass});
  switchPanel('classes');
}
function openClass(classId){
  thuyLayout.classes.value=elements.teacherClassSelect.value=elements.overviewClassSelect.value=classId;
  refreshAssignmentSelect();switchPanel('dashboard');
}

const formEditor=createFormDraftEditor({host:document.getElementById('formDraftEditor'),apiRequest,libraryEnabled:THUY_UI,
  onManagementChanged:async()=>{await loadWorkspace();await loadDashboard();},
  onPublished:published=>{
    if(!state.assignments.some(row=>row.assignment_id===published.assignmentId))state.assignments.unshift({assignment_id:published.assignmentId,public_token:published.publicToken,
      class_id:published.classId,class_name:state.classes.find(row=>String(row.class_id)===String(published.classId))?.class_name||'',
      session_number:published.sessionNumber,title:published.title,status:'published'});
    refreshAssignmentSelect(published.assignmentId);
  }});

function setNotice(message, kind = '') {
  elements.teacherNotice.textContent = message;
  elements.teacherNotice.className = `notice${kind ? ` ${kind}` : ''}`;
  elements.teacherNotice.toggleAttribute('data-idle',message==='Sẵn sàng.');
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
  let payload;
  try{payload=await readLearningResponse(response,{signal});}
  catch(error){
    if (generation !== state.authGeneration) throw new Error('Lượt đăng nhập đã thay đổi.');
    if (error.status === 401 || (error.status === 403 && !path.startsWith('/teacher/form-drafts'))) {
      clearTeacherLogin();
      setNotice(error.message, 'error');
      if(error.status===401){authView.signedOut();initializeGoogle();}else authView.failed(error);
    }
    throw error;
  }
  if (generation !== state.authGeneration) throw new Error('Lượt đăng nhập đã thay đổi.');
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

function switchPanel(panel,{returning=false}={}) {
  const previous=state.activePanel;state.panelScroll??=new Map();if(previous)state.panelScroll.set(previous,window.scrollY);
  if(THUY_UI&&panel==='create'&&previous!=='create'){
    state.classPanel=previous;state.suspendedDialogs=[elements.draftDialog,elements.journeyDetailDialog].filter(dialog=>dialog.open);
    for(const dialog of state.suspendedDialogs)dialog.hidden=true;document.body.classList.remove('has-thuy-detail');
  }else if(THUY_UI&&previous==='create'&&panel!=='create'){
    for(const dialog of state.suspendedDialogs||[])if(dialog.open)dialog.hidden=false;
    if((state.suspendedDialogs||[]).some(dialog=>dialog.open&&!dialog.classList.contains('thuy-inline-detail')))document.body.classList.add('has-thuy-detail');state.suspendedDialogs=[];
  }
  state.activePanel=panel;
  classPortal.hidden=panel!=='classes';
  if(panel!=='dashboard')liveUpdates.stop();
  if(THUY_UI){thuyLayout.setPanel(panel);if(panel==='dashboard')showThuyMode(state.thuyMode||'progress');if(panel==='create')formEditor.setContext({classId:thuyLayout.classes.value,sessionNumber:state.dashboard?.sessionNumber});}
  const creating = panel === 'create';
  elements.createPanel.hidden = !creating;
  elements.dashboardPanel.hidden = panel !== 'dashboard';
  elements.overviewPanel.hidden = panel !== 'overview';
  elements.createTab.classList.toggle('active', creating);
  elements.dashboardTab.classList.toggle('active', panel === 'dashboard');
  elements.overviewTab.classList.toggle('active', panel === 'overview');
  (panel==='overview'?elements.overviewPlanHost:elements.dashboardPlanHost).append(elements.journeyPlanSection);
  if (panel === 'dashboard') void loadDashboard({quiet:returning});
  if (panel === 'overview') { void loadCourseOverview({preserve:returning});void loadJourneyPlan(); }
  if(previous==='create'||panel==='create')requestAnimationFrame(()=>{if(state.activePanel===panel)window.scrollTo(0,state.panelScroll.get(panel)||0);});
}

function paintCourseOverview() {
  if (!state.overview) return;
  if(THUY_UI){
    const historical=state.overview.students.filter(p=>p.current===false).length;
    thuyLayout.count.textContent=(state.overview.counts?.currentStudents??state.overview.students.length-historical)+' học viên'+(historical?' · '+historical+' hồ sơ lịch sử':'');
    if(!state.thuyCourse){elements.courseOverview.textContent='Đang đọc số tự báo và phản hồi Speaking từ các phiếu đã có…';return;}
    const onOpen=(studentRef,sessionNumber)=>void openJourneyDetail({classId:state.overview.classId,studentRef,sessionNumber});
    thuySkills.renderTeacherSkills(elements.courseOverview,state.thuyCourse,{onOpen,onSummary:person=>{
      state.detailController?.abort();state.detailGeneration++;state.detailTarget=null;
      elements.retryJourneyDetailButton.hidden=true;elements.journeyDetailStatus.textContent='Tổng quan từ các phiếu đã nộp và nguồn Test đã kết nối.';
      thuySkills.renderPersonSkills(elements.journeyDetailContent,state.thuyCourse,person,{onOpen});showThuyDetail(elements.journeyDetailDialog);
    }});return;
  }
  renderCourseOverview(elements.courseOverview,state.overview,{filter:elements.overviewFilter.value,
    onOpen:(student,cell)=>void openJourneyDetail({classId:state.overview.classId,
      studentRef:student.studentRef,sessionNumber:cell.sessionNumber}),
    onComment:state.overview.journeyCommentsEnabled?(student,cell)=>void openJourneyDetail({classId:state.overview.classId,
      studentRef:student.studentRef,sessionNumber:cell.sessionNumber,focusComment:true}):undefined,
    onJourney:state.overview.journeyCommentsEnabled?student=>viewJourney({classId:state.overview.classId,studentRef:student.studentRef},student.name):undefined});
}
function viewJourney(target,studentName){const generation=state.authGeneration;void openStudentJourney({request:apiRequest,target,studentName,current:()=>state.authenticated&&generation===state.authGeneration});}
function manageJourney(target,studentName) {
  const generation=state.authGeneration;
  journeyLinkManager({request:apiRequest,target,studentName,current:()=>state.authenticated&&generation===state.authGeneration});
}
function mountCommentEditor(root,dialog,target,studentName,comment,focus=false) {
  const generation=state.authGeneration;
  const editor=commentEditor({target,studentName,comment,reviewerKey:state.reviewer.email,request:apiRequest,compact:THUY_UI,
    current:()=>dialog.open&&state.authenticated&&generation===state.authGeneration,
    onSaved:note=>{
      const person=state.dashboard?.classId===target.classId&&state.dashboard?.sessionNumber===target.sessionNumber
        ?state.dashboard.students.find(s=>s.studentRef===target.studentRef):null;
      if(person)person.sessionComment=note;
      const cell=String(state.overview?.classId)===String(target.classId)?state.overview.students.find(s=>s.studentRef===target.studentRef)?.cells.find(c=>c.sessionNumber===target.sessionNumber):null;
      if(cell)cell.sessionComment=note;
      const coursePerson=state.thuyCourse?.sessions.find(s=>s.number===target.sessionNumber)?.students.find(s=>s.studentRef===target.studentRef);
      if(coursePerson){coursePerson.sessionComment=note;coursePerson.publishedFeedback=note.visibility==='visible'?note.noteText:'';}
      renderStudentList();paintCourseOverview();
    }});
  const links=document.createElement('button');links.type='button';links.className='mini-action';links.textContent='Quản lý link Hành trình riêng';
  links.addEventListener('click',()=>manageJourney({classId:target.classId,studentRef:target.studentRef},studentName));if(!THUY_UI)editor.element.append(links);
  if(THUY_UI){root.prepend(editor.element);editor.element.querySelector('h3').textContent='Nhận xét Speaking';}
  else root.append(editor.element);if(focus)editor.focus();return editor;
}

async function loadCourseOverview({preserve=false}={}) {
  const classId=elements.overviewClassSelect.value;
  state.overviewController?.abort();
  const generation=++state.overviewGeneration;
  const keeping=preserve&&String(state.overview?.classId)===String(classId);
  if(!keeping){state.overview=null;if(THUY_UI)state.thuyCourse=null;
    elements.courseOverview.replaceChildren();elements.courseAnalytics.replaceChildren();elements.courseAnalyticsStatus.textContent='';}
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
    if(state.overview.scheduleStatus==='needs_review') elements.overviewStatus.textContent+=' · Có lịch cần đối chiếu; các mốc đã chốt vẫn được giữ. Mở Kế hoạch buổi học để xem ngày trước/sau.';
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
    if(THUY_UI){
      for(let offset=0;offset<assignments.length;offset+=3){
        const rows=await Promise.all(assignments.slice(offset,offset+3).map(async assignment=>{
          const query='?assignment='+encodeURIComponent(assignment.assignment_id);
          const {dashboard}=await apiRequest('/teacher/dashboard'+query,{signal});
          const {live}=await apiRequest('/teacher/live-drafts'+query,{signal});
          if(dashboard.assignmentId!==assignment.assignment_id||live.assignmentId!==assignment.assignment_id||String(dashboard.classId)!==String(classId))throw Error('Dữ liệu kỹ năng chưa khớp phiếu và lớp.');
          return {sessionNumber:Number(assignment.session_number),definition:dashboard.definition,dashboard,live};
        }));
        if(generation!==state.overviewGeneration||classId!==elements.overviewClassSelect.value)return;forms.push(...rows);
      }
      if(new Set(forms.map(form=>form.sessionNumber)).size!==forms.length)throw Error('Có nhiều phiếu cùng buổi cần đối chiếu; chưa gộp số liệu.');
      state.thuyCourse=thuySkills.buildSkillCourse(state.overview,forms);paintCourseOverview();elements.courseAnalytics.hidden=true;
      elements.courseAnalyticsStatus.textContent='Đã đọc '+forms.length+' phiếu của lớp. Điểm Test chỉ hiện từ nguồn đã kết nối.';return;
    }
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
  if(THUY_UI)showThuyDetail(elements.journeyDetailDialog);
  else if (!elements.journeyDetailDialog.open) elements.journeyDetailDialog.showModal();
  try {
    const path='/teacher/classes/'+encodeURIComponent(target.classId)+'/sessions/'+target.sessionNumber
      +'/students/'+encodeURIComponent(target.studentRef);
    const payload=await apiRequest(path,{signal:controller.signal});
    if(generation!==state.detailGeneration||!elements.journeyDetailDialog.open) return;
    const detail=payload.detail;
    if(String(detail.classId)!==String(target.classId)||detail.student.studentRef!==target.studentRef
      ||detail.sessionNumber!==target.sessionNumber) throw new Error('Dữ liệu buổi học không khớp học viên đã chọn.');
    renderSessionDetail(elements.journeyDetailContent,THUY_UI?legacyFeedbackForView(detail,{teacher:true}):detail,{session:state.overview?.sessions.find(s=>s.sessionNumber===target.sessionNumber)||{}});
    if(state.overview?.journeyCommentsEnabled||state.dashboard?.journeyCommentsEnabled)mountCommentEditor(elements.journeyDetailContent,elements.journeyDetailDialog,
      {classId:String(target.classId),studentRef:target.studentRef,sessionNumber:target.sessionNumber},
      detail.student.name,detail.sessionComment,target.focusComment);
    elements.journeyDetailStatus.textContent='Bản dữ liệu hiện hành; chi tiết chỉ để xem lại.';
    if(THUY_UI&&target.focusItem)requestAnimationFrame(()=>{
      const question=elements.journeyDetailContent.querySelector('[data-review-item="'+CSS.escape(target.focusItem)+'"]');
      if(question){question.tabIndex=-1;question.focus({preventScroll:true});question.scrollIntoView({block:'start'});}
    });
  } catch(error) {
    if(generation===state.detailGeneration&&elements.journeyDetailDialog.open) {
      elements.journeyDetailStatus.textContent='Chưa đọc được buổi học: '+(controller.signal.aborted?'Thời gian chờ đã hết.':error.message);
      elements.retryJourneyDetailButton.hidden=false;
    }
  } finally { clearTimeout(timer); }
}

function paintQuestionAnalytics(analytics,assignmentId){
  const assignment=state.assignments.find(item=>item.assignment_id===assignmentId);
  (THUY_UI?renderThuyAnalytics:renderQuestionAnalytics)(elements.questionAnalytics,analytics,{definition:state.dashboard?.definition,onStudent:(student,focusItem)=>void openJourneyDetail({
    classId:String(assignment.class_id),sessionNumber:Number(assignment.session_number),studentRef:student.studentRef,focusItem})});
  elements.questionAnalyticsStatus.textContent=THUY_UI?'':analytics.submittedCount+'/'+analytics.rosterCount
    +' học viên có bài nộp hiện hành. Mỗi học viên chỉ được đếm một lần.';
}
async function loadQuestionAnalytics(assignmentId,{quiet=false}={}) {
  const generation=++state.analyticsGeneration;
  state.analyticsController?.abort();const controller=new AbortController();state.analyticsController=controller;
  const timer=setTimeout(()=>controller.abort(),15_000);
  if(!quiet){elements.questionAnalytics.replaceChildren();elements.questionAnalyticsStatus.textContent='Đang đọc bài nộp và kết quả chấm…';}
  try {
    const payload=await apiRequest('/teacher/assignments/'+encodeURIComponent(assignmentId)+'/question-analytics',{signal:controller.signal});
    if(generation!==state.analyticsGeneration||elements.assignmentSelect.value!==assignmentId) return;
    if(payload.analytics.assignmentId!==assignmentId) throw new Error('Thống kê không khớp phiếu.');
    paintQuestionAnalytics(payload.analytics,assignmentId);return true;
  } catch(error) {
    if(generation===state.analyticsGeneration) elements.questionAnalyticsStatus.textContent='Chưa đọc được thống kê: '+(error.name==='AbortError'?'Quá thời gian chờ; hãy làm mới phiếu.':error.message);
    return false;
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
  title.textContent = THUY_UI?state.dashboard.definition.blocks.find(b=>b.blockId===release.blockId)?.title||`Phần ${release.checkpoint}`:`Phần ${release.checkpoint}`;
  const status = document.createElement('small');
  status.textContent = releaseLabel(release.status);
  copy.append(title, status);
  if(THUY_UI){
    const count=state.dashboard.students.filter(s=>s.checkpoints?.some(c=>c.blockId===release.blockId)).length;
    status.textContent=(release.status==='open'?'Đã mở':'Đang đóng')+' · '+count+'/'+state.dashboard.students.length+' đã nộp';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='button'+(release.status==='open'?'':' primary');
    toggle.textContent=release.status==='open'?'Đóng':'Mở';toggle.value=release.status==='open'?'closed':'open';toggle.setAttribute('aria-label',toggle.textContent+' phần '+release.checkpoint);
    toggle.addEventListener('click',()=>void setBlockRelease(release,toggle));row.append(copy,toggle);return row;
  }
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
  const url = new URL(THUY_UI?'./thuy.html':'./', window.location.href);
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
  const assignments=THUY_UI?state.assignments.filter(a=>String(a.class_id)===thuyLayout.classes.value):state.assignments;
  if (!assignments.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Chưa có phiếu nào';
    elements.assignmentSelect.replaceChildren(option);
    return;
  }
  fillSelect(elements.assignmentSelect, assignments, 'assignment_id', THUY_UI?a=>'Buổi '+a.session_number:assignmentLabel);
  elements.assignmentSelect.value = selectedId || assignments[0].assignment_id;
}

async function loadWorkspace() {
  const generation = state.authGeneration;
  setNotice('Đang tải lớp của bạn…');
  const options=await apiRequest('/teacher/options');
  if (generation !== state.authGeneration) return;
  state.reviewer = options.reviewer;
  // Chỉ đưa lớp có mã ERP hợp lệ vào bộ chọn; lớp thử mã âm không thuộc API lớp thật.
  state.classes = (options.classes || []).filter(item => /^[1-9]\d{0,17}$/u.test(String(item.class_id)));
  state.assignments = options.assignments || [];
  const entryAssignment = resolveTeacherAssignment(state.assignments,state.classes,location.href);
  state.liveAvailable=THUY_UI&&options.capabilities?.liveUpdates===true;
  state.liveEnabled=false;
  state.library=[];
  if(THUY_UI){fillSelect(thuyLayout.classes,state.classes,'class_id',c=>c.class_name);if(entryAssignment)thuyLayout.classes.value=String(entryAssignment.class_id);}
  formEditor.setWorkspace({classes:state.classes,assignments:state.assignments,classId:entryAssignment?.class_id,sessionNumber:entryAssignment?.session_number});
  elements.teacherName.textContent = state.reviewer.name || state.reviewer.email;
  fillSelect(elements.teacherClassSelect, state.classes, 'class_id', item => item.class_name);
  fillSelect(elements.overviewClassSelect, state.classes, 'class_id', item => item.class_name);
  const showAll = document.getElementById('showAllJourneyClasses');
  const refreshClasses = () => {
    const current = elements.overviewClassSelect.value;
    const withForms=state.classes.filter(c=>state.assignments.some(a=>String(a.class_id)===String(c.class_id)));
    const visible = showAll.checked || !withForms.length ? state.classes : withForms;
    fillSelect(elements.overviewClassSelect, visible, 'class_id', item=>item.class_name);
    if (visible.some(c=>String(c.class_id)===current)) elements.overviewClassSelect.value=current;
  };
  showAll.onchange = () => {refreshClasses();void loadCourseOverview();};
  refreshClasses();
  refreshAssignmentSelect(entryAssignment?.assignment_id || '');
  if (entryAssignment) {
    elements.teacherClassSelect.value = entryAssignment.class_id;
    elements.overviewClassSelect.value = entryAssignment.class_id;
  }
  renderLibrary();
  elements.teacherAccessView.hidden = true;
  elements.teacherWorkspace.hidden = false;
  if(entryAssignment||!THUY_UI)switchPanel('dashboard');else showClassPortal();
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

function draftAnswerCards(live){
  const responses=live.submissionId?live.finalResponses:live.draftResponses;
  const resultByItem=new Map((live.gradingResult?.items||[]).map(item=>[item.itemVersionId,item]));
  return definitionItems().filter(item=>itemApplies(item,responses)).map(item=>{
    const card=document.createElement('article'),heading=document.createElement('b'),answer=document.createElement('p');
    heading.textContent=item.layoutType==='conditional_other_text'?item.prompt:`Câu ${item.displayNumber||item.position}. ${item.prompt}`;
    answer.textContent=answerText(item,responses?.[item.itemVersionId]);
    if(THUY_UI&&item.layoutType==='keyword_selection')answer.replaceChildren(keywordSelection(item,responses?.[item.itemVersionId],()=>{},{disabled:true}));
    card.append(heading,answer);const result=resultByItem.get(item.itemVersionId);
    if(result&&result.verdict!=='ungraded'){const verdict=document.createElement('small');verdict.className=`draft-verdict ${result.verdict}`;verdict.textContent=verdictLabel(result.verdict);card.append(verdict);}
    return card;
  });
}
function paintOpenDraft(){
  if(!elements.draftDialog.open||!state.draftStudent)return;
  const student=state.dashboard?.students.find(s=>s.studentRef===state.draftStudent.studentRef);
  if(!student){elements.draftDialog.close();return;}
  state.draftStudent=student;const live=state.liveByStudent.get(student.studentRef)||{};
  const answers=elements.draftAnswers.querySelector('[data-live-answers]');
  if(answers){const scroll=elements.draftDialog.scrollTop;answers.replaceChildren(...draftAnswerCards(live));elements.draftDialog.scrollTop=scroll;}
  elements.draftStatus.textContent=live.submissionId?`Đã nộp lúc ${formatSavedAt(live.submittedAt)} · đây là bản cuối.`:
    live.attemptId?`Bản lưu số ${live.draftRevision||0} · lưu lúc ${formatSavedAt(live.draftUpdatedAt)}.`:'Chưa bắt đầu · Chưa có bài làm';
}
function openDraft(student,focusComment=false) {
  const live = state.liveByStudent.get(student.studentRef)||{};
  if (!live?.attemptId&&!THUY_UI) {
    return void openJourneyDetail({classId:state.dashboard.classId,studentRef:student.studentRef,
      sessionNumber:state.dashboard.sessionNumber,focusComment});
  }
  state.draftStudent = student;
  state.draftJourneyLink = '';
  state.feedbackOperationId = crypto.randomUUID();
  elements.draftJourneyLinkStatus.textContent = 'Link không hết hạn, chỉ mất hiệu lực khi được thay hoặc thu hồi.';
  elements.copyDraftJourneyLinkButton.textContent = 'Lấy link Hành trình riêng';
  elements.draftSpeakingFeedback.value = student.teacherSessionFeedback?.noteText || '';
  elements.draftFeedbackStatus.textContent = student.teacherSessionFeedback
    ? `Đã gửi nhận xét · bản ${student.teacherSessionFeedback.revision}. Chỉnh sửa rồi gửi lại để cập nhật.`
    : 'Chưa gửi nhận xét.';
  elements.draftStudentName.textContent = student.discriminator
    ? `${student.name} · ${student.discriminator}`
    : student.name;
  elements.draftStatus.textContent = THUY_UI&&!live.attemptId?'Chưa bắt đầu · Chưa có bài làm':live.submissionId
    ? `Đã nộp lúc ${formatSavedAt(live.submittedAt)} · đây là bản cuối.`
    : `Bản lưu số ${live.draftRevision || 0} · lưu lúc ${formatSavedAt(live.draftUpdatedAt)}. Nội dung có thể chậm hơn thao tác gõ vài giây.`;
  const answers=document.createElement('div');answers.dataset.liveAnswers='1';answers.append(...draftAnswerCards(live));
  elements.draftAnswers.replaceChildren(answers);
  if(THUY_UI)showThuyDetail(elements.draftDialog);else elements.draftDialog.showModal();
  if(state.dashboard.journeyCommentsEnabled) mountCommentEditor(elements.draftAnswers,elements.draftDialog,
    {classId:state.dashboard.classId,studentRef:student.studentRef,sessionNumber:state.dashboard.sessionNumber},
    student.name,student.sessionComment,focusComment);
}

function buildSummary(students) {
  const counts = [
    ['Đã nộp phiếu', students.filter(item => item.submissionId).length],
    ['Còn câu trống', students.filter(item => item.completeness === 'incomplete').length],
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
  elements.studentJourneyLinkStatus.textContent = 'Link không hết hạn. Chỉ mất hiệu lực khi được thay hoặc thu hồi.';
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

function studentJourneyUrl(accessToken) {
  const url = new URL('journey.html', window.location.href);
  url.hash = new URLSearchParams({ access: accessToken }).toString();
  return url.toString();
}

async function copyStudentJourneyLink() {
  const student = state.reportStudent;
  if(student&&state.dashboard?.classId)manageJourney({classId:state.dashboard.classId,studentRef:student.studentRef},student.name);
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
  if(student&&state.dashboard?.classId)manageJourney({classId:state.dashboard.classId,studentRef:student.studentRef},student.name);
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
  const heading=document.createElement('div');heading.className='student-name-heading';heading.append(name);
  if(state.dashboard.journeyCommentsEnabled){const journey=document.createElement('button');journey.type='button';
    journey.className='mini-action';journey.textContent='Hành trình riêng ↗';
    journey.addEventListener('click',()=>viewJourney({classId:state.dashboard.classId,studentRef:student.studentRef},student.name));heading.append(journey);}
  const detail = document.createElement('small');
  const submissionText = student.submissionId
    ? (student.completeness === 'complete' ? 'Đã nộp phiếu · đủ câu trả lời' : 'Đã nộp phiếu · còn câu trống')
    : 'Chưa nộp';
  detail.textContent = submissionText;
  if (!student.submissionId && student.checkpoints?.length) {
    detail.textContent = `Đã nộp ${student.checkpoints.length} phần · chưa nộp phiếu cuối`;
  } else if (!student.submissionId && live?.draftRevision > 0) {
    detail.textContent = `Đang nhập · bản lưu ${live.draftRevision} lúc ${formatSavedAt(live.draftUpdatedAt)}`;
  }
  copy.append(heading, detail);
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
  if (student.portalSync || ['self_confirmed', 'teacher_confirmed'].includes(student.attendanceStatus)) {
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
    if (student.portalSync?.reviewReason === 'teacher_decision') {
      portal.textContent = 'Portal: đã dừng yêu cầu điểm danh theo điều chỉnh của giảng viên.';
    } else if (student.portalSync?.reviewReason === 'teacher_decision_during_processing') {
      portal.textContent = 'Portal: giảng viên đã đổi điểm danh khi đang đồng bộ; cần đối chiếu kết quả.';
    }
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
  if (state.dashboard.journeyCommentsEnabled) {
    const draftButton = document.createElement('button');
    draftButton.className = 'button draft-button';
    draftButton.type = 'button';
    draftButton.textContent = student.sessionComment?.visibility==='visible' ? 'Nhận xét' : 'Thêm nhận xét';
    draftButton.addEventListener('click', () => openDraft(student,true));
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
  const note=commentPanel(student.sessionComment,{compact:true});if(note)row.append(note);
  row.tabIndex=0;row.setAttribute('role','group');row.setAttribute('aria-label','Bài làm của '+student.name);
  row.addEventListener('click',event=>{if(event.target.closest('button,a,input,textarea,select,summary')||window.getSelection()?.toString())return;openDraft(student);});
  row.addEventListener('keydown',event=>{if(event.target===row&&['Enter',' '].includes(event.key)){event.preventDefault();openDraft(student);}});
  return row;
}

function renderStudentList() {
  if(THUY_UI&&state.dashboard){renderThuyRoster(elements.studentList,{dashboard:state.dashboard,liveByStudent:state.liveByStudent,
    mode:state.thuyMode||'progress',
    query:state.thuySearch||'',filter:state.thuyFilter||'all',onQuery:value=>{state.thuySearch=value;renderStudentList();},
    onFilter:value=>{state.thuyFilter=value;renderStudentList();},onOpen:openDraft,onAttendance:openAttendance});return;}
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
    for(const student of state.dashboard.students){const live=state.liveByStudent.get(student.studentRef);if(live&&Object.hasOwn(live,'sessionComment'))student.sessionComment=live.sessionComment;}
    elements.liveUpdatedAt.textContent = `Tự cập nhật mỗi 8 giây · bản lưu lúc ${formatSavedAt(payload.live.generatedAt)}`;
    renderStudentList();
    paintOpenDraft();return true;
  } catch (error) {
    if (!quiet) setNotice(`Chưa tải được bản nháp: ${error.message}`, 'error');
    return false;
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
      option.disabled = ![0,1].includes(item.statusCode);
      select.append(option);
    }
    select.value = saved?.erpSessionId || '';
    label.append(title, select);
    const source = available?.sessions.find(item => item.erpSessionId === saved?.erpSessionId);
    const prior = state.journeyPlan?.sessionDates?.find(item => item.sessionNumber === number);
    if (saved?.erpSessionId && available && (!source || source.statusCode===2)) {
      const note=document.createElement('small');
      note.textContent=source?'ERP đã hủy mốc này; giữ bản chốt và chọn buổi bù sau khi đối chiếu.':'ERP không còn dòng đã chốt; không tự ghép buổi kế tiếp.';
      label.append(note);
    }
    const protectedNumbers=available?.usedSessionNumbers || available?.assignmentSessionNumbers || [];
    if (prior?.erpSessionId && protectedNumbers.includes(number)) {
      select.disabled = true;
      const lock = document.createElement('small');
      lock.textContent = 'Đã có lượt làm/điểm danh · giữ mốc đã chốt';
      label.append(lock);
    }
    if (saved?.date && (!source || source.date !== saved.date)) {
      const note = document.createElement('small');
      note.textContent = 'Ngày đã chốt: ' + saved.date + (source?' → ERP: '+source.date:'') + ' · chưa áp dụng';
      label.append(note);
      if (source && [0,1].includes(source.statusCode) && !protectedNumbers.includes(number)) {
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
    const timeChange=available?.scheduleChanges?.find(s=>s.sessionNumber===number && s.reason==='time_changed');
    if (timeChange) {
      const note=document.createElement('small');note.textContent='Giờ ERP đã đổi: '+timeChange.after.startsAt.slice(11,16)+'–'+timeChange.after.endsAt.slice(11,16)+' · chưa xác nhận';label.append(note);
      if (!protectedNumbers.includes(number)) {
        const accept=document.createElement('button');accept.type='button';accept.className='button text-button';accept.textContent='Ghi nhận giờ mới (chưa lưu)';
        accept.addEventListener('click',()=>{state.journeyPlanDirty=true;elements.journeyPlanStatus.textContent='Có giờ học mới cần xác nhận.';});label.append(accept);
      }
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
    if (sessionDates.some(item => {
      const prior = plan.sessionDates?.find(s=>s.sessionNumber===item.sessionNumber);
      const changed = !prior || prior.erpSessionId!==item.erpSessionId || prior.date!==item.date;
      return changed && item.erpSessionId && byId.get(item.erpSessionId) !== item.date;
    })) {
      elements.journeyPlanStatus.textContent = 'Có ngày đã ghép không khớp lịch ERP. Hãy đối chiếu lại buổi đã chọn.';
      return;
    }
  }
  if (sessionDates.some(item => item.sessionNumber > totalSessions)) {
    elements.journeyPlanStatus.textContent = 'Còn ngày đã nhập ở buổi ngoài tổng số buổi. Hãy tăng tổng số buổi hoặc xóa ngày đó trước khi lưu.';
    return;
  }
  const assignmentId = state.journeyPlanAssignmentId;
  const body = { ...journeyContextBody(assignmentId), totalSessions,
    testSessionNumbers, testSources, sessionDates, expectedRevision: plan.revision,
    expectedScheduleFingerprint: state.journeyErpSchedule.fingerprint };
  const operationKey = JSON.stringify(body);
  if (state.journeyPlanOperation?.key !== operationKey)
    state.journeyPlanOperation = {key:operationKey,id:crypto.randomUUID()};
  body.operationId = state.journeyPlanOperation.id;
  elements.saveJourneyPlanButton.disabled = true;
  try {
    const payload = await apiRequest('/teacher/journey-plan', {
      method: 'PUT',
      body
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

function applyLiveUpdate(update){
  if(update.assignmentId!==elements.assignmentSelect.value)throw Error('Phiếu đang xem đã đổi.');
  for(const value of [update.dashboard,update.live,update.analytics])if(value&&value.assignmentId!==update.assignmentId)throw Error('Dữ liệu không cùng phiếu.');
  const people=update.dashboard?.students||state.dashboard?.students||[];
  if(update.live?.students.some(s=>!people.some(person=>person.studentRef===s.studentRef)))throw Error('Học viên không thuộc phiếu đang xem.');
  if(update.dashboard){
    const previous=state.dashboard;state.dashboard=update.dashboard;
    thuyLayout.count.textContent=state.dashboard.students.length+' học viên';
    thuyLayout.learner.href=new URL('./thuy.html#assignment='+state.dashboard.publicToken,location.href).href;
    elements.dashboardTitle.textContent=state.dashboard.title;
    const deadlineHost=document.getElementById('teacherSubmissionWindow');
    deadlineHost.textContent=submissionWindowMessage(observeSubmissionWindow(state.dashboard.submissionWindow,performance.now()),performance.now());deadlineHost.hidden=!deadlineHost.textContent;
    elements.dashboardSummary.replaceChildren(...buildSummary(state.dashboard.students));
    elements.blockControls.replaceChildren(...state.dashboard.blockReleases.map(buildBlockControl));renderClassInsights(state.dashboard.classInsights||[]);
    if(!previous||update.full||JSON.stringify(previous.submissionWindow)!==JSON.stringify(state.dashboard.submissionWindow))assignmentManagement?.refresh();
    if(previous?.assignmentId!==state.dashboard.assignmentId)void loadJourneyPlan();
  }
  if(update.live){
    if(!update.live.partial)state.liveByStudent.clear();
    for(const student of update.live.students)state.liveByStudent.set(student.studentRef,student);
    for(const student of state.dashboard.students){const live=state.liveByStudent.get(student.studentRef);if(live&&Object.hasOwn(live,'sessionComment'))student.sessionComment=live.sessionComment;}
  }
  if(update.analytics)paintQuestionAnalytics(update.analytics,update.assignmentId);
  if(update.dashboard||update.live){renderStudentList();paintOpenDraft();}
  elements.liveUpdatedAt.textContent='Dữ liệu máy chủ đã đọc lúc '+formatSavedAt(update.generatedAt)+'. Nháp chỉ xuất hiện sau khi máy chủ nhận.';
  setNotice('');
}
async function loadDashboard({ quiet = false } = {}) {
  const assignmentId = elements.assignmentSelect.value;
  const selected=state.assignments.find(a=>a.assignment_id===assignmentId);
  state.liveEnabled=state.liveAvailable&&selected?.live_updates_enabled!==false;
  if(selected)history.replaceState(null,'',location.pathname+location.search+'#assignment='+encodeURIComponent(selected.public_token));
  if(state.dashboard?.assignmentId!==assignmentId){
    liveUpdates.stop();state.dashboardGeneration++;state.analyticsGeneration++;state.analyticsController?.abort();
    if(elements.draftDialog.open)elements.draftDialog.close();
    state.dashboard=null;state.liveByStudent.clear();elements.studentList.replaceChildren();elements.questionAnalytics.replaceChildren();elements.questionAnalyticsStatus.textContent='';
  }
  if (!assignmentId) {
    state.dashboard=null;assignmentManagement?.refresh();
    state.dashboardGeneration += 1;
    state.liveByStudent.clear();
    elements.dashboardTitle.textContent = 'Chưa có phiếu để theo dõi';
    if(thuyLayout)thuyLayout.count.textContent='Chưa có phiếu';
    elements.dashboardSummary.replaceChildren();
    elements.studentList.replaceChildren();
    return;
  }
  if(state.liveEnabled){await liveUpdates.start(assignmentId);return;}
  if (!quiet) setNotice('Đang tải tình hình lớp…');
  state.dashboardLoading += 1;
  try {
    state.dashboardGeneration += 1;
    const generation = state.dashboardGeneration;
    const payload = await apiRequest(`/teacher/dashboard?assignment=${encodeURIComponent(assignmentId)}`);
    if (generation !== state.dashboardGeneration) return;
    const previousAssignmentId = state.dashboard?.assignmentId;
    state.dashboard = payload.dashboard;
    if(THUY_UI){thuyLayout.count.textContent=state.dashboard.students.length+' học viên';thuyLayout.learner.href=new URL('./thuy.html#assignment='+state.dashboard.publicToken,location.href).href;thuyLayout.setPanel(elements.createPanel.hidden?(elements.overviewPanel.hidden?'dashboard':'overview'):'create');}
    assignmentManagement?.refresh();
    const deadlineHost = document.getElementById('teacherSubmissionWindow');
    if (deadlineHost) {
      deadlineHost.textContent = submissionWindowMessage(observeSubmissionWindow(state.dashboard.submissionWindow, performance.now()), performance.now());
      deadlineHost.hidden = !deadlineHost.textContent;
    }
    if (previousAssignmentId !== assignmentId) {
      state.liveByStudent.clear();
      void loadJourneyPlan();
    }
    elements.dashboardTitle.textContent = THUY_UI?state.dashboard.title:state.dashboard.className+' · '+sessionHeading(state.dashboard,{title:state.dashboard.title||state.dashboard.definition?.title});
    elements.dashboardSummary.replaceChildren(...buildSummary(state.dashboard.students));
    elements.blockControls.replaceChildren(...state.dashboard.blockReleases.map(buildBlockControl));
    renderClassInsights(state.dashboard.classInsights || []);
    renderStudentList();
    if (!quiet) setNotice(THUY_UI?'':`Đã cập nhật ${state.dashboard.students.length} học viên.`);
    const results=await Promise.all([loadLiveDrafts({quiet:true}),loadQuestionAnalytics(assignmentId,{quiet})]);
    paintConnection(connectionHost,elements.refreshDashboardButton,{kind:results.every(Boolean)?'fallback':'partial',lastRead:results.every(Boolean)?Date.now():0});
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
    const url = new URL(THUY_UI?'./demo/thuy.html':'./demo/', window.location.href);
    if(THUY_UI)url.searchParams.set('presentation','thuy');
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

let googleScriptLoading=false;
function initializeGoogle(attempt = 0) {
  if (!authView.needsLogin) return;
  if (!config.GOOGLE_CLIENT_ID) {
    setNotice('Chưa cấu hình Google Client ID.', 'error');
    return;
  }
  if (!window.google?.accounts?.id) {
    if(!googleScriptLoading){googleScriptLoading=true;const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onerror=()=>{googleScriptLoading=false;script.remove();authView.failed(new Error('Không tải được đăng nhập Google. Hãy thử lại.'));};document.head.append(script);}
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
      authView.checking();
      try {
        await sessionClient.login(response.credential);
        state.authenticated = true;
        await loadWorkspace();
        authView.ready();
      } catch (error) {
        if (state.authGeneration) setNotice(error.message, 'error');
        authView.failed(error);
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
  state.activePanel=null;state.classPanel=null;state.panelScroll=new Map();state.suspendedDialogs=[];
  for(const dialog of [elements.draftDialog,elements.journeyDetailDialog]){if(dialog.open)dialog.close();dialog.hidden=false;}
  liveUpdates.stop();classPortal.replaceChildren();classPortal.hidden=true;
  if(state.reviewer?.email)clearCommentDrafts(state.reviewer.email);
  document.querySelectorAll('.journey-link-dialog').forEach(dialog=>dialog.close());
  formEditor.clear();
  assignmentManagement?.dispose();
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
  if(elements.journeyDetailDialog.open)return; // Sự kiện đóng cũ không hủy lần mở nhanh tiếp theo.
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
  if(!classPortal.hidden){void loadWorkspace().catch(error=>setNotice(error.message,'error'));return;}
  if(!elements.overviewPanel.hidden){void loadCourseOverview();return;}
  if(!elements.createPanel.hidden)return;
  if(state.liveEnabled)void liveUpdates.refresh({force:true});else void loadDashboard();
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
for(const dialog of document.querySelectorAll('dialog'))bindDialogDismiss(dialog);
if(THUY_UI){
  for(const [id,step] of [['thuyPreviousStudent',-1],['thuyNextStudent',1]])document.getElementById(id)?.addEventListener('click',()=>{
    const people=state.dashboard?.students||[],index=people.findIndex(s=>s.studentRef===state.draftStudent?.studentRef);
    if(index+step>=0&&index+step<people.length)openDraft(people[index+step]);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const dialog of [elements.draftDialog,elements.journeyDetailDialog])if(dialog.open&&!dialog.hidden)dialog.close();});
  let outside=null;
  document.addEventListener('pointerdown',event=>{if(event.target.closest('.thuy-header-actions')){outside=null;return;}const dialog=[elements.draftDialog,elements.journeyDetailDialog].find(d=>d.open&&!d.hidden&&!d.contains(event.target));outside=dialog?{dialog,generation:dialog.dataset.thuyGeneration}:null;});
  document.addEventListener('click',event=>{if(outside?.dialog.open&&!outside.dialog.hidden&&outside.generation===outside.dialog.dataset.thuyGeneration&&!outside.dialog.contains(event.target))outside.dialog.close();outside=null;});
}
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
  authView.signedOut();
  const forgotten = loginPreference.set(false);
  elements.rememberTeacherLogin.checked = !forgotten;
  setNotice(forgotten ? 'Đã đăng xuất.' : 'Đã đăng xuất, nhưng trình duyệt chưa xóa được lựa chọn tự đăng nhập.', forgotten ? '' : 'error');
  initializeGoogle();
});

async function initializeAuthentication() {
  authView.checking();
  try {
    const restored = await sessionClient.restore();
    if (restored) {
      state.authenticated = true;
      await loadWorkspace();
      authView.ready();
    } else {
      authView.signedOut();
      setNotice('Đăng nhập Google để mở lớp của bạn.');
    }
  } catch (error) {
    clearTeacherLogin();
    setNotice(`Không thể khôi phục phiên: ${error.message}`, 'error');
    authView.failed(error);
  } finally {
    initializeGoogle();
  }
}

void initializeAuthentication();

window.setInterval(() => {
  if (state.liveEnabled||!state.authenticated || !state.dashboard || document.hidden || elements.dashboardPanel.hidden || state.dashboardLoading) return;
  void loadDashboard({ quiet: true });
}, 8_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.authenticated&&!elements.dashboardPanel.hidden){if(state.liveEnabled)liveUpdates.resume();else void loadDashboard({quiet:true});}});
window.addEventListener('online',()=>{if(state.liveEnabled)liveUpdates.resume();});
window.addEventListener('storage',event=>{
  if(!['izone:teacher-sso-login','izone:teacher-sso-logout'].includes(event.key))return;
  clearTeacherLogin();
  if(event.key==='izone:teacher-sso-login')void initializeAuthentication();else {authView.signedOut();setNotice('Bạn đã đăng xuất ở tab khác.');initializeGoogle();}
});
window.addEventListener('pagehide',()=>liveUpdates.stop());
window.addEventListener('pageshow',event=>{if(event.persisted&&state.authenticated&&!elements.dashboardPanel.hidden)void loadDashboard();});
