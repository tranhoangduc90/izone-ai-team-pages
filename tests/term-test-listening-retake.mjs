import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('trang thi bù chỉ bật chế độ Listening và không nhúng danh tính học viên', async () => {
  const entryPath = path.join(repoRoot, 'term-tests/term-test-1-listening-retake/index.html');
  const configPath = path.join(repoRoot, 'term-tests/term-test-1-listening-retake/retake-config.js');
  const entry = await readFile(entryPath, 'utf8');
  const config = await readFile(configPath, 'utf8');

  assert.match(config, /mode:\s*'listening-only'/);
  assert.doesNotMatch(entry + config, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  assert.doesNotMatch(config, /student(?:Name|Ref)\s*:/i);
  assert.ok(entry.indexOf('term-test-1/test-config.js') < entry.indexOf('retake-config.js'));
  assert.ok(entry.indexOf('retake-config.js') < entry.indexOf('bootstrap.js'));

  for (const asset of [...entry.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)].map(match => match[1])) {
    if (asset.startsWith('data:') || /^https?:/i.test(asset)) continue;
    await access(path.resolve(path.dirname(entryPath), asset));
  }
});

test('thi bù điền sẵn bằng UUID chính thức, giữ cổng xác nhận và tách bộ nhớ', async () => {
  const bootstrap = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/bootstrap.js'), 'utf8');
  const sharedApp = await readFile(path.join(repoRoot, 'term-tests/shared/app.js'), 'utf8');
  const enhance = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/enhance.js'), 'utf8');
  const interactions = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/interaction-tools.js'), 'utf8');

  assert.match(bootstrap, /query\.get\('student'\)/);
  assert.match(bootstrap, /launchMatches\.length !== 1/);
  assert.match(bootstrap, /bootstrapStudent\.dispatchEvent\(new Event\('change'\)\)/);
  assert.match(bootstrap, /await confirmStudentIdentity\(selectedStudent\)/);
  for (const source of [bootstrap, sharedApp, enhance, interactions]) {
    assert.match(source, /:listening-retake/);
  }
});

test('kết quả thi bù chỉ hiện Listening và chờ Portal xác nhận đồng bộ', async () => {
  const sharedApp = await readFile(path.join(repoRoot, 'term-tests/shared/app.js'), 'utf8');

  assert.match(sharedApp, /const hasReading = !listeningOnly/);
  assert.match(sharedApp, /if \(!listeningOnly\) summaryCards\.push/);
  assert.match(sharedApp, /waitForListeningPortalSync/);
  assert.match(sharedApp, /payload\.portalSyncStatus === 'synced'/);
  assert.match(sharedApp, /Điểm Reading và Writing được giữ nguyên/);
});
