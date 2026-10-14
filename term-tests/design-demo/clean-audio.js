// Demo sạch: audio đã phát từ click Bắt đầu ở phòng chờ, nằm ở trang cha.
// Màn thi chỉ có đồng hồ và âm lượng; đổi Part không đổi player hoặc vị trí nghe.
(()=>{
 const ctx=window.REAL_DEMO;
 if(ctx.toolsEnabled!==false||ctx.screen!=='listening')return;
 const audio=ctx.getListeningAudio();
 const box=document.createElement('div');box.className='clean-listening-audio';box.setAttribute('role','group');box.setAttribute('aria-label','Audio Listening');
 const clock=document.createElement('span');clock.className='clean-audio-clock';
 const volume=document.createElement('label');volume.className='clean-audio-volume';
 const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
 const slider=document.createElement('input');slider.type='range';slider.min='0.1';slider.max='1';slider.step='0.1';slider.setAttribute('aria-label','Âm lượng Listening');slider.value=String(audio?.volume??1);slider.disabled=!audio;
 const status=document.createElement('span');status.className='clean-audio-error';status.setAttribute('role','status');status.hidden=true;
 volume.append(icon,slider);box.append(clock,volume,status);
 let active=true;
 const time=value=>{const seconds=Math.max(0,Math.floor(Number(value)||0));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
 function update(){
  const value=time(audio?.currentTime)+' / '+(Number.isFinite(audio?.duration)?time(audio.duration):'--:--');
  if(clock.textContent!==value)clock.textContent=value;
  clock.setAttribute('aria-label','Đã nghe '+time(audio?.currentTime));
  volume.title='Âm lượng '+Math.round((audio?.volume??1)*100)+'%';
 }
 function attach(){
  const form=document.getElementById('listeningView');
  const heading=form?.querySelector('.cbt-test-heading');
  if(heading&&box.parentElement!==heading)heading.insertBefore(box,heading.querySelector('.cbt-toolbar-controls'));
  // Nộp xong/rời Listening kết thúc bản nghe; không cung cấp đường phát lại.
  if(form?.hidden&&active){active=false;ctx.stopListeningAudio();}
 }
 slider.addEventListener('input',()=>{if(!audio)return;audio.volume=Number(slider.value);ctx.trial.audioVolume=audio.volume;update();});
 if(audio){
  for(const event of ['loadedmetadata','timeupdate','play','ended'])audio.addEventListener(event,update);
  audio.addEventListener('pause',()=>{
   if(!active||audio.ended||audio.dataset.stopped==='true')return;
   // Khôi phục gián đoạn ở đúng vị trí, không tua lại hoặc tạo nút tạm dừng.
   audio.play().catch(()=>{if(active){status.textContent='Audio bị gián đoạn. Tải lại demo để bắt đầu lượt thử mới.';status.hidden=false;}});
  });
  audio.addEventListener('error',()=>{status.textContent='Không đọc được audio. Tải lại demo để bắt đầu lượt thử mới.';status.hidden=false;});
 }else{status.textContent='Hãy bắt đầu Listening từ phòng chờ.';status.hidden=false;}
 window.addEventListener('pagehide',()=>{active=false;ctx.stopListeningAudio();},{once:true});
 new MutationObserver(attach).observe(document.getElementById('app'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});attach();update();
})();
