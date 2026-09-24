import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ba trang demo dùng cùng giao diện và chỉ được nối đến API demo', () => {
  const check = spawnSync(process.execPath,
    [fileURLToPath(new URL('../progress-log/demo/build-pages.mjs', import.meta.url)), '--check'],
    { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  for (const page of ['index', 'teacher', 'journey']) {
    const html = read(`progress-log/demo/${page}.html`);
    assert.match(html, /BẢN THỬ · CHỈ DỮ LIỆU MẪU/);
    assert.match(html, /connect-src[^"\n]*https:\/\/ducizone\.ddns\.net\/mapping-api-progress-log-demo\//);
    assert.doesNotMatch(html, /https:\/\/ducizone\.ddns\.net\/mapping-api(?:\s|;|"|\/)/);
    assert.match(html, /src="config\.js\?/);
  }
  const config = read('progress-log/demo/config.js');
  assert.match(config, /mapping-api-progress-log-demo/);
  assert.match(config, /enabled: false/);
  assert.match(read('progress-log/config.js'), /mapping-api-progress-log-demo/);
});

test('URL nguồn nằm trong fragment và bài thử cấp mã lượt mới trước khi tải phiếu', () => {
  const boot = read('progress-log/demo/boot.js');
  assert.match(boot, /location\.hash/);
  assert.match(boot, /\/api\/demo\/runs/);
  assert.match(boot, /history\.replaceState/);
  assert.match(boot, /import\('\.\.\/app\.js/);
  assert.match(read('progress-log/teacher.html'), /Thử trong demo/);
  assert.match(read('progress-log/demo/teacher.html'), /Đặt lại lượt thử/);
  assert.match(read('progress-log/teacher.js'), /history\.replaceState\(null, '', teacherUrl\.toString\(\)\);\s*window\.location\.reload\(\)/);
  for (const page of ['app.js', 'teacher.js', 'journey.js']) {
    assert.match(read(`progress-log/${page}`), /x-progress-log-demo/);
  }
});
