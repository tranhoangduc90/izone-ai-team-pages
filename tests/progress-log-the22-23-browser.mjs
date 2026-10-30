import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startThe22Server,uid,rootDraft} from './fixtures/progress-the22-23-server.mjs';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');

test('Thẻ 22–23 Chrome: cùng phiếu, lỗi cạnh ô, Speaking đầy đủ, chia đôi và link Writing chỉ đọc',{timeout:180000},async()=>{
 const fixture=await startThe22Server(),browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/*',route=>new URL(route.request().url()).origin===fixture.origin?route.continue():route.abort());
 const evidence=process.env.PROGRESS_LOG_EVIDENCE_DIR||'E:/Codex-Data/progress-thuy-the22-23-implementation-20261030/browser';await mkdir(evidence,{recursive:true});
 try{
  await page.goto(fixture.origin+'/progress-log/teacher.html#assignment='+uid(103));
  await page.getByRole('button',{name:'Hành trình lớp',exact:true}).click();
  await page.locator('#courseOverview .thuy-skill-tabs').waitFor();
  await page.locator('#courseOverview').getByRole('button',{name:'Speaking',exact:true}).click();
  assert.deepEqual(await page.locator('#courseOverview th').allTextContents(),['Học viên','Nhận xét của giảng viên','Tự nhận xét của học viên']);
  assert.equal(await page.getByText(/phiếu có phản hồi|Đối chiếu nhãn gốc/).count(),0);
  const row=page.locator('#courseOverview tbody tr').filter({hasText:'Học viên giả A'});
  assert.equal(await row.locator('td').nth(1).locator('p').count(),2);assert.ok((await row.locator('td').nth(1).innerText()).includes(fixture.longComment));
  assert.equal(await row.locator('td').nth(2).locator('p').count(),2);
  await row.getByRole('button',{name:'Học viên giả A',exact:true}).click();
  await page.locator('#thuyCourseResults.has-inline-detail').waitFor();assert.equal(await page.locator('#journeyDetailContent .thuy-four-skills>.card').count(),4);
  const widths=await page.locator('#thuyCourseResults').evaluate(el=>[...el.children].map(e=>e.getBoundingClientRect().width));assert.ok(Math.abs(widths[0]-widths[1])<2);
  assert.equal(await page.locator('#journeyDetailDialog').evaluate(el=>getComputedStyle(el).position),'static');
  await page.evaluate(()=>{const dialog=document.querySelector('#journeyDetailDialog');dialog.scrollTop=300;window.savedSkillNode=document.querySelector('#journeyDetailContent .thuy-four-skills');window.savedPanelScroll=dialog.scrollTop;});
  for(let pass=0;pass<3;pass++){
   await Promise.all([page.waitForResponse(r=>r.url().includes('/teacher/classes/1294/overview')),page.evaluate(()=>document.querySelector('#refreshDashboardButton').click())]);
   await page.waitForFunction(()=>document.querySelector('#courseOverview').getAttribute('aria-busy')==='false');
   assert.equal(await page.evaluate(()=>document.querySelector('#journeyDetailContent .thuy-four-skills')===window.savedSkillNode),true);
   assert.equal(await page.locator('#journeyDetailDialog').evaluate(el=>el.scrollTop),await page.evaluate(()=>window.savedPanelScroll));
  }
  await page.locator('#journeyDetailDialog').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:resolve(evidence,'journey-split-1440.png'),fullPage:true});
  const [result]=await Promise.all([ctx.waitForEvent('page'),page.locator('#journeyDetailContent a.thuy-task-score').first().click()]);
  result.setDefaultTimeout(10000);result.on('pageerror',e=>errors.push(e.message));
  try{await result.getByText('The saved essay in an isolated fixture.').waitFor();}catch(e){console.error(JSON.stringify({url:result.url(),body:await result.locator('body').innerText(),calls:fixture.calls.slice(-8),errors}));throw e;}
  assert.equal(await result.locator('textarea').count(),0);
  await result.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'izone:teacher-sso-logout',newValue:String(Date.now())})));
  await result.getByText('Phiên giảng viên đã thay đổi. Hãy mở lại kết quả.',{exact:true}).waitFor();assert.equal(await result.getByText('The saved essay in an isolated fixture.').isVisible(),false);await result.close();
  await page.getByRole('button',{name:'Học viên tiếp theo',exact:true}).click();await page.locator('#journeyDetailContent h2').filter({hasText:'Học viên giả B'}).waitFor();
  await page.keyboard.press('Escape');await page.locator('#journeyDetailDialog').waitFor({state:'hidden'});
  await row.getByRole('button',{name:'Học viên giả A',exact:true}).click();assert.equal(await page.locator('#journeyDetailContent .thuy-four-skills>.card').count(),4);
  await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});await row.getByRole('button',{name:'Học viên giả A',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(evidence,'journey-390.png'),fullPage:true});await page.screenshot({path:resolve(evidence,'journey-mobile-viewport.png')});
  await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});
  fixture.overviewWarnings.scheduleStatus='temporarily_unavailable';fixture.overviewWarnings.planOutdated=true;
  await page.locator('#refreshDashboardButton').click();await page.locator('#overviewStatus').filter({hasText:'Chưa đọc được lịch hiện hành'}).waitFor();assert.match(await page.locator('#overviewStatus').innerText(),/Kế hoạch cần giảng viên xác nhận lại/);
  await page.getByRole('button',{name:'Quản lý bài tập',exact:true}).click();await page.getByRole('tab',{name:/Kho cá nhân/}).click();
  await page.getByRole('button',{name:'Phiếu kiểm thử — KHÔNG GIAO LỚP',exact:true}).click();await page.getByRole('button',{name:'Sửa bài',exact:true}).click();
  await page.getByLabel('Tên bài tập',{exact:true}).waitFor();
  assert.ok(fixture.calls.some(c=>c.path==='/api/learning/teacher/form-drafts/'+rootDraft+'/edit'));
  assert.equal(await page.getByText('Lớp, buổi và nguồn sao chép',{exact:true}).count(),0);
  await page.getByLabel('Tên bài tập',{exact:true}).fill('Phiếu đã sửa cùng dòng');await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.locator('.thuy-editor-save-state').filter({hasText:'Đã lưu'}).waitFor();
  await page.getByRole('button',{name:'Quay lại Quản lý bài tập',exact:true}).click();assert.equal(await page.locator('.thuy-library-scroll tbody tr').count(),1);
  await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();await page.getByRole('button',{name:'+ Trắc nghiệm',exact:true}).click();
  await page.getByLabel('Tên bài tập',{exact:true}).fill('');await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('');await page.getByLabel('Lựa chọn A câu 1',{exact:true}).fill('');
  await page.getByRole('button',{name:'Xuất bản',exact:true}).click();assert.ok(await page.locator('.thuy-field-error').count()>=3);
  const optionError=page.locator('.thuy-editor-option .thuy-field-error').first(),optionInput=page.getByLabel('Lựa chọn A câu 1',{exact:true});
  const [errorBox,inputBox]=await Promise.all([optionError.boundingBox(),optionInput.boundingBox()]);assert.ok(errorBox.width>200);assert.ok(errorBox.y>=inputBox.y+inputBox.height);
  await page.screenshot({path:resolve(evidence,'inline-errors.png'),fullPage:true});
  await page.getByLabel('Tên bài tập',{exact:true}).fill('Phiếu thử lỗi đã sửa tên');assert.equal(await page.getByLabel('Tên bài tập',{exact:true}).getAttribute('aria-invalid'),null);
  await page.getByRole('button',{name:'Tạo bài tập bằng AI',exact:true}).click();const input=page.getByLabel('Nội dung câu hỏi có sẵn',{exact:true});assert.equal(await input.inputValue(),'');assert.ok((await input.getAttribute('placeholder')).includes('Câu 3.'));
  await page.screenshot({path:resolve(evidence,'ai-example.png'),fullPage:true});assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();}
});
