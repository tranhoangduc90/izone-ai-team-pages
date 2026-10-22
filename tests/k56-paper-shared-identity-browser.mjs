// Kiểm trang nhập đáp án K56 thật; API là dữ liệu giả và mọi media bị chặn.
// Tên/mã/nháp chỉ là fixture; không gửi bài, audio hoặc truy vấn production.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const playwrightModule = process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const slug = process.env.IDENTITY_TERM_SLUG || 'term-test-1-k56';
if (!['term-test-1-k56', 'term-test-2-k56', 'mini-test-k56'].includes(slug)) throw new Error('Test ngoài fixture.');
const out = process.env.IDENTITY_EVIDENCE_DIR || path.join(root, 'output/playwright/paper-identity');
await mkdir(out, { recursive: true });
const a = { authority: 'erp-contact', id: '12345' }, b = { authority: 'erp-contact', id: '67890' };
const refA = '11111111-1111-4111-8111-111111111111', refB = '22222222-2222-4222-8222-222222222222';
const key = 'izone:student-identity:v1';
const tokens = { [refA]: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
  [refB]: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'] };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/identity-empty') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Thử</title>'); }
  try {
    const file = path.resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
    if (!file.startsWith(root + path.sep) || /\.(mp3|m4a|ogg|wav|enc)$/i.test(file)) throw new Error('Blocked');
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
  const requests = [], errors = [], unexpected = [], confirmations = [];
  const started = new Map();
  context.on('page', page => {
    page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept();
      confirmations.push(dialog.message()); return options.cancelConfirm ? dialog.dismiss() : dialog.accept(); });
  });
  await context.addInitScript(({ origin, identity, key, blocked }) => {
    if (location.origin !== origin) return;
    if (identity && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, identity,
      revision: 'initial_12345678', updatedAt: new Date().toISOString() }));
    if (blocked) for (const name of ['sessionStorage', 'localStorage']) Object.defineProperty(window, name,
      { configurable: true, get() { throw new DOMException('Fixture storage blocked', 'SecurityError'); } });
  }, { origin, identity: options.identity, key, blocked: options.blocked });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (/\.(mp3|m4a|ogg|wav|enc)$/i.test(url.pathname)) { unexpected.push('media'); return route.abort(); }
    if (url.origin === origin) return route.continue();
    if (url.origin !== 'https://ducizone.ddns.net') { unexpected.push(url.origin); return route.abort(); }
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = request.postDataJSON(); requests.push({ path: url.pathname, body });
    const send = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify({ ok: true, ...data }) });
    if (url.pathname.endsWith('/student-identity')) {
      if (Object.keys(body).some(key => !['identity', 'studentRef', 'classCode'].includes(key))) return send({ ok: false, error: 'INVALID_STUDENT_IDENTITY' }, 400);
      const identity = body.identity || (body.studentRef === refB ? b : a);
      const alias = { classId: '111', classCode: 'LOPTHU', studentRef: identity.id === b.id ? refB : refA,
        studentName: identity.id === b.id ? 'Học viên thử B' : 'Học viên thử A' };
      const aliases = options.multipleClasses ? [alias, { ...alias, classId: '222', classCode: 'LOPKHAC' }] : [alias];
      return send({ status: 'unique', identity, aliases: aliases.filter(value => !body.classCode || value.classCode === body.classCode) });
    }
    if (url.pathname.endsWith('/roster')) return send({ class: { name: 'LOPTHU' }, students: [
      { ref: refA, name: 'Học viên thử A' }, { ref: refB, name: 'Học viên thử B' }] });
    if (url.pathname.endsWith('/attempt/active')) return send({ found: true, attemptToken: tokens[body.studentRef][0],
      examSessionToken: tokens[body.studentRef][1], studentName: body.studentRef === refB ? 'Học viên thử B' : 'Học viên thử A' });
    if (url.pathname.endsWith('/attempt/prepare')) {
      const ref = body.studentRef;
      return send({ studentRef: ref, studentName: ref === refA ? 'Học viên thử A' : 'Học viên thử B',
        attemptToken: tokens[ref][0], examSessionToken: tokens[ref][1], examMode: body.mode || 'read_first', nextSection: 'reading',
        attemptMode: slug === 'mini-test-k56' ? 'answer_sheet' : 'cbt', generation: 0,
        policy: { timed: slug !== 'mini-test-k56', autoSubmit: slug !== 'mini-test-k56' },
        readingStartedAt: started.get(ref) || null,
        readingDeadlineAt: started.has(ref) && slug !== 'mini-test-k56' ? new Date(Date.parse(started.get(ref)) + 3600000).toISOString() : null,
        serverNow: new Date().toISOString() });
    }
    if (url.pathname.endsWith('/reading/start')) {
      const ref = Object.keys(tokens).find(ref => tokens[ref][0] === body.attemptToken);
      if (!ref) { unexpected.push('unknown token'); return send({ ok: false }, 403); }
      const time = new Date().toISOString(); started.set(ref, time);
      return send({ readingStartedAt: time, readingDeadlineAt: slug === 'mini-test-k56' ? null : new Date(Date.now() + 3600000).toISOString(), serverNow: time });
    }
    if (url.pathname.endsWith('/reading/draft')) return send({ saved: true, revision: body.revision });
    unexpected.push(url.pathname); return send({ ok: false, message: 'Unexpected paper fixture' }, 503);
  });
  const page = await context.newPage();
  return { context, page, requests, errors, unexpected, confirmations,
    open: (target = page) => target.goto(`${origin}/term-tests/${slug}/?${options.omitClass ? '' : 'class=LOPTHU&'}mode=read_first`),
    memory: () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key) };
}
async function scenario(name, options, run) {
  const f = await setup(options);
  try { await f.open(); await run(f); assert.deepEqual(f.errors, []); assert.deepEqual(f.unexpected, []);
    results.push({ name, outcome: 'passed' }); console.log('PASS', name);
  } catch (error) { results.push({ name, outcome: 'failed', error: error.message, requests: f.requests,
    pageErrors: f.errors, unexpected: f.unexpected });
    await f.page.screenshot({ path: path.join(out, `failure-${results.length}.png`), fullPage: true }); throw error;
  } finally { await f.context.close(); }
}
try {
  await scenario('Đã nhớ A: chọn sẵn và giữ nút bắt đầu/nhập đáp án, không xác nhận lại hoặc tải audio', { identity: a }, async f => {
    await f.page.locator('#k56SectionReady').waitFor({ state: 'visible' });
    assert.equal(await f.page.locator('#studentSelect').inputValue(), refA);
    assert.equal(await f.page.locator('#termTestChangeStudent').isVisible(), true);
    assert.equal(f.confirmations.length, 0);
    assert.equal(f.requests.some(r => r.path.endsWith('/roster') || /\/(?:start|submit)$/.test(r.path)), false);
    assert.equal((await f.memory()).revision, 'initial_12345678');
  });
  await scenario('Lần đầu từ bài giấy: chọn B/xác nhận một lần, tab mới nhận B', {}, async f => {
    await f.page.selectOption('#studentSelect', refB);
    if (slug === 'mini-test-k56') await f.page.locator('#miniPaperEnter').click();
    await f.page.locator('#k56SectionReady').waitFor({ state: 'visible' });
    await f.page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.identity?.id === '67890', key);
    assert.equal(f.confirmations.length, 1);
    const other = await f.context.newPage(); await f.open(other);
    await other.locator('#k56SectionReady').waitFor({ state: 'visible' });
    assert.equal(await other.locator('#studentSelect').inputValue(), refB);
    assert.equal(f.confirmations.length, 1);
  });
  await scenario('Hủy xác nhận lần đầu không mở phiên hoặc ghi danh tính', { cancelConfirm: true }, async f => {
    await f.page.selectOption('#studentSelect', refA);
    if (slug === 'mini-test-k56') await f.page.locator('#miniPaperEnter').click();
    assert.equal(f.requests.some(r => r.path.endsWith('/attempt/prepare')), false);
    assert.equal(await f.memory(), null);
  });
  await scenario('Đổi người khi đang nhập: giữ nháp A, không nhận lại A từ kho cũ', { identity: a }, async f => {
    await f.page.locator('#k56SectionReady button').click();
    await f.page.locator('#readingView').waitFor({ state: 'visible' });
    await f.page.locator('#readingQuestions input[type="text"]').first().fill('BẢN NHÁP A');
    await f.page.locator('#termTestChangeStudent').click();
    await f.page.waitForFunction(() => document.querySelector('#studentSelect')?.options.length === 3);
    assert.equal(await f.page.locator('#studentSelect').inputValue(), '');
    const drafts = await f.page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('izone-test:'))
      .map(key => JSON.parse(localStorage.getItem(key))).filter(value => value.studentRef === '11111111-1111-4111-8111-111111111111'));
    assert.equal(drafts.some(value => Object.values(value.drafts?.reading || {}).includes('BẢN NHÁP A')), true);
    assert.equal((await f.memory()).identity, null);
  });
  await scenario('Hết chỗ lưu khi đang nhập: chặn đổi người và giữ nội dung A', { identity: a }, async f => {
    await f.page.locator('#k56SectionReady button').click(); await f.page.locator('#readingView').waitFor({ state: 'visible' });
    await f.page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Fixture quota', 'QuotaExceededError'); }; });
    const field = f.page.locator('#readingQuestions input[type="text"]').first(); await field.fill('NHÁP CẦN GIỮ');
    await f.page.locator('#termTestChangeStudent').click();
    assert.equal(await f.page.locator('#readingView').isVisible(), true); assert.equal(await field.inputValue(), 'NHÁP CẦN GIỮ');
    assert.equal((await f.memory()).identity.id, a.id);
  });
  await scenario('Link thiếu lớp: tự tìm lớp duy nhất rồi mở đúng người', { identity: a, omitClass: true }, async f => {
    await f.page.locator('#k56SectionReady').waitFor({ state: 'visible' });
    assert.equal(new URL(f.page.url()).searchParams.get('class'), 'LOPTHU');
    assert.equal(await f.page.locator('#studentSelect').inputValue(), refA);
    assert.equal(f.confirmations.length, 0);
  });
  await scenario('Bài giấy đang làm A: tab khác đổi B có thông báo, reload vẫn giữ nháp A', { identity: a }, async f => {
    await f.page.locator('#k56SectionReady button').click();
    const answer = f.page.locator('#readingQuestions input[type="text"]').first();
    await answer.fill('NHÁP GIẤY A');
    const other = await f.context.newPage(); await other.goto(origin+'/identity-empty');
    await other.evaluate(({key,identity}) => localStorage.setItem(key,JSON.stringify({ version:1,identity,
      revision:'other_tab_12345678',updatedAt:new Date().toISOString() })),{key,identity:b});
    await f.page.locator('#termIdentityOtherTabNotice').waitFor();
    assert.equal(await answer.inputValue(),'NHÁP GIẤY A');
    await f.page.reload(); await f.page.locator('#readingView').waitFor({ state:'visible' });
    assert.equal(await f.page.locator('#studentSelect').inputValue(),refA);
    assert.equal(await f.page.locator('#readingQuestions input[type="text"]').first().inputValue(),'NHÁP GIẤY A');
    assert.equal((await f.memory()).identity.id,b.id);
  });
  await scenario('Link thiếu lớp có nhiều lựa chọn: chỉ chọn lớp, không chọn lại người',
    { identity: a, omitClass: true, multipleClasses: true }, async f => {
      await f.page.locator('#studentIdentityClassChoice').waitFor();
      assert.equal(f.requests.some(r => r.path.endsWith('/attempt/prepare')), false);
      await f.page.selectOption('#studentIdentityClassChoice', 'LOPTHU');
      await f.page.locator('#k56SectionReady').waitFor({ state: 'visible' });
      assert.equal(await f.page.locator('#studentSelect').inputValue(), refA);
      assert.equal(f.confirmations.length, 0);
    });
  outcome = 'passed';
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ outcome, testSlug: slug, entry: 'paper', results,
    networkMode: 'all-external-intercepted', media: 'all-forbidden' }, null, 2), 'utf8');
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ outcome, cases: results.length }));
