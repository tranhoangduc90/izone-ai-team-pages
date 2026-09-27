// Nhận link Progress Log production qua LIVE_PROGRESS_LOG_URL.
// Việc chính: mở phiếu trong trình duyệt sạch, chờ roster và kiểm tiêu đề/lớp/buổi mà không chọn học viên.
// Kết quả: chỉ in số lượng và trạng thái kỹ thuật; không in tên học viên hoặc token.
// Khi lỗi: trả exit code 1 cùng lỗi console/request để đội vận hành biết lớp hỏng ở đâu.

const { createRequire } = require('node:module');

const runtime = process.env.PLAYWRIGHT_PACKAGE
  || 'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json';
const { chromium } = createRequire(runtime)('playwright');

async function main() {
  const url = process.env.LIVE_PROGRESS_LOG_URL;
  if (!url) throw new Error('LIVE_PROGRESS_LOG_URL_REQUIRED');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('requestfailed', request => failedRequests.push(request.url()));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#identityView:not([hidden])').waitFor();

    const result = await page.evaluate(() => ({
      title: document.querySelector('#assignmentTitle')?.textContent?.trim(),
      className: document.querySelector('#classLabel')?.textContent?.trim(),
      session: document.querySelector('#sessionLabel')?.textContent?.trim(),
      rosterCount: Math.max(0, (document.querySelector('#studentSelect')?.options?.length || 1) - 1),
      appRevision: document.querySelector('script[src*="app.js"]')?.getAttribute('src') || '',
      styleRevision: document.querySelector('link[href*="styles.css"]')?.getAttribute('href') || ''
    }));

    if (result.title !== 'ENTRANCE TICKET • LISTENING 1 + SPEAKING 2') throw new Error('LIVE_TITLE_MISMATCH');
    if (result.className !== 'IC2305') throw new Error('LIVE_CLASS_MISMATCH');
    if (result.session !== 'BUỔI 3') throw new Error('LIVE_SESSION_MISMATCH');
    if (result.rosterCount !== 18) throw new Error('LIVE_ROSTER_COUNT_MISMATCH');
    if (!result.appRevision.includes('20260921-session3-v1')) throw new Error('LIVE_APP_REVISION_MISMATCH');
    if (!result.styleRevision.includes('20260921-session3-v1')) throw new Error('LIVE_STYLE_REVISION_MISMATCH');
    if (consoleErrors.length) throw new Error(`LIVE_CONSOLE_ERRORS_${consoleErrors.length}`);
    if (failedRequests.length) throw new Error(`LIVE_REQUEST_FAILURES_${failedRequests.length}`);

    process.stdout.write(`${JSON.stringify({
      outcome: 'success',
      className: result.className,
      session: result.session,
      rosterCount: result.rosterCount,
      consoleErrors: 0,
      failedRequests: 0
    }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
