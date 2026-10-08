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
  const bodyStart = source.indexOf('  function writingSnapshot(');
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
  const context = vm.createContext({ console, elements,
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
      // API Mini mới trả dàn ý riêng; fixture cũ chỉ khai báo hai Task được bổ sung field canonical.
      if (source.includes("outline: String(value?.outline") && response?.writing
        && !Object.hasOwn(response.writing, 'outline')) response.writing.outline = 'local outline';
      return response;
    }
  });
  const initial = { studentRef: 'synthetic-student', attemptToken: '00000000-0000-4000-8000-000000000002',
    writingRevision: 3, writingServerRevision: 5, writingStarted: true, writingDirty: true,
    writingConfirmedDraft: { task1: 'previous task 1', task2: 'previous task 2' },
    drafts: { writing: { outline: 'local outline', task1: 'local task 1', task2: 'local task 2' } }, ...restored };
  vm.runInContext(`
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
function canonical(overrides = {}) {
  return { revision: 6, outline: 'local outline', task1: 'server task 1', task2: 'server task 2', started: true, submitted: false, ...overrides };
}

// Kỳ vọng lấy từ hợp đồng độc lập: server version khác local counter, chỉ ACK đúng hai Task.
// Mỗi client dùng source riêng; ca lỗi phải giữ cả bài local và dàn ý, không tự vượt conflict.
export function registerWritingRevisionContract({ name, sourcePath, cachePaths }) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const title = value => `${name}: ${value}`;
  test(title('payload tách local revision và base máy chủ, giữ hai Task/dàn ý'), () => {
    const h = fixture(source);
    for (const action of ['start', 'draft', 'submit']) {
      const payload = JSON.parse(h.run(`JSON.stringify(writingPayload('${action}'))`));
      assert.deepEqual(payload, { attemptToken: '00000000-0000-4000-8000-000000000002', revision: 3,
        baseRevision: 5, action, outline: 'local outline', task1: 'local task 1', task2: 'local task 2' });
    }
  });
  test(title('restore version không lùi, không đổi local counter hoặc mất dàn ý'), () => {
    const h = fixture(source);
    h.run(`applyWritingFromServer(${JSON.stringify(canonical({ revision: 12 }))},true)`);
    h.run(`applyWritingFromServer(${JSON.stringify(canonical({ revision: 4, task1: 'older 1', task2: 'older 2' }))},true)`);
    assert.equal(h.state().writingServerRevision, 12); assert.equal(h.state().writingRevision, 3);
    assert.deepEqual(h.state().drafts.writing, { outline: 'local outline', task1: 'server task 1', task2: 'server task 2' });
  });
  test(title('legacy dirtyfalse Task2 khác server giữ local và tạo conflict'), () => {
    const h = fixture(source, { writingDirty: false, writingConfirmedDraft: null,
      drafts: { writing: { outline: 'outline kept', task1: '', task2: 'local task 2' } } });
    h.run(`applyWritingFromServer(${JSON.stringify(canonical({ revision: 5, task1: '', task2: '' }))})`);
    assert.deepEqual(h.state().drafts.writing, { outline: 'outline kept', task1: '', task2: 'local task 2' });
    assert.equal(h.state().writingDirty, true); assert.equal(h.state().writingConflict.revision, 5);
  });
  test(title('conflict giữ cả hai Task, không tự ACK/rebase; người học mới chọn tiếp tục'), async () => {
    const h = fixture(source); h.reply({ ok: true, writing: canonical({ revision: 9, accepted: false, reason: 'revision_conflict' }) });
    await h.run("saveWritingToServer('draft')");
    assert.deepEqual(h.state().drafts.writing, { outline: 'local outline', task1: 'local task 1', task2: 'local task 2' });
    assert.equal(h.state().writingServerRevision, 5); assert.equal(h.state().writingConflict.revision, 9);
    assert.equal(h.state().writingDirty, true); assert.equal(h.scheduled.length, 0);
    await assert.rejects(h.run("saveWritingToServer('draft')"), { code: 'WRITING_REVISION_CONFLICT' });
    assert.equal(h.requests.length, 1);
    h.run('resolveWritingConflict(false)');
    assert.equal(h.state().writingServerRevision, 9); assert.equal(h.state().writingRevision, 4);
    assert.equal(h.state().writingConflict, null); assert.equal(h.state().drafts.writing.task2, 'local task 2');
    assert.ok(h.state().writingRecovery.some(item => item.outline === 'local outline'
      && item.task1 === 'local task 1' && item.task2 === 'local task 2'));
    assert.ok(h.state().writingRecovery.some(item => item.task1 === 'server task 1' && item.task2 === 'server task 2'));
  });
  test(title('missing/invalid ACK hoặc sai Task bị từ chối, không sửa local'), async t => {
    const valid = { accepted: true, revision: 6, task1: 'local task 1', task2: 'local task 2', started: true };
    const cases = [ ['thiếu ok', { writing: valid }], ['thiếu accepted', { ok: true, writing: { ...valid, accepted: undefined } }],
      ['thiếu revision', { ok: true, writing: { ...valid, revision: undefined } }],
      ['revision không safe', { ok: true, writing: { ...valid, revision: Number.MAX_SAFE_INTEGER + 1 } }],
      ['ACK sai Task2', { ok: true, writing: { ...valid, task2: 'wrong task 2' } }],
      ['ACK sai Task1 khi submitted', { ok: true, writing: { ...valid, task1: 'wrong task 1', submitted: true } }] ];
    for (const [caseName, response] of cases) await t.test(caseName, async () => {
      const h = fixture(source); h.reply(response);
      await assert.rejects(h.run("saveWritingToServer('draft')"));
      assert.equal(h.state().writingServerRevision, 5); assert.equal(h.state().writingDirty, true);
      assert.equal(h.state().writingSubmitted, false);
      assert.deepEqual(h.state().drafts.writing, { outline: 'local outline', task1: 'local task 1', task2: 'local task 2' });
      assert.equal(h.scheduled.length, 0);
    });
  });
  test(title('ACK version thấp bị chặn cả khi server nói submitted'), async () => {
    const h = fixture(source); h.reply({ ok: true, writing: canonical({ revision: 4, accepted: false, submitted: true }) });
    await assert.rejects(h.run("saveWritingToServer('submit')"), /cũ hơn/);
    assert.equal(h.state().writingSubmitted, false); assert.equal(h.state().drafts.writing.task1, 'local task 1');
    assert.equal(h.state().writingServerRevision, 5);
  });
  test(title('ACK muộn không đè chỉnh sửa mới của cả hai Task và outline'), async () => {
    const h = fixture(source); let finish;
    h.transport(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.run("saveWritingToServer('draft')"); await h.dispatched();
    h.run("state.writingRevision=4;state.drafts.writing={outline:'new outline',task1:'new task 1',task2:'new task 2'}");
    finish({ ok: true, writing: { accepted: true, revision: 6, task1: 'local task 1', task2: 'local task 2', started: true } });
    await pending;
    assert.deepEqual(h.state().drafts.writing, { outline: 'new outline', task1: 'new task 1', task2: 'new task 2' });
    assert.equal(h.state().writingDirty, true); assert.equal(h.state().writingServerRevision, 6);
    assert.deepEqual(h.scheduled, [0]);
  });
  test(title('hàng đợi lấy base lúc dispatch sau khi xử lý ACK trước'), async () => {
    const h = fixture(source); let finishFirst;
    h.transport((_request, index) => index === 1 ? new Promise(resolve => { finishFirst = resolve; })
      : { ok: true, writing: { accepted: true, revision: 7, task1: 'second task 1', task2: 'second task 2', started: true } });
    const first = h.run("saveWritingToServer('draft')"); await h.dispatched();
    h.run("state.writingRevision=4;state.drafts.writing.task1='second task 1';state.drafts.writing.task2='second task 2'");
    const second = h.run("saveWritingToServer('draft')");
    finishFirst({ ok: true, writing: { accepted: true, revision: 6, task1: 'local task 1', task2: 'local task 2', started: true } });
    await Promise.all([first, second]);
    assert.deepEqual(h.requests.map(request => request.body.baseRevision), [5, 6]);
    assert.equal(h.requests[1].body.task2, 'second task 2'); assert.equal(h.state().writingServerRevision, 7);
    assert.equal(h.state().writingDirty, false);
  });
  test(title('equal replay ACK giữ version ổn định và hai Task'), async () => {
    const h = fixture(source, { writingConfirmedDraft: { task1: 'local task 1', task2: 'local task 2' } });
    h.reply({ ok: true, writing: { accepted: true, reason: 'already_saved', revision: 5,
      task1: 'local task 1', task2: 'local task 2', started: true } });
    await h.run("saveWritingToServer('draft')"); await h.run("saveWritingToServer('draft')");
    assert.equal(h.state().writingServerRevision, 5); assert.equal(h.state().writingRevision, 3);
    assert.equal(h.state().writingDirty, false); assert.deepEqual(h.requests.map(request => request.body.baseRevision), [5, 5]);
  });
  test(title('start giữ bài local và không coi clock ACK là content ACK'), async () => {
    const h = fixture(source); h.reply({ ok: true, writing: canonical({ revision: 5, accepted: true, reason: 'started' }) });
    await h.run("saveWritingToServer('start')");
    assert.equal(h.state().writingDirty, true); assert.equal(h.state().drafts.writing.task2, 'local task 2');
    assert.equal(h.state().writingConflict.revision, 5);
  });
  test(title('late submit chốt canonical nhưng giữ local và outline để phục hồi'), async () => {
    const h = fixture(source); h.reply({ ok: true, writing: canonical({ accepted: false, submitted: true, reason: 'deadline_expired' }) });
    await h.run("saveWritingToServer('submit')");
    assert.equal(h.state().writingSubmitted, true); assert.equal(h.state().drafts.writing.task2, 'server task 2');
    assert.equal(h.state().drafts.writing.outline, 'local outline');
    assert.deepEqual(h.state().writingRecovery[0], { task1: 'local task 1', task2: 'local task 2',
      outline: 'local outline', reason: 'Bài trên máy khác bản đã nộp', savedAt: h.state().writingRecovery[0].savedAt });
    assert.equal(h.elements.writingRecovery.hidden, false);
    assert.equal(h.elements.writingRecoveryDrafts.children.filter(item => item.children?.[0]?.readOnly).length, 3);
    assert.match(h.statuses.at(-1), /bản khác trên máy được giữ/);
  });
  test(title('save/restore state thật giữ server version, local counter, conflict và recovery'), () => {
    const restored = { writingServerRevision: 12, writingRevision: 4, writingDirty: true,
      writingConflict: canonical({ revision: 13 }), writingRecovery: [{task1:'recover 1',task2:'recover 2',outline:'recover outline'}] };
    const h = fixture(source, restored); h.run('saveSession()');
    assert.equal(h.persisted().writingServerRevision, 12); assert.equal(h.persisted().writingRevision, 4);
    assert.deepEqual(h.persisted().writingConflict, restored.writingConflict); assert.deepEqual(h.persisted().writingRecovery, restored.writingRecovery);
    const again = fixture(source, h.persisted()); assert.deepEqual(again.state().drafts.writing, h.state().drafts.writing);
    assert.equal(again.state().writingServerRevision, 12);
    for (const invalid of [-1, 1.5, '12', Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(fixture(source, { writingServerRevision: invalid }).state().writingServerRevision, null);
    }
  });
  test(title('bootstrap chính/dự phòng và answer sheet đều nạp app cache D08'), () => {
    // Ba client K56 giữ cơ chế D08 nhưng có bản giao diện mới; K67 giữ revision cũ.
    const cacheRevision = sourcePath==='term-tests/k56-mini-shared/app.js' ? '20261008-mini-draft-recovery-v1'
      : /^term-tests\/k56-(?:test2-)?shared\/app\.js$/.test(sourcePath)
        ? '20261006-class-reset-v1' : '20261003-writing-save-cas-v1';
    const revisionOf = url => { const query = new URL(url, 'https://fixture.invalid').searchParams; return query.get('rev') || query.get('v'); };
    for (const path of cachePaths) {
      const text = fs.readFileSync(path, 'utf8');
      const appUrls = [...text.matchAll(/[.\/\w-]*app\.js\?[^\s'"<>`]*/g)].map(match => match[0]);
      const writingApp = sourcePath.slice(sourcePath.indexOf('/') + 1);
      const writingUrls = appUrls.filter(url => url.includes(writingApp + '?'));
      if (path.endsWith('-computer-based/index.html')) {
        // Trang CBT chỉ nạp bootstrap; bootstrap chính/dự phòng đã kiểm đúng app ở ca cùng bảng.
        const bootstrapUrls = [...text.matchAll(/bootstrap\.js\?[^\s'"<>`]*/g)].map(match => match[0]);
        assert.ok(bootstrapUrls.length > 0, `Thiếu bootstrap trong ${path}`);
        for (const url of bootstrapUrls) assert.equal(revisionOf(url), cacheRevision, path);
      } else {
        assert.ok(writingUrls.length > 0, `Thiếu đúng Writing app ${writingApp} trong ${path}`);
      }
      for (const url of writingUrls) assert.equal(revisionOf(url), cacheRevision, path);
      for (const url of appUrls) assert.doesNotMatch(url, /20260910-audio-recovery-v1|20260913-writing-revision-v1|20260929-mini-homework-25m/);
    }
  });
}
