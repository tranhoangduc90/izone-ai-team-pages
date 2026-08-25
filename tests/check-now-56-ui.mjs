import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('Thiếu CODEX_NODE_MODULES để chạy Playwright.');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const root = fileURLToPath(new URL('..', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname === '/' ? 'check-now-56.html' : pathname.slice(1);
    const filePath = normalize(join(root, relative));
    if (!filePath.startsWith(normalize(root))) throw new Error('Đường dẫn ngoài thư mục kiểm thử');
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end('Không tìm thấy');
  }
});

await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
const candidates = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const executablePath = candidates.find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  const cases = ['56-reading-01', '56-listening-05', '56-vocab-23'];
  for (const assignmentCode of cases) {
    const page = await browser.newPage({ viewport: { width: 980, height: 760 } });
    let payload = null;
    await page.route('https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-vocab-56', async (route) => {
      payload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ job_id: 'demo_job_56', stage: 'reading' }) });
    });
    await page.route('https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-vocab-56?*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'done', stage: 'done' }) });
    });
    const documentId = '1Abcdefghijklmnopqrstuvwxyz0123456789';
    await page.goto(`http://127.0.0.1:4174/check-now-56.html?documentId=${documentId}&assignmentCode=${assignmentCode}`);
    await page.getByRole('heading', { name: 'Bài đã được chấm xong' }).waitFor({ timeout: 15000 });
    if (payload?.documentId !== documentId || payload?.assignmentCode !== assignmentCode) throw new Error('Payload khóa 56 bị sai.');
    if (new URL(page.url()).search) throw new Error('Trang chưa xóa query nhạy cảm khỏi thanh địa chỉ.');
    await page.close();
  }

  const invalid = await browser.newPage();
  await invalid.goto('http://127.0.0.1:4174/check-now-56.html?documentId=1Abcdefghijklmnopqrstuvwxyz0123456789&assignmentCode=67-reading-01');
  await invalid.getByText('Mã bài trong liên kết không hợp lệ').waitFor();
  process.stdout.write(JSON.stringify({ ok: true, accepted: cases, rejected: ['67-reading-01'] }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
