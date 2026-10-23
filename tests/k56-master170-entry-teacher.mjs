// Entry/giảng viên chạy với HTML/renderer thật và API giả bị chặn trước mạng.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {chromium,serve,slugs} from './helpers/k56-design-fixture.mjs';
let browser,server;
const output=resolve(process.env.K56_DESIGN_OUTPUT||'output/playwright/k56-master170');
before(async()=>{await mkdir(output,{recursive:true});server=await serve();browser=await chromium.launch({channel:'msedge',headless:true});});
after(async()=>{await browser?.close();await server?.close();});
async function fixture({teacher=false}={}){
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1366,height:768}}),page=await context.newPage(),calls=[],errors=[];
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 const content={};for(const slug of slugs){
  const sandbox={window:{}};
  const passage=await readFile('term-tests/'+slug+'-computer-based/passages.js','utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
  if(passage)vm.runInNewContext(passage,sandbox);
  vm.runInNewContext(await readFile('term-tests/'+slug+'-computer-based/content.js','utf8'),sandbox);content[slug]=sandbox.window.K56_TERM_TEST_CONTENT;
 }
 let selected='term-test-1-k56',signedIn=teacher;
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};'});
  if(url.pathname.endsWith('/k56-shared/config.js'))return route.fulfill({contentType:'text/javascript',body:`window.TERM_TEST_APP_CONFIG={API_BASE_URL:'${server.base}fixture',API_BASE_URLS:['${server.base}fixture'],API_FOR_CLASS:()=> '${server.base}fixture',GOOGLE_CLIENT_ID:'synthetic'};`});
  if(url.pathname.includes('/api/')){
   calls.push({method:request.method(),path:url.pathname});let data={ok:true};
   if(url.pathname.endsWith('/auth/session')){
    if(request.method()==='DELETE')signedIn=false;
    if(!signedIn&&request.method()==='GET')return route.fulfill({status:401,json:{ok:false}});
   }else if(url.pathname.includes('/teacher/options'))data={ok:true,reviewer:{displayName:'Giảng viên giả'},classes:[{id:'class-1',name:'IC9999'}],tests:slugs.map((slug,i)=>({slug,title:['Term Test 1','Term Test 2','Mini Test'][i],scoreMode:'raw',sectionTotals:{listening:i===2?10:40,reading:[26,40,13][i]},writingTasks:[i===1?1:2]}))};
   else if(url.pathname.includes('/teacher/results')){
    selected=url.searchParams.get('test')||selected;
    data={ok:true,students:[{ref:'student-1',name:'Học viên giả có tên dài để kiểm bảng',status:'completed',completedAt:new Date().toISOString(),writing:{status:'processing',task2State:'submitted'},result:{testTitle:'Bài thi giả',listening:{correct:20,total:40,details:[],typeStats:[]},reading:{correct:18,total:26,details:[],typeStats:[]},performance:{best:[],needsImprovement:[],other:[]}}}]};
   }else if(url.pathname.includes('/teacher/attempt-review'))data={ok:true,review:{testSlug:selected,studentName:'Học viên giả có tên dài để kiểm bảng',content:content[selected],answers:{listening:{1:'ANSWER'},reading:{1:'TRUE'},writing:{task1:'Bài giả được giữ nguyên để kiểm xem bài.',task2:'Bài giả được giữ nguyên để kiểm xem bài.'}}}};
   else if(url.pathname.includes('/teacher/saved-progress'))data={ok:true,student:{ref:'student-1'},attempts:[{viewId:'saved-1',order:'lis_first',delivery:'cbt',definitionVersion:1,createdAt:new Date().toISOString(),listening:{answers:{1:'Nháp giả'}},reading:{answers:{}},writing:{task2:'Bài nháp giả có dấu tiếng Việt.'}}]};
   else if(url.pathname.includes('roster'))data={ok:true,class:{name:'IC9999'},students:[{ref:'student-1',name:'Học viên giả'}]};
   else return route.fulfill({status:503,json:{ok:false,message:'Fixture không mở/nộp bài'}});
   return route.fulfill({json:data});
  }
  if(/\.mp3$/.test(url.pathname))return route.fulfill({status:503,body:'Audio fixture lỗi tải'});
  if(url.href.startsWith(server.base))return route.continue();
  return route.abort();
 });
 return{page,context,calls,errors,close:()=>context.close()};
}
for(const slug of slugs)for(const delivery of ['','-computer-based'])for(const mode of ['lis_first','read_first'])test('Landing → '+slug+delivery+'/'+mode,async()=>{
 const f=await fixture();try{
  await f.page.goto(server.base+'term-tests/k56-demo/');
  await f.page.locator('#classCode').fill('IC9999');
  await f.page.locator('[data-mode='+mode+']').click();
  await f.page.locator(delivery?'[data-test="'+slug+delivery+'"]':'[data-destination="'+slug+'"] ').click();
  await f.page.waitForURL('**/'+slug+delivery+'/?**');
  const url=new URL(f.page.url());assert.equal(url.searchParams.get('class'),'IC9999');assert.equal(url.searchParams.get('mode'),mode);
  assert(!f.calls.some(c=>/\/(listening|reading|writing|start)$/.test(c.path)));
 }finally{await f.close();}
});
test('Landing: desktop/mobile có lựa chọn lớp, thứ tự, ba bài và hỗ trợ tách nhóm',async()=>{
 const f=await fixture({teacher:true});try{
  await f.page.goto(server.base+'term-tests/k56-demo/');await f.page.evaluate(()=>document.fonts.ready);
  for(const width of [1366,390,320]){
   await f.page.setViewportSize({width,height:844});assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(width!==320)await f.page.screenshot({path:resolve(output,'landing-'+width+'.png'),fullPage:true});
  }
  assert.equal(await f.page.locator('.k56-brand img').count(),1);assert.equal(await f.page.locator('[data-test]').count(),3);
  assert.equal(await f.page.locator('#demoClassEntry,.landing-demo').count(),0,'Không có lối vào demo trùng ở cuối trang');
  await f.page.waitForFunction(()=>document.querySelector('#classSelect option[value="CODEXDEMO56"]'));
  assert.equal(await f.page.locator('#classSelect option[value="CODEXDEMO56"]').count(),1,'Demo vẫn có trong chọn lớp');
 }finally{await f.close();}
});
for(const slug of slugs)test(slug+': audio dự phòng lỗi tải giữ phát khóa và có thử lại',async()=>{
 const f=await fixture();try{
  await f.page.goto(server.base+'term-tests/'+slug+'-audio/?class=IC9999');
  await f.page.locator('#retryAudio').waitFor({state:'visible'});
  assert.equal(await f.page.locator('#playAudio').isDisabled(),true);
  await f.page.setViewportSize({width:390,height:844});
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await f.page.screenshot({path:resolve(output,slug+'-audio-error.png'),fullPage:true});
 }finally{await f.close();}
});
test('Giảng viên: bảng, bản lưu, toàn bài, dialog an toàn và logout',async()=>{
 const f=await fixture({teacher:true});try{
  await f.page.goto(server.base+'term-tests/teacher-k56/?class=IC9999');await f.page.locator('#dashboardView').waitFor({state:'visible'});
  await f.page.evaluate(()=>document.fonts.ready);await f.page.screenshot({path:resolve(output,'teacher-desktop.png')});
  await f.page.locator('[data-open-student]').first().click();
  const opener=f.page.getByRole('button',{name:'Xem lại toàn bộ bài làm',exact:true});
  await opener.click();
  const dialog=f.page.locator('.attempt-review-dialog');
  await dialog.locator('[data-review-skill=writing]').click();
  await f.page.waitForFunction(()=>document.querySelector('.attempt-review-dialog')?.dataset.k56Dialog==='true');
  assert.match(await dialog.innerText(),/Bài giả được giữ nguyên/);
  await f.page.screenshot({path:resolve(output,'teacher-attempt.png')});
  const box=await dialog.boundingBox();
  await f.page.mouse.move(box.x+60,box.y+60);await f.page.mouse.down();await f.page.mouse.move(5,5);await f.page.mouse.up();
  assert.equal(await dialog.isVisible(),true,'Nhả chuột ngoài sau chọn chữ không đóng');
  await f.page.mouse.click(5,5);await dialog.waitFor({state:'detached'});assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
  await opener.click();await f.page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  await f.page.getByRole('button',{name:'Xem tiến trình đã lưu',exact:true}).click();
  const saved=f.page.locator('.teacher-saved-progress-dialog');await saved.getByText('Nháp giả',{exact:true}).waitFor();
  await f.page.waitForFunction(()=>document.querySelector('.teacher-saved-progress-dialog')?.dataset.k56Dialog==='true');
  await f.page.screenshot({path:resolve(output,'teacher-saved.png')});
  await f.page.mouse.click(5,5);await saved.waitFor({state:'detached'});
  await f.page.setViewportSize({width:390,height:844});await f.page.locator('[data-tab=overview]').click();
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await f.page.screenshot({path:resolve(output,'teacher-mobile.png'),fullPage:true});
  await f.page.locator('#logoutButton').click();await f.page.locator('#accessView').waitFor({state:'visible'});
  assert.equal(await f.page.locator('#dashboardView').isVisible(),false);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
