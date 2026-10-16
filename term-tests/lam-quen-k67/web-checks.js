// Chỉ quan sát API/sự kiện của trang và mẫu riêng. Không xin micro, quét app hoặc nhận dạng thiết bị.
// Kết quả máy đo luôn tách khỏi lời xác nhận nghe; thiếu API phụ không biến thành máy bị hỏng.
export const version='web-check-v1';
const labels={environment:'Trình duyệt và tính năng cần thiết',session:'Kết nối tới bài làm quen',localDraft:'Lưu nháp trên máy',
  audio:'Tải và giải mã mẫu',cache:'Bản audio mã hóa để phục hồi',format:'Hỗ trợ định dạng',playback:'Trình phát đang chạy',
  draftSync:'Lưu và đọc lại bài thử',hearing:'Xác nhận nghe qua tai nghe',page:'Trạng thái trang',load:'Độ phản hồi giao diện',output:'Theo dõi thay đổi thiết bị',wake:'Giữ màn hình'};
const messages={
  PENDING:'Chưa kiểm trong lượt này.',AVAILABLE:'Có các tính năng cần dùng. Tên trình duyệt không bảo đảm máy luôn ổn định.',
  CORE_MISSING:'Thiếu tính năng cần cho phát hoặc giữ quyền tab. Hãy dùng Chrome/Edge cập nhật trên máy thi; nếu vẫn lỗi, trao đổi với giảng viên.',
  UNTESTED_BROWSER:'Có tính năng cơ bản nhưng môi trường này chưa nằm trong phạm vi Chrome/Edge Windows đã nghiệm thu. Hãy thử trên máy thi hoặc trao đổi giảng viên.',
  OWNER_CONFLICT:'Phiên thử đang mở ở tab khác. Dùng tab đó hoặc đóng tab đó rồi tải lại. Đây không phải kết luận máy thiếu tính năng.',
  RESPONDED:'Dịch vụ làm quen đã phản hồi; không suy từ biểu tượng Wi-Fi.',SLOW:'Dịch vụ phản hồi chậm trong lượt vừa rồi. Kiểm lại kết nối, VPN/proxy và thử lưu lại; chưa xác định lỗi do máy hay dịch vụ.',
  UNREACHABLE:'Chưa nhận được phản hồi dịch vụ. Giữ trang, kiểm kết nối rồi thử lại. Không kết luận máy bị hỏng.',OFFLINE_HINT:'Trình duyệt vừa báo mất kết nối. Đây chỉ là tín hiệu gợi ý; lần gọi dịch vụ tiếp theo sẽ kiểm lại.',
  READBACK_OK:'Đã ghi và đọc lại đúng dữ liệu trong lượt này.',UNAVAILABLE:'Không kiểm được hoặc tính năng phụ không khả dụng. Xem hướng dẫn tương ứng bên dưới.',
  VERIFIED:'Mẫu riêng đã tải đủ, kiểm hash và giải mã đúng. Không tải nội dung đề thi thật.',FAILED:'Bước này chưa thành công. Giữ nháp, kiểm kết nối và thử lại; nếu lặp lại hãy trao đổi giảng viên.',
  MPEG_HINT:'Trình duyệt báo hỗ trợ MP3, nhưng chưa kiểm giải mã được mẫu riêng. Đây chưa phải kết quả đạt của đường MP3.',
  MPEG_UNKNOWN:'Trình duyệt chưa báo rõ hỗ trợ MP3. Bài mẫu WAV không chứng minh phát được MP3; hãy kiểm lại trên Chrome/Edge hoặc trao đổi giảng viên.',
  MPEG_DECODED:'Đã kiểm đúng hash và giải mã toàn bộ mẫu MP3 riêng sáu giây, stereo. Không mở đề thật; đây vẫn không chứng minh tiếng tới tai hoặc mọi file đều phát tốt.',
  MPEG_FAILED:'Chưa tải/kiểm/giải mã được mẫu MP3 riêng. Hãy kiểm kết nối, tải lại trên Chrome/Edge hoặc trao đổi giảng viên; không suy từ mẫu WAV rằng MP3 đã đạt.',
  PROGRESS:'Đã quan sát mốc phát tiến lên. Điều này không chứng minh tiếng đã tới tai nghe.',BLOCKED:'Trình duyệt chưa cho phát. Hãy bấm phát trực tiếp, kiểm quyền âm thanh của trang rồi thử lại.',
  ERROR:'Trình phát báo lỗi. Thử lại sau khi kiểm đầu ra và trình duyệt; không tự phát lại liên tục.',MUTED:'Phần tử audio của trang đang tắt tiếng hoặc âm lượng bằng 0. Chỉnh âm lượng rồi nghe và xác nhận lại.',
  NO_PROGRESS:'Mốc audio không tiến trong hơn 5 giây khi trang đang hiện. Có thể là gián đoạn trình phát; hãy dừng rồi thử lại.',INTERRUPTED:'Trang quan sát thấy phát bị gián đoạn. Hãy kiểm lại tiếng trước khi xác nhận.',
  CONFIRMED:'Bạn xác nhận đã nghe rõ. Đây là lời người nghe, tách khỏi tín hiệu trình phát.',UNCLEAR:'Bạn chưa nghe rõ. Kiểm Volume Mixer, đầu ra Windows, tai nghe và mute của tab; nếu vẫn lỗi, báo giảng viên qua chat hoặc trực tiếp.',
  RECONFIRM:'Môi trường hoặc đường phát vừa thay đổi. Hãy nghe lại và xác nhận, không dùng kết quả cũ.',VISIBLE:'Trang đang hiển thị.',HIDDEN:'Trang vừa bị ẩn/chuyển tab. Quay lại và nghe kiểm lại; chưa kết luận đã mất tiếng.',RESUMED:'Trang vừa tiếp tục sau tín hiệu ngưng. Hãy nghe kiểm lại.',
  OBSERVING:'Đang quan sát thao tác thật; không chạy bài ép tải máy.',BUSY:'Đã thấy giao diện bị giữ lâu hoặc nhiều lần. Đóng tác vụ không cần thiết rồi kiểm lại; web không biết app nào gây ra và chưa kết luận audio mất đoạn.',
  LIMITED:'Có theo dõi thay đổi thiết bị, nhưng không xác nhận được tai nghe vật lý hoặc mọi thao tác rút jack.',CHANGED:'Trình duyệt báo danh sách thiết bị đổi. Chưa biết có phải tai nghe; hãy kiểm đầu ra và nghe xác nhận lại.',
  HELD:'Đã yêu cầu giữ màn hình trong lúc thử. Không bảo đảm Windows không ngủ hoặc khởi động lại.',RELEASED:'Quyền giữ màn hình đã được thu hồi. Kiểm nguồn điện và giữ trang hiện; đây không phải bằng chứng mất tiếng.'
};
const states={pass:'Đã kiểm',warn:'Cần chú ý',fail:'Cần khắc phục',pending:'Chưa kiểm',unknown:'Chưa quan sát được'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createWebChecks({onChange=()=>{},onRisk=()=>{}}={}){
  const startedAt=new Date().toISOString(),runId=crypto.randomUUID?.()||'00000000-0000-4000-8000-000000000000';
  const checks=new Map(Object.keys(labels).map(id=>[id,{id,state:'pending',code:'PENDING',at:startedAt}]));
  let disposePlayer=()=>{},observer,wake,disposed=false,issueCount=0,slowSeen=false;
  const probeAbort=new AbortController();
  const disposers=[];
  const set=(id,state,code)=>{
    if(disposed||!checks.has(id))return;
    const old=checks.get(id);if(old.state===state&&old.code===code)return;
    checks.set(id,{id,state,code,at:new Date().toISOString()});onChange();
  };
  function risk(id,state,code){set(id,state,code);set('hearing','warn','RECONFIRM');onRisk(code);}
  const listen=(target,name,fn)=>{target?.addEventListener?.(name,fn);disposers.push(()=>target?.removeEventListener?.(name,fn));};
  function basic(){
    const core=isSecureContext&&!!crypto.subtle&&!!crypto.randomUUID&&!!navigator.locks?.request&&!!navigator.locks?.query&&!!window.K67_AUDIO_STORE?.get&&!!window.K67_AUDIO_STORE?.put;
    const tested=/Windows NT/i.test(navigator.userAgent)&&/(Chrome\/|Edg\/)/.test(navigator.userAgent)&&!/(OPR\/|SamsungBrowser\/)/.test(navigator.userAgent);
    set('environment',core?(tested?'pass':'warn'):'fail',core?(tested?'AVAILABLE':'UNTESTED_BROWSER'):'CORE_MISSING');
    const key='izone:k67-readiness:probe:'+runId;
    try{localStorage.setItem(key,runId);if(localStorage.getItem(key)!==runId)throw Error();localStorage.removeItem(key);set('localDraft','pass','READBACK_OK');}
    catch{set('localDraft','warn','UNAVAILABLE');}
    const mpeg=!!document.createElement('audio').canPlayType('audio/mpeg');
    set('format',mpeg?'unknown':'warn',mpeg?'MPEG_HINT':'MPEG_UNKNOWN');
    set('page',document.hidden?'warn':'pass',document.hidden?'HIDDEN':'VISIBLE');
    set('output','unknown',navigator.mediaDevices?.addEventListener?'LIMITED':'UNAVAILABLE');
    set('wake','unknown','UNAVAILABLE');
  }
  function observe(){
    listen(window,'offline',()=>set('session','warn','OFFLINE_HINT'));
    listen(document,'visibilitychange',()=>{if(document.hidden)risk('page','warn','HIDDEN');else set('page','pass','VISIBLE');});
    listen(document,'freeze',()=>risk('page','warn','HIDDEN'));
    listen(document,'resume',()=>risk('page','warn','RESUMED'));
    listen(navigator.mediaDevices,'devicechange',()=>risk('output','warn','CHANGED'));
    try{
      if(!PerformanceObserver.supportedEntryTypes.includes('longtask'))throw Error();
      let recent=[];observer=new PerformanceObserver(list=>{
        const now=performance.now();recent=recent.filter(t=>now-t<30000);
        for(const e of list.getEntries()){if(e.duration>=250)recent.push(now);if(e.duration>=1000||recent.length>=3)set('load','warn','BUSY');}
      });observer.observe({type:'longtask',buffered:false});set('load','unknown','OBSERVING');
    }catch{set('load','unknown','UNAVAILABLE');}
  }
  function attach(player){
    disposePlayer();let last=player.currentTime,advanced=0,lastProgress=performance.now(),expectedPause=false;
    const off=[];const on=(event,fn)=>{player.addEventListener(event,fn);off.push(()=>player.removeEventListener(event,fn));};
    on('volumechange',()=>{if(player.muted||player.volume===0)risk('playback','fail','MUTED');else set('playback','pending','PENDING');});
    on('play',()=>{last=player.currentTime;lastProgress=performance.now();expectedPause=false;});
    on('error',()=>risk('playback','fail','ERROR'));
    on('pause',()=>{if(!expectedPause&&!player.ended&&player.currentTime<player.duration-0.5)risk('playback','warn','INTERRUPTED');expectedPause=false;releaseWake();});
    const timer=setInterval(()=>{
      if(player.paused||player.ended||document.hidden)return;
      if(player.muted||player.volume===0){risk('playback','fail','MUTED');return;}
      const now=performance.now(),delta=player.currentTime-last;
      if(delta>0&&delta<2.5){advanced+=delta;lastProgress=now;if(advanced>=2)set('playback','pass','PROGRESS');}
      else if(now-lastProgress>=5000)risk('playback','warn','NO_PROGRESS');
      last=player.currentTime;
    },1000);
    disposePlayer=()=>{clearInterval(timer);for(const f of off)f();};
    return{expectedPause:()=>{expectedPause=true;}};
  }
  async function holdWake(){
    if(!navigator.wakeLock?.request)return;
    try{const current=await navigator.wakeLock.request('screen');if(disposed){await current.release();return;}
      wake=current;set('wake','pass','HELD');current.addEventListener('release',()=>{if(wake===current){wake=null;set('wake','unknown','RELEASED');}});
    }catch{set('wake','unknown','UNAVAILABLE');}
  }
  function releaseWake(){const current=wake;wake=null;current?.release().catch(()=>{});}
  async function checkFormat(){
    let context,timer;
    try{
      const response=await fetch(new URL('./assets/codec-sample-v1.mp3',import.meta.url),{cache:'force-cache',signal:AbortSignal.any([probeAbort.signal,AbortSignal.timeout(8000)])});
      if(!response.ok)throw Error('SAMPLE_UNAVAILABLE');
      const bytes=await response.arrayBuffer();if(bytes.byteLength!==96548)throw Error('SAMPLE_SIZE');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!=='28f88bb9a2aa243d322787641339773061f1906a8ae562f30f6681e9f572feb1')throw Error('SAMPLE_HASH');
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context){set('format','unknown','MPEG_HINT');return;}
      context=new Context();
      const decoded=await Promise.race([context.decodeAudioData(bytes),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SAMPLE_TIMEOUT')),8000);})]);
      if(decoded.duration<5||decoded.duration>7||decoded.numberOfChannels!==2)throw Error('SAMPLE_DECODE');
      set('format','pass','MPEG_DECODED');
    }catch{if(!disposed)set('format','fail','MPEG_FAILED');}
    finally{clearTimeout(timer);if(context)try{await context.close();}catch{}}
  }
  function summary(){
    const all=[...checks.values()],core=['environment','session','audio','format','playback','draftSync','hearing'];
    if(core.some(id=>checks.get(id).state==='fail'))return 'Chưa nên bắt đầu thi: còn lỗi cần khắc phục. Hãy thử lại; nếu vẫn lỗi, trao đổi với giảng viên để chọn thiết bị hoặc hình thức phù hợp.';
    if(core.some(id=>checks.get(id).state!=='pass'))return 'Chưa hoàn thành các bước kiểm trong lượt này. Xem từng mục và nghe xác nhận; kết quả không tự mở hoặc chặn bài thi thật.';
    if(all.some(c=>c.state==='warn'))return 'Các bước chính đã có kết quả, nhưng còn cảnh báo cần xem trước buổi thi.';
    return 'Các bước chính đã hoàn thành trên lượt thử này. Vẫn cần lưu ý giới hạn quan sát và kiểm lại âm thanh trước giờ thi.';
  }
  function html(){return `<p id="checkSummary" class="readiness-status" role="status">${escape(summary())}</p><section id="webChecks" class="readiness-card readiness-web-checks"><h2>Kiểm tra trước thi</h2><div id="checkRows">${rows()}</div>
    <p class="readiness-muted">Web không đọc chắc được mute tab/Windows, app gọi/họp, extension, driver, Bluetooth hoặc lịch khởi động lại. Không xin quyền micro/camera. Hãy kiểm Volume Mixer và đầu ra Windows, đóng app không cần thiết; nếu lỗi còn lặp, thử hồ sơ trình duyệt riêng không cài extension hoặc trao đổi giảng viên. Không tự tắt công cụ trợ năng.</p>
    <p class="readiness-muted">API chọn đầu ra, giữ màn hình hoặc đo tải có thể thiếu. Điều đó không tự làm máy trượt. Thử lại bằng nút phát/lưu sau khi sửa; nếu vẫn không nghe rõ sau hai lần, liên hệ giảng viên qua chat hoặc trực tiếp. Trang không gửi thông báo thay bạn.</p><p id="checkSaved" class="readiness-muted" role="status"></p></section>`;}
  function explanation(c){
    const unavailable={localDraft:'Không ghi và đọc lại được nháp/phiên trên máy. Tải lại có thể cần vào lại và mất phần chưa đồng bộ. Hãy giữ trang, thử hồ sơ trình duyệt khác hoặc trao đổi giảng viên.',
      cache:'Chưa có bản audio mã hóa lưu bền. Mẫu vẫn có thể chạy trong bộ nhớ; tải lại có thể phải tải audio lại. Hãy kiểm dung lượng và quyền lưu của trình duyệt.',
      load:'Trình duyệt không cung cấp phép theo dõi nghẽn giao diện này. Đây là API phụ, không phải kết luận máy không đủ dùng.',
      output:'Web chưa theo dõi được thay đổi thiết bị. Hãy tự kiểm đầu ra Windows và xác nhận nghe qua đúng tai nghe.',
      wake:'Chưa giữ được màn hình bằng API phụ. Kiểm nguồn điện và thiết lập ngủ của Windows; điều này không tự làm lượt thử thất bại.'};
    return c.code==='UNAVAILABLE'&&unavailable[c.id]?unavailable[c.id]:messages[c.code];
  }
  function rows(){return [...checks.values()].map(c=>`<div data-check="${c.id}" data-state="${c.state}"><strong>${escape(labels[c.id])}</strong><span>${states[c.state]} · ${escape(explanation(c))}</span></div>`).join('');}
  function paint(){const n=document.getElementById('checkRows');if(n)n.innerHTML=rows();const s=document.getElementById('checkSummary');if(s)s.textContent=summary();}
  basic();observe();
  return{set,html,paint,summary,attach,holdWake,releaseWake,checkFormat,detach(){disposePlayer();releaseWake();},report:()=>({version,runId,startedAt,checks:[...checks.values()]}),
    network(ms,ok=true){if(!ok){set('session','warn','UNREACHABLE');return;}slowSeen=slowSeen||ms>2500;set('session',slowSeen?'warn':'pass',slowSeen?'SLOW':'RESPONDED');},
    hearing:yes=>set('hearing',yes?'pass':'fail',yes?'CONFIRMED':'UNCLEAR'),
    issue:()=>{issueCount++;set('hearing','fail','UNCLEAR');return issueCount>=2;},
    dispose(){disposed=true;probeAbort.abort();disposePlayer();observer?.disconnect();releaseWake();for(const off of disposers)off();}
  };
}
