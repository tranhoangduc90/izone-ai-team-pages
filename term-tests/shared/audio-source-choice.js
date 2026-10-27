(function(){
  'use strict';
  if(window.IZONE_AUDIO_SOURCE_CHOICE||window.IZONE_EXAM_DEVICE_BLOCKED)return;
  window.IZONE_AUDIO_SOURCE_CHOICE=true;
  let sourceFailed=false,button=null;
  const render=()=>{
    const retry=document.getElementById('bootstrapRetry');
    if(!retry)return;
    if(!button?.isConnected){button=document.createElement('button');button.type='button';button.id='bootstrapFallback';button.className=retry.className;button.textContent='Tải bằng nguồn dự phòng';button.hidden=true;
      button.addEventListener('click',()=>{window.IZONE_AUDIO_PREFER_FALLBACK=true;button.hidden=true;retry.click();});retry.after(button);}
    const show=sourceFailed&&!retry.hidden&&!retry.disabled&&retry.textContent.includes('audio');
    if(button.hidden===show)button.hidden=!show;
  };
  window.addEventListener('term-test:audio-source',event=>{
    if(event.detail?.source==='primary-error'){
      sourceFailed=true;
      const status=document.getElementById('bootstrapDownloadStatus');
      if(status)status.textContent='Nguồn tải chính đang lỗi, hệ thống đang thử nguồn dự phòng…';
    }
    render();
  });
  new MutationObserver(render).observe(document.getElementById('app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled']});
  render();
}());
