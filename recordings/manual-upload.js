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
  if (source.status === 'processing') return 'Zoom còn processing — chọn Kiểm tra lại tệp';
  if (source.observationStale) return 'Metadata chưa được xác minh lại — chọn Kiểm tra lại tệp';
  if (source.type !== 'MP4' || source.status !== 'completed') return 'Chưa có MP4 hoàn chỉnh';
  if (!(source.fileSize > 0)) return 'Dung lượng tệp không hợp lệ';
  const durationBlock=recordingPublication.durationBlock(source);
  if(durationBlock)return recordingPublication.messages[durationBlock];
  if (source.fileSize > 640 * 1024 * 1024) return `Dung lượng ${(source.fileSize/1024/1024).toFixed(1)} MiB vượt giới hạn 640 MiB`;
  const terminalError = Boolean(record.errorCode) || ['needs_attention','hold'].includes(record.stage);
  if (terminalError) manualUploadPending.delete(source.id);
  const activeStage=['download','downloading','upload','uploading','processing','queued','postprocess_handoff'].includes(record.stage);
  if (activeStage || (!terminalError && (manualUploadPending.has(source.id) || ['uploading','processing'].includes(record.youtubeStatus) || record.downloadStatus==='downloading' || (source.manualDecision?.manualUpload && source.autoPublish)))) return 'Đã gửi yêu cầu đăng — đang xử lý';
  return '';
}
function updateManualUploadTitle() {
  const dialog=document.getElementById('manualUploadDialog');
  const record=nightlyState.snapshot?.records?.find(r=>r.id===dialog.dataset.id);
  const metadata={className:document.getElementById('manualUploadClass').value.trim().toUpperCase(),lessonNumber:Number(document.getElementById('manualUploadLesson').value),recordingDate:document.getElementById('manualUploadDate').value};
  const keepsGroup=record && metadata.className===record.className && metadata.lessonNumber===Number(record.lessonNumber) && metadata.recordingDate===recordingPublication.date(record.recordingStart);
  const parts=keepsGroup?recordingPublication.parts(record,nightlyState.snapshot?.records):{totalParts:1,partNumber:null};
  document.getElementById('manualUploadPartsLabel').hidden=!parts.requiresConfirmation;
  document.getElementById('manualUploadParts').required=Boolean(parts.requiresConfirmation);
  try {
    const confirmed=recordingPublication.metadata(record||{},metadata);
    document.getElementById('manualUploadTitle').value=recordingPublication.title({...confirmed,...parts});
  } catch {document.getElementById('manualUploadTitle').value='';}
}
function matchManualUploadClass() {
  const code=document.getElementById('manualUploadClass').value.trim().toUpperCase();
  const day=document.getElementById('manualUploadDate').value;
  const sessions=(nightlyState.snapshot?.records||[]).filter(r=>r.kind==='session'&&r.className===code&&r.lessonDate===day&&r.numberingVerified&&Number(r.lessonNumber)>0);
  document.getElementById('manualUploadLesson').value=sessions.length===1?sessions[0].lessonNumber:'';
  document.getElementById('manualUploadStatus').textContent=sessions.length===1?'':sessions.length>1?'Có nhiều buổi phù hợp. Hãy xác nhận số buổi.':'Chưa có một buổi Portal phù hợp. Hãy nhập và xác nhận số buổi.';
  updateManualUploadTitle();
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
  document.getElementById('manualUploadClass').value = /^[A-Z]{1,4}\d{3,5}$/i.test(record.className||'')?record.className:'';
  document.getElementById('manualUploadLesson').value = Number(record.lessonNumber)>0?record.lessonNumber:'';
  document.getElementById('manualUploadDate').value = record.recordingDate || recordingPublication.date(record.recordingStart);
  document.getElementById('manualUploadSource').textContent = `${record.source} · ${dateTime(record.recordingStart)} · ${record.recordingFileId}`;
  const select=document.getElementById('manualUploadPlaylist');
  const code=record.className||'';
  const matches=state.playlists.filter(p=>(String(p.title||'').match(/\b[A-Z]{1,4}\d{3,5}\b/gi)||[]).some(c=>c.toUpperCase()===code));
  const preferred=displayed.playlistId||(matches.length===1&&record.classSessionId?matches[0].id:'');
  select.value='';select.dataset.selected=preferred;
  document.getElementById('manualUploadSearch').value='';playlistOptions(select,'',preferred);
  const publishedGroup=(nightlyState.snapshot?.records||[]).some(r=>r.id!==record.id&&r.videoId&&record.classSessionId&&r.classSessionId===record.classSessionId);
  document.getElementById('manualUploadPartsLabel').hidden=!publishedGroup;
  document.getElementById('manualUploadParts').checked=false;document.getElementById('manualUploadParts').required=publishedGroup;
  document.getElementById('manualUploadStatus').textContent = state.playlists.length ? '' : 'Chưa lấy được danh sách playlist. Hãy đóng và làm mới dữ liệu.';
  document.getElementById('manualUploadSubmit').disabled = !state.playlists.length;
  updateManualUploadTitle();dialog.showModal(); document.getElementById('manualUploadPlaylist').focus();
});
document.getElementById('manualUploadForm').addEventListener('submit', async event => {
  event.preventDefault();
  const dialog = document.getElementById('manualUploadDialog'), button = document.getElementById('manualUploadSubmit');
  if (button.disabled || !window.recordingAuth?.isAuthenticated()) return;
  const id = dialog.dataset.id;
  const body = { action:'confirm_publish', id, date:dialog.dataset.date, expectedVersion:Number(dialog.dataset.version),
    playlistId:document.getElementById('manualUploadPlaylist').value,
    className:document.getElementById('manualUploadClass').value.trim().toUpperCase(),lessonNumber:Number(document.getElementById('manualUploadLesson').value),recordingDate:document.getElementById('manualUploadDate').value,
    partsConfirmed:document.getElementById('manualUploadParts').checked,contentConfirmed:true };
  if (!document.getElementById('manualUploadTitle').value || !body.playlistId) return;
  button.disabled = true; manualUploadPending.add(id);
  document.getElementById('manualUploadStatus').textContent = 'Đang gửi yêu cầu đăng…';
  try {
    const row = await postAction(window.RECORDING_NIGHTLY.actionUrl, body);
    replaceRecord({...row, nightly:true, title:row.proposedTitle || row.title});
    dialog.close(); toast('Đã gửi yêu cầu đăng. Link YouTube sẽ xuất hiện khi xử lý hoàn tất.');
    await loadData(true);
  } catch (error) {
    if (/VERSION_CONFLICT|INVALID_|AUTH_REQUIRED|FILE_NOT_READY|FILE_TOO_LARGE|DURATION_UNVERIFIED|VIDEO_UNDER_TEN_MINUTES|RECORDING_EXCLUDED|VIDEO_ALREADY_UPLOADED/.test(error.message)) manualUploadPending.delete(id);
    // Phản hồi lỗi có thể xảy ra sau khi máy chủ đã nhận: yêu cầu tải lại, không gửi lặp tự động.
    document.getElementById('manualUploadStatus').textContent = error.message.includes('VERSION_CONFLICT')
      ? 'Dữ liệu đã thay đổi. Đóng hộp thoại và làm mới trước khi đăng.'
      : Object.entries(recordingPublication.messages).find(([code])=>error.message.includes(code))?.[1] || 'Chưa xác nhận được kết quả yêu cầu. Đóng hộp thoại, làm mới và kiểm tra tiến độ trước khi thử lại.';
  }
});

document.getElementById('manualUploadSearch').addEventListener('input',()=>playlistOptions(document.getElementById('manualUploadPlaylist'),document.getElementById('manualUploadSearch').value));
document.getElementById('manualUploadPlaylist').addEventListener('change',event=>{
  const select=event.target;select.dataset.selected=select.value;
  const code=(state.playlists.find(p=>p.id===select.value)?.title||'').match(/\b[A-Z]{1,4}\d{3,5}\b/i)?.[0]?.toUpperCase();
  if(code&&code!==document.getElementById('manualUploadClass').value.trim().toUpperCase()){
    document.getElementById('manualUploadClass').value=code;matchManualUploadClass();
  }else updateManualUploadTitle();
});
for(const id of ['manualUploadClass','manualUploadDate'])document.getElementById(id).addEventListener('change',matchManualUploadClass);
document.getElementById('manualUploadLesson').addEventListener('input',updateManualUploadTitle);
document.addEventListener('recording-auth-changed', () => {
  if (!window.recordingAuth?.isAuthenticated()) document.getElementById('manualUploadDialog').close();
});
