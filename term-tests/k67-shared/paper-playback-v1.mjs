export function mountPaperPlayback({audio, preview, button, status, onStart, timeAllowed = () => true}) {
  let phase = 'ready';
  let began = false;
  let pending = false;
  const initialLabel = button.textContent;

  function report(outcome, errorCode) {
    document.dispatchEvent(new CustomEvent('k67:paper-audio-playback', {
      detail: {outcome, positionMs: Math.round(audio.currentTime * 1000), errorCode}
    }));
  }

  function refresh() {
    button.disabled = pending || phase === 'ready' && !timeAllowed();
    if (phase === 'ready') return;
    button.hidden = phase === 'playing' || phase === 'ended';
    button.textContent = began ? 'Phát tiếp audio' : initialLabel;
  }

  button.addEventListener('click', async () => {
    if (pending || phase === 'playing' || phase === 'ended' || phase === 'ready' && !timeAllowed()) return;
    preview.pause();
    pending = true;
    refresh();
    try {
      await audio.play();
      if (phase === 'ended' || audio.ended) return;
      if (!began) onStart();
      began = true;
      phase = audio.paused ? 'paused' : 'playing';
      status.textContent = audio.paused ? 'Audio đã tạm dừng. Bấm Phát tiếp audio để tiếp tục.' : 'Đang phát audio thi.';
      report(phase === 'playing' ? 'playing' : 'paused');
    } catch (error) {
      phase = began ? 'paused' : 'ready';
      status.textContent = 'Chưa phát được audio. Bấm nút phát để thử lại.';
      report('play_rejected', error.name === 'NotAllowedError' ? 'PLAY_NOT_ALLOWED' : 'PLAY_FAILED');
    } finally {
      pending = false;
      refresh();
    }
  });

  audio.addEventListener('pause', () => {
    if (phase !== 'playing' || audio.ended) return;
    phase = 'paused';
    status.textContent = 'Audio đã tạm dừng. Bấm Phát tiếp audio để tiếp tục.';
    report('paused');
    refresh();
  });

  audio.addEventListener('ended', () => {
    phase = 'ended';
    status.textContent = 'Bài nghe đã kết thúc. Vui lòng nộp bài.';
    report('ended');
    refresh();
  });

  return {refresh, hasStarted: () => began};
}
