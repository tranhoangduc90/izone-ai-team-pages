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

for (const essay of ['', 'Synthetic Writing answer for the isolated grading queue']) test(
  'Term 1 CBT continues after offline Reading and reopens Writing ' + (essay ? 'while grading' : 'with Band 0'),
  { timeout:90_000 }, async () => {
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
      K67_PREVIEW_TERM1_WRITING_HOLD:'true',
      K67_PREVIEW_WRITING_RESULT:essay ? 'true' : 'false',
      K67_PREVIEW_AUDIO_SECONDS:essay ? '13' : '2',
      K67_PREVIEW_TERM1_READING_MINUTES:essay ? '2' : '.12',
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
    browser = await chromium.launch({ channel:'msedge', headless:true, args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
    const first = await browser.newContext({ baseURL:base });
    async function post(route, data) {
      const response = await first.request.post(apiPath + route, { data });
      const body = await response.json();
      assert.ok(response.ok(), route + ' ' + JSON.stringify(body));
      return body;
    }

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
    async function selectLearner(tab, path = pagePath) {
      await tab.goto(path);
      await tab.locator('#bootstrapStudent').selectOption(identity.studentRef);
      await tab.getByRole('button', { name:'Xác nhận, tiếp tục', exact:true }).click();
    }

    let prepared, accepted;
    if (essay) {
      const lead = await first.newPage();
      lead.on('pageerror', error => errors.push(error.message));
      await selectLearner(lead);
      await lead.locator('#bootstrapPreview').click();
      await selectLearner(page, pagePath.replace('lis_first','read_first'));
      await page.locator('#bootstrapStart').click();
      await page.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().readingStartedAt);
      const ownReading = await page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
      assert.equal(ownReading.listeningSubmitted,false);
      const readingField = page.locator('#readingQuestions input[data-number]').first();
      const readingNumber = await readingField.getAttribute('data-number');
      await readingField.fill('Own Reading draft');
      await page.waitForFunction(number => window.TERM_TEST_BOOTSTRAP.miniJourney.drafts().reading?.[number]==='Own Reading draft',readingNumber);
      await page.reload();
      await page.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().readingStartedAt);
      assert.equal(await page.locator(`#readingQuestions input[data-number="${readingNumber}"]`).inputValue(),'Own Reading draft');
      await lead.locator('#bootstrapStart').click();
      await lead.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().listeningStartedAt);
      prepared = await lead.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
      const listeningField = lead.locator('#listeningQuestions input[data-number]').first();
      await listeningField.fill('Own Listening draft');
      let firstConfirm = '';
      lead.on('dialog', dialog => {
        if (dialog.type()==='confirm') firstConfirm=dialog.message();
        return dialog.accept();
      });
      const acceptedResponse = lead.waitForResponse(response => response.url().endsWith('/cbt-journey/seal') && response.ok());
      await lead.locator('#submitListening').click();
      accepted = (await (await acceptedResponse).json()).receipt;
      assert.match(firstConfirm,/Bản nộp hợp lệ đầu tiên/);
      audioDownloads.length = 0;
      page.once('dialog', dialog => dialog.accept());
      const outOfDate = page.waitForResponse(response => response.url().endsWith('/cbt-journey/seal') && response.status()===409);
      await page.locator('#submitReading').click();
      assert.equal((await (await outOfDate).json()).error,'EXAM_FIRST_SUBMISSION_ACCEPTED');
      await page.getByRole('heading', {name:'Tiến độ bài thi đã thay đổi'}).waitFor();
      await page.getByRole('button', {name:'Mở lại theo tiến độ chính thức'}).click();
      await page.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().continuationSection==='reading');
      const continued = await page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
      assert.equal(continued.examSessionToken,ownReading.examSessionToken);
      assert.equal(continued.readingStartedAt,ownReading.readingStartedAt);
      assert.equal(continued.readingDeadlineAt,ownReading.readingDeadlineAt);
      assert.equal(await page.locator(`#readingQuestions input[data-number="${readingNumber}"]`).inputValue(),'Own Reading draft');
    } else {
      prepared = await post('session/prepare', {
        ...identity, examMode:'lis_first', examDelivery:'cbt', orderClientVersion:1, term1ContinuationVersion:1
      });
      const owner = {
        examSessionToken:prepared.examSessionToken, generation:prepared.generation,
        ownerId:randomUUID(), ownerProof:'a'.repeat(64), ownerEpoch:0, pageId:randomUUID()
      };
      const started = await post('session/start', {
        ...owner, ownerStartVersion:2, audioProtocolVersion:1, audioEventId:randomUUID()
      });
      accepted = await post('listening', {
        ...identity, ...owner, ownerEpoch:started.audioOwner.ownerEpoch,
        clientSubmissionId:randomUUID(), answers:{ 11:'A' }, draftRevision:1
      });
      await selectLearner(page);
      const start = page.getByRole('button', { name:'Bắt đầu Reading', exact:true });
      await start.waitFor({ timeout:20_000 }).catch(async error => {
        throw new Error(await page.locator('#bootstrapNotice').textContent() || error.message);
      });
      await start.click();
    }
    await page.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().readingStartedAt);
    const view = await page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
    assert.equal(view.nextSection, 'reading');
    assert.equal(view.listeningSubmitted, true);
    assert.equal(view.readingSubmitted, false);
    assert.notEqual(view.examSessionToken, prepared.examSessionToken);
    assert.notEqual(view.attemptToken, accepted.attemptToken);
    assert.deepEqual(audioDownloads, []);
    let lostReceipt, readingSeals = 0;
    if (!essay) {
      await page.route('**/cbt-journey/seal', async route => {
        if (route.request().postDataJSON()?.section !== 'reading') return route.continue();
        readingSeals += 1;
        if (readingSeals!==1) return route.continue();
        const committed = await route.fetch();
        if (committed.ok()) lostReceipt = (await committed.json()).receipt;
        await route.abort();
      });
    }
    await second.setOffline(true);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#submitReading').click();
    await page.getByRole('heading', { name:'Đã lưu Reading trên thiết bị', exact:true }).waitFor();
    const continueWriting = page.getByRole('button', { name:'Tiếp tục Writing', exact:true });
    assert.equal(await continueWriting.count(), 0);
    await second.setOffline(false);
    await page.getByRole('heading', { name:'Đã nộp Reading', exact:true }).waitFor({ timeout:27_000 });
    const receipt = await page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.continuationReceipt());
    assert.equal(receipt.nextSection, 'writing');
    assert.equal(receipt.examSessionToken, view.examSessionToken);
    assert.notEqual(receipt.attemptToken, accepted.attemptToken);
    if (!essay) {
      assert.equal(readingSeals,1);
      assert.deepEqual(receipt,lostReceipt);
    }
    await continueWriting.click();
    await page.getByRole('button', { name:'Bắt đầu Writing', exact:true }).waitFor({ timeout:12_000 }).catch(async error => {
      const visible = (await page.locator('body').innerText()).slice(0, 800);
      throw new Error(JSON.stringify({visible, preparations, errors}), {cause:error});
    });
    const resultReads = [];
    function observeResultReads(tab) {
      tab.on('request', request => {
        const pathname = new URL(request.url()).pathname;
        if (['/api/term-tests/result','/api/term-tests/result/review'].includes(pathname)) {
          resultReads.push(request.postDataJSON());
        }
      });
    }
    observeResultReads(page);
    await page.getByRole('button', { name:'Bắt đầu Writing', exact:true }).click();
    if (essay) await page.locator('textarea[data-writing-task="task2"]').fill(essay);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#submitWriting').click();
    const result = page.locator('#resultView');
    const viewResult = page.locator('#viewResult');
    await page.waitForFunction(() => !document.getElementById('resultView')?.hidden
      || (!document.getElementById('resultReadyView')?.hidden && !document.getElementById('viewResult')?.disabled));
    if (!(await result.isVisible())) await viewResult.click();
    const initialHeading = essay ? 'Bài Writing của bạn đang được chấm' : 'Điểm và bài chấm Writing';
    await result.getByRole('heading', {name:initialHeading}).waitFor();

    const fresh = await browser.newContext({ baseURL:base });
    const reopened = await fresh.newPage();
    observeResultReads(reopened);
    reopened.on('pageerror', error => errors.push(error.message));
    await selectLearner(reopened);
    const reopenedResult = reopened.locator('#resultView');
    await reopenedResult.getByRole('heading', {name:initialHeading}).waitFor();
    await reopenedResult.getByRole('button', {name:'Xem lại toàn bộ bài làm'}).click();
    await reopened.getByRole('dialog').waitFor();
    if (essay) {
      await reopened.getByRole('button', {name:'Đóng phần xem lại bài làm'}).click();
      const details = reopenedResult.locator('.detail-block').first();
      await details.evaluate(node => { node.open = true; node.dataset.fixturePreserved = 'true'; });
      await reopened.waitForResponse(response => response.url().endsWith('/api/term-tests/result')
        && response.request().postDataJSON()?.officialTerm1 && !response.request().postDataJSON()?.includeContent);
      assert.equal(await details.getAttribute('data-fixture-preserved'),'true');
      const workerId = 'term1-browser-fake-grader';
      const headers = {'x-writing-test-sync':'fixture-k67-local-writing-grader-only'};
      async function worker(path, data) {
        const response = await first.request.post(path,{headers,data});
        const body = await response.json();
        assert.ok(response.ok(), path + ' ' + JSON.stringify(body));
        return body;
      }
      const jobsPath = '/api/term-tests/writing-grading/jobs/';
      const {jobs:[dispatch]} = await worker(jobsPath+'claim',{workerId});
      assert.equal(dispatch.essay,essay);
      await worker(jobsPath+'dispatch-complete',{workerId,jobId:dispatch.jobId});
      assert.equal((await worker('/preview/writing-collect-due/'+accepted.attemptToken,{})).jobs,1);
      const {jobs:[collect]} = await worker(jobsPath+'claim',{workerId});
      const criteria = ['TR','CC','LR','GRA'].map(code => ({code,bandScore:6,feedback:'Nhận xét giả'}));
      await worker(jobsPath+'result',{workerId,jobId:collect.jobId,runKey:collect.runKey,result:{taskScore:6,criteria}});
      await reopenedResult.getByRole('heading', {name:'Điểm và bài chấm Writing'}).waitFor({timeout:20_000});
      assert.equal(await details.getAttribute('data-fixture-preserved'),'true');
      assert.equal(await details.evaluate(node => node.open),true);
      const portalReadback = await (await first.request.get('/preview/writing-portal')).json();
      assert.deepEqual(portalReadback.map(({attemptToken,grades})=>[attemptToken,grades.writing]),[[accepted.attemptToken,6]]);
    }
    assert.match(await reopenedResult.locator('.is-overall').innerText(), essay ? /Band 6/ : /Band 0/);
    assert.ok(resultReads.length >= 3);
    for (const payload of resultReads) {
      assert.deepEqual(payload.officialTerm1, identity);
      assert.equal(payload.attemptToken,undefined);
    }
    assert.deepEqual(audioDownloads, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    fixture.kill();
  }
});
