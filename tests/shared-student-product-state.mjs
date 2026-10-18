// Kiểm hành vi tách nháp bằng dữ liệu giả, không gọi API hoặc tải media.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentProductState } from '../shared/student-product-state.js';
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const base = 'izone-test:term-test-1:LOPTHU';
function store() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key) };
}
function fixture(options = {}) {
  const session = options.session || store(), local = options.local || store();
  const history = options.history || { state: null, replaceState(state) { this.state = state; } };
  return { session, local, history, create: overrides => createStudentProductState({ product: 'term-test-1',
    classCode: 'LOPTHU', getStorages: () => [session, local], history, navigationType: 'navigate', ...overrides }) };
}
test('Tab mới không tự nhận A từ local hoặc bản session do cửa sổ cha sao chép', () => {
  const f = fixture();
  for (const storage of [f.session, f.local]) storage.setItem(base, JSON.stringify({ studentRef: a, attemptToken: 'a', readingStartedAt: 'started', drafts: { a: 1 } }));
  assert.deepEqual(f.create().current().state, {});
  const bound = f.create().bind(b);
  assert.deepEqual(bound.state, {});
  assert.equal(bound.scope, `:student:${b}`);
  assert.equal(JSON.parse(f.local.getItem(base)).studentRef, a);
});
test('Tab A reload giữ A dù bộ nhớ chung/nháp cuối của người khác thay đổi', () => {
  const f = fixture(), first = f.create();
  const target = first.bind(a);
  f.local.setItem(target.keys.state, JSON.stringify({ studentRef: a, drafts: { writing: 'A' } }));
  const reloaded = f.create({ navigationType: 'reload' });
  assert.equal(reloaded.current().studentRef, a);
  assert.equal(reloaded.current().state.drafts.writing, 'A');
});
test('Reload tab cũ giữ khóa cũ; tab B dùng khóa riêng và không đè nháp A', () => {
  const f = fixture();
  const original = JSON.stringify({ studentRef: a, attemptToken: 'a', readingStartedAt: 'started', drafts: { writing: 'A' } });
  f.session.setItem(base, original); f.local.setItem(base, original);
  const active = f.create({ navigationType: 'reload' });
  assert.equal(active.current().scope, '');
  assert.equal(active.current().studentRef, a);
  const other = fixture({ local: f.local }).create();
  const target = other.bind(b);
  f.local.setItem(target.keys.state, JSON.stringify({ studentRef: b, drafts: { writing: 'B' } }));
  assert.equal(f.local.getItem(base), original);
  assert.equal(active.current().state.drafts.writing, 'A');
});
test('Chuyển nháp cũ chỉ khi cùng UUID, giữ bản gốc và ghi chú', () => {
  const f = fixture();
  const original = { studentRef: a, annotationRunId: 'run-a', drafts: { writing: 'Giữ bài A' } };
  f.local.setItem(base, JSON.stringify(original));
  f.local.setItem(base.replace('izone-test:', 'izone-test-annotations:'), JSON.stringify({ runId: 'run-a', records: ['A'] }));
  const bound = f.create().bind(a);
  assert.deepEqual(bound.state, original);
  assert.equal(JSON.parse(f.local.getItem(bound.keys.annotations)).records[0], 'A');
  assert.deepEqual(JSON.parse(f.local.getItem(base)), original);
});
test('Nháp đã tách không bị phiên cũ ghi đè; bỏ liên kết không xóa bài', () => {
  const f = fixture(), state = f.create(), target = state.bind(a);
  f.local.setItem(target.keys.state, JSON.stringify({ studentRef: a, drafts: { writing: 'Mới' } }));
  f.local.setItem(base, JSON.stringify({ studentRef: a, drafts: { writing: 'Cũ' } }));
  state.unbind();
  assert.deepEqual(state.current().state, {});
  assert.equal(state.bind(a).state.drafts.writing, 'Mới');
});
test('Bộ nhớ bị chặn vẫn giữ đúng chủ và dữ liệu gốc trả về, không trộn người', () => {
  const local = store();
  local.setItem(base, JSON.stringify({ studentRef: a, drafts: { writing: 'A' } }));
  const readonly = { getItem: local.getItem, setItem() { throw new Error('quota'); } };
  const state = fixture({ session: readonly, local: readonly }).create();
  assert.equal(state.bind(a).state.drafts.writing, 'A');
  assert.deepEqual(state.bind(b).state, {});
});
test('Đổi người rồi reload không tự nhập lại phiên cũ theo lớp', () => {
  const f = fixture();
  f.session.setItem(base, JSON.stringify({ studentRef: a, attemptToken: 'a', readingStartedAt: 'started' }));
  const old = f.create({ navigationType: 'reload' });
  assert.equal(old.current().studentRef, a);
  old.unbind();
  assert.equal(f.create({ navigationType: 'reload' }).current().studentRef, '');
});
test('Session sao chép của B không che nháp cũ và ghi chú A trong localStorage', () => {
  const f = fixture();
  f.session.setItem(base, JSON.stringify({ studentRef: b, drafts: { writing: 'B' } }));
  f.local.setItem(base, JSON.stringify({ studentRef: a, drafts: { writing: 'A' } }));
  const notes = base.replace('izone-test:', 'izone-test-annotations:');
  f.session.setItem(notes, JSON.stringify({ records: ['B'] }));
  f.local.setItem(notes, JSON.stringify({ records: ['A'] }));
  const own = f.create().bind(a);
  assert.equal(own.state.drafts.writing, 'A');
  assert.deepEqual(JSON.parse(f.local.getItem(own.keys.annotations)).records, ['A']);
  assert.equal(JSON.parse(f.session.getItem(base)).studentRef, b);
});
test('Khóa đã tách vẫn kiểm chủ ở từng nơi lưu, không để bản sai chủ che bản đúng', () => {
  const f = fixture(), state = f.create(), own = state.bind(a);
  f.session.setItem(own.keys.state, JSON.stringify({ studentRef: b, drafts: { writing: 'B' } }));
  f.local.setItem(own.keys.state, JSON.stringify({ studentRef: a, drafts: { writing: 'A' } }));
  assert.equal(state.current().state.drafts.writing, 'A');
});
