const DATA_API_URL = 'https://ducizone.ddns.net/webhook/recording-monitor-data-884067a346fc458e9e0503e73b3e41b3';
const REVIEW_API_URL = 'https://ducizone.ddns.net/webhook/recording-review-7111fb0e9d104e76809e58bb6664cc48';
const RENAME_API_URL = 'https://ducizone.ddns.net/webhook/recording-rename-763280960132451999cff944f1225fd7';
const PLAYLIST_API_URL = 'https://ducizone.ddns.net/webhook/recording-playlist-8ea46fc7390145c58ffa915cf6cedbd2';
const REFRESH_MS = 60_000;

const state = { records: [], yesterdayClasses: [], playlists: [], loading: false, playlistQuery: '', version: 0 };
const selectedSessions = new Set();
const $ = (id) => document.getElementById(id);
const controls = ['dateFilter', 'dateToFilter', 'accountFilter', 'reviewFilter', 'youtubeFilter', 'columnFilter', 'searchFilter'].map($);

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

function displayClassName(record) {
  const name=String(record.className || '').trim();
  return !name || /^(cần duyệt|chưa xác định(?: lớp)?)$/i.test(name) ? 'Chưa xác định' : name;
}

function currentRecordingFilter() {
  const from=$('dateFilter').value, to=$('dateToFilter').value;
  return {from:from||to,to:to||from,account:$('accountFilter').value,review:$('reviewFilter').value,
    youtube:$('youtubeFilter').value,column:$('columnFilter').value,search:$('searchFilter').value,
    reasonLabels:typeof NIGHTLY_LABELS==='undefined'?{}:NIGHTLY_LABELS};
}
function filteredRecords(records) {
  return records.filter(record=>recordingFilters.matches(record,currentRecordingFilter(),localDate));
}
function filteredSessions() {
  return state.yesterdayClasses.filter(record=>recordingFilters.matches(record,currentRecordingFilter(),localDate,true));
}
function incompleteNightlyData() {
  return state.historyUnavailable || nightlyState.error || ['failed', 'partial'].includes(nightlyState.snapshot?.scanStatus);
}
function renderStats() {
  if(state.rangeUnavailable){for(const id of ['yesterdayClassCount','totalCount','reviewCount','approvedCount'])$(id).textContent='—';return;}
  const records=filteredRecords(state.records), partial=incompleteNightlyData()?'≥ ':'';
  $('yesterdayClassCount').textContent = partial+filteredSessions().length;
  $('totalCount').textContent = partial+records.length;
  $('reviewCount').textContent = partial+records.filter(record=>!isApproved(record)).length;
  $('approvedCount').textContent = partial+records.filter(isApproved).length;
}
function renderFilteredView() { renderStats(); renderYesterday(); renderSections(); }

function renderYesterday() {
  if(state.rangeUnavailable){$('yesterdayClasses').innerHTML='<div class="empty-inline">Chưa tải được lịch học của khoảng ngày đã chọn.</div>';return;}
  const cards = filteredSessions().map((item) => {
    const key = String(item.classSessionId || item.id || `${item.className}:${item.sessionStart}`);
    return `<button type="button" class="class-card${selectedSessions.has(key) ? ' is-selected' : ''}" data-session-key="${escapeHtml(key)}" aria-pressed="${selectedSessions.has(key)}" aria-label="${escapeHtml(`${item.className || 'Chưa rõ lớp'}, Buổi ${item.lessonNumber || '—'}`)}">
    <div><span class="class-code">${escapeHtml(item.className || 'Chưa rõ lớp')}</span><span class="badge zoom">${escapeHtml(item.zoomAccount || 'Chưa phân bổ Zoom')}</span></div>
    <strong>Buổi ${escapeHtml(item.lessonNumber || '—')}</strong>
    <span>${item.normalizedTime?dateTime(item.sessionStart):portalTime(item.sessionStart)+" · "+displayDate(item.sessionStart)}</span>
  </button>`;
  }).join('');
  $('yesterdayClasses').innerHTML = cards || (nightlyState.error||['failed','partial'].includes(nightlyState.snapshot?.scanStatus)?'<div class="empty-inline">Chưa đọc đủ dữ liệu lịch học; chưa thể kết luận ngày này không có lớp.</div>':'<div class="empty-inline">Không có lớp dùng các tài khoản Zoom đang theo dõi trong ngày này.</div>');
}
$('yesterdayClasses').addEventListener('click', (event) => {
  const card = event.target.closest('.class-card');
  if (!card || !event.currentTarget.contains(card)) return;
  const key = card.dataset.sessionKey;
  if (selectedSessions.has(key)) selectedSessions.delete(key);
  else selectedSessions.add(key);
  card.classList.toggle('is-selected', selectedSessions.has(key));
  card.setAttribute('aria-pressed', String(selectedSessions.has(key)));
});

function youtubeState(record) {
  if (record.youtubeStatus === 'uploaded') return '<span class="badge ok">Đã đăng</span>';
  if (record.youtubeStatus === 'error' || record.error) return '<span class="badge error">Có lỗi</span>';
  return '<span class="badge wait">Đang chờ</span>';
}

function recordingSourceCell(record) {
  return '<div data-source-link-id="'+escapeHtml(record.id)+'">'+(typeof sourceLinkMarkup==='function'?sourceLinkMarkup(record):'<span class="subtext">Đang kiểm tra nguồn Zoom…</span>')+'</div>';
}
function videoEditCell(record) {
  if(!record.videoId) {
    if(canRefreshRecordingFile(record))return '<select class="video-edit-select" data-edit-id="'+escapeHtml(record.id)+'" aria-label="Chỉnh sửa recording"><option value="">Chọn thao tác</option><option value="refresh_file">Kiểm tra lại tệp</option></select>';
    return typeof manualUploadCell==='function'?manualUploadCell(record):'<span class="subtext">Chưa đăng video</span>';
  }
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
  const reason = [record.matchReason, record.playlistReason, !record.videoId && typeof manualUploadUnavailable==='function'?manualUploadUnavailable(record):''].filter(Boolean).map((text) => `<div class="subtext">${escapeHtml(text)}</div>`).join('');
  const processingNote = !record.videoId && record.status === 'processing'
    ? '<div class="subtext">Zoom đang xử lý, chưa có MP4 hoàn chỉnh. Chọn Kiểm tra lại tệp.</div>' : '';
  return `<tr data-record-id="${escapeHtml(record.id)}">
    <td><span class="class-code">${escapeHtml(displayClassName(record))}</span><div class="subtext">${escapeHtml(record.source || '—')}</div></td>
    <td><div class="record-title">${escapeHtml(record.title || 'Zoom recording')}</div><div class="subtext">${lesson}${part} · ${escapeHtml(record.recordingFileId || '')}</div>${reason}${processingNote}</td>
    <td>${dateTime(record.recordingStart)}</td>
    <td>${recordingSourceCell(record)}</td>
    <td>${videoEditCell(record)}</td>
    <td>${link}</td>
    <td class="approval-cell"><label class="approval-check"><input type="checkbox" data-action="review" data-id="${escapeHtml(record.id)}" ${typeof recordingReviewAttributes==='function'?recordingReviewAttributes(record):isApproved(record)?'checked':''}><span aria-hidden="true">✓</span><em>${isApproved(record) ? 'Đã duyệt' : 'Duyệt'}</em></label></td>
  </tr>`;
}

function renderSection(title, records, approved) {
  const rows = filteredRecords(records);
  return `<section class="review-section ${approved ? 'approved' : 'pending'}">
    ${!approved&&(nightlyState.error||['failed','partial'].includes(nightlyState.snapshot?.scanStatus))?'<div class="empty-inline" role="alert">Chưa đối soát đầy đủ: nguồn Portal hoặc Zoom đang gặp lỗi. Các bản ghi hiện có được giữ để kiểm tra.</div>':''}<div class="review-heading"><div><span class="section-dot"></span><h2>${title}</h2></div><span>${rows.length} recording</span></div>
    ${rows.length ? `<div class="table-wrap"><table><colgroup><col class="column-class"><col class="column-recording"><col class="column-time"><col class="column-source"><col class="column-edit"><col class="column-youtube"><col class="column-review"></colgroup><thead><tr><th>Lớp / Zoom</th><th>Recording</th><th>Thời gian học</th><th>Link recording</th><th>Chỉnh sửa</th><th>Youtube</th><th>Đã duyệt</th></tr></thead><tbody>${rows.map(recordRow).join('')}</tbody></table></div>` : '<div class="section-empty">Không có recording trong mục này.</div>'}
  </section>`;
}

function renderSections() {
  if(state.rangeUnavailable){$('reviewSections').innerHTML='<div class="empty" role="alert">Chưa tải được dữ liệu cho khoảng ngày đã chọn. Hãy bấm Làm mới.</div>';return;}
  const newest = (a, b) => parseTimestamp(b.recordingStart || 0) - parseTimestamp(a.recordingStart || 0);
  const pending = state.records.filter((record) => !isApproved(record)).sort(newest);
  const approved = state.records.filter(isApproved).sort((a, b) => parseTimestamp(b.approvedAt || b.recordingStart || 0) - parseTimestamp(a.approvedAt || a.recordingStart || 0));
  $('reviewSections').innerHTML = renderSection('Cần duyệt',pending,false) + renderSection('Đã duyệt',approved,true);
}

function populateAccounts() {
  const current = $('accountFilter').value;
  const accounts = [...new Set([...(window.RECORDING_ACCOUNTS || []), ...state.records.map((record) => record.source), ...(nightlyState.snapshot?.accounts || []).map(item => item.account)].filter(Boolean))].sort((a, b) => Number(a.split(' ')[1])-Number(b.split(' ')[1]) || a.localeCompare(b, 'vi'));
  $('accountFilter').innerHTML = '<option value="">Tất cả</option>' + accounts.map((name) => `<option value="${escapeHtml(name)}" ${name === current ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function playlistOptions(select, query='', preferred='') {
  const selected=select.value || select.dataset.selected || preferred;
  if(selected)select.dataset.selected=selected;
  const results=recordingPublication.playlistResults(state.playlists,query);
  const retained=state.playlists.find(p=>p.id===selected);
  if(retained&&!results.some(p=>p.id===selected))results.unshift(retained);
  select.innerHTML='<option value="">Chọn playlist</option>'+results.map(p=>`<option value="${escapeHtml(p.id)}" data-title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</option>`).join('');
  select.value=selected||'';
}
function renderPlaylistOptions(query='') {
  const record=state.records.find(r=>String(r.id)===$('playlistRecordId').value);
  playlistOptions($('playlistSelect'),query,record?.playlistId||'');
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
  document.querySelector('.live').dataset.state = label === 'Đang làm mới' ? 'pending'
    : !ok || label === 'Dữ liệu đối soát chưa đầy đủ' ? 'attention' : 'success';
  $('liveLabel').textContent = label;
}

function toast(message, type = 'success', dialogFeedback) {
  const element = $('toast');
  element.textContent = message;
  element.className = `toast show ${type}`;
  if (type === 'error') window.recordingDialogFeedback?.error(dialogFeedback, message);
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
let dashboardController;
async function loadData(force = false) {
  if (state.loading && force !== true) return;
  const from=$('dateFilter').value,to=$('dateToFilter').value;
  if(from||to){try{recordingFilters.range(from,to);}catch(error){
    $('filterStatus').textContent=error.message==='REVERSED_DATE_RANGE'?'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.':error.message==='DATE_RANGE_TOO_LARGE'?'Mỗi lần xem tối đa 90 ngày. Hãy thu hẹp khoảng ngày.':'Hãy chọn ngày hợp lệ.';
    $('filterStatus').dataset.error='true';return;
  }}
  dashboardController?.abort(); dashboardController=new AbortController();
  const signal=dashboardController.signal;
  state.loading=true;const requestId=++dataRequestId,loadVersion=state.version;
  setConnection(true,'Đang làm mới');
  try {
    const [history,night]=await Promise.allSettled([
      (async()=>{const response=await fetch(DATA_API_URL,{cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.any([signal,AbortSignal.timeout(45000)])});
        if(!response.ok)throw Error('HISTORY_UNAVAILABLE');return response.json();})(),
      loadNightly(signal,force===true)
    ]);
    if(signal.aborted||requestId!==dataRequestId||loadVersion!==state.version)return;
    if(history.status==='rejected'&&night.status==='rejected')throw Error('DATA_UNAVAILABLE');
    const payload=history.status==='fulfilled'?history.value:null;
    state.historyUnavailable=!payload;
    const snapshot=night.status==='fulfilled'?night.value:null;
    if(!payload&&!snapshot)throw Error('DATA_UNAVAILABLE');
    state.rangeUnavailable=false;
    if(night.status==='rejected')nightlyState.error=true;
    const records=payload&&Array.isArray(payload.records)?payload.records:state.records.filter(r=>!r.nightly);
    state.records=mergeNightlyRecords(records,snapshot);
    state.yesterdayClasses=snapshot?(snapshot.records||[]).filter(r=>r.kind==='session').map(r=>({...r,zoomAccount:r.source,normalizedTime:true}))
      :(Array.isArray(payload?.yesterdayClasses)?payload.yesterdayClasses:[]);
    if(Array.isArray(payload?.playlists))state.playlists=payload.playlists;
    const date=snapshot?.date||payload?.yesterdayDate;
    if(!from&&!to&&date){$('dateFilter').value=date;$('dateToFilter').value=date;}
    const f=currentRecordingFilter();
    $('yesterdayDate').textContent=f.from===f.to?displayDate(f.from):displayDate(f.from)+' – '+displayDate(f.to);
    populateAccounts();renderFilteredView();
    if(payload?.generatedAt)$('updatedAt').textContent=`Cập nhật ${dateTime(payload.generatedAt)}`;
    const warnings=[];
    if(!payload)warnings.push('Chưa tải được lịch sử/playlist; đang hiển thị dữ liệu đối soát đọc được.');
    if(nightlyState.missingDates?.length)warnings.push('Chưa có snapshot: '+nightlyState.missingDates.map(displayDate).join(', ')+'.');
    if(nightlyState.failedDates?.length)warnings.push('Chưa đọc được: '+nightlyState.failedDates.map(displayDate).join(', ')+'.');
    if(incompleteNightlyData())warnings.push('Dữ liệu chưa đầy đủ; số có dấu ≥ là số tối thiểu đã đọc được.');
    $('filterStatus').textContent=warnings.join(' ')||'Số liệu và bảng recording theo bộ lọc hiện tại. Khoảng ngày tính cả hai ngày đầu/cuối, tối đa 90 ngày mỗi lần.';
    $('filterStatus').dataset.error=String(warnings.length>0);
    setConnection(true,incompleteNightlyData()||!payload?'Dữ liệu đối soát chưa đầy đủ':'Dữ liệu trực tiếp');
  } catch(error) {
    if(signal.aborted||requestId!==dataRequestId)return;
    state.rangeUnavailable=true;renderFilteredView();
    setConnection(false,'Mất kết nối');
    $('filterStatus').textContent='Chưa tải được dữ liệu. Hãy bấm Làm mới; dữ liệu đang hiển thị có thể là bản tải trước.';
    $('filterStatus').dataset.error='true';
  } finally {if(requestId===dataRequestId)state.loading=false;}
}
controls.filter(c=>!['dateFilter','dateToFilter'].includes(c.id)).forEach(control=>control.addEventListener('input',renderFilteredView));
for(const id of ['dateFilter','dateToFilter'])$(id).addEventListener('change',()=>{state.version++;loadData(true);});
$('refreshButton').addEventListener('click',()=>loadData(true));
$('resetFilters').addEventListener('click',()=>{for(const c of controls)c.value='';state.version++;loadData(true);});

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
    $('playlistSearch').value='';$('playlistSelect').dataset.selected=record.playlistId||'';$('playlistSelect').value='';renderPlaylistOptions();
    $('playlistDialog').dataset.version=record.version||0;
    $('playlistDialog').showModal();
    $('playlistSelect').focus();
  }
}
document.addEventListener('change',event=>{const select=event.target.closest('[data-edit-id]');if(!select)return;const action=select.value;select.value='';if(action==='refresh_file')return refreshKnownRecordingFile(select.dataset.editId,select);if(['rename','playlist'].includes(action))openVideoEditor(action,select.dataset.editId);});

$('renameForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const feedback = window.recordingDialogFeedback?.begin(event.currentTarget);
  const button = $('renameSubmit');
  button.disabled = true;
  button.textContent = 'Đang lưu…';
  try {
    const record = await postAction(RENAME_API_URL, { id: $('renameRecordId').value, expectedVersion:Number($('renameDialog').dataset.version), newTitle: $('renameTitle').value.trim() });
    replaceRecord(record);
    $('renameDialog').close();
    toast('Đã đổi tên video trên YouTube.');
  } catch {
    toast('Không đổi được tên video. Vui lòng thử lại.', 'error', feedback);
  } finally {
    button.disabled = false;
    button.textContent = 'Lưu tên';
    window.recordingDialogFeedback?.finish(feedback, button);
  }
});

$('playlistForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const feedback = window.recordingDialogFeedback?.begin(event.currentTarget);
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
    if(error.message.includes('VERSION_CONFLICT')){toast('Dữ liệu đã được người khác sửa. Hãy đóng hộp thoại, làm mới và mở lại để kiểm tra trước khi lưu.','error',feedback);return;}
    toast(moved?'Đã chuyển playlist nhưng chưa lưu được tên video. Hãy kiểm tra và lưu lại.':'Chưa lưu được thay đổi. Hãy làm mới dữ liệu và thử lại.','error',feedback);
  } finally {
    button.disabled=false;button.textContent='Chuyển playlist và đổi tên';
    window.recordingDialogFeedback?.finish(feedback, button);
  }
});

window.addEventListener('DOMContentLoaded',()=>{loadData();setInterval(loadData, REFRESH_MS);});


$('playlistSearch').addEventListener('input',()=>renderPlaylistOptions($('playlistSearch').value));
$('playlistSelect').addEventListener('change',()=>{$('playlistSelect').dataset.selected=$('playlistSelect').value;});
