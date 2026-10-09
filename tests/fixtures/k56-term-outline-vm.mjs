import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Nhận source thật, chỉ thay DOM/storage/HTTP bằng dụng cụ quan sát không ghi ra ngoài.
// Chạy nguyên initializer và helper Writing; lỗi hợp đồng hiện thành assertion có tên ca.
export function fixture(source, restored = {}) {
  const initializerStart = source.indexOf('  const state = {');
  const initializerEnd = source.indexOf('  function readSession()', initializerStart);
  const saveStart = source.indexOf('  function saveSession()');
  const saveEnd = source.indexOf('  // Nhận deadline Listening', saveStart);
  const outlineStart=source.indexOf('  function serverWritingOutlineSupported(');
  const bodyStart = outlineStart >= 0 ? outlineStart : source.indexOf('  function writingSnapshot(');
  const bodyEnd = source.indexOf('  function scheduleWritingSave(', bodyStart);
  for (const [start, end] of [[initializerStart, initializerEnd], [saveStart, saveEnd], [bodyStart, bodyEnd]]) {
    assert.ok(start >= 0 && end > start, 'Không lấy được block Writing thật; không chạy fixture thay thế.');
  }
  const requests = [], scheduled = [], statuses = [], storage = new Map();
  const node = () => ({ hidden: true, disabled: false, dataset: {}, children: [],
    append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; },
    setAttribute(name, value) { this[name] = value; } });
  const elements = { writingView: node(), writingRecovery: node(), writingRecoveryDrafts: node(),
    writingConflict: node(), writingConflictDrafts: node(), writingKeepLocal: node() };
  let transport = () => ({ ok: true, writing: { accepted: true, revision: 6,
    task1: 'local task 1', task2: 'local task 2', started: true, submitted: false, reason: 'saved' } });
  const context = vm.createContext({ console, elements, restoredSessionSlug: restored.testSlug || 'term-test-1-k56',
    document: { createElement: node },
    window: { clearTimeout() {}, setTimeout() { return 1; } },
    sessionStorage: { setItem(key, value) { storage.set(key, value); } },
    localStorage: { setItem(key, value) { storage.set(key, value); } },
    syncWritingEditors() {}, setWritingSaveStatus(message) { statuses.push(message); },
    showNotice() {}, randomDelay() { return 5000; },
    scheduleWritingSave(delay) { scheduled.push(delay); },
    async apiRequest(path, options) {
      const request = { path, body: JSON.parse(options.body) }; requests.push(request);
      const response = await transport(request, requests.length);
      return response;
    }
  });
  const initial = { studentRef: 'synthetic-student', attemptToken: '00000000-0000-4000-8000-000000000002',
    writingRevision: 3, writingServerRevision: 5, writingStarted: true, writingDirty: true,
    writingConfirmedDraft: { task1: 'previous task 1', task2: 'previous task 2' },
    drafts: { writing: { outline: 'local outline', task1: 'local task 1', task2: 'local task 2' } }, ...restored };
  vm.runInContext(`
    const testConfig={slug: restoredSessionSlug};
    const classCode = 'FIXTURE', writingConfig = {tasks:[{id:'task1'},{id:'task2'}]}, demoMode = '';
    const paperMini=false,paperConfirmed=false;
    const storageKey = 'fixture-writing', restoredSession = ${JSON.stringify(initial)};
    let writingSaveTimer = 0, writingForceSaveTimer = 0, writingRetryTimer = 0;
    let writingSavePromise = Promise.resolve();
    ${source.slice(initializerStart, initializerEnd)}
    ${source.slice(saveStart, saveEnd)}
    ${source.slice(bodyStart, bodyEnd)}
  `, context);
  return { requests, scheduled, statuses, elements,
    run(code) { return vm.runInContext(code, context); },
    state() { return JSON.parse(vm.runInContext('JSON.stringify(state)', context)); },
    persisted() { return JSON.parse(storage.get('fixture-writing')); },
    reply(value) { transport = () => value; }, transport(value) { transport = value; },
    async dispatched(count = 1) {
      for (let i = 0; i < 30 && requests.length < count; i++) await new Promise(resolve => setImmediate(resolve));
      assert.equal(requests.length, count, 'Request chưa được dispatch đúng thứ tự.');
    }
  };
}
