// Real 40-minute exam, isolated fake identities. No clock acceleration.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const {Client}=createRequire(path.join(process.env.RETAKE_BACKEND_ROOT,'package.json'))('pg');
const config=JSON.parse(fs.readFileSync(process.env.RETAKE_TEST_CONFIG,'utf8'));assert.match(new URL(config.databaseUrl).pathname,/_fixture$/);
const output=process.env.RETAKE_EVIDENCE;fs.mkdirSync(output,{recursive:true});const client=new Client({connectionString:config.databaseUrl});await client.connect();
for(const s of config.students.slice(1,3)){const g=(await client.query('SELECT max(generation) g FROM reading_retake.attempt WHERE student_ref=$1',[s.studentRef])).rows[0].g;await client.query('INSERT INTO reading_retake.attempt(id,student_ref,student_internal_id,class_code,generation,permit_operation_id) VALUES($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),s.studentRef,s.studentInternalId,config.classCode,(g??-1)+1,crypto.randomUUID()]);}await client.end();
const browser=await chromium.launch({channel:'msedge',headless:true}),cases=[],startedAt=new Date().toISOString();
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('izone-reading-retake:v1:current')));
try{
 for(const offline of [false,true]){const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:18856/izone-ai-team-pages/term-tests/ic2311-reading-retake-substitute1-k56/');await page.locator('#student option').nth(1).waitFor({state:'attached'});await page.selectOption('#student',{index:offline?3:2});await page.click('#prepare');await page.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:45000});if(offline)await context.setOffline(true);await page.click('#start');await page.locator('#readingView').waitFor({state:'visible'});await page.locator('[data-question="1"]').fill('answer 1');cases.push({context,page,offline,errors,startedMono:performance.now(),attemptId:(await state(page)).identity.attemptId});}
 const report={startedAt,status:'running',samples:[]};
 for(let minute=0;minute<41;minute++){
  for(const c of cases){const s=await state(c.page);assert.equal(s.answers['1'],'answer 1');assert.equal(s.identity.attemptId,c.attemptId);report.samples.push({minute,offline:c.offline,phase:s.phase,elapsedMs:s.elapsedMs,pending:!!s.pending});if(minute<39)assert.equal(s.phase,'playing');}
  fs.writeFileSync(path.join(output,'full-round.json'),JSON.stringify(report,null,2));if(minute===40)break;
  if(minute===2){const c=cases[1],before=(await state(c.page)).elapsedMs;await c.page.reload();await c.page.locator('#readingView').waitFor({state:'visible'});assert.ok((await state(c.page)).elapsedMs>=before);}
  if(minute===4){const c=cases[1];await c.page.locator('[data-question="2"]').fill('answer 2');}
  await wait(60000);
 }
 for(const c of cases){await c.page.locator('#finished').waitFor({state:'visible',timeout:15000});let s=await state(c.page);assert.equal(s.phase,'submitted');assert.equal(s.sealed.submitReason,'deadline');assert.equal(s.sealed.elapsedMs,2400000);assert.ok(performance.now()-c.startedMono>=2398000);assert.deepEqual(c.errors,[]);if(c.offline){assert.equal(s.serverConfirmed,false);assert.ok(s.pending);await c.context.setOffline(false);await c.page.reload();}await c.page.waitForFunction(()=>document.getElementById('finish-title').textContent==='Đã nộp thành công',null,{timeout:45000});s=await state(c.page);assert.equal(s.serverConfirmed,true);assert.equal(s.rawScore,c.offline?2:1);}
 report.status='passed';report.finishedAt=new Date().toISOString();report.onlineOfflineActual40Minutes=true;fs.writeFileSync(path.join(output,'full-round.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,cases:2,realDuration:true,offlineReload:true,receiptReadback:true}));
}finally{await browser.close();}
