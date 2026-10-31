// Pacing hints never authorize an ACK or remove events from durable storage.
export function createDeliveryPump({send,retryAt=()=>0,mode='adaptive',clock=()=>Date.now(),random=Math.random,
  setTimer=setTimeout,clearTimer=clearTimeout,onHealth=()=>{},maxWaitMs=15_000,minGapMs=1000,
  eventThreshold=80,byteThreshold=192*1024}={}) {
  if(typeof send!=='function'||!['adaptive',5000,10_000,15_000].includes(mode)
    ||!Number.isInteger(maxWaitMs)||maxWaitMs<15_000||maxWaitMs>60_000
    ||!Number.isInteger(minGapMs)||minGapMs<100||minGapMs>5000
    ||!Number.isInteger(eventThreshold)||eventThreshold<1||eventThreshold>100
    ||!Number.isInteger(byteThreshold)||byteThreshold<1024||byteThreshold>256*1024)
    throw Error('JOURNAL_DELIVERY_CONFIG_INVALID');
  let timer=null,dueAt=Infinity,stopped=false,paused=false,running=false,quiet=false,forceNext=false,forceAt=null;
  let interval=mode==='adaptive'?10_000:mode,lastAttempt=-Infinity,firstPending=null,count=0,bytes=0;
  let duringCount=0,duringBytes=0,firstDuring=null,lastState='waiting';
  const sample=()=>{try{const n=Number(random());return Number.isFinite(n)?Math.max(0,Math.min(1-Number.EPSILON,n)):0.5;}catch{return 0.5;}};
  const jitter=nominal=>Math.floor(nominal*(0.8+0.2*sample()));
  const health=()=>{try{onHealth({status:'degraded',errorCode:'JOURNAL_DELIVERY_UNAVAILABLE'});}catch{}};
  function cancel(){if(timer!==null)clearTimer(timer);timer=null;dueAt=Infinity;}
  function arm(at,replace=false){
    if(stopped||paused||running)return;
    const now=clock(),target=Math.max(now,lastAttempt+minGapMs,at);
    if(timer!==null&&!replace&&target>=dueAt)return;
    cancel();dueAt=target;
    timer=setTimer(()=>{timer=null;dueAt=Infinity;void flush().catch(health);},Math.max(0,target-now));
  }
  function plan(result){
    if(stopped||paused)return;
    const now=clock();let retry=0;
    try{const value=Number(retryAt());if(Number.isFinite(value))retry=value;}catch{}
    if(forceNext){arm(forceAt??now);return;}
    if(retry>now){arm(retry);return;}
    if(['degraded','memory_only'].includes(result.status)&&result.acknowledgedCount===undefined){arm(now+2500+Math.floor(sample()*2500));return;}
    if(result.status==='deferred'){arm(now+1000+Math.floor(sample()*2000));return;}
    let next=now+jitter(interval);
    if(result.morePending||count>=eventThreshold||bytes>=byteThreshold)next=now+500+Math.floor(sample()*500);
    else if(firstPending!==null)next=Math.min(next,firstPending+maxWaitMs);
    arm(next);
  }
  function notify({bytes:amount=0,urgent=false}={}){
    if(stopped)return;
    const now=clock(),added=Number.isFinite(amount)?Math.max(0,Math.min(94*1024,amount)):0;
    count=Math.min(1000,count+1);bytes=Math.min(1024*1024,bytes+added);firstPending??=now;
    if(running){duringCount=Math.min(1000,duringCount+1);duringBytes=Math.min(1024*1024,duringBytes+added);firstDuring??=now;return;}
    if(quiet){quiet=false;arm(now+jitter(interval),true);}
    if(urgent||count>=eventThreshold||bytes>=byteThreshold)arm(now+200+Math.floor(sample()*300));
    else arm(Math.min(dueAt,firstPending+maxWaitMs));
  }
  async function flush(options={}){
    if(stopped)return {status:'deferred',reason:'stopped'};
    if(options.keepalive)return send(options);
    if(running){if(options.force){forceNext=true;forceAt=Math.min(forceAt??Infinity,clock());}return {status:'deferred',reason:'delivery_inflight'};}
    if(paused&&!options.force)return {status:'deferred',reason:'paused'};
    cancel();running=true;lastAttempt=clock();
    const beforeCount=count,beforeBytes=bytes;duringCount=0;duringBytes=0;firstDuring=null;
    const force=options.force||forceNext;forceNext=false;forceAt=null;let result;
    try{
      result=await send({...options,...force?{force:true}:{}});
      if(!result||typeof result.status!=='string')throw Error('JOURNAL_DELIVERY_RESULT_INVALID');
      if(['ok','memory_only','server_confirmed'].includes(result.status)){
        const acknowledged=Number.isInteger(result.acknowledgedCount)?Math.max(0,result.acknowledgedCount):0;
        const remaining=acknowledged===0?0:Math.max(0,beforeCount-acknowledged);
        count=Math.min(1000,remaining+duringCount);bytes=remaining?Math.min(1024*1024,beforeBytes+duringBytes):duringBytes;
        firstPending=remaining?clock():firstDuring;quiet=count===0&&!result.morePending;
        if(mode==='adaptive')interval=acknowledged>=50?5000:acknowledged>=10?10_000:15_000;
      }
      lastState=result.status;return result;
    }catch{health();lastState='degraded';result={status:'degraded'};return result;}
    finally{running=false;plan(result||{status:'degraded'});}
  }
  function pause(){paused=true;cancel();}
  function wake(){if(stopped)return;paused=false;forceNext=true;forceAt=clock()+500+Math.floor(sample()*2500);cancel();arm(forceAt);}
  function stop(){stopped=true;cancel();}
  arm(clock()+jitter(interval));
  return {notify,flush,pause,wake,stop,setOnline:online=>online?wake():pause(),
    status:()=>({stopped,paused,running,intervalMs:interval,nextAt:Number.isFinite(dueAt)?dueAt:null,
      estimatedEvents:count,estimatedBytes:bytes,firstPendingAt:firstPending,lastState})};
}
