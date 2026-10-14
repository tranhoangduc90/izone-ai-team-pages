// Phòng chờ dùng audio thật qua cầu nối demo; không mở phiên thi hay ghi bài học viên.
// Nghe thử chỉ phát 30 giây đầu, giữ âm lượng trong RAM và dừng khi rời màn.
(()=>{
 const ctx=window.REAL_DEMO,root=document.getElementById('app');
 document.body.classList.add('design67','cbt-mode');
 root.innerHTML=`<main class="demo-lobby-shell">
  <section class="demo-lobby-card" aria-labelledby="lobby-title">
   <header class="demo-lobby-header">
    <span class="demo-lobby-badge">Phòng chờ Listening</span>
    <h1 id="lobby-title">Sẵn sàng nghe, tự tin bắt đầu.</h1>
    <p>Kiểm tra tai nghe và âm lượng trước khi mở câu hỏi.</p>
   </header>
   <div class="demo-lobby-meta"><strong>Term Test 2 · IC2200</strong><span>40 câu hỏi · 4 phần</span></div>
   <div class="demo-lobby-steps">
    <section class="demo-lobby-step" id="lobby-download-step" data-state="active">
     <span class="demo-lobby-number">01</span><h2>Tải audio đề thật</h2>
     <p>Tải trước để bản nghe thử không bị gián đoạn vì chờ mạng.</p>
     <p id="lobby-download-status" class="demo-lobby-status" role="status">Đang tải audio…</p>
     <button id="lobby-retry" class="button button-secondary" type="button" hidden>Thử tải lại</button>
    </section>
    <section class="demo-lobby-step" id="lobby-preview-step" data-state="locked">
     <span class="demo-lobby-number">02</span><h2>Kiểm tra âm thanh</h2>
     <p>Nghe thử tối đa 30 giây đầu. Nếu chưa rõ, chỉnh âm lượng rồi nghe lại.</p>
     <button id="lobby-preview" class="button button-secondary" type="button" disabled>Nghe thử 30 giây</button>
     <label class="demo-lobby-volume" for="lobby-volume">Âm lượng <output id="lobby-volume-value">100%</output></label>
     <input id="lobby-volume" type="range" min="0.1" max="1" step="0.1" value="1" disabled>
     <p id="lobby-preview-status" class="demo-lobby-status" role="status">Chờ tải audio xong.</p>
    </section>
    <section class="demo-lobby-step" id="lobby-start-step" data-state="locked">
     <span class="demo-lobby-number">03</span><h2>Mở bài Listening</h2>
     <p id="lobby-start-status">Nghe thử trước. Khi âm thanh rõ, bạn có thể bắt đầu.</p>
     <button id="lobby-start" class="button button-primary" type="button" disabled>Bắt đầu làm thử Listening →</button>
    </section>
   </div>
   <p class="demo-lobby-note">Bản thử giao diện · không tạo lượt thi, không ghi điểm học viên. Audio chính có nút phát riêng trong màn làm bài.</p>
  </section>
 </main>`;
 if(ctx.toolsEnabled===false)root.querySelector('.demo-lobby-note').textContent='Bản thử giao diện · không tạo lượt thi, không ghi điểm học viên. Audio tự chạy khi bắt đầu; không tạm dừng hoặc nghe lại trong bài.';
 const el=Object.fromEntries(['download-step','download-status','retry','preview-step','preview','volume','volume-value','preview-status','start-step','start-status','start'].map(id=>[id,document.getElementById('lobby-'+id)]));
 const audio=document.createElement('audio');audio.hidden=true;document.body.append(audio);
 let disposed=false,loading=false,ready=false,heard=false,playing=false,stopTimer=0;
 const volume=Number(ctx.trial.audioVolume)||1;
 el.volume.value=String(volume);audio.volume=volume;el['volume-value'].textContent=Math.round(volume*100)+'%';
 if(ctx.mode==='saved'){
  el.start.textContent='Xem bài Listening đã làm →';
  el['start-status'].textContent='Nghe thử để kiểm tra âm thanh, rồi mở đáp án gốc của bài đang chọn.';
 }
 function stopPreview(){
  clearTimeout(stopTimer);audio.pause();playing=false;
  el.preview.textContent=heard?'Nghe lại 30 giây':'Nghe thử 30 giây';
 }
 function finishPreview(){stopPreview();el['preview-status'].textContent='Đã dừng bản nghe thử. Nếu nghe rõ, bạn có thể mở bài.';}
 async function prepare(){
  if(loading||disposed)return;loading=true;ready=false;heard=false;
  stopPreview();el.retry.hidden=true;el.preview.disabled=true;el.volume.disabled=true;el.start.disabled=true;
  el['download-step'].dataset.state='active';el['preview-step'].dataset.state='locked';el['start-step'].dataset.state='locked';
  el['download-status'].textContent='Đang tải audio…';el['preview-status'].textContent='Chờ tải audio xong.';
  try{
   const url=await ctx.audio();if(disposed)return;
   audio.src=url;ready=true;el['download-step'].dataset.state='complete';el['preview-step'].dataset.state='active';
   el['download-status'].textContent='Đã tải audio đề thật';el['preview-status'].textContent='Nhấn Nghe thử để kiểm tra tai nghe.';
   el.preview.disabled=false;el.volume.disabled=false;
  }catch(error){if(disposed)return;el['download-step'].dataset.state='error';el['download-status'].textContent='Chưa tải được audio. Kiểm tra mạng rồi thử lại.';el.retry.hidden=false;}
  finally{loading=false;}
 }
 el.preview.addEventListener('click',async()=>{
  if(!ready||disposed)return;if(playing){finishPreview();return;}
  el.preview.disabled=true;audio.currentTime=0;
  try{
   await audio.play();if(disposed){audio.pause();return;}
   playing=true;heard=true;el.preview.textContent='Dừng nghe thử';el['preview-status'].textContent='Đang nghe thử · tối đa 30 giây.';
   el['preview-step'].dataset.state='complete';el['start-step'].dataset.state='active';el.start.disabled=false;
   stopTimer=setTimeout(finishPreview,30000);
  }catch{if(!disposed)el['preview-status'].textContent='Chưa phát được âm thanh. Nhấn Nghe thử để thử lại.';}
  finally{el.preview.disabled=false;}
 });
 audio.addEventListener('timeupdate',()=>{if(playing&&audio.currentTime>=30)finishPreview();});
 audio.addEventListener('ended',finishPreview);
 audio.addEventListener('error',()=>{
  if(!ready||disposed)return;stopPreview();ready=false;heard=false;el.start.disabled=true;el.preview.disabled=true;el.volume.disabled=true;
  el['download-step'].dataset.state='error';el['preview-step'].dataset.state='locked';el['start-step'].dataset.state='locked';
  el['download-status'].textContent='Trình duyệt chưa đọc được audio. Hãy thử tải lại.';el['preview-status'].textContent='Chưa phát được audio.';el.retry.hidden=false;
 });
 el.volume.addEventListener('input',()=>{audio.volume=Number(el.volume.value);ctx.trial.audioVolume=audio.volume;el['volume-value'].textContent=Math.round(audio.volume*100)+'%';});
 el.retry.addEventListener('click',prepare);
 el.start.addEventListener('click',async()=>{
  if(!ready||!heard||disposed)return;stopPreview();el.start.disabled=true;
  ctx.trial.audioVolume=audio.volume;ctx.trial.audioPrepared=true;
  try{
   if(ctx.toolsEnabled===false)await ctx.startListeningAudio(audio.volume);
   if(!disposed)ctx.navigate('listening');
  }catch{if(!disposed){el['start-status'].textContent='Chưa phát được audio. Nhấn Bắt đầu để thử lại.';el.start.disabled=false;}}
 });
 window.addEventListener('pagehide',()=>{disposed=true;stopPreview();audio.removeAttribute('src');audio.load();},{once:true});
 prepare();
})();
