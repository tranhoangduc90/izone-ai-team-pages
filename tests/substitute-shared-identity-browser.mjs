// Trang Substitute thật, tất cả API/media được thay trước điều hướng.
// Không dùng audio trong repo; không gửi API, điểm hoặc bài tới production.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Cần thư viện trình duyệt đã cài.');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const out = process.env.IDENTITY_EVIDENCE_DIR || path.join(root, 'output/playwright/substitute-identity');
await mkdir(out, { recursive: true });
const key = 'izone:student-identity:v1', slug = process.env.IDENTITY_SUBSTITUTE_SLUG || 'substitute-test-1-k56';
if (!/^substitute-test-[12]-k(?:56|67)$/.test(slug)) throw new Error('Mã Substitute ngoài phạm vi fixture.');
const a = { authority: 'erp-contact', id: '12345' }, b = { authority: 'erp-contact', id: '67890' };
const epoch = '11111111-1111-4111-8111-111111111111';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/identity-empty') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Thử</title>'); }
  try {
    const file = path.resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
    if (!file.startsWith(root + path.sep) || /\.(mp3|wav|ogg|m4a)$/i.test(file)) throw new Error('Blocked media');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
      '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
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
  const requests = [], errors = [], unexpected = [], audio = [];
  context.on('page', page => { page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.dismiss()); });
  await context.addInitScript(({ origin, identity, key, blockedStorage }) => {
    if (location.origin !== origin) return;
    if (identity && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, identity,
      revision: 'initial_12345678', updatedAt: new Date().toISOString() }));
    if (blockedStorage) for (const name of ['sessionStorage', 'localStorage']) Object.defineProperty(window, name,
      { configurable: true, get() { throw new DOMException('Fixture storage blocked', 'SecurityError'); } });
    window.__audioPlays = 0;
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => 1800, configurable: true });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
    HTMLMediaElement.prototype.play = function () { window.__audioPlays++; return Promise.resolve(); };
    HTMLMediaElement.prototype.load = function () { queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); };
  }, { origin, identity: options.identity, key, blockedStorage: options.blockedStorage });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (/\.(mp3|wav|m4a|ogg)$/.test(url.pathname)) {
      audio.push(url.pathname);
      return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(64, 42) });
    }
    if (url.origin === origin) return route.continue();
    if (url.origin !== 'https://ducizone.ddns.net') { unexpected.push(url.origin); return route.abort(); }
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    // A journal outage must not alter native identity, permissions or exam state.
    if (url.pathname.endsWith('/journal-context')) return route.fulfill({status:503,headers,contentType:'application/json',body:'{"ok":false}'});
    const body = req.postDataJSON();
    const send = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.endsWith('/api/student-identity/resolve')) {
      requests.push({ route: 'mapping', body });
      return send({ ok: true, status: 'unique', identity: body.identity, aliases: [
        { classId: '111', classCode: 'IC2264', studentRef: '33333333-3333-4333-8333-333333333333', studentName: 'Học viên thử' }] });
    }
    if (!url.pathname.endsWith(`/${slug}-public-api`)) { unexpected.push(url.pathname); return route.abort(); }
    requests.push(body);
    if (body.route === '/api/test/history') return send({ testSlug: slug, historyEpoch: epoch, stateVersion: 2,
      ...(slug === 'substitute-test-2-k67' ? { writingVersions: { IC2264: 'substitute-k67-test2-two-task-20261007-v1', DEMO: 'substitute-k67-test2-two-task-20261007-v1' } } : {}),
      maintenance: false, examTimingVersion: 'substitute-audio-transfer-20261014-v1', classes: [
        { code: 'DEMO', name: 'DEMO · Kiểm thử' }, { code: 'IC2264', name: 'IC2264' }] });
    if (body.route === '/api/test/roster') return send({ students: options.missing ? [{ ref: b.id, name: 'Học viên thử B' }] : [
      { ref: a.id, name: 'Học viên thử A' }, { ref: b.id, name: 'Học viên thử B' }] });
    if (body.route === '/api/test/writing/session') return send({ ...body.payload, testSlug: slug,
      examVersion: 'substitute-k67-test2-two-task-20261007-v1', writingSessionId: body.payload.clientRunId });
    if (body.route === '/api/test/exam/session') return send({ ...body.payload, testSlug: slug,
      timingVersion: 'substitute-audio-transfer-20261014-v1', listeningStartedAt: new Date().toISOString(),
      listeningDeadlineAt: '', audioEndedAt: '', transferSeconds: 300, serverNow: new Date().toISOString() });
    unexpected.push(body.route); return send({ ok: false, message: 'Unexpected fixture request' }, 503);
  });
  const page = await context.newPage();
  return { page, context, requests, errors, unexpected, audio,
    open: (target = page, query = '') => target.goto(`${origin}/term-tests/${slug}-computer-based/${query}`),
    memory: () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key) };
}
async function scenario(name, options, run) {
  const f = await setup(options);
  try { await f.open(f.page, options.query || ''); await run(f);
    assert.deepEqual(f.errors, []); assert.deepEqual(f.unexpected, []);
    results.push({ name, status: 'passed' }); console.log('PASS', name);
  } catch (error) { results.push({ name, status: 'failed', error: error.message });
    await f.page.screenshot({ path: path.join(out, `failure-${results.length}.png`), fullPage: true }); throw error;
  } finally { await f.context.close(); }
}
try {
  await scenario('Nhớ từ sản phẩm khác: tìm lớp, chọn đúng mã ERP và tải audio giả, không chạy giờ', { identity: a }, async f => {
    await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    assert.equal(await f.page.locator('#bootstrapClass').inputValue(), 'IC2264');
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), a.id);
    assert.equal(await f.page.locator('#identityConfirm').isVisible(), false);
    assert.equal(await f.page.locator('#bootstrapChangeStudent').isVisible(), true);
    assert.equal(await f.page.locator('#bootstrapStart').isDisabled(), true);
    assert.equal(await f.page.evaluate(() => window.__audioPlays), 0);
    assert.equal(f.audio.length >= 1, true);
    assert.equal(f.requests.some(r => /session|grade|writing/.test(r.route || '')), false);
    if (slug === 'substitute-test-2-k67') assert.equal(await f.page.evaluate(() => window.SUBSTITUTE_STATE.stamp({})._substitute.examVersion),
      'substitute-k67-test2-two-task-20261007-v1');
    await f.page.screenshot({ path: path.join(out, 'substitute-remembered-desktop.png'), fullPage: true });
    await f.page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await f.page.screenshot({ path: path.join(out, 'substitute-remembered-mobile.png'), fullPage: true });
  });
  await scenario('Substitute là nơi chọn đầu: xác nhận B rồi tab mới nhận được mã B', {}, async f => {
    await f.page.selectOption('#bootstrapClass', 'IC2264');
    await f.page.selectOption('#bootstrapStudent', b.id);
    assert.equal(await f.memory(), null);
    await f.page.locator('#confirmIdentity').click();
    await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    // Audio giả có thể xong trước lượt ghi nhận danh tính bất đồng bộ; chờ đúng kết quả cần kiểm.
    await f.page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key) || 'null')?.identity?.id === id, { key, id: b.id });
    assert.equal((await f.memory()).identity.id, b.id);
    const other = await f.context.newPage(); await f.open(other);
    await other.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    assert.equal(await other.locator('#bootstrapStudent').inputValue(), b.id);
  });
  await scenario('Hai tab A/B: đổi người không sửa chủ/lượt của tab A', { identity: a }, async f => {
    await f.page.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    const runA = await f.page.evaluate(() => window.SUBSTITUTE_STATE.stamp({})._substitute.clientRunId);
    const other = await f.context.newPage(); await f.open(other);
    await other.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    await other.locator('#bootstrapChangeStudent').click();
    await other.selectOption('#bootstrapClass', 'IC2264'); await other.selectOption('#bootstrapStudent', b.id);
    await other.locator('#confirmIdentity').click();
    await other.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), a.id);
    assert.equal(await f.page.evaluate(() => window.SUBSTITUTE_STATE.stamp({})._substitute.clientRunId), runA);
    assert.equal((await f.memory()).identity.id, b.id);
    const next = await f.context.newPage(); await f.open(next);
    await next.locator('#bootstrapDownloadStatus').filter({ hasText: '100%' }).waitFor();
    assert.equal(await next.locator('#bootstrapStudent').inputValue(), b.id);
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), a.id);
  });
  await scenario('Không còn quyền trong roster: giữ A, không tải audio hoặc chọn B thay', { identity: a, missing: true, query: '?class=IC2264' }, async f => {
    await f.page.locator('#bootstrapNotice').filter({ hasText: 'chưa có tên' }).waitFor();
    assert.equal(await f.page.locator('#bootstrapStudent').inputValue(), '');
    assert.equal(f.audio.length, 0); assert.equal((await f.memory()).identity.id, a.id);
  });
  await scenario('Bộ nhớ bị chặn: chọn tay, mở đề giả và giữ câu trả lời trong đúng lượt RAM',
    { blockedStorage: true, query: '?demo=exam&grading=server&class=DEMO' }, async f => {
      await f.page.selectOption('#bootstrapClass', 'DEMO');
      const option = f.page.locator('#bootstrapStudent option:not([value=""])').first();
      await option.waitFor({ state: 'attached' });
      const chosen = await option.getAttribute('value');
      await f.page.selectOption('#bootstrapStudent', chosen);
      await f.page.locator('#confirmIdentity').click();
      await f.page.locator('#bootstrapPreview:enabled').waitFor();
      await f.page.locator('#bootstrapPreview').click();
      await f.page.locator('#bootstrapStart:enabled').click();
      await f.page.locator('#listeningView').waitFor({ state: 'visible' });
      // The native enhancer moves the original controls into the exam layout.
      // Wait for that usable layout so typing cannot race its focus change.
      const field = f.page.locator('#listeningView .cbt-semantic-pane input[name="question-1"]:visible').first();
      await field.fill('NHÁP TRONG RAM A');
      assert.equal(await field.inputValue(), 'NHÁP TRONG RAM A', 'the answer must exist before testing Change student');
      const originalField = await field.elementHandle();
      assert.equal(await f.page.evaluate(() => window.TERM_TEST_BOOTSTRAP.studentRef), chosen);
      await f.page.locator('#termTestChangeStudent').click();
      assert.equal(await f.page.locator('#listeningView').isVisible(), true);
      assert.equal(await field.inputValue(), 'NHÁP TRONG RAM A');
      assert.equal(await originalField.evaluate(element => element.isConnected
        && element === document.querySelector('#listeningView input[name="question-1"]')), true);
      assert.equal(await f.page.locator('#readingView [name="question-1"]').inputValue(), '');
      assert.match(await f.page.locator('#localSaveWarning').innerText(), /nháp|lưu/i);
    });
  outcome = 'passed';
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ outcome, testSlug: slug, results,
    networkMode: 'all-external-intercepted', audio: '64-byte-generated-fixture' }, null, 2), 'utf8');
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ outcome, cases: results.length }));
