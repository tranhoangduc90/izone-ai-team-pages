import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createPracticeCompactApp} from './fixtures/practice-compact-app.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.PRACTICE_COMPACT_EVIDENCE;
if(!out||!path.isAbsolute(out))throw Error('PRIVATE_BROWSER_EVIDENCE_REQUIRED');await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const products=process.env.PRACTICE_COMPACT_PRODUCT?[process.env.PRACTICE_COMPACT_PRODUCT]:['reading','listening'];
const widths=process.env.PRACTICE_COMPACT_WIDTH?[Number(process.env.PRACTICE_COMPACT_WIDTH)]:[1440,390];
const records=[];let browser;
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(records,null,2));});
async function until(fn,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('NATIVE_COMPACT_BROWSER_TIMEOUT');}
for(const product of products)for(const width of widths)test(`${product}/${width}: actual browser keeps edits/clock/DOM while native compact receipts arrive`,{timeout:60000},async t=>{
 const f=await createPracticeCompactApp({root,product}),context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);
 t.after(async()=>{await context.close();await f.close();});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 try{
  await page.goto(f.url);await page.locator('#login-submit').waitFor();
  for(const [selector,value] of [['#class-select','FIXTURE 67'],['#student-select',f.studentRef]]){
   const field=page.locator(selector);if(await field.isEnabled())await field.selectOption(value);else assert.equal(await field.inputValue(),value);
  }
  await page.locator('#login-submit').click();await page.waitForURL(/#prep$/);await page.locator('[data-action="begin"]').click();await page.waitForURL(/#exercise$/);
  await until(()=>f.requests.some(r=>r.path==='/api/activate'&&r.completed&&r.status===200));
  if(product==='listening')await page.waitForFunction(()=>!document.querySelector('#listening-audio').paused);
  const native=await f.service.read({token:f.token});assert.equal(native.attempts.length,1);assert.equal(native.attempts[0].status,'running');
  // Notes are a real persistent input in both engines; each arriving ACK must preserve a newer edit.
  await page.locator('[data-action="notes"]').first().click();const input=page.locator('#notes');await input.fill('First draft sent to the native API');
  await until(()=>f.requests.some(r=>r.path==='/api/pulse'&&r.compact&&r.completed&&r.body?.ack==='practice-pulse-v1'));
  const before=await page.evaluate(()=>{const input=document.querySelector('#notes');input.focus();input.setSelectionRange(2,9);window.__pulseNode=input;return{timer:document.querySelector('#timer strong').textContent};});
  let release;f.controls.holdPulse=new Promise(r=>release=r);
  await input.fill('Older request in flight');await until(()=>f.requests.some(r=>r.path==='/api/pulse'&&r.held));await input.fill('Newer edit must survive the older receipt');release();
  await until(async()=> (await f.service.read({token:f.token})).attempts.at(-1).notes==='Newer edit must survive the older receipt');
  const baselinePulses=f.requests.filter(r=>r.path==='/api/pulse'&&r.completed&&r.status===200).length;
  await input.evaluate(node=>{node.focus();node.setSelectionRange(2,9);node.scrollTop=0;});
  await until(()=>f.requests.filter(r=>r.path==='/api/pulse'&&r.completed&&r.status===200).length>=baselinePulses+3,20000);
  const stable=await page.evaluate(()=>({same:window.__pulseNode===document.querySelector('#notes'),focus:document.activeElement===window.__pulseNode,selection:[window.__pulseNode.selectionStart,window.__pulseNode.selectionEnd],scroll:window.__pulseNode.scrollTop,value:document.querySelector('#notes').value,timer:document.querySelector('#timer strong').textContent}));
  assert.equal(stable.same,true);assert.equal(stable.focus,true);assert.deepEqual(stable.selection,[2,9]);assert.equal(stable.scroll,0);assert.equal(stable.value,'Newer edit must survive the older receipt');assert.notEqual(stable.timer,before.timer);
  const pulses=f.requests.filter(r=>r.path==='/api/pulse'&&r.completed&&r.status===200);assert.ok(pulses.length>=3);assert.ok(pulses.every(r=>r.compact&&r.body?.ack==='practice-pulse-v1'));
  assert.ok(pulses.at(-1).body.attempt.usedMs>5000,'Native server time must advance with real playback/browser time');
  if(width===390){
   let releaseSubmit,releaseResult,failedResult=false;
   const submitDelay=new Promise(resolve=>{releaseSubmit=resolve;}),resultDelay=new Promise(resolve=>{releaseResult=resolve;});
   await context.route(/\/api\/submit(?:\?|$)/,async route=>{await submitDelay;await route.continue();});
   await context.route(/\/api\/result\//,async route=>{
    if(failedResult)return route.continue();
    await resultDelay;failedResult=true;await route.fulfill({status:503,json:{error:'SYNTHETIC_RESULT_UNAVAILABLE'}});
   });
   const toast=page.locator('#toast');
   try{
    await page.locator('[data-action="request-submit"]:visible').first().click();
    await page.locator('#modal').getByRole('button',{name:'Nộp bài',exact:true}).click();
    await toast.getByText('Đang gửi bài…',{exact:true}).waitFor();
    await toast.locator('.izone-grading-spinner').waitFor();
    releaseSubmit();
    await toast.getByText('Đã nộp · Đang mở kết quả',{exact:true}).waitFor();
    releaseResult();
    await toast.getByRole('button',{name:'Mở lại kết quả'}).click();
    await page.locator('.result-summary').waitFor();
    assert.equal(f.requests.filter(r=>r.path==='/api/submit'&&r.method==='POST').length,1);
    assert.equal((await f.service.read({token:f.token})).attempts.at(-1).id,native.attempts[0].id);
   }finally{releaseSubmit();releaseResult();}
  }
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,product+'-'+width+'-native-compact.png')});records.push({product,width,outcome:'passed',pulses:pulses.length,maxAckBytes:Math.max(...pulses.map(r=>JSON.stringify(r.body).length)),sameNode:stable.same,clockAdvanced:true});
 }catch(error){await page.screenshot({path:path.join(out,product+'-'+width+'-failed.png')});await fs.writeFile(path.join(out,product+'-'+width+'-failure.json'),JSON.stringify({errors,url:page.url(),requests:f.requests},null,2));throw error;}
});
