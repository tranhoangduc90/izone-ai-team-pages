import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundled = resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = createRequire(bundled)('playwright');
const origin = 'https://tranhoangduc90.github.io';
const prefix = '/izone-ai-team-pages/';
const base = origin + prefix;
const api = 'https://ducizone.ddns.net';
const checkPath = 'term-tests/k56-login-check/';
const reportHost = 'https://izone-k56-login-reports.tranhoangduc90.workers.dev';
const fixtureCase = 'f'.repeat(43);
const account = 'test-staff@example.test';
const fixtureToken = 'fixture-google-token';
const loginSdk = "window.google={accounts:{id:{initialize(o){this.callback=o.callback},renderButton(el){const b=document.createElement('button');b.textContent='Google thử';b.onclick=()=>this.callback({credential:'fixture-google-token'});el.append(b)}}}};";
const options = '/mapping-api-k56/api/term-tests/teacher/options';
const reading = '/reading-practice-api/api/teacher/shared-session';
const restoreK56 = '/teacher-session-api/v1/restore/k56';
let browser;

test.before(async () => { browser = await chromium.launch({ headless: true, channel: 'chrome' }); });
test.after(async () => { await browser?.close(); });

async function fixture(t, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  t.after(() => context.close());
  const page = await context.newPage();
  const state = { authenticated: false, blocked: new Set(), classes: ['IC2367'], optionsStatus: 200, calls: [], sent: [], unexpected: [] };
  const headers = {
    'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,x-izone-csrf', 'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const method = req.method();
    if (url.origin === origin && p.startsWith(prefix)) {
      const rel = p.slice(prefix.length) + (p.endsWith('/') ? 'index.html' : '');
      const file = resolve(root, rel);
      assert.ok(file.startsWith(resolve(root) + sep));
      const body = await readFile(file).catch(() => null);
      if (!body) return route.fulfill({ status: 404, body: '' });
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      return route.fulfill({ status: 200, contentType: mime[extname(file)] || 'application/octet-stream', body });
    }
    if (url.origin === 'https://accounts.google.com' && p === '/gsi/client') {
      state.calls.push([method, p]);
      if (state.blocked.has(p)) return route.abort('connectionreset');
      return route.fulfill({ contentType: 'text/javascript', body: loginSdk });
    }
    if (url.origin === reportHost && p === '/v1/reports') {
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
      assert.equal(method, 'POST');
      assert.equal(req.headers().authorization, 'Bearer ' + fixtureCase);
      state.sent.push(req.postDataJSON());
      return route.fulfill({ status: 204, headers, body: '' });
    }
    if (url.origin !== api) {
      state.unexpected.push([method, url.origin, p]);
      return route.abort('blockedbyclient');
    }
    state.calls.push([method, p]);
    if (state.blocked.has(p)) return route.abort('connectionreset');
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    const reply = (status, body = {}) => route.fulfill({ status, headers, json: { ok: status < 400, ...body } });
    if (p.endsWith('/health')) return reply(200);
    if (p.endsWith('/shared-session') || p.startsWith('/teacher-session-api/v1/restore/')) return reply(state.authenticated ? 200 : 401);
    if (p.endsWith('/api/auth/session')) {
      if (method === 'POST') {
        assert.equal(req.postDataJSON().credential, fixtureToken);
        state.authenticated = true;
        return reply(201);
      }
      return reply(state.authenticated ? 200 : 401);
    }
    if (p === options || p === options.replace('api-k56', 'api-demo')) return reply(state.optionsStatus, {
      reviewer: { email: account, displayName: 'Fixture Teacher' },
      classes: state.classes.map(name => ({ name }))
    });
    state.unexpected.push([method, url.origin, p]);
    return reply(404);
  });
  return { page, state };
}

const check = page => page.locator('#check');
const fixtureGoogle = page => page.getByRole('button', { name: 'Google thử', exact: true });
async function load(page) {
  await page.goto(base + checkPath, { waitUntil: 'load' });
  assert.equal(await check(page).isEnabled(), true);
}
async function report(page) {
  await check(page).filter({ hasText: 'Kiểm tra lại' }).waitFor();
  return JSON.parse(await page.locator('#report').inputValue());
}
async function run(page) {
  await check(page).click();
  await page.waitForFunction(() => !document.querySelector('#check').disabled);
  return report(page);
}

for (const width of [1280, 390]) test('Giao diện K56, Google sạch, quyền lớp và xuất báo cáo · ' + width, async t => {
  const { page, state } = await fixture(t, width);
  await load(page);
  assert.deepEqual(state.calls, []);
  assert.equal(await page.locator('[data-test], #teacherDashboard, #openExam').count(), 0);
  assert.equal((await run(page)).runs[0].outcome, 'SIGNED_OUT');
  await fixtureGoogle(page).click();
  await page.getByText('Tài khoản này có quyền giảng viên với lớp IC2367.').waitFor();
  await page.waitForFunction(() => !document.querySelector('#check').disabled);
  const result = await report(page);
  assert.equal(result.runs.at(-1).outcome, 'CLASS_ACCESS_OK');
  assert.ok(result.runs.at(-1).requests.some(event => event.step === 'Đọc quyền lớp · k56' && event.http === 200));
  assert.match(await page.locator('#signedInAccount').innerText(), /test-staff@example.test/);
  assert.ok(!JSON.stringify(result).includes(account));
  assert.ok(!JSON.stringify(result).includes(fixtureToken));
  assert.ok(!JSON.stringify(result).includes('Fixture Teacher'));
  await page.getByText('Xem báo cáo kỹ thuật').click();
  const beforeDownload = state.calls.length;
  const receipt = page.waitForEvent('download');
  await page.locator('#download').click();
  const file = await receipt;
  assert.equal(file.suggestedFilename(), 'k56-kiem-tra-dang-nhap.json');
  assert.deepEqual(JSON.parse(await readFile(await file.path(), 'utf8')), result);
  assert.equal(state.calls.length, beforeDownload);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (process.env.K56_CHECK_ARTIFACTS) {
    await page.screenshot({ path: resolve(process.env.K56_CHECK_ARTIFACTS, 'k56-login-check-' + width + '.png'), fullPage: true });
    const size = await page.locator('.landing-card').boundingBox();
    const login = await page.locator('.landing-auth').boundingBox();
    await page.goto(base + 'term-tests/k56-demo/');
    assert.equal((await page.locator('.landing-card').boundingBox()).width, size.width);
    assert.equal((await page.locator('.landing-auth').boundingBox()).width, login.width);
  }
  assert.deepEqual(state.unexpected, []);
});

test('Mất kết nối nguồn phiên, phục hồi và phân biệt lỗi quyền', async t => {
  const { page, state } = await fixture(t);
  state.blocked.add(reading);
  await load(page);
  const first = await run(page);
  assert.equal(first.runs[0].outcome, 'SESSION_UNVERIFIED');
  assert.ok(first.runs[0].requests.some(event => event.step === 'Tìm phiên ở reading' && event.error === 'FETCH_FAILED'));
  assert.equal(state.calls.some(([, p]) => p === options || p === '/gsi/client'), false);
  state.blocked.clear();
  state.authenticated = true;
  state.classes = ['IC2197'];
  const second = await run(page);
  assert.equal(second.runs[1].outcome, 'CLASS_NOT_GRANTED');
  assert.ok(second.runs[1].requests.some(event => event.step === 'Khôi phục phiên k56' && event.http === 200));
  state.optionsStatus = 503;
  const third = await run(page);
  assert.equal(third.runs[2].outcome, 'CLASS_LOOKUP_FAILED');
  assert.equal(third.runs[2].classError, 503);
  assert.equal(await page.locator('#loginBadge').innerText(), 'Đã xác minh phiên');
  assert.deepEqual(state.unexpected, []);
});

test('Google SDK bị chặn và báo cáo vẫn tải được', async t => {
  const { page, state } = await fixture(t, 390);
  state.blocked.add('/gsi/client');
  await load(page);
  await run(page);
  await page.getByText(/Không tải được nút Google/).waitFor();
  const result = await report(page);
  assert.equal(result.googleButton, 'LOAD_FAILED');
  assert.equal(result.runs[0].outcome, 'SIGNED_OUT');
  assert.ok(state.calls.some(([, path]) => path === restoreK56));
  assert.ok(!state.calls.some(([, path]) => path === options));
  assert.deepEqual(state.unexpected, []);
});

test('Link hỗ trợ tự gửi lỗi trước đăng nhập, rồi tự gửi kết quả sau khi đăng nhập', async t => {
  const { page, state } = await fixture(t);
  state.blocked.add(reading);
  await page.goto(base + checkPath + '#case=' + fixtureCase);
  await page.getByText('Đã gửi báo cáo kỹ thuật.').waitFor();
  const first = state.sent.find(item => item.run?.outcome === 'SESSION_UNVERIFIED');
  assert.ok(first?.run.requests.some(row => row.step === 'Tìm phiên ở reading' && row.error === 'FETCH_FAILED'));
  state.blocked.clear();
  await fixtureGoogle(page).click();
  await page.getByText('Tài khoản này có quyền giảng viên với lớp IC2367.').waitFor();
  await page.waitForFunction(() => document.querySelector('#reportDelivery').textContent === 'Đã gửi báo cáo kỹ thuật.');
  assert.equal(state.sent.at(-1).run.outcome, 'CLASS_ACCESS_OK');
  const sent = JSON.stringify(state.sent);
  assert.ok(!sent.includes(account) && !sent.includes(fixtureToken) && !sent.includes(fixtureCase));
  assert.deepEqual(state.unexpected, []);
});

test('Người dùng có thể dừng trước khi gửi', async t => {
  const { page, state } = await fixture(t);
  await page.goto(base + checkPath + '#case=' + fixtureCase);
  await page.getByRole('button', { name: 'Dừng tự gửi' }).click();
  await run(page);
  assert.deepEqual(state.sent, []);
  assert.equal(new URL(page.url()).hash, '');
});
