/* Giao diện đối soát. Chỉ đọc snapshot đã lưu; làm mới không quét Zoom. */
const NIGHTLY_LABELS = {
  missing_at_scan:'Chưa thấy recording tại lần quét', zoom_unavailable:'Chưa kiểm tra được Zoom',
  zoom_processing:'Zoom đang xử lý tại lần quét', session_in_progress:'Buổi chưa kết thúc tại lần quét',
  missing_assignment:'Chưa xác định phân bổ Zoom', unmatched_files:'Có file chưa xác định',
  recordings_found:'Đã tìm thấy recording', audio_only:'Có ghi âm, chưa có video',
  asked_teacher:'Đã hỏi giảng viên', awaiting_file:'Chờ file bổ sung', cancelled:'Buổi đã hủy', accepted_missing:'Chấp nhận thiếu',
  ambiguous_session:'Nhiều buổi phù hợp', no_matching_session:'Chưa khớp buổi Portal', short_clip:'Video dưới 10 phút — không đăng YouTube',
  overlapping_layouts:'Nhiều bản ghi trùng khoảng thời gian', unverified_assignment_history:'Chưa xác minh phân bổ tại ngày học',
  starts_too_early:'Ghi sớm hơn lịch trên 30 phút', ends_too_late:'Ghi quá giờ trên 30 phút',
  possible_partial_recording:'Có thể thiếu đoạn đầu/cuối', new_file_in_approved_group:'Có clip bổ sung cho nhóm đã duyệt',
  unverified_lesson_number:'Chưa xác minh số buổi', cancelled_or_unknown_session:'Buổi hủy hoặc trạng thái chưa rõ',
  processing:'Zoom đang xử lý', empty_file:'File rỗng', no_video:'Chưa có video', invalid_recording_time:'Thiếu thời gian ghi',
  missing_session_time:'Thiếu giờ học', not_observed_in_latest_scan:'Chưa quan sát lại được file',
};
const QUEUE_MESSAGES={queued:'Đang chờ hàng đợi truyền file',waiting:'Đang chờ hàng đợi truyền file',download:'Đang tải từ Zoom',downloading:'Đang tải từ Zoom',upload:'Đang đăng lên YouTube',uploading:'Đang đăng lên YouTube',processing:'YouTube đang xử lý',completed:'Hoàn tất',running:'Đang truyền file',blocked_disk:'Thiếu dung lượng VPS; giữ tác vụ chờ kiểm tra',blocked_quota:'Đã hết quota YouTube; cần kiểm tra trước khi thử lại',LOCAL_SPACE_INSUFFICIENT:'Thiếu dung lượng VPS; giữ tác vụ chờ kiểm tra',LOCAL_SPACE_UNKNOWN:'Chưa xác minh dung lượng trống VPS',YOUTUBE_QUOTA_EXCEEDED:'Đã hết quota YouTube',WORKER_EXECUTION_FAILED:'Tác vụ truyền file bị lỗi; cần kiểm tra',UPLOAD_OUTCOME_UNKNOWN:'Chưa xác định kết quả upload; không gửi lại để tránh đăng trùng',VIDEO_NOT_FOUND:'Không đọc được video đích — cần xác minh; giữ nguyên video ID'};
const nightlyState = {snapshot:null, generation:0, missingDates:[], failedDates:[]};
function mergeNightlyRecords(existing, snapshot) {
  const hiddenIds=new Set((snapshot?.records||[]).filter(row=>row.kind==='recording'&&!shouldShowRecordingRow(row)).map(row=>row.id));
  for(const row of snapshot?.records||[]) if(row.kind==='recording'&&row.type==='MP4')
    for(const event of row.audit||[]) if(event.action==='refresh_processing_source'&&event.previousRecordId)
      hiddenIds.add(event.previousRecordId);
  const records=existing.filter(row=>shouldShowRecordingRow(row)&&!hiddenIds.has(row.id));
  for(const row of snapshot?.records || []) {
    if(!shouldShowRecordingRow(row)) continue;
    const index=records.findIndex(r=>r.source===row.source && r.recordingFileId && r.recordingFileId===row.recordingFileId);
    if(index<0)records.push({...row,title:row.proposedTitle || `${row.className || row.source} · ${row.kind==='session'?'Buổi '+(row.lessonNumber||'—'):'Recording chưa đăng'}`,nightly:true});
    else {
      const merged={...row,...records[index],reasons:row.reasons || [],observedMatch:row.observedMatch,_snapshotDate:row._snapshotDate};
      if(row.sourceRefreshedAt && !merged.videoId) Object.assign(merged,{type:row.type,status:row.status,fileSize:row.fileSize,
        recordingEnd:row.recordingEnd,observationStale:row.observationStale,version:row.version});
      records[index]=merged;
    }
  }
  return records;
}
const nightlyRangeCache=new Map();
async function loadNightly(signal,force=false) {
  const config=window.RECORDING_NIGHTLY;if(!config?.dataUrl)return null;
  const generation=++nightlyState.generation;
  const from=document.getElementById('dateFilter').value,to=document.getElementById('dateToFilter').value;
  async function read(date,signal){
    const cached=nightlyRangeCache.get(date);
    if(!force&&cached&&Date.now()-cached.at<300000)return cached.snapshot;
    const url=new URL(config.dataUrl);if(date)url.searchParams.set('date',date);
    const r=await fetch(url,{cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(30000)])});
    if(!r.ok)throw Error('SNAPSHOT_UNAVAILABLE');const data=await r.json();if(data.ok===false)throw Error('SNAPSHOT_UNAVAILABLE');if(!date||!data.snapshot||data.snapshot.date===date)nightlyRangeCache.set(date,{at:Date.now(),snapshot:data.snapshot});
    if(nightlyRangeCache.size>100)nightlyRangeCache.delete(nightlyRangeCache.keys().next().value);return data.snapshot;
  }
  const dates=from||to?recordingFilters.range(from,to).days:[''];
  const result=await recordingFilters.loadRange(dates,read,{signal,onProgress:(done,total)=>{
    if(generation===nightlyState.generation)document.getElementById('filterStatus').textContent=`Đang tải đối soát ${done}/${total} ngày…`;
  }});
  if(generation!==nightlyState.generation)return nightlyState.snapshot;
  nightlyState.missingDates=result.missing;nightlyState.failedDates=result.failed;
  nightlyState.error=Boolean(result.missing.length||result.failed.length);
  if(!result.snapshots.length){nightlyState.snapshot=null;return null;}
  const snapshot=recordingFilters.combine(result.snapshots);nightlyState.snapshot=snapshot;
  return snapshot;
}
function nightlyRow(record) {
  const label=record.excluded?'Đã loại khỏi luồng đăng':NIGHTLY_LABELS[record.exceptionStatus || record.status] || 'Recording cần xác nhận';
  const issues=[...(record.reasons||[]).map(x=>NIGHTLY_LABELS[x]||x), typeof manualUploadUnavailable==='function'?manualUploadUnavailable(record):''].filter((x,i,all)=>x&&all.indexOf(x)===i).join(' · ');
  const currentIssue=QUEUE_MESSAGES[record.errorCode]||record.errorCode||QUEUE_MESSAGES[record.stage]||QUEUE_MESSAGES[record.queueState]||(record.status==='processing'?'Zoom đang xử lý, chưa có MP4 hoàn chỉnh. Chọn Kiểm tra lại tệp.':'Không ghi nhận lỗi kỹ thuật');
  const exception=record.kind==='session'?'<div class="subtext"><button class="action-button" data-action="exception" data-id="'+escapeHtml(record.id)+'">Xử lý ngoại lệ</button></div>':'';
  return `<tr><td><strong>${escapeHtml(displayClassName(record))}</strong><div class="subtext">${escapeHtml(record.source)}</div></td><td><strong>${escapeHtml(record.title)}</strong>${record.kind==='session'?'<div class="subtext">Buổi học từ Portal · Chưa gắn recording</div>':''}<div class="subtext"><strong>Lý do cần duyệt:</strong> ${escapeHtml(issues||label)}</div><div class="subtext"><strong>Lỗi hiện tại:</strong> ${escapeHtml(currentIssue)}</div>${exception}</td><td>${dateTime(record.recordingStart)}</td><td>${recordingSourceCell(record)}</td><td>${videoEditCell(record)}</td><td>—</td><td class="approval-cell">${record.kind==='recording'?`<label class="approval-check" title="Xác nhận đã kiểm tra; không tự đăng video hay xóa lỗi"><input type="checkbox" data-action="nightly-review" data-id="${escapeHtml(record.id)}" ${typeof recordingReviewAttributes==='function'?recordingReviewAttributes(record):isApproved(record)?'checked':''}><span aria-hidden="true">✓</span><em>${isApproved(record)?'Đã duyệt':'Duyệt'}</em></label>`:(isApproved(record)?'✓ Đã duyệt':'Cần duyệt')}</td></tr>`;

}


document.addEventListener('click',(event)=>{
  const button=event.target.closest('[data-action="exception"]');if(!button)return;
  const record=state.records.find(r=>r.id===button.dataset.id);if(!record)return;
  const dialog=document.getElementById('exceptionDialog');dialog.dataset.id=record.id;dialog.dataset.version=record.version;dialog.dataset.date=record._snapshotDate||nightlyState.snapshot?.date;
  document.getElementById('exceptionReason').value=record.exceptionReason||'';dialog.showModal();
});

const PREVIEW_ERRORS={ZOOM_SOURCE_UNAVAILABLE:'Recording không còn truy cập được trên Zoom. Có thể đã bị xóa hoặc chuyển vào thùng rác; hệ thống không tự khôi phục.',ZOOM_ACCESS_DENIED:'Tài khoản kết nối chưa có quyền đọc recording này.',ZOOM_PROCESSING:'Zoom vẫn đang xử lý recording.',ZOOM_PLAYBACK_LINK_UNAVAILABLE:'Zoom chưa cung cấp link xem đúng clip này.',AUTH_REQUIRED:'Vui lòng đăng nhập Google bằng tài khoản đã được cấp quyền.', AUTH_REQUIRED_OR_FORBIDDEN:'Phiên đăng nhập chưa hợp lệ hoặc chưa có quyền.', PREVIEW_NOT_AVAILABLE:'Chưa lấy được link xem. Hãy làm mới dữ liệu và thử lại.'};
let previewGeneration=0;
document.addEventListener('click',async(event)=>{
 const button=event.target.closest('[data-action="preview"]');if(!button)return;
 const displayed=state.records.find(r=>r.id===button.dataset.id);if(!displayed)return;
 const source=nightlyState.snapshot?.records?.find(r=>r.id===displayed.id||(r.recordingFileId&&r.recordingFileId===displayed.recordingFileId&&r.source===displayed.source));
 const record=source?{...displayed,...source,title:displayed.title}:displayed;
 const generation=++previewGeneration,dialog=document.getElementById('previewDialog');
 dialog.dataset.id=record.id;dialog.dataset.version=record.version;dialog.dataset.date=record._snapshotDate||nightlyState.snapshot?.date;dialog.dataset.date=record._snapshotDate||nightlyState.snapshot.date;
 dialog.dataset.canPublish=displayed.videoId?'false':'true';document.getElementById('publishForm').reset();document.getElementById('publishForm').hidden=dialog.dataset.canPublish==='false'||!window.recordingAuth?.isAuthenticated();
 const sessions=(nightlyState.snapshot.records||[]).filter(r=>r.kind==='session'&&r.numberingVerified&&r.lessonNumber>0);
 document.getElementById('publishSession').innerHTML='<option value="">Chọn đúng lớp và buổi học</option>'+sessions.map(r=>`<option value="${escapeHtml(r.classSessionId)}">${escapeHtml(r.className)} — Buổi ${escapeHtml(r.lessonNumber)} — ${escapeHtml(dateTime(r.recordingStart))}</option>`).join('');
 const publicationBlocked=typeof manualUploadUnavailable==='function'?manualUploadUnavailable(record):'';
 document.getElementById('publishSubmit').disabled=!sessions.length||Boolean(publicationBlocked);
 document.getElementById('publishSubmit').title=publicationBlocked;
 const status=document.getElementById('previewStatus'),link=document.getElementById('previewZoomLink');
 document.getElementById('previewTitle').textContent=record.title;
 const seconds=Math.max(0,Math.round((Date.parse(record.recordingEnd)-Date.parse(record.recordingStart))/1000));
 document.getElementById('previewMetadata').textContent=`${record.source} · ${dateTime(record.recordingStart)} → ${dateTime(record.recordingEnd)}${Number.isFinite(seconds)?' · '+Math.floor(seconds/60)+' phút '+seconds%60+' giây':''}`;
 document.getElementById('previewIssues').textContent=(record.reasons||[]).map(x=>NIGHTLY_LABELS[x]||x).join(' · ')||'Chờ nhân sự xem nội dung và xác nhận.';
 status.textContent='Đang lấy link xem từ Zoom…';link.hidden=true;link.removeAttribute('href');dialog.showModal();
 try {
  const response=await window.recordingAuth.request({action:'preview',id:record.id,date:dialog.dataset.date});
  const data=await response.json();if(generation!==previewGeneration||!dialog.open)return;
  if(!response.ok||!data.ok)throw new Error(data.error||'PREVIEW_NOT_AVAILABLE');
  if(!/^https:\/\/(?:[a-z0-9-]+\.)*zoom\.us\/rec\/(?:play|share)\/[a-zA-Z0-9_.~-]+$/i.test(data.preview?.url||''))throw new Error('PREVIEW_NOT_AVAILABLE');
  link.href=data.preview.url;link.hidden=false;status.textContent='Mở bản gốc ở tab mới. Zoom có thể yêu cầu đăng nhập hoặc mật khẩu do người quản lý cung cấp.';
 }catch(error){if(generation===previewGeneration&&dialog.open)status.textContent=PREVIEW_ERRORS[error.message]||PREVIEW_ERRORS.PREVIEW_NOT_AVAILABLE;}
});
document.getElementById('previewDialog').addEventListener('close',()=>{previewGeneration++;});
let privatePreviewObjectUrl='';
function clearPrivatePreview(){const video=document.getElementById('privatePreviewVideo');video.pause();video.removeAttribute('src');video.load();video.hidden=true;if(privatePreviewObjectUrl)URL.revokeObjectURL(privatePreviewObjectUrl);privatePreviewObjectUrl='';}
document.getElementById('previewDialog').addEventListener('close',clearPrivatePreview);
document.addEventListener('recording-auth-changed',()=>{
 document.getElementById('publishForm').hidden=document.getElementById('previewDialog').dataset.canPublish==='false'||!window.recordingAuth.isAuthenticated();
 if(!window.recordingAuth.isAuthenticated()){previewGeneration++;clearPrivatePreview();document.getElementById('previewZoomLink').hidden=true;}
});
document.getElementById('privatePreviewButton').addEventListener('click',async()=>{
 const dialog=document.getElementById('previewDialog'),button=document.getElementById('privatePreviewButton'),status=document.getElementById('previewStatus');
 const generation=previewGeneration;button.disabled=true;clearPrivatePreview();status.textContent='Đang tải video nội bộ. Vui lòng chờ…';
 try{
  const response=await window.recordingAuth.request({action:'preview_file',date:dialog.dataset.date,id:dialog.dataset.id});
  if(!response.ok||!(response.headers.get('Content-Type')||'').includes('video/mp4')){const body=await response.json();throw new Error(body.message||PREVIEW_ERRORS[body.error]||'Chưa xem được file nội bộ.');}
  const blob=await response.blob();if(!dialog.open||generation!==previewGeneration||!window.recordingAuth.isAuthenticated())return;
  privatePreviewObjectUrl=URL.createObjectURL(blob);const video=document.getElementById('privatePreviewVideo');video.src=privatePreviewObjectUrl;video.hidden=false;status.textContent='Video đã sẵn sàng để xem trong phiên đăng nhập này.';
 }catch(error){if(dialog.open&&generation===previewGeneration)status.textContent=PREVIEW_ERRORS[error.message]||error.message;}
 finally{button.disabled=false;}
});
document.getElementById('publishForm').addEventListener('submit',async(event)=>{
 event.preventDefault();const dialog=document.getElementById('previewDialog'),button=document.getElementById('publishSubmit');button.disabled=true;
 try{
  const row=await postAction(window.RECORDING_NIGHTLY.actionUrl,{date:dialog.dataset.date,id:dialog.dataset.id,expectedVersion:Number(dialog.dataset.version),action:'confirm_publish',classSessionId:document.getElementById('publishSession').value,reason:document.getElementById('publishReason').value.trim(),contentConfirmed:document.getElementById('publishConfirmed').checked});
  replaceRecord({...row,nightly:true,title:row.proposedTitle});dialog.close();toast('Đã lưu yêu cầu đăng. Theo dõi tiến độ; chưa đồng nghĩa video đã đăng thành công.');await loadData(true);
 }catch(error){toast(error.message.includes('VERSION_CONFLICT')?'Dữ liệu đã thay đổi. Đóng hộp thoại và làm mới trước khi xác nhận.':'Chưa xác nhận đăng được: '+error.message,'error');}
 finally{button.disabled=false;}
});
document.getElementById('exceptionForm').addEventListener('submit',async(event)=>{
  event.preventDefault();const dialog=document.getElementById('exceptionDialog');const button=document.getElementById('exceptionSubmit');button.disabled=true;
  try {
    const record=await postAction(window.RECORDING_NIGHTLY.actionUrl,{id:dialog.dataset.id,date:dialog.dataset.date,expectedVersion:Number(dialog.dataset.version),action:document.getElementById('exceptionAction').value,reason:document.getElementById('exceptionReason').value.trim()});
    replaceRecord({...record,nightly:true});dialog.close();toast('Đã lưu và đọc lại trạng thái ngoại lệ.');await loadData(true);
  }catch(error){toast(error.message.includes('VERSION_CONFLICT')?'Dữ liệu đã thay đổi. Hãy tải lại rồi thực hiện.':'Chưa lưu được. Khi đóng ngoại lệ, cần nhập lý do.','error');}
  finally{button.disabled=false;}
});
