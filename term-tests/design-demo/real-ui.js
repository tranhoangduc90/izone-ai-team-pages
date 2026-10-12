// Nhãn trạng thái demo và khóa bài gốc; không đổi câu trả lời/điểm mà renderer nhận.
(()=>{
 const ctx=window.REAL_DEMO,saved=ctx.mode==='saved',tools=ctx.toolsEnabled;
 let audioBox=null;
 const label=document.createElement('div');label.className='design-preview-label';label.textContent=saved?'BÀI THẬT · Chỉ đọc · Mọi màu chỉ áp dụng demo':'ĐỀ THẬT · Làm thử riêng · Không gửi bài vào hệ thống';document.body.append(label);
 function apply(){
  // Renderer có thể dựng lại vùng câu hỏi; đặt audio vào toolbar Listening mà không tạo player mới.
  const audioHost=document.querySelector('#listeningView .cbt-toolbar');
  if(audioBox&&audioHost&&audioBox.parentElement!==audioHost)audioHost.append(audioBox);
  const classLabel=document.getElementById('classLabel');if(classLabel&&classLabel.textContent!=='Lớp IC2200 · Demo')classLabel.textContent='Lớp IC2200 · Demo';
  if(saved){for(const timer of document.querySelectorAll('[role=timer]'))timer.hidden=true;}
  if(!saved){
   const h=document.querySelector('.writing-result-heading h3');if(h&&h.textContent!=='Bài Writing thử · chưa chấm AI')h.textContent='Bài Writing thử · chưa chấm AI';
   for(const n of document.querySelectorAll('.writing-result-heading p')){const text=(tools?'Bài thử được giữ riêng trong tab. Chọn bài thật để xem nhận xét đã chấm.':'Bài Writing thử chỉ giữ trong tab, không gửi chấm AI.');if(n.textContent!==text)n.textContent=text;}
  }
  for(const n of document.querySelectorAll('.notice,.writing-grading-status')){
   if(!saved&&(/Portal|đang.*chấm|cần.*kiểm tra|đang.*kiểm tra|đang chờ|quay lại sau|chấm và phân tích đầy đủ/i.test(n.textContent))){const text=(tools?'Bản thử riêng — chưa chấm AI. Chọn “Bài thật + chấm thật” trong Điều hướng demo để xem nhận xét đã lưu.':'Bản thử riêng — không gửi bài vào hệ thống và không chấm AI.');if(n.textContent!==text)n.textContent=text;}
  }

  if(!saved){
   const resultStatus=document.getElementById('resultStatus');
   const resultCopy='Listening và Reading là kết quả chấm thử; Writing không gửi chấm AI. Bài thử chỉ giữ trong tab này.';
   if(resultStatus&&ctx.trial.result&&resultStatus.textContent!==resultCopy)resultStatus.textContent=resultCopy;
   // Bản thử ở RAM: không hứa lưu server hoặc khôi phục sau đóng/tải lại tab.
   for(const n of document.querySelectorAll('#listeningSavedView p'))if(n.textContent.includes('Hệ thống đã ghi bài Listening.'))n.textContent='Bài Listening thử được giữ trong tab này. Khi sẵn sàng, mở Reading để tiếp tục.';
   for(const n of document.querySelectorAll('#writingPrepView li'))if(n.textContent.includes('đóng tab rồi mở lại'))n.textContent='Bài viết chỉ giữ trong tab này. Tải lại hoặc đóng tab sẽ bắt đầu bản thử mới.';
   for(const n of document.querySelectorAll('#listeningSaveStatus,#readingSaveStatus,.writing-outline-status')){
    const text=n.textContent.replace('Đã khôi phục bản lưu trên hệ thống','Đã mở bản thử trong tab').replace('Đã lưu trên hệ thống','Đã giữ trong tab này').replace('Đã lưu trên máy','Đã giữ trong tab này');
    if(text!==n.textContent)n.textContent=text;
   }
  }
  if(saved){
   for(const field of document.querySelectorAll('#app [data-writing-task],#app .question input,#app .question select,#app .cbt-choice input,#app .cbt-inline-answer input,#app .cbt-select-answer select')){if(field.tagName==='TEXTAREA'||field.type==='text')field.readOnly=true;else field.disabled=true;}
   for(const button of document.querySelectorAll('#submitListening,#submitReading,#submitWriting,.cbt-heading-submit')){button.disabled=true;button.title='Bài học viên chỉ để xem';}
  }
  for(const field of document.querySelectorAll('.writing-editor-meta>span:first-child')){const text=saved?'Bài gốc · chỉ đọc':'Bản thử · chỉ lưu trong tab này';if(field.textContent!==text)field.textContent=text;}
 }
 new MutationObserver(apply).observe(document.getElementById('app'),{subtree:true,childList:true});apply();
 if(ctx.screen==='listening'){
  const box=document.createElement('section');box.className='real-audio';const button=document.createElement('button');button.type='button';button.textContent='Tải audio đề thật';const audio=document.createElement('audio');audio.controls=true;audio.hidden=true;const status=document.createElement('span');status.setAttribute('role','status');box.setAttribute('aria-label','Audio của Term Test 2');box.append(button,audio,status);audioBox=box;apply();
  const loadAudio=async()=>{button.disabled=true;status.textContent='Đang tải audio…';try{audio.src=await ctx.audio();audio.volume=Number(ctx.trial.audioVolume)||1;audio.hidden=false;button.hidden=true;status.textContent='Audio của Term Test 2';}catch(e){button.disabled=false;status.textContent=e.message;}};
  button.addEventListener('click',loadAudio);if(ctx.trial.audioPrepared)loadAudio();
 }
 if(!saved&&ctx.screen==='result'&&!ctx.trial.result){
  const note=document.createElement('div');note.className='real-trial-empty';note.textContent=(tools?'Bản thử chưa có điểm Listening / Reading. Bạn có thể làm bài rồi nộp thử, hoặc chuyển sang bài thật đã chấm.':'Bản thử chưa có điểm Listening / Reading. Hãy làm bài rồi nộp thử để xem kết quả.');document.body.prepend(note);
 }
})();
