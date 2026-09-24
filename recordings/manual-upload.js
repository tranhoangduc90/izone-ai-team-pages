// Lệnh đăng riêng biệt với tick đã duyệt. Không giữ token hoặc quyết định ở localStorage.
const manualUploadPending = new Set();
function manualUploadSource(record) {
  return nightlyState.snapshot?.records?.find(r => r.kind === 'recording' &&
    (r.id === record.id || (r.recordingFileId === record.recordingFileId && r.source === record.source)));
}
function manualUploadUnavailable(record) {
  const source = manualUploadSource(record);
  if (!source || record.videoId || source.videoId || record.kind === 'session') return 'Không có video nguồn để đăng';
  if (source.excluded) return 'Recording đã bị loại khỏi luồng';
  if (typeof sourceLinks !== 'undefined' && sourceLinks.get(sourceLinkKey(record))?.result?.status === 'deleted') return 'Recording đã được xóa trong Zoom';
  if (source.type !== 'MP4' || source.status !== 'completed' || source.observationStale || !(source.fileSize > 0)) return 'File chưa sẵn sàng để đăng';
  if (source.fileSize > 512 * 1024 * 1024) return 'File vượt giới hạn 512 MiB của luồng hiện tại';
  const terminalError = Boolean(record.errorCode) || ['needs_attention','hold'].includes(record.stage);
  if (terminalError) manualUploadPending.delete(source.id);
  if (!terminalError && (manualUploadPending.has(source.id) || ['uploading','processing'].includes(record.youtubeStatus) || (source.manualDecision?.manualUpload && source.autoPublish))) return 'Đã gửi yêu cầu đăng — đang xử lý';
  return '';
}
function manualUploadCell(record) {
  if (!manualUploadSource(record)) return '<span class="subtext">Chưa đăng video</span>';
  const reason = manualUploadUnavailable(record);
  if (reason) return `<span class="subtext">${escapeHtml(reason)}</span>`;
  return `<button class="action-button" data-action="manual-upload" data-id="${escapeHtml(record.id)}">Đăng lên YouTube</button>`;
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action="manual-upload"]');
  if (!button) return;
  if (!window.recordingAuth?.isAuthenticated()) { toast('Vui lòng đăng nhập để đăng video.', 'error'); return; }
  const displayed = state.records.find(r => r.id === button.dataset.id);
  if (!displayed) return;
  const reason = manualUploadUnavailable(displayed);
  if (reason) { toast(reason, 'error'); return; }
  const record = manualUploadSource(displayed), dialog = document.getElementById('manualUploadDialog');
  dialog.dataset.id = record.id; dialog.dataset.version = record.version; dialog.dataset.date = nightlyState.snapshot.date;
  document.getElementById('manualUploadTitle').value = record.proposedTitle || record.title || '';
  document.getElementById('manualUploadSource').textContent = `${record.source} · ${dateTime(record.recordingStart)} · ${record.recordingFileId}`;
  document.getElementById('manualUploadPlaylist').innerHTML = '<option value="">Chọn playlist</option>' + state.playlists.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('');
  if (displayed.playlistId) document.getElementById('manualUploadPlaylist').value = displayed.playlistId;
  document.getElementById('manualUploadStatus').textContent = state.playlists.length ? '' : 'Chưa lấy được danh sách playlist. Hãy đóng và làm mới dữ liệu.';
  document.getElementById('manualUploadSubmit').disabled = !state.playlists.length;
  dialog.showModal(); document.getElementById('manualUploadTitle').focus();
});
document.getElementById('manualUploadForm').addEventListener('submit', async event => {
  event.preventDefault();
  const dialog = document.getElementById('manualUploadDialog'), button = document.getElementById('manualUploadSubmit');
  if (button.disabled || !window.recordingAuth?.isAuthenticated()) return;
  const id = dialog.dataset.id;
  const body = { action:'confirm_publish', id, date:dialog.dataset.date, expectedVersion:Number(dialog.dataset.version),
    title:document.getElementById('manualUploadTitle').value.trim(), playlistId:document.getElementById('manualUploadPlaylist').value, contentConfirmed:true };
  if (!body.title || !body.playlistId) return;
  button.disabled = true; manualUploadPending.add(id);
  document.getElementById('manualUploadStatus').textContent = 'Đang gửi yêu cầu đăng…';
  try {
    const row = await postAction(window.RECORDING_NIGHTLY.actionUrl, body);
    replaceRecord({...row, nightly:true, title:row.proposedTitle || row.title});
    dialog.close(); toast('Đã gửi yêu cầu đăng. Link YouTube sẽ xuất hiện khi xử lý hoàn tất.');
    await loadData(true);
  } catch (error) {
    if (/VERSION_CONFLICT|INVALID_|AUTH_REQUIRED|FILE_NOT_READY|FILE_TOO_LARGE|RECORDING_EXCLUDED|VIDEO_ALREADY_UPLOADED/.test(error.message)) manualUploadPending.delete(id);
    // Phản hồi lỗi có thể xảy ra sau khi máy chủ đã nhận: yêu cầu tải lại, không gửi lặp tự động.
    document.getElementById('manualUploadStatus').textContent = error.message.includes('VERSION_CONFLICT')
      ? 'Dữ liệu đã thay đổi. Đóng hộp thoại và làm mới trước khi đăng.'
      : 'Chưa xác nhận được kết quả yêu cầu. Đóng hộp thoại, làm mới và kiểm tra tiến độ trước khi thử lại.';
  }
});
document.addEventListener('recording-auth-changed', () => {
  if (!window.recordingAuth?.isAuthenticated()) document.getElementById('manualUploadDialog').close();
});
