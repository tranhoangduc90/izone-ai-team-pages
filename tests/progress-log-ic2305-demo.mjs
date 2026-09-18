import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'progress-log-ic2305-demo');
const source = async name => readFile(resolve(root, name), 'utf8');
const dataText = await source('data.js');
const data = await import(pathToFileURL(resolve(root, 'data.js')).href);

test('dữ liệu mẫu là 18 hồ sơ ẩn danh, 15 phiếu đủ và ba phần', () => {
  const seeded = data.seed();
  assert.equal(seeded.students.length, 18);
  assert.equal(seeded.students.filter(item => item.submitted).length, 15);
  assert.equal(seeded.students.filter(item => item.submitted && data.isComplete(item)).length, 15);
  assert.equal(data.BLOCKS.length, 3);
  assert.equal(Object.keys(data.QUESTIONS).length, 6);
  assert.deepEqual(data.BLOCKS.flatMap(block => block.items), Object.keys(data.QUESTIONS));
  assert.equal(seeded.students.filter(item => item.responses.q3 === 'B').length, 15);
  assert.equal(seeded.students.filter(item => item.responses.q5 === 'FALSE').length, 10);
});

test('câu điền khuyết giữ nguyên bốn câu và tám ô theo bản gốc', () => {
  assert.equal(data.QUESTIONS.q4.rows.length, 4);
  assert.equal(data.QUESTIONS.q4.rows.reduce((count, row) => count + row.parts.length - 1, 0), 8);
  assert.equal(data.QUESTIONS.q6.rows.reduce((count, row) => count + row.parts.length - 1, 0), 2);
});

test('mọi trang demo không khai báo mạng ra ngoài hoặc dùng kho bài thật', async () => {
  for (const name of ['index.html', 'teacher.html']) {
    const html = await source(name);
    assert.match(html, /connect-src 'none'/);
    assert.doesNotMatch(html, /ducizone\.ddns\.net|accounts\.google\.com/);
  }
  for (const name of ['student.js', 'teacher.js', 'data.js']) {
    const js = await source(name);
    assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|mapping-api|api\/learning/);
  }
  assert.match(dataText, /izone:progress-log:ic2305:demo:v1/);
  assert.doesNotMatch(dataText, /@gmail\.com|studentRef|erp_student_id/i);
});

test('câu thiếu không được coi là hoàn tất', () => {
  const target = data.seed().students[16];
  assert.equal(data.isComplete(target), false);
  assert.equal(data.isPresent(data.QUESTIONS.q4, ['a', 'b']), false);
  assert.equal(data.isPresent(data.QUESTIONS.q4, Array(8).fill('mẫu')), true);
});
