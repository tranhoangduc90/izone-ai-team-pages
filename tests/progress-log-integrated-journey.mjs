import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

class Node {
  constructor() { this.children = []; this.textContent = ''; this.hidden = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
}

const app = await readFile(new URL('../progress-log/app.js', import.meta.url), 'utf8');
const start = app.indexOf('function journeyText(');
const end = app.indexOf('async function openAssignment()', start);
assert.ok(start >= 0 && end > start);
const journeyFunctions = app.slice(start, end);

function contextFor(journey) {
  const names = [
    'journeyStudentName', 'journeyClassName', 'attendedCount', 'submittedCount',
    'reportCount', 'journeyStatus', 'journeySessions', 'journeyReports',
    'journeyReportList', 'journeyButton', 'journeyResultButton'
  ];
  const elements = Object.fromEntries(names.map(name => [name, new Node()]));
  const state = {
    assignment: { class: { id: '123' } }, publicToken: '11111111-1111-4111-8111-111111111111',
    confirmedStudent: { studentRef: '22222222-2222-4222-8222-222222222222' },
    journeyLoading: false
  };
  const calls = [];
  const context = {
    document: { createElement: () => new Node() }, elements, state,
    apiRequest: async (path, options) => { calls.push({ path, options }); return { journey }; },
    showView: view => calls.push({ view }),
    setNotice: (message, kind) => calls.push({ message, kind })
  };
  const actions = vm.runInNewContext(`${journeyFunctions}
({ openIntegratedJourney, renderIntegratedJourney })`, context);
  return { ...actions, elements, state, calls };
}

test('học viên xem Journey cùng link phiếu, buổi Test không bị coi là thiếu phiếu', async () => {
  const journey = {
    student: { studentRef: '22222222-2222-4222-8222-222222222222', name: 'Học viên giả' },
    class: { classId: '123', name: 'Lớp giả' },
    summary: { attendedSessions: 1, submittedComplete: 1, availableReports: 0 },
    sessions: [
      { sessionNumber: 1, assignmentId: 'assignment-1', completeness: 'complete',
        dataOrigin: 'progress_log', title: 'Buổi học 1', attendanceStatus: 'self_confirmed',
        portalSync: { status: 'queued' } },
      { sessionNumber: 2, assignmentId: null, completeness: null,
        dataOrigin: 'test_evidence', sessionKind: 'test', title: 'Mini Test' },
      { sessionNumber: 3, assignmentId: null, completeness: null,
        dataOrigin: 'inferred_gap', sessionKind: 'lesson', title: 'Buổi 3' }
    ], coverage: { knownThroughSession: 3 }, reports: []
  };
  const ui = contextFor(journey);
  await ui.openIntegratedJourney('confirmView');
  assert.equal(ui.calls.find(call => call.path)?.options.body.publicToken, ui.state.publicToken);
  assert.equal(ui.calls.find(call => call.path)?.options.body.identityConfirmed, true);
  assert.equal(ui.calls.find(call => call.view)?.view, 'journeyView');
  assert.equal(ui.elements.journeySessions.children.length, 3);
  const testHeading = ui.elements.journeySessions.children[1].children[0];
  assert.match(testHeading.children[1].textContent, /Có dữ liệu Test · chưa hiển thị kết quả/);
  const gapHeading = ui.elements.journeySessions.children[2].children[0];
  assert.match(gapHeading.children[1].textContent, /Chưa có dữ liệu cho buổi này/);
  assert.match(ui.elements.journeySessions.children[0].children[3].textContent, /đang chờ đồng bộ/);
  assert.match(ui.elements.journeyStatus.textContent, /1 ô buổi chưa có nguồn xác nhận/);
  assert.equal(ui.elements.attendedCount.textContent, 1);
  journey.sessions[0].portalSync.status = 'complete';
  ui.renderIntegratedJourney(journey);
  const completedPortalMessage = ui.elements.journeySessions.children[0].children[3].textContent;
  assert.match(completedPortalMessage, /cần được đối chiếu trên Portal/);
  assert.doesNotMatch(completedPortalMessage, /đã có mặt|Portal đã ghi/);
  journey.sessions[0].attendanceStatus = 'pending_teacher';
  ui.renderIntegratedJourney(journey);
  const revisedSession = ui.elements.journeySessions.children[0];
  assert.match(revisedSession.children[2].textContent, /đã từng có yêu cầu đồng bộ Portal/);
  assert.match(revisedSession.children[3].textContent, /cần được đối chiếu trên Portal/);
});

test('kế hoạch lớp hiển thị đủ buổi và Test chưa có điểm mà không coi là vắng', () => {
  const journey = {
    student: { name: 'Học viên giả' }, class: { name: 'Lớp giả' },
    summary: { attendedSessions: 0, submittedComplete: 0, availableReports: 0 },
    coverage: { knownThroughSession: 8, schedule: 'teacher_confirmed', plannedSessions: 8 },
    sessions: [
      { sessionNumber: 7, assignmentId: null, dataOrigin: 'confirmed_plan',
        sessionKind: 'test', title: 'Buổi Test', sessionDate: '2026-09-30' },
      { sessionNumber: 8, assignmentId: null, dataOrigin: 'confirmed_plan',
        sessionKind: 'lesson', title: 'Buổi 8' }
    ], reports: []
  };
  const ui = contextFor(journey);
  ui.renderIntegratedJourney(journey);
  assert.match(ui.elements.journeySessions.children[0].children[0].children[1].textContent,
    /Buổi Test theo kế hoạch · chưa có kết quả/);
  assert.match(ui.elements.journeySessions.children[1].children[0].children[1].textContent,
    /Theo kế hoạch lớp · chưa có Progress Log/);
  assert.match(ui.elements.journeySessions.children[0].children[2].textContent,
    /30\/09\/2026/);
  assert.equal(ui.elements.journeySessions.children[1].children.length, 2);
  assert.match(ui.elements.journeyStatus.textContent, /đã xác nhận kế hoạch 8 buổi/);
  journey.coverage.planOutdated = true;
  journey.coverage.knownThroughSession = 9;
  ui.renderIntegratedJourney(journey);
  assert.match(ui.elements.journeyStatus.textContent, /cần được giảng viên kiểm lại/);
  assert.equal(ui.elements.attendedCount.textContent, 0);
});

test('API trả sai lớp hoặc học viên thì Journey không hiện', async () => {
  const ui = contextFor({
    student: { studentRef: '33333333-3333-4333-8333-333333333333' },
    class: { classId: '999' }
  });
  await ui.openIntegratedJourney('confirmView');
  assert.equal(ui.calls.some(call => call.view === 'journeyView'), false);
  assert.match(ui.calls.find(call => call.kind === 'error').message, /không khớp/);
  assert.equal(ui.elements.journeyButton.disabled, false);
});

test('link phiếu đã đóng vẫn chọn tên để xem Journey và không mở phiếu', async () => {
  const begin = app.indexOf('async function openAssignment()');
  const finish = app.indexOf('async function startAttempt()', begin);
  assert.ok(begin >= 0 && finish > begin);
  const elements = Object.fromEntries([
    'brandLabel', 'sessionLabel', 'assignmentTitle', 'classLabel',
    'studentSelect', 'chooseStudentButton'
  ].map(name => [name, new Node()]));
  const calls = [];
  const state = { assignment: null, journeyOnly: false };
  const assignment = {
    class: { id: '123', name: 'Lớp giả' }, sessionNumber: 2,
    title: 'Phiếu buổi 2', roster: [{ studentRef: 'student-1', name: 'Học viên giả' }]
  };
  const context = {
    state, elements, config: {},
    readPublicToken: () => '11111111-1111-4111-8111-111111111111',
    apiRequest: async path => {
      calls.push(path);
      if (path === '/assignments/open') throw Object.assign(new Error('Phiếu đã đóng'), { status: 404 });
      return { assignment };
    },
    document: { createElement: () => new Node() },
    Option: class { constructor(text, value) { this.textContent = text; this.value = value; } },
    displayStudent: student => student.name,
    installStudentMemory: () => {},
    setNotice: message => calls.push(message),
    showView: view => calls.push(view),
    fail: (_title, message) => { throw new Error(message); }
  };
  const open = vm.runInNewContext(`${app.slice(begin, finish)}
openAssignment`, context);
  await open();
  assert.equal(state.journeyOnly, true);
  assert.equal(state.assignment, assignment);
  assert.deepEqual(calls.filter(item => item.startsWith('/')), ['/assignments/open', '/student/journey-context']);
  assert.equal(calls.at(-1), 'identityView');
  assert.equal(elements.studentSelect.children.length, 2);
});

test('kết quả Test tự hiện sau khi hoàn tất và Writing cập nhật muộn', () => {
  const journey = {
    student: { name: 'Học viên giả' }, class: { name: 'Lớp giả' },
    summary: { attendedSessions: 0, submittedComplete: 0, availableReports: 0 },
    coverage: { schedule: 'teacher_confirmed', plannedSessions: 8, testResults: 'connected' },
    sessions: [{ sessionNumber: 7, assignmentId: null, sessionKind: 'test',
      dataOrigin: 'confirmed_plan', title: 'Buổi Test',
      testResult: { title: 'Term Test 2', listening: { correct: 30, total: 40, band: 7 },
        reading: { correct: 28, total: 40, band: 6.5 },
        writing: { status: 'pending', score: null } } }], reports: []
  };
  const ui = contextFor(journey);
  ui.renderIntegratedJourney(journey);
  const result = ui.elements.journeySessions.children[0];
  assert.match(result.children[0].children[1].textContent, /Đã có kết quả Test/);
  assert.match(result.children[2].children.map(child => child.textContent).join(' '), /Writing: đã nộp, đang chờ điểm/);
  journey.sessions[0].testResult.writing = { status: 'ready', score: 6.5 };
  ui.renderIntegratedJourney(journey);
  const refreshed = ui.elements.journeySessions.children[0];
  assert.match(refreshed.children[2].children.map(child => child.textContent).join(' '), /Writing: 6.5/);
  assert.match(ui.elements.journeyStatus.textContent, /điểm Writing có thể đến sau/);
});
