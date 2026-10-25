// Trình duyệt thật, API cách ly: kiểm vai trò, sửa/nộp, reload và quyền chỉ xem.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.MATERIALS_SITE_ROOT||resolve(fileURLToPath(new URL('../../',import.meta.url)));
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const site='https://tranhoangduc90.github.io/izone-ai-team-pages',entry=site+'/reading-skills67/materials-beyond-concrete/',api='/reading67-materials/api/reading-skills67';
const person={ownerId:'11111111-1111-4111-8111-111111111111',courseId:'1293',name:'Người học thử',className:'LOPTHU'};
const content={code:'67-reading-materials-beyond-concrete-matching-information-nen-cap-1',version:'fixture',title:'Bài Materials thử',subtitle:'Dữ liệu cách ly',instruction:'Chọn đoạn.',blankValues:[],dropdownPlaceholders:[],
 paragraphs:[...'ABCDEFGH'].map(id=>({id,text:'Đoạn đọc thử '+id,target:'p.'+id})),questions:[1,2,3,4].map(number=>({number,text:'Câu hỏi thử '+number,hint:'Gợi ý',targets:{radar:`q.${number}.radar`,evidence_l1:`q.${number}.evidence_l1`,section:`q.${number}.section`}}))};
content.targets=[...content.paragraphs.map(p=>({id:p.target,kind:'paragraph',paragraph:p.id})),...content.questions.flatMap(q=>Object.entries(q.targets).map(([kind,id])=>({id,kind,question:q.number})))];
function answers(){return Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='section'?'A':'Nội dung tự viết ban đầu']));}
function attempt(id,body,correct=false,revision=1){return {attemptId:id,runNo:1,status:'done',draftRevision:revision,createdAt:'2026-10-25T01:00:00.000Z',snapshot:structuredClone(body),completeness:{filled_cells:20},
 result:{feedback:Object.fromEntries(content.targets.map((t,i)=>[t.id,{status:correct||i>0?'correct':'partial',modelAnswer:'Đáp án thử',reason:'Cần giữ ý chính.',sourceMeaning:'Ý nguồn',nextStep:'Sửa bản nén.'}]))}};}
async function fixture(browser,width,teacher=false,options={}){
 const context=await browser.newContext({viewport:{width,height:options.height||900},locale:'vi-VN'}),page=await context.newPage();page.setDefaultTimeout(6000);
 const state={teacher,revision:1,body:{answers:answers(),notes:'Ghi chú giữ nguyên',flags:[],annotations:[]},attempts:[],writes:0,submits:0,errors:[],reads:[]};
 if(options.history){
  const old=attempt('old',state.body,options.allCorrect);
  if(options.repairIds)for(const t of content.targets)old.result.feedback[t.id].status=options.repairIds.includes(t.id)?(t.kind==='section'?'incorrect':t.id==='p.C'?'blank':'partial'):'correct';
  state.attempts=[old];
 }
 page.on('pageerror',e=>state.errors.push(e.message));
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url()),reply=(json,status=200)=>route.fulfill({json,status});
  if(u.href.startsWith('https://accounts.google.com/gsi/client'))return route.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(v){window.fixtureGoogleCallback=v.callback},renderButton(root){const b=document.createElement('button');b.textContent='Google thử cách ly';b.onclick=()=>window.fixtureGoogleCallback({credential:'fixture-google-only'});root.append(b)}}}};`});
  if(u.origin===new URL(site).origin&&u.pathname.startsWith('/izone-ai-team-pages/')){
   let file=resolve(root,decodeURIComponent(u.pathname.slice('/izone-ai-team-pages/'.length)));if(u.pathname.endsWith('/'))file=resolve(file,'index.html');
   if(!file.startsWith(root))return route.abort();
   try{return route.fulfill({body:await fs.readFile(file),contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'}[extname(file)]||'application/octet-stream'});}catch{return reply({},404);}
  }
  if(u.origin!=='https://ducizone.ddns.net')return route.abort();
  if(u.pathname.startsWith('/teacher-session-api/v1/restore/'))return reply({ok:state.teacher},state.teacher?200:401);
  if(u.pathname.endsWith('/shared-session'))return reply({ok:state.teacher},state.teacher?200:401);
  const path=u.pathname.slice(api.length);
  state.reads.push(path);
  if(path==='/config')return reply({code:content.code,title:content.title,autoRole:true,studentsOpen:true,homeworkEnabled:true,googleClientId:'fixture.apps.googleusercontent.com'});
  if(path==='/teacher/login'){state.teacher=true;return reply({ok:true});}
  if(path==='/teacher/classes')return reply({classes:[{id:'1293',classCode:'LOPTHU'}]},state.teacher?200:401);
  if(path.startsWith('/teacher/work/')){
   if(!state.teacher)return reply({error:'TEACHER_LOGIN_REQUIRED'},401);
   if(options.denied||state.denied)return reply({error:'ACCESS_DENIED'},403);
   if(path.includes('/attempts/')){const found=state.attempts.find(a=>a.attemptId===path.split('/').at(-1));return reply(found||{},found?200:404);}
   return reply({identity:person,content,draft:{body:state.body,revision:state.revision,runNo:1},attempts:state.attempts,archives:[],readonly:true});
  }
  if(path==='/classes')return reply({classes:[{id:'1293',classCode:'LOPTHU'}]});
  if(path==='/classes/1293/students')return reply({students:[{studentRef:person.ownerId,name:person.name}]});
  if(path==='/identity/resolve')return reply({ok:true,status:'unique',identity:{authority:'erp-contact',id:'12345'},aliases:[{studentRef:person.ownerId,classId:'1293',classCode:'LOPTHU',studentName:person.name}]});
  if(path==='/student/login')return reply({identity:person,token:'fixture-token'});
  if(path==='/lesson')return reply({identity:person,content});
  if(path==='/draft'){
   if(request.method()==='PUT'){const value=request.postDataJSON();assert.equal(value.baseRevision,state.revision);state.body=value.body;state.revision++;state.writes++;}
   return reply({body:state.body,revision:state.revision,runNo:1,completeness:{filled_cells:20},savedAt:'2026-10-25T02:00:00.000Z'});
  }
  if(path==='/attempts')return reply({attempts:state.attempts,archives:[]});
  if(path.startsWith('/attempts/'))return reply(state.attempts.find(a=>a.attemptId===path.split('/').at(-1))||{},state.attempts.some(a=>a.attemptId===path.split('/').at(-1))?200:404);
  if(path==='/submit'){state.submits++;const a=attempt('sent-'+state.submits,state.body,state.submits>1,state.revision);state.attempts.unshift(a);return reply(a,202);}
  if(path==='/homework')return reply({status:'verified',cta:'verified',jobs:[]});
  return reply({error:'UNKNOWN_FIXTURE_ROUTE'},404);
 });
 await page.goto(options.url||entry+(teacher?'?server=1&teacher=1&classId=1293&studentRef='+person.ownerId:'?server=1'));
 if(options.cold){await page.locator('#entry-class').waitFor();return {context,page,state};}
 if(!teacher){await page.locator('#entry-class').selectOption('1293');await page.locator('#entry-student').selectOption(person.ownerId);await page.getByRole('button',{name:'Vào bài',exact:true}).click();}
 await page.locator('.lesson-head').waitFor();
 return {context,page,state};
}
for(const width of [1440,390])test(`Sửa đến đạt toàn bộ, lưu nháp/reload, không tăng reset · ${width}px`,async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const f=await fixture(browser,width),{page,state}=f;
  await page.getByRole('button',{name:'Nộp bài',exact:true}).click();
  await page.getByRole('heading',{name:'Còn 1 phần cần sửa',exact:true}).waitFor();
  assert.equal(state.submits,1);await page.locator('#modal').getByRole('button',{name:'Tôi sẽ sửa',exact:true}).click();
  await page.locator('[data-target="p.A"]').fill('Nội dung đã được sửa');
  try{await page.getByText('Đã sửa — chờ chấm lại',{exact:true}).waitFor();}catch(error){
   console.error(JSON.stringify({width,value:await page.locator('[data-target="p.A"]').inputValue(),notes:await page.locator('.repair-field-note').allTextContents(),errors:state.errors}));
   if(process.env.MATERIALS_PROOF_DIR)await page.screenshot({path:resolve(process.env.MATERIALS_PROOF_DIR,`repair-failure-${width}.png`),fullPage:true});
   throw error;
  }
  await page.waitForFunction(()=>document.querySelector('#save-state')?.dataset.saveStatus==='saved');
  await page.reload();await page.locator('.repair-banner').waitFor();assert.equal(await page.locator('[data-target="p.A"]').inputValue(),'Nội dung đã được sửa');
  await page.locator('.repair-field-note').getByRole('button',{name:'Xem giải thích lần chấm trước'}).click();await page.locator('#explanation-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#explanation-dialog .answer-copy').textContent(),'Nội dung tự viết ban đầu');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Nộp lại bài',exact:true}).click();
  await page.getByRole('heading',{name:'Chúc mừng! Bạn đã sửa đúng toàn bộ bài.',exact:true}).waitFor();
  assert.equal(state.attempts.length,2);assert.equal(state.attempts[1].snapshot.answers['p.A'],'Nội dung tự viết ban đầu');
  assert.equal(state.body.notes,'Ghi chú giữ nguyên');assert.deepEqual(state.errors,[]);
  const dir=process.env.MATERIALS_PROOF_DIR;if(dir){await fs.mkdir(dir,{recursive:true});await page.screenshot({path:resolve(dir,`all-correct-${width}.png`),fullPage:true});}
 }finally{await browser.close();}
});
test('Google giảng viên ưu tiên; chuyển cách xem vẫn chỉ đọc và không ghi/nộp',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{const {page,state}=await fixture(browser,1440,true);
  await page.getByRole('button',{name:'Giảng viên',exact:true}).click();await page.getByRole('button',{name:'Xem như học viên · Chỉ xem'}).click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('materials-student-view')),true);
  assert.equal(await page.locator('textarea[data-target]:not([readonly])').count(),0);assert.equal(await page.locator('#grade-button').count(),0);
  await page.reload();await page.locator('.lesson-head').waitFor();assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('materials-student-view')),true);
  assert.equal(state.writes,0);assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
test('Chưa có phiên: nút Giảng viên giữ đúng link bài qua Google rồi trả về đúng người/lượt',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const target=entry+'?server=1&assignmentCode='+content.code+'&teacher=1&classId=1293&studentRef='+person.ownerId+'&attemptId=old';
  const {page,state}=await fixture(browser,390,false,{cold:true,history:true,url:target});
  await page.getByRole('button',{name:'Giảng viên',exact:true}).click();await page.locator('.materials-login-card').waitFor();
  const returning=new URL(new URL(page.url()).searchParams.get('returnTo'));
  for(const key of ['assignmentCode','classId','studentRef','attemptId'])assert.equal(returning.searchParams.get(key),new URL(target).searchParams.get(key));
  await page.getByRole('button',{name:'Google thử cách ly',exact:true}).click();await page.locator('.attempt-context').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('attemptId'),'old');assert.equal(await page.locator('#materials-role-label').textContent(),'Giao diện giảng viên');
  assert.equal(await page.locator('textarea[data-target]:not([readonly])').count(),0);assert.equal(state.submits,0);assert.equal(state.writes,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
test('Quay lại bản đã chấm vẫn thấy phần cần sửa; mở menu rồi Escape giữ nháp',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{const {page,state}=await fixture(browser,390,false,{history:true});
  await page.locator('.repair-banner').waitFor();assert.match(await page.locator('.repair-banner').textContent(),/Còn 1 phần/);
  await page.getByRole('button',{name:'Giảng viên',exact:true}).click();await page.getByRole('heading',{name:'Chuyển giao diện'}).waitFor();await page.keyboard.press('Escape');
  assert.equal(state.body.notes,'Ghi chú giữ nguyên');assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
test('Đã nhớ người học khác: đăng nhập giảng viên giữ đích gốc, không thay bằng người đang nhớ',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{const {page,state}=await fixture(browser,1440);
  const linked='22222222-2222-4222-8222-222222222222';
  await page.goto(entry+'?server=1&teacher=1&classId=1293&studentRef='+linked+'&attemptId=foreign');await page.locator('.lesson-head').waitFor();
  await page.getByRole('button',{name:'Giảng viên',exact:true}).click();await page.getByRole('button',{name:'Đăng nhập giảng viên',exact:true}).click();
  await page.locator('.materials-login-card').waitFor();const url=new URL(page.url());
  assert.equal(url.searchParams.get('studentRef'),linked);assert.equal(url.searchParams.get('attemptId'),'foreign');assert.equal(url.searchParams.get('mode'),'teacher');
  assert.equal(state.writes,0);assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
test('Link GV cũ mở theo học viên đã nhớ, không đọc attempt người khác; cả hai phiên ưu tiên GV',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{const {page,state}=await fixture(browser,320);
  await page.goto(entry+'?server=1&teacher=1&classId=1293&studentRef=22222222-2222-4222-8222-222222222222&attemptId=foreign');
  await page.locator('.lesson-head').waitFor();assert.equal(await page.locator('#materials-role-label').textContent(),'Giao diện học viên');
  assert.equal(state.reads.includes('/attempts/foreign'),false);assert.equal(await page.locator('textarea[data-target]:not([readonly])').count(),16);
  state.teacher=true;await page.goto(entry+'?server=1&classId=1293&studentRef='+person.ownerId);
  await page.locator('.lesson-head').waitFor();assert.equal(await page.locator('#materials-role-label').textContent(),'Giao diện giảng viên');
  assert.equal(await page.locator('textarea[data-target]:not([readonly])').count(),0);assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
test('Link lịch sử báo bản mới hơn; phiên Google thiếu quyền không lùi sang quyền học viên',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{const {page,state}=await fixture(browser,1440,true,{history:true});
  state.attempts.unshift(attempt('new',state.body,true,2));state.revision=3;
  await page.goto(entry+'?server=1&teacher=1&classId=1293&studentRef='+person.ownerId+'&attemptId=old');
  await page.getByRole('button',{name:'Xem bản mới nhất',exact:true}).waitFor();assert.match(await page.locator('.attempt-context').textContent(),/chưa nộp lại/);
  await page.getByRole('button',{name:'Xem bản mới nhất',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.attempt-context button'));
  state.denied=true;await page.reload();await page.getByRole('heading',{name:'Chưa mở được bài'}).waitFor();
  assert.equal(await page.locator('#entry-class').count(),0);assert.equal(state.writes,0);assert.equal(state.submits,0);
 }finally{await browser.close();}
});

const repairIds=['p.A','p.C','q.1.evidence_l1','q.4.section'];
async function assertRepairPosition(page,index){
 await page.waitForFunction(({id,position})=>document.querySelector('.repair-current')?.dataset.repairTarget===id&&document.querySelector('#repair-position')?.textContent===position,{id:repairIds[index],position:`Phần cần sửa ${index+1}/${repairIds.length}`});
 const field=page.locator('.repair-current');assert.equal(await field.count(),1);
 await page.waitForFunction(id=>document.activeElement?.dataset.target===id||document.activeElement?.dataset.repairTarget===id,repairIds[index]);
 const input=page.locator('[data-target="'+repairIds[index]+'"]');assert.equal(await input.isVisible(),true);
 const visible=await input.evaluate(el=>{const r=el.getBoundingClientRect(),pane=el.closest('.pane-scroll').getBoundingClientRect(),bar=document.querySelector('.repair-navigation').getBoundingClientRect();return r.top>=Math.max(0,pane.top,bar.bottom)-2&&r.bottom<=Math.min(innerHeight,pane.bottom)+2&&bar.top>=0&&bar.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;});
 assert.equal(visible,true,'Ô đích và thanh điều hướng phải cùng nhìn thấy, không tràn ngang');
 assert.equal(await page.getByRole('button',{name:'Phần cần sửa trước',exact:true}).isDisabled(),index===0);
 assert.equal(await page.getByRole('button',{name:'Phần cần sửa tiếp theo',exact:true}).isDisabled(),index===repairIds.length-1);
}
for(const [width,height] of [[1440,900],[390,844],[844,390]])test(`Điều hướng Trước/Tiếp đúng từng ô và giữ chỉ xem · ${width}x${height}`,async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const url=entry+'?server=1&teacher=1&classId=1293&studentRef='+person.ownerId+'&attemptId=old';
  const {page,state}=await fixture(browser,width,true,{history:true,repairIds,height,url});const before=structuredClone(state.body),history=structuredClone(state.attempts);
  await page.getByRole('button',{name:'Xem phần cần sửa ↓',exact:true}).click();await assertRepairPosition(page,0);
  assert.equal(await page.locator('.repair-current-label').textContent(),'Nén cấp 1 đoạn A');
  for(let i=1;i<repairIds.length;i++){await page.getByRole('button',{name:'Phần cần sửa tiếp theo',exact:true}).click();await assertRepairPosition(page,i);}
  assert.equal(await page.locator('.repair-current-label').textContent(),'Đáp án câu 4');
  for(let i=repairIds.length-2;i>=0;i--){await page.getByRole('button',{name:'Phần cần sửa trước',exact:true}).click();await assertRepairPosition(page,i);}
  await page.getByRole('button',{name:'Giảng viên',exact:true}).click();await page.getByRole('button',{name:'Xem như học viên · Chỉ xem'}).click();
  await assertRepairPosition(page,0);await page.getByRole('button',{name:'Phần cần sửa tiếp theo',exact:true}).click();await assertRepairPosition(page,1);
  assert.equal(await page.locator('textarea[data-target]:not([readonly])').count(),0);assert.equal(await page.locator('select[data-target]:not([disabled])').count(),0);
  assert.equal(state.writes,0);assert.equal(state.submits,0);assert.deepEqual(state.body,before);assert.deepEqual(state.attempts,history);assert.deepEqual(state.errors,[]);
  if(process.env.MATERIALS_PROOF_DIR){await fs.mkdir(process.env.MATERIALS_PROOF_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.MATERIALS_PROOF_DIR,`repair-navigation-${width}x${height}.png`),fullPage:true});}
 }finally{await browser.close();}
});
test('Học viên sửa vẫn giữ danh sách/kịp vị trí đến lần chấm mới; reload giữ nháp và lịch sử',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const {page,state}=await fixture(browser,390,false,{history:true,repairIds,height:844});await page.locator('.repair-banner').waitFor();
  const history=structuredClone(state.attempts);await page.getByRole('button',{name:'Phần cần sửa tiếp theo',exact:true}).click();await assertRepairPosition(page,0);
  await page.getByRole('button',{name:'Phần cần sửa tiếp theo',exact:true}).click();await assertRepairPosition(page,1);
  await page.locator('[data-target="p.C"]').fill('Đã viết lại bản nén đoạn C');await page.getByText('Đã sửa — chờ chấm lại',{exact:true}).waitFor();await assertRepairPosition(page,1);
  assert.match(await page.locator('.repair-banner').textContent(),/Còn 4 phần/);
  await page.waitForFunction(()=>document.querySelector('#save-state')?.dataset.saveStatus==='saved');await page.reload();await page.locator('.repair-banner').waitFor();
  assert.equal(await page.locator('[data-target="p.C"]').inputValue(),'Đã viết lại bản nén đoạn C');assert.deepEqual(state.attempts,history);
  await page.getByRole('button',{name:'Phần cần sửa tiếp theo',exact:true}).click();await assertRepairPosition(page,0);
  assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
test('Chuyển từ bản đã chấm sang sửa giữ đúng ô đang xem; kết quả mới đặt lại danh sách',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const url=entry+'?server=1&attemptId=old';const {page,state}=await fixture(browser,1440,false,{history:true,repairIds,url});
  await page.getByRole('button',{name:'Xem phần cần sửa ↓',exact:true}).click();await assertRepairPosition(page,0);
  await page.getByRole('button',{name:'Phần cần sửa tiếp theo',exact:true}).click();await assertRepairPosition(page,1);
  await page.locator('.repair-banner').getByRole('button',{name:'Tôi sẽ sửa',exact:true}).click();await page.locator('#grade-button').waitFor();await assertRepairPosition(page,1);
  await page.getByRole('button',{name:'Nộp lại bài',exact:true}).click();await page.getByRole('heading',{name:'Còn 1 phần cần sửa',exact:true}).waitFor();
  await page.locator('#modal').getByRole('button',{name:'Tôi sẽ sửa',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#repair-position')?.textContent==='Phần cần sửa 1/1');
  assert.equal(await page.locator('.repair-current').getAttribute('data-repair-target'),'p.A');assert.equal(await page.getByRole('button',{name:'Phần cần sửa tiếp theo',exact:true}).isDisabled(),true);
  assert.equal(state.attempts.length,2);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
test('Đạt toàn bộ: không còn nút xem lỗi hoặc thanh Trước/Tiếp',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const url=entry+'?server=1&teacher=1&classId=1293&studentRef='+person.ownerId+'&attemptId=old';const {page,state}=await fixture(browser,390,true,{history:true,allCorrect:true,url});
  await page.locator('.repair-banner[data-state="success"]').waitFor();assert.equal(await page.locator('[data-action="repair-start"],.repair-navigation,.repair-current').count(),0);
  assert.equal(state.writes,0);assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
