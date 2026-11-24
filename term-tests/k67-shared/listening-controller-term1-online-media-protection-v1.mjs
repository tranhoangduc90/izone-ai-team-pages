import {createListeningPlayer,recordListeningPreparationCommand} from '../shared/listening-player-lifecycle-v2.mjs';
import {createAudioEnvironment} from './audio-environment-online-protected-v1.mjs';

// Nhận player/phiên K67 thật; giữ bài trước khi gọi mạng, chỉ mở lại sau ACK phục hồi.
// Mỗi yêu cầu thử lại giữ nguyên ID/payload. Lỗi telemetry không dừng audio đang nghe.
export function createOnlineListeningProtection({audio, session, slug, apiBase, generation = 0, observePlayback, releaseSource}) {
  if (session.audioProtocolVersion !== 1) return null;
  const token = session.examSessionToken;
  const key = `izone-k67-audio-incident:v1:${slug}:${token}:${generation}`;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* UI báo hạn chế lưu khi ghi lỗi. */ }
  let snapshot = session, pending = stored?.pending || null;
  let held = Boolean(session.activeIncident || pending), stopped = false, suppressPause = false, armed = false;
  let incidentId = session.activeIncident?.incidentId || pending?.incidentId || '';
  let anchor = Number(session.activeIncident?.anchorSeconds ?? pending?.heardSeconds ?? audio.currentTime) || 0;
  let recovering = false, opening = null, sampleHeard = false, ownerLost = false, environment = null;
  let panel, message, sampleButton, continueButton, reportButton, helpButton;
  let inlineContainer,unmuteButton,environmentNotice,outputButton,transferButton;
  let reporting;
  let sampleAudio = null, sampleUrl = '', storageFailed = false, progressPending = false;
  let lastPosition = Number(audio.currentTime) || 0, lastAdvance = performance.now();
  let resumeRequest = stored?.resumeRequest || null, lastMessage = '';
  let eofGate = null, eofPending = false, eofRequest = false, eofRetryAt = 0;
  const reviewOnly=()=>{const duration=Number(snapshot.listeningDurationSeconds??snapshot.timing?.listeningDurationSeconds);
    return !held&&(snapshot.listeningEofVersion===1?Boolean(snapshot.listeningEofAt||eofPending)
      :audio.ended||(duration>0&&Number(snapshot.listeningResumeAtSeconds)>=duration));};
  const callbacks = new AbortController();
  const {signal}=callbacks;
  let nextSkill='listening';
  const interruptionNotice='Âm thanh vừa bị dừng vì vấn đề trên máy của bạn. Hãy đóng các tab trình duyệt và phần mềm không dùng cho bài thi, rồi bấm Nghe tiếp để nghe từ chỗ vừa dừng.';
  const observe=(action,details={})=>{
    const {previous,...fields}=details;
    const playerHistory=previous?.map(({action,sequence,elapsedPageMs,positionMs,command,reason,rate,readyState})=>
      ({action,sequence,elapsedPageMs,positionMs,command,reason,rate,readyState}));
    observePlayback?.(action,{...fields,...(playerHistory?{playerHistory}:{})});
  };
  const lifecycle=createListeningPlayer({audio, isCurrent:()=>!stopped&&!ownerLost,
    skill:()=>nextSkill, emit:observe,
    onInterruption:reason=>{
      if(reason==='error')void automatic('error');
      if(reason==='pause')void automatic('pause');
      if(reason==='confirmed_stall')void automatic('stalled');
    }});
  const command=lifecycle.command;
  const pause=(reason='hold_listening')=>{
    if(audio.paused)return;
    suppressPause=true;
    try{command('pause',reason,()=>audio.pause());}finally{suppressPause=false;}
  };
  const sampleCommand=(sample,name,reason,run)=>recordListeningPreparationCommand(sample,name,reason,run,
    {skill:()=>nextSkill,role:'listening_recovery_sample',emit:observe});
  function persist() {
    try {
      if (held) localStorage.setItem(key, JSON.stringify({pending, resumeRequest}));
      else localStorage.removeItem(key);
    } catch { storageFailed = true; }
  }
  function notify() {
    window.dispatchEvent(new CustomEvent('term-test:listening-protection-updated', {detail: {held, ...snapshot}}));
    render();
  }
  function apply(value) {
    if (stopped || ownerLost || Number(value.audioRevision) < Number(snapshot.audioRevision || 0)) return false;
    snapshot = {...snapshot, ...value};
    if (value.needsTeacher) lastMessage = '';
    if (value.activeIncident) { incidentId = value.activeIncident.incidentId; anchor = value.activeIncident.anchorSeconds; }
    window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated', {detail: snapshot}));
    return true;
  }
  async function request(suffix, data, retry = true) {
    // Dữ liệu chỉ gửi tới backend của phiên; lỗi quyền/xung đột không retry mù.
    const body = JSON.stringify({examSessionToken: token, generation, orderClientVersion: 1, ...data,...(window.K67_AUDIO_OWNER?.fields()||{})});
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(`${apiBase}/api/term-tests/${slug}/session/${suffix}`, {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body, keepalive: suffix === 'audio-incident', signal: AbortSignal.timeout(2500)
        });
        const payload = await response.json();
        if (!response.ok) {if(payload.error==='AUDIO_OWNER_REQUIRED')window.K67_AUDIO_OWNER?.lose();throw Object.assign(new Error(payload.message || 'Chưa kết nối được máy chủ.'), {status: response.status});}
        return payload;
      } catch (error) {
        if (!retry || attempt >= 1 || (error.status && error.status < 500)) throw error;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
  function render(copy) {
    if (!panel) return;
    if (copy !== undefined) lastMessage = copy;
    panel.hidden = !held;
    inlineContainer?.classList.toggle('k67-holding',held);
    // Chỉ mở công cụ xử lý khi đã giữ bài; phục hồi xong trả thanh về một nút báo lỗi.
    if(outputButton)outputButton.hidden=!held;
    if(transferButton)transferButton.hidden=!held;
    if(unmuteButton)unmuteButton.hidden=!(audio.muted||audio.volume===0);
    if(environmentNotice){environmentNotice.textContent=held?'':lastMessage;environmentNotice.title=lastMessage;}
    reportButton.disabled = held || stopped || ownerLost || reviewOnly();
    const teacher = snapshot.needsTeacher;
    message.textContent = ownerLost ? 'Nơi này đã dừng. Quay lại nơi đang giữ quyền hoặc tải lại để xác thực; bài vẫn được giữ.' : lastMessage || (teacher
      ? 'Bài đang được giữ. Bạn cần giáo viên hỗ trợ trước khi tiếp tục; hệ thống chưa thu bài.'
      : pending ? interruptionNotice+' Đã giữ bài trên máy. Đang chờ kết nối để máy chủ xác nhận sự cố.'
        : interruptionNotice);
    if (storageFailed) message.textContent += ' Chưa lưu được sự cố qua tải lại; hãy giữ trang này và nhờ giáo viên.';
    message.title = message.textContent;
    sampleButton.disabled = recovering || teacher || ownerLost;
    continueButton.disabled = recovering || teacher || !sampleHeard || ownerLost;
    helpButton.disabled = recovering;
  }
  async function synchronize() {
    if (opening) return opening;
    opening = (async () => {
      const value = pending ? await request('audio-incident', pending) : await request('audio-state', {});
      if (!apply(value)) return;
      if (!value.activeIncident) throw new Error('Chưa xác nhận được trạng thái giữ bài. Hãy nhờ giáo viên.');
      pending = null; lastMessage = ''; persist(); notify();
      return value;
    })();
    try { return await opening; } finally { opening = null; }
  }
  async function report(reason = 'manual',safePosition=null,reportId=null) {
    if (stopped || ownerLost || reviewOnly() || document.getElementById('listeningView')?.dataset.listeningSubmitting === 'true') return;
    if (!held) {
      held = true; sampleHeard = false; lastMessage = '';
      anchor = Math.max(0, Number(audio.currentTime) || 0); incidentId = reportId??crypto.randomUUID();
      if(Number.isFinite(safePosition))anchor=reason==='media_seek'?Math.max(0,safePosition):Math.min(anchor,Math.max(0,safePosition));
      const draft = window.K67_LISTENING_ADAPTER?.capture() || {};
      pending = {eventId: incidentId, incidentId, heardSeconds: anchor, reason, ...draft};
      pause('incident_'+reason); persist(); notify();
      panel?.querySelector('h3')?.focus();
    }
    try { return await synchronize(); }
    catch { render('Đã giữ bài trên máy, chưa nhận xác nhận từ máy chủ. Kiểm tra mạng rồi thử lại hoặc nhờ giáo viên.'); }
  }
  async function waitForAdvance() {
    const start = performance.now();
    while (performance.now() - start < 2000) {
      const advance = Number(audio.currentTime) - anchor;
      if(stopped||ownerLost||audio.playbackRate!==1)throw new Error('Audio chưa phát đúng tốc độ.');
      if (!audio.paused && !audio.seeking && advance >= 0.1 && advance <= 3) return Number(audio.currentTime);
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw new Error('Audio chưa phát lại.');
  }
  function stopSample() {
    if(sampleAudio){
      const sample=sampleAudio;
      sampleAudio=null;
      if(!sample.paused)sampleCommand(sample,'pause','discard_recovery_sample',()=>sample.pause());
      sampleCommand(sample,'clear_source','discard_recovery_sample',()=>sample.removeAttribute('src'));
      sampleCommand(sample,'load','discard_recovery_sample',()=>sample.load());
    }
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    sampleUrl = '';
  }
  async function resume(automatic = false) {
    if (recovering || stopped || ownerLost || !held || (!automatic && !sampleHeard)) return;
    recovering = true; render('Đang kiểm quyền tiếp tục và khôi phục mốc nghe...');
    try {
      if(audio.muted||audio.volume===0)throw new Error('Audio đang tắt tiếng trong trang. Hãy bật lại âm lượng trước.');
      // Nếu mất ACK confirm: đọc lại trước, không tạo lượt thử/bù lần nữa.
      if (resumeRequest) {
        const prior = await request('audio-state', {});
        if (!apply(prior)) return;
        resumeRequest = null; persist();
        if (!prior.activeIncident) {
          // Máy chủ đã đóng sự cố nhưng player hiện bị dừng: mở sự cố kế tiếp để giữ đúng thời gian.
          held = false; resumeRequest = null; pending = null; persist();
          await report('pause');
        }
      }
      await synchronize();
      if (stopped || ownerLost || snapshot.needsTeacher) return;
      const resumeAttemptId = crypto.randomUUID();
      const prepared = await request('audio-resume', {incidentId, resumeAttemptId, eventId: crypto.randomUUID(), phase: 'prepare', heardSeconds: anchor});
      if (!apply(prepared) || prepared.needsTeacher) return;
      stopSample(); pause();
      if(audio.playbackRate!==1)command('set_rate','restore_normal_rate',()=>{audio.playbackRate=1;});
    command('seek','restore_valid_listening_position',()=>{audio.currentTime=anchor;});
      if (observePlayback) observePlayback('resume_play_requested');
      try { await command('play','resume_listening',()=>audio.play()); }
      catch (error) {
        if (observePlayback) observePlayback('play_rejected', {reason: error?.name === 'NotAllowedError' ? 'play_not_allowed' : 'play_failed'});
        throw error;
      }
      const heardSeconds = await waitForAdvance();
      if(stopped||ownerLost)return;
    resumeRequest = {incidentId, resumeAttemptId, eventId: crypto.randomUUID(), phase: 'confirm', heardSeconds};
      persist();
      const confirmed = await request('audio-resume', resumeRequest);
      if (!apply(confirmed)) { pause(); return; }
      if (confirmed.activeIncident) { pause(); return; }
      held = false; pending = null; resumeRequest = null; sampleHeard = false;
      lastPosition = audio.currentTime; lastAdvance = performance.now();
      persist(); notify();
    } catch (error) {
      pause();
      render(`Bài vẫn được giữ. ${error.message} Hãy thử âm thanh hoặc nhờ giáo viên.`);
    } finally { recovering = false; render(); }
  }
  let reportFlow;
  function attach(container) {
    if (panel) return;
    reportButton = document.createElement('button'); reportButton.type = 'button';
    reportButton.className = 'cbt-button'; reportButton.id = 'k67ReportAudio'; reportButton.textContent = 'Báo lỗi âm thanh';
    container.append(reportButton);
    container.classList.add('k67-inline-audio');container.closest('.cbt-toolbar')?.classList.add('k67-single-row');
    inlineContainer=container;
    environmentNotice=document.createElement('span');environmentNotice.id='k67EnvironmentStatus';environmentNotice.setAttribute('role','status');container.append(environmentNotice);
    unmuteButton=document.createElement('button');unmuteButton.type='button';unmuteButton.id='k67Unmute';unmuteButton.className='cbt-button';unmuteButton.textContent='Bật tiếng';unmuteButton.hidden=true;
    unmuteButton.addEventListener('click',()=>{audio.muted=false;audio.volume=Math.max(.1,audio.volume);render();});container.append(unmuteButton);
    panel = document.createElement('span'); panel.className = 'cbt-audio-incident'; panel.id = 'k67AudioIncident';
    panel.setAttribute('aria-labelledby', 'k67AudioIncidentTitle');
    const title = document.createElement('h3'); title.id = 'k67AudioIncidentTitle'; title.tabIndex = -1; title.textContent = 'Đang giữ bài để kiểm tra âm thanh';
    message = document.createElement('p'); message.setAttribute('role', 'status');
    const controls = document.createElement('div'); controls.className = 'cbt-audio-controls';
    const button = (id, text) => { const node = document.createElement('button'); node.type = 'button'; node.id = id; node.className = 'cbt-button'; node.textContent = text; controls.append(node); return node; };
    sampleButton = button('k67TestSound', 'Thử âm thanh');
    continueButton = button('k67ResumeAudio', 'Nghe tiếp');
    helpButton = button('k67AudioHelp', 'Giáo viên');helpButton.setAttribute('aria-label','Cần giáo viên hỗ trợ');
    panel.append(title, message, controls); container.append(panel);
    outputButton=document.createElement('button');outputButton.type='button';outputButton.className='cbt-button';outputButton.id='k67SelectOutput';outputButton.textContent='Đầu ra';outputButton.hidden=true;
    outputButton.addEventListener('click',()=>environment?.selectOutput());container.append(outputButton);
    if(window.K67_AUDIO_OWNER){
      const transfer=document.createElement('button');transferButton=transfer;transfer.type='button';transfer.className='cbt-button';transfer.id='k67StopForTransfer';transfer.textContent='Chuyển thiết bị';transfer.hidden=true;
      transfer.addEventListener('click',async()=>{if(!window.confirm('Dừng audio và giữ bài tại đây trước khi chuyển tab hoặc thiết bị?'))return;
        await report('manual');try{await window.K67_AUDIO_OWNER.release();transfer.disabled=true;}catch(error){render(error.message+' Giữ nguyên trang và báo giáo viên.');}});container.append(transfer);
    }
    reportFlow=reporting?.attach({audio,button:reportButton,host:container,
      active:()=>armed&&!held&&!stopped&&!ownerLost&&!reviewOnly()&&!audio.ended
        &&document.getElementById('listeningView')?.dataset.listeningSubmitting!=='true',
      onConfirm:({reportId,evidence})=>{
        const operation=report('manual',null,reportId);
        if(incidentId!==reportId)return;
        if(evidence)void reporting.outbox.add(reportId,evidence);
        void operation.then(result=>{
          if(result?.activeIncident)reporting.observe('report_interruption_server_received',
            {reportVersion:2,reportId,operationId:reportId});
        });
      }
    });
    sampleButton.addEventListener('click', async () => {
      stopSample(); pause(); sampleHeard = false;
      // Mẫu thử chỉ là tiếng báo tạo tại máy, không chứa câu hỏi và không xin microphone.
      const samples = 8000, bytes = new ArrayBuffer(44 + samples * 2), view = new DataView(bytes);
      const text = (at, value) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVEfmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, samples * 2, true);
      for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin(i * 440 * Math.PI * 2 / 8000) * 2500 * Math.min(1, i / 100, (samples - i) / 100), true);
      sampleUrl = URL.createObjectURL(new Blob([bytes], {type: 'audio/wav'}));
      const sample=new Audio();
      sampleAudio=sample;
      sampleCommand(sample,'set_source','prepare_recovery_sample',()=>{sample.src=sampleUrl;});
      sample.volume=audio.volume;
      try {
        // Tiếng thử phải dùng cùng loa/tai nghe đã chọn cho bài thi.
        if(audio.sinkId&&sample.setSinkId)await sample.setSinkId(audio.sinkId);
        if(stopped||ownerLost||sample!==sampleAudio)return;
        await sampleCommand(sample,'play','user_recovery_sample',()=>sample.play());
        if(!stopped&&sample===sampleAudio){sampleHeard=true;render('Bạn có nghe rõ tiếng thử không? Nếu có, bấm Nghe tiếp.');} }
      catch { render('Trình duyệt chưa phát được mẫu thử. Kiểm âm lượng/tai nghe rồi nhấn thử lại.'); }
    });
    continueButton.addEventListener('click', () => resume(false));
    helpButton.addEventListener('click', () => {
      pause();render('Giữ nguyên trang và báo giáo viên. Bài chưa được thu; giáo viên sẽ kiểm tra thiết bị và hướng dẫn cách tiếp tục.');
      const dialog=document.createElement('dialog'),copy=document.createElement('p'),close=document.createElement('button');
      copy.textContent=message.textContent;close.type='button';close.textContent='Đóng';dialog.append(copy,close);document.body.append(dialog);
      close.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{dialog.remove();helpButton.focus();});dialog.showModal();
    });
    if (held) { pause(); notify(); synchronize().catch(() => render()); }
    else notify();
  }
  async function automatic(reason) {
    if (!armed || held || stopped || ownerLost || recovering || document.getElementById('listeningView')?.dataset.listeningSubmitting === 'true') return;
    await report(reason, lastPosition);
    // Sau khi audio dừng thật, học viên chọn nghe thử và tiếp tục trong hộp xử lý sự cố.
  }
  audio.addEventListener('pause', () => {
    if (!suppressPause && audio.paused && !audio.ended) void automatic('pause');
  },{signal});
  audio.addEventListener('play',()=>{if(ownerLost||(held&&!recovering))pause('unauthorized_play');},{signal});
  audio.addEventListener('volumechange',()=>{
    observe('audio_observed',{playerId:lifecycle.playerId,event:'volumechange',
      positionMs:Math.round(audio.currentTime*1000),muted:audio.muted,volume:audio.volume});
    render();
  },{signal});
  for(const event of ['offline','online'])window.addEventListener(event,()=>{
    observe('audio_network_state',{playerId:lifecycle.playerId,event,
      positionMs:Math.round(audio.currentTime*1000),visibility:document.visibilityState});
  },{signal});
  audio.addEventListener('seeking',()=>{
    if (!armed || held || stopped || recovering || Math.abs(audio.currentTime-lastPosition)<.25) return;
    observe('audio_observed',{playerId:lifecycle.playerId,event:'seeking',source:'unknown',
      positionMs:Math.round(audio.currentTime*1000),lastValidPositionMs:Math.round(lastPosition*1000)});
    void automatic('media_seek');
  },{signal});
  audio.addEventListener('timeupdate',()=>{
    if(!armed||held||stopped||recovering||audio.paused||audio.seeking||audio.playbackRate!==1)return;
    const now=performance.now(),position=audio.currentTime;
    if(position>=lastPosition-.15&&position<=lastPosition+(now-lastAdvance)/1000+.35){
      if(position>lastPosition){lastPosition=position;lastAdvance=now;}
    }else{
      observe('audio_observed',{playerId:lifecycle.playerId,event:'unexpected_position',source:'unknown',
        positionMs:Math.round(position*1000),lastValidPositionMs:Math.round(lastPosition*1000)});
      void automatic('media_seek');
    }
  },{signal});
  async function sendEof() {
    if (!eofPending || eofRequest || held || stopped || performance.now() < eofRetryAt) return;
    eofRequest = true;
    eofRetryAt = performance.now() + 10_000;
    try {
      const value = await request('audio-progress', { heardSeconds: audio.currentTime, state: 'ended' }, false);
      if (apply(value) && value.listeningEofAt) {
        eofPending = false; notify();
        eofGate?.recordReview?.('review_server',value.listeningEofAt,value.listeningDeadlineAt);
      }
    } catch { /* Keep the exam open and retry after reconnect. */ }
    finally { eofRequest = false; }
  }
  audio.addEventListener('ratechange', () => {
    eofGate?.recordRate();
    observe('audio_observed',{playerId:lifecycle.playerId,event:'ratechange',
      positionMs:Math.round(audio.currentTime*1000),rate:audio.playbackRate});
    if(audio.playbackRate!==1)void automatic('media_seek');
  },{signal});
  audio.addEventListener('ended', event => {
    if (!armed || held || stopped) return;
    if (snapshot.listeningEofVersion === 1 || eofGate) {
      if (eofGate?.confirmEnd(event)) { eofPending = true; void sendEof(); }
      return;
    }
    request('audio-progress', {heardSeconds: audio.currentTime, state: 'playing'}, false).then(apply).catch(() => {});
  },{signal});
  const progress = setInterval(async () => {
    if (eofPending) { await sendEof(); return; }
    if (!armed || held || stopped || progressPending || audio.paused || audio.ended) return;
    progressPending = true;
    try {
      const value = await request('audio-progress', {heardSeconds: audio.currentTime, state: 'playing'}, false);
      if (!apply(value)) return;
      if (snapshot.activeIncident) { held = true; pause('server_incident'); notify(); }
    } catch { /* Nhịp sau sẽ gửi mốc mới; không pause vì lỗi API tiến độ. */ }
    finally { progressPending = false; }
  }, 5000);
  const online = () => { if (held) synchronize().catch(() => render()); if (eofPending) { eofRetryAt = 0; void sendEof(); } };
  window.addEventListener('online', online);
  const leaving = () => { if (armed && !held && !stopped && !audio.ended) report('reload'); };
  window.addEventListener('pagehide', leaving);
  const lost=()=>{
    ownerLost=true;
    held=true;
    notify();
    stop('audio_owner_lost');
  };window.addEventListener('k67:audio-owner-lost',lost);
  environment=createAudioEnvironment({audio,isHeld:()=>held||ownerLost||stopped,observe: (event,fields)=>
    observe(event,{playerId:lifecycle.playerId,positionMs:Math.round(audio.currentTime*1000),...fields}),
    notify:copy=>{lastMessage=copy;render();}});
  function stop(reason='listening_closed', following) {
    if(stopped)return;
    stopped=true;
    nextSkill=following||'listening';
    callbacks.abort();
    reportFlow?.close();
    reporting?.outbox.close();
    stopSample();
    environment.stop();
    clearInterval(progress);
    window.removeEventListener('online',online);
    window.removeEventListener('pagehide',leaving);
    window.removeEventListener('k67:audio-owner-lost',lost);
    lifecycle.retire(reason,{nextSkill:following,releaseSource});
  }
  if (held) pause();
  return {attach, active:lifecycle.active, command, report, stop, configureReports:value=>{reporting=value;},
    // Bắt đầu đã nghe thử ở phòng chờ: xác nhận player tiến trước khi mở thời gian/đáp án.
    start: async () => {if(snapshot.activeIncident?.startup)await resume(true);},
    arm: () => {armed = true; lastPosition = audio.currentTime; lastAdvance = performance.now();}, isHeld: () => held, getSnapshot: () => ({held, ...snapshot}),
    requireEof: gate => { eofGate = gate; snapshot = { ...snapshot, listeningEofVersion: 1 }; },
    canAutoSubmit: () => snapshot.listeningEofVersion !== 1 || Boolean(snapshot.listeningEofAt && (!eofGate || eofGate.canAutoSubmit()))};
}
