// Dữ liệu là definition công khai của sáu phiếu và khóa giả chỉ để kiểm thao tác.
// Chrome kiểm bộ soạn thật; API giả có trạng thái/revision, không gọi lớp thật/Portal.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const forms=JSON.parse(await readFile(new URL('./fixtures/progress-log-editor-public-forms.json',import.meta.url),'utf8'));
test('D01–D05/P02: đủ 8 dạng, sáu phiếu/14 ô, lưu/conflict/reload/import-confirm và không lưu key trong storage',{timeout:60000},async()=>{
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/editor-test') {res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/progress-log/styles.css"><link rel="stylesheet" href="/progress-log/teacher.css"><main class="teacher-shell"><section class="card" id="host"></section></main>');return;}
    try{const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(resolve(root)+sep))throw new Error('Denied');
      res.setHeader('content-type',extname(file)==='.js'?'text/javascript':extname(file)==='.css'?'text/css':'application/json');res.end(await readFile(file));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());page.setDefaultTimeout(5000);
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/editor-test');
    await page.evaluate(async()=>{
      const module=await import('/progress-log/teacher-form-editor.js');window.editorModule=module;window.calls=[];window.serverDraft=null;window.failSave=false;window.nextConflict=false;
      window.client=module.createFormDraftEditor({host:document.getElementById('host'),apiRequest:async(path,options={})=>{
        window.calls.push({path,method:options.method||'GET',body:options.body});
        if(path.endsWith('/review-queue'))return {ok:true,drafts:[]};
        if(path.includes('?classId='))return {ok:true,drafts:window.serverDraft?[{...window.serverDraft,title:window.serverDraft.definition.title}]:[]};
        if(path.endsWith('/import-preview'))return {ok:true,preview:{baseRevision:window.serverDraft.revision,rows:[{line:2,type:'reflection',prompt:'Câu nhập có dấu, xuống dòng',checkpoint:1,slotCount:1,optionCount:0,required:true,graderType:'none'}],errors:[],payload:window.importPayload}};
        if(path.endsWith('/publish')){window.publishCount=(window.publishCount||0)+1;return {ok:true,published:{publicToken:crypto.randomUUID(),assignmentId:crypto.randomUUID(),rosterCount:18}};}
        if(options.method==='PUT'){
          if(window.holdSave)await new Promise(resolve=>{window.releaseSave=resolve;});
          if(window.failSave)throw new Error('Mạng đang lỗi');
          if(window.nextConflict){window.nextConflict=false;window.serverDraft.revision+=1;window.serverDraft.definition.title='Bản mới trên máy chủ';const error=new Error('Nháp đã đổi');error.status=409;throw error;}
          window.serverDraft={...window.serverDraft,...structuredClone(options.body),revision:window.serverDraft.revision+1,status:'draft'};return {ok:true,draft:window.serverDraft};
        }
        if(path==='/teacher/form-drafts'&&options.method==='POST'){
          window.serverDraft={...structuredClone(options.body),id:crypto.randomUUID(),revision:1,status:'draft',contentHash:'a'.repeat(64)};return {ok:true,draft:window.serverDraft};
        }
        return {ok:true,draft:structuredClone(window.serverDraft)};
      }});
      window.client.setWorkspace({classes:[{class_id:'1294',class_name:'IC2305 · Lớp kiểm thử'}],assignments:[]});
    });
    let total=0,slots=0;const types=new Set();
    for(const form of forms){
      const value={id:'b0000000-0000-4000-8000-000000000001',classId:'1294',sessionNumber:3,revision:1,status:'draft',contentHash:'a'.repeat(64),definition:form.definition,
        gradingKey:{schemaVersion:'FormGradingKeyV1',formVersionId:form.definition.formVersionId,graderVersion:1,groups:{},items:Object.fromEntries(form.definition.blocks.flatMap(b=>b.items).filter(i=>i.graderType==='exact_option').map(i=>[i.itemVersionId,{graderType:'exact_option',expectedOptionId:i.options[0].id}]))}};
      await page.evaluate(value=>{window.serverDraft=structuredClone(value);window.client.openDraft(value);},value);
      const actual=await page.evaluate(()=>window.client.getPayload());assert.deepEqual(actual,{definition:value.definition,gradingKey:value.gradingKey,sessionNumber:3});
      const items=form.definition.blocks.flatMap(b=>b.items);total+=items.length;
      assert.equal(await page.locator('.editor-item').count(),items.length);
      for(const item of items){const type=await page.evaluate(item=>window.editorModule.editorType(item),item);types.add(type);if(type==='gapfill')slots+=item.interactionConfig.responseCount||1;}
      assert.equal(await page.getByLabel('Dạng bài',{exact:true}).first().locator('option').count(),8);
      for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
    }
    assert.equal(total,57);assert.equal(slots,14);assert.equal(types.size,8);
    assert.equal(await page.evaluate(()=>{try{window.editorModule.newEditorItem('essay_ai');return false;}catch{return true;}}),true);
    // Sửa thật bằng control, lưu lỗi giữ nội dung, xung đột hiện đối chiếu; người dùng chủ động giữ bản đang soạn.
    await page.getByLabel('Tên phiếu',{exact:true}).fill('Tên đang soạn có dấu');
    await page.evaluate(()=>{window.failSave=true;});await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Mạng đang lỗi'}).waitFor();assert.equal((await page.evaluate(()=>window.client.getPayload())).definition.title,'Tên đang soạn có dấu');
    await page.evaluate(()=>{window.failSave=false;window.nextConflict=true;});await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
    await page.getByText('Đối chiếu bản mới trên máy chủ',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Tên phiếu',{exact:true}).inputValue(),'Tên đang soạn có dấu');
    await page.getByRole('button',{name:'Giữ phần đang soạn và lưu trên bản mới',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
    assert.equal(await page.evaluate(()=>window.serverDraft.revision),3);
    await page.evaluate(()=>window.client.openDraft(window.serverDraft));assert.equal(await page.getByLabel('Tên phiếu',{exact:true}).inputValue(),'Tên đang soạn có dấu');
    // Mạng chậm: khóa cả nội dung và chọn lớp, tránh response xóa phần đang gõ mới.
    await page.getByLabel('Tên phiếu',{exact:true}).fill('Nội dung gửi khi mạng chậm');
    await page.evaluate(()=>{window.holdSave=true;});await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
    await page.waitForFunction(()=>typeof window.releaseSave==='function');
    assert.equal(await page.getByLabel('Tên phiếu',{exact:true}).isDisabled(),true);
    assert.equal(await page.getByText('Buổi của nháp',{exact:true}).locator('..').locator('input').isDisabled(),true);
    assert.equal(await page.getByLabel('Câu hỏi',{exact:true}).first().isDisabled(),true);
    assert.equal(await page.getByText('Lớp soạn phiếu',{exact:true}).locator('..').locator('select').isDisabled(),true);
    await page.evaluate(()=>{window.holdSave=false;window.releaseSave();});
    await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
    assert.equal(await page.getByLabel('Tên phiếu',{exact:true}).isDisabled(),false);
    assert.equal(await page.getByLabel('Tên phiếu',{exact:true}).inputValue(),'Nội dung gửi khi mạng chậm');
    // Đổi thứ tự phần/câu và xóa phần dùng cùng dữ liệu của editor thật.
    const beforeOrder=await page.evaluate(()=>window.client.getPayload().definition.blocks[0].items.map(item=>item.itemVersionId));
    await page.getByRole('button',{name:'Đưa câu xuống',exact:true}).first().click();
    const afterOrder=await page.evaluate(()=>window.client.getPayload().definition.blocks[0].items.map(item=>item.itemVersionId));
    assert.equal(afterOrder[1],beforeOrder[0]);assert.equal(afterOrder[0],beforeOrder[1]);
    await page.getByRole('button',{name:'Thêm phần',exact:true}).click();
    const blockCount=await page.evaluate(()=>window.client.getPayload().definition.blocks.length);
    await page.getByRole('button',{name:'Đưa phần lên',exact:true}).last().click();
    await page.getByRole('button',{name:'Bỏ phần',exact:true}).last().click();
    assert.equal(await page.evaluate(()=>window.client.getPayload().definition.blocks.length),blockCount-1);
    // Preview lô chưa ghi; chỉ xác nhận mới thêm và lưu. Sửa nháp trước preview phải giữ ô nhập.
    await page.getByLabel('Tên phiếu',{exact:true}).fill('Tên sửa trước khi nhập');
    await page.evaluate(()=>{window.importPayload=structuredClone(window.client.getPayload());const block=window.importPayload.definition.blocks[0];const item=window.editorModule.newEditorItem('reflection',99);item.prompt='Câu nhập có dấu, xuống dòng';block.items.push(item);});
    await page.getByText('Nhập câu hỏi từ CSV / văn bản chia cột',{exact:true}).click();
    await page.getByLabel('CSV hoặc văn bản nhập câu hỏi',{exact:true}).fill('type,prompt\nreflection,"Câu nhập có dấu, xuống dòng"');
    const count=await page.locator('.editor-item').count();await page.getByRole('button',{name:'Xem trước lô câu hỏi',exact:true}).click();
    await page.getByRole('button',{name:'Xác nhận thêm lô này vào nháp',exact:true}).waitFor();assert.equal(await page.locator('.editor-item').count(),count);
    await page.getByRole('button',{name:'Xác nhận thêm lô này vào nháp',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Đã thêm cả lô'}).waitFor();assert.equal(await page.locator('.editor-item').count(),count+1);
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
    // Publish đồng thời bị khóa ở UI; operation ID được gửi một lần.
    await page.evaluate(()=>{window.serverDraft.status='approved';window.client.openDraft(window.serverDraft);});
    const publish=page.getByRole('button',{name:'Phát hành phiếu cho lớp',exact:true});await publish.click();
    await page.getByRole('status').filter({hasText:'Đã phát hành và đối chiếu 18'}).waitFor();assert.equal(await page.evaluate(()=>window.publishCount),1);
    assert.equal(await page.getByLabel('Tên phiếu',{exact:true}).isDisabled(),true);
    const publishedLink=page.getByRole('link',{name:'Mở phiếu vừa phát hành',exact:true});
    assert.ok((await publishedLink.getAttribute('href')).includes('#assignment='));
    assert.ok(!(await publishedLink.getAttribute('href')).includes('?assignment='));
    await page.evaluate(()=>window.client.openDraft({...window.serverDraft,status:'published',publicToken:'a0000000-0000-4000-8000-000000000001'}));
    assert.ok((await publishedLink.getAttribute('href')).endsWith('#assignment=a0000000-0000-4000-8000-000000000001'));
    await mkdir(resolve(root,'output/playwright'),{recursive:true});await page.setViewportSize({width:390,height:900});
    await page.screenshot({path:resolve(root,'output/playwright/progress-editor-390.png'),fullPage:true});
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
