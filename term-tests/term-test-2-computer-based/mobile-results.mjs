
const prefix = '/api/term-tests/term-test-2/mobile-results';
const codePattern = /^[A-Za-z0-9_-]{75,280}$/;
const byResult = {correct:'Đúng', incorrect:'Sai', blank:'Bỏ trống'};
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

async function post(action, body, permit, signal) {
  const response = await fetch(window.TERM_TEST_APP_CONFIG.API_BASE_URL + prefix + '/' + action, {
    method:'POST', cache:'no-store', credentials:'omit', signal:signal || AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/json', ...(permit && {'x-term2-permit':permit})},
    body:JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.message || (response.status === 404
      ? 'Tính năng xem trên điện thoại chưa được mở cho lượt thi này.'
      : 'Chưa tải được kết quả. Hãy thử lại.'));
    error.status = response.status;
    throw error;
  }
  return data;
}

export function mountDesktopReviewCode(getOwner) {
  const result = document.getElementById('resultView');
  if (!result || result.querySelector('[data-mobile-review-code]')) return;
  const group = el('section', undefined, 'mobile-result-code');
  group.dataset.mobileReviewCode = '';
  const button = el('button', 'Lấy mã xem trên điện thoại', 'button outline');
  button.type = 'button';
  const message = el('p');
  message.setAttribute('role', 'status');
  const field = el('input');
  field.type = 'text'; field.readOnly = true; field.hidden = true;
  field.setAttribute('aria-label', 'Mã xem kết quả trên điện thoại');
  field.addEventListener('focus', () => field.select());
  group.append(button, message, field);
  result.append(group);
  let generation = 0;
  const clear = () => { generation++; field.hidden = true; field.value = ''; message.textContent = ''; button.disabled = false; };
  new MutationObserver(() => { if (result.hidden) clear(); }).observe(result, {attributes:true, attributeFilter:['hidden']});
  window.addEventListener('pagehide', clear);
  button.onclick = async () => {
    clear();
    const epoch = generation;
    button.disabled = true;
    message.textContent = 'Đang lấy mã…';
    try {
      const owner = await getOwner();
      if (!owner) throw Error('Chưa xác nhận được lượt thi trên thiết bị này.');
      const {permit, ...scope} = owner;
      const data = await post('issue', scope, permit);
      if (epoch !== generation || result.hidden) return;
      if (!codePattern.test(data.code || '')) throw Error('Máy chủ chưa trả mã xem hợp lệ.');
      field.value = data.code;
      field.hidden = false;
      message.textContent = 'Mã có hiệu lực 24 giờ. Mở lại link thi ban đầu trên điện thoại, chọn Xem kết quả và nhập mã này.';
      field.focus();
    } catch (error) {
      if (epoch === generation) message.textContent = error.message;
    } finally {
      if (epoch === generation) button.disabled = false;
    }
  };
}

function score(section) {
  if (!section) return 'Chưa có điểm';
  return `${section.correct}/${section.total}${Number.isFinite(section.band) ? ' · Band ' + section.band : ''}`;
}

function showWriting(target, writing) {
  const grading = writing?.grading;
  const content = [el('h3', 'Writing'), el('p', grading?.ready && grading.writingScore != null
    ? 'Band ' + grading.writingScore : 'Đã nộp · Chưa có điểm Writing')];
  if (grading?.ready) {
    for (const task of grading.tasks || []) {
      const item = el('details');
      item.append(el('summary', 'Task ' + task.taskNumber + ' · Band ' + (task.taskScore ?? '—')));
      if (typeof task.report === 'string' && task.report.trim()) item.append(el('p', task.report, 'mobile-writing-report'));
      content.push(item);
    }
  }
  target.replaceChildren(...content);
}

function objective(title, section, payload, getReview) {
  const details = el('details', undefined, 'detail-block mobile-result-card');
  details.dataset.skill = title;
  details.append(el('summary', title + ' · ' + score(section)));
  const table = el('table');
  const head = table.createTHead().insertRow();
  for (const label of ['Câu', 'Bài làm', 'Đáp án đúng', 'Kết quả']) {
    const cell = el('th', label);
    cell.scope = 'col'; head.append(cell);
  }
  const body = table.createTBody();
  for (const row of section?.details || []) {
    const tr = body.insertRow();
    for (const [label, value] of [['Câu', row.number], ['Bài làm', row.studentAnswer], ['Đáp án đúng', row.correctAnswer], ['Kết quả', byResult[row.result] || 'Chưa có dữ liệu']]) {
      const td = tr.insertCell();
      td.dataset.label = label;
      td.textContent = value || '—';
    }
  }
  if (!body.rows.length) details.append(el('p', 'Chưa có dữ liệu từng câu.'));
  else {
    details.append(table);
    // Attach once on demand. The native renderer keeps its own question navigation and clip player.
    details.addEventListener('toggle', () => {
      if (!details.open || table.dataset.explanationsAttached) return;
      window.K67_ANSWER_EXPLANATIONS?.attach({
        container:details.parentNode, payload, testSlug:'term-test-2',
        title:'Term Test 2 · Khóa 67', reviewKey:'term2-mobile-review', loadReview:getReview
      });
    });
  }
  if (section?.typeStats?.length) {
    const analysis = el('details', undefined, 'mobile-type-analysis');
    analysis.append(el('summary', 'Phân tích theo dạng câu'));
    const list = el('ul');
    for (const stat of section.typeStats) list.append(el('li', `${stat.type} · ${stat.correct}/${stat.total}`));
    analysis.append(list);
    details.append(analysis);
  }
  return details;
}

function mobile() {
  if (!window.IZONE_EXAM_DEVICE_BLOCKED || !window.TERM_TEST_APP_CONFIG) return;
  const root = document.querySelector('#app');
  const notice = root?.querySelector('.exam-device-notice');
  if (!notice) return;
  document.body.classList.add('term2-mobile-results');
  notice.querySelector('p').textContent = 'Bắt đầu và tiếp tục thi trên máy tính. Sau khi nộp bài, bạn có thể dùng link này để xem kết quả đã công bố.';
  const toggle = el('button', 'Xem kết quả', 'button button-primary');
  toggle.type = 'button';
  const form = el('form');
  form.hidden = true;
  const label = el('label', 'Mã xem kết quả');
  const field = el('input');
  field.type = 'text'; field.required = true; field.maxLength = 280; field.autocomplete = 'off';
  field.spellcheck = false; field.autocapitalize = 'none'; field.id = 'term2MobileCode'; label.htmlFor = field.id;
  const submit = el('button', 'Mở kết quả', 'button button-primary');
  const message = el('p');
  message.setAttribute('role', 'status');
  form.append(label, field, el('p', 'Lấy mã từ màn kết quả trên máy tính đã dùng để thi.'), submit, message);
  notice.append(toggle, form);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.onclick = () => {
    form.hidden = !form.hidden;
    toggle.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) field.focus();
  };
  const output = el('section', undefined, 'mobile-result-output');
  root.append(output);

  const query = new URLSearchParams(location.search);
  const classCode = query.get('class')?.trim().toUpperCase() || null;
  const examMode = query.get('mode') || null;
  let active, refreshTimer;
  function reset() {
    active?.abort(); active = null;
    clearTimeout(refreshTimer);
    window.K67_ANSWER_EXPLANATIONS?.reset();
    output.replaceChildren();
    field.value = '';
    submit.disabled = false;
  }
  window.addEventListener('pagehide', reset);
  form.onsubmit = async event => {
    event.preventDefault();
    const code = field.value.trim();
    reset();
    if (!codePattern.test(code)) { message.textContent = 'Mã xem chưa hợp lệ. Hãy dán đầy đủ mã.'; field.focus(); return; }
    const controller = new AbortController();
    active = controller;
    const input = {code, classCode, examMode};
    const read = action => post(action, input, null, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
    const onError = error => {
      if (controller.signal.aborted) return;
      if ([403,409].includes(error.status)) reset();
      message.textContent = error.message || 'Chưa tải được kết quả.';
    };
    submit.disabled = true;
    message.textContent = 'Đang xác minh mã xem…';
    try {
      const payload = await read('result');
      if (controller.signal.aborted) return;
      const heading = el('h2', payload.studentName);
      heading.tabIndex = -1;
      const scores = el('div', undefined, 'mobile-result-card');
      scores.append(el('p', 'Listening · ' + score(payload.result.listening)), el('p', 'Reading · ' + score(payload.result.reading)));
      const writing = el('div', undefined, 'mobile-result-card');
      showWriting(writing, payload.writing);
      const questions = el('div', undefined, 'mobile-result-questions');
      const getReview = () => read('explanations').catch(error => {
        if (error.status === 403) onError(error);
        throw error;
      });
      questions.append(objective('Reading', payload.result.reading, payload, getReview),
        objective('Listening', payload.result.listening, payload, getReview));
      const exit = el('button', 'Đóng kết quả', 'button outline');
      exit.type = 'button';
      exit.onclick = () => {reset(); message.textContent = ''; field.focus();};
      output.append(heading, el('p', payload.className + ' · Term Test 2'), scores, writing, questions, exit);
      message.textContent = '';
      heading.focus();
      let writingFingerprint = JSON.stringify(payload.writing);
      // Recheck access and Writing without replacing the question nodes or current dialog.
      const refresh = async () => {
        if (controller.signal.aborted) return;
        try {
          if (!document.hidden) {
            const fresh = await read('result');
            if (controller.signal.aborted) return;
            const fingerprint = JSON.stringify(fresh.writing);
            if (fingerprint !== writingFingerprint) {
              showWriting(writing, fresh.writing);
              writingFingerprint = fingerprint;
            }
          }
        } catch (error) { onError(error); }
        if (!controller.signal.aborted) refreshTimer = setTimeout(refresh, 30000);
      };
      refreshTimer = setTimeout(refresh, 30000);
    } catch (error) { onError(error); }
    finally { if (active === controller) submit.disabled = false; }
  };
}

if (document.readyState === 'complete') mobile();
else window.addEventListener('DOMContentLoaded', mobile, {once:true});
