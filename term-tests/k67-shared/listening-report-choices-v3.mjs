import { classifyListeningReport, silenceMessage } from '../substitute-shared/listening-report-v1.mjs';
import { captureListeningEvidence } from '../term-test-2-computer-based/listening-report-evidence-v1.mjs';

const label='Báo lỗi âm thanh';
const devices=[
  ['wired_headphones','Headphone có dây'],
  ['wireless_headphones','Headphone không dây'],
  ['external_speaker','Loa ngoài']
];
const milliseconds=value=>Math.round(value*1000)/1000;

function captureAvailableView(audio,positionSeconds){
  const reportedAt=new Date().toISOString();
  let view=null;
  try{
    const form=document.getElementById('listeningView');
    if(form?.isConnected&&!form.hidden)view=captureListeningEvidence({player:audio,form,reportedAt,positionSeconds});
  }catch{}
  return {positionSeconds,reportedAt,view};
}

export function attachListeningReportChoices({profile,audio,button,host,assetHash,active,observe,onConfirm,
  interceptClick,blockedReport,captureEvidence=position=>captureAvailableView(audio,position)}){
  if(!audio)return {close(){}};
  const lifecycle=new AbortController();
  const {signal}=lifecycle;
  button.textContent=label;
  const notice=document.createElement('p');
  notice.className='substitute-listening-report';
  notice.hidden=true;
  const announcement=document.createElement('span');
  announcement.className='substitute-listening-report-announcement';
  announcement.setAttribute('role','status');
  host.append(notice,announcement);
  let gap,dialog,current;
  let lastPosition=audio.currentTime,lastAdvance=-Infinity,stalled=false;

  function clearNotice(){
    gap=null;
    notice.hidden=true;
    announcement.textContent='';
  }
  function observeReport(phase,report,fields={}){
    try{observe(phase,{reportVersion:2,reportId:report.id,...fields});}catch{}
  }
  function dismiss(phase,restoreFocus=false){
    if(!dialog)return;
    const {id,issue}=current;
    dialog.close();
    dialog.remove();
    dialog=null;
    current=null;
    if(phase)observeReport(phase,{id},issue?{issue}:{});
    if(restoreFocus&&button.isConnected)button.focus({preventScroll:true});
  }
  function update(){
    const position=audio.currentTime;
    if(!audio.paused&&!audio.seeking&&position>=lastPosition+0.025){
      lastAdvance=performance.now();
      stalled=false;
    }
    lastPosition=position;
    if(dialog&&!active())dismiss('report_no_longer_active');
    if(!gap)return;
    if(!active()||audio.paused||audio.seeking||position>=gap.to||audio.ended){clearNotice();return;}
    const next=silenceMessage(gap,Math.ceil((gap.to-position)/audio.playbackRate));
    if(notice.textContent!==next)notice.textContent=next;
  }

  function choice(text,action){
    const item=document.createElement('button');
    Object.assign(item,{type:'button',className:'button button-secondary',textContent:text});
    item.addEventListener('click',action);
    return item;
  }
  function confirm(issue,device){
    const report=current;
    if(!active()){dismiss('report_no_longer_active');return;}
    if(!device)observeReport('report_issue_selected',report,{issue});
    if(device)observeReport('report_device_selected',report,{issue,device});
    let evidence;
    const positionSeconds=audio.currentTime;
    // The existing provider checks the evidence against the interruption time and position.
    if(assetHash===profile.sha256&&profile.audibleWindows.some(([from,to])=>positionSeconds>=from&&positionSeconds<to)){
      try{evidence=captureEvidence(positionSeconds);}catch{}
    }
    dismiss();
    observeReport('report_interruption_requested',report,{issue,positionSeconds:milliseconds(positionSeconds),
      ...(device?{device}:{})});
    onConfirm({reportId:report.id,evidence});
  }
  function showDeviceChoices(title,actions){
    current.issue='distorted';
    observeReport('report_issue_selected',current,{issue:current.issue});
    title.textContent='Bạn đang dùng thiết bị âm thanh nào?';
    actions.replaceChildren(...devices.map(([device,text])=>choice(text,()=>confirm('distorted',device))));
    title.focus({preventScroll:true});
    observeReport('report_device_prompt_opened',current,{issue:current.issue});
  }
  function showChoices(report){
    current=report;
    dialog=document.createElement('dialog');
    dialog.id='k67ListeningReportChoices';
    dialog.className='cbt-identity-confirmation-dialog';
    dialog.setAttribute('aria-labelledby','k67ListeningReportTitle');
    const card=document.createElement('div');
    card.className='cbt-identity-confirmation-card';
    const title=document.createElement('h2');
    title.id='k67ListeningReportTitle';
    title.tabIndex=-1;
    title.textContent=label;
    card.append(title);
    let interruptionNotice;
    if(report.blocked){
      interruptionNotice=document.createElement('div');
      interruptionNotice.className='cbt-listening-unavailable';
      interruptionNotice.id='k67ListeningUnavailable';
      const problem=document.createElement('strong');
      problem.textContent='Âm thanh gặp sự cố và không thể nghe tiếp trong lượt Listening này. Hãy chọn tình trạng âm thanh bên dưới.';
      const guidance=document.createElement('p');
      guidance.textContent='Bài thi listening cần được nghe liền mạch không trục trặc để đánh giá đúng năng lực thí sinh. Khi bạn không nghe được âm thanh, bạn không nên tiếp tục listening. Hãy tiếp tục làm kỹ năng tiếp theo, và sau buổi thi hãy liên hệ giảng viên để được nhận bài Listening thay thế.';
      interruptionNotice.append(problem,guidance);
      card.append(interruptionNotice);
      dialog.setAttribute('aria-describedby',interruptionNotice.id);
    }
    const actions=document.createElement('div');
    actions.className='k67-listening-report-choices';
    if(!report.blocked&&report.decision==='unverified'){
      const check=document.createElement('p');
      check.textContent='Hãy nghe thêm một chút để kiểm tra. Chỉ chọn báo lỗi nếu bạn vẫn gặp sự cố âm thanh.';
      card.append(check);
    }
    actions.append(choice('Tôi không nghe thấy âm thanh',()=>confirm('no_sound')),
      choice('Tôi nghe thấy âm thanh nhưng bị rè',()=>{
        card.replaceChildren(title,...(interruptionNotice?[interruptionNotice]:[]),actions);
        showDeviceChoices(title,actions);
      }));
    const footer=document.createElement('div');
    footer.className='cbt-identity-confirmation-actions';
    footer.append(choice('Cancel',()=>dismiss('report_cancelled',true)));
    card.append(actions,footer);
    dialog.append(card);
    dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss('report_cancelled',true);});
    document.body.append(dialog);
    dialog.showModal();
    title.focus({preventScroll:true});
    observeReport('report_dialog_opened',report,report.blocked||{});
  }

  button.addEventListener('click',event=>{
    if(interceptClick&&!interceptClick(event))return;
    if(dialog||!active()||audio.ended)return;
    const position=audio.currentTime;
    const sample={hash:assetHash,position,rate:audio.playbackRate,paused:audio.paused,seeking:audio.seeking,
      ended:audio.ended,error:Boolean(audio.error),readyState:audio.readyState,
      advancing:!stalled&&(position>=lastPosition+0.025||performance.now()-lastAdvance<1500)};
    const blocked=blockedReport?.();
    const result=blocked?{decision:'unverified',reason:'recovery_unavailable'}:classifyListeningReport(profile,sample);
    const report={id:crypto.randomUUID(),decision:result.decision,blocked};
    const nearest=profile.readingGaps.reduce((closest,window)=>{
      const distance=Math.min(Math.abs(position-window.from),Math.abs(position-window.to));
      return !closest||distance<closest.distance?{window,distance}:closest;
    },null)?.window;
    observeReport('manual_report_classified',report,{
      mapVersion:profile.version,assetHash,positionSeconds:milliseconds(position),decision:result.decision,
      ...(result.reason?{reason:result.reason}:{}),...(blocked||{}),
      ...(nearest?{gapId:nearest.id,part:nearest.part,questions:nearest.questions,gapFromSeconds:nearest.from,
        gapToSeconds:nearest.to,offsetFromStartSeconds:milliseconds(position-nearest.from),
        offsetFromEndSeconds:milliseconds(position-nearest.to)}:{}),
      ...(result.remainingSeconds===undefined?{}:{remainingSeconds:result.remainingSeconds}),
      playbackRate:sample.rate,paused:sample.paused,seeking:sample.seeking,advancing:sample.advancing,
      readyState:sample.readyState,networkState:audio.networkState,visibility:document.visibilityState
    });
    if(result.decision==='planned_silence'){
      gap=result.gap;
      notice.hidden=false;
      update();
      announcement.textContent=notice.textContent;
      observeReport('report_silence_notice_shown',report);
    }else{
      clearNotice();
      showChoices(report);
    }
  },{signal,capture:Boolean(interceptClick)});
  function reset(){
    lastPosition=audio.currentTime;
    lastAdvance=-Infinity;
    clearNotice();
  }
  for(const event of ['pause','seeking','seeked'])audio.addEventListener(event,reset,{signal});
  audio.addEventListener('ended',()=>{reset();dismiss('report_no_longer_active');},{signal});
  audio.addEventListener('waiting',()=>{stalled=true;reset();},{signal});
  audio.addEventListener('playing',()=>{stalled=false;},{signal});
  audio.addEventListener('timeupdate',update,{signal});
  audio.addEventListener('ratechange',update,{signal});
  return {close(){dismiss('report_no_longer_active');lifecycle.abort();clearNotice();}};
}
