import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const modules = resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = createRequire(resolve(modules, 'playwright/package.json'))('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const origin = 'https://tranhoangduc90.github.io';
const base = origin + '/izone-ai-team-pages/term-tests/';
const live = process.argv.includes('--live');
const widths = [1440, 1024, 768, 390, 320];
const tests = [
  ['Term Test 1', 'term-test-1', 'term-test-1-audio.html'],
  ['Term Test 2', 'term-test-2', 'term-test-2-audio.html'],
  ['Mini Test Buổi 5', 'mini-test-lesson-5', 'mini-test-listening-audio.html']
];
const destinations = new Set();

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  // Probe navigation without opening any exam attempt or reading a real roster.
  await context.route(base + '**', route => route.request().isNavigationRequest() && route.request().url() !== base
    ? route.fulfill({ contentType: 'text/html', body: '<title>Đã mở đúng URL</title>' }) : route.fallback());
  if (!live) {
    for (const [file, url, type] of [
      ['index.html', base, 'text/html'],
      ['k67-landing.css', base + 'k67-landing.css?*', 'text/css'],
      ['shared/landing.js', base + 'shared/landing.js?*', 'text/javascript']
    ]) {
      const body = await readFile(new URL('../term-tests/' + file, import.meta.url), 'utf8');
      await context.route(url, route => route.fulfill({ contentType: type + '; charset=utf-8', body }));
    }
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://ducizone.ddns.net*/**', route => route.fulfill({
    status: 401,
    headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' },
    json: { ok: false }
  }));
  const id = name => page.locator('#' + name);
  const button = name => page.getByRole('button', { name, exact: true });
  async function openTab(trigger, href) {
    assert.equal(await trigger.evaluate(node => node.href), href);
    const [popup] = await Promise.all([context.waitForEvent('page'), trigger.click()]);
    await popup.waitForURL(href);
    assert.equal(await popup.evaluate(() => window.opener), null);
    await popup.close();
    await page.bringToFront();
    destinations.add(href);
  }
  async function columns(selector) {
    const [left, right] = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
      const { x, y, width } = node.getBoundingClientRect();
      return { x, y, width };
    }).filter(node => node.width > 0));
    assert.equal(left.y, right.y);
    assert.ok(left.x < right.x && Math.abs(left.width / right.width - 2) < 0.01);
  }

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await id('testPicker').waitFor();
    assert.equal(await id('classCode').inputValue(), '');
    assert.equal(await id('testActions').isHidden(), true);
    await columns('.class-and-results > *');
    assert.equal(await id('teacherDashboard').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(219, 8, 41)');
    await id('classCode').fill(' ic2139 ');
    for (const [name, slug, audio] of (width === 1440 ? tests : tests.slice(0, 1))) {
      await button(name).press('Enter');
      assert.equal(await id('chosenName').textContent(), name);
      assert.equal(await id('chosenName').evaluate(node => getComputedStyle(node).fontSize), '22px');
      assert.equal(await id('paperHeading').evaluate(node => getComputedStyle(node).fontSize), width <= 480 ? '16px' : '18px');
      await columns('.exam-layout > section');
      assert.equal(await id('rescue').evaluate(node => node.open), false);
      await id('rescue').locator('summary').click();
      assert.equal(await id('backupAudio').locator('small').textContent(), 'Nguồn audio thay thế cho phần Listening.');
      assert.equal(await id('answerSheet').locator('small').textContent(), 'Phiếu trả lời để học viên nhập đáp án.');
      for (const [mode, label] of [['lis_first', 'Listening trước'], ['read_first', 'Reading trước']]) {
        await button(label).click();
        const field = id('studentLink');
        assert.equal(await id('copyStatus').textContent(), '');
        await field.hover();
        assert.equal(await page.locator('.copy-link-icon').isVisible(), true);
        assert.equal(await field.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(228, 245, 234)');
        if (mode === 'read_first') await field.press('Enter');
        else await field.click();
        await id('copyStatus').filter({ hasText: 'Link đã được copy, sẵn sàng gửi cho học viên.' }).waitFor();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), base + slug + '-computer-based/?class=IC2139&mode=' + mode);
        if (width === 1440) {
          await openTab(id('openExam'), base + slug + '-computer-based/?class=CODEXDEMO806&mode=' + mode);
          await openTab(id('answerSheet'), base + slug + '/?class=IC2139&mode=' + mode);
        }
      }
      assert.equal(await id('paperAudio').evaluate(node => node.href), await id('backupAudio').evaluate(node => node.href));
      if (width === 1440) {
        await openTab(id('paperAudio'), base + audio);
        await openTab(id('backupAudio'), base + audio);
      }
      if (slug === 'term-test-1' && process.env.K67_QA_DIR && [1440, 390].includes(width)) {
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.activeElement.blur());
        await page.screenshot({ path: resolve(process.env.K67_QA_DIR, `dashboard-${live ? 'live' : 'candidate'}-${width}.png`), fullPage: true });
      }
      await id('changeTest').click();
      assert.equal(await button(name).evaluate(node => node === document.activeElement), true);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base);
  await button('Term Test 1').click();
  await id('studentLink').click();
  assert.equal(await id('classCode').evaluate(node => node.validationMessage), 'Hãy nhập hoặc chọn mã lớp hợp lệ.');
  await id('classCode').fill('ic2139');
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new Error('Clipboard blocked for QA'); };
    document.execCommand = () => false;
  });
  await id('studentLink').click();
  await id('copyStatus').filter({ hasText: 'Hãy nhấn Ctrl+C hoặc ⌘C' }).waitFor();
  assert.equal(await id('studentLink').evaluate(node => node.selectionEnd - node.selectionStart), (await id('studentLink').inputValue()).length);
  await id('teacherDashboard').click();
  await page.waitForURL(base + 'teacher/?class=IC2139');
  await page.goto(base);
  await id('teacherDashboard').click();
  await page.waitForURL(base + 'teacher/');
  assert.deepEqual(errors, []);
  assert.equal(destinations.size, 15);
  console.log(JSON.stringify({ live, widths, destinations: [...destinations], clipboard: true, errors }));
} finally {
  await browser.close();
}
