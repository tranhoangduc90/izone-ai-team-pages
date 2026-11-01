import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createPracticeCompactApp} from './fixtures/practice-compact-app.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.PRACTICE_HISTORY_EVIDENCE;
if(!out||!path.isAbsolute(out))throw Error('PRIVATE_HISTORY_EVIDENCE_REQUIRED');await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const until=async fn=>{const end=Date.now()+15000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('HISTORY_BROWSER_TIMEOUT');};
const records=[];let browser;test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(records,null,2));});
for(const product of ['reading','listening'])test(`${product}: learner loads old results on demand and teacher loads the selected reset history`,{timeout:60000},async t=>{
 const f=await createPracticeCompactApp({root,product,stateStreamEnabled:true,teacherIdentity:{email:'teacher@example.test',sub:'google-fixture',email_verified:true}});
 const width=product==='reading'?1440:390,context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);
 let teacherContext;t.after(async()=>{await context.close();await teacherContext?.close();await f.close();});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 const work=()=>f.pool.query(`SELECT state,updated_at FROM ${product}_practice.work`),jobs=()=>f.pool.query(`SELECT * FROM ${product}_practice.doc_job ORDER BY id`),ids=[];
 try{
  let started=await f.service.begin({token:f.token,owner:'seed',operationId:randomUUID()});
  for(let n=1;n<=4;n++){
   const id=started.attempts.at(-1).id;ids.push(id);await f.service.activate({token:f.token,attemptId:id,lease:started.lease});
   const snapshot=f.draft();snapshot.sequence=1;snapshot.notes=`Private synthetic notes of attempt ${n}.`;snapshot.answers[Object.keys(f.content.key)[0]]='A';
   if(n!==2)await f.service.submit({token:f.token,operationId:randomUUID(),attemptId:id,lease:started.lease,snapshot,method:'manual'});
   if(n<4)started=await f.service.reset({token:f.token,operationId:randomUUID(),attemptId:id,owner:'seed',...(n===2?{lease:started.lease,snapshot}:{})});
  }
  const before=(await work()).rows,beforeJobs=(await jobs()).rows;
  await page.goto(f.url);await page.locator('#login-submit').waitFor();
  for(const [selector,value] of [['#class-select','FIXTURE 67'],['#student-select',f.studentRef]]){const field=page.locator(selector);if(await field.isEnabled())await field.selectOption(value);else assert.equal(await field.inputValue(),value);}
  await page.locator('#login-submit').click();await page.waitForURL(/#prep$/);
  const login=f.requests.find(row=>row.path==='/api/login'&&row.completed);assert.equal(login.body.historyMode,'on-demand-v1');assert.equal(login.body.attempts[0].notes,undefined);assert.equal(login.body.attempts[0].answeredCount,1);assert.ok(login.body.attempts.at(-1).notes.includes('attempt 4'));
  await page.evaluate(()=>location.hash='result?attempt=1');await page.locator('.result-summary').waitFor();await page.locator('.history [data-attempt="1"].selected').waitFor();
  const reads=id=>f.requests.filter(row=>row.path==='/api/result/'+id&&row.completed).length;assert.equal(reads(ids[0]),1);assert.equal(reads(ids[2]),0);
  await page.locator('.history [data-attempt="2"]').click();await page.locator('.history [data-attempt="2"].selected').waitFor();assert.equal(reads(ids[1]),0);assert.match(await page.locator('#app').textContent(),/1\/\d+ câu đã trả lời/);
  await page.locator('.history [data-attempt="3"]').click();await page.locator('.history [data-attempt="3"].selected').waitFor();assert.equal(reads(ids[2]),1);
  await page.locator('.history [data-attempt="1"]').click();await page.locator('.history [data-attempt="1"].selected').waitFor();assert.equal(reads(ids[0]),1);
  await page.reload();await page.waitForURL(/#prep$/);await page.evaluate(()=>location.hash='result?attempt=1');await page.locator('.result-summary').waitFor();await until(()=>reads(ids[0])===2);assert.deepEqual((await work()).rows,before);assert.deepEqual((await jobs()).rows,beforeJobs);
  await page.screenshot({path:path.join(out,product+'-learner-history.png')});
  teacherContext=await browser.newContext({viewport:{width,height:900}});await teacherContext.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
  const signed=await teacherContext.request.post(f.origin+'/api/teacher/login',{data:{credential:'synthetic-google-credential'}});assert.equal(signed.status(),200);const teacher=await teacherContext.newPage();teacher.on('pageerror',e=>errors.push(e.message));
  await teacher.goto(`${f.origin}/${product}-practice/teacher-progress.html?code=${f.content.code}&classId=1124#unit=${f.registered.bindingId}`);await until(async()=> (await teacher.locator('.teacher-notes').textContent()).includes('attempt 4'));
  await teacher.locator('#attempt-select').selectOption(ids[1]);await until(async()=> (await teacher.locator('.teacher-notes').textContent()).includes('attempt 2'));assert.equal(await teacher.locator('#attempt-select').inputValue(),ids[1]);
  const selected=f.requests.filter(row=>row.path==='/api/teacher/progress/units/'+f.registered.bindingId&&row.body?.attempts?.some(attempt=>attempt.id===ids[1]&&attempt.detailsLoaded)).at(-1);
  assert.equal(selected.body.historyMode,'on-demand-v1');assert.equal(selected.body.attempts[0].notes,undefined);assert.equal(selected.body.attempts[1].notes,'Private synthetic notes of attempt 2.');
  assert.deepEqual((await work()).rows,before);assert.deepEqual((await jobs()).rows,beforeJobs);assert.deepEqual(errors,[]);
  await teacher.screenshot({path:path.join(out,product+'-teacher-old-draft.png')});records.push({product,width,outcome:'passed',attempts:4,initialHistoryDeferred:true,oldResultOnDemand:true,cachedResultReused:true,resetCountPreserved:true,teacherOldDraft:true,workAndJobsUnchanged:true});
 }catch(error){await page.screenshot({path:path.join(out,product+'-failed.png')});await fs.writeFile(path.join(out,product+'-failure.private.json'),JSON.stringify({errors,url:page.url(),requests:f.requests},null,2));throw error;}
});
