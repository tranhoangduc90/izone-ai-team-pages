// Bộ phát dẫn chứng, kế thừa ReviewAudio của Listening thực chiến (Pages 4f699546).
// Nhận mốc theo đúng file; tải khi bấm, phát 1× và tự dừng. Không ghi bài/điểm.
(function () {
  'use strict';
  class ReviewAudio {
    constructor(audio, { durationMs, prepare, onState }) {
      this.audio = audio; this.durationMs = durationMs; this.prepare = prepare; this.onState = onState;
      this.sequence = 0; this.active = null; this.state = 'idle';
      this.listeners = [];
      const on = (target, event, handler) => { target.addEventListener(event, handler); this.listeners.push([target, event, handler]); };
      on(audio, 'timeupdate', () => this.checkEnd());
      on(audio, 'ended', () => this.stop());
      on(audio, 'error', () => { if (this.active) this.stop('Không tải được audio. Hãy bấm để thử lại.'); });
      on(document, 'visibilitychange', () => { if (document.hidden) this.stop(); });
      on(window, 'pagehide', () => this.stop());
    }
    update(state, message = '') { this.state = state; this.onState({ state, segment: this.active, message }); }
    stop(message = '') {
      this.sequence++; this.abort?.abort(); this.abort = null;
      clearInterval(this.timer); cancelAnimationFrame(this.frame); this.timer = this.frame = null;
      this.audio.pause(); this.active = null; this.update(message ? 'error' : 'idle', message);
    }
    waitFor(event, signal) {
      return new Promise((resolve, reject) => {
        const cleanup = () => { this.audio.removeEventListener(event, done); this.audio.removeEventListener('error', failed); signal.removeEventListener('abort', cancelled); };
        const done = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(Error('AUDIO_LOAD_FAILED')); };
        const cancelled = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
        this.audio.addEventListener(event, done, { once: true }); this.audio.addEventListener('error', failed, { once: true });
        signal.addEventListener('abort', cancelled, { once: true }); if (signal.aborted) cancelled();
      });
    }
    checkEnd() { if (this.state === 'playing' && this.active && this.audio.currentTime >= this.active.endMs / 1000) this.stop(); }
    dispose() { this.stop(); for (const [target, event, handler] of this.listeners) target.removeEventListener(event, handler); this.listeners = []; }
    async play(segment) {
      if (this.active?.id === segment.id) { this.stop(); return; }
      this.stop();
      if (!Number.isInteger(segment.startMs) || !Number.isInteger(segment.endMs) || segment.startMs < 0
        || segment.endMs <= segment.startMs || segment.endMs > this.durationMs) {
        this.update('error', 'Mốc của đoạn nghe chưa hợp lệ.'); return;
      }
      const sequence = this.sequence, controller = new AbortController(); this.abort = controller;
      this.active = segment; this.update('loading');
      try {
        await this.prepare(controller.signal);
        if (sequence !== this.sequence) return;
        if (this.audio.readyState < 1) { const ready = this.waitFor('loadedmetadata', controller.signal); this.audio.load(); await ready; }
        if (sequence !== this.sequence) return;
        if (Math.abs(this.audio.duration * 1000 - this.durationMs) > 500) throw Error('AUDIO_DURATION_MISMATCH');
        if (Math.abs(this.audio.currentTime - segment.startMs / 1000) > 0.01) {
          const seeked = this.waitFor('seeked', controller.signal); this.audio.currentTime = segment.startMs / 1000; await seeked;
        }
        if (sequence !== this.sequence) return;
        this.audio.playbackRate = 1;
        await this.audio.play();
        if (sequence !== this.sequence) { if (this.state !== 'playing') this.audio.pause(); return; }
        this.update('playing');
        const tick = () => { this.checkEnd(); if (this.state === 'playing') this.frame = requestAnimationFrame(tick); };
        this.frame = requestAnimationFrame(tick); this.timer = setInterval(() => this.checkEnd(), 25);
      } catch (error) {
        if (sequence !== this.sequence || error.name === 'AbortError') return;
        this.stop(error.name === 'NotAllowedError' ? 'Trình duyệt chưa cho phát. Hãy bấm nghe lại.' : 'Không phát được đoạn audio. Hãy bấm để thử lại.');
      }
    }
  }
  window.K67ReviewAudio = ReviewAudio;
}());
