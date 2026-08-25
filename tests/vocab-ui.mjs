import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const nodeModules = process.env.CODEX_NODE_MODULES;
if (!nodeModules) throw new Error('Thiếu CODEX_NODE_MODULES để chạy Playwright.');
const require = createRequire(join(nodeModules, 'playwright', 'package.json'));
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname === '/' ? 'vocab.html' : pathname.slice(1);
    const filePath = normalize(join(root, relative));
    if (!filePath.startsWith(normalize(root))) throw new Error('Đường dẫn ngoài thư mục kiểm thử');
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end('Không tìm thấy');
  }
});

await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
const executablePath = [
  process.env.CHROME_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  const documentId = '1Abcdefghijklmnopqrstuvwxyz0123456789';
  for (const homework of [4, 11]) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    let startPayload;
    await page.route('https://ducizone.ddns.net/webhook/cham-ngay-vocab-03-pilot', async (route) => {
      startPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ job_id: `job_vocab_${homework}`, homework }),
      });
    });
    await page.route('https://ducizone.ddns.net/webhook/tien-do-cham-vocab-03-pilot?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'done', stage: 'done' }),
      });
    });
    const response = await page.goto(`http://127.0.0.1:4174/vocab.html?documentId=${documentId}&homework=${homework}`);
    if (response?.status() !== 200) throw new Error(`Trang Vocab ${homework} trả ${response?.status()}`);
    await page.getByRole('heading', { name: 'Bài đã được chấm xong' }).waitFor({ timeout: 10000 });
    if (startPayload?.documentId !== documentId || startPayload?.homework !== homework) {
      throw new Error(`Payload Vocab ${homework} không đúng`);
    }
    if (!await page.getByText(`Vocab ${String(homework).padStart(2, '0')}`, { exact: true }).first().isVisible()) {
      throw new Error(`Giao diện chưa hiển thị đúng Vocab ${homework}`);
    }
    if (new URL(page.url()).search) throw new Error('Trang chưa xóa query khỏi thanh địa chỉ');
    await page.close();
  }

  const legacy = await browser.newPage();
  let legacyPayload;
  await legacy.route('https://ducizone.ddns.net/webhook/cham-ngay-vocab-03-pilot', async (route) => {
    legacyPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{"job_id":"legacy_vocab_3"}' });
  });
  await legacy.route('https://ducizone.ddns.net/webhook/tien-do-cham-vocab-03-pilot?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"done","stage":"done"}' });
  });
  await legacy.goto(`http://127.0.0.1:4174/vocab-03.html?documentId=${documentId}`);
  await legacy.getByRole('heading', { name: 'Bài đã được chấm xong' }).waitFor({ timeout: 10000 });
  if (legacyPayload?.homework !== 3) throw new Error('Link Vocab 03 cũ không tự dùng homework=3');

  const invalid = await browser.newPage();
  await invalid.goto(`http://127.0.0.1:4174/vocab.html?documentId=${documentId}&homework=12`);
  await invalid.getByText('Số bài Vocab trong liên kết chưa được hệ thống hỗ trợ').waitFor();

  process.stdout.write(JSON.stringify({ ok: true, homeworks: [3, 4, 11] }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
