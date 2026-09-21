import { allowedGroup, memoryKey, officialStudent, readMemory, resolveRememberedStudent,
  writeMemory } from '../shared/student-memory.js?v=20260905-memory-v3';

/*
 * Dữ liệu nhận vào: token phiếu trong URL fragment, danh sách lớp và FormDefinitionV1 từ API.
 * Xử lý: học viên xác nhận tên, trả lời từng checkpoint, lưu draft có revision và nộp idempotent.
 * Kết quả: màn hình xác nhận server đã nhận bài và trạng thái điểm danh; token không nằm trong query/log GitHub Pages.
 * Khi lỗi: câu trả lời vẫn ở sessionStorage của tab này, thông báo rõ và không tự coi là đã điểm danh.
 */

const config = window.PROGRESS_LOG_CONFIG || {};
const AUTOSAVE_IDLE_MIN_MS = 5_000;
const AUTOSAVE_IDLE_MAX_MS = 12_000;
const AUTOSAVE_FORCE_MIN_MS = 25_000;
const AUTOSAVE_FORCE_MAX_MS = 45_000;
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
  checkpointSubmissions: new Map(),
  submitting: false,
  confirmedStudent: null,
  startingAttempt: false
};

const viewIds = ['identityView', 'confirmView', 'formView', 'resultView', 'errorView'];
const elements = Object.fromEntries([
  'notice', ...viewIds, 'sessionLabel', 'assignmentTitle', 'classLabel', 'studentSelect',
  'chooseStudentButton', 'rememberStudentRow', 'rememberStudent', 'rememberStudentStatus', 'changeRememberedStudent',
  'confirmName', 'confirmContext', 'confirmButton', 'backToNamesButton',
  'studentNameLabel', 'formContextLabel', 'saveState', 'progressBar', 'reflectionForm',
  'checkpointLabel', 'checkpointTitle', 'checkpointInstructions', 'questionList', 'previousButton',
  'nextButton', 'submitButton', 'resultTitle', 'attendanceResult', 'completenessResult',
  'errorTitle', 'errorMessage', 'retryButton'
].map(id => [id, document.getElementById(id)]));

const studentMemory = {
  key: '', storage: null, group: null, busy: false, preference: true, enabled: false, installed: false
};

function progressRosterGroup() {
  if (!state.assignment) return null;
  return {
    classRef: state.assignment.class?.classRef || state.assignment.class?.classId || state.assignment.class?.id || state.assignment.class?.name || '',
    className: state.assignment.class?.name || '',
    students: state.assignment.roster || []
  };
}

function memoryStatus(message = '') {
  elements.rememberStudentStatus.textContent = message;
}

function syncStudentMemoryControls() {
  const selected = state.selectedStudent;
  const nonOfficial = Boolean(selected) && !officialStudent(selected);
  elements.rememberStudentRow.hidden = !studentMemory.enabled;
  elements.rememberStudent.disabled = !studentMemory.storage || nonOfficial;
  elements.rememberStudent.checked = studentMemory.preference && !nonOfficial;
  const remembered = readMemory(studentMemory.storage, studentMemory.key);
  elements.changeRememberedStudent.hidden = !studentMemory.enabled || (!selected && !remembered.studentRef);
  if (!studentMemory.enabled) return;
  if (!studentMemory.storage) memoryStatus('Trình duyệt chưa lưu được lựa chọn. Bạn vẫn có thể chọn và làm phiếu.');
  else if (nonOfficial) memoryStatus('Hồ sơ này chỉ dùng trong phiếu hiện tại và không được ghi nhớ.');
  else if (!elements.rememberStudentStatus.textContent) memoryStatus('Bỏ tick nếu dùng máy chung. Bạn vẫn cần xác nhận tên trước khi mở phiếu.');
}

function applyStudentMemory() {
  if (!studentMemory.enabled || studentMemory.busy || state.attempt) return;
  const remembered = readMemory(studentMemory.storage, studentMemory.key);
  const match = resolveRememberedStudent([studentMemory.group], remembered.studentRef, '', config.STUDENT_MEMORY);
  state.selectedStudent = match?.student || null;
  elements.studentSelect.value = match?.studentRef || '';
  elements.chooseStudentButton.disabled = !state.selectedStudent;
  if (match) memoryStatus('Đã chọn sẵn tên của bạn. Kiểm tra trước khi tiếp tục.');
  else if (remembered.studentRef) memoryStatus('Tên đã nhớ không còn phù hợp với danh sách phiếu này. Hãy chọn lại.');
  else if (remembered.status === 'unavailable') memoryStatus('Trình duyệt chưa đọc được ghi nhớ. Bạn vẫn có thể chọn và làm phiếu.');
  else memoryStatus('Bỏ tick nếu dùng máy chung. Hãy chọn đúng tên trước khi mở phiếu.');
  syncStudentMemoryControls();
}

function clearRememberedSelection() {
  if (studentMemory.busy || state.attempt) return false;
  if (!writeMemory(studentMemory.storage, studentMemory.key, '')) {
    memoryStatus('Không thể xóa ghi nhớ trong trình duyệt. Hãy kiểm tra cài đặt lưu dữ liệu.');
    return false;
  }
  state.selectedStudent = null;
  elements.studentSelect.value = '';
  elements.chooseStudentButton.disabled = true;
  memoryStatus('Đã quên lựa chọn trên thiết bị này. Hãy chọn người học.');
  syncStudentMemoryControls();
  elements.studentSelect.focus();
  return true;
}

function installStudentMemory() {
  studentMemory.group = progressRosterGroup();
  studentMemory.enabled = Boolean(config.STUDENT_MEMORY?.enabled && allowedGroup(studentMemory.group, config.STUDENT_MEMORY));
  if (!studentMemory.enabled) return;
  studentMemory.key = memoryKey(config.API_BASE_URL, location.href);
  try { studentMemory.storage = window.localStorage; } catch { studentMemory.storage = null; }
  if (!studentMemory.installed) {
    elements.rememberStudent.addEventListener('change', () => { studentMemory.preference = elements.rememberStudent.checked; });
    elements.changeRememberedStudent.addEventListener('click', clearRememberedSelection);
    window.addEventListener('storage', event => {
      if (event.storageArea !== studentMemory.storage || (event.key !== studentMemory.key && event.key !== null)) return;
      if (studentMemory.busy || state.attempt || state.submitting) {
        setNotice('Lựa chọn ghi nhớ đã đổi ở tab khác. Phiếu đang mở vẫn thuộc người học hiện tại.', '');
        return;
      }
      applyStudentMemory();
    });
    studentMemory.installed = true;
  }
  applyStudentMemory();
}

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

function randomDelay(minimum, maximum) {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function scheduleSave() {
  storeLocalDraft();
  setSaveState('Đang ghi nhận…');
  window.clearTimeout(state.idleTimer);
  state.idleTimer = window.setTimeout(
    () => void flushDraft(),
    randomDelay(AUTOSAVE_IDLE_MIN_MS, AUTOSAVE_IDLE_MAX_MS)
  );
  if (!state.maxTimer) {
    state.maxTimer = window.setTimeout(
      () => void flushDraft(),
      randomDelay(AUTOSAVE_FORCE_MIN_MS, AUTOSAVE_FORCE_MAX_MS)
    );
  }
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

function itemIsVisible(item) {
  const dependencyId = item.interactionConfig?.visibleWhenItemVersionId;
  if (!dependencyId) return true;
  return state.responses[dependencyId] === item.interactionConfig.visibleWhenValue;
}

function itemIsRequired(item) {
  if (item.required) return true;
  return item.interactionConfig?.requiredWhenVisible === true && itemIsVisible(item);
}

function responseIsPresent(item, value) {
  if (item?.layoutType === 'numbered_short_texts') {
    const expected = Number(item.interactionConfig?.responseCount || 0);
    return Array.isArray(value)
      && value.length === expected
      && value.every(entry => String(entry || '').trim().length > 0);
  }
  if (Array.isArray(value)) return value.some(entry => String(entry || '').trim().length > 0);
  if (value && typeof value === 'object') {
    return Number.isInteger(value.correct) && Number.isInteger(value.total) && value.total > 0;
  }
  return String(value ?? '').trim().length > 0;
}

function recordResponse(itemId, value) {
  if (value === undefined) delete state.responses[itemId];
  else state.responses[itemId] = value;
  state.changeVersion += 1;
  scheduleSave();
}

const SENTENCE_COMPLETION_LAYOUTS = Object.freeze({
  '56000000-0000-4000-8400-000000000004': [
    { title: 'Task Response:', parts: ['Yêu cầu người viết phải trả lời đúng ', ' và ', '.'] },
    { title: 'Coherence and Cohesion:', parts: ['Đảm bảo sự liên kết về ', ' (Coherence) và liên kết về ', ' (Cohesion).'] },
    { title: 'Lexical Resource:', parts: ['Sử dụng từ vựng đảm bảo tính ', ' và ', '.'] },
    { title: 'Grammatical Range and Accuracy:', parts: ['Sử dụng cấu trúc ngữ pháp đảm bảo tính ', ' và ', '.'] }
  ],
  '56000000-0000-4000-8400-000000000006': [
    { title: '', parts: ['', ' và ', '.'] }
  ]
});

const sentenceMeasureContext = document.createElement('canvas').getContext('2d');

function resizeSentenceBlank(control) {
  const sentence = control.closest('.sentence-text, .reasoning-chain');
  const availableWidth = Math.max(90, (sentence?.clientWidth || 420) - 8);
  if (sentenceMeasureContext) {
    sentenceMeasureContext.font = window.getComputedStyle(control).font;
    const textWidth = sentenceMeasureContext.measureText(control.value || ' ').width;
    control.style.width = `${Math.min(availableWidth, Math.max(108, Math.ceil(textWidth) + 24))}px`;
  }
  control.style.height = 'auto';
  control.style.height = `${Math.max(30, control.scrollHeight)}px`;
}

function buildSentenceCompletion(item) {
  const templates = SENTENCE_COMPLETION_LAYOUTS[item.itemVersionId];
  const expected = Number(item.interactionConfig?.responseCount || 0);
  if (!templates || templates.length * 2 !== expected) return null;
  const existing = Array.isArray(responseFor(item)) ? responseFor(item) : [];
  const group = document.createElement('div');
  group.className = 'sentence-group';
  let slot = 0;
  for (const [rowIndex, template] of templates.entries()) {
    const row = document.createElement('div');
    row.className = 'sentence-row';
    if (templates.length > 1) {
      const marker = document.createElement('span');
      marker.className = 'sentence-index';
      marker.textContent = `${rowIndex + 1}.`;
      row.append(marker);
    }
    const sentence = document.createElement('p');
    sentence.className = 'sentence-text';
    if (template.title) {
      const title = document.createElement('strong');
      title.textContent = `${template.title} `;
      sentence.append(title);
    }
    sentence.append(document.createTextNode(template.parts[0]));
    for (let part = 1; part < template.parts.length; part += 1) {
      const input = document.createElement('textarea');
      input.className = 'sentence-blank';
      input.rows = 1;
      input.maxLength = 2_000;
      input.required = itemIsRequired(item);
      input.value = existing[slot] || '';
      input.setAttribute('aria-label', item.interactionConfig.responseLabels?.[slot] || `${item.prompt} — ô ${slot + 1}`);
      input.addEventListener('input', event => {
        if (!event.isComposing) input.value = input.value.replace(/\s*[\r\n]+\s*/g, ' ');
        resizeSentenceBlank(input);
        recordResponse(item.itemVersionId, [...group.querySelectorAll('textarea')].map(control => control.value));
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
      });
      sentence.append(input, document.createTextNode(template.parts[part]));
      slot += 1;
    }
    row.append(sentence);
    group.append(row);
  }
  return group;
}

function buildReasoningChain(item) {
  const config = item.interactionConfig || {};
  const chain = document.createElement('div');
  chain.className = 'reasoning-chain';
  const before = document.createElement('div');
  before.className = 'reasoning-chain-node';
  before.textContent = config.beforeText;
  const firstArrow = document.createElement('span');
  firstArrow.className = 'reasoning-chain-arrow';
  firstArrow.setAttribute('aria-hidden', 'true');
  firstArrow.textContent = '→';
  const input = document.createElement('textarea');
  input.className = 'sentence-blank reasoning-chain-input';
  input.rows = 1;
  input.maxLength = 2_000;
  input.required = itemIsRequired(item);
  input.value = String(responseFor(item));
  input.placeholder = 'Điền mắt xích còn thiếu';
  input.setAttribute('aria-label', item.prompt);
  input.addEventListener('input', event => {
    if (!event.isComposing) input.value = input.value.replace(/\s*[\r\n]+\s*/g, ' ');
    resizeSentenceBlank(input);
    recordResponse(item.itemVersionId, input.value);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
  });
  const secondArrow = firstArrow.cloneNode(true);
  const after = document.createElement('div');
  after.className = 'reasoning-chain-node';
  after.textContent = config.afterText;
  chain.append(before, firstArrow, input, secondArrow, after);
  return chain;
}

function refreshConditionalQuestions() {
  const block = currentBlock();
  if (!block) return;
  let removedHiddenAnswer = false;
  for (const item of block.items.filter(candidate => candidate.layoutType === 'conditional_other_text')) {
    const visible = itemIsVisible(item);
    const wrapper = elements.questionList.querySelector(`[data-item-version-id="${item.itemVersionId}"]`);
    if (wrapper) {
      wrapper.hidden = !visible;
      const requiredNow = visible && item.interactionConfig.requiredWhenVisible === true;
      for (const control of wrapper.querySelectorAll('input, textarea, select')) {
        control.required = requiredNow;
      }
      const marker = wrapper.querySelector('.required');
      if (marker) marker.hidden = !requiredNow;
    }
    if (!visible && Object.hasOwn(state.responses, item.itemVersionId)) {
      delete state.responses[item.itemVersionId];
      removedHiddenAnswer = true;
    }
  }
  if (removedHiddenAnswer) {
    state.changeVersion += 1;
    scheduleSave();
  }
}

function buildChoice(item, option, inputType, optionIndex) {
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
    for (const choice of label.parentElement.querySelectorAll('.choice')) {
      const checked = choice.querySelector('input').checked;
      choice.classList.toggle('selected', checked);
      choice.querySelector('.choice-key').textContent = checked ? '✓' : choice.dataset.key;
    }
    refreshConditionalQuestions();
  });
  const key = document.createElement('span');
  key.className = 'choice-key';
  label.dataset.key = /^[A-Z]$/.test(option.id) ? option.id : String.fromCharCode(65 + optionIndex);
  key.textContent = input.checked ? '✓' : label.dataset.key;
  label.classList.toggle('selected', input.checked);
  const text = document.createElement('span');
  text.className = 'choice-text';
  text.textContent = option.label;
  label.append(input, key, text);
  return label;
}

function buildQuestion(item) {
  const wrapper = document.createElement('div');
  wrapper.className = `question ${item.layoutType || 'plain_prompt'}`;
  wrapper.dataset.itemVersionId = item.itemVersionId;
  wrapper.hidden = !itemIsVisible(item);
  const number = document.createElement('span');
  number.className = 'question-number';
  number.textContent = item.displayNumber || String(item.position);
  const content = document.createElement('div');
  content.className = 'question-content';
  const label = document.createElement('h3');
  label.id = `question-${item.itemVersionId}`;
  label.textContent = item.prompt;
  if (item.required || item.interactionConfig?.requiredWhenVisible === true) {
    const required = document.createElement('span');
    required.className = 'required';
    required.textContent = ' *';
    required.hidden = !itemIsRequired(item);
    label.append(required);
  }
  wrapper.append(number, content);
  content.append(label);
  if (item.helpText) {
    const help = document.createElement('p');
    help.className = 'help';
    help.textContent = item.helpText;
    content.append(help);
  }
  if (item.interactionType === 'number_score') {
    const score = responseFor(item);
    const config = item.interactionConfig || {};
    const row = document.createElement('div');
    row.className = 'number-score';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(config.min ?? 0);
    input.max = String(config.max);
    input.step = String(config.step ?? 1);
    input.required = itemIsRequired(item);
    input.value = score && typeof score === 'object' ? String(score.correct) : '';
    input.setAttribute('aria-label', item.prompt);
    input.addEventListener('input', () => {
      if (input.value === '') recordResponse(item.itemVersionId, undefined);
      else recordResponse(item.itemVersionId, { correct: Number(input.value), total: Number(config.max) });
    });
    const total = document.createElement('b');
    total.textContent = `/ ${config.max} ${config.unit || ''}`.trim();
    row.append(input, total);
    content.append(row);
  } else if (item.layoutType === 'reasoning_chain_completion') {
    content.append(buildReasoningChain(item));
  } else if (item.layoutType === 'numbered_short_texts') {
    const sentence = buildSentenceCompletion(item);
    if (sentence) {
      content.append(sentence);
      return wrapper;
    }
    const count = Number(item.interactionConfig?.responseCount || 0);
    const labels = item.interactionConfig?.responseLabels || [];
    const existing = Array.isArray(responseFor(item)) ? responseFor(item) : [];
    const group = document.createElement('div');
    group.className = 'numbered-text-group';
    for (let index = 0; index < count; index += 1) {
      const row = document.createElement('label');
      row.className = 'numbered-text-row';
      const marker = document.createElement('span');
      marker.textContent = `${index + 1}.`;
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 2_000;
      input.required = itemIsRequired(item);
      input.value = existing[index] || '';
      input.setAttribute('aria-label', labels[index] || `${item.prompt} — ý ${index + 1}`);
      input.placeholder = labels[index] || `Ý ${index + 1}`;
      input.addEventListener('input', () => {
        const values = [...group.querySelectorAll('input')].map(control => control.value);
        recordResponse(item.itemVersionId, values);
      });
      row.append(marker, input);
      group.append(row);
    }
    content.append(group);
  } else if (item.interactionType === 'short_text' || item.interactionType === 'long_text') {
    const input = document.createElement(item.interactionType === 'long_text' ? 'textarea' : 'input');
    if (input instanceof HTMLInputElement) input.type = 'text';
    input.value = String(responseFor(item));
    input.maxLength = item.interactionType === 'long_text' ? 12_000 : 2_000;
    input.required = itemIsRequired(item);
    input.setAttribute('aria-label', item.prompt);
    input.addEventListener('input', () => recordResponse(item.itemVersionId, input.value));
    content.append(input);
  } else {
    const choices = document.createElement('div');
    choices.className = 'choice-list';
    choices.setAttribute('role', item.interactionType === 'single_choice' ? 'radiogroup' : 'group');
    choices.setAttribute('aria-labelledby', label.id);
    const inputType = item.interactionType === 'multi_choice_group' && item.graderType !== 'unordered_group_slot'
      ? 'checkbox'
      : 'radio';
    choices.append(...item.options.map((option, index) => buildChoice(item, option, inputType, index)));
    content.append(choices);
  }
  return wrapper;
}

function blockIsComplete(block) {
  return block.items.every(item => {
    if (!itemIsRequired(item)) return true;
    const value = responseFor(item);
    return responseIsPresent(item, value);
  });
}

function releaseFor(block) {
  return (state.assignment.blockReleases || []).find(item => item.blockId === block.blockId) || null;
}

function blockIsOpen(block) {
  const release = releaseFor(block);
  return !release || release.status === 'open';
}

function renderCheckpoint() {
  const blocks = allBlocks();
  const block = currentBlock();
  if (!block) return;
  const minutes = Number(state.assignment?.definition?.estimatedMinutes || 0);
  elements.checkpointLabel.textContent = `PHẦN ${state.checkpointIndex + 1}/${blocks.length}${minutes ? ` · ${minutes} PHÚT` : ''}`;
  elements.checkpointTitle.textContent = block.title;
  elements.checkpointInstructions.textContent = block.instructions || '';
  elements.checkpointInstructions.hidden = !block.instructions;
  elements.questionList.replaceChildren(...block.items.map(buildQuestion));
  refreshConditionalQuestions();
  window.requestAnimationFrame(() => {
    for (const control of elements.questionList.querySelectorAll('.sentence-blank')) resizeSentenceBlank(control);
  });
  if (state.checkpointSubmissions.has(block.blockId)) {
    for (const control of elements.questionList.querySelectorAll('input, textarea, select')) control.disabled = true;
  }
  elements.previousButton.hidden = state.checkpointIndex === 0;
  elements.nextButton.hidden = state.checkpointIndex === blocks.length - 1;
  elements.submitButton.hidden = state.checkpointIndex !== blocks.length - 1;
  const nextBlock = blocks[state.checkpointIndex + 1];
  if (nextBlock && state.checkpointSubmissions.has(block.blockId) && !blockIsOpen(nextBlock)) {
    elements.nextButton.textContent = 'Kiểm tra phần tiếp theo';
  } else {
    elements.nextButton.textContent = 'Nộp phần và tiếp tục';
  }
  elements.progressBar.style.width = `${((state.checkpointIndex + 1) / blocks.length) * 100}%`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function refreshBlockReleases() {
  const payload = await apiRequest('/assignments/open', { body: { publicToken: state.publicToken } });
  state.assignment.blockReleases = payload.assignment.blockReleases || [];
}

async function submitCurrentCheckpoint() {
  const block = currentBlock();
  if (!blockIsOpen(block)) throw new Error('Phần này chưa được giảng viên mở.');
  await flushDraft();
  const payload = await apiRequest('/attempts/checkpoints/submit', {
    body: {
      attemptToken: state.attempt.attemptToken,
      checkpointSubmissionId: crypto.randomUUID(),
      blockId: block.blockId,
      checkpoint: block.checkpoint,
      draftRevision: state.attempt.draftRevision,
      definitionHash: state.assignment.definitionHash,
      responses: state.responses,
      idempotencyKey: `checkpoint:${state.attempt.attemptToken}:${block.blockId}:v1`
    }
  });
  state.checkpointSubmissions.set(block.blockId, payload.checkpointSubmission);
  return payload.checkpointSubmission;
}

async function continueToNextCheckpoint() {
  if (!validateCurrentBlock() || state.submitting) return;
  const block = currentBlock();
  const nextBlock = allBlocks()[state.checkpointIndex + 1];
  state.submitting = true;
  elements.nextButton.disabled = true;
  try {
    if (!state.checkpointSubmissions.has(block.blockId)) {
      setNotice('Đang ghi nhận phần này…');
      await submitCurrentCheckpoint();
    }
    await refreshBlockReleases();
    if (!blockIsOpen(nextBlock)) {
      setNotice('Phần này đã được ghi nhận. Hãy chờ giảng viên mở phần tiếp theo.');
      renderCheckpoint();
      return;
    }
    state.checkpointIndex += 1;
    setNotice('Phần trước đã được ghi nhận.');
    renderCheckpoint();
  } catch (error) {
    setNotice(error.message, 'error');
  } finally {
    state.submitting = false;
    elements.nextButton.disabled = false;
  }
}

function validateCurrentBlock() {
  const invalidControl = elements.questionList.querySelector('textarea:invalid, input:invalid, select:invalid');
  if (blockIsComplete(currentBlock()) && !invalidControl) return true;
  setNotice('Bạn hãy điền đủ các mục có dấu * trước khi tiếp tục.', 'error');
  const firstEmpty = invalidControl || elements.questionList.querySelector('textarea, input, select');
  firstEmpty?.reportValidity?.();
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
    installStudentMemory();
    setNotice('Chọn đúng tên để bắt đầu.');
    showView('identityView');
  } catch (error) {
    fail('Phiếu chưa sẵn sàng', error.message);
  }
}

async function startAttempt() {
  try {
    if (!state.confirmedStudent || state.startingAttempt) return;
    state.startingAttempt = true;
    elements.confirmButton.disabled = true;
    elements.backToNamesButton.disabled = true;
    setNotice('Đang mở phần ghi nhận…');
    const payload = await apiRequest('/attempts/start', {
      body: {
        publicToken: state.publicToken,
        studentRef: state.confirmedStudent.studentRef,
        clientIdempotencyKey: crypto.randomUUID(),
        identityConfirmed: true
      }
    });
    state.attempt = payload.attempt;
    state.checkpointSubmissions = new Map(
      (state.attempt.checkpointSubmissions || []).map(item => [item.blockId, item])
    );
    state.responses = readLocalDraft(state.attempt.draftRevision) || state.attempt.draft || {};
    state.changeVersion = 0;
    state.savedVersion = 0;
    elements.studentNameLabel.textContent = state.attempt.identity.studentName;
    elements.formContextLabel.textContent = `${state.attempt.identity.className} · Buổi ${state.attempt.identity.sessionNumber}`;
    setSaveState(state.attempt.draftRevision ? 'Đã khôi phục bản lưu' : 'Chưa có thay đổi', state.attempt.draftRevision ? 'saved' : '');
    setNotice('Bạn có thể điền mỗi phần ngay sau hoạt động tương ứng.');
    state.checkpointIndex = 0;
    const eligible = officialStudent(state.confirmedStudent) && allowedGroup(studentMemory.group || {}, config.STUDENT_MEMORY);
    if (studentMemory.enabled && !writeMemory(studentMemory.storage, studentMemory.key,
      elements.rememberStudent.checked && eligible ? state.confirmedStudent.studentRef : '')) {
      setNotice('Đã mở phiếu, nhưng trình duyệt chưa lưu được lựa chọn. Lần sau bạn có thể cần chọn lại.', 'error');
    }
    state.confirmedStudent = null;
    renderCheckpoint();
    showView('formView');
  } catch (error) {
    setNotice(error.message, 'error');
    elements.confirmButton.disabled = false;
    elements.backToNamesButton.disabled = false;
  } finally {
    state.startingAttempt = false;
    studentMemory.busy = Boolean(state.confirmedStudent && !state.attempt);
    syncStudentMemoryControls();
  }
}

async function submitForm(event) {
  event.preventDefault();
  if (!validateCurrentBlock() || state.submitting) return;
  const missing = allItems().filter(item => itemIsRequired(item) && !responseIsPresent(item, responseFor(item)));
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
    if (!state.checkpointSubmissions.has(currentBlock().blockId)) {
      await submitCurrentCheckpoint();
    }
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
    setNotice('Hoàn tất. Bạn có thể đóng trang này.');
    showView('resultView');
  } catch (error) {
    state.submitting = false;
    elements.submitButton.disabled = false;
    setNotice(`${error.message} Chưa có xác nhận điểm danh.`, 'error');
  }
}

elements.studentSelect.addEventListener('change', () => {
  if (studentMemory.busy) return;
  state.selectedStudent = state.assignment.roster.find(student => student.studentRef === elements.studentSelect.value) || null;
  elements.chooseStudentButton.disabled = !state.selectedStudent;
  memoryStatus('');
  syncStudentMemoryControls();
});

elements.chooseStudentButton.addEventListener('click', () => {
  if (!state.selectedStudent) return;
  state.confirmedStudent = state.selectedStudent;
  studentMemory.busy = true;
  elements.confirmName.textContent = displayStudent(state.confirmedStudent);
  elements.confirmContext.textContent = `${state.assignment.class.name} · Buổi ${state.assignment.sessionNumber}`;
  elements.confirmButton.disabled = false;
  setNotice('Kiểm tra kỹ trước khi xác nhận.');
  showView('confirmView');
});

elements.backToNamesButton.addEventListener('click', () => {
  if (elements.backToNamesButton.disabled) return;
  state.confirmedStudent = null;
  state.startingAttempt = false;
  studentMemory.busy = false;
  showView('identityView');
  syncStudentMemoryControls();
});
elements.confirmButton.addEventListener('click', () => void startAttempt());
elements.previousButton.addEventListener('click', () => {
  state.checkpointIndex = Math.max(0, state.checkpointIndex - 1);
  setNotice('');
  renderCheckpoint();
});
elements.nextButton.addEventListener('click', () => void continueToNextCheckpoint());
elements.reflectionForm.addEventListener('submit', event => void submitForm(event));
window.addEventListener('resize', () => {
  for (const control of elements.questionList.querySelectorAll('.sentence-blank')) resizeSentenceBlank(control);
});
elements.retryButton.addEventListener('click', () => void openAssignment());
window.addEventListener('pagehide', () => {
  storeLocalDraft();
  clearSaveTimers();
});

void openAssignment();
