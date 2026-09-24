const DATA_API_URL = 'https://ducizone.ddns.net/webhook/recording-monitor-data-884067a346fc458e9e0503e73b3e41b3';
const REVIEW_API_URL = 'https://ducizone.ddns.net/webhook/recording-review-7111fb0e9d104e76809e58bb6664cc48';
const RENAME_API_URL = 'https://ducizone.ddns.net/webhook/recording-rename-763280960132451999cff944f1225fd7';
const PLAYLIST_API_URL = 'https://ducizone.ddns.net/webhook/recording-playlist-8ea46fc7390145c58ffa915cf6cedbd2';
const REFRESH_MS = 60_000;

const state = { records: [], yesterdayClasses: [], playlists: [], loading: false, playlistQuery: '', version: 0 };
const $ = (id) => document.getElementById(id);
const controls = ['dateFilter', 'accountFilter', 'searchFilter'].map($);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function parseTimestamp(value) {
  const text=String(value||'');
  return new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)?text.replace(' ','T')+'+07:00':value);
}
function localDate(value) {
  if (!value) return '';
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function displayDate(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : escapeHtml(value);
}

function dateTime(value) {
  if (!value) return '—';
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function portalTime(value) {
  const match = String(value || '').match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '—';
}

function combinedVideoUrl(record) {
  if (!record.videoId) return record.youtubeUrl || '';
  const params = new URLSearchParams({ v: record.videoId });
  if (record.playlistId) params.set('list', record.playlistId);
  return `https://www.youtube.com/watch?${params}`;
}

function isApproved(record) {
  return record.reviewStatus === 'approved';
}

function filteredRecords(records) {
  const [date, account, search] = controls.map((control) => control.value.trim().toLowerCase());
  return records.filter((record) => (!date || localDate(record.recordingStart) === date)
    && (!account || String(record.source || '').toLowerCase() === account)
    && (!search || [record.className, record.title, record.recordingFileId, record.source, record.playlistTitle].join(' ').toLowerCase().includes(search)));
}

function renderStats() {
  $('yesterdayClassCount').textContent = state.yesterdayClasses.length;
  $('totalCount').textContent = state.records.length;
  $('reviewCount').textContent = state.records.filter((record) => !isApproved(record)).length;
  $('approvedCount').textContent = state.records.filter(isApproved).length;
}

function renderYesterday() {
  const cards = state.yesterdayClasses.map((item) => `<article class="class-card">
    <div><span class="class-code">${escapeHtml(item.className || 'Chưa rõ lớp')}</span><span class="badge zoom">${escapeHtml(item.zoomAccount || 'Chưa phân bổ Zoom')}</span></div>
    <strong>Buổi ${escapeHtml(item.lessonNumber || '—')}</strong>
    <span>${item.normalizedTime?dateTime(item.sessionStart):portalTime(item.sessionStart)+" · "+displayDate(item.sessionStart)}</span>
  </article>`).join('');
  $('yesterdayClasses').innerHTML = cards || (nightlyState.error||['failed','partial'].includes(nightlyState.snapshot?.scanStatus)?'<div class="empty-inline">Chưa đọc đủ dữ liệu lịch học; chưa thể kết luận ngày này không có lớp.</div>':'<div class="empty-inline">Không có lớp dùng các tài khoản Zoom đang theo dõi trong ngày này.</div>');
}

function youtubeState(record) {
  if (record.youtubeStatus === 'uploaded') return '<span class="badge ok">Đã đăng</span>';
  if (record.youtubeStatus === 'error' || record.error) return '<span class="badge error">Có lỗi</span>';
  return '<span class="badge wait">Đang chờ</span>';
}

function recordingSourceCell(record) {
  return '<div data-source-link-id="'+escapeHtml(record.id)+'">'+(typeof sourceLinkMarkup==='function'?sourceLinkMarkup(record):'<span class="subtext">Đang kiểm tra nguồn Zoom…</span>')+'</div>';
}
function videoEditCell(record) {
  if(!record.videoId)return typeof manualUploadCell==='function'?manualUploadCell(record):'<span class="subtext">Chưa đăng video</span>';
  return '<select class="video-edit-select" data-edit-id="'+escapeHtml(record.id)+'" aria-label="Chỉnh sửa video"><option value="">Chọn thao tác</option><option value="rename">Đổi tên video</option><option value="playlist">Đổi playlist</option></select>';
}
function recordRow(record) {
  if (record.nightly && !record.videoId) return nightlyRow(record);
  const url = combinedVideoUrl(record);
  const linkLabel = record.playlistId ? 'Mở video trong playlist ↗' : 'Mở video ↗';
  const link = url ? `<a class="video-link external-link-icon" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(linkLabel)}" aria-label="${escapeHtml(linkLabel)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 6H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5M3 22h18"/></svg></a>` : '—';
  const thumbnail = record.thumbnailStatus === 'applied' ? '<span class="badge ok">Có thumbnail</span>' : '<span class="badge wait">Chưa có thumbnail</span>';
  const playlist = record.playlistId ? `<span class="badge ok">${escapeHtml(record.playlistTitle || 'Đã vào playlist')}</span>` : '<span class="badge wait">Chưa vào playlist</span>';
  const lesson = record.lessonNumber ? `Buổi ${escapeHtml(record.lessonNumber)}` : 'Chưa xác định buổi';
  const part = Number(record.totalParts) > 1 && Number(record.partNumber) > 0
    ? ` · Phần ${escapeHtml(record.partNumber)}/${escapeHtml(record.totalParts)}`
    : '';
  const reason = [record.matchReason, record.playlistReason].filter(Boolean).map((text) => `<div class="subtext">${escapeHtml(text)}</div>`).join('');
  return `<tr data-record-id="${escapeHtml(record.id)}">
    <td><span class="class-code">${escapeHtml(record.className || 'Chưa xác định')}</span><div class="subtext">${escapeHtml(record.source || '—')}</div></td>
    <td><div class="record-title">${escapeHtml(record.title || 'Zoom recording')}</div><div class="subtext">${lesson}${part} · ${escapeHtml(record.recordingFileId || '')}</div>${reason}</td>
    <td>${dateTime(record.recordingStart)}</td>
    <td>${recordingSourceCell(record)}</td>
    <td>${videoEditCell(record)}</td>
    <td>${link}</td>
    <td class="approval-cell"><label class="approval-check"><input type="checkbox" data-action="review" data-id="${escapeHtml(record.id)}" ${isApproved(record) ? 'checked' : ''}><span aria-hidden="true">✓</span><em>${isApproved(record) ? 'Đã duyệt' : 'Duyệt'}</em></label></td>
  </tr>`;
}

function renderSection(title, records, approved) {
  const rows = filteredRecords(records);
  return `<section class="review-section ${approved ? 'approved' : 'pending'}">
    ${!approved&&(nightlyState.error||['failed','partial'].includes(nightlyState.snapshot?.scanStatus))?'<div class="empty-inline" role="alert">Chưa đối soát đầy đủ: nguồn Portal hoặc Zoom đang gặp lỗi. Các bản ghi hiện có được giữ để kiểm tra.</div>':''}<div class="review-heading"><div><span class="section-dot"></span><h2>${title}</h2></div><span>${rows.length} recording</span></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Lớp / Zoom</th><th>Recording</th><th>Thời gian học</th><th>Link recording</th><th>Chỉnh sửa</th><th>Link YouTube</th><th>Đã duyệt</th></tr></thead><tbody>${rows.map(recordRow).join('')}</tbody></table></div>` : '<div class="section-empty">Không có recording trong mục này.</div>'}
  </section>`;
}

function renderSections() {
  const newest = (a, b) => parseTimestamp(b.recordingStart || 0) - parseTimestamp(a.recordingStart || 0);
  const pending = state.records.filter((record) => !isApproved(record)).sort(newest);
  const approved = state.records.filter(isApproved).sort((a, b) => parseTimestamp(b.approvedAt || b.recordingStart || 0) - parseTimestamp(a.approvedAt || a.recordingStart || 0));
  $('reviewSections').innerHTML = renderSection('Cần duyệt',pending,false) + renderSection('Đã duyệt',approved,true);
}

function populateAccounts() {
  const current = $('accountFilter').value;
  const accounts = [...new Set([...state.records.map((record) => record.source), ...(nightlyState.snapshot?.accounts || []).map(item => item.account)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  $('accountFilter').innerHTML = '<option value="">Tất cả</option>' + accounts.map((name) => `<option value="${escapeHtml(name)}" ${name === current ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function renderPlaylistOptions(query = '') {
  const record = state.records.find((item) => String(item.id) === $('playlistRecordId').value);
  const normalized = query.trim().toLowerCase();
  const playlists = state.playlists
    .filter((item) => /\b[A-Z]{1,4}\d{3,5}\b/i.test(item.title || ''))
    .filter((item) => !normalized || item.title.toLowerCase().includes(normalized))
    .slice(0, 250);
  $('playlistSelect').innerHTML = '<option value="">Chọn playlist</option>' + playlists.map((item) => `<option value="${escapeHtml(item.id)}" data-title="${escapeHtml(item.title)}" ${item.id === record?.playlistId ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('');
}

function replaceRecord(updated) {
  const index = state.records.findIndex((record) => String(record.id) === String(updated.id));
  if (index >= 0) state.records[index] = updated;
  state.version += 1;
  renderStats();
  renderSections();
}

function setConnection(ok, label) {
  document.querySelector('.live').classList.toggle('offline', !ok);
  $('liveLabel').textContent = label;
}

function toast(message, type = 'success') {
  const element = $('toast');
  element.textContent = message;
  element.className = `toast show ${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.className = 'toast'; }, 3200);
}

async function postAction(url, payload) {
  if(url===window.RECORDING_NIGHTLY?.actionUrl)payload={...payload,idToken:window.recordingAuth.token()};
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload), referrerPolicy: 'no-referrer' });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP_${response.status}`);
  const data = JSON.parse(text);
  if (!data.ok || !data.record) throw new Error(data.error || 'Phản hồi không hợp lệ.');
  return data.record;
}

let dataRequestId=0;
async function loadData(force = false) {
  if (state.loading && force !== true) return;
  state.loading = true;
  const requestId=++dataRequestId;
  const loadVersion = state.version;
  setConnection(true, 'Đang làm mới');
  try {
    const response = await fetch(DATA_API_URL, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = await response.json();
    if (loadVersion !== state.version || requestId!==dataRequestId) return;
    let snapshot = null;
    try { snapshot = await loadNightly(); } catch { nightlyState.error=true;toast('Không tải được dữ liệu đối soát của ngày đã chọn.','error'); }
    if (loadVersion !== state.version || requestId!==dataRequestId) return;
    state.records = mergeNightlyRecords(Array.isArray(payload.records) ? payload.records : [], snapshot);
    state.yesterdayClasses = snapshot ? snapshot.records.filter(r=>r.kind==='session').map(r=>({...r,zoomAccount:r.source,normalizedTime:true})) : (Array.isArray(payload.yesterdayClasses) ? payload.yesterdayClasses : []);
    state.playlists = Array.isArray(payload.playlists) ? payload.playlists : [];
    $('yesterdayDate').textContent = displayDate(snapshot?.date || payload.yesterdayDate);
    renderStats();
    renderYesterday();
    populateAccounts();
    renderSections();
    $('updatedAt').textContent = `Cập nhật ${dateTime(payload.generatedAt)}`;
    setConnection(true, 'Dữ liệu trực tiếp');
  } catch (error) {
    setConnection(false, 'Mất kết nối');
    $('reviewSections').innerHTML = '<div class="empty">Không tải được dữ liệu. Hệ thống sẽ thử lại sau 60 giây.</div>';
  } finally {
    if(requestId===dataRequestId)state.loading = false;
  }
}

controls.forEach((control) => control.addEventListener('input', renderSections));
$('refreshButton').addEventListener('click', loadData);

document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));

function openVideoEditor(action, id) {
  const record = state.records.find((item) => String(item.id) === id);
  if (!record) return;
  if (action === 'rename') {
    $('renameRecordId').value = record.id;
    $('renameTitle').value = record.title || '';
    $('renameDialog').dataset.version=record.version||0;
    $('renameDialog').showModal();
    $('renameTitle').focus();
  }
  if (action === 'playlist') {
    $('playlistRecordId').value = record.id;
    $('playlistVideoTitle').value = record.title || '';
    renderPlaylistOptions();
    $('playlistDialog').dataset.version=record.version||0;
    $('playlistDialog').showModal();
    $('playlistSelect').focus();
  }
}
document.addEventListener('change',event=>{const select=event.target.closest('[data-edit-id]');if(!select)return;const action=select.value;select.value='';if(['rename','playlist'].includes(action))openVideoEditor(action,select.dataset.editId);});

document.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('input[data-action="review"]');
  if (!checkbox) return;
  checkbox.disabled = true;
  try {
    const record = await postAction(REVIEW_API_URL, { id: checkbox.dataset.id, expectedVersion: Number(state.records.find(r=>String(r.id)===checkbox.dataset.id)?.version||0), approved: checkbox.checked });
    replaceRecord(record);
    toast(checkbox.checked ? 'Đã chuyển recording sang mục Đã duyệt.' : 'Đã chuyển recording về mục Cần duyệt.');
  } catch {
    checkbox.checked = !checkbox.checked;
    checkbox.disabled = false;
    toast('Không cập nhật được trạng thái duyệt.', 'error');
  }
});

$('renameForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('renameSubmit');
  button.disabled = true;
  button.textContent = 'Đang lưu…';
  try {
    const record = await postAction(RENAME_API_URL, { id: $('renameRecordId').value, expectedVersion:Number($('renameDialog').dataset.version), newTitle: $('renameTitle').value.trim() });
    replaceRecord(record);
    $('renameDialog').close();
    toast('Đã đổi tên video trên YouTube.');
  } catch {
    toast('Không đổi được tên video. Vui lòng thử lại.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Lưu tên';
  }
});

$('playlistForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const select = $('playlistSelect');
  const option = select.selectedOptions[0];
  if (!select.value) return;
  const button = $('playlistSubmit');
  button.disabled = true;
  button.textContent = 'Đang chuyển…';
  let moved = false;
  const id=$('playlistRecordId').value;
  const desiredTitle=$('playlistVideoTitle').value.trim();
  try {
    let record=state.records.find(r=>String(r.id)===id);
    if(record.playlistId!==select.value){
      record=await postAction(PLAYLIST_API_URL,{id,expectedVersion:Number($('playlistDialog').dataset.version),playlistId:select.value,playlistTitle:option.dataset.title||option.textContent});
      moved=true;replaceRecord(record);
      $('playlistDialog').dataset.version=record.version||0;
    }
    if(record.title!==desiredTitle){
      record=await postAction(RENAME_API_URL,{id,expectedVersion:Number($('playlistDialog').dataset.version),newTitle:desiredTitle});
      replaceRecord(record);$('playlistDialog').dataset.version=record.version||0;
    }
    $('playlistDialog').close();await loadData(true);
    toast('Đã chuyển playlist và lưu tên video.');
  } catch(error) {
    if(error.message.includes('VERSION_CONFLICT')){toast('Dữ liệu đã được người khác sửa. Hãy đóng hộp thoại, làm mới và mở lại để kiểm tra trước khi lưu.','error');return;}
    toast(moved?'Đã chuyển playlist nhưng chưa lưu được tên video. Hãy kiểm tra và lưu lại.':'Chưa lưu được thay đổi. Hãy làm mới dữ liệu và thử lại.','error');
  } finally {
    button.disabled=false;button.textContent='Chuyển playlist và đổi tên';
  }
});

window.addEventListener('DOMContentLoaded',()=>{loadData();setInterval(loadData, REFRESH_MS);});

