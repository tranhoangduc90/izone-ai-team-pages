import {createListeningPlayer,recordListeningPreparationCommand} from '../shared/listening-player-lifecycle-v2.mjs';
import {bindListeningRecovery} from '../shared/listening-recovery-v1.mjs';
import {createListeningEofGate,createK67EofObserver} from './listening-eof.mjs?v=20261108-journal-v1';

const recoverableNotice = 'Âm thanh vừa bị dừng vì vấn đề trên máy của bạn. Hãy đóng các tab trình duyệt và phần mềm không dùng cho bài thi, rồi bấm Nghe tiếp để nghe từ chỗ vừa dừng.';
const blockedNotice = 'Âm thanh gặp sự cố và không thể nghe tiếp trong lượt Listening này.';

export function prepareProtectedContinuityAudio(blob,observe) {
  const audio = document.createElement('audio');
  const url = URL.createObjectURL(blob);
  const pending = new AbortController();
  const {signal} = pending;
  const command=(name,reason,run)=>recordListeningPreparationCommand(audio,name,reason,run,{
    skill:()=> 'listening',emit:observe
  });
  const entry={audio,url,canPlay:false,ready:null,releaseSource,release};
  audio.hidden=true;
  audio.preload='auto';
  let released=false;
  entry.ready=new Promise((resolve,reject)=>{
    const fail=()=>reject(new Error('Chưa chuẩn bị được trình phát Listening trên thiết bị.'));
    const timer=setTimeout(()=>{fail();pending.abort();},15_000);
    signal.addEventListener('abort',()=>{clearTimeout(timer);fail();},{once:true});
    audio.addEventListener('error',()=>{fail();pending.abort();},{signal,once:true});
    audio.addEventListener('canplay',()=>{
      clearTimeout(timer);
      entry.canPlay=true;
      observe('audio_player_ready');
      resolve();
    },{signal,once:true});
  });
  void entry.ready.catch(()=>{});
  command('set_source','prepare_verified_audio',()=>{audio.src=url;});
  return entry;

  function releaseSource() {
    if(released)return;
    released=true;
    pending.abort();
    URL.revokeObjectURL(url);
  }
  function release() {
    if(released)return;
    command('clear_source','discard_prepared_player',()=>audio.removeAttribute('src'));
    command('load','discard_prepared_player',()=>audio.load());
    audio.remove();
    releaseSource();
  }
}

export function mountProtectedContinuityListeningPlayer({
  host,entry,section,timing,now,persist,onReview,onAuto,onReport,canReport,volume,onVolume,onPlaying,observe,
  observeDecision,attachReport,saveCheckpoint,isCurrent,nextSkill
}) {
  const audio=entry?.audio;
  const callbacks=new AbortController();
  const {signal}=callbacks;
  const status=document.createElement('p');
  status.className='cbt-audio-status';
  status.setAttribute('role','status');
  const notice=document.createElement('p');
  notice.className='cbt-listening-recovery-notice';
  notice.hidden=true;
  notice.setAttribute('role','alert');
  const time=document.createElement('span');
  time.className='cbt-listening-duration';
  time.setAttribute('role','timer');
  time.hidden=true;
  const button=(id,label)=>{
    const control=document.createElement('button');
    Object.assign(control,{id,type:'button',className:'cbt-button',textContent:label});
    return control;
  };
  const play=button('k67PlayOfflineAudio','Phát audio');
  const report=button('k67ReportAudio','Báo lỗi âm thanh');
  host.append(status,time,notice,play,report);
  let stopped=false,starting=false,reportRequested=false,reporting=false;
  let reviewUntil=null,reviewPending=false,lastAuto=-Infinity,autoReported,retryReport;
  let recovery;
  let resumeReady=Boolean(entry?.canPlay);
  const active=()=>isCurrent()&&!stopped&&!section.operationId&&!section.eofAt&&!reportRequested;
  const lifecycle=audio?createListeningPlayer({audio,isCurrent:active,skill:nextSkill,emit:observe,
    onInterruption:reason=>recovery?.interrupt(reason)}):null;
  const gate=audio?createListeningEofGate({audio,anchorSeconds:(section.listeningCheckpoint?.positionMs||0)/1000,
    reviewSeconds:timing.listeningReviewSeconds,
    observeDecision:createK67EofObserver(audio,{mode:'offline',owner:window.TERM_TEST_BOOTSTRAP,
      configuredDurationSeconds:timing.listeningDurationSeconds,active:()=>!stopped})}):null;
  const emit=(action,data)=>observe(action,{section:'listening',playerId:lifecycle.playerId,...data});
  const durationMs=Math.round(timing.listeningDurationSeconds*1000);
  const blockedReport=()=>recovery?.state.phase==='paused'&&!recovery.state.canResume
    ? {interruptionId:recovery.state.interruption.id,playerId:lifecycle.playerId,positionMs:recovery.state.positionMs}
    : null;
  const reportFlow=attachReport({audio,button:report,host,blockedReport,
    active:()=>active()&&canReport(),onConfirm:saveReport});

  function render(state) {
    const held=state.phase==='paused'||state.phase==='resuming';
    time.hidden=state.phase==='starting'||state.phase==='ended';
    if(!time.hidden){
      const seconds=Math.ceil(state.remainingMs/1000);
      const elapsed=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
      const label=`Còn ${elapsed} audio`;
      if(time.textContent!==label)time.textContent=label;
    }
    notice.hidden=!held;
    if(held){
      notice.textContent=state.phase==='resuming'||state.canResume?recoverableNotice:blockedNotice;
      const preparing=state.canResume&&state.phase==='paused'&&!resumeReady;
      status.textContent=preparing?'Đồng hồ Listening đang tạm dừng · Đang chuẩn bị âm thanh…':'Đồng hồ Listening đang tạm dừng';
      play.textContent=state.phase==='resuming'?'Đang khôi phục…':'Nghe tiếp';
      play.disabled=preparing||state.phase==='resuming';
      play.hidden=!state.canResume&&state.phase!=='resuming';
    }else if(state.phase==='running'){
      play.hidden=true;
      status.textContent='Đang phát bài thi';
    }
    const blocked=blockedReport();
    if(!blocked||autoReported===blocked.interruptionId)return;
    queueMicrotask(()=>{
      if(!active()||!canReport()||blockedReport()?.interruptionId!==blocked.interruptionId||
        autoReported===blocked.interruptionId)return;
      autoReported=blocked.interruptionId;
      emit('listening_report_auto_open_requested',{...blocked,reason:state.interruption.reason});
      report.click();
    });
  }

  if(audio){
    audio.id='miniJourneyAudio';
    audio.volume=Number.isFinite(volume)?Math.max(0.1,Math.min(1,volume)):1;
    host.prepend(audio);
    const slider=document.createElement('input');
    slider.setAttribute('aria-label','Âm lượng');
    Object.assign(slider,{type:'range',min:'0.1',max:'1',step:'0.1',value:String(audio.volume)});
    slider.addEventListener('input',()=>{audio.volume=Number(slider.value);},{signal});
    slider.addEventListener('change',()=>onVolume?.(audio.volume),{signal});
    host.append(slider);
    recovery=bindListeningRecovery({audio,durationMs,checkpoint:section.listeningCheckpoint,active:lifecycle.active,
      command:lifecycle.command,signal,emit,render,
      save:(checkpoint,transition,remainingMs,interruptionId)=>{
        if(transition==='running')onPlaying();
        saveCheckpoint(checkpoint,transition,remainingMs,lifecycle.playerId,interruptionId);
      }});
    audio.addEventListener('playing',()=>{
      if(active()&&recovery.state.phase==='running'&&!section.playbackConfirmed){
        onPlaying();
        observeDecision('playing',{positionSeconds:audio.currentTime,readyState:audio.readyState});
      }
    },{signal});
    audio.addEventListener('ended',event=>{
      if(!active()||!event.isTrusted)return;
      if(!gate.confirmEnd(event)||!recovery.acceptEnd(event)){
        const state=recovery.state;
        if(state.interrupt('unverified_eof',{recoverable:false})){
          emit('listening_recovery_interrupted',{reason:'unverified_eof',recoverable:false,
            positionMs:state.positionMs,interruptionId:state.interruption.id});
          saveCheckpoint(state.snapshot(),'paused',state.remainingMs,lifecycle.playerId,state.interruption.id);
          render(state);
        }
        return;
      }
      section.position=audio.duration;
      section.eofAt=now();
      section.deadline=section.eofAt+timing.listeningReviewSeconds*1000;
      report.disabled=true;
      play.hidden=true;
      time.hidden=true;
      retire('audio_ended');
      observe('audio_ended',{position:section.position,duration:section.position});
      void persistReview();
    },{signal});
    recovery.restoreView();
    if(!resumeReady&&recovery.state.canResume){
      emit('listening_resume_waiting_for_audio',{positionMs:recovery.state.positionMs});
      void entry.ready.then(()=>{
        if(!active())return;
        resumeReady=true;
        emit('listening_resume_audio_ready',{positionMs:recovery.state.positionMs});
        render(recovery.state);
      },()=>{
        if(!active())return;
        const state=recovery.state;
        const pending=state.beginResume();
        if(!pending||!state.failResume(pending,'audio_unavailable'))return;
        emit('listening_resume_preparation_failed',{reason:'audio_unavailable',
          positionMs:state.positionMs,interruptionId:state.interruption.id});
        saveCheckpoint(state.snapshot(),'local',state.remainingMs,lifecycle.playerId,state.interruption.id);
        render(state);
      });
    } else if(!resumeReady) {
      void entry.ready.then(()=>{resumeReady=true;},()=>{});
    }
  }

  function playFromStart() {
    if(!lifecycle)return;
    if(!lifecycle.active())return lifecycle.command('play','initial_listening_play',()=>audio.play());
    if(!recovery.mayStart()||starting)return;
    starting=true;
    play.hidden=true;
    return lifecycle.command('play','initial_listening_play',()=>audio.play()).catch(error=>{
      if(!active()||!recovery.mayStart())return;
      status.textContent='Trình duyệt chưa cho phát. Hãy bấm Phát audio.';
      play.hidden=false;
      observeDecision('play_rejected',{reason:error?.name==='NotAllowedError'?'play_not_allowed':'play_failed'});
    }).finally(()=>{starting=false;});
  }
  play.addEventListener('click',()=>{
    if(recovery?.mayStart())void playFromStart()?.catch(()=>{});
    else if(resumeReady)void recovery?.resume();
  },{signal});
  report.addEventListener('click',()=>{if(retryReport)void saveReport(retryReport);},{signal});

  async function saveReport(details) {
    if(stopped||reporting||section.eofAt||!canReport())return;
    reporting=true;
    reportRequested=true;
    report.disabled=true;
    play.hidden=true;
    if(audio&&!audio.paused)lifecycle.command('pause','confirmed_interruption',()=>audio.pause());
    try{await onReport(details);retryReport=undefined;}
    catch{
      retryReport=details;
      status.textContent='Chưa lưu được trạng thái gián đoạn. Hãy bấm Báo lỗi âm thanh để thử lưu lại.';
      report.disabled=false;
    }finally{reporting=false;}
  }
  function reviewComplete(){
    return reviewUntil!==null&&performance.now()>=reviewUntil&&now()>=section.deadline;
  }
  function updateReview() {
    if(reviewUntil===null||stopped)return;
    const seconds=Math.max(0,Math.ceil((reviewUntil-performance.now())/1000));
    status.textContent=`Đã nghe hết · Còn ${seconds} giây rà bài`;
    if(reviewComplete()&&!section.operationId&&performance.now()-lastAuto>=2000){
      lastAuto=performance.now();
      onAuto();
    }
  }
  function startReview(restored){
    reviewUntil=performance.now()+Math.max(0,section.deadline-now());
    onReview(section.deadline);
    gate?.recordReview('review_local',section.eofAt,section.deadline);
    observeDecision(restored?'review_restored':'review_started',{eofAtMs:section.eofAt,
      deadlineAtMs:section.deadline,reviewSeconds:timing.listeningReviewSeconds,
      clockSource:restored?'saved_eof':'offline_exam_clock'});
    updateReview();
  }
  async function persistReview(){
    if(stopped||reviewPending)return;
    reviewPending=true;
    try{await persist();if(!stopped)startReview(false);}
    catch{status.textContent='Chưa lưu được mốc kết thúc. Hệ thống sẽ thử lưu lại.';}
    finally{reviewPending=false;}
  }
  function retire(reason) {
    callbacks.abort();
    reportFlow.close();
    lifecycle?.retire(reason,{nextSkill:nextSkill(),operationId:section.operationId,releaseSource:entry?.releaseSource});
  }
  if(section.eofAt){
    report.disabled=true;
    play.hidden=true;
    startReview(true);
  }else if(recovery?.mayStart()){
    status.textContent='Bấm Phát audio để bắt đầu nghe.';
  }
  const timer=setInterval(()=>{
    if(section.eofAt&&reviewUntil===null)void persistReview();
    else updateReview();
  },1000);
  return {reviewComplete,playFromStart,
    pauseForSubmit(){
      if(audio&&!audio.paused)lifecycle.command('pause','early_submit_confirmed',()=>audio.pause());
      play.hidden=true;
    },
    stop(reason='listening_closed'){
      if(stopped)return;
      stopped=true;
      clearInterval(timer);
      retire(reason);
      host.hidden=true;
    }
  };
}

export async function mountProtectedContinuityStart({host,start,journey,volume,onStart,onError}){
  const preview=document.createElement('audio');
  const sample=document.createElement('button');
  const status=document.createElement('p');
  const callbacks=new AbortController();
  const {signal}=callbacks;
  const command=(name,reason,run)=>journey.logListeningPreview(preview,name,reason,run);
  Object.assign(sample,{type:'button',className:'cbt-button',textContent:'Nghe thử',disabled:true});
  preview.hidden=true;
  preview.volume=volume;
  status.setAttribute('role','status');
  status.textContent='Đang chuẩn bị audio đã tải.';
  start.disabled=true;
  host.append(preview,sample,status,start);
  let entry=null, heard=false;
  const update=()=>{
    start.disabled=!(heard&&entry?.canPlay);
    window.IZONE_CBT_AUDIO_START_LABEL(start,!start.disabled);
  };
  const pause=reason=>{
    window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT(preview);
    if(!preview.paused)command('pause',reason,()=>preview.pause());
  };
  function release(){
    if(signal.aborted)return;
    callbacks.abort();
    pause('discard_preview');
    command('clear_source','discard_preview',()=>preview.removeAttribute('src'));
    command('load','discard_preview',()=>preview.load());
    preview.remove();sample.remove();status.remove();start.remove();
  }
  journey.ownListeningPreview(release);
  async function prepare() {
    sample.disabled=true;
    try{
      const candidate=await journey.preparePlayer();
      await candidate.ready;
      if(signal.aborted)return;
      entry=candidate;
      command('set_source','preview_ready',()=>{preview.src=candidate.url+'#t=0,30';});
      sample.textContent='Nghe thử';
      status.textContent='Bấm nút để nghe thử và chỉnh âm lượng.';
    }catch{
      if(signal.aborted)return;
      entry=null;
      sample.textContent='Thử tải lại audio';
      status.textContent='Chưa chuẩn bị được audio bài thi. Hãy thử tải lại.';
    }finally{if(!signal.aborted)sample.disabled=false;}
  }
  sample.addEventListener('click',async()=>{
    if(!entry){await prepare();return;}
    if(!preview.paused){pause('user_stopped_preview');sample.textContent='Nghe thử';return;}
    command('seek','preview_restarted',()=>{preview.currentTime=0;});
    try{
      await command('play','user_preview',()=>preview.play());
      if(signal.aborted)return;
      sample.textContent='Dừng nghe thử';
      window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(preview,start,()=>{
        if(signal.aborted)return;
        heard=true;
        update();
        status.textContent='Đã nghe thử đủ 10 giây.';
      });
    }catch{if(!signal.aborted)status.textContent='Chưa phát được bản nghe thử. Hãy bấm Nghe thử lại.';}
  },{signal});
  preview.addEventListener('ended',()=>{sample.textContent='Nghe thử';},{signal});
  preview.addEventListener('pause',()=>{if(preview.currentTime>=29.95)sample.textContent='Nghe thử';},{signal});
  preview.addEventListener('timeupdate',()=>{
    if(preview.currentTime>=30)pause('preview_reached_limit');
  },{signal});
  start.addEventListener('click',async()=>{
    if(start.disabled)return;
    start.disabled=true;
    sample.disabled=true;
    pause('listening_started');
    journey.markListeningStart();
    try{
      await journey.start('listening');
      if(signal.aborted)return;
      release();
      await onStart();
    }catch(error){
      if(!signal.aborted){update();sample.disabled=false;}
      onError(error);
    }
  },{signal});
  await prepare();
}
