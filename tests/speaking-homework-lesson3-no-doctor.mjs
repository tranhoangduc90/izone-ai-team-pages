import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Đọc trang Lesson 3, kiểm phần bổ trợ không xuất hiện; lỗi sẽ chỉ rõ trang còn khu không được giao.
const html = await readFile(new URL('../speaking-homework/lesson-3.html', import.meta.url), 'utf8');
assert.equal(/BÁC SĨ AI|doctor-preview|doctor-link-1|doctor-link-2/i.test(html), false, 'Lesson 3 vẫn còn khu Bác sĩ AI.');
assert.match(html, /id="parts"/);
console.log('Lesson 3: chỉ còn bốn phần Speaking, không có Bác sĩ AI.');
