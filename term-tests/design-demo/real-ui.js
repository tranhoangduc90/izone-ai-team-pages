// Nhãn trạng thái demo và khóa bài gốc; không đổi câu trả lời/điểm mà renderer nhận.
(()=>{
 const ctx=window.REAL_DEMO,saved=ctx.mode==='saved';
 const label=document.createElement('div');label.className='design-preview-label';label.textContent=saved?'BÀI THẬT · Chỉ đọc · Mọi màu chỉ áp dụng demo':'ĐỀ THẬT · Làm thử riêng · Không gửi bài vào hệ thống';document.body.append(label);
 function apply(){
  const classLabel=document.getElementById('classLabel');if(classLabel&&classLabel.textContent!=='Lớp IC2200 · Demo')classLabel.textContent='Lớp IC2200 · Demo';
  if(saved){for(const timer of document.querySelectorAll('[role=timer]'))timer.hidden=true;}
  if(!saved){
   const h=document.querySelector('.writing-result-heading h3');if(h&&h.textContent!=='Bài Writing thử · chưa chấm AI')h.textContent='Bài Writing thử · chưa chấm AI';
   for(const n of document.querySelectorAll('.writing-result-heading p')){const text='Bài thử được giữ riêng trong tab. Chọn bài thật để xem nhận xét đã chấm.';if(n.textContent!==text)n.textContent=text;}
  }
  for(const n of document.querySelectorAll('.notice,.writing-grading-status')){
   if(!saved&&(/Portal|đang.*chấm|cần.*kiểm tra|chấm và phân tích đầy đủ/i.test(n.textContent))){const text='Bản thử riêng — chưa chấm AI. Chọn “Bài thật + chấm thật” ở phía trên để xem nhận xét đã lưu.';if(n.textContent!==text)n.textContent=text;}
  }
  if(saved){
   for(const field of document.querySelectorAll('#app [data-writing-task],#app .question input,#app .question select,#app .cbt-choice input,#app .cbt-inline-answer input,#app .cbt-select-answer select')){if(field.tagName==='TEXTAREA'||field.type==='text')field.readOnly=true;else field.disabled=true;}
   for(const button of document.querySelectorAll('#submitListening,#submitReading,#submitWriting,.cbt-heading-submit')){button.disabled=true;button.title='Bài học viên chỉ để xem';}
  }
  for(const field of document.querySelectorAll('.writing-editor-meta>span:first-child')){const text=saved?'Bài gốc · chỉ đọc':'Bản thử · chỉ lưu trong tab này';if(field.textContent!==text)field.textContent=text;}
 }
 new MutationObserver(apply).observe(document.getElementById('app'),{subtree:true,childList:true});apply();
 if(ctx.screen==='listening'){
  const box=document.createElement('section');box.className='real-audio';const button=document.createElement('button');button.type='button';button.textContent='Tải audio đề thật';const audio=document.createElement('audio');audio.controls=true;audio.hidden=true;const status=document.createElement('span');status.setAttribute('role','status');box.append(button,audio,status);document.body.prepend(box);
  const loadAudio=async()=>{button.disabled=true;status.textContent='Đang tải audio…';try{audio.src=await ctx.audio();audio.volume=Number(ctx.trial.audioVolume)||1;audio.hidden=false;button.hidden=true;status.textContent='Audio của Term Test 2';}catch(e){button.disabled=false;status.textContent=e.message;}};
  button.addEventListener('click',loadAudio);if(ctx.trial.audioPrepared)loadAudio();
 }
 if(!saved&&ctx.screen==='result'&&!ctx.trial.result){
  const note=document.createElement('div');note.className='real-trial-empty';note.textContent='Bản thử chưa có điểm Listening / Reading. Bạn có thể làm bài rồi nộp thử, hoặc chuyển sang bài thật đã chấm.';document.body.prepend(note);
 }
})();
