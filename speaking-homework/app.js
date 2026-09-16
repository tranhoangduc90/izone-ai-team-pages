import { memoryKey, readMemory, resolveRememberedStudent, writeMemory } from '../shared/student-memory.js';
import { demoCheck, parseShareUrl, safeHomeworkUrl } from './logic.mjs';

// Bản thử chỉ dùng hai hồ sơ giả. Không có dữ liệu học viên hoặc lần nộp thật trong mã nguồn.
const roster = [{ classRef: 'IC2200', classCode: 'IC2200', students: [
  { studentRef: '00000000-0000-4000-8000-000000000001', name: 'Học viên thử A' },
  { studentRef: '00000000-0000-4000-8000-000000000002', name: 'Học viên thử B' },
] }];
const demoMemoryKey = memoryKey('https://demo.invalid/speaking-homework', location.href);
const query = new URLSearchParams(location.search);
const homeworkUrl = safeHomeworkUrl(query.get('returnUrl') || '');
if (query.has('returnUrl')) {
  query.delete('returnUrl');
  const cleanQuery = query.toString();
  history.replaceState(null, '', `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${location.hash}`);
}

const $ = (id) => document.getElementById(id);
const identitySelect = $('student-select');
const rememberCheckbox = $('remember-student');
const identityMessage = $('identity-message');
const sections = ['paraphrase', 'speaking'];
const state = {
  activeStudent: '',
  paraphrase: { accepted: false, pending: false, checkedUrl: '', request: 0 },
  speaking: { accepted: false, pending: false, checkedUrl: '', request: 0 },
};

// Chọn sẵn đúng mã giả đã nhớ; học viên vẫn phải bấm Mở bài nộp.
const remembered = readMemory(localStorage, demoMemoryKey);
const match = resolveRememberedStudent(roster, remembered.studentRef, 'IC2200', { enabled: true, allClasses: true });
if (match) identitySelect.value = match.studentRef;
if (remembered.status === 'unavailable') identityMessage.textContent = 'Trình duyệt không cho đọc bộ nhớ. Bạn vẫn có thể chọn học viên bằng tay.';

$('open-homework').addEventListener('click', () => {
  const student = roster[0].students.find((item) => item.studentRef === identitySelect.value);
  if (!student) {
    identityMessage.textContent = 'Hãy chọn một học viên thử trước khi mở bài.';
    identitySelect.focus();
    return;
  }
  const saved = writeMemory(localStorage, demoMemoryKey, rememberCheckbox.checked ? student.studentRef : '');
  identityMessage.textContent = saved ? '' : 'Không lưu được lựa chọn trên thiết bị này. Bạn vẫn có thể làm bài trong phiên hiện tại.';
  state.activeStudent = student.studentRef;
  $('active-student').textContent = student.name;
  $('identity-form').hidden = true;
  $('identity-confirmed').hidden = false;
  $('homework-content').hidden = false;
  $('paraphrase-link').focus();
});

$('change-student').addEventListener('click', () => {
  if (sections.some((section) => state[section].pending)) {
    identityMessage.textContent = 'Hãy đợi kiểm tra link xong trước khi đổi người học.';
    return;
  }
  const cleared = writeMemory(localStorage, demoMemoryKey, '');
  if (!cleared) {
    identityMessage.textContent = 'Không xóa được người học đã nhớ. Vui lòng kiểm tra quyền lưu của trình duyệt rồi thử lại.';
    return;
  }
  state.activeStudent = '';
  for (const section of sections) {
    state[section] = { accepted: false, pending: false, checkedUrl: '', request: state[section].request + 1 };
    $(`${section}-link`).value = '';
    $(`${section}-link`).disabled = false;
    $(`${section}-confirm`).disabled = false;
    $(`${section}-scenario`).disabled = false;
    $(`${section}-result`).hidden = true;
    setStatus(section, 'Chưa kiểm tra', '');
  }
  $('voice-checkbox').checked = false;
  $('voice-confirmation').hidden = true;
  $('completion-card').hidden = true;
  identitySelect.value = '';
  $('identity-confirmed').hidden = true;
  $('identity-form').hidden = false;
  $('homework-content').hidden = true;
  identityMessage.textContent = '';
  identitySelect.focus();
});

function setStatus(section, label, kind) {
  const el = $(`${section}-status`);
  el.textContent = label;
  el.className = `task-status${kind ? ` is-${kind}` : ''}`;
}

function showResult(section, result) {
  const el = $(`${section}-result`);
  el.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = result.title;
  const body = document.createElement('span');
  body.textContent = result.message;
  el.append(title, body);
  el.className = `check-result is-${result.kind}`;
  el.hidden = false;
  const label = result.kind === 'pass' ? 'Đạt yêu cầu' : result.kind === 'warning' ? 'Cần xác nhận' : 'Chưa nhận bài';
  setStatus(section, label, result.kind);
}

function resetCheck(section) {
  if (state[section].pending) return;
  state[section].accepted = false;
  state[section].checkedUrl = '';
  state[section].request += 1;
  $(`${section}-result`).hidden = true;
  setStatus(section, 'Chưa kiểm tra', '');
  if (section === 'speaking') {
    $('voice-confirmation').hidden = true;
    $('voice-checkbox').checked = false;
    $('voice-continue').disabled = true;
  }
  $('completion-card').hidden = true;
}

for (const section of sections) {
  $(`${section}-link`).addEventListener('input', () => resetCheck(section));
  $(`${section}-scenario`).addEventListener('change', () => resetCheck(section));
  $(`${section}-confirm`).addEventListener('click', () => checkSection(section));
}

async function checkSection(section) {
  if (!state.activeStudent || state[section].pending || state[section].accepted) return;
  const parsed = parseShareUrl($(`${section}-link`).value);
  if (!parsed.ok) {
    showResult(section, { kind: 'blocked', title: 'Link chưa đúng', message: parsed.reason });
    return;
  }
  const otherSection = section === 'paraphrase' ? 'speaking' : 'paraphrase';
  const otherParsed = parseShareUrl($(`${otherSection}-link`).value);
  if (otherParsed.ok && otherParsed.url === parsed.url) {
    showResult(section, { kind: 'blocked', title: 'Hai phần dùng cùng một link', message: 'Paraphrase và Full Speaking cần hai hội thoại riêng. Hãy tạo và chia sẻ đúng hội thoại cho từng phần.' });
    return;
  }

  const request = ++state[section].request;
  state[section].pending = true;
  const button = $(`${section}-confirm`);
  button.disabled = true;
  showResult(section, { kind: 'loading', title: 'Đang kiểm tra hội thoại', message: 'Bản thử đang mô phỏng việc đọc link và phân tích nội dung...' });
  await new Promise((resolve) => setTimeout(resolve, 700));
  state[section].pending = false;
  button.disabled = false;
  if (request !== state[section].request || !state.activeStudent) return;

  const outcome = demoCheck(section, $(`${section}-scenario`).value);
  showResult(section, outcome);
  state[section].checkedUrl = parsed.url;
  if (outcome.kind === 'warning') {
    $('voice-confirmation').hidden = false;
    $('voice-checkbox').checked = false;
    $('voice-continue').disabled = true;
    return;
  }
  if (outcome.kind === 'pass') {
    state[section].accepted = true;
    maybeComplete();
  }
}

$('voice-checkbox').addEventListener('change', () => {
  $('voice-continue').disabled = !$('voice-checkbox').checked;
});
$('voice-continue').addEventListener('click', () => {
  if (!state.activeStudent || !$('voice-checkbox').checked || !state.speaking.checkedUrl) return;
  $('voice-confirmation').hidden = true;
  state.speaking.accepted = true;
  showResult('speaking', { kind: 'pass', title: 'Đã ghi nhận xác nhận của bạn', message: 'Bạn xác nhận đã voice chat. Phần Speaking được nhận và lời xác nhận sẽ được lưu cùng lượt nộp trong bản vận hành.' });
  maybeComplete();
});

function maybeComplete() {
  if (!sections.every((section) => state[section].accepted)) return;
  for (const section of sections) {
    $(`${section}-link`).disabled = true;
    $(`${section}-confirm`).disabled = true;
    $(`${section}-scenario`).disabled = true;
  }
  const returnLink = $('return-homework');
  if (homeworkUrl) {
    returnLink.href = homeworkUrl;
    returnLink.removeAttribute('aria-disabled');
    returnLink.removeAttribute('tabindex');
  } else {
    returnLink.title = 'Bản thử chưa được mở từ file Homework của học viên.';
  }
  $('completion-card').hidden = false;
  $('completion-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function returnToHomework(event) {
  if (!homeworkUrl) return;
  event.preventDefault();
  if (window.opener && !window.opener.closed) {
    try { window.opener.focus(); window.close(); } catch { /* Trình duyệt có thể chặn đóng tab. */ }
  }
  setTimeout(() => { if (!document.hidden) location.assign(homeworkUrl); }, 160);
}

$('return-homework').addEventListener('click', returnToHomework);
