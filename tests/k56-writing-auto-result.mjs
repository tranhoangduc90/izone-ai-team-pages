import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const apps = [
  'term-tests/k56-shared/app.js',
  'term-tests/k56-test2-shared/app.js',
  'term-tests/k56-mini-shared/app.js'
];

test('cả ba bài K56 tự cập nhật điểm Writing sau khi nộp', async () => {
  for (const path of apps) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /await loadResult\(elements\.viewResult\)/);
    assert.match(source, /if \(payload\.writing\?\.grading\?\.ready\)/);
    assert.match(source, /scheduleWritingGradingRefresh\(\)/);
    assert.match(source, /Math\.min\(30_000, 8_000/);
  }
});

test('không cho bấm nộp một bài Writing hoàn toàn trống', async () => {
  for (const path of apps) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /const emptyTasks = belowMinimum\.filter\(task => task\.words === 0\)/);
    assert.match(source, /Hãy viết bài trước khi nộp để hệ thống có thể chấm điểm/);
  }
});

test('giao diện K56 không còn thông báo nhầm sang workflow K67', async () => {
  for (const path of apps) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /workflow chấm K67/);
  }
});
