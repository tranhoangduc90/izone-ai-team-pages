import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createPracticeCompactApp} from './fixtures/practice-compact-app.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.PRACTICE_TEACHER_EVIDENCE;
if(!out||!path.isAbsolute(out))throw Error('PRIVATE_TEACHER_EVIDENCE_REQUIRED');await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const products=process.env.PRACTICE_COMPACT_PRODUCT?[process.env.PRACTICE_COMPACT_PRODUCT]:['reading','listening'],quick=process.env.PRACTICE_TEACHER_QUICK==='true',storage=process.env.PRACTICE_TEACHER_STORAGE==='true',records=[];let browser;
const until=async(check,timeout=15000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,50));}throw Error('TEACHER_NATIVE_BROWSER_TIMEOUT');};
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(records,null,2));});
for(const product of products)test(`${product}: native teacher stream preserves reading state, receives changes, and revokes access`,{timeout:185000},async t=>{
 const teacherSource=process.env.PRACTICE_TEACHER_BASE?execFileSync('git',['show',process.env.PRACTICE_TEACHER_BASE+':shared/teacher-progress.js'],{cwd:root,encoding:'utf8'}):undefined;
 const f=await createPracticeCompactApp({root,product,stateStreamEnabled:true,teacherIdentity:{email:'teacher@example.test',sub:'google-fixture',email_verified:true},teacherSource});
 const width=product==='reading'?1440:390,context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();page.setDefaultTimeout(10000);
 t.after(async()=>{await context.close();await f.close();});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 const work=()=>f.pool.query(`SELECT state,updated_at FROM ${product}_practice.work`),jobs=()=>f.pool.query(`SELECT * FROM ${product}_practice.doc_job ORDER BY id`);
 try{
  const begun=await f.service.begin({token:f.token,owner:'synthetic-student',operationId:randomUUID()}),attempt=begun.attempts.at(-1);await f.service.activate({token:f.token,attemptId:attempt.id,lease:begun.lease});
  const snapshot=f.draft();snapshot.sequence=1;snapshot.notes='Synthetic teacher reading evidence. '.repeat(35);await f.service.pulse({token:f.token,attemptId:attempt.id,lease:begun.lease,snapshot});
  const beforeWork=(await work()).rows,beforeJobs=(await jobs()).rows;
  const login=await context.request.post(f.origin+'/api/teacher/login',{data:{credential:'synthetic-google-credential',remember:true}});assert.equal(login.status(),200);
  await page.goto(`${f.origin}/${product}-practice/teacher-progress.html?code=${f.content.code}&classId=1124#unit=${f.registered.bindingId}`);
  await page.locator('.teacher-notes').waitFor();
  if(!teacherSource){
   await until(()=>f.requests.filter(row=>row.path==='/api/teacher/progress/units/'+f.registered.bindingId&&row.completed).length>=2);
   await until(()=>page.locator('#notice').evaluate(node=>node.dataset.kind===''&&node.textContent==='Đã đọc bản lưu mới; chỉ xem bài học viên.'));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  await page.locator('.teacher-notes').scrollIntoViewIfNeeded();
  const readState=()=>page.evaluate(()=>({same:window.__teacherNotes===document.querySelector('.teacher-notes'),focus:document.activeElement===window.__teacherFocus,selection:getSelection().toString(),scroll:scrollY,notesTop:document.querySelector('.teacher-notes')?.getBoundingClientRect().top,noticeHeight:document.querySelector('#notice')?.getBoundingClientRect().height}));
  const baseline=await page.evaluate(()=>{const notes=document.querySelector('.teacher-notes'),input=document.querySelector('#attempt-select');window.__teacherNotes=notes;window.__teacherFocus=input;input.focus({preventScroll:true});const range=document.createRange();range.setStart(notes.firstChild,2);range.setEnd(notes.firstChild,18);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);return{selection:selection.toString(),scroll:scrollY};});
  const detailCount=f.requests.filter(row=>row.path==='/api/teacher/progress/units/'+f.registered.bindingId).length,listCount=f.requests.filter(row=>row.path==='/api/teacher/progress/students').length,scanCount=f.observationHub.snapshot().scans,observedAt=performance.now();
  if(!quick){await until(()=>performance.now()-observedAt>=90000&&f.observationHub.snapshot().scans>=scanCount+3,100000);const steady=await readState();assert.equal(steady.same,true);assert.equal(steady.focus,true);assert.equal(steady.selection,baseline.selection);assert.equal(steady.scroll,baseline.scroll);assert.equal(f.requests.filter(row=>row.path==='/api/teacher/progress/units/'+f.registered.bindingId).length,detailCount);assert.equal(f.requests.filter(row=>row.path==='/api/teacher/progress/students').length,listCount);}
  // Force the native detail route too: unchanged content must preserve the same readable nodes.
  await page.locator('#refresh-detail').evaluate(button=>button.click());await until(()=>f.requests.filter(row=>row.path==='/api/teacher/progress/units/'+f.registered.bindingId&&row.completed).length>detailCount);
  await until(async()=> (await readState()).same===false||f.requests.filter(row=>row.path==='/api/teacher/progress/units/'+f.registered.bindingId&&row.completed).length>=detailCount+2||Boolean(teacherSource));
  const manual=await readState();assert.equal(manual.same,true);assert.equal(manual.focus,true);assert.equal(manual.selection,baseline.selection);assert.equal(manual.scroll,baseline.scroll);
  assert.deepEqual((await work()).rows,beforeWork);assert.deepEqual((await jobs()).rows,beforeJobs);
  if(!teacherSource){
   const recoveryDetailCount=f.requests.filter(row=>row.path==='/api/teacher/progress/units/'+f.registered.bindingId).length;
   await f.pool.query(`UPDATE ${product}_practice.work SET state=jsonb_set(state,'{attempts,0,draft,answers}','[]'::jsonb)`);f.observationHub.wake();
   await until(()=>page.locator('#notice').evaluate(node=>node.dataset.kind==='error'&&node.textContent.includes('Chưa đọc được trạng thái mới')));
   assert.equal((await readState()).same,true);
   await f.pool.query(`UPDATE ${product}_practice.work SET state=$1::jsonb`,[JSON.stringify(beforeWork[0].state)]);f.observationHub.wake();
   await until(()=>page.locator('#notice').evaluate(node=>node.dataset.kind===''&&node.textContent.includes('Đã kiểm tra bản lưu')));
   assert.equal(f.requests.filter(row=>row.path==='/api/teacher/progress/units/'+f.registered.bindingId).length,recoveryDetailCount);
   const recovered=await readState();assert.equal(recovered.same,true);assert.equal(recovered.focus,true);assert.equal(recovered.selection,baseline.selection);assert.equal(recovered.scroll,baseline.scroll);
   await page.screenshot({path:path.join(out,product+'-stable-recovered.png')});
  }
  if(!quick){
   const resumed=await f.service.resume({token:f.token,owner:'synthetic-student',operationId:randomUUID(),attemptId:attempt.id});await f.service.activate({token:f.token,attemptId:attempt.id,lease:resumed.lease});
   const changed=f.draft();changed.sequence=100;changed.notes='New synthetic learner notes observed without a full-page refresh.';
   await f.service.pulse({token:f.token,attemptId:attempt.id,lease:resumed.lease,snapshot:changed});await until(async()=>await page.locator('.teacher-notes').textContent()===changed.notes,35000);
  }
  if(quick&&!storage){f.setTeacher(false);f.observationHub.wake();}
  else{
   // Replace only the browser cookie. The original account/session remains valid in SQL.
   // Even without a storage event, a different account must not keep its predecessor's view.
   const otherToken=randomBytes(32).toString('base64url');await f.pool.query(`INSERT INTO ${product}_practice.teacher_session(token_hash,email,google_subject,expires_at,absolute_expires_at,remembered)
    VALUES($1,'other-teacher@example.test','other-google-fixture',now()+interval '1 day',now()+interval '2 days',false)`,[createHash('sha256').update(otherToken).digest('hex')]);
   await context.addCookies([{name:product+'_teacher',value:otherToken,url:f.origin}]);
   if(storage)await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'izone:teacher-sso-login',newValue:'synthetic-account-change'})));
  }
  await page.locator('#workspace').waitFor({state:'hidden',timeout:35000});assert.equal((await page.locator('#detail').textContent()).trim(),'');
  assert.equal(f.requests.some(row=>row.path.startsWith('/api/audio')||/^\/api\/(begin|open|pulse|submit)$/.test(row.path)),false);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,product+'-revoked.png')});records.push({product,width,outcome:'passed',realInterval:30000,scans:quick?0:3,stableNodes:true,keptFocus:true,keptSelection:true,keptScroll:true,recoveredUnchangedState:true,teacherReadOnly:true});
 }catch(error){await page.screenshot({path:path.join(out,product+'-failed.png')});await fs.writeFile(path.join(out,product+'-failure.json'),JSON.stringify({url:page.url(),errors,requests:f.requests.map(row=>({path:row.path,method:row.method,status:row.status,completed:row.completed}))},null,2));throw error;}
});
