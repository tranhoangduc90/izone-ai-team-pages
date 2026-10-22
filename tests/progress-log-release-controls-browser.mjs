// Chrome thao tác thật trên các mô-đun mới; API giả có trạng thái, mọi mạng ngoài bị chặn.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
test('Gia hạn giữ chữ khi lỗi/đóng; kho cả hàng, sửa ở đầu; bộ soạn đủ dạng và chữa bài theo quyền',{timeout:60000},async()=>{
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://local').pathname;
  if(path==='/check'){res.setHeader('content-type','text/html');return res.end('<!doctype html><main><section id="manage"></section><section id="bank"></section><section id="editor"></section><section id="feedback"></section></main>');}
  const file=resolve(root,'.'+path);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',extname(file)==='.css'?'text/css':'text/javascript');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(5000);const errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 try{await page.goto(`http://127.0.0.1:${server.address().port}/check`);
 await page.evaluate(async()=>{
  const {mountAssignmentManagement}=await import('/progress-log/thuy-live/assignment-management.js');window.requests=[];window.failWrite=true;window.changed=[];
  mountAssignmentManagement({host:document.querySelector('#manage'),getContext:()=>({assignmentId:'assignment-a',classId:'1294',className:'Lớp thử',sessionNumber:11,title:'Phiếu thử'}),
   request:async(path,options={})=>{window.requests.push({path,...options});if(options.method==='POST'){if(window.failWrite)throw Error('Lỗi mạng kiểm thử');return {management:{revision:1}};}return {management:{revision:0,status:'published'},assignments:[]};},onChanged:async(context,action)=>window.changed.push(action)});
 });
 await page.getByRole('button',{name:'Gia hạn',exact:true}).click();await page.getByLabel('Hạn mới (giờ Việt Nam)',{exact:true}).fill('2026-10-24T12:00');await page.getByLabel('Lý do',{exact:true}).fill('Lớp gặp sự cố mạng');
 await page.getByRole('button',{name:'Gia hạn cho cả lớp',exact:true}).click();await page.getByRole('status').filter({hasText:'Lỗi mạng kiểm thử'}).waitFor();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Gia hạn',exact:true}).click();assert.equal(await page.getByLabel('Lý do',{exact:true}).inputValue(),'Lớp gặp sự cố mạng');
 await page.evaluate(()=>window.failWrite=false);await page.getByRole('button',{name:'Gia hạn cho cả lớp',exact:true}).click();await page.waitForFunction(()=>window.changed.length===1);
 const writes=await page.evaluate(()=>window.requests.filter(r=>r.method==='POST'));assert.equal(writes[0].body.operationId,writes[1].body.operationId);assert.equal(writes[1].body.closesAt,'2026-10-24T05:00:00.000Z');
 await page.evaluate(async()=>{const {createFormLibrary}=await import('/progress-log/teacher-form-library.js');window.copied=[];
  const entry={id:'entry-a',title:'Phiếu thư viện thử',itemCount:2,skills:['reading'],createdAt:'2026-10-22T00:00:00Z'};
  window.bank=createFormLibrary({host:document.querySelector('#bank'),request:async path=>path.includes('?')?{entries:[entry]}:{entry:{...entry,definition:{blocks:[{title:'Phần thử',items:[{prompt:'Câu nguồn',options:[]}]}]}}},onCopy:async entry=>window.copied.push(entry.id)});await window.bank.refresh();
 });
 await page.locator('#bank tbody tr td').last().click();await page.getByRole('dialog').getByRole('button',{name:'Sửa bài tập',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.copied),['entry-a']);
 await page.evaluate(async()=>{const m=await import('/progress-log/teacher-form-editor.js'),v=m.newEditorPayload('Bộ đủ dạng');window.editor=m.createFormDraftEditor({host:document.querySelector('#editor'),apiRequest:async()=>({drafts:[]})});
  v.definition.blocks[0].items=['mcq','multi','matching','short_answer','reflection'].map((type,index)=>m.newEditorItem(type,index+1));
  v.definition.blocks[0].items[4].interactionConfig.hintText='Gợi ý có sẵn';
  window.editor.openDraft({...v,id:crypto.randomUUID(),classId:'1294',sessionNumber:11,revision:1,status:'draft'});
  const {partFeedback}=await import('/progress-log/thuy-live/part-feedback.js');const b=v.definition.blocks[0],i=b.items[1];window.fb={b,result:{answerRelease:'released',items:[{itemVersionId:i.itemVersionId,maxScore:1,verdict:'correct',rawAnswer:['A','B'],expectedAnswer:['A','B'],explanation:'Lời giải nguồn'}]}};
  document.querySelector('#feedback').append(partFeedback(b,window.fb.result));window.hiddenFeedback=partFeedback(b,{...window.fb.result,answerRelease:'hidden'});
 });
 assert.equal(await page.getByLabel('Đáp án đúng · A · Phương án A',{exact:true}).getAttribute('type'),'checkbox');
 await page.getByLabel('Đáp án đúng · A · Phương án A',{exact:true}).check();assert.equal((await page.evaluate(()=>window.editor.getPayload())).gradingKey.items[(await page.evaluate(()=>window.editor.getPayload())).definition.blocks[0].items[1].itemVersionId].expectedOptionIds[0],'A');
 assert.equal(await page.evaluate(()=>window.hiddenFeedback),null);assert.match(await page.locator('#feedback').innerText(),/Lời giải nguồn/);
 assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(done=>server.close(done));}
});
