const currentDownloads = new WeakMap();

const defaultFormatBytes = bytes => new Intl.NumberFormat('vi-VN').format(bytes) + ' byte';

export function beginAudioDownloadStatus(status, progress, {
  signal, formatBytes = defaultFormatBytes, retry = false, preparing = false, keepTrack = false
} = {}) {
  const download = {};
  currentDownloads.set(status, download);
  const originalText = status.textContent;
  const originalValue = progress?.getAttribute('value');
  const originalMax = progress?.getAttribute('max');
  let lastMessage;
  let hasProgress = false;
  if (progress && !progress.hasAttribute('aria-label')) progress.setAttribute('aria-label', 'Tiến độ tải audio');
  const isCurrent = () => currentDownloads.get(status) === download && !signal?.aborted;

  function text(message) {
    if (status.textContent !== message) status.textContent = message;
    lastMessage = message;
  }

  function indeterminate() {
    progress?.removeAttribute('value');
    progress?.setAttribute('data-audio-indeterminate', keepTrack ? 'track' : '');
  }

  function stopIndicator() {
    status.removeAttribute('data-audio-busy');
    if (hasProgress) progress?.removeAttribute('data-audio-indeterminate');
  }

  download.phase = (message, {reset = false} = {}) => {
    if (!isCurrent()) return;
    if (message === 'Đang chờ dữ liệu âm thanh…' && status.textContent !== 'Đang chuẩn bị âm thanh…') return;
    if (reset) { hasProgress = false; indeterminate(); }
    status.setAttribute('data-audio-busy', '');
    text(message);
  };

  download.progress = ({loaded, total, verified = false, reset = false}) => {
    if (!isCurrent()) return;
    if (reset) { hasProgress = false; indeterminate(); }
    if (!Number.isFinite(loaded) || loaded <= 0) return;
    if (!Number.isFinite(total) || total <= 0 || loaded > total) {
      hasProgress = false;
      indeterminate();
      download.phase(`Đang tải audio · ${formatBytes(loaded)}`);
      return;
    }

    hasProgress = true;
    progress?.removeAttribute('data-audio-indeterminate');
    if (progress) {
      progress.max = total;
      progress.value = loaded;
    }
    status.removeAttribute('data-audio-busy');
    const ratio = Math.floor(loaded * 100 / total);
    const percent = ratio === 0 ? '<1%' : `${ratio}%`;
    const label = verified ? 'Đang tải và kiểm tra audio' : 'Đang tải audio';
    text(`${label} · ${percent} · ${formatBytes(loaded)} / ${formatBytes(total)}`);
  };

  download.finish = (message, {ready = false} = {}) => {
    if (!isCurrent()) return;
    if (ready && progress) {
      hasProgress = true;
      progress.max = 1;
      progress.value = 1;
    }
    stopIndicator();
    text(message);
    currentDownloads.delete(status);
  };

  download.restore = () => {
    if (!isCurrent()) return;
    if (status.textContent === lastMessage) text(originalText);
    status.removeAttribute('data-audio-busy');
    progress?.removeAttribute('data-audio-indeterminate');
    if (progress) {
      if (originalValue === null) progress.removeAttribute('value');
      else progress.setAttribute('value', originalValue);
      if (originalMax === null) progress.removeAttribute('max');
      else progress.setAttribute('max', originalMax);
    }
    currentDownloads.delete(status);
  };

  signal?.addEventListener('abort', () => {
    if (currentDownloads.get(status) !== download) return;
    stopIndicator();
    progress?.removeAttribute('data-audio-indeterminate');
    currentDownloads.delete(status);
  }, {once:true});

  if (isCurrent()) {
    indeterminate();
    status.setAttribute('data-audio-busy', '');
    text(retry ? 'Đang thử tải lại…' : preparing ? 'Đang chuẩn bị âm thanh…' : 'Đang chờ dữ liệu âm thanh…');
  }
  return download;
}
