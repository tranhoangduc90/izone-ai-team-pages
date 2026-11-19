import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ASSET_BUILD_ID } from '../term-tests/term-test-1/offline-assets-parallel-v1.mjs';

const backend=process.env.K67_BACKEND;
const journal=process.env.K67_EXAM_JOURNAL;
assert.ok(backend&&journal,'Set K67_BACKEND and K67_EXAM_JOURNAL to the isolated fixture sources.');
const pages=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');

test('Term 1 paper retains separate drafts and reads back the same receipt when the first response is lost',
  {timeout:150_000},async()=>{
  const socket=createServer().listen(0,'127.0.0.1');
  await once(socket,'listening');
  const {port}=socket.address();
  await new Promise(done=>socket.close(done));
  const base='http://127.0.0.1:'+port;
  const api='/api/term-tests/term-test-1/paper-journey/';
  const studentRef='11111111-1111-4111-8111-111111111111';
  const fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{
    cwd:backend,windowsHide:true,stdio:['ignore','ignore','pipe'],
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),
      K67_PREVIEW_TERM1_PAPER_JOURNEY:'on',K67_PREVIEW_TERM1_PARALLEL_ENTRY:'true',
      K67_PREVIEW_EXAM_JOURNAL:journal,
      // Warm cache from the last revision with the bytes in the old manifest.
      K67_PREVIEW_PREVIOUS_PAGES_REVISION:'f83863ff2fcc6b098620110974a590a96ab1221c'}
  });
  let browser,diagnostics='';
  fixture.stderr.setEncoding('utf8').on('data',data=>{diagnostics=(diagnostics+data).slice(-3500);});
  try{
    let ready=false;
    for(let i=0;i<160&&!ready&&fixture.exitCode===null;i++){
      try{ready=(await fetch(base+'/preview/status')).ok;}catch{}
      if(!ready)await delay(100);
    }
    assert.ok(ready,diagnostics||'Preview fixture did not start.');
    async function switchPages(previous){
      assert.ok((await fetch(base+'/preview/switch-pages?previous='+Number(previous),{method:'POST'})).ok);
    }
    await switchPages(false);
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-sandbox']});
    const errors=[];
    async function createContext(){
      const context=await browser.newContext({baseURL:base,viewport:{width:1024,height:600}});
      await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
      return context;
    }
    async function open(mode,{context,ref=studentRef,mayAutoResume=false}={}){
      context??=await createContext();
      const page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      const prepareRequests=[];
      page.on('request',request=>{
        if(request.method()==='POST'&&request.url()===base+api+'prepare')prepareRequests.push(request);
      });
      const prepared=page.waitForResponse(response=>response.url()===base+api+'prepare');
      await page.goto('/term-tests/term-test-1/?class=IC2304&mode='+mode);
      const pick=async()=>{
        await page.locator('#studentSelect').selectOption(ref);
        await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
      };
      if(mayAutoResume)await Promise.race([prepared,pick()]);
      else await pick();
      const reply=await prepared.catch(async error=>{
        throw new Error((await page.locator('body').innerText()).slice(0,730),{cause:error});
      });
      const bundle=await reply.json();
      assert.ok(reply.ok(),JSON.stringify({status:reply.status(),code:bundle.error}));
      const storageKey=bundle.examSessionToken&&'term1-k67-paper-journey-v1:IC2304:'+ref+':'+bundle.examSessionToken+':'+bundle.generation;
      const record=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),storageKey);
      return {page,context,bundle,record,storageKey,prepareRequests};
    }
    async function fill(scope,skill,answer){
      const input=scope.page.locator('#'+skill+'Questions input[data-number]').first();
      await input.fill(answer);
      const number=await input.getAttribute('data-number');
      try {
        await scope.page.waitForFunction(([key,section,n,value])=>
          JSON.parse(localStorage.getItem(key)||'null')?.drafts[section]?.[n]===value,
        [scope.storageKey,skill,number,answer],{timeout:5000});
      } catch(error) {
        const state=await scope.page.evaluate(() => Object.keys(localStorage)
          .filter(key => key.startsWith('term1-k67-paper-journey-v1:'))
          .map(key => {
            const {drafts,sections,revisions}=JSON.parse(localStorage.getItem(key));
            return {key,drafts,sections:Object.keys(sections||{}),revisions};
          }));
        throw new Error(JSON.stringify({expectedKey:scope.storageKey,skill,number,input:await input.inputValue(),state}),{cause:error});
      }
      return {input,number};
    }
    async function clickSubmit(scope,section){
      scope.page.once('dialog',dialog=>dialog.accept());
      await scope.page.locator('#submit'+section).click();
      await scope.page.locator('#submit'+section).waitFor({state:'hidden'});
    }

    const a=await open('lis_first');
    const b=await open('read_first');
    assert.notEqual(a.bundle.examSessionToken,b.bundle.examSessionToken);
    assert.equal(a.bundle.examDelivery,'answer_sheet');
    assert.equal(b.bundle.examMode,'read_first');
    await b.page.locator('#startReading').click();
    const listening=await fill(a,'listening','Listening on profile A');
    const reading=await fill(b,'reading','Reading on profile B');
    const before=(await b.record()).sections.reading;
    assert.ok(before.deadline>before.startedAt);
    assert.equal((await b.record()).drafts.listening,undefined);
    assert.equal((await a.record()).drafts.reading,undefined);
    await b.context.setOffline(true);
    await b.page.reload();
    await reading.input.waitFor({state:'visible'});
    assert.equal(await reading.input.inputValue(),'Reading on profile B');
    assert.deepEqual((await b.record()).sections.reading,before);
    await b.context.setOffline(false);

    const first=a.page.waitForResponse(response=>response.ok()&&response.url()===base+api+'seal');
    await clickSubmit(a,'Listening');
    const {receipt:accepted}=await (await first).json();
    assert.equal(accepted.section,'listening');
    assert.equal(accepted.completed,false);
    const conflict=b.page.waitForResponse(response=>response.status()===409&&response.url()===base+api+'seal');
    await clickSubmit(b,'Reading');
    assert.equal((await (await conflict).json()).error,'EXAM_FIRST_SUBMISSION_ACCEPTED');
    const pendingBefore=(await b.record()).pending[0];
    assert.ok(pendingBefore.operationId);
    assert.equal(pendingBefore.startedAt,before.startedAt);

    let lostReceipt,sendCount=0;
    await b.context.route('**/paper-journey/seal',async route=>{
      sendCount++;
      const response=await route.fetch();
      if(!lostReceipt&&response.ok()){
        lostReceipt=(await response.json()).receipt;
        await route.abort('failed');
      }else await route.fulfill({response});
    });
    let resumed;
    await b.page.route(base+api+'prepare',async route=>{
      const response=await route.fetch();
      resumed=await response.json();
      await route.fulfill({response});
    },{times:1});
    await b.page.getByRole('button',{name:'Mở theo tiến độ chính thức',exact:true}).click();
    await b.page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'null')?.receipts.reading?.completed,
      b.storageKey,{timeout:33_000});
    assert.ok(resumed);
    assert.equal(resumed.continuationSection,'reading');
    assert.equal(resumed.examSessionToken,b.bundle.examSessionToken);
    assert.equal(resumed.activatedAt,b.bundle.activatedAt);
    const completed=await b.record();
    assert.equal(sendCount,1);
    assert.deepEqual(completed.receipts.reading,lostReceipt);
    assert.equal(lostReceipt.operationId,pendingBefore.operationId);
    assert.equal(lostReceipt.attemptToken,accepted.attemptToken);
    assert.equal(completed.sections.reading.deadline,before.deadline);
    assert.equal(completed.drafts.reading[reading.number],'Reading on profile B');
    let receiptLog;
    for(let i=0;i<32&&!receiptLog;i++){
      const reply=await b.context.request.get('/preview/writing-journal?session='+b.bundle.examSessionToken);
      assert.ok(reply.ok(),await reply.text());
      receiptLog=(await reply.json()).events.map(row=>row.data?.checkpointState).find(row=>
        row?.action==='submission_receipt_verified'&&row.operationId===lostReceipt.operationId);
      if(!receiptLog)await delay(500);
    }
    assert.equal(receiptLog?.delivery,'paper');
    assert.equal(receiptLog?.via,'readback');
    assert.equal(receiptLog?.receiptId,lostReceipt.receiptId);
    assert.equal(receiptLog?.payloadHash,lostReceipt.payloadHash);

    const reopened=await open('lis_first');
    assert.equal(reopened.bundle.resultAttemptToken,accepted.attemptToken);
    const result=reopened.page.waitForResponse(response=>response.ok()&&response.url()===base+'/api/term-tests/result');
    await reopened.page.getByRole('button',{name:'Xem kết quả',exact:true}).click();
    const {result:scores}=await (await result).json();
    assert.equal(scores.listening.details.find(item=>item.number===Number(listening.number)).studentAnswer,'Listening on profile A');
    assert.equal(scores.reading.details.find(item=>item.number===Number(reading.number)).studentAnswer,'Reading on profile B');

    const shared=await createContext();
    const ref='44444444-4444-4444-8444-444444444444';
    await switchPages(true);
    const firstTab=await open('lis_first',{context:shared,ref});
    const firstDraft=await fill(firstTab,'listening','First tab draft');
    assert.equal(firstTab.bundle.term1ParallelEntry,undefined);
    await firstTab.page.evaluate(()=>{window.fixtureOldPaperDocument=true;});
    await switchPages(false);
    await firstTab.page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.getRegistration();
      const changed=new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('Paper controller did not update')),20_000);
        navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timeout);resolve();},{once:true});
      });
      await Promise.all([registration.update(),changed]);
    });
    const build=await firstTab.page.evaluate(()=>new Promise(resolve=>{
      const channel=new MessageChannel();
      channel.port1.onmessage=message=>resolve(message.data.assetBuildId);
      navigator.serviceWorker.controller.postMessage({type:'PREPARE'},[channel.port2]);
    }));
    assert.equal(build,ASSET_BUILD_ID);
    assert.equal(await firstTab.page.evaluate(()=>window.fixtureOldPaperDocument),true);
    const secondTab=await open('lis_first',{context:shared,ref,mayAutoResume:true});
    assert.notEqual(firstTab.bundle.examSessionToken,secondTab.bundle.examSessionToken);
    assert.equal(secondTab.bundle.term1ParallelEntry,true);
    const secondAnswer=secondTab.page.locator('#listeningQuestions input[data-number]').first();
    await secondAnswer.waitFor({state:'visible'});
    assert.equal(await secondAnswer.inputValue(),'');
    assert.deepEqual((await secondTab.record()).drafts,{});
    const secondDraft=await fill(secondTab,'listening','Second tab draft');
    assert.equal(await firstDraft.input.inputValue(),'First tab draft');
    await secondTab.page.reload();
    await secondDraft.input.waitFor({state:'visible'});
    assert.equal(await secondDraft.input.inputValue(),'Second tab draft');
    assert.equal(await firstDraft.input.inputValue(),'First tab draft');
    assert.equal(secondTab.prepareRequests.length,1);
    const oldSeal=firstTab.page.waitForResponse(response=>response.ok()&&response.url()===base+api+'seal');
    await clickSubmit(firstTab,'Listening');
    const {receipt:oldReceipt}=await (await oldSeal).json();
    assert.equal(oldReceipt.examSessionToken,firstTab.bundle.examSessionToken);
    assert.equal(await secondDraft.input.inputValue(),'Second tab draft');
    assert.deepEqual(errors,[]);
  }finally{
    await browser?.close();
    fixture.kill();
  }
});
