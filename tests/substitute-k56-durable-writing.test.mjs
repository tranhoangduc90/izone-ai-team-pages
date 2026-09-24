import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL(
  '../term-tests/substitute-test-2-k56-shared/app.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function refreshWritingGrading()');
const end = source.indexOf('  function scheduleWritingGradingRefresh()', start);
assert.ok(start >= 0 && end > start);
const refreshSource = source.slice(start, end);

function fixture(response) {
  const events = { renders: [], notices: [], stages: [], stopped: 0, scheduled: 0 };
  const state = { studentRef: '1001', attemptToken: '', result: null,
    drafts: { listening: {}, reading: {}, writing: { task1: '', task2: '' } },
    testGrades: { listening: null, reading: null, writing: null },
    completed: false, writingSubmitted: false };
  const context = { durableWritingMode: true, demoMode: 'exam',
    serverGradingMode: true, state, classCode: 'IC2264',
    writingGradingPollInFlight: false, queueMicrotask: callback => callback(),
    apiRequest: async () => response,
    saveSession: () => {},
    buildDemoPayload: () => ({ writing: { grading: state.testGrades.writing?.grading },
      listening: state.testGrades.listening, reading: state.testGrades.reading }),
    renderResult: result => { events.renders.push(result); state.result = result; },
    setStage: stage => events.stages.push(stage),
    showNotice: message => events.notices.push(message),
    stopWritingGradingPolling: () => { events.stopped += 1; },
    scheduleWritingGradingRefresh: () => {
      const grading = state.result?.writing?.grading;
      if (state.writingSubmitted && !grading?.ready
        && grading?.status !== 'needs_review') events.scheduled += 1;
    },
  };
  return { state, events, run: () => vm.runInNewContext(
    `${refreshSource}\nrefreshWritingGrading();`, context) };
}

test('chọn lại tên khôi phục bài và hai kỹ năng thật, không dựng điểm 0', async () => {
  const sections = { listening: { correct: 31 }, reading: { correct: 20 } };
  const setup = fixture({ accepted: true, submittedEssay: 'Synthetic essay.',
    sections, grading: { status: 'ready', ready: true }, portalSync: { status: 'not_ready' } });
  await setup.run();
  assert.equal(setup.state.drafts.writing.task1, 'Synthetic essay.');
  assert.deepEqual(setup.state.testGrades.listening, sections.listening);
  assert.deepEqual(setup.state.testGrades.reading, sections.reading);
  assert.equal(setup.events.renders.length, 1);
  assert.equal(setup.events.renders[0].listening.correct, 31);
  assert.equal(setup.events.stages.at(-1), 'result');
});

test('thiếu phiếu hoặc hai kỹ năng thì không hiện điểm giả và không poll vô hạn', async () => {
  const notStarted = fixture({ accepted: false, grading: { status: 'not_submitted' } });
  await notStarted.run();
  assert.equal(notStarted.events.renders.length, 0);
  assert.equal(notStarted.events.scheduled, 0);
  const incomplete = fixture({ accepted: true, submittedEssay: 'Synthetic essay.',
    sections: null, grading: { status: 'needs_review' } });
  await incomplete.run();
  assert.equal(incomplete.events.renders.length, 0);
  assert.equal(incomplete.events.scheduled, 0);
  assert.ok(incomplete.events.notices.some(message => message.includes('không tự điền điểm 0')));
});

test('chưa bật cờ thì code giữ API cũ; cổng mới không được fallback im lặng', () => {
  assert.match(source, /DURABLE_WRITING_ENABLED === true/u);
  assert.match(source, /DURABLE_WRITING_API_BASE_URL : appConfig\.API_BASE_URL/u);
  assert.match(source, /Cổng nhận bài Writing mới chưa được cấu hình an toàn/u);
  assert.match(source, /state\.studentRef !== requestedStudentRef/u);
  assert.match(source, /grading\?\.status === 'needs_review'/u);
});

test('mọi vùng lưu của trang K56 Test 2 tách chế độ mới khỏi bài cũ', () => {
  const scripts = [
    '../term-tests/substitute-test-2-k56-computer-based/bootstrap.js',
    '../term-tests/substitute-test-2-k56-computer-based/enhance.js',
    '../term-tests/substitute-test-2-k56-computer-based/annotations.js',
  ];
  for (const path of scripts) {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(text, /DURABLE_WRITING_ENABLED === true/u, path);
    assert.match(text, /:durable-writing/u, path);
  }
  assert.match(source, /:durable-writing/u);
});

test('đổi tên xóa kết quả người trước trước khi mở bài người sau', () => {
  const from = source.indexOf("  elements.studentSelect.addEventListener('change'");
  const to = source.indexOf("  elements.listeningView.addEventListener('submit'", from);
  assert.ok(from >= 0 && to > from);
  let onChange;
  let refreshed = 0;
  const state = { studentRef: '1001', studentName: 'Người A',
    roster: [{ ref: '1001', name: 'Người A' }, { ref: '1002', name: 'Người B' }],
    testGrades: { listening: { correct: 31 }, reading: { correct: 20 }, writing: {} },
    drafts: { listening: { 1: 'A' }, reading: { 1: 'B' }, writing: { task1: 'Bài A' } },
    result: { private: 'A' }, completed: true, writingSubmitted: true };
  const context = { durableWritingMode: true, state,
    elements: { studentSelect: { value: '1002', addEventListener: (_name, callback) => {
      onChange = callback;
    } } },
    stopWritingGradingPolling: () => {}, saveSession: () => {},
    refreshWritingGrading: () => { refreshed += 1; } };
  vm.runInNewContext(source.slice(from, to), context);
  onChange();
  assert.equal(state.studentRef, '1002');
  assert.equal(state.testGrades.listening, null);
  assert.equal(state.drafts.writing.task1, '');
  assert.equal(state.result, null);
  assert.equal(refreshed, 1);
});
