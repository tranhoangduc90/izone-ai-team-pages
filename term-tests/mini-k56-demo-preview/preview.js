/* Dữ liệu mẫu và kết quả chỉ ở trong tab. Không gọi API hoặc lưu bài thi. */
const get = id => document.getElementById(id);
const available = { listening: 'Listening', reading: 'Reading', writing: 'Writing' };
const preferred = new URLSearchParams(location.search).get('mode');
let order = [];
let position = 0;

function showSection() {
  get('start').hidden = true;
  get('finish').hidden = true;
  get('work').hidden = false;
  const active = order[position];
  for (const [section] of Object.entries(available)) get(section).hidden = section !== active;
  if (active !== 'listening') get('listening').querySelector('audio').pause();

  get('steps').replaceChildren(...order.map((section, index) => {
    const item = document.createElement('li');
    item.textContent = available[section];
    if (index === position) item.setAttribute('aria-current', 'step');
    return item;
  }));
  get('sectionTitle').textContent = available[active];
  get('next').textContent = position === order.length - 1 ? 'Xem kết quả mẫu' : 'Tiếp tục';
  get('sectionTitle').focus();
}

function begin(mode) {
  order = mode === 'read_first' ? ['reading', 'listening', 'writing'] : ['listening', 'reading', 'writing'];
  position = 0;
  showSection();
}

function showResult() {
  const score = (section, correct) => {
    const answer = document.querySelector('input[name="' + section + '"]:checked');
    return answer ? (answer.value === correct ? '1/1 câu đúng' : '0/1 câu đúng') : 'Chưa trả lời';
  };
  get('listeningResult').textContent = score('listening', 'ten');
  get('readingResult').textContent = score('reading', 'week');
  get('writingResult').textContent = Number(get('wordCount').value) + ' từ trong đoạn viết thử';
  get('work').hidden = true;
  get('finish').hidden = false;
  get('finishTitle').focus();
}

for (const button of document.querySelectorAll('[data-order]')) {
  button.addEventListener('click', () => begin(button.dataset.order));
}
get('next').addEventListener('click', () => {
  if (position === order.length - 1) return showResult();
  position += 1;
  showSection();
});
get('back').addEventListener('click', () => {
  if (position > 0) {
    position -= 1;
    showSection();
    return;
  }
  get('listening').querySelector('audio').pause();
  get('work').hidden = true;
  get('start').hidden = false;
  get('start').querySelector('button').focus();
});
get('sampleWriting').addEventListener('input', event => {
  get('wordCount').value = (event.target.value.match(/\S+/g) || []).length;
});
get('review').addEventListener('click', () => { position = 0; showSection(); });
get('restart').addEventListener('click', () => {
  for (const radio of document.querySelectorAll('input[type="radio"]')) radio.checked = false;
  get('sampleWriting').value = '';
  get('wordCount').value = '0';
  get('listening').querySelector('audio').currentTime = 0;
  get('finish').hidden = true;
  get('start').hidden = false;
  get('start').querySelector('button').focus();
});

if (preferred === 'read_first' || preferred === 'lis_first') begin(preferred);
