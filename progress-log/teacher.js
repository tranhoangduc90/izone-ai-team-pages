/*
 * Dữ liệu nhận vào: phiên đăng nhập ứng dụng, lớp được phân quyền và thư viện câu hỏi từ backend.
 * Xử lý: giảng viên chọn 2–3 câu, gán checkpoint, phát hành form bất biến và xem trạng thái nộp/điểm danh.
 * Kết quả: một link lớp để gửi cho học viên; mọi override điểm danh có lý do và operation ID riêng.
 * Khi lỗi: giao diện giữ dữ liệu đang chọn, không giả vờ đã lưu và hiện thông báo để thử lại.
 */
import { createTeacherLoginPreference } from '../shared/teacher-login-preference.js?rev=20260918-v1';
import { createTeacherSessionClient, teacherSessionRequestOptions } from '../shared/teacher-session-client.js?rev=20260920-v1';

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
  'sessionNumber', 'formTitle', 'skillFilter', 'questionLibrary', 'publishButton', 'publishResult', 'rosterCount',
  'studentLink', 'copyLinkButton', 'assignmentSelect', 'dashboardTitle', 'refreshDashboardButton',
  'openStudentFormButton', 'copyCurrentLinkButton', 'liveUpdatedAt',
  'blockControls', 'classInsights', 'dashboardSummary', 'studentList', 'attendanceDialog', 'attendanceForm', 'attendanceStudentName',
  'attendanceStatus', 'attendanceReason', 'attendanceSyncHint', 'saveAttendanceButton', 'reportDialog', 'reportStudentName',
  'reportScope', 'reportSystemContent', 'reportHumanNote', 'saveTeacherNoteButton', 'reportDeliveryStatus',
  'markReportDeliveredButton', 'copyStudentJourneyLinkButton', 'studentJourneyLinkStatus',
  'draftDialog', 'draftStudentName', 'draftStatus', 'draftAnswers',
  'draftSpeakingFeedback', 'draftFeedbackStatus', 'sendDraftFeedbackButton',
  'draftJourneyLinkStatus', 'copyDraftJourneyLinkButton'
].map(id => [id, document.getElementById(id)]));

function setNotice(message, kind = '') {
  elements.teacherNotice.textContent = message;
  elements.teacherNotice.className = `notice${kind ? ` ${kind}` : ''}`;
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  if (!config.API_BASE_URL) throw new Error('Chưa cấu hình địa chỉ API.');
  if (!state.authenticated) throw new Error('Bạn chưa đăng nhập Google.');
  const generation = state.authGeneration;
  const response = await fetch(`${config.API_BASE_URL}/api/learning${path}`, teacherSessionRequestOptions({
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  }));
  const payload = await response.json().catch(() => null);
  if (generation !== state.authGeneration) throw new Error('Lượt đăng nhập đã thay đổi.');
  if (!response.ok || !payload?.ok) {
    const message = response.status === 401
      ? 'Phiên đăng nhập đã hết hạn; hãy đăng nhập lại.'
      : payload?.message || `Hệ thống trả về mã ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    if (response.status === 401 || response.status === 403) {
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
  elements.dashboardPanel.hidden = creating;
  elements.createTab.classList.toggle('active', creating);
  elements.dashboardTab.classList.toggle('active', !creating);
  if (!creating && elements.assignmentSelect.value) void loadDashboard();
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
  return `${item.class_name} · Buổi ${item.session_number} · ${item.title}`;
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
  state.classes = options.classes || [];
  state.assignments = options.assignments || [];
  state.library = library.items || [];
  elements.teacherName.textContent = state.reviewer.name || state.reviewer.email;
  fillSelect(elements.teacherClassSelect, state.classes, 'class_id', item => item.class_name);
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

function evidenceSourceLabel(source) {
  return {
    progress_form: 'phiếu trên lớp',
    progress_log: 'phiếu trên lớp',
    term_test: 'Term Test',
    homework: 'bài tập về nhà',
    teacher_note: 'ghi chú giảng viên'
  }[source] || 'nguồn học tập khác';
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
  const sources = (student.evidenceSources || []).map(evidenceSourceLabel);
  elements.reportScope.textContent = `Buổi ${report.fromSessionNumber}–${report.toSessionNumber} · ${student.evidenceCount || 0} bằng chứng từ ${sources.join(', ') || 'chưa xác định nguồn'}`;
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
  detail.textContent = `${submissionText} · ${student.evidenceCount || 0} bằng chứng`;
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
      complete: 'Portal: đã ghi nhận',
      queued: 'Portal: đang chờ đồng bộ',
      leased: 'Portal: đang đồng bộ',
      retry_wait: 'Portal: đang thử lại',
      review_required: 'Portal: cần kiểm tra xung đột',
      failed: 'Portal: đồng bộ lỗi'
    }[student.portalSync?.status] || 'Portal: chưa có xác nhận đồng bộ';
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
    if (previousAssignmentId !== assignmentId) state.liveByStudent.clear();
    elements.dashboardTitle.textContent = `${state.dashboard.className} · Buổi ${state.dashboard.sessionNumber}`;
    elements.dashboardSummary.replaceChildren(...buildSummary(state.dashboard.students));
    elements.blockControls.replaceChildren(...state.dashboard.blockReleases.map(buildBlockControl));
    renderClassInsights(state.dashboard.classInsights || []);
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
  state.authGeneration += 1;
  state.authenticated = false;
  state.reviewer = null;
  state.classes = [];
  state.assignments = [];
  state.library = [];
  state.dashboard = null;
  state.liveByStudent.clear();
  elements.teacherName.textContent = 'Chưa đăng nhập';
  elements.teacherAccessView.hidden = false;
  elements.teacherWorkspace.hidden = true;
  for (const id of ['studentList', 'questionLibrary', 'classInsights', 'dashboardSummary', 'draftAnswers']) elements[id].replaceChildren();
  for (const id of ['attendanceDialog', 'reportDialog', 'draftDialog']) if (elements[id].open) elements[id].close();
}

elements.createTab.addEventListener('click', () => switchPanel('create'));
elements.dashboardTab.addEventListener('click', () => switchPanel('dashboard'));
elements.publishForm.addEventListener('submit', event => void publishReflection(event));
elements.copyLinkButton.addEventListener('click', () => void copyStudentLink());
elements.assignmentSelect.addEventListener('change', () => void loadDashboard());
elements.refreshDashboardButton.addEventListener('click', () => void loadDashboard());
elements.openStudentFormButton.addEventListener('click', openCurrentStudentForm);
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
