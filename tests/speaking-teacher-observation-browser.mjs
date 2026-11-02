import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {startSpeakingTeacherFixture} from './fixtures/speaking-teacher-tracking-server.mjs';

assert.ok(process.env.PLAYWRIGHT_MODULE);assert.ok(process.env.SPEAKING_TEACHER_EVIDENCE_DIR);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),output=resolve(process.env.SPEAKING_TEACHER_EVIDENCE_DIR);
await mkdir(output,{recursive:true});
const fixture=await startSpeakingTeacherFixture(root,{sourceOverride:process.env.SPEAKING_TEACHER_SOURCE_OVERRIDE||null});
const fixtures=[fixture],results=[],errors=[],external=[],googleStubs=[];let browser;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await predicate())return;await wait(30);}throw Error('Speaking teacher fixture deadline exceeded');}
const reads=f=>({students:f.requests.filter(row=>row.path.endsWith('/students')).length,detail:f.requests.filter(row=>row.path.includes('/units/')).length,
 states:f.requests.filter(row=>row.path.endsWith('/state')).length,streams:f.requests.filter(row=>row.path.endsWith('/events')).length});
async function save(name,value){results.push({name,...value});await writeFile(join(output,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify({event:'speaking_teacher_browser_case',name,passed:true}));}
async function open(f,width=1440){
 const context=await browser.newContext({viewport:{width,height:700}});
 await context.route('**/*',route=>{const url=new URL(route.request().url());
  if(url.origin==='https://accounts.google.com'&&url.pathname==='/gsi/client'){
   googleStubs.push({path:url.pathname,at:Date.now()});return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},disableAutoSelect(){},renderButton(el){const b=document.createElement("button");b.textContent="Google thử";el.replaceChildren(b);}}}};'});
  }
  if(url.origin!==f.origin){external.push(url.hostname);return route.abort();}return route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{localStorage.setItem('fixture-student-draft','Nháp học viên phải còn nguyên');});
 await page.goto(f.origin+'/speaking-homework/teacher-progress.html?code='+f.code+'&classId=2304');
 await page.locator('#rows [data-unit]').first().waitFor();return page;
}
async function select(page,id){await page.locator('#rows [data-unit="'+id+'"]').click();await page.locator('.teacher-link-row').first().waitFor();}
async function pin(page){return page.evaluate(()=>{
 const node=document.querySelector('[data-reading-key="practice:1"]')||document.querySelectorAll('.teacher-link-row')[1],anchor=node.querySelector('a'),text=node.querySelector('h3').firstChild;
 anchor.focus();node.scrollIntoView({block:'center'});const range=document.createRange();range.setStart(text,0);range.setEnd(text,text.length);getSelection().removeAllRanges();getSelection().addRange(range);
 window.__teacherReading={node,anchor,text,at:Date.now(),selection:getSelection().toString(),scroll:scrollY,top:node.getBoundingClientRect().top,mutations:0};
 window.__teacherReading.observer=new MutationObserver(records=>window.__teacherReading.mutations+=records.length);
 window.__teacherReading.observer.observe(document.getElementById('detail'),{subtree:true,childList:true,characterData:true,attributes:true});
 return{at:window.__teacherReading.at,selection:getSelection().toString(),scroll:scrollY};
});}
async function retained(page,{unchanged=false,minimum=0}={}){
 const value=await page.evaluate(()=>{const x=window.__teacherReading;return{elapsed:Date.now()-x.at,sameNode:(document.querySelector('[data-reading-key="practice:1"]')||document.querySelectorAll('.teacher-link-row')[1])===x.node,
 sameAnchor:x.anchor.isConnected,focus:document.activeElement===x.anchor,sameText:x.text.isConnected,selection:getSelection().toString(),expectedSelection:x.selection,
 scrollDelta:scrollY-x.scroll,topDelta:x.node.getBoundingClientRect().top-x.top,mutations:x.mutations};});
 assert.ok(value.elapsed>=minimum);assert.equal(value.sameNode,true);assert.equal(value.sameAnchor,true);assert.equal(value.focus,true);assert.equal(value.sameText,true);
 assert.equal(value.selection,value.expectedSelection);assert.ok(Math.abs(value.scrollDelta)<=1);assert.ok(Math.abs(value.topDelta)<=1);if(unchanged)assert.equal(value.mutations,0);return value;
}
let succeeded=false;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await open(fixture);await select(page,fixture.id(1001));
 if(!process.env.SPEAKING_TEACHER_SOURCE_OVERRIDE)await until(()=>reads(fixture).streams>=4&&fixture.requests.filter(row=>row.path.includes('/units/')).length>=2);
 await wait(1200);
 assert.equal(fixture.requests.some(row=>row.status>=400),false,'Native fixture must serve all API requests successfully');
 const initial=reads(fixture);if(!process.env.SPEAKING_TEACHER_SOURCE_OVERRIDE)assert.ok(initial.streams>=4);await pin(page);
 console.log(JSON.stringify({event:'speaking_teacher_idle_window_started',at:Date.now(),initial}));
 await wait(92000);
 const idle=await retained(page,{unchanged:true,minimum:91000}),afterIdle=reads(fixture);
 assert.equal(afterIdle.students,initial.students);assert.equal(afterIdle.detail,initial.detail);assert.equal(afterIdle.states,initial.states);
 await save('two-store-three-real-intervals',{...idle,before:initial,after:afterIdle});

 // Chỉ công việc Docs: metadata đổi nhưng không tải danh sách/chi tiết.
 const docsBefore=reads(fixture);
 await fixture.db.query("UPDATE speaking_independent.doc_progress SET status='verified',sequence=sequence+1,applied_sequence=sequence+1 WHERE unit_id=$1",[fixture.id(1004)]);
 await fixture.db.query("INSERT INTO speaking_independent.doc_progress VALUES($1,'pending',NULL,1,0,NULL)",[fixture.id(1001)]);
 await fixture.wake();await wait(1200);const docsAfter=reads(fixture);
 assert.equal(docsAfter.students,docsBefore.students);assert.equal(docsAfter.detail,docsBefore.detail);await retained(page,{unchanged:true});
 await save('docs-only-no-body-reads',{before:docsBefore,after:docsAfter});

 // Bản đã lưu thay đổi: chỉ vùng chính đổi, phần bổ trợ đang đọc vẫn nguyên.
 const changedBefore=reads(fixture);
 await fixture.db.query("UPDATE speaking_independent.link SET status='rejected',check_code='FIXTURE_REJECTED' WHERE work_unit_id=$1 AND kind='main' AND revision=2",[fixture.id(1001)]);
 await fixture.wake();await page.locator('[data-reading-key="main:main"] .badge').filter({hasText:'Cần kiểm tra lại'}).waitFor();await wait(500);
 const changedAfter=reads(fixture);assert.equal(changedAfter.students-changedBefore.students,1);assert.equal(changedAfter.detail-changedBefore.detail,1);
 await save('selected-content-one-class-one-detail',{before:changedBefore,after:changedAfter,reading:await retained(page)});

 // Template hiện hành đổi tên; chi tiết vẫn giữ cấu trúc template đã lưu.
 const titleBefore=reads(fixture);await fixture.db.query("UPDATE speaking_homework.assignment_template SET title='Tên bài mới trong fixture' WHERE assignment_code=$1",[fixture.code]);
 await fixture.wake();await page.locator('#detail .teacher-kicker').filter({hasText:'Tên bài mới trong fixture'}).waitFor();await wait(500);
 const titleAfter=reads(fixture);assert.equal(titleAfter.students-titleBefore.students,1);assert.equal(titleAfter.detail,titleBefore.detail);
 await save('current-template-title-without-detail-read',{before:titleBefore,after:titleAfter,reading:await retained(page)});

 // Kho cũ vẫn là định danh legacy_; chỉ gửi UUID thô tới metadata của kho đó.
 await page.locator('#detail-back').click();await select(page,'legacy_'+fixture.id(2001));
 await until(()=>fixture.requests.some(row=>row.path==='/api/speaking-homework/teacher/progress/events'&&row.query.includes('unitId='+fixture.id(2001))));await wait(900);
 await pin(page);const legacyBefore=reads(fixture);
 await fixture.db.query("UPDATE speaking_homework.submission_link SET check_status='rejected',check_code='FIXTURE_REJECTED' WHERE submission_id=$1 AND revision=2",[fixture.id(2001)]);
 await fixture.wake();await page.locator('[data-reading-key="main:main"] .badge').filter({hasText:'Cần kiểm tra lại'}).waitFor();await wait(500);
 const legacyAfter=reads(fixture);assert.equal(legacyAfter.students-legacyBefore.students,1);assert.equal(legacyAfter.detail-legacyBefore.detail,1);
 assert.equal(fixture.requests.filter(row=>/\/(events|state)$/.test(row.path)).some(row=>row.query.includes('legacy_')),false);
 await save('legacy-selected-content-and-scope',{before:legacyBefore,after:legacyAfter,reading:await retained(page)});

 // Thay đổi học viên khác: giữ node/nút được focus trong danh sách hiện tại.
 await page.locator('#detail-back').click();await wait(1000);
 await page.evaluate(()=>{const row=document.querySelector('#rows tr'),button=row.querySelector('button');button.focus();window.__teacherRow={row,button};});
 const listBefore=reads(fixture);
 await fixture.db.query("UPDATE speaking_independent.work_unit SET status='draft' WHERE id=$1",[fixture.id(1003)]);await fixture.wake();
 await until(()=>reads(fixture).students>listBefore.students);await wait(500);
 const rowState=await page.evaluate(()=>({same:document.querySelector('#rows tr')===window.__teacherRow.row,focused:document.activeElement===window.__teacherRow.button}));
 assert.deepEqual(rowState,{same:true,focused:true});assert.equal(reads(fixture).detail,listBefore.detail);
 await save('other-student-change-keeps-row',{...rowState,before:listBefore,after:reads(fixture)});

 // Các chiều rộng được kiểm trên renderer thật, không gọi audio hoặc luồng HV.
 await select(page,fixture.id(1001));
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(output,'teacher-'+width+'.png'),fullPage:true});}
 await save('responsive-390-768-1440',{widths:[390,768,1440]});

 // Thu hồi quyền ngay trong hai app thật: xóa nội dung riêng và ngừng reconnect.
 await fixture.db.query("UPDATE mapping.reviewer_account SET status='disabled' WHERE email='teacher@fixture.test'");await fixture.wake();
 await until(async()=>await page.locator('#workspace').isHidden());const revokedBefore=reads(fixture);await wait(16000);
 assert.equal(await page.locator('#detail').innerText(),'');assert.deepEqual(reads(fixture),revokedBefore);
 assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-student-draft')),'Nháp học viên phải còn nguyên');
 await save('revoked-role-clears-and-closes',{before:revokedBefore,after:reads(fixture)});

 // Runtime cũ: không thăm dò observation; polling native30s vẫn giữ vùng đọc.
 const old=await startSpeakingTeacherFixture(root,{enabled:false,parentEnabled:false});fixtures.push(old);const oldPage=await open(old,768);await select(oldPage,old.id(1001));
 await pin(oldPage);const oldBefore=reads(old);await wait(31500);const oldAfter=reads(old);
 assert.ok(oldAfter.students>oldBefore.students);assert.ok(oldAfter.detail>oldBefore.detail);assert.equal(oldAfter.streams,0);assert.equal(oldAfter.states,0);
 await save('old-runtime-native-fallback-preserves-reading',{before:oldBefore,after:oldAfter,reading:await retained(oldPage,{unchanged:true,minimum:31000})});

 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 for(const f of fixtures)assert.equal(f.requests.some(row=>/\/(begin|open|pulse|submit|audio-access)(?:$|\?)/.test(row.path)),false);
 succeeded=true;
}finally{
 await browser?.close();for(const f of fixtures)await f.close();
 const sourceHashes={};for(const path of ['shared/teacher-progress.js','shared/speaking-teacher-tracking.mjs','shared/test-state-observer.mjs','tests/speaking-teacher-observation-browser.mjs','tests/fixtures/speaking-teacher-tracking-server.mjs'])sourceHashes[path]=createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');
 const servedRenderer=process.env.SPEAKING_TEACHER_SOURCE_OVERRIDE||resolve(root,'shared/teacher-progress.js');
 await writeFile(join(output,'result.json'),JSON.stringify({status:succeeded?'passed':'failed',results,errors,external,googleStubs,sourceHashes,
  servedRenderer:{override:Boolean(process.env.SPEAKING_TEACHER_SOURCE_OVERRIDE),sha256:createHash('sha256').update(await readFile(servedRenderer)).digest('hex')},requests:fixtures.map(f=>f.requests)},null,2)+'\n');
}
