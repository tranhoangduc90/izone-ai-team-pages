import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const pages=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.K67_BACKEND;
assert.ok(backend,'Set K67_BACKEND to the isolated backend package.');
const require=createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');

test('Term 1 warm rollout keeps old Reading and new Listening receipts through drain', {timeout:120_000}, async()=>{
  const socket=createServer().listen(0,'127.0.0.1');
  await once(socket,'listening');
  const {port}=socket.address();
  await new Promise(done=>socket.close(done));
  const base='http://127.0.0.1:'+port;
  const entry='/term-tests/term-test-1-computer-based/?class=IC2304&mode=';
  const studentRef='11111111-1111-4111-8111-111111111111';
  const fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{
    cwd:backend,windowsHide:true,stdio:['ignore','ignore','pipe'],
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),
      K67_PREVIEW_TERM1_CBT_JOURNEY:'on',K67_PREVIEW_TERM1_PARALLEL_ENTRY:'warm-up',
      K67_PREVIEW_PREVIOUS_PAGES_REVISION:'b3bb6208c5a826525659ae54e29f1eaf0d83b46e',
      K67_PREVIEW_AUDIO_SECONDS:'13',K67_PREVIEW_TERM1_READING_MINUTES:'3'}
  });
  let browser, diagnostics='';
  fixture.stderr.setEncoding('utf8').on('data',data=>{diagnostics=(diagnostics+data).slice(-3200);});
  try {
    let ready=false;
    for (let i=0;i<200&&!ready&&fixture.exitCode===null;i+=1) {
      try {ready=(await fetch(base+entry+'read_first')).ok;} catch {}
      if (!ready) await new Promise(done=>setTimeout(done,100));
    }
    assert.ok(ready,diagnostics||'Preview fixture did not start.');
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
    const context=await browser.newContext({baseURL:base});
    const mockStandaloneWriting = async target => target.addInitScript(() => {
      const fetchOriginal = window.fetch.bind(window);
      window.fetch = (input, options) => {
        if (input !== 'https://ducizone.ddns.net/webhook/k67-term1-standalone-writing-review-v1') {
          return fetchOriginal(input, options);
        }
        const result = window.fixtureStandaloneWriting;
        if (!result) return Promise.resolve(new Response(null, { status: 404 }));
        window.fixtureStandaloneRequest = JSON.parse(options.body);
        return Promise.resolve(Response.json({ ok: true, result }));
      };
    });
    await mockStandaloneWriting(context);
    const errors=[];
    const open=async mode=>{
      const page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(entry+mode);
      await page.locator('#bootstrapStudent').selectOption(studentRef);
      await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
      return page;
    };
    const started=async (page,skill)=>{
      await page.waitForFunction(name=>window.TERM_TEST_BOOTSTRAP?.miniJourney?.view()[name+'StartedAt'],skill);
      return page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.view());
    };
    async function write(page,skill,value) {
      const input=page.locator('#'+skill+'Questions input[data-number]').first();
      await input.fill(value);
      const number=await input.getAttribute('data-number');
      await page.waitForFunction(([kind,key,answer])=>
        window.TERM_TEST_BOOTSTRAP?.miniJourney?.drafts()[kind]?.[key]===answer,[skill,number,value]);
      return number;
    }
    const submit=async (page,skill)=>{
      page.once('dialog',dialog=>dialog.accept());
      const saved=page.waitForResponse(response=>response.ok() && response.url().endsWith('/cbt-journey/seal')
        && response.request().postDataJSON()?.section===skill.toLowerCase());
      await page.locator('#submit'+skill).click();
      return (await (await saved).json()).receipt;
    };
    async function setServerMode(mode) {
      const response=await context.request.post('/preview/term1-parallel-mode',{data:{mode}});
      assert.ok(response.ok(),await response.text());
    }

    const old=await open('read_first');
    await old.locator('#bootstrapStart').click();
    const original=await started(old,'reading');
    const readingNumber=await write(old,'reading','Reading from the old shell');
    assert.equal(await old.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname.split('/').at(-1)),
      'offline-worker-listening-first-frame-v1.js');
    await old.evaluate(()=>{window.fixtureOldDocument=true;});
    assert.ok((await context.request.post('/preview/switch-pages?previous=0')).ok());
    await setServerMode('on');

    const modern=await open('lis_first');
    await modern.locator('#bootstrapPreview').click({timeout:22_000});
    await modern.locator('#bootstrapStart').click({timeout:23_000});
    const current=await started(modern,'listening');
    const listeningNumber=await write(modern,'listening','Listening from the new shell');
    assert.equal(current.term1ParallelEntry,true);
    assert.notEqual(current.examSessionToken,original.examSessionToken);
    await old.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('offline-worker-parallel-v1.js'));
    assert.equal(await old.evaluate(()=>window.fixtureOldDocument),true);
    assert.equal(await old.locator(`#readingQuestions input[data-number="${readingNumber}"]`).inputValue(),'Reading from the old shell');

    await setServerMode('drain');
    await context.setOffline(true);
    await modern.reload();
    assert.equal((await started(modern,'listening')).listeningStartedAt,current.listeningStartedAt);
    assert.equal(await modern.locator(`#listeningQuestions input[data-number="${listeningNumber}"]`).inputValue(),'Listening from the new shell');
    await context.setOffline(false);
    const readingReceipt=await submit(old,'Reading');
    assert.equal(readingReceipt.examSessionToken,original.examSessionToken);
    await modern.reload();
    await modern.waitForFunction(()=>window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().continuationSection==='listening');
    const resumed=await started(modern,'listening');
    assert.equal(resumed.examSessionToken,current.examSessionToken);
    assert.equal(resumed.listeningStartedAt,current.listeningStartedAt);
    assert.equal(resumed.readingSubmitted,true);
    assert.equal(await modern.locator(`#listeningQuestions input[data-number="${listeningNumber}"]`).inputValue(),'Listening from the new shell');
    const listeningReceipt=await submit(modern,'Listening');
    assert.equal(listeningReceipt.examSessionToken,current.examSessionToken);
    assert.equal(listeningReceipt.nextSection,'writing');

    const readBack=await context.request.post('/api/term-tests/result',{
      data:{attemptToken:readingReceipt.attemptToken,orderClientVersion:1}
    });
    assert.ok(readBack.ok(),await readBack.text());
    const {result}=await readBack.json();
    const reading=result.reading.details.find(item=>item.number===Number(readingNumber));
    const listening=result.listening.details.find(item=>item.number===Number(listeningNumber));
    assert.equal(reading.studentAnswer,'Reading from the old shell');
    assert.equal(listening.studentAnswer,'Listening from the new shell');
    const reviewContext = await browser.newContext({ baseURL: base });
    await mockStandaloneWriting(reviewContext);
    const reviewPage = await reviewContext.newPage();
    reviewPage.on('pageerror', error => errors.push(error.message));
    await reviewPage.goto(entry+'read_first');
    await reviewPage.locator('#bootstrapStudent').selectOption(studentRef);
    await reviewPage.evaluate(ref => {
      const picker = document.getElementById('bootstrapStudent');
      const studentName = Array.from(picker.options).find(option => option.value === ref).textContent;
      window.fixtureStandaloneWriting = {
        testSlug: 'term-test-1', classCode: 'IC2304', taskNumber: 2, studentRef: ref, studentName,
        score: 6, wordCount: 3, essay: 'Synthetic practice essay', prompt: 'Synthetic prompt',
        criteria: ['TR', 'CC', 'LR', 'GRA'].map(code => ({ code, bandScore: 6, feedback: 'Synthetic feedback' })),
      };
    }, studentRef);
    await reviewPage.getByRole('button', { name: 'Xác nhận, tiếp tục', exact: true }).click();
    const review = reviewPage.getByRole('dialog');
    await review.getByText('Synthetic practice essay', { exact: true }).waitFor();
    assert.deepEqual(await reviewPage.evaluate(() => window.fixtureStandaloneRequest), {
      testSlug: 'term-test-1', classCode: 'IC2304', studentRef, identityConfirmed: true,
    });
    assert.deepEqual(errors,[]);
  } finally {
    await browser?.close();
    fixture.kill();
  }
});
