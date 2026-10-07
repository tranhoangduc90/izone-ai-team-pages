// Dữ liệu giả trong Chrome riêng: kiểm trang mở sẵn, phiếu đã đóng và biên nhận khi mạng lỗi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = createRequire(process.env.PLAYWRIGHT_PACKAGE || 'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const studentRef = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';
const assignmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const block = { blockId: '33333333-3333-4333-8333-333333333333', checkpoint: 1,
  title: 'Điều em học được', instructions: '', items: [{ itemVersionId: itemId,
    itemFamilyId: itemId, position: 1, skillCodes: [], interactionType: 'long_text', required: true, prompt: 'Em đã làm được gì?', maxLength: 600 }] };

test('B10/B13/B18: Chrome giữ draft sau hạn, phiếu đóng xem Journey; mất phản hồi đọc lại biên nhận', { timeout: 45000 }, async () => {
  const server = createServer(async (req, res) => {
    try {
      const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!path.startsWith(resolve(root) + sep)) throw new Error('Sai phạm vi');
      res.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] || 'text/plain'));
      res.end(await readFile(path));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [], calls = [];
  await mkdir(resolve(root, 'output/playwright'), { recursive: true });
  try {
    for (const mode of ['close-live', 'closed', 'lost-receipt']) {
      const context = await browser.newContext({ viewport: mode === 'closed' ? { width: 390, height: 844 } : { width: 1024, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(6000);
      page.on('pageerror', e => errors.push(`${mode}:${e.message}`));
      let received = false;
      const window = { canSubmit: mode !== 'closed', completeStudents: 3,
        serverNow: mode === 'closed' ? '2026-10-06T16:00:00Z' : mode === 'close-live' ? '2026-10-06T14:59:57Z' : '2026-10-06T14:00:00Z',
        effectiveClosesAt: '2026-10-06T15:00:00Z', autoClosesAt: '2026-10-06T15:00:00Z' };
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        const json = value => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
        if (url.pathname.endsWith('/progress-log/config.js')) return route.fulfill({ contentType: 'text/javascript', body: `window.PROGRESS_LOG_CONFIG={API_BASE_URL:'${origin}'};` });
        if (!url.pathname.includes('/api/learning/')) return route.continue();
        calls.push({ mode, path: url.pathname });
        if (url.pathname.endsWith('/assignments/open')) return json({ ok: true, assignment: {
          assignmentId, publicToken: assignmentId, sessionNumber: 6, title: 'Phiếu thử hạn nộp',
          class: { id: '1294', name: 'IC2305 · Lớp thử' }, roster: [{ studentRef, name: 'Học viên giả' }],
          definitionHash: 'a'.repeat(64), definition: { kind: 'reflection', blocks: [block] },
          blockReleases: [{ blockId: block.blockId, status: 'open' }], submissionWindow: window } });
        if (url.pathname.endsWith('/attempts/start')) return json({ ok: true, attempt: {
          attemptToken: '44444444-4444-4444-8444-444444444444', draft: {}, draftRevision: 0,
          identity: { studentRef, studentName: 'Học viên giả', className: 'Lớp thử', sessionNumber: 6 }, checkpointSubmissions: [] } });
        if (url.pathname.endsWith('/attempts/draft')) return json({ ok: true, draft: { revision: request.postDataJSON().revision, savedAt: '2026-10-06T14:00:00Z' } });
        if (url.pathname.endsWith('/checkpoints/submit')) return json({ ok: true, checkpointSubmission: { blockId: block.blockId, completeness: 'complete', result: null } });
        if (url.pathname.endsWith('/attempts/submit')) {
          received = true;
          return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Mất phản hồi sau khi lưu.' }) });
        }
        if (url.pathname.endsWith('/attempts/result') && received) return json({ ok: true, receipt: {
          message: 'Đã nhận phiếu.', completeness: 'complete', attendanceStatus: 'self_confirmed' }, result: null });
        if(url.pathname.endsWith('/student/session-comments'))return json({ok:true,classId:'1294',studentRef,comments:[{studentRef,sessionNumber:6,revision:1,visibility:'visible',noteText:'Em đã làm tốt phần ôn tập.',authorDisplayName:'Cô thử nghiệm',updatedAt:'2026-10-06T14:00:00Z'}]});
        if (url.pathname.endsWith('/student/course-journey')) return json({ ok: true, journey: {
          student: { studentRef, name: 'Học viên giả' }, class: { classId: '1294', name: 'Lớp thử' },
          summary: { attendedSessions: 0, submittedComplete: 0, availableReports: 0, totalSessions: 18 }, sessions: [], reports: [],
          coverage: { plannedSessions: 18, knownThroughSession: 6, schedule: 'teacher_confirmed' } } });
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Chưa có biên nhận.' }) });
      });
      await page.goto(`${origin}/progress-log/index.html#assignment=${assignmentId}`);
      await page.locator('#studentSelect').selectOption(studentRef);
      await page.locator('#chooseStudentButton').click();
      if (mode === 'closed') {
        assert.equal(await page.locator('#confirmButton').isVisible(), false);
        await page.locator('#journeyButton').click();
        await page.locator('#journeyView').waitFor({ state: 'visible' });
        assert.match(await page.locator('#journeyPlanCount').textContent(), /18 buổi/);
        assert.equal(calls.some(c => c.mode === mode && c.path.endsWith('/attempts/start')), false);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: resolve(root, 'output/playwright/progress-log-deadline-closed-mobile.png') });
      } else {
        await page.locator('#confirmButton').click();
        await page.locator('#formView').waitFor({ state: 'visible' });
        assert.match(await page.locator('#formContextLabel').textContent(), /Buổi 06/);
        const answer = page.locator('#questionList textarea');
        await answer.fill('Em đã làm được bài nghe và nhận ra lỗi cần sửa.');
        if (mode === 'close-live') {
          await page.locator('#submissionWindowNotice').filter({ hasText: 'đã khóa' }).waitFor();
          assert.equal(await page.locator('#submitButton').isDisabled(), true);
          assert.match(await answer.inputValue(), /Em đã làm được/);
          await page.evaluate(() => document.querySelector('#reflectionForm').requestSubmit());
          assert.equal(calls.some(c => c.mode === mode && c.path.endsWith('/attempts/submit')), false);
          await page.screenshot({ path: resolve(root, 'output/playwright/progress-log-deadline-kept-draft.png') });
        } else {
          await page.locator('#submitButton').click();
          await page.locator('#resultView').waitFor({ state: 'visible' });
          await page.locator('#resultView .session-comment').waitFor();assert.match(await page.locator('#resultView .session-comment').textContent(),/Em đã làm tốt phần ôn tập/);
          assert.match(await page.locator('#attendanceResult').textContent(), /Portal đang được đồng bộ/);
          assert.equal(calls.filter(c => c.mode === mode && c.path.endsWith('/attempts/submit')).length, 1);
          assert.equal(calls.filter(c => c.mode === mode && c.path.endsWith('/attempts/result')).length, 1);
        }
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(done => server.close(done)); }
});
