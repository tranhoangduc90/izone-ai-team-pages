import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const url=new URL(process.env.K67_PREVIEW_URL||'http://127.0.0.1:8877');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');
const base=url.origin,out=process.env.K67_ORDER_EVIDENCE_DIR||'E:/Codex-Data/k67-reading-first-plan-20261014/preview-evidence';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const ctx=await browser.newContext();await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await ctx.newPage();page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
const ref='11111111-1111-4111-8111-111111111111',records=[];
const post=async(path,body)=>{const r=await ctx.request.post(base+path,{data:{...body,orderClientVersion:1}});assert.ok(r.ok(),await r.text());return r.json();};
const state=slug=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),`izone-test:${slug}:IC2304`);
// Hai nguồn nháp khác nhau được tạo bằng UI/tab cũ và API thật của tab còn lại.
// Lỗi mạng xảy ra sau commit để kiểm mất ACK, không giả lập việc lưu SQL thành công.
try{
  await post('/preview/reset',{});
  await page.goto(base+'/term-tests/mini-test-lesson-5-computer-based/?class=IC2304&mode=read_first');
  await page.locator('#bootstrapStudent').selectOption(ref);await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
  await page.locator('#readingView [data-number="14"]').selectOption('i');await page.locator('#submitReading').click();
  await page.locator('#bootstrapPreview').waitFor({state:'visible'});
  const before=await state('mini-test-lesson-5'),prefix='/api/term-tests/mini-test-lesson-5';
  await post(prefix+'/session/start',{examSessionToken:before.examSessionToken});
  await post(prefix+'/listening/draft',{examSessionToken:before.examSessionToken,revision:7,answers:{11:'A'}});
  await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
  assert.equal(await page.locator('#listeningView [data-number="11"]').inputValue(),'A');
  let restored=await state('mini-test-lesson-5');assert.equal(restored.draftRevisions.listening,7);assert.equal(restored.draftAckRevisions.listening,7);
  const listeningField=page.locator('#listeningView [data-number="11"]');
  if(await listeningField.isVisible())await listeningField.selectOption('C');
  else await page.getByRole('radio',{name:'Câu 11, đáp án C',exact:true}).check();
  await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
  assert.equal(await page.locator('#listeningView [data-number="11"]').inputValue(),'C');
  restored=await state('mini-test-lesson-5');assert.ok(restored.draftRevisions.listening>=8);
  records.push({case:'Listening: nháp server ACK và nháp local mới hơn qua reload/start',status:'passed'});
  await page.goto(base+'/term-tests/term-test-1/?class=IC2304&mode=read_first');
  let fail=true;await page.route('**/api/term-tests/term-test-1/order/open',async r=>{if(fail){fail=false;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,message:'Máy chủ thử đang bận'})});}return r.continue();});
  await page.locator('#studentSelect').selectOption(ref);await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  await page.locator('#orderOpenRetry').waitFor({state:'visible'});assert.equal(await page.locator('#listeningView').isHidden(),true);assert.equal(await page.locator('#readingView').isHidden(),true);
  await page.locator('#orderOpenRetry').click();await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
  const field=page.locator('#readingView [data-number]').first();
  if(!await field.isVisible())await page.locator('#readingView input[type="radio"]:visible').first().check();
  else if(await field.evaluate(e=>e.tagName)==='SELECT')await field.selectOption(await field.locator('option').nth(1).getAttribute('value'));else await field.fill('A');
  const token=(await state('term-test-1')).attemptToken;
  let drop=true;await page.route('**/api/term-tests/term-test-1/reading',async r=>{if(drop){drop=false;await r.fetch();return r.abort('connectionreset');}return r.continue();});
  await page.locator('#submitReading').click();await page.locator('#notice').filter({hasText:'Không thể lưu Reading'}).waitFor();
  assert.equal(await page.locator('#readingView').isVisible(),true);
  await page.locator('#submitReading').click();await page.locator('#listeningView').waitFor({state:'visible'});
  assert.equal((await state('term-test-1')).attemptToken,token);
  records.push({case:'503 giữ bước xác nhận, retry mở đúng Reading; mất ACK Reading retry giữ lượt',status:'passed'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,checks:records}));
}catch(e){await page.screenshot({path:out+'/recovery-failure.png',fullPage:true});records.push({status:'failed',error:e.message,pageErrors:errors});throw e;}
finally{await writeFile(out+'/recovery-results.json',JSON.stringify(records,null,2),'utf8');await browser.close();}
