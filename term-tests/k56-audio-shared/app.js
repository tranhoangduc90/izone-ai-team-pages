(function () {
  'use strict';

  const config = window.K56_AUDIO_BACKUP_CONFIG || {};
  const status = document.getElementById('audioStatus');
  const progress = document.getElementById('audioProgress');
  const progressText = document.getElementById('audioProgressText');
  const previewButton = document.getElementById('previewAudio');
  const playButton = document.getElementById('playAudio');
  const retryButton = document.getElementById('retryAudio');
  const classLabel = document.getElementById('classLabel');
  const previewAudio = document.getElementById('previewPlayer');
  const mainAudio = document.getElementById('mainPlayer');
  let objectUrl = '';
  let controller = null;
  let previewTimer = null;

  function formatBytes(value) {
    if (!Number.isFinite(value) || value <= 0) return '0 MB';
    return `${(value / 1048576).toFixed(1)} MB`;
  }

  function setReady(ready) {
    previewButton.disabled = !ready;
    playButton.disabled = !ready;
    retryButton.hidden = ready;
  }

  function cleanupObjectUrl() {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }

  async function loadAudio() {
    controller?.abort();
    controller = new AbortController();
    clearTimeout(previewTimer);
    previewAudio.pause();
    mainAudio.pause();
    cleanupObjectUrl();
    setReady(false);
    retryButton.hidden = true;
    status.textContent = 'Đang tải đầy đủ audio dự phòng...';
    progress.value = 0;
    progressText.textContent = 'Đã tải 0%';

    try {
      const response = await fetch(config.src, { cache: 'no-store', signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;
        chunks.push(value);
        loaded += value.byteLength;
        if (total > 0) {
          progress.value = Math.min(1, loaded / total);
          progressText.textContent = `Đã tải ${Math.round(progress.value * 100)}% · ${formatBytes(loaded)} / ${formatBytes(total)}`;
        } else {
          progressText.textContent = `Đã tải ${formatBytes(loaded)}`;
        }
      }
      if (!loaded) throw new Error('Audio rỗng');
      objectUrl = URL.createObjectURL(new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mpeg' }));
      previewAudio.src = objectUrl;
      mainAudio.src = objectUrl;
      progress.value = 1;
      progressText.textContent = `Đã tải 100% · ${formatBytes(loaded)}`;
      status.textContent = 'Audio đã sẵn sàng.';
      setReady(true);
    } catch (error) {
      if (error.name === 'AbortError') return;
      status.textContent = `Không tải được audio: ${error.message}.`;
      retryButton.hidden = false;
    }
  }

  previewButton.addEventListener('click', async () => {
    clearTimeout(previewTimer);
    mainAudio.pause();
    previewAudio.currentTime = 0;
    try {
      await previewAudio.play();
      status.textContent = 'Đang phát thử 30 giây đầu.';
      previewTimer = setTimeout(() => {
        previewAudio.pause();
        status.textContent = 'Đã nghe thử xong. Audio chính vẫn sẵn sàng.';
      }, 30000);
    } catch {
      status.textContent = 'Trình duyệt chưa cho phép phát. Hãy nhấn “Nghe thử 30 giây” lần nữa.';
    }
  });

  playButton.addEventListener('click', async () => {
    clearTimeout(previewTimer);
    previewAudio.pause();
    mainAudio.currentTime = 0;
    try {
      await mainAudio.play();
      document.querySelector('.actions').hidden = true;
      status.textContent = 'Đang phát audio bài thi từ đầu.';
    } catch {
      status.textContent = 'Trình duyệt chưa cho phép phát. Hãy nhấn “Phát audio bài thi” lần nữa.';
    }
  });

  mainAudio.addEventListener('ended', () => {
    status.textContent = 'Audio bài thi đã phát xong.';
  });
  retryButton.addEventListener('click', loadAudio);
  window.addEventListener('pagehide', cleanupObjectUrl, { once: true });

  document.title = config.title || 'Audio Backup · Khóa 56';
  document.getElementById('audioTitle').textContent = config.title || 'Audio Backup · Khóa 56';
  const classCode = String(new URLSearchParams(location.search).get('class') || '').trim().toUpperCase();
  classLabel.textContent = classCode ? `Lớp ${classCode}` : 'Khóa 56';
  if (!config.src) {
    status.textContent = 'Trang chưa được cấu hình file audio.';
    retryButton.hidden = true;
    return;
  }
  loadAudio();
}());
