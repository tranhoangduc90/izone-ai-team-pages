"""Build a separate Term1 K56 package from the verified serving entry.

Keep all old package files intact. The new shell uses an immutable entry document;
only index.html changes which package a fresh navigation loads.
"""
from pathlib import Path
from hashlib import sha256
import json
import re

root=Path(__file__).resolve().parents[1]
route=root/'term-tests/term-test-1-k56-computer-based'
shared=root/'term-tests/k56-offline-shared'

def once(source,before,after):
    assert source.count(before)==1,before[:120]
    return source.replace(before,after,1)

def write(path,value):
    path.write_text(value,encoding='utf-8',newline='\n')

runtime=(shared/'runtime-term2-parallel-entry-v1.mjs').read_text(encoding='utf-8')
runtime=once(runtime,'if(!run.prepared.term2ParallelEntry||!progress)return false;',
    "if(!run.prepared[profile.parallelEntryFlag??'term2ParallelEntry']||!progress)return false;")
runtime=once(runtime,'supersededLocalOperations:clone(record.supersededLocalOperations||[]),',
    'supersededLocalOperations:(record.supersededLocalOperations||[]).map(({operationId,section,kind,revision,occurredAt,dependency,payload})=>clone({operationId,section,kind,revision,occurredAt,dependency,payload})),')
write(shared/'runtime-parallel-entry-v2.mjs',runtime)

offline=(route/'offline-submission-recovery-v1.mjs').read_text(encoding='utf-8')
offline=once(offline,'runtime-term-submission-recovery-v1.mjs?v=20261107-k56-r2-v1','runtime-parallel-entry-v2.mjs')
offline=once(offline,'verifyRestoredDeadline:true','verifyRestoredDeadline:true,parallelEntryFlag:\'term1ParallelEntry\'')
offline=once(offline,'    const progress = await response.json();',
    '''    const progress = await response.json();
    if(this.acceptOfficialProgress(progress.officialProgress)){
     await this.persist(true);
     this.observe('official_section_restored',{phase:'resume'});
    }''')
write(route/'offline-term1-parallel-entry-v1.mjs',offline)

bootstrap=(route/'bootstrap-listening-first-frame-v1.js').read_text(encoding='utf-8')
assert bootstrap.count('offline-submission-recovery-v1.mjs?v=20261108-term1-fallback-resume-v1')==2
bootstrap=bootstrap.replace('offline-submission-recovery-v1.mjs?v=20261108-term1-fallback-resume-v1','offline-term1-parallel-entry-v1.mjs')
assert bootstrap.count('./offline-worker-listening-first-frame-v1.js')==2
bootstrap=bootstrap.replace('./offline-worker-listening-first-frame-v1.js','./offline-worker-term1-parallel-entry-v1.js')
bootstrap=once(bootstrap,'const [{bindListeningReport},{term1K56ListeningReportMap},outbox]',
    'const [{attachListeningReportChoices},{term1K56ListeningReportMap},outbox]')
bootstrap=once(bootstrap,"import('../substitute-shared/listening-report-v1.mjs')",
    "import('../k67-shared/listening-report-choices-v2.mjs')")
bootstrap=once(bootstrap,'reportModules={bindListeningReport,map:term1K56ListeningReportMap,outbox};',
    'reportModules={attachListeningReportChoices,map:term1K56ListeningReportMap,outbox};')
assert bootstrap.count("loadScript('listening-first-frame-v1.js')")==2
bootstrap=bootstrap.replace("loadScript('listening-first-frame-v1.js')","loadScript('listening-first-frame-term1-parallel-v1.js')")
bootstrap=once(bootstrap,'          publicAudioVersion: 1,','          term1ContinuationVersion: 1,\n          publicAudioVersion: 1,')
bootstrap=once(bootstrap,"      if (prepared.nextSection !== 'listening') {",
    "      if(term1Offline?.active&&prepared.term1ParallelEntry)Object.assign(prepared,term1Offline.sectionResponse());\n"
    "      if (prepared.nextSection !== 'listening') {")
bootstrap=once(bootstrap,'    const runtime=term1Offline;\n    await runtime.refreshCompletedElsewhere();',
    '''    const runtime=term1Offline;
    // Keep the restored exam usable while the new immutable shell is verified.
    // If updating fails, the existing verified shell and current draft remain.
    if(navigator.onLine!==false)void runtime.prepareCache().catch(()=>{
      runtime.observe('offline_shell_update_failed',{errorCode:'OFFLINE_SHELL_UPDATE_FAILED'});
    });
    await runtime.refreshCompletedElsewhere();''')
write(route/'bootstrap-term1-parallel-entry-v1.js',bootstrap)

# Carry only the report interaction into the Term1 view; preserve its geometry,
# raw/compound question mapping, grant handling and player controller.
view=(route/'listening-first-frame-v1.js').read_text(encoding='utf-8')
reference=(root/'term-tests/term-test-2-k56-computer-based/listening-first-frame-report-v2.js').read_text(encoding='utf-8')
start=view.index('      report.bindListeningReport({')
end=view.index('\n    }\n\n    if (protectedBootstrap?.officialAudioElement',start)
new_start=reference.index('      let forwarding=false, pendingReportId=null;')
new_end=reference.index('\n    }\n\n    if (protectedBootstrap?.officialAudioElement',new_start)
view=view[:start]+reference[new_start:new_end]+view[end:]
write(route/'listening-first-frame-term1-parallel-v1.js',view)

index=(route/'index-listening-first-frame-v1.html').read_text(encoding='utf-8')
index=once(index,'bootstrap-listening-first-frame-v1.js?','bootstrap-term1-parallel-entry-v1.js?parallel=20261118-v1&amp;')
index=once(index,'    <script src="bootstrap-term1-parallel-entry-v1.js?',
    '    <link rel="stylesheet" href="../k67-shared/listening-report-choices-v1.css">\n'
    '    <link rel="stylesheet" href="../k56-offline-shared/interruption-dialog-stability-v1.css">\n'
    '    <script src="bootstrap-term1-parallel-entry-v1.js?')
write(route/'index-term1-parallel-entry-v1.html',index)
write(route/'index.html',index)
worker=(route/'worker-listening-first-frame-v1.mjs').read_text(encoding='utf-8')
worker=once(worker,"'index-listening-first-frame-v1.html'","'index-term1-parallel-entry-v1.html'")
write(route/'worker-term1-parallel-entry-v1.mjs',worker)
write(route/'offline-worker-term1-parallel-entry-v1.js',
    "import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-term1-parallel-entry-v1.mjs';\n"
    "import {registerExamShell} from './worker-term1-parallel-entry-v1.mjs';\n"
    "registerExamShell({build:'term1-offline-20261107-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});\n")

# Keep the tested closure, including optional journal imports required by this shell.
original=(route/'offline-assets-listening-first-frame-v1.mjs').read_text(encoding='utf-8')
assets=json.loads(re.search(r'export const ASSETS=(\[.*?\]);',original,re.S).group(1))
for name in ['../k56-offline-shared/runtime-parallel-entry-v2.mjs','offline-term1-parallel-entry-v1.mjs',
             'bootstrap-term1-parallel-entry-v1.js','index-term1-parallel-entry-v1.html',
             'worker-term1-parallel-entry-v1.mjs','offline-worker-term1-parallel-entry-v1.js',
             'listening-first-frame-term1-parallel-v1.js','../k67-shared/listening-report-choices-v2.mjs',
             '../k67-shared/listening-report-choices-v1.css','../term-test-2-computer-based/listening-report-evidence-v1.mjs',
             '../k56-offline-shared/interruption-dialog-stability-v1.css']:
    assert name not in assets
    assets.append(name)
assert 'index.html' not in assets
hashes={name:sha256((route/name).read_bytes().replace(b'\r\n',b'\n') if (route/name).suffix not in ['.png','.woff2'] else (route/name).read_bytes()).hexdigest() for name in assets}
build=sha256(json.dumps(dict(sorted(hashes.items())),separators=(',',':')).encode()).hexdigest()
write(route/'offline-assets-term1-parallel-entry-v1.mjs',
    '// Public shell only; preserve the old package and its immutable entry.\n'
    +'export const ASSETS='+json.dumps(assets,indent=2)+';\n'
    +'export const ASSET_HASHES='+json.dumps(hashes,indent=2)+';\n'
    +'export const ASSET_BUILD_ID='+json.dumps(build)+';\n')
print(json.dumps({'assets':len(assets),'build':build,'immutableEntry':'index-term1-parallel-entry-v1.html'}))
