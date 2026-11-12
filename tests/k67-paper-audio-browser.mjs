import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { ASSETS } from '../shared/audio/catalog.mjs';
import { WORKER_ORIGIN } from '../shared/audio/config.mjs';

const modules = resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = createRequire(resolve(modules, 'playwright/package.json'))('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const base = 'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/';
const entries = [
  ['term-test-1', 'term-test-1-audio.html', true],
  ['term-test-2', 'term-test-2-audio.html', true],
  ['mini-test-lesson-5', 'mini-test-listening-audio.html', false]
];
const live = process.argv.includes('--live');
const routes = process.argv.includes('--term1') ? entries.slice(0, 1) : entries;

try {
  for (const [slug, path, timeWindow] of routes) {
    const context = await browser.newContext({ timezoneId: 'Asia/Saigon' });
    await context.clock.setFixedTime(new Date('2026-11-12T18:44:00+07:00'));
    await context.addInitScript(() => {
      document.addEventListener('k67:paper-audio-load', event => { window.paperAudioLoad = event.detail; });
    });
    if (!live) {
      const html = await readFile(new URL('../term-tests/' + path, import.meta.url), 'utf8');
      const adapter = await readFile(new URL('../term-tests/k67-shared/paper-audio.mjs', import.meta.url), 'utf8');
      await context.route(base + path, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      await context.route(base + 'k67-shared/paper-audio.mjs?*', route => route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: adapter }));
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const checkDenied = !live && slug === 'term-test-1';
    const pagesRequests = [];
    if (checkDenied) {
      page.on('request', request => {
        if (request.url() === ASSETS[slug].url) pagesRequests.push(request.url());
      });
      await page.route(WORKER_ORIGIN + '/access/' + slug + '/*', route => route.fulfill({
        status: 403,
        headers: { 'access-control-allow-origin': new URL(base).origin },
        body: 'denied'
      }), { times: 1 });
    }
    await page.goto(base + path);
    if (checkDenied) {
      await page.locator('#audioRetry').waitFor();
      assert.equal(await page.locator('#status').textContent(), 'Chưa xác nhận được quyền tải audio.');
      assert.equal(await page.locator('#btnCheckVol').isEnabled(), false);
      assert.deepEqual(pagesRequests, []);
      await page.evaluate(() => { delete window.paperAudioLoad; });
      await page.locator('#audioRetry').click();
    }
    await page.waitForFunction(() => window.paperAudioLoad, undefined, { timeout: 100000 });
    const result = await page.evaluate(() => window.paperAudioLoad);
    assert.equal(result.slug, slug);
    assert.equal(result.outcome, 'ready', JSON.stringify(result));
    assert.equal(result.bytes, ASSETS[slug].byteLength);
    assert.ok(result.sources.includes('cloudflare'), JSON.stringify(result));
    assert.equal(await page.locator('#btnPlayMain').isEnabled(), !timeWindow);
    await page.locator('#btnCheckVol').click();
    await page.waitForFunction(() => document.getElementById('audioTest').currentTime > 0.05);
    await page.locator('#btnConfirmVol').click();
    assert.equal(await page.locator('#audioTest').evaluate(node => node.paused), true);
    if (timeWindow) {
      for (const [clock, disabled] of [['18:45', false], ['18:59', false], ['19:00', true]]) {
        await context.clock.setFixedTime(new Date('2026-11-12T' + clock + ':00+07:00'));
        await page.waitForFunction(expected => document.getElementById('btnPlayMain').disabled === expected, disabled);
      }
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ live, ...result, soundCheck: true, timeWindow }));
    await context.close();
  }
} finally {
  await browser.close();
}
