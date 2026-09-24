import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const app = read('progress-log/app.js');
const styles = read('progress-log/styles.css');
const teacher = read('progress-log/teacher.js');
const studentHtml = read('progress-log/index.html');
const teacherHtml = read('progress-log/teacher.html');

test('renderer có chuỗi lập luận với ô điền nằm giữa hai mắt xích', () => {
  assert.match(app, /reasoning_chain_completion/);
  assert.match(app, /beforeText/);
  assert.match(app, /afterText/);
  assert.match(styles, /\.reasoning-chain/);
  assert.match(styles, /\.reasoning-chain-input/);
});

test('ô Vấn đề khác chỉ hiện và trở thành bắt buộc theo lựa chọn điều khiển', () => {
  assert.match(app, /conditional_other_text/);
  assert.match(app, /visibleWhenItemVersionId/);
  assert.match(app, /requiredWhenVisible/);
  assert.match(app, /refreshConditionalQuestions/);
  assert.match(app, /marker\.hidden = !requiredNow/);
  assert.match(app, /allItems\(\)\.filter\(item => itemIsRequired\(item\)/);
});

test('học viên và giảng viên dùng số câu hiển thị của bản gốc', () => {
  assert.match(app, /item\.displayNumber \|\| String\(item\.position\)/);
  assert.match(teacher, /item\.displayNumber \|\| item\.position/);
});

test('dashboard không tạo thẻ rỗng cho câu phụ đang không áp dụng', () => {
  assert.match(teacher, /conditional_other_text/);
  assert.match(teacher, /filter\(item =>/);
});

test('giao diện mới có responsive mobile và không thêm khối Việc tiếp theo', () => {
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(studentHtml, /VIỆC TIẾP THEO/i);
});

test('asset thay đổi có revision mới để trình duyệt không giữ giao diện cũ', () => {
  assert.match(studentHtml, /styles\.css\?rev=[A-Za-z0-9-]+/);
  assert.match(studentHtml, /app\.js\?rev=[A-Za-z0-9-]+/);
  assert.match(teacherHtml, /styles\.css\?rev=[A-Za-z0-9-]+/);
  assert.match(teacherHtml, /teacher\.js\?rev=[A-Za-z0-9-]+/);
});
