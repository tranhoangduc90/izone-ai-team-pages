import {createOfflineRuntime,withListeningContinuity} from '../k56-offline-shared/runtime-mini-demo-journal-v1.mjs';
import {MINI_CBT_PROFILE} from '../k56-offline-shared/profiles.mjs';
const runtime=createOfflineRuntime({...MINI_CBT_PROFILE,verifyRestoredDeadline:true,parallelEntryFlag:'miniCbtParallelEntry'});
export const {BUILD,canonical,hash,ExamStore,exportHtml}=runtime;
export class OfflineRuntime extends withListeningContinuity(runtime.OfflineRuntime){
 constructor(options){super(options);this.needsCapabilityCheck=true;}
 async prepare(prepared,identity){const result=await super.prepare(prepared,identity);this.needsCapabilityCheck=false;return result;}
 async restorePrepared(prepared,studentRef){
  if(!await super.restorePrepared(prepared,studentRef))return false;
  const enabled=prepared.miniCbtParallelEntry===true,changed=enabled&&!this.record.prepared.miniCbtParallelEntry;
  if(enabled)this.record.prepared.miniCbtParallelEntry=true;
  const progressed=this.acceptOfficialProgress(prepared.officialProgress);
  this.needsCapabilityCheck=false;
  if(changed||progressed)await this.persist(true);
  return true;
 }
 async refreshOfficialProgress(){
  if(!this.active||globalThis.navigator?.onLine===false)return false;
  if(this.progressRefresh)return this.progressRefresh;
  const run=this.record,scope={...this.scope};
  this.progressRefresh=(async()=>{
   try{
    const response=await this.fetchImpl(this.apiBase+'/api/term-tests/'+MINI_CBT_PROFILE.slug+'/attempt/prepare',{
     method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(1500),
     body:JSON.stringify({...scope,classCode:this.classCode,studentRef:run.studentRef,mode:run.prepared.examMode,
      attemptMode:'cbt',identityConfirmed:true,miniCbtContinuationVersion:1})});
    if(!response.ok)throw Error('Chưa đọc được tiến độ chính thức.');
    const prepared=await response.json();
    if(prepared.ok!==true||prepared.attemptToken!==scope.attemptToken||prepared.examSessionToken!==scope.examSessionToken
      ||Number(prepared.generation)!==scope.generation||prepared.attemptMode!=='cbt'||prepared.examMode!==run.prepared.examMode)
     throw Error('Tiến độ chưa khớp lượt trên thiết bị.');
    if(this.record!==run||!this.owned)return false;
    const changed=prepared.miniCbtParallelEntry===true&&!run.prepared.miniCbtParallelEntry;
    if(prepared.miniCbtParallelEntry===true)run.prepared.miniCbtParallelEntry=true;
    const progressed=this.acceptOfficialProgress(prepared.officialProgress);
    this.needsCapabilityCheck=false;
    if(changed||progressed){await this.persist(true);this.observe('official_section_restored',{phase:'resume'});}
    return true;
   }catch{
    if(this.record===run)this.observe('official_progress_unavailable',{phase:'resume',errorCode:'OFFICIAL_PROGRESS_UNAVAILABLE'});
    return false;
   }
  })().finally(()=>{this.progressRefresh=null;});
  return this.progressRefresh;
 }
 async flush(){
  if(this.active&&this.needsCapabilityCheck&&!await this.refreshOfficialProgress())return;
  return super.flush();
 }
}
