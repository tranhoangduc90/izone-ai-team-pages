import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {observeSubmissionWindow, windowCanSubmit, submissionWindowMessage} from '../progress-log/submission-window.js';

test('trang mở sẵn khóa đúng hạn với đồng hồ máy chủ và thời gian đã trôi', () => {
  const window = observeSubmissionWindow({ canSubmit: true, serverNow: '2026-10-06T14:59:59Z',
    effectiveClosesAt: '2026-10-06T15:00:00Z', completeStudents: 3 }, 100);
  assert.equal(windowCanSubmit(window, 1099), true);
  assert.equal(windowCanSubmit(window, 1100), false);
  assert.match(submissionWindowMessage(window, 100), /22:00/);
  assert.match(submissionWindowMessage(window, 1100), /đã khóa nhận bài/);
});

test('phiếu dưới ngưỡng giải thích điều kiện khóa, phiếu cũ đóng vẫn có hành trình', () => {
  const window = observeSubmissionWindow({ canSubmit: true, completeStudents: 2, effectiveClosesAt: null }, 0);
  assert.equal(windowCanSubmit(window, 99999), true);
  assert.match(submissionWindowMessage(window, 0), /2\/3/);
  assert.match(submissionWindowMessage({ ...window, canSubmit: false }, 0), /xem được hành trình/);
});

test('mốc hỏng không làm giao diện nhận bài hoặc ném lỗi định dạng thời gian', () => {
  const window = { canSubmit: true, effectiveClosesAt: 'broken', serverNow: 'broken', observedAt: 0 };
  assert.equal(windowCanSubmit(window, 0), false);
  assert.match(submissionWindowMessage(window, 0), /đã khóa/);
});

test('A02: đề xuất lịch giảng viên dùng số buổi hợp lệ, bỏ hủy và cho hai giờ khác cùng ngày', async () => {
  const source = await readFile(new URL('../progress-log/teacher.js', import.meta.url), 'utf8');
  const start = source.indexOf('function proposeJourneyPlanDates(');
  const end = source.indexOf('function renderJourneyPlanDateInputs(', start);
  const propose = vm.runInNewContext(source.slice(start, end) + '\nproposeJourneyPlanDates');
  const schedule = { ambiguous: false, sessions: [
    {erpSessionId:'35816',date:'2026-10-05',proposalEligible:false,erpSessionNumber:null},
    {erpSessionId:'35817',date:'2026-10-05',proposalEligible:true,erpSessionNumber:1},
    {erpSessionId:'35818',date:'2026-10-05',proposalEligible:true,erpSessionNumber:2}
  ] };
  const result = propose(2, [], schedule);
  assert.equal(result.added, 2);
  assert.deepEqual(Array.from(result.dates, item => [item.sessionNumber,item.erpSessionId]), [[1,'35817'],[2,'35818']]);
});
