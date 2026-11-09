import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('link thi bù cũ hiển thị thông báo ngừng và không nạp luồng thi', async () => {
  const base = path.join(repoRoot, 'term-tests/term-test-1-listening-retake');
  const entry = await readFile(path.join(base, 'index.html'), 'utf8');
  assert.match(entry, /Đã ngừng đường thi bù Listening/);
  assert.match(entry, /liên hệ giảng viên/);
  assert.match(entry, /name="referrer" content="no-referrer"/);
  assert.doesNotMatch(entry, /<script|<form|bootstrap-retake|<audio/);
  for (const name of ['retake-config.js', 'offline-assets.mjs', 'retake-ui.css']) {
    await assert.rejects(access(path.join(base, name)), { code: 'ENOENT' });
  }
  const worker = await readFile(path.join(base, 'offline-worker.js'), 'utf8');
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.doesNotMatch(worker, /registerExamShell|respondWith|caches\.delete/);
});

test('thi bù điền sẵn bằng UUID chính thức, giữ cổng xác nhận và tách bộ nhớ', async () => {
  const bootstrap = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/bootstrap-retake.js'), 'utf8');
  const sharedApp = await readFile(path.join(repoRoot, 'term-tests/shared/app-retake.js'), 'utf8');
  const enhance = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/enhance.js'), 'utf8');
  const interactions = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/interaction-tools.js'), 'utf8');

  assert.match(bootstrap, /query\.get\('student'\)/);
  assert.match(bootstrap, /openRetakeLobby/);
  assert.doesNotMatch(bootstrap, /retakeGrant:\s*retakeGrant \|\| undefined/);
  assert.match(bootstrap, /Liên kết thi bù chưa có vé hợp lệ/);
  assert.match(bootstrap, /launchMatches\.length !== 1/);
  assert.match(bootstrap, /bootstrapStudent\.dispatchEvent\(new Event\('change'\)\)/);
  assert.match(bootstrap, /await confirmStudentIdentity\(selectedStudent\)/);
  for (const source of [bootstrap, sharedApp, enhance, interactions]) {
    assert.match(source, /storageScope/);
  }
});

test('kết quả thi bù chỉ hiện Listening và chờ Portal xác nhận đồng bộ', async () => {
  const sharedApp = await readFile(path.join(repoRoot, 'term-tests/shared/app-retake.js'), 'utf8');

  assert.match(sharedApp, /const hasReading = !listeningOnly/);
  assert.match(sharedApp, /if \(!listeningOnly\) summaryCards\.push/);
  assert.match(sharedApp, /waitForListeningPortalSync/);
  assert.match(sharedApp, /payload\.portalSyncStatus === 'synced'/);
  assert.match(sharedApp, /Điểm Reading và Writing được giữ nguyên/);
  assert.match(sharedApp, /Lượt làm đang gắn với tên đã xác nhận/);
  assert.match(sharedApp, /if\(miniJourney\.retake\)return miniJourney\.loadResult\(\)/);
  assert.match(sharedApp, /Điểm Portal đang chờ đối soát/);
});
