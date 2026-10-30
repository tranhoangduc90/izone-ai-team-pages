// UI thật + API thật với hai PGlite riêng. Toàn bộ tên/lớp/bài là fixture, không gọi production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.PROGRESS_LOG_BACKEND_ROOT||fileURLToPath(new URL('../../classroom-mapping-review/backend/',import.meta.url));
const requireBackend=createRequire(resolve(backend,'package.json'));
const express=requireBackend('express'),supertest=requireBackend('supertest'),{PGlite}=requireBackend('@electric-sql/pglite');
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const load=name=>import(pathToFileURL(resolve(backend,'src',name)).href);

test('Thẻ 22: xuất bản, giao hai lớp, sửa cùng phiếu và giữ nguyên bản đã giao',{timeout:150000},async()=>{
  const [{createLearningDemoApp,createPGlitePool,initializeLearningDemoDatabase},{createLearningRouter}]=await Promise.all([load('learning-demo.js'),load('learning-routes.js')]);
  const sourceDb=new PGlite(),demoDb=new PGlite(),secret='fixture-only-preview-secret-01234567890123456789';
  let server,browser;
  try{
    await initializeLearningDemoDatabase(sourceDb);await initializeLearningDemoDatabase(demoDb);
    await sourceDb.exec("ALTER TABLE mapping.reviewer_account ADD COLUMN role text DEFAULT 'teacher', ADD COLUMN can_access_all_classes boolean DEFAULT false;");
    for(const file of ['202609160002_learning_api_mapping_schema_usage.sql','202609160005_publisher_account_lookup.sql','202610010001_progress_log_form_drafts.sql','202610220002_form_library.sql','202610280001_form_publications.sql','202610300001_worksheet_revisions.sql'])
      await sourceDb.exec(await readFile(resolve(backend,'ops/learning-migrations',file),'utf8'));
    await sourceDb.exec(`INSERT INTO mapping.classroom_course_mapping VALUES(1294,'Lớp mẫu A','approved',NULL,NULL),(1295,'Lớp mẫu B','approved',NULL,NULL);
      INSERT INTO mapping.reviewer_account(email,status) VALUES('owner@example.test','active');
      INSERT INTO mapping.reviewer_class_access VALUES('owner@example.test',1294),('owner@example.test',1295);
      INSERT INTO mapping.student_mapping_review(erp_course_class_id,erp_student_contact_id,erp_student_name_snapshot) VALUES(1294,123,'Học viên giả A'),(1295,124,'Học viên giả B');
      INSERT INTO mapping.erp_class_membership_snapshot VALUES(1294,123),(1295,124);
      INSERT INTO learning.course_content_authority(reviewer_email,course_code,can_self_approve_scored_forms,grant_reference) VALUES('owner@example.test','56',true,'Browser fixture only');`);
    const reviewer={email:'owner@example.test',canAccessAllClasses:false},pool=createPGlitePool(sourceDb),sourceApp=express();sourceApp.use(express.json());
    sourceApp.get('/api/learning/teacher/journey-plan',(req,res)=>res.json({ok:true,plan:{classId:req.query.classId,totalSessions:6,sessionDates:[]}}));
    sourceApp.use('/api/learning',createLearningRouter({pool,demoSourceSecret:secret,authenticate(req,_res,next){req.reviewer=reviewer;next();}}));
    const app=express();app.use('/source',sourceApp);
    server=app.listen(0,'127.0.0.1');await new Promise(done=>server.once('listening',done));const origin='http://127.0.0.1:'+server.address().port;
    const demo=createLearningDemoApp({pool:createPGlitePool(demoDb),allowedOrigin:origin,grantSecret:secret,fetchSource:async value=>{
      const response=await supertest(sourceApp).post('/api/learning/assignments/demo-source').set('x-learning-demo-source',secret).send(typeof value==='object'?value:{publicToken:value});
      if(response.status!==200)throw Error(response.body.message||response.body.error);return response.body.source;
    }});app.use('/demo',demo);
    app.get('/progress-log/fixture.html',(_req,res)=>res.type('html').send('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/progress-log/styles.css"><link rel="stylesheet" href="/progress-log/teacher.css"><link rel="stylesheet" href="/progress-log/thuy-live/styles.css"><link rel="stylesheet" href="/progress-log/thuy-live/revisions.css"><body class="thuy-live thuy-teacher"><main id="formDraftEditor"></main>'));
    app.get('/progress-log/demo/config.js',(_req,res)=>res.type('js').send('window.PROGRESS_LOG_CONFIG=Object.freeze('+JSON.stringify({API_BASE_URL:origin+'/demo',DEMO_MODE:true,GOOGLE_CLIENT_ID:'',THUY_PILOT_CLASS_IDS:[],STUDENT_MEMORY:{enabled:false,allClasses:false}})+');'));
    app.use(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,origin).pathname);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.type({'.js':'js','.mjs':'js','.css':'css','.html':'html','.woff2':'font/woff2'}[extname(file)]||'text');res.send(await readFile(file));}catch{res.status(404).end();}});
    browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin+'/progress-log/fixture.html');
    await page.evaluate(async()=>{
      const {createFormDraftEditor}=await import('/progress-log/teacher-form-editor.js');
      const request=async(path,options={})=>{const response=await fetch('/source/api/learning'+path,{method:options.method||'GET',headers:{'content-type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const body=await response.json();if(!response.ok||!body.ok){const error=Error(body.message||body.error);error.status=response.status;throw error;}return body;};
      window.deliveries=[];window.editor=createFormDraftEditor({host:document.querySelector('#formDraftEditor'),apiRequest:request,libraryEnabled:true,onPublished:value=>window.deliveries.push(value)});
      window.editor.setWorkspace({classes:[{class_id:'1294',class_name:'Lớp mẫu A'},{class_id:'1295',class_name:'Lớp mẫu B'}],assignments:[],classId:'1294',sessionNumber:3});
    });
    await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();await page.getByLabel('Tên bài tập',{exact:true}).fill('Phiếu tích hợp R22');await page.getByLabel('Trình độ',{exact:true}).selectOption('56');
    await page.getByRole('button',{name:'+ Trắc nghiệm',exact:true}).click();await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('reading');await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Chọn ý phù hợp');
    for(const [index,label]of ['Một','Hai','Ba','Bốn'].entries())await page.getByLabel('Lựa chọn '+String.fromCharCode(65+index)+' câu 1',{exact:true}).fill(label);
    await page.getByLabel('Đáp án đúng B câu 1',{exact:true}).check();await page.getByRole('button',{name:'Chia phần',exact:true}).click();
    const second=page.locator('.thuy-editor-section').nth(1);await second.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();
    await page.getByLabel('Kỹ năng câu 2',{exact:true}).selectOption('general');await second.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Điều em muốn chia sẻ');await second.getByLabel('Đáp án tham khảo (tùy chọn)',{exact:true}).fill('Lời tham khảo từ giáo viên');
    await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.locator('.thuy-editor-save-state').filter({hasText:'Đã lưu'}).waitFor();
    if(process.env.PROGRESS_LOG_EVIDENCE_DIR){await mkdir(process.env.PROGRESS_LOG_EVIDENCE_DIR,{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(process.env.PROGRESS_LOG_EVIDENCE_DIR,'editor-'+width+'.png'),fullPage:true});}await page.setViewportSize({width:1440,height:1000});}
    assert.deepEqual(await page.locator('.editor-actions>button').allTextContents(),['Xem trước','Lưu nháp','Xuất bản']);
    // Vị trí ghim mới được kiểm qua cuộn và viewport trong progress-log-the16-browser.mjs.
    await page.getByRole('button',{name:'Xuất bản',exact:true}).click();await page.locator('.thuy-publication-notice').filter({hasText:'Đã xuất bản thành công'}).waitFor();
    const published=(await sourceDb.query('SELECT * FROM learning.form_publication')).rows[0];assert.ok(published);
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_assignment')).rows[0].n,0);
    await page.getByRole('tab',{name:/Kho cá nhân/}).click();await page.getByRole('button',{name:'Phiếu tích hợp R22',exact:true}).click();
    const detail=page.locator('.thuy-library-detail'),frame=page.frameLocator('.thuy-library-preview');
    try{await frame.locator('.thuy-part').first().waitFor();}catch(error){throw Error(error.message+' · Detail: '+await detail.innerText()+' · Frame: '+await frame.locator('#notice').innerText());}
    assert.equal(await frame.locator('#identityView').isVisible(),false);assert.equal(await frame.locator('#confirmView').isVisible(),false);assert.match(await frame.locator('#studentNameLabel').textContent(),/Học viên mẫu 1/);
    assert.equal(await frame.locator('.context-bar').isVisible(),false);assert.equal(await frame.locator('.demo-banner').isVisible(),false);assert.equal(await frame.locator('#studentDashboardLatest').count(),0);
    const survey=frame.locator('.thuy-part').nth(1);await survey.getByRole('button',{name:'Bắt đầu làm',exact:true}).click();assert.equal(await survey.getByText('Lời tham khảo từ giáo viên',{exact:false}).count(),0);await survey.locator('textarea').fill('Nội dung học viên mẫu');await survey.getByRole('button',{name:'Nộp phần này',exact:true}).click();await survey.getByText('Đáp án tham khảo: Lời tham khảo từ giáo viên',{exact:true}).waitFor();assert.doesNotMatch(await survey.innerText(),/✕ Sai|✓ Đúng/);
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.submission')).rows[0].n,0);
    await detail.getByRole('button',{name:'Giao bài',exact:true}).click();const dialog=page.locator('.thuy-assignment-dialog');await dialog.waitFor();
    await dialog.getByLabel('Chọn buổi học 1',{exact:true}).selectOption('3');await dialog.getByRole('button',{name:'+ Thêm lớp nhận bài tập',exact:true}).click();await dialog.getByLabel('Chọn lớp nhận bài 2',{exact:true}).selectOption('1295');await dialog.getByLabel('Chọn buổi học 2',{exact:true}).selectOption('4');
    if(process.env.PROGRESS_LOG_EVIDENCE_DIR){await mkdir(process.env.PROGRESS_LOG_EVIDENCE_DIR,{recursive:true});await dialog.screenshot({path:resolve(process.env.PROGRESS_LOG_EVIDENCE_DIR,'assignment-desktop.png')});}
    await dialog.getByRole('button',{name:'Giao bài',exact:true}).click();await dialog.getByRole('status').filter({hasText:'Đã giao và đối chiếu tất cả các lớp.'}).waitFor();
    const rows=(await sourceDb.query('SELECT erp_course_class_id::text class_id,session_number,form_version_id FROM learning.form_assignment ORDER BY erp_course_class_id')).rows;
    assert.deepEqual(rows.map(row=>[row.class_id,row.session_number]),[['1294',3],['1295',4]]);assert.ok(rows.every(row=>row.form_version_id===published.form_version_id));assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.outbox_job')).rows[0].n,0);
    await page.setViewportSize({width:390,height:844});assert.equal(await dialog.evaluate(element=>element.scrollWidth>element.clientWidth),false);
    if(process.env.PROGRESS_LOG_EVIDENCE_DIR)await dialog.screenshot({path:resolve(process.env.PROGRESS_LOG_EVIDENCE_DIR,'assignment-mobile.png')});
    assert.deepEqual((await sourceDb.query('SELECT source_scope FROM learning.form_assignment_origin ORDER BY assignment_id')).rows.map(r=>r.source_scope),['personal','personal']);
    await page.setViewportSize({width:1440,height:1000});await page.keyboard.press('Escape');
    await detail.getByRole('button',{name:'Sửa bài',exact:true}).click();
    await page.getByLabel('Tên bài tập',{exact:true}).fill('Phiếu tích hợp đã sửa');await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.locator('.thuy-editor-save-state').filter({hasText:'Đã lưu'}).waitFor();
    await page.getByRole('button',{name:'Quay lại Quản lý bài tập',exact:true}).click();assert.equal(await page.locator('.thuy-library-scroll tbody tr').count(),1);
    await page.getByRole('button',{name:'Phiếu tích hợp đã sửa',exact:true}).click();await page.getByRole('button',{name:'Sửa bài',exact:true}).click();
    await page.getByRole('button',{name:'Xuất bản',exact:true}).click();await page.locator('.thuy-publication-notice').filter({hasText:'Đã xuất bản thành công'}).waitFor();
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_assignment')).rows[0].n,2);
    assert.ok((await sourceDb.query('SELECT form_version_id FROM learning.form_assignment')).rows.every(r=>r.form_version_id===published.form_version_id));
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_worksheet')).rows[0].n,1);
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_publication')).rows[0].n,2);
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();if(server)await new Promise(done=>server.close(done));await sourceDb.close();await demoDb.close();}
});
