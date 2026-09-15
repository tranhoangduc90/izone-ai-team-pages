'use strict';

const config = window.PROGRESS_LOG_CONFIG || {};
const elements = Object.fromEntries([
  'journeyNotice', 'journeyView', 'journeyStudentName', 'journeyClassName',
  'attendedCount', 'submittedCount', 'reportCount', 'latestReport', 'latestReportScope',
  'progressPoints', 'recurringPoints', 'journeyNextAction', 'teacherMessage',
  'teacherMessageText', 'emptyReport', 'timelineToggle', 'timeline', 'timelineCount',
  'sessionList', 'reportHistory', 'reportList', 'journeyError', 'journeyErrorMessage'
].map(id => [id, document.getElementById(id)]));

let accessToken = '';

function setNotice(message = '', kind = '') {
  elements.journeyNotice.textContent = message;
  elements.journeyNotice.className = `notice${kind ? ` ${kind}` : ''}`;
}

function readAccessToken() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access') || '';
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  return token;
}

async function apiRequest(token) {
  const response = await fetch(`${config.API_BASE_URL}/api/learning/student/course-journey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: token }),
    cache: 'no-store',
    referrerPolicy: 'no-referrer'
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || 'Link không còn sử dụng được.');
  }
  return payload.journey;
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

function buildSession(session) {
  const item = document.createElement('article');
  item.className = 'session-item';
  const heading = document.createElement('div');
  heading.className = 'session-heading';
  const number = document.createElement('b');
  number.textContent = `Buổi ${session.sessionNumber}`;
  const status = document.createElement('span');
  status.textContent = submissionLabel(session);
  status.className = `journey-status${session.completeness === 'complete' ? ' good' : ''}`;
  heading.append(number, status);
  const title = document.createElement('p');
  title.textContent = session.title;
  const attendance = document.createElement('small');
  attendance.textContent = attendanceLabel(session.attendanceStatus);
  item.append(heading, title, attendance);
  if (session.afterSessionReport) {
    const next = document.createElement('div');
    next.className = 'session-note';
    const text = session.afterSessionReport.systemOutput?.nextAction?.text
      || session.afterSessionReport.systemMarkdown;
    next.textContent = text || 'Đã có nhận xét sau buổi học.';
    item.append(next);
  }
  return item;
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
  elements.journeyStudentName.textContent = journey.student.name;
  elements.journeyClassName.textContent = journey.class.name;
  elements.attendedCount.textContent = journey.summary.attendedSessions;
  elements.submittedCount.textContent = journey.summary.submittedComplete;
  elements.reportCount.textContent = journey.summary.availableReports;
  renderLatestReport(journey.latestReport);
  elements.timelineCount.textContent = `${journey.summary.totalSessions} buổi`;
  elements.sessionList.replaceChildren(...journey.sessions.map(buildSession));
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
    accessToken = '';
  }
}

elements.timelineToggle.addEventListener('click', () => {
  const opening = elements.timeline.hidden;
  elements.timeline.hidden = !opening;
  elements.timelineToggle.textContent = opening ? 'Ẩn tình hình từng buổi' : 'Xem tình hình từng buổi';
  elements.timelineToggle.setAttribute('aria-expanded', String(opening));
});

void start();
