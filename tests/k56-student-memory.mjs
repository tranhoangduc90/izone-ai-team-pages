import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const studentA = '11111111-1111-4111-8111-111111111111';
const studentB = '22222222-2222-4222-8222-222222222222';
const memoryKey = 'izone:remembered-writing-student:v1:https://ducizone.ddns.net/mapping-api-demo';
const officialKey = 'izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api';

function serve() {
  return new Promise(resolveServer => {
    const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.replace(/^\//, '');
      const target = normalize(join(root, relative));
      if (!target.startsWith(normalize(root))) return response.writeHead(403).end();
      try {
        const content = await readFile(target);
        response.writeHead(200, { 'Content-Type': extname(target) === '.js' ? 'text/javascript' : extname(target) === '.css' ? 'text/css' : 'text/html' });
        response.end(content);
      } catch {
        response.writeHead(404).end();
      }
    });
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

test('K56 nhớ UUID riêng, chỉ gợi ý sau roster và không tự chuẩn bị bài', async () => {
  const server = await serve();
  const port = server.address().port;
  const site = process.env.MEMORY_SITE_BASE || `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const outside = [];
  const pageErrors = [];
  let prepares = 0;
  page.on('pageerror', error => pageErrors.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/k56-shared/config.js')) return route.fulfill({ contentType: 'text/javascript', body: "window.TERM_TEST_APP_CONFIG={API_BASE_URL:'https://ducizone.ddns.net/mapping-api-demo'};" });
    if (url.pathname.endsWith('/api/term-tests/roster')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ class: { name: 'IC5601' }, students: [
        { ref: studentA, name: 'Học viên A' }, { ref: studentB, name: 'Học viên B' }
      ] }) });
    }
    if (url.pathname.endsWith('/session/prepare')) {
      prepares += 1;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture chặn chuẩn bị bài.' }) });
    }
    if (route.request().method() === 'GET' && route.request().url().startsWith(site)) return route.continue();
    outside.push(url.href);
    return route.abort();
  });
  const address = site + 'term-tests/term-test-1-k56-computer-based/?class=IC5601';
  await page.addInitScript(({ key, ref }) => localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: ref })), { key: officialKey, ref: studentB });
  try {
    await page.goto(address);
    await page.locator('#bootstrapStudent option[value="' + studentA + '"]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#bootstrapRememberStudent').isChecked(), true);
    await page.locator('#bootstrapStudent').selectOption(studentA);
    await page.locator('#identityConfirm').waitFor({ state: 'visible' });
    await page.locator('#confirmIdentity').click();
    await page.locator('#bootstrapNotice').filter({ hasText: 'Fixture chặn' }).waitFor();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), memoryKey), JSON.stringify({ version: 1, studentRef: studentA }));
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).studentRef, officialKey), studentB, 'K56 đã đụng lựa chọn hệ chính');
    assert.equal(prepares, 1);

    await page.reload();
    await page.locator('#bootstrapStudent option[value="' + studentA + '"]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#bootstrapStudent').inputValue(), studentA);
    assert.equal(await page.locator('#bootstrapConfirmPrefilled').isVisible(), true);
    assert.equal(prepares, 1, 'Prefill không được chuẩn bị bài tự động');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'K56 tràn ngang mobile');
    await page.screenshot({ path: join(root, 'output/playwright/k56-memory-mobile.png'), fullPage: true });

    await page.locator('#bootstrapStudent').selectOption(studentB);
    await page.locator('#identityConfirm').waitFor({ state: 'visible' });
    await page.evaluate(({ key, ref }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: ref }));
      window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
    }, { key: memoryKey, ref: studentA });
    assert.equal(await page.locator('#bootstrapStudent').inputValue(), studentB, 'Dialog đang mở không được đổi danh tính qua storage event');
    await page.locator('#cancelIdentity').click();

    await page.locator('#bootstrapChangeStudent').click();
    assert.equal(await page.locator('#bootstrapStudent').inputValue(), '');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), memoryKey), null);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).studentRef, officialKey), studentB);

    await page.evaluate(({ key, ref }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: ref }));
    }, { key: memoryKey, ref: studentA });
    await page.reload();
    await page.locator('#bootstrapStudent option[value="' + studentA + '"]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#bootstrapStudent').inputValue(), studentA);
    await page.evaluate(() => {
      window.restoreRemove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = () => { throw new DOMException('Fixture blocked', 'SecurityError'); };
    });
    await page.locator('#bootstrapChangeStudent').click();
    await page.locator('#bootstrapNotice').filter({ hasText: 'Chưa thể đổi' }).waitFor();
    assert.equal(await page.locator('#bootstrapStudent').inputValue(), studentA);
    await page.evaluate(() => { Storage.prototype.removeItem = window.restoreRemove; });
    await page.locator('#bootstrapRememberStudent').uncheck();
    await page.locator('#bootstrapConfirmPrefilled').click();
    await page.locator('#confirmIdentity').click();
    await page.locator('#bootstrapNotice').filter({ hasText: 'Fixture chặn' }).waitFor();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), memoryKey), null, 'Bỏ tick vẫn giữ người đã nhớ');
    assert.equal(outside.length, 0, `Có yêu cầu mạng ngoài fixture: ${outside.join(', ')}`);
    assert.equal(pageErrors.length, 0, `Có lỗi trang: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }
});

test('K56 dùng core chung nhưng giữ namespace K56 và loại demo/hồ sơ thiếu-trùng', async () => {
  const source = await readFile(join(root, 'shared/student-memory.js'), 'utf8');
  const bootstrap = await readFile(join(root, 'term-tests/term-test-1-k56-computer-based/bootstrap.js'), 'utf8');
  const entry = await readFile(join(root, 'term-tests/term-test-1-k56-computer-based/index.html'), 'utf8');
  assert.match(entry, /bootstrap\.js\?v=20260905-memory-v3/);
  assert.match(source, /mapping-api/);
  assert.match(bootstrap, /import\('\.\.\/\.\.\/shared\/student-memory\.js\?v=20260905-memory-v3'\)/);
  assert.match(bootstrap, /localDemo \|\| classCode === 'CODEXDEMO56'/);
  assert.match(source, /matches\.length === 1/);
  assert.match(source, /officialStudent/);
  assert.match(source, /JSON\.stringify\(\{ version: 1, studentRef \}\)/);
  assert.match(bootstrap, /hasActiveExam\(\)/);
  assert.match(bootstrap, /identityDialog\.open/);
  assert.match(bootstrap, /studentMemory\?\.clear\(\) === false/);
  const core = await import(pathToFileURL(join(root, 'shared/student-memory.js')).href);
  const config = { enabled: true, allClasses: true };
  const group = (students) => [{ classRef: 'IC5601', className: 'IC5601', students }];
  assert.equal(core.resolveRememberedStudent(group([{ ref: studentA, temporary: true }]), studentA, 'IC5601', config), null);
  assert.equal(core.resolveRememberedStudent(group([{ ref: studentA }, { ref: studentA }]), studentA, 'IC5601', config), null);
  assert.equal(core.resolveRememberedStudent(group([{ ref: studentA }]), '33333333-3333-4333-8333-333333333333', 'IC5601', config), null);
});
