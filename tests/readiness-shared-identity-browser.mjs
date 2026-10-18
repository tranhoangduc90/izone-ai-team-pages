// Giao diện và bộ nhận diện thật; danh sách, phiên và nháp giả tại ranh giới HTTP.
// Chặn mọi mạng ngoài và audio thật. Assertion kiểm người/nháp/thiết bị quan sát được.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = process.env.READINESS_SOURCE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const out = process.env.IDENTITY_EVIDENCE_DIR;
assert.ok(out); await mkdir(out, { recursive: true });
const common = 'izone:student-identity:v1';
const apiBase = 'https://ducizone.ddns.net:18869/term-mini-k67-api';
const legacyMemory = 'izone:remembered-writing-student:v1:' + apiBase;
const oldState = 'izone:k67-readiness:v1:' + apiBase + ':IC2304';
const a = '11111111-1111-4111-8111-111111111111', b = '44444444-4444-4444-8444-444444444444';
const identity = id => ({ version: 1, identity: id ? { authority: 'erp-contact', id } : null,
  revision: 'fixture_' + (id || 'forgotten'), updatedAt: new Date().toISOString() });
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/empty') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Thử</title>'); }
  const file = path.resolve(root, '.' + (u.pathname.endsWith('/') ? u.pathname + 'index.html' : u.pathname));
  try {
    if (!file.startsWith(path.resolve(root) + path.sep) || /\.(wav|mp3|m4a|enc|bin)$/i.test(file)) throw Error('Blocked');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const site = process.env.READINESS_PUBLIC_BASE || `http://127.0.0.1:${server.address().port}`;
if (process.env.READINESS_PUBLIC_BASE) assert.equal(site, 'https://tranhoangduc90.github.io/izone-ai-team-pages');
const origin = new URL(site).origin;
const browser = await chromium.launch({ channel: 'msedge', headless: true }), results = [];
const target = site + '/term-tests/lam-quen-k67/?class=IC2304';
function session(ref, token, patch = {}) {
  return { id: token, classCode: 'IC2304', studentRef: ref, studentName: ref === a ? 'Học viên A' : 'Học viên B',
    sameComputer: null, sameHeadphones: null, revision: 0, answers: {}, heardSeconds: 0, cacheState: 'not_checked', submittedAt: null,
    practice: { reading: { revision: 0, data: {}, submittedAt: null }, writing: { revision: 0, data: {}, submittedAt: null } }, ...patch };
}
async function setup(options = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const requests = [], external = [], errors = [], sessions = new Map(); let audioFiles = 0, loseOpeningAck = options.openAckLost;
  const seeds = { ...options.seeds };
  if (options.id) seeds[common] = identity(options.id);
  if (options.legacy) seeds[legacyMemory] = { version: 1, studentRef: options.legacy };
  if (options.existing) {
    const ref = options.existing.ref || a, value = session(ref, 'fixture-existing', options.existing.patch);
    sessions.set('fixture-existing', value);
    seeds[oldState] = { token: 'fixture-existing', studentRef: ref, ...options.existing.local };
  }
  ctx.on('page', page => { page.setDefaultTimeout(6000); page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => options.cancel ? dialog.dismiss() : dialog.accept()); });
  await ctx.addInitScript(({ origin, seeds, blocked }) => {
    if (location.origin !== origin) return;
    if (!localStorage.getItem('fixture-context-seeded')) {
      for (const [key, value] of Object.entries(seeds)) localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem('fixture-context-seeded', 'true');
    }
    window.__plays = 0; HTMLMediaElement.prototype.play = function () { window.__plays++; return Promise.resolve(); };
    if (blocked) for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name,
      { configurable: true, get() { throw new DOMException('Fixture storage blocked', 'SecurityError'); } });
  }, { origin, seeds, blocked: options.blocked });
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (req.resourceType() === 'media' || /\.(wav|mp3|m4a|enc|bin)$/i.test(u.pathname) || u.pathname.endsWith('/audio')) {
      audioFiles++; return route.abort();
    }
    if (u.href === site + '/empty') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Thử</title>' });
    if (u.origin === origin && req.method() === 'GET' && (/\.(html|js|mjs|css|svg|png|jpe?g|woff2?|ttf)$/i.test(u.pathname) || u.pathname.endsWith('/'))) return route.continue();
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = req.method() === 'POST' ? req.postDataJSON() : {};
    requests.push({ path: u.pathname, body });
    const send = (value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
    if (u.pathname.endsWith('/student-identity') || u.pathname === '/mapping-api/api/student-identity/resolve') {
      if (options.identityDelay) await new Promise(r => setTimeout(r, options.identityDelay));
      if (options.identityFailure) return send({ ok: false, message: 'Nguồn nhận diện giả tạm lỗi' }, 503);
      const id = body.identity?.id || (body.studentRef === b ? '900002' : '900001');
      const ref = body.studentRef || (id === '900002' ? b : a);
      if (options.termNamespaceDifferent && u.pathname.endsWith('/student-identity')) {
        if (body.studentRef) return send({ ok: true, status: 'missing', identity: null, aliases: [] });
        return send({ ok: true, status: 'unique', identity: { authority: 'erp-contact', id }, aliases: [
          { classId: '1293', classCode: 'IC2304', studentRef: id === '900002' ? '66666666-6666-4666-8666-666666666666' : '33333333-3333-4333-8333-333333333333', studentName: 'Mã riêng trong Term Test' }] });
      }
      if (options.mappingMissingForUuid && body.studentRef && u.pathname === '/mapping-api/api/student-identity/resolve') return send({ ok: true, status: 'missing', identity: null, aliases: [] });
      if (options.missingIdentity) return send({ ok: true, status: 'missing', identity: null, aliases: [] });
      return send({ ok: true, status: 'unique', identity: { authority: 'erp-contact', id }, aliases: [
        { classId: '1293', classCode: 'IC2304', studentRef: ref, studentName: ref === a ? 'Học viên A' : 'Học viên B' }] });
    }
    if (u.origin !== new URL(apiBase).origin || !u.pathname.startsWith('/term-mini-k67-api/api/k67-readiness/v1/')) {
      external.push(u.pathname); return route.abort();
    }
    const endpoint = u.pathname.split('/v1')[1];
    if (endpoint === '/roster') return send({ ok: true, classCode: 'IC2304', students: (options.roster || [a, b]).map(ref => ({ ref, name: ref === a ? 'Học viên A' : 'Học viên B' })) });
    if (endpoint === '/sessions') {
      if (options.openDelay) await new Promise(r => setTimeout(r, options.openDelay));
      if (options.openFailure) return send({ ok: false, message: 'Chưa mở được phiên thử giả' }, 503);
      const token = 'fixture-' + body.requestId;
      if (!sessions.has(token)) sessions.set(token, session(body.studentRef, token));
      if (loseOpeningAck) { loseOpeningAck = false; return send({ ok: false, message: 'Phản hồi mở giả bị mất sau khi đã tạo phiên' }, 503); }
      return send({ ok: true, token, session: options.wrongOwner ? session(b, token) : sessions.get(token) }, 201);
    }
    if (!sessions.has(body.token) || options.expired) return send({ ok: false, error: 'READINESS_SESSION_EXPIRED', message: 'Phiên giả hết hạn' }, 401);
    let current = sessions.get(body.token);
    if (endpoint === '/session') return send({ ok: true, session: options.wrongOwner ? session(b, body.token) : current });
    if (endpoint === '/device') { current.sameComputer = body.sameComputer; current.sameHeadphones = body.sameHeadphones; return send({ ok: true, session: current }); }
    if (endpoint === '/audio-access') return send({ ok: false, message: 'Không tải audio trong phép kiểm danh tính.' }, 503);
    if (endpoint === '/checks') { current.checkReport = body.report; current.checkRevision = body.revision; return send({ ok: true, session: current }); }
    const practice = endpoint.match(/^\/practice\/(reading|writing)\/draft$/);
    if (practice) {
      if (options.saveFailure) return send({ ok: false, message: 'Lỗi lưu nháp giả' }, 503);
      current.practice[practice[1]] = { ...current.practice[practice[1]], revision: body.revision, data: body.data };
      return send({ ok: true, session: current });
    }
    external.push(endpoint); return send({ ok: false, message: 'Ngoài phạm vi fixture' }, 503);
  });
  return { ctx, page: await ctx.newPage(), requests, external, errors, sessions, getAudio: () => audioFiles };
}
async function run(name, options, fn) {
  if (process.env.READINESS_CASE && !new RegExp(process.env.READINESS_CASE).test(name)) return;
  const s = await setup(options);
  try { await fn(s); assert.deepEqual(s.errors, []); assert.deepEqual(s.external, []);
    results.push({ case: name, status: 'passed', blockedAudioRequests: s.getAudio(), audioFilesDownloaded: 0 }); console.log('Đạt:', name);
  } catch (error) {
    results.push({ case: name, status: 'failed', error: error.message });
    await s.page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }).catch(() => {});
    console.error('Lỗi:', name, error.message);
  } finally { await s.ctx.close(); }
}
const selected = (page, ref) => page.waitForFunction(ref => document.querySelector('#student')?.value === ref, ref);
async function choose(page, ref) { await page.locator('#student').selectOption(ref); await page.locator('#confirmPerson').click(); }
async function device(page) { await page.locator('#sameComputer').check(); await page.locator('#sameHeadphones').check(); await page.locator('#deviceContinue').click(); await page.locator('#answer1').waitFor(); }
async function change(page, ref) { await page.locator('#change').click(); await page.locator('#student').waitFor(); if (ref) await choose(page, ref); }
async function currentIdentity(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').identity?.id || null, common); }
async function setIdentity(ctx, id) { const page = await ctx.newPage(); await page.goto(site + '/empty'); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: common, value: identity(id) }); await page.close(); }
try {
  for (const legacy of [undefined, b]) await run('prefill-common-A-' + (legacy ? 'over-old-B' : 'only'), { id: '900001', legacy }, async ({ page, requests }) => {
    await page.goto(target); await selected(page, a); assert.equal(await page.locator('#confirmPerson').isVisible(), true);
    assert.equal(requests.some(r => /\/(sessions|device|audio-access)$/.test(r.path)), false);
  });
  await run('namespace-readiness-prefill-uses-mapping-not-term-roster', { id: '900001', termNamespaceDifferent: true }, async ({ page }) => {
    await page.goto(target); await selected(page, a); assert.equal(await page.locator('#confirmPerson').isVisible(), true);
  });
  await run('namespace-readiness-first-selection-produces-common-identity', { termNamespaceDifferent: true }, async ({ page }) => {
    await page.goto(target); await choose(page, a); await page.locator('#sameComputer').waitFor();
    assert.equal(await currentIdentity(page), '900001');
  });
  await run('first-selection-publishes-after-session', {}, async ({ page, ctx, requests }) => {
    await page.goto(target); await choose(page, b); await page.locator('#sameComputer').waitFor();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').identity?.id === '900002', common);
    const other = await ctx.newPage(); await other.goto(target); await selected(other, b);
    assert.equal(requests.filter(r => r.path.endsWith('/sessions')).length, 1);
  });
  await run('failed-opening-does-not-change-common', { id: '900001', openFailure: true }, async ({ page }) => {
    await page.goto(target); await selected(page, a); await choose(page, b); await page.locator('#notice[data-error=true]').waitFor();
    assert.equal(await currentIdentity(page), '900001');
  });
  await run('opening-ack-lost-reload-reuses-request-and-session', { openAckLost: true }, async ({ page, requests, sessions }) => {
    await page.goto(target); await choose(page, a); await page.getByText('Phản hồi mở giả bị mất', { exact: false }).waitFor();
    await page.reload(); await choose(page, a); await page.locator('#sameComputer').waitFor();
    const opens = requests.filter(r => r.path.endsWith('/sessions')); assert.equal(opens.length, 2);
    assert.equal(opens[0].body.requestId, opens[1].body.requestId); assert.equal(opens[0].body.openingProof, opens[1].body.openingProof); assert.equal(sessions.size, 1);
  });
  await run('legacy-name-only-prefills-without-opening-session', { legacy: a }, async ({ page, requests }) => {
    await page.goto(target); await selected(page, a); assert.equal(requests.some(r => r.path.endsWith('/sessions')), false);
  });
  await run('legacy-k67-uuid-missing-in-mapping-resolves-through-k67', { legacy: a, mappingMissingForUuid: true }, async ({ page, requests }) => {
    await page.goto(target); await selected(page, a); assert.equal(await currentIdentity(page), '900001');
    assert.ok(requests.some(r => r.path.endsWith('/student-identity') && r.body.studentRef === a));
    assert.equal(requests.some(r => r.path.endsWith('/sessions')), false);
  });
  await run('conflicting-old-people-do-not-auto-select', { legacy: a, mappingMissingForUuid: true,
    seeds: { 'reading-practice67-identity': { studentId: b } } }, async ({ page, requests }) => {
    await page.goto(target); await page.getByText('Trình duyệt đang nhớ nhiều người từ các bài cũ.', { exact: false }).waitFor();
    assert.equal(await page.locator('#student').inputValue(), ''); assert.equal(await currentIdentity(page), null);
    assert.equal(requests.some(r => r.path.endsWith('/sessions')), false);
  });
  await run('unchecked-remember-keeps-session-forgets-common', { id: '900001' }, async ({ page }) => {
    await page.goto(target); await selected(page, a); await page.locator('#remember').uncheck(); await page.locator('#confirmPerson').click();
    await page.locator('#sameComputer').waitFor(); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').identity === null, common);
    await page.reload(); await page.locator('#sameComputer').waitFor(); assert.equal(await currentIdentity(page), null);
  });
  await run('device-step-preserved-and-no-audio-before-confirm', { id: '900001' }, async ({ page, requests }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click(); await page.locator('#sameHeadphones').waitFor();
    assert.equal(requests.some(r => r.path.endsWith('/audio-access')), false);
    await device(page); assert.ok(requests.some(r => r.path.endsWith('/device') && r.body.sameComputer && r.body.sameHeadphones));
    await page.waitForFunction(() => document.querySelector('#play')?.textContent === 'Tải lại audio');
    assert.equal(await page.evaluate(() => window.__plays), 0);
  });
  await run('switch-A-B-A-listening-drafts-and-reload', { id: '900001' }, async ({ page }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click(); await device(page);
    await page.locator('#answer1').fill('Nháp A'); await change(page, b); await device(page);
    assert.equal(await page.locator('#answer1').inputValue(), ''); await page.locator('#answer1').fill('Nháp B');
    await change(page, a); await page.locator('#answer1').waitFor(); assert.equal(await page.locator('#answer1').inputValue(), 'Nháp A');
    await page.reload(); await page.locator('#answer1').waitFor(); assert.equal(await page.locator('#answer1').inputValue(), 'Nháp A');
    await change(page, b); await page.locator('#answer1').waitFor(); assert.equal(await page.locator('#answer1').inputValue(), 'Nháp B');
  });
  await run('active-tab-A-reload-global-B-new-tab-B', { id: '900001' }, async ({ page, ctx }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click(); await device(page); await page.locator('#answer1').fill('Tab A');
    await setIdentity(ctx, '900002'); await page.reload(); await page.locator('#answer1').waitFor();
    assert.equal(await page.locator('#answer1').inputValue(), 'Tab A'); assert.equal(await currentIdentity(page), '900002');
    assert.ok((await page.locator('.readiness-person').innerText()).includes('Học viên A'));
    const fresh = await ctx.newPage(); await fresh.goto(target); await selected(fresh, b);
  });
  await run('change-clears-prefill-not-draft', { id: '900001' }, async ({ page }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click(); await page.locator('#sameComputer').waitFor();
    await change(page); assert.equal(await page.locator('#student').inputValue(), ''); assert.equal(await currentIdentity(page), null);
    await page.reload(); await page.locator('#student').waitFor(); assert.equal(await page.locator('#student').inputValue(), '');
  });
  await run('cancel-change-keeps-owner-and-draft', { id: '900001', cancel: true }, async ({ page }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click(); await device(page); await page.locator('#answer1').fill('Không rời');
    await page.locator('#change').click(); assert.equal(await page.locator('#answer1').inputValue(), 'Không rời'); assert.equal(await currentIdentity(page), '900001');
  });
  await run('delayed-prefill-does-not-overwrite-manual-selection', { id: '900001', identityDelay: 350 }, async ({ page }) => {
    await page.goto(target); await page.locator('#student').selectOption(b); await page.waitForTimeout(650); assert.equal(await page.locator('#student').inputValue(), b);
  });
  await run('identity-failure-manual-session-still-works', { id: '900001', identityFailure: true }, async ({ page }) => {
    await page.goto(target); await choose(page, b); await page.locator('#sameComputer').waitFor(); assert.equal(await currentIdentity(page), '900001');
  });
  await run('missing-or-outside-roster-does-not-prefill', { id: '900001', roster: [b] }, async ({ page }) => {
    await page.goto(target); await page.locator('#student').waitFor(); await page.waitForTimeout(250); assert.equal(await page.locator('#student').inputValue(), '');
  });
  await run('blocked-storage-manual-session', { blocked: true }, async ({ page }) => {
    await page.goto(target); await choose(page, a); await page.locator('#sameComputer').waitFor();
  });
  await run('missing-common-identity-manual-session', { id: '900001', missingIdentity: true }, async ({ page }) => {
    await page.goto(target); await page.locator('#student').waitFor(); await page.waitForTimeout(200);
    assert.equal(await page.locator('#student').inputValue(), ''); await choose(page, b); await page.locator('#sameComputer').waitFor();
    assert.equal(await currentIdentity(page), '900001'); await page.getByText('Đã xác nhận người học; chưa cập nhật được ghi nhớ chung.', { exact: false }).waitFor();
  });
  await run('late-response-after-other-tab-changes-person', { id: '900001', identityDelay: 500 }, async ({ page, ctx, requests }) => {
    await page.goto(target); await page.waitForFunction(() => Boolean(document.querySelector('#student')));
    while (!requests.some(r => r.body.identity)) await page.waitForTimeout(10);
    await setIdentity(ctx, '900002'); await page.waitForTimeout(650);
    assert.equal(await page.locator('#student').inputValue(), ''); assert.equal(await currentIdentity(page), '900002');
  });
  await run('other-tab-changes-during-confirmation-not-overwritten', { id: '900001', openDelay: 500 }, async ({ page, ctx, requests }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click();
    while (!requests.some(r => r.path.endsWith('/sessions'))) await page.waitForTimeout(10);
    await setIdentity(ctx, '900002'); await page.locator('#sameComputer').waitFor(); assert.equal(await currentIdentity(page), '900002');
    assert.ok((await page.locator('.readiness-person').innerText()).includes('Học viên A'));
  });
  await run('reload-A-after-other-tab-forgets-does-not-resurrect', { id: '900001' }, async ({ page, ctx }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click(); await page.locator('#sameComputer').waitFor();
    await setIdentity(ctx, null); await page.reload(); await page.locator('#sameComputer').waitFor();
    assert.equal(await currentIdentity(page), null); assert.ok((await page.locator('.readiness-person').innerText()).includes('Học viên A'));
  });
  await run('unsaved-draft-and-storage-failure-blocks-switch', { id: '900001' }, async ({ page }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click(); await device(page);
    await page.evaluate(() => { const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key.startsWith('izone:k67-readiness:')) throw new DOMException('Quota giả', 'QuotaExceededError'); return original.call(this, key, value); }; });
    await page.locator('#answer1').fill('Nháp chưa giữ được'); await page.locator('#change').click();
    await page.getByText('Chưa giữ được bản nháp.', { exact: false }).waitFor();
    assert.equal(await page.locator('#answer1').inputValue(), 'Nháp chưa giữ được'); assert.equal(await currentIdentity(page), '900001');
  });
  await run('wrong-session-owner-rejected-without-remembering', { wrongOwner: true }, async ({ page }) => {
    await page.goto(target); await choose(page, a); await page.getByText('Danh tính bản lưu không khớp phiên.', { exact: false }).waitFor();
    assert.equal(await currentIdentity(page), null); assert.equal(await page.locator('#sameComputer').count(), 0);
  });
  await run('scoped-state-with-wrong-owner-not-restored', { id: '900001' }, async ({ page }) => {
    await page.goto(target); await selected(page, a); await page.locator('#confirmPerson').click(); await page.locator('#sameComputer').waitFor();
    await page.addInitScript(({ key, ref }) => { const value = JSON.parse(localStorage.getItem(key)); value.studentRef = ref; localStorage.setItem(key, JSON.stringify(value)); }, { key: oldState + ':student:' + a, ref: b });
    await page.reload(); await selected(page, a); assert.equal(await page.locator('#sameComputer').count(), 0);
  });
  await run('old-draft-kept-on-migration-and-person-change', { id: '900002', existing: { ref: a, local: { revision: 2, answers: { 1: 'Bản cũ A' } }, patch: { sameComputer: true, sameHeadphones: true } } }, async ({ page }) => {
    await page.goto(target); const before = await page.evaluate(key => localStorage.getItem(key), oldState);
    await page.reload(); await page.locator('#answer1').waitFor(); assert.equal(await page.locator('#answer1').inputValue(), 'Bản cũ A');
    await change(page, b); await page.locator('#sameComputer').waitFor();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), oldState), before);
    await change(page, a); await page.locator('#answer1').waitFor(); assert.equal(await page.locator('#answer1').inputValue(), 'Bản cũ A');
  });
  await run('server-save-failure-still-keeps-local-practice-draft', { id: '900001', saveFailure: true, existing: { ref: a, patch: { submittedAt: '2026-10-01T00:00:00.000Z' } } }, async ({ page }) => {
    await page.goto(target); await page.reload(); await page.locator('#openWriting').click(); await page.locator('#writingText:enabled').fill('Nháp chờ mạng');
    await page.locator('#practiceSave').click(); await page.getByText('Chưa đồng bộ. Nháp hiện giữ trên máy;', { exact: false }).waitFor();
    await change(page, b); await page.locator('#sameComputer').waitFor(); await change(page, a);
    await page.locator('#writingText:enabled').waitFor(); assert.equal(await page.locator('#writingText').inputValue(), 'Nháp chờ mạng');
  });
  await run('legacy-active-session-reload-keeps-A-global-B', { id: '900002', existing: { ref: a } }, async ({ page }) => {
    // Dữ liệu phiên cũ chỉ được phục hồi khi tải lại, không dùng cho tab mở mới.
    await page.goto(site + '/empty'); await page.goto(target); await page.reload(); await page.locator('#sameComputer').waitFor();
    assert.ok((await page.locator('.readiness-person').innerText()).includes('Học viên A')); assert.equal(await currentIdentity(page), '900002');
    assert.ok(await page.evaluate(key => Boolean(localStorage.getItem(key)), oldState));
  });
  for (const skill of ['reading', 'writing']) await run('switch-drafts-' + skill, { id: '900001', existing: { ref: a, patch: { submittedAt: '2026-10-01T00:00:00.000Z' } } }, async ({ page }) => {
    await page.goto(target); await page.reload(); await page.locator(skill === 'reading' ? '#openReading' : '#openWriting').click();
    const field = skill === 'reading' ? '#answer1' : '#writingText'; await page.locator(field + ':enabled').fill('Nháp riêng A');
    await page.locator('#practiceSave').click(); await page.waitForFunction(() => document.querySelector('#saveStatus')?.textContent.includes('Đã lưu và đọc lại'));
    await change(page, b); await page.locator('#sameComputer').waitFor(); await change(page, a);
    await page.locator(field + ':enabled').waitFor(); assert.equal(await page.locator(field).inputValue(), 'Nháp riêng A');
    await page.reload(); await page.locator(field + ':enabled').waitFor(); assert.equal(await page.locator(field).inputValue(), 'Nháp riêng A');
  });
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ mode: process.env.READINESS_PUBLIC_BASE ? 'public-frontend-http-fixtures' : 'isolated-http-fixtures', results, audioFilesDownloaded: 0 }, null, 2), 'utf8');
}
console.log(JSON.stringify({ passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length }));
if (results.some(r => r.status === 'failed')) process.exitCode = 1;
