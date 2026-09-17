import { policyLabel } from '/izone-ai-team-pages/term-tests/substitute-test-2-k56-shared/retake-policy.mjs';

const SKILLS = [
  ['listening', 'Listening'],
  ['reading', 'Reading'],
  ['writing', 'Writing']
];
const state = { data: null, selectedRef: null };
const elements = {
  classFilter: document.querySelector('#class-filter'),
  testSelect: document.querySelector('#test-select'),
  load: document.querySelector('#load-results'),
  message: document.querySelector('#page-message'),
  rows: document.querySelector('#student-rows'),
  detail: document.querySelector('#student-detail')
};

const initialParams = new URLSearchParams(window.location.search);
const requestedClass = (initialParams.get('class') || 'ALL').toUpperCase();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
function pct(value) { return Number.isFinite(value) ? `${value.toFixed(2).replace(/\.00$/u, '')}%` : '—'; }
function score(value, maximum) { return Number.isInteger(value) ? `${value}/${maximum}` : '—'; }
function statusText(status) {
  return { completed: 'Đã hoàn thành', writing_pending: 'Chờ chấm Writing', not_started: 'Chưa làm bài' }[status] || 'Chưa xác định';
}
function policyClass(policy) {
  return policy === 'cap_55' ? 'policy-cap' : policy === 'improved_not_above_cap' ? 'policy-actual' : policy === 'not_improved' ? 'policy-neutral' : 'policy-pending';
}
function setMessage(message, type = '') {
  elements.message.hidden = !message;
  elements.message.textContent = message || '';
  elements.message.className = `notice ${type}`.trim();
}

function renderMetrics() {
  const students = state.data.students;
  document.querySelector('#metric-total').textContent = students.length;
  document.querySelector('#metric-completed').textContent = students.filter(item => item.status === 'completed').length;
  document.querySelector('#metric-capped').textContent = students.filter(item => item.policyResult?.policy === 'cap_55').length;
  document.querySelector('#metric-pending').textContent = students.filter(item => item.status === 'writing_pending').length;
}

function renderRows() {
  const max = state.data.test.maxScores;
  elements.rows.innerHTML = state.data.students.map(student => {
    const actual = student.retakeActual || {};
    const policy = student.policyResult?.policy;
    const selected = state.selectedRef === student.studentRef ? ' class="selected"' : '';
    return `<tr data-student-ref="${escapeHtml(student.studentRef)}"${selected}>
      <td class="student-cell"><strong>${escapeHtml(student.displayName)}</strong><span>${escapeHtml(student.className)} · ${escapeHtml(statusText(student.status))}</span></td>
      <td class="score-cell">${score(actual.listening, max.listening)}</td>
      <td class="score-cell">${score(actual.reading, max.reading)}</td>
      <td class="score-cell">${score(actual.writing, max.writing)}</td>
      <td class="score-cell">${pct(student.retakeAveragePct)}</td>
      <td><span class="status-pill ${policyClass(policy)}">${escapeHtml(student.policyResult?.status === 'writing_review_required' ? 'Chờ Writing' : policy ? policyLabel(policy) : 'Chưa có kết quả')}</span></td>
      <td><button class="open-student" type="button" data-open-student="${escapeHtml(student.studentRef)}" ${student.retakeActual ? '' : 'disabled'}>Chi tiết</button></td>
    </tr>`;
  }).join('');
}

function scoreLines(scores, maxScores) {
  return SKILLS.map(([key, label]) => `<div class="skill-line"><span>${label}</span><strong>${score(scores?.[key], maxScores[key])}</strong></div>`).join('');
}

function detailCards(student) {
  if (!student.detail) return '<p class="empty-cell">Chưa có dữ liệu bài làm.</p>';
  const skillCard = (title, rows) => `<article class="detail-card"><h4>${title}</h4>${rows.map(row => `<div class="detail-stat"><span>${escapeHtml(row.type)}</span><strong>${row.correct}/${row.total}</strong></div>`).join('')}</article>`;
  const writing = student.detail.writing;
  return `<div class="detail-grid">
    ${skillCard('Listening', student.detail.listening)}
    ${skillCard('Reading', student.detail.reading)}
    <article class="detail-card"><h4>Writing</h4><div class="detail-stat"><span>Trạng thái</span><strong>${writing.status === 'reviewed' ? 'Đã chấm' : 'Cần review'}</strong></div><div class="detail-stat"><span>Số từ</span><strong>${writing.wordCount}</strong></div><div class="detail-stat"><span>Ghi chú</span><strong>${escapeHtml(writing.teacherNote)}</strong></div></article>
  </div>`;
}

function renderStudent(studentRef, shouldScroll = true) {
  const student = state.data.students.find(item => item.studentRef === studentRef);
  if (!student?.retakeActual) return;
  state.selectedRef = studentRef;
  renderRows();
  elements.detail.hidden = false;
  const result = student.policyResult;
  const max = state.data.test.maxScores;
  document.querySelector('#student-name').textContent = student.displayName;
  document.querySelector('#student-status').textContent = `${statusText(student.status)}${student.submittedAt ? ` · Nộp lúc ${new Date(student.submittedAt).toLocaleString('vi-VN')}` : ''}`;
  const badge = document.querySelector('#policy-badge');
  badge.className = `policy-badge ${policyClass(result?.policy)}`;
  badge.textContent = result?.status === 'writing_review_required' ? 'Chờ chấm Writing' : policyLabel(result?.policy);
  document.querySelector('#first-average').textContent = pct(student.firstAveragePct);
  document.querySelector('#retake-average').textContent = pct(student.retakeAveragePct);
  document.querySelector('#first-scores').innerHTML = scoreLines(student.firstAttempt, max);
  document.querySelector('#actual-scores').innerHTML = scoreLines(student.retakeActual, max);
  document.querySelector('#attempt-content').innerHTML = detailCards(student);

  const portalScores = result?.status === 'ready' ? result.portalScores : null;
  document.querySelector('#portal-scores').innerHTML = scoreLines(portalScores, max);
  document.querySelector('#portal-average').textContent = result?.status === 'ready' ? pct(result.portalDisplayedAveragePct) : 'Chờ điểm';
  document.querySelector('#portal-note').textContent = result?.status === 'ready'
    ? 'Điểm nguyên dự kiến ghi vào ba cột “Thi lại”. Không thay đổi điểm lần đầu.'
    : 'Chưa tạo điểm Portal cho đến khi Writing được giáo viên chấm.';

  const policyText = document.querySelector('#policy-text');
  const policyMath = document.querySelector('#policy-math');
  const payload = document.querySelector('#portal-payload');
  if (result?.status !== 'ready') {
    policyText.textContent = 'Listening và Reading đã có điểm, nhưng chưa đủ ba kỹ năng để so sánh hai lần thi.';
    policyMath.innerHTML = '<dt>Trạng thái</dt><dd>review_required</dd><dt>Ghi Portal</dt><dd>Không</dd>';
    payload.textContent = JSON.stringify({ status: 'blocked', reason: 'writing_review_required', externalWrite: false }, null, 2);
  } else {
    policyText.textContent = result.policy === 'cap_55'
      ? 'Trung bình thi lại cao hơn lần đầu và vượt 55%, nên hệ thống giảm theo cùng một tỷ lệ rồi tìm tổ hợp điểm nguyên phù hợp.'
      : result.policy === 'improved_not_above_cap'
        ? 'Trung bình thi lại cao hơn lần đầu nhưng không vượt 55%, nên điểm thi lại thực tế được giữ nguyên.'
        : 'Trung bình thi lại không cao hơn lần đầu, nên không áp dụng chính sách nâng điểm và giữ điểm thi lại thực tế.';
    policyMath.innerHTML = `<dt>Trung bình lần đầu</dt><dd>${pct(result.firstAveragePct)}</dd><dt>Trung bình thi lại</dt><dd>${pct(result.retakeAveragePct)}</dd><dt>Hệ số điều chỉnh</dt><dd>${result.policyApplied ? result.factor.toFixed(6) : '1'}</dd><dt>Cách chọn điểm nguyên</dt><dd>${result.combinationMode === 'exact' ? 'Đúng 55%' : result.combinationMode === 'rounds_to_cap' ? 'Portal làm tròn thành 55%' : 'Giữ điểm thực tế'}</dd>`;
    payload.textContent = JSON.stringify({ fields: result.portalFields, portalDisplayedAverage: result.portalDisplayedAveragePct, previewOnly: true, externalWrite: false }, null, 2);
  }
  if (shouldScroll) elements.detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadResults() {
  setMessage('');
  elements.load.disabled = true;
  elements.load.textContent = 'Đang tải…';
  const classCode = elements.classFilter.value || 'ALL';
  const test = elements.testSelect.value;
  try {
    const response = await fetch(`https://izone-substitute-test-2-k56.wingsenglish90.chatgpt.site/api/test/teacher/results?class=${encodeURIComponent(classCode)}&test=${encodeURIComponent(test)}`, { headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Không tải được kết quả.');
    state.data = data;
    state.selectedRef = null;
    renderMetrics();
    renderRows();
    document.querySelector('#updated-at').textContent = `Cập nhật ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    document.querySelector('#back-link').href = '/izone-ai-team-pages/term-tests/substitute-test-2-k56-dashboard/';
    const firstAvailable = data.students.find(item => item.retakeActual);
    if (firstAvailable) renderStudent(firstAvailable.studentRef, false);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('class', classCode);
    nextUrl.searchParams.set('test', test);
    history.replaceState(null, '', nextUrl);
  } catch (error) {
    state.data = null;
    elements.rows.innerHTML = '<tr><td colspan="7" class="empty-cell">Không có dữ liệu.</td></tr>';
    elements.detail.hidden = true;
    setMessage(error.message, 'error');
  } finally {
    elements.load.disabled = false;
    elements.load.textContent = 'Mở kết quả';
  }
}

elements.load.addEventListener('click', loadResults);
elements.rows.addEventListener('click', event => {
  const button = event.target.closest('[data-open-student]');
  if (button) renderStudent(button.dataset.openStudent);
});

async function initialize() {
  try {
    const response = await fetch('https://izone-substitute-test-2-k56.wingsenglish90.chatgpt.site/api/test/catalog', { headers: { Accept: 'application/json' } });
    const catalog = await response.json();
    if (!response.ok) throw new Error(catalog.message || 'Không tải được danh sách lớp.');
    elements.classFilter.replaceChildren(
      new Option('Tất cả lớp', 'ALL'),
      ...catalog.classes.map(item => new Option(item.name, item.code))
    );
    elements.classFilter.value = catalog.classes.some(item => item.code === requestedClass) ? requestedClass : 'ALL';
  } catch {
    elements.classFilter.replaceChildren(new Option('Tất cả lớp', 'ALL'));
  }
  loadResults();
}

initialize();
