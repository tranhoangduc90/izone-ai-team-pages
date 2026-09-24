import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeWritingTestDetail } from '../js/writing-flow-ui.js';

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
