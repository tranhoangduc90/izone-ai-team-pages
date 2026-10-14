import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),base=process.env.K67_PREVIEW_URL||'http://127.0.0.1:8878',out=process.env.K67_ORDER_EVIDENCE_DIR||'E:/Codex-Data/k67-two-orders-official-20261014/browser-evidence';
assert.equal(new URL(base).hostname,'127.0.0.1');assert.equal(new URL(base).protocol,'http:');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'}),ctx=await browser.newContext();
await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await ctx.newPage();page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
const first='11111111-1111-4111-8111-111111111111',second='44444444-4444-4444-8444-444444444444',prefix='/api/term-tests/mini-test-lesson-5/answer-sheet';
const post=async(path,body)=>{const response=await ctx.request.post(base+path,{data:{...body,orderClientVersion:1}});assert.ok(response.ok(),await response.text());return response.json();};
let result;
// A mở Reading trước; B đã có Listening trước. Đổi người trên cùng trang phải
// dùng thứ tự thật của B, giữ bài A và khôi phục đúng nội dung phòng chờ cũ.
try {
  await post('/preview/reset',{});
  const b=await post(prefix+'/open',{classCode:'IC2304',studentRef:second,identityConfirmed:true,examMode:'lis_first',examDelivery:'answer_sheet'});
  const submitted=await post(prefix+'/listening',{examSessionToken:b.examSessionToken,generation:b.generation,clientSubmissionId:randomUUID(),answers:{11:'A'},examMode:'lis_first'});
  await page.goto(base+'/term-tests/mini-test-lesson-5/?class=IC2304&mode=read_first');
  await page.locator('#miniClass').selectOption('IC2304');await page.locator('#studentSelect').selectOption(first);await page.locator('#miniEnter').click();await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  await page.locator('#listeningSavedView').waitFor({state:'visible'});assert.match(await page.locator('#listeningSavedView').innerText(),/Listening sẽ mở sau khi nộp Reading/);
  const a=await page.evaluate(()=>JSON.parse(Object.entries(localStorage).find(([key])=>key.startsWith('izone-mini-answer:v2:mini-test-lesson-5:IC2304:11111111-1111-4111-8111-111111111111:'))?.[1]||'{}'));
  assert.ok(a.attemptToken);
  await page.getByRole('button',{name:'Đổi người học',exact:true}).click();await page.locator('#studentSelect').selectOption(second);await page.locator('#miniEnter').click();await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  await page.locator('#listeningSavedView').waitFor({state:'visible'});
  assert.equal(new URL(page.url()).searchParams.get('mode'),'lis_first');assert.match(await page.locator('.progress-step').first().innerText(),/^1\. Listening/);
  assert.doesNotMatch(await page.locator('#listeningSavedView').innerText(),/Listening sẽ mở sau khi nộp Reading/);
  await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
  const current=await post(prefix+'/open',{classCode:'IC2304',studentRef:second,identityConfirmed:true,examMode:'lis_first'});assert.equal(current.attemptToken,submitted.attemptToken);assert.ok(current.readingStartedAt);
  const preserved=await post(prefix+'/open',{classCode:'IC2304',studentRef:first,identityConfirmed:true,examMode:'read_first',examDelivery:'answer_sheet'});
  assert.equal(preserved.readingStartedAt,null);assert.equal(preserved.listeningSubmitted,false);if(a.attemptToken)assert.equal(preserved.attemptToken,a.attemptToken);
  assert.deepEqual(errors,[]);result={ok:true,case:'Cùng trang: A Reading trước → B có Listening trước, giữ lượt/mode/tiến độ/copy đúng'};console.log(JSON.stringify(result));
}catch(error){result={ok:false,error:error.message,pageErrors:errors};throw error;}
finally{await writeFile(out+'/change-student-results.json',JSON.stringify(result,null,2),'utf8');await browser.close();}
