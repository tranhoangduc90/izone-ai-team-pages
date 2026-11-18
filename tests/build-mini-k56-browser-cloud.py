"""Build an isolated Mini CBT asset closure while retaining the deployed entry."""
import hashlib
import json
import re
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
exam = repo/'term-tests/mini-test-k56-computer-based'
journal = repo/'term-tests/shared/exam-journal'
shared = repo/'term-tests/k56-mini-shared'
offline = repo/'term-tests/k56-offline-shared'
before = 'mini-parallel-entry-v1'
after = 'mini-browser-cloud-v1'
worker_origin = 'https://izone-journal-prod-261116-k56-mini-ingress.tranhoangduc90.workers.dev'
manifest = (exam/f'offline-assets-{before}.mjs').read_text(encoding='utf-8')
assets = json.loads(re.search(r'export const ASSETS=(\[.*?\]);', manifest, re.S)[1])
hashes = json.loads(re.search(r'export const ASSET_HASHES=(\{.*?\});', manifest, re.S)[1])
assert set(assets) == set(hashes)
assert 'f35200490f7a37af36594791ef70229f16693bc50a697a074b6571175765224a' in manifest
def digest(data):
    return hashlib.sha256(data).hexdigest()

def asset_path(name):
    path = (exam/name).resolve()
    assert path.is_relative_to(repo.resolve())
    return path

def read_asset(name):
    return asset_path(name).read_bytes()

for name, expected in hashes.items():
    data = read_asset(name)
    assert digest(data) == expected or digest(data.replace(b'\r\n', b'\n')) == expected, name

pending = {}
def generate(source, destination, pairs):
    text = source.read_text(encoding='utf-8')
    for old, new in pairs:
        assert old in text, (source.name, old)
        text = text.replace(old, new)
    pending[destination.resolve()] = text.encode()

generate(journal/'k67-pilot-browser-transport.mjs', journal/f'transport-{after}.mjs', [
    ('selectK67BrowserBatch', 'selectMiniK56BrowserBatch'),
    ('./k67-pilot-browser-policy.mjs', './mini-k56-browser-batch-v1.mjs'),
])
generate(journal/'k67-pilot-legacy-drain.mjs', journal/f'legacy-drain-{after}.mjs', [
    ('./k67-pilot-browser-transport.mjs', f'./transport-{after}.mjs'),
])
generate(journal/'bridge-recovery-v1.mjs', journal/f'bridge-{after}.mjs', [
    ("testSlug==='term-test-1' && path.includes('term-test-1-computer-based')", "testSlug==='mini-test-k56' && path.includes('mini-test-k56-computer-based')"),
    ('izone-term1-journal-ingress', 'izone-mini-k56-journal-ingress'),
    ('if (metadataOnly && configuredIngress)', 'if (configuredIngress)'),
    ('./k67-pilot-browser-transport.mjs', f'./transport-{after}.mjs'),
    ('./k67-pilot-legacy-drain.mjs', f'./legacy-drain-{after}.mjs'),
    ('cloudLegacy = createK67LegacyDrain(options);', 'if (metadataOnly) cloudLegacy = createK67LegacyDrain(options);'),
    ('const legacy = await cloudLegacy.flush(settings);', 'const legacy = await cloudLegacy?.flush(settings);'),
    ('active.acknowledgedCount+legacy.acknowledgedCount', 'active.acknowledgedCount+(legacy?.acknowledgedCount ?? 0)'),
    ('K67_CLOUD_TRANSPORT_UNAVAILABLE', 'MINI_CLOUD_TRANSPORT_UNAVAILABLE'),
])
for old, new in [('app.js', f'app-{after}.js'), ('app-listening-view-v1.js', f'app-listening-{after}.js')]:
    generate(shared/old, shared/new, [('bridge-recovery-v1.mjs', f'bridge-{after}.mjs')])
generate(offline/f'runtime-{before}.mjs', offline/f'runtime-{after}.mjs', [('bridge-recovery-v1.mjs', f'bridge-{after}.mjs')])
generate(exam/f'offline-{before}.mjs', exam/f'offline-{after}.mjs', [(f'runtime-{before}.mjs', f'runtime-{after}.mjs')])
generate(exam/f'bootstrap-{before}.js', exam/f'bootstrap-{after}.js', [
    (before, after),
    ('../k56-mini-shared/app.js?', f'../k56-mini-shared/app-{after}.js?'),
    ('../k56-mini-shared/app-listening-view-v1.js?', f'../k56-mini-shared/app-listening-{after}.js?'),
])
generate(exam/f'index-{before}.html', exam/f'index-{after}.html', [
    (f'bootstrap-{before}.js', f'bootstrap-{after}.js'),
    ("connect-src 'self'", f"connect-src 'self' {worker_origin}"),
    ('    <title>', f'    <meta name="izone-mini-k56-journal-ingress" content="{worker_origin}/k67/pilot/journal-events">\n    <title>'),
])
generate(exam/f'worker-{before}.mjs', exam/f'worker-{after}.mjs', [(f'index-{before}.html', f'index-{after}.html')])
generate(exam/f'offline-worker-{before}.js', exam/f'offline-worker-{after}.js', [(before, after)])

def relative(path):
    import os
    return Path(os.path.relpath(path, exam)).as_posix()

# Keep the original shell's assets and append versioned changes plus the new
# journal module closure. The stable root entry is deliberately untouched.
closure = {relative(path) for path in pending}
module_paths = {path for path in pending if path.parent == journal.resolve()}
for name in ('bridge.mjs', 'bootstrap-capture.mjs'):
    path = (journal/name).resolve()
    closure.add(relative(path))
    module_paths.add(path)
while module_paths:
    path = module_paths.pop()
    text = (pending[path] if path in pending else path.read_bytes()).decode()
    local_modules = re.findall(r"(?:from\s*|import\(\s*)['\"](\./[^'\"?]+\.mjs)(?:\?[^'\"]*)?['\"]", text)
    for name in local_modules:
        dep = (path.parent/name).resolve()
        assert dep.is_relative_to(journal.resolve()) and (dep in pending or dep.is_file()), name
        leaf = relative(dep)
        if leaf not in closure:
            closure.add(leaf)
            module_paths.add(dep)

for name in sorted(closure):
    path = asset_path(name)
    data = pending[path] if path in pending else path.read_bytes()
    if name not in hashes:
        assets.append(name)
        hashes[name] = digest(data.replace(b'\r\n', b'\n'))
build = digest(json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode())
new_manifest = exam/f'offline-assets-{after}.mjs'
pending[new_manifest.resolve()] = ('// Mini CBT browser cloud candidate.\nexport const ASSETS='
    + json.dumps(assets, indent=2) + ';\nexport const ASSET_HASHES='
    + json.dumps(hashes, indent=2) + ';\nexport const ASSET_BUILD_ID=' + json.dumps(build) + ';\n').encode()
assert all(not path.exists() or path.read_bytes() == data for path, data in pending.items())
for path, data in pending.items():
    if not path.exists():
        with path.open('xb') as output:
            output.write(data)
print(json.dumps({'build': build, 'assets': len(assets), 'newFiles': len(pending),
    'oldAssetsVerified': len(assets)-len(set(closure)-set(json.loads(re.search(r'export const ASSETS=(\[.*?\]);', manifest, re.S)[1]))),
    'rootEntryChanged': False, 'journalClosure': sorted(name for name in closure if 'exam-journal' in name)}))
