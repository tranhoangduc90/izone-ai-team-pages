import {contentTitle,sessionHeading,sessionState,skillsLabel} from './session-presentation.js';
import {renderSessionReview} from './session-review.js?rev=20261007-comments';
import {commentPanel,paintJourneyComments,createCommentPoller,bindDialogDismiss} from './session-comments.js?rev=20261007-comments-v2';
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
    body: JSON.stringify({ accessToken: token }),
    cache: 'no-store',
    referrerPolicy: 'no-referrer',signal:controller.signal
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || 'Link không còn sử dụng được.');
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
function buildSession(session) {
  const view=sessionState(session,{assignmentId:session.assignmentId,status:session.completeness==='complete'?'complete':session.testResult?'test_result':'not_submitted'},
    session.assignmentId?{title:session.title,status:session.assignmentStatus}:null);
  const read=session.completeness==='complete'||Boolean(session.sessionComment?.noteText);
  const learn=!read&&view.canLearn&&/^[0-9a-f-]{36}$/iu.test(session.publicToken||'');
  const item=document.createElement(learn?'a':read?'button':'article');
  item.dataset.sessionNumber=String(session.sessionNumber);
  item.className='studentSessionCard session-'+view.kind;
  if(learn)item.href='./index.html#assignment='+encodeURIComponent(session.publicToken);
  if(read){item.type='button';item.addEventListener('click',()=>void openHistory(session));}
  const top=document.createElement('div');top.className='studentSessionTop';
  const b=document.createElement('b');b.textContent='BUỔI '+String(session.sessionNumber).padStart(2,'0');
  const d=document.createElement('span');d.textContent=session.sessionDate?.split('-').reverse().join('/')||'Chưa xác nhận ngày';top.append(b,d);
  const title=document.createElement('strong');title.textContent=contentTitle(session,{title:session.assignmentId||session.sessionKind==='test'?session.title:''});
  const skills=document.createElement('small');skills.textContent=skillsLabel(title.textContent)||'Trong kế hoạch khóa học';
  const bottom=document.createElement('div');bottom.className='studentSessionBottom';const status=document.createElement('i');status.textContent=view.label;bottom.append(status);
  if(session.quizSummary?.graded>0){const score=document.createElement('b');score.textContent=session.quizSummary.correct+'/'+session.quizSummary.graded;bottom.append(score);}
  item.append(top,title,skills,bottom);
  const comment=commentPanel(session.sessionComment);if(comment)item.append(comment);
  if(session.testResult){const p=document.createElement('p');p.className='sessionTestScore';p.textContent=Object.entries(session.testResult).filter(([k,v])=>['listening','reading','writing'].includes(k)&&v).map(([k,v])=>k==='writing'?'Writing: '+(v.status==='ready'?v.score:v.status==='pending'?'đã nộp, đang chờ điểm':'chưa có bài'):k[0].toUpperCase()+k.slice(1)+': '+v.correct+'/'+v.total).join(' · ');item.append(p);}
  return item;
}
let historyGeneration=0,historyController=null,journeyData=null;
const historyDialog=document.createElement('dialog');historyDialog.className='draft-dialog referenceRegion';historyDialog.id='journeyDetailDialog';
const close=document.createElement('button');close.type='button';close.className='button';close.textContent='Đóng chi tiết';close.addEventListener('click',()=>historyDialog.close());
const historyStatus=document.createElement('p');historyStatus.setAttribute('role','status');
const historyContent=document.createElement('div'),retry=document.createElement('button');retry.textContent='Thử lại';retry.className='button';retry.hidden=true;
bindDialogDismiss(historyDialog);
let historySession=null;retry.addEventListener('click',()=>void openHistory(historySession));historyDialog.append(close,historyStatus,historyContent,retry);document.body.append(historyDialog);
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
    renderSessionReview(historyContent,detail,{session});historyStatus.textContent='Bài đã nộp · chỉ để xem lại.';
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
  commentPoller?.refresh();
  elements.journeyStudentName.textContent = journey.student.name;
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
  elements.sessionList.replaceChildren(...journey.sessions.map(buildSession));
  paintJourneyComments(elements.journeyView,elements.sessionList,journey.sessions,session=>void openHistory(session));
  elements.reportHistory.hidden = !journey.reports.length;
  elements.reportList.replaceChildren(...journey.reports.map(buildReport));
  elements.journeyView.hidden = false;
}

async function start() {
  accessToken = readAccessToken();
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(accessToken)) {
    elements.journeyErrorMessage.textContent = 'Đường dẫn thiếu mã truy cập hoặc mã đã bị thay đổi.';
    elements.journeyError.hidden = false;
    setNotice('', '');
    return;
  }
  try {
    const journey = await apiRequest(accessToken);
    renderJourney(journey);
    setNotice('Chỉ bạn và người có link cá nhân này mới mở được nội dung.', '');
  } catch (error) {
    elements.journeyErrorMessage.textContent = error.message;
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
    elements.sessionList.replaceChildren(...journeyData.sessions.map(buildSession));paintJourneyComments(elements.journeyView,elements.sessionList,journeyData.sessions,session=>void openHistory(session));
    if(historyDialog.open&&historySession){historyContent.querySelectorAll('[data-session-comment]').forEach(box=>box.remove());const panel=commentPanel(byNumber.get(historySession.sessionNumber));if(panel)historyContent.append(panel);}
  }});
void start();

// Đồng hồ chỉ làm mới thẻ; không gọi API và không thay quyền mở phần.
function repaintSessionCards(){if(!journeyData)return;elements.sessionList.replaceChildren(...journeyData.sessions.map(buildSession));paintJourneyComments(elements.journeyView,elements.sessionList,journeyData.sessions,session=>void openHistory(session));}
function refreshClock(){repaintSessionCards();setTimeout(refreshClock,60000-Date.now()%60000+20);}
setTimeout(refreshClock,60000-Date.now()%60000+20);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)repaintSessionCards();});
