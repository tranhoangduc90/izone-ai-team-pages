import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../recordings/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../recordings/index.html', import.meta.url), 'utf8');

test('dashboard hiển thị số phần của recording nhiều clip', () => {
  assert.match(source, /Phần \$\{escapeHtml\(record\.partNumber\)\}\/\$\{escapeHtml\(record\.totalParts\)\}/);
});

test('đổi playlist tải lại cả nhóm và thông báo đã sửa tên', () => {
  assert.match(source, /Đã chuyển playlist và lưu tên video/);
  assert.match(html, /chuyển playlist rồi sửa tên video/);
});

test('chỉ đưa playlist có mã lớp vào danh sách chọn', () => {
  assert.match(source, /\[A-Z\]\{1,4\}\\d\{3,5\}/);
});

test('Portal local DATETIME giữ 19 giờ ngày học theo giờ Việt Nam',()=>{
 const source=fs.readFileSync(new URL('../recordings/app.js',import.meta.url),'utf8');
 const functions=source.slice(source.indexOf('function parseTimestamp'),source.indexOf('function portalTime'));
 const result=new Function(functions+";return {localDate:localDate('2026-09-17 19:00:00'),display:dateTime('2026-09-17 19:00:00')};")();
 assert.equal(result.localDate,'2026-09-17');assert.match(result.display,/19:00/);assert.match(result.display,/17\/09\/2026/);
});
