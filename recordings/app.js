const DATA_API_URL = 'https://ducizone.ddns.net/webhook/recording-monitor-data-884067a346fc458e9e0503e73b3e41b3';
const REVIEW_API_URL = 'https://ducizone.ddns.net/webhook/recording-review-7111fb0e9d104e76809e58bb6664cc48';
const RENAME_API_URL = 'https://ducizone.ddns.net/webhook/recording-rename-763280960132451999cff944f1225fd7';
const PLAYLIST_API_URL = 'https://ducizone.ddns.net/webhook/recording-playlist-8ea46fc7390145c58ffa915cf6cedbd2';
const REFRESH_MS = 60_000;

const state = { records: [], yesterdayClasses: [], playlists: [], loading: false, playlistQuery: '' };
const $ = (id) => document.getElementById(id);
const controls = ['dateFilter', 'accountFilter', 'searchFilter'].map($);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
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
  const date = new Date(value);
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
  if (record.playlistIndex) params.set('index', String(record.playlistIndex));
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
    <span>${portalTime(item.sessionStart)} · ${displayDate(item.sessionStart)}</span>
  </article>`).join('');
  $('yesterdayClasses').innerHTML = cards || '<div class="empty-inline">Không có lớp Zoom 36 hoặc Zoom 6 trong ngày này.</div>';
}

function youtubeState(record) {
  if (record.youtubeStatus === 'uploaded') return '<span class="badge ok">Đã đăng</span>';
  if (record.youtubeStatus === 'error' || record.error) return '<span class="badge error">Có lỗi</span>';
  return '<span class="badge wait">Đang chờ</span>';
}

function recordRow(record) {
  const url = combinedVideoUrl(record);
  const linkLabel = record.playlistId ? 'Mở video trong playlist ↗' : 'Mở video ↗';
  const link = url ? `<a class="video-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${linkLabel}</a>` : '—';
  const thumbnail = record.thumbnailStatus === 'applied' ? '<span class="badge ok">Có thumbnail</span>' : '<span class="badge wait">Chưa có thumbnail</span>';
  const playlist = record.playlistId ? `<span class="badge ok">${escapeHtml(record.playlistTitle || 'Đã vào playlist')}</span>` : '<span class="badge wait">Chưa vào playlist</span>';
  const lesson = record.lessonNumber ? `Buổi ${escapeHtml(record.lessonNumber)}` : 'Chưa xác định buổi';
  const reason = [record.matchReason, record.playlistReason].filter(Boolean).map((text) => `<div class="subtext">${escapeHtml(text)}</div>`).join('');
  return `<tr data-record-id="${escapeHtml(record.id)}">
    <td><span class="class-code">${escapeHtml(record.className || 'Chưa xác định')}</span><div class="subtext">${escapeHtml(record.source || '—')}</div></td>
    <td><div class="record-title">${escapeHtml(record.title || 'Zoom recording')}</div><div class="subtext">${lesson} · ${escapeHtml(record.recordingFileId || '')}</div>${reason}</td>
    <td>${dateTime(record.recordingStart)}</td>
    <td>${youtubeState(record)}<div class="status-stack">${thumbnail}${playlist}</div></td>
    <td><div class="row-actions"><button type="button" class="action-button" data-action="rename" data-id="${escapeHtml(record.id)}">Sửa tên</button><button type="button" class="action-button" data-action="playlist" data-id="${escapeHtml(record.id)}">Đổi playlist</button></div></td>
    <td>${link}</td>
    <td>${dateTime(record.updatedAt)}</td>
    <td class="approval-cell"><label class="approval-check"><input type="checkbox" data-action="review" data-id="${escapeHtml(record.id)}" ${isApproved(record) ? 'checked' : ''}><span aria-hidden="true">✓</span><em>${isApproved(record) ? 'Đã duyệt' : 'Duyệt'}</em></label></td>
  </tr>`;
}

function renderSection(title, records, approved) {
  const rows = filteredRecords(records);
  return `<section class="review-section ${approved ? 'approved' : 'pending'}">
    <div class="review-heading"><div><span class="section-dot"></span><h2>${title}</h2></div><span>${rows.length} recording</span></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Lớp / Zoom</th><th>Recording</th><th>Thời gian học</th><th>YouTube</th><th>Chỉnh sửa</th><th>Liên kết</th><th>Cập nhật</th><th>Đã duyệt</th></tr></thead><tbody>${rows.map(recordRow).join('')}</tbody></table></div>` : '<div class="section-empty">Không có recording trong mục này.</div>'}
  </section>`;
}

function renderSections() {
  const newest = (a, b) => new Date(b.recordingStart || 0) - new Date(a.recordingStart || 0);
  const pending = state.records.filter((record) => !isApproved(record)).sort(newest);
  const approved = state.records.filter(isApproved).sort((a, b) => new Date(b.approvedAt || b.recordingStart || 0) - new Date(a.approvedAt || a.recordingStart || 0));
  $('reviewSections').innerHTML = renderSection('Cần duyệt', pending, false) + renderSection('Đã duyệt', approved, true);
}

function populateAccounts() {
  const current = $('accountFilter').value;
  const accounts = [...new Set(state.records.map((record) => record.source).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  $('accountFilter').innerHTML = '<option value="">Tất cả</option>' + accounts.map((name) => `<option value="${escapeHtml(name)}" ${name === current ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function renderPlaylistOptions(query = '') {
  const record = state.records.find((item) => String(item.id) === $('playlistRecordId').value);
  const normalized = query.trim().toLowerCase();
  const playlists = state.playlists.filter((item) => !normalized || item.title.toLowerCase().includes(normalized)).slice(0, 250);
  $('playlistSelect').innerHTML = '<option value="">Chọn playlist</option>' + playlists.map((item) => `<option value="${escapeHtml(item.id)}" data-title="${escapeHtml(item.title)}" ${item.id === record?.playlistId ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('');
}

function replaceRecord(updated) {
  const index = state.records.findIndex((record) => String(record.id) === String(updated.id));
  if (index >= 0) state.records[index] = updated;
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
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload), referrerPolicy: 'no-referrer' });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP_${response.status}`);
  const data = JSON.parse(text);
  if (!data.ok || !data.record) throw new Error('Phản hồi không hợp lệ.');
  return data.record;
}

async function loadData() {
  if (state.loading) return;
  state.loading = true;
  setConnection(true, 'Đang làm mới');
  try {
    const response = await fetch(DATA_API_URL, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = await response.json();
    state.records = Array.isArray(payload.records) ? payload.records : [];
    state.yesterdayClasses = Array.isArray(payload.yesterdayClasses) ? payload.yesterdayClasses : [];
    state.playlists = Array.isArray(payload.playlists) ? payload.playlists : [];
    $('yesterdayDate').textContent = displayDate(payload.yesterdayDate);
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
    state.loading = false;
  }
}

controls.forEach((control) => control.addEventListener('input', renderSections));
$('refreshButton').addEventListener('click', loadData);
$('playlistSearch').addEventListener('input', (event) => renderPlaylistOptions(event.target.value));
document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.dataset.action === 'review') return;
  const record = state.records.find((item) => String(item.id) === button.dataset.id);
  if (!record) return;
  if (button.dataset.action === 'rename') {
    $('renameRecordId').value = record.id;
    $('renameTitle').value = record.title || '';
    $('renameDialog').showModal();
    $('renameTitle').focus();
  }
  if (button.dataset.action === 'playlist') {
    $('playlistRecordId').value = record.id;
    $('playlistSearch').value = '';
    renderPlaylistOptions();
    $('playlistDialog').showModal();
    $('playlistSearch').focus();
  }
});

document.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('input[data-action="review"]');
  if (!checkbox) return;
  checkbox.disabled = true;
  try {
    const record = await postAction(REVIEW_API_URL, { id: checkbox.dataset.id, approved: checkbox.checked });
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
    const record = await postAction(RENAME_API_URL, { id: $('renameRecordId').value, newTitle: $('renameTitle').value.trim() });
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
  try {
    const record = await postAction(PLAYLIST_API_URL, { id: $('playlistRecordId').value, playlistId: select.value, playlistTitle: option.dataset.title || option.textContent });
    replaceRecord(record);
    $('playlistDialog').close();
    toast('Đã chuyển video sang playlist mới.');
  } catch {
    toast('Không đổi được playlist. Hãy kiểm tra playlist đã chọn.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Chuyển playlist';
  }
});

loadData();
setInterval(loadData, REFRESH_MS);

