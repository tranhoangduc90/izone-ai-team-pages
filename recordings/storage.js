/* Lưu trữ VPS: trạng thái do backend đọc lại, trình duyệt không quyết định file/quyền. */
(() => {
  const panel=document.getElementById('recordingStorage');if(!panel)return;
  const status=document.getElementById('storageStatus'),rows=document.getElementById('storageRows');
  const summary=document.getElementById('storageSummary'),preview=document.getElementById('storagePreview');
  const clean=document.getElementById('storageCleanup'),detail=document.getElementById('storageRunResult');
  let previewId='',expiresAt=0,timer,epoch=0,busy=false;
  const reasons={ELIGIBLE:'Đủ điều kiện dọn',RETENTION_ACTIVE:'Giữ MP4 dự phòng 24 giờ',KEEP_RECOVERY_PARTS:'Giữ khối phục hồi',
    KEEP_RECOVERY:'Giữ để phục hồi hoặc chờ duyệt',UNVERIFIED_DESTINATION:'Chưa xác minh đích',DESTINATION_UNAVAILABLE:'Chưa đọc được đích',
    UNVERIFIED_YOUTUBE:'Chưa xác minh YouTube',UNVERIFIED_DASHBOARD:'Chưa xác minh dashboard',TASK_UNKNOWN:'Chưa nối được tác vụ',
    COMPLETION_TIME_UNKNOWN:'Chưa xác định thời điểm hoàn tất',UNSAFE_FILE:'File cần kiểm tra riêng',FILE_INVALID:'File lỗi — giữ để kiểm tra',SOURCE_SIZE_UNKNOWN:'Chưa xác minh kích thước nguồn',SOURCE_SIZE_MISMATCH:'Kích thước nguồn không khớp — giữ để kiểm tra',
    NOT_CHECKED_THIS_RUN:'Chưa đối soát trong lượt này',KEEP_ORIGINAL:'Giữ bản gốc',NO_FILES:'Không còn file trên VPS',RECORDING_DATE_CONFLICT:'Ngày recording mâu thuẫn — giữ để kiểm tra'};
  const errors={AUTH_REQUIRED:'Vui lòng đăng nhập để kiểm tra lưu trữ.',AUTH_FORBIDDEN:'Bạn chưa có quyền xem lưu trữ.',CLEANUP_FORBIDDEN:'Bạn chưa có quyền dọn file.',
    CLEANUP_DISABLED:'Chức năng dọn đang tắt; cần kiểm chứng khóa và cấp quyền trước.',STORAGE_BUSY:'Đang có lượt xử lý khác. Hãy kiểm tra lại sau.',
    PREVIEW_EXPIRED:'Danh sách xem trước đã hết hạn. Hãy xem trước lại.',PREVIEW_INVALID:'Danh sách xem trước không hợp lệ.',
    MOUNT_CHANGED:'Không xác minh được thư mục VPS. Chưa xác minh trạng thái file.',STORAGE_UNAVAILABLE:'Chưa kết nối được dịch vụ lưu trữ.'};
  function bytes(n){return Number.isFinite(n)?(n/1024**3).toFixed(2)+' GiB':'Chưa xác minh';}
  function time(v){return v?new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';}
  function message(text,error=false){status.textContent=text;status.classList.toggle('storage-error',error);}
  function invalidate(){previewId='';expiresAt=0;clean.disabled=true;preview.replaceChildren();}
  function uncertain(){summary.textContent='Chưa xác minh tình trạng hiện tại trên VPS.';rows.replaceChildren(tableRow(['Chưa xác minh','Chưa xác minh','—','—','Kiểm tra lại kết nối hoặc quyền','—','—']));}
  async function request(body){
    if(!window.recordingAuth?.isAuthenticated())throw Error('AUTH_REQUIRED');
    const generation=epoch,response=await window.recordingAuth.request(body);
    const data=await response.json();
    if(generation!==epoch)throw Error('AUTH_SESSION_CHANGED');
    if(!response.ok||data.ok!==true)throw Error(data.errorCode||'STORAGE_UNAVAILABLE');
    return data;
  }
  function tableRow(values){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}return tr;}
  function render(data){
    summary.textContent=`Ổ còn trống: ${bytes(data.diskFreeBytes)} · Recording đang giữ: ${bytes(data.recordingBytes)} · Đủ điều kiện dọn: ${bytes(data.eligibleBytes)} · Đo lúc ${time(data.checkedAt)}`;
    rows.replaceChildren();
    for(const row of data.rows||[]){
      rows.append(tableRow([row.recordId,row.mp4Status==='present'?'Còn lưu':row.mp4Status==='deleted'?'Đã xóa, đã xác minh':'Không có trên VPS',
        row.partCount+' khối',bytes(row.bytes),reasons[row.reason]||'Chưa xác minh',time(row.retainUntil),time(row.checkedAt)]));
    }
    if(!data.rows?.length)rows.append(tableRow(['Không tìm thấy file recording trong lần kiểm này.']));
  }
  async function perform(action){
    if(busy)return;busy=true;
    try{await action();}catch(error){invalidate();uncertain();message(errors[error.message]||'Chưa xác minh kết quả. Hãy kiểm tra lại kết nối hoặc quyền truy cập.',true);}
    finally{busy=false;}
  }
  async function waitRead(job){
    const generation=epoch;
    while(generation===epoch){
      const data=await request({action:'storage_run',runId:job.runId}),run=data.run;
      if(run.status==='verified')return run.result;
      if(run.status!=='running')throw Error(run.errorCode||'STORAGE_UNAVAILABLE');
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
    throw Error('AUTH_SESSION_CHANGED');
  }
  document.getElementById('storageRefresh').addEventListener('click',()=>perform(async()=>{
    invalidate();message('Đang kiểm tra file trên VPS và đối soát trạng thái đích…');
    const data=await waitRead(await request({action:'storage_read',refresh:true}));render(data);message('Đã đọc lại file trên VPS; mỗi lượt đối soát tối đa 20 recording.');
  }));
  document.getElementById('storagePreviewButton').addEventListener('click',()=>perform(async()=>{
    invalidate();message('Đang lập danh sách dọn…');
    const data=await waitRead(await request({action:'storage_preview'}));previewId=data.previewId;expiresAt=data.expiresAt;
    const title=document.createElement('p');title.textContent=`Dự kiến thu hồi ${bytes(data.eligibleBytes)}. Danh sách có hiệu lực đến ${time(expiresAt)}.`;preview.append(title);
    const list=document.createElement('ul');
    for(const row of data.rows||[]){const li=document.createElement('li');li.textContent=`${row.recordId}: ${reasons[row.reason]||'Chưa xác minh'} · ${row.fileCount} file · ${bytes(row.eligibleBytes)}`;
      if(row.files?.length){const more=document.createElement('details'),label=document.createElement('summary');label.textContent='Xem đúng các file sẽ dọn';more.append(label);
        const names=document.createElement('ul');for(const file of row.files){const item=document.createElement('li');item.textContent=`${file.name} · ${file.kind==='mp4'?'MP4':'Khối tải'} · ${bytes(file.bytes)}`;names.append(item);}more.append(names);li.append(more);}list.append(li);}
    preview.append(list);clean.disabled=!(data.eligibleBytes>0&&data.canCleanup===true);message(data.canCleanup===true?'Đã lập bản xem trước. Trạng thái sẽ được kiểm tra lại ngay trước khi xóa.':'Đã lập bản xem trước. Chức năng dọn đang tắt hoặc tài khoản chỉ có quyền xem.');
  }));
  async function poll(runId,generation){
    if(generation!==epoch)return;
    try{
      const data=await request({action:'storage_run',runId}),run=data.run;
      detail.textContent=`Lượt ${run.runId}: ${run.status==='running'?'Đang dọn':run.status==='verified'?'Đã dọn và xác minh':run.status==='partial'?'Dọn một phần — cần kiểm tra phần còn lại':'Chưa xác minh'} · File thu hồi: ${bytes(run.deletedBytes)} · Thay đổi dung lượng ổ trống: ${bytes(Number.isFinite(run.diskFreeAfter)?run.diskFreeAfter-run.diskFreeBefore:NaN)}`;
      if(run.status==='running'){timer=setTimeout(()=>poll(runId,generation),3000);return;}
      render(await request({action:'storage_read'}));message(run.status==='verified'?'Đã kiểm tra kết quả dọn trên VPS.':'Có kết quả cần kiểm tra trong lịch sử.',run.status!=='verified');
    }catch(error){invalidate();uncertain();message(errors[error.message]||'Mất kết nối khi theo dõi. Kết quả chưa xác minh; mở lịch sử để kiểm tra, không bấm dọn lại.',true);}
  }
  clean.addEventListener('click',()=>perform(async()=>{
    if(!previewId||Date.now()>=expiresAt)throw Error('PREVIEW_EXPIRED');
    if(!window.confirm('Xóa các file đủ điều kiện trong danh sách đã xem? File trên VPS không thể phục hồi bằng việc quay lại phiên bản phần mềm.'))return;
    const selected=previewId;invalidate();message('Đang gửi yêu cầu dọn…');
    const data=await request({action:'storage_cleanup',previewId:selected});await poll(data.runId,epoch);
  }));
  document.getElementById('storageHistory').addEventListener('click',()=>perform(async()=>{
    const data=await request({action:'storage_history'});detail.replaceChildren();
    for(const run of data.runs){
      const item=document.createElement('details'),heading=document.createElement('summary');
      heading.textContent=`${time(run.startedAt)} · ${run.kind?'Kiểm tra/xem trước': 'Dọn file'} · ${run.status==='verified'?'Đã xác minh':run.status==='running'?'Đang xử lý':'Cần kiểm tra'} · ${bytes(run.deletedBytes)}`;item.append(heading);
      for(const result of run.results||[]){const text=document.createElement('p');text.textContent=`${result.recordId} · ${result.status==='verified'?'Đã kiểm tra lại':result.status==='already_absent'?'File vốn không tồn tại':'Giữ hoặc cần kiểm tra'} · ${bytes(result.deletedBytes)} · Kiểm lúc ${time(run.finishedAt)}`;item.append(text);
        for(const file of result.files||[]){const line=document.createElement('p');line.textContent=`${file.name}: ${file.status==='deleted_verified'?'Đã xóa, đã xác minh':file.status==='already_absent'?'Không có trên VPS':'Chưa xác minh'} · ${bytes(file.bytes)}`;item.append(line);}}
      detail.append(item);
    }
    if(!data.runs.length)detail.textContent='Chưa có lượt dọn nào.';
  }));
  document.addEventListener('recording-auth-changed',()=>{
    epoch++;clearTimeout(timer);invalidate();rows.replaceChildren();summary.textContent='Chưa có lần đo trong phiên này.';detail.replaceChildren();
    message(window.recordingAuth?.isAuthenticated()?'Chọn Kiểm tra lại để đọc tình trạng trên VPS.':'Đăng nhập để kiểm tra lưu trữ VPS.');
  });
})();
