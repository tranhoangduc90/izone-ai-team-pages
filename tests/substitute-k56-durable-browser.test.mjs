import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modules = process.env.CODEX_NODE_MODULES || join(
  process.env.USERPROFILE || '', '.cache', 'codex-runtimes',
  'codex-primary-runtime', 'dependencies', 'node', 'node_modules');
const require = createRequire(pathToFileURL(join(modules, 'playwright', 'package.json')).href);
const { chromium } = require('playwright');
const studentRef = '11111111-1111-4111-8111-111111111111';
const otherRef = '22222222-2222-4222-8222-222222222222';

function server() {
  return new Promise(resolveServer => {
    const http = createServer(async (request, response) => {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html`
        : pathname.replace(/^\//u, '');
      const target = normalize(join(root, relative));
      if (!target.startsWith(normalize(root))) return response.writeHead(403).end();
      try {
        const bytes = await readFile(target);
        const type = extname(target) === '.js' ? 'text/javascript'
          : extname(target) === '.css' ? 'text/css' : 'text/html';
        response.writeHead(200, { 'Content-Type': type });
        response.end(bytes);
      } catch {
        response.writeHead(404).end();
      }
    });
    http.listen(0, '127.0.0.1', () => resolveServer(http));
  });
}

function section(correct) {
  return { correct, total: 40, answered: 40, band: 6,
    details: Array.from({ length: 40 }, (_, index) => ({
      number: index + 1, studentAnswer: 'Mẫu', correctAnswer: 'Mẫu',
      result: index < correct ? 'correct' : 'incorrect',
    })),
    typeStats: [{ type: 'Mẫu', correct, total: 40, percentage: correct / 40 }],
  };
}

test('K56 Substitute 2 mở lại bài đã lưu bằng chọn tên, không tải audio hoặc làm rơi dữ liệu', async () => {
  const http = await server();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const calls = [];
  const outside = [];
  const pageErrors = [];
  let statusUnavailable = false;
  let completed = false;
  page.on('pageerror', error => pageErrors.push(error.message));
  const base = `http://127.0.0.1:${http.address().port}/`;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/substitute-test-2-k56-shared/config.js')) {
      return route.fulfill({ contentType: 'text/javascript', body:
        "window.TERM_TEST_APP_CONFIG={API_BASE_URL:'https://ducizone.ddns.net/webhook/substitute-test-2-k56-public-api',DURABLE_WRITING_ENABLED:true,DURABLE_WRITING_API_BASE_URL:'https://ducizone.ddns.net/webhook/substitute-test-2-k56-public-durable-test'};" });
    }
    if (url.pathname.endsWith('/webhook/substitute-test-2-k56-public-api')) {
      const request = JSON.parse(route.request().postData() || '{}');
      calls.push(request.route);
      if (request.route === '/api/test/roster') return route.fulfill({ json: {
        students: [{ ref: studentRef, name: 'Học viên giả A' },
          { ref: otherRef, name: 'Học viên giả B' }],
      } });
      return route.fulfill({ status: 500, json: { message: 'Không được gọi tuyến cũ' } });
    }
    if (url.pathname.endsWith('/webhook/substitute-test-2-k56-public-durable-test')) {
      const request = JSON.parse(route.request().postData() || '{}');
      calls.push(request.route);
      if (statusUnavailable) return route.fulfill({ status: 503, json: {
        message: 'Không thể xác nhận phiếu bài đã lưu.',
      } });
      assert.equal(request.route, '/api/test/writing/status');
      assert.equal(request.payload.classCode, 'IC2264');
      assert.equal(request.payload.studentRef, studentRef);
      // Dữ liệu vào: phản hồi dạng status lồng của webhook n8n đã đọc lại trên môi trường thử.
      // Việc chính: giữ hợp đồng thật thay vì dựng trường sections/grading ở tầng ngoài.
      // Kết quả: browser phải mở lại được bài đang chờ; khi sai cấu trúc sẽ dừng ở phòng chờ.
      const result = completed ? { taskNumber: 1, taskScore: 3.5,
        criteria: ['TA', 'CC', 'LR', 'GRA'].map(code => ({
          code, bandScore: 3.5, feedback: `Synthetic ${code} feedback.`,
        })) } : null;
      return route.fulfill({ json: { accepted: true, status: {
        attemptId: studentRef,
        submissionId: '33333333-3333-4333-8333-333333333333',
        testSlug: 'substitute-test-2-k56', classId: 1252, taskNumber: 1,
        attemptStatus: 'submitted', submissionStatus: completed ? 'completed' : 'pending',
        submittedEssay: 'Synthetic Task 1 report for browser readback.',
        sectionResults: { listening: section(26), reading: section(24) },
        taskScore: completed ? 3.5 : null, result,
        portalSyncStatus: completed ? 'blocked_missing_first_scores' : 'not_ready',
      }, externalWrites: false } });
    }
    if (route.request().method() === 'GET' && route.request().url().startsWith(base)) {
      return route.continue();
    }
    outside.push(url.href);
    return route.abort();
  });
  try {
    await page.goto(`${base}term-tests/substitute-test-2-k56-computer-based/?class=IC2264&demo=exam&grading=server`);
    await page.locator('#bootstrapClass').selectOption('IC2264');
    await page.locator(`#bootstrapStudent option[value="${studentRef}"]`).waitFor({ state: 'attached' });
    await page.locator('#bootstrapStudent').selectOption(studentRef);
    await page.locator('#identityConfirm').waitFor({ state: 'visible' });
    await page.locator('#confirmIdentity').click();
    await page.locator('#resultView').waitFor({ state: 'visible' });
    assert.match(await page.locator('#writingSubmissionResult').innerText(),
      /Bài Writing đã nộp/iu);
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem(
      'izone-test:substitute-test-2-k56:IC2264:server-grade:durable-writing')));
    assert.equal(restored.studentRef, studentRef);
    assert.equal(restored.drafts.writing.task1,
      'Synthetic Task 1 report for browser readback.');
    assert.equal(restored.testGrades.listening.correct, 26);
    assert.equal(restored.testGrades.reading.correct, 24);
    assert.deepEqual(calls, ['/api/test/roster', '/api/test/writing/status',
      '/api/test/writing/status']);
    statusUnavailable = true;
    await page.close();
    const reopened = await context.newPage();
    reopened.on('pageerror', error => pageErrors.push(error.message));
    await reopened.goto(`${base}term-tests/substitute-test-2-k56-computer-based/?class=IC2264&demo=exam&grading=server`);
    await reopened.locator('#bootstrapClass').selectOption('IC2264');
    await reopened.locator(`#bootstrapStudent option[value="${studentRef}"]`).waitFor({ state: 'attached' });
    await reopened.locator('#bootstrapStudent').selectOption(studentRef);
    await reopened.locator('#identityConfirm').waitFor({ state: 'visible' });
    await reopened.locator('#confirmIdentity').click();
    await reopened.locator('#bootstrapNotice').filter({
      hasText: 'Không thể xác nhận phiếu bài đã lưu.',
    }).waitFor({ state: 'visible' });
    assert.equal(await reopened.locator('#resultView').count(), 0);
    assert.equal(await reopened.locator('#bootstrapStart').isDisabled(), true);
    await reopened.close();
    statusUnavailable = false;
    completed = true;
    const graded = await context.newPage();
    graded.on('pageerror', error => pageErrors.push(error.message));
    await graded.goto(`${base}term-tests/substitute-test-2-k56-computer-based/?class=IC2264&demo=exam&grading=server&reset=1`);
    await graded.locator('#bootstrapClass').selectOption('IC2264');
    await graded.locator(`#bootstrapStudent option[value="${studentRef}"]`).waitFor({ state: 'attached' });
    await graded.locator('#bootstrapStudent').selectOption(studentRef);
    await graded.locator('#identityConfirm').waitFor({ state: 'visible' });
    await graded.locator('#confirmIdentity').click();
    await graded.locator('#writingSubmissionResult').filter({ hasText: 'Band 3.5' })
      .waitFor({ state: 'visible' });
    assert.doesNotMatch(await graded.locator('#app').innerText(),
      /điểm thi lại đã đồng bộ lên Portal/iu);
    assert.equal(outside.length, 0, `Yêu cầu ngoài fixture: ${outside.join(', ')}`);
    assert.equal(pageErrors.length, 0, `Lỗi trang: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
    await new Promise(resolveClose => http.close(resolveClose));
  }
});
