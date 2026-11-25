import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mountAssignmentWaiting } from '../term-tests/substitute-assignment-full/assignment-browser.mjs';
import { adoptFullAdmissionRun } from '../term-tests/substitute-assignment-full/assignment-student-entry.mjs';

const provisional = '11111111-1111-4111-8111-111111111111';
const official = '22222222-2222-4222-8222-222222222222';

test('chỉ chuyển khóa sang mã chính thức khi đang chuẩn bị đúng lượt', async () => {
  const actions = [];
  const parameters = {
    clientRunId: official, currentRunId: provisional, parallel: true, isCurrent: () => true,
    release: runId => actions.push(['release', runId]),
    acquire: async runId => { actions.push(['acquire', runId]); return true; },
  };
  await adoptFullAdmissionRun(parameters);
  assert.deepEqual(actions, [['release', provisional], ['acquire', official]]);
  actions.length = 0;
  await adoptFullAdmissionRun({ ...parameters, currentRunId: official });
  await adoptFullAdmissionRun({ ...parameters, parallel: false });
  await assert.rejects(adoptFullAdmissionRun({ ...parameters, clientRunId: 'invalid' }), /ASSIGNMENT_RUN_INVALID/);
  await assert.rejects(adoptFullAdmissionRun({ ...parameters, isCurrent: () => false }), /ASSIGNMENT_SELECTION_CHANGED/);
  assert.deepEqual(actions, []);
  await assert.rejects(adoptFullAdmissionRun({ ...parameters, acquire: async () => false }), /ASSIGNMENT_RUN_IN_ANOTHER_TAB/);
  assert.deepEqual(actions, [['release', provisional]]);
});

test('nếu đổi người trong lúc chờ khóa, chỉ giải phóng khóa vừa lấy', async () => {
  let current = true;
  const released = [];
  await assert.rejects(adoptFullAdmissionRun({
    clientRunId: official, currentRunId: provisional, parallel: true, isCurrent: () => current,
    release: runId => released.push(runId),
    acquire: async () => { current = false; return true; },
  }), /ASSIGNMENT_SELECTION_CHANGED/);
  assert.deepEqual(released, [provisional, official]);
});

async function waiting(t, start) {
  t.mock.method(globalThis, 'setTimeout', () => 0);
  const original = globalThis.document;
  globalThis.document = { hidden: false, createElement: () => ({ setAttribute() {} }) };
  t.after(() => {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  const target = { replaceChildren(message, button) { Object.assign(this, { message, button }); } };
  const scope = { sittingId: 'window-fixture', testId: 'test-fixture', classCode: 'IC99001', studentRef: '99999911' };
  const errors = [];
  let status = { state: 'assigned', canStart: true };
  const stop = await mountAssignmentWaiting(target, {
    api: async route => route === 'student/join' ? { token: 'fixture' } : status,
    scope, start, keepMonitoring: true, requirePrepared: true, onPreparationError: code => errors.push(code),
    storage: { getItem: () => null, setItem() {} },
  });
  t.after(stop);
  return { ...target, errors, setStatus(value) { status = value; } };
}

test('lần chuẩn bị thất bại có thể thử lại bằng đúng phiên chờ', async t => {
  const sessions = [];
  const ui = await waiting(t, async session => {
    sessions.push(session);
    return sessions.length === 2;
  });
  await ui.button.onclick();
  assert.match(ui.message.textContent, /Chưa chuẩn bị được bài/);
  assert.equal(ui.button.textContent, 'Thử chuẩn bị lại');
  assert.equal(ui.button.disabled, false);
  await ui.button.onclick();
  assert.equal(ui.message.textContent, 'Đã chuẩn bị bài');
  assert.equal(ui.button.disabled, true);
  assert.deepEqual(sessions[0], sessions[1]);
  assert.deepEqual(ui.errors, ['ASSIGNMENT_PREPARATION_INCOMPLETE']);
});

test('phản hồi đọc ca đang mở giữ thông báo sai thiết bị', async t => {
  const ui = await waiting(t, async () => { throw Error('DEVICE_MISMATCH'); });
  await ui.button.onclick();
  assert.match(ui.message.textContent, /thiết bị khác/);
  assert.equal(ui.button.disabled, true);
  assert.deepEqual(ui.errors, ['DEVICE_MISMATCH']);
});

test('ca đóng trong lúc chuẩn bị sẽ khóa thử lại', async t => {
  const ui = await waiting(t, async () => {
    ui.setStatus({ state: 'assigned', canStart: false, sittingClosed: true });
    throw Error('SITTING_CLOSED');
  });
  await ui.button.onclick();
  assert.equal(ui.message.textContent, 'Ngoài giờ thi');
  assert.equal(ui.button.disabled, true);
});
