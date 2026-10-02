// Nhận vào: hồ sơ Test tranh chấp và hồ sơ lỗi thường; chạy hàm tạo thao tác V1/V2.
// Việc chính: kiểm các nút người dùng nhận được, không gọi API hoặc trình duyệt thật.
// Kết quả: tranh chấp chỉ cho xem/đối chiếu; lỗi thường vẫn có Retry và Bỏ qua.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { historicalReviewMessage, writingReviewAction } from '../js/writing-flow-ui.js';

function actionHarness(script) {
  const start = script.indexOf('function actionCell(row) {');
  const end = script.indexOf('\nfunction appendCell(', start);
  assert.ok(start >= 0 && end > start, 'Có hàm thao tác đang dùng trên dashboard');
  const context = vm.createContext({
    document: { createElement: () => ({ children: [], append(...items) { this.children.push(...items); } }) },
    actionButton: label => ({ label }), makeText: (_, text) => ({ text }),
    writingReviewAction, historicalReviewMessage,
  });
  vm.runInContext(script.slice(start, end), context);
  return row => context.actionCell(row);
}

for (const file of ['writing-flow.js', 'writing-flow-v2.js']) {
  test(`D03 ${file}: không có Retry hoặc Bỏ qua cho hồ sơ tranh chấp đã giao`, async () => {
    const script = await readFile(new URL(`../js/${file}`, import.meta.url), 'utf8');
    const createCell = actionHarness(script);
    const cell = createCell({ source_type: 'term_test', status: 'delivered',
      historical_review_code: 'TEST_HISTORICAL_EVIDENCE_CONFLICT',
      historical_peer_pair_ids: ['22222222-2222-4222-8222-222222222222'] });
    assert.deepEqual(cell.children.filter(item => item.label).map(item => item.label), ['Xem']);
    assert.match(cell.title, /đã được giao trước/u);
  });
  test(`D03 ${file}: lỗi thường vẫn có đường thử lại và bỏ qua`, async () => {
    const script = await readFile(new URL(`../js/${file}`, import.meta.url), 'utf8');
    const cell = actionHarness(script)({ source_type: 'lark_homework', status: 'needs_review',
      last_error_code: 'STAGE_TIMEOUT' });
    assert.deepEqual(cell.children.filter(item => item.label).map(item => item.label),
      ['Xem', 'Retry', 'Bỏ qua']);
  });
}
