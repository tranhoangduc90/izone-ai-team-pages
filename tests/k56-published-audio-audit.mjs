import assert from 'node:assert/strict';
import { openSync, readSync, statSync, closeSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Nhận các file audio đã phát hành trong Git, không truy cập MP3 nguồn riêng tư.
// Xác nhận ba link dự phòng có file nghe được và hai bài Substitute có audio riêng.
function publishedMp3(relative) {
  const url = new URL(`../term-tests/${relative}`, import.meta.url);
  const size = statSync(url).size;
  assert.ok(size > 100_000, `${relative}: audio quá nhỏ hoặc rỗng`);
  const fd = openSync(url, 'r');
  try {
    const header = Buffer.alloc(3);
    readSync(fd, header, 0, 3, 0);
    assert.ok(header.toString() === 'ID3' || header[0] === 0xff && (header[1] & 0xe0) === 0xe0, `${relative}: không giống MP3`);
  } finally { closeSync(fd); }
}

for (const [route, file] of [
  ['term-test-1-k56-audio', 'term-test-1-k56.mp3'],
  ['term-test-2-k56-audio', 'term-test-2-k56.mp3'],
  ['mini-test-k56-audio', 'mini-test-k56.mp3']
]) {
  test(`${route}: trang dự phòng trỏ đúng MP3 đã phát hành`, () => {
    const source = readFileSync(new URL(`../term-tests/${route}/audio-config.js`, import.meta.url), 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context);
    assert.equal(context.window.K56_AUDIO_BACKUP_CONFIG.src, `../k56-audio-assets/${file}`);
    publishedMp3(`k56-audio-assets/${file}`);
  });
}

for (const number of [1, 2]) {
  test(`Substitute K56 ${number}: audio riêng tồn tại và không trỏ bài khác`, () => {
    publishedMp3(`substitute-test-${number}-k56-computer-based/assets/private/listening-substitute-test-${number}-k56.mp3`);
    const content = readFileSync(new URL(`../term-tests/substitute-test-${number}-k56-computer-based/content.js`, import.meta.url), 'utf8');
    assert.match(content, new RegExp(`listening-substitute-test-${number}-k56\\.mp3`, 'u'));
  });
}
