import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../recordings/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../recordings/index.html', import.meta.url), 'utf8');

test('dashboard hiển thị số phần của recording nhiều clip', () => {
  assert.match(source, /Phần \$\{escapeHtml\(record\.partNumber\)\}\/\$\{escapeHtml\(record\.totalParts\)\}/);
});

test('đổi playlist tải lại cả nhóm và thông báo đã sửa tên', () => {
  assert.match(source, /await loadData\(\);\s*toast\('Đã đổi playlist và sửa lại tên/);
  assert.match(html, /chuyển playlist rồi sửa tên video/);
});

test('chỉ đưa playlist có mã lớp vào danh sách chọn', () => {
  assert.match(source, /\[A-Z\]\{1,4\}\\d\{3,5\}/);
});
