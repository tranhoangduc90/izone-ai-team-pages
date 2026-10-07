import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const root=resolve(process.env.K56_PAGES_ROOT||'.');
const ref='11111111-1111-4111-8111-111111111111',other='44444444-4444-4444-8444-444444444444';
const token='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333';
let browser,server,base;
before(async()=>{
 server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root))throw Error('outside');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'text/plain');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,channel:'chrome'});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
async function fixture({reading=false,legacy=null,mobile=false,offline=false,delayDraft=false,openError=false,offlineDraft=false}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}}),page=await context.newPage();
 page.setDefaultTimeout(6000);let rejectSubmission=offline,releaseDraft,seenDraft;const draftSeen=new Promise(r=>seenDraft=r);
 const writes=[],drafts=[],opens=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-07T02:00:00Z')});
 const response={ok:true,attemptMode:'answer_sheet',generation:0,policy:{timed:false,autoSubmit:false},examMode:'lis_first',nextSection:reading?'reading':'listening',
 attemptToken:token,examSessionToken:session,studentName:'Học viên giả lập',className:'IC2264',listeningSubmitted:reading,readingSubmitted:false,
 listeningStartedAt:reading?null:'2026-10-07T02:00:00Z',listeningDeadlineAt:null,
 readingStartedAt:reading?'2026-10-07T02:00:00Z':null,readingDeadlineAt:null,completed:false,serverNow:'2026-10-07T02:00:00Z',
 listeningDraft:{},listeningDraftRevision:0,readingDraft:{},readingDraftRevision:0};
 await page.route('**/api/**',async route=>{
 const u=route.request().url(),body=route.request().method()==='POST'?route.request().postDataJSON():{};
 let out={ok:true};
 if(u.includes('/roster?'))out={ok:true,class:{name:'IC2264'},students:[{ref,name:'Học viên giả lập'},{ref:other,name:'Người giả lập khác'}]};
 else if(u.endsWith('/attempt/prepare')){opens.push(body);out={...response,studentRef:body.studentRef};if(openError){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'API thử gián đoạn'})});return;}}
 else if(u.endsWith('/draft')){drafts.push(body);seenDraft();if(offlineDraft){await route.abort('internetdisconnected');return;}if(delayDraft)await new Promise(r=>releaseDraft=r);out={ok:true,accepted:true,revision:body.revision,draft:body.answers,deadlineAt:null};}
 else if(u.endsWith('/reading/start')||u.endsWith('/session/start'))out={...response,readingStartedAt:'2026-10-07T02:00:00Z'};
 else if(u.endsWith('/reading')){writes.push(body);if(rejectSubmission){await route.abort('internetdisconnected');return;}out={...response,completed:true};}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(out)});
 });
 if(legacy)await page.addInitScript(data=>localStorage.setItem('izone-test:mini-test-k56:IC2264',JSON.stringify(data)),legacy);
 await page.goto(base+'/term-tests/mini-test-k56/?class=IC2264');await page.locator('#studentSelect').waitFor();
 return {page,context,writes,drafts,opens,errors,draftSeen,releaseDraft:()=>releaseDraft?.(),online:()=>rejectSubmission=false};
}
async function enter(page,who=ref){
 page.once('dialog',d=>d.accept());await page.locator('#studentSelect').selectOption(who);
 if(await page.locator('#miniPaperEnter').count())await page.locator('#miniPaperEnter').click();
}
test('Hủy xác nhận rồi tải lại không mở bài hoặc tạo lượt',async()=>{
 const f=await fixture();try{f.page.once('dialog',d=>d.dismiss());await f.page.locator('#studentSelect').selectOption(ref);
 if(await f.page.locator('#miniPaperEnter').count())await f.page.locator('#miniPaperEnter').click();
 await f.page.reload();await f.page.locator('#studentSelect').waitFor();await f.page.clock.runFor(1000);
 assert.equal(f.opens.length,0);assert.equal(await f.page.locator('#listeningView').isVisible(),false);
 }finally{await f.context.close();}
});
test('Paper có hạn cũ vẫn phải xác nhận, không tự nộp khi chờ lâu, nền hoặc tải lại',async()=>{
 const f=await fixture({reading:true,legacy:{studentRef:ref,attemptToken:token,examSessionToken:session,readingDeadlineAt:'2026-10-07T01:00:00Z'}});
 try{assert.equal(f.opens.length,0);await enter(f.page);await f.page.locator('#readingView').waitFor({state:'visible'});
 await f.page.clock.fastForward(60*60*1000);assert.equal(f.writes.length,0);assert.equal(await f.page.locator('#submitReading').isEnabled(),true);
 await f.page.reload();await f.page.locator('#studentSelect').waitFor();assert.equal(await f.page.locator('#readingView').isVisible(),false);
 await enter(f.page);await f.page.locator('#readingView').waitFor({state:'visible'});assert.equal(f.writes.length,0);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('Paper gửi lại sau mất mạng giữ đáp án, token, thế hệ và chỉ nộp khi bấm',async()=>{
 const f=await fixture({reading:true,offline:true});try{
 await enter(f.page);await f.page.locator('#readingView').waitFor({state:'visible'});await f.page.locator('#readingQuestions [data-number]').first().fill('synthetic');
 f.page.once('dialog',d=>d.accept());await f.page.locator('#submitReading').click();await f.page.getByText('Không thể lưu Reading:',{exact:false}).waitFor();
 f.online();f.page.once('dialog',d=>d.accept());await f.page.locator('#submitReading').click();await f.page.locator('#resultReadyView').waitFor({state:'visible'});
 assert.equal(f.writes.length,2);assert.deepEqual(f.writes[0].answers,f.writes[1].answers);assert.equal(f.writes[1].attemptToken,token);
 assert.equal(f.writes[1].attemptMode,'answer_sheet');assert.equal(f.writes[1].generation,0);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('Đổi người bỏ phản hồi nháp đang chờ; mobile không tràn ngang',async()=>{
 const f=await fixture({delayDraft:true,mobile:true});try{
 await enter(f.page);await f.page.locator('#listeningView').waitFor({state:'visible'});
 await f.page.locator('#listeningQuestions [data-number]').first().fill('synthetic');await f.page.clock.runFor(1000);await f.draftSeen;
 await f.page.locator('#miniPaperChange').click();await enter(f.page,other);await f.page.locator('#listeningView').waitFor({state:'visible'});
 f.releaseDraft();await f.page.clock.runFor(1000);assert.equal(await f.page.locator('#listeningQuestions [data-number]').first().inputValue(),'');
 assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(f.errors,[]);
 }finally{f.releaseDraft();await f.context.close();}
});
test('API mở lỗi giữ lựa chọn và nháp cũ; không mở vùng nhập',async()=>{
 const f=await fixture({openError:true,legacy:{drafts:{listening:{11:'B'}}}});try{
 await enter(f.page);await f.page.getByText('Chưa chuẩn bị được bài thi:',{exact:false}).waitFor();
 assert.equal(await f.page.locator('#listeningView').isVisible(),false);assert.equal(await f.page.locator('#miniPaperEnter').isEnabled(),true);
 assert.ok((await f.page.evaluate(()=>localStorage.getItem('izone-test:mini-test-k56:IC2264'))).includes('B'));
 }finally{await f.context.close();}
});
test('Nháp Reading mất mạng được phục hồi sau tải lại và xác nhận đúng người',async()=>{
 const f=await fixture({reading:true,offlineDraft:true});try{
 await enter(f.page);await f.page.locator('#readingView').waitFor({state:'visible'});
 await f.page.locator('#readingQuestions [data-number]').first().fill('UNSAVED-SYNTHETIC');await f.page.clock.runFor(1000);
 await f.page.reload();await f.page.locator('#studentSelect').waitFor();await enter(f.page);
 await f.page.locator('#readingView').waitFor({state:'visible'});
 assert.equal(await f.page.locator('#readingQuestions [data-number]').first().inputValue(),'UNSAVED-SYNTHETIC');assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('CBT chỉ dùng tên/lượt cũ sau xác nhận; hủy rồi xác nhận lại giữ đúng token cũ',async()=>{
 const f=await fixture({legacy:{studentRef:ref,studentName:'Học viên giả lập',attemptToken:token,examSessionToken:session,
  listeningSubmitted:true,readingDeadlineAt:'2026-10-07T02:25:00Z'}});
 try{
 await f.page.goto(base+'/term-tests/mini-test-k56-computer-based/?class=IC2264');await f.page.locator('#identityConfirm').waitFor({state:'visible'});
 assert.equal(f.opens.length,0);await f.page.locator('#cancelIdentity').click();assert.equal(f.opens.length,0);
 await f.page.locator('#bootstrapStudent').selectOption(ref);await f.page.locator('#confirmIdentity').click();
 await f.page.getByText('Máy chủ chưa xác nhận lượt thi CBT.',{exact:false}).waitFor();
 assert.equal(f.opens.length,1);assert.equal(f.opens[0].attemptToken,token);assert.equal(f.opens[0].attemptMode,'cbt');
 const saved=await f.page.evaluate(()=>JSON.parse(localStorage.getItem('izone-test:mini-test-k56:IC2264:cbt')));
 assert.equal(saved.readingDeadlineAt,'2026-10-07T02:25:00Z');assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('CBT mới đọc đúng kho riêng và tự thu Reading theo hạn máy chủ',async()=>{
 const f=await fixture({reading:true});try{
 await f.page.route('**/api/**/attempt/prepare',async route=>{
  f.opens.push(route.request().postDataJSON());
  await route.fulfill({json:{ok:true,attemptMode:'cbt',policy:{timed:true,autoSubmit:true},generation:0,
   attemptToken:token,examSessionToken:session,studentName:'Học viên giả lập',examMode:'lis_first',nextSection:'reading',
   listeningSubmitted:true,readingSubmitted:false,readingStartedAt:'2026-10-07T02:00:00Z',readingDeadlineAt:'2026-10-07T02:01:00Z',
   listeningDraft:{},readingDraft:{},listeningDraftRevision:0,readingDraftRevision:0,serverNow:'2026-10-07T02:00:00Z',
   content:await f.page.evaluate(()=>window.K56_TERM_TEST_CONTENT)}});
 });
 await f.page.goto(base+'/term-tests/mini-test-k56-computer-based/?class=IC2264');
 await f.page.locator('#bootstrapStudent').selectOption(ref);await f.page.locator('#confirmIdentity').click();
 await f.page.locator('#readingView').waitFor({state:'visible'});await f.page.clock.runFor(1000);
 assert.equal(await f.page.locator('#readingView .cbt-reading-clock').getAttribute('data-seconds'),'59');
 await f.page.clock.fastForward(61*1000);await f.page.clock.runFor(1000);
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].attemptToken,token);assert.notEqual(f.writes[0].attemptMode,'answer_sheet');
 assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('Listening legacy chưa có attempt vẫn giữ nháp và token phiên sau xác nhận cùng người',async()=>{
 const f=await fixture({legacy:{studentRef:ref,studentName:'Học viên giả lập',examSessionToken:session,
  drafts:{listening:{1:'UNACKED-SYNTHETIC'}},draftRevisions:{listening:3},draftAckRevisions:{listening:1}}});
 try{
 await f.page.addInitScript(()=>localStorage.setItem('izone-test-ui:mini-test-k56:IC2264',JSON.stringify({audio:{started:true,time:100}})));
 await f.page.goto(base+'/term-tests/mini-test-k56-computer-based/?class=IC2264');await f.page.locator('#identityConfirm').waitFor({state:'visible'});
 await f.page.locator('#confirmIdentity').click();await f.page.getByText('Máy chủ chưa xác nhận lượt thi CBT.',{exact:false}).waitFor();
 assert.equal(f.opens[0].examSessionToken,session);assert.equal(f.opens[0].legacyElapsedSeconds,100);
 const saved=await f.page.evaluate(()=>JSON.parse(localStorage.getItem('izone-test:mini-test-k56:IC2264:cbt')));
 assert.equal(saved.drafts.listening[1],'UNACKED-SYNTHETIC');assert.equal(saved.draftRevisions.listening,3);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
