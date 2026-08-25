import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

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

const demos = [
  {
    padded: '04',
    documentId: 'DEMO_VOCAB_04_DOCUMENT_ID_1234567890',
    startPath: '/webhook/cham-ngay-vocab-04-demo',
    statusPath: '/webhook/tien-do-cham-vocab-04-demo',
  },
  {
    padded: '06',
    documentId: 'DEMO_VOCAB_06_DOCUMENT_ID_1234567890',
    startPath: '/webhook/cham-ngay-vocab-06-demo',
    statusPath: '/webhook/tien-do-cham-vocab-06-demo',
  },
  {
    padded: '11',
    documentId: 'DEMO_VOCAB_11_DOCUMENT_ID_1234567890',
    startPath: '/webhook/cham-ngay-vocab-11-demo',
    statusPath: '/webhook/tien-do-cham-vocab-11-demo',
  },
];

for (const demo of demos) {
  const html = readFileSync(join(root, `vocab-${demo.padded}.html`), 'utf8');
  const config = readFileSync(join(root, `vocab-${demo.padded}-config.js`), 'utf8');
  assert.ok(html.includes(`VOCAB ${demo.padded} · KHÓA 56 · DEMO`));
  assert.ok(html.includes(`vocab-${demo.padded}-config.js`));
  assert.ok(config.includes(demo.startPath));
  assert.ok(config.includes(demo.statusPath));
  for (const other of demos.filter((candidate) => candidate.padded !== demo.padded)) {
    assert.ok(!config.includes(`vocab-${other.padded}-demo`));
  }
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname === '/' ? 'vocab-04.html' : pathname.slice(1);
    const filePath = normalize(join(root, relative));
    if (!filePath.startsWith(normalize(root))) throw new Error('Đường dẫn ngoài thư mục kiểm thử');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    response.end(body);
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
  for (const demo of demos) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
    const calls = [];
    let pollCount = 0;
    await page.route('https://ducizone.ddns.net/webhook/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      calls.push({ path: url.pathname, method: request.method(), body: request.postData() });
      if (url.pathname === demo.startPath) {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ job_id: `demo_${demo.padded}` }),
        });
        return;
      }
      if (url.pathname === demo.statusPath) {
        pollCount += 1;
        const state = pollCount === 1
          ? { status: 'running', stage: 'grading' }
          : { status: 'done', stage: 'done' };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(state),
        });
        return;
      }
      await route.fulfill({ status: 500, body: 'Cross-flow endpoint detected' });
    });

    const response = await page.goto(
      `http://127.0.0.1:4174/vocab-${demo.padded}.html?documentId=${demo.documentId}`,
    );
    assert.equal(response?.status(), 200);
    await page.getByRole('heading', { name: 'Bài đã được chấm xong' }).waitFor({ timeout: 15000 });
    assert.equal(new URL(page.url()).search, '');
    assert.equal((await page.locator('.step.done').count()), 3);
    assert.equal(calls[0].path, demo.startPath);
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].body), { documentId: demo.documentId });
    assert.ok(calls.slice(1).every((call) => call.path === demo.statusPath));
    await page.close();
  }
  console.log('GitHub Pages isolation and UI flow passed for Vocab 04, Vocab 06 and Vocab 11.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
