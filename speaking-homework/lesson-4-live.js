import { createSpeakingIdentity } from './speaking-identity.js';
import { createPendingPoller } from './pending-poller.js';
import { parseShareUrl } from './logic.mjs';
import { freestyleInstructions } from './assignment-instructions.js';
import { lesson5Code, lesson5Parts } from './lesson-5-parts.js';
import { lesson6Code, lesson6Parts } from './lesson-6-parts.js';
import { lesson7Code, lesson7Parts } from './lesson-7-parts.js';

const independent = document.body.dataset.speakingIntake === 'independent';
const apiBase = independent
  ? 'https://ducizone.ddns.net/mapping-api/api/speaking-homework-independent'
  : 'https://ducizone.ddns.net/mapping-api/api/speaking-homework';
const identityBase = 'https://ducizone.ddns.net/mapping-api';
const query = new URLSearchParams(location.search);
const originalDocumentId = query.get('documentId') || '';
let documentId = '';
let workUnitId = '';
let classCode = '';
const lessonNumber = ['5', '6', '7'].includes(document.body.dataset.speakingLesson)
  ? Number(document.body.dataset.speakingLesson) : 4;
const expectedAssignmentCode = lessonNumber === 7 ? lesson7Code
  : lessonNumber === 6 ? lesson6Code
  : lessonNumber === 5 ? lesson5Code : '67-speaking-diem_giua';
const assignmentCode = query.get('assignmentCode') || expectedAssignmentCode;
const classHint = query.get('class') || '';
const $ = id => document.getElementById(id);
const parts = lessonNumber === 7 ? lesson7Parts : lessonNumber === 6 ? lesson6Parts : lessonNumber === 5 ? lesson5Parts : [
  { key: 'insert_middle', title: 'Chèn điểm giữa trong Speaking',
    url: 'https://ducizone.short.gy/chen_diem_giua_speak',
    lead: 'Luyện đủ ba giai đoạn trong một hội thoại.',
    steps: ['Xem chatbot giới thiệu cấu trúc Chèn điểm giữa.',
      'Luyện có hướng dẫn bằng cách nối dài câu có sẵn.',
      'Luyện tự do: tự tạo câu trả lời có dùng cấu trúc, rồi chia sẻ cả hội thoại.'] },
  { key: 'freestyle', title: 'Full câu Speaking · Freestyle',
    url: 'https://ducizone.short.gy/freestyle',
    lead: 'Luyện đủ ba câu Speaking, mỗi câu có góp ý và lượt nói lại.',
    steps: ['Yêu cầu ChatGPT hỏi một câu; nếu cần, hỏi thêm gợi ý ý tưởng hoặc từ vựng.',
      'Trả lời, đọc góp ý và phần sửa lỗi của ChatGPT.',
      'Nói lại toàn bộ câu trả lời sau góp ý. Làm tương tự với hai câu nữa.'] }
];
const draftFields = new Set();
const state = {
  studentRef: '', accessToken: '', assignment: null, links: new Map(),
  practice: new Map(), doctor: null, localFeedback: new Map(),
  pending: new Set(), submitted: false, finishing: false,
  expanded: false, extraPending: false
};

async function post(path, body, timeout = 20_000) {
  const changeButton = $('change-student');
  state.requestCount = (state.requestCount || 0) + 1;
  changeButton.disabled = true;
  try {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(timeout)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    const error = new Error(data.message || 'Hệ thống chưa xử lý được yêu cầu. Hãy thử lại.');
    error.code = data.error || `HTTP_${response.status}`;
    throw error;
  }
  return data;
  } finally {
    state.requestCount -= 1;
    changeButton.disabled = state.requestCount > 0;
  }
}
function identity() { return { accessToken: state.accessToken, studentRef: state.studentRef }; }
function draftKey() { return `speaking-homework:lesson-${lessonNumber}:${independent ? workUnitId : documentId}:${state.studentRef}`; }
// Chỉ nạp link máy chủ khi trường chưa có nháp; chuỗi rỗng là lựa chọn đã lưu.
// Sau nộp, hiện lại link của biên nhận và khóa sửa như trước.
function hydrateField(input, savedValue) {
  if (state.submitted || !draftFields.has(input.id)) {
    if (state.submitted || !input.value) input.value = savedValue || '';
    draftFields.add(input.id);
  }
}
function saveDraft() {
  if (!state.studentRef) return;
  const draft = Object.fromEntries(parts.map(part => [part.key, $(`${part.key}-link`).value]));
  for (const slot of [1, 2]) {
    draft[`practice_${slot}_exercise`] = $(`practice-${slot}-exercise`).value;
    draft[`practice_${slot}_link`] = $(`practice-${slot}-link`).value;
  }
  draft.extraExercise = $('extra-exercise').value;
  draft.extraLink = $('extra-link').value;
  try { localStorage.setItem(draftKey(), JSON.stringify(draft)); }
  catch { $('draft-status').textContent = 'Thiết bị chưa lưu được link đang gõ. Các link đã xác nhận vẫn được giữ trên máy chủ.'; }
}
function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey()) || '{}');
    for (const part of parts) if (typeof draft[part.key] === 'string') {
      const input = $(`${part.key}-link`);
      input.value = draft[part.key];
      draftFields.add(input.id);
    }
    for (const slot of [1, 2]) {
      if (typeof draft[`practice_${slot}_exercise`] === 'string') {
        const select = $(`practice-${slot}-exercise`);
        select.dataset.draft = draft[`practice_${slot}_exercise`];
        draftFields.add(select.id);
      }
      if (typeof draft[`practice_${slot}_link`] === 'string') {
        const input = $(`practice-${slot}-link`);
        input.value = draft[`practice_${slot}_link`];
        draftFields.add(input.id);
      }
    }
    if (typeof draft.extraExercise === 'string') $('extra-exercise').dataset.draft = draft.extraExercise;
    if (typeof draft.extraLink === 'string') $('extra-link').value = draft.extraLink;
  } catch { $('draft-status').textContent = 'Không khôi phục được link đang gõ; các link đã xác nhận vẫn ở trên máy chủ.'; }
}
function showResult(id, kind, title, message) {
  const el = $(id);
  el.replaceChildren();
  const strong = document.createElement('strong');
  const detail = document.createElement('span');
  strong.textContent = title;
  detail.textContent = message;
  el.append(strong, detail);
  el.className = `check-result is-${kind}`;
  el.hidden = false;
}
function localError(id, input, title, message) {
  state.localFeedback.set(id, { value: input.value.trim(), title, message });
  showResult(id, 'blocked', title, message);
}
function currentPractice(slot) { return state.practice.get(slot); }
function practiceAccepted(slot) {
  const link = currentPractice(slot);
  return link?.status === 'accepted'
    && $(`practice-${slot}-link`).value.trim() === link.share_url
    && $(`practice-${slot}-exercise`).value === link.exercise_id;
}
function mainAccepted(part) {
  const link = state.links.get(part.key);
  return link?.check_status === 'accepted'
    && $(`${part.key}-link`).value.trim() === link.share_url;
}
function allAccepted() {
  return parts.every(mainAccepted) && [1, 2].every(practiceAccepted);
}
function renderMain() {
  for (const part of parts) {
    const link = state.links.get(part.key);
    const input = $(`${part.key}-link`);
    const resultId = `${part.key}-result`;
    hydrateField(input, link?.share_url);
    const changed = link && input.value.trim() !== link.share_url;
    const local = state.localFeedback.get(resultId);
    if (local && input.value.trim() !== local.value) state.localFeedback.delete(resultId);
    input.disabled = state.submitted;
    $(`${part.key}-confirm`).disabled = state.submitted || state.pending.has(part.key);
    if (link?.check_status === 'accepted' && !changed) {
      showResult(resultId, 'pass', 'Đã xác nhận hội thoại',
        part.linkOnly ? 'Đã nhận link. Phần này không yêu cầu số lượng luyện tập.'
          : `Đã kiểm đủ ${link.question_count} giai đoạn/câu luyện.`);
    } else if (link?.check_status === 'pending' && !changed) {
      showResult(resultId, 'loading', 'Đang kiểm nội dung', 'Hệ thống đang đọc và phân tích hội thoại.');
    } else if (link?.check_status === 'rejected' && !changed) {
      showResult(resultId, 'blocked', 'Chưa nhận link',
        link.check_code === 'REUSED_CONVERSATION'
          ? 'Hội thoại này đã dùng cho bài khác trong khóa. Hãy tạo hội thoại mới.'
          : link.check_code === 'CHECK_REVIEW_REQUIRED' ? 'Hệ thống chưa kiểm được hội thoại sau nhiều lần thử. Bài vẫn được giữ; hãy nhờ giảng viên kiểm tra.'
          : 'Hội thoại chưa đủ bước luyện hoặc chưa mở được. Hãy hoàn thành bài rồi chia sẻ lại.');
    } else if (state.localFeedback.has(resultId)) {
      const note = state.localFeedback.get(resultId);
      showResult(resultId, 'blocked', note.title, note.message);
    } else $(resultId).hidden = true;
    $(`${part.key}-status`).textContent = link?.check_status === 'accepted' && !changed
      ? 'Đạt yêu cầu' : link?.check_status === 'pending' && !changed ? 'Đang kiểm tra' : 'Chưa kiểm tra';
  }
}
function doctorOptions() {
  const personal = [...(state.doctor?.allNeeded || []), ...(state.doctor?.practiced || [])]
    .map(item => ({ ...item, source: 'personal' }));
  const shared = (state.doctor?.sharedCatalog || [])
    .map(item => ({ ...item, source: 'shared' }));
  const all = [...personal, ...shared];
  return [...new Map(all.map(item => [item.exercise_id, item])).values()];
}
function updateExerciseLinks() {
  const choices = new Map(doctorOptions().map(item => [item.exercise_id, item]));
  for (const [selectId, linkId] of [
    ['practice-1-exercise', 'practice-1-open'],
    ['practice-2-exercise', 'practice-2-open'],
    ['extra-exercise', 'extra-open']
  ]) {
    const link = $(linkId);
    const chosen = choices.get($(selectId).value);
    let url;
    try { url = new URL(chosen?.exercise_url || ''); } catch { url = null; }
    link.hidden = url?.protocol !== 'https:';
    if (!link.hidden) link.href = url.href;
    else link.removeAttribute('href');
  }
}
function renderDoctor() {
  const doctor = state.doctor;
  if (!doctor) return;
  const items = state.expanded ? doctor.allNeeded : doctor.needed;
  const list = $('doctor-list');
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('li');
    empty.textContent = doctor.neededCount
      ? 'Danh sách đang được tải lại.' : 'Hiện chưa có bài cần luyện. Bác sĩ AI sẽ cập nhật khi bài Speaking được phân tích.';
    list.append(empty);
  }
  for (const item of items) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    try { const url = new URL(item.exercise_url); if (url.protocol === 'https:') a.href = url.href; }
    catch { /* Bài không có URL hợp lệ: giữ tên để học viên báo giảng viên. */ }
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = item.title;
    const count = document.createElement('small');
    count.textContent = `Đề xuất ${item.recommendation_count} lần · đã luyện ${item.practice_count} lần`;
    li.append(a, count);
    list.append(li);
  }
  $('doctor-expand').hidden = doctor.neededCount <= 5;
  $('doctor-expand').textContent = state.expanded ? 'Thu gọn còn 5 bài đầu'
    : `Xem tất cả ${doctor.neededCount} bài cần luyện`;
  $('doctor-sync').textContent = `Đang chờ luyện: ${doctor.neededCount} bài`;
  $('doctor-fallback').hidden = Number(doctor.personalCount) >= 2;
  const choices = doctorOptions();
  for (const select of [$('practice-1-exercise'), $('practice-2-exercise'), $('extra-exercise')]) {
    const selected = select.value || select.dataset.draft || '';
    select.replaceChildren(new Option('Chọn bài luyện tập', ''));
    for (const item of choices) {
      select.add(new Option(item.source === 'shared'
        ? `Kho bài chung · ${item.title}`
        : `${item.title} · đề xuất ${item.recommendation_count} lần`, item.exercise_id));
    }
    if (choices.some(item => item.exercise_id === selected)) select.value = selected;
    select.dataset.draft = '';
  }
  for (const slot of [1, 2]) {
    const row = currentPractice(slot);
    const select = $(`practice-${slot}-exercise`);
    if (row && (state.submitted || !draftFields.has(select.id))
      && choices.some(item => item.exercise_id === row.exercise_id)) {
      select.value = row.exercise_id;
    }
    draftFields.add(select.id);
  }
  updateExerciseLinks();
}
function renderPractice() {
  for (const slot of [1, 2]) {
    const row = currentPractice(slot);
    const input = $(`practice-${slot}-link`);
    const select = $(`practice-${slot}-exercise`);
    const resultId = `practice-${slot}-result`;
    hydrateField(input, row?.share_url);
    const changed = row && (input.value.trim() !== row.share_url
      || select.value !== row.exercise_id);
    input.disabled = state.submitted;
    select.disabled = state.submitted;
    $(`practice-${slot}-confirm`).disabled = state.submitted || state.pending.has(`practice-${slot}`);
    if (row && !changed) {
      if (row.status === 'accepted') {
        showResult(resultId, row.analysis_status === 'done' ? 'pass' : 'loading',
          'Đã nhận bài bổ trợ', row.analysis_status === 'done'
            ? 'Lỗi đã được phân tích; danh sách bài cần luyện đã cập nhật.'
            : 'Bài đã đạt. Bác sĩ AI đang phân tích lỗi để cập nhật danh sách.');
      } else if (row.status === 'pending') {
        showResult(resultId, 'loading', 'Đang kiểm bài bổ trợ',
          'Hệ thống đang đọc hội thoại và bước áp dụng vào câu Speaking.');
      } else showResult(resultId, 'blocked', 'Chưa nhận bài bổ trợ',
        row.check_code === 'REUSED_CONVERSATION'
          ? 'Hội thoại này đã dùng cho bài khác trong khóa.'
          : 'Bài chưa đúng kỹ năng đã chọn hoặc chưa đủ bước áp dụng vào Speaking.');
    } else if (state.localFeedback.has(resultId)) {
      const note = state.localFeedback.get(resultId);
      if (input.value.trim() === note.value) showResult(resultId, 'blocked', note.title, note.message);
      else { state.localFeedback.delete(resultId); $(resultId).hidden = true; }
    } else $(resultId).hidden = true;
  }
  $('extra-practice').hidden = !state.submitted;
  const extra = [...state.practice.values()].filter(row => Number(row.slot) >= 3)
    .sort((a, b) => Number(a.slot) - Number(b.slot));
  $('extra-history').replaceChildren();
  for (const row of extra) {
    const li = document.createElement('li');
    const exercise = doctorOptions().find(item => item.exercise_id === row.exercise_id);
    li.textContent = `${exercise?.title || 'Bài bổ trợ'} · ${row.status === 'accepted'
      ? row.analysis_status === 'done' ? 'Đã phân tích' : 'Đã nhận, đang phân tích'
      : row.status === 'pending' ? 'Đang kiểm' : 'Chưa đạt'}`;
    $('extra-history').append(li);
  }
  const last = extra.at(-1);
  $('extra-confirm').disabled = state.extraPending
    || extra.some(row => row.status === 'pending');
  if (last?.status === 'accepted' && $('extra-link').value.trim() === last.share_url) {
    $('extra-link').value = '';
    saveDraft();
    showResult('extra-result', last.analysis_status === 'done' ? 'pass' : 'loading',
      'Đã nhận bài luyện thêm', last.analysis_status === 'done'
        ? 'Danh sách cá nhân đã cập nhật.' : 'Đang phân tích lỗi để cập nhật danh sách.');
  }
}
function render() {
  renderMain();
  renderDoctor();
  renderPractice();
  const total = parts.length + 2;
  const count = state.submitted ? total
    : parts.filter(mainAccepted).length + [1, 2].filter(practiceAccepted).length;
  $('progress-count').textContent = `Đã xác nhận ${count}/${total} hội thoại`;
  $('progress-bar').setAttribute('aria-valuemax', String(total));
  $('progress-bar').setAttribute('aria-valuenow', String(count));
  $('progress-fill').style.width = `${count / total * 100}%`;
  $('completion-card').hidden = !state.submitted;
}
async function refresh() {
  if (!state.accessToken) return;
  const token = state.accessToken;
  const [data, doctor] = await Promise.all([
    post('/open', identity()), post('/doctor/list', identity())
  ]);
  if (token !== state.accessToken) return;
  state.links = new Map((data.links || []).map(link => [link.part, link]));
  state.practice = new Map((data.practiceLinks || []).map(link => [Number(link.slot), link]));
  state.doctor = doctor;
  state.submitted = data.status === 'submitted' && Boolean(data.receipt?.id);
  if (independent && state.submitted && !documentId) $('completion-message').textContent = `Biên nhận ${data.receipt.id} đã được lưu. Bạn có thể đóng trang và quay lại để xem bài hoặc luyện thêm.`;
  render();
  if (!state.submitted && allAccepted()) await finish();
  poller.settled();
}
async function finish() {
  if (state.submitted || state.finishing || !allAccepted()) return;
  state.finishing = true;
  try {
    const response = await post('/finish', identity(), 30_000);
    if (!response.receipt?.id) throw new Error('Máy chủ chưa trả biên nhận.');
    state.submitted = true;
    if (independent && !documentId) $('completion-message').textContent = `Biên nhận ${response.receipt.id} đã được lưu. Bạn có thể đóng trang và quay lại để xem bài hoặc luyện thêm.`;
    render();
    $('completion-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    $('draft-status').textContent = `Chưa nộp xong: ${error.message} Tiến trình vẫn được giữ.`;
  } finally { state.finishing = false; }
}
for (const [index, part] of parts.entries()) {
  const section = document.createElement('section');
  section.className = 'task-card';
  section.id = `${part.key}-card`;
  section.innerHTML = `<div class="task-header"><div class="task-number">0${index + 1}</div><div><span class="section-kicker">PHẦN ${index + 1}</span><h2>${part.title}</h2></div><span class="task-status" id="${part.key}-status">Chưa kiểm tra</span></div><div class="task-body"><div class="instructions"><p class="instruction-lead">${part.lead}</p><ol>${part.steps.map(step => `<li>${step}</li>`).join('')}</ol></div><div class="submission-panel">${index === 0 ? '<button id="open-share-guide" class="button button-outline guide-button" type="button">Xem hướng dẫn lấy link có hình minh họa ?</button>' : ''}<a class="button button-primary practice-button" href="${part.url}" target="_blank" rel="noopener noreferrer">Mở bài luyện ${part.title} ↗</a><label for="${part.key}-link">Link ChatGPT Share của phần này</label><input id="${part.key}-link" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://chatgpt.com/share/..."><p class="field-hint">Dán link chia sẻ toàn bộ hội thoại, rồi bấm Xác nhận.</p><button id="${part.key}-confirm" class="button button-primary confirm-button" type="button">Xác nhận link ${part.title} →</button><div id="${part.key}-result" class="check-result" role="status" aria-live="polite" hidden></div></div></div>`;
  $('parts').append(section);
}
for (const slot of [1, 2]) {
  const section = document.createElement('section');
  section.className = 'practice-slot';
  section.innerHTML = `<h4>Bài bổ trợ ${slot}</h4><label for="practice-${slot}-exercise">Chọn bài tập</label><select id="practice-${slot}-exercise"><option value="">Đang tải danh sách…</option></select><a id="practice-${slot}-open" class="text-button" target="_blank" rel="noopener noreferrer" hidden>Mở bài đã chọn ↗</a><label for="practice-${slot}-link">Link ChatGPT Share của bài này</label><input id="practice-${slot}-link" type="url" inputmode="url" autocomplete="off" placeholder="https://chatgpt.com/share/..."><button id="practice-${slot}-confirm" class="button button-primary" type="button">Xác nhận bài bổ trợ ${slot} →</button><div id="practice-${slot}-result" class="check-result" role="status" aria-live="polite" hidden></div>`;
  $('practice-slots').append(section);
}
const guide = $('share-guide-dialog');
$('open-share-guide').addEventListener('click', () => guide.showModal());
$('close-share-guide-x').addEventListener('click', () => guide.close());
$('close-share-guide').addEventListener('click', () => guide.close());
guide.addEventListener('click', event => {
  if (event.target !== guide) return;
  const rect = guide.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom) guide.close();
});
for (const part of parts) {
  $(`${part.key}-link`).addEventListener('input', () => { saveDraft(); render(); });
  $(`${part.key}-confirm`).addEventListener('click', async () => {
    if (!state.accessToken || state.pending.has(part.key) || state.submitted) return;
    const input = $(`${part.key}-link`);
    const parsed = parseShareUrl(input.value);
    if (!parsed.ok) { localError(`${part.key}-result`, input, 'Link chưa đúng', parsed.reason); return; }
    input.value = parsed.url;
    const others = [
      ...parts.filter(item => item.key !== part.key).map(item => $(`${item.key}-link`).value),
      ...[1, 2].map(slot => $(`practice-${slot}-link`).value)
    ];
    if (others.some(url => parseShareUrl(url).url === parsed.url)) {
      localError(`${part.key}-result`, input, 'Trùng hội thoại', 'Mỗi phần cần một hội thoại riêng.');
      return;
    }
    state.localFeedback.delete(`${part.key}-result`);
    state.pending.add(part.key);
    showResult(`${part.key}-result`, 'loading', 'Đang nhận link', part.linkOnly
      ? 'Hệ thống đang lưu link; phần này không kiểm số lượng luyện tập.' : 'Hệ thống đang đọc hội thoại.');
    try {
      poller.expect();
      await post('/checks/request', { ...identity(), part: part.key, url: parsed.url });
      saveDraft(); await refresh();
    } catch (error) { localError(`${part.key}-result`, input, 'Chưa nhận link', error.message); }
    finally { poller.update(); state.pending.delete(part.key); render(); }
  });
}
for (const slot of [1, 2]) {
  const input = $(`practice-${slot}-link`);
  const select = $(`practice-${slot}-exercise`);
  input.addEventListener('input', () => { saveDraft(); render(); });
  select.addEventListener('change', () => { saveDraft(); updateExerciseLinks(); render(); });
  $(`practice-${slot}-confirm`).addEventListener('click', async () => {
    if (!state.accessToken || state.submitted || state.pending.has(`practice-${slot}`)) return;
    if (!select.value) { showResult(`practice-${slot}-result`, 'blocked', 'Chưa chọn bài', 'Hãy chọn một bài trong danh sách cá nhân hoặc Kho bài chung.'); return; }
    if ([1, 2].some(other => other !== slot
      && $(`practice-${other}-exercise`).value === select.value)) {
      showResult(`practice-${slot}-result`, 'blocked', 'Trùng bài tập', 'Hai bài bổ trợ bắt buộc cần khác nhau.');
      return;
    }
    const parsed = parseShareUrl(input.value);
    if (!parsed.ok) { localError(`practice-${slot}-result`, input, 'Link chưa đúng', parsed.reason); return; }
    input.value = parsed.url;
    const others = [...parts.map(part => $(`${part.key}-link`).value),
      $(`practice-${slot === 1 ? 2 : 1}-link`).value];
    if (others.some(url => parseShareUrl(url).url === parsed.url)) {
      localError(`practice-${slot}-result`, input, 'Trùng hội thoại', 'Mỗi bài cần hội thoại riêng.');
      return;
    }
    state.pending.add(`practice-${slot}`);
    showResult(`practice-${slot}-result`, 'loading', 'Đang nhận bài', 'Hệ thống đang kiểm bài bổ trợ.');
    try {
      poller.expect();
    await post('/doctor/practice/request', {
        ...identity(), slot, exerciseId: select.value, url: parsed.url
      });
      saveDraft(); await refresh();
    } catch (error) { localError(`practice-${slot}-result`, input, 'Chưa nhận bài', error.message); }
    finally { state.pending.delete(`practice-${slot}`); render(); }
  });
}
$('doctor-expand').addEventListener('click', () => { state.expanded = !state.expanded; renderDoctor(); });
$('extra-exercise').addEventListener('change', () => { saveDraft(); updateExerciseLinks(); });
$('extra-link').addEventListener('input', saveDraft);
$('extra-confirm').addEventListener('click', async () => {
  if (!state.submitted || state.extraPending) return;
  const input = $('extra-link');
  const parsed = parseShareUrl(input.value);
  if (!parsed.ok) { localError('extra-result', input, 'Link chưa đúng', parsed.reason); return; }
  input.value = parsed.url;
  if (!$('extra-exercise').value) {
    showResult('extra-result', 'blocked', 'Chưa chọn bài', 'Hãy chọn bài muốn luyện thêm.');
    return;
  }
  state.extraPending = true;
  showResult('extra-result', 'loading', 'Đang nhận bài luyện thêm', 'Hệ thống đang lưu lượt mới.');
  try {
    poller.expect();
    await post('/doctor/practice/extra/request', {
      ...identity(), exerciseId: $('extra-exercise').value, url: parsed.url
    });
    saveDraft(); await refresh();
  } catch (error) { localError('extra-result', input, 'Chưa nhận bài', error.message); }
  finally { state.extraPending = false; render(); }
});
// Chỉ tự tải khi máy chủ đang kiểm/phân tích; lỗi mạng tăng thời gian chờ.
const poller = createPendingPoller({
  refresh,
  hasSession: () => Boolean(state.accessToken),
  isPending: () => (!state.submitted && allAccepted()) || [...state.links.values()].some(link => link.check_status === 'pending' || ['pending', 'queued', 'running', 'processing'].includes(link.analysis_status))
    || [...state.practice.values()].some(link => link.status === 'pending' || ['pending', 'queued', 'running', 'processing'].includes(link.analysis_status)),
  onError: () => { $('draft-status').textContent = 'Tạm mất kết nối; các link đã gửi vẫn được giữ. Trang sẽ tự thử lại.'; },
});

// Nhận lớp/tên đã xác nhận và phiên máy chủ; giữ đích Docs trong suốt lượt làm.
const identityController = createSpeakingIdentity({
  apiBase, identityBase, assignmentCode, lessonNumber, originalDocumentId, classHint, allowWebReceipt: independent,
  validateAssignment: assignment => assignmentCode === expectedAssignmentCode
    && assignment.parts?.length === parts.length && parts.every((part,index) => assignment.parts[index]?.part_key === part.key)
    && (lessonNumber !== 5 || (Number(assignment.parts[0].min_questions) === 3 && Number(assignment.parts[1].min_questions) === 1))
    && (lessonNumber !== 6 || assignment.parts.every((part, index) => Number(part.min_questions) === [0, 2, 1][index]))
    && (lessonNumber !== 7 || Number(assignment.parts[0].min_questions) === 4)
    && Number(assignment.requiredPracticeCount) === 2 && assignment.doctorEnabled === true,
  async onOpened(context) {
    state.studentRef = context.studentRef;
    state.accessToken = context.session.accessToken;
    state.assignment = context.assignment;
    // Dùng ngưỡng của bài đang mở, không áp yêu cầu IC2304 cho lớp khác.
    if (parts.some(part => part.key === 'freestyle')) {
      const instructions = freestyleInstructions(context.assignment);
      $('freestyle-card').querySelector('.instruction-lead').textContent = instructions.lead;
      $('freestyle-card').querySelectorAll('.instructions li')[2].textContent = instructions.repeat;
    }
    documentId = context.documentId;
    workUnitId = context.session.workUnitId || '';
    classCode = context.classCode;
    restoreDraft();
    $('return-homework').hidden = !documentId;
    if (documentId) $('return-homework').href = `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit?tab=t.0`;
    if (independent && !documentId) $('completion-message').textContent = 'Biên nhận đã được lưu. Bạn có thể đóng trang và quay lại để xem bài hoặc luyện thêm.';
    try { await refresh(); }
    catch (error) {
      $('draft-status').textContent = `Đã mở phiên, nhưng chưa tải được tiến trình: ${error.message} Trang sẽ tự thử lại.`;
      poller.retry();
    }
    $('open-share-guide').focus();
  },
  onReset() {
    poller.stop();
    saveDraft();
    state.studentRef = ''; state.accessToken = '';
    state.links.clear(); state.practice.clear(); state.doctor = null; state.submitted = false;
    state.localFeedback.clear();
    draftFields.clear();
    for (const part of parts) $(`${part.key}-link`).value = '';
    for (const slot of [1, 2]) {
      $(`practice-${slot}-link`).value = '';
      $(`practice-${slot}-exercise`).value = '';
    }
    $('extra-link').value = '';
    state.pending.clear(); state.finishing = false;
    if ('extraPending' in state) state.extraPending = false;
    documentId = ''; workUnitId = ''; classCode = '';
    $('draft-status').textContent = '';
  },
});
window.addEventListener('beforeunload', event => {
  if (!state.studentRef || state.submitted) return;
  saveDraft(); event.preventDefault(); event.returnValue = '';
});
identityController.start();
