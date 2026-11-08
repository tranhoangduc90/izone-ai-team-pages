"""Build the public skill shells. Exam content and API responses stay outside the cache."""
import hashlib
import html
import json
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
main = root / 'term-tests/term-test-1-k56-computer-based'
pattern = re.compile(r'''["'(]([^"'()\s<>]+\.(?:js|mjs|css|woff2|png|svg|html)(?:\?[^"'()\s<>]*)?)["')]''')


def graph(entry, figure):
    assets = {entry / 'index.html', entry / 'offline-worker.js'}
    if figure:
        assets.add(main / 'assets/figures' / figure)
    pending = list(assets)
    while pending:
        file = pending.pop()
        if file.suffix not in {'.js', '.mjs', '.css', '.html'}:
            continue
        for reference in pattern.findall(file.read_text(encoding='utf-8')):
            parsed = urlsplit(html.unescape(reference))
            if parsed.scheme or parsed.netloc:
                continue
            path = (file.parent / unquote(parsed.path)).resolve()
            if not path.is_relative_to(root) or not path.is_file() or path in assets:
                continue
            if path.name == 'offline-assets.mjs' or 'exam-journal' in path.parts:
                continue
            assets.add(path)
            pending.append(path)
    return assets


def digest(file):
    data = file.read_bytes()
    if file.suffix not in {'.png', '.woff2'}:
        data = data.replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()


def write_manifest(folder, names, header):
    hashes = {name: digest(folder / name) for name in names}
    build = hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    content = header + '\n'
    for key, value in [('ASSETS', names), ('ASSET_HASHES', hashes), ('ASSET_BUILD_ID', build)]:
        content += 'export const ' + key + '=' + json.dumps(value, ensure_ascii=False, indent=2) + ';\n'
    (folder / 'offline-assets.mjs').write_text(content, encoding='utf-8', newline='\n')


for skill, figure in [('reading', 'rovio.png'), ('listening', 'hinchingbrooke-park.png'), ('writing', None)]:
    entry = root / f'term-tests/term-test-1-k56-{skill}-fallback'
    assets = graph(entry, figure)
    assert not any(path.name == 'content.js' for path in assets), 'Exam content must come from the authenticated API'
    write_manifest(entry, sorted(os.path.relpath(path, entry).replace('\\', '/') for path in assets),
                   '// Tài nguyên vỏ offline, không chứa dữ liệu trả về từ API hoặc bí mật.')
existing = (main / 'offline-assets.mjs').read_text(encoding='utf-8')
main_names = json.loads(re.search(r'ASSETS=(\[.*?\]);', existing, re.S)[1])
write_manifest(main, main_names, '// Tạo từ byte public Git/Pages (text LF); không chứa đáp án hoặc quyền.')
