// Chạy giao diện thật với API và bài giả; chặn mạng ngoài, kiểm thẻ, chuyển trang và tải lại.
// Không tạo bài hoặc gọi AI thật. Khi lỗi, script dừng và báo đúng ca thất bại.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(process.env.PAGES_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const output = path.resolve(process.env.PROOF_DIR || 'output/playwright/draft-viewer');
const backend = process.env.WRITING_BACKEND_ROOT;
assert.ok(backend, 'Thiếu WRITING_BACKEND_ROOT để kiểm cả backend và frontend.');
const { createLmsResultService } = await import(pathToFileURL(path.join(backend, 'src/lms-result-service.js')));
const classRef = '11111111-1111-4111-8111-111111111111';
const studentRef = '22222222-2222-4222-8222-222222222222';
const sessionRef = '33333333-3333-4333-8333-333333333333';
const time = '2026-09-21T01:00:00.000Z';
const links = {
  viewer: `https://ducizone.ddns.net/writing/shared/writing-essays/${'a'.repeat(48)}/edit`,
  legacy: 'https://practice.izone.edu.vn/shared/writing-essays/fixture-example/edit?page=0',
  invalid: 'https://untrusted.example/result',
};
const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const payload = { essays: [1, 2].map(index => ({ id: `fake-${index}`, index,
  content: doc(`Original sentence ${index}.`), suggestedContent: doc(`Corrected sentence ${index}.`), comments: [`Giải thích giả ${index}.`] })) };
const responses = { overview: 'Overview.', body1: 'First outline.', body2: 'Second outline.',
  body1_message: 'Ý chính giả', body1_idea1: 'Ý 1', body1_idea2: 'Ý 2', body2_message: 'Ý đối chiếu', body2_idea1: 'Ý 3', body2_idea2: 'Ý 4',
  body_choice: 'body1', topic_sentence: 'Topic.', idea1_a: 'A', idea1_x: 'X', idea1_b: 'B', idea2_a: 'A', idea2_x: 'X', idea2_b: 'B',
  draft1: 'Original paragraph.', draft2: 'Revised paragraph.', draft2Unlocked: true };
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { const data = await fs.readFile(file); res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.SITE_BASE || `http://127.0.0.1:${server.address().port}/writing-handouts/`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
await fs.mkdir(output, { recursive: true });
const cases = [];

async function runCase(kind, surface, source, retry = false, mobile = false) {
  const label = `${kind}-${surface}-${source}${retry ? '-retry' : ''}${mobile ? '-mobile' : ''}`;
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const errors = []; let draftReads = 0; let checkWrites = 0; let requestsFailed = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.google = { accounts: { id: { initialize() {}, renderButton() {}, prompt() {}, disableAutoSelect() {} } } }; });
  const sectionKeys = kind === 'task1' ? ['overview', 'outline', 'draft'] : ['topic_sentence', 'supporting_idea_1', 'supporting_idea_2', 'draft'];
  const sections = Object.fromEntries(sectionKeys.map(key => [key, { status: 'passed', attemptsWithoutPass: 0 }]));
  const comments = sectionKeys.map((section, index) => ({ commentRef: `fake-comment-${index}`, section, commentNumber: 1, status: 'completed',
    feedback: section === 'draft' ? links[source] : 'Đã đạt.', artifacts: section === 'draft' ? { lmsUrl: links[source] } : {}, createdAt: time }));
  const session = { sessionRef, draftVersion: 1, responses, ...responses, sections, comments, attempts: [], updatedAt: time };
  const student = { studentRef, sessionRef, classRef, className: 'Lớp kiểm thử', displayName: 'Học viên giả', online: false,
    hasStarted: true, progressPercent: 100, filledFields: 15, totalFields: 15, passedSectionCount: sectionKeys.length, checkCount: 4, responses, sections, comments };
  const svc = createLmsResultService({ pool: { query: async (_sql, values) => {
    assert.equal(values[0], sessionRef); return { rowCount: 1, rows: [{ lmsUrl: links[source], updatedAt: time }] };
  } }, fetchImpl: async () => new Response(JSON.stringify(payload)) });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); const pathname = url.pathname;
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname.endsWith('/config.json')) return send({ apiBase: `${new URL(base).origin}/mock/`, googleClientId: 'fake-client', studentMemory: { enabled: false } });
    if (pathname.startsWith('/mock/')) {
      if (pathname.endsWith('/auth/session')) return send({ ok: true, user: { canManage: false } });
      if (pathname.endsWith('/roster')) return send({ ok: true, classes: [{ classRef, className: 'Lớp kiểm thử', students: [{ studentRef, alias: 'Học viên giả' }] }] });
      if (pathname.endsWith('/draft-result')) {
        draftReads++;
        if (retry && draftReads === 1) return send({ ok: false, error: 'LMS_UNAVAILABLE', message: 'Lỗi tải giả.' }, 502);
        try { return send({ ok: true, result: await svc.getDraftResult({ sessionRef }) }); }
        catch (e) { requestsFailed++; return send({ ok: false, error: e.code, message: e.message }, e.status || 500); }
      }
      if (pathname.endsWith('/teacher-comments')) return send({ ok: true, threads: [] });
      if (pathname.endsWith('/provisional-students')) return send({ ok: true, students: [] });
      if (pathname.includes('/admin/live/activities/')) return send({ ok: true, students: [student], generatedAt: time, permissions: { canManage: false } });
      if (pathname.endsWith('/checks') || pathname.includes('/retry')) { checkWrites++; return send({ ok: false }, 500); }
      if (pathname.endsWith('/live')) return send({ ok: true, accepted: true });
      return send({ ok: true, session });
    }
    if (url.hostname === '127.0.0.1' || (process.env.SITE_BASE && url.origin === new URL(base).origin)) return route.continue();
    return route.fulfill({ status: 200, body: '', contentType: 'text/javascript' });
  });
  const slug = kind === 'task1' ? 'pie-app-users-by-age' : 'writing-task2-english-medium-instruction';
  await page.goto(`${base}${surface === 'teacher' ? 'teacher.html' : kind === 'task1' ? 'index.html' : 'lesson.html'}?task=${slug}`);
  if (surface === 'teacher') await page.locator('.teacher-student-card').click();
  else {
    await page.selectOption(kind === 'task1' ? '#class-id' : '#lesson-class', classRef);
    await page.selectOption(kind === 'task1' ? '#student-name' : '#lesson-student', studentRef);
    await page.locator(`${kind === 'task1' ? '#identity-form' : '#lesson-identity-form'} button[type=submit]`).click();
  }
  if (source === 'invalid') {
    await page.locator('.draft-result-message').filter({ hasText: /không hợp lệ|chưa hợp lệ|LMS hợp lệ/ }).waitFor();
    assert.equal(draftReads, 0); assert.equal(await page.locator('.lms-sentence-card').count(), 0);
  } else {
    if (retry) await page.getByRole('button', { name: 'Tải lại kết quả', exact: true }).click();
    await page.locator('.lms-sentence-card').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('.lms-sentence-card').count(), 2, label);
    const first = page.locator('.lms-sentence-card').first();
    for (const expected of ['Original sentence 1.', 'Corrected sentence 1.', 'Giải thích giả 1.']) assert.ok((await first.innerText()).includes(expected), label);
    await page.locator('.lms-page-button').last().click();
    await page.locator('.lms-sentence-card').nth(1).waitFor({ state: 'visible' });
    assert.ok((await page.locator('.lms-sentence-card').nth(1).innerText()).includes('Giải thích giả 2.'));
    if (surface === 'teacher') {
      // Dashboard tự làm mới: phải giữ thẻ thứ hai đang đọc và không gọi tải trùng.
      await page.waitForTimeout(5300);
      assert.equal(await page.locator('.lms-sentence-card').nth(1).isVisible(), true);
    }
    assert.equal(draftReads, retry ? 2 : 1); assert.equal(requestsFailed, 0);
    if (source === 'viewer' && !retry) await page.locator(surface === 'teacher' ? '#teacher-detail' : '.draft-result-panel').screenshot({ path: path.join(output, `${label}.png`) });
  }
  assert.equal(checkWrites, 0, 'Xem/tải lại kết quả đã tạo lượt chấm.'); assert.deepEqual(errors, [], label);
  cases.push({ label, passed: true, draftReads, checkWrites, pageErrors: errors.length });
  await context.close();
}
try {
  for (const kind of ['task1', 'task2']) for (const surface of ['student', 'teacher']) {
    for (const source of ['legacy', 'viewer']) await runCase(kind, surface, source);
    await runCase(kind, surface, 'viewer', true);
  }
  await runCase('task2', 'teacher', 'invalid');
  await runCase('task2', 'student', 'invalid');
  await runCase('task2', 'student', 'viewer', false, true);
  await runCase('task2', 'teacher', 'viewer', false, true);
  const report = { outcome: 'passed', cases, externalWrites: 0 };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
