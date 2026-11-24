const resumeLimit = 2;
const positionToleranceMs = 75;
const playbackJitterMs = 350;
const minimumResumeProgressMs = 80;

function validCheckpoint(value, durationMs) {
  return value?.version === 1 &&
    Number.isInteger(value.positionMs) && value.positionMs >= 0 && value.positionMs < durationMs &&
    Number.isInteger(value.resumeCount) && value.resumeCount >= 0 && value.resumeCount <= resumeLimit;
}

export function listeningSample(audio, clock) {
  return {
    at: clock.now(),
    positionMs: Math.round(audio.currentTime * 1000),
    rate: audio.playbackRate,
    paused: audio.paused,
    seeking: audio.seeking,
  };
}

export class ListeningRecoveryState {
  #anchorAt;
  #resume = null;
  #durationMs;

  constructor({durationMs, checkpoint = null}) {
    if (!Number.isInteger(durationMs) || durationMs <= 0) throw new TypeError('Invalid Listening duration');
    if (checkpoint && !validCheckpoint(checkpoint, durationMs)) throw new TypeError('Invalid Listening checkpoint');
    this.#durationMs = durationMs;
    this.positionMs = checkpoint?.positionMs ?? 0;
    this.resumeCount = checkpoint?.resumeCount ?? 0;
    this.phase = checkpoint ? 'paused' : 'starting';
    this.interruption = checkpoint ? (checkpoint.interruption && {...checkpoint.interruption} || {
      id: crypto.randomUUID(), reason: 'page_reopened', recoverable: this.resumeCount < resumeLimit
    }) : null;
  }

  get remainingMs() { return this.#durationMs - this.positionMs; }
  get canResume() { return this.phase === 'paused' && this.interruption?.recoverable === true && this.resumeCount < resumeLimit; }

  snapshot() {
    return {version: 1, positionMs: this.positionMs, resumeCount: this.resumeCount,
      interruption: this.interruption ? {...this.interruption} : null};
  }

  start(sample) {
    if (this.phase !== 'starting' || sample.paused || sample.seeking || sample.rate !== 1 ||
      !Number.isFinite(sample.at) || !Number.isInteger(sample.positionMs) ||
      sample.positionMs < 0 || sample.positionMs > playbackJitterMs) return false;
    this.phase = 'running';
    this.positionMs = sample.positionMs;
    this.#anchorAt = sample.at;
    return true;
  }

  #acceptPosition(sample) {
    if (!Number.isFinite(sample.at) || !Number.isInteger(sample.positionMs) ||
      sample.positionMs < this.positionMs - positionToleranceMs ||
      sample.positionMs > this.positionMs + Math.max(0, sample.at - this.#anchorAt) + playbackJitterMs ||
      sample.positionMs >= this.#durationMs) return false;
    if (sample.positionMs > this.positionMs) {
      this.positionMs = sample.positionMs;
      this.#anchorAt = sample.at;
    }
    return true;
  }

  interrupt(reason, {sample, recoverable = true} = {}) {
    if (this.phase === 'paused' || this.phase === 'ended') return false;
    if (reason === 'pause' && this.phase === 'running' && sample?.rate === 1 && !sample.seeking) {
      this.#acceptPosition(sample);
    }
    const failedResume = this.phase === 'resuming';
    this.phase = 'paused';
    this.interruption = {
      id: this.interruption?.id ?? crypto.randomUUID(),
      reason: this.resumeCount >= resumeLimit ? 'resume_limit_reached' : reason,
      recoverable: recoverable && !failedResume && this.resumeCount < resumeLimit
    };
    this.#resume = null;
    return true;
  }

  beginResume() {
    if (!this.canResume) return null;
    const request = {id: crypto.randomUUID(), positionMs: this.positionMs};
    this.#resume = {request, playbackAt: null};
    this.phase = 'resuming';
    return request;
  }

  ownsResume(request) { return this.phase === 'resuming' && this.#resume?.request === request; }

  resumePlayback(request, sample) {
    if (!this.ownsResume(request) || this.#resume.playbackAt !== null || sample.paused || sample.seeking ||
      sample.rate !== 1 || !Number.isFinite(sample.at) || !Number.isInteger(sample.positionMs) ||
      Math.abs(sample.positionMs - request.positionMs) > playbackJitterMs) return false;
    this.#resume.playbackAt = sample.at;
    return true;
  }

  sample(sample) {
    if (this.phase !== 'running' && this.phase !== 'resuming') return 'inactive';
    if (sample.paused) return 'pending';
    if (sample.seeking || sample.rate !== 1) {
      this.interrupt(sample.seeking ? 'unexpected_seek' : 'unexpected_rate', {sample});
      return 'interrupted';
    }
    if (this.phase === 'resuming') {
      const {request, playbackAt} = this.#resume;
      if (playbackAt === null) return 'pending';
      const advanced = sample.positionMs - request.positionMs;
      if (advanced < -positionToleranceMs || advanced > sample.at - playbackAt + playbackJitterMs ||
        !Number.isFinite(sample.at) || !Number.isInteger(sample.positionMs) || sample.positionMs >= this.#durationMs) {
        this.failResume(request, 'resume_position_mismatch');
        return 'interrupted';
      }
      if (advanced < minimumResumeProgressMs) return 'pending';
      this.phase = 'running';
      this.positionMs = sample.positionMs;
      this.#anchorAt = sample.at;
      this.resumeCount++;
      this.interruption = null;
      this.#resume = null;
      return 'resumed';
    }
    const previous = this.positionMs;
    if (!this.#acceptPosition(sample)) {
      this.interrupt('unexpected_position', {sample});
      return 'interrupted';
    }
    return this.positionMs > previous ? 'advanced' : 'pending';
  }

  failResume(request, reason) {
    if (!this.ownsResume(request)) return false;
    return this.interrupt(reason, {recoverable: false});
  }

  canEnd(sample, durationMs) {
    // Browsers can report the final media timestamp in the same turn as ended.
    // Reuse the preceding valid sample and refuse a jump directly to the end.
    return this.phase === 'running' && sample.rate === 1 && !sample.seeking &&
      Number.isFinite(durationMs) && Math.abs(durationMs - this.#durationMs) <= 2000 &&
      Number.isFinite(sample.at) && Math.abs(sample.positionMs - durationMs) <= playbackJitterMs &&
      sample.positionMs >= this.positionMs &&
      sample.positionMs - this.positionMs <= Math.max(0, sample.at - this.#anchorAt) + playbackJitterMs;
  }

  finish() {
    this.phase = 'ended';
    this.positionMs = this.#durationMs;
    this.interruption = null;
    this.#resume = null;
  }
}
