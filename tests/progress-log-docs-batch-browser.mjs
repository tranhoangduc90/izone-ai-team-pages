// Dữ liệu giả, Chrome thật: lỗi một nguồn, thử lại, loại câu, mất phản hồi và phản hồi đến sau đổi nháp.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
test('Lô Docs: partial/retry, key, lựa chọn, biên nhận và bỏ phản hồi cũ',{timeout:90000},async t=>{
 const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/test'){res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/progress-log/styles.css"><link rel="stylesheet" href="/progress-log/teacher.css"><button id="open">Mở</button>');return;}
  try{const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+sep))throw Error();res.setHeader('content-type',extname(file)==='.js'?'text/javascript':'text/css');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/test');
  await page.evaluate(async()=>{
   const {createDocsBatchImporter}=await import('/progress-log/docs-batch-import.js');
   const copy=v=>structuredClone(v),hash=n=>String(n).repeat(64);window.context={draftId:crypto.randomUUID(),revision:1,contextKey:'first',blocks:[]};
   window.calls=[];window.writes=0;window.applied=null;window.deferList=false;
   const session={id:crypto.randomUUID(),draftId:window.context.draftId,draftRevision:1,preserveSourceParts:true,catalogRevision:0,plan:null,documents:[1,2,3].map(n=>({documentKey:hash(n),documentId:'fixture_batch_'+n,status:'pending',canRead:true,generation:0}))};
   let readCount={},lost=true,operation=null;
   window.importer=createDocsBatchImporter({getContext:()=>window.context,refreshDraft:async()=>copy(window.context),onApplied:reply=>{window.applied=reply;window.context.revision=2;},apiRequest:async(path,options={})=>{
    window.calls.push({path,body:copy(options.body),method:options.method||'GET'});
    if(path.endsWith('/docs-import-sessions')){if(options.method==='POST')return {session:copy(session)};
     if(window.deferList)return new Promise(resolve=>{window.resolveList=()=>resolve({sessions:[{id:'obsolete',created_at:'2026-10-25T01:00:00Z',documents:99}]});});
     return {sessions:session.documents.some(d=>d.status!=='pending')?[{id:session.id,documents:3,created_at:'2026-10-25T01:00:00Z'}]:[]};}
    if(path.endsWith('/read')){const doc=session.documents.find(d=>path.includes(d.documentKey));readCount[doc.documentKey]=(readCount[doc.documentKey]||0)+1;
     if(doc.documentKey===hash(3)&&readCount[doc.documentKey]===1){doc.status='error';doc.error={message:'Nguồn giả tạm thời không đọc được'};session.catalogRevision++;return {session:copy(session)};}
     doc.status='ready';doc.error=null;doc.generation++;session.catalogRevision++;
     doc.catalog={source:{title:'File giả '+doc.documentKey[0]},characterCount:25001,questionCount:1,units:[{unitId:doc.documentKey,label:'Buổi giả '+doc.documentKey[0]+' · Phần 1',questionCount:1}],warnings:[],manualRegions:doc.documentKey===hash(1)?[{label:'Khảo sát đầu file',characters:21000,excerpt:'Phần cần giảng viên soạn riêng'}]:[]};
     return {session:copy(session)};}
    if(path.endsWith('/preview')){session.plan={planId:crypto.randomUUID(),baseRevision:window.context.revision,catalogRevision:session.catalogRevision,
     stats:{selectedQuestions:options.body.unitIds.length,convertedQuestions:options.body.unitIds.length,needsReviewQuestions:0,incompleteDocuments:session.documents.filter(d=>d.status!=='ready').length,alreadyImportedQuestions:0,duplicateSourceQuestions:0,keyProblems:1},warnings:[],
     results:options.body.unitIds.map(id=>({questionId:id,unitId:id,status:'ready',label:'Câu giả '+id[0],prompt:'Nội dung nguồn giả',warnings:[],reviews:[{sourceLabel:'Câu giả '+id[0],sourceQuote:'Nguồn giả',sourceKey:'Key giả',keyStatus:'mismatch',candidates:[],messages:['KEY KHÔNG KHỚP: kiểm lại trước khi duyệt/phát.']}]}))};return {plan:copy(session.plan)};}
    if(path.endsWith('/apply')){if(!operation){operation=copy(options.body);window.writes++;}else if(JSON.stringify(operation)!==JSON.stringify(options.body))throw Error('Đã đổi thao tác khi thử lại');
     if(lost){lost=false;throw Error('Mất phản hồi giả sau khi đã ghi');}return {draft:{revision:2},receipt:{appliedQuestions:operation.questionIds.length},replayed:true};}
    return {session:copy(session)};
   }});document.getElementById('open').onclick=()=>window.importer.open();
  });
  const dialog=page.locator('dialog.docs-batch-dialog');await page.locator('#open').click();
  await t.test('Lỗi một tài liệu giữ nguồn khỏe, thử lại riêng và cảnh báo vùng chưa chuyển',async()=>{
   await dialog.getByLabel('Các link Google Docs').fill('fixture_batch_1\nfixture_batch_2\nfixture_batch_3');await dialog.getByRole('button',{name:'Tạo phiên và đọc các tài liệu',exact:true}).click();
   await dialog.getByText('2/3 tài liệu đã đọc',{exact:false}).waitFor();await dialog.getByText('CẦN XỬ LÝ · Khảo sát đầu file',{exact:true}).waitFor();
   assert.equal(await dialog.getByText('25.001 ký tự',{exact:false}).count(),2);
   await dialog.getByRole('button',{name:'Thử đọc tài liệu này',exact:true}).click();await dialog.getByText('3/3 tài liệu đã đọc',{exact:false}).waitFor();
   assert.deepEqual(await page.evaluate(()=>[1,2,3].map(n=>window.calls.filter(c=>c.path.includes(String(n).repeat(64))&&c.path.endsWith('/read')).length)),[1,1,2]);
  });
  await t.test('Loại câu và retry giữ cùng thao tác, cảnh báo key rõ trên hai cỡ màn hình',async()=>{
   for(const check of await dialog.locator('[data-docs-unit-id]').all())await check.check();await dialog.locator('[data-docs-preview]').click();
   await dialog.getByRole('alert').filter({hasText:'KEY KHÔNG KHỚP'}).first().waitFor();await dialog.locator('[data-docs-question-id]').last().uncheck();
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   await dialog.locator('[data-docs-apply]').click();await dialog.getByRole('button',{name:'Kiểm tra lại lần thêm vừa rồi',exact:true}).waitFor();await dialog.locator('[data-docs-apply]').click();await dialog.waitFor({state:'hidden'});
   assert.deepEqual(await page.evaluate(()=>({writes:window.writes,count:window.applied.receipt.appliedQuestions})),{writes:1,count:2});
   assert.equal(await page.evaluate(()=>Object.values(localStorage).concat(Object.values(sessionStorage)).some(s=>s.includes('Key giả')||s.includes('sourceKey'))),false);
  });
  await t.test('Mở lại phiên không đọc nguồn; Escape đóng và phản hồi đến sau đổi nháp bị bỏ',async()=>{
   await page.locator('#open').click();await dialog.getByLabel('Phiên nhập gần đây').selectOption({index:1});await dialog.getByText('3/3 tài liệu đã đọc',{exact:false}).waitFor();
   assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.path.endsWith('/read')).length),4);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   await page.evaluate(()=>{window.importer.dispose();window.context={...window.context,contextKey:'second'};window.deferList=true;});await page.locator('#open').click();
   await page.waitForFunction(()=>Boolean(window.resolveList));await page.evaluate(()=>{const resolve=window.resolveList;window.importer.dispose();window.context={...window.context,contextKey:'third'};window.deferList=false;window.importer.open();resolve();});
   await dialog.getByLabel('Phiên nhập gần đây').waitFor();assert.equal(await dialog.getByLabel('Phiên nhập gần đây').locator('option[value="obsolete"]').count(),0);
   await dialog.getByLabel('Đóng nhập Docs').click();assert.deepEqual(errors,[]);
  });
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
