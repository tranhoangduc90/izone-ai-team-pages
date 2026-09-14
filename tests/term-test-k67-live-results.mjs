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

test('chỉ bốn trang Term Test K67 buộc tải bản giao diện mới', async () => {
  const revision = '20260914-live-results-v1';
  for (const entry of [
    'term-tests/term-test-1/index.html',
    'term-tests/term-test-2/index.html',
    'term-tests/term-test-1-computer-based/index.html',
    'term-tests/term-test-2-computer-based/index.html'
  ]) {
    assert.match(await read(entry), new RegExp(revision), entry);
  }
  assert.match(await read('term-tests/term-test-2-computer-based/bootstrap.js'), new RegExp(revision));
});

test('giao diện K56 không bị nối vào kênh mới', async () => {
  for (const entry of [
    'term-tests/k56-shared/app.js',
    'term-tests/term-test-1-k56-computer-based/bootstrap.js'
  ]) {
    assert.doesNotMatch(await read(entry), /\/api\/term-tests\/result\/stream/, entry);
  }
});
