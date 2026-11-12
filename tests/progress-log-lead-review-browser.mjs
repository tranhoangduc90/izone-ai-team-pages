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

test('Chrome + API: lead sửa nháp, đi tới từng đáp án lỗi, duyệt trực tiếp rồi mới xuất bản',{timeout:60000},async()=>{
  const db=new PGlite(),fixture=await startThe20Server();
  let browser;
  try{
    const [{createPGlitePool,initializeLearningDemoDatabase},{createLearningRouter},{previewFormImport}]=
      await Promise.all([load('learning-demo.js'),load('learning-routes.js'),load('learning-form-import.js')]);
    await initializeLearningDemoDatabase(db);
    for(const migration of ['202609160002_learning_api_mapping_schema_usage.sql','202609160005_publisher_account_lookup.sql',
      '202610010001_progress_log_form_drafts.sql','202610220002_form_library.sql','202610280001_form_publications.sql',
      '202610300001_worksheet_revisions.sql','202611090002_shared_course_drafts.sql'])
      await db.exec(await readFile(resolve(backend,'ops','learning-migrations',migration),'utf8'));
    await db.exec(`INSERT INTO mapping.reviewer_account VALUES('lead@example.test','active');
      INSERT INTO learning.course_content_authority(reviewer_email,course_code,can_self_approve_scored_forms,grant_reference)
        VALUES('lead@example.test','56',true,'Browser fixture only');`);
    const app=express(),events=[];
    app.use(express.json());
    app.use(createLearningRouter({pool:createPGlitePool(db),logger:{info:line=>events.push(JSON.parse(line))},
      authenticate(req,_res,next){req.reviewer={email:'lead@example.test',canAccessAllClasses:false};next();}}));
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
    page.setDefaultTimeout(8000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==fixture.origin)return route.abort();
      if(!url.pathname.startsWith('/fixture/lead-api/'))return route.continue();
      const call=request(app)[route.request().method().toLowerCase()](url.pathname.replace('/fixture/lead-api','')+url.search);
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
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await fixture.close();await db.close();}
});
