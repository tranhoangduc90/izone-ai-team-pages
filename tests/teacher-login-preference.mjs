/*
 * Dùng kho giả để kiểm lựa chọn tự đăng nhập; không tạo mã Google hay dữ liệu lớp.
 * Khi kho bị chặn, giao diện cần biết rằng lựa chọn chưa được lưu hoặc xóa.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeacherLoginPreference } from '../shared/teacher-login-preference.js';

test('chỉ lưu cờ cho phép và xóa cờ khi đăng xuất', () => {
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key)
  };
  const preference = createTeacherLoginPreference(() => storage);
  assert.equal(preference.read(), false);
  assert.equal(preference.set(true), true);
  assert.equal(createTeacherLoginPreference(() => storage).read(), true);
  assert.deepEqual([...data.values()], ['1']);
  assert.equal(preference.set(false), true);
  assert.equal(data.size, 0);
});

test('báo thất bại nếu trình duyệt chặn lưu hoặc xóa lựa chọn', () => {
  const blocked = createTeacherLoginPreference(() => { throw new Error('blocked'); });
  assert.equal(blocked.read(), false);
  assert.equal(blocked.set(true), false);
  assert.equal(blocked.set(false), false);
  const cannotDelete = createTeacherLoginPreference(() => ({
    getItem: () => '1',
    removeItem: () => {}
  }));
  assert.equal(cannotDelete.set(false), false);
});
