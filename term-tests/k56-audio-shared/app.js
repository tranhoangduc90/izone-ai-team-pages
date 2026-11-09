(function () {
  'use strict';
  const config = window.K56_AUDIO_BACKUP_CONFIG || {};
  const status = document.getElementById('audioStatus');
  const progress = document.getElementById('audioProgress');
  const progressText = document.getElementById('audioProgressText');
  const previewButton = document.getElementById('previewAudio');
  const playButton = document.getElementById('playAudio');
  const retryButton = document.getElementById('retryAudio');
  const reportButton = document.getElementById('reportAudio');
  const previewAudio = document.getElementById('previewPlayer');
  const mainAudio = document.getElementById('mainPlayer');
  const modal = document.getElementById('volumeModal');
  const previewStatus = document.getElementById('previewStatus');
  const confirmButton = document.getElementById('confirmVolume');
  const volume = document.getElementById('audioVolume');
  const actions = document.querySelector('.actions');
  let objectUrl = '', controller = null;
  let ready = false, volumeConfirmed = false, started = false, finished = false, disposed = false;
  let mainReady = false, loadGeneration = 0;
  const classCode = String(new URLSearchParams(location.search).get('class') || '').trim().toUpperCase();
  const tabKey = 'izone:backup-listening:' + location.pathname + ':' + classCode;
  const tabState = () => { try { return sessionStorage.getItem(tabKey); } catch { return null; } };
  const remember = value => {
    try {
      if (value) sessionStorage.setItem(tabKey,value);
      else sessionStorage.removeItem(tabKey);
    } catch { /* A tab with blocked storage can still play the verified audio. */ }
  };

  const formatBytes = value => `${(Math.max(0, value) / 1048576).toFixed(1)} MB`;
  function refreshButtons() {
    previewButton.disabled = !ready || started || finished;
    playButton.disabled = !ready || !mainReady || !volumeConfirmed || started || finished;
  }
  function cleanupObjectUrl() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }
  async function loadAudio() {
    const generation = ++loadGeneration;
    controller?.abort();
    controller = new AbortController();
    ready = volumeConfirmed = started = finished = false;
    mainReady = false;
    previewAudio.pause(); mainAudio.pause();
    cleanupObjectUrl();
    if (modal.open) modal.close();
    actions.hidden = false; progress.hidden = progressText.hidden = false;
    retryButton.hidden = reportButton.hidden = true;
    refreshButtons();
    status.textContent = '⏳ Đang tải audio...';
    progress.value = 0;
    progressText.textContent = 'Đã tải: 0%';
    try {
      const response = await fetch(config.src, { cache: 'no-store', signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (disposed || generation !== loadGeneration) return;
        if (done) break;
        if (!value?.byteLength) continue;
        chunks.push(value); loaded += value.byteLength;
        if (loaded > config.bytes) throw new Error('Audio vượt kích thước đã xác minh');
        if (total > 0) progress.value = Math.min(1, loaded / total);
        progressText.textContent = total > 0
          ? `Đã tải: ${Math.round(progress.value * 100)}% (${formatBytes(loaded)} / ${formatBytes(total)})`
          : `Đã tải: ${formatBytes(loaded)}`;
      }
      if (loaded !== config.bytes || (total > 0 && loaded !== total)) throw new Error('Audio chưa tải đầy đủ');
      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      const bytes = await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
      const sha = Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
      if (sha !== config.sha256) throw new Error('Audio chưa khớp phiên bản bài thi');
      if (disposed || generation !== loadGeneration) return;
      objectUrl = URL.createObjectURL(blob);
      previewAudio.src = mainAudio.src = objectUrl;
      progress.value = 1;
      progressText.textContent = `Đã tải: 100% (${formatBytes(loaded)})`;
      ready = true;
      status.textContent = '✅ Tải xong 100%. Hãy thử và xác nhận âm lượng trước khi phát.';
      refreshButtons();
    } catch (error) {
      if (error.name === 'AbortError' || disposed || generation !== loadGeneration) return;
      status.textContent = `❌ Không tải được audio: ${error.message}. Hãy tải lại.`;
      retryButton.hidden = false;
    }
  }
  async function playPreview() {
    if (!ready || started || finished) return;
    confirmButton.disabled = true;
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewAudio.volume = mainAudio.volume = Number(volume.value);
    try {
      await previewAudio.play();
      if (disposed || !modal.open) { previewAudio.pause(); return; }
      previewStatus.textContent = 'Đang phát 30 giây đầu...';
      window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW(previewAudio,confirmButton,()=>{
        confirmButton.disabled = false;
      });
    } catch {
      previewStatus.textContent = 'Chưa phát được. Hãy nhấn “Nghe lại (30 giây)”.';
    }
  }
  previewButton.addEventListener('click', () => {
    if (!ready || started || finished) return;
    modal.showModal();
    playPreview();
  });
  document.getElementById('replayPreview').addEventListener('click', playPreview);
  previewAudio.addEventListener('timeupdate', () => {
    if (previewAudio.currentTime >= 30) {
      previewAudio.pause();
      previewStatus.textContent = 'Đã dừng sau 30 giây. Có thể nghe lại hoặc xác nhận.';
    }
  });
  volume.addEventListener('input', () => {
    previewAudio.volume = mainAudio.volume = Number(volume.value);
  });
  confirmButton.addEventListener('click', () => {
    if (!ready || confirmButton.disabled) return;
    previewAudio.pause();
    volumeConfirmed = true;
    modal.close();
    status.textContent = '✅ Đã xác nhận âm lượng. Có thể phát audio bài thi.';
    refreshButtons();
  });
  modal.addEventListener('close', () => previewAudio.pause());
  playButton.addEventListener('click', async () => {
    if (!ready || !mainReady || !volumeConfirmed || started || finished) return;
    playButton.disabled = true;
    previewAudio.pause();
    mainAudio.currentTime = 0;
    remember('started');
    try {
      await mainAudio.play();
      if (disposed) return;
      started = true;
      actions.hidden = true;
      progress.hidden = progressText.hidden = true;
      reportButton.hidden = false;
      status.textContent = '🎧 Đang phát bài thi. Không làm mới trang; audio không có nút tạm dừng.';
    } catch {
      remember(null);
      status.textContent = 'Trình duyệt chưa cho phép phát. Hãy nhấn “PHÁT AUDIO BÀI THI” lần nữa.';
      refreshButtons();
    }
  });
  function showInterrupted() {
    finished = true;
    started = false;
    actions.hidden = reportButton.hidden = retryButton.hidden = true;
    progress.hidden = progressText.hidden = true;
    status.textContent = 'Listening gián đoạn. Hãy báo giảng viên.';
    const dialog = document.createElement('dialog');
    dialog.className = 'volume-modal';
    dialog.setAttribute('aria-label','Listening gián đoạn');
    const message = document.createElement('p');
    message.textContent = 'Bài thi listening cần được nghe liền mạch không trục trặc để đánh giá đúng năng lực thí sinh. Khi bạn không nghe được âm thanh, bạn không nên tiếp tục listening. Hãy tiếp tục làm kỹ năng tiếp theo, và sau buổi thi hãy liên hệ giảng viên để được nhận bài Listening thay thế.';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = 'Tôi đã hiểu.';
    confirm.addEventListener('click',()=>{
      remember('acknowledged');
      dialog.close();
      dialog.remove();
    });
    dialog.addEventListener('cancel',event=>event.preventDefault());
    dialog.append(message,confirm);
    document.body.append(dialog);
    dialog.showModal();
  }
  mainAudio.addEventListener('canplay',()=>{
    if (!objectUrl || mainAudio.currentSrc !== objectUrl) return;
    mainReady = true;
    refreshButtons();
  });
  mainAudio.addEventListener('pause',()=>{
    if (started && !mainAudio.ended) status.textContent = 'Audio bị ngắt. Nếu không nghe được, hãy báo giảng viên.';
  });
  mainAudio.addEventListener('error',()=>{
    if (started) status.textContent = 'Không đọc được audio. Hãy báo giảng viên.';
    else if (!finished && !disposed && objectUrl) {
      mainReady = false;
      status.textContent = 'Trình phát chưa sẵn sàng. Hãy tải lại audio.';
      retryButton.hidden = false;
      refreshButtons();
    }
  });
  reportButton.addEventListener('click',()=>{
    if (!started || finished) return;
    remember('interrupted');
    showInterrupted();
    mainAudio.pause();
  });
  mainAudio.addEventListener('ended',()=>{
    if (!started || finished) return;
    finished = true;
    started = false;
    remember('ended');
    reportButton.hidden = true;
    status.textContent = '⏹ Bài nghe đã kết thúc. Vui lòng nộp bài.';
  });
  retryButton.addEventListener('click', loadAudio);
  window.addEventListener('pagehide', () => {
    disposed = true; controller?.abort();
    previewAudio.pause();
    cleanupObjectUrl();
  }, { once: true });
  document.title = config.title || 'Audio Backup · Khóa 56';
  document.getElementById('audioTitle').textContent = document.title;
  document.getElementById('classLabel').textContent = classCode ? `Lớp ${classCode}` : 'Khóa 56';
  const previous = tabState();
  if (previous === 'started' || previous === 'interrupted') showInterrupted();
  else if (previous === 'ended' || previous === 'acknowledged') {
    actions.hidden = progress.hidden = progressText.hidden = true;
    status.textContent = previous === 'ended' ? 'Bài nghe đã kết thúc. Vui lòng nộp bài.' : 'Listening gián đoạn. Hãy báo giảng viên.';
  } else if (config.src) loadAudio();
  else { status.textContent = 'Trang chưa được cấu hình audio.'; refreshButtons(); }
}());
