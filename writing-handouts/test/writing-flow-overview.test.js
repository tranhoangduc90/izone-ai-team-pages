import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultWritingRange, withinWritingRange, sourceIssueAlreadyDelivered,
  writingPeriodMetrics, collectWritingPairs } from '../js/writing-flow-overview.js';

test('khoảng mặc định gồm bảy ngày theo giờ Việt Nam, kể cả khi qua tháng', () => {
  assert.deepEqual(defaultWritingRange(new Date('2026-09-30T18:00:00Z')),
    { from: '2026-09-25', to: '2026-10-01' });
  assert.equal(withinWritingRange('2026-09-30T18:00:00Z', '2026-10-01', '2026-10-01'), true);
  assert.equal(withinWritingRange('2026-09-30T16:00:00Z', '2026-10-01', '2026-10-01'), false);
  assert.equal(withinWritingRange(null, '2026-10-01', '2026-10-01'), true);
});

const issue = { issue_key: 'issue-demo', homework_file_id: 'document-demo', essay_slot: 2,
  source_record_id: 'source-demo', source_link_index: 1 };
const delivered = { pair_id: 'pair-demo', ...issue, status: 'delivered', lms_url: 'https://example.invalid/result' };

test('nguồn đã giao đúng bài không còn hiển thị trong Tiếp nhận', () => {
  assert.equal(sourceIssueAlreadyDelivered(issue, [delivered]), true);
  assert.equal(sourceIssueAlreadyDelivered(issue, [{ ...delivered, essay_slot: 1 }]), false);
  assert.equal(sourceIssueAlreadyDelivered(issue, [{ ...delivered, source_record_id: 'other-source' }]), false);
  assert.equal(sourceIssueAlreadyDelivered(issue, [{ ...delivered, source_link_index: 2 }]), false);
});

test('không lấy link cũ hoặc một bài khác đã xong để che bài đang lỗi', () => {
  assert.equal(sourceIssueAlreadyDelivered(issue, [{ ...delivered, status: 'needs_review' }]), false);
  assert.equal(sourceIssueAlreadyDelivered(issue, [{ ...delivered, lms_url: null }]), false);
  assert.equal(sourceIssueAlreadyDelivered(issue, [{ ...delivered, historical_review_code: 'CONFLICT' }]), false);
  const documentIssue = { homework_file_id: issue.homework_file_id };
  assert.equal(sourceIssueAlreadyDelivered(documentIssue,
    [delivered, { ...delivered, essay_slot: 3, status: 'running' }]), false);
  assert.equal(sourceIssueAlreadyDelivered(documentIssue, []), false);
});

test('Test đã giao trong Docs được nhận diện dù không dùng link LMS Homework', () => {
  assert.equal(sourceIssueAlreadyDelivered(issue,
    [{ ...delivered, source_type: 'term_test', lms_url: null }]), true);
});

test('tổng quan đếm hoạt động trong khoảng, không đếm trùng lỗi cùng cặp', () => {
  const reviews = [{ ...delivered, status: 'needs_review' }, { ...delivered, status: 'needs_review' }];
  const metrics = writingPeriodMetrics([
    { newly_graded_count: 2, historical_count: 8, delivered_count: 1 },
    { newly_graded_count: 3, completed_count: 4 },
  ], reviews, [issue, { homework_file_id: 'another-document', issue_key: 'other-issue' }]);
  assert.deepEqual(metrics, { graded: 5, delivered: 5, errors: 2 });
});

test('đọc đủ các trang để số tổng không bị cắt ở 50/100 bài', async () => {
  const requests = [];
  const rows = await collectWritingPairs(async filters => {
    requests.push(filters);
    return { data: filters.offset === 100
      ? { pairs: [{ pair_id: 'b' }] }
      : { pairs: [{ pair_id: 'a' }], nextOffset: 100 } };
  }, { view: 'review', dateFrom: '2026-10-07' });
  assert.deepEqual(rows.map(row => row.pair_id), ['a', 'b']);
  assert.equal(requests[1].dateFrom, '2026-10-07');
  assert.equal(requests[1].offset, 100);
});

test('không báo tổng đã xác nhận khi máy chủ trả con trỏ lặp', async () => {
  await assert.rejects(collectWritingPairs(async () => ({ data: { pairs: [], nextOffset: 100 } }), {}),
    /cùng một trang/u);
});
