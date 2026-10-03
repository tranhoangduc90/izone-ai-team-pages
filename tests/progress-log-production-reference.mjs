// Dữ liệu giả qua API thật của trình duyệt: khóa title, full bài, mốc 18:25 và không ghi bài khi xem.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {demoDetail,demoCourse} from '../progress-log/reference-preview-v2/fixture.js';
const root=process.env.PROGRESS_PRODUCTION_ROOT||fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const ref='11111111-1111-4111-8111-111111111111',token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function run(action){
 const server=createServer(async(req,res)=>{try{let f=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(f)]||'text/plain'));res.end(await readFile(f));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(20000+Math.floor(Math.random()*30000),'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/New_York'}),writes=[],errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 const detail={...demoDetail(demoCourse.overview.students[0].studentRef,5),classId:'1294',student:{studentRef:ref,name:'Học viên giả'},sessionNumber:2,status:'complete'};
 const sessions=[{sessionNumber:2,sessionDate:'2026-09-21',assignmentId:'assignment-2',title:'ENTRANCE TICKET • Reading 3 + Writing 1',assignmentStatus:'published',completeness:'complete',attendanceStatus:'self_confirmed',portalSync:{status:'complete'},quizSummary:{correct:2,incorrect:1,graded:3}},
 {sessionNumber:3,sessionDate:'2026-10-03',assignmentId:'assignment-3',title:'Reading 4 + Writing 2',assignmentStatus:'published',publicToken:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},
 {sessionNumber:4,sessionDate:'2026-10-05',sessionKind:'test',dataOrigin:'confirmed_plan',title:'Buổi Test'},
 {sessionNumber:5,sessionDate:'2026-10-08',dataOrigin:'confirmed_plan'}];
 let detailMode='ok',release;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.pathname.endsWith('/progress-log/config.js'))return route.fulfill({contentType:'text/javascript',body:`window.PROGRESS_LOG_CONFIG={API_BASE_URL:'${origin}'};`});
  if(url.pathname.endsWith('/assignments/open'))return json({ok:true,assignment:{assignmentId:'assignment-2',sessionNumber:2,title:'ENTRANCE TICKET • Reading 3 + Writing 1',class:{id:'1294',name:'IC2305 · Lớp thử'},roster:[{studentRef:ref,name:'Học viên giả'}],definition:{blocks:[]}}});
  if(url.pathname.endsWith('/student/course-journey'))return json({ok:true,journey:{student:{studentRef:ref,name:'Học viên giả'},class:{classId:'1294',name:'IC2305 · Lớp thử'},summary:{totalSessions:4,attendedSessions:1,submittedComplete:1,availableReports:0},sessions,reports:[],coverage:{schedule:'teacher_confirmed',plannedSessions:4}}});
  if(url.pathname.endsWith('/student/course-session-detail')){
   assert.equal(req.postDataJSON().studentRef,ref);assert.equal(req.postDataJSON().sessionNumber,2);assert.equal(req.postDataJSON().identityConfirmed,true);
   if(detailMode==='hold')await new Promise(r=>release=r);
   if(detailMode==='fail')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,message:'Nguồn tạm lỗi'})});
   return json({ok:true,detail:detailMode==='wrong'?{...detail,student:{studentRef:'wrong'}}:detail});
  }
  if(url.origin===origin&&req.method()==='GET')return route.continue();writes.push(url.pathname);return route.abort();
 });
 try{
  await page.clock.install({time:new Date('2026-10-03T11:24:58Z')});await page.clock.pauseAt(new Date('2026-10-03T11:24:59Z'));
  await page.goto(origin+'/progress-log/index.html#assignment='+token);await page.locator('#studentSelect').selectOption(ref);await page.locator('#chooseStudentButton').click();await page.locator('#journeyButton').click();await page.locator('#journeyView').waitFor({state:'visible'});
  await action({page,origin,sessions,detail,setMode:m=>detailMode=m,release:()=>release?.()});assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 } finally{release?.();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
test('Production reference regression: session title and full submitted questions/answers',{timeout:60000},async()=>run(async({page,detail})=>{
 const card=page.locator('#journeySessions').getByRole('button',{name:/BUỔI 02/});
 assert.match(await page.locator('#journeyListTitle').textContent(),/4 buổi học/);
 assert.match(await page.locator('#journeySessions').textContent(),/Reading 3 \+ Writing 1/);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mkdir(resolve(root,'output/playwright'),{recursive:true});await page.screenshot({path:resolve(root,'output/playwright/production-journey-'+width+'.png'),fullPage:true});}
 await card.click();await page.locator('#journeyDetailView').waitFor({state:'visible'});
 assert.equal(await page.locator('.studentDetailHeader').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(13, 41, 65)');
 assert.equal(await page.locator('.studentDetailHeader h1').evaluate(e=>getComputedStyle(e).fontWeight),'400');
 const items=detail.definition.blocks.flatMap(b=>b.items);assert.equal(await page.locator('#journeyDetailContent [data-review-item]').count(),items.length);
 for(const item of items){const q=page.locator('[data-review-item="'+item.itemVersionId+'"]');assert.match(await q.textContent(),new RegExp(item.prompt.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}
 assert.equal(await page.locator('.reviewOption').count(),items.reduce((n,i)=>n+(i.options?.length||0),0));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mkdir(resolve(root,'output/playwright'),{recursive:true});await page.screenshot({path:resolve(root,'output/playwright/production-detail-'+width+'.png')});}
 await page.locator('#journeyDetailBackButton').click();assert.equal(await page.locator('#journeyView').isVisible(),true);await page.locator('#journeyBackButton').click();assert.equal(await page.locator('#confirmView').isVisible(),true);
}));
test('Production reference regression: Vietnam 18:25 switches assigned session without API writes',{timeout:60000},async()=>run(async({page})=>{
 const region=page.locator('#journeySessions');assert.match(await region.textContent(),/Chưa đến buổi học/);await page.clock.runFor(1021);
 const ready=region.getByRole('link',{name:/Nhấn để học buổi hôm nay/});await ready.waitFor();assert.match(await ready.getAttribute('href'),/#assignment=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb$/);
 assert.match(await region.textContent(),/Buổi Test · chưa có kết quả/);assert.match(await region.textContent(),/Chưa tạo Progress Log/);
}));
test('Production history errors, wrong identity and late detail do not reopen hidden context',{timeout:60000},async()=>run(async({page,setMode,release})=>{
 const open=()=>page.locator('#journeySessions').getByRole('button',{name:/BUỔI 02/}).click();
 setMode('wrong');await open();await page.locator('#journeyDetailStatus').filter({hasText:'không khớp'}).waitFor();assert.equal(await page.locator('[data-review-item]').count(),0);
 setMode('fail');await page.locator('#journeyDetailRetryButton').click();await page.locator('#journeyDetailStatus').filter({hasText:'Nguồn tạm lỗi'}).waitFor();
 setMode('hold');await page.locator('#journeyDetailRetryButton').click();await page.locator('#journeyDetailBackButton').click();release();await page.waitForTimeout(100);assert.equal(await page.locator('#journeyView').isVisible(),true);assert.equal(await page.locator('[data-review-item]').count(),0);
}));
