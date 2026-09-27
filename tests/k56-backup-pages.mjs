import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

test('landing K56 không giới thiệu IC2264 như lớp duy nhất dùng dữ liệu thật', async () => {
  const html = await read('term-tests/k56-demo/index.html');
  assert.match(html, /Các lớp khóa 56 đã được mở bài dùng danh sách học viên thật/);
  assert.doesNotMatch(html, /IC2264 dùng danh sách lớp thật/);
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
  // Nhận vào: hash SHA-256 của ba MP3 production công khai, xác minh ngày 23/09/2026.
  // So file branch với mốc đã phát hành; khi khác, test báo lỗi trước khi phát hành lại.
  const pages = [
    ['term-test-1-k56-audio', 'term-test-1-k56.mp3', 'c7766f97758ec5ecdd3b69dfd3f762567a50bdbb0fd38930a2b609879e8439fc'],
    ['term-test-2-k56-audio', 'term-test-2-k56.mp3', '3600563c0af62fd5c9656be0d7b7f52a1bae281d6af1de80ba4fe0de523f92af'],
    ['mini-test-k56-audio', 'mini-test-k56.mp3', '93a3901c37fb37a8eb2ec989ef8d382810d4dc99e6b6506a8377fac68dc756ab']
  ];
  for (const [route, file, productionHash] of pages) {
    const configSource = await read(`term-tests/${route}/audio-config.js`);
    const sandbox = { window: {} };
    vm.runInNewContext(configSource, sandbox, { timeout: 5_000 });
    assert.equal(sandbox.window.K56_AUDIO_BACKUP_CONFIG.src, `../k56-audio-assets/${file}`);
    const published = await read(`term-tests/k56-audio-assets/${file}`, null);
    const digest = value => createHash('sha256').update(value).digest('hex');
    assert.equal(digest(published), productionHash);
  }
});

test('nút reset online chỉ áp dụng CODEXDEMO56 và gọi endpoint reset một lần', async () => {
  const source = await read('term-tests/k56-demo-reset/app.js');
  assert.match(source, /classCode !== 'CODEXDEMO56'/);
  assert.match(source, /\/api\/term-tests\/demo\/reset/);
  assert.match(source, /confirmation: 'RESET_DEMO_STUDENT'/);
  assert.match(source, /window\.setTimeout\(\(\) => controller\.abort\(\), 30000\)/);
  assert.equal(/retry|setInterval/.test(source), false);
  for (const route of [
    'term-test-1-k56-computer-based',
    'term-test-2-k56-computer-based',
    'mini-test-k56-computer-based'
  ]) {
    const html = await read(`term-tests/${route}/index.html`);
    assert.match(html, /\.\.\/k56-demo-reset\/styles\.css/);
    assert.match(html, /\.\.\/k56-demo-reset\/app\.js/);
  }
});
