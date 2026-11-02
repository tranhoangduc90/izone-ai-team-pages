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
const until=async check=>{const end=performance.now()+10000;while(performance.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('RESULT_COMPAT_BROWSER_TIMEOUT');};
const records=[];let browser;test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(records,null,2));});
for(const product of ['reading','listening'])for(const mode of ['disabled','missing','expired'])test(`${product}: result view handles ${mode} observation without losing the saved draft`,{timeout:35000},async t=>{
 const f=await createPracticeCompactApp({root,product,stateStreamEnabled:mode!=='disabled'}),context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);t.after(async()=>{await context.close();await f.close();});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==f.origin)return route.abort();if(mode==='missing'&&url.pathname.startsWith('/api/student-progress/'))return route.fulfill({status:404,contentType:'application/json',body:'{"error":"NOT_FOUND"}'});return route.continue();});
 try{
  const begun=await f.service.begin({token:f.token,owner:'seed',operationId:randomUUID()}),attempt=begun.attempts.at(-1);await f.service.activate({token:f.token,attemptId:attempt.id,lease:begun.lease});
  const draft=f.draft();draft.sequence=1;draft.notes='Private saved synthetic draft.';await f.service.submit({token:f.token,operationId:randomUUID(),attemptId:attempt.id,lease:begun.lease,snapshot:draft,method:'manual'});
  const before=(await f.pool.query(`SELECT state,updated_at FROM ${product}_practice.work`)).rows;
  await page.goto(f.url);await page.locator('#login-submit').waitFor();for(const [selector,value] of [['#class-select','FIXTURE 67'],['#student-select',f.studentRef]]){const field=page.locator(selector);if(await field.isEnabled())await field.selectOption(value);else assert.equal(await field.inputValue(),value);}
  await page.locator('#login-submit').click();await page.waitForURL(/#prep$/);await page.evaluate(()=>location.hash='result?attempt=1');await page.locator('.result-summary').waitFor();
  if(mode==='expired'){
   await until(()=>f.requests.some(row=>row.path==='/api/student-progress/status'&&row.completed));const storage=await page.evaluate(()=>JSON.stringify({...localStorage}));await f.pool.query(`DELETE FROM ${product}_practice.student_session`);f.observationHub.wake();await page.waitForURL(/#login$/);assert.equal(await page.locator('.result-summary').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),storage);
  }else if(mode==='missing'){
   await until(()=>page.locator('[data-practice-result-state]').evaluate(node=>!node.hidden&&node.textContent.includes('Chưa có kênh cập nhật')));assert.equal(await page.locator('.result-summary').count(),1);
  }else{
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(f.requests.some(row=>row.path.startsWith('/api/student-progress/')),false);assert.equal(await page.locator('[data-practice-result-state]').evaluate(node=>node.hidden),true);
  }
  assert.deepEqual((await f.pool.query(`SELECT state,updated_at FROM ${product}_practice.work`)).rows,before);assert.equal(f.requests.some(row=>/^\/api\/(pulse|pause|submit|begin|reset)$/.test(row.path)),false);assert.deepEqual(errors,[]);records.push({product,mode,outcome:'passed',workUnchanged:true});
 }catch(error){await page.screenshot({path:path.join(out,product+'-'+mode+'-failed.png')});throw error;}
});
