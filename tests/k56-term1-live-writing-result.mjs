import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => readFile(path.join(repoRoot, relativePath), 'utf8');

test('K56 nhận tín hiệu ready an toàn và vẫn giữ polling dự phòng', async () => {
  const app = await read('term-tests/k56-shared/app.js');
  assert.match(app, /\/api\/term-tests\/result\/stream/);
  assert.match(app, /method: 'POST'/);
  assert.match(app, /body: JSON\.stringify\(\{ attemptToken: state\.attemptToken \}\)/);
  assert.doesNotMatch(app, /result\/stream\?[^'"`]*attemptToken/);
  assert.match(app, /eventName === 'ready'/);
  assert.match(app, /await refreshWritingGrading\(\)/);
  assert.match(app, /replace\(\/\\r\\n\/g, '\\n'\)/);
  assert.match(app, /buffer\.length > 64 \* 1024/);
  assert.match(app, /\[1_000, 2_000, 5_000, 10_000, 30_000\]/);
  assert.match(app, /\[404, 405\]\.includes\(response\.status\)/);
  assert.match(app, /Math\.min\(30_000, 8_000 \+ \(writingGradingPollCount \* 2_000\)\)/);
  assert.match(app, /writingGradingStreamController\?\.abort\(\)/);
  assert.match(app, /window\.addEventListener\('pagehide',[\s\S]*stopWritingGradingPolling\(\)/);
});

test('mọi nhánh Term Test 1 K56 tải cùng revision mới', async () => {
  const revision = 'live-writing-result-v1';
  const bootstrap = await read('term-tests/term-test-1-k56-computer-based/bootstrap.js');
  assert.equal((bootstrap.match(new RegExp(revision, 'g')) || []).length, 2);
  assert.match(await read('term-tests/term-test-1-k56-computer-based/index.html'), new RegExp(revision));
  assert.match(await read('term-tests/term-test-1-k56/index.html'), new RegExp(revision));
});

test('cấu hình Term Test 1 K56 vẫn là một bài Writing và không chứa answer key', async () => {
  const config = await read('term-tests/term-test-1-k56/test-config.js');
  assert.match(config, /writing:\s*\{[\s\S]*totalQuestions:\s*1/);
  assert.doesNotMatch(config, /answerKey|correctAnswers/i);
});
