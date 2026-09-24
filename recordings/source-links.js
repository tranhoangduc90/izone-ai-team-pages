// Link nguồn chỉ tồn tại trong bộ nhớ phiên đăng nhập, không lưu vào localStorage.
const sourceLinks = new Map();
let sourceLinkEpoch = 0;
let sourceLinkRunning = false;
const SOURCE_MESSAGES = {
  deleted: 'Recording đã được xóa trong Zoom',
  processing: 'Zoom đang xử lý recording',
  ambiguous: 'Cần xác nhận nguồn recording',
  unavailable: 'Zoom chưa cung cấp link xem',
  unknown: 'Chưa tìm thấy nguồn Zoom — chưa xác nhận đã xóa',
  error: 'Chưa kiểm tra được link Zoom',
  unassigned: 'Chưa xác định nguồn recording của buổi',
};
function sourceLookupDate(record) {
  const selected=document.getElementById('dateFilter').value || nightlyState.snapshot?.date;
  if(selected)return selected;
  const time=Date.parse(record.recordingStart);
  return Number.isFinite(time)?new Date(time+7*3600000).toISOString().slice(0,10):'';
}
function sourceLinkKey(record) { return `${sourceLookupDate(record)}:${record.id}`; }
function sourceLinkMarkup(record) {
  if (record.kind === 'session') return `<span class="subtext">${record.status === 'missing_assignment' ? 'Chưa xác định tài khoản Zoom' : 'Chưa tìm thấy recording của buổi'}</span>`;
  if (!window.recordingAuth?.isAuthenticated()) return '<span class="subtext">Đăng nhập để lấy link Zoom</span>';
  const entry = sourceLinks.get(sourceLinkKey(record));
  if (!entry) return '<span class="subtext">Đang lấy link Zoom…</span>';
  const result = entry.result;
  if (result.status === 'available' && /^https:\/\/(?:[a-z0-9-]+\.)*zoom\.us\/rec\/(?:play|share)\/[a-zA-Z0-9_.~-]+$/i.test(result.url || '')) {
    return `<a class="video-link zoom-source-link external-link-icon" href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" title="Mở recording trên Zoom" aria-label="Mở recording trên Zoom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 6H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5M3 22h18"/></svg></a>`;
  }
  const message = result.error === 'ZOOM_ACCESS_DENIED' ? 'Chưa có quyền đọc recording trên Zoom' : SOURCE_MESSAGES[result.status] || SOURCE_MESSAGES.error;
  return `<span class="subtext">${escapeHtml(message)}</span>`;
}
function paintSourceLinks() {
  document.querySelectorAll('[data-source-link-id]').forEach(cell => {
    const record = state.records.find(r => String(r.id) === cell.dataset.sourceLinkId);
    if (record) cell.innerHTML = sourceLinkMarkup(record);
  });
}
async function refreshSourceLinks() {
  paintSourceLinks();
  if (sourceLinkRunning || !window.recordingAuth?.isAuthenticated()) return;
  const epoch = sourceLinkEpoch;
  sourceLinkRunning = true;
  try {
    const visible = new Set([...document.querySelectorAll('[data-source-link-id]')].map(e => e.dataset.sourceLinkId));
    for (const record of [...state.records]) {
      if (epoch !== sourceLinkEpoch || !window.recordingAuth.isAuthenticated()) break;
      if (record.kind === 'session' || !visible.has(String(record.id))) continue;
      const key = sourceLinkKey(record), cached = sourceLinks.get(key);
      if (cached && Date.now() - cached.at < 300000) continue;
      const date = sourceLookupDate(record);
      if(!date){sourceLinks.set(key,{result:{status:'unknown'},at:Date.now()});continue;}
      let result;
      try {
        const response = await window.recordingAuth.request({ action: 'source_link', id: String(record.id), date });
        result = await response.json();
        if (!response.ok) result = { status: 'error' };
      } catch { result = { status: 'error' }; }
      if (epoch !== sourceLinkEpoch || !window.recordingAuth.isAuthenticated()) break;
      sourceLinks.set(key, { result, at: Date.now() });
      paintSourceLinks();
    }
  } finally { sourceLinkRunning = false; }
}
document.addEventListener('recording-auth-changed', () => {
  sourceLinkEpoch++;
  sourceLinks.clear();
  paintSourceLinks();
  // Lượt trước có thể còn chờ HTTP; vòng timer sẽ tiếp tục phiên mới.
  refreshSourceLinks();
});
document.getElementById('dateFilter').addEventListener('change', () => { sourceLinkEpoch++; });
setInterval(refreshSourceLinks, 2000);
refreshSourceLinks();
