// Chạy giao diện và API K67 thật với PostgreSQL nhúng, tên/đề/audio giả tại localhost.
// Chặn mọi mạng ngoài trước khi mở trang; lỗi lưu ở thư mục bằng chứng được chỉ định.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.K67_PREVIEW_URL || 'http://127.0.0.1:8877';
assert.equal(new URL(base).hostname, '127.0.0.1');
const out = process.env.IDENTITY_EVIDENCE_DIR;
assert.ok(out); await mkdir(out, { recursive: true });
const key = 'izone:student-identity:v1';
const refA = '11111111-1111-4111-8111-111111111111', refB = '44444444-4444-4444-8444-444444444444';
const memory = id => ({ version: 1, identity: { authority: 'erp-contact', id }, revision: 'fixture_1234567890', updatedAt: new Date().toISOString() });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
async function setup(id, blocked = false) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' }), requests = [], errors = [], external = [];
  ctx.on('page', p => { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message));
    p.on('dialog', d => d.type() === 'beforeunload' ? d.accept() : d.dismiss()); });
  await ctx.route('**/*', route => {
    if (new URL(route.request().url()).origin !== base) { external.push(route.request().url()); return route.abort(); }
    requests.push({ path: new URL(route.request().url()).pathname, body: route.request().postData() });
    return route.continue();
  });
  await ctx.addInitScript(({ key, initial, blocked, base }) => {
    if (location.origin !== base) return;
    if (initial && !sessionStorage.getItem('fixture-seeded')) {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
      sessionStorage.setItem('fixture-seeded', 'true');
    }
    window.__plays = 0;
    HTMLMediaElement.prototype.play = function () { window.__plays++; return Promise.resolve(); };
    if (blocked) for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name,
      { configurable: true, get() { throw new DOMException('Bộ nhớ giả bị chặn', 'SecurityError'); } });
  }, { key, initial: id ? memory(id) : null, blocked, base });
  return { ctx, requests, errors, external, page: await ctx.newPage() };
}
async function reset() {
  const r = await fetch(base + '/preview/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200); assert.equal((await r.json()).fixtureOnly, true);
}
async function run(name, fn) {
  await reset(); const s = await setup(...fn.setup);
  try { await fn.test(s); assert.deepEqual(s.errors, []); assert.deepEqual(s.external, []);
    results.push({ case: name, status: 'passed' }); console.log('Đạt:', name);
  } catch (error) {
    await s.page.screenshot({ path: path.join(out, name + '-failure.png'), fullPage: true });
    await writeFile(path.join(out, name + '-failure.html'), await s.page.content(), 'utf8');
    results.push({ case: name, status: 'failed', error: error.message, pageErrors: s.errors, requests: s.requests }); throw error;
  } finally { await s.ctx.close(); }
}
const paper = process.env.IDENTITY_K67_DELIVERY === 'paper';
const url = (slug, mode) => `${base}/term-tests/${slug}${paper ? '' : '-computer-based'}/?class=IC2304&mode=${mode}`;
async function choose(page, slug, ref) {
  await page.locator(paper ? '#studentSelect' : '#bootstrapStudent').selectOption(ref);
  if (paper && slug === 'mini-test-lesson-5') await page.locator('#miniEnter').click();
  await page.getByRole('button', { name: 'Xác nhận, tiếp tục', exact: true }).click();
}
async function owner(page) {
  return page.evaluate(() => window.TERM_TEST_BOOTSTRAP?.sessionState || JSON.parse(
    localStorage.getItem(history.state?.izoneStudentProductStateV1?.stateKey || '') || '{}'));
}
try {
  for (const slug of ['term-test-1', 'term-test-2', 'mini-test-lesson-5']) {
    for (const mode of ['lis_first', 'read_first']) await run(`${slug}-${mode}-remembered`, {
      setup: ['900001'], test: async ({ page, requests }) => {
        await page.goto(url(slug, mode));
        if (paper && mode === 'lis_first') {
          await page.locator('#listeningView').waitFor();
          assert.equal(await page.locator('#studentSelect').inputValue(), refA);
          assert.equal(requests.some(r => /\/audio(?:$|-)/.test(r.path)), false);
        } else if (mode === 'lis_first') {
          await page.locator('#bootstrapPreview:enabled').waitFor();
          assert.equal(await page.locator('#bootstrapStudent').inputValue(), refA);
          assert.ok(requests.some(r => /\/session\/[^/]+\/audio$/.test(r.path)));
          assert.equal(await page.locator('#bootstrapStart').isDisabled(), true);
        } else {
          await page.locator('#startReading').waitFor();
          assert.equal(requests.some(r => r.path.endsWith('/session/audio')), false);
        }
        assert.equal(requests.some(r => /\/(?:session\/start|reading\/start)$/.test(r.path)), false);
        assert.equal(await page.evaluate(() => window.__plays), 0);
        assert.equal(await page.getByRole('button', { name: 'Đổi người học', exact: true }).count(), 1);
      }
    });
    await run(`${slug}-first-producer-and-next-page`, { setup: [], test: async ({ page, ctx }) => {
      await page.goto(url(slug, 'read_first')); await choose(page, slug, refB);
      await page.locator('#startReading').waitFor();
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').identity?.id === '900002', key);
      const other = await ctx.newPage(); await other.goto(url(slug, 'lis_first'));
      // Lượt đã chọn Reading trước phải giữ thứ tự đó dù mở lại bằng link Listening trước.
      await other.locator('#startReading').waitFor();
      assert.equal(await other.locator('#studentSelect').inputValue(), refB);
    } });
    await run(`${slug}-active-owner-other-tab-reload`, { setup: ['900001'], test: async ({ page, ctx }) => {
      await page.goto(url(slug, 'read_first')); await page.locator('#startReading').click();
      const field = page.locator('#readingView [data-number]').first();
      if (await field.evaluate(el => el.tagName === 'SELECT')) await field.selectOption({ index: 1 }); else await field.fill('DRAFT A');
      const draft = await field.inputValue();
      const before = paper ? await page.evaluate(() => {
        const ref = document.querySelector('#studentSelect').value;
        const all = Object.keys(localStorage).filter(k => k.includes(ref) && !k.includes('identity'));
        return all.map(k => JSON.parse(localStorage.getItem(k) || '{}')).find(s => s.attemptToken) || {};
      }) : await owner(page);
      const other = await ctx.newPage(); await other.goto(base + '/preview/status');
      await other.evaluate(({ key, next }) => localStorage.setItem(key, JSON.stringify(next)), { key, next: { ...memory('900002'), revision: 'other_tab_12345678' } });
      await page.reload(); await page.locator('#readingView').waitFor();
      assert.equal(await page.locator('#readingView [data-number]').first().inputValue(), draft);
      const after = paper ? await page.evaluate(() => {
        const ref = document.querySelector('#studentSelect').value;
        return Object.keys(localStorage).filter(k => k.includes(ref) && !k.includes('identity'))
          .map(k => JSON.parse(localStorage.getItem(k) || '{}')).find(s => s.attemptToken) || {};
      }) : await owner(page);
      assert.equal(after.studentRef, refA); assert.equal(after.attemptToken, before.attemptToken);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).identity.id, key), '900002');
    } });
    await run(`${slug}-blocked-storage-manual`, { setup: [null, true], test: async ({ page }) => {
      await page.goto(url(slug, 'read_first')); await choose(page, slug, refA);
      await page.locator('#startReading').waitFor(); await page.locator('#startReading').click();
      await page.locator('#readingView').waitFor();
      assert.equal(await page.locator('#studentSelect').inputValue(), refA);
    } });
    if (paper) await run(`${slug}-missing-class-remembered`, { setup: ['900001'], test: async ({ page, requests }) => {
      const target = new URL(url(slug, 'read_first')); target.searchParams.delete('class');
      await page.goto(target.href);
      await page.locator('#startReading').waitFor();
      assert.equal(new URL(page.url()).searchParams.get('class'), 'IC2304');
      assert.equal(await page.locator('#studentSelect').inputValue(), refA);
      assert.equal(requests.some(r => /\/(?:session\/start|reading\/start)$/.test(r.path)), false);
    } });
  }
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2), 'utf8'); await browser.close();
}
