import { memoryKey, readMemory, writeMemory } from '../shared/student-memory.js';
import { parseShareUrl } from './logic.mjs';

// Bản thử giữ học viên giả. Khi nối API, roster và quyền mở bài phải đến từ backend.
const documentId = '1hx2XF1bJtNCZZXbwo8PyAlYHFwY4udsDmiqhEwqrA18';
const assignmentCode = '67-speaking-lam_ro';
const parts = [
  { key: 'clarify_1', title: 'Làm rõ · Cấp 1', url: 'https://ducizone.short.gy/lam_ro_lv1', lead: 'Luyện đủ 3 phần: Danh từ, Động từ và Tính từ. Mỗi phần ít nhất một câu hỏi.', steps: ['Đăng nhập ChatGPT và mở bài Làm rõ cấp 1.', 'Làm theo chatbot cho cả ba loại từ, mỗi loại ít nhất một câu.', 'Tạo link Chia sẻ của chính hội thoại cấp 1.'] },
  { key: 'clarify_2', title: 'Làm rõ · Cấp 2', url: 'https://ducizone.short.gy/lam_ro_lv2', lead: 'Luyện ít nhất 2 câu hỏi ở cấp 2.', steps: ['Mở bài Làm rõ cấp 2.', 'Làm theo các bước của chatbot cho ít nhất hai câu hỏi.', 'Tạo link Chia sẻ riêng của hội thoại cấp 2.'] },
  { key: 'clarify_3', title: 'Làm rõ · Cấp 3', url: 'https://ducizone.short.gy/lam_ro_lv3', lead: 'Luyện ít nhất 2 câu hỏi ở cấp 3.', steps: ['Mở bài Làm rõ cấp 3.', 'Làm theo các bước của chatbot cho ít nhất hai câu hỏi.', 'Tạo link Chia sẻ riêng của hội thoại cấp 3.'] },
  { key: 'freestyle', title: 'Full câu Speaking · Freestyle', url: 'https://ducizone.short.gy/freestyle', lead: 'Luyện đủ 2 câu Speaking. Mỗi câu cần một chu trình hoàn chỉnh.', steps: ['Yêu cầu ChatGPT hỏi một câu. Nếu cần, xin gợi ý về ý tưởng hoặc từ vựng.', 'Trả lời và xem ChatGPT nhận xét, sửa lỗi, nâng cấp câu trả lời.', 'Nói lại toàn bộ câu trả lời sau góp ý. Lặp lại với câu hỏi thứ hai.', 'Tạo link Chia sẻ riêng của hội thoại Freestyle.'] },
];
const $ = (id) => document.getElementById(id);
const query = new URLSearchParams(location.search);
const fromDocument = query.get('documentId') === documentId && query.get('assignmentCode') === assignmentCode;
const classCode = query.get('class') || 'IC2304';
const pagesPreview = location.hostname.endsWith('.github.io');
const memory = memoryKey('https://demo.invalid/speaking-homework', location.href);
const remembered = readMemory(localStorage, memory);
const roster = new Map([['00000000-0000-4000-8000-000000000001', 'Học viên thử A'], ['00000000-0000-4000-8000-000000000002', 'Học viên thử B']]);
const state = { student: '', checks: Object.fromEntries(parts.map((part) => [part.key, { accepted: false, pending: false, url: '', fingerprint: '', request: 0 }])) };
const homeworkUrl = `https://docs.google.com/document/d/${documentId}/edit?tab=t.0`;

$('assignment-context').textContent = pagesPreview
  ? 'Giao diện mẫu Homework Lesson 3 · IC2304. Bản này dùng hồ sơ và kết quả minh họa.'
  : fromDocument
    ? `Bài ${assignmentCode} của lớp IC2304 đã được chọn sẵn từ file Homework.`
    : 'Hãy mở từ CTA trong file Homework Lesson 3 để hệ thống nhận đúng bài và lớp.';
if (classCode !== 'IC2304') $('identity-message').textContent = 'Mã lớp trong đường link chưa đúng với bản thử IC2304.';
$('return-homework').href = homeworkUrl;

const container = $('parts');
for (const [index, part] of parts.entries()) {
  const section = document.createElement('section');
  section.className = 'task-card';
  section.id = `${part.key}-card`;
  section.innerHTML = `<div class="task-header"><div class="task-number">${String(index + 1).padStart(2, '0')}</div><div><span class="section-kicker">PHẦN ${index + 1}</span><h2>${part.title}</h2></div><span class="task-status" id="${part.key}-status">Chưa kiểm tra</span></div><div class="task-body"><div class="instructions"><p class="instruction-lead">${part.lead}</p><ol>${part.steps.map((step) => `<li>${step}</li>`).join('')}</ol>${part.key === 'freestyle' ? '<p class="voice-note">Trên điện thoại hãy dùng nút micro để nói; sau khi nhận góp ý, nói lại câu trả lời đầy đủ.</p>' : ''}</div><div class="submission-panel">${index === 0 ? '<button id="open-share-guide" class="button button-outline guide-button" type="button">Xem hướng dẫn lấy link có hình minh họa <span aria-hidden="true">?</span></button>' : ''}<a class="button button-primary practice-button" href="${part.url}" target="_blank" rel="noopener noreferrer">Mở bài luyện ${part.title} <span aria-hidden="true">↗</span></a><label for="${part.key}-link">Link luyện tập ${part.title}</label><input id="${part.key}-link" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://chatgpt.com/share/..."><p class="field-hint">${pagesPreview ? 'Bản Pages chỉ xem giao diện; link không được gửi đi kiểm hoặc lưu bài nộp.' : 'Dán link Chia sẻ rồi bấm Xác nhận để kiểm hội thoại ngay.'}</p>${pagesPreview ? `<label for="${part.key}-scenario">Kết quả muốn xem thử</label><select id="${part.key}-scenario" class="scenario-select"><option value="pass">Đủ bài luyện</option><option value="blocked">Thiếu bài luyện</option>${part.key === 'freestyle' ? '<option value="warning">Cảnh báo có thể gõ chữ</option>' : ''}</select>` : ''}<button id="${part.key}-confirm" class="button button-primary confirm-button" type="button">${pagesPreview ? 'Xem trạng thái mẫu' : `Xác nhận link ${part.title}`} <span aria-hidden="true">→</span></button><div id="${part.key}-result" class="check-result" role="status" aria-live="polite" hidden></div>${part.key === 'freestyle' ? '<div id="voice-confirmation" class="voice-confirmation" hidden><label class="checkbox-line"><input id="voice-checkbox" type="checkbox"> Tôi đã voice chat chứ không phải gõ câu trả lời</label><button id="voice-continue" class="button button-outline" type="button" disabled>Vẫn nộp phần Freestyle</button></div>' : ''}</div></div>`;
  container.append(section);
}

const guide = $('share-guide-dialog');
$('open-share-guide').addEventListener('click', () => guide.showModal());
$('close-share-guide-x').addEventListener('click', () => guide.close());
$('close-share-guide').addEventListener('click', () => guide.close());
guide.addEventListener('click', (event) => {
  if (event.target !== guide) return;
  const rect = guide.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) guide.close();
});

function draftKey(ref) { return `speaking-homework-demo:IC2304:lesson-3:${documentId}:${ref}`; }
function saveDraft() {
  if (!state.student) return;
  try {
    localStorage.setItem(draftKey(state.student), JSON.stringify(Object.fromEntries(parts.map((part) => [part.key, $(`${part.key}-link`).value]))));
    $('draft-status').textContent = 'Đã giữ bốn ô link trên thiết bị này. Khi mở lại, bạn cần Xác nhận từng link để kiểm lại.';
  } catch { $('draft-status').textContent = 'Không lưu được link trên thiết bị này. Hãy giữ link trước khi rời trang.'; }
}
function restoreDraft(ref) {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(ref)) || '{}');
    for (const part of parts) $(`${part.key}-link`).value = typeof draft[part.key] === 'string' ? draft[part.key] : '';
  } catch { $('draft-status').textContent = 'Không đọc được bản nháp. Bạn vẫn có thể dán lại các link.'; }
}
function openStudent(ref) {
  if (!roster.has(ref)) return;
  state.student = ref;
  restoreDraft(ref);
  if (pagesPreview) {
    for (const [index, part] of parts.entries()) {
      if (!$(`${part.key}-link`).value) {
        $(`${part.key}-link`).value = `https://chatgpt.com/share/00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      }
    }
  }
  $('active-student').textContent = roster.get(ref);
  $('identity-form').hidden = true;
  $('identity-confirmed').hidden = false;
  $('homework-content').hidden = false;
  $('open-share-guide').focus();
}
if (remembered.status === 'ok' && roster.has(remembered.studentRef)) {
  $('student-select').value = remembered.studentRef;
  if (fromDocument) openStudent(remembered.studentRef);
}
if (remembered.status === 'unavailable') $('identity-message').textContent = 'Trình duyệt không đọc được tên đã nhớ. Bạn vẫn có thể chọn bằng tay.';
$('open-homework').addEventListener('click', () => {
  const ref = $('student-select').value;
  if (!roster.has(ref) || classCode !== 'IC2304' || (!pagesPreview && (!query.has('class') || !fromDocument))) {
    $('identity-message').textContent = 'Hãy mở từ CTA của Homework Lesson 3 và chọn đúng học viên.';
    return;
  }
  writeMemory(localStorage, memory, $('remember-student').checked ? ref : '');
  $('identity-message').textContent = '';
  openStudent(ref);
});
$('change-student').addEventListener('click', () => {
  if (parts.some((part) => state.checks[part.key].pending)) return;
  writeMemory(localStorage, memory, '');
  state.student = '';
  for (const part of parts) {
    state.checks[part.key] = { accepted: false, pending: false, url: '', fingerprint: '', request: state.checks[part.key].request + 1 };
    $(`${part.key}-link`).value = '';
    $(`${part.key}-link`).disabled = false;
    $(`${part.key}-confirm`).disabled = false;
    $(`${part.key}-result`).hidden = true;
    setStatus(part.key, 'Chưa kiểm tra', '');
  }
  $('completion-card').hidden = true;
  $('identity-form').hidden = false;
  $('identity-confirmed').hidden = true;
  $('homework-content').hidden = true;
});
function setStatus(key, label, kind) {
  const el = $(`${key}-status`);
  el.textContent = label;
  el.className = `task-status${kind ? ` is-${kind}` : ''}`;
}
function showResult(key, result) {
  const el = $(`${key}-result`);
  el.replaceChildren();
  const strong = document.createElement('strong'); strong.textContent = result.title;
  const span = document.createElement('span'); span.textContent = result.message;
  el.append(strong, span);
  el.className = `check-result is-${result.kind}`;
  el.hidden = false;
  setStatus(key, result.kind === 'pass' ? 'Đạt yêu cầu' : result.kind === 'warning' ? 'Cần xác nhận' : result.kind === 'loading' ? 'Đang kiểm tra' : 'Chưa nhận bài', result.kind);
}
function resetCheck(key) {
  if (state.checks[key].pending) return;
  state.checks[key] = { accepted: false, pending: false, url: '', fingerprint: '', request: state.checks[key].request + 1 };
  $(`${key}-result`).hidden = true;
  setStatus(key, 'Chưa kiểm tra', '');
  if (key === 'freestyle') { $('voice-confirmation').hidden = true; $('voice-checkbox').checked = false; $('voice-continue').disabled = true; }
  $('completion-card').hidden = true;
  saveDraft();
}
for (const part of parts) {
  $(`${part.key}-link`).addEventListener('input', () => resetCheck(part.key));
  $(`${part.key}-confirm`).addEventListener('click', () => checkPart(part.key));
}
async function checkPart(key) {
  const current = state.checks[key];
  if (!state.student || current.pending || current.accepted) return;
  const parsed = parseShareUrl($(`${key}-link`).value);
  if (!parsed.ok) { showResult(key, { kind: 'blocked', title: 'Link chưa đúng', message: parsed.reason }); return; }
  for (const other of parts) {
    if (other.key === key) continue;
    const otherUrl = parseShareUrl($(`${other.key}-link`).value);
    if (otherUrl.ok && otherUrl.url === parsed.url) {
      showResult(key, { kind: 'blocked', title: 'Link đã dùng ở phần khác', message: `Hội thoại này đã được dán vào ${other.title}. Hãy dùng bốn hội thoại riêng.` }); return;
    }
  }
  const request = ++current.request;
  current.pending = true;
  $(`${key}-link`).disabled = true;
  $(`${key}-confirm`).disabled = true;
  showResult(key, { kind: 'loading', title: 'Đang đọc hội thoại', message: 'Hệ thống đang mở ChatGPT Share và kiểm nội dung. Việc này có thể mất khoảng một phút.' });
  let result;
  if (pagesPreview) {
    const scenario = $(`${key}-scenario`).value;
    const index = parts.findIndex((part) => part.key === key) + 1;
    result = {
      kind: scenario,
      title: scenario === 'blocked' ? 'Mẫu: cần luyện thêm' : scenario === 'warning' ? 'Mẫu: cần xác nhận voice chat' : 'Mẫu: đủ khối lượng',
      message: scenario === 'blocked' ? 'Đây là cách cảnh báo sẽ hiện khi phần luyện chưa đủ; bản xem giao diện chưa đọc link bạn dán.' : scenario === 'warning' ? 'Mẫu cảnh báo: hệ thống sẽ nêu đoạn chat làm bằng chứng. Học viên có thể xác nhận đã voice chat trước khi nộp.' : 'Đây chỉ là kết quả mô phỏng giao diện. Chưa có hội thoại nào được kiểm hoặc lưu.',
      fingerprint: scenario === 'blocked' ? '' : String(index).repeat(64),
    };
  } else {
    try {
      const response = await fetch('/api/speaking/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ section: key, url: parsed.url }), signal: AbortSignal.timeout(150_000) });
      result = await response.json();
      if (!response.ok && result.kind !== 'blocked') result.kind = 'error';
    } catch { result = { kind: 'error', title: 'Chưa kết nối được bộ kiểm', message: 'Bài chưa được nhận. Hãy thử lại khi bộ kiểm hoạt động.' }; }
  }
  current.pending = false;
  $(`${key}-link`).disabled = false;
  $(`${key}-confirm`).disabled = false;
  if (request !== current.request || !state.student) return;
  if (!['pass', 'warning', 'blocked', 'error'].includes(result?.kind) || (['pass', 'warning'].includes(result.kind) && !/^[0-9a-f]{64}$/.test(result.fingerprint || ''))) result = { kind: 'error', title: 'Phản hồi chưa hợp lệ', message: 'Bài chưa được nhận. Hãy thử lại.' };
  const duplicate = parts.find((part) => part.key !== key && result.fingerprint && state.checks[part.key].fingerprint === result.fingerprint);
  if (duplicate) { showResult(key, { kind: 'blocked', title: 'Trùng nội dung hội thoại', message: `Hội thoại này đã dùng cho ${duplicate.title}. Hãy luyện một hội thoại khác.` }); return; }
  showResult(key, result);
  if (result.kind === 'pass' || result.kind === 'warning') { current.url = parsed.url; current.fingerprint = result.fingerprint; }
  if (result.kind === 'pass') { current.accepted = true; maybeComplete(); }
  if (result.kind === 'warning' && key === 'freestyle') { $('voice-confirmation').hidden = false; $('voice-checkbox').checked = false; $('voice-continue').disabled = true; }
}
$('voice-checkbox').addEventListener('change', () => { $('voice-continue').disabled = !$('voice-checkbox').checked; });
$('voice-continue').addEventListener('click', () => {
  if (!state.student || !$('voice-checkbox').checked || !state.checks.freestyle.url) return;
  state.checks.freestyle.accepted = true;
  $('voice-confirmation').hidden = true;
  showResult('freestyle', { kind: 'pass', title: 'Đã ghi nhận lời xác nhận', message: 'Bạn xác nhận đã voice chat. Bản vận hành sẽ lưu lời xác nhận cùng bài nộp.' });
  maybeComplete();
});
function maybeComplete() {
  if (!parts.every((part) => state.checks[part.key].accepted)) return;
  for (const part of parts) { $(`${part.key}-link`).disabled = true; $(`${part.key}-confirm`).disabled = true; }
  $('completion-card').hidden = false;
  $('completion-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.addEventListener('beforeunload', (event) => {
  if (!state.student || parts.every((part) => state.checks[part.key].accepted)) return;
  saveDraft();
  event.preventDefault();
  event.returnValue = '';
});

// Danh mục sau chỉ để kiểm bố cục. Bản thật sẽ tải đúng danh sách Bác sĩ AI của học viên.
const sampleExercises = [
  ['Mở rộng câu trả lời bằng lý do và ví dụ', 8],
  ['Nói lại câu sau khi được góp ý', 7],
  ['Dùng thì quá khứ khi kể trải nghiệm', 6],
  ['Làm rõ ý bằng một ví dụ cụ thể', 5],
  ['Dùng từ nối tự nhiên khi nói', 4],
  ['Tránh lặp lại từ trong câu trả lời', 3],
  ['Kết thúc câu trả lời gọn và rõ', 2],
];
const doctorList = $('doctor-list');
const doctorSelect = $('doctor-exercise');
for (const [index, [title, times]] of sampleExercises.entries()) {
  const item = document.createElement('li');
  item.className = 'doctor-item';
  if (index >= 5) item.hidden = true;
  const name = document.createElement('strong'); name.textContent = title;
  const count = document.createElement('span'); count.textContent = `${times} lần đề xuất · mẫu`;
  item.append(name, count);
  doctorList.append(item);
  const option = document.createElement('option'); option.value = String(index); option.textContent = title;
  doctorSelect.append(option);
}
$('doctor-expand').addEventListener('click', () => {
  const expanded = $('doctor-expand').getAttribute('aria-expanded') !== 'true';
  doctorList.querySelectorAll('li').forEach((item, index) => { item.hidden = !expanded && index >= 5; });
  $('doctor-expand').setAttribute('aria-expanded', String(expanded));
  $('doctor-expand').textContent = expanded ? 'Thu gọn danh sách' : 'Xem tất cả bài cần luyện';
});
$('doctor-confirm').addEventListener('click', () => {
  const first = parseShareUrl($('doctor-link-1').value);
  const second = parseShareUrl($('doctor-link-2').value);
  $('doctor-result').textContent = !first.ok || !second.ok
    ? 'Mỗi ô cần một link ChatGPT Share đúng dạng.'
    : first.url === second.url
      ? 'Hai ô cần hai hội thoại riêng.'
      : 'Hai link đúng dạng. Đây là bản xem giao diện nên link chưa được kiểm nội dung hoặc ghi nhận.';
});
