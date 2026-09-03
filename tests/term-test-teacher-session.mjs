/* Nhận bộ nhớ và đồng hồ giả; kiểm tra khôi phục, hết hạn, cách ly và lỗi lưu.
 * Không dùng mã Google thật hoặc dữ liệu học viên; lỗi hiện bằng tên ca kiểm thử. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionStore, tokenExpiresAt } from '../term-tests/teacher/auth-session.js';

const now = 1_800_000_000_000;
const token = payload => ['fake', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'fake'].join('.');
const valid = token({ exp: now / 1000 + 3600 });

function fixture(overrides = {}) {
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key)
  };
  const options = { apiBaseUrl: 'https://example.invalid', clientId: 'fake-client', getStorage: () => storage, now: () => now, ...overrides };
  return { data, options, store: createSessionStore(options) };
}

test('khôi phục mã còn hạn khi tạo lại trang; chỉ lưu một mã, không lưu kết quả', () => {
  const { data, options, store } = fixture();
  assert.equal(store.save(valid), true);
  assert.equal(createSessionStore(options).read(), valid);
  assert.deepEqual([...data.values()], [valid]);
});

test('đăng xuất xóa phiên để tải lại trang không tự đăng nhập', () => {
  const { options, store, data } = fixture();
  store.save(valid);
  store.clear();
  assert.equal(createSessionStore(options).read(), '');
  assert.equal(data.size, 0);
});

test('xóa mã hết hạn hoặc chỉ còn dưới 10 giây', () => {
  const { store, options, data } = fixture();
  store.save(valid);
  const later = createSessionStore({ ...options, now: () => now + 3600_000 - 10_000 });
  assert.equal(later.read(), '');
  assert.equal(data.size, 0);
  assert.equal(store.save(token({ exp: now / 1000 - 1 })), false);
});

test('từ chối mã hỏng hoặc hạn dùng sai kiểu mà không làm vỡ trang', () => {
  const { store, options, data } = fixture();
  store.save(valid);
  const key = [...data.keys()][0];
  for (const invalid of ['broken', 'a.!.b', token({}), token({ exp: '9999999999' }), token({ exp: null })]) {
    data.set(key, invalid);
    assert.equal(createSessionStore(options).read(), '');
    assert.equal(data.size, 0);
    assert.equal(tokenExpiresAt(invalid), 0);
  }
});

test('không nối phiên sang API hoặc ứng dụng Google khác', () => {
  const { store, options } = fixture();
  store.save(valid);
  assert.equal(createSessionStore({ ...options, clientId: 'other' }).read(), '');
  assert.equal(createSessionStore({ ...options, apiBaseUrl: 'https://other.invalid' }).read(), '');
  assert.equal(store.read(), valid);
});

test('bộ nhớ bị chặn không ngăn dùng mã trong lượt đăng nhập hiện tại', () => {
  const { store } = fixture({ getStorage: () => { throw new Error('Storage blocked'); } });
  assert.equal(store.read(), '');
  assert.equal(store.save(valid), false);
  assert.equal(store.usable(valid), true);
  assert.doesNotThrow(() => store.clear());
});
