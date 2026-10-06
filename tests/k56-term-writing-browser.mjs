// Dữ liệu vào: hai trang Term K56 từ source Pages và phản hồi API giả cho lớp/học viên giả.
// Việc chính: mở Chrome, xem trạng thái đang chấm, cập nhật điểm và mở lại bài chấm của đúng Task.
// Kết quả: kiểm giao diện và định danh; mọi API thật bị chặn, lỗi hiện ở bài test.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modules = process.env.CODEX_NODE_MODULES || resolve(
  process.env.USERPROFILE || '', '.cache', 'codex-runtimes',
  'codex-primary-runtime', 'dependencies', 'node', 'node_modules'
);
const { chromium } = createRequire(pathToFileURL(resolve(modules, 'playwright', 'package.json')).href)('playwright');
const studentRef = '11111111-1111-4111-8111-111111111111';
const attemptToken = '22222222-2222-4222-8222-222222222222';
const classCode = 'IC5601';
const essay = 'The figures show a clear change over time. This is a synthetic Writing answer for a browser test.';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

async function servePages() {
  // Chỉ phục vụ file thuộc worktree thử, không có route API hay ghi dữ liệu.
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const target = resolve(root, `.${relative}`);
    if (!target.startsWith(`${root}${sep}`)) return response.writeHead(403).end();
    try {
      response.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream' });
      response.end(await readFile(target));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  return server;
}

function resultPayload({ slug, taskNumber, ready }) {
  // Phản hồi mô phỏng đúng hợp đồng kết quả; không chứa dữ liệu học viên thật.
  const readingTotal = taskNumber === 1 ? 40 : 26;
  const grading = ready ? {
    status: 'ready', ready: true, writingScore: 7.5,
    tasks: [{
      taskNumber, taskScore: 7.5, wordCount: essay.split(/\s+/u).length,
      report: 'Nhận xét tổng hợp của bài giả.',
      criteria: ['TA', 'CC', 'LR', 'GRA'].map(code => ({
        code, name: code, bandScore: 7.5, feedback: `Nhận xét ${code} của bài giả.`, components: []
      }))
    }]
  } : { status: 'processing', ready: false, tasks: [] };
  return {
    studentName: 'Học viên giả A', className: classCode, completed: true,
    portalSyncStatus: 'synced',
    writing: { started: true, submitted: true, [ `task${taskNumber}` ]: essay, grading },
    result: {
      testTitle: slug === 'term-test-1-k56' ? 'Term Test 1 · Khóa 56' : 'Term Test 2 · Khóa 56',
      listening: { correct: 30, total: 40, details: [], typeStats: [] },
      reading: { correct: 20, total: readingTotal, details: [], typeStats: [] }
    }
  };
}

for (const { slug, taskNumber } of [
  { slug: 'term-test-1-k56', taskNumber: 2 },
  { slug: 'term-test-2-k56', taskNumber: 1 }
]) {
  test(`${slug}: đang chấm, nhận điểm và mở lại đúng bài trên Chrome`, async () => {
    const server = await servePages();
    const siteBase = `http://127.0.0.1:${server.address().port}/`;
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const blocked = [];
    const errors = [];
    const calls = [];
    let ready = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ key, ref, token }) => {
      localStorage.setItem(key, JSON.stringify({
        studentRef: ref, studentName: 'Học viên giả A', attemptToken: token,
        completed: true, writingStarted: true, writingSubmitted: true
      }));
    }, { key: `izone-test:${slug}:${classCode}`, ref: studentRef, token: attemptToken });
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (/\/k56(?:-test2)?-shared\/config\.js$/u.test(url.pathname)) {
        return route.fulfill({ contentType: 'text/javascript', body: "window.TERM_TEST_APP_CONFIG={API_BASE_URL:'https://ducizone.ddns.net/mapping-api'};" });
      }
      if (url.pathname === '/mapping-api/api/term-tests/roster') {
        return route.fulfill({ json: { class: { name: classCode }, students: [{ ref: studentRef, name: 'Học viên giả A' }] } });
      }
      if (url.pathname === '/mapping-api/api/term-tests/result' && request.method() === 'POST') {
        calls.push(request.postDataJSON());
        return route.fulfill({ json: resultPayload({ slug, taskNumber, ready }) });
      }
      if (url.pathname === `/mapping-api/api/term-tests/${slug}/attempt/prepare`) {
        return page.evaluate(() => window.K56_TERM_TEST_CONTENT).then(content => route.fulfill({ json: {
          content, serverNow: new Date().toISOString(),
          attemptToken, examMode: 'lis_first', nextSection: 'result', completed: true,
          listeningSubmitted: true, readingSubmitted: true, writingSubmittedAt: new Date().toISOString()
        } }));
      }
      if (url.pathname === '/mapping-api/api/term-tests/result/stream') {
        return route.fulfill({ status: 404, json: { message: 'Fixture: dùng nút kiểm tra kết quả.' } });
      }
      if (request.method() === 'GET' && request.url().startsWith(siteBase)) return route.continue();
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    });

    try {
      await page.goto(`${siteBase}term-tests/${slug}-computer-based/?class=${classCode}`);
      const status = page.locator('#writingSubmissionResult .writing-grading-status');
      try {
        await status.waitFor({ state: 'visible' });
      } catch (error) {
        throw new Error(`Không mở được kết quả giả: ${JSON.stringify({
          body: (await page.locator('body').innerText()).slice(0, 1200),
          calls: calls.length, blocked, errors
        })}`, { cause: error });
      }
      assert.equal(await status.innerText(), 'Phần Writing của bạn đang được giáo viên chấm điểm, kết quả sẽ được hiển thị sau');
      assert.equal(await page.locator('.writing-score-card.is-action').count(), 0);
      assert.ok(calls.length >= 2, 'Chưa đi qua cả khôi phục lượt và tải kết quả');
      assert.ok(calls.every(call => call.attemptToken === attemptToken), 'Lượt kết quả bị đổi định danh');

      assert.equal(await page.getByRole('button', { name: 'Kiểm tra kết quả ngay' }).count(), 0);
      const details = page.locator('#questionDetails details');
      await details.nth(0).locator('summary').click();
      const callsBeforePolling = calls.length;
      await page.waitForFunction(() => document.querySelector('#questionDetails details')?.open);
      await page.waitForTimeout(12_000);
      assert.ok(calls.length > callsBeforePolling, 'Chưa có cập nhật tự động Writing');
      assert.equal(await details.nth(0).evaluate(node => node.open), true, 'Polling làm đóng Listening');
      assert.equal(await details.nth(1).evaluate(node => node.open), false, 'Polling làm đổi Reading');
      assert.equal(await page.locator('.writing-score-card.is-action').count(), 0);

      ready = true;
      // API fixture đã công bố sau hạn server; nhận qua polling, không cần nút kiểm tra.
      const score = page.locator('#writingSubmissionResult .writing-score-card.is-action');
      await score.waitFor({ state: 'visible' });
      assert.match(await score.innerText(), new RegExp(`Writing Task ${taskNumber}[\\s\\S]*Band 7.5`));
      assert.equal(await page.locator('#writingSubmissionResult .writing-score-card.is-action').count(), 1);
      assert.match(await page.locator('#resultMeta').innerText(), new RegExp(classCode));
      assert.equal(await page.locator('#resultStudentName').innerText(), 'Học viên giả A');

      await score.click();
      const dialog = page.locator('.writing-feedback-dialog');
      await dialog.waitFor({ state: 'visible' });
      assert.match(await dialog.locator('h2').innerText(), new RegExp(`Task ${taskNumber}.*Band 7.5`));
      assert.equal(await dialog.locator('.writing-feedback-essay').innerText(), essay);
      assert.equal(await dialog.locator('.writing-band-summary-item').count(), 4);
      await dialog.getByRole('button', { name: 'Đóng bài chấm Writing' }).click();

      await page.reload();
      await score.waitFor({ state: 'visible' });
      assert.match(await score.innerText(), new RegExp(`Writing Task ${taskNumber}[\\s\\S]*Band 7.5`));
      assert.ok(calls.every(call => call.attemptToken === attemptToken), 'Mở lại dùng sai lượt thi');
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Kết quả tràn ngang trên điện thoại');
      await score.click();
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.evaluate(element => element.getBoundingClientRect().width <= innerWidth), true, 'Bài chấm tràn ngang trên điện thoại');
      assert.deepEqual(blocked, [], 'Có yêu cầu ngoài fixture');
      assert.deepEqual(errors, [], 'Có lỗi JavaScript trên trang');
    } finally {
      await browser.close();
      await new Promise(resolveClose => server.close(resolveClose));
    }
  });
}

for (const slug of ['term-test-1-k56', 'term-test-2-k56', 'mini-test-k56']) {
  test(`${slug}: Writing gọn, Nộp bài và giữ dàn ý/editor trên desktop/mobile`, async () => {
    const server = await servePages();
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext(); const page = await context.newPage(); const blocked = [];
    await context.route('**/*', route => {
      if (route.request().url().startsWith(base)) return route.continue();
      blocked.push(route.request().url()); return route.abort();
    });
    try {
      await page.goto(`${base}term-tests/${slug}-computer-based/?class=CODEXDEMO56&demo=writing`);
      await page.locator('#writingView').waitFor({ state: 'visible' });
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.locator('#submitWriting').innerText(), 'Nộp bài');
        assert.equal(await page.locator('#writingTaskTabs').isVisible(), false);
        assert.equal(await page.locator('#writingView .cbt-notes-open').count(), 0);
        assert.equal(await page.locator('#writingView .writing-pane-header span').count(), 0);
        assert.equal(await page.locator('#writingView .writing-outline-card header span').count(), 0);
        // demo=writing là preview offline: từ trước đã không chạy đồng hồ. Timer thật có suite riêng.
        assert.equal(await page.locator('#writingView .cbt-writing-clock').count(), 0);
        await page.locator('[data-writing-outline]').fill('Dàn ý giả để kiểm lưu');
        await page.locator('[data-writing-task]').first().fill('Synthetic essay for editor and word count.');
        assert.equal(await page.locator('[data-writing-outline]').inputValue(), 'Dàn ý giả để kiểm lưu');
        assert.match(await page.locator('.writing-editor-meta').first().innerText(), /7 từ/);
      }
      assert.deepEqual(blocked, [], 'Test Writing offline không được gọi hệ thống thật');
    } finally { await browser.close(); await new Promise(done => server.close(done)); }
  });
}

test('Mini: bảng L/R giữ mở, chỉ nhận Link LMS qua API sau 2 giờ và reload giữ kết quả', async () => {
  const server = await servePages(); const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext(); const page = await context.newPage();
  const blocked = []; let published = false; let calls = 0;
  const now = Date.parse('2026-10-04T10:00:00Z');
  const lmsUrl = 'https://ducizone.ddns.net/writing/shared/writing-essays/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/view?v=1';
  await page.clock.install({ time: new Date(now) });
  await page.clock.pauseAt(new Date(now + 60_000));
  await page.addInitScript(({ ref, token }) => {
    localStorage.setItem('izone-test:mini-test-k56:IC5601', JSON.stringify({ studentRef: ref, studentName: 'Học viên giả A', attemptToken: token, completed: true, writingStarted: true, writingSubmitted: true }));
  }, { ref: studentRef, token: attemptToken });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.endsWith('/k56-mini-shared/config.js')) return route.fulfill({ contentType: 'text/javascript', body: "window.TERM_TEST_APP_CONFIG={API_BASE_URL:'https://ducizone.ddns.net/mapping-api'};" });
    if (url.pathname.endsWith('/api/term-tests/roster')) return route.fulfill({ json: { class: { name: classCode }, students: [{ ref: studentRef, name: 'Học viên giả A' }] } });
    if (url.pathname.endsWith('/mini-test-k56/attempt/prepare')) {
      const content = await request.frame().evaluate(() => window.K56_TERM_TEST_CONTENT);
      return route.fulfill({ json: { content, attemptToken, examMode: 'lis_first', nextSection: 'result', completed: true, listeningSubmitted: true, readingSubmitted: true, writingSubmittedAt: new Date(now).toISOString() } });
    }
    if (url.pathname.endsWith('/api/term-tests/result')) {
      calls++;
      const payload = resultPayload({ slug: 'mini-test-k56', taskNumber: 2, ready: false });
      payload.writing.grading = published ? { ready: true, status: 'ready', mode: 'homework', lmsUrl }
        : { ready: false, status: 'awaiting_release', availableAt: new Date(now + 7200000).toISOString(), tasks: [] };
      return route.fulfill({ json: payload });
    }
    if (request.url().startsWith(base)) return route.continue();
    blocked.push(url.pathname); return route.abort();
  });
  try {
    await page.goto(`${base}term-tests/mini-test-k56-computer-based/?class=${classCode}`);
    await page.locator('#writingSubmissionResult .writing-grading-status').waitFor({ state: 'visible' });
    const details = page.locator('#questionDetails details');
    await details.nth(0).locator('summary').click(); await details.nth(1).locator('summary').click();
    const before = calls;
    await page.clock.runFor(7139999);
    assert.equal(await page.locator('#writingSubmissionResult a').count(), 0);
    assert.equal(calls, before, 'Không polling liên tục trong khoảng chờ công bố');
    published = true; await page.clock.runFor(1);
    const link = page.locator('#writingSubmissionResult a');
    await link.waitFor({ state: 'visible' }); assert.equal(await link.getAttribute('href'), lmsUrl);
    assert.equal(await details.nth(0).evaluate(node => node.open), true);
    assert.equal(await details.nth(1).evaluate(node => node.open), true);
    assert.doesNotMatch(await page.locator('#writingSubmissionResult').innerText(), /Band \d|Writing tổng/);
    await page.reload(); await link.waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(blocked, []);
  } finally { await browser.close(); await new Promise(done => server.close(done)); }
});
