import {drainListeningClock, queueListeningClock} from './listening-clock-sync-v1.mjs';
import {bindListeningRecovery} from '../shared/listening-recovery-v1.mjs';
import {createListeningPlayer, recordListeningPreparationCommand} from '../shared/listening-player-lifecycle-v2.mjs';

export function withProtectedListening(Base) {
  return class extends Base {
    listeningPreparationCommand(audio, command, reason, run, {attempt = this.record, role} = {}) {
      return recordListeningPreparationCommand(audio, command, reason, run, {
        role, skill: () => this.record === attempt && this.owned ? this.sectionResponse().nextSection : null,
        emit: (action, data) => { if (this.record === attempt) this.observe(action, {section: 'listening', ...data}); },
      });
    }

    get listeningRecoveryEnabled() {
      return this.record?.prepared?.offline?.listeningRecoveryVersion === 1;
    }

    async open() {
      await super.open();
      globalThis.addEventListener?.('online', this.onListeningClockOnline ??= () => drainListeningClock(this));
      drainListeningClock(this);
      return this;
    }

    saveListeningRecovery(attempt, checkpoint, transition, remainingMs, playerId, interruptionId) {
      if (!this.owned || this.record !== attempt) return;
      attempt.listeningCheckpoint = checkpoint;
      const transitionChanged = transition !== 'local';
      if (transitionChanged) queueListeningClock(this, attempt, checkpoint, transition, remainingMs, playerId, interruptionId);
      if (transitionChanged) this.observe('listening_checkpoint_changed', {
        section: 'listening', playerId, transition, positionMs: checkpoint.positionMs, remainingMs,
        interruptionId, resumeCount: checkpoint.resumeCount
      });
      void this.persist(false, !transitionChanged).catch(() => {
        if (this.record === attempt) this.observe('listening_checkpoint_save_failed', {
          section: 'listening', playerId, transition, positionMs: checkpoint.positionMs
        });
      });
    }
    preloadListening(blob, onReady, onFailure) {
      const attempt = this.record;
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(blob);
      const began = performance.now();
      const callbacks = new AbortController();
      const run = (command, reason, action) => this.listeningPreparationCommand(audio, command, reason, action, {attempt});
      let discarded = false;
      const cancel = () => callbacks.abort();
      callbacks.signal.addEventListener('abort', () => clearTimeout(timeout), {once: true});
      const stillCurrent = () => this.owned && this.record === attempt;
      const entry = {audio, url, ready: false, discard() {
        if (discarded) return;
        discarded = true;
        cancel();
        run('clear_source', 'discard_prepared_player', () => audio.removeAttribute('src'));
        run('load', 'discard_prepared_player', () => audio.load());
        audio.remove();
        URL.revokeObjectURL(url);
      }};
      const failed = () => {
        cancel();
        if (stillCurrent()) onFailure();
        else entry.discard();
      };
      const timeout = setTimeout(failed, 15000);
      audio.hidden = true;
      audio.preload = 'auto';
      audio.addEventListener('canplay', () => {
        cancel();
        if (!stillCurrent()) { entry.discard(); return; }
        entry.ready = true;
        this.observe('audio_player_ready', {elapsedMs: performance.now() - began});
        onReady();
      }, {signal: callbacks.signal});
      audio.addEventListener('error', failed, {signal: callbacks.signal});
      document.body.append(audio);
      run('set_source', 'prepare_verified_audio', () => { audio.src = url; });
      return entry;
    }

    async detachLatest() {
      this.listeningController?.dispose('owner_released');
      return super.detachLatest();
    }

    attachPlayer({audio, resumeButton, manualButton, render, renderRecovery, form, observeListening}) {
      const attempt = this.record;
      const source = audio.getAttribute('src');
      let terminal = '';
      let interrupting = false;
      let started = false;
      let interruptionMessage;
      let autoReportedInterruption;
      const update = (message = interruptionMessage || 'Đang phát bài thi') => {
        const position = recovery && recovery.state.phase !== 'ended' ? recovery.state.positionMs / 1000 : audio.currentTime;
        render(message, position, audio.duration);
      };
      const events = new AbortController();
      const listen = (target, type, handler) => target.addEventListener(type, handler, {signal: events.signal});
      const lifecycle = createListeningPlayer({audio,
        isCurrent: () => this.owned && this.record === attempt && this.player === audio && !terminal,
        skill: () => this.record === attempt ? this.sectionResponse().nextSection : null,
        emit: (action, data) => { if (this.record === attempt) this.observe(action, {section: 'listening', ...data}); },
        onInterruption: reason => {
          if (recovery) {
            recovery.interrupt(reason);
          } else {
            interruptionMessage = 'Audio bị gián đoạn. Hãy bấm Báo lỗi âm thanh.';
            update();
          }
        },
      });
      const recovery = this.listeningRecoveryEnabled ? bindListeningRecovery({
        audio, durationMs: Math.round(attempt.prepared.timing.listeningDurationSeconds * 1000),
        checkpoint: attempt.player.ended ? null : attempt.listeningCheckpoint,
        active: lifecycle.active, command: lifecycle.command, signal: events.signal,
        emit: (action, data) => this.observe(action, {section: 'listening', playerId: lifecycle.playerId, ...data}),
        save: (checkpoint, transition, remainingMs, interruptionId) =>
          this.saveListeningRecovery(attempt, checkpoint, transition, remainingMs, lifecycle.playerId, interruptionId),
        render: state => {
          const held = ['paused', 'resuming'].includes(state.phase);
          if (state.phase === 'resuming') resumeButton.textContent = 'Đang khôi phục…';
          else if (held) resumeButton.textContent = 'Nghe tiếp';
          if (state.phase !== 'starting') {
            resumeButton.hidden = !held || state.phase === 'paused' && !state.canResume;
            resumeButton.disabled = state.phase === 'resuming';
          }
          renderRecovery?.(state);
          update(held ? 'Đồng hồ Listening đang tạm dừng' : undefined);
          if (state.phase !== 'paused' || state.canResume || autoReportedInterruption === state.interruption.id) return;
          const interruption = state.interruption;
          queueMicrotask(() => {
            if (!lifecycle.active() || state.interruption !== interruption || autoReportedInterruption === interruption.id) return;
            autoReportedInterruption = interruption.id;
            this.observe('listening_report_auto_open_requested', {section: 'listening', playerId: lifecycle.playerId,
              interruptionId: interruption.id, reason: interruption.reason, positionMs: state.positionMs});
            manualButton.click();
          });
        }
      }) : null;
      const retire = (reason, nextSkill) => {
        events.abort();
        lifecycle.retire(reason, {nextSkill, operationId: attempt.sections.listening?.operationId, releaseSource: () => {
          if (source?.startsWith('blob:')) URL.revokeObjectURL(source);
        }});
        if (this.player === audio) {
          this.player = null;
          this.playerReady = false;
        }
        resumeButton.hidden = true;
        renderRecovery?.(null);
        if (window.K56_LISTENING_AUDIO === controller) delete window.K56_LISTENING_AUDIO;
        if (this.listeningController === controller) this.listeningController = null;
      };
      const playBlocked = () => {
        if (started || !lifecycle.active() || recovery && !recovery.mayStart()) return;
        resumeButton.textContent = 'Phát audio';
        resumeButton.hidden = false;
        update('Trình duyệt chưa cho phát. Hãy bấm Phát audio');
      };
      const play = reason => lifecycle.command('play', reason, () => {
        if (recovery && !recovery.mayStart()) {
          throw new DOMException('Lượt Listening đang tạm dừng; hãy bấm Nghe tiếp.', 'InvalidStateError');
        }
        return audio.play();
      });
      listen(resumeButton, 'click', () => {
        if (recovery && !recovery.mayStart()) {
          void recovery.resume();
        } else if (!started && lifecycle.active()) {
          void play('retry_initial_play').catch(playBlocked);
        }
      });
      listen(audio, 'playing', () => {
        if (!lifecycle.active()) return;
        if (!started) this.observe('audio_playing', {position: audio.currentTime,
          ...(this.listeningStartIntent === undefined ? {} : {elapsedMs: performance.now() - this.listeningStartIntent})});
        started = true;
        if (!recovery) {
          resumeButton.hidden = true;
          update();
        }
      });
      if (!recovery) listen(audio, 'timeupdate', () => { if (lifecycle.active() && !audio.paused) update(); });

      // Keep the report button bound during a failed local write so the same interruption can be retried.
      listen(manualButton, 'click', async () => {
        if (interrupting || this.record !== attempt || !this.owned || terminal && terminal !== 'interrupt' || audio.ended) return;
        interrupting = true;
        terminal = 'interrupt';
        manualButton.disabled = true;
        if (!audio.paused) lifecycle.command('pause', 'confirmed_interruption', () => audio.pause());
        for (const control of form.querySelectorAll('input:not([type="range"]),select,textarea,button[type="submit"]')) control.disabled = true;
        try {
          await this.interruptListening('learner_cannot_hear');
          if (this.record !== attempt || !this.owned) return;
          retire('confirmed_interruption', this.sectionResponse().nextSection);
          form.dispatchEvent(new Event('term-test:listening-interrupted'));
        } catch {
          interruptionMessage = 'Chưa lưu được trạng thái gián đoạn. Hãy bấm Báo lỗi âm thanh để thử lưu lại.';
          update();
          manualButton.disabled = false;
        } finally {
          interrupting = false;
        }
      });

      listen(audio, 'ended', event => {
        const expected = Number(attempt.prepared.timing.listeningDurationSeconds);
        if (!lifecycle.active() || !event.isTrusted || !audio.ended || audio.seeking || !Number.isFinite(audio.duration)
          || Math.abs(audio.duration - expected) > 2 || audio.currentTime < audio.duration - 0.5) return;
        if (recovery && !recovery.acceptEnd(event)) return;
        terminal = 'ended';
        try { observeListening?.({phase: 'eof_accepted', configuredDurationSeconds: expected}); } catch { /* Diagnostics only. */ }
        this.observe('audio_ended', {position: audio.currentTime, duration: audio.duration});
        attempt.player = {position: audio.currentTime, ended: true};
        update('Đã phát hết audio');
        const button = document.createElement('button');
        button.type = 'submit';
        button.hidden = true;
        button.dataset.autoSubmit = 'true';
        form.append(button);
        form.requestSubmit(button);
        button.remove();
      });

      const controller = {
        play, playBlocked,
        blockedReport: () => recovery?.state.phase === 'paused' && !recovery.state.canResume
          ? {interruptionId: recovery.state.interruption.id, playerId: lifecycle.playerId, positionMs: recovery.state.positionMs}
          : null,
        beforeAutoSubmit: async () => ({submit: Boolean(attempt.player.ended), deadlineChanged: !attempt.player.ended}),
        submitting: () => {
          if (terminal) return;
          terminal = 'manual';
          manualButton.disabled = true;
          this.observe('listening_early_submit_confirmed');
          if (!audio.paused) lifecycle.command('pause', 'early_submit_confirmed', () => audio.pause());
        },
        submitFailed() {},
        finish: () => {
          terminal ||= 'submitted';
          manualButton.disabled = true;
          retire(terminal, this.sectionResponse().nextSection);
        },
        dispose: (reason = 'left_listening') => {
          terminal ||= 'disposed';
          manualButton.disabled = true;
          retire(reason);
        },
      };
      listen(window, 'pagehide', () => controller.dispose('pagehide'));
      window.K56_LISTENING_AUDIO = controller;
      this.listeningController = controller;
      this.player = audio;
      this.playerReady = true;
      if (recovery && !attempt.player.ended) recovery.restoreView();
      else update();
      return controller;
    }
  };
}
