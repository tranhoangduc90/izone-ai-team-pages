import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testPages = [
  'term-tests/term-test-1-k56-computer-based/index.html',
  'term-tests/term-test-2-k56-computer-based/index.html',
  'term-tests/mini-test-k56-computer-based/index.html'
];

test('cả ba bài K56 đều nạp lớp chặn tìm kiếm dùng chung', async () => {
  for (const relative of testPages) {
    const html = await readFile(path.join(root, relative), 'utf8');
    assert.match(html, /k56-exam-integrity\/styles\.css\?rev=20260911-find-lock-v1/);
    assert.match(html, /k56-exam-integrity\/app\.js\?rev=20260911-find-lock-v1/);
  }
});

test('chặn đúng Ctrl hoặc Command + F/G và F3', async () => {
  const source = await readFile(path.join(root, 'term-tests/k56-exam-integrity/app.js'), 'utf8');
  assert.match(source, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(source, /key === 'f3'/);
  assert.match(source, /key === 'f' \|\| key === 'g'/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
});

test('nút reset demo không thay đổi grid/flex của header bài thi', async () => {
  const css = await readFile(path.join(root, 'term-tests/k56-demo-reset/styles.css'), 'utf8');
  assert.match(css, /\.topbar > \.k56-reset-button \{[\s\S]*position: fixed;/);
  assert.doesNotMatch(css, /\.topbar\.k56-reset-header[\s\S]*display:\s*flex/);
  assert.doesNotMatch(css, /\.k56-reset-header \.cbt-identity-panel/);
});
