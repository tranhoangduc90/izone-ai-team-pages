
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

const band = value => value == null || !Number.isFinite(Number(value)) ? '—' : String(Number(value));

function appendWritingText(parent, value) {
  const tokens = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\([^)]+\)/g;
  let end = 0;
  for (const match of value.matchAll(tokens)) {
    parent.append(value.slice(end, match.index));
    parent.append(match[1] ? el('strong', match[1]) : match[2] ? el('em', match[2]) : match[3]);
    end = match.index + match[0].length;
  }
  parent.append(value.slice(end));
}

function appendWritingMarkdown(target, value) {
  let list;
  let paragraph;
  for (const raw of value.split('\n')) {
    const line = raw.trim();
    if (!line || /^-{3,}$/.test(line)) { list = paragraph = null; continue; }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    const bullet = /^(?:([-*])|(\d+)\.)\s+(.+)$/.exec(line);
    if (heading) {
      const title = el('h5');
      appendWritingText(title, heading[1]);
      target.append(title);
      list = paragraph = null;
    } else if (bullet) {
      const tag = bullet[2] ? 'ol' : 'ul';
      if (list?.localName !== tag) {
        list = el(tag);
        if (bullet[2]) list.start = Number(bullet[2]);
        target.append(list);
      }
      const item = el('li');
      appendWritingText(item, bullet[3]);
      list.append(item);
      paragraph = null;
    } else {
      if (!paragraph) { paragraph = el('p'); target.append(paragraph); }
      else paragraph.append(' ');
      appendWritingText(paragraph, line);
      list = null;
    }
  }
}

const writingBlock = new Set(['p','div','ul','ol','li','blockquote','table','thead','tbody','tfoot','tr','th','td']);
const writingInline = new Set(['strong','b','em','i','span','br']);
const ignoredWritingTags = new Set(['script','style','template','iframe','object','embed','svg','math','form','button','textarea']);

function appendWritingFeedback(target, value) {
  const source = String(value || '').replace(/\r/g, '').trim();
  if (!source) return;
  // Parse in a template so report HTML is inert. Recreate only supported tags and never copy attributes.
  const template = document.createElement('template');
  template.innerHTML = source;
  function copy(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) { appendWritingText(parent, node.textContent); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || ignoredWritingTags.has(node.localName)) return;
    const tag = node.localName;
    const safeTag = /^h[1-6]$/.test(tag) ? 'h5'
      : writingBlock.has(tag) || writingInline.has(tag) ? tag : null;
    const targetNode = safeTag ? el(safeTag) : parent;
    for (const child of node.childNodes) copy(child, targetNode);
    if (safeTag) parent.append(targetNode);
  }
  // Mixed legacy reports start with HTML and continue with Markdown after the score summary.
  for (const node of template.content.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) appendWritingMarkdown(target, node.textContent);
    else copy(node, target);
  }
}

function writingPart(parent, value, className) {
  if (!String(value || '').trim()) return null;
  const part = el('div', undefined, className + ' writing-feedback-richtext');
  appendWritingFeedback(part, value);
  parent.append(part);
  return part;
}

function criterionSections(value) {
  const sections = [];
  let current;
  for (const line of value.split('\n')) {
    const heading = /^#{2,6}\s+(.*)$/.exec(line)?.[1]?.replaceAll('**', '').trim();
    if (heading && /^KẾT LUẬN/i.test(heading)) break;
    if (heading && /^\d+\.\s/.test(heading)) {
      current = {title:heading, lines:[]};
      sections.push(current);
    } else if (current) current.lines.push(line);
  }
  return sections;
}

function criterionCard(criterion) {
  const card = el('article', undefined, 'writing-criterion-card');
  const header = el('header');
  header.append(el('h4', criterion.name || criterion.code), el('strong', 'Band ' + band(criterion.bandScore)));
  card.append(header);
  const feedback = String(criterion.feedback || '');
  const components = criterion.components || [];
  const sections = criterionSections(feedback);
  if (!components.length && !sections.length) {
    writingPart(card, feedback, 'writing-feedback-text');
    return card;
  }
  const parts = el('div', undefined, 'writing-component-list');
  for (let index = 0; index < Math.max(components.length, sections.length); index++) {
    const component = components[index];
    const section = sections[index];
    const part = el('section', undefined, 'writing-component');
    part.append(el('h5', section?.title || component?.label || component?.code || 'Nhận xét'));
    writingPart(part, component?.summary || section?.lines.join('\n'), 'writing-component-summary');
    if (component?.feedback) {
      const detail = el('details');
      detail.append(el('summary', 'Xem phân tích chi tiết và cách cải thiện', 'writing-component-toggle'));
      writingPart(detail, component.feedback, 'writing-component-detail');
      part.append(detail);
    }
    parts.append(part);
  }
  card.append(parts);
  const conclusion = /^#{2,6}\s+(?:\*\*)?KẾT LUẬN(?:\*\*)?\s*$/im.exec(feedback);
  if (conclusion) {
    const text = feedback.slice(conclusion.index + conclusion[0].length).trim();
    if (text) {
      const block = el('section', undefined, 'writing-feedback-text');
      block.append(el('h5', 'Kết luận và giới hạn điểm'));
      writingPart(block, text, 'writing-feedback-text');
      card.append(block);
    }
  }
  return card;
}

function openWritingFeedback(task, opener) {
  const label = 'Task ' + task.taskNumber;
  const dialog = el('dialog', undefined, 'writing-feedback-dialog mobile-writing-feedback');
  const shell = el('div', undefined, 'writing-feedback-shell');
  const header = el('header', undefined, 'writing-feedback-header');
  const heading = el('div');
  const title = el('h2', label + ' · Band ' + band(task.taskScore));
  title.id = 'mobileWritingFeedbackTitle';
  dialog.setAttribute('aria-labelledby', title.id);
  heading.append(el('span', 'Kết quả ' + label), title);
  const blank = task.gradingMethod === 'blank_rule';
  const meta = blank ? 'Điểm theo quy tắc bài trắng' : 'Chấm theo 4 tiêu chí IELTS';
  heading.append(el('p', Number.isFinite(task.wordCount) ? task.wordCount + ' từ · ' + meta : meta));
  const close = el('button', '×', 'writing-feedback-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Đóng bài chấm Writing');
  close.addEventListener('click', () => dialog.close());
  header.append(heading, close);
  const layout = el('div', undefined, 'writing-feedback-layout');
  const scores = el('section', undefined, 'writing-feedback-scores');
  const criteria = task.criteria || [];
  if (criteria.length && !blank) {
    scores.append(el('h3', 'Nhận xét theo tiêu chí'), ...criteria.map(criterionCard));
  } else {
    scores.append(el('h3', blank ? 'Quy tắc tính điểm' : 'Nhận xét tổng hợp'));
    if (!writingPart(scores, task.report, 'writing-feedback-text')) {
      scores.append(el('p', 'Chưa có nhận xét chi tiết.'));
    }
  }
  layout.append(scores);
  shell.append(header, layout);
  dialog.append(shell);
  let pointerDownOutside = false;
  dialog.addEventListener('pointerdown', event => { pointerDownOutside = event.target === dialog; });
  dialog.addEventListener('click', event => {
    if (pointerDownOutside && event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (opener.isConnected) opener.focus({preventScroll:true});
  }, {once:true});
  document.body.append(dialog);
  dialog.showModal();
}

function showWriting(target, writing, refreshResult) {
  const grading = writing?.grading;
  const section = el('section', undefined, 'writing-result-section');
  const heading = el('header', undefined, 'writing-result-heading');
  const label = el('div');
  const needsReview = grading?.status === 'review_required';
  label.append(el('span', grading?.ready ? 'Kết quả Writing' : 'Bài Writing đã nộp'),
    el('h3', grading?.ready ? 'Điểm và bài chấm Writing'
      : needsReview ? 'Bài Writing đang được kiểm tra' : 'Bài Writing của bạn đang được chấm'));
  heading.append(label, el('p', grading?.ready ? 'Nhấn vào điểm Task 1 hoặc Task 2 để xem bài chấm chi tiết.'
    : 'Kết quả sẽ hiển thị tại đây khi bài chấm hoàn tất.'));
  section.append(heading);
  if (grading?.ready) {
    const grid = el('div', undefined, 'writing-score-grid');
    for (const task of [...(grading.tasks || [])].sort((a,b) => a.taskNumber - b.taskNumber)) {
      const button = el('button', undefined, 'writing-score-card is-action');
      button.type = 'button';
      button.append(el('span', 'Writing Task ' + task.taskNumber),
        el('strong', 'Band ' + band(task.taskScore)), el('small', 'Xem bài chấm chi tiết →'));
      button.onclick = () => openWritingFeedback(task, button);
      grid.append(button);
    }
    const overall = el('article', undefined, 'writing-score-card is-overall');
    overall.append(el('span', 'Writing tổng'), el('strong', 'Band ' + band(grading.writingScore)),
      el('small', 'Task 1 × 1 · Task 2 × 2'));
    grid.append(overall);
    section.append(grid);
  } else {
    const status = el('div', undefined, 'writing-grading-status' + (needsReview ? ' needs-review' : ''));
    const copy = el('div');
    copy.append(el('strong', needsReview ? 'Bài chấm đang được kiểm tra' : 'Đang chấm Task 1 và Task 2'),
      el('p', 'Bài làm đã được lưu trên hệ thống.'));
    status.append(copy);
    if (refreshResult) {
      const button = el('button', 'Kiểm tra kết quả ngay', 'button button-secondary');
      button.type = 'button';
      button.onclick = async () => {
        button.disabled = true;
        try { await refreshResult(); }
        finally { if (button.isConnected) button.disabled = false; }
      };
      status.append(button);
    }
    section.append(status);
  }
  target.replaceChildren(section);
}

function summaryCard(label, value) {
  const card = el('article', undefined, 'summary-card');
  card.append(el('span', label), el('strong', value));
  return card;
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
  const panel = el('section', undefined, 'panel result-panel mobile-result-panel');
  const identity = el('header', undefined, 'result-heading');
  const identityCopy = el('div');
  identityCopy.append(el('p', 'Kết quả cá nhân', 'eyebrow'), heading, el('p', payload.className + ' · Term Test 2'));
  identity.append(identityCopy);
  const scores = el('div', undefined, 'summary-grid');
  scores.append(summaryCard('Listening', score(payload.result.listening)), summaryCard('Reading', score(payload.result.reading)));
  const writing = el('div');
  showWriting(writing, payload.writing, refreshResult && updateWriting);
  const questions = el('div', undefined, 'mobile-result-questions');
  questions.append(objective('Reading', payload.result.reading, payload, getReview),
    objective('Listening', payload.result.listening, payload, getReview));
  panel.append(identity, scores, writing, questions);
  root.replaceChildren(panel);
  if (onClose) {
    const exit = el('button', 'Đóng kết quả', 'button outline');
    exit.type = 'button';
    exit.onclick = onClose;
    panel.append(exit);
  }
  heading.focus({preventScroll:true, focusVisible:false});
  let timer;
  let closed = false;
  let writingFingerprint = JSON.stringify(payload.writing);
  let pending;
  function updateWriting() {
    if (closed) return Promise.resolve();
    if (!pending) pending = (async () => {
      try {
        const fresh = await refreshResult();
        if (closed) return;
        const fingerprint = JSON.stringify(fresh.writing);
        if (fingerprint !== writingFingerprint) {
          showWriting(writing, fresh.writing, updateWriting);
          writingFingerprint = fingerprint;
        }
      } catch (error) { if (!closed) onAccessError?.(error); }
      finally { pending = undefined; }
    })();
    return pending;
  }
  const refresh = async () => {
    if (!document.hidden) await updateWriting();
    if (!closed) timer = setTimeout(refresh, 30000);
  };
  if (refreshResult) timer = setTimeout(refresh, 30000);
  return () => {
    closed = true;
    clearTimeout(timer);
    document.querySelector('dialog.mobile-writing-feedback')?.close();
    window.K67_ANSWER_EXPLANATIONS?.reset();
    root.replaceChildren();
  };
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
    notice.hidden = false;
    status.textContent = 'Đang tải kết quả…';
    const read = action => post(action, input, null, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
    const fail = error => {
      if (signal.aborted) return;
      if ([403,409].includes(error.status)) reset();
      retry.hidden = error.status === 403;
      notice.hidden = false;
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
      notice.hidden = true;
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
