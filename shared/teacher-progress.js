import {patchReadingView} from './reading-view.mjs?v=20261027-reading1';
import { teacherSessionRequestOptions } from './teacher-session-client.js?startup=20261026-v2';
import { renderPracticeDefinitionHtml as definitionHtml } from './teacher-practice-definition.js?v=20261028-full-test1';

// Nhận dữ liệu chỉ đọc từ API của từng sản phẩm. Không dùng danh tính học viên,
// không gọi begin/open/pulse/submit và không tạo trình phát hoặc yêu cầu audio.
const product = document.body.dataset.product;
const speaking = product === 'speaking';
const query = new URLSearchParams(location.search);
const config = speaking ? window.TERM_TEST_APP_CONFIG : window[product === 'reading' ? 'READING_CONFIG' : 'LISTENING_CONFIG'];
const base = String(speaking ? config.API_BASE_URL : config.apiBase).replace(/\/$/, '');
const progressPath = speaking ? '/api/speaking-homework-independent/teacher/progress' : '/teacher/progress';
const titles = { speaking: 'Speaking Homework', reading: 'Reading thực chiến', listening: 'Listening thực chiến' };
const defaults = { reading: query.get('lesson') === '7' ? '67-practice-reading_matching_heading_mcq' : '67-practice-reading_matching_names_sentence_endings_mcq', listening: '67-practice-listening_mcq_flowchart' };
const state = { code: query.get('code') || defaults[product] || '', classes: [], classId: '', students: [], selected: null, detail: null, attemptId: null, focusRef: null };
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const workId = value => uuid(speaking && String(value).startsWith('legacy_') ? value.slice(7) : value);
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa có bản lưu';
const status = unit => unit?.status === 'submitted' ? 'Đã nộp' : !unit || unit.status === 'not_started' ? 'Chưa có tiến trình' : unit.status === 'reset' ? 'Đã reset' : 'Có tiến trình chưa nộp';
let generation = 0, controller = new AbortController(), timer, googleLoading;
let bootGeneration = null, resumeBoot = false;
const back = new URL(query.get('back') || './index.html', location.href);
$('student-return').href = back.origin === location.origin ? back.href : './index.html';
$('page-title').textContent = titles[product];

function notice(message, kind = '') { $('notice').textContent = message; $('notice').dataset.kind = kind; $('notice').hidden = !message; }
function resetRequests() { generation++;controller.abort();controller = new AbortController();clearTimeout(timer);return generation; }
function rememberView({ unitId = state.selected, attemptId = state.attemptId, view = 'detail', clearEntry = false } = {}) {
  // URL chỉ nhớ vị trí xem; máy chủ vẫn kiểm quyền lớp và bài ở mọi yêu cầu.
  const url = new URL(location.href), fragment = new URLSearchParams(url.hash.slice(1));
  url.searchParams.set('code', state.code);url.searchParams.set('classId', state.classId);
  if (clearEntry) { fragment.delete('entry');url.searchParams.delete('documentId'); }
  if (uuid(state.focusRef)) fragment.set('student', state.focusRef);else fragment.delete('student');
  if (workId(unitId)) fragment.set('unit', unitId);else fragment.delete('unit');
  if (uuid(attemptId)) fragment.set('attempt', attemptId);else fragment.delete('attempt');
  if (view === 'list') fragment.set('view', 'list');else fragment.delete('view');
  url.hash = fragment.toString();
  if (url.href !== location.href) history.pushState({}, '', url);
}
async function request(path, body, { method = body ? 'POST' : 'GET', signal = controller.signal } = {}) {
  const response = await fetch(base + path, teacherSessionRequestOptions({ method, cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) }));
  const value = await response.json().catch(() => ({}));
  if (!response.ok || value.ok === false) {
    const error = new Error(value.message || value.error?.message || 'Chưa tải được dữ liệu. Hãy thử lại.');
    error.status = response.status;error.code = value.error?.code || value.error;throw error;
  }
  return value;
}
function privateClear() {
  state.students = [];state.detail = null;state.selected = null;state.attemptId = null;state.focusRef = null;
  $('search').value = '';
  $('rows').replaceChildren();$('detail').replaceChildren();$('detail').hidden = true;$('list-panel').hidden = false;$('workspace').hidden = true;document.body.classList.remove('teacher-view-detail');
}
async function handle(error, epoch = generation) {
  if (epoch !== generation || error.name === 'AbortError') return;
  if (error.status === 401 || error.status === 403) {
    resetRequests();privateClear();
    if (error.status === 401) await showLogin();
    else { $('auth').hidden = true;notice(error.message + ' Bạn có thể đăng xuất để đổi tài khoản.', 'error'); }
  } else { notice(error.message + ' Sẽ tự thử lại; nội dung đang hiện là bản đọc trước đó.', 'error');schedule(); }
}
function schedule() {
  clearTimeout(timer);
  if (!document.hidden && !$('workspace').hidden) timer = setTimeout(() => refresh(true), 30000);
}
function renderRows() {
  const search = $('search').value.trim().toLocaleLowerCase('vi');
  const filter = $('status-filter').value;
  const selected = state.students.filter(student => (!state.focusRef || student.studentRef === state.focusRef) && student.name.toLocaleLowerCase('vi').includes(search))
    .filter(student => !filter || (filter === 'empty' ? !student.units.length || student.units.every(u => u.status === 'not_started')
      : filter === 'submitted' ? student.units.some(u => u.status === 'submitted') : student.units.some(u => !['submitted', 'not_started'].includes(u.status))));
  $('rows').innerHTML = selected.length ? selected.map(student => {
    const units = student.units;
    return `<tr><td><strong>${escape(student.name)}</strong>${student.active === false ? '<small>Không còn trong danh sách đang học</small>' : ''}</td><td>${units.length ? units.map(u => `<span class="badge ${u.status === 'submitted' ? 'done' : 'pending'}">${status(u)}</span>`).join(' ') : '<span class="badge">Chưa có tiến trình</span>'}</td><td>${units.length ? units.map(u => speaking ? `Đã gửi ${u.sentLinks} link` : `Đã lưu ${u.answered} câu`).join('<br>') : 'Chưa có bài lưu trên máy chủ'}</td><td>${units.length ? units.map(u => date(u.savedAt)).join('<br>') : '—'}</td><td><div class="teacher-unit-links">${units.length ? units.map((u, i) => `<button type="button" class="text" data-unit="${escape(u.id)}">Xem bài${units.length > 1 ? ' ' + (i + 1) : ''} →</button>`).join('') : '<span class="small muted">Chưa có bản để xem</span>'}</div></td></tr>`;
  }).join('') : '<tr><td colspan="5" class="teacher-empty">Không có học viên phù hợp với bộ lọc hiện tại.</td></tr>';
  $('list-count').textContent = `${selected.length}/${state.students.length} học viên · Hiển thị tiến trình đã lưu, không phải trạng thái trực tuyến`;
}
async function refresh(quiet = false) {
  const epoch = resetRequests();
  try {
    if (!quiet) notice('Đang đọc bản lưu và kiểm quyền lớp…');
    const selectedClass = state.classes.find(c => c.classId === state.classId);
    const params = new URLSearchParams(speaking ? { assignmentCode: state.code, classCode: selectedClass.classCode } : { code: state.code, classId: state.classId });
    const value = await request(progressPath + '/students?' + params);
    if (epoch !== generation) return;
    state.students = value.students;$('class-label').textContent = selectedClass.classCode;
    if (value.assignment?.title) $('page-title').textContent = value.assignment.title;
    const focused = state.students.find(s => s.studentRef === state.focusRef);
    if (focused && !$('search').value) $('search').value = focused.name;
    renderRows();notice('Bản đọc lúc ' + date(new Date().toISOString()) + '. Nội dung chưa gửi lên máy chủ sẽ chưa xuất hiện.');
    if (state.selected) {
      if (state.students.some(s => s.units.some(u => u.id === state.selected))) await loadDetail(state.selected, epoch, false);
      else { state.selected = null;state.detail = null;$('detail').replaceChildren();$('detail').hidden = true;$('list-panel').hidden = false;notice('Bài vừa xem không còn trong danh sách được truy cập. Hãy chọn lại từ danh sách.', 'error'); }
    }
    schedule();
  } catch (error) { await handle(error, epoch); }
}
async function boot() {
  const epoch = resetRequests();privateClear();$('auth').hidden = true;
  bootGeneration = epoch;resumeBoot = false;
  try {
    notice('Đang khôi phục đăng nhập của bạn…');
    await window.IzoneTeacherSso?.restore(speaking ? 'mapping' : product);
    const routeQuery = new URLSearchParams(location.search), routeHash = new URLSearchParams(location.hash.slice(1));
    state.code = routeQuery.get('code') || state.code;
    if (speaking && !state.code) throw new Error('Link chưa xác định bài Speaking. Hãy mở “Giảng viên” từ đúng bài học.');
    let entry;
    const entryToken = routeHash.get('entry');
    if(speaking&&routeQuery.get('documentId'))entry=await request(progressPath+'/entry?'+new URLSearchParams({assignmentCode:state.code,documentId:routeQuery.get('documentId')}));
    if (!speaking && entryToken) entry = await request(progressPath + '/entry', { entryToken });
    if (epoch !== generation) return;
    if (entry) { state.code = entry.code;state.selected = entry.id || (entry.unitIds?.length===1?entry.unitIds[0]:null);state.focusRef = speaking && uuid(entry.studentRef) ? entry.studentRef : null; }
    if (speaking && uuid(routeHash.get('student'))) state.focusRef = routeHash.get('student');
    if (workId(routeHash.get('unit'))) state.selected = routeHash.get('unit');
    if (routeHash.get('view') === 'list') state.selected = null;
    state.attemptId = uuid(routeHash.get('attempt')) ? routeHash.get('attempt') : null;
    const options = await request(progressPath + '/classes?' + new URLSearchParams(speaking ? { assignmentCode: state.code } : { code: state.code }));
    if (epoch !== generation) return;
    state.classes = options.classes;
    if (!state.classes.length) throw new Error('Tài khoản chưa có lớp được cấp quyền cho bài này.');
    const wanted = entry?.classId || routeQuery.get('classId');
    const wantedName = routeQuery.get('class') || routeQuery.get('classCode');
    const chosen=state.classes.find(c => c.classId === wanted || c.classCode === wantedName);
    if((wanted||wantedName)&&!chosen)throw new Error('Tài khoản chưa có quyền xem lớp trong link này. Hãy kiểm tra lại lớp hoặc tài khoản Google.');
    state.classId = chosen?.classId || state.classes[0].classId;
    $('class-select').innerHTML = state.classes.map(c => `<option value="${escape(c.classId)}">${escape(c.classCode)}</option>`).join('');
    $('class-select').value = state.classId;$('workspace').hidden = false;
    await refresh();
  } catch (error) { await handle(error, epoch); }
  finally { if (bootGeneration === epoch) bootGeneration = null; }
}
function safeLink(value) {
  try { const url = new URL(value);return url.protocol === 'https:' && ['chatgpt.com', 'docs.google.com'].includes(url.hostname) ? url.href : ''; } catch { return ''; }
}
function renderDetail() {
  const data = state.detail;if (!data) return;
  document.body.classList.add('teacher-view-detail');
  const selected = data.attempts?.find(a => a.id === state.attemptId) || data.attempts?.at(-1);
  state.attemptId = selected?.id || null;
  const submitted = speaking ? data.status === 'submitted' : selected?.status === 'submitted';
  let content;
  if (speaking) {
    const requiredPracticeCount = Number(data.assignment.requiredPracticeCount || 0);
    const rows = [...data.assignment.parts.map((p, i) => ({ label: p.display_title || p.title || `Phần luyện ${i + 1}`, link: data.links.find(l => l.kind === 'main' && l.part === p.part_key) })),
      ...Array.from({ length: requiredPracticeCount }, (_, i) => ({ label: `Bài bổ trợ ${i + 1}`, link: data.links.find(l => l.kind === 'practice' && l.slot === i + 1) })),
      ...data.links.filter(l => l.kind === 'practice' && Number(l.slot) > requiredPracticeCount).sort((a,b) => a.slot-b.slot)
        .map(link => ({ label: `Luyện thêm ${link.slot}`, link }))];
    content = `<section class="teacher-paper"><h2>Các phần đã gửi lên máy chủ</h2>${rows.map(({ label, link }) => `<div class="teacher-link-row"><h3>${escape(label)}</h3>${link ? `<p><span class="badge ${link.status === 'accepted' ? 'done' : 'pending'}">${link.status === 'accepted' ? 'Đã xác nhận' : link.status === 'rejected' ? 'Cần kiểm tra lại' : 'Đang kiểm'}</span> · Bản gửi lúc ${date(link.savedAt)}</p>${safeLink(link.url) ? `<a href="${escape(safeLink(link.url))}" target="_blank" rel="noopener noreferrer">Mở hội thoại học viên đã gửi ↗</a>` : '<p>Link lưu chưa hợp lệ.</p>'}` : '<p class="muted">Chưa có link lưu trên máy chủ.</p>'}</div>`).join('')}<p class="small muted">Link đang gõ hoặc phần luyện chưa chia sẻ có thể vẫn ở phía học viên.</p></section>`;
  } else {
    const answers = selected?.answers || {};
    const questions = [...(data.questionIds || Object.keys(answers))].sort((a, b) => Number(a) - Number(b));
    const attemptSelect = data.attempts?.length ? `<div class="teacher-attempts"><label for="attempt-select">Lần làm</label><select id="attempt-select">${data.attempts.map(a => `<option value="${a.id}" ${a.id === state.attemptId ? 'selected' : ''}>Lần ${a.no} · ${status(a)}</option>`).join('')}</select></div>` : '';
    content = attemptSelect + `<div class="teacher-grid"><section class="teacher-paper"><h2>Đề bài để đối chiếu</h2>${definitionHtml(data.definition,data.questionIds,data.code)}</section><section class="teacher-paper"><h2>Bài làm đã lưu</h2>${selected ? `<p class="small muted">${submitted ? `Đã nộp${Number.isFinite(selected.finalScore) ? ' · ' + selected.finalScore + ' câu đúng' : ''}` : 'Chưa nộp · Chưa có kết quả chính thức'}</p>${questions.length ? questions.map(n => `<div class="teacher-answer"><span>Câu ${escape(n)}</span><span>${escape(answers[n] || 'Chưa nhập')}</span></div>`).join('') : '<p class="muted">Chưa có câu trả lời được lưu.</p>'}<h3 style="margin-top:26px">Ghi chú học viên</h3><div class="teacher-notes">${escape(selected.notes || 'Chưa có ghi chú.')}</div>` : '<p class="muted">Chưa có lần làm nào được lưu. Việc xem trang này không tạo lượt làm bài.</p>'}</section></div>`;
  }
  const markup = `<a class="teacher-back" href="#students" id="detail-back">← Về danh sách học viên</a><p class="teacher-kicker">${escape($('page-title').textContent)}</p><div class="teacher-detail-heading"><div><h1>${escape(data.student.name)}</h1><span class="badge ${submitted ? 'done' : 'pending'}">${submitted ? 'Đã nộp · Chỉ xem' : 'Chưa nộp · Chỉ xem'}</span><p class="teacher-saved">${escape(data.student.classCode)} · ${date(data.savedAt || data.submittedAt || data.links?.at(-1)?.savedAt)}</p></div><button class="secondary" id="refresh-detail">Cập nhật bài đã lưu</button></div>${content}${safeLink(data.documentUrl) ? `<a class="teacher-document" target="_blank" rel="noopener noreferrer" href="${escape(safeLink(data.documentUrl))}">Mở tài liệu bài tập ↗</a>` : ''}`;
  const fullListening=product==='listening'&&data.definition?.lesson?.parts?.length;
  const identity=JSON.stringify([state.code,state.classId,state.selected,state.attemptId]);
  if(fullListening&&state.readingIdentity===identity&&$('detail').firstChild){
    // Vẫn đọc nền; chỉ sửa vùng đổi, giữ thẻ đang mở/đóng, bôi chọn và vị trí đọc.
    const template=document.createElement('template');template.innerHTML=markup;
    patchReadingView($('detail'),template.content,{
      nodeKey:node=>node.nodeType===1?(node.id||node.dataset.readingKey||''):'',
      boundary:(existing,incoming)=>existing.nodeName==='DETAILS'&&incoming.nodeName==='DETAILS'&&existing.innerHTML===incoming.innerHTML?'keep':undefined
    });
  }else $('detail').innerHTML=markup;
  state.readingIdentity=fullListening?identity:null;
  $('detail').hidden = false;$('list-panel').hidden = true;
}
async function loadDetail(id, epoch = resetRequests(), navigate = true) {
  if (!workId(id)) return;
  state.selected = id;
  try {
    const data = await request(progressPath + '/units/' + encodeURIComponent(id));
    if (epoch !== generation || state.selected !== id) return;
    state.detail = data;renderDetail();if (navigate) rememberView();notice('Chỉ xem bản đã lưu; không khởi động, nộp hoặc chấm bài thay học viên.');schedule();
  } catch (error) { await handle(error, epoch); }
}
async function showLogin() {
  bootGeneration = null;resumeBoot = false;
  $('auth').hidden = false;notice('Đăng nhập Google để kiểm quyền lớp.');
  $('remember-wrap').hidden = speaking;
  try {
    const clientId = speaking ? config.GOOGLE_CLIENT_ID : (await request('/config')).googleClientId;
    if (!clientId) throw new Error('Chưa cấu hình đăng nhập Google.');
    googleLoading ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;script.onerror = () => { googleLoading = null;reject(new Error('Chưa tải được Google. Hãy tải lại trang.')); };document.head.append(script);
    });
    await googleLoading;
    window.google.accounts.id.initialize({ client_id: clientId, auto_select: false, callback: async value => {
      try {
        await request(speaking ? '/api/auth/session' : '/teacher/login', { credential: value.credential, ...(!speaking ? { remember: $('remember').checked } : {}) });
        await boot();
      } catch (error) { await handle(error); }
    } });
    window.google.accounts.id.renderButton($('google-signin'), { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with' });
  } catch (error) { notice(error.message, 'error'); }
}
$('logout').addEventListener('click', async () => {
  bootGeneration = null;resumeBoot = false;
  resetRequests();privateClear();
  try {
    await request(speaking ? '/api/auth/session' : '/teacher/logout', speaking ? undefined : {}, { method: speaking ? 'DELETE' : 'POST' });
    try { localStorage.setItem(`${product}-teacher-logout`, crypto.randomUUID()); } catch { /* Cookie vẫn là nguồn phiên. */ }
    window.google?.accounts?.id?.disableAutoSelect();await showLogin();
  } catch (error) { notice('Chưa xác nhận đăng xuất trên máy chủ. ' + error.message, 'error'); }
});
$('class-select').addEventListener('change', () => { privateClear();state.classId = $('class-select').value;rememberView({ view: 'list', clearEntry: true });$('workspace').hidden = false;$('list-panel').hidden = false;refresh(); });
$('refresh').addEventListener('click', () => refresh());
$('retry').addEventListener('click', () => boot());
$('search').addEventListener('input', () => {
  if (state.focusRef) { state.focusRef = null;rememberView({ view: state.selected ? 'detail' : 'list', clearEntry: true }); }
  renderRows();
});
$('status-filter').addEventListener('input', renderRows);
$('rows').addEventListener('click', event => { const button = event.target.closest('[data-unit]');if (button) loadDetail(button.dataset.unit); });
$('detail').addEventListener('click', event => {
  if (event.target.closest('#refresh-detail')) loadDetail(state.selected);
  if (event.target.closest('#detail-back')) { event.preventDefault();resetRequests();state.selected = null;state.detail = null;state.attemptId = null;rememberView({ view: 'list' });$('detail').hidden = true;$('detail').replaceChildren();$('list-panel').hidden = false;document.body.classList.remove('teacher-view-detail');schedule(); }
});
$('detail').addEventListener('change', event => { if (event.target.id === 'attempt-select') { state.attemptId = event.target.value;renderDetail();rememberView(); } });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Nếu đang kiểm quyền lần đầu, ghi nhớ để vào lại khi quay về tab; chưa có workspace để refresh.
    resumeBoot ||= bootGeneration !== null;
    clearTimeout(timer);controller.abort();generation++;
  } else if (resumeBoot) { resumeBoot = false;boot(); }
  else if (!$('workspace').hidden) refresh(true);
});
window.addEventListener('storage', event => { if (event.key === `${product}-teacher-logout`) { resetRequests();privateClear();showLogin(); } });
window.addEventListener('popstate', () => boot());
boot();
