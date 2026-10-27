// HTML/controller thật của sáu bài Task 1; mọi HTTP/Google đều bằng dữ liệu giả.
// Bắt mất node/focus/bôi chọn/history khi polling, không thêm hook vào production.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(process.env.SW_TASK1_READING_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const tasks=['pie-app-users-by-age','australian-destinations-1999-2009','australian-physical-activity-2010','new-zealand-employment-1993-2003','average-earnings-by-sector-2000-2010','mobile-phone-market-share-1994-2004'];
const origin='https://tranhoangduc90.github.io',prefix='/izone-ai-team-pages';
const classRef='22222222-2222-4222-8222-222222222222',studentRef='33333333-3333-4333-8333-333333333333',sessionRef='11111111-1111-4111-8111-111111111111';
const stamp='2026-10-27T08:00:00.000Z';
function session(task,pending){
 const texts=Object.fromEntries(['overview','body1','body2','draft1','draft2'].map(k=>[k,k+' Synthetic content for reading.']));
 return {sessionRef,classRef,studentRef,activitySlug:task,draftVersion:4,...texts,responses:texts,draft2Unlocked:true,updatedAt:stamp,sections:{overview:{status:'passed'},outline:{status:pending?'queued':'passed'},draft:{status:'passed'}},comments:['overview','outline','draft'].flatMap(section=>[1,2].map(n=>({section,commentRef:section+'-'+n,attemptRef:section+'-attempt-'+n,commentNumber:n,status:'passed',createdAt:stamp,feedback:section+' nhận xét '+n+'. '+('Giải thích dài đang được đọc. '.repeat(35)),snapshot:structuredClone(texts)}))),attempts:pending?[{attemptRef:'pending-outline',section:'outline',status:'queued',createdAt:new Date().toISOString(),submittedAt:Date.now()}]:[]};
}
async function fixture(browser,{task=tasks[0],teacher=false,width=1440,editable=false,second=false}={}){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 const state={raw:session(task,!teacher),calls:[],errors:[],escaped:[],status:200,sessionStatus:200,threads:[],pendingResult:null,canManage:true};
 if(editable)state.raw.sections.overview.status='draft';
 if(second)state.other={...structuredClone(state.raw),studentRef:'55555555-5555-4555-8555-555555555555',sessionRef:'66666666-6666-4666-8666-666666666666'};
 const summary=(raw=state.raw)=>({...raw,displayName:raw.studentRef===studentRef?'Học viên thử':'Người thử khác',className:'CS-FIXTURE',hasStarted:true,online:raw.online||false,checkCount:6,savedAt:stamp,filledFields:5,totalFields:5,passedSectionCount:3,progressPercent:100});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;
  if(u.origin===origin){
   if(p.endsWith('/config.json'))return route.fulfill({json:{apiBase:'https://ducizone.ddns.net/writing-api/',googleClientId:'fixture-google',studentMemory:{enabled:false},socraticTask1Slugs:tasks}});
   const file=resolve(root,'.'+p.slice(prefix.length)+(p.endsWith('/')?'index.html':''));assert(file.startsWith(root+'\\')||file.startsWith(root+'/'));
   try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.json':'application/json'})[extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
  }
  if(u.hostname!=='ducizone.ddns.net'){state.escaped.push(req.url());return route.abort();}
  state.calls.push({path:p,method:req.method(),body:req.method()==='GET'?null:req.postDataJSON()});
  if(p.includes('/restore/')||p.endsWith('/auth/session'))return route.fulfill({json:{ok:true,reviewer:{role:'admin',canManage:state.canManage}}});
  if(p.endsWith('/shared-session'))return route.fulfill({status:401,json:{error:'NO_FIXTURE_SHARED_SESSION'}});
  if(p.endsWith('/roster'))return route.fulfill({json:{classes:[{classRef,className:'CS-FIXTURE',students:[{studentRef,alias:'Học viên thử',displayName:'Học viên thử'}]}]}});
  if(p.includes('/admin/live/activities/'))return route.fulfill({status:state.status,json:state.status===200?{students:[summary(),...(state.other?[summary(state.other)]:[])],permissions:{canManage:state.canManage},generatedAt:new Date().toISOString()}:{error:'FIXTURE_UNAVAILABLE'}});
  if(p.endsWith('/provisional-students'))return route.fulfill({json:{students:[]}});
  if(p.endsWith('/teacher-comments'))return route.fulfill({json:{threads:state.threads},headers:{etag:'fixture-threads'}});
  if(p.endsWith('/teacher-comments')&&req.method()==='POST')return route.fulfill({json:{ok:true}});
  if(p.includes('/attempts/'))return state.pendingResult?route.fulfill({json:{attempt:state.pendingResult}}):route.fulfill({status:304});
  if(p.endsWith('/sessions')&&req.method()==='POST')return route.fulfill({json:{session:state.raw}});
  if(p.includes('/sessions/')&&p.endsWith('/live'))return route.fulfill({json:{ok:true}});
  if(p.endsWith('/draft')&&req.method()==='PUT'){Object.assign(state.raw,req.postDataJSON());state.raw.draftVersion++;return route.fulfill({json:{session:state.raw}});}
  if(p.includes('/sessions/'))return route.fulfill({status:state.sessionStatus,json:state.sessionStatus===200?{session:state.other&&p.includes(state.other.sessionRef)?state.other:state.raw}:{error:'FIXTURE_SESSION_UNAVAILABLE'}});
  state.errors.push(req.method()+' '+p);return route.fulfill({status:500,json:{error:'UNEXPECTED_FIXTURE'}});
 });
 page.on('pageerror',e=>state.errors.push(e.message));
 await page.goto(origin+prefix+'/writing-handouts/'+(teacher?'teacher':'index')+'.html?task='+task+'&class='+classRef);
 if(teacher){await page.locator('.teacher-student-card').first().click();await page.locator('#teacher-detail .feedback-content').first().waitFor({state:'attached'});}
 else{await page.locator('#student-name').selectOption(studentRef);await page.locator('#identity-form button[type="submit"]').click();await page.locator('#confirm-open').click();await page.locator('#workspace:not([hidden])').waitFor();}
 const selector=teacher?'#teacher-detail-content [data-section-key="draft"]':'#section-overview';
 await page.locator(selector+' details.history').first().waitFor({state:'attached'});
 return {context,page,state,selector,reads:()=>state.calls.filter(c=>teacher?c.path.includes('/admin/live/sessions/'):c.path.includes('/attempts/')).length,async close(){assert.deepEqual(state.errors,[]);assert.deepEqual(state.escaped,[]);assert(state.calls.every(c=>c.method==='GET'||c.path.endsWith('/sessions')||c.path.endsWith('/live')||c.path.endsWith('/draft')||c.path.includes('/restore/')||c.path.endsWith('/shared-session')||c.path.endsWith('/teacher-comments')));await context.close();}};
}
async function remember(f){await f.page.locator(f.selector).evaluate(section=>{
 const prior=section.querySelector('details.prior-step');if(prior)prior.open=true;
 const histories=section.querySelectorAll('details.history');histories[0].open=false;histories[1].open=true;
 const text=histories[1].querySelector('.feedback-content');text.tabIndex=0;text.focus({preventScroll:true});text.scrollIntoView({block:'center'});
 const range=document.createRange();range.selectNodeContents(text);getSelection().removeAllRanges();getSelection().addRange(range);
 window.__reading={section,text,history:histories[1],selection:getSelection().toString(),focus:document.activeElement,top:text.getBoundingClientRect().top};
});}
async function retained(f){const proof=await f.page.evaluate(()=>{const p=window.__reading;return {section:p.section.isConnected,text:p.text.isConnected,history:p.history.open,focus:p.focus===document.activeElement,selection:p.selection===getSelection().toString(),position:Math.abs(p.top-p.text.getBoundingClientRect().top)<2};});assert.deepEqual(proof,{section:true,text:true,history:true,focus:true,selection:true,position:true},'Cập nhật nền phải giữ vùng đang đọc, history, focus, bôi chọn và vị trí');}

for(const teacher of [true,false])test('Task 1 '+(teacher?'giảng viên':'học viên')+': sáu đề giữ vùng đọc qua 35 giây polling',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(let offset=0;offset<tasks.length;offset+=3){const batch=await Promise.all(tasks.slice(offset,offset+3).map(async task=>{const f=await fixture(browser,{task,teacher});try{await remember(f);const count=f.reads();await f.page.waitForTimeout(35000);assert(f.reads()-count>=3,'Phải có ít nhất ba lượt đọc nền');await retained(f);return task;}finally{await f.close();}}));assert.equal(batch.length,3);}}finally{await browser.close();}
});

test('Task 1 GV: phần khác đổi giữ Draft, guard chỉ đọc và nhận xét mới vẫn cập nhật; lỗi đọc giữ kết quả',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{teacher:true,width:390});
 try{await remember(f);f.state.raw.overview='Overview đã thay đổi';f.state.raw.responses.overview=f.state.raw.overview;f.state.raw.draftVersion++;
 await f.page.getByText('Overview đã thay đổi',{exact:true}).first().waitFor({state:'attached',timeout:12000});await retained(f);
 f.state.raw.activeField='overview';f.state.raw.online=true;
 await f.page.locator('.teacher-response-field[data-active="true"]').waitFor({timeout:12000});await retained(f);
 f.state.sessionStatus=503;await f.page.getByRole('button',{name:'Cập nhật bài',exact:true}).click();
 await f.page.locator('#teacher-detail-content > .notice').filter({hasText:'chi tiết mới nhất'}).waitFor({timeout:12000});
 assert(await f.page.getByText('Overview đã thay đổi',{exact:true}).count(),'Lỗi đọc không được quay về closure bản bài cũ');
 assert(await f.page.evaluate(()=>window.__reading.section.isConnected&&window.__reading.text.isConnected),'Thêm banner lỗi không được thay vùng nội dung không đổi');
 f.state.sessionStatus=200;await f.page.getByRole('button',{name:'Cập nhật bài',exact:true}).click();
 await f.page.waitForFunction(()=>document.querySelectorAll('#teacher-detail-content > .notice').length===0,null,{timeout:12000});
 const field=f.page.locator('#teacher-detail-content [data-section-key="draft"] .teacher-response-field').first();
 await field.getByRole('button',{name:'Góp ý ô này',exact:true}).click();await field.locator('.teacher-comment-composer textarea').fill('Comment giả để kiểm baseVersion mới');
 await field.getByRole('button',{name:'Comment',exact:true}).click();
 await f.page.waitForFunction(()=>document.querySelectorAll('.teacher-comment-composer:not([hidden])').length===0,null,{timeout:12000});
 const posted=f.state.calls.find(c=>c.method==='POST'&&c.path.endsWith('/teacher-comments'));assert.equal(posted.body.baseVersion,5);assert.equal(posted.body.fieldKey,'draft1');
 f.state.raw.comments.push({...f.state.raw.comments[0],section:'draft',commentNumber:3,attemptRef:'new-draft',feedback:'Nhận xét Draft mới'});
 await f.page.getByText('Nhận xét Draft mới',{exact:true}).waitFor({state:'attached',timeout:12000});
 f.state.raw.readOnly=true;await f.page.getByText(/Bản sao lịch sử chỉ đọc/).waitFor({timeout:12000});
 for(const button of await f.page.getByRole('button',{name:'Góp ý ô này',exact:true}).all())assert(await button.isDisabled());
 f.state.status=503;await f.page.locator('#teacher-error').filter({hasText:'Chưa thể cập nhật'}).waitFor({timeout:12000});assert(await f.page.getByText('Nhận xét Draft mới',{exact:true}).count());
 assert(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }finally{await f.close();await browser.close();}
});

test('Task 1 HV: chấm xong phần khác giữ kết quả đang đọc và ô đang gõ',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{editable:true,width:390});
 try{await remember(f);const field=f.page.locator('textarea[name="overview"]');await field.fill('Chữ mới cần giữ khi Outline hoàn tất');
 await field.evaluate(input=>{input.focus();input.setSelectionRange(6,10);window.__field=input;});
 f.state.pendingResult={attemptRef:'pending-outline',section:'outline',status:'completed',resultStatus:'passed',commentNumber:3,feedback:'Outline mới đã hoàn tất'};
 await f.page.getByText('Outline mới đã hoàn tất',{exact:true}).waitFor({state:'attached',timeout:12000});
 assert(await field.evaluate(input=>input===window.__field));assert.equal(await field.inputValue(),'Chữ mới cần giữ khi Outline hoàn tất');
 assert.deepEqual(await field.evaluate(input=>[document.activeElement===input,input.selectionStart,input.selectionEnd]),[true,6,10]);
 }finally{await f.close();await browser.close();}
});

test('Task 1 GV: không mang node kết quả sang người/phiên khác dù nội dung giống nhau',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{teacher:true,second:true});
 try{await remember(f);await f.page.getByRole('button',{name:'Đóng bài làm',exact:true}).click();
 await f.page.locator('.teacher-student-card').filter({hasText:'Người thử khác'}).click();
 await f.page.locator('#teacher-detail h2').filter({hasText:'Người thử khác'}).waitFor();
 assert.equal(await f.page.evaluate(()=>window.__reading.section.isConnected),false);
 assert.equal(await f.page.locator('#teacher-detail .feedback-content').count(),6);
 }finally{await f.close();await browser.close();}
});
