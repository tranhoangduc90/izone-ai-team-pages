import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Nhận trạng thái trình duyệt giả, chỉ xóa bản demo của đúng Substitute Test.
// Kiểm kết quả sau reset và lỗi lưu trữ; không ghi lên trình duyệt thật.
const read = number => readFileSync(new URL(`../term-tests/substitute-test-${number}-k56-computer-based/demo-reset.js`, import.meta.url), 'utf8');
function storage(entries) {
  const data = new Map(entries);
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key)
  };
}
function harness(number, blocked = false) {
  const slug = `substitute-test-${number}-k56`;
  const own = ['RETAKE-LOBBY', 'K56A', 'K56B', 'K56C'].flatMap(namespace =>
    ['izone-test:', 'izone-test-ui:', 'izone-test-annotations:'].map(prefix => `${prefix}${slug}:${namespace}:server-grade`));
  const unrelated = [`izone-test:substitute-test-${3 - number}-k56:K56A:server-grade`, 'unrelated'];
  const entries = [...own, ...unrelated].map(key => [key, 'synthetic']);
  const listeners = {};
  const dialogChildren = {};
  function element() {
    return {
      hidden: true, disabled: false,
      classList: { add() {} },
      setAttribute() {}, focus() {}, append() {},
      addEventListener(name, callback) { this.listeners ??= {}; this.listeners[name] = callback; },
      querySelector(selector) { return dialogChildren[selector] ??= element(); },
      showModal() { this.open = true; }, close() { this.open = false; }
    };
  }
  const root = element();
  root.querySelector = selector => selector === '.topbar' ? element() : null;
  const dialog = element();
  const body = { append() {} };
  const context = {
    window: { TERM_TEST_CONFIG: { slug, title: 'Bài thử' }, TERM_TEST_APP_CONFIG: { AUTH_MODE: 'online-demo' }, addEventListener(name, callback) { listeners[name] = callback; } },
    URL, URLSearchParams, Date, Math,
    location: { search: '?demo=exam&grading=server&class=K56A&demoStudent=x&demoAttempt=y', href: 'https://example.test/?demo=exam&grading=server&class=K56A&demoStudent=x&demoAttempt=y', replace(url) { context.replaced = url; } },
    history: { replaceState() {} },
    sessionStorage: storage(entries), localStorage: storage(entries),
    document: { getElementById: () => root, createElement(tag) { return tag === 'dialog' ? dialog : element(); }, body },
    MutationObserver: class { observe() {} }
  };
  if (blocked) context.sessionStorage.removeItem = () => { throw new Error('blocked'); };
  vm.runInNewContext(read(number), context);
  return { context, dialog, own, unrelated, listeners, confirm: () => dialog.querySelector('[data-reset-confirm]').listeners.click() };
}

for (const number of [1, 2]) {
  test(`Substitute K56 ${number}: reset chỉ xóa đúng bài, hai vùng lưu và URL`, () => {
    const h = harness(number);
    h.confirm();
    for (const storageArea of [h.context.sessionStorage, h.context.localStorage]) {
      for (const key of h.own) assert.equal(storageArea.getItem(key), null, key);
      for (const key of h.unrelated) assert.equal(storageArea.getItem(key), 'synthetic', key);
    }
    const next = new URL(h.context.replaced);
    for (const field of ['class', 'demoStudent', 'demoAttempt']) assert.equal(next.searchParams.has(field), false);
    assert.equal(next.searchParams.get('reset'), '1');
  });
  test(`Substitute K56 ${number}: storage bị chặn phải báo lỗi và không tải lại`, () => {
    const h = harness(number, true);
    h.confirm();
    assert.equal(h.context.replaced, undefined);
    assert.equal(h.dialog.querySelector('.k56-reset-error').hidden, false);
    assert.equal(h.dialog.querySelector('[data-reset-confirm]').disabled, false);
  });
  test(`Substitute K56 ${number}: reset từ tab khác cũng xóa bản cũ`, () => {
    const h = harness(number);
    const key = `izone-demo-reset:substitute-test-${number}-k56:RETAKE-LOBBY:server-grade`;
    h.listeners.storage({ key, newValue: '1' });
    for (const ownKey of h.own) assert.equal(h.context.sessionStorage.getItem(ownKey), null, ownKey);
  });
}
