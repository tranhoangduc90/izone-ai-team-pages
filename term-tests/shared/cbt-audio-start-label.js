// Opt in from the CBT entries that use the audio confirmation label.
window.IZONE_CBT_AUDIO_START_LABEL = (button, previewConfirmed = false) => {
  if (previewConfirmed && !button.disabled) {
    button.replaceChildren(
      'Đã nghe rõ',
      document.createElement('br'),
      'Bắt đầu thi Listening'
    );
  } else if (button.querySelector('br')) {
    button.textContent = 'Bắt đầu thi Listening';
  }
};

window.IZONE_CBT_AUDIO_START_WAIT = (button, remaining) => {
  let hint = button.previousElementSibling;
  if (!hint?.matches('[data-audio-start-wait]')) hint = null;
  if (remaining == null || !button.disabled) {
    hint?.remove();
    return;
  }
  if (!hint) {
    hint = document.createElement('p');
    hint.dataset.audioStartWait = '';
    hint.style.cssText = 'margin:0 0 8px;color:#1c3d68;font-weight:600;font-size:14px;line-height:1.4;';
    button.before(hint);
  }
  const seconds = Math.ceil(remaining);
  const message = seconds > 0
    ? `Còn khoảng ${seconds} giây để bắt đầu.`
    : 'Đang kiểm tra âm thanh…';
  if (hint.textContent !== message) hint.textContent = message;
};

(() => {
  const waits = new WeakMap();
  window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT = audio => waits.get(audio)?.();
  window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW = (audio, button, onReady) => {
    waits.get(audio)?.();
    if (audio.paused) return;

    const requiredSeconds = 10;
    const startedAt = performance.now();
    const startedPosition = audio.currentTime;
    const stopEvents = ['ended', 'emptied', 'error'];
    const render = remaining => window.IZONE_CBT_AUDIO_START_WAIT(button, remaining);
    function cancel() {
      audio.removeEventListener('timeupdate', update);
      audio.removeEventListener('pause', onPause);
      for (const event of stopEvents) audio.removeEventListener(event, cancel);
      waits.delete(audio);
      render();
    }
    function onPause() {
      if (audio.paused) cancel();
    }
    function update() {
      if (audio.paused || audio.seeking) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      const played = audio.currentTime - startedPosition;
      if (elapsed >= requiredSeconds && played >= requiredSeconds && played <= elapsed * 1.05) {
        cancel();
        onReady();
      } else {
        render(requiredSeconds - Math.min(elapsed, played));
      }
    }
    waits.set(audio, cancel);
    audio.addEventListener('timeupdate', update);
    audio.addEventListener('pause', onPause);
    for (const event of stopEvents) audio.addEventListener(event, cancel);
    render(requiredSeconds);
  };
})();
