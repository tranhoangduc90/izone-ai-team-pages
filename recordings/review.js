/* Xác nhận kiểm tra độc lập với đăng video. Không giữ token hoặc quyết định ở localStorage. */
const recordingReviewPending=new Map();
function recordingReviewTarget(row){
 const snapshot=nightlyState.snapshot;
 const source=snapshot?.records?.find(r=>r.kind==='recording'&&(r.id===row.id||(r.source===row.source&&r.recordingFileId&&r.recordingFileId===row.recordingFileId)));
 return {row,source:source||row,date:source?snapshot.date:localDate(row.recordingStart)};
}
async function readRecordingReviews(rows){
 if(!window.recordingAuth?.isAuthenticated())return [];
 const groups=new Map();
 for(const row of rows){if(row.kind==='session')continue;const t=recordingReviewTarget(row);if(!t.date)continue;if(!groups.has(t.date))groups.set(t.date,[]);groups.get(t.date).push(t);}
 const results=[];
 for(const [date,targets]of groups)for(let i=0;i<targets.length;i+=150){
  const batch=targets.slice(i,i+150),response=await recordingAuth.request({action:'review_read',date,ids:[...new Set(batch.map(t=>t.source.id))]});
  const body=await response.json();if(!response.ok||body.ok!==true)throw Error(body.error||'REVIEW_READ_FAILED');
  for(const review of body.reviews||[]){for(const t of batch.filter(t=>t.source.id===review.id))results.push({...review,id:t.row.id});}
 }
 return results;
}
function recordingReviewAttributes(row){
 const pending=recordingReviewPending.get(row.id);
 return `${pending!==undefined?'disabled':''} ${pending!==undefined?pending?'checked':'':isApproved(row)?'checked':''}`;
}
function recordingReviewMetadata(row){
 const source=recordingReviewTarget(row).source;
 return row.reviewMetadata||{title:source.title||source.proposedTitle||'',className:source.className||''};
}
function applyRecordingReview(actual,id){
 const current=state.records.find(r=>r.id===id);if(!current||!actual)return false;
 const metadata=recordingReviewMetadata(current);
 if(actual.reviewMetadata?.title!==metadata.title||actual.reviewMetadata?.className!==metadata.className)return false;
 Object.assign(current,{reviewStatus:actual.reviewStatus,approvedAt:actual.approvedAt,reviewVersion:actual.reviewVersion});return true;
}
document.addEventListener('change',async event=>{
 const checkbox=event.target.closest('input[data-action="review"],input[data-action="nightly-review"]');if(!checkbox)return;
 const row=state.records.find(r=>String(r.id)===checkbox.dataset.id);if(!row)return;
 const approved=checkbox.checked;
 if(!recordingAuth?.isAuthenticated()){checkbox.checked=isApproved(row);toast('Vui lòng đăng nhập để xác nhận đã kiểm tra.','error');return;}
 if(recordingReviewPending.has(row.id))return;
 const t=recordingReviewTarget(row),requestId=crypto.randomUUID().replaceAll('-','');let reload=false;
 recordingReviewPending.set(row.id,approved);checkbox.disabled=true;
 try{
  const response=await recordingAuth.request({action:'acknowledge_review',date:t.date,id:t.source.id,expectedVersion:Number(t.source.version||0),expectedReviewVersion:Number(row.reviewVersion||0),expectedMetadata:recordingReviewMetadata(row),approved,requestId});
  const result=await response.json();if(!response.ok||result.ok!==true||!result.record)throw Error(result.error||'REVIEW_SAVE_UNKNOWN');
  const actual=(await readRecordingReviews([row])).find(r=>r.id===row.id);
  if(!actual||actual.reviewStatus!==(approved?'approved':'pending'))throw Error('REVIEW_READBACK_PENDING');
  if(!applyRecordingReview(actual,row.id))throw Error('REVIEW_METADATA_CONFLICT');
  toast(approved?'Đã xác nhận kiểm tra. Lý do/lỗi được giữ nguyên.':'Đã chuyển về Cần duyệt.');
 }catch(error){
  // Mất phản hồi chưa chứng minh lệnh thất bại: chỉ đọc lại, không gửi thêm lệnh duyệt.
  let readback;try{readback=(await readRecordingReviews([row])).find(r=>r.id===row.id);}catch{}
  const applied=applyRecordingReview(readback,row.id);reload=/CONFLICT/.test(error.message)||Boolean(readback&&!applied);
  if(!reload&&applied&&readback.reviewStatus===(approved?'approved':'pending'))toast(approved?'Đã xác nhận kiểm tra.':'Đã chuyển về Cần duyệt.');
  else toast(reload?'Trạng thái đã thay đổi. Đang làm mới; vui lòng kiểm tra rồi bấm lại.':/AUTH/.test(error.message)?'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':'Chưa xác nhận lưu được trạng thái duyệt. Hãy làm mới trước khi thử lại.','error');
 }finally{
  recordingReviewPending.delete(row.id);state.version++;renderStats();renderSections();
  if(reload)await loadData(true);
 }
});
document.addEventListener('recording-auth-changed',()=>{if(recordingAuth.isAuthenticated())loadData(true);});
