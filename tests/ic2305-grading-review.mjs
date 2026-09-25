// Dữ liệu nhận vào: bốn file tĩnh của trang rà chấm thử.
// Việc chính: giữ riêng bài làm, kiểm hai route và đường gửi phản hồi.
// Kết quả: test thất bại nếu có dữ liệu chấm trong Git hoặc trang không còn guard.
// Khi lỗi: Node in tên invariant hỏng; không chạm vào dữ liệu thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'progress-log-ic2305-grading-review');
const read = (name) => readFileSync(resolve(root, name), 'utf8');

test('một trang có bộ lọc, CSP và chỉ nạp mã tĩnh cùng thư mục', () => {
  const html = read('index.html');
  assert.match(html, /data-view="all"/);
  for (const view of ['all', 'same', 'different']) assert.match(html, new RegExp(`data-tab="${view}"`));
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /src="review\.js"/);
  assert.match(html, /href="styles\.css"/);
});

test('repository không mang tệp bài làm hoặc kết quả chấm từng ca', () => {
  const names = readdirSync(root);
  assert.deepEqual(names.sort(), ['README.md', 'favicon.svg', 'index.html', 'review.js', 'styles.css'].sort());
  const js = read('review.js');
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.match(js, /file\.text\(\)/);
  assert.match(js, /item\.answer/);
  assert.match(js, /textContent/);
});

test('gửi phản hồi qua Google Form chỉ có mã ca và ý kiến người rà', () => {
  const js = read('review.js');
  assert.match(js, /docs\.google\.com\/forms/);
  for (const field of ['caseKey', 'gemini', 'luna', 'human', 'reason']) assert.match(js, new RegExp(`FORM_FIELDS\\.${field}`));
  assert.doesNotMatch(js.slice(js.indexOf('function formLink'), js.indexOf('function card')), /item\.answer|question\.criteria/);
  assert.match(js, /reason\.focus\(\)/);
});
