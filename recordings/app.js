const DATA_API_URL = 'https://ducizone.ddns.net/webhook/recording-monitor-data-884067a346fc458e9e0503e73b3e41b3';
const KEY_STORAGE = 'izone_recording_dashboard_key';
const REFRESH_MS = 60_000;

const state = { records: [], key: '', loading: false };
const $ = (id) => document.getElementById(id);
const controls = ['dateFilter', 'accountFilter', 'statusFilter', 'searchFilter'].map($);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function statusOf(record) {
  if (record.youtubeStatus === 'error' || record.error) return 'error';
  if (record.matchStatus === 'needs_review' || record.youtubeStatus === 'needs_review') return 'needs_review';
  return record.youtubeStatus || 'detected';
}

function youtubeStatus(record) {
  if (record.youtubeStatus === 'uploaded') return '<span class="badge ok">Đã đăng</span>';
  if (record.youtubeStatus === 'needs_review') return '<span class="badge review">Cần duyệt</span>';
  if (record.youtubeStatus === 'error' || record.error) return '<span class="badge error">Có lỗi</span>';
  return '<span class="badge wait">Đang chờ</span>';
}

function renderStats() {
  const today = localDate(new Date().toISOString());
  $('totalCount').textContent = state.records.length;
  $('todayCount').textContent = state.records.filter((record) => record.youtubeStatus === 'uploaded' && localDate(record.processedAt || record.updatedAt) === today).length;
  $('reviewCount').textContent = state.records.filter((record) => statusOf(record) === 'needs_review').length;
  $('errorCount').textContent = state.records.filter((record) => statusOf(record) === 'error').length;
}

function recordRow(record) {
  const videoUrl = record.videoId ? `https://youtu.be/${encodeURIComponent(record.videoId)}` : record.youtubeUrl;
  const videoLinks = videoUrl ? `<a class="video-link" href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">Mở video ↗</a><button class="copy-link" type="button" data-copy="${escapeHtml(videoUrl)}">Sao chép link</button>` : '—';
  const playlistLink = record.playlistUrl ? `<div class="subtext"><a class="video-link" href="${escapeHtml(record.playlistUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.playlistTitle || 'Mở playlist')} ↗</a></div>` : '';
  const thumbnail = record.thumbnailStatus === 'applied' ? '<span class="badge ok">Có thumbnail</span>' : '<span class="badge wait">Chưa có thumbnail</span>';
  const playlist = ['added', 'already_present'].includes(record.playlistStatus) ? '<span class="badge ok">Đã vào playlist</span>' : (record.playlistStatus === 'needs_review' ? '<span class="badge review">Duyệt playlist</span>' : '<span class="badge wait">Chưa vào playlist</span>');
  const lesson = record.lessonNumber ? `Buổi ${escapeHtml(record.lessonNumber)}` : 'Chưa xác định buổi';
  const privacy = record.privacyStatus === 'unlisted' ? 'Không công khai · ai có link xem được' : (record.privacyStatus || '—');
  const reason = [record.matchReason, record.playlistReason].filter(Boolean).map((text) => `<div class="subtext">${escapeHtml(text)}</div>`).join('');
  return `<tr data-date="${escapeHtml(localDate(record.recordingStart))}" data-account="${escapeHtml(record.source || '')}" data-status="${escapeHtml(statusOf(record))}">
    <td><strong>${escapeHtml(record.source || '—')}</strong></td>
    <td><div class="record-title">${escapeHtml(record.title || 'Zoom recording')}</div><div class="subtext">${lesson} · ${escapeHtml(record.recordingFileId || '')}</div>${reason}</td>
    <td>${dateTime(record.recordingStart)}</td>
    <td>${record.downloadStatus === 'downloaded' ? '<span class="badge ok">Đã tải</span>' : '<span class="badge wait">Chờ tải</span>'}</td>
    <td>${youtubeStatus(record)}<div class="subtext">${escapeHtml(privacy)}</div><div class="status-stack">${thumbnail}${playlist}</div></td>
    <td>${videoLinks}${playlistLink}</td>
    <td>${dateTime(record.updatedAt)}</td>
    <td>${escapeHtml(record.error || '')}</td>
  </tr>`;
}

function renderFolders() {
  const groups = new Map();
  for (const record of state.records) {
    const key = String(record.className || 'Cần duyệt');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => a === 'Cần duyệt' ? 1 : b === 'Cần duyệt' ? -1 : a.localeCompare(b, 'vi'));
  $('folders').innerHTML = sorted.map(([className, records], index) => {
    const uploaded = records.filter((record) => record.youtubeStatus === 'uploaded').length;
    const review = records.filter((record) => statusOf(record) === 'needs_review').length;
    return `<details class="class-folder" data-folder ${className === 'Cần duyệt' || index === 0 ? 'open' : ''}>
      <summary><span class="folder-arrow">▶</span><strong class="folder-name">${escapeHtml(className)}</strong><span class="folder-meta">${records.length} recording · ${uploaded} đã đăng${review ? ` · ${review} cần duyệt` : ''}</span></summary>
      <div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Recording</th><th>Thời gian học</th><th>Zoom</th><th>YouTube</th><th>Liên kết</th><th>Cập nhật</th><th>Lỗi</th></tr></thead><tbody>${records.map(recordRow).join('')}</tbody></table></div>
    </details>`;
  }).join('') || '<div class="empty">Chưa có recording nào.</div>';
  applyFilters();
}

function populateAccounts() {
  const current = $('accountFilter').value;
  const accounts = [...new Set(state.records.map((record) => record.source).filter(Boolean))].sort();
  $('accountFilter').innerHTML = '<option value="">Tất cả</option>' + accounts.map((name) => `<option ${name === current ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function applyFilters() {
  const [date, account, status, search] = controls.map((control) => control.value.toLowerCase());
  document.querySelectorAll('tr[data-date]').forEach((row) => {
    const visible = (!date || row.dataset.date === date) && (!account || row.dataset.account.toLowerCase() === account) && (!status || row.dataset.status === status) && (!search || row.innerText.toLowerCase().includes(search));
    row.hidden = !visible;
  });
  document.querySelectorAll('[data-folder]').forEach((folder) => {
    folder.hidden = ![...folder.querySelectorAll('tr[data-date]')].some((row) => !row.hidden);
  });
}

function setConnection(ok, label) {
  document.querySelector('.live').classList.toggle('offline', !ok);
  $('liveLabel').textContent = label;
}

async function loadData() {
  if (!state.key || state.loading) return;
  state.loading = true;
  setConnection(true, 'Đang làm mới');
  try {
    const response = await fetch(`${DATA_API_URL}?key=${encodeURIComponent(state.key)}`, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (response.status === 403) throw new Error('ACCESS_DENIED');
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = await response.json();
    state.records = Array.isArray(payload.records) ? payload.records : [];
    renderStats();
    populateAccounts();
    renderFolders();
    $('updatedAt').textContent = `Cập nhật ${dateTime(payload.generatedAt)}`;
    setConnection(true, 'Dữ liệu trực tiếp');
  } catch (error) {
    setConnection(false, 'Mất kết nối');
    if (error.message === 'ACCESS_DENIED') {
      sessionStorage.removeItem(KEY_STORAGE);
      state.key = '';
      $('accessError').textContent = 'Mã truy cập không đúng.';
      $('accessDialog').showModal();
    } else {
      $('folders').innerHTML = '<div class="empty">Không tải được dữ liệu. Hệ thống sẽ thử lại sau 60 giây.</div>';
    }
  } finally {
    state.loading = false;
  }
}

function initializeAccess() {
  const url = new URL(window.location.href);
  const keyFromUrl = url.searchParams.get('key');
  if (keyFromUrl) {
    sessionStorage.setItem(KEY_STORAGE, keyFromUrl);
    url.searchParams.delete('key');
    history.replaceState({}, '', url);
  }
  state.key = sessionStorage.getItem(KEY_STORAGE) || '';
  if (state.key) loadData(); else $('accessDialog').showModal();
}

controls.forEach((control) => control.addEventListener('input', applyFilters));
$('refreshButton').addEventListener('click', loadData);
$('accessForm').addEventListener('submit', (event) => {
  event.preventDefault();
  state.key = $('accessKey').value.trim();
  sessionStorage.setItem(KEY_STORAGE, state.key);
  $('accessError').textContent = '';
  $('accessDialog').close();
  loadData();
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = 'Đã sao chép';
    setTimeout(() => { button.textContent = 'Sao chép link'; }, 1600);
  } catch {
    window.prompt('Sao chép đường link này:', button.dataset.copy);
  }
});

initializeAccess();
setInterval(loadData, REFRESH_MS);

