import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Trang thật, tài khoản và API giả: không gửi yêu cầu ra máy chủ hoặc tải audio.
const imported=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=imported.chromium?imported:imported.default;
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const output=process.env.TEACHER_EVIDENCE_DIR||join(root,'output/playwright/teacher-existing');
const token='30000000-0000-4000-8000-000000000001';
const assignmentId='40000000-0000-4000-8000-000000000001';

test('Lối GV của Writing, Handout 5/7/9 và Progress Log giữ ngữ cảnh, nháp; chỉ đọc dashboard',async t=>{
 const server=createServer(async(req,res)=>{
   const url=new URL(req.url,'http://localhost');let path=resolve(root,'.'+decodeURIComponent(url.pathname));
   if(!path.startsWith(root+sep))return res.writeHead(403).end();
   if(url.pathname.endsWith('/'))path=join(path,'index.html');
   try{const bytes=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch({channel:'msedge',headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1440,height:1000}});t.after(()=>context.close());
 const calls=[],unexpected=[],errors=[];let teacherMode=false;
 context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
 await context.addInitScript(()=>{if(location.hostname==='127.0.0.1'&&!localStorage.getItem('fixture-identity')){localStorage.setItem('fixture-identity','HV cần giữ');localStorage.setItem('fixture-draft','Nháp cần giữ');}});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){},disableAutoSelect(){}}}};'});
  if(url.hostname!=='ducizone.ddns.net'){unexpected.push(url.href);return route.abort();}
  calls.push({path:p,query:url.search,method:req.method(),teacher:teacherMode});
  if(teacherMode&&req.method()!=='GET'){unexpected.push(req.method()+' '+p);return route.abort();}
  if(p.startsWith('/api/handout67/v1/lessons/')){
   const activity=p.split('/').at(-1),number=Number(activity.slice(6));
   return route.fulfill({json:{ok:true,lesson:{activity,number,title:'Đề kiểm thử',shortTitle:'Đề thử',body:number===9?1:2,classes:['IC2304','IC2305'],defaultClass:'IC2304',workflowMode:number===9?'whole-chain-v1':'guided-bax-v1',whyOptions:['Lý do 1','Lý do 2'],aInstruction:'Hướng dẫn thử',ideaHint:'Ý tưởng'}}});
  }
  if(p==='/api/handout67/v1/roster')return route.fulfill({json:{ok:true,classes:[]}});
  if(p==='/api/handout67/v1/teacher/session')return route.fulfill({json:{ok:true,reviewer:{email:'fixture@example.test'}}});
  if(p==='/api/handout67/v1/teacher/config')return route.fulfill({json:{ok:true,clientId:'fixture'}});
  if(p==='/api/handout67/v1/teacher/classes')return route.fulfill({json:{ok:true,classes:[{classRef:'IC2304',className:'Lớp A'},{classRef:'IC2305',className:'Lớp B'}]}});
  if(p==='/api/handout67/v1/teacher/students')return route.fulfill({json:{ok:true,students:[]}});
  if(p==='/mapping-api/api/auth/session')return route.fulfill({json:{ok:true}});
  if(p.endsWith('/api/v1/auth/session'))return route.fulfill({json:{ok:true}});
  if(p.includes('/api/v1/admin/live/activities/')){
   const students=['A','B'].map((suffix,i)=>({studentRef:'writing-'+suffix,displayName:'HV Writing '+suffix,classRef:'class-'+suffix.toLowerCase(),className:i?'IC2305':'IC2304',responses:{overview:'Nháp Writing '+suffix},sections:{}}));
   const selected=url.searchParams.get('classRef');
   return route.fulfill({json:{students:selected?students.filter(s=>s.classRef===selected):students,generatedAt:'2026-10-19T02:00:00Z',permissions:{canManage:false}}});
  }
  if(p.includes('/api/v1/admin/activities/')&&p.endsWith('/provisional-students'))return route.fulfill({json:{students:[]}});
  if(p==='/mapping-api/api/learning/teacher/options')return route.fulfill({json:{ok:true,reviewer:{name:'GV thử'},classes:[{class_id:'1124',class_name:'Lớp A'},{class_id:'1125',class_name:'Lớp B'}],assignments:[{assignment_id:'newer',public_token:'other',class_id:'1124',title:'Phiếu khác',session_number:9},{assignment_id:assignmentId,public_token:token,class_id:'1125',class_name:'Lớp B',title:'Đúng phiếu',session_number:2}]}});
  if(p==='/mapping-api/api/learning/teacher/question-library')return route.fulfill({json:{ok:true,items:[]}});
  if(p==='/mapping-api/api/learning/teacher/dashboard')return route.fulfill({json:{ok:true,dashboard:{assignmentId,classId:'1125',className:'Lớp B',title:'Đúng phiếu',sessionNumber:2,students:[],blockReleases:[],classInsights:[],definition:{}}}});
  // Các phần phụ chỉ đọc không có dữ liệu giả. Không cho fixture giả hành vi ghi thành công.
  if(teacherMode&&p.includes('/learning/teacher/'))return route.fulfill({status:503,json:{ok:false,message:'Phần phụ không có dữ liệu trong bộ thử.'}});
  return route.fulfill({status:401,json:{ok:false,error:'LOGIN_REQUIRED',message:'Chỉ có dữ liệu thử cho lối giảng viên.'}});
 });
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const entry of ['index.html?task=pie-app-users-by-age&class=IC2305','lesson.html?task=writing-task2-living-alone-development&class=IC2305']){
  teacherMode=false;const page=await context.newPage();await page.goto(base+'/writing-handouts/'+entry);
  const link=page.locator('[data-teacher-entry]');await link.waitFor();const href=new URL(await link.getAttribute('href'));
  assert.equal(href.pathname,'/writing-handouts/teacher.html');assert.equal(href.searchParams.get('class'),'IC2305');assert.ok(href.searchParams.get('task'));
  teacherMode=true;const teacher=await context.newPage();await teacher.goto(href.href);
  await teacher.locator('#teacher-dashboard').waitFor({state:'visible'});
  assert.equal(await teacher.locator('#teacher-class').inputValue(),'class-b');
  assert.match(await teacher.locator('#teacher-students').innerText(),/HV Writing B/);
  assert.equal((await teacher.locator('#teacher-students').innerText()).includes('HV Writing A'),false);
  await teacher.reload();await teacher.locator('#teacher-dashboard').waitFor({state:'visible'});assert.equal(await teacher.locator('#teacher-class').inputValue(),'class-b');
  await teacher.close();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-draft')),'Nháp cần giữ');await page.close();
 }
 const wrongWriting=await context.newPage();teacherMode=true;
 await wrongWriting.goto(base+'/writing-handouts/teacher.html?task=pie-app-users-by-age&class=UNKNOWN');
 await wrongWriting.locator('#teacher-login-error').filter({hasText:'Không tìm thấy lớp'}).waitFor();
 assert.equal(await wrongWriting.locator('#teacher-dashboard').isVisible(),false);await wrongWriting.close();
 for(const n of [5,7,9]){
  teacherMode=false;const page=await context.newPage();await page.goto(`${base}/writing-handouts/lesson${n}/?class=IC2305`);
  const link=page.locator('[data-teacher-entry]');await link.waitFor();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);teacherMode=true;
  const popupPromise=page.waitForEvent('popup');await link.click();const teacher=await popupPromise;
  await teacher.locator('#dashboard').waitFor({state:'visible'});assert.equal(await teacher.locator('#class-select').inputValue(),'IC2305');
  assert.ok(calls.some(c=>c.teacher&&c.path.endsWith('/teacher/students')&&c.query.includes('class=IC2305')&&c.query.includes('activity=lesson'+n)));
  await teacher.setViewportSize({width:390,height:844});assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mkdir(output,{recursive:true});await teacher.screenshot({path:join(output,`handout${n}-entry-mobile.png`),fullPage:true});
  await teacher.close();assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-identity')),'HV cần giữ');await page.close();
 }
 teacherMode=false;const page=await context.newPage();await page.goto(`${base}/progress-log/#assignment=${token}`);
 const link=page.locator('[data-teacher-entry]');await link.waitFor();assert.equal(new URL(await link.getAttribute('href')).hash,'#assignment='+token);teacherMode=true;
 const popupPromise=page.waitForEvent('popup');await link.click();const teacher=await popupPromise;
 await teacher.locator('#teacherWorkspace').waitFor({state:'visible'});assert.equal(await teacher.locator('#assignmentSelect').inputValue(),assignmentId);
 assert.equal(await teacher.locator('#overviewClassSelect').inputValue(),'1125');
 await teacher.waitForFunction(id=>document.querySelector('#dashboardTitle').textContent.includes('Đúng phiếu'),assignmentId);
 assert.ok(calls.some(c=>c.teacher&&c.path.endsWith('/teacher/dashboard')&&c.query==='?assignment='+assignmentId));
 await teacher.reload();await teacher.locator('#teacherWorkspace').waitFor({state:'visible'});assert.equal(await teacher.locator('#assignmentSelect').inputValue(),assignmentId);
 await teacher.setViewportSize({width:390,height:844});assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await teacher.screenshot({path:join(output,'progress-log-entry-mobile.png'),fullPage:true});
 const beforeDenied=calls.filter(c=>c.path.endsWith('/teacher/dashboard')).length;
 await teacher.goto(`${base}/progress-log/teacher.html#assignment=not-authorized`);
 await teacher.locator('#teacherNotice').filter({hasText:'chưa có quyền'}).waitFor();
 assert.equal(await teacher.locator('#teacherWorkspace').isVisible(),false);
 assert.equal(calls.filter(c=>c.path.endsWith('/teacher/dashboard')).length,beforeDenied);
 assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-draft')),'Nháp cần giữ');
 await teacher.close();await page.close();assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
});
