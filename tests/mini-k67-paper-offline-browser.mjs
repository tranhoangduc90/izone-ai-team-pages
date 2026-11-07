import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const backend = process.env.K67_BACKEND;
assert.ok(backend, 'Set K67_BACKEND to the isolated K67 backend package.');
const { createMiniFixture } = await import(pathToFileURL(resolve(backend, 'test/helpers/mini-answer-sheet-fixture.js')));
const require = createRequire(resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const ref = '11111111-1111-4111-8111-111111111111';
const routeName = '/term-tests/mini-test-lesson-5/';
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

for (const mode of ['lis_first', 'read_first']) test('Mini K67 paper offline ' + mode, { timeout: 90000 }, async () => {
  const f = await createMiniFixture({ examOrder: true, assets: { getTiming: () => ({ readingDurationMinutes: 20 }) }, miniPaperOffline: 'on' });
  const api = createServer(f.app);
  const journalFailures = new Set();
  const web = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/term-tests/shared/exam-journal/')) {
      journalFailures.add(pathname);
      return res.writeHead(503).end();
    }
    try {
      const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + sep)) return res.writeHead(403).end();
      const type = extname(file);
      let data = await readFile(file);
      if (['.js', '.mjs', '.html', '.css', '.svg'].includes(type)) data = Buffer.from(data.toString().replace(/\r\n/g, '\n'));
      res.writeHead(200, { 'content-type': types[type] || 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  const [apiBase, webBase] = await Promise.all([listen(api), listen(web)]);
  let browser;
  let lostAck = false;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.TERM2_BROWSER_CHANNEL || 'msedge' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await context.route('**/*', async route => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.origin === webBase) return route.continue();
      const index = u.pathname.indexOf('/api/');
      if (index < 0) return route.abort();
      const headers = { 'Content-Type': 'application/json', Origin: 'https://tranhoangduc90.github.io',
        'x-term2-permit': req.headers()['x-term2-permit'] || '' };
      const result = await fetch(apiBase + u.pathname.slice(index) + u.search, {
        method: req.method(), headers, body: req.postData() || undefined
      });
      const data = await result.text();
      if (req.method() === 'POST' && u.pathname.endsWith('/offline/operation') && result.ok
        && req.postDataJSON().kind === 'seal' && !lostAck) {
        lostAck = true;
        return route.abort();
      }
      return route.fulfill({ status: result.status, body: data, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' } });
    });
    const url = webBase + routeName + '?class=IC2304&mode=' + mode;
    await page.goto(url);
    await page.locator('#studentSelect option[value="' + ref + '"]').waitFor({ state: 'attached' });
    await page.locator('#studentSelect').selectOption(ref);
    await page.locator('#miniEnter').click();
    await page.getByRole('button', { name: 'Xác nhận, tiếp tục', exact: true }).click();
    await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
    await context.setOffline(true);
    const order = mode === 'lis_first' ? ['listening','reading'] : ['reading','listening'];
    for (const [index, section] of order.entries()) {
      const reading = section === 'reading';
      if (reading) await page.locator('#startReading').click();
      const field = page.locator(reading ? '#readingQuestions [data-number="24"]' : '#listeningQuestions [data-number="11"]');
      if (reading) await field.fill('A'); else await field.selectOption('A');
      if (index === 0) {
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Tải bài làm về máy' }).click();
        const html = await readFile(await (await download).path(), 'utf8');
        assert.match(html, /<td>A<\/td>/);
        assert.doesNotMatch(html, /permit|examSessionToken/i);
        await page.reload();
        await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
        assert.equal(await field.inputValue(), 'A');
      }
      await page.locator(reading ? '#submitReading' : '#submitListening').click();
    }
    await page.locator('#resultReadyView').waitFor({ state: 'visible' });
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM assessment.mini_k67_paper_offline_operation')).rows[0].n, 0);
    await context.setOffline(false);
    await page.getByText('Máy chủ đã xác nhận các thao tác đã gửi.', { exact: true }).waitFor({ timeout: 25000 });
    await page.locator('#viewResult').click();
    await page.locator('#resultView').waitFor({ state: 'visible' });
    const rows = (await f.db.query('SELECT * FROM assessment.term_test_attempt')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].listening_answers['11'], 'A');
    assert.equal(rows[0].reading_answers['24'], 'A');
    assert.equal(rows[0].reading_deadline_at, null);
    assert.ok(lostAck, 'test must lose a committed seal response');
    assert.ok(journalFailures.has('/term-tests/shared/exam-journal/bridge.mjs'));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await Promise.all([close(api), close(web)]);
    await f.db.close();
  }
});
