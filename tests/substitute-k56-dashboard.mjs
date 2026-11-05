import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('trang chủ có đủ hai kì và giữ các đường dẫn bài thi cùng kết quả K56', () => {
  const html = read('term-tests/substitute-test-1-k56-dashboard/index.html');
  assert.match(html, /Bạn đang thi cho bài thi kỳ nào\?/u);
  assert.match(html, />Kì 1</u);
  assert.match(html, />Kì 2</u);
  assert.match(html, /substitute-test-1-k56-computer-based/u);
  assert.match(html, /substitute-test-2-k56-computer-based/u);
  assert.match(html, /substitute-test-1-k56-results/u);
  assert.match(html, /substitute-test-2-k56-results/u);
  assert.doesNotMatch(html, /chatgpt\.site/u);
});

test('dashboard chọn được K56 hoặc K67 và dashboard Test 2 cũ vẫn dùng link GitHub Pages', () => {
  const app = read('term-tests/substitute-test-1-k56-dashboard/app.js');
  assert.match(app, /allowedCourses\.has\(requested\)/u);
  const dashboardHtml = read('term-tests/substitute-test-1-k56-dashboard/index.html');
  assert.match(dashboardHtml, /aria-label="Chọn Khóa 56"/u);
  assert.match(dashboardHtml, /aria-label="Chọn Khóa 67"/u);
  assert.match(dashboardHtml, /substitute-test-1-k67-computer-based/u);
  assert.match(dashboardHtml, /substitute-test-2-k67-computer-based/u);
  const oldDashboardHtml = read('term-tests/substitute-test-2-k56-dashboard/index.html');
  assert.match(oldDashboardHtml, /substitute-test-2-k56-computer-based/u);
  assert.match(oldDashboardHtml, /substitute-test-2-k56-results/u);
  assert.doesNotMatch(oldDashboardHtml, /chatgpt\.site/u);
  assert.match(read('term-tests/substitute-test-2-k56-results/index.html'), /substitute-test-1-k56-dashboard/u);
});

test('mỗi nhóm có hai kì dẫn tới đúng khóa đã chọn', () => {
  const html = read('term-tests/substitute-test-1-k56-dashboard/index.html');
  const groups = [...html.matchAll(/class="courses test-group" data-course="(k56|k67)" hidden>([\s\S]*?)<\/div>/gu)];
  assert.deepEqual(groups.map(([,course]) => course), ['k56','k67']);
  for (const [,course,body] of groups) {
    const links = [...body.matchAll(/href="([^"]+)"[^>]*><strong>Kì ([12])</gu)];
    assert.deepEqual(links.map(([,href,test]) => [test,href]), ['1','2'].map(test =>
      [test,'../substitute-test-'+test+'-'+course+'-computer-based/?demo=exam&amp;grading=server']));
    assert.doesNotMatch(body, /Reading|Writing|\d+ câu/u);
  }
});
