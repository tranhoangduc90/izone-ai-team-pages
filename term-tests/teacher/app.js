/*
 * Dữ liệu nhận vào: Google ID token và JSON kết quả lớp từ API đã phân quyền.
 * Xử lý: tải lớp/bài test được phép xem, tạo tab tổng quan và tab cá nhân, rồi dựng lại màn hình kết quả chi tiết.
 * Kết quả: giảng viên thấy Band cả lớp và từng câu đúng/sai mà không nhận ID ERP, email hay token lượt làm.
 * Khi lỗi: trang giữ nguyên dữ liệu cũ nếu có và hiện thông báo rõ để giảng viên đăng nhập lại hoặc thử tải lại.
 */

import {
  formatBand,
  statusLabel,
  summarizeStudents,
  writingStatusLabel,
  writingTaskStateLabel
} from './model.js?rev=20260904-k56-demo-v1';
import { createSessionStore } from './auth-session.js?rev=20260903-remember-login-v1';

const appConfig = window.TERM_TEST_APP_CONFIG || {};
const sessionStore = createSessionStore({
  apiBaseUrl: appConfig.API_BASE_URL,
  clientId: appConfig.GOOGLE_CLIENT_ID,
  getStorage: () => window.sessionStorage
});
let loginGeneration = 0;
const initialParams = new URLSearchParams(window.location.search);
const state = {
  idToken: '',
  reviewer: null,
  classes: [],
  tests: [],
  students: [],
  selectedClassId: '',
  selectedTestSlug: '',
  selectedTab: initialParams.get('student') || 'overview',
  resultsLoading: false,
  writingDetailCache: new Map(),
  attemptReviewCache: new Map(),
  connected: false
};

const elements = Object.fromEntries([
  'notice', 'accessView', 'googleSignInButton', 'dashboardView', 'loginBadge', 'refreshButton', 'logoutButton',
  'classSelect', 'testSelect', 'reviewerName', 'teacherTabs', 'teacherTabsPrev', 'teacherTabsNext', 'overviewView', 'overviewTitle',
  'resultCount', 'classSummary', 'overviewBody', 'studentView'
].map(id => [id, document.getElementById(id)]));

function showNotice(message, kind = '') {
  elements.notice.textContent = message;
  elements.notice.className = `notice${kind ? ` ${kind}` : ''}`;
}

function createNode(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function studentDisplayName(student) {
  return student.temporary ? `${student.name} (mã tạm)` : student.name;
}

function getSelectedClass() {
  return state.classes.find(item => item.id === state.selectedClassId) || null;
}

function getSelectedTest() {
  return state.tests.find(item => item.slug === state.selectedTestSlug) || null;
}

function configuredWritingTasks() {
  const configured = getSelectedTest()?.writingTasks;
  if (Array.isArray(configured)) return configured.map(Number).filter(number => [1, 2].includes(number));
  if (state.selectedTestSlug === 'mini-test-lesson-5') return [];
  if (['term-test-1', 'term-test-1-k56'].includes(state.selectedTestSlug)) return [2];
  return [1, 2];
}

function scoreMode() {
  return getSelectedTest()?.scoreMode === 'raw' ? 'raw' : 'band';
}

function formatSectionScore(section) {
  if (!section) return '—';
  return scoreMode() === 'raw'
    ? `${Number(section.correct) || 0}/${Number(section.total) || 0}`
    : formatBand(section.band);
}

function updateUrl() {
  const url = new URL(window.location.href);
  const selectedClass = getSelectedClass();
  if (selectedClass) url.searchParams.set('class', selectedClass.name);
  if (state.selectedTestSlug) url.searchParams.set('test', state.selectedTestSlug);
  if (state.selectedTab !== 'overview') url.searchParams.set('student', state.selectedTab);
  else url.searchParams.delete('student');
  window.history.replaceState({}, '', url);
}

async function apiRequest(path) {
  if (!appConfig.API_BASE_URL) throw new Error('Chưa cấu hình địa chỉ API.');
  if (!state.idToken) throw new Error('Bạn chưa đăng nhập Google.');
  if (!sessionStore.usable(state.idToken)) {
    resetLoginAfterError();
    throw new Error('Phiên Google đã hết hạn; hãy đăng nhập lại.');
  }
  const generation = loginGeneration;
  const response = await fetch(`${appConfig.API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${state.idToken}` },
    cache: 'no-store'
  }).catch(error => {
    if (generation !== loginGeneration) error.staleSession = true;
    throw error;
  });
  const payload = await response.json().catch(() => null);
  // Bỏ phản hồi đến muộn sau đăng xuất hoặc đổi tài khoản, không dựng lại dữ liệu cũ.
  if (generation !== loginGeneration) {
    throw Object.assign(new Error('Lượt đăng nhập đã thay đổi.'), { staleSession: true });
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) resetLoginAfterError();
    if (response.status === 401) throw new Error('Phiên Google đã hết hạn; hãy đăng nhập lại.');
    if (response.status === 403) throw new Error(payload?.message || 'Tài khoản chưa được cấp quyền cho lớp này.');
    throw new Error(payload?.message || `API trả về mã ${response.status}.`);
  }
  if (!payload?.ok) throw new Error(payload?.message || payload?.error || 'API không xác nhận yêu cầu.');
  return payload;
}

function fillSelect(select, items, valueKey, labelKey) {
  select.replaceChildren(...items.map(item => {
    const option = document.createElement('option');
    option.value = item[valueKey];
    option.textContent = item[labelKey];
    return option;
  }));
}

function chooseInitialFilters() {
  const requestedClass = (initialParams.get('class') || '').trim().toUpperCase();
  const requestedTest = (initialParams.get('test') || '').trim();
  const selectedClass = state.classes.find(item => item.name.toUpperCase() === requestedClass || item.id === requestedClass)
    || state.classes[0];
  const selectedTest = state.tests.find(item => item.slug === requestedTest) || state.tests[0];
  state.selectedClassId = selectedClass?.id || '';
  state.selectedTestSlug = selectedTest?.slug || '';
  elements.classSelect.value = state.selectedClassId;
  elements.testSelect.value = state.selectedTestSlug;
}

async function loadOptions() {
  const payload = await apiRequest('/api/term-tests/teacher/options');
  state.reviewer = payload.reviewer;
  state.classes = payload.classes || [];
  state.tests = payload.tests || [];
  if (!state.classes.length) throw new Error('Tài khoản chưa được cấp quyền xem lớp nào.');
  if (!state.tests.length) throw new Error('Chưa có bài test nào đang hoạt động.');
  fillSelect(elements.classSelect, state.classes, 'id', 'name');
  fillSelect(elements.testSelect, state.tests, 'slug', 'title');
  chooseInitialFilters();
  elements.reviewerName.textContent = state.reviewer.displayName || state.reviewer.email;
  elements.loginBadge.textContent = `Đã đăng nhập: ${state.reviewer.displayName || state.reviewer.email}`;
  elements.refreshButton.hidden = false;
  elements.logoutButton.hidden = false;
  elements.accessView.hidden = true;
  elements.dashboardView.hidden = false;
  state.connected = true;
}

function addTeacherSummaryCard(label, value) {
  const card = createNode('article', 'teacher-summary-card');
  card.append(createNode('span', '', label), createNode('strong', '', value));
  return card;
}

function renderClassSummary() {
  const mode = scoreMode();
  const totals = getSelectedTest()?.sectionTotals || {};
  const summary = summarizeStudents(state.students, mode);
  elements.classSummary.replaceChildren(
    addTeacherSummaryCard('Sĩ số', String(summary.total)),
    addTeacherSummaryCard('Đã hoàn thành', `${summary.completed}/${summary.total}`),
    addTeacherSummaryCard(
      mode === 'raw' ? 'Listening đúng trung bình' : 'Listening trung bình',
      mode === 'raw' ? `${formatBand(summary.listeningAverage, 2)}/${totals.listening || 40}` : formatBand(summary.listeningAverage, 2)
    ),
    addTeacherSummaryCard(
      mode === 'raw' ? 'Reading đúng trung bình' : 'Reading trung bình',
      mode === 'raw' ? `${formatBand(summary.readingAverage, 2)}/${totals.reading || 40}` : formatBand(summary.readingAverage, 2)
    ),
    addTeacherSummaryCard(
      mode === 'raw' ? 'Tổng câu đúng trung bình' : 'Band tổng trung bình',
      mode === 'raw'
        ? `${formatBand(summary.overallAverage, 2)}/${(totals.listening || 40) + (totals.reading || 40)}`
        : formatBand(summary.overallAverage, 2)
    ),
    addTeacherSummaryCard('Writing đã chấm', String(summary.writingReady)),
    addTeacherSummaryCard('Writing đang chấm', String(summary.writingProcessing)),
    addTeacherSummaryCard('Writing cần kiểm tra', String(summary.writingReviewRequired))
  );
}

function renderTabs() {
  const overviewButton = createNode('button', `teacher-tab${state.selectedTab === 'overview' ? ' active' : ''}`, 'Tổng quan');
  overviewButton.type = 'button';
  overviewButton.dataset.tab = 'overview';
  overviewButton.setAttribute('role', 'tab');
  overviewButton.setAttribute('aria-selected', String(state.selectedTab === 'overview'));

  const studentButtons = state.students.map(student => {
    const button = createNode('button', `teacher-tab${state.selectedTab === student.ref ? ' active' : ''}`);
    button.type = 'button';
    button.dataset.tab = student.ref;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(state.selectedTab === student.ref));
    button.append(
      createNode('span', `teacher-tab-status ${student.status}`),
      document.createTextNode(studentDisplayName(student))
    );
    return button;
  });
  elements.teacherTabs.replaceChildren(overviewButton, ...studentButtons);
  requestAnimationFrame(() => refreshTabScrollLayout('auto'));
}

function updateTabScrollControls() {
  const maxScrollLeft = Math.max(0, elements.teacherTabs.scrollWidth - elements.teacherTabs.clientWidth);
  const hasOverflow = maxScrollLeft > 2;
  elements.teacherTabsPrev.hidden = !hasOverflow;
  elements.teacherTabsNext.hidden = !hasOverflow;
  elements.teacherTabsPrev.disabled = !hasOverflow || elements.teacherTabs.scrollLeft <= 2;
  elements.teacherTabsNext.disabled = !hasOverflow || elements.teacherTabs.scrollLeft >= maxScrollLeft - 2;
}

function scrollActiveTabIntoView(behavior = 'smooth') {
  const activeTab = elements.teacherTabs.querySelector('.teacher-tab.active');
  if (!activeTab) return;
  const viewport = elements.teacherTabs.getBoundingClientRect();
  const tab = activeTab.getBoundingClientRect();
  if (tab.left < viewport.left) {
    elements.teacherTabs.scrollBy({ left: tab.left - viewport.left - 8, behavior });
  } else if (tab.right > viewport.right) {
    elements.teacherTabs.scrollBy({ left: tab.right - viewport.right + 8, behavior });
  }
}

function scrollTeacherTabs(direction) {
  const distance = Math.max(180, Math.round(elements.teacherTabs.clientWidth * 0.75));
  elements.teacherTabs.scrollBy({ left: direction * distance, behavior: 'smooth' });
}

function refreshTabScrollLayout(behavior = 'auto') {
  updateTabScrollControls();
  requestAnimationFrame(() => {
    scrollActiveTabIntoView(behavior);
    updateTabScrollControls();
  });
}

function renderOverviewRows() {
  elements.overviewBody.replaceChildren(...state.students.map(student => {
    const result = student.result;
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.append(createNode('span', 'teacher-student-name', studentDisplayName(student)));
    const listeningCell = createNode('td', 'teacher-band', result ? formatSectionScore(result.listening) : '—');
    const readingCell = createNode('td', 'teacher-band', result ? formatSectionScore(result.reading) : '—');
    const writing = student.writing || { status: 'not_submitted' };
    const taskNumbers = configuredWritingTasks();
    const writingCell = document.createElement('td');
    const writingMain = taskNumbers.length === 0
      ? 'Không có Writing'
      : writing.status === 'ready'
      ? `Band ${formatBand(Number(writing.writingScore))}`
      : writingStatusLabel(writing.status);
    writingCell.append(
      createNode('span', `teacher-writing-status ${taskNumbers.length ? writing.status : 'not_submitted'}`, writingMain),
      createNode(
        'small',
        'teacher-writing-tasks',
        taskNumbers.map(taskNumber => writing.status === 'ready'
          ? `Task ${taskNumber}: ${formatBand(Number(writing[`task${taskNumber}Score`]))}`
          : `Task ${taskNumber}: ${writingTaskStateLabel(writing[`task${taskNumber}State`])}`
        ).join(' · ')
      )
    );
    const statusCell = document.createElement('td');
    statusCell.append(createNode('span', `teacher-status ${student.status}`, statusLabel(student.status)));
    const actionCell = document.createElement('td');
    const openButton = createNode('button', 'button button-secondary teacher-open-button', 'Xem');
    openButton.type = 'button';
    openButton.dataset.openStudent = student.ref;
    actionCell.append(openButton);
    row.append(nameCell, listeningCell, readingCell, writingCell, statusCell, actionCell);
    return row;
  }));
}

function renderOverview() {
  const selectedClass = getSelectedClass();
  const selectedTest = getSelectedTest();
  elements.overviewTitle.textContent = `${selectedClass?.name || ''} · ${selectedTest?.title || ''}`;
  elements.resultCount.textContent = `${state.students.length} học viên`;
  renderClassSummary();
  renderOverviewRows();
}

function addResultSummaryCard(label, value) {
  const card = createNode('article', 'summary-card');
  card.append(createNode('span', '', label), createNode('strong', '', value));
  return card;
}

function addWritingResultSummaryButton(student, taskNumber, value, ready) {
  if (!ready) return addResultSummaryCard(`Writing Task ${taskNumber}`, value);
  const button = createNode('button', 'summary-card teacher-writing-score-button');
  button.type = 'button';
  button.dataset.writingStudent = student.ref;
  button.dataset.writingTask = String(taskNumber);
  button.setAttribute('aria-label', `Xem bài chấm chi tiết Writing Task ${taskNumber} của ${student.name}`);
  button.append(
    createNode('span', '', `Writing Task ${taskNumber} · nhấn để xem chi tiết`),
    createNode('strong', '', value)
  );
  return button;
}

function cleanWritingFeedback(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/https:\/\/(?:docs|drive)\.google\.com\/\S+/gi, '')
    .replace(/^\s*\(?\s*Xem phân tích chi tiết[^\n]*\)?\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function writingReportSummary(value) {
  const cleaned = cleanWritingFeedback(value);
  const markerIndex = cleaned.search(/Nhận xét từng tiêu chí/iu);
  if (markerIndex < 0) return cleaned;
  const separatorIndex = cleaned.lastIndexOf('---', markerIndex);
  const headingIndex = cleaned.lastIndexOf('#', markerIndex);
  const cutIndex = separatorIndex >= 0
    ? separatorIndex
    : headingIndex >= 0
      ? headingIndex
      : markerIndex;
  return cleaned.slice(0, cutIndex).trim();
}

function looksLikeWritingHtml(value) {
  return /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?>/i.test(String(value || ''));
}

function appendSanitizedWritingHtml(target, value) {
  const allowedTags = new Set([
    'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'br',
    'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
  ]);
  const blockedTags = new Set([
    'script', 'style', 'template', 'iframe', 'object', 'embed', 'svg', 'math',
    'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta'
  ]);
  const parsed = new DOMParser().parseFromString(String(value || ''), 'text/html');

  const cloneSafeNode = node => {
    if (node.nodeType === 3) return document.createTextNode(node.textContent || '');
    if (node.nodeType !== 1) return null;
    const sourceTag = String(node.tagName || '').toLowerCase();
    if (blockedTags.has(sourceTag)) return null;
    const outputTag = /^h[1-6]$/.test(sourceTag)
      ? 'h5'
      : sourceTag === 'b'
        ? 'strong'
        : sourceTag === 'i'
          ? 'em'
          : allowedTags.has(sourceTag)
            ? sourceTag
            : null;
    const output = outputTag ? document.createElement(outputTag) : document.createDocumentFragment();
    for (const child of Array.from(node.childNodes || [])) {
      const safeChild = cloneSafeNode(child);
      if (safeChild) output.append(safeChild);
    }
    return output;
  };

  for (const child of Array.from(parsed.body.childNodes || [])) {
    const safeChild = cloneSafeNode(child);
    if (safeChild) target.append(safeChild);
  }
}

function appendSafeWritingFeedback(target, value) {
  const appendInline = (parent, source) => {
    const text = String(source || '');
    const tokenPattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let cursor = 0;
    for (const match of text.matchAll(tokenPattern)) {
      if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
      const node = document.createElement(match[1] ? 'strong' : 'em');
      node.textContent = match[1] || match[2];
      parent.append(node);
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
  };
  const cleaned = cleanWritingFeedback(value || 'Chưa có nhận xét.');
  if (looksLikeWritingHtml(cleaned)) {
    appendSanitizedWritingHtml(target, cleaned);
    return;
  }
  const lines = cleaned.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,5})\s+(?:\*\*([^*]+)\*\*|(.+))$/);
    if (heading) {
      const title = document.createElement('h5');
      title.textContent = String(heading[2] || heading[3] || '').trim();
      target.append(title);
      index += 1;
      continue;
    }
    const listItem = line.match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
    if (listItem) {
      const ordered = Boolean(listItem[2]);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      while (index < lines.length) {
        const candidate = lines[index].trim().match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
        if (!candidate || Boolean(candidate[2]) !== ordered) break;
        const item = document.createElement('li');
        appendInline(item, candidate[3]);
        list.append(item);
        index += 1;
      }
      target.append(list);
      continue;
    }
    const paragraph = document.createElement('p');
    appendInline(paragraph, line);
    target.append(paragraph);
    index += 1;
  }
}

function writingCriterionSections(value) {
  const text = cleanWritingFeedback(value);
  if (!text) return [];
  const sections = [];
  let current = null;
  for (const rawLine of text.split('\n')) {
    const heading = rawLine.trim().match(/^#{2,5}\s+(?:\*\*)?(.+?)(?:\*\*)?\s*$/);
    const title = String(heading?.[1] || '').replace(/\*\*/g, '').trim();
    if (heading && /^\d+\.\s+/.test(title)) {
      if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
      current = { title, body: [] };
      continue;
    }
    if (heading && /KẾT LUẬN/i.test(title)) {
      if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
      current = null;
      break;
    }
    if (current) current.body.push(rawLine);
  }
  if (current) sections.push({ title: current.title, body: current.body.join('\n').trim() });
  return sections;
}

function criterionTitle(code, taskNumber) {
  return {
    TA: 'Task Achievement',
    TR: 'Task Response',
    CC: 'Coherence & Cohesion',
    LR: 'Lexical Resource',
    GRA: 'Grammatical Range & Accuracy'
  }[code] || `Task ${taskNumber} · ${code || 'Tiêu chí'}`;
}

function safeWritingImageUrl(value) {
  const raw = String(value || '').trim();
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw;
  try {
    const apiOrigin = new URL(appConfig.API_BASE_URL).origin;
    const url = new URL(raw, `${apiOrigin}/`);
    return url.protocol === 'https:' && url.origin === apiOrigin ? url.href : '';
  } catch {
    return '';
  }
}

function appendWritingComponent(parent, component, section, index, criterionCode, taskNumber) {
  const aspect = createNode('section', 'writing-component');
  aspect.append(createNode('h5', '', section?.title || `${index + 1}. ${component?.label || component?.code || 'Khía cạnh'}`));
  const summaryValue = cleanWritingFeedback(component?.summary || section?.body || '');
  if (summaryValue) {
    const summary = createNode('div', 'writing-component-summary writing-feedback-richtext');
    appendSafeWritingFeedback(summary, summaryValue);
    aspect.append(summary);
  }
  const detailValue = cleanWritingFeedback(component?.feedback || '');
  if (detailValue) {
    const detailId = `teacherWritingDetail${taskNumber}${criterionCode}${index}${crypto.randomUUID()}`;
    const toggle = createNode('button', 'writing-component-toggle', 'Xem phân tích chi tiết và cách cải thiện');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', detailId);
    const detail = createNode('div', 'writing-component-detail writing-feedback-richtext');
    detail.id = detailId;
    detail.hidden = true;
    appendSafeWritingFeedback(detail, detailValue);
    toggle.addEventListener('click', () => {
      const willOpen = detail.hidden;
      detail.hidden = !willOpen;
      toggle.setAttribute('aria-expanded', String(willOpen));
      toggle.textContent = willOpen ? 'Thu gọn phân tích chi tiết' : 'Xem phân tích chi tiết và cách cải thiện';
    });
    aspect.append(toggle, detail);
  }
  parent.append(aspect);
}

function openTeacherWritingFeedback(studentName, writing) {
  const taskNumber = Number(writing.taskNumber);
  const dialog = createNode('dialog', 'writing-feedback-dialog');
  dialog.setAttribute('aria-labelledby', `teacherWritingTitle${taskNumber}`);
  const shell = createNode('div', 'writing-feedback-shell');
  const header = createNode('header', 'writing-feedback-header');
  const headerCopy = document.createElement('div');
  headerCopy.append(
    createNode('span', '', `${studentName} · Kết quả Writing`),
    createNode('h2', '', `Task ${taskNumber} · Band ${formatBand(Number(writing.taskScore))}`),
    createNode('p', '', `${Number(writing.wordCount || 0)} từ · Chấm theo 4 tiêu chí IELTS`)
  );
  headerCopy.querySelector('h2').id = `teacherWritingTitle${taskNumber}`;
  const closeButton = createNode('button', 'writing-feedback-close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Đóng bài chấm Writing');
  closeButton.addEventListener('click', () => dialog.close());
  header.append(headerCopy, closeButton);

  const layout = createNode('div', 'writing-feedback-layout');
  const sourcePane = createNode('section', 'writing-feedback-source');
  sourcePane.append(createNode('h3', '', 'Đề bài'), createNode('p', 'writing-feedback-prompt', writing.prompt || 'Chưa lưu nội dung đề bài.'));
  const imageUrl = safeWritingImageUrl(writing.promptImage);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = `Hình minh họa Writing Task ${taskNumber}`;
    image.className = 'writing-feedback-image';
    image.referrerPolicy = 'no-referrer';
    sourcePane.append(image);
  }
  const reportSummary = writingReportSummary(writing.report);
  if (reportSummary) {
    sourcePane.append(createNode('h3', '', 'Nhận xét tổng hợp'));
    const report = createNode('div', 'writing-feedback-text writing-feedback-richtext');
    appendSafeWritingFeedback(report, reportSummary);
    sourcePane.append(report);
  }
  const essayValue = String(writing.essay || '');
  sourcePane.append(createNode('h3', '', 'Bài viết của học viên'));
  const essay = createNode(
    'div',
    `writing-feedback-essay${essayValue.trim() ? '' : ' is-empty'}`,
    essayValue.trim() || 'Chưa có nội dung bài viết.'
  );
  essay.lang = 'en';
  sourcePane.append(essay);

  const scorePane = createNode('section', 'writing-feedback-scores');
  scorePane.append(createNode('h3', '', 'Nhận xét theo tiêu chí'));
  for (const criterion of Array.from(writing.criteria || [])) {
    const card = createNode('article', 'writing-criterion-card');
    const criterionHeader = document.createElement('header');
    criterionHeader.append(
      createNode('h4', '', criterion.name || criterionTitle(criterion.code, taskNumber)),
      createNode('strong', '', `Band ${formatBand(Number(criterion.bandScore))}`)
    );
    card.append(criterionHeader);
    const components = Array.from(criterion.components || []);
    const sections = writingCriterionSections(criterion.feedback);
    const componentCount = Math.max(components.length, sections.length);
    if (componentCount) {
      const list = createNode('div', 'writing-component-list');
      for (let index = 0; index < componentCount; index += 1) {
        appendWritingComponent(list, components[index], sections[index], index, criterion.code, taskNumber);
      }
      card.append(list);
    } else {
      const feedback = createNode('div', 'writing-feedback-text writing-feedback-richtext');
      appendSafeWritingFeedback(feedback, criterion.feedback || 'Chưa có nhận xét chi tiết.');
      card.append(feedback);
    }
    scorePane.append(card);
  }
  layout.append(sourcePane, scorePane);
  shell.append(header, layout);
  dialog.append(shell);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

async function loadTeacherWritingDetail(student, taskNumber, button) {
  const selectedClass = getSelectedClass();
  if (!selectedClass || !student || ![1, 2].includes(taskNumber)) return;
  const cacheKey = [selectedClass.id, state.selectedTestSlug, student.ref, taskNumber, student.writing?.updatedAt || ''].join('|');
  let payload = state.writingDetailCache.get(cacheKey);
  const originalText = button.querySelector('strong')?.textContent || '';
  try {
    button.disabled = true;
    if (button.querySelector('strong')) button.querySelector('strong').textContent = 'Đang tải…';
    if (!payload) {
      const query = new URLSearchParams({
        class: selectedClass.name,
        test: state.selectedTestSlug,
        student: student.ref,
        task: String(taskNumber)
      });
      payload = await apiRequest(`/api/term-tests/teacher/writing-detail?${query}`);
      state.writingDetailCache.set(cacheKey, payload);
    }
    openTeacherWritingFeedback(payload.studentName || student.name, payload.writing);
  } catch (error) {
    if (error.staleSession) return;
    showNotice(`Không thể tải bài chấm Writing: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    if (button.querySelector('strong')) button.querySelector('strong').textContent = originalText;
  }
}

async function openTeacherAttemptReview(student, button) {
  const selectedClass = getSelectedClass();
  if (!selectedClass || !student?.ref) return;
  const cacheKey = [selectedClass.id, state.selectedTestSlug, student.ref].join('|');
  const normalText = 'Xem lại toàn bộ bài làm';
  button.disabled = true;
  button.textContent = 'Đang tải bài chi tiết...';
  try {
    if (!state.attemptReviewCache.has(cacheKey)) {
      const query = new URLSearchParams({
        class: selectedClass.name,
        test: state.selectedTestSlug,
        student: student.ref
      });
      const payload = await apiRequest(`/api/term-tests/teacher/attempt-review?${query}`);
      state.attemptReviewCache.set(cacheKey, payload.review);
    }
    if (!window.TERM_TEST_ATTEMPT_REVIEW?.open) throw new Error('Chưa tải được giao diện xem lại bài làm.');
    window.TERM_TEST_ATTEMPT_REVIEW.open(state.attemptReviewCache.get(cacheKey));
  } catch (error) {
    if (error.staleSession) return;
    showNotice(`Không thể tải bài chi tiết: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = normalText;
  }
}

function renderAnalysisList(container, items, emptyText) {
  const rows = items?.length ? items : [{ type: emptyText, correct: 0, total: 0, percentage: 0 }];
  container.replaceChildren(...rows.map(item => createNode(
    'li',
    '',
    item.total ? `${item.type}: ${item.correct}/${item.total} (${Math.round(item.percentage * 100)}%)` : item.type
  )));
}

function renderDetailBlock(title, details) {
  const block = createNode('details', 'detail-block');
  const detailRows = details || [];
  const summary = createNode(
    'summary',
    '',
    detailRows.length ? `${title} · xem chi tiết ${detailRows.length} câu` : `${title} · chưa có dữ liệu từng câu`
  );
  const wrap = createNode('div', 'detail-table-wrap');
  const table = createNode('table', 'detail-table');
  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of ['Câu', 'Bài làm', 'Đáp án đúng', 'Kết quả']) {
    headerRow.append(createNode('th', '', label));
  }
  head.append(headerRow);
  const body = document.createElement('tbody');
  for (const detail of detailRows) {
    const row = createNode('tr', `detail-row detail-row-${detail.result || 'unknown'}`);
    const resultMeta = {
      correct: { icon: '✓', label: 'Đúng' },
      incorrect: { icon: '✕', label: 'Sai' },
      blank: { icon: '–', label: 'Bỏ trống' }
    }[detail.result] || { icon: '?', label: detail.result || 'Chưa xác định' };
    for (const value of [
      `${String(detail.number).padStart(2, '0')}.`,
      detail.studentAnswer || '—',
      detail.correctAnswer || '—'
    ]) row.append(createNode('td', '', value));
    const resultCell = createNode('td', `detail-result-cell result-${detail.result}`);
    const icon = createNode('span', 'detail-result-icon', resultMeta.icon);
    icon.setAttribute('aria-hidden', 'true');
    resultCell.append(icon, createNode('span', '', resultMeta.label));
    row.append(resultCell);
    body.append(row);
  }
  table.append(head, body);
  wrap.append(table);
  block.append(summary, wrap);
  return block;
}

function formatCompletedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
}

function renderStudentResult(student) {
  if (!student || student.status !== 'completed' || !student.result) {
    const empty = createNode('section', 'panel teacher-empty');
    empty.append(
      createNode('p', 'eyebrow', 'Kết quả cá nhân'),
      createNode('h2', '', student?.name || 'Học viên'),
      createNode('p', '', student?.status === 'incomplete'
        ? 'Học viên đã gửi Listening nhưng chưa hoàn tất Reading.'
        : 'Học viên chưa nộp bài test này.')
    );
    elements.studentView.replaceChildren(empty);
    return;
  }

  const result = student.result;
  const writing = student.writing || { status: 'not_submitted' };
  const panel = createNode('section', 'panel result-panel teacher-result-panel');
  const heading = createNode('div', 'result-heading');
  const headingCopy = document.createElement('div');
  headingCopy.append(
    createNode('p', 'eyebrow', 'Kết quả cá nhân'),
    createNode('h2', '', studentDisplayName(student)),
    createNode('p', '', `${getSelectedClass()?.name || ''} · ${result.testTitle || getSelectedTest()?.title || ''}${student.completedAt ? ` · ${formatCompletedAt(student.completedAt)}` : ''}`)
  );
  const reviewButton = createNode('button', 'button button-secondary teacher-attempt-review-button', 'Xem lại toàn bộ bài làm');
  reviewButton.type = 'button';
  reviewButton.dataset.fullAttemptStudent = student.ref;
  reviewButton.hidden = configuredWritingTasks().length > 0 && writing.status === 'not_submitted';
  reviewButton.addEventListener('click', () => openTeacherAttemptReview(student, reviewButton));
  heading.append(headingCopy, reviewButton);

  const summaryGrid = createNode('div', 'summary-grid');
  const writingSummaryCards = configuredWritingTasks().map(taskNumber => addWritingResultSummaryButton(
    student,
    taskNumber,
    writing.status === 'ready'
      ? `Band ${formatBand(Number(writing[`task${taskNumber}Score`]))}`
      : writingTaskStateLabel(writing[`task${taskNumber}State`]),
    writing.status === 'ready'
  ));
  summaryGrid.append(
    addResultSummaryCard('Listening', scoreMode() === 'raw'
      ? `${result.listening.correct}/${result.listening.total} câu đúng`
      : `${result.listening.correct}/${result.listening.total} · Band ${result.listening.band}`),
    addResultSummaryCard('Reading', scoreMode() === 'raw'
      ? `${result.reading.correct}/${result.reading.total} câu đúng`
      : `${result.reading.correct}/${result.reading.total} · Band ${result.reading.band}`),
    ...writingSummaryCards,
    ...(configuredWritingTasks().length
      ? [addResultSummaryCard('Writing', writing.status === 'ready' ? `Band ${formatBand(Number(writing.writingScore))}` : writingStatusLabel(writing.status))]
      : [])
  );

  const questionDetails = document.createElement('div');
  questionDetails.append(
    renderDetailBlock('Listening', result.listening.details),
    renderDetailBlock('Reading', result.reading.details)
  );

  const analysisGrid = createNode('div', 'analysis-grid');
  const bestCard = createNode('article', 'analysis-card best');
  const bestList = createNode('ul', 'analysis-list');
  bestCard.append(createNode('h3', '', 'Dạng làm tốt nhất'), bestList);
  const improveCard = createNode('article', 'analysis-card improve');
  const improveList = createNode('ul', 'analysis-list');
  improveCard.append(createNode('h3', '', 'Dạng cần cải thiện'), improveList);
  analysisGrid.append(bestCard, improveCard);
  renderAnalysisList(bestList, result.performance?.best, 'Chưa có dạng nổi trội riêng.');
  renderAnalysisList(improveList, result.performance?.needsImprovement, 'Các dạng đang có kết quả ngang nhau.');

  const performanceWrap = createNode('div', 'detail-table-wrap');
  const performanceTable = createNode('table', 'performance-table');
  const performanceHead = document.createElement('thead');
  const performanceHeader = document.createElement('tr');
  for (const label of ['Dạng bài', 'Đúng', 'Tổng', 'Tỷ lệ']) performanceHeader.append(createNode('th', '', label));
  performanceHead.append(performanceHeader);
  const performanceBody = document.createElement('tbody');
  for (const item of result.typeStats || []) {
    const row = document.createElement('tr');
    for (const value of [item.type, item.correct, item.total, `${Math.round(item.percentage * 100)}%`]) {
      row.append(createNode('td', '', String(value)));
    }
    performanceBody.append(row);
  }
  performanceTable.append(performanceHead, performanceBody);
  performanceWrap.append(performanceTable);
  panel.append(heading, summaryGrid, questionDetails, analysisGrid, performanceWrap);
  elements.studentView.replaceChildren(panel);
}

function renderActiveView() {
  const selectedStudent = state.students.find(student => student.ref === state.selectedTab);
  if (state.selectedTab !== 'overview' && !selectedStudent) state.selectedTab = 'overview';
  renderTabs();
  elements.overviewView.hidden = state.selectedTab !== 'overview';
  elements.studentView.hidden = state.selectedTab === 'overview';
  if (state.selectedTab === 'overview') renderOverview();
  else renderStudentResult(selectedStudent);
  updateUrl();
}

async function loadResults({ quiet = false } = {}) {
  const selectedClass = getSelectedClass();
  if (!selectedClass || !state.selectedTestSlug) return;
  if (state.resultsLoading) return;
  const generation = loginGeneration;
  state.resultsLoading = true;
  try {
    if (!quiet) showNotice(`Đang tải kết quả ${selectedClass.name}...`);
    const query = new URLSearchParams({ class: selectedClass.name, test: state.selectedTestSlug });
    const payload = await apiRequest(`/api/term-tests/teacher/results?${query}`);
    state.students = payload.students || [];
    if (state.selectedTab !== 'overview' && !state.students.some(student => student.ref === state.selectedTab)) {
      state.selectedTab = 'overview';
    }
    renderActiveView();
    const completed = state.students.filter(student => student.status === 'completed').length;
    const updatedAt = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    showNotice(`Đã tải ${state.students.length} học viên; ${completed} học viên đã hoàn thành · cập nhật ${updatedAt}.`, 'success');
  } finally {
    if (generation === loginGeneration) state.resultsLoading = false;
  }
}

async function connectAfterGoogleLogin() {
  await loadOptions();
  // Chỉ nhớ mã sau khi máy chủ đã xác nhận tài khoản và quyền truy cập.
  const remembered = sessionStore.save(state.idToken);
  await loadResults();
  if (!remembered) showNotice('Đã đăng nhập, nhưng trình duyệt đang chặn lưu phiên. Tải lại trang sẽ cần đăng nhập lại.');
}

function resetLoginAfterError({ clearSavedSession = true } = {}) {
  loginGeneration += 1;
  if (clearSavedSession) sessionStore.clear();
  state.idToken = '';
  state.connected = false;
  state.resultsLoading = false;
  state.reviewer = null;
  state.classes = [];
  state.tests = [];
  state.students = [];
  state.selectedClassId = '';
  state.selectedTestSlug = '';
  state.writingDetailCache.clear();
  state.attemptReviewCache.clear();
  // Xóa cả nội dung ẩn và hộp xem bài để máy dùng chung không giữ kết quả cũ.
  for (const id of ['classSelect', 'testSelect', 'teacherTabs', 'classSummary', 'overviewBody', 'studentView']) {
    elements[id].replaceChildren();
  }
  document.querySelectorAll('.writing-feedback-dialog, .attempt-review-dialog').forEach(dialog => dialog.remove());
  elements.reviewerName.textContent = '—';
  elements.overviewTitle.textContent = 'Kết quả của lớp';
  elements.resultCount.textContent = '0 học viên';
  elements.loginBadge.textContent = 'Chưa đăng nhập';
  elements.refreshButton.hidden = true;
  elements.logoutButton.hidden = true;
  elements.accessView.hidden = false;
  elements.dashboardView.hidden = true;
}

async function restoreLogin() {
  const token = sessionStore.read();
  if (!token) return;
  state.idToken = token;
  showNotice('Đang khôi phục phiên đăng nhập...');
  try {
    await connectAfterGoogleLogin();
  } catch (error) {
    if (error.staleSession) return;
    // Lỗi mạng tạm thời không xóa phiên còn hạn; 401/403 đã xóa trong apiRequest.
    resetLoginAfterError({ clearSavedSession: false });
    showNotice(`Không thể khôi phục phiên: ${error.message} Bạn có thể tải lại trang hoặc đăng nhập lại.`, 'error');
  }
}

function setupGoogleSignIn() {
  const clientId = appConfig.GOOGLE_CLIENT_ID;
  if (!clientId) {
    showNotice('Chưa cấu hình Google OAuth Client ID.', 'error');
    return;
  }
  const renderButton = () => {
    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      callback: async response => {
        resetLoginAfterError();
        state.idToken = response.credential || '';
        try {
          await connectAfterGoogleLogin();
        } catch (error) {
          if (error.staleSession) return;
          resetLoginAfterError({ clearSavedSession: false });
          showNotice(`Không thể đăng nhập: ${error.message}`, 'error');
        }
      }
    });
    window.google.accounts.id.renderButton(elements.googleSignInButton, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular'
    });
  };
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = renderButton;
  script.onerror = () => {
    if (!state.connected) showNotice('Không tải được màn hình đăng nhập Google.', 'error');
  };
  document.head.append(script);
}

elements.classSelect.addEventListener('change', async () => {
  state.selectedClassId = elements.classSelect.value;
  state.selectedTab = 'overview';
  try {
    await loadResults();
  } catch (error) {
    if (error.staleSession) return;
    showNotice(`Không thể tải kết quả: ${error.message}`, 'error');
  }
});

elements.testSelect.addEventListener('change', async () => {
  state.selectedTestSlug = elements.testSelect.value;
  state.selectedTab = 'overview';
  try {
    await loadResults();
  } catch (error) {
    if (error.staleSession) return;
    showNotice(`Không thể tải kết quả: ${error.message}`, 'error');
  }
});

elements.refreshButton.addEventListener('click', async () => {
  try {
    await loadResults();
  } catch (error) {
    if (error.staleSession) return;
    showNotice(`Không thể làm mới: ${error.message}`, 'error');
  }
});

elements.logoutButton.addEventListener('click', () => {
  resetLoginAfterError();
  window.google?.accounts?.id?.disableAutoSelect();
  showNotice('Đã đăng xuất. Đăng nhập Google để xem kết quả lớp.');
});

elements.teacherTabs.addEventListener('click', event => {
  const button = event.target.closest('[data-tab]');
  if (!button) return;
  state.selectedTab = button.dataset.tab;
  renderActiveView();
});

elements.teacherTabs.addEventListener('scroll', updateTabScrollControls, { passive: true });
elements.teacherTabs.addEventListener('wheel', event => {
  if (elements.teacherTabs.scrollWidth <= elements.teacherTabs.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  elements.teacherTabs.scrollBy({ left: event.deltaY, behavior: 'auto' });
}, { passive: false });
elements.teacherTabsPrev.addEventListener('click', () => scrollTeacherTabs(-1));
elements.teacherTabsNext.addEventListener('click', () => scrollTeacherTabs(1));
window.addEventListener('resize', () => refreshTabScrollLayout('auto'));
if ('ResizeObserver' in window) {
  const teacherTabsResizeObserver = new ResizeObserver(() => refreshTabScrollLayout('auto'));
  teacherTabsResizeObserver.observe(elements.teacherTabs);
}

elements.overviewBody.addEventListener('click', event => {
  const button = event.target.closest('[data-open-student]');
  if (!button) return;
  state.selectedTab = button.dataset.openStudent;
  renderActiveView();
});

elements.studentView.addEventListener('click', event => {
  const button = event.target.closest('[data-writing-student][data-writing-task]');
  if (!button) return;
  const student = state.students.find(item => item.ref === button.dataset.writingStudent);
  loadTeacherWritingDetail(student, Number(button.dataset.writingTask), button);
});

setupGoogleSignIn();
restoreLogin();

// Khi trang đang mở, tự lấy trạng thái mới để giảng viên thấy bài vừa chấm xong mà không phải bấm liên tục.
window.setInterval(() => {
  if (state.connected && !sessionStore.usable(state.idToken)) {
    resetLoginAfterError();
    showNotice('Phiên Google đã hết hạn; hãy đăng nhập lại.', 'error');
    return;
  }
  if (!state.connected || document.hidden) return;
  loadResults({ quiet: true }).catch(error => {
    if (error.staleSession) return;
    showNotice(`Không thể tự làm mới: ${error.message}`, 'error');
  });
}, 30_000);
