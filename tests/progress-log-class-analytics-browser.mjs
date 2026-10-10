// Nhận dữ liệu giả: kiểm cộng đúng/sai toàn lớp, mở đúng người/buổi và xóa dữ liệu khi mất quyền.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {demoCourse} from '../progress-log/reference-preview/fixture.js';
import {demoDetail} from '../progress-log/reference-preview-v2/fixture.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
test('Whole-class basic analysis drills into exact student/session, keeps sparse course and clears on forbidden',{timeout:60000},async()=>{
 const server=createServer(async(req,res)=>{try{const f=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);assert.ok(f.startsWith(root));res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(f)]||'text/plain'));res.end(await readFile(f));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(20000+Math.floor(Math.random()*30000),'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[],writes=[],detailCalls=[];let forbidden=false,hold=false,release;
 page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 const course=structuredClone(demoCourse);course.classId='1294';course.overview.classId='1294';
 course.assignments.forEach((f,i)=>{f.title='Reading '+(i+3)+' + Writing '+(i+1);course.overview.sessions.find(s=>s.sessionNumber===f.sessionNumber).assignments[0].title=f.title;});
 try{
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),json=v=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true'},body:JSON.stringify(v)});
   if(u.origin===origin)return route.continue();
   if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:''});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true'}});
   if(req.method()!=='GET'){writes.push(u.pathname);return route.abort();}
   if(u.pathname.endsWith('/api/auth/session'))return json({ok:true,reviewer:{email:'teacher@example.test'}});
   if(u.pathname.endsWith('/teacher/options'))return json({ok:true,reviewer:{name:'Giảng viên giả'},classes:[{class_id:'1294',class_name:course.className},{class_id:'2139',class_name:'Lớp khác'}],assignments:course.assignments.map(f=>({assignment_id:f.id,class_id:'1294',class_name:course.className,session_number:f.sessionNumber,title:f.title,status:'published'}))});
   if(u.pathname.endsWith('/question-library'))return json({ok:true,items:[]});
   if(u.pathname.includes('/form-drafts'))return json({ok:true,drafts:[]});
   if(u.pathname.endsWith('/journey-plan'))return json({ok:true,plan:{classId:'1294',totalSessions:31,highestKnownSession:5,revision:1,testSessionNumbers:[16,31],testSources:[],sessionDates:[]}});
   if(u.pathname.endsWith('/dashboard'))return json({ok:true,dashboard:{assignmentId:course.assignments[0].id,classId:'1294',className:course.className,sessionNumber:2,title:course.assignments[0].title,students:[],blockReleases:[],definition:{blocks:[]},classInsights:[]}});
   if(u.pathname.endsWith('/live-drafts'))return json({ok:true,live:{assignmentId:course.assignments[0].id,students:[],generatedAt:'2026-10-03T12:00:00Z'}});
   if(u.pathname.endsWith('/overview')){const id=u.pathname.split('/').at(-2);return json({ok:true,overview:id==='1294'?course.overview:{...course.overview,classId:id,className:'Lớp khác',students:[],sessions:[],counts:{currentStudents:0,complete:0}}});}
   if(u.pathname.endsWith('/question-analytics')){
    if(hold)await new Promise(r=>release=r);
    if(forbidden)return route.fulfill({status:403,contentType:'application/json',headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true'},body:JSON.stringify({ok:false,message:'Đã thu hồi quyền'})});
    return json({ok:true,analytics:course.assignments.find(f=>f.id===u.pathname.split('/').at(-2)).analytics});
   }
   if(u.pathname.includes('/sessions/')){const parts=u.pathname.split('/'),n=Number(parts.at(-3)),ref=parts.at(-1);detailCalls.push({n,ref});return json({ok:true,detail:{...demoDetail(ref,n),classId:'1294'}});}
   return route.abort();
  });
  await page.goto(origin+'/progress-log/teacher.html');await page.locator('#teacherWorkspace').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Hành trình lớp',exact:true}).click();await page.locator('#courseAnalyticsStatus').filter({hasText:'Đã đọc 4'}).waitFor();
  // Fixture có 15 bài × 3 câu khách quan: 30 đúng, 15 sai; câu mở được giữ riêng.
  assert.deepEqual(await page.locator('#courseAnalytics .teacherMetric strong').allTextContents(),['15','30','15','67%']);
  assert.equal(await page.locator('#courseAnalytics .teacherMetric').first().evaluate(e=>getComputedStyle(e).display),'flex');
  assert.equal(await page.locator('#courseAnalytics .previewTable tbody tr').count(),4);
  assert.equal(await page.locator('.overview-table th').filter({hasText:'Buổi 31'}).count(),1);
  assert.match(await page.locator('#courseAnalytics').textContent(),/Reading 3 \+ Writing 1/);
  // Hai phản hồi thật: tên giữ thao tác mở bài nhưng trông như chữ thường; bảng cùng cỡ chữ.
  await page.locator('#courseAnalytics .comment-disclosure > summary').first().click();
  await page.locator('#courseAnalytics .comment-disclosure > summary').nth(1).click();
  const appearance=await page.locator('#courseAnalytics [data-summary]').first().evaluate(e=>{
   const name=getComputedStyle(e),cell=getComputedStyle(e.parentElement);
   const header=getComputedStyle(document.querySelector('#courseOverview .overview-table th'));
   const content=getComputedStyle(document.querySelector('#courseOverview .overview-cell'));
   return {underline:name.textDecorationLine,border:name.borderTopWidth,background:name.backgroundColor,
    colorMatches:name.color===cell.color,nameFont:name.fontSize,headerFont:header.fontSize,cellFont:content.fontSize};
  });
  assert.deepEqual(appearance,{underline:'none',border:'0px',background:'rgba(0, 0, 0, 0)',
   colorMatches:true,nameFont:'13px',headerFont:'13px',cellFont:'13px'});
  const wrong=page.locator('#courseAnalytics [data-student]').first(),ref=await wrong.getAttribute('data-student'),n=Number(await wrong.getAttribute('data-session'));
  await wrong.click();await page.locator('#journeyDetailStatus').filter({hasText:'hiện hành'}).waitFor();assert.deepEqual(detailCalls.at(-1),{n,ref});assert.ok(await page.locator('[data-review-item]').count());await page.keyboard.press('Escape');
  const summary=page.locator('#courseAnalytics [data-summary]').first(),person=await summary.getAttribute('data-summary');await summary.click();assert.equal(await page.locator('#journeyDetailContent tbody tr').count(),4);
  assert.match(await page.locator('#journeyDetailContent').innerText(),/Reading 3 \+ Writing 1/);await page.locator('#journeyDetailContent [data-session="3"]').click();await page.locator('#journeyDetailStatus').filter({hasText:'hiện hành'}).waitFor();assert.deepEqual(detailCalls.at(-1),{n:3,ref:person});await page.keyboard.press('Escape');
  await mkdir(resolve(root,'output/playwright'),{recursive:true});
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(root,'output/playwright/production-class-'+width+'.png'),fullPage:true});}
  await page.locator('#showAllJourneyClasses').check();
  hold=true;await page.getByRole('button',{name:'Làm mới hành trình',exact:true}).click();await page.locator('#courseAnalyticsStatus').filter({hasText:'Đang đọc'}).waitFor();await page.locator('#overviewClassSelect').selectOption('2139');await page.locator('#courseAnalyticsStatus').filter({hasText:'Đã đọc 0'}).waitFor();release?.();hold=false;await page.waitForTimeout(100);assert.doesNotMatch(await page.locator('#courseAnalytics').textContent(),/Thủy/);
  forbidden=true;await page.locator('#overviewClassSelect').selectOption('1294');await page.locator('#teacherWorkspace').waitFor({state:'hidden'});assert.equal(await page.locator('#courseAnalytics').textContent(),'');assert.equal(await page.locator('#journeyDetailContent').textContent(),'');assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 }finally{release?.();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
