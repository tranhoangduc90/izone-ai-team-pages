const miniAudioHash = '93a3901c37fb37a8eb2ec989ef8d382810d4dc99e6b6506a8377fac68dc756ab';

// Preston Park Run. Verified against the spoken prompts and 0.25 s decoded samples.
// The final review gap has no next question, so it is not eligible for the notice.
const readingWindows = [
  {id: 'before-q1', from: 15, to: 45, part: 1, questions: '1–6'},
  {id: 'before-q7', from: 236.5, to: 256.5, part: 1, questions: '7–10'},
];
const audibleWindows = [[0.75,14.5],[45.5,226.25],[230.5,236],[257,402.25],[406,410.5],[441.25,442.25]];
const boundarySeconds = 0.5;

export function classifyListeningReport({assetHash, position, rate, paused, seeking, stalled, ended, mediaError, readyState, advancing}) {
  if (assetHash !== miniAudioHash || !Number.isFinite(position)) return {kind:'unverified', reason:'asset_unverified'};
  if (ended || seeking) return {kind:'unverified', reason:'position_unstable'};
  if (audibleWindows.some(([from,to]) => position >= from && position < to)) return {kind:'expected_audible'};

  const gap = readingWindows.find(({from,to}) => position >= from + boundarySeconds && position < to - boundarySeconds);
  if (!gap) return {kind:'unverified', reason:'position_unverified'};
  if (paused || stalled || !advancing || mediaError || readyState < 3 || !Number.isFinite(rate) || rate <= 0) {
    return {kind:'unverified', reason:'player_not_advancing'};
  }
  return {kind:'planned_silence', gap, seconds: Math.ceil((gap.to - position) / rate)};
}

export function silenceNotice(gap, seconds) {
  return 'Hiện tại là khoảng im lặng trước câu hỏi ' + gap.questions + ' của part ' + gap.part
    + ', không phải lỗi âm thanh. Audio sẽ vang lên sau khoảng ' + seconds
    + ' giây. Hãy tập trung đọc và phân tích đề trong lúc này.';
}

export function attachListeningReport({audio, assetHash, button, noticeHost, canReport, observe, captureExpectedAudible}) {
  const notice = document.createElement('p');
  notice.className = 'mini-k56-silence-report';
  notice.hidden = true;
  noticeHost.append(notice);
  const announcement = document.createElement('span');
  announcement.className = 'mini-k56-report-announcement';
  announcement.setAttribute('role','status');
  noticeHost.append(announcement);

  let currentGap;
  let stalled = false;
  let lastPosition = audio.currentTime;
  let lastProgressAt = -Infinity;

  function clearNotice() {
    currentGap = null;
    notice.hidden = true;
    announcement.textContent = '';
  }
  function updateNotice() {
    if (!audio.paused && !audio.seeking && audio.currentTime >= lastPosition + 0.025) {
      stalled = false;
      lastProgressAt = performance.now();
    }
    lastPosition = audio.currentTime;
    if (!currentGap) return;
    if (!canReport() || audio.currentTime >= currentGap.to || audio.paused || audio.seeking || audio.ended) {
      clearNotice();
      return;
    }
    const seconds = Math.ceil((currentGap.to - audio.currentTime) / audio.playbackRate);
    const next = silenceNotice(currentGap, seconds);
    if (notice.textContent !== next) notice.textContent = next;
  }
  button.addEventListener('click', event => {
    if (button.disabled || !canReport()) return;
    const position = audio.currentTime;
    const decision = classifyListeningReport({
      assetHash, position, rate:audio.playbackRate, paused:audio.paused,
      seeking:audio.seeking, ended:audio.ended, mediaError:Boolean(audio.error),
      readyState:audio.readyState, stalled,
      advancing:position>=lastPosition+0.025||performance.now()-lastProgressAt<1500,
    });
    if (decision.kind === 'planned_silence') {
      event.stopImmediatePropagation();
      currentGap = decision.gap;
      updateNotice();
      announcement.textContent = notice.textContent;
      notice.hidden = false;
    }
    if (decision.kind === 'expected_audible') {
      try { captureExpectedAudible?.(position); } catch {}
    }
    // Observability is read-only and never delays the native button path.
    try { observe(decision, position); } catch {}
  }, {capture:true});
  audio.addEventListener('waiting', () => { stalled = true; lastProgressAt=-Infinity; clearNotice(); });
  audio.addEventListener('playing', () => { stalled = false; });
  audio.addEventListener('timeupdate', updateNotice);
  audio.addEventListener('ratechange', updateNotice);
  const resetProgress=()=>{lastPosition=audio.currentTime;lastProgressAt=-Infinity;clearNotice();};
  audio.addEventListener('pause', resetProgress);
  audio.addEventListener('seeking', resetProgress);
  audio.addEventListener('seeked', resetProgress);
  audio.addEventListener('ended', clearNotice);
}
