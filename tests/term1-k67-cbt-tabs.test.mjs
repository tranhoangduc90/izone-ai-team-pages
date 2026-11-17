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
assert.ok(backend, 'Set K67_BACKEND to the isolated backend package.');
const require = createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const { chromium } = require('playwright');

test('Term 1 tabs sharing local storage each keep their own draft and timer', {timeout:100_000}, async () => {
  const socket = createServer().listen(0,'127.0.0.1');
  await once(socket,'listening');
  const {port} = socket.address();
  await new Promise(done => socket.close(done));
  const base = 'http://127.0.0.1:' + port;
  const entry = '/term-tests/term-test-1-computer-based/?class=IC2304&mode=read_first';
  const studentRef = '11111111-1111-4111-8111-111111111111';
  const fixture = spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{
    cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_TERM1_CBT_JOURNEY:'on',
      K67_PREVIEW_TERM1_PARALLEL_ENTRY:'true',K67_PREVIEW_TERM1_READING_MINUTES:'3'},
    stdio:['ignore','ignore','pipe']
  });
  let browser, diagnostics='';
  fixture.stderr.setEncoding('utf8').on('data',data => {diagnostics=(diagnostics+data).slice(-3000);});
  try {
    let ready = false;
    for (let i=0;i<160&&!ready&&fixture.exitCode===null;i+=1) {
      try {ready=(await fetch(base+entry)).ok;} catch {}
      if (!ready) await new Promise(done=>setTimeout(done,100));
    }
    assert.ok(ready,diagnostics||'Preview fixture did not start.');
    browser = await chromium.launch({channel:'msedge',headless:true,args:['--no-sandbox']});
    const context = await browser.newContext({baseURL:base});
    const traces = new WeakMap();
    context.on('page',page=>{
      const events = [];
      traces.set(page,events);
      page.on('pageerror',error=>events.push(error.message));
      page.on('framenavigated',frame=>{
        if (frame===page.mainFrame()) events.push('navigated '+new URL(frame.url()).pathname);
      });
      page.on('response', response=>{
        if (!/\/(?:prepare|begin)$/.test(response.url())) return;
        const request = response.request().postDataJSON();
        void response.json().then(body=>events.push([
          new URL(response.url()).pathname,response.status(),request?.examMode,
          request?.examSessionToken?.slice(-8),body.examMode,body.examSessionToken?.slice(-8)
        ])).catch(()=>{});
      });
    });
    const select = async page => {
      await page.goto(entry);
      await page.locator('#bootstrapStudent').selectOption(studentRef);
      await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    };
    const start = async page => {
      await page.evaluate(() => {
        window.term1FixtureClicks=[];
        document.addEventListener('click',event=>window.term1FixtureClicks.push(
          (event.target.closest('button')||event.target).id),{capture:true});
      });
      await page.locator('#bootstrapStart').click({timeout:12_000}).catch(async error=>{
        throw new Error((await page.locator('body').innerText()).slice(0,1100),{cause:error});
      });
      await page.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().readingStartedAt,{},{timeout:12_000})
        .catch(async error=>{
          throw new Error(JSON.stringify({visible:(await page.locator('body').innerText()).slice(0,1200),
            events:traces.get(page),clicks:await page.evaluate(()=>window.term1FixtureClicks)}),{cause:error});
        });
      return page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
    };
    const write = async (page, value) => {
      const input = page.locator('#readingQuestions input[data-number]').first();
      const number = await input.getAttribute('data-number');
      await input.fill(value);
      await page.waitForFunction(([key, answer])=>window.TERM_TEST_BOOTSTRAP?.miniJourney?.drafts().reading?.[key]===answer,[number,value]);
      return input;
    };
    const copiedTab = async snapshot => {
      const page = await context.newPage();
      await page.addInitScript(({historyState,session})=>{
        if (sessionStorage.getItem('term1-test-duplicate-initialized')) return;
        for (const [key,value] of session) sessionStorage.setItem(key,value);
        sessionStorage.setItem('term1-test-duplicate-initialized','1');
        history.replaceState(historyState,'');
      },snapshot);
      await page.goto(entry);
      return page;
    };
    const a = await context.newPage();
    await select(a);
    const scopeA = await start(a);
    const fieldA = await write(a,'Draft saved in tab A');

    const b = await context.newPage();
    await select(b);
    const scopeB = await start(b);
    assert.notEqual(scopeB.examSessionToken,scopeA.examSessionToken);
    assert.equal(traces.get(b).filter(event=>Array.isArray(event) && event[0].endsWith('/session/prepare') && !event[3]).length,1);
    const fieldB = await write(b,'Draft saved in tab B');

    const snapshot = await a.evaluate(() => ({historyState:history.state, session:Object.entries(sessionStorage)}));
    const duplicate = await copiedTab(snapshot);
    const scopeC = await start(duplicate);
    assert.notEqual(scopeC.examSessionToken,scopeA.examSessionToken);
    assert.notEqual(scopeC.examSessionToken,scopeB.examSessionToken);
    const draftC = duplicate.locator('#readingQuestions input[data-number]').first();
    assert.equal(await draftC.inputValue(),'');
    await write(duplicate,'Draft saved in tab C');

    await a.reload();
    await b.reload();
    for (const [page,scope,input,value] of [[a,scopeA,fieldA,'Draft saved in tab A'],[b,scopeB,fieldB,'Draft saved in tab B']]) {
      await page.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().readingStartedAt);
      const after = await page.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
      assert.equal(after.examSessionToken,scope.examSessionToken);
      assert.equal(after.readingDeadlineAt,scope.readingDeadlineAt);
      assert.equal(await input.inputValue(),value);
    }
    const closedHistory = await b.evaluate(() => history.state);
    await b.close();
    const restored = await copiedTab({historyState:closedHistory,session:[]});
    await restored.waitForFunction(() => window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().readingStartedAt);
    const afterClose = await restored.evaluate(() => window.TERM_TEST_BOOTSTRAP.miniJourney.view());
    assert.equal(afterClose.examSessionToken,scopeB.examSessionToken);
    assert.equal(afterClose.readingDeadlineAt,scopeB.readingDeadlineAt);
    assert.equal(await restored.locator('#readingQuestions input[data-number]').first().inputValue(),'Draft saved in tab B');
  } finally {
    await browser?.close();
    fixture.kill();
  }
});
