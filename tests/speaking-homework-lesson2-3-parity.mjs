import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseShareUrl } from '../speaking-homework/logic.mjs';

const root = new URL('../speaking-homework/', import.meta.url);
const page = name => readFileSync(fileURLToPath(new URL(name, root)), 'utf8');
const lesson2 = page('index.html');
const lesson3 = page('lesson-3.html');
const lesson4 = page('lesson-4.html');

// Học viên thấy cùng nhận diện và cùng hướng dẫn tránh hai loại link không nộp được.
for (const [name, html] of [['Buổi 2', lesson2], ['Buổi 3', lesson3]]) {
  assert.match(html, /href="\.\/lesson-3\.css"/, `${name} cần nạp màu IZONE như buổi 4`);
  assert.match(html, /<code>\/c\/\.\.\.<\/code>/, `${name} cần giải thích link riêng tư`);
  assert.match(html, /<code>\/s\/t_\.\.\.<\/code>/, `${name} cần giải thích link một phản hồi`);
  assert.match(html, /https:\/\/chatgpt\.com\/share\//, `${name} cần chỉ rõ dạng link đúng`);
}
assert.match(lesson4, /<code>\/s\/t_\.\.\.<\/code>/);

// Bộ kiểm dùng chung chỉ cho link Share đúng tên miền đi tiếp tới bước đọc hội thoại.
const valid = 'https://chatgpt.com/share/6a4b8dc6-aa30-83ec-82cb-b235ee51d460';
assert.equal(parseShareUrl(valid).ok, true);
for (const invalid of [
  'https://chatgpt.com/c/6a4b8dc6-aa30-83ec-82cb-b235ee51d460',
  'https://chatgpt.com/s/t_6ab7c876892881919d9c9cfff0af4c32',
  'https://chatgpt.com.evil.example/share/6a4b8dc6-aa30-83ec-82cb-b235ee51d460',
]) assert.equal(parseShareUrl(invalid).ok, false, invalid);

console.log('Buổi 2 và 3: màu IZONE, hướng dẫn link và bộ kiểm Share cùng chuẩn buổi 4.');
