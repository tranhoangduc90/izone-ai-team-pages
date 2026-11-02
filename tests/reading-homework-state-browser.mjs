// Browser + router/store/identity/SSE thật, dữ liệu bài làm giả trên PGlite local.
// Chạy đủ ma trận nếu không chọn subset; ghi rõ subset trong biên nhận, không suy rộng.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createHomeworkObservationApp,lessons} from './fixtures/homework-observation-app.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.env.HOMEWORK_STATE_EVIDENCE;
if(!out||!path.isAbsolute(out))throw Error('PRIVATE_BROWSER_EVIDENCE_DIR_REQUIRED');await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const selected=process.env.HOMEWORK_STATE_LESSONS?.split(',')||lessons.map(([name])=>name),widths=process.env.HOMEWORK_STATE_WIDTH?[Number(process.env.HOMEWORK_STATE_WIDTH)]:[1440,390],roles=process.env.HOMEWORK_STATE_ROLE?[process.env.HOMEWORK_STATE_ROLE]:['student','teacher'];
assert.ok(selected.length&&selected.every(name=>lessons.some(([known])=>known===name)));assert.ok(widths.every(w=>[1440,390].includes(w)));assert.ok(roles.every(r=>['student','teacher'].includes(r)));
const records=[];let browser;
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({selected,widths,roles,expected:selected.length*widths.length*roles.length,records},null,2));});
async function until(check,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('BROWSER_FIXTURE_TIMEOUT');}
function attemptReads(f){return f.requests.filter(r=>r.path.includes('/attempts/')&&r.method==='GET'&&r.status===200&&r.completed).length;}

for(const name of selected)for(const width of widths)for(const role of roles)test(`State/reading/save/rights · ${name} · ${width}px · ${role}`,{timeout:70000},async t=>{
 const f=await createHomeworkObservationApp({root,fixtureName:name});let context;
 t.after(async()=>{await context?.close();await f.close();});
 context=await browser.newContext({viewport:{width,height:900},locale:'vi-VN'});const page=await context.newPage(),errors=[],external=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===f.origin)return route.continue();if(u.pathname.includes('teacher-session-api')||u.pathname.includes('shared-session'))return route.fulfill({json:{error:'TEACHER_LOGIN_REQUIRED'},status:401});external.push({origin:u.origin,path:u.pathname,method:route.request().method()});return route.abort();});
 if(role==='teacher')await context.addCookies([await f.teacherCookie()]);
 const entry=lessons.find(([known])=>known===name)[1],url=f.origin+'/reading-skills67/'+entry+'/?server=1&attemptId='+f.initial.attemptId+(role==='teacher'?'&teacher=1&classId=1124&studentRef='+f.scope.ownerId:'');
 await page.goto(url);
 if(role==='student'){await page.locator('#entry-class').selectOption('1124');await page.locator('#entry-student').selectOption(f.scope.ownerId);await page.getByRole('button',{name:'Vào bài',exact:true}).click();}
 await page.locator('.result-note').waitFor();await until(()=>attemptReads(f)>=2);if(role==='student')await page.waitForFunction(()=>window.ReadingServerClient.state.homework?.status==='verified');await page.evaluate(()=>document.fonts.ready);
 const baseline=await page.evaluate(()=>{
  const passages=[...document.querySelectorAll('.passage-text')],source=passages[Math.min(2,passages.length-1)];source.scrollIntoView({block:'center',behavior:'instant'});
  const focus=document.querySelector('.history-button');focus.focus({preventScroll:true});const walk=document.createTreeWalker(source,NodeFilter.SHOW_TEXT);let text;while((text=walk.nextNode()))if(text.textContent.trim().length>20)break;
  const range=document.createRange();range.setStart(text,0);range.setEnd(text,Math.min(24,text.textContent.length));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  window.__readingProof={source,focus,input:document.querySelector('[data-target]')};return {selected:selection.toString(),y:source.getBoundingClientRect().y,scroll:document.querySelector('#scroll-passage').scrollTop};
 });
 await page.waitForTimeout(80);const scans=f.hub.snapshot().scans,reads=attemptReads(f);await until(()=>f.hub.snapshot().scans>=scans+3);
 const unchanged=await page.evaluate(()=>({source:__readingProof.source.isConnected,focus:document.activeElement===__readingProof.focus,input:__readingProof.input===document.querySelector('[data-target]'),selected:getSelection().toString(),y:__readingProof.source.getBoundingClientRect().y,scroll:document.querySelector('#scroll-passage').scrollTop}));
 await fs.writeFile(path.join(out,`${name}-${width}-${role}-reading.json`),JSON.stringify({baseline,unchanged,attemptReadsBefore:reads,attemptReadsAfter:attemptReads(f)},null,2));
 assert.equal(unchanged.source,true);assert.equal(unchanged.focus,true);assert.equal(unchanged.input,true);assert.equal(unchanged.selected,baseline.selected);assert.ok(Math.abs(unchanged.y-baseline.y)<2,JSON.stringify({baseline,unchanged}));assert.equal(unchanged.scroll,baseline.scroll);assert.equal(attemptReads(f),reads);
 const changedId=f.content.targets[0].id,newReason='Góp ý mới trong cùng lượt chấm · giữ nguyên vùng đang đọc.';
 await f.updateFeedback(changedId,newReason);await page.waitForFunction(({id,text})=>[...document.querySelectorAll('[data-feedback]')].find(n=>n.dataset.feedback===id)?.textContent.includes(text),{id:changedId,text:newReason});
 assert.equal(await page.evaluate(()=>__readingProof.source.isConnected&&document.activeElement===__readingProof.focus),true);
 await page.screenshot({path:path.join(out,`${name}-${width}-${role}.png`),fullPage:false});
 // Mất một lượt đọc kết quả: phải tự thử lại dù revision phía server không đổi tiếp.
 if(name==='materials'){f.controls.failReads=2;await f.updateFeedback(changedId,newReason+' Đã tự đọc lại sau lỗi mạng.');await page.waitForFunction(id=>[...document.querySelectorAll('[data-feedback]')].find(n=>n.dataset.feedback===id)?.textContent.includes('Đã tự đọc lại sau lỗi mạng.'),changedId,{timeout:12000});}
 const before=f.initial.attemptId,oldSnapshot=structuredClone(f.initialBody);let selectedId=before;
 if(name==='materials'&&width===1440){
  const nextBody=structuredClone(f.initialBody);nextBody.answers[changedId]='Nội dung riêng của lượt xem mới B.';
  await f.store.save(f.scope,{baseRevision:1,mutationId:randomUUID(),body:nextBody});const second=await f.store.submit(f.scope,{revision:2,requestId:randomUUID()});await f.completePending(false);
  let release;const wait=new Promise(resolve=>release=resolve);f.controls.holdAttempt={id:before,wait};
  try{
   await f.updateFeedback(changedId,'Phản hồi A đang chờ, không được phủ lượt B.');await until(()=>f.controls.holding>0);
   await page.locator('.history-button').click();await page.locator('[data-server-attempt="'+second.attemptId+'"]').click();await page.waitForFunction(id=>window.ReadingInteractionBridge.current().serverAttempt?.attemptId===id,second.attemptId);
   selectedId=second.attemptId;release();await page.waitForTimeout(150);
   assert.equal(await page.evaluate(()=>window.ReadingInteractionBridge.current().serverAttempt.attemptId),selectedId);
   assert.equal(await page.locator('[data-target="'+changedId+'"]').inputValue(),nextBody.answers[changedId]);
  }finally{release();f.controls.holdAttempt=null;}
  f.controls.offline=true;f.disconnect();await f.updateFeedback(changedId,'Đã nhận góp ý qua đường polling dự phòng.',false,selectedId);
  await page.waitForFunction(({id,text})=>[...document.querySelectorAll('[data-feedback]')].find(n=>n.dataset.feedback===id)?.textContent.includes(text),{id:changedId,text:'polling dự phòng'});
  f.controls.offline=false;await until(()=>f.hub.snapshot().connections===1);
 }
 if(role==='student'){
  await page.locator('footer [data-action="edit"]').click();await page.locator('.repair-current[aria-current="step"]').waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  if(width===390&&['materials','green-roofs','sentence_completion'].includes(f.content.type||'materials'))await page.locator('[data-pane="passage"]').click();
  const editable=page.locator('textarea[data-target]:visible').first();await editable.waitFor();assert.equal(await editable.getAttribute('readonly'),null);
  const id=await editable.getAttribute('data-target'),text='Bản đang sửa cần được lưu đúng một lần, giữ nguyên khi phản hồi cũ đến.',draftBefore=(await f.store.draft(f.scope)).revision,historyBefore=(await f.store.history(f.scope)).length;f.controls.dropSaveReply=true;
  await editable.fill(text);await until(async()=> (await f.store.draft(f.scope)).body.answers[id]===text);await page.waitForFunction(()=>window.ReadingServerClient.state.status==='saved');
  const writes=f.requests.filter(r=>r.path==='/draft'&&r.method==='PUT');assert.equal(writes.length,2);assert.ok(writes.every(r=>r.compact));assert.equal((await f.store.draft(f.scope)).revision,draftBefore+1);
  await editable.evaluate(node=>window.__draftNode=node);const editedReads=attemptReads(f);await f.updateFeedback(changedId,'Góp ý khác đến khi đang sửa nháp.',false,selectedId);await until(()=>attemptReads(f)>editedReads);await page.waitForTimeout(100);
  assert.equal(await editable.inputValue(),text);assert.equal(await editable.evaluate(node=>node===window.__draftNode),true);assert.deepEqual((await f.store.attempt(f.scope,before)).snapshot,oldSnapshot);assert.equal((await f.store.history(f.scope)).length,historyBefore);
  // Thu hồi phiên phải khóa màn, giữ nguyên nháp đã lưu và chặn mọi ghi mới.
  await f.db.query('DELETE FROM reading_listening67.web_student_session WHERE owner_id=$1',[f.scope.ownerId]);
 }else {
  // Kết quả cùng lượt đổi từ còn phải sửa sang đạt: cập nhật số đếm, giữ node đọc.
  await page.evaluate(()=>window.__progressSource=document.querySelector('.passage-text'));
  await f.updateFeedback(changedId,'Tất cả mục đã đạt sau đối soát.',true,selectedId);
  await page.waitForFunction(()=>window.ReadingInteractionBridge.current().serverAttempt?.progress?.allCorrect===true);
  assert.equal(await page.evaluate(()=>window.__progressSource.isConnected),true);
  await f.db.query('DELETE FROM reading_listening67.web_teacher_session');
 }
 await page.getByRole('heading',{name:'Cần kiểm tra lại quyền truy cập',exact:true}).waitFor();assert.equal(await page.locator('[data-target]').count(),0);
 assert.equal(f.requests.filter(r=>['PUT','POST'].includes(r.method)&&['/submit','/reset','/draft'].includes(r.path)).length,role==='teacher'?0:2);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 records.push({name,width,role,scans:3,unchanged,compactSave:role==='student',nativeRevision:(await f.store.draft(f.scope)).revision,outcome:'passed'});
});
