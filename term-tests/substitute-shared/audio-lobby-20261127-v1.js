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
      hint.className='cbt-preview-status';
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

    let confirmation;
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
      confirmation?.remove();
      audio.removeEventListener('emptied',cancel);audio.removeEventListener('error',cancel);
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
        // Playback progress proves media advancement; only the learner can
        // confirm that the selected speaker/headphones are audible.
        suspend();
        for (const [event, handler] of Object.entries(events)) audio.removeEventListener(event, handler);
        audio.addEventListener('emptied', cancel, {once:true});
        audio.addEventListener('error', cancel, {once:true});
        confirmation=document.createElement('div');
        confirmation.dataset.audioHearingConfirmation='';
        const yes=document.createElement('button'),no=document.createElement('button');
        yes.type=no.type='button';
        yes.className='button button-primary';no.className='button button-secondary';
        yes.textContent='Tôi đã nghe rõ';no.textContent='Tôi chưa nghe được';
        yes.addEventListener('click',()=>{
          if(audio.error || audio.muted || audio.volume===0)return;
          cancel();onReady();
        });
        no.addEventListener('click',()=>{
          cancel();audio.pause();
          showStatus(button,'Hãy kiểm tra loa/tai nghe, tăng âm lượng rồi bấm Nghe lại. Bài thi chưa bắt đầu.');
        });
        confirmation.append(yes,no);button.before(confirmation);
        showStatus(button,'Bạn có nghe rõ âm thanh không?');
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

window.SUBSTITUTE_START_MESSAGE = error => ({
  SUBSTITUTE_SAVE_UNCONFIRMED:'Chưa nhận được xác nhận từ máy chủ. Hãy thử lại cùng lượt; bài thi chỉ mở sau khi được xác nhận.',
  RETAKE_ALREADY_USED:'Bạn đã có lượt làm bài này. Hãy tiếp tục lượt đang làm hoặc mở biên nhận nếu đã nộp.',
  ALREADY_SUBMITTED:'Bài này đã được nộp. Hãy mở biên nhận của lượt đã nộp.',
  ATTEMPT_ALREADY_STARTED:'Lượt thi đã bắt đầu. Hãy quay lại tab và thiết bị đang làm bài.',
  SITTING_CLOSED:'Ca thi đã đóng. Hãy liên hệ giảng viên để được hướng dẫn.',
  SITTING_NOT_ACCEPTING:'Ca thi hiện chưa nhận lượt mới. Hãy kiểm tra trạng thái ca với giảng viên.',
  ATTEMPT_HISTORY_UNAVAILABLE:'Chưa kiểm tra được lịch sử bài này. Hãy thử lại cùng lượt.',
  ASSIGNMENT_REQUIRED:'Chưa xác nhận được quyền làm bài. Hãy kiểm tra lớp, tên và ca thi.',
  FULL_ASSIGNMENT_REQUIRED:'Chưa xác nhận được phiên thi trên thiết bị này. Hãy kiểm tra lại trang vào thi.',
  SESSION_SCOPE_MISMATCH:'Thông tin người học hoặc bài thi đã thay đổi. Hãy quay lại đúng lượt đang làm.',
  ASSIGNMENT_PART_NOT_OPEN:'Phần thi này chưa được giao. Hãy kiểm tra đúng đường link với giảng viên.',
  REGISTRATION_UNAVAILABLE:'Chưa tìm thấy quyền làm bài cho tên và lớp đã chọn. Hãy kiểm tra lại với giảng viên.',
  DEVICE_MISMATCH:'Lượt thi thuộc thiết bị khác. Hãy quay lại thiết bị đã chuẩn bị bài.',
  NATIVE_START_UNCONFIRMED:'Chưa nhận được xác nhận bắt đầu. Hãy thử lại cùng lượt để kiểm tra trạng thái.'
}[error?.code??error?.message] ?? error?.userMessage ?? error?.message ?? 'Chưa xác nhận được thao tác. Hãy thử lại cùng lượt.');
// Every media wait has a finite lifetime and belongs to one preparation signal.
window.SUBSTITUTE_WAIT_FOR_AUDIO = (audio,{signal,readyState=1,timeoutMs=20000}={}) => new Promise((resolve,reject)=>{
  let timer;
  const cleanup=()=>{clearTimeout(timer);for(const event of ['loadedmetadata','canplay','loadeddata'])audio.removeEventListener(event,check);audio.removeEventListener('error',fail);signal?.removeEventListener('abort',abort);};
  const finish=error=>{cleanup();error?reject(error):resolve();};
  const fail=()=>finish(Object.assign(new Error('Trình duyệt chưa đọc được audio. Hãy bấm Thử tải lại audio.'),{code:'AUDIO_PLAYER_ERROR',mediaCode:audio.error?.code??0}));
  const abort=()=>finish(signal.reason??new DOMException('Đã hủy chuẩn bị','AbortError'));
  const check=()=>{if(audio.error)return fail();if(audio.readyState>=readyState&&Number.isFinite(audio.duration)&&audio.duration>0)finish();};
  if(signal?.aborted)return abort();
  for(const event of ['loadedmetadata','canplay','loadeddata'])audio.addEventListener(event,check);
  audio.addEventListener('error',fail);signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>finish(Object.assign(new Error('Trình phát chưa sẵn sàng. Hãy bấm Thử tải lại audio.'),{code:'AUDIO_PLAYER_TIMEOUT'})),timeoutMs);
  check();
});
