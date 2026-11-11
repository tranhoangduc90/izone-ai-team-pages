import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(process.env.SW_ENTRY_ROOT || fileURLToPath(new URL('../', import.meta.url)));
const { chromium } = createRequire(pathToFileURL(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const origin = 'https://tranhoangduc90.github.io';
const prefix = '/izone-ai-team-pages';
const task = 'writing-task2-living-alone-development';
const catalog = await fs.readFile(resolve(root, 'sw-task2-writing/writing-handouts/shops-review/lesson-config.mjs'), 'utf8');
const tasks = [...catalog.matchAll(/^    "slug": "([^"]+)"/gm)].map(match => match[1]);
const official = { studentRef: 'official-fixture', displayName: 'Học viên thử' };
const temporary = {
  studentRef: 'temporary-fixture', displayName: official.displayName,
  alias: 'Học viên thử · TEMP', provisional: true, requiresAccessCode: true,
};
const help = 'Bạn hãy nhờ giảng viên thêm tên vào danh sách lớp và gửi liên kết làm bài';

function session(slug, studentRef, classRef) {
  const definitions = [
    ['topic_sentence', ['topic_sentence', 'body1_idea1', 'body1_idea2', 'body_choice']],
    ['supporting_idea_1', ['idea1_a', 'idea1_x', 'idea1_b']],
    ['supporting_idea_2', ['idea2_a', 'idea2_x', 'idea2_b']],
    ['draft', ['draft1', 'draft2']],
  ].map(([key, inputFields]) => ({ key, inputFields }));
  return {
    sessionRef: studentRef + '-session', activitySlug: slug, studentRef, classRef, draftVersion: 0,
    responses: {}, sectionDefinitions: definitions,
    sections: Object.fromEntries(definitions.map(d => [d.key, { status: 'not_started', locked: false }])),
    attempts: [], comments: [], ui: { version: 'sw-task2-lesson9-v1', data: {} }, uiEvents: [],
  };
}

async function fixture(browser, { slug = task, query = true, width = 1440, empty = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const classes = [
    { classRef: 'class-fixture', className: 'CS-FIXTURE', students: empty ? [] : [official, temporary] },
    { classRef: 'other-class', className: 'CS-OTHER', students: [] },
  ];
  const sessions = [];
  const registrations = [];
  const errors = [];
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (url.origin === origin) {
      const file = resolve(root, '.' + path.slice(prefix.length) + (path.endsWith('/') ? 'index.html' : ''));
      assert(file.startsWith(root + '\\') || file.startsWith(root + '/'));
      const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
      try { return route.fulfill({ body: await fs.readFile(file), contentType: types[extname(file)] || 'application/octet-stream' }); }
      catch { return route.fulfill({ status: 404, body: '' }); }
    }
    if (url.hostname !== 'ducizone.ddns.net') {
      errors.push('Unexpected external origin');
      return route.abort();
    }
    if (path.endsWith('/sw/status')) return route.fulfill({ json: { ok: true } });
    if (path.endsWith('/roster')) return route.fulfill({ json: { classes } });
    if (path.endsWith('/provisional-students')) {
      registrations.push(req.method());
      return route.fulfill({ status: 500, json: { error: 'UNEXPECTED_REGISTRATION' } });
    }
    if (path.endsWith('/lesson9/sessions') && req.method() === 'POST') {
      const body = req.postDataJSON();
      sessions.push(body);
      if (body.studentRef === temporary.studentRef && body.accessCode !== '4826') {
        return route.fulfill({ status: 403, json: { error: 'INVALID_ACCESS_CODE', message: 'Mã truy cập không đúng.' } });
      }
      return route.fulfill({ json: { session: session(slug, body.studentRef, body.classRef) } });
    }
    if (path.endsWith('/teacher-comments')) return route.fulfill({ json: { threads: [] } });
    if (path.includes('/lesson9/sessions/')) {
      return route.fulfill({ json: { session: session(slug, temporary.studentRef, 'class-fixture') } });
    }
    errors.push('Unexpected API ' + req.method() + ' ' + path);
    return route.fulfill({ status: 500, json: { error: 'UNEXPECTED_FIXTURE' } });
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + prefix + '/sw-task2-writing/index.html?task=' + slug + (query ? '&class=CS-FIXTURE' : ''));
  await page.locator('#identity-form').waitFor();
  return {
    page, sessions,
    async close() {
      try {
        assert.deepEqual(registrations, [], 'The student page should never call the registration API');
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    },
  };
}

async function continueAsStudent(page) {
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByRole('button', { name: /Đúng là tôi/ }).click();
}

async function screenshot(page, name) {
  if (!process.env.SW_ENTRY_OUTPUT) return;
  await fs.mkdir(process.env.SW_ENTRY_OUTPUT, { recursive: true });
  await page.screenshot({ path: resolve(process.env.SW_ENTRY_OUTPUT, name + '.png'), fullPage: true });
}

test('SW: tám đề hướng dẫn nhờ giảng viên khi thiếu tên, kể cả lớp rỗng trên mobile', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    assert.equal(tasks.length, 8);
    for (const slug of tasks) {
      const f = await fixture(browser, { slug, width: 390, empty: true });
      try {
        const toggle = f.page.getByText('Không có tên trong danh sách', { exact: true });
        const notice = f.page.getByText(help, { exact: true });
        assert.equal(await notice.isVisible(), false);
        await toggle.press('Enter');
        await notice.waitFor({ timeout: 4000 });
        assert.equal(await f.page.locator('#identity-class').inputValue(), 'class-fixture');
        assert.equal(await f.page.getByText('Tạo hồ sơ tạm', { exact: true }).count(), 0);
        assert.equal(await f.page.getByText('Mở lại bài bằng mã 4 số', { exact: true }).isVisible(), false);
        assert(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (slug === task) await screenshot(f.page, 'mobile-missing-name');
        await toggle.press('Space');
        assert.equal(await notice.isVisible(), false);
        assert.deepEqual(f.sessions, []);
      } finally { await f.close(); }
    }
  } finally { await browser.close(); }
});

test('SW: tên đã có và hồ sơ PIN cũ vẫn mở đúng bài qua đường chọn tên', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const f = await fixture(browser);
  try {
    await f.page.locator('#identity-person').selectOption(official.studentRef);
    assert.equal(await f.page.locator('#pin-box').isVisible(), false);
    await continueAsStudent(f.page);
    await f.page.locator('#save-state').waitFor();
    assert.deepEqual(f.sessions[0], { activitySlug: task, classRef: 'class-fixture', studentRef: official.studentRef });

    await f.page.evaluate(() => localStorage.clear());
    await f.page.reload();
    await f.page.locator('#identity-person').selectOption(temporary.studentRef);
    await f.page.locator('#access-code').fill('4826');
    await continueAsStudent(f.page);
    await f.page.locator('#save-state').waitFor();
    assert.deepEqual(f.sessions[1], { activitySlug: task, classRef: 'class-fixture', studentRef: temporary.studentRef, accessCode: '4826' });
    const stored = await f.page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    assert(!stored.includes('4826'));
  } finally { await f.close(); await browser.close(); }
});

test('SW: lối PIN lọc đúng hồ sơ, từ chối mã sai và xóa mã khi đổi lớp', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const f = await fixture(browser, { query: false });
  try {
    const page = f.page;
    await page.locator('#identity-class').selectOption('class-fixture');
    await page.getByRole('button', { name: 'Mở lại bài bằng mã 4 số', exact: true }).click({ timeout: 4000 });
    const person = page.locator('#identity-person');
    assert.deepEqual(await person.locator('option').allTextContents(), ['Chọn tên của bạn', temporary.alias]);
    await person.selectOption(temporary.studentRef);
    await page.locator('#access-code').fill('1111');
    await screenshot(page, 'desktop-reopen-with-pin');
    await continueAsStudent(page);
    await page.getByText('Mã truy cập không đúng.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Chọn lại tên', exact: true }).click();
    assert.equal(await page.locator('#access-code').inputValue(), '');
    assert.equal(await person.inputValue(), temporary.studentRef);
    await page.locator('#access-code').fill('4826');
    await page.locator('#identity-class').selectOption('other-class');
    assert.equal(await page.locator('#access-code').inputValue(), '');
    assert.equal(await page.locator('#pin-box').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Mở lại bài bằng mã 4 số', exact: true }).isVisible(), false);
    await page.locator('#identity-class').selectOption('class-fixture');
    await page.getByRole('button', { name: 'Mở lại bài bằng mã 4 số', exact: true }).click();
    await person.selectOption(temporary.studentRef);
    await page.locator('#access-code').fill('4826');
    await continueAsStudent(page);
    await page.locator('#save-state').waitFor();
    assert.deepEqual(f.sessions.map(({ studentRef, classRef, accessCode }) => [studentRef, classRef, accessCode]),
      [[temporary.studentRef, 'class-fixture', '1111'], [temporary.studentRef, 'class-fixture', '4826']]);
  } finally { await f.close(); await browser.close(); }
});
