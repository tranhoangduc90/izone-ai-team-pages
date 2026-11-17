import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const pages = fileURLToPath(new URL('../', import.meta.url));
const backend = process.env.K67_BACKEND;
const previousPages = process.env.K67_TERM2_BASELINE;
assert.ok(backend && /^[a-f0-9]{40}$/.test(previousPages), 'Set K67_BACKEND and K67_TERM2_BASELINE to the fixture package and old Pages revision.');
const require = createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const { chromium } = require('playwright');

test('Term 2 warm cache preserves the old tab and lets the second session finish the same official exam', { timeout: 130_000 }, async () => {
  const socket = createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  await new Promise(done => socket.close(done));
  const base = 'http://127.0.0.1:' + port;
  const entry = '/term-tests/term-test-2-computer-based/?class=IC2304&mode=';
  const studentRef = '11111111-1111-4111-8111-111111111111';
  const fixture = spawn(process.execPath, ['tools/preview-exam-order.mjs', pages], {
    cwd: backend,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(K67_|DATABASE_URL$)/.test(key))),
      K67_PREVIEW_PORT: String(port),
      K67_PREVIEW_TERM2_CBT_JOURNEY: 'on',
      K67_PREVIEW_TERM2_PARALLEL_ENTRY: 'warm-up',
      K67_PREVIEW_PREVIOUS_PAGES_REVISION: previousPages,
      K67_PREVIEW_AUDIO_SECONDS: '18',
      K67_PREVIEW_AUDIO_PROTECTION: 'true',
      K67_PREVIEW_TERM2_WRITING_HOLD: 'true',
      K67_PREVIEW_TERM2_READING_MINUTES: '3',
    },
  });
  let browser, diagnosticPage, diagnostics = '';
  fixture.stderr.setEncoding('utf8').on('data', data => { diagnostics = (diagnostics + data).slice(-3200); });
  const errors = [], rejected = [];
  try {
    let ready = false;
    for (let i = 0; i < 200 && !ready && fixture.exitCode === null; i += 1) {
      try { ready = (await fetch(base + '/preview/status')).ok; } catch {}
      if (!ready) await new Promise(done => setTimeout(done, 100));
    }
    assert.ok(ready, diagnostics || 'Synthetic fixture did not start.');
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const context = await browser.newContext({ baseURL: base, viewport: { width: 1024, height: 600 } });

    const open = async (mode, profile = context) => {
      const page = await profile.newPage();
      diagnosticPage = page;
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', async response => {
        const url = new URL(response.url());
        if (url.origin !== base || !url.pathname.startsWith('/api/term-tests/') || response.status() < 400) return;
        const body = await response.json().catch(() => null);
        rejected.push({ path: url.pathname, status: response.status(), code: body?.error, reason: body?.reasonCode });
      });
      await page.goto(entry + mode);
      await page.locator('#bootstrapStudent').selectOption(studentRef);
      await page.getByRole('button', { name: 'Xác nhận, tiếp tục', exact: true }).click();
      return page;
    };
    const started = async (page, skill) => {
      await page.waitForFunction(name => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view()[name + 'StartedAt'], skill);
      return page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
    };
    const writeAnswer = async (page, skill, answer) => {
      const input = page.locator('#' + skill + 'Questions input[data-number]').first();
      await input.fill(answer);
      const number = await input.getAttribute('data-number');
      await page.waitForFunction(([kind, key, value]) => window.TERM_TEST_BOOTSTRAP?.miniJourney?.drafts()[kind]?.[key] === value,
        [skill, number, answer]);
      return number;
    };
    const submit = async (page, skill) => {
      page.once('dialog', dialog => dialog.accept());
      const response = page.waitForResponse(reply => reply.ok() && reply.url().endsWith('/cbt-journey/seal')
        && reply.request().postDataJSON()?.section === skill.toLowerCase());
      await page.locator('#submit' + skill).click();
      return (await (await response).json()).receipt;
    };
    const switchMode = async mode => {
      const response = await context.request.post('/preview/term2-parallel-mode', { data: { mode } });
      assert.ok(response.ok(), await response.text());
    };

    const old = await open('read_first');
    await old.getByRole('button', { name: 'Bắt đầu Term Test 2', exact: true }).click();
    await old.locator('#readingView:visible, #startReading:visible').first().waitFor();
    if (await old.locator('#startReading').isVisible()) await old.locator('#startReading').click();
    const original = await started(old, 'reading');
    const readingNumber = await writeAnswer(old, 'reading', 'Reading from the old shell');
    assert.equal(await old.evaluate(() => new URL(navigator.serviceWorker.controller.scriptURL).pathname.split('/').at(-1)),
      'offline-worker-listening-first-frame-v1.js');
    await old.evaluate(() => { window.fixtureOldDocument = true; });
    assert.ok((await context.request.post('/preview/switch-pages?previous=0')).ok());
    await switchMode('on');

    const modern = await open('lis_first');
    await modern.locator('#bootstrapPreview').click();
    await modern.locator('#bootstrapStart').click();
    const current = await started(modern, 'listening');
    const listeningNumber = await writeAnswer(modern, 'listening', 'Listening from the new shell');
    assert.equal(current.term2ParallelEntry, true);
    assert.notEqual(current.examSessionToken, original.examSessionToken);
    await old.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes('offline-worker-parallel-v1.js'));
    assert.equal(await old.evaluate(() => window.fixtureOldDocument), true);
    assert.equal(await old.locator(`#readingQuestions input[data-number="${readingNumber}"]`).inputValue(), 'Reading from the old shell');

    await switchMode('drain');
    await context.setOffline(true);
    await modern.reload();
    assert.equal((await started(modern, 'listening')).listeningStartedAt, current.listeningStartedAt);
    assert.equal(await modern.locator(`#listeningQuestions input[data-number="${listeningNumber}"]`).inputValue(), 'Listening from the new shell');
    await context.setOffline(false);
    const reading = await submit(old, 'Reading');
    assert.equal(reading.examSessionToken, original.examSessionToken);

    await modern.reload();
    await modern.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().continuationSection === 'listening');
    const resumed = await started(modern, 'listening');
    assert.equal(resumed.examSessionToken, current.examSessionToken);
    assert.equal(resumed.listeningStartedAt, current.listeningStartedAt);
    assert.equal(resumed.readingSubmitted, true);
    assert.equal(await modern.locator(`#listeningQuestions input[data-number="${listeningNumber}"]`).inputValue(), 'Listening from the new shell');
    const listening = await submit(modern, 'Listening');
    assert.equal(listening.examSessionToken, current.examSessionToken);
    assert.equal(listening.nextSection, 'writing');

    await modern.getByRole('button', { name: 'Tiếp tục Writing', exact: true }).click();
    await modern.locator('#bootstrapStart').click();
    const writing = modern.locator('#writingView');
    await writing.waitFor();
    const reports = { task1: 'Synthetic report from the continued Writing session',
      task2: 'Synthetic essay from the continued Writing session' };
    await writing.locator('textarea[data-writing-task="task1"]').fill(reports.task1);
    await writing.locator('.writing-task-tab').last().click();
    await writing.locator('textarea[data-writing-task="task2"]').fill(reports.task2);
    const written = await submit(modern, 'Writing');
    assert.equal(written.nextSection, 'result');

    const readback = await context.request.post('/api/term-tests/result', {
      data: { officialTerm2: { classCode: 'IC2304', studentRef }, orderClientVersion: 1 },
    });
    assert.ok(readback.ok(), await readback.text());
    const { result, officialTerm2, writing: writingResult } = await readback.json();
    assert.equal(officialTerm2, true);
    assert.equal(writingResult.submitted, true);
    assert.equal(result.reading.details.find(item => item.number === Number(readingNumber)).studentAnswer, 'Reading from the old shell');
    assert.equal(result.listening.details.find(item => item.number === Number(listeningNumber)).studentAnswer, 'Listening from the new shell');
    const stored = await context.request.get('/preview/rehearsal-receipt-readback');
    assert.ok(stored.ok(), await stored.text());
    const { rows } = await stored.json();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].writing_task_1, reports.task1);
    assert.equal(rows[0].writing, reports.task2);

    const cleanProfile = await browser.newContext({ baseURL: base });
    const completed = await open('read_first', cleanProfile);
    await completed.locator('#resultView').waitFor();
    assert.deepEqual(errors, []);
  } catch (error) {
    const screen = await diagnosticPage?.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    throw new Error(JSON.stringify({ diagnostics, errors, rejected, screen: screen?.slice(0, 1000) }), { cause: error });
  } finally {
    await browser?.close();
    fixture.kill();
  }
});
