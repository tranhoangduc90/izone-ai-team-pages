"""New immutable Term2 shell, reusing the scope-safe runtime already used by Term1."""
from pathlib import Path
from hashlib import sha256
import json,re
root=Path(__file__).resolve().parents[1]
route=root/'term-tests/term-test-2-k56-computer-based'
def write(file,text):file.write_text(text,encoding='utf-8',newline='\n')
wrapper=(route/'offline-term2-parallel-entry-v1.mjs').read_text(encoding='utf-8')
assert wrapper.count('runtime-term2-parallel-entry-v1.mjs')==1
write(route/'offline-term2-export-v2.mjs',wrapper.replace('runtime-term2-parallel-entry-v1.mjs','runtime-parallel-entry-v2.mjs'))
bootstrap=(route/'bootstrap-listening-report-v3.js').read_text(encoding='utf-8')
assert bootstrap.count('offline-term2-parallel-entry-v1.mjs')==2
assert bootstrap.count('offline-worker-listening-report-v3.js')==2
bootstrap=bootstrap.replace('offline-term2-parallel-entry-v1.mjs','offline-term2-export-v2.mjs').replace('offline-worker-listening-report-v3.js','offline-worker-listening-report-v4.js')
anchor='  async function restoreOffline(preparationStatus) {\n    const runtime=term2Offline;'
assert bootstrap.count(anchor)==1
bootstrap=bootstrap.replace(anchor,anchor+'''
    // Keep the current exam usable while the new immutable shell is verified.
    if(navigator.onLine!==false)void runtime.prepareCache().catch(()=>{
      runtime.observe('offline_shell_update_failed',{errorCode:'OFFLINE_SHELL_UPDATE_FAILED'});
    });''')
write(route/'bootstrap-listening-report-v4.js',bootstrap)
index=(route/'index-listening-report-v3.html').read_text(encoding='utf-8')
assert index.count('bootstrap-listening-report-v3.js?')==1
index=index.replace('bootstrap-listening-report-v3.js?','bootstrap-listening-report-v4.js?exportScope=20261118-v1&amp;')
write(route/'index-listening-report-v4.html',index);write(route/'index.html',index)
worker=(route/'worker-listening-report-v3.mjs').read_text(encoding='utf-8')
assert worker.count("'index-listening-report-v3.html'")==1
write(route/'worker-listening-report-v4.mjs',worker.replace("'index-listening-report-v3.html'","'index-listening-report-v4.html'"))
write(route/'offline-worker-listening-report-v4.js',
 "import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-listening-report-v4.mjs';\n"
 "import {registerExamShell} from './worker-listening-report-v4.mjs';\n"
 "registerExamShell({build:'term2-offline-20261106-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});\n")
previous=(route/'offline-assets-listening-report-v3.mjs').read_text(encoding='utf-8')
assets=json.loads(re.search(r'export const ASSETS\s*=(\[.*?\]);',previous,re.S).group(1))
for name in ['bootstrap-listening-report-v4.js','index-listening-report-v4.html','worker-listening-report-v4.mjs',
 'offline-worker-listening-report-v4.js','offline-term2-export-v2.mjs','../k56-offline-shared/runtime-parallel-entry-v2.mjs']:
 assert name not in assets;assets.append(name)
hashes={}
for name in assets:
 data=(route/name).read_bytes()
 if not re.search(r'\.(png|woff2)$',name):data=data.replace(b'\r\n',b'\n')
 hashes[name]=sha256(data).hexdigest()
build=sha256(json.dumps(dict(sorted(hashes.items())),separators=(',',':')).encode()).hexdigest()
write(route/'offline-assets-listening-report-v4.mjs','// Export fix; all previous package files remain unchanged.\n'
 +'export const ASSETS='+json.dumps(assets,indent=2)+';\nexport const ASSET_HASHES='+json.dumps(hashes,indent=2)
 +';\nexport const ASSET_BUILD_ID='+json.dumps(build)+';\n')
print(json.dumps({'assets':len(assets),'build':build}))
