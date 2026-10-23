// HTTP 200 chỉ xác nhận headers; chỉ dùng dữ liệu sau khi đã đọc và kiểm đủ JSON.
function responseError(message,{code,status,httpStatus,retryable=false,cause}={}){
  return Object.assign(new Error(message,{cause}),{code,status,httpStatus,retryable});
}

export async function readLearningResponse(response,{signal}={}){
  let payload;
  try{payload=await response.json();}
  catch(cause){
    if(signal?.aborted){
      const timedOut=signal.reason?.name==='TimeoutError';
      throw responseError(timedOut?'Đọc dữ liệu quá lâu. Đang thử lại.':'Lượt đọc dữ liệu đã dừng.',
        {code:timedOut?'READ_TIMEOUT':'READ_ABORTED',retryable:true,cause});
    }
    if(response.ok)throw responseError('Chưa nhận đủ phản hồi dữ liệu. Đang thử lại.',
      {code:cause?.name==='SyntaxError'?'INVALID_JSON':'INCOMPLETE_RESPONSE',httpStatus:response.status,retryable:true,cause});
    // HTTP lỗi vẫn giữ status, kể cả khi proxy trả HTML hoặc không có body JSON.
  }
  if(!response.ok||payload?.ok===false){
    const status=response.status;
    const message=status===401?'Phiên đăng nhập đã hết hạn; hãy đăng nhập lại.':
      payload?.message||(status===200?'Máy chủ chưa xác nhận yêu cầu. Hãy thử lại.':`Hệ thống trả về mã ${status}.`);
    throw responseError(message,{code:payload?.error||'API_ERROR',status,httpStatus:status,
      retryable:status===408||status===429||status>=500});
  }
  if(!payload||Array.isArray(payload)||typeof payload!=='object'||payload.ok!==true)
    throw responseError('Phản hồi dữ liệu chưa đúng định dạng. Đang thử lại.',
      {code:'INVALID_RESPONSE',httpStatus:response.status,retryable:true});
  return payload;
}
