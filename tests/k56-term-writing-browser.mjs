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
      if (url.pathname === `/mapping-api/api/term-tests/${slug}/session/resume-attempt`) {
        return page.evaluate(() => window.K56_TERM_TEST_CONTENT).then(content => route.fulfill({ json: {
          content, serverNow: new Date().toISOString(),
          attemptToken, listeningSubmitted: true
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
      assert.match(await status.innerText(), new RegExp(`Đang chấm Task ${taskNumber}`));
      assert.equal(await page.locator('.writing-score-card.is-action').count(), 0);
      assert.ok(calls.length >= 2, 'Chưa đi qua cả khôi phục lượt và tải kết quả');
      assert.ok(calls.every(call => call.attemptToken === attemptToken), 'Lượt kết quả bị đổi định danh');

      ready = true;
      await status.getByRole('button', { name: 'Kiểm tra kết quả ngay' }).click();
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
