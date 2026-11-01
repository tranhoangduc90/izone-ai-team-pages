import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createPracticeCompactApp} from './fixtures/practice-compact-app.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.PRACTICE_COMPACT_EVIDENCE;
if(!out||!path.isAbsolute(out))throw Error('PRIVATE_BROWSER_EVIDENCE_REQUIRED');await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const products=process.env.PRACTICE_COMPACT_PRODUCT?[process.env.PRACTICE_COMPACT_PRODUCT]:['reading','listening'];
const widths=process.env.PRACTICE_COMPACT_WIDTH?[Number(process.env.PRACTICE_COMPACT_WIDTH)]:[1440,390];
const modes=process.env.PRACTICE_COMPAT_MODE?[process.env.PRACTICE_COMPAT_MODE]:['compact','published-client'];
const published='c45b6b7f00f3495d78c91019dbc1cd0954c0142d',records=[];let browser;
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(records,null,2));});
async function until(fn,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('NATIVE_RECOVERY_BROWSER_TIMEOUT');}
for(const product of products)for(const width of widths)for(const mode of modes)test(`${product}/${width}/${mode}: lost committed pulse ACK recovers the same draft, then submits exactly once`,{timeout:60000},async t=>{
 const clientSource=mode==='published-client'?execFileSync('git',['show',published+':'+product+'-practice/app.js'],{cwd:root,encoding:'utf8'}):undefined;
 const f=await createPracticeCompactApp({root,product,clientSource}),context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);
 t.after(async()=>{await context.close();await f.close();});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 const label=product+'-'+width+'-'+mode;
 try{
  await page.goto(f.url);await page.locator('#login-submit').waitFor();
  for(const [selector,value] of [['#class-select','FIXTURE 67'],['#student-select',f.studentRef]]){const field=page.locator(selector);if(await field.isEnabled())await field.selectOption(value);else assert.equal(await field.inputValue(),value);}
  await page.locator('#login-submit').click();await page.waitForURL(/#prep$/);await page.locator('[data-action="begin"]').click();await page.waitForURL(/#exercise$/);
  await until(()=>f.requests.some(r=>r.path==='/api/activate'&&r.completed&&r.status===200));
  if(product==='listening')await page.waitForFunction(()=>!document.querySelector('#listening-audio').paused);
  const initial=(await f.service.read({token:f.token})).attempts.at(-1),notes='Synthetic committed draft with a lost acknowledgment. '+label;
  await page.locator('[data-action="notes"]').first().click();f.controls.dropPulseAck=true;await page.locator('#notes').fill(notes);
  await until(()=>f.requests.some(r=>r.path==='/api/pulse'&&r.dropped));
  const committed=(await f.service.read({token:f.token})).attempts.at(-1);assert.equal(committed.id,initial.id);assert.equal(committed.notes,notes);
  const lost=f.requests.find(r=>r.dropped);assert.equal(lost.compact,mode==='compact');assert.equal(lost.body.ack,mode==='compact'?'practice-pulse-v1':undefined);
  await page.waitForURL(/#resume$/);await page.locator('[data-action="resume"]').click();await page.waitForURL(/#exercise$/);
  await until(()=>f.requests.filter(r=>r.path==='/api/activate'&&r.completed&&r.status===200).length===2);
  const restored=(await f.service.read({token:f.token})).attempts;assert.equal(restored.length,1);assert.equal(restored[0].id,initial.id);assert.equal(restored[0].notes,notes);
  if(!await page.locator('#notes').isVisible())await page.locator('[data-action="notes"]').first().click();assert.equal(await page.locator('#notes').inputValue(),notes);
  const latest=notes+' New edit after recovery.';await page.locator('#notes').fill(latest);
  await until(async()=> (await f.service.read({token:f.token})).attempts.at(-1).notes===latest);
  await page.locator('#notes-panel [data-action="notes"]').click();
  await page.locator('[data-action="request-submit"]').first().click();await page.locator('[data-action="confirm-modal"]').click();await page.waitForURL(/#result\?attempt=1$/);
  await page.locator('.result-summary').waitFor({state:'visible'});await page.locator('.history [data-action="result-attempt"]').first().waitFor({state:'visible'});
  const final=await f.service.read({token:f.token});assert.equal(final.attempts.length,1);assert.equal(final.attempts[0].id,initial.id);assert.equal(final.attempts[0].status,'submitted');assert.equal(final.attempts[0].notes,latest);assert.equal(final.firstCompleted,1);
  assert.equal(f.requests.filter(r=>r.path==='/api/submit').length,1);
  const jobs=(await f.pool.query(`SELECT sequence,kind FROM ${product}_practice.doc_job WHERE binding_id=$1 ORDER BY sequence`,[f.registered.bindingId])).rows;assert.equal(jobs.length,3);assert.equal(jobs.filter(job=>job.kind==='status').length,2);
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,label+'-recovered-result.png')});records.push({product,width,mode,outcome:'passed',lostAckCommitted:true,sameAttempt:true,notesRecovered:true,submissionRequests:1,docJobs:3});
 }catch(error){await page.screenshot({path:path.join(out,label+'-failed.png')});await fs.writeFile(path.join(out,label+'-failure.json'),JSON.stringify({errors,url:page.url(),requests:f.requests},null,2));throw error;}
});
