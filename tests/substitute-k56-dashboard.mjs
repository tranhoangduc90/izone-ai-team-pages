import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('dashboard chung hiển thị đủ Substitute Test 1 và 2', () => {
  const html = read('term-tests/substitute-test-1-k56-dashboard/index.html');
  assert.match(html, /Substitute Test 1/u);
  assert.match(html, /Substitute Test 2/u);
  assert.match(html, /substitute-test-1-k56-computer-based/u);
  assert.match(html, /substitute-test-2-k56-computer-based/u);
  assert.match(html, /substitute-test-1-k56-results/u);
  assert.match(html, /substitute-test-2-k56-results/u);
  assert.match(html, /izone-substitute-test-1-k56\.wingsenglish90\.chatgpt\.site/u);
  assert.match(html, /izone-substitute-test-2-k56\.wingsenglish90\.chatgpt\.site/u);
});

test('dashboard tổng hợp hai catalog và đường cũ Test 2 quay về dashboard chung', () => {
  const app = read('term-tests/substitute-test-1-k56-dashboard/app.js');
  assert.match(app, /substitute-test-1-k56[^']*\/api\/test\/catalog/u);
  assert.match(app, /substitute-test-2-k56[^']*\/api\/test\/catalog/u);
  assert.match(read('term-tests/substitute-test-2-k56-dashboard/app.js'), /substitute-test-1-k56-dashboard/u);
  assert.match(read('term-tests/substitute-test-2-k56-results/index.html'), /substitute-test-1-k56-dashboard/u);
});
