import {createOfflineRuntime} from '../k56-offline-shared/runtime.mjs?v=20261107-k56-r2-v1';
import {TERM1_PROFILE} from '../k56-offline-shared/profiles.mjs';
const runtime=createOfflineRuntime(TERM1_PROFILE);
export const {BUILD,canonical,hash,ExamStore,exportHtml}=runtime;
export class Term1Offline extends runtime.OfflineRuntime {
 attachPlayer({ audio, resumeButton, manualButton, render, form, observeListening }) {
  let started = false;
  let terminal = '';
  let interrupting = false;
  const update = (message = 'Đang phát bài thi') => render(message, audio.currentTime, audio.duration);
  const submit = () => {
   const button = document.createElement('button');
   button.type = 'submit';
   button.hidden = true;
   button.dataset.autoSubmit = 'true';
   form.append(button);
   form.requestSubmit(button);
   button.remove();
  };
  const playBlocked = () => {
   if (started || terminal) return;
   resumeButton.textContent = 'Phát audio';
   resumeButton.hidden = false;
   update('Trình duyệt chưa cho phát. Hãy bấm Phát audio');
  };
  resumeButton.addEventListener('click', () => {
   if (!started && !terminal) void audio.play().catch(playBlocked);
  });
  audio.addEventListener('playing', () => {
   if (!started) this.observe('audio_playing', { position: audio.currentTime,
    ...(this.listeningStartIntent === undefined ? {} : { elapsedMs: performance.now() - this.listeningStartIntent }) });
   started = true;
   resumeButton.hidden = true;
   if (!terminal) update();
  });
  audio.addEventListener('timeupdate', () => { if (!terminal) update(); });
  for (const event of ['waiting', 'error']) audio.addEventListener(event, () => {
   if (!terminal) this.observe('audio_diagnostic', { event, position: audio.currentTime });
  });
  manualButton.addEventListener('click', async () => {
   if (interrupting || (terminal && terminal !== 'interrupt') || audio.ended) return;
   interrupting = true;
   terminal = 'interrupt';
   manualButton.disabled = true;
   if (!audio.paused) audio.pause();
   for (const control of form.querySelectorAll('input:not([type="range"]),select,textarea,button[type="submit"]')) control.disabled = true;
   try {
    await this.interruptListening('learner_cannot_hear');
    form.dispatchEvent(new Event('term-test:listening-interrupted'));
   } catch {
    update('Chưa lưu được trạng thái gián đoạn. Hãy bấm Tôi không nghe được để thử lưu lại.');
    manualButton.disabled = false;
   } finally { interrupting = false; }
  });
  audio.addEventListener('ended', async event => {
   const expected = Number(this.record.prepared.timing.listeningDurationSeconds);
   if (terminal || !event.isTrusted || !audio.ended || audio.seeking || !Number.isFinite(audio.duration)
       || Math.abs(audio.duration - expected) > 2 || audio.currentTime < audio.duration - 0.5) return;
   terminal = 'ended';
   try { observeListening?.({ phase: 'eof_accepted', configuredDurationSeconds: expected }); } catch { /* Chẩn đoán không chặn thu bài. */ }
   this.observe('audio_ended', { position: audio.currentTime, duration: audio.duration });
   this.record.player = { position: audio.currentTime, ended: true };
   update('Đã phát hết audio');
   submit();
  });
  const controller = {
   playBlocked,
   beforeAutoSubmit: async () => ({ submit: Boolean(this.record.player.ended), deadlineChanged: !this.record.player.ended }),
   submitting: () => {
    if (terminal) return;
    terminal = 'manual';
    manualButton.disabled = true;
    this.observe('listening_early_submit_confirmed');
    if (!audio.paused) audio.pause();
   },
   submitFailed() {},
   finish() { terminal ||= 'submitted'; manualButton.disabled = true; }
  };
  window.K56_LISTENING_AUDIO = controller;
  this.player = audio;
  this.playerReady = true;
  update();
  return controller;
 }

 async interruptListening(reason) {
  if (!['learner_cannot_hear', 'page_interrupted'].includes(reason)) throw Error('Lý do gián đoạn không hợp lệ.');
  if (this.interruptionPending) return this.interruptionPending;
  const listening = this.record.sections.listening;
  if (!listening?.startedAt || listening.sealed) throw Error('Lượt Listening đã kết thúc hoặc chưa bắt đầu.');
  if (listening.interrupted) return this.sectionResponse();
  this.interruptionPending = this.enqueue('listening', 'interrupt', { interruptionReason: reason }, listening.revision)
   .then(operation => {
    this.observe('listening_interrupted', { operationId: operation.operationId, reason });
    return this.sectionResponse();
   });
  try { return await this.interruptionPending; }
  finally { this.interruptionPending = null; }
 }

 async seal(section, data, revision, reason) {
  const alreadySealed = this.record.sections[section]?.sealed;
  const response = await super.seal(section, data, revision, reason);
  if (section === 'listening' && !alreadySealed) {
   this.observe('listening_local_collected', { operationId: this.record.sections.listening.operationId, reason });
  }
  return response;
 }

 async applyCompletedElsewhere(completed, listeningInterruption) {
  if (!this.record) return;
  const markers = { ...completed, ...(listeningInterruption ? { listening: listeningInterruption } : {}) };
  const previous = this.record.sections;
  const sections = { ...previous };
  let changed = false;
  for (const section of this.order()) {
   const marker = markers[section];
   if (!marker || !/^[0-9a-f-]{36}$/i.test(marker.operationId)
       || !Number.isFinite(Date.parse(marker.startedAt)) || !Number.isSafeInteger(marker.revision)
       || marker.revision < 0 || (marker.deadlineAt !== null && !Number.isFinite(Date.parse(marker.deadlineAt)))) continue;
   const item = previous[section];
   if (item?.operationId === marker.operationId) continue;
   if (this.record.operations.some(op => op.section === section || (item?.operationId && op.dependency === item.operationId))) {
    this.observe('fallback_progress_conflict', { section, operationId: marker.operationId });
    continue;
   }
   sections[section] = marker === listeningInterruption ? { ...marker, interrupted: true } : { ...marker, sealed: true };
   changed = true;
  }
  if (!changed) return;
  this.record.sections = sections;
  try {
   await this.persist(true);
   this.observe('fallback_progress_restored', { sections: Object.keys(markers).filter(section => sections[section] !== previous[section]) });
  }
  catch (error) { this.record.sections = previous; throw error; }
 }

 async prepare(prepared, identity) {
  const response = await super.prepare(prepared, identity);
  await this.applyCompletedElsewhere(response.completedElsewhere, response.listeningInterruption);
  return response;
 }

 async refreshCompletedElsewhere() {
  if (!this.active || globalThis.navigator?.onLine === false) return;
  try {
   const response = await this.fetchImpl(this.apiBase + '/api/term-tests/' + TERM1_PROFILE.slug + '/offline/resume', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-term2-permit': this.record.prepared.offline.permit },
    body: JSON.stringify(this.scope), signal: AbortSignal.timeout(1500)
   });
   if (response.ok) {
    const progress = await response.json();
    await this.applyCompletedElsewhere(progress.completedElsewhere, progress.listeningInterruption);
   }
  } catch { /* Bản đang làm trong trình duyệt vẫn dùng được khi máy chủ chậm hoặc mất kết nối. */ }
 }
}
