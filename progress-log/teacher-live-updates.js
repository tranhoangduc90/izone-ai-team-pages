// Nhận thông báo máy chủ và đọc bù theo revision. Chỉ áp dụng sau khi đọc đủ; không gửi lại thao tác ghi.
export function createTeacherLiveUpdates({read,apply,url,onState=()=>{},onAccessDenied=()=>{},
  EventSourceClass=globalThis.EventSource,active=()=>!document.hidden,
  fallbackMs=3000,repairMs=30000,heartbeatTimeoutMs=35000}) {
  let context='',epoch=0,revision='0',target='0',source=null,timer=null,reconnect=null,debounce=null;
  let controller=null,running=null,queued=false,forceQueued=false,failures=0,lastAck=0,lastRead=0,streamOpen=false;
  let lastRepair=0,retryAt=0,lastError=null,stopped=true,needsFull=false;
  const state=(kind,extra={})=>onState({kind,lastRead,lastAck,revision,target,
    ...(['partial','offline','reconnecting'].includes(kind)?lastError:null),...extra});
  const ahead=()=>BigInt(target)>BigInt(revision);
  function closeStream(){source?.close();source=null;streamOpen=false;clearTimeout(reconnect);reconnect=null;}
  function stop(){stopped=true;epoch++;context='';closeStream();clearInterval(timer);clearTimeout(debounce);debounce=null;controller?.abort();queued=false;forceQueued=false;state('idle');}
  async function refresh({force=false}={}) {
    if(stopped||!context)return;
    if(running){queued=true;forceQueued||=force;return running;}
    force||=needsFull;const version=epoch,id=context;
    const requestController=new AbortController();controller=requestController;
    const deadline=setTimeout(()=>requestController.abort(new DOMException('Đọc dữ liệu quá lâu.','TimeoutError')),15000);
    state('updating');
    const work=(async()=>{
      try{
        const result=await read({assignmentId:id,after:revision,force,signal:requestController.signal});
        if(version!==epoch||stopped)return;
        if(!result||result.assignmentId!==id||!/^\d{1,18}$/.test(result.revision))throw Error('Dữ liệu cập nhật không khớp phiếu.');
        // Apply phải hoàn tất trước khi ghi mốc; lỗi một vùng giữ mốc cũ để lần thử lại đọc đủ.
        await apply(result);
        if(version!==epoch||stopped)return;
        revision=result.revision;if(BigInt(revision)>BigInt(target))target=revision;
        lastRead=Date.now();lastAck=lastRead;failures=0;retryAt=0;lastError=null;if(force)needsFull=false;
        state(ahead()?'updating':streamOpen?'connected':'fallback',{pulse:true});
      }catch(error){
        if(version!==epoch||stopped)return;
        if([401,403,404].includes(error.status)){stop();onAccessDenied(error);return;}
        failures++;needsFull||=force;
        // SSE có thể vẫn tốt khi HTTP/body lỗi. Đọc lại riêng, có backoff/jitter, không phát lại thao tác ghi.
        retryAt=error.retryable===false?Infinity:Date.now()+Math.min(30000,1000*2**Math.min(failures-1,5)*(.8+Math.random()*.4));
        lastError={message:error.message,code:error.code||'READ_FAILED'};
        state(navigator.onLine===false?'offline':'partial');
      }finally{clearTimeout(deadline);}
    })();
    running=work;
    try{await work;}finally{
      if(running===work)running=null;
      if(version===epoch&&!stopped&&(queued||ahead()&&failures===0)){
        const force=forceQueued;queued=false;forceQueued=false;schedule(force);
      }
    }
  }
  function schedule(force=false){forceQueued||=force;if(debounce||stopped||failures&&Date.now()<retryAt&&!forceQueued)return;debounce=setTimeout(()=>{debounce=null;const forced=forceQueued;forceQueued=false;void refresh({force:forced});},250);}
  function connect(){
    if(stopped||!active()||!EventSourceClass||source)return;
    const version=epoch,id=context,stream=new EventSourceClass(url(id),{withCredentials:true});source=stream;
    const valid=()=>!stopped&&version===epoch&&source===stream;
    stream.addEventListener('open',()=>{if(valid()){streamOpen=true;state(ahead()?'updating':'reconnecting');}});
    function signal(event,pulse){
      if(!valid())return;
      try{
        const message=JSON.parse(event.data);
        if(message.assignmentId!==id||!/^\d{1,18}$/.test(String(message.revision)))throw Error('Invalid revision');
        if(BigInt(message.revision)>BigInt(target))target=String(message.revision);
        if(typeof message.notificationsReady==='boolean')streamOpen=message.notificationsReady;
        lastAck=Date.now();
        if(failures){state('partial');if(Date.now()>=retryAt)schedule();}
        else if(ahead()){state('updating');schedule();}else state(lastRead?(streamOpen?'connected':'fallback'):'updating',{pulse});
      }catch{state('reconnecting');schedule();}
    }
    stream.addEventListener('change',event=>signal(event,true));
    stream.addEventListener('heartbeat',event=>signal(event,true));
    stream.addEventListener('unavailable',()=>{if(valid()){streamOpen=false;state('reconnecting');schedule();}});
    stream.addEventListener('access',event=>{if(!valid())return;let status=401;try{status=JSON.parse(event.data).status;}catch{}stop();onAccessDenied(Object.assign(Error(status===403?'Quyền xem phiếu đã thay đổi.':'Phiên đăng nhập đã hết hạn.'),{status}));});
    stream.addEventListener('error',()=>{
      if(!valid())return;closeStream();state(navigator.onLine===false?'offline':'reconnecting');schedule();
      reconnect=setTimeout(()=>{reconnect=null;connect();},Math.min(30000,3000*2**Math.min(failures,3))+Math.random()*750);
    });
  }
  function start(assignmentId){
    if(!stopped&&context===assignmentId)return refresh({force:true});
    stop();stopped=false;context=assignmentId;revision='0';target='0';lastRead=lastAck=0;lastRepair=Date.now();failures=0;retryAt=0;lastError=null;needsFull=false;
    // Không giữ promise thuộc lớp cũ; response vẫn bị epoch và AbortController loại bỏ.
    running=null;const initial=refresh({force:true});connect();
    timer=setInterval(()=>{
      if(stopped)return;
      if(!active()){closeStream();return;}
      const now=Date.now();
      if(lastAck&&now-lastAck>heartbeatTimeoutMs){closeStream();state('reconnecting');}
      if(!source&&!reconnect)connect();
      if(failures){if(now>=retryAt&&!running)void refresh({force:needsFull});return;}
      const period=fallbackMs*Math.min(8,2**failures);
      if(!streamOpen&&now-lastRead>=period&&now-lastRepair>=period){lastRepair=now;void refresh();}
      else if(streamOpen&&now-lastRepair>=repairMs){lastRepair=now;void refresh({force:true});}
    },1000+Math.random()*250);
    return initial;
  }
  function resume(){if(stopped)return;lastRepair=Date.now();connect();void refresh({force:true});}
  return {start,stop,refresh,resume};
}

export function paintConnection(host,button,value) {
  if(!host||!button)return;
  const labels={idle:'Chọn lớp để theo dõi',updating:'Đang cập nhật',connected:'Đang kết nối',fallback:'Đang cập nhật · dự phòng',
    reconnecting:'Đang kết nối lại',offline:'Mất kết nối',partial:'Chưa cập nhật đủ'};
  host.dataset.state=value.kind;host.textContent=labels[value.kind]||labels.idle;
  // Lưu mã chẩn đoán tối thiểu, không ghi nội dung bài/phiên; heartbeat không xóa nguyên nhân lỗi.
  if(value.code)host.dataset.errorCode=value.code;
  else if(!['partial','offline','reconnecting','updating'].includes(value.kind))delete host.dataset.errorCode;
  host.title=[value.lastRead?'Dữ liệu cập nhật lúc '+new Date(value.lastRead).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa đọc dữ liệu',value.message||''].filter(Boolean).join(' · ');
  button.classList.toggle('is-refreshing',value.kind==='updating');button.setAttribute('aria-busy',String(value.kind==='updating'));
  if(value.pulse){host.classList.remove('received-signal');void host.offsetWidth;host.classList.add('received-signal');}
}
