// Demo sạch: dùng audio thật đã tải ở phòng chờ, giữ player khi renderer dựng lại.
// Nút phát, đồng hồ nhỏ và âm lượng nằm cạnh tiêu đề; lỗi có thông báo để thử lại.
(()=>{
 const ctx=window.REAL_DEMO;
 if(ctx.toolsEnabled!==false||ctx.screen!=='listening')return;
 const box=document.createElement('div');box.className='clean-listening-audio';box.setAttribute('role','group');box.setAttribute('aria-label','Audio Listening');
 const audio=document.createElement('audio');audio.hidden=true;audio.preload='auto';
 const play=document.createElement('button');play.type='button';play.className='clean-audio-play';
 const clock=document.createElement('span');clock.className='clean-audio-clock';
 const volume=document.createElement('label');volume.className='clean-audio-volume';
 const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
 const slider=document.createElement('input');slider.type='range';slider.min='0.1';slider.max='1';slider.step='0.1';slider.setAttribute('aria-label','Âm lượng Listening');
 const savedVolume=Number(ctx.trial.audioVolume);audio.volume=Number.isFinite(savedVolume)&&savedVolume>=0.1&&savedVolume<=1?savedVolume:1;slider.value=String(audio.volume);
 const status=document.createElement('span');status.className='clean-audio-error';status.setAttribute('role','status');status.hidden=true;
 volume.append(icon,slider);box.append(play,clock,volume,audio,status);
 let ready=false,loading=false;
 const time=value=>{const seconds=Math.max(0,Math.floor(Number(value)||0));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
 function update(){
  const action=audio.paused?'Phát audio Listening':'Tạm dừng audio Listening';
  const glyph=audio.paused?'▶':'Ⅱ';if(play.textContent!==glyph)play.textContent=glyph;
  play.setAttribute('aria-label',action);play.title=action;
  const value=time(audio.currentTime)+' / '+(Number.isFinite(audio.duration)?time(audio.duration):'--:--');
  if(clock.textContent!==value)clock.textContent=value;
  clock.setAttribute('aria-label','Đã nghe '+time(audio.currentTime));
  volume.title='Âm lượng '+Math.round(audio.volume*100)+'%';
 }
 function attach(){
  const heading=document.querySelector('#listeningView .cbt-test-heading');
  if(heading&&box.parentElement!==heading)heading.insertBefore(box,heading.querySelector('.cbt-toolbar-controls'));
 }
 async function prepare(){
  if(ready||loading)return ready;loading=true;play.disabled=true;status.hidden=true;
  try{audio.src=await ctx.audio();ready=true;return true;}
  catch{status.textContent='Chưa tải được audio. Nhấn phát để thử lại.';status.hidden=false;return false;}
  finally{loading=false;play.disabled=false;update();}
 }
 play.addEventListener('click',async()=>{
  if(!audio.paused){audio.pause();return;}
  if(!await prepare())return;
  try{await audio.play();status.hidden=true;}
  catch{status.textContent='Chưa phát được audio. Nhấn phát để thử lại.';status.hidden=false;}
  update();
 });
 slider.addEventListener('input',()=>{audio.volume=Number(slider.value);ctx.trial.audioVolume=audio.volume;update();});
 for(const event of ['loadedmetadata','timeupdate','play','pause','ended'])audio.addEventListener(event,update);
 audio.addEventListener('error',()=>{ready=false;status.textContent='Không đọc được audio. Nhấn phát để tải lại.';status.hidden=false;update();});
 window.addEventListener('pagehide',()=>{audio.pause();audio.removeAttribute('src');audio.load();},{once:true});
 new MutationObserver(attach).observe(document.getElementById('app'),{subtree:true,childList:true});attach();update();
 if(ctx.trial.audioPrepared)prepare();
})();
