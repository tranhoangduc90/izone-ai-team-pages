import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('trang học viên mẫu dùng cùng giao diện và chỉ được nối đến API demo', () => {
  const check = spawnSync(process.execPath,
    [fileURLToPath(new URL('../progress-log/demo/build-pages.mjs', import.meta.url)), '--check'],
    { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const html = read('progress-log/demo/index.html');
  assert.match(html, /BẢN THỬ · KHÔNG GHI BÀI THẬT/);
  assert.match(html, /connect-src[^"\n]*https:\/\/ducizone\.ddns\.net\/mapping-api-progress-log-demo\//);
  assert.doesNotMatch(html, /https:\/\/ducizone\.ddns\.net\/mapping-api(?:\s|;|"|\/)/);
  assert.match(html, /src="config\.js\?/);
  assert.match(html, /id="resetDemoButton"/);
  assert.match(html, /id="journeyButton" type="button"/);
  assert.match(html, /id="journeyResultButton" type="button"/);
  assert.doesNotMatch(html, /id="journey(?:Result)?Button" type="button" hidden/);
  assert.doesNotMatch(html, /id="openDemoBlocksButton"/);
  const config = read('progress-log/demo/config.js');
  assert.match(config, /mapping-api-progress-log-demo/);
  assert.match(config, /enabled: false/);
  assert.match(read('progress-log/config.js'), /mapping-api-progress-log-demo/);
});

test('dashboard có nút xem thử; trang thử nhận grant rồi cấp mã lượt riêng', () => {
  const boot = read('progress-log/demo/boot.js');
  assert.match(boot, /location\.hash/);
  assert.match(boot, /grant \? \{ grant \} : \{ runToken \}/);
  assert.match(boot, /history\.replaceState/);
  assert.match(boot, /import\('\.\.\/app\.js/);
  assert.match(read('progress-log/teacher.html'), /Xem thử như học viên/);
  assert.match(read('progress-log/teacher.js'), /\/teacher\/demo-grants/);
  assert.match(read('progress-log/app.js'), /config\.DEMO_MODE/);
});
