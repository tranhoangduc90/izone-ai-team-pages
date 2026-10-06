import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const root=process.env.MINI_BASE_PAGES||new URL('..',import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/,'');
const student='11111111-1111-4111-8111-111111111111';
const otherStudent='44444444-4444-4444-8444-444444444444';
const attempt='22222222-2222-4222-8222-222222222222';
const session='33333333-3333-4333-8333-333333333333';
let browser,server,base;
before(async()=>{
  // Chạy asset thật trên localhost; tất cả API được chặn và thay bằng dữ liệu giả.
  server=createServer(async(req,res)=>{try{
    let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';
    const f=resolve(root,'.'+p);if(!f.startsWith(resolve(root)))throw new Error('outside');
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(f)]||'text/plain');res.end(await readFile(f));
  }catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
async function fixture({reading=false,legacy=false,mobile=false,legacyDraft=null,openError=false,delayDraft=false}={}){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
  const page=await context.newPage();const writes=[];const errors=[];
  const draftCalls=[];let releaseDraft;
  let draftSeen;const firstDraft=new Promise(r=>draftSeen=r);
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-07T02:00:00Z')});
  const data={ok:true,studentRef:student,studentName:'Học viên mô phỏng',className:'IC2304',attemptMode:'answer_sheet',
    policy:{timed:false,autoSubmit:false},generation:0,examSessionToken:session,attemptToken:reading?attempt:null,
    listeningSubmitted:reading,completed:false,readingStartedAt:reading?'2026-10-07T02:00:00Z':null,
    readingDeadlineAt:null,listeningDeadlineAt:null,readingDraft:{},readingDraftRevision:0,listeningDraft:{},listeningDraftRevision:0,serverNow:'2026-10-07T02:00:00Z'};
  await page.route('**/api/**',async route=>{
    const url=route.request().url();const body=route.request().postDataJSON();let out={ok:true};
    if(url.includes('/classes'))out={ok:true,classes:[{name:'IC2304'}]};
    else if(url.includes('/roster?'))out={ok:true,class:{id:'1293',name:'IC2304'},students:[{ref:student,name:'Học viên mô phỏng'},{ref:otherStudent,name:'Người khác'}]};
    else if(url.endsWith('/open'))out=openError?{ok:false,message:'Máy chủ thử đang gián đoạn'}:body.studentRef===otherStudent?
      {...data,studentRef:otherStudent,studentName:'Người khác',examSessionToken:'66666666-6666-4666-8666-666666666666'}:data;
    else if(url.endsWith('/attempt/active'))out={ok:true,active:false};
    else if(url.endsWith('/result'))out={...data,exam:{readingDeadlineAt:'2026-10-07T02:20:00Z'},result:null};
    else if(url.endsWith('/reading/start'))out=data;
    else if(url.endsWith('/draft')){
      draftCalls.push(body);
      draftSeen();
      if(delayDraft)await new Promise(r=>releaseDraft=r);
      out={...data,accepted:true,revision:body.revision,draft:body.answers};
    }
    else if(url.endsWith('/reading')){writes.push(body);out={...data,completed:true};}
    await route.fulfill({status:openError&&url.endsWith('/open')?503:200,contentType:'application/json',body:JSON.stringify(out)});
  });
  if(legacyDraft)await page.addInitScript(draft=>localStorage.setItem('izone-test:mini-test-lesson-5:IC2304',JSON.stringify(draft)),legacyDraft);
  if(legacy)await page.addInitScript(({student,attempt})=>{
    localStorage.setItem('izone-test:mini-test-lesson-5:IC2304',JSON.stringify({studentRef:student,studentName:'Học viên mô phỏng',
      attemptToken:attempt,listeningSubmitted:true,readingDeadlineAt:'2026-10-07T02:20:00Z',drafts:{listening:{},reading:{}}}));
  },{student,attempt});
  await page.goto(base+'/term-tests/mini-test-lesson-5/?class=IC2304');
  await page.locator('#studentSelect').waitFor({state:'visible'}).catch(()=>{});
  return{page,context,writes,errors,draftCalls,firstDraft,releaseDraft:()=>releaseDraft?.()};
}
async function enter(page,ref=student){
  if(await page.locator('#miniEnter').count()){
    await page.locator('#studentSelect').selectOption(ref);await page.locator('#miniEnter').click();
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  }
}
test('Không mở ô Listening trước khi xác nhận lớp/tên',async()=>{
  const f=await fixture();try{assert.equal(await f.page.locator('#listeningView').isVisible(),false);
    await enter(f.page);await f.page.locator('#listeningView').waitFor({state:'visible'});
    await f.page.locator('[data-number="11"]').selectOption('A');assert.equal(await f.page.locator('#studentSelect').inputValue(),student);
    assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
});
test('Hạn cũ không tự nộp Reading sau 21 phút hoặc tải lại',async()=>{
  const f=await fixture({reading:true,legacy:true});try{await enter(f.page);await f.page.locator('#readingView').waitFor({state:'visible'});
    await f.page.clock.fastForward(21*60*1000);assert.equal(f.writes.length,0);
    assert.equal(await f.page.locator('#readingQuestions select').first().isEnabled(),true);
    await f.page.reload();await enter(f.page);await f.page.locator('#readingView').waitFor({state:'visible'});
    assert.equal(f.writes.length,0);assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
});
test('Nháp chưa có tên chỉ phục hồi sau xác nhận rõ, không làm kẹt chọn tên',async()=>{
  const f=await fixture({legacyDraft:{drafts:{listening:{11:'B'},reading:{24:'word'}}}});
  try{let confirmations=0;f.page.on('dialog',d=>{confirmations++;return d.accept();});
    await enter(f.page);await f.page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(confirmations,1);assert.equal(await f.page.locator('#listeningQuestions [data-number="11"]').inputValue(),'B');
    assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
});
test('Nháp người khác không gắn vào người vừa xác nhận',async()=>{
  const f=await fixture({legacyDraft:{studentRef:'44444444-4444-4444-8444-444444444444',drafts:{listening:{11:'B'}}}});
  try{await enter(f.page);await f.page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(await f.page.locator('#listeningQuestions [data-number="11"]').inputValue(),'');assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
});
test('Lỗi mở bài giữ màn chọn tên và nháp, không mở ô trả lời',async()=>{
  const f=await fixture({openError:true,legacyDraft:{drafts:{listening:{11:'B'}}}});
  try{await enter(f.page);await f.page.getByText('Chưa mở được bài:',{exact:false}).waitFor({state:'visible'});
    assert.equal(await f.page.locator('#listeningView').isVisible(),false);
    assert.equal(await f.page.locator('#miniEnter').isEnabled(),true);
    assert.ok((await f.page.evaluate(()=>localStorage.getItem('izone-test:mini-test-lesson-5:IC2304'))).includes('B'));
  }finally{await f.context.close();}
});
test('Đổi người khi nháp đang chờ không gửi đáp án xếp hàng bằng token mới',async()=>{
  const f=await fixture({delayDraft:true});
  try{await enter(f.page);await f.page.locator('#listeningView').waitFor({state:'visible'});
    await f.page.locator('#listeningQuestions [data-number="11"]').selectOption('A');await f.page.clock.runFor(5500);
    await f.firstDraft;
    assert.equal(f.draftCalls.length,1);
    await f.page.locator('#listeningQuestions [data-number="12"]').selectOption('B');await f.page.clock.runFor(5500);
    await f.page.getByRole('button',{name:'Đổi người học',exact:true}).click();await enter(f.page,otherStudent);
    await f.page.locator('#listeningView').waitFor({state:'visible'});f.releaseDraft();
    await f.page.clock.runFor(1000);
    assert.equal(f.draftCalls.length,1);assert.equal(await f.page.locator('#listeningQuestions [data-number="11"]').inputValue(),'');
    assert.deepEqual(f.errors,[]);
  }finally{f.releaseDraft();await f.context.close();}
});
