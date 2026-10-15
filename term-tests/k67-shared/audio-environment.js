(function () {
  'use strict';
  // Tín hiệu web chỉ cho biết trạng thái player/thiết bị được browser cho thấy, không đo âm thanh tới tai.
  window.K67_AUDIO_ENVIRONMENT = function ({audio,report,isHeld,notify}) {
    let stopped=false,wake=null,requesting=false,outputs=new Set(),lastTick=performance.now(),lastPosition=audio.currentTime;
    const handlers=[];
    // Khi đã nghe hết, phần kiểm tra đáp án không còn phụ thuộc đầu ra âm thanh.
    const incident=(reason,position)=>{if(!stopped&&!audio.ended)report(reason,position);};
    const listen=(target,type,fn)=>{target?.addEventListener?.(type,fn);handlers.push(()=>target?.removeEventListener?.(type,fn));};
    const release=()=>{const old=wake;wake=null;old?.release().catch(()=>{});};
    async function keepAwake(){
      if(stopped||requesting||wake||isHeld()||audio.paused||document.hidden||!navigator.wakeLock?.request)return;
      requesting=true;
      try {const value=await navigator.wakeLock.request('screen');
        if(stopped||isHeld()||audio.paused||document.hidden){await value.release();return;}
        wake=value;value.addEventListener('release',()=>{if(wake===value)wake=null;});
      }catch{notify('Trình duyệt chưa giữ màn hình sáng. Tránh khóa hoặc gập máy khi thi.');}
      finally{requesting=false;}
    }
    listen(audio,'play',keepAwake);listen(audio,'pause',release);
    listen(document,'visibilitychange',()=>{if(document.hidden)release();else keepAwake();});
    listen(audio,'volumechange',()=>{if(audio.muted||audio.volume===0)incident('muted');});
    listen(document,'freeze',()=>incident('freeze'));
    listen(document,'resume',()=>incident('lifecycle'));
    listen(window,'pageshow',event=>{if(event.persisted)incident('lifecycle');});
    const timer=setInterval(()=>{
      const now=performance.now();
      if(!isHeld()&&now-lastTick>6000)incident('lifecycle',lastPosition);
      lastTick=now;lastPosition=Number(audio.currentTime)||0;
    },1000);
    async function devices(changed=false){
      try{
        const current=new Set((await navigator.mediaDevices?.enumerateDevices?.()||[]).filter(x=>x.kind==='audiooutput').map(x=>x.deviceId));
        const selected=String(audio.sinkId||'');
        if(changed&&selected&&selected!=='default'&&outputs.has(selected)&&!current.has(selected))incident('output_lost');
        else if(changed)notify('Thiết bị có thay đổi. Nếu không nghe rõ, bấm “Tôi không nghe được”.');
        outputs=current;
      }catch{if(changed)notify('Hãy kiểm tra đầu ra âm thanh trong cài đặt thiết bị.');}
    }
    listen(navigator.mediaDevices,'devicechange',()=>devices(true));devices();
    if(navigator.mediaSession?.setActionHandler)for(const action of ['pause','stop','play','seekbackward','seekforward','seekto']){
      try{navigator.mediaSession.setActionHandler(action,()=>incident(action==='play'?'media_pause':'media_'+(action.startsWith('seek')?'seek':'pause')));}
      catch{ /* API/hành động chưa có: vẫn theo dõi player và có nút báo lỗi. */ }
    }
    keepAwake();
    return{async selectOutput(){
      if(!navigator.mediaDevices?.selectAudioOutput||!audio.setSinkId){notify('Trình duyệt này chưa chọn đầu ra trong web. Hãy chọn loa/tai nghe trong cài đặt máy.');return;}
      incident('output_change');
      try{const selected=await navigator.mediaDevices.selectAudioOutput();await audio.setSinkId(selected.deviceId);await devices();notify('Đã chọn đầu ra. Thử âm thanh rồi xác nhận tiếp tục.');}
      catch{notify('Chưa đổi được đầu ra. Kiểm quyền âm thanh hoặc chọn trong cài đặt máy rồi thử lại.');}
    },stop(){stopped=true;release();clearInterval(timer);handlers.forEach(fn=>fn());
      if(navigator.mediaSession?.setActionHandler)for(const action of ['pause','stop','play','seekbackward','seekforward','seekto'])try{navigator.mediaSession.setActionHandler(action,null);}catch{}
    }};
  };
}());
