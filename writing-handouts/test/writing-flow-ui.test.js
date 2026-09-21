import assert from 'node:assert/strict';
import test from 'node:test';
import { clampColumnWidth, defaultColumnWidths, formatWritingDay, normalizeWritingDay,
  readColumnWidths, serializeSortRules } from '../js/writing-flow-ui.js';

test('ngày date-only và ISO cùng hiển thị ổn định theo lịch Việt Nam', () => {
  assert.equal(normalizeWritingDay('2026-09-21'), '2026-09-21');
  assert.equal(normalizeWritingDay('2026-09-21T00:00:00.000Z'), '2026-09-21');
  assert.equal(formatWritingDay('2026-09-21T00:00:00.000Z'), '21/9/2026');
  assert.equal(formatWritingDay('2026-02-30'), 'Ngày không hợp lệ');
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
