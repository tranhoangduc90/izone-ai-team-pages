// Kiểm giao diện thật với máy chủ/Google giả cách ly; không gửi bài hay ghi dữ liệu lớp.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { chromium } = createRequire(pathToFileURL(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const site = 'https://tranhoangduc90.github.io/izone-ai-team-pages';
const entry = '/reading-skills67/materials-beyond-concrete/';
const query = '?server=1&teacher=1&classId=fixture-class&studentRef=fixture-student';
const api = '/reading67-materials/api/reading-skills67';
const title = 'Materials to take us beyond concrete';
const content = {
  code: 'fixture-materials', version: 'fixture', title, subtitle: 'Bài đọc minh họa cách ly',
  instruction: 'Chọn đoạn phù hợp.', blankValues: [], dropdownPlaceholders: [],
  paragraphs: [...'ABCDEFGH'].map(id => ({ id, text: 'Nội dung thử giao diện đoạn ' + id, target: 'p.' + id })),
  questions: [1, 2, 3, 4].map(number => ({ number, text: 'Câu hỏi thử ' + number, hint: 'Thông tin thử',
    targets: { radar: 'q.' + number + '.radar', evidence_l1: 'q.' + number + '.evidence', section: 'q.' + number + '.section' } })),
  targets: []
};
content.targets = [...content.paragraphs.map(p => ({ id: p.target })),
  ...content.questions.flatMap(q => Object.values(q.targets).map(id => ({ id })))];
const work = { identity: { ownerId: 'fixture-student', courseId: 'fixture-class', name: 'Học viên thử', className: 'LỚP THỬ' },
  content, draft: { revision: 0, savedAt: null, body: { answers: {}, flags: [], notes: '', annotations: [] } }, attempts: [] };

// Nút giả chỉ dùng trong browser fixture; sản phẩm vẫn nạp nút Google chính thức.
const google = `window.google={accounts:{id:{initialize(value){window.fixtureCredential=value.callback;},renderButton(root){
 const button=document.createElement('button');button.textContent='Đăng nhập bằng Google';button.type='button';
 button.style.cssText='height:40px;min-height:40px;border:1px solid #dadce0;border-radius:4px;background:white;padding:0 12px;font:500 14px Arial;color:#3c4043';
 button.onclick=()=>window.fixtureCredential({credential:'fixture-only'});root.append(button);
}}}};`;

async function fixture(browser, width, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: width > 800 ? 900 : 844 },
    deviceScaleFactor: 1, locale: 'vi-VN', isMobile: width <= 620, hasTouch: width <= 620 });
  const state = { native: false, shared: false, failure: null, deny: false, ...options };
  const calls = [], errors = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = (value, status = 200) => route.fulfill({ status, json: value });
    if (url.origin === new URL(site).origin && url.pathname.startsWith('/izone-ai-team-pages/')) {
      let file = resolve(root, decodeURIComponent(url.pathname.slice('/izone-ai-team-pages/'.length)));
      if (!file.startsWith(root)) return route.abort();
      if (url.pathname.endsWith('/')) file = resolve(file, 'index.html');
      try { return route.fulfill({ body: await fs.readFile(file), contentType: {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2'
      }[extname(file)] || 'application/octet-stream' }); } catch { return reply({}, 404); }
    }
    if (url.href.startsWith('https://accounts.google.com/gsi/client')) {
      if (state.googleUnavailable) return route.abort();
      return route.fulfill({ body: google, contentType: 'application/javascript' });
    }
    if (url.origin !== 'https://ducizone.ddns.net') return route.abort();
    calls.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
    if (url.pathname.startsWith('/teacher-session-api/v1/restore/')) {
      if (state.restoreFailure) return reply({ error: 'ACCESS_DENIED' }, state.restoreFailure);
      if (state.shared) { state.native = true; return reply({ ok: true }); }
      return reply({ error: 'SSO_LOGIN_REQUIRED' }, 401);
    }
    if (url.pathname.endsWith('/shared-session')) {
      if (state.native && url.pathname.startsWith(api)) { state.shared = true; return reply({ ok: true }); }
      return reply({ error: 'SSO_LOGIN_REQUIRED' }, 401);
    }
    if (url.pathname === '/teacher-session-api/v1/logout') { state.shared = state.native = false; return reply({ ok: true }); }
    if (url.pathname === api + '/config') return reply({ title, code: content.code, studentsOpen: false, googleClientId: 'fixture.apps.googleusercontent.com' });
    if (url.pathname === api + '/teacher/login') {
      if (state.failure) return reply({ error: state.failure }, 403);
      state.native = true; return reply({ ok: true });
    }
    if (url.pathname === api + '/teacher/logout') { state.native = false; return reply({ ok: true }); }
    if (!url.pathname.startsWith(api + '/teacher/')) throw Error('Ghi hoặc API ngoài phạm vi: ' + url.pathname);
    if (request.method() !== 'GET') throw Error('Không cho phép ghi bài: ' + url.pathname);
    if (state.deny) return reply({ error: 'ACCESS_DENIED' }, 403);
    if (!state.native) return reply({ error: 'TEACHER_LOGIN_REQUIRED' }, 401);
    if (url.pathname === api + '/teacher/classes') return reply({ classes: [{ id: 'fixture-class', classCode: 'LỚP THỬ' }] });
    if (url.pathname === api + '/teacher/students/fixture-class') return reply({ students: [{ studentRef: 'fixture-student', name: 'Học viên thử' }] });
    if (url.pathname === api + '/teacher/work/fixture-class/fixture-student') return reply(work);
    throw Error('Route chưa có fixture: ' + url.pathname);
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, state, calls, errors };
}

test('Materials teacher login: desktop/mobile, shared session and permissions', async t => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 390]) {
      await t.test(width + ': login, remember, retry, readonly work, reload/new tab', async () => {
        const f = await fixture(browser, width, { failure: 'GOOGLE_IDENTITY_INVALID' });
        try {
          await f.page.goto(site + entry + query);
          await f.page.getByRole('button', { name: 'Đăng nhập bằng Google' }).waitFor();
          await f.page.evaluate(() => document.fonts.ready);
          const metrics = await f.page.evaluate(() => {
            const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height }; };
            return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
              header: rect('.materials-login-header'), hero: rect('.materials-login-hero'), card: rect('.materials-login-card'),
              font: getComputedStyle(document.querySelector('.materials-login-hero h1')).fontFamily,
              titleSize: getComputedStyle(document.querySelector('.materials-login-hero h1')).fontSize };
          });
          assert.equal(metrics.scrollWidth, width);
          assert.equal(metrics.card.x, width === 1440 ? 140 : 16);
          assert.equal(metrics.card.width, width === 1440 ? 1160 : 358);
          assert.ok(Math.abs(metrics.card.height - (width === 1440 ? 150.19 : 138.19)) < 2, JSON.stringify(metrics));
          assert.equal(metrics.header.height, width === 1440 ? 65 : 58);
          assert.ok(Math.abs(metrics.card.y - (width === 1440 ? 270.53 : 294.72)) < 2, JSON.stringify(metrics));
          assert.equal(metrics.titleSize, width === 1440 ? '32px' : '28px');
          if (process.env.MATERIALS_REFERENCE_HTML) {
            const reference = await f.context.newPage();
            await reference.setContent(await fs.readFile(process.env.MATERIALS_REFERENCE_HTML, 'utf8'));
            await reference.evaluate(() => document.fonts.ready);
            const styles = await reference.evaluate(() => Object.fromEntries(
              ['.studio-header', '.design-brand', '.hero', '.hero h1', '.card', 'label', 'input', '#google-signin', '#teacher-error'].map(s => {
                const el = document.querySelector(s), css = getComputedStyle(el), rect = el.getBoundingClientRect();
                return [s, { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                  style: Object.fromEntries(['fontSize', 'fontWeight', 'lineHeight', 'color', 'margin', 'padding', 'display', 'verticalAlign'].map(k => [k, css[k]])) }];
              })));
            await fs.writeFile(resolve(process.env.MATERIALS_TEST_OUTPUT, 'reference-styles-' + width + '.json'), JSON.stringify(styles, null, 2));
            await reference.close();
          }
          if (process.env.MATERIALS_TEST_OUTPUT) {
            await fs.mkdir(process.env.MATERIALS_TEST_OUTPUT, { recursive: true });
            await f.page.screenshot({ path: resolve(process.env.MATERIALS_TEST_OUTPUT, 'materials-login-' + width + '.png') });
            await fs.writeFile(resolve(process.env.MATERIALS_TEST_OUTPUT, 'metrics-' + width + '.json'), JSON.stringify(metrics, null, 2));
          }
          // Bàn phím phải đổi đúng lựa chọn ghi nhớ, không tạo bản nộp.
          await f.page.locator('#teacher-remember').focus();
          await f.page.keyboard.press('Space');
          assert.equal(await f.page.locator('#teacher-remember').isChecked(), false);
          await f.page.getByRole('button', { name: 'Đăng nhập bằng Google' }).click();
          await f.page.locator('#teacher-error').filter({ hasText: 'GOOGLE_IDENTITY_INVALID' }).waitFor();
          assert.equal(f.calls.find(c => c.path.endsWith('/teacher/login')).body.remember, false);
          assert.equal(await f.page.locator('.materials-login-header').count(), 1);
          f.state.failure = null;
          await f.page.getByRole('button', { name: 'Đăng nhập bằng Google' }).click();
          await f.page.locator('.teacher-notice').waitFor();
          assert.match(await f.page.locator('.learner').innerText(), /Học viên thử/);
          assert.equal(await f.page.locator('.materials-login-header').count(), 0);
          assert.equal(await f.page.locator('.app-header').isVisible(), true);
          assert.equal(await f.page.locator('textarea:not([readonly])').count(), 0);
          assert.equal(await f.page.locator('#grade-button').count(), 0);
          assert.equal(await f.page.locator('.study-pane').count(), 2);
          await f.page.reload(); await f.page.locator('.teacher-notice').waitFor();
          const tab = await f.context.newPage();
          await tab.goto(site + entry + query); await tab.locator('.teacher-notice').waitFor();
          assert.equal(await tab.locator('#google-button').count(), 0);
          assert.equal(f.calls.filter(c => c.path.endsWith('/teacher/login')).length, 2);
          assert.equal(f.calls.some(c => /\/(submit|draft|reset)$/.test(c.path)), false);
          assert.deepEqual(f.errors, []);
        } finally { await f.context.close(); }
      });
      await t.test(width + ': existing shared session skips login; dashboard return link', async () => {
        const f = await fixture(browser, width, { shared: true });
        try {
          await f.page.goto(site + entry + 'teacher.html?returnTo=' + encodeURIComponent('./' + query));
          await f.page.locator('.teacher-notice').waitFor();
          assert.ok(f.calls.some(c => c.path.endsWith('/restore/materials')));
          assert.equal(f.calls.some(c => c.path.endsWith('/teacher/login')), false);
          assert.equal(await f.page.locator('#teacher-remember').count(), 0);
          assert.equal(new URL(f.page.url()).searchParams.get('studentRef'), 'fixture-student');
          await f.page.goto(site + entry + 'teacher.html');
          await f.page.locator('#teacher-class').waitFor();
          await f.page.selectOption('#teacher-class', 'fixture-class');
          await f.page.getByRole('link', { name: 'Xem nháp và lịch sử' }).click();
          await f.page.locator('.teacher-notice').waitFor();
          assert.deepEqual(f.errors, []);
        } finally { await f.context.close(); }
      });
      await t.test(width + ': dashboard login/logout and safe return target', async () => {
        const f = await fixture(browser, width);
        try {
          await f.page.goto(site + entry + 'teacher.html?returnTo=' + encodeURIComponent('https://example.org/'));
          await f.page.getByRole('button', { name: 'Đăng nhập bằng Google' }).click();
          await f.page.locator('#teacher-class').waitFor();
          assert.equal(await f.page.locator('.materials-login-header').count(), 0);
          assert.ok(f.page.url().startsWith(site));
          await f.page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
          await f.page.locator('#teacher-remember').waitFor();
          assert.equal(f.state.shared, false);
          assert.equal(await f.page.locator('#teacher-remember').isChecked(), true);
          assert.deepEqual(f.errors, []);
        } finally { await f.context.close(); }
      });
      for (const [label, options, expected] of [
        ['expired', {}, 'Đăng nhập để xem bài học viên'],
        ['Google unavailable', { googleUnavailable: true }, 'Chưa tải được đăng nhập Google'],
        ['class denied', { shared: true, deny: true }, 'Tài khoản chưa có quyền lớp'],
        ['shared permission denied', { restoreFailure: 403 }, 'chưa có quyền sản phẩm'],
        ['broker unavailable', { restoreFailure: 503 }, 'Chưa khôi phục được phiên']
      ]) {
        await t.test(width + ': ' + label, async () => {
          const f = await fixture(browser, width, options);
          try {
            await f.page.goto(site + entry + query);
            await f.page.getByText(expected, { exact: false }).first().waitFor();
            assert.equal(await f.page.locator('.teacher-notice').count(), 0);
            if (options.deny || options.restoreFailure) assert.equal(await f.page.locator('#google-button').count(), 0);
            assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.deepEqual(f.errors, []);
          } finally { await f.context.close(); }
        });
      }
    }
    for (const width of [320, 620, 768]) {
      await t.test(width + ': no clipped login controls', async () => {
        const f = await fixture(browser, width);
        try {
          await f.page.goto(site + entry + 'teacher.html');
          await f.page.getByRole('button', { name: 'Đăng nhập bằng Google' }).waitFor();
          assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          assert.equal(await f.page.locator('#teacher-remember').isVisible(), true);
          assert.deepEqual(f.errors, []);
        } finally { await f.context.close(); }
      });
    }
    await t.test('student remains closed; sibling Reading67 login keeps its existing screen', async () => {
      const f = await fixture(browser, 390);
      try {
        await f.page.goto(site + entry + '?server=1');
        await f.page.getByText('chưa mở cho học viên', { exact: false }).waitFor();
        assert.equal(await f.page.locator('.materials-login-header').count(), 0);
        // Trang Reading67 gốc có API khác; chỉ thay cấu hình trong fixture cách ly.
        await f.page.route('**/reading-skills67/api-config.js', route => route.fulfill({
          body: 'window.READING67_API_BASE="https://ducizone.ddns.net' + api + '";', contentType: 'application/javascript'
        }));
        await f.page.goto(site + '/reading-skills67/' + query);
        await f.page.getByRole('button', { name: 'Đăng nhập bằng Google' }).waitFor();
        assert.equal(await f.page.locator('.access-card').count(), 1);
        assert.equal(await f.page.locator('.materials-login-header').count(), 0);
        assert.deepEqual(f.errors, []);
      } finally { await f.context.close(); }
    });
  } finally { await browser.close(); }
});
