const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { resolve, sep } = require('node:path');
const test = require('node:test');

const { chromium } = createRequire(
  process.env.PLAYWRIGHT_PACKAGE
    || 'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'
)('playwright');
const root = resolve(__dirname, '..');

test('trang học viên mở bằng URL chung giải thích cách lấy link phiếu đầy đủ', async () => {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = resolve(root, `.${pathname === '/progress-log/' ? '/progress-log/index.html' : pathname}`);
      if (!file.startsWith(`${root}${sep}`)) throw Error('INVALID_PATH');
      const body = await readFile(file);
      const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
      response.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/progress-log/`);
      await page.locator('#errorView:not([hidden])').waitFor();
      assert.equal(await page.locator('#errorTitle').textContent(), 'Đường dẫn chưa đúng');
      assert.match(await page.locator('#errorMessage').textContent(), /Sao chép link/);
      assert.equal(errors.length, 0);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }
});
