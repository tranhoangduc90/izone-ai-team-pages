// Mở trang Lesson 4 thật, chặn mọi mạng ngoài và thay API bằng dữ liệu giả.
// Kiểm tự vào bài, lần đăng nhập đầu, hai tab, sai chủ Docs và không mất nháp khi đổi người.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Cần PLAYWRIGHT_MODULE trỏ tới thư viện đã cài.');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const out = process.env.SPEAKING_EVIDENCE_DIR || path.join(root, 'output/playwright/speaking-shared-identity');
await mkdir(out, { recursive: true });
const key = 'izone:student-identity:v1';
const a = { authority: 'erp-contact', id: '12345' }, b = { authority: 'erp-contact', id: '67890' };
const refA = '11111111-1111-4111-8111-111111111111';
const refB = '22222222-2222-4222-8222-222222222222';
const refOther = '33333333-3333-4333-8333-333333333333';
const lesson = Number(process.env.IDENTITY_SPEAKING_LESSON || 4);
assert.ok(Number.isInteger(lesson) && lesson >= 2 && lesson <= 9);
const assignmentCode = { 2: '67-speaking-paraphrase', 3: '67-speaking-lam_ro', 4: '67-speaking-diem_giua',
  5: '67-speaking-on_tap_lam_ro_diem_giua', 6: '67-speaking-ly_do_hanh_vi', 7: '67-speaking-cach_lam_mot_viec',
  8: '67-speaking-so_sanh', 9: '67-speaking-freestyle_on_tap' }[lesson];
const lessonParts = { 2: [['paraphrase', 5], ['speaking', 3]],
  3: [['clarify_1', 3], ['clarify_2', 2], ['clarify_3', 2], ['freestyle', 2]],
  4: [['insert_middle', 3], ['freestyle', 1]], 5: [['review_clarify_middle', 3], ['freestyle', 1]],
  6: [['benefit_harm', 0], ['reason_action', 2], ['freestyle', 1]], 7: [['how_to_do', 4]],
  8: [['comparison_direct', 6], ['comparison_extended', 6], ['freestyle', 1]], 9: [['freestyle', 1]] }[lesson];
const firstPart = lessonParts[0][0];
const pageFile = lesson === 2 ? 'index.html' : `lesson-${lesson}.html`;
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/identity-fixture-empty') {
    res.setHeader('content-type', 'text/html'); return res.end('<!doctype html><title>Tab thử bộ nhớ</title>');
  }
  try {
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + path.sep)) throw new Error('Outside source');
    res.setHeader('content-type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
      '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
let outcome = 'partial';
function aliases(identity) {
  const isB = identity.id === b.id;
  return [{ classId: isB ? '222' : '111', classCode: isB ? 'IC2305' : 'IC2304',
    studentRef: isB ? refB : refA, studentName: isB ? 'Học viên thử B' : 'Học viên thử A' }];
}

async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: options.mobile ? 390 : 1280, height: 900 } });
  const requests = [], errors = [], unexpected = [], blocked = [];
  context.on('page', page => {
    page.setDefaultTimeout(7000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  });
  if (options.identity) await context.addInitScript(({ key, identity, origin }) => {
    // Không gieo localStorage trong about:blank hoặc frame ngoài origin của bản thử.
    if (location.origin !== origin) return;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, identity,
      revision: 'initial_' + identity.id, updatedAt: new Date().toISOString() }));
  }, { key, identity: options.identity, origin });
  await context.route('**/*', async route => {
    const address = new URL(route.request().url());
    if (/\.(?:mp3|m4a|wav|ogg)(?:$|\?)/i.test(address.pathname)) {
      unexpected.push('audio requested in Speaking'); return route.abort();
    }
    if (address.origin === origin) return route.continue();
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json',
      headers: { 'access-control-allow-origin': origin }, body: JSON.stringify({ ok: true, ...data }) });
    if (address.origin !== 'https://ducizone.ddns.net') { blocked.push(address.origin); return route.abort(); }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204,
      headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const body = route.request().postDataJSON();
    if (address.pathname === '/mapping-api/api/student-identity/resolve') {
      requests.push({ path: '/shared-identity', body });
      const identity = body.identity || (body.studentRef === refB ? b : a);
      return send({ status: 'unique', identity: options.wrongIdentity ? b : identity,
        aliases: aliases(options.wrongIdentity ? b : identity) });
    }
    const match = /\/api\/speaking-homework(?:-independent)?(\/.*)$/.exec(address.pathname);
    if (!match) { unexpected.push(address.pathname); return route.abort(); }
    const endpoint = match[1], code = body?.classCode || 'IC2304';
    requests.push({ path: endpoint, body });
    if (endpoint === '/classes') return send({ classes: [
      { classCode: 'IC2304', classRef: '111', ready: true, assignmentStatus: 'open' },
      { classCode: 'IC2305', classRef: '222', ready: true, assignmentStatus: 'open' },
    ] });
    if (endpoint === '/identity/resolve') return send({ status: 'unique', classCode: body.studentRef === refB ? 'IC2305' : 'IC2304' });
    if (endpoint === '/assignment/open') return send({ assignment: { classCode: 'IC2305',
      assignmentStatus: 'open', selectedStudentRef: refB } });
    if (endpoint === '/assignment/roster') return send({ assignment: {
      assignmentCode, classCode: code, title: 'Bài Speaking thử', assignmentStatus: 'open',
      ...(body.documentId ? { selectedStudentRef: refB } : {}),
      students: code === 'IC2305' ? [{ student_ref: refB, name: 'Học viên thử B' }]
        : [{ student_ref: refOther, name: 'Học viên thử A' }, { student_ref: refA, name: 'Học viên thử A' }],
      parts: lessonParts.map(([part_key, min_questions]) => ({ part_key, min_questions })),
      requiredPracticeCount: 2, doctorEnabled: true,
    } });
    if (endpoint === '/session/start-selected') return send({ session: {
      accessToken: 'fixture-token-' + body.studentRef, studentRef: body.studentRef, classCode: code,
      documentId: body.documentId || 'fixture-doc-' + body.studentRef, intakeMode: 'legacy',
    } });
    if (endpoint === '/open') return send({ status: 'draft', links: [], practiceLinks: [] });
    if (endpoint === '/doctor/list') return send({ needed: [], allNeeded: [], practiced: [], sharedCatalog: [], neededCount: 0, personalCount: 0 });
    if (endpoint === '/checks/request') return send({ check: { status: 'pending' } });
    unexpected.push(endpoint);
    return send({ ok: false, message: 'Unexpected fixture API: ' + endpoint }, 503);
  });
  const page = await context.newPage();
  await page.goto(`${origin}/speaking-homework/${pageFile}${options.query || ''}`);
  return { context, page, requests, errors, unexpected, blocked,
    memory: () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key),
    sessionRequests: () => requests.filter(item => item.path === '/session/start-selected') };
}

async function choose(page, code, ref) {
  await page.locator('#class-select').selectOption(code);
  await page.locator('#student-select').selectOption(ref);
  await page.locator('#open-homework').click();
  await page.locator('#homework-content').waitFor({ state: 'visible' });
}
async function scenario(name, options, run) {
  const fixture = await setup(options);
  try {
    await run(fixture);
    assert.deepEqual(fixture.errors, [], 'Lỗi JavaScript trong trang thật');
    assert.deepEqual(fixture.unexpected, [], 'Trang gọi ngoài hợp đồng fixture');
    results.push({ name, outcome: 'passed', requests: fixture.requests.length,
      blockedOrigins: [...new Set(fixture.blocked)], realAudioRequests: 0, liveApiRequests: 0 });
  } catch (error) {
    results.push({ name, outcome: 'failed', error: error.message, requests: fixture.requests,
      errors: fixture.errors, unexpected: fixture.unexpected, realAudioRequests: 0, liveApiRequests: 0 });
    await fixture.page.screenshot({ path: path.join(out, 'failed.png'), fullPage: true });
    throw error;
  } finally { await fixture.context.close(); }
}
try {
  await scenario('Đã nhớ ở nơi khác: bỏ màn đăng nhập và mở đúng UUID dù trùng tên', { identity: a }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(await f.page.locator('#login-screen').isHidden(), true);
    assert.equal(f.sessionRequests().length, 1);
    assert.equal(f.sessionRequests()[0].body.studentRef, refA);
    assert.equal(await f.page.locator('#change-student').isVisible(), true);
    assert.equal((await f.memory()).identity.id, a.id);
    await f.page.screenshot({ path: path.join(out, 'speaking-auto-desktop.png'), fullPage: true });
    await f.page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await f.page.screenshot({ path: path.join(out, 'speaking-auto-mobile.png'), fullPage: true });
  });
  await scenario('Speaking là nơi chọn người đầu tiên; tab mới tự vào cùng người', {}, async f => {
    await f.page.locator('#class-select').waitFor({ state: 'visible' });
    assert.equal(f.sessionRequests().length, 0);
    await choose(f.page, 'IC2304', refA);
    assert.equal((await f.memory()).identity.id, a.id);
    const next = await f.context.newPage();
    await next.goto(`${origin}/speaking-homework/${pageFile}`);
    await next.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(await next.locator('#login-screen').isHidden(), true);
    assert.equal(f.sessionRequests().length, 2);
    assert.ok(f.sessionRequests().every(item => item.body.studentRef === refA));
  });
  await scenario('Đổi sang B ở tab khác không đổi chủ hoặc nháp đang gõ của A', { identity: a }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    const draft = 'https://chatgpt.com/share/44444444-4444-4444-8444-444444444444';
    await f.page.locator(`#${firstPart}-link`).fill(draft);
    const next = await f.context.newPage();
    await next.goto(`${origin}/speaking-homework/${pageFile}`);
    await next.locator('#homework-content').waitFor({ state: 'visible' });
    await next.locator('#change-student').click();
    await choose(next, 'IC2305', refB);
    await f.page.locator('#memory-status').filter({ hasText: 'Bài đang làm vẫn giữ đúng người ban đầu' }).waitFor();
    assert.equal((await f.memory()).identity.id, b.id);
    assert.equal(await f.page.locator('#active-student').innerText(), 'Học viên thử A');
    assert.equal(await f.page.locator(`#${firstPart}-link`).inputValue(), draft);
    await f.page.locator(`#${firstPart}-confirm`).click();
    await f.page.waitForFunction(() => !document.getElementById('change-student').disabled);
    const check = f.requests.filter(item => item.path === '/checks/request').at(-1);
    assert.equal(check.body.studentRef, refA);
    assert.equal(check.body.accessToken, 'fixture-token-' + refA);
  });
  await scenario('API quy đổi trả sai người: không tự mở phiên hoặc xóa người đã nhớ', { identity: a, wrongIdentity: true }, async f => {
    await f.page.locator('#identity-message').filter({ hasText: 'Chưa kiểm' }).waitFor();
    assert.equal(f.sessionRequests().length, 0);
    assert.equal((await f.memory()).identity.id, a.id);
    assert.equal(await f.page.locator('#forget-remembered').isVisible(), true);
  });
  await scenario('Link Docs của B không tự đăng nhập B khi trình duyệt nhớ A',
    { identity: a, query: '?documentId=fixture-owned-by-b' }, async f => {
      await f.page.locator('#student-select').waitFor({ state: 'visible' });
      await f.page.waitForFunction(() => !document.getElementById('student-select').disabled);
      assert.equal(f.sessionRequests().length, 0);
      assert.equal((await f.memory()).identity.id, a.id);
      assert.equal(await f.page.locator('#login-screen').isVisible(), true);
    });
  await scenario('Không đổi người khi chưa giữ được nháp mới đang gõ', { identity: a }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    const draft = 'https://chatgpt.com/share/55555555-5555-4555-8555-555555555555';
    await f.page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Fixture quota', 'QuotaExceededError'); }; });
    await f.page.locator(`#${firstPart}-link`).fill(draft);
    await f.page.locator('#change-student').click();
    assert.equal(await f.page.locator('#homework-content').isVisible(), true);
    assert.equal(await f.page.locator(`#${firstPart}-link`).inputValue(), draft);
    assert.equal((await f.memory()).identity.id, a.id);
  });
  outcome = 'passed';
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ outcome, results, realAudioRequests: 0, liveApiRequests: 0 }, null, 2), 'utf8');
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ outcome, cases: results.length, realAudioRequests: 0, liveApiRequests: 0 }));
