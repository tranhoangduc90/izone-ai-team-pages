import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('dashboard chung hiển thị đủ hai bài K56 và không dùng ChatGPT Site', () => {
  const html = read('term-tests/substitute-test-1-k56-dashboard/index.html');
  assert.match(html, /Substitute Test 1/u);
  assert.match(html, /Substitute Test 2/u);
  assert.match(html, /substitute-test-1-k56-computer-based/u);
  assert.match(html, /substitute-test-2-k56-computer-based/u);
  assert.match(html, /substitute-test-1-k56-results/u);
  assert.match(html, /substitute-test-2-k56-results/u);
  assert.doesNotMatch(html, /chatgpt\.site/u);
});

test('dashboard chọn được K56 hoặc K67 và dashboard Test 2 cũ vẫn dùng link GitHub Pages', () => {
  const app = read('term-tests/substitute-test-1-k56-dashboard/app.js');
  assert.match(app, /course-filter/u);
  assert.match(app, /requested === 'k67'/u);
  const dashboardHtml = read('term-tests/substitute-test-1-k56-dashboard/index.html');
  assert.match(dashboardHtml, /option value="k56"/u);
  assert.match(dashboardHtml, /option value="k67"/u);
  assert.match(dashboardHtml, /substitute-test-1-k67-computer-based/u);
  assert.match(dashboardHtml, /substitute-test-2-k67-computer-based/u);
  const oldDashboardHtml = read('term-tests/substitute-test-2-k56-dashboard/index.html');
  assert.match(oldDashboardHtml, /substitute-test-2-k56-computer-based/u);
  assert.match(oldDashboardHtml, /substitute-test-2-k56-results/u);
  assert.doesNotMatch(oldDashboardHtml, /chatgpt\.site/u);
  assert.match(read('term-tests/substitute-test-2-k56-results/index.html'), /substitute-test-2-k56-dashboard/u);
});
