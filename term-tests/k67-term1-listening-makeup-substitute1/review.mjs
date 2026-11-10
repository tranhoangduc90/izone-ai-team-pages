import { DurableStore } from '../ic2311-listening-retake-substitute1-k56/storage.mjs';
import { API, SLUG } from './config.mjs?v=1';
const byId = id => document.getElementById(id);
const skill = 'listening';
const setup = { label: 'Listening', count: 40 };
let rendered;
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
  return identity?.testSlug === SLUG &&
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
  byId('result-meta').textContent = `${review.identity.classCode} · Substitute Test 1 · Khóa 67 · ${setup.label} thi lại`;
  if (review.identity.receiptId) byId('result-receipt').textContent = 'Biên nhận nộp bài ' + review.identity.receiptId;
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
      testSlug: review.identity.testSlug, title: 'Substitute Test 1 · Khóa 67',
      reviewKey: review.identity.receiptId ?? review.identity.attemptId, loadReview: async () => ({ review }),
    });
  }
}


async function load() {
  const status = byId('result-status');
  const retry = byId('result-retry');
  retry.hidden = true;
  try {
    const storage = await new DurableStore('k67-makeup:').open();
    const state = await storage.get('current');
    const submitted = submission(state);
    if (!submitted) {
      byId('result-student').textContent = 'Chưa tìm thấy bài nộp đã xác nhận trên thiết bị này';
      status.textContent = 'Mở trên trình duyệt đã làm bài hoặc liên hệ giảng viên.';
      return;
    }
    const response = await fetch(API + '/review', {
      method: 'POST', cache: 'no-store',
      headers: {Authorization: 'Bearer ' + state.permit, 'Content-Type': 'application/json'},
      body: JSON.stringify({receiptId: submitted.receiptId}),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('REVIEW_UNAVAILABLE');
    const {review} = await response.json();
    if (!matchingReview(review, state, submitted.receiptId)) throw new Error('REVIEW_SCOPE_MISMATCH');
    render(review);
    status.textContent = 'Máy chủ đã xác nhận bài và điểm Listening.';
  } catch {
    byId('result-student').textContent = 'Chưa tải được kết quả';
    status.textContent = 'Hãy kiểm tra kết nối và thử tải lại.';
    retry.hidden = false;
  }
}
byId('result-retry').addEventListener('click', load);
void load();
