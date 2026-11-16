import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const pages = fileURLToPath(new URL('../', import.meta.url));
const backend = process.env.K67_BACKEND;
assert.ok(backend, 'Set K67_BACKEND to the isolated backend package.');
const require = createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const { chromium } = require('playwright');

test('Term 1 CBT opens the remaining Reading skill in a separate profile', { timeout:90_000 }, async () => {
  const socket = createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(done => socket.close(done));
  const base = 'http://127.0.0.1:' + port;
  const pagePath = '/term-tests/term-test-1-computer-based/?class=IC2304&mode=lis_first';
  const apiPath = '/api/term-tests/term-test-1/';
  const identity = { classCode:'IC2304', studentRef:'11111111-1111-4111-8111-111111111111' };
  const fixture = spawn(process.execPath, ['tools/preview-exam-order.mjs', pages], { cwd:backend, windowsHide:true,
    env:{ ...process.env, K67_ORDER_NATIVE_URL:'', K67_PREVIEW_PORT:String(port),
      K67_PREVIEW_TERM1_PARALLEL_ENTRY:'true', K67_PREVIEW_TERM1_CBT_JOURNEY:'on',
      K67_PREVIEW_AUDIO_PROTECTION:'true', K67_PREVIEW_AUDIO_OWNER:'true' },
    stdio:['ignore', 'ignore', 'pipe'] });
  let browser;
  let fixtureErrors = '';
  fixture.stderr.setEncoding('utf8').on('data', data => { fixtureErrors = (fixtureErrors + data).slice(-4000); });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready && fixture.exitCode === null; attempt += 1) {
      try { ready = (await fetch(base + pagePath)).ok; } catch {}
      if (!ready) await new Promise(done => setTimeout(done, 100));
    }
    assert.ok(ready, fixtureErrors || 'Preview fixture did not start.');
    browser = await chromium.launch({ channel:'msedge', headless:true, args:['--no-sandbox'] });
    const first = await browser.newContext({ baseURL:base });
    async function post(route, data) {
      const response = await first.request.post(apiPath + route, { data });
      const body = await response.json();
      assert.ok(response.ok(), route + ' ' + JSON.stringify(body));
      return body;
    }

    const prepared = await post('session/prepare', {
      ...identity, examMode:'lis_first', examDelivery:'cbt', orderClientVersion:1, term1ContinuationVersion:1
    });
    const owner = {
      examSessionToken:prepared.examSessionToken, generation:prepared.generation,
      ownerId:randomUUID(), ownerProof:'a'.repeat(64), ownerEpoch:0, pageId:randomUUID()
    };
    const started = await post('session/start', {
      ...owner, ownerStartVersion:2, audioProtocolVersion:1, audioEventId:randomUUID()
    });
    const accepted = await post('listening', {
      ...identity, ...owner, ownerEpoch:started.audioOwner.ownerEpoch,
      clientSubmissionId:randomUUID(), answers:{ 11:'A' }, draftRevision:1
    });

    const second = await browser.newContext({ baseURL:base });
    const page = await second.newPage();
    const errors = [];
    const audioDownloads = [];
    const preparations = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/prepare')) preparations.push(response.status());
    });
    page.on('request', request => {
      if (/\/preview-(?:term1-audio|tone\.wav)|\/cbt-journey\/audio/.test(request.url())) audioDownloads.push(request.url());
    });
    await page.goto(pagePath);
    await page.locator('#bootstrapStudent').selectOption(identity.studentRef);
    await page.getByRole('button', { name:'Xác nhận, tiếp tục', exact:true }).click();
    const start = page.getByRole('button', { name:'Bắt đầu Reading', exact:true });
    await start.waitFor({ timeout:20_000 }).catch(async error => {
      throw new Error(await page.locator('#bootstrapNotice').textContent() || error.message);
    });
    await start.click();
    await page.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().readingStartedAt);
    const view = await page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
    assert.equal(view.nextSection, 'reading');
    assert.equal(view.listeningSubmitted, true);
    assert.equal(view.readingSubmitted, false);
    assert.notEqual(view.examSessionToken, prepared.examSessionToken);
    assert.notEqual(view.attemptToken, accepted.attemptToken);
    assert.deepEqual(audioDownloads, []);
    await second.setOffline(true);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#submitReading').click();
    await page.getByRole('heading', { name:'Đã lưu Reading trên thiết bị', exact:true }).waitFor();
    const continueWriting = page.getByRole('button', { name:'Tiếp tục Writing', exact:true });
    assert.equal(await continueWriting.count(), 0);
    await second.setOffline(false);
    await page.getByRole('heading', { name:'Đã nộp Reading', exact:true }).waitFor({ timeout:20_000 });
    const receipt = await page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.continuationReceipt());
    assert.equal(receipt.nextSection, 'writing');
    assert.equal(receipt.examSessionToken, view.examSessionToken);
    assert.notEqual(receipt.attemptToken, accepted.attemptToken);
    await continueWriting.click();
    await page.getByRole('button', { name:'Bắt đầu Writing', exact:true }).waitFor({ timeout:12_000 }).catch(async error => {
      const visible = (await page.locator('body').innerText()).slice(0, 800);
      throw new Error(JSON.stringify({visible, preparations, errors}), {cause:error});
    });
    assert.deepEqual(audioDownloads, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    fixture.kill();
  }
});
