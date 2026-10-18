// Kiểm nhận diện Substitute từ roster thật của hợp đồng, dùng dữ liệu giả hoàn toàn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubstituteStudentIdentity } from '../shared/substitute-student-identity.js';
import { createStudentIdentityMemory } from '../shared/student-identity.js';
const a = { authority: 'erp-contact', id: '12345' }, b = { authority: 'erp-contact', id: '67890' };
const epoch = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const store = new Map(); let revision = 10000000;
  const memory = createStudentIdentityMemory({ getStorage: () => ({ getItem: key => store.get(key) || null,
    setItem: (key, value) => store.set(key, value) }), eventTarget: new EventTarget(),
  createRevision: () => String(++revision) });
  const history = { state: null, replaceState(state) { this.state = state; } };
  const create = options => createSubstituteStudentIdentity({ testSlug: 'substitute-test-1-k56', historyEpoch: epoch,
    memory, history, navigationType: 'navigate', ...options });
  return { memory, history, create };
}
test('Chỉ chọn đúng mã ERP trong roster có quyền, không ghép theo tên', () => {
  const f = fixture(); f.memory.remember(a, null);
  const adapter = f.create(), students = [{ ref: '99999', name: 'Trùng tên' }, { ref: a.id, name: 'Trùng tên' }];
  assert.equal(adapter.selectFromRoster('IC2264', students).student.ref, a.id);
  assert.equal(adapter.selectFromRoster('IC2264', [{ ref: b.id, name: 'Trùng tên' }]).status, 'missing');
  assert.equal(f.memory.read().identity.id, a.id);
});
test('Substitute là nơi đầu tiên: nhớ mã ERP; DEMO/mã tạm không biến thành người chính thức', () => {
  const f = fixture(), adapter = f.create();
  assert.equal(adapter.rememberSelected('DEMO', { ref: a.id }, f.memory.read()).status, 'demo');
  assert.equal(adapter.rememberSelected('IC2264', { ref: 'demo-1' }, f.memory.read()).status, 'invalid');
  assert.equal(adapter.rememberSelected('IC2264', { ref: a.id }, f.memory.read()).status, 'ok');
  assert.deepEqual(f.memory.read().identity, a);
});
test('Phản hồi roster đến sau đổi người không ghi A đè B', () => {
  const f = fixture(), adapter = f.create(), old = f.memory.read();
  f.memory.remember(b, null);
  assert.equal(adapter.rememberSelected('IC2264', { ref: a.id }, old).status, 'conflict');
  assert.deepEqual(f.memory.read().identity, b);
});
test('Tab mới không lấy lobby được sao chép; reload đúng tab giữ chủ/lịch sử/lượt', () => {
  const f = fixture(), adapter = f.create();
  const binding = { classCode: 'IC2264', studentRef: a.id, clientRunId: 'run-a' };
  assert.equal(adapter.mayRestore(binding), false);
  adapter.pin(binding);
  assert.equal(f.create({ navigationType: 'reload' }).mayRestore(binding), true);
  assert.equal(f.create().mayRestore({ ...binding, studentRef: b.id }), false);
  adapter.forget();
  assert.equal(f.create({ navigationType: 'reload' }).mayRestore(binding), false);
});
