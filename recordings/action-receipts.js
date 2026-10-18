/* Mỗi yêu cầu có biên nhận riêng; không lưu token hoặc tự gửi lại lệnh upload. */
(() => {
  const rejected=error=>/VERSION_CONFLICT|INVALID_|AUTH_|FILE_|VIDEO_|DURATION_|RECORD_BUSY|PUBLISHED_GROUP|SCAN_BUSY|PLAYLIST_|RECORDING_EXCLUDED|CONTENT_CONFIRMATION_REQUIRED|QUEUE_INCONSISTENT|ACCOUNT_NOT_ENABLED_FOR_DATE|REQUEST_ID_CONFLICT/.test(error.message);
  async function read(body, timeout=30000) {
    let timer;
    try {
      return await Promise.race([
        (async()=>{const response=await window.recordingAuth.request(body);const data=await response.json();
          if(!response.ok||!data.ok)throw Error(data.error||'ACTION_FAILED');return data;})(),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('ACTION_RECEIPT_UNKNOWN')),timeout);})
      ]);
    } finally {clearTimeout(timer);}
  }
  async function submit(input) {
    const body={...input,requestId:input.requestId||crypto.randomUUID()};
    try {return await read(body);}
    catch(error) {
      if(input.action!=='confirm_publish'||rejected(error))throw error;
      // Chỉ đọc biên nhận. Không POST lại confirm_publish khi mất phản hồi.
      try {const receipt=await read({action:'publish_status',date:body.date,id:body.id,requestId:body.requestId},10000);
        if(receipt.accepted)return receipt;
      }catch{}
      throw Error('ACTION_RECEIPT_UNKNOWN');
    }
  }
  window.recordingRequests={submit,rejected};
})();
