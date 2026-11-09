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
