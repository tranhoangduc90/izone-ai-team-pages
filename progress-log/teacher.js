/*
 * Dữ liệu nhận vào: Google ID token, lớp được phân quyền và thư viện câu hỏi từ backend.
 * Xử lý: giảng viên chọn 2–3 câu, gán checkpoint, phát hành form bất biến và xem trạng thái nộp/điểm danh.
 * Kết quả: một link lớp để gửi cho học viên; mọi override điểm danh có lý do và operation ID riêng.
 * Khi lỗi: giao diện giữ dữ liệu đang chọn, không giả vờ đã lưu và hiện thông báo để thử lại.
 */

const config = window.PROGRESS_LOG_CONFIG || {};
const state = {
  idToken: '',
  reviewer: null,
  classes: [],
  assignments: [],
  library: [],
  dashboard: null,
  attendanceStudent: null,
  reportStudent: null,
  studentJourneyLink: ''
};

const elements = Object.fromEntries([
  'teacherName', 'teacherNotice', 'teacherAccessView', 'googleSignInButton', 'teacherWorkspace',
  'createTab', 'dashboardTab', 'createPanel', 'dashboardPanel', 'publishForm', 'teacherClassSelect',
  'sessionNumber', 'formTitle', 'skillFilter', 'questionLibrary', 'publishButton', 'publishResult', 'rosterCount',
  'studentLink', 'copyLinkButton', 'assignmentSelect', 'dashboardTitle', 'refreshDashboardButton',
  'blockControls', 'classInsights', 'dashboardSummary', 'studentList', 'attendanceDialog', 'attendanceForm', 'attendanceStudentName',
  'attendanceStatus', 'attendanceReason', 'saveAttendanceButton', 'reportDialog', 'reportStudentName',
  'reportScope', 'reportSystemContent', 'reportHumanNote', 'saveTeacherNoteButton', 'reportDeliveryStatus',
  'markReportDeliveredButton', 'copyStudentJourneyLinkButton', 'studentJourneyLinkStatus'
].map(id => [id, document.getElementById(id)]));

function setNotice(message, kind = '') {
  elements.teacherNotice.textContent = message;
  elements.teacherNotice.className = `notice${kind ? ` ${kind}` : ''}`;
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  if (!config.API_BASE_URL) throw new Error('Chưa cấu hình địa chỉ API.');
  if (!state.idToken) throw new Error('Bạn chưa đăng nhập Google.');
  const response = await fetch(`${config.API_BASE_URL}/api/learning${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${state.idToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const message = response.status === 401
      ? 'Phiên Google đã hết hạn; hãy tải lại trang và đăng nhập lại.'
      : payload?.message || `Hệ thống trả về mã ${response.status}.`;
    throw new Error(message);
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
  setNotice('Đang tải lớp và thư viện câu hỏi…');
  const [options, library] = await Promise.all([
    apiRequest('/teacher/options'),
    apiRequest('/teacher/question-library')
  ]);
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
  elements.attendanceStudentName.textContent = student.discriminator
    ? `${student.name} · ${student.discriminator}`
    : student.name;
  elements.attendanceStatus.value = student.attendanceStatus || 'teacher_confirmed';
  elements.attendanceReason.value = student.attendanceReason || '';
  elements.attendanceDialog.showModal();
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
  }
  copy.append(name, detail);
  const status = document.createElement('span');
  status.className = `status-pill${['self_confirmed', 'teacher_confirmed'].includes(student.attendanceStatus) ? ' good' : ''}`;
  status.textContent = attendanceLabel(student.attendanceStatus);
  const actions = document.createElement('div');
  actions.className = 'student-actions';
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

async function loadDashboard() {
  const assignmentId = elements.assignmentSelect.value;
  if (!assignmentId) {
    elements.dashboardTitle.textContent = 'Chưa có phiếu để theo dõi';
    elements.dashboardSummary.replaceChildren();
    elements.studentList.replaceChildren();
    return;
  }
  setNotice('Đang tải tình hình lớp…');
  try {
    const payload = await apiRequest(`/teacher/dashboard?assignment=${encodeURIComponent(assignmentId)}`);
    state.dashboard = payload.dashboard;
    elements.dashboardTitle.textContent = `${state.dashboard.className} · Buổi ${state.dashboard.sessionNumber}`;
    elements.dashboardSummary.replaceChildren(...buildSummary(state.dashboard.students));
    elements.blockControls.replaceChildren(...state.dashboard.blockReleases.map(buildBlockControl));
    renderClassInsights(state.dashboard.classInsights || []);
    elements.studentList.replaceChildren(...state.dashboard.students.map(buildStudentRow));
    setNotice(`Đã cập nhật ${state.dashboard.students.length} học viên.`);
  } catch (error) {
    setNotice(error.message, 'error');
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
    await apiRequest('/teacher/attendance/override', {
      method: 'POST',
      body: {
        assignmentId: state.dashboard.assignmentId,
        studentRef: state.attendanceStudent.studentRef,
        status: elements.attendanceStatus.value,
        reason: elements.attendanceReason.value.trim(),
        operationId: crypto.randomUUID()
      }
    });
    elements.attendanceDialog.close();
    await loadDashboard();
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
    callback: response => {
      state.idToken = response.credential || '';
      if (state.idToken) void loadWorkspace().catch(error => setNotice(error.message, 'error'));
    }
  });
  window.google.accounts.id.renderButton(elements.googleSignInButton, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi'
  });
}

elements.createTab.addEventListener('click', () => switchPanel('create'));
elements.dashboardTab.addEventListener('click', () => switchPanel('dashboard'));
elements.publishForm.addEventListener('submit', event => void publishReflection(event));
elements.copyLinkButton.addEventListener('click', () => void copyStudentLink());
elements.assignmentSelect.addEventListener('change', () => void loadDashboard());
elements.refreshDashboardButton.addEventListener('click', () => void loadDashboard());
elements.attendanceForm.addEventListener('submit', event => void saveAttendance(event));
elements.skillFilter.addEventListener('change', renderLibrary);
elements.markReportDeliveredButton.addEventListener('click', () => void markReportDelivered());
elements.saveTeacherNoteButton.addEventListener('click', () => void saveTeacherHumanNote());
elements.copyStudentJourneyLinkButton.addEventListener('click', () => void copyStudentJourneyLink());

initializeGoogle();
