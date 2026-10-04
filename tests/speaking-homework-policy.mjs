import assert from 'node:assert/strict';
import test from 'node:test';
import { freestyleInstructions } from '../speaking-homework/assignment-instructions.js';
// Kiểm kết quả hướng dẫn từ hai cấu hình độc lập.
test('một câu và ba câu hiển thị đúng cấu hình của từng bài', () => {
  for (const minimum of [1,3]) {
    const instructions=freestyleInstructions({parts:[{part_key:'freestyle',min_questions:minimum}]});
    assert.match(instructions.lead,new RegExp(`ít nhất ${minimum} câu`));
  }
  assert.match(freestyleInstructions({parts:[{part_key:'freestyle',min_questions:1}]}).repeat,/một câu là đủ/);
});
test('thiếu cấu hình không tự đoán ngưỡng', () => {
  assert.throws(()=>freestyleInstructions({parts:[]}),/Thiếu số câu/);
});
