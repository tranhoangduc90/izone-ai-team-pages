import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('..', import.meta.url));
const outputDir = join(root, '..', 'output', 'playwright');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname === '/' ? 'check-now.html' : pathname.slice(1);
    const filePath = normalize(join(root, relative));
    if (!filePath.startsWith(normalize(root))) throw new Error('Đường dẫn ngoài thư mục kiểm thử');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Không tìm thấy');
  }
});

await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let startPayload = null;
  let pollCount = 0;

  await page.route('https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-67', async (route) => {
    startPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ job_id: 'demo_job_67', stage: 'reading' }),
    });
  });
  await page.route('https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-67?*', async (route) => {
    pollCount += 1;
    const states = [
      { status: 'running', stage: 'grading' },
      { status: 'running', stage: 'writing' },
      { status: 'done', stage: 'done' },
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(states[Math.min(pollCount - 1, states.length - 1)]),
    });
  });

  const documentId = '1Abcdefghijklmnopqrstuvwxyz0123456789';
  const navigation = await page.goto(`http://127.0.0.1:4173/check-now.html?documentId=${documentId}&assignmentCode=67-reading-02`);
  if (navigation?.status() !== 200) throw new Error(`Trang kiểm thử trả mã ${navigation?.status()}`);
  try {
    await page.getByRole('heading', { name: 'Bài đã được chấm xong' }).waitFor({ timeout: 15000 });
  } catch (error) {
    const visibleText = (await page.locator('body').innerText()).slice(0, 1200);
    throw new Error(`Giao diện không hoàn tất. Nội dung đang thấy: ${visibleText}`, { cause: error });
  }

  if (new URL(page.url()).search) throw new Error('Giao diện chưa xóa query khỏi thanh địa chỉ');
  if (await page.locator('.brand-row').count()) throw new Error('Dòng tiêu đề bài riêng vẫn còn trên giao diện dùng chung');
  if (startPayload?.documentId !== documentId || startPayload?.assignmentCode !== '67-reading-02') {
    throw new Error('Payload gửi n8n không giữ đúng cặp Document ID và mã bài');
  }
  if ((await page.locator('.step.done').count()) !== 3) throw new Error('Ba giai đoạn chưa hoàn tất đúng');
  if (await page.locator('#warning-box').isVisible()) throw new Error('Cảnh báo dưới ngưỡng xuất hiện nhầm ở trạng thái hoàn tất');
  await page.screenshot({ path: join(outputDir, 'check-now-desktop-done.png'), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto('http://127.0.0.1:4173/check-now.html?preview=writing');
  await mobile.locator('.step.active[data-stage="writing"]').waitFor();
  await mobile.screenshot({ path: join(outputDir, 'check-now-mobile-writing.png'), fullPage: true });

  // Mô phỏng đúng nhánh cảnh báo dưới ngưỡng khóa 67; không gửi dữ liệu ra production.
  const warning67 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await warning67.route('https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-67', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ job_id: 'warning_job_67', stage: 'reading' }),
    });
  });
  await warning67.route('https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-67?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'warning',
        stage: 'failed',
        message: 'Bạn chưa hoàn thành đủ 80% bài tập. Hãy bổ sung các câu còn thiếu.',
        retryable: true,
      }),
    });
  });
  await warning67.goto(`http://127.0.0.1:4173/check-now.html?documentId=${documentId}&assignmentCode=67-reading-02`);
  await warning67.getByRole('heading', { name: 'Bài chưa đủ điều kiện chấm' }).waitFor({ timeout: 10000 });
  if ((await warning67.locator('#warning-threshold').innerText()).trim() !== '80%') {
    throw new Error('Cảnh báo khóa 67 không hiển thị đúng ngưỡng 80%');
  }
  if (await warning67.locator('.steps').isVisible()) throw new Error('Tiến độ vẫn che khuất cảnh báo khóa 67');
  if (!(await warning67.getByRole('link', { name: 'Quay lại bài làm ngay' }).isVisible())) {
    throw new Error('Nút quay lại bài làm chưa nổi bật ở cảnh báo khóa 67');
  }
  if (await warning67.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) {
    throw new Error('Cảnh báo khóa 67 gây tràn ngang trên desktop');
  }
  await warning67.screenshot({ path: join(outputDir, 'check-now-desktop-warning-80.png'), fullPage: true });

  // Kiểm tra riêng khóa 56 trên mobile để khóa đúng ngưỡng 90% và vùng nhìn đầu tiên.
  const warning56 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await warning56.route('https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-vocab-56', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ job_id: 'warning_job_56', stage: 'reading' }),
    });
  });
  await warning56.route('https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-vocab-56?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'warning',
        stage: 'failed',
        message: 'Bạn chưa hoàn thành đủ 90% bài tập. Hãy bổ sung các câu còn thiếu.',
        retryable: true,
      }),
    });
  });
  await warning56.goto(`http://127.0.0.1:4173/check-now-56.html?documentId=${documentId}&assignmentCode=56-vocab-06`);
  await warning56.getByRole('heading', { name: 'Bài chưa đủ điều kiện chấm' }).waitFor({ timeout: 10000 });
  if ((await warning56.locator('#warning-threshold').innerText()).trim() !== '90%') {
    throw new Error('Cảnh báo khóa 56 không hiển thị đúng ngưỡng 90%');
  }
  if (await warning56.locator('.steps').isVisible()) throw new Error('Tiến độ vẫn che khuất cảnh báo khóa 56');
  const mobileBackLink = warning56.getByRole('link', { name: 'Quay lại bài làm ngay' });
  const mobileBackBox = await mobileBackLink.boundingBox();
  if (!mobileBackBox || mobileBackBox.y + mobileBackBox.height > 844) {
    throw new Error('Nút quay lại bài làm chưa nằm trong vùng nhìn đầu tiên trên mobile');
  }
  if (await warning56.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) {
    throw new Error('Cảnh báo khóa 56 gây tràn ngang trên mobile');
  }
  await warning56.screenshot({ path: join(outputDir, 'check-now-mobile-warning-90.png'), fullPage: true });

  async function expectReturnButtonToClosePortal(pathname, preview, buttonName) {
    const context = await browser.newContext();
    const documentTab = await context.newPage();
    await documentTab.goto('about:blank');

    const portalPromise = context.waitForEvent('page');
    await documentTab.evaluate((url) => window.open(url, '_blank'),
      `http://127.0.0.1:4173/${pathname}?preview=${preview}`);
    const portalTab = await portalPromise;
    const returnButton = portalTab.getByRole('link', { name: buttonName });
    await returnButton.waitFor();

    const closePromise = portalTab.waitForEvent('close');
    await returnButton.click();
    await closePromise;
    if (!portalTab.isClosed()) throw new Error(`Nút ${buttonName} chưa đóng tab cổng chấm bài`);
    await context.close();
  }

  // Tab cổng chấm phải tự đóng ở cả trạng thái hoàn tất và chưa đạt ngưỡng.
  await expectReturnButtonToClosePortal('check-now.html', 'done', 'Quay lại bài làm');
  await expectReturnButtonToClosePortal('check-now-56.html', 'warning', 'Quay lại bài làm ngay');

  // Nếu tab được mở trực tiếp và trình duyệt chặn tự đóng, nút vẫn quay về Docs như trước.
  const fallback = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await fallback.route('https://docs.google.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google Docs dự phòng</title>' });
  });
  await fallback.goto('http://127.0.0.1:4173/check-now.html?preview=done');
  await fallback.getByRole('link', { name: 'Quay lại bài làm' }).click();
  await fallback.waitForURL('https://docs.google.com/**');

  const invalid = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await invalid.goto(`http://127.0.0.1:4173/check-now.html?documentId=${documentId}&assignmentCode=67-writing-01`);
  await invalid.getByText('Mã bài trong liên kết không hợp lệ').waitFor();
  if (await invalid.getByRole('button', { name: 'Thử chấm lại' }).isVisible()) {
    throw new Error('Lỗi mã bài không hợp lệ không được phép thử lại mù');
  }
  if (await invalid.locator('#warning-box').isVisible()) {
    throw new Error('Lỗi mã bài không hợp lệ bị hiển thị nhầm thành cảnh báo dưới ngưỡng');
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    pollCount,
    payload: startPayload,
    warning67: '80%',
    warning56: '90%',
    returnTab: 'passed',
    directOpenFallback: 'passed',
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
