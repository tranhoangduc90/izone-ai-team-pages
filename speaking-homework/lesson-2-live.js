import { createSpeakingIdentity } from './speaking-identity.js';
import { createPendingPoller } from './pending-poller.js';
import { parseShareUrl } from './logic.mjs';

const apiBase = 'https://ducizone.ddns.net/mapping-api/api/speaking-homework';
const identityBase = 'https://ducizone.ddns.net/mapping-api';
const assignmentCode = '67-speaking-paraphrase';
const query = new URLSearchParams(location.search);
const originalDocumentId = query.get('documentId') || '';
const classHint = query.get('class') || '';
let documentId = '';
let classCode = '';
const $ = (id) => document.getElementById(id);
const parts = [
  { key: 'paraphrase', title: 'Luyện tập Paraphrase', url: 'https://ducizone.short.gy/paraphrase_cau_hoi', lead: 'Luyện ít nhất 5 câu hỏi theo hướng dẫn của ChatGPT.', steps: ['Đăng nhập ChatGPT và mở bài luyện Paraphrase.', 'Làm theo các bước chatbot hướng dẫn với ít nhất 5 câu hỏi.', 'Tạo link Chia sẻ của chính hội thoại Paraphrase.'] },
  { key: 'speaking', title: 'Luyện full câu Speaking', url: 'https://ducizone.short.gy/freestyle', lead: 'Luyện đủ 3 câu Speaking trong một hội thoại.', steps: ['Yêu cầu ChatGPT hỏi một câu; nếu cần, hỏi thêm câu phụ hoặc xin gợi ý ý tưởng và từ vựng.', 'Trả lời và xem ChatGPT nhận xét, sửa lỗi, nâng cấp câu trả lời.', 'Nói lại câu trả lời hoàn chỉnh sau góp ý. Lặp lại với hai câu hỏi khác.', 'Tạo link Chia sẻ riêng của hội thoại Full Speaking.'] },
];
const state = { studentRef: '', accessToken: '', assignment: null, links: new Map(), practice: [], doctor: null, expanded: false, extraPending: false, localFeedback: new Map(), pending: new Set(), submitted: false, finishing: false };

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
    throw error;
  }
  return data;
  } finally {
    state.requestCount -= 1;
    changeButton.disabled = state.requestCount > 0;
  }
}

function identity() { return { accessToken: state.accessToken, studentRef: state.studentRef }; }
function draftKey() { return `speaking-homework:lesson-2:${classCode}:${documentId}:${state.studentRef}`; }
function saveDraft() {
  if (!state.studentRef) return;
  try {
    localStorage.setItem(draftKey(), JSON.stringify(Object.fromEntries(parts.map(part => [part.key, $(`${part.key}-link`).value]))));
  } catch { $('draft-status').textContent = 'Không lưu được link đang gõ trên thiết bị này; hãy giữ link trước khi rời trang.'; }
}
function restoreDraft() {
  try {
    // Bản cũ chỉ mở trực tiếp IC2304. Khôi phục link cũ đúng ngữ cảnh đó; lớp khác/CTA không dùng chung draft.
    const raw = localStorage.getItem(draftKey())
      || (!originalDocumentId && classCode === 'IC2304' ? localStorage.getItem(`speaking-homework:lesson-2:${state.studentRef}`) : null);
    const draft = JSON.parse(raw || '{}');
    for (const part of parts) if (typeof draft[part.key] === 'string') $(`${part.key}-link`).value = draft[part.key];
  } catch { $('draft-status').textContent = 'Không đọc được link đang gõ; các link đã xác nhận vẫn ở trên máy chủ.'; }
}
function setStatus(key, label, kind = '') {
  const el = $(`${key}-status`);
  el.textContent = label;
  el.className = `task-status${kind ? ` is-${kind}` : ''}`;
}
function showResult(key, kind, title, message) {
  const el = $(`${key}-result`);
  const strong = document.createElement('strong'); strong.textContent = title;
  const span = document.createElement('span'); span.textContent = message;
  el.replaceChildren(strong, span);
  el.className = `check-result is-${kind}`;
  el.hidden = false;
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
  if (link.check_code === 'SHARE_UNAVAILABLE' || link.check_code === 'SHARE_CONTENT_INVALID') return 'Người khác chưa mở được hội thoại này. Hãy tạo lại link ChatGPT Share rồi xác nhận.';
  if (link.check_code === 'CHECK_SERVICE_UNAVAILABLE') return 'Bộ kiểm đang gặp lỗi. Bài chưa được nhận; hãy xác nhận lại sau hoặc báo giảng viên.';
  if (link.check_code === 'REUSED_CONVERSATION') return 'Hội thoại này đã dùng ở bài khác trong khóa. Hãy tạo hội thoại mới.';
  if (link.check_code === 'MISSING_CLARIFICATION_CATEGORY') return 'Cấp 1 cần có đủ Danh từ, Động từ và Tính từ.';
  if (link.check_code === 'INSUFFICIENT_PRACTICE') return `Hội thoại chưa đủ số câu hoặc các bước luyện của ${part.title}. Hãy luyện thêm rồi tạo link Chia sẻ mới.`;
  return 'Link này chưa đạt yêu cầu. Hãy xem lại hội thoại và thử lại.';
}

function renderLinks() {
  for (const part of parts) {
    const link = state.links.get(part.key);
    const input = $(`${part.key}-link`);
    if (!input.value && link?.share_url) input.value = link.share_url;
    const changed = link && input.value.trim() !== link.share_url;
    const localFeedback = state.localFeedback.get(part.key);
    if (localFeedback && input.value.trim() !== localFeedback.value) state.localFeedback.delete(part.key);
    input.disabled = state.submitted;
    $(`${part.key}-confirm`).disabled = state.submitted || state.pending.has(part.key);
    if (state.submitted || (link?.check_status === 'accepted' && !changed)) {
      if (link?.typing_warning && !link.voice_confirmed && !state.submitted) {
        const details = [link.typing_warning.summary, ...(link.typing_warning.evidence || [])].filter(Boolean).join(' ');
        showResult(part.key, 'warning', 'Cần xác nhận cách luyện nói', details || 'Hệ thống thấy dấu hiệu cần hỏi thêm về cách bạn luyện nói.');
      } else {
        showResult(part.key, 'pass', 'Đã xác nhận hội thoại', `Đã kiểm được ${link?.question_count ?? 'đủ'} câu/lượt luyện cho phần này.`);
      }
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
  const needsVoice = parts.some(part => {
    const link = state.links.get(part.key);
    return link?.check_status === 'accepted' && link.typing_warning && !link.voice_confirmed
      && $(`${part.key}-link`).value.trim() === link.share_url;
  }) && !state.submitted;
  $('voice-confirmation').hidden = !needsVoice;
  $('voice-continue').disabled = !$('voice-checkbox').checked;
  const confirmed = state.submitted ? parts.length : parts.filter(part => {
    const link = state.links.get(part.key);
    return link?.check_status === 'accepted'
      && $(`${part.key}-link`).value.trim() === link.share_url
      && (!link.typing_warning || link.voice_confirmed || $('voice-checkbox').checked);
  }).length;
  $('progress-count').textContent = `Đã xác nhận ${confirmed}/${parts.length} phần`;
  $('progress-bar').setAttribute('aria-valuenow', String(confirmed));
  $('progress-fill').style.width = `${confirmed * 100 / parts.length}%`;
  if (state.submitted) {
    $('completion-card').hidden = false;
    $('completion-message').textContent = 'Biên nhận đã lưu trong hệ thống. Bạn có thể quay lại file Homework để làm tiếp.';
  }
  $('completion-card').hidden = !state.submitted;
  renderDoctor();
}

// Dữ liệu vào: danh sách Bác sĩ AI và bài đã luyện của đúng học viên.
// Việc chính: hiện 5 bài đầu, cho mở rộng và chỉ mở ô luyện thêm sau khi có biên nhận.
// Kết quả: bài vừa luyện được phân tích rồi cập nhật thứ tự ở lượt tải tiếp theo.
function renderDoctor() {
  const doctor = state.doctor;
  if (!doctor) return;
  const list = $('doctor-list');
  list.replaceChildren();
  const needed = state.expanded ? doctor.allNeeded : doctor.needed;
  if (!needed.length) {
    const empty = document.createElement('li');
    empty.textContent = doctor.personalCount ? 'Hiện không có bài đang chờ luyện.' : 'Danh sách sẽ hiện sau khi hệ thống phân tích bài Speaking.';
    list.append(empty);
  }
  for (const item of needed) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.exercise_url;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = item.title;
    const detail = document.createElement('small');
    detail.textContent = `Đề xuất ${item.recommendation_count} lần · đã luyện ${item.practice_count} lần`;
    li.append(link, detail); list.append(li);
  }
  $('doctor-sync').textContent = `Đang chờ luyện: ${doctor.neededCount} bài`;
  $('doctor-expand').hidden = doctor.neededCount <= 5;
  $('doctor-expand').textContent = state.expanded ? 'Thu gọn còn 5 bài đầu' : `Xem tất cả ${doctor.neededCount} bài`;
  const choices = [...doctor.allNeeded, ...doctor.practiced];
  const select = $('extra-exercise');
  const selected = select.value;
  select.replaceChildren(new Option('Chọn bài luyện tập', ''));
  for (const item of choices) select.add(new Option(item.title, item.exercise_id));
  if (choices.some(item => item.exercise_id === selected)) select.value = selected;
  $('extra-practice').hidden = !state.submitted;
  $('extra-confirm').disabled = state.extraPending || !choices.length
    || state.practice.some(item => item.status === 'pending' || item.status === 'needs_voice_confirmation');
  const chosen = choices.find(item => item.exercise_id === select.value);
  $('extra-open').hidden = !chosen;
  if (chosen) $('extra-open').href = chosen.exercise_url;
  const history = $('extra-history'); history.replaceChildren();
  for (const item of state.practice) {
    const li = document.createElement('li');
    li.textContent = `Bài luyện ${item.slot}: ${item.status === 'accepted' ? (item.analysis_status === 'done' ? 'đã phân tích' : 'đang phân tích') : item.status === 'pending' ? 'đang kiểm tra' : item.status === 'needs_voice_confirmation' ? 'cần xác nhận đã nói' : 'chưa đạt'}`;
    history.append(li);
  }
  const last = state.practice.at(-1);
  $('extra-voice-confirm').hidden = last?.status !== 'needs_voice_confirmation';
  if (last?.status === 'accepted' && $('extra-link').value.trim() === last.share_url) {
    $('extra-link').value = '';
    const result = $('extra-result');
    result.textContent = last.analysis_status === 'done' ? 'Đã phân tích và cập nhật danh sách cá nhân.' : 'Đã nhận bài, đang phân tích lỗi.';
    result.className = 'check-result is-pass'; result.hidden = false;
  }
}

async function refresh() {
  if (!state.accessToken) return;
  const token = state.accessToken;
  const [data, doctor] = await Promise.all([post('/open', identity()), post('/doctor/list', identity())]);
  if (token !== state.accessToken) return;
  state.links = new Map((data.links || []).map(link => [link.part, link]));
  state.practice = data.practiceLinks || [];
  state.doctor = doctor;
  state.submitted = data.status === 'submitted' && Boolean(data.receipt?.id);
  renderLinks();
  if (!state.submitted && allAccepted()) await finish();
  poller.settled();
}
function allAccepted() {
  return parts.every(part => {
    const link = state.links.get(part.key);
    return link?.check_status === 'accepted' && $(`${part.key}-link`).value.trim() === link.share_url
      && (!link.typing_warning || link.voice_confirmed || $('voice-checkbox').checked);
  });
}

async function finish() {
  if (state.submitted || state.finishing || !allAccepted()) return;
  state.finishing = true;
  try {
    const voiceConfirmedParts = parts.filter(part => state.links.get(part.key)?.typing_warning).map(part => part.key);
    const response = await post('/finish', { ...identity(), voiceConfirmedParts }, 30_000);
    if (!response.receipt?.id) throw new Error('Máy chủ chưa trả biên nhận.');
    state.submitted = true;
    renderLinks();
    $('completion-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    $('draft-status').textContent = `Chưa nộp xong: ${error.message} Tiến trình đã xác nhận vẫn được giữ.`;
  } finally { state.finishing = false; }
}

const container = $('parts');
for (const [index, part] of parts.entries()) {
  const section = document.createElement('section');
  section.className = 'task-card';
  section.id = `${part.key}-card`;
  section.innerHTML = `<div class="task-header"><div class="task-number">${String(index + 1).padStart(2, '0')}</div><div><span class="section-kicker">PHẦN ${index + 1}</span><h2>${part.title}</h2></div><span class="task-status" id="${part.key}-status">Chưa kiểm tra</span></div><div class="task-body"><div class="instructions"><p class="instruction-lead">${part.lead}</p><ol>${part.steps.map(step => `<li>${step}</li>`).join('')}</ol>${part.key === 'freestyle' ? '<p class="voice-note">Trên điện thoại hãy dùng nút micro để nói; sau khi nhận góp ý, nói lại câu trả lời đầy đủ.</p>' : ''}</div><div class="submission-panel">${index === 0 ? '<button id="open-share-guide" class="button button-outline guide-button" type="button">Xem hướng dẫn lấy link có hình minh họa <span aria-hidden="true">?</span></button>' : ''}<a class="button button-primary practice-button" href="${part.url}" target="_blank" rel="noopener noreferrer">Mở bài luyện ${part.title} <span aria-hidden="true">↗</span></a><label for="${part.key}-link">Link luyện tập ${part.title}</label><input id="${part.key}-link" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://chatgpt.com/share/..."><p class="field-hint">Dán link Chia sẻ rồi bấm Xác nhận. Hệ thống sẽ đọc hội thoại và kiểm khối lượng luyện.</p><button id="${part.key}-confirm" class="button button-primary confirm-button" type="button">Xác nhận link ${part.title} <span aria-hidden="true">→</span></button><div id="${part.key}-result" class="check-result" role="status" aria-live="polite" hidden></div>${part.key === 'freestyle' ? '<div id="voice-confirmation" class="voice-confirmation" hidden><label class="checkbox-line"><input id="voice-checkbox" type="checkbox"> Tôi đã voice chat chứ không phải gõ câu trả lời</label><button id="voice-continue" class="button button-outline" type="button" disabled>Xác nhận để nộp</button></div>' : ''}</div></div>`;
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
  $(`${part.key}-link`).addEventListener('input', () => { saveDraft(); renderLinks(); });
  $(`${part.key}-confirm`).addEventListener('click', async () => {
    if (!state.accessToken || state.pending.has(part.key) || state.submitted) return;
    const parsed = parseShareUrl($(`${part.key}-link`).value);
    if (!parsed.ok) { showLocalFeedback(part.key, 'Link chưa đúng', parsed.reason); return; }
    $(`${part.key}-link`).value = parsed.url;
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
    finally { poller.update(); state.pending.delete(part.key); $(`${part.key}-confirm`).disabled = false; }
  });
}
$('voice-checkbox').addEventListener('change', () => {
  $('voice-continue').disabled = !$('voice-checkbox').checked;
  renderLinks();
});
$('voice-continue').addEventListener('click', finish);
$('doctor-expand').addEventListener('click', () => { state.expanded = !state.expanded; renderDoctor(); });
$('extra-exercise').addEventListener('change', renderDoctor);
$('extra-confirm').addEventListener('click', async () => {
  if (!state.submitted || !state.accessToken || state.extraPending) return;
  const exerciseId = $('extra-exercise').value;
  const parsed = parseShareUrl($('extra-link').value);
  const result = $('extra-result');
  if (!exerciseId || !parsed.ok) {
    result.textContent = exerciseId ? parsed.reason : 'Hãy chọn một bài trong danh sách cá nhân.';
    result.className = 'check-result is-blocked'; result.hidden = false; return;
  }
  state.extraPending = true; renderDoctor();
  try {
    $('extra-link').value = parsed.url;
    poller.expect();
    await post('/doctor/practice/extra/request', { ...identity(), exerciseId, url: parsed.url });
    result.textContent = 'Đã gửi bài luyện, đang kiểm tra hội thoại.';
    result.className = 'check-result is-loading'; result.hidden = false;
    await refresh();
  } catch (error) {
    result.textContent = error.message; result.className = 'check-result is-blocked'; result.hidden = false;
  } finally { poller.update(); state.extraPending = false; renderDoctor(); }
});
$('extra-voice-confirm').addEventListener('click', async () => {
  const last = state.practice.at(-1);
  if (last?.status !== 'needs_voice_confirmation') return;
  try { await post('/doctor/practice/confirm-voice', { ...identity(), linkId: last.id }); await refresh(); }
  catch (error) { $('extra-result').textContent = error.message; $('extra-result').hidden = false; }
});
// Chỉ tự tải khi máy chủ đang kiểm/phân tích; lỗi mạng tăng thời gian chờ.
const poller = createPendingPoller({
  refresh,
  hasSession: () => Boolean(state.accessToken),
  isPending: () => (!state.submitted && allAccepted()) || [...state.links.values()].some(link => link.check_status === 'pending' || ['pending', 'queued', 'running', 'processing'].includes(link.analysis_status))
    || state.practice.some(link => link.status === 'pending' || ['pending', 'queued', 'running', 'processing'].includes(link.analysis_status)),
  onError: () => { $('draft-status').textContent = 'Tạm mất kết nối; các link đã gửi vẫn được giữ. Trang sẽ tự thử lại.'; },
});

// Nhận lớp/tên đã xác nhận và phiên máy chủ; giữ đích Docs trong suốt lượt làm.
const identityController = createSpeakingIdentity({
  apiBase, identityBase, assignmentCode, lessonNumber: 2, originalDocumentId, classHint,
  validateAssignment: assignment => assignment.parts?.length === 2,
  async onOpened(context) {
    state.studentRef = context.studentRef;
    state.accessToken = context.session.accessToken;
    state.assignment = context.assignment;
    documentId = context.documentId;
    classCode = context.classCode;
    restoreDraft();
    $('return-homework').href = `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit?tab=t.0`;
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
    state.studentRef = ''; state.accessToken = ''; documentId = '';
    state.links.clear(); state.practice = []; state.doctor = null; state.expanded = false; state.submitted = false;
    state.localFeedback.clear();
    $('completion-card').hidden = true;
    $('extra-practice').hidden = true;
    $('doctor-list').replaceChildren(); $('doctor-sync').textContent = 'Đang tải danh sách…';
    $('extra-link').value = ''; $('extra-result').hidden = true;
    for (const part of parts) { $(`${part.key}-link`).value = ''; $(`${part.key}-result`).hidden = true; setStatus(part.key, 'Chưa kiểm tra'); }
    state.pending.clear(); state.finishing = false;
    if ('extraPending' in state) state.extraPending = false;
    documentId = ''; classCode = '';
    $('draft-status').textContent = '';
    if ($('voice-checkbox')) $('voice-checkbox').checked = false;
    for (const part of parts) if ($(`${part.key}-voice`)) $(`${part.key}-voice`).checked = false;
  },
});
window.addEventListener('beforeunload', event => {
  if (!state.studentRef || state.submitted) return;
  saveDraft(); event.preventDefault(); event.returnValue = '';
});
identityController.start();