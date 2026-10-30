import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {startThe20Server,a,b,detail,token} from './fixtures/progress-the20-server.mjs';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const fixture=await startThe20Server(),browser=await chromium.launch({channel:'chrome',headless:true}),out=process.env.THE20_EVIDENCE_DIR;
if(out)await mkdir(out,{recursive:true});
const contexts=[];
test.after(async()=>{for(const context of contexts)await context.close();await browser.close();await fixture.close();});
async function pageFor(path,{width=1440,blocked=false}={}){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});contexts.push(context);
 if(blocked)await context.addInitScript(()=>{for(const field of ['localStorage','sessionStorage'])Object.defineProperty(window,field,{get(){throw new DOMException('Blocked','SecurityError');}});});
 const page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>new URL(route.request().url()).origin===fixture.origin?route.continue():route.abort());
 await page.goto(fixture.origin+path);return {page,context,errors};
}
test('Thẻ 20 tổng quan học viên gọn, đúng kỹ năng/Test, Speaking hai khối và giữ nguyên tổng quan giảng viên',async()=>{
 const {page,errors}=await pageFor('/fixture/skills.html');await page.locator('#student h2').waitFor();
 assert.equal(await page.locator('#student h2').textContent(),'Tổng quan');assert.equal(await page.locator('#student .thuy-skill-chart').count(),0);
 assert.equal(await page.locator('#student .thuy-metric-method').count(),0);assert.equal(await page.locator('#teacher .thuy-skill-chart').count(),2);assert.equal(await page.locator('#teacher .thuy-metric-method').count(),1);
 const cards=page.locator('#student .thuy-four-skills>.card');
 assert.match(await cards.nth(0).innerText(),/Mini Test: 5\/10/u);assert.match(await cards.nth(0).innerText(),/Term Test 1: 0\/10/u);
 assert.match(await cards.nth(0).innerText(),/Gap fill/u);assert.doesNotMatch(await cards.nth(0).innerText(),/Nguồn Portal|buổi có số|TFNG/u);
 assert.match(await cards.nth(1).innerText(),/TFNG/u);assert.doesNotMatch(await cards.nth(1).innerText(),/Old Reading/u);
 assert.deepEqual(await cards.nth(2).locator('h4').allTextContents(),['Nhận xét của giảng viên','Tự nhận xét']);assert.doesNotMatch(await cards.nth(2).innerText(),/3 buổi/u);
 assert.doesNotMatch(await cards.nth(3).innerText(),/Mini Test|Task 1: Chưa có nhận xét/u);assert.equal(await cards.nth(3).getByRole('link').count(),2);
 const zero=cards.nth(3).getByRole('link',{name:/Task 1 Term Test 1 điểm 0/u});assert.match(await zero.getAttribute('href'),/task=1/u);
 await page.evaluate(()=>{window.kept=document.querySelector('#student .thuy-four-skills>.card');for(let i=0;i<3;i++)window.paint();});
 assert.equal(await page.evaluate(()=>window.kept===document.querySelector('#student .thuy-four-skills>.card')),true);
 await page.evaluate(()=>{window.fixture.forms[0].dashboard.students[0].sessionComment.noteText='Nhận xét mới';window.paint();});
 assert.equal(await page.evaluate(()=>window.kept===document.querySelector('#student .thuy-four-skills>.card')),true);
 assert.deepEqual(errors,[]);if(out)await page.screenshot({path:out+'/overview-desktop.png',fullPage:true});
});
test('Thẻ 20 chi tiết có tên lớn và một khối tóm tắt; số tự báo không bị chấm',async()=>{
 const {page,errors}=await pageFor('/fixture/skills.html',{width:390});await page.waitForFunction(()=>window.detail);
 await page.evaluate(value=>window.detail(value),detail());
 assert.equal(await page.locator('#detail .reviewStudentName').count(),1);assert.equal(await page.locator('#detail .studentDetailHeader .studentDetailScore').count(),1);
 assert.equal(await page.locator('#detail .studentDetailPage>.studentDetailScore').count(),0);assert.doesNotMatch(await page.locator('#detail').innerText(),/tự khai/u);
 assert.match(await page.locator('#detail').innerText(),/Câu trả lời của em/u);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 if(out)await page.screenshot({path:out+'/detail-mobile.png',fullPage:true});
});
test('Thẻ 20 cổng học viên chọn, nhớ, reload và đăng xuất; không start/nộp bài',async()=>{
 const before=fixture.calls.length,{page,errors}=await pageFor('/progress-log/student.html');
 await page.locator('#portalClass:not([disabled])').waitFor();await page.locator('#portalClass').selectOption('1294');await page.locator('#portalStudent:not([disabled])').waitFor();
 await page.locator('#portalStudent').selectOption(a);await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.locator('#portalHome:not([hidden])').waitFor();
 assert.match(await page.locator('#portalName').textContent(),/Học viên A/u);assert.match(await page.locator('#portalJourney').getAttribute('href'),/view=journey/u);
 await page.reload();await page.locator('#portalHome:not([hidden])').waitFor();
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.locator('#portalIdentity:not([hidden])').waitFor();await page.reload();await page.locator('#portalClass:not([disabled])').waitFor();
 assert.equal(await page.locator('#portalHome').isVisible(),false);
 await page.locator('#portalClass').selectOption('1294');await page.locator('#portalStudent:not([disabled])').waitFor();await page.locator('#portalStudent').selectOption(b);await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.locator('#portalHome:not([hidden])').waitFor();
 assert.equal(await page.locator('#portalName').textContent(),'Học viên B');assert.equal(fixture.calls.slice(before).some(c=>/attempts\/(start|submit)|checkpoint/u.test(c.path)),false);
 assert.deepEqual(errors,[]);if(out)await page.screenshot({path:out+'/portal-remember.png',fullPage:true});
});
test('Thẻ 20 Writing mở điểm 0 và Task 2 đầy đủ, chỉ đọc và không chạy script trong nhận xét',async()=>{
 const before=fixture.calls.length,{page,errors}=await pageFor('/term-tests/writing-result/#test=term-test-1&result='+ 'a'.repeat(64)+'&task=1&assignment=30000000-0000-4000-8000-000000000001&student='+a);
 await page.locator('#resultContent:not([hidden])').waitFor();assert.match(await page.locator('#resultContent').innerText(),/Task 1 · Band 0/u);
 await page.getByRole('link',{name:'Task 2: 6',exact:true}).click();await page.getByRole('heading',{name:'Task 2 · Band 6',exact:true}).waitFor();
 assert.match(await page.locator('#resultContent').innerText(),/The saved essay of student A/u);assert.equal(await page.locator('#resultContent :is(input,textarea,button)').count(),0);
 assert.equal(await page.evaluate(()=>window.unsafeWritingFeedback),undefined);assert.equal(await page.locator('#resultContent script').count(),0);
 assert.equal(fixture.calls.slice(before).filter(c=>c.path.endsWith('/writing-test-result')).length,1);assert.equal(fixture.calls.slice(before).some(c=>/attempts/u.test(c.path)),false);
 assert.deepEqual(errors,[]);if(out)await page.screenshot({path:out+'/writing-result.png',fullPage:true});
});
test('Thẻ 20 từ cổng vào Journey, xem bài, mở Writing và đăng xuất trở lại chọn lớp không tạo attempt',async()=>{
 const before=fixture.calls.length,{page,errors}=await pageFor('/progress-log/student.html',{width:390});
 await page.locator('#portalClass:not([disabled])').waitFor();await page.locator('#portalClass').selectOption('1294');await page.locator('#portalStudent:not([disabled])').waitFor();
 await page.locator('#portalStudent').selectOption(a);await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.locator('#portalHome:not([hidden])').waitFor();
 await page.getByRole('link',{name:'Hành trình của em',exact:true}).click();await page.locator('#journeyView:not([hidden])').waitFor();
 assert.equal(await page.getByRole('button',{name:'Hành trình của em',exact:true}).getAttribute('aria-pressed'),'true');
 await page.locator('#journeySessions button.studentSessionCard').first().click();await page.locator('#journeyDetailContent .reviewStudentName').waitFor();
 assert.equal(await page.locator('#journeyDetailContent .reviewStudentName').count(),1);assert.ok(await page.locator('#journeyDetailBackButton').evaluate(e=>e.getBoundingClientRect().height>=44&&parseFloat(getComputedStyle(e).fontSize)>=16));await page.locator('#journeyDetailBackButton').click();
 await page.getByRole('link',{name:/Task 1 Term Test 1 điểm 0/u}).click();await page.locator('#resultContent:not([hidden])').waitFor();
 await page.getByRole('link',{name:'← Hành trình của em',exact:true}).click();await page.locator('#journeyView:not([hidden])').waitFor();
 assert.equal(await page.locator('#progressLogChangeStudent').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e;}),true);
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.waitForURL('**/progress-log/student.html');await page.locator('#portalIdentity:not([hidden])').waitFor();
 await page.goBack();await page.locator('#portalIdentity:not([hidden])').waitFor();assert.equal(await page.locator('#portalHome').isVisible(),false);
 assert.equal(fixture.calls.slice(before).some(c=>/attempts\/(start|submit)|checkpoints/u.test(c.path)),false);assert.deepEqual(errors,[]);
});
test('Thẻ 20 lỗi nguồn và chặn lưu trữ vẫn cho chọn tay, không lấy nhầm kết quả người khác',async()=>{
 const {page,errors}=await pageFor('/progress-log/student.html',{blocked:true});
 await page.locator('#portalClass:not([disabled])').waitFor();await page.locator('#portalClass').selectOption('1294');await page.locator('#portalStudent:not([disabled])').waitFor();
 await page.locator('#portalStudent').selectOption(a);await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.locator('#portalHome:not([hidden])').waitFor();
 assert.match(await page.locator('#portalStatus').textContent(),/chưa lưu/u);
 const other=await pageFor('/term-tests/writing-result/#test=term-test-1&result='+ 'a'.repeat(64)+'&task=2&assignment=30000000-0000-4000-8000-000000000001&student='+b);
 await other.page.locator('#resultRetry:not([hidden])').waitFor();assert.equal(await other.page.locator('#resultContent').isVisible(),false);assert.doesNotMatch(await other.page.locator('body').innerText(),/The saved essay/u);
 assert.deepEqual(errors,[]);assert.deepEqual(other.errors,[]);
});

test('Thẻ 20 lỗi nguồn có thể thử lại, không giữ nội dung Writing cũ khi đổi bản',async()=>{
 fixture.faults['/api/learning/student/portal-classes']=true;
 const {page,errors}=await pageFor('/progress-log/student.html');await page.locator('#portalRetry:not([hidden])').waitFor();
 assert.equal(await page.locator('#portalHome').isVisible(),false);delete fixture.faults['/api/learning/student/portal-classes'];
 await page.locator('#portalRetry').click();await page.locator('#portalClass:not([disabled])').waitFor();
 await page.goto(fixture.origin+'/term-tests/writing-result/#test=term-test-1&result='+ 'a'.repeat(64)+'&task=2&assignment='+token+'&student='+a);
 await page.locator('#resultContent:not([hidden])').waitFor();fixture.faults['/api/learning/student/writing-test-result']=true;
 await page.evaluate(()=>{location.hash=location.hash.replace('test=term-test-1','test=term-test-2');});await page.locator('#resultRetry:not([hidden])').waitFor();
 assert.equal(await page.locator('#resultContent').isVisible(),false);assert.equal(await page.locator('#resultContent').textContent(),'');
 delete fixture.faults['/api/learning/student/writing-test-result'];await page.evaluate(()=>{location.hash=location.hash.replace('test=term-test-2','test=term-test-1');});
 await page.locator('#resultContent:not([hidden])').waitFor();assert.match(await page.locator('#resultContent').innerText(),/saved essay/u);assert.deepEqual(errors,[]);
});

test('Thẻ 20 ba nhịp cập nhật thật giữ DOM, vùng đọc và lựa chọn trên Journey chung/riêng; nhận xét đổi đúng buổi',{timeout:125000},async()=>{
 const primary=await pageFor('/progress-log/student.html',{width:1280}),page=primary.page;
 await page.locator('#portalClass:not([disabled])').waitFor();await page.locator('#portalClass').selectOption('1294');await page.locator('#portalStudent:not([disabled])').waitFor();
 await page.locator('#portalStudent').selectOption(a);await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.locator('#portalHome:not([hidden])').waitFor();
 await page.getByRole('link',{name:'Hành trình của em',exact:true}).click();await page.locator('#thuyStudentSkills h2').waitFor();
 const privateView=await pageFor('/progress-log/journey.html#access='+ 'x'.repeat(48),{width:1280});
 await privateView.page.locator('#thuyStudentJourneySkills h2').waitFor();await privateView.page.locator('#timelineToggle').click();
 let changed=false;
 for(const current of [page,privateView.page])await current.route('**/api/learning/student/session-comments',async route=>{
  if(!changed)return route.continue();const response=await route.fetch(),data=await response.json();data.comments[0].noteText='Nhận xét mới đúng buổi 2';await route.fulfill({response,json:data});
 });
 const save=async(current,skills,list)=>current.evaluate(({skills,list})=>{
  window.readingState={card:document.querySelector(skills+' .thuy-four-skills>.card'),row:document.querySelector(list+' [data-session-number="1"]'),row2:document.querySelector(list+' [data-session-number="2"]')};
  const target=window.readingState.card.querySelector('h3'),range=document.createRange();range.selectNodeContents(target);getSelection().removeAllRanges();getSelection().addRange(range);
  const filter=document.querySelector('.journey-comment-filter select');filter.focus({preventScroll:true});window.scrollTo({top:240,behavior:'instant'});window.readingState.scroll=scrollY;window.readingState.selection=getSelection().toString();
 },{skills,list});
 await save(page,'#thuyStudentSkills','#journeySessions');await save(privateView.page,'#thuyStudentJourneySkills','#sessionList');
 const start=fixture.calls.filter(c=>c.path.endsWith('/session-comments')).length;await page.waitForTimeout(92500);
 assert.ok(fixture.calls.filter(c=>c.path.endsWith('/session-comments')).length>=start+6);
 for(const [current,skills,list]of [[page,'#thuyStudentSkills','#journeySessions'],[privateView.page,'#thuyStudentJourneySkills','#sessionList']]){
  const state=await current.evaluate(({skills,list})=>({sameCard:readingState.card===document.querySelector(skills+' .thuy-four-skills>.card'),sameRow:readingState.row===document.querySelector(list+' [data-session-number="1"]'),
   sameRow2:readingState.row2===document.querySelector(list+' [data-session-number="2"]'),scroll:Math.abs(scrollY-readingState.scroll),selection:getSelection().toString()===readingState.selection,focus:document.activeElement?.getAttribute('aria-label')}),{skills,list});
  assert.deepEqual(state,{sameCard:true,sameRow:true,sameRow2:true,scroll:0,selection:true,focus:'Lọc buổi học theo nhận xét'});
 }
 changed=true;for(const current of [page,privateView.page])await current.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 for(const [current,list]of [[page,'#journeySessions'],[privateView.page,'#sessionList']]){await current.locator(list+' [data-session-number="2"]').filter({hasText:'Nhận xét mới đúng buổi 2'}).waitFor();
  assert.equal(await current.evaluate(list=>readingState.row===document.querySelector(list+' [data-session-number="1"]'),list),true);}
 assert.deepEqual(primary.errors,[]);assert.deepEqual(privateView.errors,[]);
});


test('Thẻ 20 lịch và tổng quan nhiều buổi có thời hạn đọc riêng khi mạng chậm',{timeout:60000},async()=>{
 const {page,errors}=await pageFor('/progress-log/student.html');
 await page.route('**/api/learning/student/course-journey',async route=>{
  const response=await route.fetch(),data=await response.json();data.journey.sessions=Array.from({length:7},(_,i)=>({...data.journey.sessions[0],sessionNumber:i+1,sessionDate:'2026-10-0'+(i+1)}));
  await new Promise(done=>setTimeout(done,6000));await route.fulfill({response,json:data});
 });
 await page.route('**/api/learning/student/course-session-detail',async route=>{await new Promise(done=>setTimeout(done,4000));await route.continue();});
 await page.locator('#portalClass:not([disabled])').waitFor();await page.locator('#portalClass').selectOption('1294');await page.locator('#portalStudent:not([disabled])').waitFor();await page.locator('#portalStudent').selectOption(a);
 await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();await page.locator('#portalHome:not([hidden])').waitFor();
 await page.getByRole('link',{name:'Hành trình của em',exact:true}).click();await page.locator('#thuyStudentSkills h2').waitFor({timeout:40000});
 assert.equal(await page.locator('#thuyStudentSkills h2').textContent(),'Tổng quan');assert.doesNotMatch(await page.locator('#thuyStudentSkills').textContent(),/Hết thời gian chờ/u);assert.deepEqual(errors,[]);
});
