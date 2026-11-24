import {ListeningRecoveryState, listeningSample} from './listening-recovery-state-v1.mjs';

const stallConfirmationMs = 6000;
const resumeTimeoutMs = 6000;
const seekToleranceMs = 75;
const normalSampleGapMs = 3000;

function seekTo(audio, signal, command, targetMs) {
  return new Promise((resolve, reject) => {
    const waiting = new AbortController();
    const settle = error => {
      if (waiting.signal.aborted) return;
      waiting.abort();
      signal.removeEventListener('abort', aborted);
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const aborted = () => settle(new DOMException('Lượt Listening đã thay đổi.', 'AbortError'));
    const timer = setTimeout(() => settle(new DOMException('Chưa tới đúng mốc nghe.', 'TimeoutError')), 3000);
    if (signal.aborted) return aborted();
    signal.addEventListener('abort', aborted, {once: true});
    audio.addEventListener('seeked', () => settle(), {signal: waiting.signal});
    audio.addEventListener('error', () => settle(new DOMException('Không đọc được âm thanh.', 'NotSupportedError')), {
      signal: waiting.signal
    });
    try {
      command('seek', 'restore_listening_checkpoint', () => { audio.currentTime = targetMs / 1000; });
    } catch (error) {
      settle(error);
    }
  });
}

export function bindListeningRecovery({audio, durationMs, checkpoint, active, command, emit, signal, save, render,
  document = globalThis.document, clock = globalThis.performance}) {
  const state = new ListeningRecoveryState({durationMs, checkpoint});
  const sample = () => listeningSample(audio, clock);
  let request = null;
  let resumeTimer;
  let checkpointsAfter = 0;
  let lastSampleAt;
  let lastMovementAt;

  const activeHere = () => active() && !signal.aborted;
  const log = (action, fields = {}) => emit(action, {
    positionMs: state.positionMs, remainingMs: state.remainingMs, resumeCount: state.resumeCount,
    interruptionId: state.interruption?.id, ...fields
  });
  function resetStallObservation() { lastSampleAt = lastMovementAt = clock.now(); }
  function cancelResume() {
    clearTimeout(resumeTimer);
    request = null;
  }
  function write(transition, interruptionId = state.interruption?.id ?? null) {
    save(state.snapshot(), transition, state.remainingMs, interruptionId);
  }
  function renderState() { render(state); }
  function containPause(reason) {
    if (!audio.paused && !audio.ended) command('pause', reason, () => audio.pause());
  }
  function pauseState(lastSample, newInterruption) {
    cancelResume();
    log('listening_recovery_interrupted', {reason: state.interruption.reason, recoverable: state.canResume,
      observedPositionMs: lastSample.positionMs, playbackRate: lastSample.rate});
    containPause('contain_listening_interruption');
    write(newInterruption ? 'paused' : 'local');
    renderState();
  }
  function interrupt(reason) {
    if (!activeHere() || audio.ended || state.phase === 'starting' && reason !== 'error') return;
    const current = sample();
    const newInterruption = state.phase !== 'resuming';
    if (state.interrupt(reason, {sample: current, recoverable: reason !== 'error'})) pauseState(current, newInterruption);
  }
  function failure(pending, reason) {
    if (!activeHere() || !state.failResume(pending, reason)) return;
    log('listening_resume_failed', {requestId: pending.id, reason});
    pauseState(sample(), false);
  }
  function readPosition() {
    if (!activeHere() || audio.ended) return;
    // A seek started by this resume stays frozen until its seeked event validates the target.
    if (state.phase === 'resuming' && audio.seeking) return;
    const current = sample();
    const interruptionId = state.interruption?.id;
    const result = state.sample(current);
    if (result === 'interrupted') {
      if (request) log('listening_resume_failed', {requestId: request.id, reason: state.interruption.reason});
      pauseState(current, !request);
      return;
    }
    if (result === 'resumed') {
      const requestId = request?.id;
      cancelResume();
      resetStallObservation();
      log('listening_resume_verified', {interruptionId, requestId, playbackRate: current.rate});
      write('running', interruptionId);
    } else if (result === 'advanced') {
      lastMovementAt = current.at;
      if (current.at >= checkpointsAfter) {
        checkpointsAfter = current.at + 1500;
        write('local');
      }
    } else return;
    renderState();
  }

  const listen = (target, type, handler) => target.addEventListener(type, handler, {signal});
  listen(audio, 'play', () => {
    if (!activeHere() || state.phase !== 'paused') return;
    containPause('block_unsolicited_listening_play');
    log('listening_unsolicited_play_blocked');
  });
  listen(audio, 'playing', () => {
    if (!activeHere()) return;
    const current = sample();
    if (state.phase === 'paused') {
      containPause('block_unsolicited_listening_playing');
      return;
    }
    if (state.start(current)) {
      resetStallObservation();
      log('listening_recovery_started');
      write('local');
      renderState();
    } else if (request) {
      state.resumePlayback(request, current);
    } else if (state.phase === 'starting') {
      interrupt('error');
    }
  });
  listen(audio, 'seeking', () => { if (state.phase === 'running') interrupt('unexpected_seek'); });
  listen(audio, 'ratechange', () => {
    if ((state.phase === 'running' || state.phase === 'resuming') && audio.playbackRate !== 1) interrupt('unexpected_rate');
  });
  listen(audio, 'timeupdate', readPosition);
  listen(document, 'visibilitychange', resetStallObservation);

  const monitor = setInterval(() => {
    if (!activeHere() || state.phase !== 'running' || document.visibilityState !== 'visible' || audio.seeking || audio.ended) {
      resetStallObservation();
      return;
    }
    const now = clock.now();
    if (now - lastSampleAt > normalSampleGapMs) resetStallObservation();
    lastSampleAt = now;
    if (audio.paused) interrupt('pause');
    else {
      readPosition();
      if (now - lastMovementAt >= stallConfirmationMs) interrupt('confirmed_stall');
    }
  }, 1000);
  listen(signal, 'abort', () => {
    cancelResume();
    clearInterval(monitor);
  });

  return {
    state,
    interrupt,
    mayStart: () => state.phase === 'starting',
    restoreView() {
      if (state.phase === 'paused') {
        log('listening_recovery_restored', {reason: state.interruption.reason, recoverable: state.canResume});
        write(checkpoint?.interruption ? 'local' : 'paused');
      }
      renderState();
    },
    async resume() {
      if (!activeHere()) return;
      if (state.phase === 'resuming') {
        log('listening_resume_duplicate', {requestId: request?.id});
        return;
      }
      const pending = state.beginResume();
      if (!pending) return;
      request = pending;
      log('listening_resume_requested', {requestId: pending.id, targetPositionMs: pending.positionMs});
      renderState();
      resumeTimer = setTimeout(() => failure(pending, 'resume_progress_timeout'), resumeTimeoutMs);
      try {
        if (audio.error || !Number.isFinite(audio.duration)) return failure(pending, 'audio_unavailable');
        if (audio.playbackRate !== 1) command('set_rate', 'restore_listening_rate', () => { audio.playbackRate = 1; });
        if (audio.seeking || Math.abs(sample().positionMs - pending.positionMs) > seekToleranceMs) {
          await seekTo(audio, signal, command, pending.positionMs);
        }
        if (!activeHere() || !state.ownsResume(pending)) return;
        const current = sample();
        if (current.seeking || current.rate !== 1 || Math.abs(current.positionMs - pending.positionMs) > seekToleranceMs) {
          return failure(pending, 'resume_position_mismatch');
        }
        await command('play', 'learner_resumed_listening', () => audio.play());
      } catch (error) {
        failure(pending, error?.name === 'NotAllowedError' ? 'play_not_allowed' : 'resume_media_failed');
      }
    },
    acceptEnd(event) {
      if (!event.isTrusted || !audio.ended || !state.canEnd(sample(), Math.round(audio.duration * 1000))) return false;
      state.finish();
      write('local');
      return true;
    }
  };
}
