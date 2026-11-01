// Public Listening UI + real native app/store/hub. AI, Google and audio network stay isolated.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createListeningObservationApp,lessons} from './fixtures/listening-observation-app.mjs';
import {WORKER_ORIGIN} from '../shared/audio/config.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.LISTENING_STATE_EVIDENCE;
if(!out||!path.isAbsolute(out))throw Error('PRIVATE_BROWSER_EVIDENCE_DIR_REQUIRED');await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const names=process.env.LISTENING_STATE_LESSONS?.split(',')||lessons.map(([name])=>name),widths=process.env.LISTENING_STATE_WIDTH?[Number(process.env.LISTENING_STATE_WIDTH)]:[1440,390],roles=process.env.LISTENING_STATE_ROLE?[process.env.LISTENING_STATE_ROLE]:['student','teacher'];
assert.ok(names.every(name=>lessons.some(row=>row[0]===name)));assert.ok(widths.every(w=>[1440,390].includes(w)));assert.ok(roles.every(r=>['student','teacher'].includes(r)));
const records=[];let browser;
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({names,widths,roles,records},null,2));});
async function until(check,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('LISTENING_NATIVE_BROWSER_TIMEOUT');}
const reads=f=>f.requests.filter(r=>r.path.includes('/attempts/')&&r.method==='GET'&&r.status===200&&r.completed).length;

for(const name of names)for(const width of widths)for(const role of roles)test(`Listening state/audio/save/rights · ${name} · ${width}px · ${role}`,{timeout:70000},async t=>{
 const f=await createListeningObservationApp({root,name}),context=await browser.newContext({viewport:{width,height:900},locale:'vi-VN'});t.after(async()=>{await context.close();await f.close();});
 const errors=[],external=[],audioRequests=[];let audioBytes;
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin===f.origin)return route.continue();
  if(url.origin===WORKER_ORIGIN){audioRequests.push('worker');return route.fulfill({status:503,json:{error:'SYNTHETIC_PRIMARY_OFFLINE'}});}
  if(url.href===f.asset.url){audioRequests.push('pages');audioBytes??=await fs.readFile(path.join(root,'listening-homework/audio-assets',url.pathname.split('/').at(-1)));const range=/^bytes=(\d+)-(\d+)$/.exec(request.headers().range||''),start=range?Number(range[1]):0,end=range?Math.min(Number(range[2]),audioBytes.length-1):audioBytes.length-1;return route.fulfill({status:206,headers:{'content-type':'audio/mpeg','content-range':`bytes ${start}-${end}/${audioBytes.length}`},body:audioBytes.subarray(start,end+1)});}
  if(url.pathname.includes('teacher-session-api')||url.pathname.includes('shared-session'))return route.fulfill({status:401,json:{error:'TEACHER_LOGIN_REQUIRED'}});
  external.push({origin:url.origin,path:url.pathname});return route.abort();
 });
 if(role==='teacher')await context.addCookies([await f.teacherCookie()]);
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(f.origin+'/listening-homework/'+name+'.html?'+(role==='teacher'?'teacher=1&classId=1293&studentRef='+f.scope.ownerId:'fresh=1'));
 if(role==='student'){await page.locator('#class').selectOption('1293');await page.locator('#student').selectOption(f.scope.ownerId);await page.locator('#entry-submit').click();}
 await page.locator('[data-review="'+f.data.items[0].id+'"]').waitFor();await until(()=>f.hub.snapshot().connections===1&&reads(f)>=2).catch(error=>{throw Error('STREAM_BOOTSTRAP_REQUIRED '+JSON.stringify({connections:f.hub.snapshot().connections,attemptReads:reads(f),errors}),{cause:error});});await page.evaluate(()=>document.fonts.ready);
 if(role==='student')await page.waitForFunction(()=>document.querySelector('#docs-status').textContent==='Đã cập nhật trạng thái về Homework Docs.');
 const baseline=await page.evaluate(()=>{
  const source=document.querySelector('.dictation-line p,.cbt-question-heading p,.cue p'),input=document.querySelector('#exercise-content input,#exercise-content textarea'),focus=document.querySelector('#history-button');source.scrollIntoView({block:'center',behavior:'instant'});focus.focus({preventScroll:true});
  const walk=document.createTreeWalker(source,NodeFilter.SHOW_TEXT);let node;while((node=walk.nextNode()))if(node.textContent.trim().length>12)break;if(!node)throw Error('NATIVE_SOURCE_TEXT_REQUIRED');const range=document.createRange();range.setStart(node,0);range.setEnd(node,Math.min(20,node.textContent.length));getSelection().removeAllRanges();getSelection().addRange(range);window.__listeningProof={source,input,focus};return {selection:getSelection().toString(),y:source.getBoundingClientRect().y,exercise:document.querySelector('#exercise').scrollTop};
 });
 const before=reads(f),scans=f.hub.snapshot().scans;await until(()=>f.hub.snapshot().scans>=scans+3);
 const stable=await page.evaluate(()=>({source:__listeningProof.source.isConnected,input:__listeningProof.input===document.querySelector('#exercise-content input,#exercise-content textarea'),focus:document.activeElement===__listeningProof.focus,selection:getSelection().toString(),y:__listeningProof.source.getBoundingClientRect().y,exercise:document.querySelector('#exercise').scrollTop}));
 assert.equal(stable.source,true);assert.equal(stable.input,true);assert.equal(stable.focus,true);assert.equal(stable.selection,baseline.selection);assert.ok(Math.abs(stable.y-baseline.y)<2);assert.equal(stable.exercise,baseline.exercise);assert.equal(reads(f),before);
 const id=f.data.items[0].id;await page.locator('[data-review="'+id+'"]').click();await page.locator('#explanation-dialog').waitFor({state:'visible'});
 await page.locator('#replay-review').click();await page.waitForFunction(()=>!document.querySelector('#audio').paused,{timeout:20000});
 const reviewBefore=await page.evaluate(()=>{const source=document.querySelector('.explanation-dialog-passage-scroll p'),focus=document.activeElement,range=document.createRange();range.setStart(source.firstChild,0);range.setEnd(source.firstChild,Math.min(20,source.firstChild.textContent.length));getSelection().removeAllRanges();getSelection().addRange(range);window.__reviewProof={source,focus};return {selection:getSelection().toString(),scroll:source.parentElement.scrollTop};});
 const audioBefore=await page.evaluate(()=>({src:document.querySelector('#audio').src,time:document.querySelector('#audio').currentTime})),audioReads=audioRequests.length;
 const reason='Native updated feedback in the same immutable attempt.';await f.updateFeedback(id,reason);await page.waitForFunction(text=>document.querySelector('#review-content').textContent.includes(text),reason);
 const audioAfter=await page.evaluate(()=>({src:document.querySelector('#audio').src,time:document.querySelector('#audio').currentTime}));assert.equal(audioAfter.src,audioBefore.src);assert.ok(audioAfter.time>=audioBefore.time);assert.equal(audioRequests.length,audioReads);
 const reviewAfter=await page.evaluate(()=>({source:__reviewProof.source.isConnected,focus:document.activeElement===__reviewProof.focus,selection:getSelection().toString(),scroll:__reviewProof.source.parentElement.scrollTop}));assert.equal(reviewAfter.source,true);assert.equal(reviewAfter.focus,true);assert.equal(reviewAfter.selection,reviewBefore.selection);assert.equal(reviewAfter.scroll,reviewBefore.scroll);
 if(name==='scandinavian-studies'&&width===1440){
  f.controls.failReads=2;await f.updateFeedback(id,reason+' Recovered without another server revision.');await page.waitForFunction(()=>document.querySelector('#review-content').textContent.includes('Recovered without another'),null,{timeout:15000});
  f.controls.offline=true;f.disconnect();await f.updateFeedback(id,reason+' Polling fallback result.');await page.waitForFunction(()=>document.querySelector('#review-content').textContent.includes('Polling fallback result.'));f.controls.offline=false;await until(()=>f.hub.snapshot().connections===1);
 }
 await page.keyboard.press('Escape');
 if(role==='student'){
  const input=page.locator('#exercise-content input:not([type=radio]):visible,#exercise-content textarea:visible').first(),beforeSave=(await f.store.draft(f.scope)).revision,text='Draft preserved after a lost acknowledgment '+name;
  f.controls.dropSaveReply=true;await input.fill(text);await until(async()=> (await f.store.draft(f.scope)).revision===beforeSave+1);await until(async()=>await page.locator('#save-retry').isVisible()||(await page.locator('#save-status').getAttribute('aria-label'))==='Đã lưu nháp trên hệ thống.');if(await page.locator('#save-retry').isVisible())await page.locator('#save-retry').click();await page.waitForFunction(()=>document.querySelector('#save-status').getAttribute('aria-label')==='Đã lưu nháp trên hệ thống.');assert.equal(await page.locator('#save-status').textContent(),'Đã lưu nháp');
  // Chromium may itself retry an idempotent PUT after the first connection drops.
  const writes=f.requests.filter(r=>r.method==='PUT'&&r.path==='/draft');assert.equal(writes.length,2);assert.ok(writes.every(r=>r.compact));assert.equal(new Set(writes.map(r=>r.mutationId)).size,1);assert.ok(writes.some(r=>!r.completed));assert.equal((await f.store.draft(f.scope)).revision,beforeSave+1);assert.equal(await input.inputValue(),text);assert.deepEqual((await f.store.attempt(f.scope,f.initial.attemptId)).snapshot,f.initialBody);
  await f.db.query('DELETE FROM reading_listening67.web_student_session WHERE owner_id=$1',[f.scope.ownerId]);
 }else{
  if(name==='scandinavian-studies'&&width===1440){let release;const wait=new Promise(resolve=>release=resolve);f.controls.holdAttempt={id:f.initial.attemptId,wait};try{await f.updateFeedback(id,'Late A feedback must not overwrite selected B.');await until(()=>f.controls.holding>0);await page.locator('#teacher-student').selectOption(f.otherId);await page.waitForFunction(()=>document.querySelector('#person').textContent.includes('Synthetic 1'));release();await page.waitForTimeout(200);assert.equal(await page.locator('#sample-feedback').isDisabled(),true);assert.equal(await page.locator('#exercise-content input,#exercise-content textarea').evaluateAll(nodes=>nodes.every(n=>n.type==='radio'?!n.checked:!n.value)),true);}finally{release();f.controls.holdAttempt=null;}}
  await f.db.query('DELETE FROM reading_listening67.web_teacher_session');
 }
 await page.waitForFunction(()=>document.querySelector('#global-error').hidden===false&&document.querySelector('#play').disabled);
 assert.ok(await page.locator('#exercise-content input,#exercise-content textarea').evaluateAll(nodes=>nodes.every(n=>n.type==='radio'?n.disabled:n.readOnly)));assert.equal(await page.locator('#new-run').isDisabled(),true);assert.equal(await page.locator('#submit').isDisabled(),true);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await page.screenshot({path:path.join(out,`${name}-${width}-${role}.png`)});records.push({name,width,role,unchanged:stable,scans:3,audioBefore,audioAfter,readsBefore:before,readsAfterStable:before,outcome:'passed'});
});
