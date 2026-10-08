import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve('.'),ref='11111111-1111-4111-8111-111111111111';
const token='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333';
let browser,server,base;
before(async()=>{
 server=createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';
 const file=resolve(root,'.'+p);if(!file.startsWith(root+String.fromCharCode(92))&&!file.startsWith(root+'/'))throw Error('outside');
 const override=p==='/term-tests/k56-mini-shared/app.js'?process.env.K56_DRAFT_SOURCE:
  p==='/term-tests/mini-test-k56-computer-based/bootstrap.js'?process.env.K56_BOOTSTRAP_SOURCE:null;
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'text/plain');res.end(await readFile(override||file));
 }catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,channel:'chrome'});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
test('D02 CBT: online và reload tự đồng bộ Reading; trình duyệt sạch đọc đúng bản mới',async()=>{
 let draft={},revision=0,fail=false,rejected=0;const requests=[],errors=[];
 const attach=async context=>{
  await context.route('**/api/**',async route=>{
   const u=route.request().url(),body=route.request().method()==='POST'?route.request().postDataJSON():{};let out={ok:true};
   if(u.includes('/roster?'))out={ok:true,class:{name:'IC2264'},students:[{ref,name:'Người giả Mini'}]};
   else if(u.endsWith('/attempt/prepare'))out={ok:true,attemptMode:'cbt',policy:{timed:true,autoSubmit:true},generation:0,
    attemptToken:token,examSessionToken:session,studentName:'Người giả Mini',examMode:'lis_first',nextSection:'reading',
    listeningSubmitted:true,readingSubmitted:false,readingStartedAt:'2026-10-08T02:00:00Z',readingDeadlineAt:'2026-10-08T02:25:00Z',
    listeningDraft:{},readingDraft:draft,listeningDraftRevision:0,readingDraftRevision:revision,serverNow:'2026-10-08T02:00:00Z',
    content:await context.pages()[0].evaluate(()=>window.K56_TERM_TEST_CONTENT)};
   else if(u.endsWith('/reading/draft')){requests.push(body);if(fail){rejected++;await route.abort('internetdisconnected');return;}
    const accepted=body.revision>revision;if(accepted){draft=body.answers;revision=body.revision;}out={ok:true,accepted,revision,draft};}
   await route.fulfill({json:out});
  });
 };
 const open=async context=>{await attach(context);const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-08T02:00:00Z')});
  await page.goto(base+'/term-tests/mini-test-k56-computer-based/?class=IC2264');
  await page.locator('#bootstrapStudent').selectOption(ref);await page.locator('#confirmIdentity').click();
  await page.locator('#readingView').waitFor({state:'visible'});return page;
 };
 const context=await browser.newContext(),fresh=await browser.newContext();
 try{
  const page=await open(context),field=page.locator('#readingQuestions [data-number]').first();
  fail=true;await field.fill('OFFLINE-ONLINE');await page.clock.runFor(800);
  await assertEventually(()=>rejected===1);
  fail=false;await page.evaluate(()=>dispatchEvent(new Event('online')));await page.clock.runFor(1000);
  await assertEventually(()=>draft[1]==='OFFLINE-ONLINE');
  fail=true;await field.fill('OFFLINE-RELOAD');await page.clock.runFor(800);
  await assertEventually(()=>rejected===2);
  fail=false;await page.reload();await page.locator('#confirmIdentity').click();await page.locator('#readingView').waitFor({state:'visible'});
  await page.clock.runFor(1000);await assertEventually(()=>draft[1]==='OFFLINE-RELOAD');
  const other=await open(fresh);assert.equal(await other.locator('#readingQuestions [data-number]').first().inputValue(),'OFFLINE-RELOAD');
  assert.ok(requests.length>=4);assert.deepEqual(errors,[]);
 }finally{await context.close();await fresh.close();}
});

test('D04 CBT: reload giữ nháp offline khi tab khác lưu cùng revision, chỉ sửa mới được gửi lên',async()=>{
 let draft={},revision=0,fail=true;const requests=[],errors=[];
 const context=await browser.newContext();
 try{
  await context.route('**/api/**',async route=>{
   const u=route.request().url(),body=route.request().method()==='POST'?route.request().postDataJSON():{};let out={ok:true};
   if(u.includes('/roster?'))out={ok:true,class:{name:'IC2264'},students:[{ref,name:'Người giả Mini'}]};
   else if(u.endsWith('/attempt/prepare'))out={ok:true,attemptMode:'cbt',policy:{timed:true,autoSubmit:true},generation:0,
    attemptToken:token,examSessionToken:session,studentName:'Người giả Mini',examMode:'lis_first',nextSection:'reading',
    listeningSubmitted:true,readingSubmitted:false,readingStartedAt:'2026-10-08T02:00:00Z',readingDeadlineAt:'2026-10-08T02:25:00Z',
    listeningDraft:{},readingDraft:draft,listeningDraftRevision:0,readingDraftRevision:revision,serverNow:'2026-10-08T02:00:00Z',
    content:await context.pages()[0].evaluate(()=>window.K56_TERM_TEST_CONTENT)};
   else if(u.endsWith('/reading/draft')){
    requests.push(body);if(fail){await route.abort('internetdisconnected');return;}
    const accepted=body.revision>revision;if(accepted){draft=body.answers;revision=body.revision;}
    out={ok:true,accepted,revision,draft};
   }
   await route.fulfill({json:out});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-08T02:00:00Z')});
  await page.goto(base+'/term-tests/mini-test-k56-computer-based/?class=IC2264');
  await page.locator('#bootstrapStudent').selectOption(ref);await page.locator('#confirmIdentity').click();
  await page.locator('#readingView').waitFor({state:'visible'});
  await page.locator('#readingQuestions [data-number]').first().fill('LOCAL-OFFLINE');await page.clock.runFor(800);
  await assertEventually(()=>requests.length>0);
  revision=requests.at(-1).revision;draft={1:'OTHER-TAB'};fail=false;
  await page.reload();await page.locator('#confirmIdentity').click();await page.locator('#readingView').waitFor({state:'visible'});
  assert.equal(await page.locator('#readingQuestions [data-number]').first().inputValue(),'LOCAL-OFFLINE');
  await page.clock.runFor(2000);await assertEventually(()=>requests.length>1);
  assert.equal(draft[1],'OTHER-TAB');
  assert.equal(await page.locator('#readingQuestions [data-number]').first().inputValue(),'LOCAL-OFFLINE');
  await page.locator('#readingQuestions [data-number]').first().fill('LOCAL-EXPLICIT-EDIT');await page.clock.runFor(1000);
  await assertEventually(()=>draft[1]==='LOCAL-EXPLICIT-EDIT');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
async function assertEventually(check){for(let i=0;i<40&&!check();i++)await new Promise(r=>setTimeout(r,50));assert.ok(check(),'Bản mới phải được lưu trên API giả trước khi mở browser sạch');}
