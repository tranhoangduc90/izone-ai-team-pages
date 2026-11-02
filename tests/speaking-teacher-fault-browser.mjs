import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {startSpeakingTeacherFixture} from './fixtures/speaking-teacher-tracking-server.mjs';
assert.ok(process.env.PLAYWRIGHT_MODULE);assert.ok(process.env.SPEAKING_TEACHER_EVIDENCE_DIR);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),output=resolve(process.env.SPEAKING_TEACHER_EVIDENCE_DIR);
await mkdir(output,{recursive:true});const f=await startSpeakingTeacherFixture(root);let browser,succeeded=false;
const results=[],external=[],errors=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),path='/api/speaking-homework-independent/teacher/progress';
const count=suffix=>f.requests.filter(row=>row.path===path+suffix).length;
async function until(predicate,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await predicate())return;await wait(25);}throw Error('Speaking teacher fault fixture deadline');}
async function save(name,value){results.push({name,...value});console.log(JSON.stringify({event:'speaking_teacher_fault_case',name,passed:true}));}
try{
 // Hai Google principal tổng hợp, B chỉ được lớp khác; cookie vẫn qua auth SQL thật.
 await f.db.query("INSERT INTO mapping.reviewer_account VALUES('teacher-b@fixture.test','Tài khoản B','reviewer',false,'fixture-subject-b','active',NULL,NULL)");
 await f.db.query("INSERT INTO mapping.reviewer_class_access VALUES('teacher-b@fixture.test',2305)");
 const hash=createHash('sha256').update('b'.repeat(43)).digest();
 await f.db.query("INSERT INTO mapping.reviewer_session VALUES($1,'teacher-b@fixture.test','fixture-subject-b',NULL,now()+interval '1 day',now()+interval '365 days','2026-01-01T00:00:00Z')",[hash]);
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:800}});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==f.origin){external.push(url.hostname);return route.abort();}return route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('fixture-student-draft','Nháp riêng vẫn còn'));
 await page.goto(f.origin+'/speaking-homework/teacher-progress.html?code='+f.code+'&classId=2304');
 const select=async id=>{await page.locator('#rows [data-unit="'+id+'"]').click();await page.locator('.teacher-link-row').first().waitFor();};
 await select(f.id(1001));await until(()=>count('/units/'+f.id(1001))>=2);await wait(700);

 // 503 một lần ở danh sách: lane chi tiết vẫn nhận dữ liệu, metadata không phá30s backoff.
 f.control.failures.push({path:path+'/students',status:503,retryAfter:2});const before=count('/students');
 await f.db.query("UPDATE speaking_independent.link SET status='rejected' WHERE work_unit_id=$1 AND kind='main' AND revision=2",[f.id(1001)]);await f.wake();
 await page.locator('[data-reading-key="main:main"] .badge').filter({hasText:'Cần kiểm tra lại'}).waitFor();
 await until(()=>count('/students')===before+1);const failed=f.requests.filter(row=>row.path===path+'/students').at(-1);
 const node=await page.evaluate(()=>{window.__faultNode=document.querySelector('[data-reading-key="practice:1"]');return Boolean(window.__faultNode);});assert.equal(node,true);
 await f.db.query("UPDATE speaking_independent.work_unit SET status='draft' WHERE id=$1",[f.id(1003)]);await f.wake();await wait(4500);
 assert.equal(count('/students'),before+1);assert.equal(await page.evaluate(()=>document.querySelector('[data-reading-key="practice:1"]')===window.__faultNode),true);
 await until(()=>count('/students')===before+2,35000);await wait(700);
 const recovered=f.requests.filter(row=>row.path===path+'/students').at(-1);assert.ok(recovered.at-failed.at>=29500);assert.equal(recovered.status,200);
 await save('class503-backoff-does-not-block-detail',{gapMs:recovered.at-failed.at,before,after:count('/students')});

 // A đang tải nền chậm, chuyển B; response A không đổi danh tính/nội dung B.
 f.control.delays.push({path:path+'/units/'+f.id(1001),ms:4500});const aBefore=count('/units/'+f.id(1001));
 await f.db.query("UPDATE speaking_independent.link SET status='accepted' WHERE work_unit_id=$1 AND kind='main' AND revision=2",[f.id(1001)]);await f.wake();
 await until(()=>count('/units/'+f.id(1001))===aBefore+1);await page.locator('#detail-back').click();await select(f.id(1003));await wait(500);
 const bBefore=await page.locator('#detail').innerHTML();await wait(4800);assert.equal(await page.locator('#detail').innerHTML(),bBefore);
 assert.ok(new URL(page.url()).hash.includes(f.id(1003)));await save('late-response-cannot-replace-selected-b',{selected:f.id(1003)});

 // A đang tải lần nữa, cookie đổi sang principalB chỉ được IC2305 rồi boot lại.
 await page.locator('#detail-back').click();await select(f.id(1001));await wait(1000);
 f.control.delays.push({path:path+'/units/'+f.id(1001),ms:4500});const accountBefore=count('/units/'+f.id(1001));
 await f.db.query("UPDATE speaking_independent.link SET status='rejected' WHERE work_unit_id=$1 AND kind='main' AND revision=2",[f.id(1001)]);await f.wake();
 await until(()=>count('/units/'+f.id(1001))===accountBefore+1);f.control.cookie='observe_teacher='+'b'.repeat(43);
 await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'izone:teacher-sso-login',newValue:'fixture-account-b'})));
 await until(async()=>await page.locator('#workspace').isHidden());await wait(5000);
 assert.equal(await page.locator('#detail').innerHTML(),'');assert.equal(await page.locator('#rows').innerHTML(),'');
 assert.match(await page.locator('#notice').innerText(),/chưa có quyền xem lớp/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-student-draft')),'Nháp riêng vẫn còn');
 await save('new-cookie-narrower-role-clears-late-a',{workspaceHidden:true,detailEmpty:true,rowsEmpty:true,draftPreserved:true});
 // HTTP429 ở stream thật: cả reconnect và fallback đều tôn trọng quote20s.
 await page.close();f.control.cookie='observe_teacher='+'t'.repeat(43);
 f.control.failures.push({path:path+'/events',status:429,retryAfter:20});const quoteStart=f.requests.length;
 const quotaPage=await context.newPage();quotaPage.on('pageerror',error=>errors.push(error.message));
 await quotaPage.goto(f.origin+'/speaking-homework/teacher-progress.html?code='+f.code+'&classId=2304');
 await until(()=>f.requests.slice(quoteStart).some(row=>row.path===path+'/events'&&row.status===429));
 const quoted=f.requests.slice(quoteStart).find(row=>row.path===path+'/events'&&row.status===429);await wait(16000);
 assert.equal(f.requests.slice(quoteStart).filter(row=>row.path===path+'/events').length,1);
 assert.equal(f.requests.slice(quoteStart).filter(row=>row.path===path+'/state').length,0);
 await until(()=>f.requests.slice(quoteStart).some(row=>row.path===path+'/events'&&row.status===200),10000);
 const retry=f.requests.slice(quoteStart).find(row=>row.path===path+'/events'&&row.status===200);
 assert.ok(retry.at-quoted.at>=19500);await save('real-http429-stream-retry-after20s',{gapMs:retry.at-quoted.at,noEarlyFallback:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);succeeded=true;
}finally{
 await browser?.close();await f.close();const sourceHashes={};
 for(const file of ['shared/teacher-progress.js','shared/speaking-teacher-tracking.mjs','shared/test-state-observer.mjs','tests/fixtures/speaking-teacher-tracking-server.mjs','tests/speaking-teacher-fault-browser.mjs'])sourceHashes[file]=createHash('sha256').update(await readFile(resolve(root,file))).digest('hex');
 await writeFile(join(output,'result.json'),JSON.stringify({status:succeeded?'passed':'failed',results,errors,external,sourceHashes,requests:f.requests},null,2)+'\n');
}
