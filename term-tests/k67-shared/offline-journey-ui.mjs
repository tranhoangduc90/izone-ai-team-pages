import { createListeningEofGate, createK67EofObserver } from './listening-eof.mjs?v=20261108-journal-v1';

// Hai luồng thi máy giữ nguyên kho lượt và biên nhận riêng, dùng chung điều khiển.
export async function mountOfflineListeningPlayer({
  host, onReview, onAuto, volume, onVolume, onHold, onReopen, section, timing, verifiedAudio, now, persist,
  reviewStatus = seconds => `Đã nghe hết · Còn ${seconds} giây rà bài`
}) {
  const audio = document.createElement('audio');
  audio.hidden = true;
  audio.id = 'miniJourneyAudio';
  if (Number.isFinite(volume)) audio.volume = Math.max(0.1, Math.min(1, volume));
  const copy = document.createElement('div');
  copy.className = 'cbt-audio-copy';
  const status = document.createElement('span');
  status.className = 'cbt-audio-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Đang kiểm tra audio đã lưu.';
  copy.append(status);
  const controls = document.createElement('div');
  controls.className = 'cbt-audio-controls';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cbt-audio-play';
  button.hidden = true;
  const progress = document.createElement('progress');
  progress.className = 'cbt-audio-progress';
  progress.setAttribute('aria-label', 'Tiến độ phát audio');
  progress.value = 0;
  const volumeLabel = document.createElement('label');
  volumeLabel.className = 'cbt-volume';
  const volumeText = document.createElement('span');
  volumeText.textContent = 'Âm lượng';
  const volumeInput = document.createElement('input');
  volumeInput.setAttribute('aria-label', 'Âm lượng');
  Object.assign(volumeInput, {type:'range', min:'0.1', max:'1', step:'0.1', value:String(audio.volume)});
  volumeInput.addEventListener('input', () => { audio.volume = Number(volumeInput.value); });
  volumeInput.addEventListener('change', () => onVolume?.(audio.volume));
  volumeLabel.append(volumeText, volumeInput);
  controls.append(button, progress, volumeLabel);
  host.append(audio, copy, controls);
  let blob;
  try {
    blob = await verifiedAudio();
  } catch (error) {
    status.textContent = error.message;
    return;
  }
  const url = URL.createObjectURL(blob);
  audio.src = url;
  audio.preload = 'metadata';

  function incidentButton(id, text) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'cbt-button';
    action.id = id;
    action.textContent = text;
    return action;
  }
  const report = incidentButton('k67ReportAudio', 'Tôi không nghe được');
  const cacheStatus = document.createElement('span');
  cacheStatus.className = 'k67-cache-status';
  cacheStatus.textContent = 'Đã lưu audio để khôi phục';
  cacheStatus.title = 'Audio đã được xác minh và lưu trên thiết bị để khôi phục khi mất mạng.';
  const incident = document.createElement('section');
  incident.className = 'cbt-audio-incident';
  incident.setAttribute('aria-labelledby', 'k67AudioIncidentTitle');
  const incidentTitle = document.createElement('h3');
  incidentTitle.id = 'k67AudioIncidentTitle';
  incidentTitle.tabIndex = -1;
  incidentTitle.textContent = 'Đang giữ bài để kiểm tra âm thanh';
  const incidentStatus = document.createElement('p');
  incidentStatus.setAttribute('role', 'status');
  const incidentControls = document.createElement('div');
  incidentControls.className = 'cbt-audio-controls';
  const sample = incidentButton('k67TestSound', 'Thử âm thanh');
  const resume = incidentButton('k67ResumeAudio', 'Đã nghe được · Tiếp tục');
  const help = incidentButton('k67AudioHelp', 'Giáo viên');
  help.setAttribute('aria-label', 'Cần giáo viên hỗ trợ');
  const output = incidentButton('k67SelectOutput', 'Đầu ra');
  const reopen = incidentButton('k67ReopenOfflineAudio', 'Mở lại audio đã lưu');
  incidentControls.append(sample, resume, help, output, reopen);
  incident.append(incidentTitle, incidentStatus, incidentControls);
  host.append(report, cacheStatus, incident);
  const anchor = section.position || 0;
  let last = anchor, stoppedPlayer = false, reviewing = false, lastAuto = -Infinity;
  const observeDecision = createK67EofObserver(audio, {
    mode: 'offline', owner: window.TERM_TEST_BOOTSTRAP,
    configuredDurationSeconds: timing.listeningDurationSeconds, active: () => !stoppedPlayer
  });
  const gate = createListeningEofGate({
    audio, anchorSeconds: anchor, reviewSeconds: timing.listeningReviewSeconds, observeDecision
  });
  let reviewEnd = null;
  let playbackError = '';
  let startingPlayback = false;
  let held = false;
  let finishing = false;
  let sampleHeard = false;
  let tone = null;
  let toneUrl = '';
  const describeIncident = message => {
    incidentStatus.textContent = message;
    incidentStatus.title = message;
  };
  function stopTone() {
    tone?.pause();
    tone = null;
    if (toneUrl) URL.revokeObjectURL(toneUrl);
    toneUrl = '';
  }
  const formatTime = value => {
    const seconds = Math.floor(Math.max(0, value));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  };
  function renderPlayback() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : timing.listeningDurationSeconds;
    progress.max = duration || 1;
    progress.value = reviewing ? progress.max : audio.currentTime;
    button.hidden = held || finishing || reviewing || startingPlayback || (!audio.paused && !playbackError);
    report.disabled = finishing || reviewing || startingPlayback;
    incident.hidden = !held;
    host.classList.toggle('k67-holding', held);
    resume.disabled = !sampleHeard || Boolean(audio.error) || startingPlayback;
    reopen.hidden = !audio.error;
    if (reviewing || finishing) return;
    const resuming = section.position > 0;
    const label = resuming ? 'Nghe tiếp' : 'Phát audio';
    if (button.textContent !== label) button.textContent = label;
    let message = 'Đang mở audio.';
    if (playbackError) message = playbackError;
    else if (!startingPlayback) {
      message = audio.paused ? (resuming ? 'Bấm Nghe tiếp để phát từ mốc đã lưu.' : 'Bấm Phát audio để bắt đầu nghe.')
        : 'Đang phát bài thi · ' + formatTime(audio.currentTime) + ' / ' + formatTime(duration || 0);
    }
    if (status.textContent !== message) status.textContent = message;
  }
  function coveredPosition() {
    let position = anchor;
    for (let i = 0; i < audio.played.length; i += 1) {
      if (audio.played.start(i) > position + 0.25) break;
      position = Math.max(position, audio.played.end(i));
    }
    return Math.min(position, audio.currentTime || 0);
  }
  async function checkpoint() {
    if (stoppedPlayer || section.operationId) return;
    if (!section.eofAt) section.position = Math.max(section.position || 0, coveredPosition());
    else if (reviewEnd !== null) section.reviewRemaining = Math.max(0, Math.ceil(reviewEnd - performance.now()));
    await persist();
  }
  function startReview(restored=false){
    reviewing=true;button.disabled=true;
    host.classList.add('k67-reviewing');
    reviewEnd=performance.now()+(section.reviewRemaining??timing.listeningReviewSeconds*1_000);
    onReview(section.deadline);
    gate.recordReview(restored?'review_restored':'review_local',section.eofAt,section.deadline);
  }
  if(section.eofAt) startReview(true);
  audio.addEventListener('loadedmetadata',()=>{
    if(!section.eofAt&&anchor>0)audio.currentTime=Math.min(anchor,Math.max(0,audio.duration-.02));
  });
  audio.addEventListener('ratechange',gate.recordRate);
  audio.addEventListener('pause',()=>{void checkpoint().catch(()=>{});});
  function holdPlayback(message) {
    if (reviewing || finishing || stoppedPlayer) return;
    held = true;
    onHold(true);
    sampleHeard = false;
    stopTone();
    audio.pause();
    describeIncident(message);
    renderPlayback();
    incidentTitle.focus();
  }
  report.addEventListener('click', () => {
    holdPlayback('Bài và mốc nghe đang được giữ. Kiểm âm lượng, loa hoặc tai nghe rồi thử âm thanh.');
  });
  // Mẫu thử là tiếng báo cục bộ, dùng cùng đầu ra với bài thi.
  function createCheckTone() {
    const sampleRate = 8000;
    const frameCount = 5600;
    const pcm = new DataView(new ArrayBuffer(44 + frameCount * 2));
    const writeText = (offset, text) => {
      for (let i = 0; i < text.length; i += 1) pcm.setUint8(offset + i, text.charCodeAt(i));
    };
    writeText(0, 'RIFF');
    pcm.setUint32(4, pcm.byteLength - 8, true);
    writeText(8, 'WAVEfmt ');
    pcm.setUint32(16, 16, true);
    pcm.setUint16(20, 1, true);
    pcm.setUint16(22, 1, true);
    pcm.setUint32(24, sampleRate, true);
    pcm.setUint32(28, sampleRate * 2, true);
    pcm.setUint16(32, 2, true);
    pcm.setUint16(34, 16, true);
    writeText(36, 'data');
    pcm.setUint32(40, frameCount * 2, true);
    for (let i = 0; i < frameCount; i += 1) {
      const fade = Math.min(1, i / 320, (frameCount - i) / 800);
      pcm.setInt16(44 + 2 * i, 2500 * fade * Math.sin(i * 440 * 2 * Math.PI / sampleRate), true);
    }
    return new Blob([pcm.buffer], {type:'audio/wav'});
  }
  sample.addEventListener('click', async () => {
    stopTone();
    sampleHeard = false;
    renderPlayback();
    sample.disabled = true;
    output.disabled = true;
    try {
      toneUrl = URL.createObjectURL(createCheckTone());
      const speaker = new Audio(toneUrl);
      tone = speaker;
      speaker.volume = audio.volume;
      if (audio.sinkId) await speaker.setSinkId(audio.sinkId);
      if (tone !== speaker) return;
      speaker.addEventListener('ended', () => { if (tone === speaker) stopTone(); }, {once:true});
      await speaker.play();
      if (tone !== speaker) return;
      sampleHeard = true;
      describeIncident(audio.error ? 'Nếu nghe rõ tiếng thử, hãy mở lại audio đã lưu.'
        : 'Nếu nghe rõ tiếng thử, hãy bấm Đã nghe được · Tiếp tục.');
    } catch {
      stopTone();
      describeIncident('Chưa phát được tiếng thử. Hãy kiểm loa, tai nghe hoặc báo giáo viên.');
    } finally {
      sample.disabled = false;
      output.disabled = false;
      renderPlayback();
    }
  });
  help.addEventListener('click', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Hỗ trợ audio Listening');
    const message = document.createElement('p');
    message.textContent = 'Giữ nguyên trang và báo giáo viên để kiểm tra loa hoặc tai nghe. Bài chưa được thu.';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Đóng';
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (!stoppedPlayer) help.focus();
    }, {once:true});
    dialog.append(message, close);
    document.body.append(dialog);
    dialog.showModal();
  });
  output.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.selectAudioOutput || !audio.setSinkId) {
      describeIncident('Trình duyệt chưa chọn đầu ra trong web. Hãy chọn loa hoặc tai nghe trong cài đặt máy.');
      return;
    }
    stopTone();
    sampleHeard = false;
    sample.disabled = true;
    output.disabled = true;
    renderPlayback();
    try {
      const selected = await navigator.mediaDevices.selectAudioOutput();
      if (stoppedPlayer) return;
      await audio.setSinkId(selected.deviceId);
      describeIncident('Đã chọn đầu ra. Thử âm thanh rồi xác nhận tiếp tục.');
    } catch {
      describeIncident('Chưa chọn được đầu ra. Hãy kiểm cài đặt loa hoặc tai nghe.');
    } finally {
      sample.disabled = false;
      output.disabled = false;
    }
  });
  resume.addEventListener('click', async () => {
    if (!held || !sampleHeard || audio.error || startingPlayback) return;
    stopTone();
    if (await startPlayback() && !stoppedPlayer) {
      held = false;
      onHold(false);
      renderPlayback();
      report.focus();
    } else {
      describeIncident('Chưa phát lại được. Hãy thử âm thanh hoặc báo giáo viên.');
    }
  });
  reopen.addEventListener('click', async () => {
    reopen.disabled = true;
    try {
      await checkpoint();
      await onReopen();
    } catch {
      describeIncident('Chưa lưu được tiến độ. Hãy tải bài làm về máy và báo giáo viên.');
      reopen.disabled = false;
    }
  });
  audio.addEventListener('error', () => {
    holdPlayback('Audio gặp lỗi. Nháp vẫn được giữ. Hãy mở lại audio đã lưu.');
  });
  audio.addEventListener('timeupdate',()=>{
    renderPlayback();
    if(audio.currentTime>=last+1){last=audio.currentTime;void checkpoint().catch(()=>{});}
  });
  audio.addEventListener('ended',event=>{
    if(stoppedPlayer || held || finishing || reviewing || !gate.confirmEnd(event))return;
    finishing = true;
    renderPlayback();
    section.position = audio.duration;
    section.eofAt = now();
    section.reviewRemaining = timing.listeningReviewSeconds * 1_000;
    section.deadline = section.eofAt + section.reviewRemaining;
    void persist().then(()=>startReview()).catch(() => {
      finishing = false;
      playbackError = 'Chưa lưu được mốc nghe. Bài sẽ chưa tự nộp.';
      renderPlayback();
    });
  });
  async function startPlayback() {
    if (startingPlayback || reviewing || stoppedPlayer) return;
    startingPlayback = true;
    playbackError = '';
    renderPlayback();
    try {
      await audio.play();
      button.disabled = true;
      return true;
    } catch {
      playbackError = section.position > 0 ? 'Chưa phát được audio. Hãy bấm Nghe tiếp.'
        : 'Trình duyệt chưa phát audio. Hãy bấm Phát audio.';
      button.disabled = false;
      return false;
    } finally {
      startingPlayback = false;
      renderPlayback();
    }
  }
  button.addEventListener('click', startPlayback);
  audio.addEventListener('pause',()=>{if(!reviewing&&!stoppedPlayer)button.disabled=false;renderPlayback();});
  const reviewComplete=()=>reviewEnd!==null&&performance.now()>=reviewEnd&&now()>=section.deadline;
  renderPlayback();
  const tick=setInterval(()=>{
    renderPlayback();
    if(reviewing){
      const seconds=Math.max(0,Math.ceil((reviewEnd-performance.now())/1000));
      status.textContent=reviewStatus(seconds);
      void checkpoint().catch(()=>{});
      if(reviewComplete()&&!section.operationId&&performance.now()-lastAuto>=10_000){lastAuto=performance.now();onAuto();}
    }
  },1000);
  return {
    checkpoint, reviewComplete,
    playFromStart() { if (!reviewing && anchor === 0) void startPlayback(); },
    stop() {
      stoppedPlayer = true;
      clearInterval(tick);
      stopTone();
      audio.pause();
      URL.revokeObjectURL(url);
      host.hidden = true;
    }
  };
}

export function mountOfflineJourneyHeader({host, studentSelect, changed, readStatus, onDownload}) {
  const status = document.createElement('span');
  status.className = 'cbt-journey-sync';
  status.setAttribute('role', 'status');
  const render = () => {
    const message = readStatus();
    if (status.textContent !== message) status.textContent = message;
  };
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'button button-secondary cbt-journey-download';
  download.setAttribute('aria-label', 'Tải bài làm về máy');
  download.title = 'Tải bài làm về máy';
  const fullLabel = document.createElement('span');
  fullLabel.className = 'cbt-journey-download-full';
  fullLabel.textContent = 'Tải bài làm về máy';
  const shortLabel = document.createElement('span');
  shortLabel.className = 'cbt-journey-download-short';
  shortLabel.textContent = 'Tải bài';
  download.append(fullLabel, shortLabel);
  download.addEventListener('click', onDownload);
  host.append(status, download);
  if (studentSelect) {
    const compact = matchMedia('(max-width: 620px)');
    const studentLabel = studentSelect.closest('label');
    function placeActions() {
      const focused = document.activeElement === download;
      if (compact.matches && studentLabel) studentLabel.before(download, status);
      else host.append(status, download);
      if (focused) download.focus({preventScroll:true});
    }
    compact.addEventListener('change', placeActions);
    placeActions();
  }
  changed.addEventListener('change', render);
  render();
}
