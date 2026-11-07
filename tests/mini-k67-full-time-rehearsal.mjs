import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Full native-timing rehearsal on isolated data. Does not certify an offline CBT release.
const mode = process.argv[2];
assert.ok(['lis_first', 'read_first'].includes(mode));
const backend = process.argv[3];
assert.ok(backend, 'Supply the isolated K67 backend package.');
const pages = fileURLToPath(new URL('../', import.meta.url));
const reservation = createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const fixture = spawn(process.execPath, ['tools/preview-exam-order.mjs', pages], { cwd: backend, windowsHide: true,
  env: { ...process.env, K67_ORDER_NATIVE_URL: '', K67_PREVIEW_PORT: String(port), K67_PREVIEW_REAL_MINI_AUDIO: 'true',
    K67_PREVIEW_AUDIO_PROTECTION: 'true', K67_PREVIEW_AUDIO_OWNER: 'true' }, stdio: ['ignore','pipe','pipe'] });
let browser;
fixture.stdout.pipe(process.stderr);
fixture.stderr.pipe(process.stderr);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = (phase, details = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), mode, phase, ...details }));
const endpoint = '/api/term-tests/mini-test-lesson-5';

try {
  let ready = false;
  for (let attempt = 0; attempt < 80 && !ready; attempt += 1) {
    assert.equal(fixture.exitCode, null, 'Local fixture exited during startup');
    try { ready = (await (await fetch(base + '/preview/status')).json()).fixtureOnly === true; } catch {}
    if (!ready) await sleep(250);
  }
  assert.ok(ready, 'Local fixture did not start');
  const require = createRequire(resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
  const { chromium } = require('playwright');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === base && !url.pathname.includes('/exam-journal') ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  page.on('pageerror', error => log('page_error', { message: error.message }));
  await page.goto(`${base}/term-tests/mini-test-lesson-5-computer-based/?class=IC2304&mode=${mode}`);
  await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button', { name: 'Xác nhận, tiếp tục', exact: true }).click();

  async function answer(skill) {
    const first = page.locator(`#${skill}View [data-number]:visible`).first();
    if (await first.evaluate(element => element.tagName) === 'SELECT') await first.selectOption({ index: 1 });
    else await first.fill('A');
  }

  async function round(skill) {
    const clock = { start: null, eof: null, submit: null };
    const network = response => {
      if (response.request().method() !== 'POST' || !response.ok()) return;
      const path = new URL(response.url()).pathname;
      if (path === endpoint + (skill === 'reading' ? '/reading/start' : '/session/start') ||
          (skill === 'listening' && path === endpoint + '/listening/start')) clock.start ??= performance.now();
      if (path === endpoint + '/' + skill) clock.submit ??= performance.now();
    };
    page.on('response', network);
    try {
      if (skill === 'listening') {
        await page.locator('#bootstrapPreview').click({ timeout: 45_000 });
        await page.locator('#bootstrapStart').click();
      } else await page.locator('#startReading').click({ timeout: 45_000 });
      await page.locator(`#${skill}View`).waitFor({ state: 'visible', timeout: 45_000 });
      assert.ok(clock.start, 'Native Start did not return success');
      await answer(skill);
      if (skill === 'listening') await page.evaluate(() => {
        const audio = window.TERM_TEST_BOOTSTRAP.officialAudioElement;
        if (audio.ended) throw new Error('Unexpected EOF before the clock was observed');
        window.fullRehearsal = { eof: null, duration: audio.duration, completedPlayback: false };
        audio.addEventListener('ended', event => {
          window.fullRehearsal.eof = performance.now();
          window.fullRehearsal.completedPlayback = event.isTrusted && audio.ended && audio.playbackRate === 1 &&
            !audio.error && audio.currentTime >= audio.duration - 0.25;
        });
      });
      log('section_started', { skill });
      const stop = performance.now() + 22 * 60_000;
      let heartbeat = 0;
      while (!clock.submit && performance.now() < stop) {
        const state = skill === 'listening' ? await page.evaluate(() => ({ ...window.fullRehearsal,
          position: window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime,
          reviewElapsedMs: window.fullRehearsal.eof === null ? null : performance.now() - window.fullRehearsal.eof })) : {};
        if (state.eof !== null && state.eof !== undefined && clock.eof === null) {
          clock.eof = state.eof;
          assert.ok(state.completedPlayback);
          assert.ok(Math.abs(state.duration - 972) < 2);
          log('native_eof', { duration: state.duration });
        }
        if (performance.now() >= heartbeat) { log('heartbeat', { skill, seconds: Math.round((performance.now() - clock.start) / 1000), ...state }); heartbeat = performance.now() + 15_000; }
        await sleep(500);
      }
      assert.ok(clock.submit, 'Native auto-submission did not commit');
      if (skill === 'reading') assert.ok(clock.submit - clock.start >= 1198_000, 'Reading submitted before 20 minutes');
      else {
        const elapsedAfterEnd = await page.evaluate(() => window.fullRehearsal.eof === null ? -1 : performance.now() - window.fullRehearsal.eof);
        assert.ok(elapsedAfterEnd >= 119_500, 'Listening submitted before native EOF plus review');
      }
      log('section_committed', { skill, elapsedMs: Math.round(clock.submit - clock.start) });
    } finally { page.off('response', network); }
  }

  for (const skill of mode === 'lis_first' ? ['listening','reading'] : ['reading','listening']) await round(skill);
  await page.locator('#resultReadyView:visible, #resultView:visible').first().waitFor({ state: 'visible', timeout: 30_000 });
  log('passed', { scope: 'native Mini K67 CBT timing with real audio and isolated data' });
} finally {
  await browser?.close();
  if (fixture.exitCode === null) fixture.kill();
}
