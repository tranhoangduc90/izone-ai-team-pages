import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';

const imported=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=imported.chromium?imported:imported.default;
const A='70000000-0000-4000-8000-000000000001',B='70000000-0000-4000-8000-000000000002';
const when='2026-10-19T02:00:00.000Z';

for(const family of ['k67','k56'])test(`Term/Mini ${family}: từ CTA tới đúng bài/lớp; xem nháp, giữ lượt cũ, chặn phản hồi muộn/hết phiên và audio`,async t=>{
 const testSlug=family==='k56'?'term-test-1-k56':'term-test-1',teacherFolder=family==='k56'?'teacher-k56':'teacher';
 const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true});
 t.after(async()=>{await browser.close();await server.close();});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(8000);
 const errors=[],forbidden=[],calls=[];let delayA=false,signed=true;
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{if(location.hostname==='127.0.0.1'&&!localStorage.getItem('fixture-draft'))localStorage.setItem('fixture-draft','Nháp cần giữ');});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(req.resourceType()==='media'||/\.(mp3|wav|ogg|enc)(?:$|\?)|\/(?:audio|preview|audio-access)(?:\/|$)/i.test(url.href)){forbidden.push(url.href);return route.abort();}
  if(url.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){},disableAutoSelect(){}}}};'});
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname!=='ducizone.ddns.net'){forbidden.push(url.href);return route.abort();}
  calls.push({path,method:req.method()});if(req.method()!=='GET'){forbidden.push(req.method()+' '+path);return route.abort();}
  if(!signed)return route.fulfill({status:401,json:{ok:false,error:'LOGIN_REQUIRED'}});
  const reviewer={email:'teacher@fixture.test',displayName:'GV thử',role:'teacher'},cls={id:'1293',name:'IC2304',accessMode:'assigned_teacher',isAssignedTeacher:true};
  if(path.endsWith('/api/auth/session'))return route.fulfill({json:{ok:true,reviewer}});
  if(path.endsWith('/teacher/options'))return route.fulfill({json:{ok:true,reviewer,classes:[cls],tests:[{slug:testSlug,title:'Term Test 1',version:1}]}});
  if(path.endsWith('/teacher/results'))return route.fulfill({json:{ok:true,reviewer,class:cls,test:{slug:testSlug,title:'Term Test 1'},students:[{ref:A,name:'Học viên A',status:'incomplete'},{ref:B,name:'Học viên B',status:'not_started'}]}});
  if(path.endsWith('/teacher/saved-progress')){
   const ref=url.searchParams.get('student');if(ref===A&&delayA)await new Promise(r=>setTimeout(r,300));
   const attempt=(old=false)=>({viewId:(old?'a':'b').repeat(64),definitionVersion:1,createdAt:when,superseded:old,order:'read_first',delivery:'cbt',
    listening:{answers:{'11':old?'A cũ':'B mới'},startedAt:when,savedAt:when},reading:{answers:{'14':'Câu trả lời '+(ref===A?'A':'B')},startedAt:when,savedAt:when},
    writing:{task2:'Bản Writing '+(ref===A?'A':'B')+(old?' cũ':' mới'),startedAt:when,savedAt:when}});
   return route.fulfill({json:{ok:true,student:{ref,name:ref===A?'Học viên A':'Học viên B'},attempts:ref===A?[attempt(true),attempt()]:[attempt()]}}).catch(()=>{});
  }
  // Trang học viên chỉ cần giữ lối vào khi nguồn roster lỗi; không giả vờ mở bài thành công.
  return route.fulfill({status:401,json:{ok:false,error:'FIXTURE_NOT_OPEN',message:'Bộ thử không mở lượt học viên.'}});
 });
 await page.goto(server.base+`term-tests/${teacherFolder}/?class=IC2304&test=${testSlug}&student=${A}`);
 await page.getByRole('button',{name:'Xem tiến trình đã lưu'}).click();
 const dialog=page.getByRole('dialog');await dialog.getByText('Bản Writing A mới',{exact:true}).waitFor();
 await dialog.getByLabel('Lượt làm').selectOption('a'.repeat(64));await dialog.getByText('Bản Writing A cũ',{exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
 delayA=true;await page.getByRole('button',{name:'Xem tiến trình đã lưu'}).click();await dialog.getByText('Đang đọc lại bản đã lưu…',{exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Đóng',exact:true}).click();await page.getByRole('tab',{name:/Học viên B/}).click();
 await page.getByRole('button',{name:'Xem tiến trình đã lưu'}).click();await dialog.getByText('Bản Writing B mới',{exact:true}).waitFor();await page.waitForTimeout(350);
 assert.equal((await dialog.innerText()).includes('Bản Writing A'),false);
 await page.setViewportSize({width:390,height:844});assert.equal(await dialog.evaluate(el=>el.getBoundingClientRect().width<=innerWidth),true);
 const output=process.env.TEACHER_EVIDENCE_DIR;if(output){await mkdir(output,{recursive:true});await page.screenshot({path:join(output,`term-${family}-saved-progress-mobile.png`),fullPage:true});}
 signed=false;await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();await dialog.waitFor({state:'detached'});
 assert.equal((await page.locator('body').innerText()).includes('Bản Writing B'),false);signed=true;
 for(const slug of family==='k56'?['term-test-1-k56','term-test-2-k56','mini-test-k56']:['term-test-1','term-test-2','mini-test-lesson-5'])for(const suffix of ['', '-computer-based']){
  await page.goto(server.base+`term-tests/${slug}${suffix}/?class=IC2304`);
  const entry=page.locator('[data-teacher-entry]');await entry.waitFor();const href=new URL(await entry.getAttribute('href'));
  assert.equal(href.pathname,`/term-tests/${teacherFolder}/index.html`);assert.equal(href.searchParams.get('test'),slug);assert.equal(href.searchParams.get('class'),'IC2304');
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-draft')),'Nháp cần giữ');assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 assert.equal(calls.some(c=>/\/(open|begin|pulse|submit|audio-access)$/.test(c.path)),false);
});
