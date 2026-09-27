// Lệnh đăng riêng biệt với tick đã duyệt. Không giữ token hoặc quyết định ở localStorage.
const manualUploadPending = new Set();
const refreshFilePending = new Set();
async function refreshKnownRecordingFile(id, control) {
  const record = nightlyState.snapshot?.records?.find(r => r.id === id);
  if (!canRefreshRecordingFile(record)) { toast('Tệp này không còn cần kiểm tra lại.', 'error'); return; }
  if (!window.recordingAuth?.isAuthenticated()) { toast('Vui lòng đăng nhập để kiểm tra lại tệp.', 'error'); return; }
  if (refreshFilePending.has(id)) return;
  refreshFilePending.add(id); control.disabled = true;
  try {
    const response = await window.recordingAuth.request({action:'refresh_file',date:nightlyState.snapshot.date,id,expectedVersion:record.version});
    const result = await response.json();
    if (!response.ok || result.ok !== true || result.record?.type !== 'MP4' || result.record?.status !== 'completed')
      throw new Error(result.error || 'REFRESH_FAILED');
    await loadData(true);
    const saved = nightlyState.snapshot?.records?.find(r => r.id === result.record.id);
    if (!saved || saved.version !== result.record.version || saved.type !== 'MP4' || saved.status !== 'completed')
      throw new Error('READBACK_PENDING');
    toast('Tệp đã sẵn sàng. Hãy kiểm tra video rồi chọn Đăng lên YouTube.');
  } catch (error) {
    if (error.message === 'COMPLETED_FILE_NOT_UNIQUE') toast('Zoom chưa trả về một video MP4 hoàn chỉnh duy nhất cho tệp này.', 'error');
    else if (error.message === 'VERSION_CONFLICT' || error.message === 'REFRESH_BUSY') toast('Dữ liệu đang thay đổi. Hãy làm mới trang rồi thử lại.', 'error');
    else toast('Chưa xác minh được tệp. Hãy làm mới dữ liệu trước khi thử lại.', 'error');
  } finally {
    refreshFilePending.delete(id); if (control.isConnected) control.disabled = false;
  }
}
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
  if (record.kind === 'session') return '<span class="subtext">Chưa có video</span>';
  if (!manualUploadSource(record)) return '<button class="action-button manual-upload-disabled" disabled title="Chưa xác định được video nguồn">Đăng lên YouTube</button>';
  const reason = manualUploadUnavailable(record);
  if (reason) return `<button class="action-button manual-upload-disabled" disabled title="${escapeHtml(reason)}">Đăng lên YouTube</button>`;
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
