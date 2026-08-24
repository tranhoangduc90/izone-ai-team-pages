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

  await page.route('https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-67-demo', async (route) => {
    startPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ job_id: 'demo_job_67', stage: 'reading' }),
    });
  });
  await page.route('https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-67-demo?*', async (route) => {
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
  await page.screenshot({ path: join(outputDir, 'check-now-desktop-done.png'), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto('http://127.0.0.1:4173/check-now.html?preview=writing');
  await mobile.locator('.step.active[data-stage="writing"]').waitFor();
  await mobile.screenshot({ path: join(outputDir, 'check-now-mobile-writing.png'), fullPage: true });

  const invalid = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await invalid.goto(`http://127.0.0.1:4173/check-now.html?documentId=${documentId}&assignmentCode=67-writing-01`);
  await invalid.getByText('Mã bài trong liên kết không hợp lệ').waitFor();
  if (await invalid.getByRole('button', { name: 'Thử chấm lại' }).isVisible()) {
    throw new Error('Lỗi mã bài không hợp lệ không được phép thử lại mù');
  }

  process.stdout.write(JSON.stringify({ ok: true, pollCount, payload: startPayload }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
