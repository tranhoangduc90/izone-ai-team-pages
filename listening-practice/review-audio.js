// Nhận mốc của một dẫn chứng, phát audio gốc và báo trạng thái cho nút nghe.
// Không ghi điểm, nháp hoặc tiến độ làm bài; lỗi tải/phát được đưa về giao diện.
class ReviewAudio {
  constructor(element, notify) {
    this.audio = element;
    this.notify = notify;
    this.sequence = 0;
    this.active = null;
    this.state = 'idle';
    this.events = [];
    this.timer = null;
    this.frame = null;
    element.addEventListener('timeupdate', () => this.checkEnd());
    element.addEventListener('ended', () => this.stop('ended'));
    element.addEventListener('error', () => {
      if (this.active) this.stop('error', 'Không tải được audio. Hãy bấm nghe để thử lại.');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop('hidden');
    });
    window.addEventListener('pagehide', () => this.stop('pagehide'));
  }

  record(type, extra = {}) {
    this.events.push({ type, question: this.active?.question, id: this.active?.id,
      mediaTime: this.audio.currentTime, ...extra });
    if (this.events.length > 100) this.events.shift();
  }

  update(state, message = '') {
    this.state = state;
    this.notify({ state, segment: this.active, message });
  }

  stop(reason = 'manual', message = '') {
    this.sequence += 1;
    this.abort?.abort();
    this.abort = null;
    clearInterval(this.timer);
    cancelAnimationFrame(this.frame);
    this.timer = this.frame = null;
    this.audio.pause();
    if (this.active) this.record('stop', { reason, requestedEnd: this.active.endMs / 1000 });
    this.active = null;
    this.update(message ? 'error' : 'idle', message);
  }

  waitFor(event, signal) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.audio.removeEventListener(event, done);
        this.audio.removeEventListener('error', failed);
        signal.removeEventListener('abort', cancelled);
      };
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('AUDIO_LOAD_FAILED')); };
      const cancelled = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      this.audio.addEventListener(event, done, { once: true });
      this.audio.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', cancelled, { once: true });
      if (signal.aborted) cancelled();
    });
  }

  checkEnd() {
    if (this.state !== 'playing' || !this.active) return;
    if (this.audio.currentTime >= this.active.endMs / 1000) {
      this.stop('segment-end');
    }
  }

  async play(segment) {
    if (this.active?.id === segment.id) {
      this.stop('toggle');
      return;
    }
    this.stop('replace');
    if (!Number.isInteger(segment.startMs) || !Number.isInteger(segment.endMs) ||
        segment.startMs < 0 || segment.endMs <= segment.startMs ||
        segment.endMs > 459207) {
      this.update('error', 'Mốc của đoạn nghe chưa hợp lệ.');
      return;
    }
    const sequence = this.sequence;
    const controller = new AbortController();
    this.abort = controller;
    this.active = segment;
    this.update('loading');
    this.record('request', { requestedStart: segment.startMs / 1000 });
    try {
      // Gói audio xem lại được tải bằng đúng quyền của kết quả đang mở.
      if (this.prepare) await this.prepare(controller.signal);
      if (sequence !== this.sequence) return;
      if (this.audio.readyState < 1) {
        const ready = this.waitFor('loadedmetadata', controller.signal);
        this.audio.load();
        await ready;
      }
      if (sequence !== this.sequence) return;
      if (segment.endMs / 1000 > this.audio.duration + 0.05) throw new Error('AUDIO_DURATION_MISMATCH');
      if (Math.abs(this.audio.currentTime - segment.startMs / 1000) > 0.01) {
        const seeked = this.waitFor('seeked', controller.signal);
        this.audio.currentTime = segment.startMs / 1000;
        await seeked;
      }
      if (sequence !== this.sequence) return;
      await this.audio.play();
      if (sequence !== this.sequence) return;
      this.update('playing');
      this.record('playing', { requestedStart: segment.startMs / 1000 });
      const tick = () => {
        this.checkEnd();
        if (this.state === 'playing') this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
      this.timer = setInterval(() => this.checkEnd(), 25);
    } catch (error) {
      if (sequence !== this.sequence || error.name === 'AbortError') return;
      this.stop('error', error.name === 'NotAllowedError'
        ? 'Trình duyệt chưa cho phép phát. Hãy bấm nghe lại.'
        : 'Không phát được đoạn audio. Hãy bấm nghe để thử lại.');
    }
  }
}
