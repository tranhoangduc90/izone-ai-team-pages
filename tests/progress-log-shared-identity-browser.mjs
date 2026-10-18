// Phiếu thật với API và danh tính giả. Chặn mạng ngoài, không ghi điểm danh/Portal.
// Kiểm tự vào, đúng người, nháp, phiếu đóng và lỗi lưu; không tự nộp checkpoint.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url))), out = process.env.IDENTITY_EVIDENCE_DIR;
assert.ok(out); await mkdir(out, { recursive: true });
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
const assignmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', blockId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444', attemptToken = '55555555-5555-4555-8555-555555555555';
const key = 'izone:student-identity:v1';
const identity = id => ({ version: 1, identity: { authority: 'erp-contact', id }, revision: 'fixture_' + id, updatedAt: new Date().toISOString() });
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://local');
  if (u.pathname === '/empty') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Thử</title>'); }
  const file = path.resolve(root, '.' + (u.pathname.endsWith('/') ? u.pathname + 'index.html' : u.pathname));
  try { if (!file.startsWith(root + path.sep) || /\.(mp3|wav|enc|m4a|ogg)$/.test(file)) throw Error('Blocked');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream'); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ channel: 'msedge', headless: true }), results = [];
async function setup(options) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' }), errors = [], requests = [], unexpected = [];
  let started, release;
  const startedRequest = new Promise(r => started = r), gate = new Promise(r => release = r);
  ctx.on('page', p => { p.setDefaultTimeout(8000); p.on('pageerror', e => errors.push(e.message)); });
  await ctx.addInitScript(({ origin, key, initial, blocked }) => {
    if (location.origin !== origin) return;
    if (initial && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
    if (blocked) for (const name of ['sessionStorage', 'localStorage']) Object.defineProperty(window, name,
      { configurable: true, get() { throw new DOMException('Fixture storage blocked', 'SecurityError'); } });
  }, { origin, key, initial: options.remembered ? identity('900001') : null, blocked: options.blocked });
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url()), body = req.postDataJSON();
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'content-type' };
    const send = (value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (u.pathname === '/mapping-api/api/student-identity/resolve') {
      if(options.identityDelay)await new Promise(resolve=>setTimeout(resolve,options.identityDelay));
      const id = body.identity?.id || (body.studentRef === b ? '900002' : '900001');
      return send({ ok: true, status: 'unique', identity: { authority: 'erp-contact', id }, aliases: [
        { classId: '1293', classCode: 'IC2304', studentRef: id === '900002' ? b : a, studentName: id === '900002' ? 'Học viên B' : 'Học viên A' }] });
    }
    if (u.origin !== origin) { unexpected.push(u.origin); return route.abort(); }
    if (u.pathname === '/progress-log/config.js') return route.fulfill({ contentType: 'text/javascript', body: `window.PROGRESS_LOG_CONFIG={API_BASE_URL:${JSON.stringify(origin)}};` });
    if (!u.pathname.startsWith('/api/learning/')) return route.continue();
    const endpoint = u.pathname.slice('/api/learning'.length); requests.push({ path: endpoint, body });
    if (endpoint === '/assignments/open') return send({ ok: true, assignment: { assignmentId, publicToken: assignmentId, sessionNumber: 6, title: 'Phiếu nhận diện thử',
      courseCode: '67', class: { id: '1293', name: 'IC2304' }, roster: [{ studentRef: a, name: 'Học viên A' }, { studentRef: b, name: 'Học viên B' }],
      definitionHash: 'a'.repeat(64), definition: { kind: 'reflection', blocks: [{ blockId, checkpoint: 1, title: 'Ghi nhận', instructions: '', items: [
        { itemVersionId: itemId, itemFamilyId: itemId, position: 1, skillCodes: [], interactionType: 'long_text', required: true, prompt: 'Em đã làm được gì?', maxLength: 600 }] }] },
      blockReleases: [{ blockId, status: 'open' }], submissionWindow: { canSubmit: !options.closed, serverNow: new Date().toISOString(),
        effectiveClosesAt: new Date(Date.now() + (options.closed ? -3600000 : 3600000)).toISOString(), completeStudents: 0 } } });
    if (endpoint === '/attempts/start') {
      started(); if (options.delay) await gate;
      const ref = options.wrongOwner ? b : body.studentRef;
      return send({ ok: true, attempt: { attemptToken, assignmentId, definitionHash: 'a'.repeat(64), draftRevision: 0, draft: {}, checkpointSubmissions: [],
        identity: { studentRef: ref, studentName: ref === b ? 'Học viên B' : 'Học viên A', classId: '1293', className: 'IC2304', sessionNumber: 6 } } });
    }
    if (endpoint === '/attempts/draft') return options.saveFailure ? send({ ok: false, message: 'Lỗi lưu giả' }, 503) : send({ ok: true, draft: { revision: body.revision } });
    if (endpoint === '/student/course-journey') return send({ ok: true, journey: { student: { studentRef: body.studentRef, name: 'Học viên A' }, class: { classId: '1293', name: 'IC2304' },
      summary: { attendedSessions: 0, submittedComplete: 0, availableReports: 0, totalSessions: 18 }, sessions: [], reports: [], coverage: { plannedSessions: 18, knownThroughSession: 6, schedule: 'teacher_confirmed' } } });
    if (endpoint === '/student/session-comments') return send({ ok: true, classId: '1293', studentRef: a, comments: [] });
    unexpected.push(endpoint); return send({ ok: false, message: 'Ngoài fixture' }, 503);
  });
  return { ctx, page: await ctx.newPage(), errors, requests, unexpected, startedRequest, release };
}
const url = origin + '/progress-log/index.html#assignment=' + assignmentId;
async function run(name, options, fn) {
  const s = await setup(options);
  try { await fn(s); assert.deepEqual(s.errors, []); assert.deepEqual(s.unexpected, []);
    assert.equal(s.requests.some(r => /\/(?:checkpoints\/submit|attempts\/submit)$/.test(r.path)), false);
    results.push({ case: name, status: 'passed' }); console.log('Đạt:', name);
  } catch (error) { results.push({ case: name, status: 'failed', error: error.message, errors: s.errors, requests: s.requests });
    await s.page.screenshot({ path: path.join(out, name + '-failure.png'), fullPage: true }); throw error;
  } finally { s.release(); await s.ctx.close(); }
}
async function manual(page) { await page.locator('#studentSelect').selectOption(a); await page.locator('#chooseStudentButton').click();
  await page.locator('#confirmButton').click(); await page.locator('#formView').waitFor(); }
try {
  await run('remembered-auto-opens-form-without-submit', { remembered: true }, async ({ page }) => {
    await page.goto(url); await page.locator('#formView').waitFor(); assert.equal(await page.locator('#confirmView').isVisible(), false);
    assert.match(await page.locator('#studentNameLabel').innerText(), /Học viên A/); assert.equal(await page.locator('#progressLogChangeStudent').isVisible(), true);
  });
  await run('first-producer', {identityDelay:1200}, async ({ page }) => { await page.goto(url); await manual(page);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.identity?.id,key),'900001'); });
  await run('pinned-reload-keeps-A-draft-while-memory-B', { remembered: true }, async ({ page, ctx }) => {
    await page.goto(url); await page.locator('#formView').waitFor(); await page.locator('#questionList textarea').fill('Nháp A còn nguyên');
    const other = await ctx.newPage(); await other.goto(origin + '/empty');
    await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: identity('900002') });
    await page.reload(); await page.locator('#formView').waitFor(); assert.equal(await page.locator('#questionList textarea').inputValue(), 'Nháp A còn nguyên');
    assert.match(await page.locator('#studentNameLabel').innerText(), /Học viên A/);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900002');
  });
  await run('wrong-attempt-owner-blocked', { remembered: true, wrongOwner: true }, async ({ page }) => {
    await page.goto(url); await page.locator('#notice').filter({ hasText: 'chưa khớp' }).waitFor();
    assert.equal(await page.locator('#formView').isVisible(), false); assert.equal(await page.locator('#confirmView').isVisible(), true);
  });
  await run('blocked-storage-manual', { blocked: true }, async ({ page }) => { await page.goto(url); await manual(page); });
  await run('late-auto-response-not-applied', { remembered: true, delay: true }, async ({ page, ctx, startedRequest, release }) => {
    await page.goto(url); await startedRequest; const other = await ctx.newPage(); await other.goto(origin + '/empty');
    await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: identity('900002') });
    release(); await page.locator('#notice').filter({ hasText: 'vừa đổi' }).waitFor(); assert.equal(await page.locator('#formView').isVisible(), false);
  });
  await run('failed-save-keeps-owner-and-draft', { remembered: true, saveFailure: true }, async ({ page }) => {
    await page.goto(url); await page.locator('#formView').waitFor(); await page.locator('#questionList textarea').fill('Nháp chưa lưu của A');
    await page.locator('#progressLogChangeStudent').click(); await page.locator('#notice').filter({ hasText: 'Chưa lưu xong' }).waitFor();
    assert.equal(await page.locator('#formView').isVisible(), true); assert.equal(await page.locator('#questionList textarea').inputValue(), 'Nháp chưa lưu của A');
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900001');
  });
  await run('closed-form-opens-journey-without-new-attempt', { remembered: true, closed: true }, async ({ page, requests }) => {
    await page.goto(url); await page.locator('#journeyView').waitFor(); assert.equal(requests.some(r => r.path === '/attempts/start'), false);
  });
} finally { await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2), 'utf8'); await browser.close(); await new Promise(r => server.close(r)); }
