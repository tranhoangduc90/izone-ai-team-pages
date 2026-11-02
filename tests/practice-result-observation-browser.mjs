import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createPracticeCompactApp} from './fixtures/practice-compact-app.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.PRACTICE_RESULT_EVIDENCE;
if(!out||!path.isAbsolute(out))throw Error('PRIVATE_RESULT_EVIDENCE_REQUIRED');await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const products=process.env.PRACTICE_COMPACT_PRODUCT?[process.env.PRACTICE_COMPACT_PRODUCT]:['reading','listening'],quick=process.env.PRACTICE_RESULT_QUICK==='true',records=[];let browser;
const until=async(check,timeout=15000)=>{const end=performance.now()+timeout;while(performance.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('RESULT_NATIVE_BROWSER_TIMEOUT');};
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(records,null,2));});
for(const product of products)test(`${product}: native Docs commit reaches learner without result rereads or interrupting the reading view`,{timeout:200000},async t=>{
 const f=await createPracticeCompactApp({root,product,stateStreamEnabled:true}),width=product==='reading'?1440:390;
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);
 t.after(async()=>{await context.close();await f.close();});const errors=[];page.on('pageerror',error=>errors.push(error.message));let holdResult=null,releaseHeld;
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==f.origin)return route.abort();
  if(url.pathname.startsWith('/api/result/')&&holdResult){const held=holdResult;holdResult=null;const response=await route.fetch();held.captured();await held.release;await route.fulfill({response}).catch(()=>{});return;}
  return route.continue();
 });
 const schema=product+'_practice',work=()=>f.pool.query(`SELECT state,updated_at FROM ${schema}.work`),resultReads=()=>f.requests.filter(row=>row.path.startsWith('/api/result/')&&row.completed).length,statusReads=()=>f.requests.filter(row=>row.path==='/api/student-progress/status'&&row.completed).length;
 const warning=()=>page.locator('[data-practice-result-state]').evaluate(node=>!node.hidden);
 try{
  const ids=[];
  let begun=await f.service.begin({token:f.token,owner:'seed',operationId:randomUUID()});
  for(let n=1;n<=2;n++){
   const id=begun.attempts.at(-1).id;ids.push(id);await f.service.activate({token:f.token,attemptId:id,lease:begun.lease});
   const draft=f.draft();draft.sequence=1;draft.notes=`Private synthetic result ${n}.`;draft.answers[Object.keys(f.content.key)[0]]=f.content.key[Object.keys(f.content.key)[0]][0];
   await f.service.submit({token:f.token,operationId:randomUUID(),attemptId:id,lease:begun.lease,snapshot:draft,method:'manual'});
   if(n<2)begun=await f.service.reset({token:f.token,operationId:randomUUID(),attemptId:id,owner:'seed'});
  }
  const before=(await work()).rows;
  await page.goto(f.url);await page.locator('#login-submit').waitFor();
  for(const [selector,value] of [['#class-select','FIXTURE 67'],['#student-select',f.studentRef]]){const field=page.locator(selector);if(await field.isEnabled())await field.selectOption(value);else assert.equal(await field.inputValue(),value);}
  await page.locator('#login-submit').click();await page.waitForURL(/#prep$/);await page.evaluate(()=>location.hash='result?attempt=1');await page.locator('.result-summary').waitFor();
  await until(()=>resultReads()===1&&statusReads()>=1);await until(async()=>!await warning());
  // Let the barrier response finish painting before collecting stable DOM evidence.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const number=Object.keys(f.content.key)[1];await page.locator(`[data-action="explanation-toggle"][data-question="${number}"]`).click();
  const paneSelector=product==='reading'?'.explanation-dialog-detail-scroll':`#explanation-${number} .explanation-analysis`;
  const paragraphSelector=product==='reading'?'.explanation-dialog-analysis > p':`#explanation-${number} .explanation-analysis p`;
  const focusSelector=product==='reading'?'#explanation-dialog [data-action="explanation-next"]':`[data-action="explanation-toggle"][data-question="${number}"]`;
  await page.locator(paragraphSelector).first().waitFor();
  const baseline=await page.evaluate(({paneSelector,paragraphSelector,focusSelector})=>{
   const pane=document.querySelector(paneSelector),paragraph=document.querySelector(paragraphSelector),focus=document.querySelector(focusSelector);
   window.__resultPane=pane;window.__resultParagraph=paragraph;window.__resultFocus=focus;focus.focus({preventScroll:true});pane.scrollTop=100;
   const range=document.createRange();range.setStart(paragraph.firstChild,2);range.setEnd(paragraph.firstChild,15);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
   return{selection:selection.toString(),scroll:scrollY,paneScroll:pane.scrollTop,paragraphTop:paragraph.getBoundingClientRect().top};
  },{paneSelector,paragraphSelector,focusSelector});
  const readingState=()=>page.evaluate(({paneSelector,paragraphSelector})=>({samePane:window.__resultPane===document.querySelector(paneSelector),sameParagraph:window.__resultParagraph===document.querySelector(paragraphSelector),focused:document.activeElement===window.__resultFocus,selection:getSelection().toString(),scroll:scrollY,paneScroll:document.querySelector(paneSelector)?.scrollTop,paragraphTop:document.querySelector(paragraphSelector)?.getBoundingClientRect().top}),{paneSelector,paragraphSelector});
  const assertReading=async({unchanged=false}={})=>{const now=await readingState();assert.equal(now.samePane,true);assert.equal(now.sameParagraph,true);assert.equal(now.focused,true);assert.equal(now.selection,baseline.selection);if(unchanged)assert.equal(now.scroll,baseline.scroll);assert.equal(now.paneScroll,baseline.paneScroll);assert.ok(Math.abs(now.paragraphTop-baseline.paragraphTop)<=1,JSON.stringify({baseline,now}));};
  const initialReads=resultReads(),initialStatus=statusReads(),scanStart=f.observationHub.snapshot().scans,started=performance.now();
  if(!quick)await until(()=>performance.now()-started>=90000&&f.observationHub.snapshot().scans>=scanStart+3,102000);
  await assertReading({unchanged:true});assert.equal(resultReads(),initialReads);assert.equal(statusReads(),initialStatus);
  // Do not wake the hub here: only the native worker's verified COMMIT may publish this state.
  const docs=await f.resultDocs.drain();assert.ok(docs.writes>0);assert.ok(docs.reads>docs.writes);assert.ok(docs.signals.includes('state'));
  await until(()=>page.locator('[data-practice-docs]').evaluate(node=>node.textContent.includes('Đã cập nhật tình trạng')));
  await assertReading();assert.equal(resultReads(),initialReads);assert.deepEqual((await work()).rows,before);
  const verified=(await f.pool.query(`SELECT status FROM ${schema}.doc_job`)).rows;assert.ok(verified.length>1&&verified.every(row=>row.status==='verified'));
  // Same attempt, unchanged work timestamp, repaired explanations: one content read plus a fresh metadata barrier.
  f.content.explanations.entries[number].heading={runs:[{text:'Repaired synthetic explanation heading'}]};
  f.content.explanations.entries[number].prompt={runs:[{text:'Repaired synthetic explanation heading'}]};
  await f.pool.query(`UPDATE ${schema}.content SET explanations=$1`,[f.content.explanations]);f.observationHub.wake();
  await until(()=>resultReads()===initialReads+1&&statusReads()===initialStatus+1);
  await until(()=>page.locator(product==='reading'?'#explanation-dialog':`#explanation-${number}`).evaluate(node=>node.textContent.includes('Repaired synthetic explanation heading')));
  await assertReading();assert.deepEqual((await work()).rows,before);
  // A failed metadata read keeps the owned result. Recovery of the same revision clears its warning without a full read.
  await f.pool.query(`UPDATE ${schema}.work SET state=jsonb_set(state,'{attempts,0,draft,answers}','[]'::jsonb)`);f.observationHub.wake();await until(warning);await assertReading();
  await f.pool.query(`UPDATE ${schema}.work SET state=$1::jsonb`,[JSON.stringify(before[0].state)]);f.observationHub.wake();await until(async()=>!await warning());await assertReading();assert.equal(resultReads(),initialReads+1);
  await page.screenshot({path:path.join(out,product+'-result-stable.png')});
  // A completed but delayed HTTP response must be discarded after leaving this attempt.
  let captured;const capturedPromise=new Promise(resolve=>captured=resolve),release=new Promise(resolve=>releaseHeld=resolve);holdResult={captured,release};
  f.content.explanations.entries[number].heading.runs[0].text='Late response must not reopen result';await f.pool.query(`UPDATE ${schema}.content SET explanations=$1`,[f.content.explanations]);f.observationHub.wake();await capturedPromise;
  await page.evaluate(()=>location.hash='prep');await page.waitForURL(/#prep$/);await page.locator('.result-summary').waitFor({state:'hidden'});releaseHeld();
  await until(()=>f.observationHub.snapshot().connections===0);assert.equal(await page.locator('.result-summary').count(),0);assert.equal(await warning(),false);
  await page.evaluate(()=>location.hash='result?attempt=1');await page.locator('.result-summary').waitFor();await until(()=>f.requests.filter(row=>row.path==='/api/student-progress/status'&&row.completed).length>=initialStatus+2);
  const storageBefore=await page.evaluate(()=>JSON.stringify({...localStorage}));f.setEligible(false);f.observationHub.wake();await page.waitForURL(/#login$/);
  assert.equal(await page.locator('.result-summary').count(),0);assert.equal(await page.locator('#explanation-dialog[open]').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),storageBefore);
  assert.deepEqual((await work()).rows,before);assert.deepEqual(errors,[]);
  records.push({product,width,outcome:'passed',observedMs:performance.now()-started,realIntervalMs:30000,steadyScans:quick?0:3,steadyFullResultReads:0,steadyStatusReads:0,nativeDocsReadback:docs.reads,nativeDocsWrites:docs.writes,nativeCommitSignals:docs.signals.length,docsOnlyResultReads:0,repairedContentReads:1,preservedReadingState:true,metadataRecovery:true,lateResultDiscarded:true,revokedPrivateView:true,workUnchanged:true});
 }catch(error){releaseHeld?.();await page.screenshot({path:path.join(out,product+'-failed.png')});await fs.writeFile(path.join(out,product+'-failure.private.json'),JSON.stringify({url:page.url(),errors,hub:f.observationHub.snapshot(),docs:f.resultDocs.snapshot(),requests:f.requests.map(row=>({path:row.path,status:row.status,completed:row.completed,code:row.body?.error?.code}))},null,2));throw error;}
});
