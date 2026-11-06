"""So hash cache với blob qua bộ lọc Git thật, độc lập cách chuẩn hóa của generator."""
from pathlib import Path
import subprocess,json,hashlib
root=Path(__file__).resolve().parents[1];route=root/'term-tests/term-test-2-k56-computer-based'
raw=(route/'offline-assets.mjs').read_text(encoding='utf-8')
hashes=json.loads(raw.split('export const ASSET_HASHES=',1)[1].split(';',1)[0])
names=[]
for key in hashes:
 p=(route/key).resolve()
 if not p.is_relative_to(root):raise RuntimeError('Outside public source')
 names.append(p.relative_to(root).as_posix())
oids=subprocess.run(['git','hash-object','-w','--stdin-paths'],cwd=root,input=('\n'.join(names)+'\n').encode(),stdout=subprocess.PIPE,check=True).stdout.splitlines()
blobs=subprocess.run(['git','cat-file','--batch'],cwd=root,input=b'\n'.join(oids)+b'\n',stdout=subprocess.PIPE,check=True).stdout
offset=0
for key,oid in zip(hashes,oids,strict=True):
 end=blobs.index(b'\n',offset);header=blobs[offset:end].split();assert header[0]==oid and header[1]==b'blob'
 size=int(header[2]);data=blobs[end+1:end+1+size];offset=end+2+size
 if hashlib.sha256(data).hexdigest()!=hashes[key]:raise RuntimeError('Published bytes differ: '+key)
print(json.dumps({'outcome':'passed','gitBlobsChecked':len(hashes),'manifestSha256':hashlib.sha256((route/'offline-assets.mjs').read_bytes()).hexdigest()}))
