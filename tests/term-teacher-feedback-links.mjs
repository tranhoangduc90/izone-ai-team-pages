import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

// Dữ liệu giả kiểm phần hiển thị, không đọc hoặc thay đổi bài chấm trong database.
const source = fs.readFileSync(new URL('../term-tests/teacher/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function cleanWritingFeedback(');
const end = source.indexOf('\nfunction ', start + 1);
assert(start >= 0 && end > start);
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);

test('bỏ liên kết chi tiết lặp, giữ nhận xét trước và sau', () => {
  for (const href of ['#tr_task_coverage', '*#tr_position*', './#cc_organization', ' #lr_range ']) {
    for (const separator of ['\n', '\r\n', ' ']) {
      const value = `Nhận xét giả cần giữ.${separator}[(Xem phân tích chi tiết và cách cải thiện nội dung)](${href})${separator}Kết luận cần giữ.`;
      const result = context.cleanWritingFeedback(value);
      assert.match(result, /Nhận xét giả cần giữ\./);
      assert.match(result, /Kết luận cần giữ\./);
      assert.doesNotMatch(result, /Xem phân tích|\]\(#/);
    }
  }
});

test('hỗ trợ nhãn xuống dòng và liên kết không có ngoặc quanh nhãn', () => {
  assert.equal(context.cleanWritingFeedback('[Xem phân tích chi tiết\nvà cách cải thiện](#tr_task_coverage)'), '');
});

test('không xóa nội dung chuyên môn hoặc liên kết nội bộ không liên quan', () => {
  const value = 'Band 6.5\nNhận xét chuyên môn.\n[Ví dụ trong bài](#example)';
  assert.equal(context.cleanWritingFeedback(value), value);
});

test('nút mở chi tiết và hành vi mở/thu gọn vẫn có trong giao diện', () => {
  assert.match(source, /'writing-component-toggle', 'Xem phân tích chi tiết và cách cải thiện'/);
  assert.match(source, /toggle\.textContent = willOpen \? 'Thu gọn phân tích chi tiết'/);
});
