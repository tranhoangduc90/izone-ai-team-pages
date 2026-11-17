"""Ghép progress Mini trên đúng runtime Mini hiện hành, giữ các sửa cứu seal/audio."""
from pathlib import Path
from hashlib import sha256
import json,re
root=Path(__file__).resolve().parents[1]
route=root/'term-tests/mini-test-k56-computer-based'
shared=root/'term-tests/k56-offline-shared'
def once(source,before,after):
    assert source.count(before)==1,before[:120]
    return source.replace(before,after,1)
def write(path,source):path.write_text(source,encoding='utf-8',newline='\n')

runtime=(shared/'runtime-recovery-v1.mjs').read_text(encoding='utf-8')
reference=(shared/'runtime-parallel-entry-v2.mjs').read_text(encoding='utf-8')
runtime=once(runtime,'  pending:(record.operations||[]).map(o=>',
 "  supersededLocalOperations:(record.supersededLocalOperations||[]).map(({operationId,section,kind,revision,occurredAt,dependency,payload})=>clone({operationId,section,kind,revision,occurredAt,dependency,payload})),\n"
 '  pending:(record.operations||[]).map(o=>')
runtime=once(runtime,"  this.key='run:'+response.attemptToken;await this.claim();this.anchor();await this.persist();",
 "  this.acceptOfficialProgress(this.record.prepared.officialProgress);\n"
 "  this.key='run:'+response.attemptToken;await this.claim();this.anchor();await this.persist();")
start=reference.index(' acceptOfficialProgress(');end=reference.index(' async prepareCache()',start)
progress=once(reference[start:end],
 '   const section=run.sections[skill]||{};',
 '   const section=run.sections[skill]||{};\n'
 '   // A resume response cannot distinguish our committed seal from another profile.\n'
 '   // Keep the pending seal until its status returns a receipt or explicit conflict.\n'
 "   if(!onlySkill&&section.operationId&&run.operations.some(op=>op.operationId===section.operationId\n"
 "      &&(op.kind==='seal'||op.kind==='interrupt')))continue;")
runtime=once(runtime,' async prepareCache(){',progress+' async prepareCache(){')
runtime=once(runtime,"   const result=status.persisted?status:await this.post('/offline/operation',op),r=result.receipt;",
 "   if(!status.persisted && this.acceptOfficialProgress(status.officialProgress,op.section)){\n"
 "    this.observe('official_section_restored',{section:op.section,phase:'status'});\n"
 "    await this.persist();continue;\n   }\n"
 "   const result=status.persisted?status:await this.post('/offline/operation',op),r=result.receipt;")
runtime=once(runtime,"   if(!r||r.operationId!==op.operationId",
 "   if(!result.persisted && this.acceptOfficialProgress(result.officialProgress,op.section)){\n"
 "    this.observe('official_section_restored',{section:op.section,phase:'operation'});\n"
 "    await this.persist();continue;\n   }\n"
 "   if(!r||r.operationId!==op.operationId")
write(shared/'runtime-mini-parallel-entry-v1.mjs',runtime)

write(route/'offline-mini-parallel-entry-v1.mjs',"""import {createOfflineRuntime,withListeningContinuity} from '../k56-offline-shared/runtime-mini-parallel-entry-v1.mjs';
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
""")

old_report=(route/'listening-report-v1.mjs').read_text(encoding='utf-8')
gaps=re.search(r'const readingWindows = (\[.*?\]);',old_report,re.S).group(1)
audible=re.search(r'const audibleWindows = (\[.*?\]);',old_report,re.S).group(1)
audio_hash=re.search(r"const miniAudioHash = '([a-f0-9]{64})'",old_report).group(1)
write(route/'listening-report-map-mini-v1.mjs',
 "// Same verified Mini media windows; choices use the shared classifier.\n"
 "export const miniK56ListeningReportMap=Object.freeze({version:1,sha256:'"+audio_hash+"',readingGaps:"+gaps+",audibleWindows:"+audible+"});\n")
view=(route/'listening-view-v1.js').read_text(encoding='utf-8')
view=once(view,'function setupBufferedAudio(listeningForm, attachListeningReport, reportOutbox, watchOnlineListeningReports)',
 'function setupBufferedAudio(listeningForm, report, reportOutbox, watchOnlineListeningReports)')
start=view.index('    function watchManualReport(');end=view.index('    function observeListening(',start)
view=view[:start]+"""    function watchManualReport(player, button, canReport, mode, runtime, captureOnline) {
      const capture=runtime?reportOutbox?.watch({form:listeningForm.form,player,assetHash:protectedBootstrap.officialAudioHash}):captureOnline;
      function publish(details){
        const data={mode,section:'listening',mapVersion:1,...details};
        if(runtime)runtime.observe('mini_player_observation',data);
        else{
          const config=window.TERM_TEST_APP_CONFIG;
          const endpoint=config.EXAM_JOURNAL_BASE_URL||config.API_BASE_URL+'/api/term-tests/'+testConfig.slug;
          const key=JSON.stringify([new URL(endpoint,location.href).href,testConfig.slug]);
          window[Symbol.for('izone.examJournal.connections.v1')]?.get(key)?.recordK56Submission?.(
            protectedBootstrap,'state_observed',{cause:'mini_k56_online',checkpointState:{offlineVersion:1,action:'mini_player_observation',...data}});
        }
      }
      let forwarding=false,pendingReportId=null;
      if(runtime)listeningForm.form.addEventListener('term-test:listening-interrupted',()=>{
        const operationId=runtime.record.sections.listening?.operationId;
        if(!pendingReportId||!operationId)return;
        publish({phase:'report_interruption_device_saved',reportVersion:2,reportId:pendingReportId,operationId});
        pendingReportId=null;
      });
      report.attachListeningReportChoices({audio:player,button,host:examCard,profile:report.map,
        assetHash:protectedBootstrap.officialAudioHash,active:canReport,
        captureEvidence:positionSeconds=>capture?.(positionSeconds),
        interceptClick(event){if(forwarding||pendingReportId)return false;event.stopImmediatePropagation();return true;},
        observe(phase,details){publish({phase,...details});},
        onConfirm({reportId}){if(runtime)pendingReportId=reportId;forwarding=true;try{button.click();}finally{forwarding=false;}}
      });
    }

"""+view[end:]
view=once(view,"        const {attachListeningReport} = await import('./listening-report-v1.mjs');\n        setupBufferedAudio(listeningForm, attachListeningReport, reportOutbox, watchOnlineListeningReports);",
 "        const [{attachListeningReportChoices},{miniK56ListeningReportMap}]=await Promise.all([\n"
 "          import('../k67-shared/listening-report-choices-v2.mjs'),import('./listening-report-map-mini-v1.mjs')]);\n"
 "        setupBufferedAudio(listeningForm,{attachListeningReportChoices,map:miniK56ListeningReportMap},reportOutbox,watchOnlineListeningReports);")
write(route/'listening-view-mini-parallel-v1.js',view)
write(route/'listening-report-mini-dialog-v1.css',"""/* Scoped Mini adaptation of its existing identity/interruption dialog. */
#k67ListeningReportChoices {
  width: min(510px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 26px 20px 20px;
  border: 0;
  border-radius: 14px;
  background: white;
  color: #173b67;
  box-shadow: 0 20px 60px #14284640;
  font: 15px/1.5 system-ui, sans-serif;
}
#k67ListeningReportChoices::backdrop { background: #10223b80; }
#k67ListeningReportChoices h2 { margin: 0 0 12px; }
#k67ListeningReportChoices .cbt-identity-confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
#k67ListeningReportChoices .cbt-identity-confirmation-actions button { width: auto; }
""")

bootstrap=(route/'bootstrap-shell-v3.js').read_text(encoding='utf-8')
old='offline-audio-status-v2.mjs?journalAudio=20261114-mini-journal-v1&release=20261112-mini-recovery&v=20261107-mini-v1&miniAudio=20261108-v1&audioSeal=20261113-v1'
assert bootstrap.count(old)==2
bootstrap=bootstrap.replace(old,'offline-mini-parallel-entry-v1.mjs')
bootstrap=once(bootstrap,"loadScript('listening-view-v1.js')","loadScript('listening-view-mini-parallel-v1.js')")
assert bootstrap.count('./offline-worker-shell-v3.js')==2
bootstrap=bootstrap.replace('./offline-worker-shell-v3.js','./offline-worker-mini-parallel-entry-v1.js')
bootstrap=once(bootstrap,'          publicAudioVersion: 1,','          miniCbtContinuationVersion: 1,\n          publicAudioVersion: 1,')
bootstrap=once(bootstrap,'    const runtime=miniOffline;\n    const listening',
 "    const runtime=miniOffline;\n    await runtime.refreshOfficialProgress();\n"
 "    if(navigator.onLine!==false)void runtime.prepareCache().catch(()=>{\n"
 "      runtime.observe('offline_shell_update_failed',{errorCode:'OFFLINE_SHELL_UPDATE_FAILED'});\n    });\n"
 '    const listening')
bootstrap=once(bootstrap,"      if (prepared.nextSection !== 'listening') {",
 "      if(miniOffline?.active&&prepared.miniCbtParallelEntry)Object.assign(prepared,miniOffline.sectionResponse());\n"
 "      if (prepared.nextSection !== 'listening') {")
bootstrap=bootstrap.replace("!shell.includes('/offline-worker-shell-v3.js')","!shell.includes('/offline-worker-mini-parallel-entry-v1.js')")
write(route/'bootstrap-mini-parallel-entry-v1.js',bootstrap)
index=(route/'index-shell-v3.html').read_text(encoding='utf-8')
index=once(index,'bootstrap-shell-v3.js?','bootstrap-mini-parallel-entry-v1.js?parallel=20261118-v1&amp;')
index=once(index,'  </head>',
 '    <link rel="stylesheet" href="../k67-shared/listening-report-choices-v1.css">\n'
 '    <link rel="stylesheet" href="listening-report-mini-dialog-v1.css">\n'
 '    <link rel="stylesheet" href="../k56-offline-shared/interruption-dialog-stability-v1.css">\n  </head>')
write(route/'index-mini-parallel-entry-v1.html',index);write(route/'index.html',index)
worker=(route/'worker-shell-v3.mjs').read_text(encoding='utf-8')
worker=once(worker,"'index-shell-v3.html'","'index-mini-parallel-entry-v1.html'")
write(route/'worker-mini-parallel-entry-v1.mjs',worker)
write(route/'offline-worker-mini-parallel-entry-v1.js',
 "import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-mini-parallel-entry-v1.mjs';\n"
 "import {registerExamShell} from './worker-mini-parallel-entry-v1.mjs';\n"
 "registerExamShell({build:'mini-k56-cbt-offline-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});\n")
previous=(route/'offline-assets-shell-v3.mjs').read_text(encoding='utf-8')
assets=json.loads(re.search(r'export const ASSETS=(\[.*?\]);',previous,re.S).group(1))
assets=[name for name in assets if name!='index.html']
for name in ['../k56-offline-shared/runtime-mini-parallel-entry-v1.mjs','offline-mini-parallel-entry-v1.mjs',
 'bootstrap-mini-parallel-entry-v1.js','index-mini-parallel-entry-v1.html','worker-mini-parallel-entry-v1.mjs','offline-worker-mini-parallel-entry-v1.js',
 'listening-view-mini-parallel-v1.js','listening-report-map-mini-v1.mjs','../k67-shared/listening-report-choices-v2.mjs',
 'listening-report-mini-dialog-v1.css',
 '../k67-shared/listening-report-choices-v1.css','../k56-offline-shared/interruption-dialog-stability-v1.css',
 '../substitute-shared/listening-report-v1.mjs','../term-test-2-computer-based/listening-report-evidence-v1.mjs']:
    if name not in assets:assets.append(name)
hashes={}
for name in assets:
    data=(route/name).read_bytes()
    if Path(name).suffix in ['.html','.js','.mjs','.css','.json','.svg','.txt']:data=data.replace(b'\r\n',b'\n')
    hashes[name]=sha256(data).hexdigest()
build=sha256(json.dumps(dict(sorted(hashes.items())),separators=(',',':')).encode()).hexdigest()
write(route/'offline-assets-mini-parallel-entry-v1.mjs','// Mini CBT immutable parallel package; previous assets unchanged.\n'
 +'export const ASSETS='+json.dumps(assets,indent=2)+';\nexport const ASSET_HASHES='+json.dumps(hashes,indent=2)
 +';\nexport const ASSET_BUILD_ID='+json.dumps(build)+';\n')
print(json.dumps({'assets':len(assets),'build':build,'miniRecoveryBasePreserved':True}))
