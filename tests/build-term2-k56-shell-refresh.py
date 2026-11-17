"""Refresh Term2's immutable shell after the shared Reading journal changed."""
from pathlib import Path
from hashlib import sha256
import json,re
root=Path(__file__).resolve().parents[1]
route=root/'term-tests/term-test-2-k56-computer-based'
def write(path,text):path.write_text(text,encoding='utf-8',newline='\n')
bootstrap=(route/'bootstrap-listening-report-v2.js').read_text(encoding='utf-8')
assert bootstrap.count('./offline-worker-listening-report-v2.js')==2
bootstrap=bootstrap.replace('./offline-worker-listening-report-v2.js','./offline-worker-listening-report-v3.js')
write(route/'bootstrap-listening-report-v3.js',bootstrap)
index=(route/'index-listening-report-v2.html').read_text(encoding='utf-8')
assert index.count('bootstrap-listening-report-v2.js?')==1
index=index.replace('bootstrap-listening-report-v2.js?','bootstrap-listening-report-v3.js?shell=20261118-v1&amp;')
needle='    <script src="bootstrap-listening-report-v3.js?'
assert index.count(needle)==1
index=index.replace(needle,'    <link rel="stylesheet" href="../k56-offline-shared/interruption-dialog-stability-v1.css">\n'+needle)
write(route/'index-listening-report-v3.html',index);write(route/'index.html',index)
worker=(route/'worker-listening-report-v2.mjs').read_text(encoding='utf-8')
assert worker.count("'index-listening-report-v2.html'")==1
worker=worker.replace("'index-listening-report-v2.html'","'index-listening-report-v3.html'")
write(route/'worker-listening-report-v3.mjs',worker)
write(route/'offline-worker-listening-report-v3.js',
 "import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-listening-report-v3.mjs';\n"
 "import {registerExamShell} from './worker-listening-report-v3.mjs';\n"
 "registerExamShell({build:'term2-offline-20261106-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});\n")
previous=(route/'offline-assets-listening-report-v2.mjs').read_text(encoding='utf-8')
assets=json.loads(re.search(r'export const ASSETS\s*=(\[.*?\]);',previous,re.S).group(1))
assert 'index.html' not in assets
for name in ['bootstrap-listening-report-v3.js','index-listening-report-v3.html','worker-listening-report-v3.mjs',
 'offline-worker-listening-report-v3.js','../k56-offline-shared/interruption-dialog-stability-v1.css']:
 assert name not in assets;assets.append(name)
hashes={}
for name in assets:
 value=(route/name).read_bytes()
 if (route/name).suffix not in ['.png','.woff2']:value=value.replace(b'\r\n',b'\n')
 hashes[name]=sha256(value).hexdigest()
build=sha256(json.dumps(dict(sorted(hashes.items())),separators=(',',':')).encode()).hexdigest()
write(route/'offline-assets-listening-report-v3.mjs','// Separate immutable shell; previous package files stay unchanged.\n'
 +'export const ASSETS='+json.dumps(assets,indent=2)+';\nexport const ASSET_HASHES='+json.dumps(hashes,indent=2)
 +';\nexport const ASSET_BUILD_ID='+json.dumps(build)+';\n')
print(json.dumps({'assets':len(assets),'build':build}))
