// Trình duyệt thật, API giả có revision; chỉ nội dung/key giả, không gọi lớp thật hoặc Portal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
test('Docs: cảnh báo key rõ ở đề xuất và nháp sau đọc lại; không lưu key trong browser storage',{timeout:90000},async()=>{
  const server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/test'){res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/progress-log/styles.css"><link rel="stylesheet" href="/progress-log/teacher.css"><main id="host"></main>');return;}
    try{const file=resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(resolve(root)+sep))throw Error();
      res.setHeader('content-type',extname(file)==='.js'?'text/javascript':'text/css');res.end(await readFile(file));}
    catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(12000);
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/test');
    await page.evaluate(async()=>{
      const m=await import('/progress-log/teacher-form-editor.js');const v=crypto.randomUUID(),b=crypto.randomUUID();
      const item=m.newEditorItem('mcq');item.prompt='Chọn đáp án cho tình huống giả';item.skillCodes=['reading'];
      const review={sourceLabel:'Phần 2 · Câu 2',sourceQuote:'Câu nguồn giả và hai phương án.',sourceKey:'Lời giải cho một câu khác.',
        sourceHash:'a'.repeat(64),keyStatus:'mismatch',candidates:[],messages:['KEY KHÔNG KHỚP: lời giải không thuộc nội dung câu này. Không tự đoán đáp án.']};
      window.saved={id:crypto.randomUUID(),classId:'9999',sessionNumber:5,revision:1,status:'draft',contentHash:'b'.repeat(64),
        definition:{schemaVersion:'FormDefinitionV1',formVersionId:v,title:'Phiếu thử cách ly',kind:'mixed',answerReleasePolicy:'hidden',blocks:[{blockId:b,checkpoint:1,title:'Phần thử',items:[]}]},
        gradingKey:{schemaVersion:'FormGradingKeyV1',formVersionId:v,graderVersion:1,items:{},groups:{}}};
      window.calls=[];window.editor=m.createFormDraftEditor({host:document.getElementById('host'),libraryEnabled:true,apiRequest:async(path,options={})=>{
        window.calls.push({path,method:options.method||'GET'});
        if(path.endsWith('/docs-import-preview')){const definition=structuredClone(window.saved.definition);definition.blocks[0].items.push(item);
          const gradingKey=structuredClone(window.saved.gradingKey);gradingKey.importReviews={[item.itemVersionId]:review};
          return {preview:{baseRevision:window.saved.revision,source:{title:'Docs giả'},warnings:[],errors:[],unmappedText:'',
            coverage:{sourceQuestions:2,convertedQuestions:1,deferredQuestions:1,generatedControls:1},
            rows:[{line:2,type:'mcq',prompt:item.prompt,slotCount:1,optionCount:2,checkpoint:1,graderType:'exact_option',...review}],payload:{definition,gradingKey}}};}
        if(options.method==='PUT'){window.saved={...window.saved,...structuredClone(options.body),revision:window.saved.revision+1};return {draft:window.saved};}
        return {draft:window.saved,drafts:[],entries:[]};
      }});window.editor.openDraft(window.saved);
    });
    await page.getByRole('button',{name:'AI chuyển nội dung có sẵn',exact:true}).click();
    await page.locator('dialog').getByLabel('Link Google Docs câu hỏi',{exact:true}).fill('https://docs.google.com/document/d/fixture_document_123/edit');
    await page.getByRole('button',{name:'Đọc Google Docs và đề xuất câu hỏi',exact:true}).click();
    await page.locator('dialog').getByRole('alert').filter({hasText:'KEY KHÔNG KHỚP'}).waitFor();
    await page.locator('dialog').getByRole('alert').filter({hasText:'CHƯA CHUYỂN'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Dùng đáp án đề xuất sau khi đối chiếu'}).count(),0);
    await page.locator('dialog').getByRole('button',{name:'Xác nhận thêm các câu đã chuyển vào nháp',exact:true}).click();
    const saved=await page.evaluate(()=>window.saved);assert.equal(saved.revision,2);
    await page.evaluate(()=>window.editor.openDraft(structuredClone(window.saved)));
    await page.getByRole('alert').filter({hasText:'KEY KHÔNG KHỚP'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Tôi đã xử lý và xác nhận key / chế độ không chấm',exact:true}).isDisabled(),true);
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});
      const warning=page.getByRole('alert').filter({hasText:'KEY KHÔNG KHỚP'});assert.equal(await warning.isVisible(),true);
      await warning.getByText('Đối chiếu câu gốc và key nguồn',{exact:true}).click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await mkdir(resolve(root,'output/playwright'),{recursive:true});await page.screenshot({path:resolve(root,`output/playwright/docs-key-warning-${width}.png`),fullPage:true});
      await warning.getByText('Đối chiếu câu gốc và key nguồn',{exact:true}).click();
    }
    assert.equal(await page.evaluate(()=>[localStorage,sessionStorage].some(s=>Object.values(s).some(x=>x.includes('sourceKey')||x.includes('expectedOptionId')))),false);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
