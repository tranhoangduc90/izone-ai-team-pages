import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modules = process.env.CODEX_NODE_MODULES || join(
  process.env.USERPROFILE || '', '.cache', 'codex-runtimes',
  'codex-primary-runtime', 'dependencies', 'node', 'node_modules');
const require = createRequire(pathToFileURL(join(modules, 'playwright', 'package.json')).href);
const { chromium } = require('playwright');
const studentRef = '56000000-0000-4000-8000-000000000002';
const pagesOrigin = 'https://tranhoangduc90.github.io';
const pagesPrefix = '/izone-ai-team-pages/';
const publicUrl = 'https://ducizone.ddns.net/webhook/substitute-test-2-k56-public-durable-canary-20260925';
const legacyUrl = 'https://ducizone.ddns.net/webhook/substitute-test-2-k56-public-api';
const expected = process.argv.includes('--completed') ? 'completed' : 'submitted';

if (process.env.RUN_SUBSTITUTE_BROWSER_CANARY !== '1') {
  throw new Error('Chỉ chạy sau khi kiểm fixture giả, khóa thử và workflow thử đang bật.');
}

// Dữ liệu vào: file Pages ứng viên, một roster giả và webhook canary trên staging.
// Việc chính: giữ origin GitHub Pages thật, chỉ thay file static/roster; phiếu Writing đi qua n8n/backend thật.
// Kết quả: chứng minh học viên chọn lại tên nhìn thấy đúng bài và các phần điểm đã lưu.
// Khi lỗi: in mã bước, không in bài/nhận xét hoặc payload; không nộp bài hay ghi Portal.
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
const seen = { roster: 0, durable: 0, blocked: 0 };
let step = 'open';
page.on('pageerror', error => errors.push(error.message));

await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === pagesOrigin && url.pathname.startsWith(pagesPrefix)) {
    const relative = url.pathname.slice(pagesPrefix.length);
    if (relative.endsWith('substitute-test-2-k56-shared/config.js')) {
      return route.fulfill({ contentType: 'text/javascript', body:
        `window.TERM_TEST_APP_CONFIG={API_BASE_URL:'${legacyUrl}',` +
        `DURABLE_WRITING_ENABLED:true,DURABLE_WRITING_API_BASE_URL:'${publicUrl}'};` });
    }
    const filename = relative.endsWith('/') ? `${relative}index.html` : relative;
    const target = normalize(join(root, filename));
    if (!target.startsWith(normalize(root))) return route.abort();
    try {
      const bytes = await readFile(target);
      const type = extname(target) === '.js' ? 'text/javascript'
        : extname(target) === '.css' ? 'text/css'
          : extname(target) === '.html' ? 'text/html' : 'application/octet-stream';
      return route.fulfill({ status: 200, contentType: type, body: bytes });
    } catch {
      return route.fulfill({ status: 404, body: '' });
    }
  }
  if (request.method() === 'POST' && request.url() === legacyUrl) {
    const body = JSON.parse(request.postData() || '{}');
    if (body.route !== '/api/test/roster' || body.payload?.class !== 'IC2264') {
      seen.blocked++;
      return route.fulfill({ status: 409, json: { code: 'UNEXPECTED_LEGACY_ROUTE' } });
    }
    seen.roster++;
    return route.fulfill({ json: { students: [
      { ref: studentRef, name: 'Học viên giả web khóa 56' },
    ] } });
  }
  if (request.method() === 'POST' && request.url() === publicUrl) {
    const body = JSON.parse(request.postData() || '{}');
    if (body.route !== '/api/test/writing/status'
      || body.payload?.classCode !== 'IC2264'
      || body.payload?.studentRef !== studentRef) {
      seen.blocked++;
      return route.abort();
    }
    seen.durable++;
    return route.continue();
  }
  seen.blocked++;
  return route.abort();
});

try {
  await page.goto(`${pagesOrigin}${pagesPrefix}term-tests/substitute-test-2-k56-computer-based/` +
    '?class=IC2264&demo=exam&grading=server&reset=1');
  await page.locator('#bootstrapClass').selectOption('IC2264');
  await page.locator(`#bootstrapStudent option[value="${studentRef}"]`).waitFor({ state: 'attached' });
  await page.locator('#bootstrapStudent').selectOption(studentRef);
  step = 'confirm';
  await page.locator('#confirmIdentity').click();
  step = 'result_visible';
  await page.locator('#resultView').waitFor({ state: 'visible', timeout: 45000 });
  step = 'writing_result';
  const result = await page.locator('#writingSubmissionResult').innerText();
  if (expected !== 'completed') assert.match(result, /Bài Writing đã nộp/iu);
  step = 'band_result';
  if (expected === 'completed') assert.match(result, /Band [0-9]/iu);
  step = 'local_receipt';
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem(
    'izone-test:substitute-test-2-k56:IC2264:server-grade:durable-writing')));
  step = 'student_ref';
  assert.equal(restored.studentRef, studentRef);
  step = 'essay';
  assert.equal(restored.drafts.writing.task1,
    'Synthetic Task 1 report for staging. The three pizza places changed over time.');
  step = 'listening';
  assert.equal(restored.testGrades.listening.correct, 26);
  step = 'reading';
  assert.equal(restored.testGrades.reading.correct, 28);
  step = 'page_errors';
  assert.equal(errors.length, 0);
  step = 'network_scope';
  assert.equal(seen.blocked, 0);
  step = 'request_count';
  assert.ok(seen.roster >= 1 && seen.durable >= 1);
  process.stdout.write(JSON.stringify({ toolOutcome: 'success', businessOutcome: 'verified',
    expected, browserResultVisible: true, classCode: 'IC2264', classId: 1252,
    rosterCalls: seen.roster, realStatusCalls: seen.durable, pageErrors: 0,
    externalWrites: false }) + '\n');
} catch (error) {
  const notice = await page.locator('#bootstrapNotice').innerText().catch(() => 'unavailable');
  const dialogVisible = await page.locator('#identityConfirm').isVisible().catch(() => false);
  const configFlag = await page.evaluate(() => window.TERM_TEST_APP_CONFIG?.DURABLE_WRITING_ENABLED)
    .catch(() => null);
  process.stderr.write(JSON.stringify({ toolOutcome: 'failure', businessOutcome: 'unknown',
    errorCode: error.code || error.name || 'BROWSER_CANARY_FAILED',
    step,
    rosterCalls: seen.roster, realStatusCalls: seen.durable,
    blockedCalls: seen.blocked, pageErrorCount: errors.length,
    notice: notice.slice(0, 160), dialogVisible, configFlag }) + '\n');
  process.exitCode = 1;
} finally {
  await browser.close();
}
