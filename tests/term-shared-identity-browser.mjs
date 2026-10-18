// Chạy trang Term 1 K56 thật với API và audio giả. Chặn mạng ngoài trước khi mở trang.
// Kiểm danh tính, lần đầu, hai tab, tải trước và giữ phòng chờ/đồng hồ cũ.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Cần đường dẫn thư viện Playwright đã cài.');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const out = process.env.IDENTITY_EVIDENCE_DIR || path.join(root, 'output/playwright/term-identity');
await mkdir(out, { recursive: true });
const refA = '11111111-1111-4111-8111-111111111111', refB = '22222222-2222-4222-8222-222222222222';
const speakingRefA = '33333333-3333-4333-8333-333333333333';
const speakingRefB = '44444444-4444-4444-8444-444444444444';
const a = { authority: 'erp-contact', id: '12345' }, b = { authority: 'erp-contact', id: '67890' };
const tokens = { [refA]: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
  [refB]: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'] };
const key = 'izone:student-identity:v1', slug = process.env.IDENTITY_TERM_SLUG || 'term-test-1-k56';
if (!['term-test-1-k56', 'term-test-2-k56', 'mini-test-k56'].includes(slug)) throw new Error('Mã Test ngoài phạm vi fixture.');
const base = `izone-test:${slug}:LOPTHU${slug === 'mini-test-k56' ? ':cbt' : ''}`;
const sandbox = { window: {} };
if (slug !== 'term-test-1-k56') vm.runInNewContext(
  await readFile(path.join(root, `term-tests/${slug}-computer-based/passages.js`), 'utf8'), sandbox);
vm.runInNewContext(await readFile(path.join(root, `term-tests/${slug}-computer-based/content.js`), 'utf8'), sandbox);
const content = JSON.parse(JSON.stringify(sandbox.window.K56_TERM_TEST_CONTENT));
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/identity-empty') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Thử</title>'); }
  try {
    const file = path.resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
    if (!file.startsWith(root + path.sep) || /\.(?:mp3|m4a|wav|ogg|enc)$/i.test(file)) throw new Error('Blocked');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
      '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
let outcome = 'partial';
async function setup(options = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const requests = [], errors = [], unexpected = [];
  const started = new Map();
  context.on('page', page => { page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()); });
  await context.addInitScript(({ origin, identity, key, base, legacy, refA, tokens, blockedStorage }) => {
    if (location.origin !== origin) return;
    if (identity && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, identity,
      revision: 'initial_12345678', updatedAt: new Date().toISOString() }));
    if (legacy && !localStorage.getItem(base)) localStorage.setItem(base, JSON.stringify({ studentRef: refA,
      attemptToken: tokens[refA][0], examSessionToken: tokens[refA][1], drafts: { writing: { task2: 'Nháp cũ A' } },
      annotationRunId: 'run-a', listeningStartedAt: new Date().toISOString() }));
    window.__audioPlays = 0;
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => 1800, configurable: true });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
    HTMLMediaElement.prototype.play = function () { window.__audioPlays++; return Promise.resolve(); };
    if (blockedStorage) for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name,
      { configurable: true, get() { throw new DOMException('Fixture storage blocked', 'SecurityError'); } });
  }, { origin, identity: options.identity, key, base, legacy: options.legacy, refA, tokens, blockedStorage: options.blockedStorage });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin) {
      if (options.crossProduct && url.pathname.endsWith('/assets/private/listening-substitute-test-1-k56.mp3'))
        return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(64, 42) });
      if (/\.(?:mp3|m4a|wav|ogg|enc)$/i.test(url.pathname)) { unexpected.push('local real audio'); return route.abort(); }
      return route.continue();
    }
    if (url.origin !== 'https://ducizone.ddns.net') { unexpected.push(url.origin); return route.abort(); }
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = request.postDataJSON();
    requests.push({ path: url.pathname, body, at: Date.now() });
    const send = (value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify({ ok: true, ...value }) });
    if (options.crossProduct && url.pathname.endsWith('/api/student-identity/resolve')) {
      const identity = body.identity || (body.studentRef === speakingRefB ? b : a);
      const aliases = [{ classId: '111', classCode: 'IC2304', studentRef: identity.id === b.id ? speakingRefB : speakingRefA,
        studentName: identity.id === b.id ? 'Học viên thử B' : 'Học viên thử A' },
      { classId: '222', classCode: 'IC2264', studentRef: identity.id === b.id ? refB : refA,
        studentName: identity.id === b.id ? 'Học viên thử B' : 'Học viên thử A' }];
      return send({ ok: true, status: 'unique', identity, aliases: aliases.filter(item => !body.classCode || item.classCode === body.classCode) });
    }
    if (options.crossProduct && url.pathname.endsWith('/substitute-test-1-k56-public-api')) {
      if (body.route === '/api/test/history') return send({ testSlug: 'substitute-test-1-k56',
        historyEpoch: refA, stateVersion: 2, maintenance: false, classes: [
          { code: 'DEMO', name: 'DEMO · Kiểm thử' }, { code: 'IC2264', name: 'IC2264' }] });
      if (body.route === '/api/test/roster') return send({ students: [
        { ref: a.id, name: 'Học viên thử A' }, { ref: b.id, name: 'Học viên thử B' }] });
      unexpected.push(body.route); return send({ message: 'Unexpected substitute fixture' }, 503);
    }
    if (options.crossProduct && /\/api\/speaking-homework(?:-independent)?\//.test(url.pathname)) {
      const endpoint = url.pathname.replace(/^.*\/api\/speaking-homework(?:-independent)?/, '');
      const code = body?.classCode || 'IC2304';
      if (endpoint === '/classes') return send({ classes: [{ classCode: 'IC2304', classRef: '111', ready: true, assignmentStatus: 'open' }] });
      if (endpoint === '/assignment/roster') return send({ assignment: { assignmentCode: '67-speaking-diem_giua',
        classCode: code, title: 'Bài Speaking thử', assignmentStatus: 'open',
        students: [{ student_ref: speakingRefA, name: 'Học viên thử A' }, { student_ref: speakingRefB, name: 'Học viên thử B' }],
        parts: [{ part_key: 'insert_middle', min_questions: 3 }, { part_key: 'freestyle', min_questions: 1 }],
        requiredPracticeCount: 2, doctorEnabled: true } });
      if (endpoint === '/session/start-selected') return send({ session: { accessToken: 'fixture-token-' + body.studentRef,
        studentRef: body.studentRef, classCode: code, documentId: 'fixture-doc-' + body.studentRef, intakeMode: 'legacy' } });
      if (endpoint === '/open') return send({ status: 'draft', links: [], practiceLinks: [] });
      if (endpoint === '/doctor/list') return send({ needed: [], allNeeded: [], practiced: [], sharedCatalog: [], neededCount: 0, personalCount: 0 });
      unexpected.push(endpoint); return send({ message: 'Unexpected Speaking fixture' }, 503);
    }
    if (url.pathname.endsWith('/student-identity')) {
      if (options.identityOffline) return send({ message: 'Nguồn thử chưa sẵn sàng' }, 503);
      const identity = body.identity || (body.studentRef === refB ? b : a);
      const aliases = [{ classId: '111', classCode: 'LOPTHU', studentRef: identity.id === b.id ? refB : refA,
        studentName: identity.id === b.id ? 'Học viên thử B' : 'Học viên thử A' }];
      if (options.multipleClasses) aliases.push({ ...aliases[0], classId: '222', classCode: 'LOP2' });
      return send({ ok: true, status: 'unique', identity: options.wrongIdentity ? b : identity,
        aliases: aliases.filter(alias => !body.classCode || body.classCode === alias.classCode) });
    }
    if (url.pathname.endsWith('/roster')) return send({ ok: true, class: { name: 'LOPTHU' },
      students: [{ ref: refA, name: 'Học viên thử A' }, { ref: refB, name: 'Học viên thử B' }] });
    if (/\/(?:audio|preview)$/.test(url.pathname)) {
      // Nội dung giả sinh trong test; tuyệt đối không chuyển yêu cầu ra VPS/Pages.
      return route.fulfill({ status: 200, headers, contentType: 'application/octet-stream', body: Buffer.alloc(64, 42) });
    }
    if (url.pathname.endsWith('/attempt/active')) {
      const ref = body.studentRef;
      return send({ ok: true, found: true, attemptToken: tokens[ref][0], examSessionToken: tokens[ref][1],
        studentName: ref === refA ? 'Học viên thử A' : 'Học viên thử B' });
    }
    if (url.pathname.endsWith('/attempt/prepare')) {
      const ref = body.studentRef;
      const response = { ok: true, studentName: ref === refA ? 'Học viên thử A' : 'Học viên thử B',
        attemptToken: tokens[ref][0], examSessionToken: tokens[ref][1], examMode: body.mode,
        nextSection: body.mode === 'read_first' ? 'reading' : 'listening', serverNow: new Date().toISOString(),
        attemptMode: 'cbt', policy: { timed: true, autoSubmit: true },
        readingStartedAt: started.get(ref) || null,
        readingDeadlineAt: started.has(ref) ? new Date(Date.parse(started.get(ref)) + 3600000).toISOString() : null,
        generation: 0, content,
        encryptedAudioUrl: `/api/term-tests/${slug}/session/${tokens[ref][1]}/audio`,
        previewAudioUrl: `/api/term-tests/${slug}/session/${tokens[ref][1]}/preview` };
      return send(options.wrongSession ? { ...response, studentRef: refB } : response);
    }
    if (url.pathname.endsWith('/reading/start')) {
      const ref = Object.keys(tokens).find(ref => tokens[ref][0] === body.attemptToken);
      if (!ref) { unexpected.push('unknown reading token'); return send({ ok: false }, 403); }
      const time = new Date().toISOString(); started.set(ref, time);
      return send({ ok: true, ...body, studentName: ref === refA ? 'Học viên thử A' : 'Học viên thử B',
        attemptToken: tokens[ref][0], examSessionToken: tokens[ref][1], readingStartedAt: time,
        readingDeadlineAt: new Date(Date.now() + 3600000).toISOString(), serverNow: time, examMode: 'read_first',
        nextSection: 'reading', content });
    }
    if (url.pathname.endsWith('/reading/draft')) return send({ ok: true, saved: true, revision: body.revision });
    unexpected.push(url.pathname); return send({ ok: false, message: 'Unexpected fixture API' }, 503);
  });
  const page = await context.newPage();
  return { context, page, requests, errors, unexpected,
    open: (page = null, mode = 'lis_first') => (page || context.pages()[0]).goto(`${origin}/term-tests/${slug}-computer-based/?${options.omitClass ? '' : 'class=LOPTHU&'}mode=${mode}`),
    memory: () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key) };
}
async function scenario(name, options, run) {
  const f = await setup(options);
  try { await f.open(null, options.mode); await run(f);
    assert.deepEqual(f.errors, [], 'Lỗi JS trên trang'); assert.deepEqual(f.unexpected, [], 'Yêu cầu ngoài fixture');
    results.push({ name, status: 'passed' }); console.log('PASS', name);
  } catch (error) { results.push({ name, status: 'failed', error: error.message, requests: f.requests,
    pageErrors: f.errors, unexpected: f.unexpected });
    await f.page.screenshot({ path: path.join(out, `failure-${results.length}.png`), fullPage: true }); throw error;
  } finally { await f.context.close(); }
}
try {
  await scenario('Nhớ A: chọn sẵn, tải audio giả ngay, giữ phòng chờ và không chạy giờ/phát', { identity: a }, async f => {
    await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), refA);
    assert.equal(await f.page.locator('#identityConfirm').isVisible(), false);
    assert.equal(await f.page.locator('#bootstrapChangeStudent').isVisible(), true);
    assert.equal(await f.page.locator('#bootstrapStart').isDisabled(), true);
    assert.equal(await f.page.evaluate(() => window.__audioPlays), 0);
    const stored = await f.page.evaluate(key => JSON.parse(localStorage.getItem(key)), `${base}:student:${refA}`);
    assert.equal(Boolean(stored.listeningStartedAt || stored.readingStartedAt), false);
    assert.equal(f.requests.some(r => r.path.endsWith('/roster')), false);
    assert.equal(f.requests.some(r => /\/(?:start|submit)$/.test(r.path)), false);
    await f.page.screenshot({ path: path.join(out, 'term-remembered-desktop.png'), fullPage: true });
    await f.page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await f.page.screenshot({ path: path.join(out, 'term-remembered-mobile.png'), fullPage: true });
  });
  await scenario('Lần đầu ở Test: giữ chọn/xác nhận hiện có; chuẩn bị xong mới nhớ ERP', {}, async f => {
    await f.page.selectOption('#bootstrapStudent', refB);
    assert.equal(f.requests.some(r => r.path.endsWith('/attempt/prepare')), false);
    assert.equal(await f.memory(), null);
    await f.page.locator('#confirmIdentity').click();
    await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    await f.page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.identity?.id === '67890', key);
    const other = await f.context.newPage(); await f.open(other);
    await other.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    assert.equal(await other.locator('#bootstrapStudent').inputValue(), refB);
  });
  await scenario('Lần đầu chọn tên rồi quay lại: không chuẩn bị, nhớ người hoặc tải audio', {}, async f => {
    await f.page.selectOption('#bootstrapStudent', refA);
    await f.page.locator('#cancelIdentity').click();
    assert.equal(await f.page.locator('#identityConfirm').isVisible(), false);
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), '');
    assert.equal(await f.memory(), null);
    assert.equal(f.requests.some(r => r.path.endsWith('/attempt/prepare') || /\/(?:audio|preview)$/.test(r.path)), false);
  });
  await scenario('Đổi A sang B ở phòng chờ: không mang token/nháp A; tab A khác vẫn giữ A', { identity: a, legacy: true }, async f => {
    await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    const original = await f.page.evaluate(key => localStorage.getItem(key), base);
    const other = await f.context.newPage(); await f.open(other);
    await other.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    await other.locator('#bootstrapChangeStudent').click();
    await other.selectOption('#bootstrapStudent', refB); await other.locator('#confirmIdentity').click();
    await other.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), refA);
    assert.equal(await other.locator('#bootstrapStudent').inputValue(), refB);
    const prepareB = f.requests.filter(r => r.path.endsWith('/attempt/prepare') && r.body.studentRef === refB).at(-1);
    assert.equal(prepareB.body.attemptToken, undefined);
    assert.equal(prepareB.body.examSessionToken, undefined);
    assert.equal(await f.page.evaluate(key => localStorage.getItem(key), base), original);
    const stateA = await f.page.evaluate(key => JSON.parse(localStorage.getItem(key)), `${base}:student:${refA}`);
    assert.equal(stateA.drafts.writing.task2, 'Nháp cũ A');
  });
  await scenario('Nguồn nhận diện lỗi: giữ người chung, cho chọn tay, không tự chuẩn bị', { identity: a, identityOffline: true }, async f => {
    await f.page.waitForFunction(() => document.querySelector('#bootstrapStudent')?.options.length === 3);
    assert.equal(f.requests.some(r => r.path.endsWith('/attempt/prepare')), false);
    assert.equal((await f.memory()).identity.id, a.id);
  });
  await scenario('Nguồn trả sai mã người: không tự mở phiên', { identity: a, wrongIdentity: true }, async f => {
    await f.page.waitForFunction(() => document.querySelector('#bootstrapStudent')?.options.length === 3);
    assert.equal(f.requests.some(r => r.path.endsWith('/attempt/prepare')), false);
    assert.equal((await f.memory()).identity.id, a.id);
  });
  await scenario('Reading trước: giữ nút bắt đầu, không audio hoặc chạy giờ, có Đổi người học', { identity: a, mode: 'read_first' }, async f => {
    await f.page.locator('#k56SectionReady').waitFor({ state: 'visible' });
    assert.equal(await f.page.locator('#termTestChangeStudent').isVisible(), true);
    assert.equal(f.requests.some(r => /\/(?:audio|preview|start)$/.test(r.path)), false);
    const stored = await f.page.evaluate(key => JSON.parse(localStorage.getItem(key)), `${base}:student:${refA}`);
    assert.equal(Boolean(stored.readingStartedAt), false);
  });
  for (const first of ['speaking', 'term', 'substitute']) {
    await scenario(`Ba sản phẩm cùng trình duyệt: chọn đầu ở ${first}, hai sản phẩm kia nhận đúng ERP dù UUID khác`,
      { crossProduct: true }, async f => {
        const urls = { speaking: `${origin}/speaking-homework/lesson-4.html`,
          term: `${origin}/term-tests/${slug}-computer-based/?class=LOPTHU`,
          substitute: `${origin}/term-tests/substitute-test-1-k56-computer-based/` };
        await f.page.goto(urls[first]);
        if (first === 'speaking') {
          await f.page.selectOption('#class-select', 'IC2304');
          await f.page.selectOption('#student-select', speakingRefA);
          await f.page.locator('#open-homework').click();
          await f.page.locator('#homework-content').waitFor({ state: 'visible' });
        } else {
          if (first === 'substitute') await f.page.selectOption('#bootstrapClass', 'IC2264');
          await f.page.selectOption('#bootstrapStudent', first === 'substitute' ? a.id : refA);
          await f.page.locator('#confirmIdentity').click();
          await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
        }
        await f.page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.identity?.id === '12345', key);
        for (const product of ['speaking', 'term', 'substitute'].filter(item => item !== first)) {
          const next = await f.context.newPage(); await next.goto(urls[product]);
          if (product === 'speaking') {
            await next.locator('#homework-content').waitFor({ state: 'visible' });
            assert.equal(await next.locator('#login-screen').isHidden(), true);
            const request = f.requests.filter(r => r.path.endsWith('/session/start-selected')).at(-1);
            assert.equal(request.body.studentRef, speakingRefA);
          } else {
            await next.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
            assert.equal(await next.locator('#bootstrapStudent').inputValue(), product === 'term' ? refA : a.id);
            assert.equal(await next.locator('#identityConfirm').isVisible(), false);
          }
        }
      });
  }
  await scenario('Trình duyệt chặn cả hai bộ nhớ: chọn tay vẫn mở phòng chờ Reading đúng người',
    { blockedStorage: true, mode: 'read_first' }, async f => {
      await f.page.selectOption('#bootstrapStudent', refA);
      await f.page.locator('#confirmIdentity').click();
      await f.page.locator('#k56SectionReady').waitFor({ state: 'visible' });
      assert.equal(await f.page.locator('#termTestChangeStudent').isVisible(), true);
      assert.equal(f.requests.some(r => /\/(?:start|submit)$/.test(r.path)), false);
      await f.page.locator('#termTestChangeStudent').click();
      assert.equal(await f.page.locator('#termLocalDraftWarning').isVisible(), true);
      assert.equal(await f.page.locator('#k56SectionReady').isVisible(), true);
    });
  await scenario('Đang làm Reading A: tab mới đổi B, A vẫn giữ câu trả lời/token và reload đúng A',
    { identity: a, mode: 'read_first' }, async f => {
      await f.page.locator('#k56SectionReady button').click();
      await f.page.locator('#readingView').waitFor({ state: 'visible' });
      const answer = f.page.locator('#readingQuestions input[type="text"]').first();
      await answer.fill('DRAFT-A');
      const other = await f.context.newPage(); await f.open(other, 'read_first');
      await other.locator('#readingView').waitFor({ state: 'visible' });
      await other.locator('#termTestChangeStudent').click();
      await other.selectOption('#bootstrapStudent', refB); await other.locator('#confirmIdentity').click();
      await other.locator('#k56SectionReady').waitFor({ state: 'visible' });
      assert.equal(await answer.inputValue(), 'DRAFT-A');
      await f.page.waitForFunction(() => JSON.parse(localStorage.getItem('izone:student-identity:v1')).identity.id === '67890');
      await f.page.reload();
      await f.page.locator('#readingView').waitFor({ state: 'visible' });
      assert.equal(await f.page.locator('#readingQuestions input[type="text"]').first().inputValue(), 'DRAFT-A');
      const restore = f.requests.filter(r => r.path.endsWith('/attempt/active')).at(-1);
      assert.equal(restore.body.studentRef, refA); assert.equal(restore.body.attemptToken, tokens[refA][0]);
      const drafts = f.requests.filter(r => r.path.endsWith('/reading/draft'));
      assert.equal(drafts.length > 0, true, 'Đã có yêu cầu lưu nháp A để kiểm chủ');
      assert.equal(drafts.every(r => r.body.attemptToken === tokens[refA][0]), true);
    });
  await scenario('Đang làm Reading: đổi người giữ nháp A, trở về chọn người và không gọi reset/dừng giờ',
    { identity: a, mode: 'read_first' }, async f => {
      await f.page.locator('#k56SectionReady button').click();
      await f.page.locator('#readingView').waitFor({ state: 'visible' });
      await f.page.locator('#readingQuestions input[type="text"]').first().fill('GIỮ BÀI A');
      await f.page.locator('#termTestChangeStudent').click();
      await f.page.waitForFunction(() => document.querySelector('#bootstrapStudent')?.options.length === 3);
      assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), '');
      const own = await f.page.evaluate(key => JSON.parse(localStorage.getItem(key)), `${base}:student:${refA}`);
      assert.equal(Object.values(own.drafts.reading).includes('GIỮ BÀI A'), true);
      assert.equal(own.attemptToken, tokens[refA][0]);
      assert.equal(Boolean(own.readingStartedAt), true);
      assert.equal((await f.memory()).identity, null);
      assert.equal(f.requests.some(r => /\/(?:reset|pause|submit)$/.test(r.path)), false);
    });
  await scenario('Đang gõ Reading nhưng storage hết chỗ: chặn đổi người, giữ câu trả lời và danh tính A',
    { identity: a, mode: 'read_first' }, async f => {
      await f.page.locator('#k56SectionReady button').click();
      await f.page.locator('#readingView').waitFor({ state: 'visible' });
      await f.page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Fixture quota', 'QuotaExceededError'); }; });
      const answer = f.page.locator('#readingQuestions input[type="text"]').first();
      await answer.fill('NHÁP CHƯA GIỮ ĐƯỢC');
      await f.page.locator('#termTestChangeStudent').click();
      assert.equal(await f.page.locator('#readingView').isVisible(), true);
      assert.equal(await answer.inputValue(), 'NHÁP CHƯA GIỮ ĐƯỢC');
      assert.equal(await f.page.locator('#termLocalDraftWarning').isVisible(), true);
      assert.equal((await f.memory()).identity.id, a.id);
    });
  await scenario('Link thiếu lớp nhưng chỉ một lớp hợp lệ: tự tìm lớp, không yêu cầu chọn lại',
    { identity: a, omitClass: true }, async f => {
      await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
      assert.equal(new URL(f.page.url()).searchParams.get('class'), 'LOPTHU');
      assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), refA);
      assert.equal(await f.page.locator('#identityConfirm').isVisible(), false);
    });
  await scenario('Link thiếu lớp và có hai lớp: chỉ hỏi lớp/bài, giữ danh tính và không tự lấy lớp đầu',
    { identity: a, omitClass: true, multipleClasses: true }, async f => {
      await f.page.locator('#bootstrapRememberedClass').waitFor({ state: 'visible' });
      assert.equal(f.requests.some(r => r.path.endsWith('/attempt/prepare')), false);
      await f.page.selectOption('#bootstrapRememberedClass', 'LOP2');
      await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
      assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), refA);
      assert.equal(new URL(f.page.url()).searchParams.get('class'), 'LOP2');
      assert.equal(await f.page.locator('#identityConfirm').isVisible(), false);
      assert.equal((await f.memory()).identity.id, a.id);
    });
  outcome = 'passed';
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ outcome, testSlug: slug, results,
    networkMode: 'all-external-intercepted', audio: '64-byte-generated-fixture' }, null, 2), 'utf8');
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ outcome, cases: results.length }));
