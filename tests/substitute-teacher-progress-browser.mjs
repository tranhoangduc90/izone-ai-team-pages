import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve } from './helpers/result-details-browser-fixture.mjs';
const imported=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=imported.chromium?imported:imported.default;
const when='2026-10-19T02:00:00.000Z',viewA='a'.repeat(64),viewB='b'.repeat(64),old='c'.repeat(64);

for(const suffix of ['1-k56','2-k56','1-k67','2-k67'])test('Substitute '+suffix+': CTA, Google, tiến trình trước nộp, lịch sử/A–B và giữ nháp',async t=>{
 const slug='substitute-test-'+suffix,server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true});
 t.after(async()=>{await browser.close();await server.close();});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(7000);
 let signed=true,delayA=false,many=false;const errors=[],forbidden=[],calls=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(()=>localStorage.setItem('fixture-student-draft','Nháp cần giữ nguyên'));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(req.resourceType()==='media'||/\.(mp3|wav|ogg|enc)$/.test(path)){forbidden.push(path);return route.abort();}
  if(url.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(options){window.fakeTeacherSignIn=options.callback},renderButton(){},disableAutoSelect(){}}}};'});
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname!=='ducizone.ddns.net'){forbidden.push(url.href);return route.abort();}
  if(path.startsWith('/webhook/')){
   const data=JSON.parse(req.postData()||'{}');calls.push(data.route);
   if(!['/api/test/history','/api/test/catalog','/api/test/roster'].includes(data.route)){forbidden.push(data.route);return route.abort();}
   return route.fulfill({status:503,json:{ok:false,code:'FIXTURE_NOT_OPEN',message:'Bộ thử không mở lượt học viên.'}});
  }
  calls.push(path);if(req.method()!=='GET'){forbidden.push(req.method()+' '+path);return route.abort();}
  if(path.endsWith('/teacher/config'))return route.fulfill({json:{googleClientId:'fake.apps.googleusercontent.com'}});
  if(!signed)return route.fulfill({status:401,json:{ok:false,code:'LOGIN_REQUIRED'}});
  if(path.endsWith('/teacher/scopes'))return route.fulfill({json:{scopes:[{testSlug:slug,classCode:'DEMO'}]}});
  if(path.endsWith('/teacher/results'))return route.fulfill({json:{testSlug:slug,classCode:'DEMO',results:[],hasMore:false}});
  const summary=(viewId,historical=false)=>({viewId,startedAt:when,updatedAt:when,historical,status:'sections_submitted',savedSections:['listening'],submittedAt:null});
  if(path.endsWith('/progress/students')){const offset=Number(url.searchParams.get('offset')||0);const students=many?Array.from({length:102},(_,i)=>({studentRef:'page-'+i,studentName:'Học viên trang '+i,status:'not_started',progress:[]})):[
   {studentRef:'student-A',studentName:'Học viên A',status:'sections_submitted',progress:[summary(viewA),summary(old,true)]},
   {studentRef:'student-B',studentName:'Học viên B',status:'opened',progress:[summary(viewB)]},
   {studentRef:'student-C',studentName:'Học viên C',status:'not_started',progress:[]}];return route.fulfill({json:{testSlug:slug,classCode:'DEMO',students:students.slice(offset,offset+100),offset,limit:100,hasMore:offset+100<students.length}});}
  if(path.endsWith('/progress/detail')){
   const student=url.searchParams.get('student'),view=url.searchParams.get('view');
   if(student==='student-A'&&delayA)await new Promise(resolve=>setTimeout(resolve,300));
   return route.fulfill({json:{testSlug:slug,classCode:'DEMO',studentRef:student,studentName:student==='student-A'?'Học viên A':'Học viên B',
    progress:{...summary(view,view===old),listening:{availability:'available',submittedAt:when,answers:[{number:1,answer:student==='student-A'?(view===old?'Đáp án A lịch sử':'Đáp án A hiện tại'):'Đáp án B'}]},
     reading:{availability:'local_only'},writing:{availability:'local_only',tasks:[]}}}}).catch(()=>{});
  }
  forbidden.push(path);return route.fulfill({status:404,json:{ok:false}});
 });
 await page.goto(server.base+`term-tests/${slug}-results/?class=DEMO&test=${slug}`);
 await page.waitForFunction(()=>typeof window.fakeTeacherSignIn==='function');
 await page.evaluate(()=>window.fakeTeacherSignIn({credential:'fake-valid-token'}));
 await page.getByRole('button',{name:'Tiến trình đã lưu',exact:true}).click();
 const panel=page.locator('.substitute-progress');
 await panel.getByRole('button',{name:/Học viên A/}).click();await panel.getByText('Đáp án A hiện tại',{exact:true}).waitFor();
 await panel.getByLabel('Lượt Substitute').selectOption(old);await panel.getByText('Đáp án A lịch sử',{exact:true}).waitFor();
 assert.ok((await panel.innerText()).includes('Máy chủ chưa nhận nội dung này.'));
 await panel.getByRole('button',{name:/Học viên C/}).click();await panel.getByText('Chưa có lượt hoặc nội dung lưu trên máy chủ.',{exact:true}).waitFor();
 delayA=true;await panel.getByRole('button',{name:/Học viên A/}).click();await panel.getByRole('button',{name:/Học viên B/}).click();
 await panel.getByText('Đáp án B',{exact:true}).waitFor();await page.waitForTimeout(350);assert.equal((await panel.innerText()).includes('Đáp án A'),false);
 await page.setViewportSize({width:390,height:844});assert.equal(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 if(process.env.TEACHER_EVIDENCE_DIR){await mkdir(process.env.TEACHER_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.TEACHER_EVIDENCE_DIR,`${slug}-teacher-progress-mobile.png`),fullPage:true});}
 if(suffix==='1-k67'){
  many=true;await panel.getByRole('button',{name:'Cập nhật tiến trình',exact:true}).click();
  await panel.getByRole('button',{name:'Xem trang học viên tiếp theo',exact:true}).click();
  await panel.getByRole('button',{name:/Học viên trang 100/}).waitFor();
  await panel.getByRole('button',{name:'Cập nhật tiến trình',exact:true}).click();
  await panel.getByRole('button',{name:/Học viên trang 101/}).waitFor();
  assert.equal(await panel.getByRole('button',{name:/^Học viên trang 0 ·/}).count(),0);
  await panel.getByRole('button',{name:'Trang học viên trước',exact:true}).click();
  await panel.getByRole('button',{name:/^Học viên trang 0 ·/}).waitFor();
 }
 signed=false;await panel.getByRole('button',{name:'Cập nhật tiến trình',exact:true}).click();await panel.waitFor({state:'hidden'});
 assert.equal((await page.locator('body').innerText()).includes('Đáp án B'),false);
 signed=true;await page.goto(server.base+`term-tests/${slug}-results/?class=IC9999&test=${slug}`);
 await page.waitForFunction(()=>typeof window.fakeTeacherSignIn==='function');const deniedStart=calls.length;
 await page.evaluate(()=>window.fakeTeacherSignIn({credential:'fake-valid-token'}));
 await page.getByText('Bạn chưa có quyền xem lớp trong link này. Hãy mở lại từ bài được giao.',{exact:true}).waitFor();
 assert.equal(calls.slice(deniedStart).some(path=>path.endsWith('/teacher/results')||path.includes('/progress/')),false);
 await page.goto(server.base+`term-tests/${slug}-computer-based/?class=DEMO`);
 const entry=page.locator('[data-teacher-entry]');await entry.waitFor();const href=new URL(await entry.getAttribute('href'));
 assert.equal(href.pathname,`/term-tests/${slug}-results/index.html`);assert.equal(href.searchParams.get('test'),slug);assert.equal(href.searchParams.get('class'),'DEMO');
 assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-student-draft')),'Nháp cần giữ nguyên');
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 assert.equal(calls.some(path=>/\/(session|grade|writing|submit|audio-ended)$/.test(path)),false);
});
