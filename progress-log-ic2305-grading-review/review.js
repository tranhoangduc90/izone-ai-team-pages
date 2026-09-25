/* Dữ liệu nhận vào: tệp dữ liệu đã ẩn danh cùng thư mục trên GitHub Pages.
 * Việc chính: tách ca giống/khác, hiện hai nhãn chấm và chuẩn bị phản hồi Google Form.
 * Kết quả: trang tải tự động; localStorage chỉ giữ lựa chọn và lý do.
 * Khi lỗi: báo lỗi tải/gửi rõ ràng, không coi phản hồi đã được ghi lên Form.
 */
(() => {
  'use strict';

  const DEMO_ID = 'IC2305-sessions-2-3-4-grading-public-v1';
  const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdqwkeqKb9eawvFPxxEu9Z8GOff01BqbmYqT-g2Ywpbpu8a3Q/viewform';
  const FORM_FIELDS = Object.freeze({caseKey: '2023912036', gemini: '1631772558', luna: '1902183348', human: '3129667', reason: '1863534216'});
  const storageKey = 'ic2305:grading-review:v3';
  const $ = (id) => document.getElementById(id);
  const fileStatus = $('file-status');
  const retryLoad = $('retry-load');
  const reviewArea = $('review-area');
  const questionFilter = $('question-filter');
  const caseSearch = $('case-search');
  const cards = $('cards');
  let bundle = null;
  let view = 'all';
  let reviews = loadReviews();

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  }

  function loadReviews() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  function persistReviews() {
    try { localStorage.setItem(storageKey, JSON.stringify(reviews)); }
    catch { fileStatus.textContent = 'Không lưu tạm được trên trình duyệt này. Hãy tải bản sao phản hồi trước khi đóng trang.'; }
  }

  function validate(value) {
    if (!value || value.schema_version !== 1 || value.demo_id !== DEMO_ID || value.public_data !== true) throw new Error('Sai phiên bản dữ liệu chấm thử.');
    if (!value.questions || !Array.isArray(value.items) || value.items.length !== 98) throw new Error('Dữ liệu không đủ 98 câu trả lời.');
    const keys = new Set();
    let different = 0;
    for (const item of value.items) {
      if (!/^IC-[A-Za-z0-9_-]{7,12}$/.test(item.key || '') || keys.has(item.key)) throw new Error('Mã ca trùng hoặc sai định dạng.');
      if (!value.questions[item.question_key] || typeof item.gemini !== 'boolean' || typeof item.luna !== 'boolean') throw new Error('Câu hỏi hoặc kết luận AI sai cấu trúc.');
      if (!(typeof item.answer === 'string' || Array.isArray(item.answer))) throw new Error('Câu trả lời sai cấu trúc.');
      keys.add(item.key);
      if (item.gemini !== item.luna) different += 1;
    }
    if (different !== 1) throw new Error('Số ca bất đồng không khớp bản chấm thử này.');
    return value;
  }

  function currentItems() {
    if (!bundle) return [];
    const q = questionFilter.value;
    const search = caseSearch.value.trim().toLowerCase();
    return bundle.items.filter((item) => {
      const belongs = view === 'all' || ((item.gemini === item.luna) === (view === 'same'));
      return belongs && (!q || item.question_key === q) && (!search || item.key.toLowerCase().includes(search));
    }).sort((a, b) => Number(a.gemini === a.luna) - Number(b.gemini === b.luna));
  }

  function updateView(next) {
    view = ['all', 'same', 'different'].includes(next) ? next : 'all';
    document.body.dataset.view = view;
    for (const tab of document.querySelectorAll('[data-tab]')) {
      if (tab.dataset.tab === view) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    questionFilter.value = '';
    caseSearch.value = '';
    render();
  }

  function verdict(correct) { return correct ? 'Đúng' : 'Sai'; }
  function choiceField(label, value, onChange) {
    const field = element('fieldset', 'choice-field');
    field.append(element('legend', '', label));
    for (const option of ['Đồng ý', 'Không đồng ý', 'Chưa chắc']) {
      const wrap = element('label', 'choice');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `${label}:${onChange.key}`;
      radio.value = option;
      radio.checked = value === option;
      radio.addEventListener('change', () => onChange(option));
      wrap.append(radio, document.createTextNode(option));
      field.append(wrap);
    }
    return field;
  }

  function formLink(item, state) {
    const url = new URL(FORM_URL);
    url.searchParams.set('usp', 'pp_url');
    url.searchParams.set(`entry.${FORM_FIELDS.caseKey}`, item.key);
    url.searchParams.set(`entry.${FORM_FIELDS.gemini}`, state.gemini);
    url.searchParams.set(`entry.${FORM_FIELDS.luna}`, state.luna);
    url.searchParams.set(`entry.${FORM_FIELDS.human}`, state.human);
    if (state.reason) url.searchParams.set(`entry.${FORM_FIELDS.reason}`, state.reason.trim().slice(0, 500));
    return url.toString();
  }

  function card(item) {
    const question = bundle.questions[item.question_key];
    const state = reviews[item.key] || {};
    const disputed = item.gemini !== item.luna;
    const card = element('article', disputed ? 'card disputed' : 'card');
    const top = element('div', 'card-top');
    top.append(element('span', 'case-key', `Buổi ${item.session} · ${item.key}`));
    if (disputed) top.append(element('span', 'dispute-tag', 'Cần phân xử'));
    top.append(element('span', 'question-tag', question.title));
    card.append(top);

    const grades = element('div', 'grades');
    for (const [name, value] of [['Gemini 3.1 Flash-Lite', item.gemini], ['GPT‑6 Luna', item.luna]]) {
      const block = element('div', 'grade');
      block.append(element('span', 'model-name', name), element('strong', value ? 'verdict right' : 'verdict wrong', verdict(value)));
      grades.append(block);
    }
    card.append(grades);

    const answers = element('div', 'answers');
    answers.append(element('h3', '', 'Câu trả lời của học viên'));
    const values = Array.isArray(item.answer) ? item.answer : [item.answer];
    values.forEach((answer, index) => {
      const row = element('div', 'answer-row');
      row.append(element('span', 'answer-label', question.labels[index] || `Ô ${index + 1}`), element('p', '', answer || '(Để trống)'));
      answers.append(row);
    });
    card.append(answers);

    const criteria = element('details', 'criteria');
    criteria.append(element('summary', '', 'Xem câu hỏi'));
    criteria.append(element('p', '', question.question));
    card.append(criteria);

    const feedback = element('div', 'feedback');
    feedback.append(element('h3', '', 'Bạn đánh giá hai kết luận này thế nào?'));
    const controls = element('div', 'feedback-grid');
    const write = (field, value) => { reviews[item.key] = {...(reviews[item.key] || {}), [field]: value}; persistReviews(); updateSummary(); };
    const geminiChange = (value) => write('gemini', value); geminiChange.key = item.key;
    const lunaChange = (value) => write('luna', value); lunaChange.key = item.key;
    controls.append(choiceField('Gemini 3.1 Flash-Lite', state.gemini, geminiChange));
    controls.append(choiceField('GPT‑6 Luna', state.luna, lunaChange));
    feedback.append(controls);
    const humanLabel = element('label', 'human-label', 'Theo bạn, cả câu trả lời là');
    const human = element('select');
    for (const option of ['', 'Đúng', 'Sai', 'Chưa thể chốt']) {
      const optionNode = element('option', '', option || 'Chọn kết luận');
      optionNode.value = option;
      human.append(optionNode);
    }
    human.value = state.human || '';
    human.addEventListener('change', () => write('human', human.value));
    humanLabel.append(human);
    feedback.append(humanLabel);
    const reasonLabel = element('label', 'reason-label', 'Lý do AI sai hoặc tiêu chí còn mơ hồ');
    const reason = element('textarea');
    reason.rows = 3;
    reason.maxLength = 500;
    reason.placeholder = 'Nếu không đồng ý, ghi ý còn thiếu hoặc chỗ AI suy diễn. Không chép bài làm.';
    reason.value = state.reason || '';
    reason.addEventListener('input', () => write('reason', reason.value));
    reasonLabel.append(reason);
    feedback.append(reasonLabel);
    const actions = element('div', 'actions');
    const send = element('a', 'send-button', 'Mở biểu mẫu gửi phản hồi ↗');
    send.href = FORM_URL;
    send.target = '_blank';
    send.rel = 'noopener noreferrer';
    const message = element('span', 'inline-status', '');
    send.addEventListener('click', (event) => {
      const latest = reviews[item.key] || {};
      if (!latest.gemini || !latest.luna || !latest.human) {
        event.preventDefault();
        message.textContent = 'Hãy đánh giá cả hai AI và chọn kết luận của bạn.';
        return;
      }
      if ((latest.gemini === 'Không đồng ý' || latest.luna === 'Không đồng ý') && !String(latest.reason || '').trim()) {
        event.preventDefault();
        message.textContent = 'Hãy ghi lý do khi bạn không đồng ý.';
        reason.focus();
        return;
      }
      send.href = formLink(item, latest);
      message.textContent = 'Kiểm tra thông tin rồi bấm Gửi trên Google Form.';
    });
    actions.append(send, message);
    feedback.append(actions);
    card.append(feedback);
    return card;
  }

  function updateSummary() {
    if (!bundle) return;
    const subset = bundle.items.filter((item) => view === 'all' || ((item.gemini === item.luna) === (view === 'same')));
    const reviewed = subset.filter((item) => reviews[item.key]?.gemini && reviews[item.key]?.luna && reviews[item.key]?.human).length;
    const label = view === 'all' ? 'tất cả' : view === 'same' ? 'chấm giống nhau' : 'chấm khác nhau';
    $('summary').textContent = `${subset.length} ca ${label} · ${reviewed} ca đã chọn đánh giá trên máy này`;
  }

  function render() {
    if (!bundle) return;
    updateSummary();
    cards.replaceChildren();
    const items = currentItems();
    if (!items.length) cards.append(element('p', 'empty', 'Không có ca nào khớp bộ lọc.'));
    else for (const item of items) cards.append(card(item));
  }

  async function loadData() {
    fileStatus.textContent = 'Đang tải 98 câu trả lời...';
    retryLoad.hidden = true;
    try {
      const response = await fetch('./data.json', {cache: 'no-store'});
      if (!response.ok) throw new Error(`Máy chủ trả HTTP ${response.status}.`);
      bundle = validate(await response.json());
      fileStatus.textContent = 'Đã tải 98 câu trả lời: 97 ca giống nhau, 1 ca bất đồng.';
      reviewArea.hidden = false;
      questionFilter.replaceChildren(element('option', '', 'Tất cả câu hỏi'));
      questionFilter.firstChild.value = '';
      for (const [key, q] of Object.entries(bundle.questions)) {
        const option = element('option', '', q.title);
        option.value = key;
        questionFilter.append(option);
      }
      render();
    } catch (error) {
      bundle = null;
      reviewArea.hidden = true;
      retryLoad.hidden = false;
      fileStatus.textContent = `Không tải được dữ liệu: ${error.message}`;
    }
  }

  retryLoad.addEventListener('click', loadData);
  loadData();

  questionFilter.addEventListener('change', render);
  caseSearch.addEventListener('input', render);
  $('export-feedback').addEventListener('click', () => {
    const payload = {demo_id: DEMO_ID, exported_at: new Date().toISOString(), reviews};
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ic2305-phan-hoi-cham-thu.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  for (const tab of document.querySelectorAll('[data-tab]')) {
    tab.addEventListener('click', () => updateView(tab.dataset.tab));
  }
})();
