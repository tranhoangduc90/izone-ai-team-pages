import { focusSpeakingStart } from './journey-focus.js';
import {renderDocsProgress,docsProgressPending} from './docs-progress.js?v=20261025-progress1';
import { createSpeakingIdentity } from './speaking-identity.js?v=20261018-speaking-tab-v2';
import { createPendingPoller } from './pending-poller.js';
import { createAutoSubmit } from './auto-submit.js?v=20261019-auto-submit-v1';
import { parseShareUrl } from './logic.mjs';

const independentApi = 'https://ducizone.ddns.net/mapping-api/api/speaking-homework-independent';
let apiBase = independentApi;
let workUnitId = '';
let independent = true;
const identityBase = 'https://ducizone.ddns.net/mapping-api';
const query = new URLSearchParams(location.search);
const originalDocumentId = query.get('documentId') || '';
let documentId = '';
let classCode = '';
const assignmentCode = query.get('assignmentCode') || '67-speaking-lam_ro';
document.body.dataset.teacherCode = assignmentCode;
const classHint = query.get('class') || '';
const $ = (id) => document.getElementById(id);
const parts = [
  { key: 'clarify_1', title: 'Làm rõ · Cấp 1', url: 'https://ducizone.short.gy/lam_ro_lv1', lead: 'Luyện đủ 3 phần: Danh từ, Động từ và Tính từ. Mỗi phần ít nhất một câu hỏi.', steps: ['Đăng nhập ChatGPT và mở bài Làm rõ cấp 1.', 'Làm theo chatbot cho cả ba loại từ, mỗi loại ít nhất một câu.', 'Tạo link Chia sẻ của chính hội thoại cấp 1.'] },
  { key: 'clarify_2', title: 'Làm rõ · Cấp 2', url: 'https://ducizone.short.gy/lam_ro_lv2', lead: 'Luyện ít nhất 2 câu hỏi ở cấp 2.', steps: ['Mở bài Làm rõ cấp 2.', 'Làm theo các bước của chatbot cho ít nhất hai câu hỏi.', 'Tạo link Chia sẻ riêng của hội thoại cấp 2.'] },
  { key: 'clarify_3', title: 'Làm rõ · Cấp 3', url: 'https://ducizone.short.gy/lam_ro_lv3', lead: 'Luyện ít nhất 2 câu hỏi ở cấp 3.', steps: ['Mở bài Làm rõ cấp 3.', 'Làm theo các bước của chatbot cho ít nhất hai câu hỏi.', 'Tạo link Chia sẻ riêng của hội thoại cấp 3.'] },
  { key: 'freestyle', title: 'Full câu Speaking · Freestyle', url: 'https://ducizone.short.gy/freestyle', lead: 'Luyện đủ 2 câu Speaking. Mỗi câu cần một chu trình hoàn chỉnh.', steps: ['Yêu cầu ChatGPT hỏi một câu. Nếu cần, xin gợi ý về ý tưởng hoặc từ vựng.', 'Trả lời và xem ChatGPT nhận xét, sửa lỗi, nâng cấp câu trả lời.', 'Nói lại toàn bộ câu trả lời sau góp ý. Lặp lại với câu hỏi thứ hai.', 'Tạo link Chia sẻ riêng của hội thoại Freestyle.'] },
];
const draftFields = new Set();
const state = { studentRef: '', accessToken: '', assignment: null, links: new Map(), localFeedback: new Map(), pending: new Set(), submitted: false, finishing: false };

// Dữ liệu vào: URL của đúng file Homework. Việc chính: gọi API thật và giữ lỗi HTTP có mã.
// Kết quả: dữ liệu máy chủ hoặc thông báo dễ hiểu; lỗi không được biến thành bài đã nộp.
async function post(path, body, timeout = 20_000) {
  const changeButton = $('change-student');
  state.requestCount = (state.requestCount || 0) + 1;
  changeButton.disabled = true;
  try {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    const error = new Error(data.message || 'Hệ thống chưa xử lý được yêu cầu. Hãy thử lại.');
    error.code = data.error || `HTTP_${response.status}`;
    error.status = response.status;
    const retryAfter = response.headers.get('retry-after');
    error.retryAfterMs = retryAfter && /^\d+$/.test(retryAfter)
      ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
    throw error;
  }
  return data;
  } finally {
    state.requestCount -= 1;
    changeButton.disabled = state.requestCount > 0 || state.finishing;
  }
}

function identity() { return { accessToken: state.accessToken, studentRef: state.studentRef }; }
function draftKey() { return `speaking-homework:lesson-3:${independent ? workUnitId : documentId}:${state.studentRef}`; }
// Chỉ nạp link máy chủ khi trường chưa có nháp; chuỗi rỗng là lựa chọn đã lưu.
// Sau nộp, hiện lại link của biên nhận và khóa sửa như trước.
function hydrateField(input, savedValue) {
  if (state.submitted || !draftFields.has(input.id)) {
    if (state.submitted || !input.value) input.value = savedValue || '';
    draftFields.add(input.id);
  }
}
function saveDraft() {
  if (!state.studentRef) return true;
  try {
    localStorage.setItem(draftKey(), JSON.stringify(Object.fromEntries(parts.map(part => [part.key, $(`${part.key}-link`).value]))));
    return true;
  } catch { $('draft-status').textContent = 'Không lưu được link đang gõ trên thiết bị này; hãy giữ link trước khi rời trang.'; return false; }
}
function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey()) || '{}');
    for (const part of parts) if (typeof draft[part.key] === 'string') {
      const input = $(`${part.key}-link`);
      input.value = draft[part.key];
      draftFields.add(input.id);
    }
  } catch { $('draft-status').textContent = 'Không đọc được link đang gõ; các link đã xác nhận vẫn ở trên máy chủ.'; }
}
function setStatus(key, label, kind = '') {
  const el = $(`${key}-status`);
  el.textContent = label;
  el.className = `task-status${kind ? ` is-${kind}` : ''}`;
}
function showResult(key, kind, title, message) {
  const el = $(`${key}-result`);
  renderCheckResult(el, kind, title, message);
  setStatus(key, kind === 'pass' ? 'Đạt yêu cầu' : kind === 'warning' ? 'Cần xác nhận' : kind === 'loading' ? 'Đang kiểm tra' : 'Chưa nhận bài', kind);
}
// Dữ liệu vào: cảnh báo của link học viên đang gõ.
// Việc chính: giữ cảnh báo qua các lượt tự cập nhật từ máy chủ.
// Kết quả: học viên thấy lý do bị chặn cho tới khi sửa link hoặc xác nhận lại.
function showLocalFeedback(key, title, message) {
  state.localFeedback.set(key, { value: $(`${key}-link`).value.trim(), title, message });
  showResult(key, 'blocked', title, message);
}
function reasonFor(link, part) {
  return checkReason(link);
}

function renderLinks() {
  for (const part of parts) {
    const link = state.links.get(part.key);
    const input = $(`${part.key}-link`);
    hydrateField(input, link?.share_url);
    const changed = link && input.value.trim() !== link.share_url;
    const localFeedback = state.localFeedback.get(part.key);
    if (localFeedback && input.value.trim() !== localFeedback.value) state.localFeedback.delete(part.key);
    input.disabled = state.submitted || state.finishing;
    updateCheckControl($(`${part.key}-confirm`), link, { changed, disabled: state.submitted || state.finishing || state.pending.has(part.key) });
    if (state.submitted || (link?.check_status === 'accepted' && !changed)) {
        showResult(part.key, 'pass', 'Đã xác nhận hội thoại', acceptanceMessage(link, `Đã xác nhận ${link?.question_count ?? 'đủ'} câu/lượt luyện cho phần này.`));
    } else if (!changed && technicalCheckFeedback(link)) {
      const feedback = technicalCheckFeedback(link);
      showResult(part.key, feedback.kind, feedback.title, feedback.message);
      setStatus(part.key, 'Chờ kiểm tra lại', 'warning');
    } else if (link?.check_status === 'pending' && !changed) {
      showResult(part.key, 'loading', 'Đang đọc hội thoại', 'Hệ thống đang kiểm nội dung link bạn đã dán. Kết quả sẽ tự cập nhật.');
    } else if (link?.check_status === 'rejected' && !changed) {
      showResult(part.key, 'blocked', 'Chưa nhận link này', reasonFor(link, part));
    } else if (state.localFeedback.has(part.key)) {
      const feedback = state.localFeedback.get(part.key);
      showResult(part.key, 'blocked', feedback.title, feedback.message);
    } else if (changed || !link) {
      $(`${part.key}-result`).hidden = true;
      setStatus(part.key, 'Chưa kiểm tra');
    }
  }
  const confirmed = state.submitted ? parts.length : parts.filter(part => {
    const link = state.links.get(part.key);
    return link?.check_status === 'accepted'
      && $(`${part.key}-link`).value.trim() === link.share_url;
  }).length;
  $('progress-count').textContent = `Đã xác nhận ${confirmed}/4 phần`;
  $('progress-bar').setAttribute('aria-valuenow', String(confirmed));
  $('progress-fill').style.width = `${confirmed * 25}%`;
  updateSubmitControl({ ready: allAccepted(), submitted: state.submitted, phase: state.submitPhase, error: state.submitError, onSubmit: () => autoSubmit.retry() });
  $('completion-card').hidden = !state.submitted;
  if (state.submitted) {
    $('completion-card').hidden = false;
    $('completion-message').textContent = documentId ? 'Biên nhận đã lưu. Google Docs có thể cần thêm ít phút để hiện dòng xác nhận.' : 'Biên nhận đã lưu trên web. Bạn có thể đóng trang và quay lại để xem bài.';
  }
}

async function refresh() {
  if (!state.accessToken) return;
  const token = state.accessToken;
  const revision = state.refreshRevision = (state.refreshRevision || 0) + 1;
  const data = await post('/open', identity());
  if (token !== state.accessToken || revision !== state.refreshRevision) return;
  state.links = new Map((data.links || []).map(link => [link.part, link]));
  state.submitted = state.submitted || (data.status === 'submitted' && Boolean(data.receipt?.id));
  state.docsProgress=data.docsProgress||null;renderDocsProgress(state.docsProgress);
  renderLinks();
  poller.settled();
  autoSubmit.consider();
}
function allAccepted() {
  return parts.every(part => {
    const link = state.links.get(part.key);
    return link?.check_status === 'accepted' && $(`${part.key}-link`).value.trim() === link.share_url;
  });
}

// Nhận phiên và các link đã công nhận; tự nộp một lượt, lỗi mạng đọc lại trước retry.
const autoSubmit = createAutoSubmit({
  key: () => state.accessToken && JSON.stringify([state.accessToken, ...parts.map(part => $(`${part.key}-link`).value.trim())]),
  ready: allAccepted,
  submitted: () => state.submitted,
  busy: () => state.pending.size > 0 || state.requestCount > 0,
  send: () => post('/finish', identity(), 30_000),
  readBack: refresh,
  onSubmitted() {
    state.submitted = true;
    state.finishing = false;
    $('change-student').disabled = state.requestCount > 0;
    renderLinks();
    if(!documentId) $('completion-message').textContent = 'Biên nhận đã lưu trên web. Bạn có thể đóng trang và quay lại để xem bài.';
    $('completion-card').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  },
  onState(phase, error) {
    state.submitPhase = phase;
    state.submitError = phase === 'failed' ? error?.message || '' : '';
    state.finishing = ['sending', 'verifying'].includes(phase);
    $('change-student').disabled = state.finishing || state.requestCount > 0;
    renderLinks();
  },
});

const container = $('parts');
for (const [index, part] of parts.entries()) {
  const section = document.createElement('section');
  section.className = 'task-card';
  section.id = `${part.key}-card`;
  section.innerHTML = `<div class="task-header"><div class="task-number">${String(index + 1).padStart(2, '0')}</div><div><span class="section-kicker">PHẦN ${index + 1}</span><h2>${part.title}</h2></div><span class="task-status" id="${part.key}-status">Chưa kiểm tra</span></div><div class="task-body"><div class="instructions"><p class="instruction-lead">${part.lead}</p><ol>${part.steps.map(step => `<li>${step}</li>`).join('')}</ol>${part.key === 'freestyle' ? '<p class="voice-note">Trên điện thoại hãy dùng nút micro để nói; sau khi nhận góp ý, nói lại câu trả lời đầy đủ.</p>' : ''}</div><div class="submission-panel">${index === 0 ? '<button id="open-share-guide" class="button button-outline guide-button" type="button">Xem hướng dẫn lấy link có hình minh họa <span aria-hidden="true">?</span></button>' : ''}<a class="button button-primary practice-button" href="${part.url}" target="_blank" rel="noopener noreferrer">Mở bài luyện ${part.title} <span aria-hidden="true">↗</span></a><label for="${part.key}-link">Link luyện tập ${part.title}</label><input id="${part.key}-link" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://chatgpt.com/share/..."><p class="field-hint">Dán link Chia sẻ rồi bấm Xác nhận. Hệ thống sẽ đọc hội thoại và kiểm khối lượng luyện.</p><button id="${part.key}-confirm" class="button button-primary confirm-button" type="button">Xác nhận link ${part.title} <span aria-hidden="true">→</span></button><div id="${part.key}-result" class="check-result" role="status" aria-live="polite" hidden></div></div></div>`;
  container.append(section);
}

const guide = $('share-guide-dialog');
$('open-share-guide').addEventListener('click', () => guide.showModal());
$('close-share-guide-x').addEventListener('click', () => guide.close());
$('close-share-guide').addEventListener('click', () => guide.close());
guide.addEventListener('click', event => {
  if (event.target !== guide) return;
  const rect = guide.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) guide.close();
});

for (const part of parts) {
  $(`${part.key}-link`).addEventListener('input', () => { saveDraft(); renderLinks(); autoSubmit.consider(); });
  $(`${part.key}-confirm`).addEventListener('click', async () => {
    if (!state.accessToken || state.pending.has(part.key) || state.submitted) return;
    const parsed = parseShareUrl($(`${part.key}-link`).value);
    if (!parsed.ok) { showLocalFeedback(part.key, 'Link chưa đúng', parsed.reason); return; }
    for (const other of parts) {
      if (other.key !== part.key && parseShareUrl($(`${other.key}-link`).value).url === parsed.url) {
        showLocalFeedback(part.key, 'Trùng hội thoại', `Bạn đã dùng link này cho ${other.title}. Mỗi phần cần một hội thoại riêng.`);
        return;
      }
    }
    state.localFeedback.delete(part.key);
    state.pending.add(part.key);
    $(`${part.key}-confirm`).disabled = true;
    showResult(part.key, 'loading', 'Đang nhận link', 'Hệ thống đang gửi link đi kiểm. Kết quả sẽ tự cập nhật.');
    try {
      poller.expect();
      await post('/checks/request', { ...identity(), part: part.key, url: parsed.url });
      saveDraft();
      await refresh();
    } catch (error) { showLocalFeedback(part.key, 'Chưa nhận link', error.message); }
    finally { poller.update(); state.pending.delete(part.key); renderLinks(); autoSubmit.consider(); }
  });
}
// Chỉ tự tải khi máy chủ đang kiểm/phân tích; lỗi mạng tăng thời gian chờ.
const poller = createPendingPoller({
  refresh,
  hasSession: () => Boolean(state.accessToken),
  isPending: () => docsProgressPending(state.docsProgress)||[...state.links.values()].some(link => link.check_status === 'pending' || ['pending', 'queued', 'running', 'processing'].includes(link.analysis_status)),
  onError: () => { $('draft-status').textContent = 'Tạm mất kết nối; các link đã gửi vẫn được giữ. Trang sẽ tự thử lại.'; },
});

// Nhận lớp/tên đã xác nhận và phiên máy chủ; giữ đích Docs trong suốt lượt làm.
const identityController = createSpeakingIdentity({
  sharedIdentityEnabled: true,
  apiBase: independentApi, identityBase, assignmentCode, lessonNumber: 3, originalDocumentId, classHint, allowWebReceipt: true,
  validateAssignment: assignment => assignment.parts?.length === 4,
  async onOpened(context) {
    independent = Boolean(context.session.workUnitId);
    apiBase = context.session.intakeMode === 'legacy' ? 'https://ducizone.ddns.net/mapping-api/api/speaking-homework' : independentApi;
    workUnitId = context.session.workUnitId || '';
    state.studentRef = context.studentRef;
    if (state.accessToken !== context.session.accessToken) state.finishing = false;
    state.accessToken = context.session.accessToken;
    state.assignment = context.assignment;
    documentId = context.documentId;
    classCode = context.classCode;
    restoreDraft();
    $('return-homework').hidden = !documentId;
    if(documentId) $('return-homework').href = `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit?tab=t.0`;
    try { await refresh(); }
    catch (error) {
      $('draft-status').textContent = `Đã mở phiên, nhưng chưa tải được tiến trình: ${error.message} Trang sẽ tự thử lại.`;
      poller.retry();
    }
    focusSpeakingStart(state.submitted);
  },
  onReset() {
    if (saveDraft() === false) return false;
    poller.stop();
    autoSubmit.reset();
    state.studentRef = ''; state.accessToken = ''; state.links.clear(); state.submitted = false;state.docsProgress=null;renderDocsProgress(null);
    state.localFeedback.clear();
    draftFields.clear();
    $('completion-card').hidden = true;
    for (const part of parts) { $(`${part.key}-link`).value = ''; $(`${part.key}-result`).hidden = true; setStatus(part.key, 'Chưa kiểm tra'); }
    state.pending.clear(); state.finishing = false;
    if ('extraPending' in state) state.extraPending = false;
    documentId = ''; classCode = '';
    $('draft-status').textContent = '';
  },
});
window.addEventListener('beforeunload', event => {
  if (!state.studentRef || state.submitted) return;
  saveDraft(); event.preventDefault(); event.returnValue = '';
});
identityController.start();
import { acceptanceMessage, checkReason, updateSubmitControl, technicalCheckFeedback, renderCheckResult, updateCheckControl } from './check-feedback.js?v=20261029-check-retry-v1';
