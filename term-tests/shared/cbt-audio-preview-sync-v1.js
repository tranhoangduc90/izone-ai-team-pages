// The countdown and the confirmation use the same amount of verified playback.
(() => {
  const requiredSeconds = 10;
  const waits = new WeakMap();

  function showStatus(button, message) {
    let hint = button.previousElementSibling;
    if (!hint?.matches('[data-audio-start-wait]')) hint = null;
    if (!message || !button.disabled) {
      hint?.remove();
      return;
    }
    if (!hint) {
      hint = document.createElement('p');
      hint.dataset.audioStartWait = '';
      hint.style.cssText = 'margin:0 0 8px;color:#1c3d68;font-weight:600;font-size:14px;line-height:1.4;';
      button.before(hint);
    }
    if (hint.textContent !== message) hint.textContent = message;
  }

  window.IZONE_CBT_AUDIO_START_LABEL = (button, previewConfirmed = false) => {
    if (previewConfirmed && !button.disabled) {
      showStatus(button);
      button.replaceChildren('Đã nghe rõ', document.createElement('br'), 'Bắt đầu thi Listening');
    } else if (button.querySelector('br')) {
      button.textContent = 'Bắt đầu thi Listening';
    }
  };

  window.IZONE_CBT_AUDIO_CANCEL_PREVIEW_WAIT = audio => waits.get(audio)?.();
  window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW = (audio, button, onReady) => {
    waits.get(audio)?.();
    if (audio.paused) return;

    let listened = 0;
    let sample;
    function countdown() {
      return 'Còn khoảng ' + Math.ceil(requiredSeconds - listened) + ' giây để bắt đầu.';
    }

    function suspend() {
      sample = undefined;
    }

    function cancel() {
      suspend();
      for (const [event, handler] of Object.entries(events)) audio.removeEventListener(event, handler);
      waits.delete(audio);
      showStatus(button);
    }

    function measure() {
      if (!sample || audio.seeking || audio.playbackRate !== 1) return;
      const now = performance.now();
      const position = audio.currentTime;
      const advanced = position - sample.position;
      const elapsed = (now - sample.time) / 1000;
      if (advanced === 0) return;
      sample = {position, time: now};
      // Skip a discontinuity. Allow normal jitter in the browser's media clock.
      if (advanced > 0 && advanced <= elapsed + 0.15) listened += advanced;
      if (listened + 1e-6 >= requiredSeconds) {
        cancel();
        onReady();
        if (button.disabled) {
          waits.set(audio, cancel);
          showStatus(button, 'Đã nghe đủ 10 giây. Đang chuẩn bị bài thi…');
        }
      } else {
        showStatus(button, countdown());
      }
    }

    function update() {
      if (!audio.paused) measure();
    }

    function start() {
      if (audio.paused || audio.seeking || audio.playbackRate !== 1 || sample) return;
      sample = {position: audio.currentTime, time: performance.now()};
      showStatus(button, countdown());
    }

    function hold(message) {
      measure();
      suspend();
      if (listened + 1e-6 < requiredSeconds) showStatus(button, message);
    }

    function end() {
      measure();
      const incomplete = listened + 1e-6 < requiredSeconds;
      if (incomplete) {
        cancel();
        waits.set(audio, cancel);
        showStatus(button, 'Chưa nghe đủ 10 giây. Hãy bấm Nghe lại.');
      }
    }

    const events = {
      playing: start,
      timeupdate: update,
      waiting: () => hold('Đang chờ âm thanh tiếp tục…'),
      pause: () => {
        if (audio.ended) end();
        else hold('Đã tạm dừng nghe thử.');
      },
      seeking: suspend,
      seeked: () => {
        if (audio.readyState >= 3) start();
      },
      ratechange: () => {
        suspend();
        if (audio.readyState >= 3) start();
      },
      ended: end,
      emptied: cancel,
      error: cancel
    };
    waits.set(audio, cancel);
    for (const [event, handler] of Object.entries(events)) audio.addEventListener(event, handler);
    if (audio.readyState >= 3) start();
    else showStatus(button, 'Đang chờ âm thanh bắt đầu phát…');
  };
})();
