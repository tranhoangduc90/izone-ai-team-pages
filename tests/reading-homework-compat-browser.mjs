// Cùng native API với client hiện tại/đường polling cũ và bundle tab cũ được cấp riêng.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHomeworkObservationApp,lessons} from './fixtures/homework-observation-app.mjs';
const current=path.resolve(fileURLToPath(new URL('../',import.meta.url))),legacy=process.env.HOMEWORK_LEGACY_PAGES;
if(!legacy||!path.isAbsolute(legacy))throw Error('EXACT_LEGACY_PAGES_REQUIRED');
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
let browser;test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});test.after(()=>browser?.close());
for(const mode of ['current-poll','old-client'])for(const width of [1440,390])test(`Native repair/save/reload/submit · ${mode} · ${width}px`,{timeout:40000},async t=>{
 const f=await createHomeworkObservationApp({root:mode==='old-client'?legacy:current,fixtureName:'materials',stream:mode!=='current-poll'}),context=await browser.newContext({viewport:{width,height:900},locale:'vi-VN'}),page=await context.newPage();t.after(async()=>{await context.close();await f.close();});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===f.origin)return route.continue();if(u.pathname.includes('teacher-session-api')||u.pathname.includes('shared-session'))return route.fulfill({status:401,json:{ok:false}});return route.abort();});
 const entry=f.origin+'/reading-skills67/'+lessons[0][1]+'/?server=1';await page.goto(entry+'&attemptId='+f.initial.attemptId);await page.locator('#entry-class').selectOption('1124');await page.locator('#entry-student').selectOption(f.scope.ownerId);await page.getByRole('button',{name:'Vào bài',exact:true}).click();await page.locator('.result-note').waitFor();
 await page.locator('footer [data-action="edit"]').click();await page.locator('.repair-current[aria-current="step"]').waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));if(width===390)await page.locator('[data-pane="passage"]').click();
 const field=page.locator('textarea[data-target]:visible').first(),id=await field.getAttribute('data-target'),text='Nội dung đã sửa, cần giữ sau reload và nộp lại.';await field.fill(text);await page.waitForFunction(()=>window.ReadingServerClient.state.status==='saved');assert.equal((await f.store.draft(f.scope)).body.answers[id],text);
 await page.reload();await page.waitForFunction(()=>window.ReadingInteractionBridge.current()?.status==='draft');assert.equal(await page.locator('[data-target="'+id+'"]').inputValue(),text);
 await page.locator('#grade-button').click();await page.locator('.waiting-card').waitFor();const sent=(await f.store.history(f.scope))[0];assert.equal(sent.status,'queued');
 if(mode==='current-poll'){
  const attemptUrl=new RegExp('/attempts/'+sent.attemptId+'(?:\\?|$)');
  let checkedItems=3;
  await context.route(attemptUrl,async route=>{
   const response=await route.fetch(),value=await response.json();
   if(value.status==='queued')value.validationProgress={phase:'review',itemProgress:{checkedItems,totalItems:f.content.targets.length}};
   await route.fulfill({response,json:value});
  });
  const waiting=page.locator('.waiting-card');
  await waiting.getByText('3/'+f.content.targets.length,{exact:true}).waitFor();
  checkedItems=5;
  await waiting.getByText('5/'+f.content.targets.length,{exact:true}).waitFor();
  assert.equal(await waiting.locator('progress').evaluate(node=>node.value),5);
  await context.unroute(attemptUrl);
 }
 await f.completePending();await page.waitForFunction(()=>window.ReadingInteractionBridge.current().serverAttempt?.status==='done');assert.equal(await page.locator('.repair-banner').getAttribute('data-state'),'success');
 await page.goto(entry+'&attemptId='+sent.attemptId);await page.waitForFunction(()=>document.querySelector('#entry-class')||document.querySelector('.result-note'));
 // Link kết quả mới có thể yêu cầu chọn lại người theo chính sách đường vào native.
 if(await page.locator('#entry-class').count()){await page.locator('#entry-class').selectOption('1124');await page.locator('#entry-student').selectOption(f.scope.ownerId);await page.getByRole('button',{name:'Vào bài',exact:true}).click();}
 await page.locator('.result-note').waitFor();assert.equal(await page.locator('[data-target="'+id+'"]').inputValue(),text);assert.equal((await f.store.history(f.scope)).length,2);assert.deepEqual((await f.store.attempt(f.scope,f.initial.attemptId)).snapshot,f.initialBody);
 const writes=f.requests.filter(r=>r.method==='PUT'&&r.path==='/draft');assert.equal(writes.length,1);assert.equal(writes[0].compact,mode!=='old-client');assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path==='/submit').length,1);assert.deepEqual(errors,[]);
});
