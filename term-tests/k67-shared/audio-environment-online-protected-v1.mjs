// Tín hiệu web chỉ cho biết trạng thái player/thiết bị được browser cho thấy, không đo âm thanh tới tai.
export function createAudioEnvironment({audio,isHeld,notify,observe}) {
  let stopped=false,wake=null,requesting=false;
  const handlers=[];
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
  keepAwake();
  return{async selectOutput(){
    if(!navigator.mediaDevices?.selectAudioOutput||!audio.setSinkId){notify('Trình duyệt này chưa chọn đầu ra trong web. Hãy chọn loa/tai nghe trong cài đặt máy.');return;}
    const outputChangeId=crypto.randomUUID();
    observe('audio_device_change',{outputChangeId,trigger:'explicit_output_picker'});
    try{
      const selected=await navigator.mediaDevices.selectAudioOutput();
      if(stopped){observe('audio_output_result',{outputChangeId,outcome:'cancelled'});return;}
      await audio.setSinkId(selected.deviceId);
      observe('audio_output_result',{outputChangeId,outcome:'resolved'});
      if(!stopped)notify('Đã đổi đầu ra. Nếu vẫn không nghe được, bấm Báo lỗi âm thanh.');
    }catch(error){
      observe('audio_output_result',{outputChangeId,outcome:'rejected',errorCode:error?.name||'Error'});
      if(!stopped)notify('Chưa đổi được đầu ra. Bạn có thể chọn loa hoặc tai nghe trong cài đặt máy.');
    }
  },stop(){stopped=true;release();handlers.forEach(fn=>fn());}};
};
