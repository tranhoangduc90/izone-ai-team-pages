import {readNameReview, selectionKey} from './student-review-entry.mjs?v=1';
import { DurableStore as ReadingStore } from '../ic2311-reading-retake-substitute1-k56/storage.mjs';
import { DurableStore as ListeningStore } from '../ic2311-listening-retake-substitute1-k56/storage.mjs';
import { API as readingApi } from '../ic2311-reading-retake-substitute1-k56/config.mjs';
import { API as listeningApi } from '../ic2311-listening-retake-substitute1-k56/config.mjs';

const byId = id => document.getElementById(id);
const definition = new Map([
  ['reading', { label: 'Reading', count: 26, Store: ReadingStore, api: readingApi }],
  ['listening', { label: 'Listening', count: 40, Store: ListeningStore, api: listeningApi }],
]);
const skill = new URLSearchParams(location.search).get('skill');
const setup = definition.get(skill);
const teacherMode = location.pathname.endsWith('/teacher.html');
const teacherAttempt = new URLSearchParams(location.search).get('attemptId');
const byName = new URLSearchParams(location.search).get('view')==='by-name';
const status = byId('result-status');
const retry = byId('result-retry');
let request;
let rendered;
let identityKey;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function table(headers, className, caption) {
  const node = element('table', undefined, className);
  if (caption) node.createCaption().textContent = caption;
  const row = node.createTHead().insertRow();
  for (const value of headers) {
    const th = element('th', value);
    th.scope = 'col';
    row.append(th);
  }
  return { node, body: node.createTBody() };
}

function appendCells(body, cells) {
  const row = body.insertRow();
  for (const value of cells) row.insertCell().textContent = value;
  return row;
}

function submission(state) {
  if (state?.phase !== 'submitted' || !state.serverConfirmed || state.pending || !state.permit || !state.identity) return null;
  const receiptId = typeof state.receipt === 'string' ? state.receipt : state.receipt?.receiptId;
  return receiptId ? { receiptId, key: state.identity.attemptId + ':' + receiptId } : null;
}

function matchingReview(value, state, receiptId) {
  const identity = value?.identity;
  if (!state?.identity) return false;
  const section = value?.result?.[skill];
  return identity?.testSlug === `ic2311-${skill}-retake-substitute1-k56` &&
    ['classCode', 'studentRef', 'attemptId', 'generation', 'contentVersion'].every(key => identity[key] === state.identity[key]) &&
    identity.receiptId === receiptId && (!state.sealed || identity.revision === state.sealed.revision) &&
    section?.total === setup.count && section.details?.length === setup.count &&
    section.details.every((detail, index) => detail.number === index + 1 && ['correct', 'incorrect', 'blank'].includes(detail.result)) &&
    section.correct === section.details.filter(detail => detail.result === 'correct').length &&
    (!value.bundle || value.bundle.testSlug === identity.testSlug);
}

function renderAnalysis(section) {
  const types = section.typeStats;
  if (!types?.length) return;
  const root = element('section', undefined, 'skill-performance-section');
  const heading = element('header', undefined, 'skill-performance-heading');
  const copy = element('div');
  copy.append(element('span', 'Phân tích riêng'), element('h3', setup.label));
  heading.append(copy, element('strong', `${section.correct}/${section.total} câu đúng`));
  const ratio = type => type.correct / type.total;
  const top = Math.max(...types.map(ratio));
  const bottom = Math.min(...types.map(ratio));
  const cards = element('div', undefined, 'analysis-grid');
  for (const [label, style, list] of [
    ['Dạng làm tốt nhất', 'best', types.filter(type => ratio(type) === top)],
    ['Dạng cần cải thiện', 'improve', top === bottom ? [] : types.filter(type => ratio(type) === bottom)],
  ]) {
    const card = element('article', undefined, `analysis-card ${style}`);
    const items = element('ul', undefined, 'analysis-list');
    for (const type of list) items.append(element('li', `${type.type}: ${type.correct}/${type.total} (${Math.round(ratio(type) * 100)}%)`));
    card.append(element('h4', label), list.length ? items : element('p', 'Các dạng đang có kết quả ngang nhau.'));
    cards.append(card);
  }
  const analysis = table(['Dạng bài', 'Đúng', 'Tổng', 'Tỷ lệ'], 'performance-table');
  for (const type of types) appendCells(analysis.body, [type.type, type.correct, type.total, `${Math.round(ratio(type) * 100)}%`]);
  const wrap = element('div', undefined, 'detail-table-wrap');
  wrap.append(analysis.node);
  root.append(heading, cards, wrap);
  byId('review-analysis').replaceChildren(root);
}

function render(review) {
  const signature = JSON.stringify(review);
  if (signature === rendered) return;
  rendered = signature;
  window.K67_ANSWER_EXPLANATIONS?.reset();
  const section = review.result[skill];
  byId('result-student').textContent = review.studentName || 'Bài làm của bạn';
  byId('result-meta').textContent = `${review.identity.classCode} · Substitute Test 1 · Khóa 56 · ${setup.label} thi lại`;
  if (!teacherMode && review.identity.receiptId) byId('result-receipt').textContent = 'Biên nhận nộp bài ' + review.identity.receiptId;
  const scores = table(['Kỹ năng', 'Điểm thực tế', 'Trạng thái'], 'substitute-score-table', 'Tổng hợp điểm thực tế');
  appendCells(scores.body, [setup.label, `${section.correct}/${section.total} câu đúng`, 'Đã chấm']);
  byId('review-score').replaceChildren(scores.node);

  const block = element('details', undefined, 'detail-block');
  block.dataset.skill = skill;
  block.open = true;
  const rows = table(['Câu', 'Bài làm', 'Đáp án đúng', 'Kết quả'], 'detail-table');
  const labels = { correct: ['✓', 'Đúng'], incorrect: ['✕', 'Sai'], blank: ['–', 'Bỏ trống'] };
  for (const detail of section.details) {
    const shownAnswer = detail.gradingNote ? `${detail.correctAnswer} · khóa chấm` : detail.correctAnswer;
    const row = appendCells(rows.body, [String(detail.number).padStart(2, '0') + '.', detail.studentAnswer || '—', shownAnswer]);
    row.className = `detail-row detail-row-${detail.result}`;
    const [icon, label] = labels[detail.result];
    const cell = row.insertCell();
    cell.className = `detail-result-cell result-${detail.result}`;
    const mark = element('span', icon, 'detail-result-icon');
    mark.setAttribute('aria-hidden', 'true');
    cell.append(mark, element('span', label));
  }
  const wrap = element('div', undefined, 'detail-table-wrap');
  wrap.append(rows.node);
  block.append(element('summary', `${setup.label} · xem chi tiết ${section.total} câu`), wrap);
  const container = byId('review-details');
  container.replaceChildren(block);
  byId('review-analysis').replaceChildren();
  renderAnalysis(section);
  if (review.bundle) {
    window.K67_ANSWER_EXPLANATIONS.attach({
      container, payload: { completed: true, result: review.result },
      testSlug: review.identity.testSlug, title: 'Substitute Test 1 · Khóa 56',
      reviewKey: review.identity.receiptId ?? review.identity.attemptId, loadReview: async () => ({ review }),
    });
  }
}

function clearResult() {
  rendered = undefined;
  byId('result-meta').textContent = '';
  byId('result-receipt').textContent = '';
  window.K67_ANSWER_EXPLANATIONS?.reset();
  for (const id of ['review-score', 'review-details', 'review-analysis']) byId(id).replaceChildren();
}

async function load() {
  if (!setup || request) return;
  const controller = new AbortController();
  request = controller;
  retry.hidden = true;
  let cached;
  try {
    const courseScope=skill==='listening'&&new URLSearchParams(location.search).get('course')==='56';
    const storage = await new setup.Store(courseScope?'k56:':'').open();
    const state = await storage.get('current');
    const current = submission(state);
    if (!current) {
      identityKey = undefined;
      clearResult();
      byId('result-student').textContent = 'Chưa có kết quả của lượt thi';
      status.textContent = state?.pending ? 'Bài đang chờ đồng bộ. Mở lại trang bài thi khi có mạng.' : '';
      return;
    }
    const { receiptId, key } = current;
    if (identityKey !== key) clearResult();
    identityKey = key;
    const cacheKey = 'review:' + key;
    const saved = await storage.get(cacheKey);
    if (matchingReview(saved?.review, state, receiptId)) cached = saved.review;
    if (!navigator.onLine && cached) {
      render(cached);
      status.textContent = 'Đang xem kết quả đã tải trên thiết bị này.';
      return;
    }
    const response = await fetch(`${setup.api}/review`, {
      method: 'POST', cache: 'no-store', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.permit}`, 'X-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({ receiptId }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    });
    if ([400, 401, 403, 404, 409].includes(response.status)) {
      cached = undefined;
      await storage.put(cacheKey, { review: null }).catch(() => {});
      clearResult();
      byId('result-student').textContent = 'Cần xác minh lượt thi';
      status.textContent = 'Lượt thi trên thiết bị này cần được đối soát. Hãy liên hệ giảng viên.';
      return;
    }
    if (!response.ok) throw new Error('Review unavailable');
    const { review } = await response.json();
    const latest = await storage.get('current');
    if (latest?.permit !== state.permit || submission(latest)?.key !== key || !matchingReview(review, latest, receiptId)) {
      cached = undefined;
      clearResult();
      throw new Error('Attempt changed');
    }
    controller.signal.throwIfAborted();
    render(review);
    status.textContent = review.bundle ? '' : 'Đã tải điểm và đáp án. Lời giải chi tiết đang được chuẩn bị.';
    retry.hidden = !!review.bundle;
    await storage.put(cacheKey, { review }).catch(() => {});
  } catch {
    if (controller.signal.aborted) return;
    if (cached) render(cached);
    if (!rendered) byId('result-student').textContent = 'Chưa tải được kết quả';
    status.textContent = cached ? 'Đang xem kết quả đã tải. Kết nối mạng để cập nhật.' : 'Hãy kết nối mạng rồi thử tải lại kết quả.';
    retry.hidden = false;
  } finally {
    request = undefined;
    if (controller.signal.reason === "attempt-changed") void load();
  }
}

async function loadTeacherReview() {
  if (request) return;
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(teacherAttempt ?? '')) {
    byId('result-student').textContent = 'Chọn bài đã nộp từ bảng giảng viên';
    return;
  }
  const controller = new AbortController();
  request = controller;
  retry.hidden = true;
  try {
    const response = await fetch(setup.api + '/teacher/review?' + new URLSearchParams({attemptId:teacherAttempt}), {
      cache:'no-store', credentials:'include',
      headers:{'X-Izone-Csrf':'1','X-Request-Id':crypto.randomUUID()},
      signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]),
    });
    if ([401,403,404].includes(response.status)) {
      clearResult();
      byId('result-student').textContent = 'Chưa mở được bài đã nộp';
      status.textContent = response.status===404 ? 'Hãy chọn lại bài từ bảng giảng viên.' : 'Hãy đăng nhập bằng tài khoản được cấp quyền tại bảng giảng viên.';
      return;
    }
    if (!response.ok) throw Error('Review unavailable');
    const {review}=await response.json();
    const identity=review?.identity;
    if (identity?.classCode!=='IC2311'||identity.attemptId!==teacherAttempt||
        !matchingReview(review,{identity},undefined)) throw Error('Wrong review');
    controller.signal.throwIfAborted();
    render(review);
    status.textContent = review.bundle ? '' : 'Đã tải điểm và đáp án. Lời giải chi tiết đang được chuẩn bị.';
  } catch {
    if (controller.signal.aborted) return;
    clearResult();
    byId('result-student').textContent = 'Chưa tải được kết quả';
    status.textContent = 'Hãy kết nối mạng rồi thử tải lại.';
    retry.hidden = false;
  } finally {
    request = undefined;
  }
}

function initNameReview() {
  const picker=byId('review-name');
  const heading=byId('result-student');
  let namedRequest;
  let rosterReady=false;
  let rosterLoading=false;

  async function showSelected() {
    namedRequest?.abort();
    clearResult();
    retry.hidden=true;
    const studentRef=picker.value;
    heading.textContent=studentRef?'Đang tải kết quả…':'Chọn tên để xem kết quả';
    status.textContent='';
    try {
      if (studentRef) sessionStorage.setItem(selectionKey(skill),studentRef);
      else sessionStorage.removeItem(selectionKey(skill));
    } catch {}
    if (!studentRef) return;

    const controller=new AbortController();
    namedRequest=controller;
    try {
      const payload=await readNameReview(setup.api,studentRef,{signal:controller.signal});
      controller.signal.throwIfAborted();
      if (!payload) {
        heading.textContent='Chưa có bài đã nộp';
        return;
      }
      const {review}=payload, identity=review?.identity;
      if (identity?.classCode!=='IC2311'||identity.studentRef!==studentRef||
          !matchingReview(review,{identity},undefined)) throw Error('Wrong review');
      render(review);
      status.textContent=review.bundle?'':'Đã tải điểm và đáp án. Lời giải chi tiết đang được chuẩn bị.';
    } catch {
      if (controller.signal.aborted) return;
      heading.textContent='Chưa tải được kết quả';
      status.textContent='Hãy kết nối mạng rồi thử lại.';
      retry.hidden=false;
    } finally {
      if (namedRequest===controller) namedRequest=undefined;
    }
  }

  async function loadRoster() {
    if (rosterLoading) return;
    rosterLoading=true;
    heading.textContent='Đang tải danh sách học viên…';
    retry.hidden=true;
    try {
      const r=await fetch(setup.api+'/roster',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(7000)});
      if (!r.ok) throw Error('Roster unavailable');
      const data=await r.json();
      if (data.classCode!=='IC2311'||data.testSlug!=='ic2311-'+skill+'-retake-substitute1-k56'||!Array.isArray(data.students)) throw Error('Wrong roster');
      picker.replaceChildren(new Option('Chọn tên',''),...data.students.map(s=>new Option(s.name,s.studentRef)));
      try { picker.value=sessionStorage.getItem(selectionKey(skill))??''; } catch {}
      byId('review-name-field').hidden=false;
      rosterReady=true;
      await showSelected();
    } catch {
      heading.textContent='Chưa tải được danh sách học viên';
      status.textContent='Hãy kết nối mạng rồi thử lại.';
      retry.hidden=false;
    } finally {
      rosterLoading=false;
    }
  }

  picker.onchange=showSelected;
  retry.onclick=()=>rosterReady?showSelected():loadRoster();
  addEventListener('pagehide',()=>namedRequest?.abort());
  addEventListener('pageshow',event=>{if(event.persisted)void retry.onclick();});
  void loadRoster();
}

if (setup && teacherMode) {
  byId('review-skill').textContent = setup.label;
  const back=byId('exam-link');
  back.href = '../ic2311-' + skill + '-retake-substitute1-k56/teacher.html';
  back.hidden = false;
  retry.onclick = loadTeacherReview;
  addEventListener('storage', event => {
    if (!['izone:teacher-sso-logout','izone:teacher-sso-login'].includes(event.key)) return;
    request?.abort();
    clearResult();
    byId('result-student').textContent = 'Phiên đăng nhập đã thay đổi';
    status.textContent = 'Quay lại bảng giảng viên để mở bài.';
    retry.hidden = true;
  });
  addEventListener('pagehide', () => {
    request?.abort();
    clearResult();
    byId('result-student').textContent = 'Đang xác minh phiên giảng viên…';
  });
  addEventListener('pageshow', event => { if (event.persisted) void loadTeacherReview(); });
  void loadTeacherReview();
} else if (setup) {
  byId('review-skill').textContent = setup.label;
  const back = byId('exam-link');
  back.href = `../ic2311-${skill}-retake-substitute1-k56/?result=0`;
  back.hidden = false;
  if (byName) initNameReview();
  else initSavedReview();
} else {
  byId('result-student').textContent = 'Chọn kết quả cần xem';
  for (const [name, item] of definition) {
    const link = element('a', `Kết quả ${item.label}`);
    link.href = `?skill=${name}`;
    const line = element('p');
    line.append(link);
    status.append(line);
  }
}

function initSavedReview() {
  const pick=byId('pick-name-link');
  pick.href='?' + new URLSearchParams({skill,view:'by-name'});
  pick.hidden=false;
  retry.onclick = load;
  addEventListener('online', load);
  addEventListener('pagehide', () => request?.abort());
  addEventListener('pageshow', event => { if (event.persisted) void load(); });
  addEventListener('storage', event => {
    if (event.key !== null && !/^izone-(reading|listening)-retake:v1:current$/.test(event.key)) return;
    clearResult();
    byId('result-student').textContent = 'Đang xác minh lượt thi…';
    const previous = request;
    previous?.abort('attempt-changed');
    if (!previous) void load();
  });
  navigator.serviceWorker?.register('sw.js').catch(() => {});
  void load();
}
