
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

export function mountDesktopReviewLink(getOwner) {
  const result = document.getElementById('resultView');
  if (!result || result.querySelector('[data-mobile-review-link]')) return;
  const group = el('section', undefined, 'mobile-result-code');
  group.dataset.mobileReviewLink = '';
  const button = el('button', 'Lấy link xem trên điện thoại', 'button outline');
  button.type = 'button';
  const message = el('p');
  message.setAttribute('role', 'status');
  const field = el('input');
  field.type = 'text'; field.readOnly = true; field.hidden = true;
  field.setAttribute('aria-label', 'Link xem kết quả trên điện thoại');
  field.addEventListener('focus', () => field.select());
  const open = el('a', 'Mở link kết quả'); open.hidden = true;
  open.target = '_blank'; open.rel = 'noopener noreferrer';
  const copy = el('button', 'Sao chép link', 'button outline'); copy.type = 'button'; copy.hidden = true;
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(field.value); message.textContent = 'Đã sao chép link.'; }
    catch { field.focus(); }
  };
  group.append(button, message, field, copy, open);
  result.append(group);
  let generation = 0;
  const clear = () => { generation++; open.hidden = true; open.removeAttribute('href'); copy.hidden = true; field.hidden = true; field.value = ''; message.textContent = ''; button.disabled = false; };
  new MutationObserver(() => { if (result.hidden) clear(); }).observe(result, {attributes:true, attributeFilter:['hidden']});
  window.addEventListener('pagehide', clear);
  button.onclick = async () => {
    clear();
    const epoch = generation;
    button.disabled = true;
    message.textContent = 'Đang tạo link…';
    try {
      const owner = await getOwner();
      if (!owner) throw Error('Chưa xác nhận được lượt thi trên thiết bị này.');
      const {permit, ...scope} = owner;
      const data = await post('issue', scope, permit);
      if (epoch !== generation || result.hidden) return;
      if (!codePattern.test(data.code || '')) throw Error('Máy chủ chưa cấp được link xem.');
      const link = new URL(location.href);
      link.hash = 'xem=' + data.code;
      field.value = link.href;
      open.href = link.href;
      open.hidden = false;
      copy.hidden = false;
      field.hidden = false;
      message.textContent = 'Mở link này trên điện thoại để xem ngay. Link cá nhân có hiệu lực 24 giờ.';
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

export function renderMobileResult(root, payload, {getReview, refreshResult, onAccessError, onClose} = {}) {
  const heading = el('h2', payload.studentName);
  heading.tabIndex = -1;
  const scores = el('div', undefined, 'mobile-result-card');
  scores.append(el('p', 'Listening · ' + score(payload.result.listening)), el('p', 'Reading · ' + score(payload.result.reading)));
  const writing = el('div', undefined, 'mobile-result-card');
  showWriting(writing, payload.writing);
  const questions = el('div', undefined, 'mobile-result-questions');
  questions.append(objective('Reading', payload.result.reading, payload, getReview),
    objective('Listening', payload.result.listening, payload, getReview));
  root.replaceChildren(heading, el('p', payload.className + ' · Term Test 2'), scores, writing, questions);
  if (onClose) {
    const exit = el('button', 'Đóng kết quả', 'button outline');
    exit.type = 'button';
    exit.onclick = onClose;
    root.append(exit);
  }
  heading.focus();
  let timer;
  let closed = false;
  let writingFingerprint = JSON.stringify(payload.writing);
  const refresh = async () => {
    if (closed) return;
    try {
      if (!document.hidden) {
        const fresh = await refreshResult();
        if (closed) return;
        const fingerprint = JSON.stringify(fresh.writing);
        if (fingerprint !== writingFingerprint) {
          showWriting(writing, fresh.writing);
          writingFingerprint = fingerprint;
        }
      }
    } catch (error) { if (!closed) onAccessError?.(error); }
    if (!closed) timer = setTimeout(refresh, 30000);
  };
  if (refreshResult) timer = setTimeout(refresh, 30000);
  return () => { closed = true; clearTimeout(timer); window.K67_ANSWER_EXPLANATIONS?.reset(); root.replaceChildren(); };
}

function boot() {
  if (!window.TERM_TEST_APP_CONFIG) return;
  const root = document.querySelector('#app');
  if (!root) return;
  const code = new URLSearchParams(location.hash.slice(1)).get('xem');
  if (code === null && !window.IZONE_EXAM_DEVICE_BLOCKED) return;
  document.body.classList.add('term2-mobile-results');
  const notice = el('section', undefined, 'exam-device-notice');
  const status = el('p');
  status.setAttribute('role', 'status');
  notice.append(el('h1', code === null ? 'Bài thi cần thực hiện trên máy tính' : 'Kết quả Term Test 2'), status);
  const output = el('section', undefined, 'mobile-result-output');
  root.replaceChildren(notice, output);
  if (code === null) {
    status.textContent = 'Bắt đầu và tiếp tục thi trên máy tính. Để xem điểm và lời giải trên điện thoại, mở link cá nhân lấy từ màn kết quả trên máy tính.';
    return;
  }
  if (!codePattern.test(code)) {
    status.textContent = 'Link xem kết quả chưa đầy đủ. Hãy lấy link mới trên máy tính.';
    return;
  }
  const query = new URLSearchParams(location.search);
  const input = {code, classCode:query.get('class')?.trim().toUpperCase() || null, examMode:query.get('mode') || null};
  let controller, clear;
  const reset = () => { controller?.abort(); clear?.(); clear = undefined; };
  const retry = el('button', 'Thử lại', 'button outline');
  retry.type = 'button';
  retry.hidden = true;
  notice.append(retry);
  async function openResult() {
    reset();
    controller = new AbortController();
    const signal = controller.signal;
    retry.hidden = true;
    status.textContent = 'Đang tải kết quả…';
    const read = action => post(action, input, null, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
    const fail = error => {
      if (signal.aborted) return;
      if ([403,409].includes(error.status)) reset();
      retry.hidden = error.status === 403;
      status.textContent = error.message || 'Chưa tải được kết quả.';
    };
    try {
      const payload = await read('result');
      if (signal.aborted) return;
      const getReview = () => read('explanations').catch(error => {
        if (error.status === 403) fail(error);
        throw error;
      });
      clear = renderMobileResult(output, payload, {getReview, refreshResult:() => read('result'), onAccessError:fail});
      status.textContent = '';
    } catch (error) { fail(error); }
  }
  retry.onclick = openResult;
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', event => {if (event.persisted) void openResult();});
  void openResult();
}
window.addEventListener('hashchange', event => {
  const hadReview = new URLSearchParams(new URL(event.oldURL).hash.slice(1)).has('xem');
  const hasReview = new URLSearchParams(location.hash.slice(1)).has('xem');
  if (hadReview || hasReview) location.reload();
});
if (document.readyState === 'complete') boot();
else window.addEventListener('DOMContentLoaded', boot, {once:true});
