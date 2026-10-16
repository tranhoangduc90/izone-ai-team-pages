(function () {
  'use strict';
  const credentials=new Map();
  // Web Lock giữ độc quyền cùng origin; server giữ chủ giữa thiết bị, không tự chiếm khi mất mạng.
  // Bằng chứng chủ phát khác khóa giải mã audio. Reload cùng profile chỉ reclaim sau Web Lock.
  window.K67_CREATE_AUDIO_OWNER = async function ({apiBase,slug,token,generation}) {
    const storageKey=`izone-k67-audio-owner:v1:${apiBase}:${slug}:${token}:${generation}`;
    let saved=credentials.get(storageKey);
    if(!saved)try { saved=JSON.parse(localStorage.getItem(storageKey)||'null'); } catch {}
    const ownerId=saved?.ownerId||crypto.randomUUID();
    const ownerProof=saved?.ownerProof||Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    const pageId=credentials.get(storageKey)?.pageId||crypto.randomUUID();let epoch=0,enabled=false,live=false,unlock=null,audio=null;
    const fields=()=>enabled?{ownerId,ownerProof,ownerEpoch:epoch,generation}:{};
    async function call(action,reclaim=false) {
      const response=await fetch(`${apiBase}/api/term-tests/${slug}/session/audio-owner`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({examSessionToken:token,generation,ownerId,ownerProof,pageId,ownerEpoch:epoch,action,reclaim}),signal:AbortSignal.timeout(8000)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Object.assign(new Error(data.message||'Chưa xác nhận được quyền phát audio.'),{code:data.error||'',status:response.status});
      return data;
    }
    let status;
    try { status=await call('status'); } catch(error) { if(error.status===404&&!error.code)return null;throw error; }
    if(!status.ownerEnabled)return null;
    enabled=true;
    if(navigator.locks?.request){
      const acquired=await new Promise((resolve,reject)=>{
        navigator.locks.request(`k67-audio:${apiBase}:${slug}:${token}:${generation}`,{ifAvailable:true},async lock=>{
          if(!lock){resolve(false);return;}resolve(true);await new Promise(done=>{unlock=done;});
        }).catch(reject);
      });
      if(!acquired)throw Object.assign(new Error('Bài đang mở ở tab khác. Quay lại tab đang thi hoặc dừng audio tại đó trước.'),{code:'AUDIO_OWNER_IN_USE'});
    }
    try {
      credentials.set(storageKey,{ownerId,ownerProof,pageId});
      try {
        const durable=JSON.stringify({ownerId,ownerProof});localStorage.setItem(storageKey,durable);
        if(localStorage.getItem(storageKey)!==durable)throw new Error('Không đọc lại được bằng chứng chủ phát.');
      } catch {throw new Error('Trình duyệt chưa lưu được quyền phát để khôi phục sau tải lại. Hãy cho phép lưu dữ liệu trang hoặc nhờ giáo viên trước khi bắt đầu.');}
      const claim=await call('claim',Boolean(unlock));epoch=claim.ownerEpoch;live=true;
    }catch(error){unlock?.();throw error;}
    const lose=()=>{live=false;audio?.pause();unlock?.();unlock=null;window.dispatchEvent(new Event('k67:audio-owner-lost'));};
    const leaving=()=>{if(audio&&!audio.ended)window.K67_ACTIVE_LISTENING?.report('reload');lose();};window.addEventListener('pagehide',leaving);
    const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(`k67-audio:${token}:${generation}`):null;
    channel?.postMessage({type:'active',pageId});
    return {token,slug,fields,canPlay:()=>live,bindAudio(value){audio=value;audio.addEventListener('play',()=>{if(!live)audio.pause();});},
      request(options){if(!options?.body||typeof options.body!=='string')return options;
        try{return{...options,body:JSON.stringify({...JSON.parse(options.body),...fields()})};}catch{return options;}},
      async release(){audio?.pause();const result=await call('release');if(result.released)lose();return result;},
      lose,stop(){lose();channel?.close();window.removeEventListener('pagehide',leaving);}};
  };
}());
