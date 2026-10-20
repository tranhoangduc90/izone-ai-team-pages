// Kiểm UI thật với lớp/học viên giả; chặn mọi request ra hệ thống production.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modules = process.env.CODEX_NODE_MODULES || resolve(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = createRequire(pathToFileURL(resolve(modules, 'playwright/package.json')))('playwright');

test('Chromium desktop/mobile: khối demo cuối trang, mở demo và lớp thật đúng ba bài và mode', async () => {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    const target = resolve(root, `.${path.endsWith('/') ? path + 'index.html' : path}`);
    if (!target.startsWith(root + sep)) return res.writeHead(403).end();
    // Ranh giới test là điều hướng landing, không chạy lại toàn app thi ở mỗi link.
    if (path.endsWith('-computer-based/')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!doctype html><html><body><h1>Đích bài thi giả lập</h1></body></html>');
    }
    try {
      const content = await readFile(target);
      res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(target)] || 'application/octet-stream' });
      res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{channel:'chrome'}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === base) return route.continue();
    if (url.origin === 'https://accounts.google.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.google={accounts:{id:{initialize(){},renderButton(){}}}};' });
    requests.push({ path: url.pathname, method: req.method() });
    if (url.pathname.endsWith('/api/auth/session')) return route.fulfill({ json: { ok: true } });
    if (url.pathname.endsWith('/teacher/options')) {
      if (url.pathname.includes('mapping-api-demo/')) return route.fulfill({ status: 500, json: { ok: false, message: 'Synthetic demo options failure' } });
      return route.fulfill({ json: { ok: true, reviewer: { displayName: 'Giáo viên giả' }, classes: [{ name: 'CODEXDEMO806' }, { name: 'IC2264' }, { name: 'IC2305' }] } });
    }
    if (url.pathname.endsWith('/roster')) return route.fulfill({ json: { ok: true, students: [{ ref: 'synthetic', name: 'Học viên giả' }] } });
    return route.abort();
  });
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const mode of ['lis_first', 'read_first']) {
        for (const slug of ['term-test-1-k56', 'term-test-2-k56', 'mini-test-k56']) for(const code of ['CODEXDEMO56','IC2264']) {
          await page.goto(`${base}/term-tests/k56-demo/?class=${code}&mode=${mode}`);
          const select = page.locator('#classSelect');
          await select.waitFor({ state: 'visible' });
          assert.equal(await select.inputValue(), code);
          assert.equal(await select.locator('option[value="CODEXDEMO806"]').count(), 0);
          assert.equal(await select.locator('option').first().getAttribute('value'), 'CODEXDEMO56');
          assert.equal(new URL(page.url()).searchParams.get('class'), code);
          const demo=page.locator('#demoClassEntry');await demo.waitFor({state:'visible'});
          assert.equal(await demo.getAttribute('href'),'../demo/?course=56');
          assert.ok((await demo.boundingBox()).y > (await page.locator('#teacherDashboard').boundingBox()).y);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await select.selectOption('IC2305');
          assert.equal(new URL(page.url()).searchParams.get('class'), 'IC2305');
          await select.selectOption(code);
          await page.locator(`[data-slug="${slug}"]`).click();
          await page.waitForURL(`**/${slug}-computer-based/?class=${code}&mode=${mode}`);
        }
      }
    }
    const rosters = requests.filter(item => item.path.endsWith('/roster'));
    assert.equal(rosters.length, 24);
    assert.equal(rosters.filter(item=>item.path.includes('/mapping-api-k56/')).length,12);
    assert.equal(rosters.filter(item=>item.path.includes('/mapping-api-demo/')).length,12);
    assert.ok(rosters.every(item => item.method === 'GET'));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});
