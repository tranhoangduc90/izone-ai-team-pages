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
import { ASSETS } from '../shared/audio/catalog.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');

test('các bài test có đủ computer-based, answer sheet và Listening audio', async () => {
  const html = await readFile(join(repoRoot, 'term-tests/index.html'), 'utf8');
  const styles = await readFile(join(repoRoot, 'term-tests/shared/styles.css'), 'utf8');
  for (const [slug, label] of [
    ['term-test-1', 'Term Test 1'],
    ['term-test-2', 'Term Test 2'],
    ['mini-test-lesson-5', 'Mini Test Buổi 5']
  ]) {
    assert.match(html, new RegExp(`data-pick="${slug}">${label}`));
  }
  assert.match(html, /id="testActions" aria-labelledby="chosenName" hidden/);
  assert.match(html, /id="paperAudio" target="_blank"/);
  assert.match(html, /id="backupAudio" target="_blank"/);
  assert.match(html, /id="answerSheet" target="_blank"/);
  assert.match(html, /accounts\.google\.com/);
  assert.match(html, /type="module" src="shared\/landing\.js/);
  assert.match(styles, /\.landing-actions \.button \{[^}]*min-height: 62px/);
  assert.match(styles, /\.button-audio \{[^}]*grid-column: 1 \/ -1/);
  assert.match(styles, /#teacherDashboard \{ grid-column: 1 \/ -1; \}/);
});

test('ba trang Listening audio dùng đúng tài sản K67 và giữ cổng phát', async () => {
  const pages = [
    ['term-test-1-audio.html', 'term-test-1', true],
    ['term-test-2-audio.html', 'term-test-2', true],
    ['mini-test-listening-audio.html', 'mini-test-lesson-5', false]
  ];
  for (const [fileName, slug, hasTimeWindow] of pages) {
    const html = await readFile(join(repoRoot, 'term-tests', fileName), 'utf8');
    assert.match(html, /k67-shared\/paper-audio\.mjs/);
    assert.match(html, new RegExp(`slug: '${slug}'`));
    assert.equal(ASSETS[slug].id, slug);
    assert.match(ASSETS[slug].url, /\/k67-audio-assets\//);
    assert.match(html, /THỬ ÂM LƯỢNG TRƯỚC KHI THI/);
    assert.match(html, /PHÁT AUDIO THI THẬT/);
    assert.match(html, /audioTest\.currentTime >= 30/);
    assert.match(html, /id="audioRetry"/);
    assert.doesNotMatch(html, /res\.cloudinary\.com/);
    assert.equal(html.includes('function checkTimeWindow()'), hasTimeWindow);
  }
  const termTest1 = await readFile(join(repoRoot, 'term-tests', 'term-test-1-audio.html'), 'utf8');
  assert.doesNotMatch(termTest1, /18h45 - 24h00/);
});

test('lớp được xếp theo ngày mở trên Portal mà không sửa mảng API gốc', () => {
  const classes = [
    { id: '10', name: 'IC9999', startedAt: '2024-01-01T00:00:00Z' },
    { id: '30', name: 'IC2172', startedAt: '2026-08-01T00:00:00Z' },
    { id: '20', name: 'IC3000', startedAt: '2025-06-01T00:00:00Z' }
  ];
  assert.deepEqual(sortClassesNewestFirst(classes).map(item => item.name), ['IC2172', 'IC3000', 'IC9999']);
  assert.deepEqual(classes.map(item => item.name), ['IC9999', 'IC2172', 'IC3000']);
});

test('lớp chưa có ngày Portal vẫn được xếp theo mã mới tới cũ', () => {
  const classes = [
    { id: '10', name: 'IC2172' },
    { id: '30', name: 'IC2238' },
    { id: '20', name: 'IC2200' }
  ];
  assert.deepEqual(sortClassesNewestFirst(classes).map(item => item.name), ['IC2238', 'IC2200', 'IC2172']);
});

test('đăng nhập Google giả lập đổi ô nhập thành dropdown lớp đã cấp quyền', async () => {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  const token = ['fake', Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fake'].join('.');
  let receivedCookie = '';
  let optionsMode = 'success';
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/api/auth/session') {
        if (request.method === 'POST') {
          response.writeHead(201, {
            'Content-Type': 'application/json; charset=utf-8',
            'Set-Cookie': 'fixture_teacher_session=active; Path=/; HttpOnly; SameSite=Lax'
          });
          response.end(JSON.stringify({ ok: true, reviewer: { displayName: 'Giảng viên thử' } }));
          return;
        }
        if (request.method === 'DELETE') {
          response.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Set-Cookie': 'fixture_teacher_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
          });
          response.end(JSON.stringify({ ok: true }));
          return;
        }
        response.writeHead(request.headers.cookie?.includes('fixture_teacher_session=active') ? 200 : 401, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(request.headers.cookie?.includes('fixture_teacher_session=active')
          ? { ok: true, reviewer: { displayName: 'Giảng viên thử' } }
          : { ok: false, error: 'UNAUTHORIZED' }));
        return;
      }
      if (url.pathname === '/api/term-tests/teacher/options') {
        receivedCookie = request.headers.cookie || '';
        if (optionsMode === 'error') {
          response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ ok: false, message: 'Dịch vụ thử đang bận.' }));
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
          ok: true,
          reviewer: { displayName: 'Giảng viên thử' },
          classes: optionsMode === 'empty' ? [] : [
            { id: '1', name: 'IC9999', startedAt: '2024-01-01T00:00:00Z' },
            { id: '3', name: 'IC2172', startedAt: '2026-08-01T00:00:00Z' },
            { id: '2', name: 'IC3000', startedAt: '2025-06-01T00:00:00Z' }
          ],
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
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({
      contentType: 'application/javascript',
      body: `globalThis.google={accounts:{id:{initialize(options){this.options=options;},renderButton(element){const button=document.createElement('button');button.textContent='Đăng nhập thử';button.onclick=()=>this.options.callback({credential:'${token}'});element.append(button);}}}};`
    }));
    await page.route('**/term-tests/k67-shared/config.js*', route => route.fulfill({
      contentType: 'application/javascript',
      body: "window.TERM_TEST_APP_CONFIG=Object.freeze({API_BASE_URL:'http://127.0.0.1:4180',GOOGLE_CLIENT_ID:'fixture-client-id'});"
    }));
    await page.goto('http://127.0.0.1:4180/term-tests/');
    assert.equal(await page.locator('#classCode').isVisible(), true);
    await page.getByRole('button', { name: 'Đăng nhập thử' }).click();
    await page.locator('#classSelect').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('#classSelect option').allTextContents(), ['IC2172', 'IC3000', 'IC9999']);
    assert.match(receivedCookie, /fixture_teacher_session=active/u);
    assert.equal(await page.locator('#classCodeLabel').getAttribute('for'), 'classSelect');
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const select = await page.locator('#classSelect').boundingBox();
      const results = await page.locator('#teacherDashboard').boundingBox();
      assert.equal(select.y, results.y);
      assert.equal(select.height, results.height);
      assert.ok(Math.abs(select.width / results.width - 2) < 0.01);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    for(const group of await page.locator('#testPicker .landing-actions').all()) {
      const heights = await group.locator('.button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
      assert.equal(new Set(heights.map(Math.round)).size, 1, 'Nút trong cùng nhóm phải cao bằng nhau');
    }
    await page.getByRole('button', { name: 'Term Test 1', exact: true }).click();
    assert.match(await page.locator('#studentLink').inputValue(), /class=IC2172&mode=lis_first$/);
    await page.locator('#classSelect').selectOption('IC3000');
    assert.match(await page.locator('#studentLink').inputValue(), /class=IC3000&mode=lis_first$/);
    await page.reload();
    await page.locator('#classSelect').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await page.locator('#loginStatus').filter({ hasText: 'Đã đăng xuất' }).waitFor();
    assert.equal(await page.locator('#classCode').isVisible(), true);
    assert.equal(await page.locator('#classSelect').isHidden(), true);
    optionsMode = 'error';
    await page.getByRole('button', { name: 'Đăng nhập thử' }).click();
    await page.locator('#loginStatus').filter({ hasText: 'Dịch vụ thử đang bận.' }).waitFor();
    assert.equal(await page.locator('#classCode').isVisible(), true);
    assert.equal(await page.locator('#classSelect').isHidden(), true);
    assert.equal(await page.getByRole('button',{name:'Đăng nhập thử'}).isVisible(),false);
    optionsMode = 'empty';
    await page.getByRole('button', { name: 'Thử lại',exact:true }).click();
    await page.locator('#loginStatus').filter({ hasText: 'chưa được cấp quyền cho lớp nào' }).waitFor();
    assert.equal(await page.locator('#classSelect option').count(), 0);
    assert.deepEqual(browserErrors, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
