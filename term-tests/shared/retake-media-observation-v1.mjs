// Observe position directly so sparse media callbacks cannot imply a pause.
export function observeRetakeMedia(audio, journal, isPlaying) {
  const quietMs = 5000;
  let previous, sampleAt = 0, stationarySince = 0, reported = false, quietReported = false;
  const emit = (action, fields) => journal.emit(action, { phase: 'playing', audioAfter: journal.snapshot(), ...fields });
  function sample(now = performance.now()) {
    if (!isPlaying()) { previous = undefined; stationarySince = 0; reported = quietReported = false; return; }
    if (!Number.isFinite(audio.currentTime) || audio.ended) return;
    const position = audio.currentTime;
    if (previous === undefined) { previous = position; sampleAt = stationarySince = now; return; }
    if (position > previous + 0.05) {
      const callbacksQuiet = journal.snapshot().lastAdvanceAgeMs >= quietMs;
      if (reported || now - sampleAt >= quietMs || callbacksQuiet && !quietReported)
        emit('audio_position_observed', { reason: reported ? 'position_resumed' : callbacksQuiet ? 'position_advanced_without_callback' : 'sample_after_gap', positionBefore: previous, positionAfter: position, elapsedMs: now - sampleAt });
      quietReported = callbacksQuiet;
      stationarySince = now;
      reported = false;
    } else if (!reported && now - stationarySince >= quietMs) {
      reported = true;
      emit('audio_position_observed', { reason: audio.paused ? 'paused' : 'position_unchanged', positionBefore: previous, positionAfter: position, elapsedMs: now - stationarySince });
    }
    previous = position;
    sampleAt = now;
  }
  audio.addEventListener('pause', () => { if (isPlaying() && !audio.ended) emit('audio_context_observed', { reason: 'media_pause' }); });
  audio.addEventListener('playing', () => { if (isPlaying()) emit('audio_context_observed', { reason: 'media_playing' }); });
  document.addEventListener('visibilitychange', () => {
    if (isPlaying()) emit('audio_context_observed', { reason: document.hidden ? 'page_hidden' : 'page_visible' });
  });
  return sample;
}
