import { createTeacherApi } from './api.js?rev=20260920-server-session-v1';
import { createRequestId } from './core.js';
import { teacherAuthFailure } from './teacher-auth-ui.js';
import { coverageDescription, coverageStatusLabels } from './writing-flow-coverage.js';
import { createTeacherLoginPreference } from '../../shared/teacher-login-preference.js?rev=20260918-v1';
import { createTeacherSessionClient } from '../../shared/teacher-session-client.js?rev=20260920-v1';

// Nhận trạng thái và log từ API quản trị, rồi hiện 7 giai đoạn theo dạng bảng 50 dòng.
// Người vận hành thêm file thủ công, retry, bỏ qua hoặc khôi phục mà không sửa Lark Base.
// Khi lỗi, màn hình giữ dữ liệu cũ và chỉ báo lỗi; không tự coi thao tác là thành công.
const $ = id => document.getElementById(id);
const loginPreference = createTeacherLoginPreference(() => window.localStorage);
const stages = ['intake', 'precheck', 'main', 'critic', 'arbiter', 'render', 'deliver'];
const stageNames = { intake: 'Tiếp nhận', precheck: 'Kiểm trước khi chấm', main: 'Chấm chính',
  critic: 'Phản biện', arbiter: 'Phân xử', render: 'Tạo trang kết quả', deliver: 'Ghi link vào homework' };
const stageWorkflowIds = { intake: 'zxSd0xBPJzMqQlWt', precheck: 'P2p5N7iZzwHFDufk',
  main: 'X0qzwWc5CgBzgOWT', critic: '4o6jEwyQM4U29XU6', arbiter: 'yFdVOEBVhLitToQD',
  render: 'o8uncH0TWsJybeS2', deliver: 'KqWtSbjkHDMSAgbN' };
const statusNames = { received: 'Chờ chấm', running: 'Đang xử lý', needs_review: 'Cần kiểm tra',
  delivered: 'Đã giao', superseded: 'Có bản mới', pending: 'Đang chờ', succeeded: 'Đã xong', skipped: 'Bỏ qua' };
const state = { authenticated: false, api: null, sessionClient: null, timer: null, loginGeneration: 0,
  activeView: 'overview', pairs: [], nextCursor: null, loadingMore: false, summary: [], counts: null,
  coverage: [], reviews: [], issues: [], failures: [], legacy: [] };

function makeText(tag, value, className = '') { const node = document.createElement(tag); node.textContent = String(value ?? ''); if (className) node.className = className; return node; }
function showError(id, message = '') { const node = $(id); node.textContent = message; node.hidden = !message; }
function formatTime(value) { return value ? new Date(value).toLocaleString('vi-VN') : '—'; }
function sourceName(row) { return row.student_name || row.display_name || 'Chưa có tên'; }
function rowMatchesTeacher(row, teacher) { return !teacher || (row.teacher_names || []).includes(teacher); }
function filters(extra = {}) { return { classCode: $('flow-class').value, teacherName: $('flow-teacher').value, limit: 50, ...extra }; }
function viewFilters() { if (stages.includes(state.activeView)) return { stageKey: state.activeView }; if (state.activeView === 'skipped') return { view: 'skipped' }; if (state.activeView === 'delivered') return { view: 'delivered' }; return state.activeView === 'overview' ? {} : { view: 'unfinished' }; }

function populateFilters(rows) {
  const teacher = $('flow-teacher'); const selectedTeacher = teacher.value;
  const teachers = [...new Set(rows.flatMap(row => row.teacher_names || []))].sort((a, b) => a.localeCompare(b, 'vi'));
  teacher.replaceChildren(new Option('Tất cả giảng viên', '')); for (const name of teachers) teacher.append(new Option(name, name));
  teacher.value = teachers.includes(selectedTeacher) ? selectedTeacher : '';
  const select = $('flow-class'); const selectedClass = select.value;
  const codes = [...new Set(rows.filter(row => rowMatchesTeacher(row, teacher.value)).map(row => row.class_code).filter(Boolean))].sort();
  select.replaceChildren(new Option('Tất cả lớp', '')); for (const code of codes) select.append(new Option(code, code));
  select.value = codes.includes(selectedClass) ? selectedClass : '';
}

function renderSummary() {
  const root = $('flow-summary'); root.replaceChildren(); const counts = new Map();
  for (const row of state.summary) counts.set(row.status, (counts.get(row.status) || 0) + Number(row.pair_count || 0));
  for (const status of ['received', 'running', 'needs_review', 'delivered', 'superseded']) { const card = document.createElement('article'); card.dataset.status = status; card.append(makeText('strong', counts.get(status) || 0), makeText('span', statusNames[status])); root.append(card); }
}
function renderCounts() {
  const values = { overview: state.summary.reduce((sum, row) => sum + Number(row.pair_count || 0), 0), review: state.reviews.length,
    source: state.issues.length, skipped: 0, delivered: state.summary.filter(row => row.status === 'delivered').reduce((sum, row) => sum + Number(row.pair_count || 0), 0), legacy: state.legacy.length };
  for (const stage of stages) values[stage] = 0;
  for (const row of state.counts?.stages || []) { if (row.skipped) values.skipped += Number(row.pair_count || 0); else values[row.stage_key] = (values[row.stage_key] || 0) + Number(row.pair_count || 0); }
  for (const [view, count] of Object.entries(values)) { const node = document.querySelector(`[data-count="${view}"]`); if (node) node.textContent = String(count); }
}
function actionButton(label, handler, className = 'secondary') { const button = makeText('button', label); button.type = 'button'; button.className = className; button.addEventListener('click', handler); return button; }

async function requestClassScan(classCode, button) { const reason = prompt(`Lý do quét lại lớp ${classCode}:`, 'Kiểm tra bài mới')?.trim(); if (!reason) return; button.disabled = true; try { await state.api.requestWritingClassScan(classCode, reason); showError('flow-error', `Đã xếp lớp ${classCode} vào lượt quét gần nhất.`); } catch (error) { showError('flow-error', `Chưa quét được lớp: ${error.message}`); button.disabled = false; } }
function renderCoverage() {
  const root = $('flow-class-coverage'); root.replaceChildren(); const rows = state.coverage.filter(row => (!$('flow-class').value || row.class_code === $('flow-class').value));
  if (!rows.length) return root.append(makeText('p', 'Chưa có dữ liệu đối chiếu lớp.', 'muted'));
  for (const item of rows) { const row = document.createElement('article'); row.className = 'flow-row flow-coverage-row'; row.dataset.status = item.status;
    const body = document.createElement('div'); body.append(makeText('strong', `${item.class_code || item.class_name || 'Chưa rõ lớp'} · ${coverageStatusLabels[item.status] || item.status}`), makeText('p', coverageDescription(item), 'flow-meta'));
    if (item.class_code && item.status !== 'excluded') row.append(body, actionButton('Quét lớp ngay', () => void requestClassScan(item.class_code, row.lastElementChild))); else row.append(body); root.append(row); }
}

async function skipPair(pair) { const reason = prompt('Lý do bỏ qua bài này:')?.trim(); if (!reason) return; try { await state.api.skipWritingPair(pair.pair_id, reason); await refreshData(); } catch (error) { showError('flow-error', `Chưa bỏ qua được bài: ${error.message}`); } }
async function restorePair(pair) { const reason = prompt('Lý do khôi phục bài:', 'Bỏ qua nhầm')?.trim(); if (!reason) return; try { await state.api.restoreWritingPair(pair.pair_id, reason); await refreshData(); } catch (error) { showError('flow-error', `Chưa khôi phục được bài: ${error.message}`); } }
async function retryPair(pair) { const stageKey = stages.includes(state.activeView) ? state.activeView : pair.stage_key; const reason = prompt(`Lý do chạy lại từ bước “${stageNames[stageKey] || stageKey}”:`, 'Kiểm tra và chạy lại')?.trim(); if (!reason) return; try { await state.api.retryWritingPairStage(pair.pair_id, stageKey, reason); await refreshData(); } catch (error) { showError('flow-error', `Chưa tạo được lượt retry: ${error.message}`); } }

function renderPairs() {
  const root = $('flow-pairs'); root.replaceChildren();
  if (!state.pairs.length) { const row = document.createElement('tr'); const cell = makeText('td', 'Chưa có bài trong phạm vi đã chọn.', 'muted'); cell.colSpan = 10; row.append(cell); root.append(row); return; }
  for (const pair of state.pairs) { const row = document.createElement('tr'); const status = document.createElement('td'); const pill = makeText('span', `${stageNames[pair.stage_key] || pair.stage_key} · ${statusNames[pair.stage_status] || pair.stage_status}`, 'flow-stage-pill'); pill.dataset.status = pair.stage_status; status.append(pill);
    const file = document.createElement('td'); if (pair.file_url) { const link = makeText('a', 'Mở Google Docs'); link.href = pair.file_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; file.append(link); } else file.textContent = pair.homework_file_id || '—';
    const classroom = document.createElement('td'); if (pair.classroom_url) { const link = makeText('a', 'Mở Classroom'); link.href = pair.classroom_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; classroom.append(link); } else classroom.textContent = '—';
    const actions = document.createElement('td'); actions.className = 'flow-actions'; actions.append(actionButton('Xem', () => void openDetail(pair)));
    actions.append(pair.skipped_at ? actionButton('Khôi phục', () => void restorePair(pair)) : actionButton('Bỏ qua', () => void skipPair(pair)));
    if (pair.stage_key !== 'intake') actions.append(actionButton('Retry', () => void retryPair(pair), 'primary'));
    row.append(status, makeText('td', sourceName(pair)), makeText('td', pair.class_code || '—'), makeText('td', (pair.teacher_names || []).join(', ') || '—'), file, classroom, makeText('td', pair.source_status || '—'), makeText('td', formatTime(pair.finished_at)), makeText('td', formatTime(pair.source_created_at || pair.created_at)), actions); root.append(row); }
  $('flow-more').hidden = !state.nextCursor;
}

function describeEvent(event) { const step = stageNames[event.stage_key] || event.stage_key || ''; if (event.kind === 'attempt') return `${step}: lần ${event.attempt_no}, ${event.status}`; if (event.kind === 'ai_call') return `${step}: gọi AI ${event.provider || ''}, ${event.status}`; if (event.kind === 'handoff') return `Chuyển ${stageNames[event.from_stage] || event.from_stage} → ${stageNames[event.to_stage] || event.to_stage}: ${event.status}`; if (event.kind === 'operator') return `Thao tác ${event.event_type}: ${event.reason || ''}`; return `${step}: ${event.status || event.kind}`; }
async function openDetail(pair) {
  const dialog = $('flow-detail'); const content = $('flow-detail-content'); content.textContent = 'Đang tải nội dung và log…'; dialog.showModal();
  try { const [detailResponse, historyResponse] = await Promise.all([state.api.writingPairDetail(pair.pair_id), state.api.writingPairHistory(pair.pair_id)]); const detail = detailResponse.data.detail; const history = historyResponse.data.history;
    const grid = document.createElement('div'); grid.className = 'flow-detail-grid'; const source = document.createElement('section'); source.className = 'flow-detail-panel'; source.append(makeText('h3', 'Bài nguồn'), makeText('p', `Đề bài\n${detail.source.topic || '—'}`), makeText('p', `Ảnh biểu đồ\n${detail.source.image || '—'}`), makeText('p', `Nội dung học viên\n${detail.source.essay || '—'}`), makeText('p', `TRCC: ${detail.source.trCcCheck ? 'Có' : 'Không'}`));
    const results = document.createElement('section'); results.className = 'flow-detail-panel'; results.append(makeText('h3', 'Text chấm bài'));
    for (const stage of detail.stages) { const block = document.createElement('details'); block.open = ['render', 'deliver'].includes(stage.stage_key); block.append(makeText('summary', `${stageNames[stage.stage_key]} · ${statusNames[stage.status] || stage.status}`), makeText('pre', stage.result ? JSON.stringify(stage.result, null, 2) : 'Chưa có kết quả.')); results.append(block); }
    const log = document.createElement('section'); log.className = 'flow-detail-panel flow-detail-panel-wide'; log.append(makeText('h3', 'Nhật ký và lỗi'));
    for (const event of history.events || []) { const line = makeText('p', `${formatTime(event.at)} · ${describeEvent(event)}${event.error_code ? ` · lỗi ${event.error_code}` : ''}`, 'flow-meta'); const workflowId = stageWorkflowIds[event.stage_key]; if (workflowId && event.n8n_execution_id) { const link = makeText('a', 'Mở lượt chạy n8n'); link.href = `https://ducizone.ddns.net/workflow/${workflowId}/executions/${encodeURIComponent(event.n8n_execution_id)}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; line.append(' · ', link); } log.append(line); }
    grid.append(source, results, log); content.replaceChildren(makeText('h2', sourceName(detail.pair)), grid);
  } catch (error) { content.textContent = `Chưa đọc được chi tiết: ${error.message}`; }
}

async function retryReview(review, button) { if (!confirm(`Chạy lại từ bước “${stageNames[review.stage_key] || review.stage_key}”?`)) return; button.disabled = true; try { await state.api.retryWritingReview(review.review_id, createRequestId()); await refreshData(); } catch (error) { showError('flow-error', `Chưa gửi được yêu cầu: ${error.message}`); button.disabled = false; } }
function renderReviews() { const root = $('flow-reviews'); root.replaceChildren(); if (!state.reviews.length) return root.append(makeText('p', 'Không có bài cần kiểm tra.', 'muted')); for (const review of state.reviews) { const row = document.createElement('article'); row.className = 'flow-row'; const body = document.createElement('div'); body.append(makeText('strong', `${stageNames[review.stage_key]} · đã thử ${review.attempt_count}/3`), makeText('p', `Lớp ${review.class_code} · bài ${review.essay_slot} · lỗi ${review.error_code}`, 'flow-meta')); const button = actionButton('Chạy lại từ bước này', () => void retryReview(review, button), 'primary'); row.append(body, button); root.append(row); } }
async function retrySourceIssue(issue, button) { if (!confirm('Đọc lại nguồn này? Thao tác không sửa Lark Base.')) return; button.disabled = true; try { await state.api.retryWritingSourceIssue(issue.issue_key, createRequestId()); await refreshData(); } catch (error) { showError('flow-error', `Chưa đọc lại được nguồn: ${error.message}`); button.disabled = false; } }
function renderIssues() { const labels = { FILE_TYPE_UNSUPPORTED: 'Sai loại file', FETCH_FAILED: 'Không mở được tài liệu', PARSER_FAILED: 'Không đọc được tài liệu', TOPIC_NOT_IN_REGISTRY: 'Đề không có trong kho đề', ESSAY_ANCHOR_MISSING: 'Thiếu ô “HV Viết bài”', ESSAY_CELL_MISSING: 'Thiếu ô bài làm', TEACHER_COMMENT_ANCHOR_MISSING: 'Thiếu ô “Comment của GV”', RESULT_CELL_AMBIGUOUS: 'Không xác định được ô ghi kết quả', TABLE_STRUCTURE_INVALID: 'Sai format bảng', NO_ESSAY: 'Chưa có bài làm', NOT_WRITING_DOCUMENT: 'Không phải tài liệu Writing' }; const root = $('flow-source-issues'); root.replaceChildren(); if (!state.issues.length) return root.append(makeText('p', 'Không có lỗi nguồn.', 'muted')); for (const issue of state.issues) { const row = document.createElement('article'); row.className = 'flow-row'; const body = document.createElement('div'); body.append(makeText('strong', labels[issue.reason_code] || issue.reason_code), makeText('p', `${sourceName(issue)} · lớp ${issue.class_code || '—'} · bài ${issue.essay_slot || '—'}`, 'flow-meta')); const button = actionButton('Đọc lại nguồn', () => void retrySourceIssue(issue, button)); row.append(body, button); root.append(row); } }
function renderFailures() { const root = $('flow-technical-errors'); root.replaceChildren(); if (!state.failures.length) return root.append(makeText('p', 'Chưa có lỗi kỹ thuật gần đây.', 'muted')); for (const failure of state.failures) { const row = document.createElement('article'); row.className = 'flow-row'; const body = document.createElement('div'); body.append(makeText('strong', `${failure.workflow_name} · ${failure.last_node}`), makeText('p', `${formatTime(failure.last_seen_at)} · ${failure.error_kind}`, 'flow-meta')); const link = makeText('a', 'Mở trên n8n'); link.href = `https://ducizone.ddns.net/workflow/${encodeURIComponent(failure.workflow_id)}`; link.target = '_blank'; body.append(link); row.append(body); root.append(row); } }
function renderLegacy() { const root = $('flow-legacy'); root.replaceChildren(); if (!state.legacy.length) return root.append(makeText('p', 'Chưa nhập lịch sử cũ trong phạm vi này.', 'muted')); for (const item of state.legacy) { const row = document.createElement('article'); row.className = 'flow-row'; row.append(makeText('div', `${item.student_name || 'Chưa có tên'} · ${item.class_code || '—'} · bài ${item.essay_slot || '—'} · ${item.source_status || '—'} · ${formatTime(item.created_at_source)}`)); root.append(row); } }

function setViewVisibility() { const view = state.activeView; const visible = view === 'overview' ? ['flow-coverage-section', 'flow-summary-section', 'flow-reviews-section', 'flow-source-section', 'flow-technical-section', 'flow-pairs-section'] : view === 'review' ? ['flow-reviews-section'] : view === 'source' ? ['flow-source-section', 'flow-technical-section'] : view === 'legacy' ? ['flow-legacy-section'] : ['flow-pairs-section']; for (const id of ['flow-coverage-section', 'flow-summary-section', 'flow-reviews-section', 'flow-source-section', 'flow-technical-section', 'flow-pairs-section', 'flow-legacy-section']) $(id).hidden = !visible.includes(id); for (const button of document.querySelectorAll('#flow-views [data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view)); $('flow-pairs-title').textContent = stages.includes(view) ? `Bài ở bước ${stageNames[view]}` : view === 'skipped' ? 'Các bài đã bỏ qua' : view === 'delivered' ? 'Các bài đã giao' : 'Các bài gần đây'; }
function renderAll() { renderSummary(); renderCounts(); renderCoverage(); renderPairs(); renderReviews(); renderIssues(); renderFailures(); renderLegacy(); setViewVisibility(); }
async function loadPairs(reset = true) { const cursor = reset ? {} : (state.nextCursor || {}); const response = await state.api.writingPairsPage(filters({ ...viewFilters(), ...cursor })); const rows = response.data.pairs || []; state.pairs = reset ? rows : [...state.pairs, ...rows]; state.nextCursor = response.data.nextCursor || null; }

async function refreshData() {
  clearTimeout(state.timer); if (!state.authenticated || !state.api) return; const generation = state.loginGeneration;
  try { const classCode = $('flow-class').value; const teacherName = $('flow-teacher').value; const [summary, counts, coverage, reviews, issues, failures, legacy] = await Promise.all([state.api.writingSummary(), state.api.writingCounts(classCode, teacherName), state.api.writingClassCoverage(), state.api.writingReviews(0, 200), state.api.writingSourceIssues(0, 200), state.api.writingWorkflowFailures(0, 100), state.api.writingLegacy(classCode, 0, 50)]); if (generation !== state.loginGeneration) return;
    state.summary = summary.data.summary || []; state.counts = counts.data.counts || null; state.coverage = coverage.data.classes || []; state.reviews = (reviews.data.reviews || []).filter(row => (!classCode || row.class_code === classCode) && rowMatchesTeacher(row, teacherName)); state.issues = (issues.data.issues || []).filter(row => !classCode || row.class_code === classCode); state.failures = failures.data.failures || []; state.legacy = legacy.data.records || [];
    populateFilters([...state.summary, ...state.coverage, ...state.reviews, ...state.issues]); if (!['review', 'source', 'legacy'].includes(state.activeView)) await loadPairs(true); else state.pairs = []; renderAll(); $('flow-login').hidden = true; $('flow-dashboard').hidden = false; $('flow-updated').textContent = `Đã cập nhật ${new Date().toLocaleTimeString('vi-VN')}`; showError('flow-login-error'); showError('flow-error');
  } catch (error) { const failure = teacherAuthFailure(error.status); if (failure) { clearLogin(); showError('flow-login-error', failure.message); globalThis.google?.accounts?.id?.disableAutoSelect?.(); return; } showError($('flow-dashboard').hidden ? 'flow-login-error' : 'flow-error', `Chưa tải được trạng thái: ${error.message}`); }
  state.timer = setTimeout(refreshData, 30_000);
}
async function submitManual(event) { event.preventDefault(); const button = event.submitter; button.disabled = true; try { await state.api.addWritingManualSource($('flow-manual-name').value.trim(), $('flow-manual-url').value.trim(), createRequestId()); event.currentTarget.reset(); showError('flow-error', 'Đã thêm file. Hệ thống sẽ đọc, tách từng bài và chuyển qua 7 giai đoạn.'); await refreshData(); } catch (error) { showError('flow-error', `Chưa thêm được file: ${error.message}`); } finally { button.disabled = false; } }
async function handleCredential(response) { if (!response?.credential) return showError('flow-login-error', 'Không nhận được thông tin đăng nhập.'); state.loginGeneration += 1; state.authenticated = false; try { await state.sessionClient.login(response.credential); state.authenticated = true; await refreshData(); } catch (error) { clearLogin(); showError('flow-login-error', `Không thể đăng nhập: ${error.message}`); } }
async function waitForGoogle(clientId) { for (let attempt = 0; attempt < 100; attempt += 1) { const accounts = globalThis.google?.accounts?.id; if (accounts) { accounts.initialize({ client_id: clientId, callback: handleCredential, auto_select: loginPreference.read() }); accounts.renderButton($('google-signin'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'vi' }); return; } await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Không tải được dịch vụ đăng nhập Google.'); }
function clearLogin() { state.loginGeneration += 1; state.authenticated = false; clearTimeout(state.timer); $('flow-dashboard').hidden = true; $('flow-login').hidden = false; }
async function init() { try { const response = await fetch('./writing-flow-config.json', { cache: 'no-store' }); if (!response.ok) throw new Error('Thiếu cấu hình trang chấm bài.'); const config = await response.json(); state.sessionClient = createTeacherSessionClient({ apiBaseUrl: config.apiBase || '', sessionPath: 'api/v1/auth/session' }); state.api = createTeacherApi(config.apiBase || ''); $('flow-manual-form').addEventListener('submit', event => void submitManual(event)); $('flow-detail-close').addEventListener('click', () => $('flow-detail').close()); for (const id of ['flow-class', 'flow-teacher']) $(id).addEventListener('change', () => void refreshData()); for (const button of document.querySelectorAll('#flow-views [data-view]')) button.addEventListener('click', () => { state.activeView = button.dataset.view; void refreshData(); }); $('flow-more').addEventListener('click', async () => { if (!state.nextCursor || state.loadingMore) return; state.loadingMore = true; try { await loadPairs(false); renderPairs(); } finally { state.loadingMore = false; } }); const restored = await state.sessionClient.restore(); if (restored) { state.authenticated = true; await refreshData(); } await waitForGoogle(config.googleClientId); if (!state.authenticated && loginPreference.read()) globalThis.google.accounts.id.prompt(); } catch (error) { showError('flow-login-error', error.message); } }

$('remember-flow-login').checked = loginPreference.read();
$('remember-flow-login').addEventListener('change', () => { const input = $('remember-flow-login'); if (!loginPreference.set(input.checked)) input.checked = loginPreference.read(); });
$('flow-logout').addEventListener('click', async () => { try { await state.sessionClient?.logout(); } catch { /* Vẫn xóa dữ liệu đang hiển thị. */ } clearLogin(); globalThis.google?.accounts?.id?.disableAutoSelect?.(); loginPreference.set(false); $('remember-flow-login').checked = false; });
void init();
