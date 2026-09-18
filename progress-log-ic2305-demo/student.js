/* Dữ liệu nhận vào: hồ sơ mẫu đã chọn và câu trả lời người xem thử.
 * Việc chính: mô phỏng xác nhận tên, nộp ba phần, lưu nháp và điểm danh.
 * Kết quả: dashboard demo ở tab khác thấy thay đổi; khi lỗi lưu cục bộ, không gửi dữ liệu ra ngoài.
 */
import { BLOCKS, QUESTIONS, CLASS, KEY, load, save, isComplete, isPresent } from './data.js';

const $ = id => document.getElementById(id);
let selectedId = '';
let currentBlock = 0;
let reviewing = false;
let pendingSave = 0;
let draftResponses = {};
const measure = document.createElement('canvas').getContext('2d');

function student() { return load().students.find(item => item.id === selectedId); }
function notice(message, error = false) { $('notice').textContent = message; $('notice').className = error ? 'notice error' : 'notice'; }
function view(id) { for (const key of ['identityView', 'confirmView', 'formView', 'resultView']) $(key).hidden = key !== id; }
function setSaveState(message, saved = false) { $('saveState').textContent = message; $('saveState').className = `save-state${saved ? ' saved' : ''}`; }

function persistDraft() {
  window.clearTimeout(pendingSave);
  pendingSave = 0;
  if (!selectedId || reviewing) return;
  const state = load();
  const target = state.students.find(item => item.id === selectedId);
  if (!target || target.submitted) return;
  target.responses = structuredClone(draftResponses);
  target.revision += 1;
  target.updatedAt = new Date().toISOString();
  save(state);
  setSaveState('Đã lưu bản demo', true);
}

function responseChanged(key, value) {
  draftResponses[key] = value;
  setSaveState('Đang ghi nhận…');
  window.clearTimeout(pendingSave);
  pendingSave = window.setTimeout(persistDraft, 350);
}

function resizeBlank(control) {
  const available = Math.max(90, (control.closest('.sentence-text')?.clientWidth || 420) - 8);
  if (measure) {
    measure.font = getComputedStyle(control).font;
    control.style.width = `${Math.min(available, Math.max(108, Math.ceil(measure.measureText(control.value || ' ').width) + 24))}px`;
  }
  control.style.height = 'auto';
  control.style.height = `${Math.max(30, control.scrollHeight)}px`;
}

function buildQuestion(key) {
  const question = QUESTIONS[key];
  const wrapper = document.createElement('div'); wrapper.className = 'question';
  const number = document.createElement('span'); number.className = 'question-number'; number.textContent = question.number;
  const content = document.createElement('div'); content.className = 'question-content';
  const label = document.createElement('h3'); label.textContent = question.prompt;
  const required = document.createElement('span'); required.className = 'required'; required.textContent = ' *'; label.append(required);
  content.append(label);
  const value = draftResponses[key];

  if (question.type === 'long_text') {
    const input = document.createElement('textarea'); input.value = value || ''; input.maxLength = 12000;
    input.setAttribute('aria-label', question.prompt); input.disabled = reviewing || student()?.checkpoints.includes(currentBlock + 1);
    input.addEventListener('input', () => responseChanged(key, input.value)); content.append(input);
  } else if (question.type === 'choice') {
    const choices = document.createElement('div'); choices.className = 'choice-list'; choices.setAttribute('role', 'radiogroup'); choices.setAttribute('aria-label', question.prompt);
    for (const [index, option] of question.options.entries()) {
      const row = document.createElement('label'); row.className = `choice${value === option[0] ? ' selected' : ''}`;
      const input = document.createElement('input'); input.type = 'radio'; input.name = key; input.value = option[0]; input.checked = value === option[0]; input.disabled = reviewing || student()?.checkpoints.includes(currentBlock + 1);
      const mark = document.createElement('span'); mark.className = 'choice-key'; mark.textContent = input.checked ? '✓' : String.fromCharCode(65 + index);
      const text = document.createElement('span'); text.className = 'choice-text'; text.textContent = option[1];
      input.addEventListener('change', () => { responseChanged(key, option[0]); for (const label of choices.children) { const checked = label.querySelector('input').checked; label.classList.toggle('selected', checked); label.querySelector('.choice-key').textContent = checked ? '✓' : String.fromCharCode(65 + [...choices.children].indexOf(label)); } });
      row.append(input, mark, text); choices.append(row);
    }
    content.append(choices);
  } else {
    const group = document.createElement('div'); group.className = 'sentence-group';
    let position = 0;
    for (const [rowIndex, template] of question.rows.entries()) {
      const row = document.createElement('div'); row.className = 'sentence-row';
      if (question.rows.length > 1) { const index = document.createElement('span'); index.className = 'sentence-index'; index.textContent = `${rowIndex + 1}.`; row.append(index); }
      const sentence = document.createElement('p'); sentence.className = 'sentence-text';
      if (template.title) { const title = document.createElement('strong'); title.textContent = `${template.title} `; sentence.append(title); }
      sentence.append(document.createTextNode(template.parts[0]));
      for (let part = 1; part < template.parts.length; part += 1) {
        const blank = document.createElement('textarea'); blank.className = 'sentence-blank'; blank.rows = 1; blank.maxLength = 2000;
        blank.value = Array.isArray(value) ? value[position] || '' : '';
        blank.disabled = reviewing || student()?.checkpoints.includes(currentBlock + 1);
        blank.setAttribute('aria-label', `Câu ${question.number}, ô ${position + 1}`);
        blank.addEventListener('input', () => { blank.value = blank.value.replace(/\s*[\r\n]+\s*/g, ' '); resizeBlank(blank); responseChanged(key, [...group.querySelectorAll('textarea')].map(node => node.value)); });
        blank.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
        sentence.append(blank, document.createTextNode(template.parts[part])); position += 1;
      }
      row.append(sentence); group.append(row);
    }
    content.append(group);
  }
  wrapper.append(number, content);
  return wrapper;
}

function renderBlock() {
  const block = BLOCKS[currentBlock];
  $('checkpointLabel').textContent = `PHẦN ${block.number}/3 · 5 PHÚT`;
  $('checkpointTitle').textContent = block.title;
  $('questionList').replaceChildren(...block.items.map(buildQuestion));
  requestAnimationFrame(() => document.querySelectorAll('.sentence-blank').forEach(resizeBlank));
  $('previousButton').hidden = currentBlock === 0;
  $('nextButton').hidden = !reviewing && currentBlock === 2;
  $('submitButton').hidden = reviewing || currentBlock !== 2;
  $('nextButton').textContent = reviewing ? (currentBlock === 2 ? 'Xem kết quả' : 'Xem phần tiếp theo') : 'Nộp phần và tiếp tục';
  if (!reviewing && student()?.checkpoints.includes(currentBlock + 1) && load().releases[currentBlock + 1] !== 'open') $('nextButton').textContent = 'Kiểm tra phần tiếp theo';
  $('nextButton').hidden = !reviewing && currentBlock === 2;
  if (reviewing && currentBlock === 2) $('nextButton').hidden = false;
  $('progressBar').style.width = `${((currentBlock + 1) / 3) * 100}%`;
  notice(reviewing ? 'Đang xem bản đã nộp; câu trả lời không thể sửa.' : '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateBlock() {
  const missing = BLOCKS[currentBlock].items.find(key => !isPresent(QUESTIONS[key], draftResponses[key]));
  if (!missing) return true;
  notice(`Vui lòng điền đủ câu ${QUESTIONS[missing].number} trước khi tiếp tục.`, true);
  const questionIndex = BLOCKS[currentBlock].items.indexOf(missing);
  $('questionList').children[questionIndex]?.querySelector('textarea, input')?.focus();
  return false;
}

function result() {
  const target = student();
  $('resultTitle').textContent = target?.submitted ? 'Bạn đã hoàn tất' : 'Chưa hoàn tất';
  $('attendanceResult').textContent = target?.attendance === 'self_confirmed' ? 'Đã xác nhận tham gia' : target?.attendance === 'teacher_confirmed' ? 'Giảng viên xác nhận' : 'Chờ giảng viên';
  $('completenessResult').textContent = target?.submitted && isComplete(target) ? 'Đã nộp đủ' : 'Chưa nộp đủ';
  view('resultView'); notice('');
}

function start() {
  const target = student();
  if (!target) return;
  draftResponses = structuredClone(target.responses);
  $('studentNameLabel').textContent = target.name;
  if (target.submitted) return result();
  reviewing = false;
  currentBlock = 0;
  view('formView'); renderBlock();
}

function continueBlock() {
  if (reviewing) { if (currentBlock === 2) result(); else { currentBlock += 1; renderBlock(); } return; }
  const before = load();
  const currentStudent = before.students.find(item => item.id === selectedId);
  if (before.releases[currentBlock] !== 'open' && !currentStudent?.checkpoints.includes(currentBlock + 1)) { notice('Phần này hiện chưa được giảng viên mở.', true); return; }
  if (!validateBlock()) return;
  persistDraft();
  const data = load();
  const target = data.students.find(item => item.id === selectedId);
  if (!target) return;
  if (!target.checkpoints.includes(currentBlock + 1)) target.checkpoints.push(currentBlock + 1);
  save(data);
  if (data.releases[currentBlock + 1] !== 'open') { renderBlock(); notice('Phần này đã được ghi nhận. Hãy chờ giảng viên mở phần tiếp theo.'); return; }
  currentBlock += 1; renderBlock();
}

function submit() {
  if (!validateBlock()) return;
  persistDraft();
  const data = load();
  const target = data.students.find(item => item.id === selectedId);
  if (!target || data.releases[2] !== 'open') { notice('Phần này chưa được giảng viên mở.', true); return; }
  if (!target.checkpoints.includes(3)) target.checkpoints.push(3);
  target.submitted = true;
  target.attendance = isComplete(target) ? 'self_confirmed' : 'pending_teacher';
  target.portalSync = target.attendance === 'self_confirmed' ? 'demo_only' : null;
  target.updatedAt = new Date().toISOString();
  save(data); result();
}

function init() {
  const data = load();
  for (const target of data.students) $('studentSelect').add(new Option(target.name, target.id));
  const suggested = new URLSearchParams(location.search).get('student');
  if (data.students.some(item => item.id === suggested)) { $('studentSelect').value = suggested; $('chooseStudentButton').disabled = false; }
  $('studentSelect').addEventListener('change', () => { $('chooseStudentButton').disabled = !$('studentSelect').value; });
  $('chooseStudentButton').addEventListener('click', () => { selectedId = $('studentSelect').value; if (!selectedId) return; $('confirmName').textContent = student().name; view('confirmView'); });
  $('backToNamesButton').addEventListener('click', () => view('identityView'));
  $('confirmButton').addEventListener('click', start);
  $('previousButton').addEventListener('click', () => { persistDraft(); currentBlock = Math.max(0, currentBlock - 1); renderBlock(); });
  $('nextButton').addEventListener('click', continueBlock);
  $('reflectionForm').addEventListener('submit', event => { event.preventDefault(); submit(); });
  $('reviewButton').addEventListener('click', () => { reviewing = true; draftResponses = structuredClone(student().responses); currentBlock = 0; view('formView'); renderBlock(); });
  $('changeStudentButton').addEventListener('click', () => { selectedId = ''; $('studentSelect').value = ''; $('chooseStudentButton').disabled = true; view('identityView'); });
  window.addEventListener('beforeunload', persistDraft);
  window.addEventListener('storage', event => { if (event.key === KEY && selectedId && !reviewing && !student()?.submitted && $('formView').hidden === false) renderBlock(); });
  view('identityView');
}

init();
