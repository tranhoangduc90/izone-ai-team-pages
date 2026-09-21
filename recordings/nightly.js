/* Giao diện đối soát. Chỉ đọc snapshot đã lưu; làm mới không quét Zoom. */
const NIGHTLY_LABELS = {
  missing_at_scan:'Chưa thấy recording tại lần quét', zoom_unavailable:'Chưa kiểm tra được Zoom',
  zoom_processing:'Zoom đang xử lý tại lần quét', session_in_progress:'Buổi chưa kết thúc tại lần quét',
  missing_assignment:'Chưa xác định phân bổ Zoom', unmatched_files:'Có file chưa xác định',
  recordings_found:'Đã tìm thấy recording', audio_only:'Có ghi âm, chưa có video',
  asked_teacher:'Đã hỏi giảng viên', awaiting_file:'Chờ file bổ sung', cancelled:'Buổi đã hủy', accepted_missing:'Chấp nhận thiếu',
  ambiguous_session:'Nhiều buổi phù hợp', no_matching_session:'Chưa khớp buổi Portal', short_clip:'Clip dưới 3 phút',
  overlapping_layouts:'Nhiều bản ghi trùng khoảng thời gian', unverified_assignment_history:'Chưa xác minh phân bổ tại ngày học',
  starts_too_early:'Ghi sớm hơn lịch trên 30 phút', ends_too_late:'Ghi quá giờ trên 30 phút',
  possible_partial_recording:'Có thể thiếu đoạn đầu/cuối', new_file_in_approved_group:'Có clip bổ sung cho nhóm đã duyệt',
  unverified_lesson_number:'Chưa xác minh số buổi', cancelled_or_unknown_session:'Buổi hủy hoặc trạng thái chưa rõ',
  processing:'Zoom đang xử lý', empty_file:'File rỗng', no_video:'Chưa có video', invalid_recording_time:'Thiếu thời gian ghi',
  missing_session_time:'Thiếu giờ học', not_observed_in_latest_scan:'Chưa quan sát lại được file',
};
const nightlyState = {snapshot:null, generation:0};
function mergeNightlyRecords(existing, snapshot) {
  const records=[...existing];
  for(const row of snapshot?.records || []) {
    if(row.kind==='session' && row.status==='recordings_found' && !row.exceptionStatus) continue;
    const index=records.findIndex(r=>r.source===row.source && r.recordingFileId && r.recordingFileId===row.recordingFileId);
    if(index<0)records.push({...row,title:row.proposedTitle || `${row.className || row.source} · ${row.kind==='session'?'Buổi '+(row.lessonNumber||'—'):'Recording chưa đăng'}`,nightly:true});
    else records[index]={...row,...records[index],reasons:row.reasons || [],observedMatch:row.observedMatch};
  }
  return records;
}
async function loadNightly() {
  const config=window.RECORDING_NIGHTLY;
  if(!config?.dataUrl)return null;
  const generation=++nightlyState.generation;
  const date=document.getElementById('scanDate').value;
  const url=new URL(config.dataUrl);if(date)url.searchParams.set('date',date);
  const r=await fetch(url,{cache:'no-store',referrerPolicy:'no-referrer'});
  if(!r.ok)throw new Error('Không tải được đối soát');const data=await r.json();
  if(generation!==nightlyState.generation)return nightlyState.snapshot;
  nightlyState.snapshot=data.snapshot;
  const status=document.getElementById('scanStatus');
  status.textContent=data.snapshot
    ? `${data.snapshot.mode==='observe'?'Pilot chỉ đọc · ':''}${data.snapshot.scanStatus==='completed'?'Đã quét đủ hai tài khoản':'Lượt quét chưa đầy đủ'} · ${dateTime(data.snapshot.scannedAt)}`
    : 'Chưa có lượt quét cho ngày đã chọn. Không tự suy ra thiếu recording.';
  return data.snapshot;
}
function nightlyRow(record) {
  const label=NIGHTLY_LABELS[record.exceptionStatus || record.status] || 'Recording cần xác nhận';
  const issues=(record.reasons||[]).map(x=>NIGHTLY_LABELS[x]||x).join(' · ');
  const actions=record.kind==='session'?`<button class="action-button" data-action="exception" data-id="${escapeHtml(record.id)}">Xử lý ngoại lệ</button>`:`<button class="action-button" data-action="recording-decision" data-id="${escapeHtml(record.id)}">Xử lý recording</button>`;
  return `<tr><td><strong>${escapeHtml(record.className||'Chưa xác định')}</strong><div class="subtext">${escapeHtml(record.source)}</div></td><td><strong>${escapeHtml(record.title)}</strong><div class="subtext">${escapeHtml(issues)}</div></td><td>${dateTime(record.recordingStart)}</td><td><span class="badge wait">${escapeHtml(label)}</span></td><td>${actions}</td><td>—</td><td>${dateTime(record.updatedAt)}</td><td>${record.reviewStatus==='approved'?'✓ Đã duyệt':'Cần duyệt'}</td></tr>`;
}
document.getElementById('scanDate').value=localDate(new Date(Date.now()-86400000));
document.getElementById('scanDate').addEventListener('change',()=>{state.version++;loadData(true);});
document.getElementById('recheckButton').addEventListener('click',async(event)=>{
  const button=event.currentTarget;button.disabled=true;
  try {
    const r=await fetch(window.RECORDING_NIGHTLY.recheckUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({date:document.getElementById('scanDate').value}),referrerPolicy:'no-referrer'});
    if(!r.ok)throw new Error();
    toast('Đã gửi yêu cầu kiểm tra lại. Kết quả sẽ xuất hiện khi lượt quét hoàn tất.');
    document.getElementById('scanStatus').textContent='Đã gửi yêu cầu; đang chờ kết quả lượt quét mới.';
  }catch{toast('Không gửi được yêu cầu kiểm tra lại.','error');}finally{button.disabled=false;}
});
document.addEventListener('click',(event)=>{
  const button=event.target.closest('[data-action="exception"]');if(!button)return;
  const record=state.records.find(r=>r.id===button.dataset.id);if(!record)return;
  const dialog=document.getElementById('exceptionDialog');dialog.dataset.id=record.id;dialog.dataset.version=record.version;
  document.getElementById('exceptionReason').value=record.exceptionReason||'';dialog.showModal();
});
document.getElementById('exceptionForm').addEventListener('submit',async(event)=>{
  event.preventDefault();const dialog=document.getElementById('exceptionDialog');const button=document.getElementById('exceptionSubmit');button.disabled=true;
  try {
    const record=await postAction(window.RECORDING_NIGHTLY.actionUrl,{id:dialog.dataset.id,date:document.getElementById('scanDate').value,expectedVersion:Number(dialog.dataset.version),action:document.getElementById('exceptionAction').value,reason:document.getElementById('exceptionReason').value.trim()});
    replaceRecord({...record,nightly:true});dialog.close();toast('Đã lưu và đọc lại trạng thái ngoại lệ.');await loadData(true);
  }catch(error){toast(error.message.includes('VERSION_CONFLICT')?'Dữ liệu đã thay đổi. Hãy tải lại rồi thực hiện.':'Chưa lưu được. Khi đóng ngoại lệ, cần nhập lý do.','error');}
  finally{button.disabled=false;}
});

document.addEventListener('click',(event)=>{
  const button=event.target.closest('[data-action="recording-decision"]');if(!button)return;
  const record=state.records.find(r=>r.id===button.dataset.id);if(!record)return;
  const dialog=document.getElementById('recordingDecisionDialog');dialog.dataset.id=record.id;dialog.dataset.version=record.version;
  const sessions=(nightlyState.snapshot?.records||[]).filter(r=>r.kind==='session'&&r.numberingVerified&&r.lessonNumber>0);
  document.getElementById('recordingSession').innerHTML='<option value="">Chọn buổi học</option>'+sessions.map(r=>`<option value="${escapeHtml(r.classSessionId)}">${escapeHtml(r.className)} · Buổi ${escapeHtml(r.lessonNumber)} · ${escapeHtml(dateTime(r.sessionStart))}</option>`).join('');
  document.getElementById('recordingSession').value=record.classSessionId||record.proposedSessionId||'';
  document.getElementById('recordingDecisionReason').value='';dialog.showModal();
});
document.getElementById('recordingDecisionForm').addEventListener('submit',async(event)=>{
  event.preventDefault();const dialog=document.getElementById('recordingDecisionDialog');const button=document.getElementById('recordingDecisionSubmit');button.disabled=true;
  try {
    const record=await postAction(window.RECORDING_NIGHTLY.actionUrl,{id:dialog.dataset.id,date:document.getElementById('scanDate').value,expectedVersion:Number(dialog.dataset.version),action:document.getElementById('recordingDecisionAction').value,classSessionId:document.getElementById('recordingSession').value,reason:document.getElementById('recordingDecisionReason').value.trim()});
    replaceRecord({...record,nightly:true});dialog.close();toast('Đã lưu quyết định.');await loadData(true);
  }catch(error){const messages={VERSION_CONFLICT:'Dữ liệu đã thay đổi. Hãy làm mới rồi xử lý lại.',SELECT_PRIMARY_LAYOUT_FIRST:'Các clip trùng thời gian. Hãy bỏ qua bản phụ trước khi xác nhận bản chính.',INVALID_SESSION:'Hãy chọn buổi Portal có số buổi đã xác minh.',USE_PLAYLIST_CORRECTION_FOR_UPLOADED_VIDEO:'Video đã đăng: hãy dùng chức năng đổi playlist.'};toast(messages[error.message]||'Chưa lưu được quyết định. Hãy làm mới và kiểm tra trạng thái.','error');}
  finally{button.disabled=false;}
});
