import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startThe20Server,a,journey,detail} from './fixtures/progress-the20-server.mjs';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
test('Thẻ 26: tổng quan đọc theo lô, thẻ gọn/điểm đầu dòng, logo về đúng trang chủ ở bốn viewport',{timeout:45000},async()=>{
 const f=await startThe20Server(),browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();let details=0;
 try{
  await page.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
  await page.route('**/api/learning/student/course-journey',async route=>{const j=journey(a);j.skillForms=j.sessions.filter(s=>['complete','incomplete'].includes(s.completeness)).map(s=>detail(a,s.sessionNumber));await route.fulfill({json:{ok:true,journey:j}});});
  page.on('request',r=>{if(r.url().endsWith('/student/course-session-detail'))details++;});
  await page.goto(f.origin+'/progress-log/student.html');await page.locator('#portalClass:not([disabled])').selectOption('1294');await page.locator('#portalStudent:not([disabled])').selectOption(a);await page.locator('#portalContinue').click();
  await page.locator('#thuyStudentSkills h2').waitFor();assert.equal(details,0,'Home must not fan out session detail reads');
  for(const width of [390,768,1440,1920]){
   await page.setViewportSize({width,height:1000});const card=page.locator('#journeySessions>.studentSessionCard').first();const box=await card.boundingBox();assert.ok(box.height<150,'Compact history at '+width);
   assert.equal(await page.locator('#thuyJourneyNav').isVisible(),false);assert.equal(await page.locator('#journeyBackButton').isVisible(),false);
   const score=card.locator('.studentSessionScore');if(await score.count()){const top=await card.locator('.studentSessionTop').boundingBox(),s=await score.boundingBox();assert.ok(s.y>=top.y&&s.y<top.y+top.height);}
  }
  await page.getByRole('button',{name:'Về trang chủ Progress Log',exact:true}).click();await page.locator('#journeyView:not([hidden])').waitFor();assert.equal(details,0);
  assert.equal(f.calls.filter(c=>/attempts\/(start|draft|submit)|checkpoints\/submit/.test(c.path)).length,0);
 }finally{await browser.close();await f.close();}
});
test('Thẻ 26: Kho chung dùng cùng bộ soạn, admin xuất bản đúng nguồn, xóa không mở nhầm hàng',{timeout:45000},async()=>{
 const f=await startThe20Server(),browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
 try{
  await page.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
  await page.goto(f.origin+'/fixture/skills.html');await page.evaluate(async()=>{
   document.body.className='thuy-live thuy-teacher';document.body.innerHTML='<main id="editorHost"></main>';
   const {createFormDraftEditor}=await import('/progress-log/teacher-form-editor.js');window.calls26=[];window.entries26=[];window.saved26=null;
   const request=async(path,options={})=>{window.calls26.push({path,body:options.body,method:options.method});const d=window.saved26;
    if(path.startsWith('/teacher/form-library?'))return {canManageShared:true,entries:path.includes('izone')?window.entries26:[],
      shared:{createCourses:['34','45','56','67'],reviewCourses:['56'],selfApproveCourses:['56']}};
    if(path.startsWith('/teacher/form-drafts/review-queue'))return {drafts:[]};
    if(path==='/teacher/form-publications')return {publications:[]};
    if(path.startsWith('/teacher/form-drafts?'))return {drafts:d&&!window.entries26.length&&path.includes('izone')?[d]:[]};
    if(path==='/teacher/form-drafts'){window.saved26={...options.body,id:'50000000-0000-4000-8000-000000000026',revision:1,status:'draft',contentHash:'a'.repeat(64)};return {draft:structuredClone(window.saved26)};}
    if(path.endsWith('/request-review')){d.status='pending_review';return {draft:structuredClone(d)};}
    if(path.endsWith('/approve')){d.status='approved';return {draft:structuredClone(d)};}
    if(path.endsWith('/publish-library')){
      window.entries26=[{id:'60000000-0000-4000-8000-000000000026',title:d.definition.title,sourceDraftId:d.id,sourceRevision:d.revision}];
      return {publication:{id:'publication-26',libraryEntryId:window.entries26[0].id,draftId:d.id,formVersionId:d.definition.formVersionId,revision:d.revision}};
    }
    if(path.endsWith('/archive')){window.entries26=[];return {ok:true,archived:true};}
    if(options.method==='PUT'){Object.assign(d,options.body,{revision:d.revision+1});return {draft:structuredClone(d)};}
    throw Error('Outside fixture: '+path);
   };
   window.editor26=createFormDraftEditor({host:document.querySelector('#editorHost'),apiRequest:request,libraryEnabled:true});window.editor26.setWorkspace({classes:[{class_id:'1294',class_name:'IC_TEST20'}],assignments:[],classId:'1294',sessionNumber:1});
  });
  await page.waitForFunction(()=>document.querySelector('.thuy-library-heading button')?.title==='Tạo bài trong Kho chung');
  await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();await page.getByLabel('Tên bài tập',{exact:true}).fill('Bài chung kiểm Thẻ 26');await page.getByLabel('Khóa',{exact:true}).selectOption('56');
  await page.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('general');await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Câu phản hồi thử');
  await page.getByRole('button',{name:'Gửi duyệt',exact:true}).click();await page.getByRole('button',{name:'Duyệt bản này',exact:true}).click();
  await page.getByRole('button',{name:'Xuất bản',exact:true}).click();await page.getByRole('button',{name:'Bài chung kiểm Thẻ 26',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.calls26.find(c=>c.path==='/teacher/form-drafts')?.body.scope),'izone');
  assert.equal(await page.evaluate(()=>window.calls26.some(c=>c.path==='/teacher/form-library')),false);
  page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Xóa bài',exact:true}).click();await page.waitForFunction(()=>window.entries26.length===0);assert.equal(await page.locator('dialog[open]').count(),0);
 }finally{await browser.close();await f.close();}
});
