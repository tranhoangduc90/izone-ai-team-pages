/* Dữ liệu nhận vào: 18 hồ sơ mô phỏng từ cùng kho cục bộ với phiếu học viên.
 * Việc chính: hiển thị trạng thái lớp, bản nháp, điều khiển phần và điểm danh thử.
 * Kết quả: thay đổi hiện ở cả hai tab demo; không gọi API hoặc Portal thật.
 */
import { BLOCKS, QUESTIONS, KEY, answerText, isComplete, load, reset, save } from './data.js';

const $ = id => document.getElementById(id);
let attendanceStudentId = '';
let lastRenderedAt = '';

function notice(message, error = false) { $('teacherNotice').textContent = message; $('teacherNotice').className = `notice demo-notice${error ? ' error' : ''}`; }
function studentLink() { return new URL('./', location.href).toString(); }
function statusText(student) {
  if (student.submitted) return isComplete(student) ? 'Đã nộp đủ' : 'Nộp thiếu';
  if (student.revision > 0) return 'Đang nhập';
  return 'Chưa nộp';
}
function attendanceText(value) { return { self_confirmed: 'Tự xác nhận', teacher_confirmed: 'GV xác nhận', pending_teacher: 'Chờ xác nhận', not_eligible: 'Không đủ điều kiện' }[value] || 'Chờ xác nhận'; }
function displayTime(value) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'; }

function renderControls(data) {
  $('blockControls').replaceChildren(...BLOCKS.map((block, index) => {
    const card = document.createElement('div'); card.className = 'block-control';
    const copy = document.createElement('div');
    const title = document.createElement('b'); title.textContent = `Phần ${block.number}`;
    const status = document.createElement('small'); status.textContent = { open: 'Đang mở', locked: 'Chưa mở', closed: 'Đã đóng' }[data.releases[index]];
    copy.append(title, status);
    const select = document.createElement('select'); select.setAttribute('aria-label', `Trạng thái phần ${block.number}`);
    for (const [key, label] of [['locked', 'Chưa mở'], ['open', 'Mở cho học viên'], ['closed', 'Đóng phần']]) select.add(new Option(label, key, false, data.releases[index] === key));
    select.addEventListener('change', () => { const fresh = load(); fresh.releases[index] = select.value; save(fresh); render(); notice(`Đã đổi Phần ${block.number} thành “${select.selectedOptions[0].textContent}” trong demo.`); });
    card.append(copy, select); return card;
  }));
}

function summaryCard(count, label) {
  const card = document.createElement('div'); card.className = 'summary-item';
  const number = document.createElement('b'); number.textContent = count;
  const small = document.createElement('small'); small.textContent = label;
  card.append(number, small); return card;
}

function openDraft(id) {
  const target = load().students.find(item => item.id === id);
  if (!target) return;
  $('draftStudentName').textContent = target.name;
  $('draftStatus').textContent = `${statusText(target)} · bản lưu ${target.revision} lúc ${displayTime(target.updatedAt)}`;
  $('draftAnswers').replaceChildren(...Object.entries(QUESTIONS).map(([key, question]) => {
    const card = document.createElement('article');
    const heading = document.createElement('b'); heading.textContent = `Câu ${question.number}. ${question.prompt}`;
    const response = document.createElement('p'); response.textContent = answerText(key, target.responses[key]);
    card.append(heading, response);
    if (target.responses[key] !== undefined && (key === 'q3' || key === 'q5')) {
      const verdict = document.createElement('span');
      const correct = key === 'q3' ? target.responses[key] === 'B' : target.responses[key] === 'FALSE';
      verdict.className = `draft-verdict ${correct ? 'correct' : 'incorrect'}`;
      verdict.textContent = correct ? 'Đúng' : 'Chưa đúng'; card.append(verdict);
    }
    return card;
  }));
  $('draftDialog').showModal();
}

function openAttendance(id) {
  const target = load().students.find(item => item.id === id);
  if (!target) return;
  attendanceStudentId = id;
  $('attendanceStudentName').textContent = target.name;
  $('attendanceStatus').value = target.attendance === 'self_confirmed' ? 'teacher_confirmed' : target.attendance;
  $('attendanceReason').value = target.note || '';
  $('attendanceDialog').showModal();
}

function studentRow(target, data) {
  const row = document.createElement('div'); row.className = 'student-row';
  const copy = document.createElement('div'); copy.className = 'student-copy';
  const name = document.createElement('b'); name.textContent = target.name;
  const detail = document.createElement('small');
  detail.textContent = target.submitted ? `${statusText(target)} · 1 bằng chứng` : target.checkpoints.length ? `Đã nộp ${target.checkpoints.length} phần · chưa nộp phiếu cuối` : target.revision ? `Đang nhập · bản lưu ${target.revision} lúc ${displayTime(target.updatedAt)}` : 'Chưa nộp · 0 bằng chứng';
  const progress = document.createElement('div'); progress.className = 'student-block-progress';
  BLOCKS.forEach((block, index) => {
    const submitted = target.submitted || target.checkpoints.includes(block.number);
    const typing = !submitted && block.items.some(key => {
      const value = target.responses[key]; return Array.isArray(value) ? value.some(part => String(part || '').trim()) : Boolean(String(value || '').trim());
    });
    const pill = document.createElement('span'); pill.className = `block-progress-pill ${submitted ? 'submitted' : typing ? 'typing' : ''}`;
    pill.textContent = `Phần ${block.number}: ${submitted ? 'Đã nộp' : typing ? 'Đang nhập' : data.releases[index] === 'locked' ? 'Chưa mở' : 'Chưa nộp'}`;
    progress.append(pill);
  });
  copy.append(name, detail, progress);
  if (target.attendance === 'self_confirmed' || target.attendance === 'teacher_confirmed') {
    const portal = document.createElement('small'); portal.className = 'portal-sync-status'; portal.textContent = 'Portal: chỉ mô phỏng'; copy.append(portal);
  }
  const status = document.createElement('span'); status.className = `status-pill${['self_confirmed', 'teacher_confirmed'].includes(target.attendance) ? ' good' : ''}`; status.textContent = attendanceText(target.attendance);
  const actions = document.createElement('div'); actions.className = 'student-actions';
  if (target.revision || target.submitted) {
    const draft = document.createElement('button'); draft.type = 'button'; draft.className = 'button draft-button'; draft.textContent = target.submitted ? 'Xem bài nộp' : 'Xem đang gõ'; draft.addEventListener('click', () => openDraft(target.id)); actions.append(draft);
  }
  const attendance = document.createElement('button'); attendance.type = 'button'; attendance.className = 'button'; attendance.textContent = 'Điều chỉnh'; attendance.addEventListener('click', () => openAttendance(target.id)); actions.append(attendance);
  row.append(copy, status, actions); return row;
}

function render() {
  const data = load();
  lastRenderedAt = data.updatedAt;
  renderControls(data);
  const complete = data.students.filter(item => item.submitted && isComplete(item)).length;
  const incomplete = data.students.filter(item => item.submitted && !isComplete(item)).length;
  $('dashboardSummary').replaceChildren(summaryCard(complete, 'Đã nộp đủ'), summaryCard(incomplete, 'Nộp thiếu'), summaryCard(data.students.length - complete - incomplete, 'Chưa nộp'));
  const filter = $('statusFilter').value;
  const shown = data.students.filter(item => filter === 'all' || filter === 'submitted' && item.submitted || filter === 'typing' && !item.submitted && item.revision > 0 || filter === 'missing' && !item.submitted);
  $('studentList').replaceChildren(...shown.map(item => studentRow(item, data)));
  $('liveUpdatedAt').textContent = `Tự cập nhật mỗi 8 giây · bản demo lúc ${displayTime(data.updatedAt)}`;
}

function renderQuestionLibrary() {
  $('questionLibrary').replaceChildren(...BLOCKS.flatMap(block => block.items.map(key => {
    const question = QUESTIONS[key];
    const row = document.createElement('div'); row.className = 'demo-question-row';
    const heading = document.createElement('b'); heading.textContent = `Phần ${block.number} · Câu ${question.number}`;
    const copy = document.createElement('small'); copy.textContent = question.prompt;
    row.append(heading, copy); return row;
  })));
}

function switchTab(tab) {
  const dashboard = tab === 'dashboard';
  $('dashboardPanel').hidden = !dashboard; $('createPanel').hidden = dashboard;
  $('dashboardTab').classList.toggle('active', dashboard); $('createTab').classList.toggle('active', !dashboard);
}

function init() {
  renderQuestionLibrary(); render();
  $('dashboardTab').addEventListener('click', () => switchTab('dashboard'));
  $('createTab').addEventListener('click', () => switchTab('create'));
  $('refreshDashboardButton').addEventListener('click', () => { render(); notice('Đã đọc lại dữ liệu mô phỏng mới nhất.'); });
  $('statusFilter').addEventListener('change', render);
  $('openStudentFormButton').addEventListener('click', () => window.open(studentLink(), '_blank', 'noopener'));
  $('previewFormButton').addEventListener('click', () => window.open(studentLink(), '_blank', 'noopener'));
  $('copyCurrentLinkButton').addEventListener('click', async () => { try { await navigator.clipboard.writeText(studentLink()); notice('Đã sao chép link phiếu demo.'); } catch { notice('Trình duyệt chưa cho phép sao chép. Hãy dùng nút “Mở phiếu” rồi sao chép địa chỉ trang.', true); } });
  $('attendanceForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('attendanceReason').reportValidity()) return;
    const data = load(); const target = data.students.find(item => item.id === attendanceStudentId);
    if (!target) return;
    target.attendance = $('attendanceStatus').value; target.note = $('attendanceReason').value.trim();
    target.portalSync = 'demo_only'; save(data); $('attendanceDialog').close(); render(); notice(`Đã lưu điểm danh mô phỏng cho ${target.name}; Portal thật không đổi.`);
  });
  $('resetDemoButton').addEventListener('click', () => { if (!confirm('Đặt lại mọi thay đổi thử nghiệm của bản demo? Dữ liệu thật không bị ảnh hưởng.')) return; reset(); render(); notice('Đã khôi phục 15 bài nộp mẫu và 3 học viên chưa nộp.'); });
  window.addEventListener('storage', event => { if (event.key === KEY) render(); });
  window.addEventListener('demo-data-updated', render);
  window.setInterval(() => { if (load().updatedAt !== lastRenderedAt) render(); }, 8000);
}

init();
