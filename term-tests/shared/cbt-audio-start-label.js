// Opt in from the CBT entries that use the audio confirmation label.
window.IZONE_CBT_AUDIO_START_LABEL = (button, previewConfirmed = false) => {
  if (previewConfirmed && !button.disabled) {
    button.replaceChildren(
      'Âm thanh đã vừa tai',
      document.createElement('br'),
      'Bắt đầu thi'
    );
  } else if (button.querySelector('br')) {
    button.textContent = 'Bắt đầu thi Listening';
  }
};
