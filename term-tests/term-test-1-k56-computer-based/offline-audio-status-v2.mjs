import {createOfflineRuntime,withListeningContinuity} from '../k56-offline-shared/runtime-audio-status-v2.mjs?v=20261107-k56-r2-v1';
import {TERM1_PROFILE} from '../k56-offline-shared/profiles.mjs';
const runtime=createOfflineRuntime(TERM1_PROFILE);
export const {BUILD,canonical,hash,ExamStore,exportHtml}=runtime;
export class Term1Offline extends withListeningContinuity(runtime.OfflineRuntime) {
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
