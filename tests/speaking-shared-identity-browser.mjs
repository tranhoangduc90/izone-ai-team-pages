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
      if (options.documentIntake && body.classCode === 'DOCS') return send({ status: 'missing', identity: null, aliases: [] });
      if (options.missingA && body.studentRef === refA) return send({ status: 'missing', identity: null, aliases: [] });
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
    if (endpoint === '/assignment/open' && options.documentIntake) return send({ assignment: {
      classCode: 'DOCS', assignmentCode, intakeMode: 'document', assignmentStatus: 'open',
      students: [{ student_ref: refA, name: 'Chủ Docs thử' }],
      parts: lessonParts.map(([part_key, min_questions]) => ({ part_key, min_questions })), requiredPracticeCount: 2, doctorEnabled: true,
    } });
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
      ...(options.independent || options.documentIntake ? { workUnitId: 'fixture-work-' + body.studentRef,
        ...(body.documentId ? { documentId: body.documentId } : {}), intakeMode: 'independent' }
        : { documentId: body.documentId || 'fixture-doc-' + body.studentRef, intakeMode: 'legacy' }),
    } });
    if (endpoint === '/open') return send({ status: 'draft', links: options.serverLink ? [{ part: firstPart,
      share_url: 'https://chatgpt.com/share/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', check_status: 'accepted', question_count: 30 }] : [], practiceLinks: [] });
    if (endpoint === '/doctor/list') return send({ needed: [], allNeeded: [], practiced: [], sharedCatalog: [], neededCount: 0, personalCount: 0 });
    if (endpoint === '/checks/request') return send({ check: { status: 'pending' } });
    unexpected.push(endpoint);
    return send({ ok: false, message: 'Unexpected fixture API: ' + endpoint }, 503);
  });
  const page = await context.newPage();
  await page.goto(`${origin}/speaking-homework/${pageFile}${options.query || ''}`);
  return { context, page, requests, errors, unexpected, blocked, options,
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
  await scenario('Tải lại tab A sau khi tab khác đổi B: giữ chủ và nháp A, tab mới nhận B', { identity: a }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    const draft = 'https://chatgpt.com/share/66666666-6666-4666-8666-666666666666';
    await f.page.locator(`#${firstPart}-link`).fill(draft);
    const next = await f.context.newPage();
    await next.goto(`${origin}/speaking-homework/${pageFile}`);
    await next.locator('#homework-content').waitFor({ state: 'visible' });
    await next.locator('#change-student').click();
    await choose(next, 'IC2305', refB);
    await f.page.reload();
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(await f.page.locator('#active-class').innerText(), 'IC2304');
    assert.equal(await f.page.locator(`#${firstPart}-link`).inputValue(), draft);
    assert.equal(f.sessionRequests().at(-1).body.studentRef, refA);
    assert.equal((await f.memory()).identity.id, b.id, 'Khôi phục A không ghi đè người chung B');
    const fresh = await f.context.newPage();
    await fresh.goto(`${origin}/speaking-homework/${pageFile}`);
    await fresh.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(f.sessionRequests().at(-1).body.studentRef, refB);
  });
  await scenario('Đổi A/B/A và tải lại: nháp riêng từng người còn nguyên', { identity: a }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    const draftA = 'https://chatgpt.com/share/77777777-7777-4777-8777-777777777777';
    const draftB = 'https://chatgpt.com/share/88888888-8888-4888-8888-888888888888';
    await f.page.locator(`#${firstPart}-link`).fill(draftA);
    await f.page.locator('#change-student').click();
    await choose(f.page, 'IC2305', refB);
    assert.notEqual(await f.page.locator(`#${firstPart}-link`).inputValue(), draftA);
    await f.page.locator(`#${firstPart}-link`).fill(draftB);
    await f.page.reload();
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(await f.page.locator(`#${firstPart}-link`).inputValue(), draftB);
    await f.page.locator('#change-student').click();
    await choose(f.page, 'IC2304', refA);
    assert.equal(await f.page.locator(`#${firstPart}-link`).inputValue(), draftA);
    await f.page.reload();
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(await f.page.locator(`#${firstPart}-link`).inputValue(), draftA);
    assert.equal(f.sessionRequests().at(-1).body.studentRef, refA);
  });
  await scenario('Tab khác quên danh tính: tải lại vẫn giữ A, không tự nhớ lại toàn trình duyệt', { identity: a }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    const next = await f.context.newPage();
    await next.goto(`${origin}/speaking-homework/${pageFile}`);
    await next.locator('#homework-content').waitFor({ state: 'visible' });
    await next.locator('#change-student').click();
    await f.page.reload();
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(f.sessionRequests().at(-1).body.studentRef, refA);
    assert.equal((await f.memory()).identity, null);
  });
  await scenario('Hồ sơ ghim không còn hợp lệ: không rơi sang B và vẫn đổi người thủ công được', { identity: a }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    const next = await f.context.newPage();
    await next.goto(`${origin}/speaking-homework/${pageFile}`);
    await next.locator('#homework-content').waitFor({ state: 'visible' });
    await next.locator('#change-student').click();
    await choose(next, 'IC2305', refB);
    f.options.missingA = true;
    const opens = f.sessionRequests().length;
    await f.page.reload();
    await f.page.locator('#identity-message').filter({ hasText: 'chưa còn hợp lệ' }).waitFor();
    assert.equal(f.sessionRequests().length, opens);
    assert.equal((await f.memory()).identity.id, b.id);
    await f.page.locator('#forget-remembered').click();
    await choose(f.page, 'IC2305', refB);
    assert.equal(f.sessionRequests().at(-1).body.studentRef, refB);
  });
  await scenario('Đã bấm đổi người: tải lại màn chọn không tự quay về người ghim hoặc B ở tab khác', { identity: a }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    await f.page.locator('#change-student').click();
    // Đợi thao tác quên ghi xong; click không tự chờ phần async của bộ xử lý sự kiện.
    await f.page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.identity === null, key);
    const next = await f.context.newPage();
    await next.goto(`${origin}/speaking-homework/${pageFile}`);
    await choose(next, 'IC2305', refB);
    const opens = f.sessionRequests().length;
    await f.page.reload();
    await f.page.waitForFunction(() => !document.getElementById('class-select').disabled);
    assert.equal(await f.page.locator('#homework-content').isHidden(), true);
    assert.equal(f.sessionRequests().length, opens);
    await choose(f.page, 'IC2304', refA);
    assert.equal(f.sessionRequests().at(-1).body.studentRef, refA);
  });
  await scenario('Phiên web không có Docs: tải lại A sau đổi B vẫn khôi phục đúng nháp A', { identity: a, independent: true }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    const draft = 'https://chatgpt.com/share/99999999-9999-4999-8999-999999999999';
    await f.page.locator(`#${firstPart}-link`).fill(draft);
    const next = await f.context.newPage();
    await next.goto(`${origin}/speaking-homework/${pageFile}`);
    await next.locator('#homework-content').waitFor({ state: 'visible' });
    await next.locator('#change-student').click();
    await choose(next, 'IC2305', refB);
    await f.page.reload();
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(await f.page.locator(`#${firstPart}-link`).inputValue(), draft);
    assert.equal(f.sessionRequests().at(-1).body.studentRef, refA);
    assert.equal((await f.memory()).identity.id, b.id);
  });
  await scenario('Khôi phục tab giữ xóa chủ động, không tự điền lại link máy chủ hoặc nhận nháp B', { identity: a, serverLink: true }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    const field = f.page.locator(`#${firstPart}-link`);
    await field.filter({ visible: true }).waitFor();
    await f.page.waitForFunction(id => document.getElementById(id).value.includes('aaaaaaaa'), `${firstPart}-link`);
    await field.fill('');
    await f.page.reload();
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(await field.inputValue(), '');
    await f.page.locator('#change-student').click();
    await choose(f.page, 'IC2305', refB);
    await field.fill('https://chatgpt.com/share/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    await f.page.locator('#change-student').click();
    await choose(f.page, 'IC2304', refA);
    assert.equal(await field.inputValue(), '');
    await f.page.reload();
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(await field.inputValue(), '');
  });
  await scenario('Docs riêng chưa gắn lớp vẫn mở và tải lại được khi chưa có nhận diện ERP', { documentIntake: true, query: '?documentId=fixture-private-doc-a' }, async f => {
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(f.sessionRequests().at(-1).body.studentRef, refA);
    const draft = 'https://chatgpt.com/share/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    await f.page.locator(`#${firstPart}-link`).fill(draft);
    await f.page.reload();
    await f.page.locator('#homework-content').waitFor({ state: 'visible' });
    assert.equal(f.sessionRequests().length, 2);
    assert.equal(f.sessionRequests().at(-1).body.documentId, 'fixture-private-doc-a');
    assert.equal(await f.page.locator(`#${firstPart}-link`).inputValue(), draft);
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
