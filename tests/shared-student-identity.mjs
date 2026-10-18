// Kiểm hợp đồng bộ nhớ thật qua interface công khai bằng kho giả, không gọi API/audio.
// Các ca bảo vệ mã bigint, chuyển người, phản hồi muộn và nháp ngoài khóa nhận diện.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStudentIdentityMemory, normalizeStudentIdentity, STUDENT_IDENTITY_KEY,
} from '../shared/student-identity.js';

const alice = { authority: 'erp-contact', id: '12345' };
const bob = { authority: 'erp-contact', id: '67890' };
const now = Date.parse('2026-10-18T01:00:00.000Z');
function fixture() {
  const values = new Map([['draft:alice:term1', 'nháp của A'], ['legacy:student', 'mã cũ']]);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  let version = 0;
  const target = new EventTarget();
  const memory = () => createStudentIdentityMemory({ getStorage: () => storage,
    eventTarget: target, clock: () => now, createRevision: () => `revision_${++version}` });
  return { values, storage, target, memory };
}

test('Các sản phẩm cùng bộ nhớ nhận đúng một người, không lưu tên hoặc mã phiên', () => {
  const f = fixture(), speaking = f.memory(), term = f.memory(), substitute = f.memory();
  assert.equal(speaking.read().status, 'empty');
  const saved = speaking.remember({ ...alice, studentName: 'Không lưu tên này', attemptToken: 'không lưu mã phiên' }, null);
  assert.equal(saved.status, 'ok');
  assert.deepEqual(term.read().identity, alice);
  assert.deepEqual(substitute.read().identity, alice);
  const stored = JSON.parse(f.values.get(STUDENT_IDENTITY_KEY));
  assert.deepEqual(Object.keys(stored).sort(), ['identity', 'revision', 'updatedAt', 'version']);
  assert.deepEqual(stored.identity, alice);
  assert.equal(stored.updatedAt, '2026-10-18T01:00:00.000Z');
  assert.equal(f.values.get('draft:alice:term1'), 'nháp của A');
});

test('Hai mã ERP lớn liền nhau vẫn là hai người khác nhau', () => {
  const f = fixture(), memory = f.memory();
  const first = memory.remember({ authority: 'erp-contact', id: '9007199254740992' }, null);
  const second = memory.remember({ authority: 'erp-contact', id: '9007199254740993' }, first.revision);
  assert.equal(second.identity.id, '9007199254740993');
  assert.equal(memory.isCurrent(first), false);
  assert.equal(memory.isCurrent(second), true);
  assert.deepEqual(normalizeStudentIdentity({ authority: 'erp-contact', id: '9223372036854775807' }),
    { authority: 'erp-contact', id: '9223372036854775807' });
});

test('Mã tạm, UUID theo bài, số sai nguồn hoặc vượt bigint không ghi đè người đang nhớ', () => {
  const f = fixture(), memory = f.memory(), initial = memory.remember(alice, null);
  const invalid = [null, {}, { ...bob, authority: 'mapping-uuid' },
    ...['0', '-5', '0001', ' 12345', '1.5', '1e5', '9223372036854775808',
      '11111111-1111-4111-8111-111111111111', 12345].map(id => ({ authority: 'erp-contact', id }))];
  for (const value of invalid) {
    assert.equal(memory.remember(value, initial.revision).status, 'invalid');
    assert.deepEqual(memory.read(), initial);
  }
});

test('Đọc JSON hỏng hoặc sai phiên bản báo invalid và không tự xóa dữ liệu', () => {
  const f = fixture(), memory = f.memory();
  for (const raw of ['{bad', 'null', '[]', JSON.stringify({ version: 2, identity: alice }),
    JSON.stringify({ version: 1, identity: alice, revision: 'revision_1', updatedAt: '2026-10-18T08:00:00+07:00' })]) {
    f.values.set(STUDENT_IDENTITY_KEY, raw);
    assert.equal(memory.read().status, 'invalid');
    assert.equal(f.values.get(STUDENT_IDENTITY_KEY), raw);
  }
  assert.equal(memory.remember(alice, null).status, 'ok');
});

test('Phản hồi A đến muộn không ghi đè B vừa được chọn ở sản phẩm khác', () => {
  const f = fixture(), firstTab = f.memory(), secondTab = f.memory();
  const initial = firstTab.remember(alice, null);
  const changed = secondTab.remember(bob, initial.revision);
  assert.equal(changed.status, 'ok');
  assert.equal(firstTab.remember(alice, initial.revision).status, 'conflict');
  assert.deepEqual(firstTab.read().identity, bob);
  assert.equal(firstTab.isCurrent(initial), false);
  assert.equal(f.values.get('draft:alice:term1'), 'nháp của A');
});

test('Hai lần chọn đầu xuất phát từ cùng bộ nhớ trống không âm thầm ghi đè nhau', () => {
  const f = fixture(), a = f.memory(), b = f.memory();
  const snapshot = b.read();
  assert.equal(a.remember(alice, null).status, 'ok');
  assert.equal(b.remember(bob, snapshot.revision).status, 'conflict');
  assert.deepEqual(b.read().identity, alice);
});

test('Quên người chỉ bỏ danh tính, giữ dấu đổi và không xóa B bằng thao tác cũ của A', () => {
  const f = fixture(), memory = f.memory();
  const initial = memory.remember(alice, null);
  const changed = memory.remember(bob, initial.revision);
  assert.equal(memory.forget(initial.revision).status, 'conflict');
  assert.deepEqual(memory.read().identity, bob);
  const forgotten = memory.forget(changed.revision);
  assert.equal(forgotten.status, 'empty');
  assert.equal(JSON.parse(f.values.get(STUDENT_IDENTITY_KEY)).identity, null);
  assert.notEqual(forgotten.revision, changed.revision);
  assert.equal(f.values.get('draft:alice:term1'), 'nháp của A');
  assert.equal(f.values.get('legacy:student'), 'mã cũ');
});

test('Bộ nhớ bị chặn trả unavailable; không giả vờ đã nhớ hoặc đã quên', () => {
  const memory = createStudentIdentityMemory({ getStorage() { throw new Error('blocked'); }, eventTarget: null });
  assert.equal(memory.read().status, 'unavailable');
  assert.equal(memory.remember(alice, null).status, 'unavailable');
  assert.equal(memory.forget(null).status, 'unavailable');
});

test('Quên người học khi bộ nhớ chưa có danh tính vẫn chặn phản hồi đăng nhập cũ', () => {
  const f = fixture(), memory = f.memory();
  const beforeLogin = memory.read();
  assert.equal(memory.forget(beforeLogin.revision).status, 'empty');
  // Học viên đã đổi ý trong lúc lần đăng nhập đầu còn chờ; kết quả A về sau không được nhớ A.
  assert.equal(memory.remember(alice, beforeLogin.revision).status, 'conflict');
  assert.equal(memory.read().status, 'empty');
});

test('Hết dung lượng ghi không thay đổi người đã nhớ hoặc nháp', () => {
  const f = fixture(), memory = f.memory(), initial = memory.remember(alice, null);
  f.storage.setItem = () => { throw new Error('quota'); };
  assert.equal(memory.remember(bob, initial.revision).status, 'unavailable');
  assert.deepEqual(memory.read().identity, alice);
  assert.equal(f.values.get('draft:alice:term1'), 'nháp của A');
});

test('Đọc lại phát hiện kho bỏ qua lần ghi, không báo đã ghi thành công', () => {
  const f = fixture(), memory = f.memory();
  f.storage.setItem = () => {};
  assert.equal(memory.remember(alice, null).status, 'conflict');
  assert.equal(memory.read().status, 'empty');
});

test('Ghi hoặc quên phải có dấu danh tính trước thao tác; không có đường ghi đè vô điều kiện', () => {
  const f = fixture(), memory = f.memory();
  assert.equal(memory.remember(alice).status, 'invalid');
  const saved = memory.remember(alice, null);
  assert.equal(memory.forget().status, 'invalid');
  assert.deepEqual(memory.read(), saved);
});

test('Các phần cùng tab nhận thay đổi; sự kiện tab khác được lọc và có thể ngừng theo dõi', () => {
  const f = fixture(), a = f.memory(), b = f.memory(), seen = [];
  const stop = b.subscribe(value => seen.push(value));
  const saved = a.remember(alice, null);
  assert.deepEqual(seen.map(value => value.identity?.id), [alice.id]);
  const other = new Event('storage');
  Object.defineProperty(other, 'key', { value: 'draft:alice:term1' });
  f.target.dispatchEvent(other);
  assert.equal(seen.length, 1);
  const external = new Event('storage');
  Object.defineProperty(external, 'key', { value: STUDENT_IDENTITY_KEY });
  f.target.dispatchEvent(external);
  assert.equal(seen.length, 2);
  stop();
  a.remember(bob, saved.revision);
  assert.equal(seen.length, 2);
});
