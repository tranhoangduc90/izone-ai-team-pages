// Nhận request L/R và state của đúng lượt; chỉ chuyển bước khi đã có xác nhận hợp lệ.
// Khi mất phản hồi, đọc biên nhận không ghi dữ liệu. Gói chưa rõ kết quả giữ nguyên qua reload/retry.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const canonical=value=>JSON.stringify(Object.fromEntries(Object.entries(value||{}).sort(([a],[b])=>a.localeCompare(b))));
const failure=()=>Object.assign(new Error('Chưa nhận được xác nhận lưu bài hợp lệ. Bản đã gửi vẫn được giữ; hãy thử kiểm tra và nộp lại.'),{code:'SUBMISSION_UNCONFIRMED'});
export function validateSubmission(data,{section,body,testSlug}){
  if(!data||data.ok!==true||!uuid(data.attemptToken)||typeof data.completed!=='boolean')throw failure();
  if(body.attemptToken&&data.attemptToken!==body.attemptToken)throw failure();
  if(data.testSlug&&data.testSlug!==testSlug)throw failure();
  if(data.examSessionToken&&body.examSessionToken&&data.examSessionToken!==body.examSessionToken)throw failure();
  if(data.generation!==undefined&&body.generation!==undefined&&data.generation!==body.generation)throw failure();
  if(section==='reading'&&data.completed!==true&&!(data.examMode==='read_first'&&data.readingSubmitted===true))throw failure();
  if(section==='listening'&&data.listeningSubmitted===false)throw failure();
  return data;
}
function receiptData(status,input){
  const r=status?.receipt;
  if(status?.ok!==true||status.persisted!==true||!r||r.version!==1||r.section!==input.section||r.testSlug!==input.testSlug
    ||!r.submittedAt||!Number.isFinite(Date.parse(r.submittedAt))||!uuid(r.attemptToken)
    ||(input.body.examSessionToken&&r.examSessionToken!==input.body.examSessionToken)
    ||(input.body.attemptToken&&r.attemptToken!==input.body.attemptToken)
    ||(input.body.clientSubmissionId&&r.clientSubmissionId!==input.body.clientSubmissionId)
    ||(input.body.generation!==undefined&&r.generation!==input.body.generation)
    ||canonical(r.answers)!==canonical(input.body.answers))throw failure();
  return validateSubmission(status.response,input);
}
export async function submitSection({state,section,body,testSlug,owner,getOwner,save,send,read}){
  state.pendingSubmissions ||= {};
  let previous=state.pendingSubmissions[section];
  if(previous&&previous.owner!==owner)throw Object.assign(failure(),{code:'SUBMISSION_OWNER_CHANGED'});
  // Quyền audio luôn lấy từ request hiện tại; bản lưu chỉ giữ payload nộp, không giữ bằng chứng quyền cũ.
  if(previous)body={...body,...previous.body};
  const input={section,body,testSlug};
  const checkOwner=()=>{if(getOwner()!==owner)throw Object.assign(failure(),{code:'SUBMISSION_OWNER_CHANGED'});};
  const accept=data=>{checkOwner();delete state.pendingSubmissions[section];save();return data;};
  if(previous){
    const status=await read(body);checkOwner();
    if(status?.persisted===true)return accept(receiptData(status,input));
    if(status?.ok!==true||status.persisted!==false)throw failure();
  }else{
    const stored={...body};for(const key of ['ownerId','ownerProof','ownerEpoch','audioOwnerId'])delete stored[key];
    state.pendingSubmissions[section]={owner,body:stored,answers:{...body.answers}};save();
  }
  try{return accept(validateSubmission(await send(body),input));}
  catch(error){
    checkOwner();
    try{
      const status=await read(body);checkOwner();
      if(status?.persisted===true)return accept(receiptData(status,input));
      // HTTP lỗi đã kết thúc + đọc thấy chưa lưu: cho sửa bài theo deadline. Lỗi truyền tải vẫn giữ snapshot.
      if(status?.ok===true&&status.persisted===false&&Number(error.status)>=400){delete state.pendingSubmissions[section];save();}
    }catch(readError){if(readError.code==='SUBMISSION_OWNER_CHANGED')throw readError;}
    if(state.pendingSubmissions[section])throw failure();
    throw error;
  }
}
