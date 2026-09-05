// Chạy độc lập: node tests/term-student-memory-ui.cjs
// Dữ liệu vào: source Term Test local và roster/API giả trong bộ nhớ.
// Việc chính: kiểm bộ nhớ chỉ điền sẵn UUID, vẫn đòi xác nhận và không tự nối lượt làm.
// Kết quả: báo JSON; không gọi API thật, không tạo bài làm hay dùng dữ liệu học viên thật.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join, normalize } = require('node:path');
const { createRequire } = require('node:module');

const runtime = 'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json';
const { chromium } = createRequire(runtime)('playwright');
const root = normalize(join(__dirname, '..'));
const siteBase = process.argv.includes('--live')
  ? 'https://tranhoangduc90.github.io/izone-ai-team-pages/'
  : 'http://127.0.0.1:4195/';
const unexpectedRequests = [];
const pageErrors = [];
const uuidA = '11111111-1111-4111-8111-111111111111';
const uuidB = '22222222-2222-4222-8222-222222222222';
const memoryKey = 'izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const file = normalize(join(root, relative));
    if (!file.startsWith(root)) throw new Error('Đường dẫn ngoài worktree');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

async function openTestPage(context, { remembered = uuidA, classCode = 'CS.070626', slug = 'term-test-1', activeAttempt = true, storageDenied = false } = {}) {
  // Chỉ cho tải source; mọi endpoint học viên phải có route giả riêng ở bên dưới.
  await context.route('**/*', route => {
    const request = route.request();
    if (request.method() === 'GET' && request.url().startsWith(siteBase)) return route.continue();
    unexpectedRequests.push(request.url().split('?')[0]);
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  const requests = { active: 0, listening: 0 };
  const observed = [];
  page.on('request', request => observed.push(request.url()));
  page.on('pageerror', error => { observed.push(`PAGE_ERROR:${error.message}`); pageErrors.push(error.message); });
  await page.addInitScript(({ key, ref, storageDenied }) => {
    if (storageDenied) {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Fixture blocked', 'SecurityError'); } });
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    if (ref) localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: ref }));
  }, { key: memoryKey, ref: remembered, storageDenied });
  await page.route('**/term-tests/shared/config.js*', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: "window.TERM_TEST_APP_CONFIG=Object.freeze({API_BASE_URL:'https://ducizone.ddns.net/mapping-api'});"
  }));
  await page.route('https://ducizone.ddns.net/mapping-api/api/term-tests/*/client-event', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.route('https://ducizone.ddns.net/mapping-api/api/term-tests/roster*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      class: { code: classCode, name: classCode },
      students: [
        { ref: uuidB, name: 'Học viên giả B' },
        { ref: uuidA, name: 'Học viên giả A' },
        { ref: '33333333-3333-4333-8333-333333333333', name: 'Hồ sơ tạm giả', temporary: true }
      ]
    })
  }));
  await page.route('https://ducizone.ddns.net/mapping-api/api/term-tests/*/attempt/active', route => {
    requests.active += 1;
    if (!activeAttempt) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ active: false }) });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        active: true,
        attemptToken: '44444444-4444-4444-8444-444444444444',
        studentName: 'Học viên giả A',
        readingDraft: {},
        readingDraftRevision: 0
      })
    });
  });
  await page.route('https://ducizone.ddns.net/mapping-api/api/term-tests/term-test-1/listening', route => {
    requests.listening += 1;
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Không được tự nộp.' }) });
  });
  await page.goto(`${siteBase}term-tests/${slug}/?class=${classCode}`);
  try {
    await page.locator('#studentSelect option[value="' + uuidA + '"]').waitFor({ state: 'attached' });
  } catch (error) {
    throw new Error(`${error.message}\n${await page.locator('body').innerText()}\n${observed.join('\n')}`);
  }
  return { page, requests };
}

async function confirmPrefilled(page) {
  await page.locator('#confirm-remembered-student').click();
  const dialog = page.locator('.cbt-identity-confirmation-dialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: 'Xác nhận, tiếp tục' }).click();
  await page.waitForTimeout(40);
}

async function verifyCbtRoute(browser, classCode, slug, screenshot = false) {
  const context = await browser.newContext();
  const prepared = { count: 0, payload: null };
  const opened = await openTestPage(context, { classCode, slug: 'term-test-1' });
  await opened.page.route('**/session/prepare', route => {
    prepared.count += 1;
    prepared.payload = route.request().postDataJSON();
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture chặn prepare.' }) });
  });
  await opened.page.goto(`${siteBase}term-tests/${slug}/?class=${classCode}`);
  const picker = opened.page.locator('#bootstrapStudent');
  await picker.locator(`option[value="${uuidA}"]`).waitFor({ state: 'attached' });
  assert.equal(await picker.inputValue(), uuidA, `CBT ${slug}/${classCode} không prefill UUID`);
  assert.equal(prepared.count, 0, `CBT ${slug}/${classCode} tự gọi prepare`);
  assert.equal(await opened.page.locator('#bootstrap-remember-student').isChecked(), true, 'CBT không tick mặc định');
  await opened.page.evaluate(() => {
    window.restoreMemoryRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function () { throw new DOMException('Fixture blocked', 'SecurityError'); };
  });
  await opened.page.locator('#bootstrap-change-remembered-student').click();
  await opened.page.locator('#bootstrap-remember-student-status').filter({ hasText: 'Không thể xóa' }).waitFor();
  assert.equal(await picker.inputValue(), uuidA, 'Xóa bộ nhớ lỗi vẫn bỏ tên trên màn hình');
  await opened.page.evaluate(() => { Storage.prototype.removeItem = window.restoreMemoryRemove; });
  if (screenshot) await opened.page.screenshot({ path: join(root, 'output', 'playwright', 'term-memory-cbt.png'), fullPage: true });
  await opened.page.locator('#bootstrap-confirm-remembered-student').click();
  const dialog = opened.page.locator('.cbt-identity-confirmation-dialog');
  const otherTab = await context.newPage();
  await otherTab.goto(siteBase + 'writing-handouts/config.json');
  await otherTab.evaluate(({ key, ref }) => localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: ref })), { key: memoryKey, ref: uuidB });
  assert.equal(await picker.inputValue(), uuidA, 'Storage event trong dialog đã đổi UUID đang xác nhận');
  await dialog.getByRole('button', { name: 'Quay lại chọn tên' }).click();
  await opened.page.waitForTimeout(30);
  assert.equal(prepared.count, 0, 'Hủy xác nhận CBT vẫn gọi prepare');
  await picker.selectOption(uuidA);
  await otherTab.evaluate(({ key, ref }) => {
    localStorage.removeItem(key);
    localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: ref }));
  }, { key: memoryKey, ref: uuidB });
  await opened.page.waitForTimeout(50);
  assert.equal(await picker.inputValue(), uuidA, 'Trong dialog, tab khác đổi UUID sắp xác nhận');
  await opened.page.locator('.cbt-identity-confirmation-dialog').getByRole('button', { name: 'Xác nhận, tiếp tục' }).click();
  await opened.page.waitForTimeout(30);
  assert.equal(prepared.count, 1, 'Xác nhận CBT không gọi đúng một prepare');
  assert.equal(prepared.payload?.studentRef, uuidA, 'Prepare nhận UUID khác UUID đã xác nhận');
  await otherTab.close();
  await context.close();
}

async function main() {
  await new Promise(resolve => server.listen(4195, '127.0.0.1', resolve));
  // Máy Windows này không có Chromium bundled của Playwright; dùng Chrome có sẵn
  // chỉ để chạy fixture local, vẫn giữ mọi request API trong route giả.
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  });
  try {
    const context = await browser.newContext();
    const first = await openTestPage(context);
    assert.equal(await first.page.locator('#studentSelect').inputValue(), uuidA, 'UUID hợp lệ không được điền sẵn');
    assert.equal(await first.page.locator('#remember-student').isChecked(), true, 'Ô ghi nhớ phải được chọn mặc định');
    assert.equal(await first.page.locator('#confirm-remembered-student').isVisible(), true, 'Tên điền sẵn thiếu nút xác nhận');
    assert.equal(first.requests.active, 0, 'Điền sẵn đã tự nối lượt làm');
    assert.equal(first.requests.listening, 0, 'Điền sẵn đã tự nộp bài');
    await confirmPrefilled(first.page);
    assert.ok(first.requests.active <= 1, 'Xác nhận tạo nhiều yêu cầu kiểm lượt làm');
    assert.equal(await first.page.evaluate(key => localStorage.getItem(key), memoryKey), JSON.stringify({ version: 1, studentRef: uuidA }), 'Bộ nhớ không chỉ chứa UUID đã xác nhận');

    const other = await context.newPage();
    await other.goto(siteBase + 'writing-handouts/config.json');
    await other.evaluate(({ key, ref }) => localStorage.setItem(key, JSON.stringify({ version: 1, studentRef: ref })), { key: memoryKey, ref: uuidB });
    await first.page.locator('#notice').filter({ hasText: 'Bài hiện tại vẫn giữ đúng danh tính' }).waitFor();
    assert.equal(await first.page.locator('#studentSelect').inputValue(), uuidA, 'Storage event đổi danh tính của lượt đang làm');

    const noMatch = await openTestPage(await browser.newContext(), { remembered: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    assert.equal(await noMatch.page.locator('#studentSelect').inputValue(), '', 'UUID không thuộc roster vẫn được điền');
    assert.equal(await noMatch.page.locator('#confirm-remembered-student').isVisible(), false, 'UUID không thuộc roster vẫn có thể xác nhận');
    await noMatch.page.context().close();

    const uncheckedContext = await browser.newContext();
    const unchecked = await openTestPage(uncheckedContext);
    await unchecked.page.locator('#remember-student').uncheck();
    await confirmPrefilled(unchecked.page);
    assert.equal(await unchecked.page.evaluate(key => localStorage.getItem(key), memoryKey), null, 'Bỏ chọn vẫn ghi nhớ danh tính');
    await uncheckedContext.close();

    const tempContext = await browser.newContext();
    const tempPage = await openTestPage(tempContext, { slug: 'mini-test-lesson-5', activeAttempt: false });
    const tempPicker = tempPage.page.locator('#studentSelect');
    const tempCheckbox = tempPage.page.locator('#remember-student');
    await tempPicker.selectOption('__temporary__');
    await tempPage.page.locator('#temporaryStudentForm').waitFor({ state: 'visible' });
    await tempPage.page.waitForFunction(() => document.querySelector('#remember-student')?.disabled === true);
    assert.equal(await tempCheckbox.isDisabled(), true, 'Hồ sơ tạm vẫn bật ghi nhớ');
    await tempPicker.selectOption(uuidA);
    await tempPage.page.waitForTimeout(20);
    assert.equal(await tempCheckbox.isChecked(), true, 'Temporary làm mất preference tick mặc định');
    await tempCheckbox.uncheck();
    await tempPicker.selectOption('__temporary__');
    await tempPage.page.locator('#temporaryStudentForm').waitFor({ state: 'visible' });
    await tempPicker.selectOption(uuidA);
    await tempPage.page.waitForTimeout(20);
    assert.equal(await tempCheckbox.isChecked(), false, 'Temporary không giữ preference opt-out');
    await tempContext.close();

    const answerRoutes = ['term-test-1', 'term-test-2', 'mini-test-lesson-5'];
    const deniedContext = await browser.newContext();
    const denied = await openTestPage(deniedContext, { storageDenied: true });
    assert.equal(await denied.page.locator('#studentSelect').isEnabled(), true, 'Storage bị chặn làm hỏng chọn tay Term');
    await denied.page.goto(siteBase + 'term-tests/term-test-1-computer-based/?class=CS.070626');
    await denied.page.locator('#bootstrapStudent option[value="' + uuidA + '"]').waitFor({ state: 'attached' });
    assert.equal(await denied.page.locator('#bootstrapStudent').isEnabled(), true, 'Storage bị chặn làm hỏng chọn tay CBT');
    await deniedContext.close();
    for (const classCode of ['CS.070626', 'CS.160826']) {
      for (const slug of answerRoutes) {
        const routeContext = await browser.newContext();
        const route = await openTestPage(routeContext, { classCode, slug });
        assert.equal(await route.page.locator('#studentSelect').inputValue(), uuidA, `${slug}/${classCode} không prefill`);
        assert.equal(route.requests.active, 0, `${slug}/${classCode} tự resume`);
        if (classCode === 'CS.070626' && slug === 'term-test-1') {
          await route.page.screenshot({ path: join(root, 'output', 'playwright', 'term-memory-answer-sheet.png'), fullPage: true });
        }
        await routeContext.close();
      }
    }
    for (const classCode of ['CS.070626', 'CS.160826']) {
      for (const slug of ['term-test-1-computer-based', 'term-test-2-computer-based', 'mini-test-lesson-5-computer-based']) {
        await verifyCbtRoute(browser, classCode, slug, classCode === 'CS.070626' && slug === 'term-test-1-computer-based');
      }
    }

    await context.close();
    assert.deepEqual(unexpectedRequests, [], 'Có yêu cầu mạng chưa mô phỏng');
    assert.deepEqual(pageErrors, [], 'Có lỗi JavaScript trong trình duyệt');
    process.stdout.write(JSON.stringify({ outcome: 'success', externalRequests: unexpectedRequests.length, pageErrors: pageErrors.length, checks: [
      'Điền sẵn UUID duy nhất không tự resume/nộp',
      'Xác nhận hiện có là cổng trước khi ghi nhớ và resume',
      'Storage event không đổi danh tính active attempt',
      'UUID không thuộc roster và untick đều fail-closed',
      'Cả 3 answer sheet và 3 CBT trên hai lớp CS không tự mở lượt làm',
      'Bộ nhớ đổi trong dialog vẫn chuẩn bị đúng UUID; lỗi xóa không báo đã quên',
      'Hồ sơ tạm → chính thức giữ đúng tick mặc định và lựa chọn bỏ tick'
    ] }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
