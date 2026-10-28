// Kiểm nháp bộ soạn thật bằng API giả có trạng thái, gồm mất phản hồi sau khi đã ghi.
// Không có request tới máy chủ lớp thật; không dùng storage chứa đáp án chấm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
test('Thủy editor: đúng lớp, tự lưu, mất phản hồi, giữ node qua ba nhịp và mở lại Kho cá nhân',{timeout:60000},async()=>{
 const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local').pathname;
  if(path==='/fixture'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<!doctype html><link rel="stylesheet" href="/progress-log/thuy-live/styles.css"><body class="thuy-live thuy-teacher"><main id="formDraftEditor"></main>');}
  const file=resolve(root,'.'+path);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',{'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'text/plain');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);page.on('dialog',d=>d.accept());await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 try{
  await page.goto(origin+'/fixture');await page.evaluate(async()=>{
   const {createFormDraftEditor}=await import('/progress-log/teacher-form-editor.js');window.savedDraft=null;window.lost=true;window.calls=[];
   const request=async(path,options={})=>{
    const body=structuredClone(options.body);window.calls.push({path,...options,body});
    if(path.startsWith('/teacher/form-library?'))return {entries:[]};
    if(path==='/teacher/form-publications')return {publications:[]};
    if(path.startsWith('/teacher/form-drafts/review-queue'))return {drafts:[]};
    if(path.startsWith('/teacher/form-drafts?'))return {drafts:window.savedDraft?[{id:window.savedDraft.id,title:window.savedDraft.definition.title,sessionNumber:window.savedDraft.sessionNumber,revision:window.savedDraft.revision,status:window.savedDraft.status}]:[]};
    if(path==='/teacher/form-drafts'&&options.method==='POST'){
     window.savedDraft??={...body,id:'draft-a',revision:1,status:'draft'};
     if(window.lost){window.lost=false;throw Error('Mất phản hồi sau khi máy chủ đã lưu');}return {draft:structuredClone(window.savedDraft)};
    }
    if(path==='/teacher/form-drafts/draft-a/ai-import-preview'){
     const definition=structuredClone(window.savedDraft.definition),question={...structuredClone(definition.blocks[0].items[0]),itemVersionId:crypto.randomUUID(),itemFamilyId:crypto.randomUUID(),position:2,prompt:'Câu AI có sẵn từ nguồn'};
     definition.blocks.push({blockId:crypto.randomUUID(),checkpoint:1,title:'Phần nhập tạm',instructions:'',items:[question]});
     return {preview:{baseRevision:window.savedDraft.revision,rows:[{line:1,type:'reflection',checkpoint:1,slotCount:1,optionCount:0,required:true,graderType:'none',prompt:question.prompt}],errors:[],payload:{definition,gradingKey:structuredClone(window.savedDraft.gradingKey)}}};
    }
    if(path==='/teacher/form-drafts/draft-a'){
     if(options.method==='PUT'){if(window.holdSave)await new Promise(done=>{window.releaseSave=()=>{window.holdSave=false;done();};});if(body.expectedRevision!==window.savedDraft.revision)throw Error('Sai revision');window.savedDraft={...window.savedDraft,...body,revision:window.savedDraft.revision+1};}
     return {draft:structuredClone(window.savedDraft)};
    }
    throw Error('Ngoài fixture: '+path);
   };
   window.editor=createFormDraftEditor({host:document.querySelector('#formDraftEditor'),apiRequest:request,libraryEnabled:true});
   window.editor.setWorkspace({classes:[{class_id:'111',class_name:'Lớp khác'},{class_id:'1294',class_name:'IC2305'}],assignments:[],classId:'1294',sessionNumber:11});
  });
  await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();await page.getByRole('button',{name:'Khảo sát',exact:true}).click();await page.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();
  await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('general');
  await page.getByLabel('Tên bài tập',{exact:true}).fill('Phiếu nháp cần phục hồi');await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Nội dung trước lỗi');
  await page.getByRole('status').filter({hasText:'Mất phản hồi sau khi máy chủ đã lưu'}).waitFor();
  assert.equal(await page.getByLabel('Nội dung câu hỏi',{exact:true}).inputValue(),'Nội dung trước lỗi');
  await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Nội dung mới sau khi mất phản hồi');
  await page.getByRole('button',{name:'Thử lưu lại',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
  const state=await page.evaluate(()=>({draft:window.savedDraft,calls:window.calls.map(c=>({path:c.path,body:c.body,method:c.method})),keys:[...Object.keys(localStorage),...Object.keys(sessionStorage)]}));
  assert.equal(state.draft.classId,'1294');assert.equal(state.draft.sessionNumber,11);assert.equal(state.draft.definition.blocks[0].items[0].prompt,'Nội dung mới sau khi mất phản hồi');
  const creates=state.calls.filter(c=>c.path==='/teacher/form-drafts'&&c.method==='POST');assert.equal(creates.length,2);assert.deepEqual(creates[0].body,creates[1].body);assert.deepEqual(state.keys,[]);
  await page.getByRole('button',{name:'← Quản lý bài tập',exact:true}).click();await page.getByRole('tab',{name:/Kho cá nhân/}).click();
  await page.getByRole('button',{name:'Phiếu nháp cần phục hồi',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Sửa bài',exact:true}).click();
  assert.equal(await page.getByLabel('Nội dung câu hỏi',{exact:true}).inputValue(),'Nội dung mới sau khi mất phản hồi');
  await page.evaluate(()=>{window.readingNode=document.querySelector('textarea[aria-label="Nội dung câu hỏi"]');});
  for(let i=1;i<=3;i++){
    const text='Nội dung qua nhịp tự lưu '+i;await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill(text);
    await page.waitForFunction(value=>window.savedDraft.definition.blocks[0].items[0].prompt===value,text);
    assert.equal(await page.evaluate(()=>window.readingNode===document.querySelector('textarea[aria-label="Nội dung câu hỏi"]')),true);
    assert.equal(await page.getByLabel('Nội dung câu hỏi',{exact:true}).evaluate(e=>e===document.activeElement),true);
  }
  await page.evaluate(()=>{window.holdSave=true;});await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Nháp đang gửi chậm');
  await page.waitForFunction(()=>typeof window.releaseSave==='function');
  await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Tiếp tục gõ trong khi phản hồi cũ chưa tới');await page.evaluate(()=>window.releaseSave());
  await page.waitForFunction(()=>window.savedDraft.definition.blocks[0].items[0].prompt==='Tiếp tục gõ trong khi phản hồi cũ chưa tới');
  assert.equal(await page.getByLabel('Nội dung câu hỏi',{exact:true}).inputValue(),'Tiếp tục gõ trong khi phản hồi cũ chưa tới');
  assert.equal(await page.evaluate(()=>window.readingNode===document.querySelector('textarea[aria-label="Nội dung câu hỏi"]')),true);
  await page.getByRole('button',{name:'AI chuyển nội dung có sẵn',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Nội dung câu hỏi có sẵn',{exact:true}).fill('Nội dung nguồn giữ khi đóng AI');
  await page.getByRole('button',{name:'Đóng AI',exact:true}).click();
  await page.getByRole('button',{name:'AI chuyển nội dung có sẵn',exact:true}).click();
  assert.equal(await page.getByRole('dialog').getByLabel('Nội dung câu hỏi có sẵn',{exact:true}).inputValue(),'Nội dung nguồn giữ khi đóng AI');
  await page.getByRole('dialog').getByRole('button',{name:'AI chuyển nội dung có sẵn thành câu hỏi',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Xác nhận thêm lô này vào nháp',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Đã thêm cả lô vào nháp'}).waitFor();
  assert.equal(await page.getByRole('dialog').count(),0);
  const final=await page.evaluate(()=>window.savedDraft);assert.equal(final.definition.blocks.length,1);assert.equal(final.definition.blocks[0].items.length,2);assert.equal(final.definition.blocks[0].items[1].prompt,'Câu AI có sẵn từ nguồn');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(done=>server.close(done));}
});
