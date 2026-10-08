import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const refs=['11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444'];
const tokens=['22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555'];
const sessions=['33333333-3333-4333-8333-333333333333','66666666-6666-4666-8666-666666666666'];
const key='izone-test:mini-test-k56:IC2264:cbt',uiKey='izone-test-ui:mini-test-k56:IC2264',noteKey='izone-test-annotations:mini-test-k56:IC2264';
let browser,server,base;
before(async()=>{
 server=createServer(async(req,res)=>{try{
  let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';
  const file=resolve(root,'.'+p);if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\'))throw Error('outside');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,channel:'chrome'});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});

// Chỉ API là fixture RAM. Toàn bộ HTML, bootstrap, autosave, radio, navigation và annotations là source Pages đang phát hành.
async function fixture({cached,reset=false,prepareError=false,rosterError=false,mode='lis_first',viewport={width:1280,height:720},longName=false}={}){
 const context=await browser.newContext({viewport});const requests=[],errors=[];
 const owners=refs.map(()=>({draft:{},revision:0}));let resetPending=reset,prepareErrorPending=prepareError,rosterErrorPending=rosterError;
 if(cached)await context.addInitScript(({cached,key,uiKey,noteKey})=>{
  if(location.hostname!=='127.0.0.1')return;
  for(const storage of [sessionStorage,localStorage]){
   storage.setItem(key,JSON.stringify(cached));
   storage.setItem(uiKey,JSON.stringify({flags:{reading:{1:true}},fontSize:{reading:120}}));
   storage.setItem(noteKey,JSON.stringify({runId:cached.annotationRunId,revision:1,records:[]}));
  }
 },{cached,key,uiKey,noteKey});
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=req.url(),body=req.method()==='POST'?req.postDataJSON():{};
  requests.push({url:new URL(url).pathname,body});let out={ok:true};
  if(url.includes('/roster?')){
   if(rosterErrorPending){rosterErrorPending=false;await route.fulfill({status:503,json:{error:'UNAVAILABLE',message:'Roster fixture tạm lỗi'}});return;}
   out={ok:true,class:{name:'IC2264'},students:refs.map((ref,i)=>({ref,name:longName?'Người giả có tên rất dài để kiểm hiển thị trên màn hình nhỏ của bài Mini số '+i:'Người giả '+i}))};
  }
  else if(url.endsWith('/attempt/prepare')){
   if(resetPending){resetPending=false;await route.fulfill({status:404,json:{ok:false,error:'ATTEMPT_NOT_FOUND',message:'Lượt cũ đã reset trong fixture'}});return;}
   if(prepareErrorPending){prepareErrorPending=false;await route.fulfill({status:503,json:{error:'UNAVAILABLE',message:'Prepare fixture tạm lỗi'}});return;}
   const i=refs.indexOf(body.studentRef);assert.ok(i>=0);const o=owners[i];
   out={ok:true,attemptMode:'cbt',policy:{timed:true,autoSubmit:true},generation:reset?1:0,
    attemptToken:tokens[i],examSessionToken:sessions[i],studentName:'Người giả '+i,examMode:mode,nextSection:'reading',
    listeningSubmitted:true,readingSubmitted:false,readingStartedAt:'2026-10-08T02:00:00Z',readingDeadlineAt:'2026-10-08T02:25:00Z',
    listeningDraft:{},readingDraft:o.draft,listeningDraftRevision:0,readingDraftRevision:o.revision,serverNow:'2026-10-08T02:00:00Z',
    content:await context.pages()[0].evaluate(()=>window.K56_TERM_TEST_CONTENT)};
  }else if(url.endsWith('/reading/draft')){
   const i=tokens.indexOf(body.attemptToken);assert.ok(i>=0);const o=owners[i],accepted=body.revision>o.revision;
   if(accepted){o.draft=body.answers;o.revision=body.revision;}out={ok:true,accepted,revision:o.revision,draft:o.draft};
  }
  await route.fulfill({json:out});
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-08T02:00:00Z')});
 await page.goto(base+'/term-tests/mini-test-k56-computer-based/?class=IC2264&mode='+mode);
 if(!rosterError)await page.locator('#bootstrapStudent option').nth(2).waitFor({state:'attached'});
 async function enter(i=0){await page.locator('#bootstrapStudent').selectOption(refs[i]);await page.locator('#confirmIdentity').click();await page.locator('#readingView').waitFor({state:'visible'});await page.locator('#cbtNotesPanel').waitFor({state:'attached'});}
 return{context,page,requests,owners,errors,enter,triggerReset(){resetPending=true;}};
}
async function eventually(check){for(let i=0;i<60&&!await check();i++)await new Promise(r=>setTimeout(r,50));assert.ok(await check(),'Hành vi mong đợi chưa xuất hiện');}

test('A03: link thiếu class không tải roster, không tạo lượt và chỉ báo mã lớp không hợp lệ',async()=>{
 const f=await fixture();try{
  const before=f.requests.length;await f.page.goto(base+'/term-tests/mini-test-k56-computer-based/');
  await f.page.getByText('Link chưa có mã lớp hợp lệ.',{exact:true}).waitFor();assert.equal(f.requests.length,before);
  assert.equal(await f.page.locator('#readingView').count(),0);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

for(const mode of ['lis_first','read_first'])test(`A10 ${mode}: roster 503 giữ phòng chờ khóa; thử lại sau hồi phục cho chọn và xác nhận tên`,async()=>{
 const f=await fixture({rosterError:true,mode});try{
  await f.page.getByText('Không thể mở phòng chờ:',{exact:false}).waitFor();assert.equal(await f.page.locator('#readingView').count(),0);
  assert.equal(f.requests.filter(r=>r.url.endsWith('/attempt/prepare')).length,0);
  await f.page.getByRole('button',{name:'Thử tải lại',exact:true}).click();await f.page.locator('#bootstrapStudent option').nth(2).waitFor({state:'attached'});
  assert.equal(await f.page.locator('#bootstrapRetry').isVisible(),false);assert.equal(await f.page.locator('#bootstrapNotice').isVisible(),false);
  await f.page.locator('#bootstrapStudent').selectOption(refs[0]);assert.equal(f.requests.filter(r=>r.url.endsWith('/attempt/prepare')).length,0);
  await f.page.locator('#confirmIdentity').click();await f.page.locator('#readingView').waitFor({state:'visible'});assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

for(const mode of ['lis_first','read_first'])test(`A10 ${mode}: prepare 503 giữ token và nháp đã có; có nút thử lại để nối chính lượt cũ`,async()=>{
 const f=await fixture({prepareError:true,mode,cached:{studentRef:refs[0],studentName:'Người giả 0',attemptToken:tokens[0],examSessionToken:sessions[0],drafts:{listening:{},reading:{1:'PENDING-RECOVERY'}},draftRevisions:{listening:0,reading:2},draftAckRevisions:{listening:0,reading:0}}});
 try{
  await f.page.locator('#confirmIdentity').click();await f.page.getByText('Chưa chuẩn bị được bài thi:',{exact:false}).waitFor();
  assert.equal(await f.page.locator('#readingView').count(),0);
  const saved=await f.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(saved.attemptToken,tokens[0]);assert.equal(saved.drafts.reading[1],'PENDING-RECOVERY');
  await f.page.getByRole('button',{name:'Thử tải lại',exact:true}).click();await f.page.locator('#readingView').waitFor({state:'visible'});
  assert.equal(await f.page.locator('#readingQuestions [data-number="1"]').inputValue(),'PENDING-RECOVERY');
  const preps=f.requests.filter(r=>r.url.endsWith('/attempt/prepare'));assert.equal(preps.length,2);
  for(const p of preps){assert.equal(p.body.studentRef,refs[0]);assert.equal(p.body.attemptToken,tokens[0]);assert.equal(p.body.examSessionToken,sessions[0]);}
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('A02/A08: quay lại chọn B không nhận nháp, ghi chú, UI hoặc token owner A chưa bắt đầu',async()=>{
 const f=await fixture({cached:{studentRef:refs[0],studentName:'Người giả 0',annotationRunId:'old-owner-run',drafts:{listening:{1:'PRIVATE-A'},reading:{1:'PRIVATE-A'},writing:{task1:'',task2:'PRIVATE-A',outline:'PRIVATE-A'}},draftRevisions:{listening:5,reading:5},draftAckRevisions:{listening:0,reading:0}}});
 try{
  await f.page.locator('#bootstrapStudent').selectOption(refs[0]);await f.page.locator('#cancelIdentity').click();
  assert.equal(f.requests.filter(r=>r.url.endsWith('/attempt/prepare')).length,0);
  await f.enter(1);assert.equal(await f.page.locator('#readingQuestions [data-number="1"]').inputValue(),'');
  const prep=f.requests.find(r=>r.url.endsWith('/attempt/prepare'));assert.equal(prep.body.studentRef,refs[1]);
  assert.ok(!JSON.stringify(prep.body).includes(tokens[0]));assert.ok(!JSON.stringify(prep.body).includes('PRIVATE-A'));
  const saved=await f.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  assert.equal(saved.studentRef,refs[1]);assert.notEqual(saved.annotationRunId,'old-owner-run');assert.ok(!JSON.stringify(saved).includes('PRIVATE-A'));
  assert.equal(await f.page.locator('#readingView [data-nav-number="1"]').getAttribute('class').then(c=>c.includes('is-flagged')),false);
  await f.page.locator('#readingQuestions [data-number="1"]').fill('PUBLIC-B');await f.page.clock.runFor(1000);
  await eventually(()=>f.owners[1].draft[1]==='PUBLIC-B');assert.deepEqual(f.owners[0].draft,{});assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('A06: 404 lượt cũ mở lại lựa chọn; lần xác nhận mới không gửi token/nháp đã reset',async()=>{
 const f=await fixture({reset:true,cached:{studentRef:refs[0],studentName:'Người giả 0',attemptToken:tokens[0],examSessionToken:sessions[0],annotationRunId:'old-run',drafts:{listening:{},reading:{1:'STALE'}},draftRevisions:{listening:0,reading:8}}});
 try{
  await f.page.locator('#confirmIdentity').click();await f.page.getByText('Lượt làm trước đã được reset.',{exact:false}).waitFor();
  assert.equal(await f.page.locator('#bootstrapStudent').inputValue(),'');assert.equal(await f.page.locator('#readingView').count(),0);
  const state=await f.page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}'),key);assert.ok(!state.attemptToken);assert.ok(!state.drafts);
  await f.enter(1);const preps=f.requests.filter(r=>r.url.endsWith('/attempt/prepare'));
  assert.equal(preps.length,2);assert.ok(!preps[1].body.attemptToken);assert.ok(!preps[1].body.examSessionToken);
  assert.equal(await f.page.locator('#readingQuestions [data-number="1"]').inputValue(),'');assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('B05: mỗi câu TFNG 6–9 chỉ có ba radio; đổi đáp án được autosave và reload đúng',async()=>{
 const f=await fixture();try{
  await f.enter();
  for(let n=6;n<=9;n++){
   const card=f.page.locator(`#readingView [data-question-number="${n}"]`);assert.equal(await card.locator('input[type="radio"]').count(),3);
   for(const answer of ['TRUE','FALSE','NOT GIVEN']){
    await f.page.getByRole('radio',{name:`Câu ${n}, đáp án ${answer}`,exact:true}).check();
    assert.equal(await f.page.locator(`#readingQuestions [data-number="${n}"]`).inputValue(),answer);
    assert.equal(await card.locator('input[type="radio"]:checked').count(),1);
   }
  }
  await f.page.clock.runFor(1000);await eventually(()=>[6,7,8,9].every(n=>f.owners[0].draft[n]==='NOT GIVEN'));
  await f.page.reload();await f.page.locator('#confirmIdentity').click();await f.page.locator('#readingView').waitFor({state:'visible'});await f.page.locator('#cbtNotesPanel').waitFor({state:'attached'});
  for(let n=6;n<=9;n++)assert.equal(await f.page.getByRole('radio',{name:`Câu ${n}, đáp án NOT GIVEN`,exact:true}).isChecked(),true);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('B07: 13 số câu điều hướng đúng ô; đánh dấu và đáp án tồn tại sau reload',async()=>{
 const f=await fixture();try{
  await f.enter();const view=f.page.locator('#readingView');assert.equal(await view.locator('[data-nav-number]').count(),13);
  for(let n=1;n<=13;n++){
   await view.locator(`[data-nav-number="${n}"]`).click();await f.page.clock.runFor(50);
   const active=await f.page.evaluate(()=>document.activeElement.dataset.number||document.activeElement.getAttribute('aria-label'));
   assert.ok(active===String(n)||active?.startsWith(`Câu ${n}, đáp án`),`Câu ${n}: ${active}`);
  }
  await f.page.locator('#readingQuestions [data-number="1"]').fill('NAV-SAVED');
  await view.getByRole('button',{name:'Đánh dấu câu 1',exact:true}).click();
  assert.match(await view.locator('[data-nav-number="1"]').getAttribute('aria-label'),/đã làm.*đã đánh dấu/);
  await f.page.clock.runFor(1000);await eventually(()=>f.owners[0].draft[1]==='NAV-SAVED');
  await f.page.reload();await f.page.locator('#confirmIdentity').click();await view.waitFor({state:'visible'});await f.page.locator('#cbtNotesPanel').waitFor({state:'attached'});
  assert.equal(await f.page.locator('#readingQuestions [data-number="1"]').inputValue(),'NAV-SAVED');
  assert.match(await view.locator('[data-nav-number="1"]').getAttribute('aria-label'),/đã đánh dấu/);
  await view.getByRole('button',{name:'Đánh dấu câu 1',exact:true}).click();assert.doesNotMatch(await view.locator('[data-nav-number="1"]').getAttribute('aria-label'),/đã đánh dấu/);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('B08: chọn văn bản thật, highlight và note; reload giữ đúng run và không mất đáp án',async()=>{
 const f=await fixture();try{
  await f.enter();await f.page.locator('#readingQuestions [data-number="1"]').fill('NOTE-SAVED');await f.page.clock.runFor(1000);
  const select=async()=>{
   await f.page.locator('.cbt-passage-body').click({position:{x:10,y:10}});await f.page.clock.runFor(1000);
   await f.page.evaluate(()=>{
    const root=document.querySelector('.cbt-passage-body'),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode())if(node.textContent.trim().length>=20)break;
    const range=document.createRange();range.setStart(node,0);range.setEnd(node,20);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);document.dispatchEvent(new Event('selectionchange'));
   });await f.page.clock.runFor(50);await f.page.locator('#cbtSelectionMenu').waitFor({state:'visible'});
  };
  await select();await f.page.locator('#cbtSelectionMenu').getByRole('button',{name:'Highlight',exact:true}).click();
  assert.equal(await f.page.locator('.cbt-passage-body .cbt-annotation.is-highlight').count(),1);
  await f.page.locator('.cbt-passage-body .cbt-annotation.is-highlight').click();await f.page.clock.runFor(50);
  await f.page.locator('#cbtSelectionMenu').getByRole('button',{name:'Note',exact:true}).click();
  await f.page.getByRole('textbox',{name:'Nội dung ghi chú',exact:true}).fill('Ghi chú giả Mini');await f.page.clock.runFor(500);
  await f.page.getByRole('button',{name:'Đóng Notes',exact:true}).click();
  const notes=await f.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),noteKey);assert.equal(notes.records[0].note,'Ghi chú giả Mini');
  await f.page.reload();await f.page.locator('#confirmIdentity').click();await f.page.locator('#readingView').waitFor({state:'visible'});await f.page.locator('#cbtNotesPanel').waitFor({state:'attached'});
  assert.equal(await f.page.locator('.cbt-passage-body .cbt-annotation.is-highlight.has-note').count(),1);
  await f.page.locator('.cbt-passage-body .cbt-annotation.has-note').click();await f.page.clock.runFor(50);
  assert.equal(await f.page.getByRole('textbox',{name:'Nội dung ghi chú',exact:true}).inputValue(),'Ghi chú giả Mini');
  assert.equal(await f.page.locator('#readingQuestions [data-number="1"]').inputValue(),'NOTE-SAVED');
  await f.page.getByRole('button',{name:'Đóng Notes',exact:true}).click();f.triggerReset();
  await f.page.reload();await f.page.locator('#confirmIdentity').click();await f.page.getByText('Lượt làm trước đã được reset.',{exact:false}).waitFor();
  await f.enter(1);assert.equal(await f.page.locator('.cbt-passage-body .cbt-annotation').count(),0);
  assert.equal(await f.page.locator('#readingQuestions [data-number="1"]').inputValue(),'');
  assert.ok(!await f.page.evaluate(k=>localStorage.getItem(k)?.includes('Ghi chú giả Mini'),noteKey));
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

for(const width of [320,360,390])test(`F10: viewport ${width}px với tên dài và cỡ chữ 120% không tràn ngang`,async()=>{
 const f=await fixture({viewport:{width,height:844},longName:true});try{
  assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await f.enter();
  const larger=f.page.locator('#readingView').getByRole('button',{name:'Tăng cỡ chữ',exact:true});
  await larger.click();await larger.click();assert.equal(await f.page.locator('#readingView .cbt-content-viewport').getAttribute('data-font-size'),'120');
  assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await f.page.locator('#readingView [data-nav-number="13"]').click();assert.equal(await f.page.locator('#readingQuestions [data-number="13"]').isVisible(),true);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

