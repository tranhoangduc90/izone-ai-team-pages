// Gaps are bound to exact verified media bytes and use the rendered question
// numbers. Unassigned and edge windows stay with the original player path.
export function classifyListeningReport(profile, sample){
  const {hash,position,rate,paused,seeking,ended,error,readyState,advancing}=sample;
  if(!profile||hash!==profile.sha256||!Number.isFinite(position))return {decision:'unverified',reason:'asset_unverified'};
  if(seeking||ended)return {decision:'unverified',reason:'position_unstable'};
  const gap=profile.readingGaps.find(({from,to})=>position>=from+0.5&&position<to-0.5);
  if(gap){
    if(paused||error||readyState<3||!advancing||!Number.isFinite(rate)||rate<=0)
      return {decision:'unverified',reason:'player_not_advancing'};
    return {decision:'planned_silence',gap,remainingSeconds:Math.ceil((gap.to-position)/rate)};
  }
  if(profile.audibleWindows.some(([from,to])=>position>=from&&position<to))
    return {decision:'expected_audible'};
  return {decision:'unverified',reason:'position_unverified'};
}

export function silenceMessage(gap, seconds){
  return 'Hiện tại là khoảng im lặng trước câu hỏi '+gap.questions+' của part '+gap.part+
    ', không phải lỗi âm thanh. Audio sẽ vang lên sau khoảng '+seconds+
    ' giây. Hãy tập trung đọc và phân tích đề trong lúc này.';
}

export function bindListeningReport({audio,button,host,profile,assetHash,active,observe,capture}){
  const notice=document.createElement('p');
  notice.className='substitute-listening-report';
  notice.hidden=true;
  const announcement=document.createElement('span');
  announcement.className='substitute-listening-report-announcement';
  announcement.setAttribute('role','status');
  host.append(notice,announcement);
  let currentGap;
  let lastPosition=audio.currentTime;
  let lastAdvance=-Infinity;
  let stalled=false;
  function clear(){
    lastPosition=audio.currentTime;
    lastAdvance=-Infinity;
    currentGap=null;
    notice.hidden=true;
    announcement.textContent='';
  }
  function update(){
    const position=audio.currentTime;
    if(!audio.paused&&!audio.seeking&&position>=lastPosition+0.025){
      lastAdvance=performance.now();
      stalled=false;
    }
    lastPosition=position;
    if(!currentGap)return;
    if(!active()||audio.paused||audio.seeking||position>=currentGap.to||audio.ended){clear();return;}
    const next=silenceMessage(currentGap,Math.ceil((currentGap.to-position)/audio.playbackRate));
    if(notice.textContent!==next)notice.textContent=next;
  }
  button.addEventListener('click',event=>{
    if(button.hidden||button.disabled||!active())return;
    const position=audio.currentTime;
    const result=classifyListeningReport(profile,{
      hash:assetHash,position,rate:audio.playbackRate,paused:audio.paused,seeking:audio.seeking,
      ended:audio.ended,error:Boolean(audio.error),readyState:audio.readyState,
      advancing:!stalled&&(position>=lastPosition+0.025||performance.now()-lastAdvance<1500),
    });
    if(result.decision==='planned_silence'){
      event.stopImmediatePropagation();
      currentGap=result.gap;
      update();
      notice.hidden=false;
      announcement.textContent=notice.textContent;
    }
    if(result.decision==='expected_audible')try{capture?.(position);}catch{}
    try{observe?.(result,position);}catch{}
  },{capture:true});
  for(const event of ['pause','seeking','seeked','ended'])audio.addEventListener(event,clear);
  audio.addEventListener('waiting',()=>{stalled=true;clear();});
  audio.addEventListener('playing',()=>{stalled=false;});
  audio.addEventListener('timeupdate',update);
  audio.addEventListener('ratechange',update);
}
