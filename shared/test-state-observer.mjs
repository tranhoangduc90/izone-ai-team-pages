/**
 * Theo dõi trạng thái qua fetch/SSE với header phiên hiện hành, không đặt token vào URL.
 * Kênh lỗi dùng hàm đọc dự phòng; đổi người/lượt phải đóng observer trước khi mở lại.
 * Chỉ chuyển snapshot đổi cho giao diện. Lỗi đọc không biến dữ liệu cũ thành rỗng.
 */
export function createTestStateObserver({url,headers={},poll,onState,onUnavailable=()=>{},onRevoked=()=>{},onUnsupported=()=>{},fetcher=fetch,pollInterval=1500,pollErrorInterval=4000,reconnectInterval=1000,stallMs=40000,initialPollDelay=0,reconnectGraceMs=0,setTimer=setTimeout,clearTimer=clearTimeout}){
 if(![initialPollDelay,reconnectGraceMs].every(value=>Number.isFinite(value)&&value>=0&&value<=5000))throw Error('STATE_GRACE_OPTIONS_INVALID');
 let closed=false,live=false,streaming=null,polling=null,streamController=null,streamReader=null,pollController=null,pollTimer=null,reconnectTimer=null,stallTimer=null,lastRevision=null,lastError=null,failures=0;
 const stats={streams:0,polls:0,states:0};
 let pollDelay=pollInterval;
 function timer(fn,delay){const t=setTimer(fn,delay);t?.unref?.();return t;}
 function unavailable(error){if(closed)return;const code=error.code||'STATE_CONNECTION_ERROR';if(lastError!==code){lastError=code;onUnavailable({code,status:error.status||503});}}
 function close(){if(closed)return;closed=true;live=false;for(const t of [pollTimer,reconnectTimer,stallTimer])clearTimer(t);streamController?.abort();pollController?.abort();void streamReader?.cancel().catch(()=>{});}
 function revoked(value){if(closed)return;close();onRevoked(value);}
 function unsupported(){if(closed)return;close();onUnsupported();}
 function deliver(value,fromStream=false){
  if(closed)return;
  if(typeof value?.revision!=='string')throw Object.assign(Error('STATE_FORMAT_INVALID'),{code:'STATE_FORMAT_INVALID'});
  if(fromStream){live=true;failures=0;clearTimer(pollTimer);pollTimer=null;pollController?.abort();}
  if(lastRevision!==value.revision||lastError){lastRevision=value.revision;lastError=null;stats.states++;onState(value);}
 }
 function schedulePoll(delay=pollDelay){if(closed||live||pollTimer||polling)return;pollTimer=timer(()=>{pollTimer=null;void check();},delay);}
 async function check(){
  if(closed||live||polling)return;pollController=new AbortController();const controller=pollController;
  polling=(async()=>{try{stats.polls++;deliver(await poll({signal:controller.signal}));pollDelay=pollInterval;}catch(error){if(closed||controller.signal.aborted)return;pollDelay=Math.max(pollErrorInterval,Number.isFinite(error.retryAfterMs)?error.retryAfterMs:0);if([401,403,423].includes(error.status))revoked({code:error.code,status:error.status});else if([404,405].includes(error.status))unsupported();else unavailable(error);}})();
  try{await polling;}finally{polling=null;if(pollController===controller)pollController=null;schedulePoll();}
 }
 function scheduleConnect(immediate=false){if(closed||reconnectTimer)return;reconnectTimer=timer(()=>{reconnectTimer=null;void connect();},immediate?0:Math.min(5000,reconnectInterval*2**Math.min(3,failures++)));}
 function armStall(controller){clearTimer(stallTimer);stallTimer=timer(()=>{unavailable({code:'STATE_STREAM_TIMEOUT'});controller.abort();void streamReader?.cancel().catch(()=>{});},stallMs);}
 async function connect(){
  if(closed||streaming)return;const controller=new AbortController();streamController=controller;let endedCleanly=false;
  streaming=(async()=>{
   let reader;
   try{
    stats.streams++;armStall(controller);
    const response=await fetcher(url,{credentials:'include',headers:{Accept:'text/event-stream',...headers},signal:controller.signal});
    if(closed)return;
    if([401,403,423].includes(response.status)){let value;try{value=await response.json();}catch{}return revoked({code:value?.error||'ACCESS_DENIED',status:response.status});}
    if([404,405].includes(response.status))return unsupported();
    if(!response.ok||!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw Object.assign(Error('STATE_STREAM_UNAVAILABLE'),{code:'STATE_STREAM_UNAVAILABLE',status:response.status});
    reader=response.body.getReader();streamReader=reader;const decoder=new TextDecoder();let line='',afterCR=false,event='message',data=[],size=0;
    function completeLine(){
     if(!line){
      if(data.length&&['state','access_revoked','unavailable'].includes(event)){const value=JSON.parse(data.join('\n'));if(event==='state')deliver(value,true);else if(event==='access_revoked')revoked(value);else if(event==='unavailable'){live=false;unavailable(value);schedulePoll(0);}}
      event='message';data=[];size=0;return;
     }
     if(line[0]===':')return;
     const split=line.indexOf(':'),field=split<0?line:line.slice(0,split),raw=split<0?'':line.slice(split+1),value=raw.startsWith(' ')?raw.slice(1):raw;
     if(field==='event')event=value;else if(field==='data')data.push(value);
    }
    while(!closed){
     const next=await reader.read();if(next.done){endedCleanly=true;break;}armStall(controller);
     for(const character of decoder.decode(next.value,{stream:true})){
      if(afterCR){afterCR=false;if(character==='\n')continue;}
      if(character==='\r'||character==='\n'){completeLine();line='';afterCR=character==='\r';}
      else{line+=character;if(++size>65536)throw Object.assign(Error('STATE_FRAME_TOO_LARGE'),{code:'STATE_FRAME_TOO_LARGE'});}
      if(closed)break;
     }
    }
   }catch(error){if(!closed)unavailable(error);}
   finally{clearTimer(stallTimer);try{await reader?.cancel();}catch{}if(streamReader===reader)streamReader=null;controller.abort();}
  })();
  try{await streaming;}finally{streaming=null;if(streamController===controller)streamController=null;if(!closed){const renew=endedCleanly&&live&&!lastError&&reconnectGraceMs>0;live=false;schedulePoll(renew?reconnectGraceMs:0);scheduleConnect(renew);}}
 }
 schedulePoll(initialPollDelay);void connect();
 return {close,snapshot(){return {closed,live,...stats};}};
}
