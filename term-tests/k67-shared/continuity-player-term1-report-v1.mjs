import { createListeningEofGate, createK67EofObserver } from './listening-eof.mjs?v=20261108-journal-v1';

export function mountContinuityListeningPlayer({
  host, entry, section, timing, now, persist, onReview, onAuto, onReport, canReport, volume, onVolume, onPlaying, observe,
  observeDecision = () => {}, attachReport
}) {
  const audio = entry?.audio;
  const status = document.createElement('p');
  status.className = 'cbt-audio-status';
  status.setAttribute('role','status');
  host.append(status);
  const action = (id, label) => {
    const button = document.createElement('button');
    Object.assign(button,{id,type:'button',className:'cbt-button',textContent:label});
    host.append(button);
    return button;
  };
  const play = action('k67PlayOfflineAudio','Phát audio');
  const report = action('k67ReportAudio','Báo lỗi âm thanh');
  play.hidden = true;
  const reviewMs = timing.listeningReviewSeconds * 1_000;
  let stopped=false, starting=false, started=false, reporting=false, reportRequested=false, reviewPending=false;
  let reviewUntil = null, lastAuto = -Infinity;
  const diagnostics = new Set();
  const media = new AbortController();
  const {signal} = media;
  const gate = audio && createListeningEofGate({audio,reviewSeconds:timing.listeningReviewSeconds,
    observeDecision:createK67EofObserver(audio,{mode:'offline',owner:window.TERM_TEST_BOOTSTRAP,
      configuredDurationSeconds:timing.listeningDurationSeconds,active:()=>!stopped})});

  function startReview(restored = false) {
    const remaining = Math.max(0, section.deadline - now());
    reviewUntil=performance.now()+remaining;
    onReview(section.deadline);
    gate?.recordReview('review_local',section.eofAt,section.deadline);
    observeDecision(restored ? 'review_restored' : 'review_started', {eofAtMs: section.eofAt,
      deadlineAtMs: section.deadline, reviewSeconds: timing.listeningReviewSeconds,
      clockSource: restored ? 'saved_eof' : 'offline_exam_clock'});
    updateReview();
  }
  function updateReview() {
    if (reviewUntil===null || stopped) return;
    const seconds=Math.max(0,Math.ceil((reviewUntil-performance.now())/1_000));
    status.textContent=`Đã nghe hết · Còn ${seconds} giây rà bài`;
    if (reviewComplete()&&!section.operationId&&performance.now()-lastAuto>=2_000) {
      lastAuto=performance.now();
      onAuto();
    }
  }
  function reviewComplete() { return reviewUntil!==null&&performance.now()>=reviewUntil&&now()>=section.deadline; }
  async function persistReview() {
    if (reviewPending || stopped) return;
    reviewPending=true;
    try { await persist(); if(!stopped)startReview(); }
    catch { status.textContent='Chưa lưu được mốc kết thúc. Hệ thống sẽ thử lưu lại.'; }
    finally { reviewPending=false; }
  }

  if (audio) {
    audio.id='miniJourneyAudio';
    audio.volume=Number.isFinite(volume)?Math.max(0.1,Math.min(1,volume)):1;
    host.prepend(audio);
    const slider = document.createElement('input');
    slider.setAttribute('aria-label','Âm lượng');
    Object.assign(slider,{type:'range',min:'0.1',max:'1',step:'0.1',value:String(audio.volume)});
    slider.addEventListener('input',()=>{audio.volume=Number(slider.value);});
    slider.addEventListener('change',()=>onVolume?.(audio.volume));
    host.append(slider);
    audio.addEventListener('ratechange',gate.recordRate,{signal});
    audio.addEventListener('playing',()=>{
      if (started || stopped || reportRequested || section.operationId) return;
      started=true;
      play.hidden=true;
      status.textContent='Đang phát bài thi';
      onPlaying?.();
      observe('audio_playing',{position:audio.currentTime});
      observeDecision('playing', {positionSeconds:audio.currentTime, readyState:audio.readyState});
    },{signal});
    for(const event of ['waiting','stalled','error','pause']) audio.addEventListener(event,()=>{
      if (audio.ended||reportRequested||section.operationId||diagnostics.has(event))return;
      diagnostics.add(event);
      observe('audio_diagnostic',{event,position:audio.currentTime});
      observeDecision('media_state', {mediaEvent:event, positionSeconds:audio.currentTime, readyState:audio.readyState,
        paused:audio.paused, online:navigator.onLine, visibility:document.visibilityState});
    },{signal});
    audio.addEventListener('ended',event=>{
      if (reportRequested || section.operationId || section.eofAt || !gate.confirmEnd(event)) return;
      report.disabled=true;
      section.position=audio.duration;
      section.eofAt=now();
      section.deadline=section.eofAt+reviewMs;
      observe('audio_ended',{position:audio.currentTime,duration:audio.duration});
      void persistReview();
    },{signal});
  }
  async function playFromStart() {
    if (!audio || started || starting || stopped || reportRequested || section.eofAt || section.operationId) return;
    starting=true;
    play.hidden=true;
    observeDecision('play_requested', {positionSeconds:audio.currentTime, readyState:audio.readyState});
    try { await audio.play(); }
    catch (error) {
      if (!reportRequested && !stopped) {
        observeDecision('play_rejected', {reason:error?.name==='NotAllowedError'?'play_not_allowed':'play_failed'});
        observe('audio_diagnostic',{event:'play_rejected',position:audio.currentTime});
        status.textContent='Trình duyệt chưa cho phát. Hãy bấm Phát audio.';
        play.hidden=false;
      }
    } finally { starting=false; }
  }
  play.addEventListener('click',playFromStart);
  let retryReport;
  const reportFlow=attachReport({audio,button:report,host,
    active:()=>!stopped&&!reportRequested&&!section.eofAt&&!section.operationId&&!audio?.ended&&canReport(),
    onConfirm:saveReport});
  report.addEventListener('click',()=>{if(retryReport)void saveReport(retryReport);},{signal});
  async function saveReport(details){
    if (stopped || reporting || section.eofAt || audio?.ended || !canReport())return;
    reporting=true;
    reportRequested=true;
    play.hidden=true;
    report.disabled=true;
    if (audio && !audio.paused)audio.pause();
    try { await onReport(details); retryReport=undefined; }
    catch {
      retryReport=details;
      status.textContent='Chưa lưu được trạng thái gián đoạn. Hãy bấm lại để lưu trên thiết bị.';
      report.disabled=false;
    } finally { reporting=false; }
  }
  if(section.eofAt){report.disabled=true;startReview(true);}
  else {
    status.textContent='Bấm Phát audio để bắt đầu nghe.';
    play.hidden=false;
  }
  const timer=setInterval(()=>{
    if(section.eofAt&&reviewUntil===null)void persistReview();
    else updateReview();
  },1000);
  return {
    reviewComplete, playFromStart,
    pauseForSubmit(){ if (audio && !audio.paused)audio.pause(); play.hidden=true; },
    stop() {
      stopped=true;
      reportFlow.close();
      media.abort();
      clearInterval(timer);
      entry?.release();
      host.hidden=true;
    }
  };
}
