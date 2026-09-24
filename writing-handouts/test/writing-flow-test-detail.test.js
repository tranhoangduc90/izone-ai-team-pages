import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeWritingTestDetail, summarizeWritingTestRow } from '../js/writing-flow-ui.js';

test('dòng Test đã khôi phục chỉ dẫn xem Docs cũ, không hiển thị điểm và tiến độ lượt chấm sai', () => {
  const row = summarizeWritingTestRow({ source_type: 'term_test', result_origin: 'legacy_restored',
    test_config: null, task_number: 2, component_count: 10, task_score: null, writing_score: null });
  assert.match(row.progress, /kết quả cũ.*Docs/iu);
  assert.doesNotMatch(row.progress, /10\/10|Chưa rõ kỳ/iu);
  assert.equal(row.overall, 'Xem điểm trong Docs cũ');
  assert.equal(row.lms, 'Không dùng');
});

test('dòng Test hiện hành giữ điểm và đủ số thành phần', () => {
  const row = summarizeWritingTestRow({ source_type: 'term_test', test_config: 'Term Test 1',
    task_number: 2, component_count: 10, task_score: 6.5, writing_score: 6 });
  assert.equal(row.progress, 'Term Test 1 · Task 2 · 10/10 phần · Band 6.5');
  assert.equal(row.overall, 'Band 6');
});

test('dòng rỗng hoặc Homework không bị gắn nhãn Test', () => {
  assert.equal(summarizeWritingTestRow(null), null);
  assert.equal(summarizeWritingTestRow({ source_type: 'google_classroom', task_number: 2 }), null);
});

test('chi tiết Test cho thấy từng tiêu chí, thành phần và điểm đã lưu', () => {
  const detail = summarizeWritingTestDetail({
    task_number: 2, task_score: 6.5, writing_score: 6.5,
    criteria: [{ criterion_code: 'TR', name: 'Task Response', band_score: 6,
      feedback: 'Đã trả lời đề.', components: [{ component_code: 'tr_task_coverage',
        label: 'Trả lời đủ yêu cầu', summary: 'Còn thiếu ví dụ.', feedback: 'Bổ sung dẫn chứng.' }] }],
  });
  assert.equal(detail.taskNumber, 2);
  assert.equal(detail.scoreLabel, 'Band 6.5');
  assert.equal(detail.criteria[0].title, 'TR · Task Response · Band 6');
  assert.equal(detail.criteria[0].components[0].title, 'Trả lời đủ yêu cầu');
  assert.equal(detail.criteria[0].components[0].summary, 'Còn thiếu ví dụ.');
});

test('kết quả Test cũ đã khôi phục không hiện điểm lượt chấm sai', () => {
  const detail = summarizeWritingTestDetail({ result_origin: 'legacy_restored',
    task_number: 1, task_score: 8, criteria: [] });
  assert.equal(detail.scoreLabel, null);
  assert.deepEqual(detail.criteria, []);
  assert.match(detail.message, /kết quả cũ.*Google Docs/iu);
});

test('bài Test chưa có kết quả không tạo điểm hoặc nhận xét giả', () => {
  assert.equal(summarizeWritingTestDetail(null), null);
  const detail = summarizeWritingTestDetail({ task_number: 1, task_score: null,
    criteria: null });
  assert.equal(detail.scoreLabel, null);
  assert.deepEqual(detail.criteria, []);
  assert.match(detail.message, /Chưa có nhận xét chi tiết/iu);
});
