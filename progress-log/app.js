/*
 * Dữ liệu nhận vào: token phiếu trong URL fragment, danh sách lớp và FormDefinitionV1 từ API.
 * Xử lý: học viên xác nhận tên, trả lời từng checkpoint, lưu draft có revision và nộp idempotent.
 * Kết quả: màn hình xác nhận server đã nhận bài và trạng thái điểm danh; token không nằm trong query/log GitHub Pages.
 * Khi lỗi: câu trả lời vẫn ở sessionStorage của tab này, thông báo rõ và không tự coi là đã điểm danh.
 */

const config = window.PROGRESS_LOG_CONFIG || {};
const state = {
  publicToken: '',
  assignment: null,
  selectedStudent: null,
  attempt: null,
  responses: {},
  checkpointIndex: 0,
  changeVersion: 0,
  savedVersion: 0,
  idleTimer: 0,
  maxTimer: 0,
  saveChain: Promise.resolve(),
  submitting: false
};

const viewIds = ['identityView', 'confirmView', 'formView', 'resultView', 'errorView'];
const elements = Object.fromEntries([
  'notice', ...viewIds, 'sessionLabel', 'assignmentTitle', 'classLabel', 'studentSelect',
  'chooseStudentButton', 'confirmName', 'confirmContext', 'confirmButton', 'backToNamesButton',
  'studentNameLabel', 'formContextLabel', 'saveState', 'progressBar', 'reflectionForm',
  'checkpointLabel', 'checkpointTitle', 'checkpointInstructions', 'questionList', 'previousButton',
  'nextButton', 'submitButton', 'resultTitle', 'attendanceResult', 'completenessResult',
  'nextActionResult', 'errorTitle', 'errorMessage', 'retryButton'
].map(id => [id, document.getElementById(id)]));

function showView(id) {
  for (const viewId of viewIds) elements[viewId].hidden = viewId !== id;
}

function setNotice(message = '', kind = '') {
  elements.notice.textContent = message;
  elements.notice.className = `notice${kind ? ` ${kind}` : ''}`;
}

function fail(title, message) {
  elements.errorTitle.textContent = title;
  elements.errorMessage.textContent = message;
  setNotice('', '');
  showView('errorView');
}

function readPublicToken() {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = fragment.get('assignment') || '';
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(token) ? token : '';
}

async function apiRequest(path, { method = 'POST', body } = {}) {
  if (!config.API_BASE_URL) throw new Error('Trang chưa được cấu hình địa chỉ API.');
  const response = await fetch(`${config.API_BASE_URL}/api/learning${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.message || `Hệ thống trả về mã ${response.status}.`);
    error.code = payload?.error || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return payload;
}

function draftStorageKey() {
  return state.assignment && state.selectedStudent
    ? `progress-log:draft:${state.assignment.assignmentId}:${state.selectedStudent.studentRef}`
    : '';
}

function storeLocalDraft() {
  const key = draftStorageKey();
  if (!key) return;
  const payload = {
    definitionHash: state.assignment.definitionHash,
    serverRevisionAtChange: state.attempt?.draftRevision || 0,
    responses: state.responses,
    expiresAt: Date.now() + 12 * 60 * 60 * 1000
  };
  sessionStorage.setItem(key, JSON.stringify(payload));
}

function readLocalDraft(serverRevision) {
  const key = draftStorageKey();
  if (!key) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!value || value.expiresAt < Date.now() || value.definitionHash !== state.assignment.definitionHash) {
      sessionStorage.removeItem(key);
      return null;
    }
    if (!Number.isInteger(value.serverRevisionAtChange) || value.serverRevisionAtChange < serverRevision) return null;
    return value.responses && typeof value.responses === 'object' && !Array.isArray(value.responses)
      ? value.responses
      : null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function clearLocalDraft() {
  const key = draftStorageKey();
  if (key) sessionStorage.removeItem(key);
}

function setSaveState(label, kind = '') {
  elements.saveState.textContent = label;
  elements.saveState.className = `save-state${kind ? ` ${kind}` : ''}`;
}

function scheduleSave() {
  storeLocalDraft();
  setSaveState('Đang ghi nhận…');
  window.clearTimeout(state.idleTimer);
  state.idleTimer = window.setTimeout(() => void flushDraft(), 2_000 + Math.floor(Math.random() * 1_000));
  if (!state.maxTimer) state.maxTimer = window.setTimeout(() => void flushDraft(), 15_000);
}

function clearSaveTimers() {
  window.clearTimeout(state.idleTimer);
  window.clearTimeout(state.maxTimer);
  state.idleTimer = 0;
  state.maxTimer = 0;
}

function flushDraft() {
  clearSaveTimers();
  if (!state.attempt || state.savedVersion === state.changeVersion) return state.saveChain;
  const requestedVersion = state.changeVersion;
  state.saveChain = state.saveChain.then(async () => {
    const revision = state.attempt.draftRevision + 1;
    const payload = await apiRequest('/attempts/draft', {
      method: 'PATCH',
      body: {
        attemptToken: state.attempt.attemptToken,
        revision,
        definitionHash: state.assignment.definitionHash,
        responses: state.responses
      }
    });
    state.attempt.draftRevision = Number(payload.draft.revision);
    state.savedVersion = requestedVersion;
    setSaveState(state.savedVersion === state.changeVersion ? 'Đã lưu' : 'Có thay đổi mới', 'saved');
    if (state.savedVersion !== state.changeVersion) scheduleSave();
  }).catch(error => {
    setSaveState('Chưa lưu — vẫn còn trên máy');
    setNotice(error.message, 'error');
  });
  return state.saveChain;
}

function allBlocks() {
  return state.assignment?.definition?.blocks || [];
}

function allItems() {
  return allBlocks().flatMap(block => block.items || []);
}

function currentBlock() {
  return allBlocks()[state.checkpointIndex];
}

function displayStudent(student) {
  return student.discriminator ? `${student.name} · ${student.discriminator}` : student.name;
}

function responseFor(item) {
  return state.responses[item.itemVersionId] ?? '';
}

function recordResponse(itemId, value) {
  state.responses[itemId] = value;
  state.changeVersion += 1;
  scheduleSave();
}

function buildChoice(item, option, inputType) {
  const label = document.createElement('label');
  label.className = 'choice';
  const input = document.createElement('input');
  input.type = inputType;
  input.name = item.itemVersionId;
  input.value = option.id;
  input.checked = inputType === 'radio'
    ? responseFor(item) === option.id
    : Array.isArray(responseFor(item)) && responseFor(item).includes(option.id);
  input.addEventListener('change', () => {
    if (inputType === 'radio') recordResponse(item.itemVersionId, input.value);
    else {
      const selected = [...label.parentElement.querySelectorAll('input:checked')].map(node => node.value);
      recordResponse(item.itemVersionId, selected);
    }
  });
  const text = document.createElement('span');
  text.textContent = option.label;
  label.append(input, text);
  return label;
}

function buildQuestion(item) {
  const wrapper = document.createElement(item.interactionType.includes('choice') ? 'fieldset' : 'div');
  wrapper.className = 'question';
  const label = document.createElement(item.interactionType.includes('choice') ? 'legend' : 'label');
  label.textContent = item.prompt;
  if (item.required) {
    const required = document.createElement('span');
    required.className = 'required';
    required.textContent = ' *';
    label.append(required);
  }
  wrapper.append(label);
  if (item.helpText) {
    const help = document.createElement('p');
    help.className = 'help';
    help.textContent = item.helpText;
    wrapper.append(help);
  }
  if (item.interactionType === 'short_text' || item.interactionType === 'long_text') {
    const input = document.createElement(item.interactionType === 'long_text' ? 'textarea' : 'input');
    if (input instanceof HTMLInputElement) input.type = 'text';
    input.value = String(responseFor(item));
    input.maxLength = item.interactionType === 'long_text' ? 12_000 : 2_000;
    input.setAttribute('aria-label', item.prompt);
    input.addEventListener('input', () => recordResponse(item.itemVersionId, input.value));
    wrapper.append(input);
  } else {
    const choices = document.createElement('div');
    choices.className = 'choice-list';
    const inputType = item.interactionType === 'multi_choice_group' && item.graderType !== 'unordered_group_slot'
      ? 'checkbox'
      : 'radio';
    choices.append(...item.options.map(option => buildChoice(item, option, inputType)));
    wrapper.append(choices);
  }
  return wrapper;
}

function blockIsComplete(block) {
  return block.items.every(item => {
    if (!item.required) return true;
    const value = responseFor(item);
    return Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0;
  });
}

function renderCheckpoint() {
  const blocks = allBlocks();
  const block = currentBlock();
  if (!block) return;
  elements.checkpointLabel.textContent = `GHI NHANH ${state.checkpointIndex + 1}/${blocks.length}`;
  elements.checkpointTitle.textContent = block.title;
  elements.checkpointInstructions.textContent = block.instructions || '';
  elements.checkpointInstructions.hidden = !block.instructions;
  elements.questionList.replaceChildren(...block.items.map(buildQuestion));
  elements.previousButton.hidden = state.checkpointIndex === 0;
  elements.nextButton.hidden = state.checkpointIndex === blocks.length - 1;
  elements.submitButton.hidden = state.checkpointIndex !== blocks.length - 1;
  elements.progressBar.style.width = `${((state.checkpointIndex + 1) / blocks.length) * 100}%`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentBlock() {
  if (blockIsComplete(currentBlock())) return true;
  setNotice('Bạn hãy điền đủ các mục có dấu * trước khi tiếp tục.', 'error');
  const firstEmpty = elements.questionList.querySelector('textarea:invalid, input:invalid, textarea, input');
  firstEmpty?.focus();
  return false;
}

async function openAssignment() {
  state.publicToken = readPublicToken();
  if (!state.publicToken) {
    fail('Đường dẫn chưa đúng', 'Link cần có mã phiếu sau dấu #. Hãy mở lại link giảng viên đã gửi.');
    return;
  }
  try {
    setNotice('Đang mở phiếu…');
    const payload = await apiRequest('/assignments/open', { body: { publicToken: state.publicToken } });
    state.assignment = payload.assignment;
    elements.sessionLabel.textContent = `BUỔI ${state.assignment.sessionNumber}`;
    elements.assignmentTitle.textContent = state.assignment.title;
    elements.classLabel.textContent = state.assignment.class.name;
    const options = state.assignment.roster.map(student => {
      const option = document.createElement('option');
      option.value = student.studentRef;
      option.textContent = displayStudent(student);
      return option;
    });
    elements.studentSelect.replaceChildren(new Option('Chọn tên của bạn', ''), ...options);
    elements.chooseStudentButton.disabled = true;
    setNotice('Chọn đúng tên để bắt đầu.');
    showView('identityView');
  } catch (error) {
    fail('Phiếu chưa sẵn sàng', error.message);
  }
}

async function startAttempt() {
  try {
    elements.confirmButton.disabled = true;
    setNotice('Đang mở phần ghi nhận…');
    const payload = await apiRequest('/attempts/start', {
      body: {
        publicToken: state.publicToken,
        studentRef: state.selectedStudent.studentRef,
        clientIdempotencyKey: crypto.randomUUID(),
        identityConfirmed: true
      }
    });
    state.attempt = payload.attempt;
    state.responses = readLocalDraft(state.attempt.draftRevision) || state.attempt.draft || {};
    state.changeVersion = 0;
    state.savedVersion = 0;
    elements.studentNameLabel.textContent = state.attempt.identity.studentName;
    elements.formContextLabel.textContent = `${state.attempt.identity.className} · Buổi ${state.attempt.identity.sessionNumber}`;
    setSaveState(state.attempt.draftRevision ? 'Đã khôi phục bản lưu' : 'Chưa có thay đổi', state.attempt.draftRevision ? 'saved' : '');
    setNotice('Bạn có thể điền mỗi phần ngay sau hoạt động tương ứng.');
    state.checkpointIndex = 0;
    renderCheckpoint();
    showView('formView');
  } catch (error) {
    setNotice(error.message, 'error');
    elements.confirmButton.disabled = false;
  }
}

async function submitForm(event) {
  event.preventDefault();
  if (!validateCurrentBlock() || state.submitting) return;
  const missing = allItems().filter(item => item.required && !String(responseFor(item)).trim());
  if (missing.length) {
    const target = allBlocks().findIndex(block => block.items.some(item => missing.includes(item)));
    state.checkpointIndex = Math.max(0, target);
    renderCheckpoint();
    setNotice(`Phiếu còn thiếu ${missing.length} mục bắt buộc.`, 'error');
    return;
  }
  state.submitting = true;
  elements.submitButton.disabled = true;
  setNotice('Đang nộp phiếu…');
  clearSaveTimers();
  try {
    await flushDraft();
    const payload = await apiRequest('/attempts/submit', {
      body: {
        attemptToken: state.attempt.attemptToken,
        submissionId: crypto.randomUUID(),
        definitionHash: state.assignment.definitionHash,
        draftRevision: state.attempt.draftRevision,
        responses: state.responses
      }
    });
    clearLocalDraft();
    const receipt = payload.receipt;
    elements.resultTitle.textContent = receipt.message;
    elements.attendanceResult.textContent = receipt.attendanceStatus === 'self_confirmed'
      ? 'Đã tự động ghi nhận'
      : 'Chờ giảng viên xác nhận';
    elements.completenessResult.textContent = receipt.completeness === 'complete' ? 'Đã đủ nội dung' : 'Còn thiếu mục bắt buộc';
    elements.nextActionResult.textContent = receipt.nextAction;
    setNotice('Hoàn tất. Bạn có thể đóng trang này.');
    showView('resultView');
  } catch (error) {
    state.submitting = false;
    elements.submitButton.disabled = false;
    setNotice(`${error.message} Chưa có xác nhận điểm danh.`, 'error');
  }
}

elements.studentSelect.addEventListener('change', () => {
  state.selectedStudent = state.assignment.roster.find(student => student.studentRef === elements.studentSelect.value) || null;
  elements.chooseStudentButton.disabled = !state.selectedStudent;
});

elements.chooseStudentButton.addEventListener('click', () => {
  if (!state.selectedStudent) return;
  elements.confirmName.textContent = displayStudent(state.selectedStudent);
  elements.confirmContext.textContent = `${state.assignment.class.name} · Buổi ${state.assignment.sessionNumber}`;
  elements.confirmButton.disabled = false;
  setNotice('Kiểm tra kỹ trước khi xác nhận.');
  showView('confirmView');
});

elements.backToNamesButton.addEventListener('click', () => showView('identityView'));
elements.confirmButton.addEventListener('click', () => void startAttempt());
elements.previousButton.addEventListener('click', () => {
  state.checkpointIndex = Math.max(0, state.checkpointIndex - 1);
  setNotice('');
  renderCheckpoint();
});
elements.nextButton.addEventListener('click', () => {
  if (!validateCurrentBlock()) return;
  state.checkpointIndex = Math.min(allBlocks().length - 1, state.checkpointIndex + 1);
  setNotice('Nội dung của phần trước đã được giữ lại.');
  renderCheckpoint();
});
elements.reflectionForm.addEventListener('submit', event => void submitForm(event));
elements.retryButton.addEventListener('click', () => void openAssignment());
window.addEventListener('pagehide', () => {
  storeLocalDraft();
  clearSaveTimers();
});

void openAssignment();
