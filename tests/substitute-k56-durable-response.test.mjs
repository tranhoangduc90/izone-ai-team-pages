import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../term-tests/substitute-test-2-k56-shared/durable-response.js', import.meta.url), 'utf8');
const browser = { window: {} };
runInNewContext(source, browser);
const adapter = browser.window.K56_SUBSTITUTE_DURABLE_RESPONSE;

const attemptId = '11111111-1111-4111-8111-111111111111';
const submissionId = '33333333-3333-4333-8333-333333333333';

function status(overrides = {}) {
  return { accepted: true, status: {
    attemptId, submissionId, testSlug: 'substitute-test-2-k56',
    classId: 1252, taskNumber: 1, attemptStatus: 'submitted',
    submissionStatus: 'pending', submittedEssay: 'Synthetic Task 1 essay.',
    sectionResults: { listening: { correct: 26, total: 40 },
      reading: { correct: 24, total: 40 } },
    taskScore: null, result: null, portalSyncStatus: 'not_ready',
    ...overrides,
  }, externalWrites: false };
}

test('phiếu chưa có hoặc mới mở không bị nhận nhầm là bài đang chấm', () => {
  assert.equal(adapter.statusForPage({ accepted: false, status: null }).accepted, false);
  assert.equal(adapter.statusForPage(status({ attemptStatus: 'open',
    submissionId: null, submissionStatus: null, submittedEssay: null,
    sectionResults: null })).accepted, false);
});

test('phiếu đang chờ giữ đúng ba phần và không dựng điểm Writing giả', () => {
  const page = adapter.statusForPage(status());
  assert.equal(page.accepted, true);
  assert.equal(page.attemptId, attemptId);
  assert.equal(page.submissionId, submissionId);
  assert.equal(page.sections.listening.correct, 26);
  assert.equal(page.sections.reading.correct, 24);
  assert.equal(page.submittedEssay, 'Synthetic Task 1 essay.');
  assert.equal(page.grading.status, 'processing');
  assert.equal(page.grading.ready, false);
  assert.equal(page.grading.tasks.length, 0);
});

test('phiếu hoàn tất hiển thị đúng điểm, bốn tiêu chí và trạng thái Portal', () => {
  const result = { taskNumber: 1, taskScore: 3.5,
    criteria: ['TA', 'CC', 'LR', 'GRA'].map(code => ({ code, bandScore: 3.5 })) };
  const page = adapter.statusForPage(status({ submissionStatus: 'completed',
    taskScore: 3.5, result, portalSyncStatus: 'blocked_missing_first_scores' }));
  assert.equal(page.grading.ready, true);
  assert.equal(page.grading.writingScore, 3.5);
  assert.equal(page.grading.tasks[0].criteria.length, 4);
  assert.equal(page.portalSync.status, 'blocked_missing_first_scores');
  assert.equal(adapter.statusForPage(status({ submissionStatus: 'needs_review' }))
    .grading.status, 'needs_review');
});

test('sai đề, Task, lượt, phần bài hoặc kết quả đều dừng trước khi hiển thị', () => {
  const result = { taskNumber: 1, taskScore: 3.5,
    criteria: ['TA', 'CC', 'LR', 'GRA'].map(code => ({ code })) };
  for (const changed of [
    { testSlug: 'substitute-test-2-k67' }, { taskNumber: 2 },
    { attemptId: 'browser-generated' }, { submissionId: null },
    { submittedEssay: '' }, { sectionResults: null },
    { submissionStatus: 'unknown' },
    { submissionStatus: 'completed', taskScore: 3.5, result: null },
    { submissionStatus: 'completed', taskScore: 4, result },
    { submissionStatus: 'completed', taskScore: 3.5,
      result: { ...result, criteria: result.criteria.slice(0, 3) } },
  ]) {
    assert.throws(() => adapter.statusForPage(status(changed)),
      /Chưa xác nhận được phiếu bài Writing/u);
  }
  assert.throws(() => adapter.statusForPage({ accepted: true, status: null }),
    /Chưa xác nhận được phiếu bài Writing/u);
});

test('HTTP 202 thiếu phiếu không được báo nộp thành công', () => {
  assert.equal(adapter.submittedReceipt({ accepted: true, attemptId,
    submissionId }).submissionId, submissionId);
  for (const invalid of [{ accepted: false, attemptId, submissionId },
    { accepted: true, attemptId },
    { accepted: true, attemptId: 'browser-generated', submissionId }]) {
    assert.throws(() => adapter.submittedReceipt(invalid),
      /Chưa xác nhận được phiếu bài Writing/u);
  }
});
