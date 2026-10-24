import test from 'node:test';
import assert from 'node:assert/strict';
import { worksheetSourcePanel } from '../js/writing-flow-worksheet-ui.js';
const pending = { homework_file_id: 'fixture-pending', class_code: 'IC-DEMO', dispatch_status: 'sent', source_created_at: '2026-10-01T00:00:00Z' };
const done = { homework_file_id: 'fixture-done', class_code: 'IC-DEMO', dispatch_status: 'acknowledged', worksheet: { kind: 'writing2', answeredCount: 3, deliveredAt: '2026-10-23T00:00:00Z' } };
test('Nguồn chưa có pair vẫn hiện trong hàng đợi, kể cả bài tồn trước khoảng ngày mặc định', () => {
  const p = worksheetSourcePanel([pending, done], { view: 'intake', dateFrom: '2026-10-22', dateTo: '2026-10-23' });
  assert.equal(p.documents, 1); assert.equal(p.rows[0].homework_file_id, pending.homework_file_id);
});
test('Phiếu đã giao tính theo số ô thực làm, không đếm bản nguồn trùng', () => {
  const p = worksheetSourcePanel([done, { ...done }], { view: 'delivered', dateFrom: '2026-10-23', dateTo: '2026-10-23' });
  assert.equal(p.documents, 1); assert.equal(p.units, 3);
});
test('Danh sách đã giao giữ bộ lọc ngày, còn thanh giai đoạn xem toàn hàng đợi', () => {
  assert.equal(worksheetSourcePanel([done], { view: 'delivered', dateFrom: '2026-10-22', dateTo: '2026-10-22' }).documents, 0);
  assert.equal(worksheetSourcePanel([done], { view: 'deliver', stage: 'deliver', dateFrom: '2026-10-22', dateTo: '2026-10-22' }).documents, 1);
});
test('Không đưa kết quả phiếu vào các bước AI đang chờ', () => assert.equal(worksheetSourcePanel([done], { view: 'main', stage: 'main' }), null));

test('Lọc Task 1 không hiện phiếu luyện Task 2', () => assert.equal(worksheetSourcePanel([done], {view:'delivered',taskType:'task_1'}),null));
