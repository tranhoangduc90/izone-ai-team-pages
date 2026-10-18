// Giao diện Writing/handout thật, dữ liệu và API giả, chặn mọi mạng ngoài/media.
// Kiểm tự vào, phiên đúng chủ, giữ nháp và chặn đổi khi lưu lỗi; không gọi AI.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createState } from '../writing-handouts/lesson5-demo/core.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url))), out = process.env.IDENTITY_EVIDENCE_DIR;
assert.ok(out); await mkdir(out, { recursive: true });
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
const classRef = '33333333-3333-4333-8333-333333333333';
const sa = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sb = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key = 'izone:student-identity:v1';
const identity = id => ({ version: 1, identity: { authority: 'erp-contact', id }, revision: 'fixture_' + id, updatedAt: new Date().toISOString() });
const variants = { task1: ['sample-task', 'index.html'], task2: ['writing-task2-practice-template', 'lesson.html'],
  lesson13: ['writing-lesson13-young-leaders', 'lesson.html'], bax5: ['lesson5', 'lesson5/'], bax7: ['lesson7', 'lesson7/'], bax9: ['lesson9', 'lesson9/'] };
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://local');
  if (u.pathname === '/empty') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Thử</title>'); }
  const file = path.resolve(root, '.' + (u.pathname.endsWith('/') ? u.pathname + 'index.html' : u.pathname));
  try { if (!file.startsWith(root + path.sep) || /\.(mp3|wav|m4a|ogg|enc)$/i.test(file)) throw Error('Blocked');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
function selectors(kind) { const bax = kind.startsWith('bax'), lesson = !bax && kind !== 'task1';
  return { bax, lesson, workspace: bax ? '#workspace' : lesson ? '#lesson-workspace' : '#workspace',
    form: bax ? '#login-form' : lesson ? '#lesson-identity-form' : '#identity-form',
    classes: bax ? '#class-select' : lesson ? '#lesson-class' : '#class-id',
    students: bax ? '#student-select' : lesson ? '#lesson-student' : '#student-name',
    error: lesson ? '#lesson-identity-error' : '#identity-error',
    change: bax ? '#logout' : '#change-active-student', save: lesson ? '#lesson-save' : '#manual-save' };
}
const pageUrl = kind => `${origin}/writing-handouts/${variants[kind][1]}${kind.startsWith('bax') ? '' : '?task=' + variants[kind][0]}`;
async function setup(kind, options) {
  const s = selectors(kind), slug = variants[kind][0], ctx = await browser.newContext({ serviceWorkers: 'block' });
  const errors = [], unexpected = [], requests = [], sessions = new Map();
  const lesson = { activity: slug, number: Number(slug.replace('lesson', '')) || 5, title: 'Đề giả để kiểm nhận diện', topic: 'Synthetic question.',
    defaultClass: classRef, classes: [classRef], body: kind === 'bax9' ? 1 : 2, aInstruction: 'Hướng dẫn giả', whyOptions: ['Gợi ý giả'],
    ...(kind === 'bax9' ? { workflowMode: 'whole-chain-v1' } : {}) };
  const roster = { ok: true, activity: { slug }, classes: [{ classRef, className: 'IC2304', students: [
    { studentRef: a, displayName: 'Học viên A', alias: 'Học viên A' }, { studentRef: b, displayName: 'Học viên B', alias: 'Học viên B' }] }] };
  function state(ref) {
    const sid = ref === b ? sb : sa;
    if (!sessions.has(sid)) sessions.set(sid, { ...(s.bax ? createState(0, lesson) : { draftVersion: 0, sections: {}, comments: [], attempts: [], responses: {} }),
      ref: sid, sessionRef: sid, activity: slug, activitySlug: slug, classRef, studentRef: ref, updatedAt: new Date().toISOString(),
      ...(s.bax ? { vocabulary: {}, commentThreads: [], submittedSections: [], processing: {} } : {}) });
    return sessions.get(sid);
  }
  ctx.on('page', p => { p.setDefaultTimeout(8000); p.on('pageerror', e => errors.push(e.message)); });
  await ctx.addInitScript(({ origin, key, initial }) => { if (location.origin === origin && initial && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial)); },
    { origin, key, initial: options.remembered ? identity('900001') : null });
  await ctx.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), body = req.postDataJSON();
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS', 'access-control-allow-headers': 'content-type,authorization,if-match' };
    const send = (value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (/\.(mp3|wav|m4a|ogg|enc)$/i.test(url.pathname)) { unexpected.push('media'); return route.abort(); }
    if (url.pathname === '/mapping-api/api/student-identity/resolve') {
      if(options.identityDelay)await new Promise(resolve=>setTimeout(resolve,options.identityDelay));
      const id = body.identity?.id || (body.studentRef === b ? '900002' : '900001');
      return send({ ok: true, status: 'unique', identity: { authority: 'erp-contact', id }, aliases: [
        { classId: '1293', classCode: 'IC2304', studentRef: id === '900002' ? b : a, studentName: id === '900002' ? 'Học viên B' : 'Học viên A' }] });
    }
    if (url.origin === origin && url.pathname === '/writing-handouts/config.json') return send({ apiBase: origin + '/writing-api/' });
    const prefix = s.bax ? '/api/handout67/v1' : '/writing-api/api/v1';
    if (url.pathname.startsWith(prefix)) {
      const routePath = url.pathname.slice(prefix.length); requests.push({ path: routePath, method: req.method(), body });
      if (routePath === '/lessons/' + slug) return send({ ok: true, lesson });
      if (routePath === '/roster' || routePath.endsWith('/roster')) return send(roster);
      if (routePath === (s.lesson ? '/lesson-sessions' : '/sessions') && req.method() === 'POST') {
        const owner = options.wrongOwner ? b : body.studentRef;
        return send({ ok: true, session: state(owner), ...(s.bax ? { token: 'fixture-token-' + owner } : {}) }, 201);
      }
      if (routePath.endsWith('/teacher-comments')) return send({ ok: true, threads: [] });
      if (routePath.endsWith('/live')) return send({ ok: true, accepted: true });
      const match = /^\/(?:lesson-sessions|sessions)\/([^/]+)(?:\/(draft|responses))?$/.exec(routePath);
      if (match) {
        const current = sessions.get(match[1]); assert.ok(current, 'Chỉ đọc đúng phiên đã mở');
        if (match[2] && req.method() === 'PUT') {
          if (options.saveFailure) return send({ ok: false, message: 'Lỗi lưu giả', error: 'FIXTURE_SAVE_FAILED' }, 503);
          if (s.bax) { Object.assign(current.responses, body.responses); current.version++; }
          else { if (s.lesson) Object.assign(current.responses, body.responses); else Object.assign(current, body); current.draftVersion++; }
          current.updatedAt = new Date().toISOString();
        }
        return send({ ok: true, session: current });
      }
      unexpected.push(routePath); return send({ ok: false, message: 'Ngoài fixture' }, 503);
    }
    if (url.origin === origin) return route.continue();
    unexpected.push(url.origin); return route.abort();
  });
  return { ...s, slug, ctx, page: await ctx.newPage(), errors, unexpected, requests, sessions };
}
async function open(s, manual = false) {
  await s.page.goto(pageUrl(s.kind));
  if (manual) {
    await s.page.locator(s.classes).selectOption(classRef); await s.page.locator(s.students).selectOption(a);
    await s.page.locator(s.form + ' [type="submit"]').click();
    if (s.bax) await s.page.locator('#confirm-button').click();
  }
  await s.page.locator(s.workspace).waitFor();
}
async function run(kind, name, options, fn) {
  const s = { ...await setup(kind, options), kind };
  try { await fn(s); assert.deepEqual(s.errors, []); assert.deepEqual(s.unexpected, []);
    assert.equal(s.requests.some(r => /\/(checks|attest|vocabulary)/.test(r.path)), false);
    results.push({ case: kind + '-' + name, status: 'passed' }); console.log('Đạt:', kind + '-' + name);
  } catch (error) {
    results.push({ case: kind + '-' + name, status: 'failed', error: error.message, errors: s.errors, unexpected: s.unexpected, requests: s.requests });
    await s.page.screenshot({ path: path.join(out, kind + '-' + name + '-failure.png'), fullPage: true }); throw error;
  } finally { await s.ctx.close(); }
}
const field = s => s.page.locator(s.workspace + ' textarea:not([disabled])').first();
try {
  const chosen = process.env.IDENTITY_WRITING_VARIANT ? [process.env.IDENTITY_WRITING_VARIANT] : Object.keys(variants);
  for (const kind of chosen) {
    assert.ok(variants[kind]);
    await run(kind, 'remembered-auto', { remembered: true }, async s => { await open(s);
      assert.equal(await s.page.locator(s.form).isVisible(), false); assert.equal(await s.page.locator(s.change).isVisible(), true); });
    await run(kind, 'first-producer', {identityDelay:1200}, async s => { await open(s, true);
      assert.equal(await s.page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.identity?.id,key),'900001'); });
    await run(kind, 'wrong-session-owner-blocked', { remembered: true, wrongOwner: true }, async s => {
      await s.page.goto(pageUrl(kind));
      if (s.bax) await s.page.locator('#toast:not([hidden])').waitFor(); else await s.page.locator(s.error + ':not([hidden])').waitFor();
      assert.equal(await s.page.locator(s.workspace).isVisible(), false);
      assert.equal(await s.page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900001');
    });
    await run(kind, 'pinned-reload-keeps-draft-A-and-memory-B', { remembered: true }, async s => {
      await open(s);
      const saved = s.page.waitForResponse(r => r.request().method() === 'PUT' && /\/(responses|draft)$/.test(new URL(r.url()).pathname));
      await field(s).fill('Nháp riêng của A');
      if (!s.bax) await s.page.locator(s.save).click();
      await saved;
      const other = await s.ctx.newPage(); await other.goto(origin + '/empty');
      await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: identity('900002') });
      await s.page.reload(); await s.page.locator(s.workspace).waitFor();
      assert.equal(await field(s).inputValue(), 'Nháp riêng của A');
      assert.equal(await s.page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900002');
    });
    await run(kind, 'failed-save-blocks-switch', { remembered: true, saveFailure: true }, async s => {
      await open(s); await field(s).fill('Nháp chưa lưu của A'); await s.page.locator(s.change).click();
      await s.page.waitForTimeout(200);
      assert.equal(await s.page.locator(s.workspace).isVisible(), true); assert.equal(await field(s).inputValue(), 'Nháp chưa lưu của A');
      assert.equal(await s.page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900001');
    });
    await run(kind, 'switch-does-not-auto-return-A', { remembered: true }, async s => {
      await open(s); await s.page.locator(s.change).click(); await s.page.locator(s.form).waitFor();
      assert.equal(await s.page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity, key), null);
      await s.page.reload(); await s.page.locator(s.form).waitFor(); assert.equal(await s.page.locator(s.workspace).isVisible(), false);
    });
  }
} finally { await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
  await browser.close(); await new Promise(r => server.close(r)); }
