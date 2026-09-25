/* Dữ liệu: 98 bài ẩn danh và kết luận từng ô. Hiện hai AI tại ô bất đồng; phản hồi theo ô.
 * Lỗi tải/gửi được báo rõ; chỉ Google Form xác nhận mới là phản hồi đã gửi.
 */
(() => {
  'use strict';
  const DEMO_ID = 'IC2305-sessions-2-3-4-grading-public-v2';
  const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdqwkeqKb9eawvFPxxEu9Z8GOff01BqbmYqT-g2Ywpbpu8a3Q/viewform';
  const FORM_FIELDS = {caseKey: '2023912036', gemini: '1631772558', luna: '1902183348', human: '3129667', reason: '1863534216'};
  const storageKey = 'ic2305:grading-review:v4';
  const $ = (id) => document.getElementById(id);
  const fileStatus = $('file-status'), cards = $('cards'), reviewArea = $('review-area');
  const questionFilter = $('question-filter'), caseSearch = $('case-search');
  let bundle = null, view = 'all';
  let reviews;
  try { reviews = JSON.parse(localStorage.getItem(storageKey) || '{}'); }
  catch { reviews = {}; }
  if (!reviews || typeof reviews !== 'object' || Array.isArray(reviews)) reviews = {};

  function el(tag, className = '', content) {
    const node = document.createElement(tag);
    node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  }
  const answers = (item) => Array.isArray(item.answer) ? item.answer : [item.answer];
  const disputed = (item) => item.gemini_parts.some((value, i) => value !== item.luna_parts[i]);
  const slotKey = (item, i) => `${item.key}#${i + 1}`;
  const correctCount = (parts) => parts.filter(Boolean).length;
  const verdict = (value) => value ? 'Đúng' : 'Sai';
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(reviews)); }
    catch { fileStatus.textContent = 'Không lưu tạm được phản hồi trên trình duyệt này.'; }
    updateSummary();
  }
  function validate(data) {
    if (data?.schema_version !== 2 || data.demo_id !== DEMO_ID || data.public_data !== true || !data.questions || !Array.isArray(data.items) || data.items.length !== 98) throw new Error('Dữ liệu sai phiên bản hoặc không đủ 98 bài.');
    const keys = new Set(); let slots = 0;
    for (const item of data.items) {
      const labels = data.questions[item.question_key]?.labels, fields = answers(item);
      if (!/^IC-[A-Za-z0-9_-]{7,12}$/.test(item.key || '') || keys.has(item.key) || !Array.isArray(labels) || fields.length !== labels.length || fields.some((x) => typeof x !== 'string')) throw new Error('Mã ca hoặc câu trả lời sai cấu trúc.');
      for (const parts of [item.gemini_parts, item.luna_parts]) if (!Array.isArray(parts) || parts.length !== fields.length || parts.some((x) => typeof x !== 'boolean')) throw new Error('Kết luận từng ô sai cấu trúc.');
      keys.add(item.key); slots += fields.length;
    }
    if (slots !== 308) throw new Error('Dữ liệu không đủ 308 ô.');
    return data;
  }
  function choice(label, id, value, write) {
    const field = el('fieldset', 'choice-field'); field.append(el('legend', '', label));
    for (const option of ['Đồng ý', 'Không đồng ý', 'Chưa chắc']) {
      const wrap = el('label', 'choice'), radio = el('input');
      radio.type = 'radio'; radio.name = `${id}:${label}`; radio.value = option; radio.checked = value === option;
      radio.addEventListener('change', () => write(option));
      wrap.append(radio, document.createTextNode(option)); field.append(wrap);
    }
    return field;
  }
  function formLink(id, state) {
    const url = new URL(FORM_URL); url.searchParams.set('usp', 'pp_url');
    for (const field of ['gemini', 'luna', 'human']) url.searchParams.set(`entry.${FORM_FIELDS[field]}`, state[field]);
    url.searchParams.set(`entry.${FORM_FIELDS.caseKey}`, id);
    if (state.reason) url.searchParams.set(`entry.${FORM_FIELDS.reason}`, state.reason.trim().slice(0, 500));
    return url.toString();
  }
  function feedback(item, i, different) {
    const id = slotKey(item, i), state = reviews[id] || {};
    const panel = el('details', 'slot-feedback'); panel.append(el('summary', '', `Góp ý kết quả ô ${i + 1}`));
    const body = el('div', 'slot-feedback-content'), controls = el('div', different ? 'feedback-grid' : 'feedback-grid shared');
    const write = (field, value) => { reviews[id] = {...(reviews[id] || {}), [field]: value}; save(); };
    if (different) {
      controls.append(choice('Gemini 3.1 Flash-Lite', id, state.gemini, (v) => write('gemini', v)));
      controls.append(choice('GPT‑6 Luna', id, state.luna, (v) => write('luna', v)));
    } else {
      controls.append(choice('Kết quả chung của hai AI', id, state.gemini === state.luna ? state.gemini : '', (v) => {
        reviews[id] = {...(reviews[id] || {}), gemini: v, luna: v}; save();
      }));
    }
    body.append(controls);
    const humanLabel = el('label', 'human-label', `Theo bạn, ô ${i + 1} là`), human = el('select');
    for (const option of ['', 'Đúng', 'Sai', 'Chưa thể chốt']) {
      const node = el('option', '', option || 'Chọn kết luận'); node.value = option; human.append(node);
    }
    human.value = state.human || ''; human.addEventListener('change', () => write('human', human.value));
    humanLabel.append(human); body.append(humanLabel);
    const reasonLabel = el('label', 'reason-label', 'Lý do AI sai hoặc tiêu chí còn mơ hồ'), reason = el('textarea');
    reason.rows = 2; reason.maxLength = 500; reason.placeholder = 'Nêu chỗ AI suy diễn. Không chép bài làm.';
    reason.value = state.reason || ''; reason.addEventListener('input', () => write('reason', reason.value));
    reasonLabel.append(reason); body.append(reasonLabel);
    const actions = el('div', 'actions'), send = el('a', 'send-button', 'Mở biểu mẫu gửi phản hồi ↗'), message = el('span', 'inline-status', '');
    send.href = FORM_URL; send.target = '_blank'; send.rel = 'noopener noreferrer';
    send.addEventListener('click', (event) => {
      const latest = reviews[id] || {};
      if (!latest.gemini || !latest.luna || !latest.human || (!different && latest.gemini !== latest.luna)) {
        event.preventDefault(); message.textContent = 'Hãy đánh giá AI và chọn kết luận của bạn cho ô này.'; return;
      }
      if ((latest.gemini === 'Không đồng ý' || latest.luna === 'Không đồng ý') && !String(latest.reason || '').trim()) {
        event.preventDefault(); message.textContent = 'Hãy ghi lý do khi không đồng ý.'; reason.focus(); return;
      }
      send.href = formLink(id, latest); message.textContent = 'Kiểm tra thông tin rồi bấm Gửi trên Google Form.';
    });
    actions.append(send, message); body.append(actions); panel.append(body); return panel;
  }
  function grade(label, value) {
    const block = el('div', 'grade');
    block.append(el('span', 'model-name', label), el('strong', value ? 'verdict right' : 'verdict wrong', verdict(value)));
    return block;
  }
  function card(item) {
    const question = bundle.questions[item.question_key], different = disputed(item);
    const card = el('article', different ? 'card disputed' : 'card'), top = el('div', 'card-top');
    top.append(el('span', 'case-key', `Buổi ${item.session} · ${item.key}`));
    if (different) top.append(el('span', 'dispute-tag', 'Có ô cần phân xử'));
    top.append(el('span', 'question-tag', question.title)); card.append(top);
    const summary = different
      ? `Gemini đúng ${correctCount(item.gemini_parts)}/${item.gemini_parts.length} ô · Luna đúng ${correctCount(item.luna_parts)}/${item.luna_parts.length} ô`
      : `Hai AI cùng chấm đúng ${correctCount(item.gemini_parts)}/${item.gemini_parts.length} ô`;
    card.append(el('p', 'card-summary', summary));
    answers(item).forEach((answer, i) => {
      const mismatch = item.gemini_parts[i] !== item.luna_parts[i];
      const row = el('section', mismatch ? 'answer-row disputed-slot' : 'answer-row');
      row.append(el('h3', 'answer-label', `${question.labels[i]} · Ô ${i + 1}`));
      row.append(el('p', 'answer-text', answer || '(Để trống)'));
      const grades = el('div', 'slot-grades');
      if (mismatch) grades.append(grade('Gemini 3.1 Flash-Lite', item.gemini_parts[i]), grade('GPT‑6 Luna', item.luna_parts[i]));
      else grades.append(grade('Kết quả chung của hai AI', item.gemini_parts[i]));
      row.append(grades, feedback(item, i, mismatch)); card.append(row);
    });
    const criteria = el('details', 'criteria'); criteria.append(el('summary', '', 'Xem câu hỏi'), el('p', '', question.question));
    card.append(criteria); return card;
  }
  function updateSummary() {
    if (!bundle) return;
    const subset = bundle.items.filter((item) => view === 'all' || disputed(item) === (view === 'different'));
    const slots = subset.reduce((n, item) => n + answers(item).length, 0);
    const reviewed = subset.reduce((n, item) => n + answers(item).filter((_, i) => {
      const state = reviews[slotKey(item, i)]; return state?.gemini && state?.luna && state?.human;
    }).length, 0);
    $('summary').textContent = `${subset.length} bài · ${slots} ô · ${reviewed} ô đã chọn đánh giá trên máy này`;
  }
  function render() {
    if (!bundle) return;
    updateSummary(); cards.replaceChildren();
    const question = questionFilter.value, search = caseSearch.value.trim().toLowerCase();
    const items = bundle.items.filter((item) =>
      (view === 'all' || disputed(item) === (view === 'different'))
      && (!question || item.question_key === question)
      && (!search || item.key.toLowerCase().includes(search))
    ).sort((a, b) => Number(disputed(b)) - Number(disputed(a)));
    if (!items.length) cards.append(el('p', 'empty', 'Không có bài nào khớp bộ lọc.'));
    else for (const item of items) cards.append(card(item));
  }
  function updateView(next) {
    view = ['all', 'same', 'different'].includes(next) ? next : 'all';
    document.body.dataset.view = view;
    for (const tab of document.querySelectorAll('[data-tab]')) {
      if (tab.dataset.tab === view) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    }
    questionFilter.value = ''; caseSearch.value = ''; render();
  }
  async function loadData() {
    fileStatus.textContent = 'Đang tải 98 bài làm...'; $('retry-load').hidden = true;
    try {
      const response = await fetch('./data.json', {cache: 'no-store'});
      if (!response.ok) throw new Error(`Máy chủ trả HTTP ${response.status}.`);
      bundle = validate(await response.json());
      const differentCases = bundle.items.filter(disputed).length;
      const differentSlots = bundle.items.reduce((n, item) => n + item.gemini_parts.filter((value, i) => value !== item.luna_parts[i]).length, 0);
      fileStatus.textContent = `Đã tải 98 bài, 308 ô. Hai AI khác nhau ở ${differentSlots} ô của ${differentCases} bài.`;
      for (const tab of document.querySelectorAll('[data-tab]')) {
        const count = tab.dataset.tab === 'all' ? 98 : tab.dataset.tab === 'different' ? differentCases : 98 - differentCases;
        const badge = tab.querySelector('span'); if (badge) badge.textContent = String(count);
      }
      reviewArea.hidden = false;
      questionFilter.replaceChildren(el('option', '', 'Tất cả câu hỏi')); questionFilter.firstChild.value = '';
      for (const [key, question] of Object.entries(bundle.questions)) {
        const option = el('option', '', question.title); option.value = key; questionFilter.append(option);
      }
      render();
    } catch (error) {
      bundle = null; reviewArea.hidden = true; $('retry-load').hidden = false;
      fileStatus.textContent = `Không tải được dữ liệu: ${error.message}`;
    }
  }
  $('retry-load').addEventListener('click', loadData);
  questionFilter.addEventListener('change', render); caseSearch.addEventListener('input', render);
  $('export-feedback').addEventListener('click', () => {
    const payload = {demo_id: DEMO_ID, exported_at: new Date().toISOString(), reviews};
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
    const link = el('a'); link.href = url; link.download = 'ic2305-phan-hoi-cham-tung-o.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  for (const tab of document.querySelectorAll('[data-tab]')) tab.addEventListener('click', () => updateView(tab.dataset.tab));
  loadData();
})();
