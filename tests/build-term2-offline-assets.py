"""Danh mục tài nguyên công khai của Term 2; không lấy API, key hay audio vào vỏ cache."""
from pathlib import Path
import json,re,html,hashlib
from urllib.parse import urlparse,unquote

root=Path(__file__).resolve().parents[1]
route=root/'term-tests/term-test-2-k56-computer-based'
dirs=['term-tests/term-test-2-k56-computer-based','term-tests/k56-test2-shared','term-tests/shared','shared','term-tests/k56-design','term-tests/k56-demo-reset','term-tests/k56-exam-integrity','term-tests/k56-writing-feedback']
allowed={'.js','.mjs','.css','.html','.woff2','.png','.svg'}
files={p for d in dirs for p in (root/d).rglob('*') if p.is_file() and p.suffix in allowed and 'private' not in p.parts}
files.update(root/p for p in ['term-tests/k56-audio-recovery.js','term-tests/k56-exam-order.js','term-tests/term-test-2-k56/test-config.js','term-tests/demo/reset-listener.js'])
queue=list(files)
while queue:
 p=queue.pop()
 if p.suffix not in {'.js','.mjs','.css','.html'}:continue
 for ref in re.findall(r'''["'(]([^"'()\s<>]+\.(?:js|mjs|css|woff2|png|svg|html)(?:\?[^"'()\s<>]*)?)["')]''',p.read_text(encoding='utf-8')):
  parsed=urlparse(html.unescape(ref))
  if parsed.scheme or parsed.netloc:continue
  candidate=(root/parsed.path.lstrip('/') if parsed.path.startswith('/') else p.parent/unquote(parsed.path)).resolve()
  if candidate.is_relative_to(root) and candidate.is_file() and candidate not in files:files.add(candidate);queue.append(candidate)
files.discard(route/'offline-assets.mjs')
import os
assets=sorted(os.path.relpath(p,route).replace('\\','/') for p in files)
def published_bytes(path):
 data=path.read_bytes()
 # Git chuẩn hóa các file text của đồ thị này về LF trước khi Pages phát hành.
 return data if path.suffix in {'.png','.woff2'} else data.replace(b'\r\n',b'\n')
hashes={name:hashlib.sha256(published_bytes(route/name)).hexdigest() for name in assets}
build_id=hashlib.sha256(json.dumps(hashes,sort_keys=True,separators=(',',':')).encode()).hexdigest()
(route/'offline-assets.mjs').write_text('// Tạo từ byte public Git/Pages (text LF); không chứa đáp án hoặc quyền.\nexport const ASSETS='+json.dumps(assets,ensure_ascii=False,indent=2)+';\nexport const ASSET_HASHES='+json.dumps(hashes,ensure_ascii=False,indent=2)+';\nexport const ASSET_BUILD_ID='+json.dumps(build_id)+';\n',encoding='utf-8',newline='\n')
print(json.dumps({'assets':len(assets),'bytes':sum(p.stat().st_size for p in files)}))
