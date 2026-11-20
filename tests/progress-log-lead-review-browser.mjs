import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {startThe20Server} from './fixtures/progress-the20-server.mjs';

const backend=process.env.PROGRESS_LOG_BACKEND_ROOT||fileURLToPath(new URL('../../classroom-mapping-review/backend/',import.meta.url));
const requireBackend=createRequire(resolve(backend,'package.json'));
const express=requireBackend('express'),request=requireBackend('supertest'),{PGlite}=requireBackend('@electric-sql/pglite');
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const load=name=>import(pathToFileURL(resolve(backend,'src',name)).href);

test('Chrome + API: lead xử lý đáp án và sửa lại bài Kho chung đã xuất bản',{timeout:90000},async()=>{
  const db=new PGlite(),fixture=await startThe20Server();
  let browser;
  try{
    const [{createPGlitePool,initializeLearningDemoDatabase},{createLearningRouter},{previewFormImport}]=
      await Promise.all([load('learning-demo.js'),load('learning-routes.js'),load('learning-form-import.js')]);
    await initializeLearningDemoDatabase(db);
    for(const migration of ['202609160002_learning_api_mapping_schema_usage.sql','202609160005_publisher_account_lookup.sql',
      '202610010001_progress_log_form_drafts.sql','202610220002_form_library.sql','202610280001_form_publications.sql',
      '202610300001_worksheet_revisions.sql','202611090002_shared_course_drafts.sql','202611170001_shared_library_revisions.sql',
      '202611200002_progress_log_shared_draft_actions.sql'])
      await db.exec(await readFile(resolve(backend,'ops','learning-migrations',migration),'utf8'));
    await db.exec(`INSERT INTO mapping.reviewer_account VALUES('lead@example.test','active'),('plain@example.test','active');
      INSERT INTO learning.course_content_authority(reviewer_email,course_code,can_self_approve_scored_forms,grant_reference)
        VALUES('lead@example.test','56',true,'Browser fixture only'),('lead@example.test','67',false,'Browser fixture only');`);
    const app=express(),events=[];
    app.use(express.json());
    app.use(createLearningRouter({pool:createPGlitePool(db),sharedRevisionCatalog:true,demoSourceSecret:'browser-shared-edit-fixture-only-not-a-real-secret',
      logger:{info:line=>events.push(JSON.parse(line))},
      authenticate(req,_res,next){req.reviewer={email:`${req.get('x-fixture-role')==='plain'?'plain':'lead'}@example.test`,canAccessAllClasses:false};next();}}));
    const {payload}=previewFormImport('type,prompt,options,answer,skill\nmcq,"Chọn tiêu đề đoạn A","[{""id"":""A"",""label"":""Tiêu đề A""},{""id"":""B"",""label"":""Tiêu đề B""}]",A,reading');
    Object.assign(payload.definition,{title:'Phiếu thử khóa 56',courseCode:'56'});
    const section=payload.definition.blocks[0],imported=section.items[0];
    section.title='Bài tập kiểm thử';
    section.items.push({...structuredClone(imported),itemVersionId:randomUUID(),itemFamilyId:randomUUID(),position:2,prompt:'Chọn tiêu đề đoạn B'});
    payload.gradingKey.importReviews={[imported.itemVersionId]:{sourceLabel:'AI nhập câu nguồn 1',sourceQuote:'Câu gốc',
      sourceKey:'',sourceHash:'a'.repeat(64),keyStatus:'missing',candidates:[],messages:[]}};
    const {body:{draft}}=await request(app).post('/teacher/form-drafts').send({...payload,scope:'izone',operationId:randomUUID()}).expect(201);

    browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[];
    let actor='lead',editCalls=0;
    page.setDefaultTimeout(8000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==fixture.origin)return route.abort();
      if(url.pathname==='/progress-log/demo/thuy.html')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<p>Bản xem trước của bài mẫu</p>'});
      if(!url.pathname.startsWith('/fixture/lead-api/'))return route.continue();
      const call=request(app)[route.request().method().toLowerCase()](url.pathname.replace('/fixture/lead-api','')+url.search).set('x-fixture-role',actor);
      if(url.pathname.endsWith('/edit'))editCalls++;
      const payload=route.request().postDataJSON();
      if(payload)call.send(payload);
      const reply=await call;
      return route.fulfill({status:reply.status,json:reply.body});
    });
    await page.goto(fixture.origin+'/fixture/skills.html');
    await page.evaluate(async()=>{
      document.body.className='thuy-live thuy-teacher';
      document.body.innerHTML='<main id="editorHost"></main>';
      const {createFormDraftEditor}=await import('/progress-log/teacher-form-editor.js');
      const apiRequest=async(path,{method='GET',body}={})=>{
        const res=await fetch('/fixture/lead-api'+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
        const result=await res.json();
        if(!res.ok)throw Object.assign(new Error(result.message),{status:res.status,code:result.error,issues:result.issues});
        return result;
      };
      const editor=createFormDraftEditor({host:document.querySelector('#editorHost'),apiRequest,libraryEnabled:true});
      editor.setWorkspace({classes:[],assignments:[]});
      window.fixtureEditor=editor;
    });
    await page.getByRole('button',{name:'Phiếu thử khóa 56',exact:true}).click();
    const approve=page.getByRole('button',{name:'Duyệt bản này',exact:true});
    assert.equal(await page.getByRole('button',{name:'Gửi duyệt',exact:true}).isVisible(),false);
    assert.equal(await page.getByRole('button',{name:'Xuất bản',exact:true}).isVisible(),false);
    await page.getByLabel('Tên bài tập',{exact:true}).fill('Phiếu đã sửa');
    await approve.click();
    await page.getByRole('status').filter({hasText:'Đã lưu nháp. Chưa duyệt. Còn 2 câu cần kiểm tra đáp án.'}).waitFor();
    const saved=(await db.query('SELECT status,revision,public_definition FROM learning.form_draft WHERE id=$1',[draft.id])).rows[0];
    assert.equal(saved.public_definition.title,'Phiếu đã sửa');
    assert.equal(saved.status,'draft');assert.equal(Number(saved.revision),2);
    const confirm=page.getByRole('button',{name:'Tôi đã xử lý và xác nhận key / chế độ không chấm'});
    await page.getByRole('button',{name:/Bài tập kiểm thử.*câu 1.*xác nhận/}).click();
    assert.equal(await confirm.evaluate(button=>document.activeElement===button),true);
    await page.getByRole('button',{name:/Bài tập kiểm thử.*câu 2.*thiếu đáp án/}).click();
    const missingAnswer=page.getByLabel('Đáp án đúng A câu 2',{exact:true});
    assert.equal(await missingAnswer.evaluate(input=>document.activeElement===input),true);
    await missingAnswer.check();
    await confirm.click();
    await approve.click();
    await page.getByText('Đã duyệt bản này. Bạn có thể xuất bản.',{exact:true}).waitFor();
    assert.equal((await db.query('SELECT count(*)::int AS n FROM learning.form_publication')).rows[0].n,0);
    await page.getByRole('button',{name:'Xuất bản',exact:true}).click();
    await page.getByText('Đã xuất bản thành công vào Kho chung',{exact:false}).waitFor();
    assert.equal((await db.query('SELECT count(*)::int AS n FROM learning.form_publication WHERE source_draft_id=$1',[draft.id])).rows[0].n,1);
    assert.equal(events.some(event=>event.operation.endsWith('/request-review')),false);

    // Tạo nguồn có điểm với đáp án hoàn chỉnh để kiểm nút Sửa bài đã xuất bản và quyền trên cùng cửa sổ.
    const clean=previewFormImport('type,prompt,options,answer,skill\nmcq,"Chọn A","[{""id"":""A"",""label"":""Đúng""},{""id"":""B"",""label"":""Sai""}]",A,listening').payload;
    Object.assign(clean.definition,{title:'Listening 7 · Bài mẫu',courseCode:'56'});
    const {body:{draft:source}}=await request(app).post('/teacher/form-drafts').send({...clean,scope:'izone',operationId:randomUUID()}).expect(201);
    await request(app).post(`/teacher/form-drafts/${source.id}/approve`).send({expectedRevision:source.revision,expectedHash:source.contentHash}).expect(200);
    const {body:{publication:initial}}=await request(app).post(`/teacher/form-drafts/${source.id}/publish-library`).send({expectedRevision:source.revision,operationId:randomUUID()}).expect(201);
    await page.evaluate(()=>window.fixtureEditor.setWorkspace({classes:[],assignments:[]}));
    const row=page.getByRole('button',{name:'Listening 7 · Bài mẫu',exact:true});
    await row.click();
    const modal=page.getByRole('dialog');
    const edit=modal.getByRole('button',{name:'Sửa bài',exact:true});
    await edit.waitFor({state:'visible'});
    assert.ok(await edit.evaluate(button=>button.getBoundingClientRect().right<=innerWidth));
    assert.equal(await modal.getByRole('button',{name:'Thêm vào kho cá nhân'}).isVisible(),true);
    assert.equal(await modal.getByRole('button',{name:'Giao bài',exact:true}).isVisible(),true);
    actor='plain';
    await edit.click();
    await modal.getByText('Bạn chưa có quyền soạn bài Kho chung cho khóa này.',{exact:true}).waitFor();
    await modal.getByRole('button',{name:'Tải lại Kho chung'}).click();
    await row.click();
    assert.equal(await edit.count(),0);
    await modal.getByRole('button',{name:'Đóng',exact:true}).click();
    actor='lead';
    await page.evaluate(()=>window.fixtureEditor.setWorkspace({classes:[],assignments:[]}));
    await page.setViewportSize({width:1280,height:880});
    await row.click();
    await edit.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Sửa bài tập · Kho chung · Khóa 56'}).waitFor();
    assert.equal(await page.getByLabel('Khóa',{exact:true}).isDisabled(),true);
    const question=page.getByLabel('Nội dung câu hỏi',{exact:true});
    await question.evaluate(control=>{window.fixtureQuestion=control;});
    for(const text of ['Chọn phương án','Chọn phương án đúng','Chọn phương án đúng khi nghe']){
      const oldSaves=events.filter(event=>event.method==='PUT').length;
      await question.fill(text);
      await page.waitForFunction(()=>document.querySelector('.thuy-editor-save-state')?.textContent==='Đã lưu nháp');
      assert.ok(events.filter(event=>event.method==='PUT').length>oldSaves);
      assert.equal(await question.inputValue(),text);
      assert.ok(await question.evaluate(control=>document.activeElement===control&&window.fixtureQuestion===control));
    }
    await page.getByRole('button',{name:'Duyệt bản này',exact:true}).click();
    assert.equal(await page.getByLabel('Khóa',{exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Xuất bản',exact:true}).click();
    await page.getByText('Đã xuất bản thành công vào Kho chung',{exact:false}).waitFor();
    const {body:updated}=await request(app).get('/teacher/form-library?scope=izone').expect(200);
    const entries=updated.entries.filter(entry=>entry.title==='Listening 7 · Bài mẫu');
    assert.equal(entries.length,1);
    assert.notEqual(entries[0].id,initial.libraryEntryId);
    const {body:{entry}}=await request(app).get(`/teacher/form-library/${entries[0].id}`).expect(200);
    assert.equal(entry.definition.blocks[0].items[0].prompt,'Chọn phương án đúng khi nghe');
    assert.equal(editCalls,2);
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await fixture.close();await db.close();}
});
