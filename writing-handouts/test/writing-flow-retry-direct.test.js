// Dữ liệu giả: chạy ba nút Retry mà không gọi API production hay đọc bài thật.
// Mục tiêu: một lần bấm gửi ngay, bấm lặp khi đang gửi không tạo yêu cầu thứ hai.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = readFileSync(new URL('../js/writing-flow.js', import.meta.url), 'utf8');
function isolate(start, end, context) {
  const first = script.indexOf(start);
  const last = script.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Không thấy hàm ${start}`);
  return runInNewContext(`${script.slice(first, last)}\n${start.match(/function (\w+)/u)[1]}`, context);
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function forbidDialog() { throw new Error('Không được mở hộp hỏi trước Retry'); }

test('Retry một bài gửi đúng bước ngay và chặn bấm lặp', async () => {
  const pending = deferred();
  const calls = [];
  const button = { disabled: false };
  const context = {
    writingReviewAction: () => ({ canRetry: true }), activeStage: () => null,
    stageNames: { main: 'Chấm chính' }, testStageNames: {},
    state: { api: { retryWritingPairStage: (...args) => { calls.push(args); return pending.promise; } } },
    prompt: forbidDialog, confirm: forbidDialog,
    refreshData: async () => {}, showError: forbidDialog,
  };
  const retryPair = isolate('async function retryPair(', 'async function skipSourceIssue(', context);
  const pair = { pair_id: 'pair-demo', stage_key: 'main', source_type: 'homework' };
  const first = retryPair(pair, button);
  assert.equal(button.disabled, true);
  await retryPair(pair, button);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], pair.pair_id);
  assert.equal(calls[0][1], 'main');
  assert.ok(calls[0][2]);
  pending.resolve();
  await first;
});

test('Retry bài cần kiểm tra gửi ngay, không hỏi lại', async () => {
  const calls = [];
  const context = {
    state: { api: { retryWritingReview: async (...args) => { calls.push(args); } } },
    stageNames: { precheck: 'Kiểm trước' }, createRequestId: () => 'request-demo',
    confirm: forbidDialog, refreshData: async () => {}, showError: forbidDialog,
  };
  const retryReview = isolate('async function retryReview(', 'function renderReviews(', context);
  await retryReview({ review_id: 'review-demo', stage_key: 'precheck' }, { disabled: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'review-demo');
});

test('Đọc lại lỗi nguồn gửi ngay và mở lại nút khi API lỗi', async () => {
  const errors = [];
  const context = {
    state: { api: { retryWritingSourceIssue: async () => { throw new Error('API thử lỗi'); } } },
    createRequestId: () => 'request-demo', confirm: forbidDialog,
    refreshData: async () => {}, showError: (_id, message) => errors.push(message),
  };
  const retrySourceIssue = isolate('async function retrySourceIssue(', 'function renderIssues(', context);
  const button = { disabled: false };
  await retrySourceIssue({ issue_key: 'issue-demo' }, button);
  assert.equal(button.disabled, false);
  assert.match(errors[0], /API thử lỗi/u);
});

test('API đã nhận nhưng tải lại màn hình lỗi thì không mở nút gây gửi trùng', async () => {
  const errors = [];
  let calls = 0;
  const context = {
    state: { api: { retryWritingSourceIssue: async () => { calls += 1; } } },
    createRequestId: () => 'request-demo', confirm: forbidDialog,
    refreshData: async () => { throw new Error('Mất kết nối khi tải lại'); },
    showError: (_id, message) => errors.push(message),
  };
  const retrySourceIssue = isolate('async function retrySourceIssue(', 'function renderIssues(', context);
  const button = { disabled: false };
  await retrySourceIssue({ issue_key: 'issue-demo' }, button);
  assert.equal(calls, 1);
  assert.equal(button.disabled, true);
  assert.match(errors[0], /Đã gửi yêu cầu/u);
  await retrySourceIssue({ issue_key: 'issue-demo' }, button);
  assert.equal(calls, 1);
});

test('nguồn Test trùng vẫn chặn Retry trước API', async () => {
  let calls = 0;
  const errors = [];
  const context = {
    writingReviewAction: () => ({ canRetry: false, message: 'Nguồn Test trùng' }),
    activeStage: () => null, stageNames: {}, testStageNames: {},
    state: { api: { retryWritingPairStage: async () => { calls += 1; } } },
    prompt: forbidDialog, confirm: forbidDialog,
    refreshData: async () => {}, showError: (_id, message) => errors.push(message),
  };
  const retryPair = isolate('async function retryPair(', 'async function skipSourceIssue(', context);
  await retryPair({ pair_id: 'pair-demo', stage_key: 'main' }, { disabled: false });
  assert.equal(calls, 0);
  assert.match(errors[0], /Nguồn Test trùng/u);
});