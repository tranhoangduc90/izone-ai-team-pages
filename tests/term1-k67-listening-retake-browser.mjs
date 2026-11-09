import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const { chromium } = require('playwright');
const route = '/term-tests/term-test-1-listening-retake/';
const html = await readFile(new URL('..' + route + 'index.html', import.meta.url));

test('retired retake opens a notice without calling the exam API or altering local data', async () => {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://fixture.invalid').pathname;
    if (pathname === route) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      return;
    }
    response.writeHead(404).end();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', request => requests.push(request));
    await page.addInitScript(() => localStorage.setItem('listening-retake-fixture', 'saved'));
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin + route + '?class=FIXTURE&student=synthetic&retake=synthetic');
    await page.getByRole('heading', { name: 'Đã ngừng đường thi bù Listening Term Test 1' }).waitFor();
    assert.equal(await page.locator('form, audio, script').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('listening-retake-fixture')), 'saved');
    for (const request of requests) {
      assert.equal(new URL(request.url()).origin, origin);
      assert.equal(request.method(), 'GET');
      assert.doesNotMatch(new URL(request.url()).pathname, /\/api\//);
    }
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});
