// UI thật + API thật với hai PGlite riêng. Toàn bộ tên/lớp/bài là fixture, không gọi production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.PROGRESS_LOG_BACKEND_ROOT||fileURLToPath(new URL('../../classroom-mapping-review/backend/',import.meta.url));
const requireBackend=createRequire(resolve(backend,'package.json'));
const express=requireBackend('express'),supertest=requireBackend('supertest'),{PGlite}=requireBackend('@electric-sql/pglite');
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const load=name=>import(pathToFileURL(resolve(backend,'src',name)).href);

test('Chrome: chỉ chọn buổi Portal từ hôm nay, giao một lớp và nhiều lớp',{timeout:150000},async t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-04T17:00:00Z')});
  const [{createLearningDemoApp,createPGlitePool,initializeLearningDemoDatabase},{createLearningRouter},{createPortalAssignmentScheduleReader},{createLearningClassPolicy}]=
    await Promise.all([load('learning-demo.js'),load('learning-routes.js'),load('learning-portal-assignment-schedule.js'),load('learning-class-policy.js')]);
  const sourceDb=new PGlite(),demoDb=new PGlite(),secret='fixture-only-preview-secret-01234567890123456789';
  let server,browser;
  try{
    await initializeLearningDemoDatabase(sourceDb);await initializeLearningDemoDatabase(demoDb);
    await sourceDb.exec("ALTER TABLE mapping.reviewer_account ADD COLUMN role text DEFAULT 'teacher', ADD COLUMN can_access_all_classes boolean DEFAULT false;");
    for(const file of ['202609160002_learning_api_mapping_schema_usage.sql','202609160005_publisher_account_lookup.sql','202610010001_progress_log_form_drafts.sql','202610090001_journey_schedule_changes.sql','202610220002_form_library.sql','202610280001_form_publications.sql','202610300001_worksheet_revisions.sql','202611040001_form_assignment_portal_target.sql','202611050001_progress_log_course_viewer.sql','202611090001_class_draft_delivery.sql'])
      await sourceDb.exec(await readFile(resolve(backend,'ops/learning-migrations',file),'utf8'));
    await sourceDb.exec(`INSERT INTO mapping.classroom_course_mapping VALUES(1294,'IC1000','approved',NULL,NULL),(1295,'Lớp mẫu B','approved',NULL,NULL),
      (1296,'Lớp mẫu trống','approved',NULL,NULL),(1298,'IC999','approved',NULL,NULL),(1299,'Lớp mẫu cần đối chiếu','approved',NULL,NULL),
      (1300,'Lớp mẫu đã kết thúc','approved',NULL,NULL),(1301,'Lớp mẫu chưa bắt đầu','approved',NULL,NULL);
      INSERT INTO mapping.reviewer_account(email,status) VALUES('owner@example.test','active'),('viet@example.test','active'),('thuy@example.test','active'),('admin@example.test','active');
      INSERT INTO mapping.reviewer_class_access VALUES('owner@example.test',1294),('owner@example.test',1295),('owner@example.test',1296),('owner@example.test',1298),('owner@example.test',1299);
      INSERT INTO mapping.reviewer_class_access VALUES('owner@example.test',1300),('owner@example.test',1301),
        ('viet@example.test',1294),('viet@example.test',1300),('thuy@example.test',1295);
      INSERT INTO learning.progress_log_course_viewer(reviewer_email,course_id) VALUES('thuy@example.test',4);
      INSERT INTO learning.progress_log_admin(reviewer_email,grant_reference) VALUES('admin@example.test','Browser fixture global role');
      INSERT INTO mapping.student_mapping_review(erp_course_class_id,erp_student_contact_id,erp_student_name_snapshot) VALUES(1294,123,'Học viên giả A'),(1295,124,'Học viên giả B');
      INSERT INTO mapping.erp_class_membership_snapshot VALUES(1294,123),(1295,124);
      INSERT INTO learning.course_content_authority(reviewer_email,course_code,can_self_approve_scored_forms,grant_reference) VALUES('owner@example.test','56',true,'Browser fixture only');`);
    const reviewer={email:'owner@example.test',canAccessAllClasses:false},pool=createPGlitePool(sourceDb),sourceApp=express();sourceApp.use(express.json());
    const target=(classId,sessionNumber)=>{
      const date=`2026-11-${String((classId==='1294'?3:13)+sessionNumber).padStart(2,'0')}`;
      return {classId,sessionNumber,portalTarget:{id:String(Number(classId)*10+sessionNumber-1),startsAt:date+' 18:30:00'}};
    };
    const portalAssignmentScheduleReader=createPortalAssignmentScheduleReader({fetchImpl:async url=>{
      const classId=new URL(url).pathname.split('/').at(-2);
      if(classId==='1298')return new Response('',{status:503});
      const rows=Array.from({length:classId==='1296'?0:6},(_,index)=>{
        const slot=target(classId,index+1).portalTarget;
        return {course_class_id:Number(classId),class_session_id:Number(slot.id),session_start_datetime:slot.startsAt.replace(' ','T'),
          session_end_datetime:classId==='1294'&&index===1?'2026-10-29T21:00:00':slot.startsAt.slice(0,10)+'T21:00:00',
          status:classId==='1299'&&index===0?4:0};
      });
      return Response.json(rows.reverse());
    }});
    const catalog=[
      ['1294','IC1000','4','on_going','2026-09-01'],
      ['1295','Lớp mẫu B','5','on_going','2026-11-01'],
      ['1296','Lớp mẫu trống','4','on_going','2026-09-02'],
      ['1298','IC999','5','on_going','2026-09-02'],
      ['1299','Lớp mẫu cần đối chiếu','5','on_going','2026-09-02'],
      ['1300','Lớp mẫu đã kết thúc','4','completed','2026-10-12'],
      ['1301','Lớp mẫu chưa bắt đầu','5','on_going','2026-11-09'],
      ['1302','Lớp mẫu chưa nối Progress Log','4','pending','2026-11-18']
    ].map(([class_id,class_name,course_id,class_status,class_started_at])=>({class_id,class_name,course_id,class_status,class_started_at}));
    let classPolicyNow=Date.parse('2026-11-05T05:00:00Z');
    const classPolicy=createLearningClassPolicy({pool,directoryReader:async()=>structuredClone(catalog),now:()=>new Date(classPolicyNow)});
    const fixtureActors={owner:reviewer,viet:{email:'viet@example.test',role:'teacher',canAccessAllClasses:true},
      thuy:{email:'thuy@example.test',role:'teacher',canAccessAllClasses:false},
      admin:{email:'admin@example.test',role:'teacher',canAccessAllClasses:false}};
    sourceApp.use('/api/learning',createLearningRouter({pool,portalAssignmentScheduleReader,classPolicy,demoSourceSecret:secret,authenticate(req,_res,next){
      req.reviewer=fixtureActors[req.get('x-fixture-actor')]||reviewer;next();
    }}));
    const denied=await supertest(sourceApp).get('/api/learning/teacher/assignment-sessions?classId=1297&source=portal').expect(403);
    assert.equal(denied.body.error,'CLASS_ACCESS_DENIED');
    for(const [id,status] of [['1296','empty'],['1298','unavailable'],['1299','needs_review']]){
      const {body:{availability}}=await supertest(sourceApp).get('/api/learning/teacher/assignment-sessions').query({classId:id,source:'portal'}).expect(200);
      assert.equal(availability.classId,id);assert.equal(availability.scheduleStatus,status);assert.equal(availability.rosterStatus,'empty');
      assert.deepEqual(availability.proposals,[]);
    }
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
    await page.addInitScript(()=>{
      window.copiedLinks=[];
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.copiedLinks.push(value)}});
    });
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin+'/progress-log/fixture.html');
    await page.evaluate(async()=>{
      const {createFormDraftEditor}=await import('/progress-log/teacher-form-editor.js');
      const request=async(path,options={})=>{const response=await fetch('/source/api/learning'+path,{method:options.method||'GET',headers:{'content-type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const body=await response.json();if(!response.ok||!body.ok){const error=Error(body.message||body.error);error.status=response.status;throw error;}return body;};
      window.deliveries=[];window.editor=createFormDraftEditor({host:document.querySelector('#formDraftEditor'),apiRequest:request,libraryEnabled:true,
        onPublished:value=>window.deliveries.push(value)});
      window.fixtureRead=async(actor,path)=>{
        const response=await fetch('/source/api/learning'+path,{headers:{'x-fixture-actor':actor}});
        return {status:response.status,body:await response.json()};
      };
      const {body}=await window.fixtureRead('owner','/teacher/options');
      window.editor.setWorkspace({...body,classId:'1294',sessionNumber:3});
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
    const sent=[];
    page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/assign'))sent.push(request.postDataJSON());});
    await detail.getByRole('button',{name:'Giao bài',exact:true}).click();const dialog=page.locator('.thuy-assignment-dialog');await dialog.waitFor();
    const classAt=index=>dialog.getByLabel('Chọn lớp nhận bài '+index,{exact:true});
    const sessionAt=index=>dialog.getByLabel('Chọn buổi học '+index,{exact:true});
    const add=dialog.getByRole('button',{name:'+ Thêm lớp nhận bài tập',exact:true});
    const send=dialog.getByRole('button',{name:'Giao bài',exact:true});
    const statuses=dialog.getByRole('status');
    const classChoices=select=>select.locator('option').evaluateAll(options=>options.map(option=>option.value));
    const expectedClasses=['','1294','1298','1295','1299','1296'];
    assert.deepEqual(await classChoices(classAt(1)),expectedClasses);
    assert.equal(await classAt(1).inputValue(),'1294');
    const font=selector=>dialog.locator(selector).first().evaluate(node=>getComputedStyle(node).fontSize);
    assert.equal(await font('.thuy-management-head h2'),'20px');
    assert.equal(await font('.thuy-assignment-summary h2'),'16px');
    assert.equal(await font('.thuy-assignment-target select'),'14px');
    assert.equal(await font('.thuy-assignment-footer .button'),'14px');
    await sessionAt(1).selectOption('2');await send.click();
    assert.equal(await sessionAt(1).locator('option[value="1"]').count(),0);
    await statuses.filter({hasText:'Đã giao và đối chiếu tất cả các lớp.'}).waitFor();
    assert.deepEqual(sent.map(call=>call.targets),[[target('1294',2)]]);
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_assignment')).rows[0].n,1);

    await add.click();assert.equal(await classAt(2).inputValue(),'');
    assert.deepEqual(await classChoices(classAt(2)),expectedClasses);
    await classAt(2).selectOption('1294');
    await sessionAt(2).selectOption('3');
    assert.equal(await sessionAt(2).locator('option[value="2"]').count(),0);
    await add.click();
    let resolveRead,releaseRead;
    const captured=new Promise(resolve=>{resolveRead=resolve;}),holdRead=new Promise(resolve=>{releaseRead=resolve;});
    await page.route('**/teacher/assignment-sessions?classId=1295&source=portal',async route=>{
      const response=await route.fetch();resolveRead();await holdRead;await route.fulfill({response});
    },{times:1});
    await classAt(3).selectOption('1295');await captured;
    await classAt(3).selectOption('1294');await sessionAt(3).selectOption('5');releaseRead();
    assert.equal(await sessionAt(3).inputValue(),'5');
    await classAt(3).selectOption('1295');
    await sessionAt(3).selectOption('4');
    assert.equal(await sessionAt(2).inputValue(),'3');

    await supertest(sourceApp).post('/api/learning/teacher/form-publications/'+published.id+'/assign')
      .send({operationId:randomUUID(),targets:[target('1295',4)],origin:{source:'draft',id:published.source_draft_id}}).expect(200);
    if(process.env.PROGRESS_LOG_EVIDENCE_DIR){await mkdir(process.env.PROGRESS_LOG_EVIDENCE_DIR,{recursive:true});await dialog.screenshot({path:resolve(process.env.PROGRESS_LOG_EVIDENCE_DIR,'assignment-desktop.png')});}
    await send.click();await statuses.filter({hasText:'Một số đích chưa giao được'}).waitFor();
    await sessionAt(3).selectOption('5');await send.click();
    await statuses.filter({hasText:'Đã giao và đối chiếu tất cả các lớp.'}).waitFor();
    assert.deepEqual(sent.slice(1).map(call=>call.targets),[
      [target('1294',3),target('1295',4)],
      [target('1295',5)]
    ]);
    await add.click();await classAt(4).selectOption('1294');await sessionAt(4).selectOption('4');
    await add.click();await classAt(5).selectOption('1295');await sessionAt(5).selectOption('6');
    await send.click();await statuses.filter({hasText:'Đã giao và đối chiếu tất cả các lớp.'}).waitFor();
    assert.deepEqual(sent.at(-1).targets,[target('1294',4),target('1295',6)]);
    for(const [classId,className,session] of [['1294','IC1000',4],['1295','Lớp mẫu B',6]]){
      const {rows:[delivery]}=await sourceDb.query(
        'SELECT public_token FROM learning.form_assignment WHERE erp_course_class_id=$1 AND session_number=$2',
        [classId,session]
      );
      const receipt=dialog.locator('.thuy-delivery-row').filter({hasText:className+' · Buổi '+session});
      await receipt.getByRole('button',{name:/Sao chép link cho học viên/}).click();
      assert.equal(await page.evaluate(()=>window.copiedLinks.at(-1)),origin+'/progress-log/thuy.html#assignment='+delivery.public_token);
    }
    const rows=(await sourceDb.query('SELECT erp_course_class_id::text class_id,session_number,form_version_id FROM learning.form_assignment ORDER BY erp_course_class_id,session_number')).rows;
    assert.deepEqual(rows.map(row=>[row.class_id,row.session_number]),[['1294',2],['1294',3],['1294',4],['1295',4],['1295',5],['1295',6]]);assert.ok(rows.every(row=>row.form_version_id===published.form_version_id));assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.outbox_job')).rows[0].n,0);
    const pinned=(await sourceDb.query(`SELECT a.erp_course_class_id::text class_id,a.session_number,t.portal_session_id::text portal_id,t.starts_at
      FROM learning.form_assignment_portal_target t JOIN learning.form_assignment a ON a.id=t.assignment_id ORDER BY class_id,session_number`)).rows;
    assert.deepEqual(pinned,rows.map(row=>{const {portalTarget}=target(row.class_id,row.session_number);
      return {class_id:row.class_id,session_number:row.session_number,portal_id:portalTarget.id,starts_at:portalTarget.startsAt};}));
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.class_journey_plan')).rows[0].n,0);
    const roster=(await sourceDb.query(`SELECT a.erp_course_class_id::text class_id, s.erp_student_contact_id::text student_id, count(*)::int n
      FROM learning.form_assignment a JOIN learning.form_assignment_roster s ON s.assignment_id=a.id
      GROUP BY a.erp_course_class_id,s.erp_student_contact_id ORDER BY a.erp_course_class_id`)).rows;
    assert.deepEqual(roster,[{class_id:'1294',student_id:'123',n:3},{class_id:'1295',student_id:'124',n:3}]);
    await page.setViewportSize({width:390,height:844});assert.equal(await dialog.evaluate(element=>element.scrollWidth>element.clientWidth),false);
    assert.equal(await font('.thuy-assignment-target select'),'16px');
    if(process.env.PROGRESS_LOG_EVIDENCE_DIR)await dialog.screenshot({path:resolve(process.env.PROGRESS_LOG_EVIDENCE_DIR,'assignment-mobile.png')});
    assert.deepEqual((await sourceDb.query('SELECT source_scope FROM learning.form_assignment_origin ORDER BY assignment_id')).rows.map(r=>r.source_scope),Array(6).fill('personal'));
    await page.setViewportSize({width:1440,height:1000});await page.keyboard.press('Escape');
    await detail.getByRole('button',{name:'Sửa bài',exact:true}).click();
    await page.getByLabel('Tên bài tập',{exact:true}).fill('Phiếu tích hợp đã sửa');await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.locator('.thuy-editor-save-state').filter({hasText:'Đã lưu'}).waitFor();
    await page.getByRole('button',{name:'Quay lại Quản lý bài tập',exact:true}).click();assert.equal(await page.locator('.thuy-library-scroll tbody tr').count(),1);
    await page.getByRole('button',{name:'Phiếu tích hợp đã sửa',exact:true}).click();await page.getByRole('button',{name:'Sửa bài',exact:true}).click();
    await page.getByRole('button',{name:'Xuất bản',exact:true}).click();await page.locator('.thuy-publication-notice').filter({hasText:'Đã xuất bản thành công'}).waitFor();
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_assignment')).rows[0].n,6);
    assert.ok((await sourceDb.query('SELECT form_version_id FROM learning.form_assignment')).rows.every(r=>r.form_version_id===published.form_version_id));
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_worksheet')).rows[0].n,1);
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_publication')).rows[0].n,2);
    const roles=await page.evaluate(async()=>{
      const read=window.fixtureRead,opts=actor=>read(actor,'/teacher/options');
      const [viet,thuy,admin,other,k56,unmapped,readonlySchedule]=await Promise.all([
        opts('viet'),opts('thuy'),opts('admin'),read('viet','/teacher/classes/1295/overview'),
        read('thuy','/teacher/classes/1294/overview'),read('thuy','/teacher/classes/1302/overview'),
        read('thuy','/teacher/assignment-sessions?classId=1294&source=portal')
      ]);
      return {viet:viet.body,thuy:thuy.body,admin:admin.body,statuses:[other.status,k56.status,unmapped.status,readonlySchedule.status],
        unmapped:unmapped.body.overview?.progressLogMapped};
    });
    assert.equal(roles.viet.reviewer.canAccessAllClasses,false);
    assert.deepEqual(roles.viet.classes.map(row=>row.class_id).sort(),['1294','1300']);
    assert.deepEqual(roles.viet.assignmentClasses.map(row=>row.class_id),['1294']);
    assert.equal(roles.thuy.reviewer.canReadCourse56,true);
    assert.equal(roles.thuy.classes.find(row=>row.class_id==='1294').can_manage,false);
    assert.equal(roles.thuy.classes.some(row=>row.class_id==='1298'),false);
    assert.deepEqual(roles.thuy.assignmentClasses.map(row=>row.class_id),['1295']);
    assert.equal(roles.admin.reviewer.canAccessAllClasses,true);
    assert.deepEqual(roles.statuses,[403,200,200,403]);assert.equal(roles.unmapped,false);
    const deniedWrite=await supertest(sourceApp).post('/api/learning/teacher/form-publications/'+published.id+'/assign')
      .set('x-fixture-actor','thuy').send({operationId:randomUUID(),targets:[target('1294',1)]}).expect(200);
    assert.equal(deniedWrite.body.delivery.results[0].error,'DRAFT_CLASS_ACCESS_DENIED');
    catalog.find(row=>row.class_id==='1295').class_status='completed';
    const ended=await supertest(sourceApp).post('/api/learning/teacher/form-publications/'+published.id+'/assign')
      .send({operationId:randomUUID(),targets:[target('1295',1)]}).expect(200);
    assert.equal(ended.body.delivery.results[0].error,'CLASS_NOT_ONGOING');
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_assignment')).rows[0].n,6);
    await sourceDb.exec("UPDATE learning.course_content_authority SET status='revoked',revoked_at=now() WHERE reviewer_email='owner@example.test'");
    await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();
    await page.getByLabel('Tên bài tập',{exact:true}).fill('Bài ghép tiêu đề của giảng viên');
    await page.getByLabel('Trình độ',{exact:true}).selectOption('56');
    await page.getByRole('button',{name:'+ Danh sách xổ xuống',exact:true}).click();
    await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('reading');
    await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Chọn tiêu đề cho đoạn A');
    for(const [index,label]of ['i Tiêu đề một','ii Tiêu đề hai','iii Tiêu đề ba','iv Tiêu đề bốn'].entries())
      await page.getByLabel('Lựa chọn '+String.fromCharCode(65+index)+' câu 1',{exact:true}).fill(label);
    await page.getByLabel('Đáp án đúng B câu 1',{exact:true}).check();
    await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
    await page.locator('.thuy-editor-save-state').filter({hasText:'Đã lưu'}).waitFor();
    await page.getByRole('button',{name:'Quay lại Quản lý bài tập',exact:true}).click();
    const row=page.getByRole('row',{name:'Xem Bài ghép tiêu đề của giảng viên'});
    await row.getByRole('button',{name:'Giao bài',exact:true}).click();
    assert.equal(await send.isEnabled(),false);
    await sessionAt(1).selectOption('6');
    assert.equal(await dialog.getByRole('checkbox').count(),0);
    assert.equal(await send.isEnabled(),true);
    const request=page.waitForRequest(req=>req.method()==='POST'&&new URL(req.url()).pathname.endsWith('/assign-to-classes'));
    await sourceDb.exec('SET ROLE learning_api');
    await send.click();
    await statuses.filter({hasText:'Đã giao và đối chiếu tất cả các lớp.'}).waitFor();
    const submitted=await request,body=submitted.postDataJSON(),draftId=new URL(submitted.url()).pathname.split('/').at(-2);
    assert.deepEqual(body.targets,[target('1294',6)]);
    assert.equal(body.confirmedAnswers,true);
    const endpoint='/api/learning/teacher/form-drafts/'+draftId+'/assign-to-classes';
    const repeat=await supertest(sourceApp).post(endpoint).send(body).expect(200);
    const delivered=repeat.body.delivery.results[0].delivery;
    assert.equal(delivered.replayed,true);
    assert.equal(delivered.rosterCount,1);
    const evidence=process.env.PROGRESS_COPY_LINK_EVIDENCE;
    const receipt=dialog.locator('.thuy-delivery-row');
    assert.equal(await receipt.count(),1);
    if(evidence){await mkdir(evidence,{recursive:true});await dialog.screenshot({path:resolve(evidence,'giao-mot-lop.png')});}
    await receipt.first().getByRole('button',{name:/Sao chép link cho học viên/}).click();
    assert.equal(await page.evaluate(()=>window.copiedLinks.at(-1)),origin+'/progress-log/thuy.html#assignment='+delivered.publicToken);
    await supertest(sourceApp).post(endpoint).send({...body,confirmedAnswers:false}).expect(400);
    const forbidden=await supertest(sourceApp).post(endpoint).send({...body,operationId:randomUUID(),targets:[target('1302',3)]}).expect(200);
    assert.equal(forbidden.body.delivery.results[0].error,'DRAFT_CLASS_ACCESS_DENIED');
    const stale=await supertest(sourceApp).post(endpoint).send({...body,operationId:randomUUID(),expectedRevision:body.expectedRevision+1}).expect(200);
    assert.equal(stale.body.delivery.results[0].error,'DRAFT_STALE');
    await supertest(sourceApp).post('/api/learning/teacher/form-drafts/'+draftId+'/publish-library')
      .send({expectedRevision:body.expectedRevision,operationId:randomUUID()}).expect(409);
    await sourceDb.exec('RESET ROLE');
    const scoped=(await sourceDb.query('SELECT * FROM learning.class_draft_delivery')).rows[0];
    assert.equal(scoped.form_version_id,delivered.formVersionId);
    assert.equal(scoped.draft_hash,body.expectedHash);
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_publication')).rows[0].n,2);
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.form_assignment')).rows[0].n,7);
    assert.equal((await sourceDb.query('SELECT count(*)::int n FROM learning.outbox_job')).rows[0].n,0);
    assert.equal((await sourceDb.query('SELECT status FROM learning.form_draft WHERE id=$1',[draftId])).rows[0].status,'draft');
    const publicView=await supertest(sourceApp).post('/api/learning/assignments/open').send({publicToken:delivered.publicToken}).expect(200);
    assert.equal(publicView.body.assignment.definition.title,'Bài ghép tiêu đề của giảng viên');
    assert.doesNotMatch(JSON.stringify(publicView.body),/expectedOptionId|gradingKey/);
    await assert.rejects(()=>sourceDb.query('UPDATE learning.form_assignment SET session_number=1 WHERE id=$1',[delivered.assignmentId]),/CLASS_DRAFT_DELIVERY_TARGET_MISMATCH/);
    await assert.rejects(()=>sourceDb.query('UPDATE learning.form_grading_key SET content_hash=content_hash WHERE form_version_id=$1',[delivered.formVersionId]),/CLASS_DRAFT_DELIVERY_CONTENT_SCOPED/);
    catalog.find(row=>row.class_id==='1295').class_status='on_going';
    classPolicyNow+=61000;
    await add.click();
    await classAt(2).selectOption('1295');
    await sessionAt(2).selectOption('3');
    await send.click();
    await statuses.filter({hasText:'Đã giao và đối chiếu tất cả các lớp.'}).waitFor();
    assert.equal(await receipt.count(),2);
    const secondDelivery=(await sourceDb.query('SELECT public_token FROM learning.form_assignment WHERE erp_course_class_id=1295 AND session_number=3')).rows[0];
    if(evidence){
      await dialog.screenshot({path:resolve(evidence,'giao-nhieu-lop.png')});
      await page.setViewportSize({width:390,height:900});
      assert.equal(await dialog.evaluate(element=>element.scrollWidth>element.clientWidth),false);
      await dialog.screenshot({path:resolve(evidence,'giao-nhieu-lop-dien-thoai.png')});
      await page.setViewportSize({width:1440,height:1000});
    }
    for(const [index,token] of [delivered.publicToken,secondDelivery.public_token].entries()){
      await receipt.nth(index).getByRole('button',{name:/Sao chép link cho học viên/}).click();
      assert.equal(await page.evaluate(()=>window.copiedLinks.at(-1)),origin+'/progress-log/thuy.html#assignment='+token);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();if(server)await new Promise(done=>server.close(done));await sourceDb.close();await demoDb.close();}
});
