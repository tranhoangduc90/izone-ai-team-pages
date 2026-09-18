import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('dashboard thử nghiệm chỉ chứa cấu hình trình duyệt công khai', async () => {
  const raw = await readFile(new URL('writing-flow-config.json', root), 'utf8');
  const config = JSON.parse(raw);
  assert.deepEqual(Object.keys(config).sort(), ['apiBase', 'googleClientId']);
  assert.equal(config.apiBase, 'https://ducizone.ddns.net/writing-api-stage/');
  assert.match(config.googleClientId, /^[0-9a-z-]+\.apps\.googleusercontent\.com$/u);
  assert.doesNotMatch(raw, /token|secret|password|credential/iu);
});

test('dashboard tải đúng mã giao diện và cấu hình staging riêng', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('writing-flow.html', root), 'utf8'),
    readFile(new URL('js/writing-flow.js', root), 'utf8'),
  ]);
  assert.match(html, /Bản thử nghiệm/u);
  assert.match(html, /\.\/js\/writing-flow\.js/u);
  assert.match(script, /\.\/writing-flow-config\.json/u);
  assert.match(script, /Chạy lại từ bước này/u);
});
