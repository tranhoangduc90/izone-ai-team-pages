// Only the official player for this run may close playback. An expired exam clock
// or a bare event cannot establish the end of a recording.
export function createListeningEofGate({ audio, anchorSeconds = 0, reviewSeconds = 120,
  now = () => performance.now(), observeDecision }) {
  const tolerance = 0.25;
  let reviewUntil = null;
  let wrongRate = audio.playbackRate !== 1;

  const emit = (phase, extra = {}) => {
    try { observeDecision?.({ phase, anchorSeconds, reviewSeconds, ...extra }); } catch {}
  };

  function playedToEnd() {
    let covered = Math.max(0, anchorSeconds);
    for (let index = 0; index < audio.played.length; index += 1) {
      if (audio.played.start(index) > covered + tolerance) return false;
      covered = Math.max(covered, audio.played.end(index));
    }
    return covered >= audio.duration - tolerance;
  }

  function confirmEnd(event) {
    if (reviewUntil !== null) return true;
    let rejected;
    if (event?.type !== 'ended' || event?.currentTarget !== audio || !event.isTrusted) rejected = 'event_unverified';
    else if (!audio.ended || audio.seeking || audio.error) rejected = 'media_not_finished';
    else if (wrongRate) rejected = 'playback_rate_invalid';
    else if (!Number.isFinite(audio.duration) || audio.duration <= 0) rejected = 'duration_unavailable';
    else if (audio.currentTime < audio.duration - tolerance) rejected = 'position_short';
    else if (!playedToEnd()) rejected = 'playback_incomplete';
    if (rejected) { emit(rejected); return false; }
    reviewUntil = now() + reviewSeconds * 1_000;
    emit('eof_accepted');
    return true;
  }

  return {
    confirmEnd,
    recordReview(phase, start, deadline) {
      try {
        if (!start || !deadline) return;
        const started = new Date(start).toISOString(), until = new Date(deadline).toISOString();
        emit(phase, { reviewStartedAt: started, reviewDeadlineAt: until });
      } catch {}
    },
    recordRate() { wrongRate ||= audio.playbackRate !== 1; },
    remainingReviewMs() { return reviewUntil === null ? null : Math.max(0, reviewUntil - now()); },
    canAutoSubmit() { return reviewUntil !== null && now() >= reviewUntil; }
  };
}

// Telemetry uses the existing connection. The online player can be prepared before
// the app creates its bootstrap object, so identify it by the exact media element.
export function createK67EofObserver(audio, { mode, owner, configuredDurationSeconds, active = () => true }) {
  const seen = new Set();
  return detail => {
    if (!active() || seen.has(detail.phase)) return;
    const win = globalThis.window, config = win?.TERM_TEST_APP_CONFIG;
    if (config?.EXAM_JOURNAL_ENABLED !== true) return;
    const current = win.TERM_TEST_BOOTSTRAP;
    const bound = mode === 'offline' ? owner : current?.officialAudioElement === audio ? current : null;
    if (!bound || bound !== current) return;
    const slug = win.TERM_TEST_CONFIG?.slug;
    const endpoint = config.EXAM_JOURNAL_BASE_URL || config.API_BASE_URL + '/api/term-tests/' + slug;
    const key = JSON.stringify([new URL(endpoint, win.location.href).href, slug]);
    if (win[Symbol.for('izone.examJournal.connections.v1')]?.get(key)?.recordK67ListeningEof?.(bound, {
      ...detail, mode, configuredDurationSeconds, positionSeconds: audio.currentTime,
      durationSeconds: audio.duration, playbackRate: audio.playbackRate, ended: audio.ended
    })) seen.add(detail.phase);
  };
}
