import { createTeacherApi } from './api.js?rev=20260922-table-polish-v1';
import { createRequestId } from './core.js';
import { teacherAuthFailure } from './teacher-auth-ui.js';
import { coverageDescription, coverageStatusLabels } from './writing-flow-coverage.js';
import { isBackdropClick } from './teacher-detail-core.js';
import { clampColumnWidth, defaultColumnWidths, formatWritingDay, normalizeWritingDay, readColumnWidths,
  dailyBreakdown, saveColumnWidths, serializeSortRules, summarizeWritingTestDetail,
  summarizeWritingTestRow, writingSortFields, writingReviewAction } from './writing-flow-ui.js?v=20260924-test-review-v1';
import { createTeacherLoginPreference } from '../../shared/teacher-login-preference.js?rev=20260918-v1';
import { createTeacherSessionClient } from '../../shared/teacher-session-client.js?rev=20260920-v1';

// Trang tải xem trước ngắn; toàn bộ nội dung và log chỉ tải khi mở một dòng.
// Mọi thao tác retry/bỏ qua đều ghi yêu cầu qua API; trang không ghi Lark Base.
const $ = id => document.getElementById(id);
const stages = ['intake', 'precheck', 'main', 'critic', 'arbiter', 'render', 'deliver'];
const stageNames = { intake: 'Tiếp nhận', precheck: 'Kiểm trước khi chấm', main: 'Chấm chính',
  critic: 'Phản biện', arbiter: 'Phân xử', render: 'Tạo trang kết quả', deliver: 'Ghi link vào homework' };
const testStageNames = { ...stageNames, render: 'Tổng hợp nhận xét',
  deliver: 'Ghi nhận xét vào Docs' };
const stageWorkflowIds = { intake: 'zxSd0xBPJzMqQlWt', precheck: 'P2p5N7iZzwHFDufk',
  main: 'X0qzwWc5CgBzgOWT', critic: '4o6jEwyQM4U29XU6', arbiter: 'yFdVOEBVhLitToQD',
  render: 'o8uncH0TWsJybeS2', deliver: 'KqWtSbjkHDMSAgbN' };
const statusNames = { received: 'Chờ chấm', running: 'Đang xử lý', needs_review: 'Cần kiểm tra',
  delivered: 'Đã giao', superseded: 'Có bản mới', pending: 'Đang chờ', succeeded: 'Đã xong',
  skipped: 'Đã bỏ qua', failed: 'Lỗi', paused: 'Tạm dừng', scanning: 'Đang quét' };
const viewMeta = {
  overview: ['Toàn hệ thống', 'Tổng quan vận hành', 'Các số cần chú ý và tình trạng quét lớp.', 'Tất cả trạng thái'],
  daily: ['Thống kê', 'Hoạt động Writing theo ngày', 'Tách bài chấm mới, kết quả cũ được ghi nhận và bài đã giao.', 'Ba loại hoạt động'],
  classes: ['Theo lớp', 'Không gian lớp', 'Xem trạng thái nguồn và yêu cầu quét riêng từng lớp đang học.', 'Lớp đang học và lớp CS hợp lệ'],
  completed_classes: ['Lưu trữ', 'Các lớp đã hoàn thành', 'Không nằm trong lượt quét và các view vận hành hằng ngày.', 'Không quét tự động'],
  mapping: ['Nguồn lớp', 'Lớp cần ghép hoặc kiểm tra', 'Các lớp thiếu trạng thái, trùng mapping hoặc chưa đủ điều kiện quét.', 'Đang tạm dừng'],
  review: ['Cần xử lý', 'Bài đã lỗi ba lần', 'Kiểm tra nguyên nhân rồi chạy lại đúng bước đang lỗi.', 'Cần kiểm tra'],
  source: ['Cần xử lý', 'Tài liệu hoặc bài không hợp lệ', 'Sai loại file, sai đề hoặc sai format bảng được giữ riêng tại đây.', 'Dừng trước khi gọi AI'],
  skipped: ['Thùng rác mềm', 'Các bài đã bỏ qua', 'Có thể khôi phục bài bị bỏ qua nhầm.', 'Đã bỏ qua'],
  delivered: ['Kết quả', 'Các bài đã giao', 'Link kết quả đã được ghi và đọc lại thành công.', 'Đã giao'],
  legacy: ['Chuyển đổi', 'Lịch sử từ luồng cũ', 'Dữ liệu cũ chỉ dùng để xem lại theo lớp.', 'Chỉ đọc'],
  logs: ['Điều tra lỗi', 'Nhật ký lỗi kỹ thuật', 'Mã workflow, node lỗi, số lần gặp và link mở n8n.', '7 ngày gần nhất'],
  audit: ['Dấu vết vận hành', 'Nhật ký thao tác', 'Ai đã retry, bỏ qua, khôi phục, quét lớp hoặc thay đổi trạng thái lớp.', 'Mới nhất trước'],
};
for (const [index, stage] of stages.entries()) viewMeta[stage] = ['7 giai đoạn',
  `${index + 1}. ${stageNames[stage]}`, 'Mỗi bài ở đây đang chờ, chạy hoặc cần xử lý tại đúng giai đoạn này.',
  `Đang ở bước: ${stageNames[stage]}`];
viewMeta.test_overview = ['Bài Test', 'Tổng quan chấm Test', 'Chỉ hiển thị bài kiểm tra; dùng chung cơ chế chính xác và retry của Writing.', 'Tất cả trạng thái Test'];
viewMeta.test_daily = ['Bài Test', 'Hoạt động Test theo ngày', 'Tách bài chấm mới, kết quả cũ được ghi nhận và bài đã giao.', 'Ba loại hoạt động'];
viewMeta.test_review = ['Bài Test', 'Bài Test cần kiểm tra', 'Bài lỗi ba lần có thể Retry; nguồn Test trùng cần đối chiếu trước khi bỏ qua.', 'Cần kiểm tra'];
viewMeta.test_skipped = ['Bài Test', 'Bài Test đã bỏ qua', 'Có thể khôi phục bài Test bị bỏ qua nhầm.', 'Đã bỏ qua'];
viewMeta.test_delivered = ['Bài Test', 'Bài Test đã giao', 'Kết quả đã được ghi và đọc lại thành công.', 'Đã giao'];
for (const [index, stage] of stages.entries()) viewMeta[`test_${stage}`] = ['7 giai đoạn Test',
  `${index + 1}. ${testStageNames[stage]}`, 'Mỗi bài Test ở đây đang ở đúng giai đoạn ghi trên tiêu đề.',
  `Test đang ở bước: ${testStageNames[stage]}`];

const columns = {
  student: ['Học viên / tên thủ công', row => sourceName(row)],
  class: ['Lớp', row => row.class_code || '—'],
  teacher: ['Giảng viên', row => (row.teacher_names || []).join(', ') || '—'],
  file: ['File Doc', row => externalLink(row.file_url, 'Mở Docs', row.homework_file_id || '—')],
  classroom: ['Classroom', row => externalLink(row.classroom_url, row.display_name || 'Mở Classroom', row.display_name || '—')],
  trcc: ['TRCC', row => row.tr_cc_check == null ? '—' : row.tr_cc_check ? 'Có' : 'Không'],
  sourceStatus: ['Trạng thái nguồn', row => row.source_status || '—'],
  testProgress: ['Test / tiến độ', row => summarizeWritingTestRow(row)?.progress || '—'],
  testOverall: ['Điểm toàn Test', row => summarizeWritingTestRow(row)?.overall || '—'],
  finished: ['Thời điểm xong', row => formatTime(row.finished_at)],
  topic: ['Đề bài', row => row.topic || '—'],
  image: ['Ảnh biểu đồ', row => externalLink(row.image_url, 'Mở ảnh', '—')],
  created: ['Ngày tạo', row => formatTime(row.source_created_at || row.created_at)],
  content: ['Nội dung', row => contentPreview(row)],
  lms: ['Link LMS', row => row.source_type === 'term_test'
    ? summarizeWritingTestRow(row).lms : externalLink(row.lms_url, 'Mở bài chấm', 'Chưa có')],
  attempts: ['Số lần thử', row => Number(row.attempt_count || 0)],
  error: ['Lỗi gần nhất', row => row.last_error_code || '—'],
  actions: ['Thao tác', row => actionCell(row)],
};
const defaultColumns = ['student', 'class', 'teacher', 'file', 'classroom', 'trcc',
  'finished', 'topic', 'content', 'lms', 'testProgress', 'testOverall', 'actions'];
const loginPreference = createTeacherLoginPreference(() => window.localStorage);
const state = { authenticated: false, api: null, timer: null, searchTimer: null, sessionClient: null,
  loginGeneration: 0, activeView: 'overview', pairs: [], nextCursor: null, nextOffset: null,
  loadingMore: false,
  counts: null, summary: [], coverage: [], reviews: [], issues: [], failures: [], events: [], legacy: [],
  activeClasses: [], completedClasses: [], daily: [], filtersLoaded: false,
  visibleColumns: readColumns(), columnWidths: readColumnWidths(window.localStorage),
  sortRules: readSortRules(), pinnedClasses: readClassList('writing-flow:pinned-classes:v1'),
  recentClasses: readClassList('writing-flow:recent-classes:v1') };

function isTestView(view = state.activeView) { return view.startsWith('test_'); }
function baseView(view = state.activeView) { return isTestView(view) ? view.slice(5) : view; }
function activeSourceKind() { return isTestView() ? 'test' : 'homework'; }
function activeStage() { const view = baseView(); return stages.includes(view) ? view : ''; }

function makeText(tag, value, className = '') { const node = document.createElement(tag); node.textContent = String(value ?? ''); if (className) node.className = className; return node; }
function showError(id, message = '') { const node = $(id); node.textContent = message; node.hidden = !message; }
function formatTime(value) { return value ? new Date(value).toLocaleString('vi-VN') : '—'; }
function sourceName(row) { return row.student_name || row.display_name || 'Chưa có tên'; }
function externalLink(url, label, fallback) { if (!url) return fallback; const link = makeText('a', label); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link; }
function actionButton(label, handler, className = 'secondary') { const button = makeText('button', label); button.type = 'button'; button.className = className; button.addEventListener('click', handler); return button; }
function readColumns() { try { const current = localStorage.getItem('writing-flow:columns:v3'); const saved = JSON.parse(current || localStorage.getItem('writing-flow:columns:v2') || localStorage.getItem('writing-flow:columns:v1') || 'null'); const value = Array.isArray(saved) ? saved.map(key => key === 'grading' ? 'lms' : key) : null; if (!value?.length || !value.every(key => columns[key])) return defaultColumns; return current ? [...new Set(value)] : [...new Set([...value, 'testProgress', 'testOverall'])]; } catch { return defaultColumns; } }
function saveColumns() { try { localStorage.setItem('writing-flow:columns:v3', JSON.stringify(state.visibleColumns)); } catch { /* Vẫn dùng được lựa chọn trong phiên hiện tại. */ } }
function readSortRules() { try { const value = JSON.parse(localStorage.getItem('writing-flow:sort:v1') || '[]'); return Array.isArray(value) ? value.slice(0, 3) : []; } catch { return []; } }
function saveSortRules() { try { localStorage.setItem('writing-flow:sort:v1', JSON.stringify(state.sortRules)); } catch { /* Sort vẫn dùng được trong phiên hiện tại. */ } }
function readClassList(key) { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 12) : []; } catch { return []; } }
function saveClassList(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Danh sách ghim/gần đây chỉ là tiện ích giao diện. */ } }
function currentFilters(extra = {}) { return { classCode: $('flow-class').value, teacherName: $('flow-teacher').value,
  taskType: $('flow-task-type').value, search: $('flow-search').value.trim(), searchScope: $('flow-search-scope').value,
  stageStatus: activeStage() ? $('flow-stage-status').value : '', sourceKind: activeSourceKind(),
  dateFrom: $('flow-date-from').value, dateTo: $('flow-date-to').value,
  sort: serializeSortRules(state.sortRules), limit: 50, ...extra }; }
function pairViewFilters() { const view = baseView(); if (stages.includes(view)) return { stageKey: view };
  if (view === 'review') return { view: 'review' };
  if (view === 'skipped') return { view: 'skipped' };
  if (view === 'delivered') return { view: 'delivered' };
  return view === 'classes' ? {} : { view: 'unfinished' }; }

function renderColumnChoices() {
  const root = $('flow-field-choices'); root.replaceChildren(makeText('legend', 'Cột hiển thị'));
  const ordered = [...state.visibleColumns, ...Object.keys(columns).filter(key => !state.visibleColumns.includes(key))];
  const move = (key, delta) => { const index = state.visibleColumns.indexOf(key); if (index < 0) return; const target = index + delta; if (target < 0 || target >= state.visibleColumns.length) return; [state.visibleColumns[index], state.visibleColumns[target]] = [state.visibleColumns[target], state.visibleColumns[index]]; saveColumns(); renderColumnChoices(); renderPairs(); };
  for (const key of ordered) {
    const label = columns[key][0]; const line = document.createElement('div'); line.className = 'flow-column-choice'; line.draggable = state.visibleColumns.includes(key); line.dataset.key = key;
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.visibleColumns.includes(key); input.value = key;
    input.addEventListener('change', () => { if (input.checked) state.visibleColumns.push(key); else if (state.visibleColumns.length > 1) state.visibleColumns = state.visibleColumns.filter(item => item !== key); else input.checked = true; saveColumns(); renderColumnChoices(); renderPairs(); });
    const grip = makeText('span', '⋮⋮', 'flow-column-grip'); grip.title = 'Kéo để đổi thứ tự';
    const up = actionButton('↑', () => move(key, -1)); up.title = 'Đưa cột sang trái'; up.disabled = !input.checked || state.visibleColumns.indexOf(key) <= 0;
    const down = actionButton('↓', () => move(key, 1)); down.title = 'Đưa cột sang phải'; down.disabled = !input.checked || state.visibleColumns.indexOf(key) < 0 || state.visibleColumns.indexOf(key) === state.visibleColumns.length - 1;
    line.append(input, document.createTextNode(label), up, down); line.prepend(grip);
    line.addEventListener('dragstart', event => { line.dataset.dragging = 'true'; event.dataTransfer?.setData('text/plain', key); });
    line.addEventListener('dragend', () => { delete line.dataset.dragging; });
    line.addEventListener('dragover', event => event.preventDefault());
    line.addEventListener('drop', event => { event.preventDefault(); const source = event.dataTransfer?.getData('text/plain'); const from = state.visibleColumns.indexOf(source); const to = state.visibleColumns.indexOf(key); if (from < 0 || to < 0 || from === to) return; state.visibleColumns.splice(from, 1); state.visibleColumns.splice(to, 0, source); saveColumns(); renderColumnChoices(); renderPairs(); });
    root.append(line);
  }
}

// Nhận vào: các quy tắc sắp xếp mà người vận hành chọn trên giao diện.
// Việc chính: hiển thị tối đa ba mức ưu tiên và chỉ cho chọn các trường backend đã duyệt.
// Kết quả: lưu lựa chọn trên trình duyệt, tải lại trang đầu theo thứ tự mới.
// Khi lỗi: bỏ quy tắc không hợp lệ và vẫn giữ thứ tự mặc định của hệ thống.
function renderSortControls() {
  const root = $('flow-sort-rules'); root.replaceChildren();
  const addRule = (rule = { key: 'finished', direction: 'desc' }) => {
    if (state.sortRules.length >= 3) return;
    state.sortRules.push(rule); renderSortControls();
  };
  state.sortRules = state.sortRules.slice(0, 3).filter(rule =>
    writingSortFields.some(([key]) => key === rule?.key) && ['asc', 'desc'].includes(rule?.direction));
  for (const [index, rule] of state.sortRules.entries()) {
    const line = document.createElement('div'); line.className = 'flow-sort-rule';
    const field = document.createElement('select'); field.setAttribute('aria-label', `Trường sắp xếp ${index + 1}`);
    for (const [key, label] of writingSortFields) field.append(new Option(label, key)); field.value = rule.key;
    field.addEventListener('change', () => { state.sortRules[index].key = field.value; });
    const direction = document.createElement('select'); direction.setAttribute('aria-label', `Chiều sắp xếp ${index + 1}`);
    direction.append(new Option('Giảm dần', 'desc'), new Option('Tăng dần', 'asc')); direction.value = rule.direction;
    direction.addEventListener('change', () => { state.sortRules[index].direction = direction.value; });
    const remove = actionButton('Xóa', () => { state.sortRules.splice(index, 1); renderSortControls(); });
    line.append(field, direction, remove); root.append(line);
  }
  $('flow-sort-add').disabled = state.sortRules.length >= 3;
  $('flow-sort-add').onclick = () => addRule();
  $('flow-sort-apply').onclick = () => { saveSortRules(); state.pairs = []; state.nextCursor = null; state.nextOffset = null; $('flow-sort').open = false; void refreshData(); };
  $('flow-sort-clear').onclick = () => { state.sortRules = []; saveSortRules(); renderSortControls(); state.pairs = []; state.nextCursor = null; state.nextOffset = null; $('flow-sort').open = false; void refreshData(); };
}

function renderHeading() { const meta = viewMeta[state.activeView]; const view = baseView(); $('flow-view-kicker').textContent = meta[0]; $('flow-view-title').textContent = meta[1]; $('flow-view-help').textContent = meta[2]; const badge = $('flow-view-status'); badge.textContent = meta[3]; badge.dataset.tone = ['review', 'source', 'logs'].includes(view) ? 'danger' : ['delivered', 'completed_classes'].includes(view) ? 'success' : ''; const breakdown = $('flow-stage-breakdown'); breakdown.replaceChildren(); breakdown.hidden = !stages.includes(view); if (!breakdown.hidden) { const rows = (state.counts?.stages || []).filter(row => row.stage_key === view && !row.skipped); const totals = new Map(rows.map(row => [row.stage_status, Number(row.pair_count || 0)])); for (const key of ['pending', 'running', 'needs_review', 'succeeded']) breakdown.append(makeText('span', `${statusNames[key]}: ${totals.get(key) || 0}`)); } for (const button of document.querySelectorAll('#flow-views [data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === state.activeView)); }
function setViewVisibility() { const view = baseView(); const map = { overview: ['flow-overview-section'], daily: ['flow-daily-section'], classes: ['flow-classes-section', 'flow-pairs-section'], completed_classes: ['flow-classes-section'], mapping: ['flow-mapping-section'], review: ['flow-pairs-section'], source: ['flow-pairs-section'], logs: ['flow-technical-section'], audit: ['flow-audit-section'], legacy: ['flow-pairs-section'] }; const visible = [...(map[view] || ['flow-pairs-section'])]; if (state.activeView === 'test_overview') visible.push('flow-pairs-section'); for (const id of ['flow-overview-section', 'flow-daily-section', 'flow-classes-section', 'flow-reviews-section', 'flow-source-section', 'flow-technical-section', 'flow-audit-section', 'flow-mapping-section', 'flow-pairs-section', 'flow-legacy-section']) $(id).hidden = !visible.includes(id); if (view === 'classes' && !$('flow-class').value) $('flow-pairs-section').hidden = true; $('flow-stage-status-filter').hidden = !stages.includes(view); renderHeading(); }

function renderCounts() {
  const values = { overview: 0, classes: state.activeClasses.length, completed_classes: state.completedClasses.length,
    mapping: state.coverage.filter(row => !['covered', 'completed', 'excluded'].includes(row.status)).length,
    review: Number(state.counts?.support?.reviews || 0), source: Number(state.counts?.support?.source_issues || 0),
    skipped: 0, delivered: 0 };
  for (const stage of stages) values[stage] = 0;
  for (const row of state.counts?.stages || []) { const count = Number(row.pair_count || 0); values.overview += count; if (row.skipped) values.skipped += count; else { values[row.stage_key] = (values[row.stage_key] || 0) + count; if (row.stage_key === 'deliver' && row.stage_status === 'succeeded') values.delivered += count; } }
  for (const [key, value] of Object.entries(values)) { const node = document.querySelector(`[data-count="${key}"]`); if (node) node.textContent = String(value); }
  const prefix = isTestView() ? 'test_' : '';
  const overviewNode = document.querySelector(`[data-count="${prefix}overview"]`);
  if (overviewNode) overviewNode.textContent = String(values.overview);
  if (isTestView()) for (const key of [...stages, 'review', 'skipped', 'delivered']) {
    const node = document.querySelector(`[data-count="test_${key}"]`);
    if (node) node.textContent = String(values[key] || 0);
  }
}
function renderSummary() { const root = $('flow-summary'); root.replaceChildren(); const stageRows = state.counts?.stages || []; const skipped = stageRows.filter(row => row.skipped).reduce((sum, row) => sum + Number(row.pair_count || 0), 0); const delivered = stageRows.filter(row => !row.skipped && row.stage_key === 'deliver' && row.stage_status === 'succeeded').reduce((sum, row) => sum + Number(row.pair_count || 0), 0); const running = stageRows.filter(row => !row.skipped && row.stage_status === 'running').reduce((sum, row) => sum + Number(row.pair_count || 0), 0); const attention = Number(state.counts?.support?.reviews || 0) + Number(state.counts?.support?.source_issues || 0); for (const item of [{ key: 'running', label: 'Đang xử lý', value: running }, { key: 'needs_review', label: 'Cần xử lý', value: attention }, { key: 'delivered', label: 'Đã giao', value: delivered }, { key: 'skipped', label: 'Đã bỏ qua', value: skipped }]) { const card = document.createElement('article'); card.dataset.status = item.key; card.append(makeText('strong', item.value), makeText('span', item.label)); root.append(card); } }

function populateFilters(filters) { const currentClass = $('flow-class').value; const currentTeacher = $('flow-teacher').value; const active = (filters.classes || []).filter(row => row.enabled && row.mapping_status === 'approved'); $('flow-class').replaceChildren(new Option('Tất cả lớp đang học', '')); for (const row of active) $('flow-class').append(new Option(`${row.class_code}${row.classroom_name ? ` · ${row.classroom_name}` : ''}`, row.class_code)); $('flow-class').value = active.some(row => row.class_code === currentClass) ? currentClass : ''; $('flow-teacher').replaceChildren(new Option('Tất cả giảng viên', '')); for (const name of filters.teachers || []) $('flow-teacher').append(new Option(name, name)); $('flow-teacher').value = (filters.teachers || []).includes(currentTeacher) ? currentTeacher : ''; }

async function requestClassScan(classCode, button) { const reason = prompt(`Lý do quét lại lớp ${classCode}:`, 'Kiểm tra bài mới')?.trim(); if (!reason) return; button.disabled = true; try { await state.api.requestWritingClassScan(classCode, reason); showError('flow-error', `Đã xếp lớp ${classCode} vào hàng quét. Workflow điều phối sẽ nhận trong tối đa một phút.`); await refreshData(); } catch (error) { showError('flow-error', `Chưa quét được lớp: ${error.message}`); } finally { button.disabled = false; } }
function rememberClass(classCode) { state.recentClasses = [classCode, ...state.recentClasses.filter(item => item !== classCode)].slice(0, 8); saveClassList('writing-flow:recent-classes:v1', state.recentClasses); }
function chooseClass(classCode) { $('flow-class').value = classCode; rememberClass(classCode); void refreshData(); }
function togglePinnedClass(classCode) { state.pinnedClasses = state.pinnedClasses.includes(classCode) ? state.pinnedClasses.filter(item => item !== classCode) : [classCode, ...state.pinnedClasses].slice(0, 12); saveClassList('writing-flow:pinned-classes:v1', state.pinnedClasses); renderClasses(); }
function classCard(item, completed = false) { const classCode = item.class_code || ''; const pinned = state.pinnedClasses.includes(classCode); const active = item.operational_state === 'active'; const card = document.createElement('article'); card.className = 'flow-class-card'; card.dataset.pinned = String(pinned); card.append(makeText('h3', classCode || item.class_name || 'Chưa rõ mã lớp'), makeText('p', item.classroom_name || item.class_name || 'Chưa có tên Classroom', 'flow-meta')); if (item.class_info) card.append(makeText('p', item.class_info, 'flow-meta')); if (!completed && !active) card.append(makeText('p', 'Thiếu hoặc xung đột trạng thái nguồn · vẫn giữ trong danh sách đang học', 'flow-meta flow-warning')); card.append(makeText('p', `Giảng viên: ${(item.teacher_names || []).join(', ') || '—'}`, 'flow-meta'), makeText('p', completed ? 'Đã hoàn thành · không quét tự động' : `Quét: ${statusNames[item.scan_status] || item.scan_status || 'chưa có'} · lần lỗi ${item.scan_attempt_count || 0}/3`, 'flow-meta'), makeText('p', `Lần quét gần nhất: ${formatTime(item.last_scan_at)}`, 'flow-meta')); if (!completed && classCode) { const actions = document.createElement('div'); actions.className = 'flow-class-card-actions'; const scan = actionButton('Quét lớp ngay', () => void requestClassScan(classCode, scan)); const show = actionButton('Xem bài lớp', () => chooseClass(classCode)); const pin = actionButton(pinned ? 'Bỏ ghim' : 'Ghim lớp', () => togglePinnedClass(classCode)); actions.append(show, scan, pin); card.append(actions); } return card; }
function orderedClasses(rows) { const rank = code => { const pinned = state.pinnedClasses.indexOf(code); if (pinned >= 0) return pinned; const recent = state.recentClasses.indexOf(code); return recent >= 0 ? 100 + recent : 1000; }; return [...rows].sort((a, b) => rank(a.class_code) - rank(b.class_code) || String(a.class_code).localeCompare(String(b.class_code), 'vi')); }
function renderClassWorkspace() { const workspace = $('flow-class-workspace'); const classCode = $('flow-class').value; workspace.hidden = state.activeView !== 'classes' || !classCode; if (workspace.hidden) return; $('flow-class-workspace-title').textContent = `Tình hình lớp ${classCode}`; const summary = $('flow-class-stage-summary'); summary.replaceChildren(); const rows = (state.counts?.stages || []).filter(row => !row.skipped); for (const stage of stages) { const count = rows.filter(row => row.stage_key === stage).reduce((total, row) => total + Number(row.pair_count || 0), 0); const card = document.createElement('article'); card.append(makeText('strong', count), makeText('span', stageNames[stage])); summary.append(card); } renderDailyBars($('flow-class-daily-chart'), state.daily, true, 120); }
function renderClasses() { const root = $('flow-classes'); root.replaceChildren(); const completed = state.activeView === 'completed_classes'; const rows = orderedClasses(completed ? state.completedClasses : state.activeClasses); if (!rows.length) root.append(makeText('p', completed ? 'Chưa có lớp đã hoàn thành.' : 'Chưa có lớp đang vận hành.', 'muted')); else for (const item of rows) root.append(classCard(item, completed)); renderClassWorkspace(); }

function renderCoverageList(rootId, limit = null) { const root = $(rootId); root.replaceChildren(); let rows = state.coverage.filter(row => !['covered', 'completed', 'excluded'].includes(row.status)); if (limit) rows = rows.slice(0, limit); if (!rows.length) return root.append(makeText('p', 'Không có lớp cần chú ý.', 'muted')); for (const item of rows) { const row = document.createElement('article'); row.className = 'flow-row'; const body = document.createElement('div'); body.append(makeText('strong', `${item.class_code || item.class_name || 'Chưa rõ lớp'} · ${coverageStatusLabels[item.status] || item.status}`), makeText('p', coverageDescription(item), 'flow-meta')); row.append(body); if (item.class_code && !['excluded', 'completed'].includes(item.status)) { const button = actionButton('Quét ngay', () => void requestClassScan(item.class_code, button)); row.append(button); } root.append(row); } }
function renderCoverage() { renderCoverageList('flow-class-coverage', 8); renderCoverageList('flow-mapping-coverage'); }
function renderAttention() {
  const root = $('flow-attention'); root.replaceChildren();
  const rows = [...state.reviews.slice(0, 4).map(item => ({ kind: 'review', item })),
    ...state.issues.slice(0, 4).map(item => ({ kind: 'issue', item }))].slice(0, 8);
  if (!rows.length) return root.append(makeText('p', 'Không có việc cần xử lý.', 'muted'));
  for (const { kind, item } of rows) {
    const row = document.createElement('article'); row.className = 'flow-row';
    const title = kind === 'issue' ? `Lỗi nguồn · ${sourceIssueLabel(item.reason_code)}`
      : writingReviewAction(item).canRetry
        ? `${stageNames[item.stage_key]} · lỗi sau ${item.attempt_count}/3 lần`
        : 'Nguồn Test trùng · cần đối chiếu';
    row.append(makeText('div', `${title}\n${sourceName(item)} · ${item.class_code || 'ngoài lớp'}`));
    root.append(row);
  }
}

function detailButton(row, label) { return actionButton(label, () => void openRowDetail(row)); }
function contentPreview(row) { const preview = makeText('button', row.essay_preview || 'Chưa có nội dung', 'flow-content-preview'); preview.type = 'button'; preview.title = 'Nhấn đúp hoặc nhấn Enter để xem đầy đủ'; preview.disabled = !row.essay_preview; const open = () => void openRowDetail(row); preview.addEventListener('dblclick', open); preview.addEventListener('click', event => { if (event.detail === 1) preview.focus(); }); preview.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }); return preview; }
async function skipPair(pair) { const reason = prompt('Lý do bỏ qua bài này:')?.trim(); if (!reason) return; try { await state.api.skipWritingPair(pair.pair_id, reason); await refreshData(); } catch (error) { showError('flow-error', `Chưa bỏ qua được bài: ${error.message}`); } }
async function restorePair(pair) { const reason = prompt('Lý do khôi phục bài:', 'Bỏ qua nhầm')?.trim(); if (!reason) return; try { await state.api.restoreWritingPair(pair.pair_id, reason); await refreshData(); } catch (error) { showError('flow-error', `Chưa khôi phục được bài: ${error.message}`); } }
async function retryPair(pair, button) {
  const action = writingReviewAction(pair);
  if (!action.canRetry) { showError('flow-error', action.message); return; }
  if (button.disabled) return;
  const stageKey = activeStage() || pair.stage_key;
  button.disabled = true;
  let submitted = false;
  try {
    await state.api.retryWritingPairStage(pair.pair_id, stageKey, 'Chạy lại từ dashboard');
    submitted = true;
    await refreshData();
  } catch (error) {
    if (!submitted) button.disabled = false;
    showError('flow-error', submitted
      ? `Đã gửi yêu cầu nhưng chưa cập nhật màn hình: ${error.message}`
      : `Chưa tạo được lượt retry: ${error.message}`);
  }
}
async function skipSourceIssue(issue) { const reason = prompt('Lý do bỏ qua lỗi nguồn này:')?.trim(); if (!reason) return; try { await state.api.skipWritingSourceIssue(issue.issue_key, reason); await refreshData(); } catch (error) { showError('flow-error', `Chưa bỏ qua được lỗi nguồn: ${error.message}`); } }
async function restoreSourceIssue(issue) { const reason = prompt('Lý do khôi phục lỗi nguồn:', 'Bỏ qua nhầm')?.trim(); if (!reason) return; try { await state.api.restoreWritingSourceIssue(issue.issue_key, reason); await refreshData(); } catch (error) { showError('flow-error', `Chưa khôi phục được lỗi nguồn: ${error.message}`); } }
function actionCell(row) {
  const cell = document.createElement('div'); cell.className = 'flow-actions';
  cell.append(actionButton('Xem', () => void openRowDetail(row)));
  if (row.row_kind === 'legacy') return cell;
  if (row.row_kind === 'source_issue') {
    if (row.skipped_at) cell.append(actionButton('Khôi phục', () => void restoreSourceIssue(row)));
    else {
      const retry = actionButton('Đọc lại nguồn', () => void retrySourceIssue(row, retry), 'primary');
      cell.append(retry, actionButton('Bỏ qua', () => void skipSourceIssue(row)));
    }
    return cell;
  }
  const reviewAction = writingReviewAction(row);
  if (reviewAction.canRetry) {
    const retry = actionButton('Retry', () => void retryPair(row, retry), 'primary');
    cell.append(retry);
  }
  else cell.append(makeText('span', 'Đối chiếu nguồn trùng', 'flow-meta'));
  cell.append(row.skipped_at ? actionButton('Khôi phục', () => void restorePair(row))
    : actionButton('Bỏ qua', () => void skipPair(row)));
  return cell;
}
function appendCell(row, key, content) { const cell = document.createElement('td'); cell.dataset.column = key; cell.style.width = `${state.columnWidths[key]}px`; if (content instanceof Node) cell.append(content); else cell.textContent = String(content ?? ''); row.append(cell); }
function startColumnResize(event, key, header) {
  event.preventDefault(); const startX = event.clientX; const startWidth = state.columnWidths[key];
  header.dataset.resizing = 'true'; document.body.classList.add('flow-resizing-column');
  const move = moveEvent => { state.columnWidths[key] = clampColumnWidth(startWidth + moveEvent.clientX - startX, defaultColumnWidths[key]); renderPairs(); };
  const stop = () => { delete header.dataset.resizing; document.body.classList.remove('flow-resizing-column'); saveColumnWidths(window.localStorage, state.columnWidths); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true });
}
function resetColumnWidths() { state.columnWidths = { ...defaultColumnWidths }; saveColumnWidths(window.localStorage, state.columnWidths); renderPairs(); }
function renderPairs() {
  const head = $('flow-table-head'); const root = $('flow-pairs'); const table = $('flow-pairs-table');
  const visible = isTestView() ? state.visibleColumns
    : state.visibleColumns.filter(key => !['testProgress', 'testOverall'].includes(key));
  head.replaceChildren(); root.replaceChildren();
  table.style.width = `${visible.reduce((sum, key) => sum + state.columnWidths[key], 0)}px`;
  for (const key of visible) {
    const header = makeText('th', columns[key][0]); header.dataset.column = key; header.style.width = `${state.columnWidths[key]}px`;
    const resizer = document.createElement('span'); resizer.className = 'flow-column-resizer'; resizer.title = 'Kéo để đổi độ rộng cột'; resizer.addEventListener('pointerdown', event => startColumnResize(event, key, header));
    header.append(resizer); head.append(header);
  }
  if (!state.pairs.length) { const row = document.createElement('tr'); const cell = makeText('td', 'Chưa có bài trong phạm vi đã chọn.', 'muted'); cell.colSpan = visible.length; row.append(cell); root.append(row); $('flow-more').hidden = true; return; }
  for (const pair of state.pairs) { const row = document.createElement('tr'); for (const key of visible) appendCell(row, key, columns[key][1](pair)); root.append(row); }
  $('flow-more').hidden = !state.nextCursor && state.nextOffset == null;
}

function sourceIssueRow(issue) {
  return { ...issue, row_kind: 'source_issue', class_code: issue.class_code || null,
    created_at: issue.first_seen_at, updated_at: issue.last_seen_at,
    source_created_at: issue.first_seen_at, finished_at: null,
    teacher_names: issue.teacher_names || [], task_type: null,
    topic: sourceIssueLabel(issue.reason_code), image_url: null, tr_cc_check: null,
    essay_preview: `Lỗi nguồn: ${sourceIssueLabel(issue.reason_code)}. Mở chi tiết để xem link và số lần gặp.`,
    lms_url: null, attempt_count: issue.occurrence_count || 0,
    last_error_code: issue.reason_code };
}
function legacyRow(item) {
  return { ...item, row_kind: 'legacy', display_name: item.homework_title || '',
    teacher_names: item.teacher_name ? [item.teacher_name] : [],
    homework_file_id: item.file_url?.match(/\/document\/d\/([^/]+)/u)?.[1] || null,
    created_at: item.created_at_source || item.imported_at,
    source_created_at: item.created_at_source, finished_at: item.finished_at_source,
    source_status: item.source_status || item.match_status,
    attempt_count: 0, last_error_code: item.data_issue_code || null };
}

function openSourceIssueDetail(issue) {
  const dialog = $('flow-detail'); const content = $('flow-detail-content');
  const main = document.createElement('section'); main.className = 'flow-detail-panel flow-detail-panel-wide';
  main.append(makeText('h3', 'Lỗi nguồn'), makeText('p', sourceIssueLabel(issue.reason_code)),
    makeText('p', `Đã gặp ${issue.occurrence_count || 1} lần · gần nhất ${formatTime(issue.last_seen_at)}`, 'flow-meta'));
  const source = document.createElement('section'); source.className = 'flow-detail-panel';
  source.append(makeText('h3', 'Thông tin nguồn'), makeText('p', `Học viên: ${sourceName(issue)}`),
    makeText('p', `Lớp: ${issue.class_code || 'Ngoài lớp'}`),
    makeText('p', `Bài số: ${issue.essay_slot || '—'}`),
    makeText('p', `Trạng thái nguồn: ${issue.source_status || '—'}`),
    externalLink(issue.file_url, 'Mở Docs', ''),
    externalLink(issue.classroom_url, issue.display_name || 'Mở Classroom', ''));
  const note = document.createElement('section'); note.className = 'flow-detail-panel';
  note.append(makeText('h3', 'Cách xử lý'), makeText('p', issue.skipped_at
    ? `Đã bỏ qua: ${issue.skip_reason || 'không ghi lý do'}. Có thể khôi phục từ tab Đã bỏ qua.`
    : 'Dùng “Đọc lại nguồn” sau khi đã sửa file; dùng “Bỏ qua” để chuyển vào thùng rác mềm.'));
  const grid = document.createElement('div'); grid.className = 'flow-detail-grid'; grid.append(main, source, note);
  content.replaceChildren(makeText('h2', sourceName(issue)), grid); dialog.showModal();
}
function openLegacyDetail(item) {
  const dialog = $('flow-detail'); const content = $('flow-detail-content');
  const topic = document.createElement('section'); topic.className = 'flow-detail-panel flow-detail-panel-wide';
  topic.append(makeText('h3', 'Đề bài'), makeText('p', item.topic || '—'));
  if (item.image_url) topic.append(externalLink(item.image_url, 'Mở ảnh biểu đồ', ''));
  const essay = document.createElement('section'); essay.className = 'flow-detail-panel flow-detail-panel-wide';
  essay.append(makeText('h3', 'Nội dung đã lưu trong lịch sử'), makeText('p', item.essay_preview || '—'));
  const info = document.createElement('section'); info.className = 'flow-detail-panel';
  info.append(makeText('h3', 'Thông tin bài'), makeText('p', `Học viên: ${sourceName(item)}`),
    makeText('p', `Lớp: ${item.class_code || '—'}`), makeText('p', `Giảng viên: ${item.teacher_name || '—'}`),
    externalLink(item.file_url, 'Mở Docs', ''), externalLink(item.lms_url, 'Mở bài chấm trên LMS', ''));
  const grid = document.createElement('div'); grid.className = 'flow-detail-grid'; grid.append(topic, essay, info);
  content.replaceChildren(makeText('h2', sourceName(item)), grid); dialog.showModal();
}
function openRowDetail(row) {
  if (row.row_kind === 'source_issue') return openSourceIssueDetail(row);
  if (row.row_kind === 'legacy') return openLegacyDetail(row);
  return openDetail(row);
}

function describeEvent(event) { const step = stageNames[event.stage_key] || event.stage_key || ''; if (event.kind === 'attempt') return `${step}: lần ${event.attempt_no}, ${event.status}`; if (event.kind === 'ai_call') return `${step}: gọi AI ${event.provider || ''}, ${event.status}`; if (event.kind === 'handoff') return `Chuyển ${stageNames[event.from_stage] || event.from_stage} → ${stageNames[event.to_stage] || event.to_stage}: ${event.status}`; if (event.kind === 'operator') return `Thao tác ${event.event_type}: ${event.reason || ''}`; return `${step}: ${event.status || event.kind}`; }
// Nhận vào: kết quả Test đã được backend kiểm theo tiêu chí và thành phần.
// Việc chính: hiện điểm và nhận xét thành các mục có thể mở, thay vì bắt người xem đọc JSON.
// Kết quả: bài cũ đã khôi phục chỉ dẫn xem Google Docs; dữ liệu lỗi chỉ hiện trạng thái thiếu.
function testDetailSection(test) {
  const view = summarizeWritingTestDetail(test);
  const section = document.createElement('section');
  section.className = 'flow-detail-panel flow-detail-panel-wide';
  section.append(makeText('h3', `Kết quả chấm Test · Task ${view.taskNumber || '?'}`));
  if (view.scoreLabel) section.append(makeText('p', `Điểm Task: ${view.scoreLabel}`));
  if (test.writing_score != null && test.result_origin !== 'legacy_restored') {
    section.append(makeText('p', `Điểm Writing toàn bài: Band ${test.writing_score}`));
  }
  section.append(makeText('p', view.message, 'flow-meta'));
  for (const criterion of view.criteria) {
    const block = document.createElement('details');
    block.append(makeText('summary', criterion.title));
    if (criterion.feedback) block.append(makeText('p', criterion.feedback));
    for (const component of criterion.components) {
      const item = document.createElement('details');
      item.append(makeText('summary', component.title));
      if (component.summary) item.append(makeText('p', component.summary));
      if (component.feedback) item.append(makeText('p', component.feedback));
      block.append(item);
    }
    section.append(block);
  }
  return section;
}
async function openDetail(pair) { const dialog = $('flow-detail'); const content = $('flow-detail-content'); content.textContent = 'Đang tải đề bài, nội dung và nhật ký…'; dialog.showModal(); try { const [detailResponse, historyResponse] = await Promise.all([state.api.writingPairDetail(pair.pair_id), state.api.writingPairHistory(pair.pair_id)]); const detail = detailResponse.data.detail; const history = historyResponse.data.history; const topic = document.createElement('section'); topic.className = 'flow-detail-panel flow-detail-panel-wide flow-detail-topic'; topic.append(makeText('h3', 'Đề bài'), makeText('p', detail.source.topic || '—')); if (detail.source.image) topic.append(externalLink(detail.source.image, 'Mở ảnh biểu đồ', '')); const essay = document.createElement('section'); essay.className = 'flow-detail-panel flow-detail-panel-wide flow-detail-essay'; essay.append(makeText('h3', 'Nội dung học viên'), makeText('p', detail.source.essay || '—')); const metadata = document.createElement('section'); metadata.className = 'flow-detail-panel'; const trcc = detail.source.trCcCheck == null ? '—' : detail.source.trCcCheck ? 'Có' : 'Không'; const trccNote = detail.source.trCcSource === 'repair_override' ? ' · bổ sung sau khi cứu TR/CC' : ''; metadata.append(makeText('h3', 'Thông tin bài'), makeText('p', `Học viên: ${sourceName(detail.pair)}`), makeText('p', `Lớp: ${detail.pair.class_code || 'Ngoài lớp'}`), makeText('p', `TRCC: ${trcc}${trccNote}`), makeText('p', `Trạng thái nguồn: ${detail.pair.source_status || '—'}`), externalLink(detail.pair.file_url, 'Mở Docs', '')); const results = document.createElement('section'); results.className = 'flow-detail-panel'; results.append(makeText('h3', 'Kết quả và giai đoạn')); const renderStage = detail.stages.find(stage => stage.stage_key === 'render' && stage.result?.resultUrl); if (detail.pair.source_type !== 'term_test') results.append(externalLink(renderStage?.result?.resultUrl, 'Mở bài chấm trên LMS', 'Chưa có Link LMS')); for (const stage of detail.stages) { const block = document.createElement('details'); block.append(makeText('summary', `${detail.pair.source_type === 'term_test' ? testStageNames[stage.stage_key] : stageNames[stage.stage_key]} · ${statusNames[stage.status] || stage.status}`), makeText('pre', stage.result ? JSON.stringify(stage.result, null, 2) : 'Chưa có kết quả.')); results.append(block); } const log = document.createElement('section'); log.className = 'flow-detail-panel flow-detail-panel-wide'; log.append(makeText('h3', 'Nhật ký và lỗi')); for (const event of history.events || []) { const line = makeText('p', `${formatTime(event.at)} · ${describeEvent(event)}${event.error_code ? ` · lỗi ${event.error_code}` : ''}`, 'flow-meta'); const workflowId = stageWorkflowIds[event.stage_key]; if (workflowId && event.n8n_execution_id) { const link = externalLink(`https://ducizone.ddns.net/workflow/${workflowId}/executions/${encodeURIComponent(event.n8n_execution_id)}`, 'Mở lượt chạy n8n', ''); line.append(' · ', link); } log.append(line); } const grid = document.createElement('div'); grid.className = 'flow-detail-grid'; grid.append(topic, essay, metadata); if (detail.test) grid.append(testDetailSection(detail.test)); grid.append(results, log); content.replaceChildren(makeText('h2', sourceName(detail.pair)), grid); } catch (error) { content.textContent = `Chưa đọc được chi tiết: ${error.message}`; } }

async function retryReview(review, button) {
  if (button.disabled) return;
  button.disabled = true;
  let submitted = false;
  try {
    await state.api.retryWritingReview(review.review_id, createRequestId());
    submitted = true;
    await refreshData();
  } catch (error) {
    if (!submitted) button.disabled = false;
    showError('flow-error', submitted
      ? `Đã gửi yêu cầu nhưng chưa cập nhật màn hình: ${error.message}`
      : `Chưa gửi được yêu cầu: ${error.message}`);
  }
}
function renderReviews() {
  const root = $('flow-reviews'); root.replaceChildren();
  if (!state.reviews.length) return root.append(makeText('p', 'Không có bài cần kiểm tra.', 'muted'));
  for (const review of state.reviews) {
    const row = document.createElement('article'); row.className = 'flow-row';
    const body = document.createElement('div');
    const action = writingReviewAction(review);
    const title = action.canRetry
      ? `${stageNames[review.stage_key]} · đã thử ${review.attempt_count}/3`
      : 'Nguồn Test trùng · cần đối chiếu';
    const description = action.canRetry
      ? `${sourceName(review)} · lớp ${review.class_code || 'ngoài lớp'} · lỗi ${review.error_code}`
      : `${sourceName(review)} · lớp ${review.class_code || 'ngoài lớp'}. ${action.message}`;
    body.append(makeText('strong', title), makeText('p', description, 'flow-meta'));
    if (action.canRetry) {
      const button = actionButton('Chạy lại từ bước này', () => void retryReview(review, button), 'primary');
      row.append(body, button);
    } else row.append(body, actionButton('Xem bài', () => void openDetail(review)));
    root.append(row);
  }
}
function sourceIssueLabel(code) { return ({ FILE_TYPE_UNSUPPORTED: 'Sai loại file', FETCH_FAILED: 'Không mở được tài liệu', PARSER_FAILED: 'Không đọc được tài liệu', TOPIC_NOT_IN_REGISTRY: 'Đề không có trong kho đề', ESSAY_ANCHOR_MISSING: 'Thiếu ô “HV Viết bài”', ESSAY_CELL_MISSING: 'Thiếu ô bài làm', TEACHER_COMMENT_ANCHOR_MISSING: 'Thiếu ô “Comment của GV”', RESULT_CELL_AMBIGUOUS: 'Không xác định được ô ghi kết quả', TABLE_STRUCTURE_INVALID: 'Sai format bảng', NO_ESSAY: 'Chưa có bài làm', NOT_WRITING_DOCUMENT: 'Không phải tài liệu Writing' })[code] || code; }
async function retrySourceIssue(issue, button) {
  if (button.disabled) return;
  button.disabled = true;
  let submitted = false;
  try {
    await state.api.retryWritingSourceIssue(issue.issue_key, createRequestId());
    submitted = true;
    await refreshData();
  } catch (error) {
    if (!submitted) button.disabled = false;
    showError('flow-error', submitted
      ? `Đã gửi yêu cầu nhưng chưa cập nhật màn hình: ${error.message}`
      : `Chưa đọc lại được nguồn: ${error.message}`);
  }
}
function renderIssues() { const root = $('flow-source-issues'); root.replaceChildren(); if (!state.issues.length) return root.append(makeText('p', 'Không có lỗi nguồn.', 'muted')); for (const issue of state.issues) { const row = document.createElement('article'); row.className = 'flow-row'; const body = document.createElement('div'); body.append(makeText('strong', sourceIssueLabel(issue.reason_code)), makeText('p', `${sourceName(issue)} · lớp ${issue.class_code || 'ngoài lớp'} · bài ${issue.essay_slot || '—'}`, 'flow-meta')); const button = actionButton('Đọc lại nguồn', () => void retrySourceIssue(issue, button)); row.append(body, button); root.append(row); } }
function renderFailures() { const root = $('flow-technical-errors'); root.replaceChildren(); if (!state.failures.length) return root.append(makeText('p', 'Chưa có lỗi kỹ thuật trong bảy ngày gần đây.', 'muted')); for (const failure of state.failures) { const row = document.createElement('article'); row.className = 'flow-row'; const body = document.createElement('div'); body.append(makeText('strong', `${failure.workflow_name} · ${failure.last_node}`), makeText('p', `${formatTime(failure.last_seen_at)} · ${failure.error_kind} · gặp ${failure.seen_count || 1} lần`, 'flow-meta'), externalLink(`https://ducizone.ddns.net/workflow/${encodeURIComponent(failure.workflow_id)}`, 'Mở workflow n8n', '')); row.append(body); root.append(row); } }
const operatorLabels = { retry_requested: 'Retry bài lỗi', rerun_requested: 'Chạy lại từ một bước', skipped: 'Bỏ qua bài', restored: 'Khôi phục bài', source_issue_skipped: 'Bỏ qua lỗi nguồn', source_issue_restored: 'Khôi phục lỗi nguồn', source_edited: 'Sửa nguồn', manual_source_added: 'Thêm file ngoài lớp', class_scan_requested: 'Quét lớp ngay', legacy_imported: 'Nhập lịch sử cũ', legacy_promoted: 'Chuyển lịch sử sang nguồn mới', class_mapping_changed: 'Đổi trạng thái lớp từ mapping' };
function renderOperatorEvents() { const root = $('flow-operator-events'); root.replaceChildren(); if (!state.events.length) return root.append(makeText('p', 'Chưa có thao tác trong phạm vi đang lọc.', 'muted')); for (const event of state.events) { const row = document.createElement('article'); row.className = 'flow-row'; const body = document.createElement('div'); body.append(makeText('strong', operatorLabels[event.event_type] || event.event_type), makeText('p', `${formatTime(event.created_at)} · lớp ${event.class_code || 'ngoài lớp'} · ${event.actor_ref || 'hệ thống'}`, 'flow-meta')); if (event.reason) body.append(makeText('p', event.reason, 'flow-meta')); const states = document.createElement('details'); states.className = 'flow-audit-state'; states.append(makeText('summary', 'Xem trạng thái trước và sau'), makeText('pre', `Trước:\n${JSON.stringify(event.before_state || {}, null, 2)}\n\nSau:\n${JSON.stringify(event.after_state || {}, null, 2)}`)); body.append(states); row.append(body); root.append(row); } }
function renderLegacy() { const root = $('flow-legacy'); root.replaceChildren(); if (!state.legacy.length) return root.append(makeText('p', 'Chưa nhập lịch sử cũ trong phạm vi này.', 'muted')); for (const item of state.legacy) { const row = document.createElement('article'); row.className = 'flow-row'; row.append(makeText('div', `${item.student_name || 'Chưa có tên'} · ${item.class_code || '—'} · bài ${item.essay_slot || '—'} · ${item.source_status || '—'} · ${formatTime(item.created_at_source)}`)); root.append(row); } }
function openDailyDetails(day) { const normalized = normalizeWritingDay(day); if (!normalized) return; $('flow-date-from').value = normalized; $('flow-date-to').value = normalized; state.activeView = isTestView() ? 'test_delivered' : 'delivered'; state.pairs = []; state.nextCursor = null; state.nextOffset = null; void refreshData(); }
function renderDailyBars(root, days, interactive = true, maxHeight = 190) { root.replaceChildren(); if (!days.length) return root.append(makeText('p', 'Chưa có bài hoàn thành trong khoảng đã chọn.', 'muted')); const max = Math.max(...days.map(row => Number(row.completed_count || 0)), 1); const chart = document.createElement('div'); chart.className = 'flow-chart-bars'; for (const item of days) { const day = normalizeWritingDay(item.day); const bar = document.createElement(interactive ? 'button' : 'div'); if (interactive) { bar.type = 'button'; bar.disabled = !day; bar.title = day ? `Mở ${item.completed_count} bài đã giao ngày ${formatWritingDay(day)}` : 'Ngày không hợp lệ'; if (day) bar.addEventListener('click', () => openDailyDetails(day)); } bar.className = 'flow-chart-bar'; const visual = document.createElement('i'); visual.style.height = `${Math.max(3, Math.round(Number(item.completed_count || 0) / max * maxHeight))}px`; bar.append(visual, makeText('strong', item.completed_count), makeText('small', formatWritingDay(item.day))); chart.append(bar); } root.append(chart); }
// Nhận vào: ba số theo từng ngày từ API.
// Việc chính: vẽ ba cột cạnh nhau; chỉ cột Đã giao mở danh sách bài đã giao ngày đó.
// Trả ra: biểu đồ có chú giải, số và ngày đọc được ngay cả khi không dùng màu.
// Khi thiếu dữ liệu: giữ thông báo trống, không suy diễn bài đã chấm từ bài lịch sử.
function renderDaily() {
  const root = $('flow-daily-chart');
  root.replaceChildren();
  const days = dailyBreakdown(state.daily);
  if (!days.length) {
    root.append(makeText('p', 'Chưa có hoạt động trong khoảng đã chọn.', 'muted'));
    return;
  }
  const legend = document.createElement('div');
  legend.className = 'flow-chart-key';
  for (const series of days[0].series) {
    const item = makeText('span', series.label);
    item.className = `flow-chart-key-${series.key}`;
    legend.append(item);
  }
  const chart = document.createElement('div');
  chart.className = 'flow-chart-days';
  chart.setAttribute('aria-label', 'Các ngày; cuộn ngang để xem thêm');
  const max = Math.max(1, ...days.flatMap(row => row.series.map(series => series.count)));
  for (const row of days) {
    const group = document.createElement('div');
    group.className = 'flow-chart-day';
    const bars = document.createElement('div');
    bars.className = 'flow-chart-day-bars';
    for (const series of row.series) {
      const clickable = series.key === 'delivered' && row.day;
      const bar = document.createElement(clickable ? 'button' : 'div');
      bar.className = `flow-chart-day-bar flow-chart-day-bar-${series.key}`;
      bar.title = `${series.label}: ${series.count} · ${formatWritingDay(row.day)}`;
      bar.setAttribute('aria-label', bar.title);
      if (clickable) {
        bar.type = 'button';
        bar.addEventListener('click', () => openDailyDetails(row.day));
      }
      const visual = document.createElement('i');
      visual.style.height = `${Math.max(3, Math.round(series.count / max * 180))}px`;
      bar.append(makeText('strong', series.count), visual);
      bars.append(bar);
    }
    group.append(bars, makeText('small', formatWritingDay(row.day)));
    chart.append(group);
  }
  root.append(legend, makeText('p', 'Vuốt ngang để xem thêm ngày.', 'flow-chart-scroll-hint'), chart);
}
function renderAll() { renderHeading(); renderCounts(); renderSummary(); renderCoverage(); renderAttention(); renderClasses(); renderPairs(); renderReviews(); renderIssues(); renderFailures(); renderOperatorEvents(); renderLegacy(); renderDaily(); setViewVisibility(); }

async function loadPairs(reset = true) { const page = reset ? {} : state.nextCursor || (state.nextOffset == null ? {} : { offset: state.nextOffset }); const response = await state.api.writingPairsPage(currentFilters({ ...pairViewFilters(), ...page })); const rows = response.data.pairs || []; state.pairs = reset ? rows : [...state.pairs, ...rows]; state.nextCursor = response.data.nextCursor || null; state.nextOffset = response.data.nextOffset ?? null; }
async function loadCommon() { const [counts, activeClasses, completedClasses] = await Promise.all([state.api.writingCounts($('flow-class').value, $('flow-teacher').value, activeSourceKind()), state.api.writingClasses('active'), state.api.writingClasses('completed')]); state.counts = counts.data.counts || null; state.activeClasses = activeClasses.data.classes || []; state.completedClasses = completedClasses.data.classes || []; if (!state.filtersLoaded) { const response = await state.api.writingFilterOptions(); populateFilters(response.data.filters || {}); state.filtersLoaded = true; } }
async function loadView() {
  const filters = currentFilters();
  const view = baseView();
  if (view === 'overview') {
    if (isTestView()) { await loadPairs(true); state.coverage = []; state.reviews = []; state.issues = []; return; }
    const [coverage, reviews, issues] = await Promise.all([
      state.api.writingClassCoverage(), state.api.writingReviews({ ...filters, limit: 8 }),
      state.api.writingSourceIssues({ ...filters, status: 'open', limit: 8 }),
    ]);
    state.coverage = coverage.data.classes || []; state.reviews = reviews.data.reviews || [];
    state.issues = issues.data.issues || []; return;
  }
  if (view === 'mapping') { const response = await state.api.writingClassCoverage(); state.coverage = response.data.classes || []; return; }
  if (view === 'daily') { const response = await state.api.writingDailyStats(filters); state.daily = response.data.days || []; return; }
  if (view === 'classes') { if ($('flow-class').value) { const [stats] = await Promise.all([state.api.writingDailyStats(filters), loadPairs(true)]); state.daily = stats.data.days || []; } else { state.pairs = []; state.daily = []; state.nextCursor = null; state.nextOffset = null; } return; }
  if (view === 'completed_classes') return;
  if (view === 'review') { await loadPairs(true); return; }
  if (view === 'source') {
    const response = await state.api.writingSourceIssues({ ...filters, status: 'open', limit: 100 });
    state.issues = response.data.issues || []; state.pairs = state.issues.map(sourceIssueRow);
    state.nextCursor = null; state.nextOffset = null; return;
  }
  if (view === 'skipped') {
    await loadPairs(true);
    if (isTestView()) return;
    const response = await state.api.writingSourceIssues({ ...filters, status: 'skipped', limit: 100 });
    const skippedIssues = (response.data.issues || []).map(sourceIssueRow);
    state.pairs = [...state.pairs, ...skippedIssues].sort((left, right) =>
      new Date(right.skipped_at || right.updated_at).getTime()
        - new Date(left.skipped_at || left.updated_at).getTime());
    return;
  }
  if (view === 'logs') { const response = await state.api.writingWorkflowFailures(0, 100); state.failures = response.data.failures || []; return; }
  if (view === 'audit') { const response = await state.api.writingOperatorEvents({ classCode: filters.classCode, limit: 100 }); state.events = response.data.events || []; return; }
  if (view === 'legacy') { const response = await state.api.writingLegacy(filters.classCode, 0, 50); state.legacy = response.data.records || []; state.pairs = state.legacy.map(legacyRow); state.nextCursor = null; state.nextOffset = null; return; }
  await loadPairs(true);
}

async function refreshData() { clearTimeout(state.timer); if (!state.authenticated || !state.api) return; const generation = state.loginGeneration; try { await loadCommon(); await loadView(); if (generation !== state.loginGeneration) return; renderAll(); $('flow-login').hidden = true; $('flow-dashboard').hidden = false; $('flow-updated').textContent = `Đã cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`; showError('flow-login-error'); showError('flow-error'); } catch (error) { const failure = teacherAuthFailure(error.status); if (failure) { clearLogin(); showError('flow-login-error', failure.message); globalThis.google?.accounts?.id?.disableAutoSelect?.(); return; } showError($('flow-dashboard').hidden ? 'flow-login-error' : 'flow-error', `Chưa tải được trạng thái: ${error.message}`); } state.timer = setTimeout(refreshData, 30_000); }
async function submitManual(event) {
  event.preventDefault();
  // Giữ biểu mẫu ngay khi người dùng bấm: currentTarget của trình duyệt thành null sau await.
  const form = event.currentTarget;
  const button = event.submitter;
  const kind = $('flow-manual-kind').value;
  const payload = {
    displayName: $('flow-manual-name').value.trim(),
    documentUrl: $('flow-manual-url').value.trim(),
    kind,
    ...(kind === 'test' ? {
      testConfig: $('flow-manual-test-config').value.trim() || null,
      topology: $('flow-manual-topology').value,
      note: $('flow-manual-note').value.trim() || null,
    } : {}),
  };
  if (button) button.disabled = true;
  try {
    // Chỉ lỗi từ API mới có nghĩa là file chưa được nhận.
    await state.api.addWritingManualSource(payload, createRequestId());
  } catch (error) {
    showError('flow-error', `Chưa thêm được file: ${error.message}`);
    return;
  } finally {
    if (button) button.disabled = false;
  }
  // API đã nhận file: đóng form và báo thành công, tránh bấm lại tạo nguồn trùng.
  form.reset();
  $('flow-manual-test-fields').hidden = true;
  $('flow-manual-dialog').close();
  await refreshData();
  showError('flow-error', `Đã thêm ${kind === 'test' ? 'bài Test' : 'file'}. Hệ thống sẽ kiểm đề và format trước khi chấm.`);
}
async function handleCredential(response) { if (!response?.credential) return showError('flow-login-error', 'Không nhận được thông tin đăng nhập.'); state.loginGeneration += 1; state.authenticated = false; try { await state.sessionClient.login(response.credential); state.authenticated = true; if ($('remember-flow-login').checked) loginPreference.set(true); await refreshData(); } catch (error) { clearLogin(); showError('flow-login-error', `Không thể đăng nhập: ${error.message}`); } }
async function waitForGoogle(clientId) { for (let attempt = 0; attempt < 100; attempt += 1) { const accounts = globalThis.google?.accounts?.id; if (accounts) { accounts.initialize({ client_id: clientId, callback: handleCredential, auto_select: loginPreference.read() }); accounts.renderButton($('google-signin'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'vi' }); return; } await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Không tải được dịch vụ đăng nhập Google.'); }
function clearLogin() { state.loginGeneration += 1; state.authenticated = false; clearTimeout(state.timer); $('flow-dashboard').hidden = true; $('flow-login').hidden = false; }
function selectView(view) { state.activeView = view; $('flow-stage-status').value = ''; state.pairs = []; state.nextCursor = null; state.nextOffset = null; void refreshData(); }
function clearFilters() { $('flow-search').value = ''; $('flow-search-scope').value = 'all'; $('flow-class').value = ''; $('flow-teacher').value = ''; $('flow-task-type').value = ''; $('flow-stage-status').value = ''; $('flow-date-from').value = ''; $('flow-date-to').value = ''; state.pairs = []; state.nextCursor = null; state.nextOffset = null; void refreshData(); }
async function init() { try { const response = await fetch('./writing-flow-config.json', { cache: 'no-store' }); if (!response.ok) throw new Error('Thiếu cấu hình trang chấm bài.'); const config = await response.json(); state.sessionClient = createTeacherSessionClient({ apiBaseUrl: config.apiBase || '', sessionPath: 'api/v1/auth/session' }); state.api = createTeacherApi(config.apiBase || ''); renderColumnChoices(); renderSortControls(); $('flow-manual-form').addEventListener('submit', event => void submitManual(event)); $('flow-manual-kind').addEventListener('change', () => { $('flow-manual-test-fields').hidden = $('flow-manual-kind').value !== 'test'; }); $('flow-manual-open').addEventListener('click', () => $('flow-manual-dialog').showModal()); $('flow-detail-close').addEventListener('click', () => $('flow-detail').close()); $('flow-detail').addEventListener('click', event => { const dialog = $('flow-detail'); if (event.target === dialog && isBackdropClick(event, dialog.getBoundingClientRect())) dialog.close(); }); $('flow-reset-widths').addEventListener('click', resetColumnWidths); $('flow-class').addEventListener('change', () => { if ($('flow-class').value) rememberClass($('flow-class').value); void refreshData(); }); for (const id of ['flow-teacher', 'flow-task-type', 'flow-stage-status', 'flow-date-from', 'flow-date-to']) $(id).addEventListener('change', () => void refreshData()); $('flow-search-button').addEventListener('click', () => void refreshData()); $('flow-search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void refreshData(); } }); for (const button of document.querySelectorAll('#flow-views [data-view]')) button.addEventListener('click', () => selectView(button.dataset.view)); $('flow-clear-filters').addEventListener('click', clearFilters); $('flow-refresh').addEventListener('click', () => void refreshData()); $('flow-more').addEventListener('click', async () => { if ((!state.nextCursor && state.nextOffset == null) || state.loadingMore) return; state.loadingMore = true; try { await loadPairs(false); renderPairs(); } finally { state.loadingMore = false; } }); const restored = await state.sessionClient.restore(); if (restored) { state.authenticated = true; await refreshData(); } await waitForGoogle(config.googleClientId); if (!state.authenticated && loginPreference.read()) globalThis.google.accounts.id.prompt(); } catch (error) { showError('flow-login-error', error.message); } }

$('remember-flow-login').checked = loginPreference.read();
$('remember-flow-login').addEventListener('change', () => { const input = $('remember-flow-login'); if (!loginPreference.set(input.checked)) input.checked = loginPreference.read(); });
$('flow-logout').addEventListener('click', () => { clearLogin(); globalThis.google?.accounts?.id?.disableAutoSelect?.(); loginPreference.set(false); $('remember-flow-login').checked = false; });
void init();
