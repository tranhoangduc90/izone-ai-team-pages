import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mọi ô mã 4 số đều che nội dung trên màn hình', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['access-code', 'provisional-pin', 'provisional-pin-confirm']) {
    assert.match(html, new RegExp(`<input[^>]*id="${id}"[^>]*type="password"`));
  }
});

test('dashboard cho phép style Google Sign-In hiện hành mà không mở unsafe-inline', async () => {
  const html = await readFile(new URL('../teacher.html', import.meta.url), 'utf8');
  assert.match(html, /sha256-CJ02OVqT7p9v9HDCMKiouj0TJ0ooW7ybXUHymIEqyeE=/u);
  assert.match(html, /sha256-RU4sU0AaS8IBGZx8XrGt\/pa9A5SLA3dQszGeqT5L3Kw=/u);
  assert.doesNotMatch(html, /style-src[^;]*'unsafe-inline'/u);
});
