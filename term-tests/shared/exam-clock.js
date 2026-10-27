(function () {
  'use strict';
  if (window.IZONE_EXAM_CLOCK) return;
  const localEpoch=Date.now(), localTick=performance.now();
  let epoch=null, tick=localTick, suspended=false, fetchTime=null, pending=null;
  const valid=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
  const localNow=()=>localEpoch+Math.max(0,performance.now()-localTick);
  function notice(show,failed=false){
    let box=document.getElementById?.('examClockNotice');
    if(!box&&show&&document.createElement){const host=document.querySelector('main')||document.getElementById('app');if(!host)return;
      box=document.createElement('div');box.id='examClockNotice';box.className='notice';box.setAttribute('role','status');
      const text=document.createElement('span'),button=document.createElement('button');button.type='button';button.className='button button-secondary';button.textContent='Đối chiếu lại giờ';button.addEventListener('click',()=>void resync());box.append(text,button);host.prepend(box);
    }
    if(box){box.hidden=!show;if(show)box.firstChild.textContent=failed?'Chưa xác nhận lại được giờ máy chủ. Nháp được giữ; hãy kiểm tra mạng rồi đối chiếu lại giờ. ':'Đang đối chiếu giờ máy chủ. Nháp được giữ và thời hạn bài thi vẫn tính theo máy chủ. ';}
  }
  function sync(value) {
    if (!valid(value)) return false;
    const currentTick=performance.now(),sample=Date.parse(value);
    epoch=epoch===null?sample:Math.max(sample,epoch+Math.max(0,currentTick-tick));tick=currentTick;suspended=false;
    notice(false);
    window.dispatchEvent(new CustomEvent('term-test:clock-ready'));
    return true;
  }
  function observe(data) {
    const value=data?.serverNow||data?.exam?.serverNow||data?.writing?.serverNow;
    if (value) sync(value);
    return data;
  }
  // Offset is only a compatibility fallback for local demos/legacy pages.
  // A live server sample always wins; neither anchor is persisted across reload.
  function now(offset=0) {
    if (suspended) return NaN;
    return estimate(offset);
  }
  // Observational timestamps may be recorded while offline. They do not confirm
  // server time or permit a deadline guard to auto-submit from an uncertain clock.
  function estimate(offset=0){return epoch===null?localNow()+(Number(offset)||0):epoch+Math.max(0,performance.now()-tick);}
  async function resync() {
    if (!fetchTime) return false;
    if (pending) return pending;
    notice(suspended);
    pending=(async()=>{try{const ok=sync((await fetchTime()).serverNow);if(!ok)notice(suspended,true);return ok;}catch{notice(suspended,true);return false;}finally{pending=null;}})();
    return pending;
  }
  function wake() {
    if (document.visibilityState==='hidden') return;
    // Browsers differ in whether their monotonic clock counts system sleep.
    // Never auto-submit from an uncertain sample after a suspended page wakes.
    if (epoch!==null) suspended=true;
    window.dispatchEvent(new CustomEvent('term-test:clock-syncing'));
    void resync();
  }
  window.addEventListener('pageshow',event=>{if(event.persisted)wake();});
  window.addEventListener('online',wake);
  document.addEventListener('visibilitychange',wake);
  document.addEventListener('resume',wake);
  window.IZONE_EXAM_CLOCK=Object.freeze({now,estimate,sync,observe,resync,
    offset(value){sync(value);return Date.parse(value)-Date.now();},
    configure(read){fetchTime=read;suspended=epoch===null||suspended;return resync();},
    get ready(){return epoch!==null&&!suspended;}
  });
}());
