import {contentTitle,sessionHeading,sessionState,skillsLabel} from '/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/progress-log/session-presentation.js';
import {renderSessionReview} from '/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/progress-log/session-review.js';
import {commentPanel,paintJourneyComments,createCommentPoller,bindDialogDismiss} from '/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/progress-log/session-comments.js';
import {createCourseStudentIdentity,requestMappingStudentIdentity} from '/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/shared/course-student-identity.js';
import {markProgressLogout,stampProgressStudent,progressPinWasLoggedOut} from '/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/progress-log/student-session-memory.js';
import {assignmentAllowsEntry,dashboardSessionState,latestAssignedSession,preserveSessionComments,renderLatestSession,studentEntryState,visibleStudentSessions} from '/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/progress-log/student-session-dashboard.js';
'use strict';

const config = window.PROGRESS_LOG_CONFIG || {};
const elements = Object.fromEntries([
  'journeyNotice', 'journeyView', 'journeyStudentName', 'journeyClassName',
  'attendedCount', 'submittedCount', 'reportCount', 'latestReport', 'latestReportScope',
  'progressPoints', 'recurringPoints', 'journeyNextAction', 'teacherMessage',
  'teacherMessageText', 'emptyReport', 'timelineToggle', 'timeline', 'timelineCount',
  'sessionList', 'reportHistory', 'reportList', 'journeyError', 'journeyErrorMessage',
  'latestSpeakingFeedback', 'latestSpeakingFeedbackScope', 'latestSpeakingFeedbackText'
].map(id => [id, document.getElementById(id)]));

let accessToken = '';
let startGeneration=0,studentSkillView=null;

function setNotice(message = '', kind = '') {
  elements.journeyNotice.textContent = message;
  elements.journeyNotice.className = `notice${kind ? ` ${kind}` : ''}`;
}

function readAccessToken() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access') || '';
  return token;
}

async function apiRequest(token) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try {
  const response = await fetch(`${config.API_BASE_URL}/api/learning/student/course-journey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: token,includeSkills:true }),
    cache: 'no-store',
    referrerPolicy: 'no-referrer',signal:controller.signal
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw Object.assign(new Error(payload?.message || 'Link không còn sử dụng được.'),{status:response.status});
  }
  return payload.journey;
  } finally {clearTimeout(timeout);}
}

function addPoints(container, points, emptyText) {
  const values = Array.isArray(points) ? points.filter(item => item?.text) : [];
  if (!values.length) {
    const empty = document.createElement('p');
    empty.className = 'muted compact';
    empty.textContent = emptyText;
    container.replaceChildren(empty);
    return;
  }
  const list = document.createElement('ul');
  for (const point of values) {
    const item = document.createElement('li');
    item.textContent = point.text;
    list.append(item);
  }
  container.replaceChildren(list);
}

function formatScope(report) {
  if (!report) return '';
  return report.fromSessionNumber === report.toSessionNumber
    ? `Sau buổi ${report.toSessionNumber}`
    : `Từ buổi ${report.fromSessionNumber} đến buổi ${report.toSessionNumber}`;
}

function renderLatestReport(report) {
  elements.latestReport.hidden = !report;
  elements.emptyReport.hidden = Boolean(report);
  if (!report) return;
  const output = report.systemOutput || {};
  elements.latestReportScope.textContent = formatScope(report);
  addPoints(elements.progressPoints, output.progress, 'Chưa đủ dữ liệu để kết luận.');
  addPoints(elements.recurringPoints, output.recurringIssues, 'Chưa ghi nhận vấn đề lặp lại.');
  elements.journeyNextAction.textContent = output.nextAction?.text || 'Tiếp tục hoàn thành phiếu ở các buổi sau.';
  elements.teacherMessage.hidden = !report.humanNote;
  elements.teacherMessageText.textContent = report.humanNote || '';
}

function attendanceLabel(status) {
  return {
    self_confirmed: 'Có mặt · học viên xác nhận',
    teacher_confirmed: 'Có mặt · giảng viên xác nhận',
    pending_teacher: 'Chờ giảng viên xác nhận',
    not_eligible: 'Chưa đủ điều kiện điểm danh'
  }[status] || 'Chưa ghi nhận điểm danh';
}

function submissionLabel(session) {
  if (session.completeness === 'complete') return 'Đã nộp đủ';
  if (session.completeness === 'incomplete') return 'Đã nộp nhưng còn thiếu';
  return 'Chưa nộp phiếu';
}

// Link Journey cũ dùng cùng nhãn/bài chỉ đọc; quyền truy cập vẫn được API kiểm.
function buildSession(session,view,highlight) {
  const read=view.readOnly&&Boolean(view.action);
  const learn=view.canLearn&&/^[0-9a-f-]{36}$/iu.test(session.publicToken||'');
  const item=document.createElement(learn&&!isThuy()?'a':read||learn?'button':'article');
  item.dataset.sessionNumber=String(session.sessionNumber);
  item.className='studentSessionCard session-'+view.kind;
  item.classList.toggle('is-upcoming',highlight);
  if(learn&&isThuy()){item.type='button';item.addEventListener('click',()=>void openLatest(session,view));}
  else if(learn)item.href='./thuy.html#'+new URLSearchParams({assignment:session.publicToken,student:journeyData.student.studentRef});
  if(read){item.type='button';item.addEventListener('click',()=>void openHistory(session));}
  const top=document.createElement('div');top.className='studentSessionTop';
  const b=document.createElement('b');b.textContent='Buổi '+session.sessionNumber;
  const d=document.createElement('span');d.textContent=session.sessionDate?.split('-').reverse().join('/')||'Chưa xác nhận ngày';top.append(b,d);
  const title=document.createElement('strong');title.textContent=contentTitle(session,{title:session.title});
  const skills=document.createElement('small');skills.textContent=skillsLabel(title.textContent)||'Trong kế hoạch khóa học';
  const bottom=document.createElement('div');bottom.className='studentSessionBottom';const status=document.createElement('i');status.textContent=view.label;bottom.append(status);
  if(session.quizSummary?.graded>0){const score=document.createElement('b');score.className='studentSessionScore';score.textContent=session.quizSummary.correct+'/'+session.quizSummary.graded;top.append(score);}
  item.append(top,title,skills,bottom);
  const comment=commentPanel(session.sessionComment,{compact:true});if(comment)item.append(comment);
  if(session.testResult){const p=document.createElement('p');p.className='sessionTestScore';p.textContent=Object.entries(session.testResult).filter(([k,v])=>['listening','reading','writing'].includes(k)&&v).map(([k,v])=>k==='writing'?'Writing: '+(v.status==='ready'?v.score:v.status==='pending'?'đã nộp, đang chờ điểm':'chưa có bài'):k[0].toUpperCase()+k.slice(1)+': '+v.correct+'/'+v.total).join(' · ');item.append(p);}
  return item;
}
let historyGeneration=0,historyController=null,journeyData=null,sessionOwner='',sessionCards=new Map();
const isThuy=()=>document.body.classList.contains('thuy-student');
const displayedSessions=()=>isThuy()?visibleStudentSessions(journeyData.sessions):journeyData.sessions;
let accessStale=false,refreshingAccess=false,openingLatest=false;
const emptySessions=document.createElement('p');emptySessions.textContent='Chưa có buổi học để hiển thị.';emptySessions.className='muted';
emptySessions.hidden=true;elements.sessionList.before(emptySessions);
function paintSessionCards(){
 if(!journeyData)return;
 const owner=journeyData.class.classId+':'+journeyData.student.studentRef;
 if(owner!==sessionOwner){elements.sessionList.replaceChildren();sessionCards.clear();sessionOwner=owner;}
 const keep=new Set(),ordered=[];
 const sessions=displayedSessions(),latest=isThuy()?latestAssignedSession(sessions)?.sessionNumber:null;
 emptySessions.hidden=!isThuy()||Boolean(sessions.length);
 if(isThuy())elements.timelineCount.textContent='';
 for(const session of [...sessions].sort((a,b)=>Number(a.sessionNumber)-Number(b.sessionNumber))){
  const key=String(session.sessionNumber),state=isThuy()?studentEntryState(session,Date.now(),!accessStale):dashboardSessionState(session);
  const highlight=session.sessionNumber===latest;
  const signature=JSON.stringify({session,state,highlight},(key,value)=>key==='serverNow'?undefined:value);
  keep.add(key);let card=sessionCards.get(key);if(!card||card.signature!==signature){const element=buildSession(session,state,highlight);if(card)card.element.replaceWith(element);card={element,signature};sessionCards.set(key,card);}ordered.push(card.element);
 }
 for(const [key,card]of sessionCards)if(!keep.has(key)){card.element.remove();sessionCards.delete(key);}
 for(const [index,card]of ordered.entries())if(elements.sessionList.children[index]!==card)elements.sessionList.insertBefore(card,elements.sessionList.children[index]||null);
}
const historyDialog=document.createElement('dialog');historyDialog.className='draft-dialog referenceRegion';historyDialog.id='journeyDetailDialog';
const close=document.createElement('button');close.type='button';close.className='button';close.textContent='Đóng chi tiết';close.addEventListener('click',()=>historyDialog.close());
const historyStatus=document.createElement('p');historyStatus.setAttribute('role','status');
const historyContent=document.createElement('div'),retry=document.createElement('button');retry.textContent='Thử lại';retry.className='button';retry.hidden=true;
bindDialogDismiss(historyDialog);
let historySession=null;retry.addEventListener('click',()=>void openHistory(historySession));historyDialog.append(close,historyStatus,historyContent,retry);document.body.append(historyDialog);
async function openLatest(session,state){
  if(!state.canLearn||openingLatest||!journeyData)return;
  const {studentRef}=journeyData.student,{classId}=journeyData.class,token=accessToken;
  const current=()=>accessToken===token&&journeyData?.student.studentRef===studentRef&&!historyDialog.open;
  openingLatest=true;
  try{
    const response=await fetch(config.API_BASE_URL+'/api/learning/assignments/open',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({publicToken:session.publicToken}),cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
    const payload=await response.json();
    if(!current())return;
    if(!response.ok||!assignmentAllowsEntry(payload.assignment,session,{studentRef,classId}))throw Error('Phiếu hoặc phần đầu hiện không mở.');
    location.assign('./thuy.html#'+new URLSearchParams({assignment:session.publicToken,student:studentRef,view:'learn'}));
  }catch(error){if(current()){accessStale=true;repaintSessionCards();setNotice(error.message,'error');}}
  finally{openingLatest=false;}
}
function paintLatest(){
  if(!journeyData||!isThuy())return;
  let host=document.querySelector('#studentUpcoming');
  if(!host){host=document.createElement('section');host.id='studentUpcoming';host.setAttribute('aria-label','Buổi học gần nhất');elements.journeyClassName.after(host);}
  renderLatestSession(host,journeyData.sessions,{onOpen:openLatest,available:!accessStale});
}
historyDialog.addEventListener('close',()=>{if(historyDialog.open)return;historyGeneration++;historyController?.abort();historyContent.replaceChildren();});
async function openHistory(session){
  historyController?.abort();const generation=++historyGeneration;historySession=session;
  const controller=new AbortController();historyController=controller;const timeout=setTimeout(()=>controller.abort(),15000);
  historyContent.replaceChildren();retry.hidden=true;historyStatus.textContent='Đang tải toàn bộ bài làm…';if(!historyDialog.open)historyDialog.showModal();
  try{
    const response=await fetch(config.API_BASE_URL+'/api/learning/student/course-session-detail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken,sessionNumber:session.sessionNumber}),cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
    const data=await response.json();if(generation!==historyGeneration||!historyDialog.open)return;
    if(!response.ok||!data.ok)throw Error(data.message||'Chưa đọc được bài làm.');const detail=data.detail;
    if(detail.student?.studentRef!==journeyData.student.studentRef||String(detail.classId)!==String(journeyData.class.classId)||detail.sessionNumber!==session.sessionNumber)throw Error('Dữ liệu không khớp học viên và buổi đã chọn.');
    renderSessionReview(historyContent,detail,{session,studentView:true});historyStatus.textContent='Bài đã nộp · chỉ để xem lại.';
  }catch(e){if(generation===historyGeneration&&historyDialog.open){historyStatus.textContent=controller.signal.aborted?'Quá thời gian chờ.':e.message;retry.hidden=false;}}finally{clearTimeout(timeout);}
}

function buildReport(report) {
  const item = document.createElement('article');
  item.className = 'history-report';
  const heading = document.createElement('b');
  heading.textContent = formatScope(report);
  const output = report.systemOutput || {};
  const summary = document.createElement('p');
  summary.textContent = output.progress?.[0]?.text || report.systemMarkdown || 'Chưa đủ dữ liệu để kết luận.';
  item.append(heading, summary);
  return item;
}

function renderJourney(journey) {
  journeyData=journey;
  if(config.THUY_PILOT_CLASS_IDS?.includes(String(journey.class.classId))&&new URLSearchParams(location.search).get('presentation')!=='legacy'){
    document.body.classList.add('thuy-live','thuy-student');
    paintLatest();elements.timeline.hidden=false;elements.timelineToggle.hidden=true;
    const heading=document.createElement('h2');heading.textContent='Các buổi học';
    elements.timeline.querySelector('.timeline-heading .eyebrow')?.replaceWith(heading);
    if(!document.querySelector('#thuyStudentJourneySkills')){
      for(const path of ['/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/progress-log/thuy-live/styles.css','/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/progress-log/the24.css']){const css=document.createElement('link');css.rel='stylesheet';css.href=path;document.head.append(css);}
      const root=document.createElement('section');root.id='thuyStudentJourneySkills';document.querySelector('#studentUpcoming').after(root);
      void import('/izone-ai-team-pages/progress-log/releases/273bcc4245f492cc/progress-log/thuy-live/student-skills-journey.js').then(({mountStudentSkillJourney})=>mountStudentSkillJourney(root,journey,async sessionNumber=>{
        const response=await fetch(config.API_BASE_URL+'/api/learning/student/course-session-detail',{method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({accessToken,sessionNumber}),cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
        const payload=await response.json();if(!response.ok||!payload.ok)throw Error(payload.message||'Chưa đọc được bài buổi này.');return payload;
      },{accessToken})).then(view=>{if(root.isConnected&&journeyData?.student.studentRef===journey.student.studentRef)studentSkillView=view;}).catch(()=>{root.textContent='Chưa tải được tổng quan kỹ năng. Lịch sử bên dưới vẫn xem được.';});
    }
  }
  commentPoller?.refresh();
  elements.journeyStudentName.textContent = isThuy()?'':journey.student.name;
  document.querySelector('#journeyAccountName').textContent=isThuy()?journey.student.name:'';
  elements.journeyClassName.textContent = journey.class.name;
  elements.attendedCount.textContent = journey.summary.attendedSessions;
  elements.submittedCount.textContent = journey.summary.submittedComplete;
  elements.reportCount.textContent = journey.summary.availableReports;
  renderLatestReport(journey.latestReport);
  const latestFeedbackSession = [...journey.sessions]
    .filter(session => session.teacherSessionFeedback?.noteText)
    .sort((left, right) => Date.parse(left.teacherSessionFeedback.sentAt)
      - Date.parse(right.teacherSessionFeedback.sentAt)).at(-1);
  elements.latestSpeakingFeedback.hidden = !latestFeedbackSession;
  const originalTitle = String(latestFeedbackSession?.title || '').trim();
  const prefix = originalTitle.match(/^Buổi\s+(\d+)(?=\s|[-–—:·]|$)/iu);
  const title = prefix && Number(prefix[1]) === Number(latestFeedbackSession.sessionNumber)
    ? originalTitle.slice(prefix[0].length).replace(/^[\s:·–—-]+/u, '').trim()
    : originalTitle;
  elements.latestSpeakingFeedbackScope.textContent = latestFeedbackSession
    ? [`Buổi ${latestFeedbackSession.sessionNumber}`, title].filter(Boolean).join(' · ') : '';
  elements.latestSpeakingFeedbackText.textContent = latestFeedbackSession?.teacherSessionFeedback.noteText || '';
  elements.timelineCount.textContent = `${journey.summary.totalSessions} buổi`;
  paintSessionCards();
  paintJourneyComments(elements.journeyView,elements.sessionList,displayedSessions(),session=>void openHistory(session),{showLatest:!isThuy()});
  elements.reportHistory.hidden = !journey.reports.length;
  elements.reportList.replaceChildren(...journey.reports.map(buildReport));
  elements.journeyView.hidden = false;
}

async function start() {
  const generation=++startGeneration;
  accessToken = readAccessToken();
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(accessToken)) {
    elements.journeyErrorMessage.textContent = 'Đường dẫn thiếu mã truy cập hoặc mã đã bị thay đổi.';
    elements.journeyError.hidden = false;
    setNotice('', '');
    return;
  }
  try {
    const journey = await apiRequest(accessToken);if(generation!==startGeneration)return;
    renderJourney(journey);
    setNotice('Chỉ bạn và người có link cá nhân này mới mở được nội dung.', '');
  } catch (error) {
    if(generation!==startGeneration)return;elements.journeyErrorMessage.textContent = error.message;
    elements.journeyError.hidden = false;
    setNotice('', '');
  } finally {
    if(!journeyData)accessToken = '';
  }
}

elements.timelineToggle.addEventListener('click', () => {
  const opening = elements.timeline.hidden;
  elements.timeline.hidden = !opening;
  elements.timelineToggle.textContent = opening ? 'Ẩn tình hình từng buổi' : 'Xem tình hình từng buổi';
  elements.timelineToggle.setAttribute('aria-expanded', String(opening));
});

let commentPoller=createCommentPoller({context:()=>journeyData&&accessToken?{accessToken}:null,
  request:async(path,options)=>{const response=await fetch(config.API_BASE_URL+'/api/learning'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options.body),signal:options.signal,cache:'no-store',referrerPolicy:'no-referrer'});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.message||'Chưa đọc được nhận xét.');return data;},
  onData:data=>{if(!journeyData||data.studentRef!==journeyData.student.studentRef||String(data.classId)!==String(journeyData.class.classId))return;
    const byNumber=new Map(data.comments.map(note=>[note.sessionNumber,note]));journeyData.sessions=journeyData.sessions.map(session=>({...session,sessionComment:byNumber.get(session.sessionNumber)||null}));
    repaintSessionCards();
    studentSkillView?.refreshComments(data.comments);
    if(historyDialog.open&&historySession){const existing=[...historyContent.querySelectorAll('[data-session-comment]')],panel=commentPanel(byNumber.get(historySession.sessionNumber));
      if(existing.length!==(panel?1:0)||existing[0]?.outerHTML!==panel?.outerHTML){existing.forEach(box=>box.remove());if(panel)historyContent.append(panel);}}
  }});
stampProgressStudent();void start();
window.addEventListener('pageshow',event=>{if(event.persisted&&progressPinWasLoggedOut()){journeyData=null;accessToken='';elements.journeyView.hidden=true;location.replace(new URL('./student.html',location.href));}});

// Đồng hồ chỉ làm mới thẻ; không gọi API và không thay quyền mở phần.
function repaintSessionCards(){if(!journeyData)return;paintSessionCards();paintLatest();paintJourneyComments(elements.journeyView,elements.sessionList,displayedSessions(),session=>void openHistory(session),{showLatest:!isThuy()});}
async function refreshSessionAccess(){
  if(!isThuy()||!journeyData||!accessToken||document.hidden||refreshingAccess)return;
  const token=accessToken,{studentRef}=journeyData.student,{classId}=journeyData.class;
  const current=()=>token===accessToken&&journeyData?.student.studentRef===studentRef;
  refreshingAccess=true;
  try{
    const latest=await apiRequest(token);
    if(!current())return;
    if(latest.student?.studentRef!==studentRef||String(latest.class?.classId)!==String(classId))throw Error('Dữ liệu chưa khớp học viên và lớp.');
    journeyData=preserveSessionComments(journeyData,latest);
    accessStale=false;
  }catch(error){
    if(!current())return;
    if([401,403,404].includes(error.status)){
      historyGeneration++;historyController?.abort();historyDialog.close();journeyData=null;accessToken='';
      elements.journeyView.hidden=true;elements.journeyError.hidden=false;elements.journeyErrorMessage.textContent=error.message;
      document.querySelector('#journeyAccountName').textContent='';commentPoller.stop();return;
    }
    accessStale=true;setNotice('Chưa cập nhật được quyền mở phiếu. Em có thể xem lại bài đã nộp.','error');
  }finally{refreshingAccess=false;}
  if(current())repaintSessionCards();
}
setInterval(()=>void refreshSessionAccess(),30_000);
function refreshClock(){repaintSessionCards();setTimeout(refreshClock,60000-Date.now()%60000+20);}
setTimeout(refreshClock,60000-Date.now()%60000+20);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){repaintSessionCards();void refreshSessionAccess();}});
document.getElementById('journeyLogout')?.addEventListener('click',async()=>{
 const identity=createCourseStudentIdentity({product:'progress-log',entry:'private-journey',requestIdentity:input=>requestMappingStudentIdentity(input,config.API_BASE_URL)});
 const result=await identity.forget();if(result.status!=='empty'){setNotice('Chưa xóa được ghi nhớ. Em hãy thử lại.','error');return;}
 markProgressLogout();startGeneration++;historyGeneration++;historyController?.abort();commentPoller.stop();accessToken='';journeyData=null;
 document.querySelector('#journeyAccountName').textContent='';elements.journeyView.hidden=true;
 try{history.replaceState({},'',location.pathname+location.search);}catch{/* URL không được chặn xử lý bài hoặc màn đang xem. */}location.replace(new URL('./student.html',location.href));
});

window.progressLogUpdateGuard=()=>Boolean(journeyData)&&!historyDialog.open&&!getSelection()?.toString();
