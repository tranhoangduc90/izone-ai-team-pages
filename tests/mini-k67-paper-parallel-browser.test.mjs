import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const backend = process.env.K67_BACKEND;
assert.ok(backend, 'Set K67_BACKEND to the isolated K67 backend package.');
const { createMiniFixture } = await import(pathToFileURL(resolve(backend, 'test/helpers/mini-answer-sheet-fixture.js')));
const nativeReceiptModule = process.env.K67_NATIVE_PAPER_RECEIPT_MODULE
  ? await import(pathToFileURL(process.env.K67_NATIVE_PAPER_RECEIPT_MODULE)) : null;
const previousPages = process.env.K67_PAPER_PREVIOUS_PAGES;
const require = createRequire(resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const slug = 'mini-test-lesson-5';
const ref = '11111111-1111-4111-8111-111111111111';
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const listen = server => new Promise(done => server.listen(0, '127.0.0.1', () => done('http://127.0.0.1:' + server.address().port)));
const close = server => new Promise(done => server.close(done));
const fieldSelector = section => section === 'listening' ? '#listeningQuestions [data-number="11"]' : '#readingQuestions [data-number="24"]';
const sealSelector = section => section === 'listening' ? '#submitListening' : '#submitReading';
const order = section => section === 'listening' ? 'lis_first' : 'read_first';

async function serve(req, res, sourceRoot = root) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(sourceRoot, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(sourceRoot + sep)) return res.writeHead(403).end();
  try {
    const ext = extname(file);
    let bytes = await readFile(file);
    if (/^\.(?:js|mjs|html|css|svg|json|txt)$/.test(ext)) bytes = Buffer.from(bytes.toString().replace(/\r\n/g, '\n'));
    res.writeHead(200, { 'content-type': types[ext] ?? 'application/octet-stream' }).end(bytes);
  } catch {
    res.writeHead(404).end();
  }
}

async function enter(page) {
  await page.locator('#studentSelect option[value="' + ref + '"]').waitFor({ state: 'attached' });
  await page.locator('#studentSelect').selectOption(ref);
  await page.locator('#miniEnter').click();
  await page.getByRole('button', { name: 'Xác nhận, tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
}

async function answer(page, section, value) {
  const field = page.locator(fieldSelector(section));
  if (section === 'reading') {
    const start = page.locator('#startReading');
    if (await start.isVisible()) await start.click();
    await field.fill(value);
  } else await field.selectOption(value);
}

async function bindFixtureRequests(context, apiBase, webBase, observe = () => false) {
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === webBase) return route.continue();
    const index = url.pathname.indexOf('/api/');
    if (index < 0) return route.abort();
    const path = url.pathname.slice(index);
    const headers = { 'Content-Type': 'application/json', Origin: 'https://tranhoangduc90.github.io',
      'x-term2-permit': req.headers()['x-term2-permit'] || '' };
    const result = await fetch(apiBase + path + url.search, { method: req.method(), headers, body: req.postData() || undefined });
    const text = await result.text();
    const body = path.includes('/offline/') && result.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(text) : null;
    const op = req.postData() && path.endsWith('/offline/operation') ? req.postDataJSON() : null;
    if (observe(path, result, body, op)) return route.abort();
    return route.fulfill({ status: result.status, body: text, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' } });
  });
}

for (const first of ['listening', 'reading']) test('Mini paper keeps independent drafts and a single result when ' + first + ' commits first',
  { timeout: 110000 }, async () => {
    const fixture = await createMiniFixture({ examOrder: true, completeSchema: true, miniPaperOffline: 'on',
      miniPaperParallelEntryMode: 'on', miniCbtJourneyMode: 'on', pretestCbtJourneyMode: 'on', term2ParallelEntryMode: 'on',
      assets: { getTiming: () => ({ readingDurationMinutes: 20 }) } });
    const api = createServer(fixture.app);
    const web = createServer((req, res) => serve(req, res));
    let browser;
    const traces = [], pages = [], errors = [];
    const prepares = new Map();
    let lost;
    try {
      for (const name of ['047-pretest-cbt-parallel-entry.sql', '048-mini-k67-cbt-parallel-entry.sql', '050-mini-k67-paper-parallel-entry.sql']) {
        await fixture.db.exec(await readFile(resolve(backend, 'db', name), 'utf8'));
      }
      const [apiBase, webBase] = await Promise.all([listen(api), listen(web)]);
      browser = await chromium.launch({ channel: 'msedge', headless: true });
      const makeProfile = async (name, section) => {
        const context = await browser.newContext({ viewport: { width: 960, height: 820 } });
        await bindFixtureRequests(context, apiBase, webBase, (path, result, body, op) => {
          traces.push({ name, path, status: result.status, error: body?.error, operationId: body?.receipt?.operationId,
            receiptId: body?.receipt?.receiptId, kind: op?.kind, section: op?.section });
          if (result.ok && path.endsWith('/parallel-prepare')) {
            prepares.set(name, [...(prepares.get(name) || []), body]);
          }
          if (result.ok && name === 'A' && !lost && op?.kind === 'seal') {
            lost = body.receipt;
            return true;
          }
          return false;
        });
        const page = await context.newPage();
        pages.push(page);
        page.setDefaultTimeout(12000);
        page.on('dialog', dialog => dialog.accept());
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(webBase + '/term-tests/' + slug + '/?class=IC2304&mode=' + order(section));
        await enter(page);
        return { context, page };
      };
      const remaining = first === 'listening' ? 'reading' : 'listening';
      const a = await makeProfile('A', first);
      await answer(a.page, first, 'A');
      const b = await makeProfile('B', remaining);
      const [initialA] = prepares.get('A');
      const [initialB] = prepares.get('B');
      assert.notEqual(initialA.examSessionToken, initialB.examSessionToken);
      assert.notEqual(initialA.offline.ownerId, initialB.offline.ownerId);
      assert.notEqual(initialA.offline.permit, initialB.offline.permit);
      await b.context.setOffline(true);
      await answer(b.page, remaining, 'B');
      await b.page.reload();
      await b.page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
      assert.equal(await b.page.locator(fieldSelector(remaining)).inputValue(), 'B');
      assert.equal(await a.page.locator(fieldSelector(first)).inputValue(), 'A');
      const readback = a.page.waitForResponse(async res => res.url().endsWith('/offline/status') && res.ok()
        && Boolean(lost) && (await res.json()).receipt?.receiptId === lost.receiptId, { timeout: 26000 });
      await a.page.locator(sealSelector(first)).click();
      await readback;
      assert.equal(lost.examSessionToken, initialA.examSessionToken);
      await b.page.locator(sealSelector(remaining)).click();
      await b.context.setOffline(false);
      const resume = b.page.getByRole('button', { name: 'Mở theo tiến độ chính thức', exact: true });
      await resume.waitFor({ timeout: 26000 });
      await resume.click();
      await b.page.locator('#resultReadyView').waitFor({ state: 'visible' });
      await b.page.getByText('Máy chủ đã xác nhận các thao tác đã gửi.', { exact: true }).waitFor({ timeout: 26000 });
      await b.page.locator('#viewResult').click();
      await b.page.locator('#resultView').waitFor({ state: 'visible' });
      const progression = prepares.get('B').at(-1);
      assert.equal(progression.continuationSection, remaining);
      assert.equal(progression.examSessionToken, initialB.examSessionToken);
      const { rows } = await fixture.db.query(`SELECT id, exam_session_id, listening_answers, reading_answers
        FROM assessment.term_test_attempt WHERE completed_at IS NOT NULL`);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].exam_session_id, initialA.examSessionToken);
      assert.equal(rows[0].id, progression.officialAttemptToken);
      assert.equal(rows[0].listening_answers['11'], first === 'listening' ? 'A' : 'B');
      assert.equal(rows[0].reading_answers['24'], first === 'reading' ? 'A' : 'B');
      const { rows: receipts } = await fixture.db.query(`SELECT session_id,receipt
        FROM assessment.mini_k67_paper_offline_operation WHERE receipt->>'kind'='seal'`);
      assert.equal(receipts.length, 2);
      const fromB = receipts.find(row => row.session_id === initialB.examSessionToken)?.receipt;
      assert.equal(fromB.officialAttemptToken, rows[0].id);
      assert.equal(fromB.section, remaining);
      if (nativeReceiptModule) {
        const captured = [];
        const offer = nativeReceiptModule.createMiniPaperNativeReceiptProducer({
          pool: fixture.db, scopeForOwner: async scope => scope,
          spool: { append: async (scope, items) => { captured.push({ scope, items }); return items; } },
        });
        const details = receipt => ({ section: receipt.section, submission: {
          operationId: receipt.operationId, receiptId: receipt.receiptId,
          generation: receipt.generation, delivery: 'paper',
        } });
        assert.equal(await offer('submission_completed', slug, initialA.examSessionToken, details(fromB)), null);
        await offer('submission_completed', slug, initialA.examSessionToken, details(lost));
        await offer('submission_completed', slug, initialB.examSessionToken, details(fromB));
        assert.equal(captured.length, 2);
        assert.equal(captured[0].scope.sourceId, initialA.examSessionToken);
        assert.equal(captured[1].scope.sourceId, initialB.examSessionToken);
        assert.equal(captured[0].items[0].data.checkpointState.receiptId, lost.receiptId);
        assert.equal(captured[1].items[0].data.checkpointState.receiptId, fromB.receiptId);
        assert.notEqual(captured[0].items[0].id, captured[1].items[0].id);
        await assert.rejects(offer('submission_completed', slug, initialB.examSessionToken, details(fromB), captured[0].scope),
          { code: 'PILOT_NATIVE_SCOPE_DENIED' });
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ first, profiles: 2, lostAckRecovered: true, offlineDraftRestored: true,
        nativeReceiptScopeChecked: Boolean(nativeReceiptModule), officialAttempts: rows.length,
        firstReceipt: lost.receiptId, continuedReceipt: fromB.receiptId }));
    } catch (error) {
      const notices = await Promise.all(pages.map(page => page.locator('#notice').textContent({ timeout: 1000 }).catch(() => null)));
      throw new Error(error.message + '\nNotices: ' + JSON.stringify(notices) + '\nBrowser errors: ' + JSON.stringify(errors)
        + '\nLast requests: ' + JSON.stringify(traces.slice(-24)), { cause: error });
    } finally {
      await browser?.close();
      await Promise.all([close(api), close(web)]);
      await fixture.db.close();
    }
  });

test('Mini paper reload keeps a legacy draft when the new worker takes control and a new profile submits first',
  { timeout: 100000, skip: !previousPages }, async () => {
    const previousRoot = resolve(previousPages);
    const candidateId = (await import('../term-tests/mini-test-lesson-5/offline-assets.mjs')).ASSET_BUILD_ID;
    const legacyId = (await import(pathToFileURL(resolve(previousRoot, 'term-tests/mini-test-lesson-5/offline-assets.mjs')))).ASSET_BUILD_ID;
    assert.notEqual(candidateId, legacyId);
    const fixture = await createMiniFixture({ examOrder: true, completeSchema: true, miniPaperOffline: 'on',
      miniPaperParallelEntryMode: 'on', miniCbtJourneyMode: 'on', pretestCbtJourneyMode: 'on', term2ParallelEntryMode: 'on',
      assets: { getTiming: () => ({ readingDurationMinutes: 20 }) } });
    const legacyApp = fixture.appForMiniPaperParallelMode('off');
    let switched = false;
    const api = createServer((req, res) => (switched ? fixture.app : legacyApp)(req, res));
    const web = createServer((req, res) => serve(req, res, switched ? root : previousRoot));
    let browser, page, preparation;
    const prepares = [];
    const checkpoint = [];
    try {
      for (const name of ['047-pretest-cbt-parallel-entry.sql', '048-mini-k67-cbt-parallel-entry.sql', '050-mini-k67-paper-parallel-entry.sql']) {
        await fixture.db.exec(await readFile(resolve(backend, 'db', name), 'utf8'));
      }
      const [apiBase, webBase] = await Promise.all([listen(api), listen(web)]);
      browser = await chromium.launch({ channel: 'msedge', headless: true });
      const context = await browser.newContext({ viewport: { width: 960, height: 820 } });
      await bindFixtureRequests(context, apiBase, webBase, (path, result, body) => {
        if (result.ok && path.endsWith('/offline/prepare')) preparation = body;
        if (result.ok && path.endsWith('/offline/parallel-prepare')) prepares.push(body);
      });
      page = await context.newPage();
      page.setDefaultTimeout(14000);
      page.on('dialog', dialog => dialog.accept());
      await page.goto(webBase + '/term-tests/' + slug + '/?class=IC2304&mode=read_first');
      await enter(page);
      assert.ok(preparation?.examSessionToken);
      checkpoint.push('legacy-ready');
      await context.setOffline(true);
      await answer(page, 'reading', 'B');
      await page.reload();
      await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
      assert.equal(await page.locator(fieldSelector('reading')).inputValue(), 'B');
      checkpoint.push('legacy-draft-restored');
      await context.setOffline(false);
      switched = true;
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration.update();
      });
      const newBuild = await page.evaluate(async (expectedId) => {
        function message(worker, type) {
          const channel = new MessageChannel();
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Worker message timeout: ' + type)), 12000);
            channel.port1.onmessage = ({ data }) => {
              clearTimeout(timeout);
              if (data.ok) resolve(data);
              else reject(new Error(data.error));
            };
            worker.postMessage({ type }, [channel.port2]);
          });
        }
        const registration = await navigator.serviceWorker.getRegistration();
        const deadline = performance.now() + 22000;
        let observed;
        while (performance.now() < deadline) {
          const waiting = registration.waiting;
          if (waiting?.state === 'installed') await message(waiting, 'ACTIVATE');
          const controller = navigator.serviceWorker.controller;
          if (controller?.state === 'activated') {
            observed = (await message(controller, 'PREPARE')).assetBuildId;
            if (observed === expectedId) return observed;
          }
          await new Promise(resolve => setTimeout(resolve, 120));
        }
        throw new Error('Candidate worker did not take control. Last cache: ' + observed);
      }, candidateId);
      assert.equal(newBuild, candidateId);
      checkpoint.push('candidate-worker-active');
      await context.setOffline(true);
      await page.reload();
      await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
      assert.equal(await page.locator(fieldSelector('reading')).inputValue(), 'B');
      assert.ok(await page.evaluate(() => Array.from(document.scripts).some(script => script.src.includes('app-mini-paper-k67-parallel-v1.js'))));
      checkpoint.push('candidate-draft-restored-offline');

      const freshContext = await browser.newContext({ viewport: { width: 960, height: 820 } });
      await bindFixtureRequests(freshContext, apiBase, webBase, (path, result, body) => {
        if (result.ok && path.endsWith('/offline/parallel-prepare')) prepares.push(body);
      });
      const fresh = await freshContext.newPage();
      fresh.setDefaultTimeout(14000);
      fresh.on('dialog', dialog => dialog.accept());
      await fresh.goto(webBase + '/term-tests/' + slug + '/?class=IC2304&mode=lis_first');
      await enter(fresh);
      await answer(fresh, 'listening', 'A');
      const committed = fresh.waitForResponse(async res => res.url().endsWith('/offline/operation') && res.ok()
        && (await res.json()).receipt?.kind === 'seal');
      await fresh.locator(sealSelector('listening')).click();
      await committed;
      checkpoint.push('fresh-profile-committed');
      await page.locator(sealSelector('reading')).click();
      await context.setOffline(false);
      await page.getByRole('button', { name: 'Mở theo tiến độ chính thức', exact: true }).click();
      await page.getByText('Máy chủ đã xác nhận các thao tác đã gửi.', { exact: true }).waitFor({ timeout: 26000 });
      await page.locator('#viewResult').click();
      await page.locator('#resultView').waitFor({ state: 'visible' });
      assert.equal(prepares.length, 2);
      assert.notEqual(prepares[0].examSessionToken, preparation.examSessionToken);
      assert.equal(prepares[1].examSessionToken, preparation.examSessionToken);
      assert.equal(prepares[1].offline.permit, preparation.offline.permit);
      assert.equal(prepares[1].continuationSection, 'reading');
      const { rows } = await fixture.db.query(`SELECT exam_session_id, listening_answers, reading_answers
        FROM assessment.term_test_attempt WHERE completed_at IS NOT NULL`);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].exam_session_id, prepares[0].examSessionToken);
      assert.equal(rows[0].listening_answers['11'], 'A');
      assert.equal(rows[0].reading_answers['24'], 'B');
      console.log(JSON.stringify({ legacyId, candidateId, checkpoint, sameLegacyScope: true, officialAttempts: rows.length }));
    } catch (error) {
      const notice = await page?.locator('#notice').textContent({ timeout: 1000 }).catch(() => null);
      throw new Error(error.message + '\nCheckpoint: ' + JSON.stringify(checkpoint) + '\nNotice: ' + notice, { cause: error });
    } finally {
      await browser?.close();
      await Promise.all([close(api), close(web)]);
      await fixture.db.close();
    }
  });
