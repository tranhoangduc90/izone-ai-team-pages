"""Giữ gói Term 1 đã phát, thêm wrapper giữ biên nhận đang chờ khi resume."""
from pathlib import Path
from hashlib import sha256
import json,re
root=Path(__file__).resolve().parents[1]
route=root/'term-tests/term-test-1-k56-computer-based'
def write(name,text):(route/name).write_text(text,encoding='utf-8',newline='\n')
def once(text,before,after):
 assert text.count(before)==1,before
 return text.replace(before,after,1)
write('offline-term1-receipt-resume-v2.mjs',"""import {Term1Offline as Previous} from './offline-term1-parallel-entry-v1.mjs';
export {BUILD,canonical,hash,ExamStore,exportHtml} from './offline-term1-parallel-entry-v1.mjs';
export class Term1Offline extends Previous {
 acceptOfficialProgress(progress,onlySkill=null){
  if(progress&&!onlySkill&&this.record){
   progress={...progress};
   for(const [skill,section] of Object.entries(this.record.sections)){
    // Resume cannot tell our unacknowledged commit from another profile's seal.
    // Status must read its receipt or an explicit conflict before discarding it.
    if(section.operationId&&this.record.operations.some(op=>op.operationId===section.operationId
      &&(op.kind==='seal'||op.kind==='interrupt')))delete progress[skill];
   }
  }
  return super.acceptOfficialProgress(progress,onlySkill);
 }
}
""")
bootstrap=(route/'bootstrap-term1-parallel-entry-v1.js').read_text(encoding='utf-8')
assert bootstrap.count('offline-term1-parallel-entry-v1.mjs')==2
bootstrap=bootstrap.replace('offline-term1-parallel-entry-v1.mjs','offline-term1-receipt-resume-v2.mjs')
assert bootstrap.count('offline-worker-term1-parallel-entry-v1.js')==2
bootstrap=bootstrap.replace('offline-worker-term1-parallel-entry-v1.js','offline-worker-term1-receipt-resume-v2.js')
write('bootstrap-term1-receipt-resume-v2.js',bootstrap)
index=(route/'index-term1-parallel-entry-v1.html').read_text(encoding='utf-8')
index=once(index,'bootstrap-term1-parallel-entry-v1.js?','bootstrap-term1-receipt-resume-v2.js?receiptResume=20261118-v2&amp;')
write('index-term1-receipt-resume-v2.html',index);write('index.html',index)
worker=(route/'worker-term1-parallel-entry-v1.mjs').read_text(encoding='utf-8')
write('worker-term1-receipt-resume-v2.mjs',once(worker,"'index-term1-parallel-entry-v1.html'","'index-term1-receipt-resume-v2.html'"))
write('offline-worker-term1-receipt-resume-v2.js',
 "import {ASSETS,ASSET_HASHES,ASSET_BUILD_ID} from './offline-assets-term1-receipt-resume-v2.mjs';\n"
 "import {registerExamShell} from './worker-term1-receipt-resume-v2.mjs';\n"
 "registerExamShell({build:'term1-offline-20261107-v1',assets:ASSETS,hashes:ASSET_HASHES,assetBuildId:ASSET_BUILD_ID});\n")
previous=(route/'offline-assets-term1-parallel-entry-v1.mjs').read_text(encoding='utf-8')
assets=json.loads(re.search(r'export const ASSETS=(\[.*?\]);',previous,re.S).group(1))
for name in ['offline-term1-receipt-resume-v2.mjs','bootstrap-term1-receipt-resume-v2.js','index-term1-receipt-resume-v2.html',
 'worker-term1-receipt-resume-v2.mjs','offline-worker-term1-receipt-resume-v2.js']:
 assert name not in assets;assets.append(name)
assert 'index.html' not in assets
hashes={}
for name in assets:
 data=(route/name).read_bytes()
 if Path(name).suffix in ['.html','.js','.mjs','.css','.json','.svg','.txt']:data=data.replace(b'\r\n',b'\n')
 hashes[name]=sha256(data).hexdigest()
build=sha256(json.dumps(dict(sorted(hashes.items())),separators=(',',':')).encode()).hexdigest()
write('offline-assets-term1-receipt-resume-v2.mjs','// Separate immutable receipt/resume package; previous files unchanged.\n'
 +'export const ASSETS='+json.dumps(assets,indent=2)+';\nexport const ASSET_HASHES='+json.dumps(hashes,indent=2)
 +';\nexport const ASSET_BUILD_ID='+json.dumps(build)+';\n')
print(json.dumps({'assets':len(assets),'build':build}))
