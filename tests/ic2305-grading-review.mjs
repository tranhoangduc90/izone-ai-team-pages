// Dữ liệu nhận vào: trang rà chấm thử và dữ liệu công khai đã ẩn mã bài.
// Việc chính: kiểm việc tải tự động, cấu trúc 98 ca và đường gửi phản hồi.
// Kết quả: test thất bại nếu lộ mã bài, prompt riêng hoặc trang mất dữ liệu.
// Khi lỗi: Node in tên invariant hỏng; không chạm vào dữ liệu thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'progress-log-ic2305-grading-review');
const read = (name) => readFileSync(resolve(root, name), 'utf8');

test('một trang tự tải dữ liệu cùng nguồn và vẫn có bộ lọc', () => {
  const html = read('index.html');
  assert.match(html, /data-view="all"/);
  for (const view of ['all', 'same', 'different']) assert.match(html, new RegExp(`data-tab="${view}"`));
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /src="review\.js"/);
  assert.match(html, /href="styles\.css"/);
  assert.doesNotMatch(html, /type="file"|Chọn tệp JSON/);
  assert.match(html, /id="retry-load"/);
});

test('dữ liệu công khai đúng 98 ca, không mang định danh và prompt riêng', () => {
  const names = readdirSync(root);
  assert.deepEqual(names.sort(), ['README.md', 'data.json', 'favicon.svg', 'index.html', 'review.js', 'styles.css'].sort());
  const data = JSON.parse(read('data.json'));
  assert.equal(data.public_data, true);
  assert.equal(data.items.length, 98);
  assert.equal(Object.keys(data.questions).length, 6);
  assert.equal(data.items.filter((item) => item.gemini !== item.luna).length, 1);
  assert.equal(new Set(data.items.map((item) => item.key)).size, 98);
  for (const item of data.items) {
    assert.match(item.key, /^IC-[A-Za-z0-9_-]{7,12}$/);
    assert.deepEqual(Object.keys(item).sort(), ['answer', 'gemini', 'key', 'luna', 'question_key', 'session']);
  }
  for (const question of Object.values(data.questions)) {
    assert.deepEqual(Object.keys(question).sort(), ['labels', 'mode', 'question', 'title']);
  }
  assert.equal(/"criteria"|"paper"|"private_data"|"prompt_hash_short"|"student_id"|"student_name"/.test(read('data.json')), false, 'Không xuất trường riêng tư');
  assert.equal(/"key":\s*"[234]-(?:2|3|4|6|8)-\d+"/.test(read('data.json')), false, 'Không xuất mã ca gốc');
  assert.equal(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?<!\d)(?:\+?84|0)\d{8,10}(?!\d)/i.test(read('data.json')), false, 'Không xuất email hoặc số điện thoại');
  const js = read('review.js');
  assert.match(js, /fetch\('\.\/data\.json'/);
  assert.doesNotMatch(js, /file\.text\(\)|data-file|question\.criteria|item\.paper/);
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
