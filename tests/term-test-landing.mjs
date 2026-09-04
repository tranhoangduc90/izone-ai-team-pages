/*
 * Dữ liệu nhận vào: source trang tạo link và danh sách lớp giả, không có tài khoản hay học viên thật.
 * Xử lý: kiểm thứ tự/nhãn nút, cách xếp lớp và luồng Google OAuth giả lập trên localhost.
 * Kết quả: xác nhận giảng viên chỉ thấy lớp được API trả và mọi nút có cùng chiều cao.
 * Khi lỗi: Node báo đúng assertion hoặc lỗi trình duyệt; không gọi API production.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { sortClassesNewestFirst } from '../term-tests/shared/landing-model.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');

test('Term Test 2 và chiều cao nút đúng bố cục Term Test 1', async () => {
  const html = await readFile(join(repoRoot, 'term-tests/index.html'), 'utf8');
  const styles = await readFile(join(repoRoot, 'term-tests/shared/styles.css'), 'utf8');
  const computer = 'data-test="term-test-2-computer-based">Term Test 2 · Computer-based';
  const answer = 'data-test="term-test-2">Term Test 2 · Answer sheet';
  assert.ok(html.indexOf(computer) >= 0 && html.indexOf(computer) < html.indexOf(answer));
  assert.match(html, /accounts\.google\.com/);
  assert.match(html, /type="module" src="shared\/landing\.js/);
  assert.match(styles, /\.landing-actions \.button \{[^}]*min-height: 62px/);
  assert.match(styles, /#teacherDashboard \{ grid-column: 1 \/ -1; \}/);
});

test('lớp được xếp từ mã mới tới mã cũ mà không sửa mảng API gốc', () => {
  const classes = [
    { id: '10', name: 'IC2172' },
    { id: '30', name: 'IC2238' },
    { id: '20', name: 'IC2200' }
  ];
  assert.deepEqual(sortClassesNewestFirst(classes).map(item => item.name), ['IC2238', 'IC2200', 'IC2172']);
  assert.deepEqual(classes.map(item => item.name), ['IC2172', 'IC2238', 'IC2200']);
});

test('đăng nhập Google giả lập đổi ô nhập thành dropdown lớp đã cấp quyền', async () => {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  const token = ['fake', Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fake'].join('.');
  let receivedAuthorization = '';
  let optionsMode = 'success';
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/api/term-tests/teacher/options') {
        receivedAuthorization = request.headers.authorization || '';
        if (optionsMode === 'error') {
          response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ ok: false, message: 'Dịch vụ thử đang bận.' }));
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
          ok: true,
          reviewer: { displayName: 'Giảng viên thử' },
          classes: optionsMode === 'empty' ? [] : [{ id: '1', name: 'IC2172' }, { id: '3', name: 'IC2238' }, { id: '2', name: 'IC2200' }],
          tests: []
        }));
        return;
      }
      const relative = url.pathname.endsWith('/') ? `${url.pathname.slice(1)}index.html` : url.pathname.slice(1);
      const filePath = normalize(join(repoRoot, relative));
      if (!filePath.startsWith(normalize(repoRoot))) throw new Error('Đường dẫn ngoài repo');
      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end('Không tìm thấy');
    }
  });
  await new Promise(resolve => server.listen(4180, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({
      contentType: 'application/javascript',
      body: `globalThis.google={accounts:{id:{initialize(options){this.options=options;},renderButton(element){const button=document.createElement('button');button.textContent='Đăng nhập thử';button.onclick=()=>this.options.callback({credential:'${token}'});element.append(button);}}}};`
    }));
    await page.goto('http://127.0.0.1:4180/term-tests/');
    assert.equal(await page.locator('#classCode').isVisible(), true);
    await page.getByRole('button', { name: 'Đăng nhập thử' }).click();
    await page.locator('#classSelect').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('#classSelect option').allTextContents(), ['IC2238', 'IC2200', 'IC2172']);
    assert.equal(receivedAuthorization, `Bearer ${token}`);
    const heights = await page.locator('.landing-actions .button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
    assert.equal(new Set(heights.map(Math.round)).size, 1);
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    assert.equal(await page.locator('#classCode').isVisible(), true);
    assert.equal(await page.locator('#classSelect').isHidden(), true);
    optionsMode = 'error';
    await page.getByRole('button', { name: 'Đăng nhập thử' }).click();
    await page.locator('#loginStatus').filter({ hasText: 'Dịch vụ thử đang bận.' }).waitFor();
    assert.equal(await page.locator('#classCode').isVisible(), true);
    assert.equal(await page.locator('#classSelect').isHidden(), true);
    optionsMode = 'empty';
    await page.getByRole('button', { name: 'Đăng nhập thử' }).click();
    await page.locator('#loginStatus').filter({ hasText: 'chưa được cấp quyền cho lớp nào' }).waitFor();
    assert.equal(await page.locator('#classSelect option').count(), 0);
    assert.deepEqual(browserErrors, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
