// Kiểm hợp đồng quy đổi/caller, phản hồi muộn và gộp yêu cầu. Chưa thay kiểm UI thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentIdentityMemory } from '../shared/student-identity.js';
import { createStudentIdentityClient, selectStudentIdentityAlias } from '../shared/student-identity-client.js';

const alice = { authority: 'erp-contact', id: '12345' }, bob = { authority: 'erp-contact', id: '67890' };
const ref = '11111111-1111-4111-8111-111111111111';
const alias = { classId: '111', classCode: 'LOPTHU', studentRef: ref, studentName: 'Học viên thử' };
const result = (identity = alice, aliases = [alias]) => ({ ok: true, status: 'unique', identity, aliases });
function fixture(requestIdentity) {
  const values = new Map(); let revision = 0;
  const memory = createStudentIdentityMemory({ getStorage: () => ({
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }), eventTarget: null, createRevision: () => `revision_${++revision}` });
  return { memory, client: createStudentIdentityClient({ memory, requestIdentity }) };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('Đã nhớ gửi mã ERP tới API, chọn đúng lớp và không đổi bản nhớ sau đọc', async () => {
  const requests = [], f = fixture(async body => { requests.push(body); return result(); });
  const saved = f.memory.remember(alice, null);
  const resolved = await f.client.resolveRemembered({ classHint: ' lopthu ' });
  assert.deepEqual(requests, [{ identity: alice, classCode: 'LOPTHU' }]);
  assert.deepEqual(selectStudentIdentityAlias(resolved, { classHint: 'LOPTHU' }), { status: 'unique', alias });
  assert.equal(f.client.isCurrent(resolved), true);
  assert.deepEqual(f.memory.read(), saved);
});

test('Chọn người lần đầu học được mã ERP từ máy chủ, không tự ghép bằng tên', async () => {
  const f = fixture(async body => { assert.deepEqual(body, { studentRef: ref, classCode: 'LOPTHU' }); return result(); });
  const snapshot = f.client.captureSelection();
  assert.equal((await f.client.rememberSelection({ studentRef: ref, classHint: 'LOPTHU' }, snapshot)).status, 'ok');
  assert.deepEqual(f.memory.read().identity, alice);
});

test('Tra mã song song với mở bài không ghi nhớ trước khi caller xác nhận phiên hợp lệ', async () => {
  const f = fixture(async () => result());
  const snapshot = f.client.captureSelection();
  const resolved = await f.client.resolveSelection({ studentRef: ref });
  assert.equal(f.memory.read().status, 'empty');
  assert.equal(f.client.rememberResolvedSelection(resolved, snapshot).status, 'ok');
  assert.deepEqual(f.memory.read().identity, alice);
});

test('Phép tra đã xong nhưng mở phiên A chậm vẫn không ghi đè B được chọn trong lúc chờ', async () => {
  const f = fixture(async () => result());
  const snapshot = f.client.captureSelection();
  const resolved = await f.client.resolveSelection({ studentRef: ref });
  f.memory.remember(bob, null);
  assert.equal(f.client.rememberResolvedSelection(resolved, snapshot).status, 'conflict');
  assert.deepEqual(f.memory.read().identity, bob);
});

test('Đang mở A mà tab khác chọn B: kết quả đọc cũ không được áp vào màn mới', async () => {
  const waiting = deferred(), f = fixture(() => waiting.promise);
  const a = f.memory.remember(alice, null);
  const pending = f.client.resolveRemembered();
  f.memory.remember(bob, a.revision);
  waiting.resolve(result());
  assert.equal((await pending).status, 'changed');
  assert.deepEqual(f.memory.read().identity, bob);
});

test('Mở bài lần đầu A chậm: kết quả ghi nhớ không ghi đè B đã được chọn sau đó', async () => {
  const waiting = deferred(), f = fixture(() => waiting.promise);
  const snapshot = f.client.captureSelection();
  const pending = f.client.rememberSelection({ studentRef: ref }, snapshot);
  f.memory.remember(bob, null);
  waiting.resolve(result());
  assert.equal((await pending).status, 'conflict');
  assert.deepEqual(f.memory.read().identity, bob);
  assert.equal((await f.client.rememberSelection({ studentRef: ref })).status, 'invalid');
});

test('Một người có nhiều lớp: phải khớp ngữ cảnh hoặc danh sách lớp được phép', () => {
  const other = { ...alias, classId: '222', classCode: 'LOPKHAC', studentRef: '22222222-2222-4222-8222-222222222222' };
  const resolved = result(alice, [alias, other]);
  assert.equal(selectStudentIdentityAlias(resolved).status, 'ambiguous');
  assert.deepEqual(selectStudentIdentityAlias(resolved, { allowedClassCodes: ['lopkhac'] }).alias, other);
  assert.equal(selectStudentIdentityAlias(resolved, { allowedClassCodes: [] }).status, 'missing');
  assert.equal(selectStudentIdentityAlias(resolved, { classHint: 'LOPKHAC', studentRef: ref }).status, 'missing');
});

test('API trả sai người hoặc sai UUID đã chọn bị chặn, không xóa người đang nhớ', async () => {
  const f = fixture(async () => result(bob));
  f.memory.remember(alice, null);
  await assert.rejects(f.client.resolveRemembered(), error => error.code === 'IDENTITY_SOURCE_INVALID');
  assert.deepEqual(f.memory.read().identity, alice);
  const wrongRef = fixture(async () => result(alice, [{ ...alias, studentRef: '22222222-2222-4222-8222-222222222222' }]));
  await assert.rejects(wrongRef.client.rememberSelection({ studentRef: ref }, wrongRef.client.captureSelection()),
    error => error.code === 'IDENTITY_SOURCE_INVALID');
  assert.equal(wrongRef.memory.read().status, 'empty');
});

test('Lượt đọc giống nhau cùng chờ một yêu cầu; sau hoàn tất phải đọc mới', async () => {
  const waiting = deferred(); let calls = 0;
  const f = fixture(() => { calls++; return calls === 1 ? waiting.promise : result(); });
  f.memory.remember(alice, null);
  const a = f.client.resolveRemembered(), b = f.client.resolveRemembered();
  await Promise.resolve(); assert.equal(calls, 1);
  waiting.resolve(result());
  assert.deepEqual((await Promise.all([a, b])).map(value => value.status), ['unique', 'unique']);
  await f.client.resolveRemembered(); assert.equal(calls, 2);
});

test('Lỗi nguồn không bị giữ trong bộ gộp; lần thử lại vẫn kiểm mới và không mất danh tính', async () => {
  let calls = 0;
  const f = fixture(async () => { if (++calls === 1) throw new Error('source offline'); return result(); });
  f.memory.remember(alice, null);
  await assert.rejects(f.client.resolveRemembered(), /source offline/);
  assert.equal((await f.client.resolveRemembered()).status, 'unique');
  assert.equal(calls, 2); assert.deepEqual(f.memory.read().identity, alice);
});

test('Bộ nhớ trống không gọi API; missing/ambiguous giữ đúng trạng thái, không tự quên người', async () => {
  let calls = 0, status = 'missing';
  const f = fixture(async () => { calls++; return { ok: true, status, identity: null, aliases: [] }; });
  assert.equal((await f.client.resolveRemembered()).status, 'empty'); assert.equal(calls, 0);
  f.memory.remember(alice, null);
  assert.equal((await f.client.resolveRemembered()).status, 'missing');
  status = 'ambiguous';
  assert.equal((await f.client.resolveRemembered()).status, 'ambiguous');
  assert.deepEqual(f.memory.read().identity, alice);
});
