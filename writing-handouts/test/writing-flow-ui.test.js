import assert from 'node:assert/strict';
import test from 'node:test';
import { clampColumnWidth, dailyBreakdown, defaultColumnWidths, formatWritingDay, normalizeWritingDay,
  readColumnWidths, serializeSortRules } from '../js/writing-flow-ui.js';
import * as writingUi from '../js/writing-flow-ui.js';

test('ngày date-only và ISO cùng hiển thị ổn định theo lịch Việt Nam', () => {
  assert.equal(normalizeWritingDay('2026-09-21'), '2026-09-21');
  assert.equal(normalizeWritingDay('2026-09-21T00:00:00.000Z'), '2026-09-21');
  assert.equal(formatWritingDay('2026-09-21T00:00:00.000Z'), '21/9/2026');
  assert.equal(formatWritingDay('2026-02-30'), 'Ngày không hợp lệ');
});

test('biểu đồ ngày tách ba loại hoạt động và giữ tương thích số đã giao cũ', () => {
  const rows = dailyBreakdown([
    { day: '2026-09-23T00:00:00.000Z', newly_graded_count: 3,
      historical_count: 162, delivered_count: 162, completed_count: 162 },
    { day: '2026-09-24', completed_count: 2 },
  ]);
  assert.equal(rows[0].day, '2026-09-23');
  assert.deepEqual(rows[0].series.map(item => item.count), [3, 162, 162]);
  assert.deepEqual(rows[1].series.map(item => item.count), [0, 0, 2]);
  assert.deepEqual(rows[0].series.map(item => item.label),
    ['Chấm mới', 'Ghi nhận kết quả cũ', 'Đã giao']);
});

test('độ rộng cột bị giới hạn và dữ liệu lưu hỏng quay về mặc định', () => {
  const storage = { getItem: () => JSON.stringify({ topic: 9999, content: 20, student: 'bad' }) };
  const widths = readColumnWidths(storage);
  assert.equal(widths.topic, 640);
  assert.equal(widths.content, 80);
  assert.equal(widths.student, defaultColumnWidths.student);
  assert.equal(clampColumnWidth(321.6), 322);
});

test('sort chỉ gửi tối đa ba trường đã công khai', () => {
  assert.equal(serializeSortRules([
    { key: 'finished', direction: 'desc' }, { key: 'student', direction: 'asc' },
    { key: 'source_ciphertext', direction: 'asc' }, { key: 'class', direction: 'asc' },
  ]), 'finished:desc,student:asc');
  assert.equal(serializeSortRules([
    { key: 'student', direction: 'asc' }, { key: 'student', direction: 'desc' },
  ]), 'student:asc');
});

test('bài Test trùng hiện hướng dẫn đối chiếu thay vì nút Retry', () => {
  const duplicate = writingUi.writingReviewAction({
    last_error_code: 'TEST_DOCUMENT_PAIR_ALREADY_REGISTERED',
  });
  assert.equal(duplicate.canRetry, false);
  assert.match(duplicate.message, /đối chiếu/u);
  assert.equal(writingUi.writingReviewAction({ error_code: 'STAGE_TIMEOUT' }).canRetry, true);
});
