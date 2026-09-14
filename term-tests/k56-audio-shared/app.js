(function () {
  'use strict';
  const config = window.K56_AUDIO_BACKUP_CONFIG || {};
  const status = document.getElementById('audioStatus');
  const progress = document.getElementById('audioProgress');
  const progressText = document.getElementById('audioProgressText');
  const previewButton = document.getElementById('previewAudio');
  const playButton = document.getElementById('playAudio');
  const retryButton = document.getElementById('retryAudio');
  const resumeButton = document.getElementById('resumeAudio');
  const previewAudio = document.getElementById('previewPlayer');
  const mainAudio = document.getElementById('mainPlayer');
  const modal = document.getElementById('volumeModal');
  const previewStatus = document.getElementById('previewStatus');
  const confirmButton = document.getElementById('confirmVolume');
  const volume = document.getElementById('audioVolume');
  const actions = document.querySelector('.actions');
  let objectUrl = '', controller = null;
  let ready = false, volumeConfirmed = false, started = false, finished = false, disposed = false;
  let recovering = false, loadGeneration = 0;

  const formatBytes = value => `${(Math.max(0, value) / 1048576).toFixed(1)} MB`;
  function refreshButtons() {
    previewButton.disabled = !ready || started || finished;
    playButton.disabled = !ready || !volumeConfirmed || started || finished;
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
    recovering = false;
    previewAudio.pause(); mainAudio.pause();
    cleanupObjectUrl();
    if (modal.open) modal.close();
    actions.hidden = false; progress.hidden = progressText.hidden = false;
    retryButton.hidden = resumeButton.hidden = true;
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
        if (total > 0) progress.value = Math.min(1, loaded / total);
        progressText.textContent = total > 0
          ? `Đã tải: ${Math.round(progress.value * 100)}% (${formatBytes(loaded)} / ${formatBytes(total)})`
          : `Đã tải: ${formatBytes(loaded)}`;
      }
      if (!loaded || (total > 0 && loaded !== total)) throw new Error('Audio chưa tải đầy đủ');
      if (disposed || generation !== loadGeneration) return;
      objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
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
      confirmButton.disabled = false;
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
    if (!ready || !volumeConfirmed || started || finished) return;
    playButton.disabled = true;
    previewAudio.pause();
    mainAudio.currentTime = 0;
    try {
      await mainAudio.play();
      if (disposed) return;
      started = true;
      actions.hidden = true;
      progress.hidden = progressText.hidden = true;
      resumeButton.hidden = true;
      status.textContent = '🎧 Đang phát bài thi. Không làm mới trang; audio không có nút tạm dừng.';
    } catch {
      status.textContent = 'Trình duyệt chưa cho phép phát. Hãy nhấn “PHÁT AUDIO BÀI THI” lần nữa.';
      refreshButtons();
    }
  });
  async function resumeMain() {
    if (!started || finished || disposed || recovering) return;
    recovering = true;
    try {
      // Phát tiếp tại vị trí thực tế của player, không tua về đầu hoặc theo đồng hồ.
      await mainAudio.play();
      resumeButton.hidden = true;
      status.textContent = '🎧 Audio bài thi đang tiếp tục phát.';
    } catch {
      status.textContent = 'Audio bị gián đoạn. Nhấn “Tiếp tục audio” để phát tiếp.';
      resumeButton.hidden = false;
    } finally { recovering = false; }
  }
  mainAudio.addEventListener('pause', () => {
    if (started && !mainAudio.ended) resumeMain();
  });
  mainAudio.addEventListener('error', () => {
    if (!started || disposed) return;
    status.textContent = 'Audio bị gián đoạn. Hãy nhấn “Tiếp tục audio”.';
    resumeButton.hidden = false;
  });
  resumeButton.addEventListener('click', resumeMain);
  mainAudio.addEventListener('ended', () => {
    finished = true; started = false;
    resumeButton.hidden = true;
    status.textContent = '⏹ Bài nghe đã kết thúc. Vui lòng nộp bài.';
  });
  retryButton.addEventListener('click', loadAudio);
  window.addEventListener('pagehide', () => {
    disposed = true; controller?.abort();
    previewAudio.pause(); mainAudio.pause();
    cleanupObjectUrl();
  }, { once: true });
  document.title = config.title || 'Audio Backup · Khóa 56';
  document.getElementById('audioTitle').textContent = document.title;
  const classCode = String(new URLSearchParams(location.search).get('class') || '').trim().toUpperCase();
  document.getElementById('classLabel').textContent = classCode ? `Lớp ${classCode}` : 'Khóa 56';
  if (config.src) loadAudio();
  else { status.textContent = 'Trang chưa được cấu hình audio.'; refreshButtons(); }
}());
