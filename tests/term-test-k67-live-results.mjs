import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => readFile(path.join(repoRoot, relativePath), 'utf8');

test('K67 nhận tín hiệu chấm xong nhưng vẫn giữ polling dự phòng', async () => {
  const app = await read('term-tests/shared/app.js');
  assert.match(app, /\/api\/term-tests\/result\/stream/);
  assert.match(app, /method: 'POST'/);
  assert.match(app, /body: JSON\.stringify\(\{ attemptToken: state\.attemptToken \}\)/);
  assert.doesNotMatch(app, /result\/stream\?[^'"`]*attemptToken/);
  assert.match(app, /eventName === 'ready'/);
  assert.match(app, /await refreshWritingGrading\(\)/);
  assert.match(app, /Math\.min\(30_000, 8_000 \+ \(writingGradingPollCount \* 2_000\)\)/);
  assert.match(app, /writingGradingStreamController\?\.abort\(\)/);
});

// Phiên bản cache được kiểm tập trung tại term-mini-cache-graph.mjs.
// Ở đây giữ hợp đồng: cả bốn entry dùng đúng engine kết quả và phục hồi lượt.
test('bốn trang Term Test K67 dùng chung engine kết quả trực tiếp và phục hồi lượt', async () => {
  for (const entry of [
    'term-tests/term-test-1/index.html',
    'term-tests/term-test-2/index.html'
  ]) {
    const scripts = [...(await read(entry)).matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
      .map(match => new URL(match[1], `https://fixture.invalid/${entry}`).pathname);
    assert.equal(scripts.filter(src => src === '/term-tests/shared/app.js').length, 1, entry);
  }
  for (const entry of [
    'term-tests/term-test-1-computer-based/index.html',
    'term-tests/term-test-2-computer-based/index.html'
  ]) {
    const scripts = [...(await read(entry)).matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
      .map(match => new URL(match[1], `https://fixture.invalid/${entry}`).pathname);
    assert.equal(scripts.filter(src => src === '/term-tests/term-test-2-computer-based/bootstrap.js').length, 1, entry);
  }
  const bootstrap = await read('term-tests/term-test-2-computer-based/bootstrap.js');
  assert.match(bootstrap, /await loadScript\('\.\.\/shared\/app\.js\?[^']+'\)/);
  assert.match(bootstrap, /recoverFromServerReset/);
});
