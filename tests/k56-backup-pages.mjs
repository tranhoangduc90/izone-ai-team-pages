import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.resolve(root, '../..');

async function read(relative, encoding = 'utf8') {
  return fs.readFile(path.join(root, relative), encoding);
}

test('landing K56 chỉ hiện tên bài thi và đủ sáu link dự phòng', async () => {
  const html = await read('term-tests/k56-demo/index.html');
  assert.equal(/Listening:\s*\d+\s*câu|Reading:\s*\d+\s*câu/.test(html), false);
  for (const label of [
    'Term Test 1', 'Term Test 2', 'Mini Test',
    'Audio Term Test 1', 'Audio Term Test 2', 'Audio Mini Test',
    'Answer Sheet Term Test 1', 'Answer Sheet Term Test 2', 'Answer Sheet Mini Test'
  ]) assert.match(html, new RegExp(`>${label}<`));
});

test('ba Answer Sheet K56 dùng đúng config, app và backend K56', async () => {
  const pages = [
    ['term-test-1-k56', 'k56-shared'],
    ['term-test-2-k56', 'k56-test2-shared'],
    ['mini-test-k56', 'k56-mini-shared']
  ];
  for (const [route, appDir] of pages) {
    const [html, config] = await Promise.all([
      read(`term-tests/${route}/index.html`),
      read(`term-tests/${route}/test-config.js`)
    ]);
    assert.match(html, /\.\.\/k56-shared\/config\.js/);
    assert.match(html, new RegExp(`\\.\\.\\/${appDir}\\/app\\.js`));
    assert.equal(/answerKey|correctAnswer|acceptedAnswers/.test(config), false);
  }
});

test('ba trang Audio Backup trỏ tới bản audio K56 đúng nguồn', async () => {
  const pages = [
    ['term-test-1-k56-audio', 'term-test-1-k56.mp3', 'term-tests/izone-term-tests-k56/term-test-1-k56-computer-based/assets/private/listening-k56.mp3'],
    ['term-test-2-k56-audio', 'term-test-2-k56.mp3', 'term-tests/izone-term-test-2-k56/term-test-2-k56-computer-based/assets/private/listening-k56.mp3'],
    ['mini-test-k56-audio', 'mini-test-k56.mp3', 'term-tests/izone-mini-test-k56/mini-test-k56-computer-based/assets/private/preston-park-run.mp3']
  ];
  for (const [route, file, sourceRelative] of pages) {
    const configSource = await read(`term-tests/${route}/audio-config.js`);
    const sandbox = { window: {} };
    vm.runInNewContext(configSource, sandbox, { timeout: 5_000 });
    assert.equal(sandbox.window.K56_AUDIO_BACKUP_CONFIG.src, `../k56-audio-assets/${file}`);
    const [published, source] = await Promise.all([
      read(`term-tests/k56-audio-assets/${file}`, null),
      fs.readFile(path.join(workspace, sourceRelative))
    ]);
    const digest = value => createHash('sha256').update(value).digest('hex');
    assert.equal(digest(published), digest(source));
  }
});
