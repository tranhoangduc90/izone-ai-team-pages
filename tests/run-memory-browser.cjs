// Nhận đường dẫn callback kiểm thử và URL mở đầu; chạy trong trình duyệt sạch.
// Callback tự chặn API thật. Lỗi assertion được in ra và trả exit code 1.
const { readFile } = require('node:fs/promises');
const { runInThisContext } = require('node:vm');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const runtime = process.env.PLAYWRIGHT_PACKAGE || 'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json';
const { chromium } = createRequire(runtime)('playwright');

async function main() {
  const filename = resolve(process.argv[2]);
  const callback = runInThisContext(`(${await readFile(filename, 'utf8')})`, { filename });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(process.argv[3] || 'http://127.0.0.1:4187/writing-handouts/config.json');
    let deadline;
    const result = await Promise.race([
      callback(page),
      new Promise((_, reject) => { deadline = setTimeout(async () => {
        await page.screenshot({ path: 'output/playwright/student-memory-timeout.png', fullPage: true }).catch(() => {});
        reject(Error('Kiểm thử quá 60 giây tại ' + page.url()));
      }, 60000); }),
    ]).finally(() => clearTimeout(deadline));
    if (result?.outcome !== 'success' || result.baseline === true) throw Error('Kiểm thử chưa xác nhận thành công bản mới.');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally { await browser.close(); }
}
main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
