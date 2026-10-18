// Kiểm bộ nối Test dùng chung: không nhớ trước phiên, giữ nháp và bỏ kết quả cũ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentIdentityMemory } from '../shared/student-identity.js';
import { createTestStudentIdentity } from '../shared/test-student-identity.js';
const refA = '11111111-1111-4111-8111-111111111111';
const refB = '22222222-2222-4222-8222-222222222222';
const a = { authority: 'erp-contact', id: '12345' }, b = { authority: 'erp-contact', id: '67890' };
function fixture(requestIdentity) {
  const values = new Map(); let revision = 10000000;
  const store = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const memory = createStudentIdentityMemory({ getStorage: () => store, eventTarget: new EventTarget(), createRevision: () => String(++revision) });
  const history = { state: null, replaceState(state) { this.state = state; } };
  const resolve = input => ({ ok: true, status: 'unique', identity: input.identity || (input.studentRef === refB ? b : a),
    aliases: [{ classId: '111', classCode: 'IC2264', studentRef: input.identity?.id === b.id || input.studentRef === refB ? refB : refA,
      studentName: 'Học viên thử' }] });
  const bridge = createTestStudentIdentity({ product: 'term-test-2-k56', classCode: 'IC2264', memory, history,
    getStorages: () => [store], navigationType: 'navigate', requestIdentity: requestIdentity || (async input => resolve(input)) });
  return { bridge, memory, store, resolve };
}
test('Tra mã song song nhưng chỉ nhớ ERP sau khi caller xác nhận phiên hợp lệ', async () => {
  const f = fixture(); f.bridge.select({ ref: refA });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(f.memory.read().status, 'empty');
  assert.equal((await f.bridge.prepared(refA)).status, 'ok');
  assert.deepEqual(f.memory.read().identity, a);
});
test('Đã nhớ từ nơi khác chọn đúng người mà không đổi dấu danh tính hoặc nhớ token', async () => {
  const f = fixture(), snapshot = f.memory.remember(a, null);
  const result = await f.bridge.resolveRemembered();
  assert.equal(result.student.ref, refA);
  f.bridge.select(result.student, { resolution: result.resolution });
  await f.bridge.prepared(refA);
  assert.equal(f.memory.read().revision, snapshot.revision);
});
test('Quên trong lúc tra mã: kết quả cũ không nhập lại A', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(async input => { await gate; return f.resolve(input); });
  f.bridge.select({ ref: refA });
  const waiting = f.bridge.prepared(refA);
  assert.equal(f.bridge.forget().status, 'empty');
  release(); assert.equal((await waiting).status, 'changed');
  assert.equal(f.memory.read().status, 'empty');
});
test('Chuyển sang B sau phiên A: bài A vẫn còn trong khóa riêng', async () => {
  const f = fixture(), ownA = f.bridge.select({ ref: refA });
  f.store.setItem(ownA.keys.state, JSON.stringify({ studentRef: refA, drafts: { writing: 'Giữ A' } }));
  await f.bridge.prepared(refA); f.bridge.forget();
  const ownB = f.bridge.select({ ref: refB });
  assert.deepEqual(ownB.state, {});
  await f.bridge.prepared(refB);
  assert.equal(f.memory.read().identity.id, b.id);
  assert.equal(JSON.parse(f.store.getItem(ownA.keys.state)).drafts.writing, 'Giữ A');
});
test('Bộ nhớ chung đã đổi ở nơi khác khi phiên A trả về: không ghi A đè B', async () => {
  const f = fixture(); f.bridge.select({ ref: refA });
  f.memory.remember(b, null);
  assert.equal((await f.bridge.prepared(refA)).status, 'conflict');
  assert.equal(f.memory.read().identity.id, b.id);
});
test('Bỏ ghi nhớ vẫn quên người cũ sau phiên hợp lệ dù nguồn quy đổi mã lỗi', async () => {
  const f = fixture(async () => { throw new Error('Fixture lookup offline'); });
  f.memory.remember(a, null);
  f.bridge.select({ ref: refB }, { remember: false });
  assert.equal((await f.bridge.prepared(refB)).status, 'empty');
  assert.equal(f.memory.read().identity, null);
});
