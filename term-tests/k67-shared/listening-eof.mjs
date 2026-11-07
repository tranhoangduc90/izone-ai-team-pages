// Only the official player for this run may close playback. An expired exam clock
// or a bare event cannot establish the end of a recording.
export function createListeningEofGate({ audio, anchorSeconds = 0, reviewSeconds = 120, now = () => performance.now() }) {
  const tolerance = 0.25;
  let reviewUntil = null;
  let wrongRate = audio.playbackRate !== 1;

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
    if (event?.type !== 'ended' || event?.currentTarget !== audio || !event.isTrusted || !audio.ended || audio.seeking
        || audio.error || wrongRate || !Number.isFinite(audio.duration) || audio.duration <= 0
        || audio.currentTime < audio.duration - tolerance || !playedToEnd()) return false;
    reviewUntil = now() + reviewSeconds * 1_000;
    return true;
  }

  return {
    confirmEnd,
    recordRate() { wrongRate ||= audio.playbackRate !== 1; },
    remainingReviewMs() { return reviewUntil === null ? null : Math.max(0, reviewUntil - now()); },
    canAutoSubmit() { return reviewUntil !== null && now() >= reviewUntil; }
  };
}
