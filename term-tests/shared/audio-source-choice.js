(function(){
  'use strict';
  if(window.IZONE_AUDIO_SOURCE_CHOICE||window.IZONE_EXAM_DEVICE_BLOCKED)return;
  window.IZONE_AUDIO_SOURCE_CHOICE=true;
  let sourceFailed=false,button=null,fallbackUsed=false,fullFallback=false;
  const pendingFallback=new Set();
  const render=()=>{
    const retry=document.getElementById('bootstrapRetry');
    if(!retry)return;
    if(!button?.isConnected){button=document.createElement('button');button.type='button';button.id='bootstrapFallback';button.className=retry.className;button.textContent='Tải bằng nguồn dự phòng';button.hidden=true;
      button.addEventListener('click',()=>{window.IZONE_AUDIO_PREFER_FALLBACK=true;button.hidden=true;retry.click();});retry.after(button);}
    const show=sourceFailed&&!retry.hidden&&!retry.disabled&&retry.textContent.includes('audio');
    if(button.hidden===show)button.hidden=!show;
  };
  window.addEventListener('term-test:audio-source',event=>{
    const source=event.detail?.source,index=event.detail?.index,status=document.getElementById('bootstrapDownloadStatus');
    if(source==='transfer-start'){sourceFailed=false;fallbackUsed=false;fullFallback=false;pendingFallback.clear();}
    if(source==='primary-error')sourceFailed=true;
    // Chỉ báo nguồn phụ khi bộ tải đã chọn Pages cho đúng phần đang thiếu.
    // Cloudflare thử lại thành công phải trả thông báo về đúng nguồn thực tế.
    if(source==='pages-start'){pendingFallback.add(index);if(event.detail?.scope==='source')fullFallback=true;}
    if(source==='pages'){pendingFallback.delete(index);fallbackUsed=true;}
    if(status){
      if(source==='transfer-start')status.textContent='Đang chuẩn bị audio…';
      else if(fullFallback)status.textContent='Đang tải audio từ nguồn dự phòng…';
      else if(pendingFallback.size)status.textContent='Đang tải một phần audio từ nguồn dự phòng; các phần khác vẫn ưu tiên Cloudflare…';
      else if(fallbackUsed&&['pages','cloudflare','cache'].includes(source))status.textContent='Đang tải audio, ưu tiên Cloudflare; một số phần đã lấy từ nguồn dự phòng.';
      else if(source==='primary-error')status.textContent='Cloudflare tải chậm hoặc bị gián đoạn, đang thử lại phần audio…';
      else if(source==='cloudflare')status.textContent='Đang tải audio từ Cloudflare…';
      else if(source==='cache')status.textContent='Đang dùng audio đã tải và kiểm tra…';
    }
    render();
  });
  new MutationObserver(render).observe(document.getElementById('app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled']});
  render();
}());
