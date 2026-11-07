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
const term = process.env.K67_PAPER_TERM || (process.env.K67_PAPER_TERM1 === '1' ? '1' : '');
assert.ok(['','1','2'].includes(term),'K67_PAPER_TERM must be 1, 2 or empty for Mini.');
const slug = term ? 'term-test-' + term : 'mini-test-lesson-5';
const paperFlagOff = term && process.env.K67_PAPER_FLAG_OFF === '1';
const routeName = '/term-tests/' + slug + '/';
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

for (const mode of ['lis_first', 'read_first']) test(slug + ' K67 paper offline ' + mode, { timeout: 90000 }, async () => {
  const assets = { getTiming: () => ({ readingDurationMinutes: term ? 60 : 20 }) };
  const f = await createMiniFixture({ examOrder: true, assets, ...(term
    ? {[`term${term}PaperJourneyMode`]:paperFlagOff?'off':'on',completeSchema:true} : {miniPaperOffline:'on'}) });
  if(term){
    const definition=JSON.stringify({questions:Array.from({length:40},(_,i)=>({number:i+1,type:'Câu thử',accepted:['A']}))});
    await f.db.query(`INSERT INTO assessment.test_definition(slug,title,version,listening_definition,reading_definition,is_active)
      VALUES($1,'Đề giả Term',1,$2,$2,true)`,[slug,definition]);
  }
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
  let browser, page;
  let lostAck = false;
  let mediaRequests = 0;
  const errors = [], debug = [];
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.TERM2_BROWSER_CHANNEL || 'msedge' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    page = await context.newPage();
    const observe = page => {
      page.setDefaultTimeout(18000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      page.on('request', req => { if (req.resourceType() === 'media') mediaRequests++; });
      page.on('response', response => {
        const path=new URL(response.url()).pathname;
        if(path.includes('journey')||path.endsWith('roster')||path.endsWith('order/open'))debug.push([path,response.status()]);
      });
    };
    observe(page);
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
      if(!result.ok&&u.pathname.includes('journey'))debug.push([u.pathname,result.status,data]);
      if (req.method() === 'POST' && result.ok && !lostAck
        && (term ? u.pathname.endsWith('/paper-journey/seal')
          : u.pathname.endsWith('/offline/operation') && req.postDataJSON().kind === 'seal')) {
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
    if(!term)await page.locator('#miniEnter').click();
    await page.getByRole('button', { name: 'Xác nhận, tiếp tục', exact: true }).click();
    if(paperFlagOff){
      await page.locator(mode==='lis_first'?'#submitListening':'#startReading').waitFor({state:'visible'});
      assert.equal(await page.getByRole('button',{name:'Tải bài làm về máy'}).count(),0);
      assert.deepEqual(errors,[]);
      return;
    }
    await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
    await context.setOffline(true);
    const order = mode === 'lis_first' ? ['listening','reading'] : ['reading','listening'];
    for (const [index, section] of order.entries()) {
      const reading = section === 'reading';
      if (reading) await page.locator('#startReading').click();
      const readingNumber=term==='2'?'1':'24';
      const selector = reading ? `#readingQuestions [data-number="${readingNumber}"]` : '#listeningQuestions [data-number="11"]';
      const field = page.locator(selector);
      if (reading) await field.fill('A'); else await field.selectOption('A');
      if (index === 0) {
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Tải bài làm về máy' }).click();
        const html = await readFile(await (await download).path(), 'utf8');
        assert.match(html, term ? /<dd>A<\/dd>/ : /<td>A<\/td>/);
        assert.doesNotMatch(html, /permit|examSessionToken/i);
        if(term){
          await page.getByText('Đã lưu nháp trên máy',{exact:true}).waitFor();
          await page.close();page=await context.newPage();observe(page);await page.goto(url);
          const name=page.locator('#termPaperRecovery input');
          await name.fill('Người khác');await page.getByRole('button',{name:'Mở bài trên máy'}).click();
          await page.getByText('Không khớp bài lưu của bạn.',{exact:false}).waitFor();
          await name.fill('Học viên mô phỏng');await page.getByRole('button',{name:'Mở bài trên máy'}).click();
        }
        else await page.reload();
        await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
        assert.equal(await page.locator(selector).inputValue(), 'A');
      }
      await page.locator(reading ? '#submitReading' : '#submitListening').click();
    }
    await page.locator('#resultReadyView').waitFor({ state: 'visible' });
    if(term)assert.equal((await f.db.query('SELECT count(*)::int AS n FROM assessment.term_test_attempt WHERE completed_at IS NOT NULL')).rows[0].n,0);
    else assert.equal((await f.db.query('SELECT count(*)::int AS n FROM assessment.mini_k67_paper_offline_operation')).rows[0].n,0);
    await context.setOffline(false);
    await page.getByText(term?'Máy chủ đã xác nhận nhận bài':'Máy chủ đã xác nhận các thao tác đã gửi.', { exact: true }).waitFor({ timeout: 25000 });
    if(term){
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'Tải bài làm về máy'}).click();
      const html=await readFile(await (await download).path(),'utf8');
      assert.match(html,/Máy chủ đã nhận/);
      assert.doesNotMatch(html,/permit|examSessionToken|<h2>writing<\/h2>/i);
    }
    await page.locator('#viewResult').click();
    await page.locator('#resultView').waitFor({ state: 'visible' });
    const rows = (await f.db.query('SELECT * FROM assessment.term_test_attempt')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].listening_answers['11'], 'A');
    assert.equal(rows[0].reading_answers[term==='2'?'1':'24'], 'A');
    if(term){
      assert.equal(new Date(rows[0].reading_deadline_at)-new Date(rows[0].reading_started_at),60*60_000);
      assert.equal(rows[0].writing_scope,'lr_only');
      assert.equal(rows[0].writing_submitted_at,null);
      assert.equal(mediaRequests,0);
    }else assert.equal(rows[0].reading_deadline_at, null);
    assert.ok(lostAck, 'test must lose a committed seal response');
    assert.ok(journalFailures.has('/term-tests/shared/exam-journal/bridge.mjs'));
    assert.deepEqual(errors, []);
  } catch (error) {
    const notice=await page?.locator('#notice').textContent({timeout:1500}).catch(()=>null);
    throw new Error(`${error.message}\nRequests: ${JSON.stringify(debug)}\nPage errors: ${JSON.stringify(errors)}\nVisible notice: ${notice}`,{cause:error});
  } finally {
    await browser?.close();
    await Promise.all([close(api), close(web)]);
    await f.db.close();
  }
});
