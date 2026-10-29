// Entry/CSS thật; mọi ghi và dữ liệu đều cách ly, không gọi lớp hay AI production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=process.env.PROGRESS_LOG_TEST_ROOT||fileURLToPath(new URL('../',import.meta.url));
const evidence=process.env.PROGRESS_LOG_QA_DIR;
async function fixture(t){
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/progress-log/fixture.html'){
   const html=(await readFile(resolve(root,'progress-log/teacher.html'),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   res.setHeader('content-type','text/html; charset=utf-8');return res.end(html);
  }
  const file=resolve(root,'.'+path);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');
  res.setHeader('content-type',{'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.html':'text/html'}[extname(file)]||'text/plain');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.goto(origin+'/progress-log/fixture.html');
 await page.evaluate(()=>{document.body.className='thuy-live thuy-teacher';});
 t.after(async()=>{await browser.close();await new Promise(done=>server.close(done));assert.deepEqual(errors,[]);});
 return {page,context,origin};
}
async function shot(page,name){if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:resolve(evidence,name+'.png'),fullPage:true});}}
async function readable(locator){const box=await locator.boundingBox();assert.ok(box&&box.width>200&&box.height>=16,'Thông báo phải đủ vùng để đọc: '+JSON.stringify(box));assert.equal(await locator.evaluate(e=>getComputedStyle(e).clipPath),'none','Thông báo không được bị CSS cắt giấu');assert.ok(await locator.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=12));}

test('T19 giao xong rồi thêm lớp mới mở lại nút và ghép biên nhận theo định danh',{timeout:45000},async t=>{
 const {page}=await fixture(t);
 await page.evaluate(async()=>{
  const {createAssignmentDialog}=await import('/progress-log/teacher-assignment-dialog.js');
  window.deliveryCalls=[];
  const request=async(path,options={})=>{
   if(path.startsWith('/teacher/journey-plan'))return {plan:{classId:new URLSearchParams(path.split('?')[1]).get('classId'),totalSessions:12}};
   window.deliveryCalls.push(structuredClone(options.body));
   return {delivery:{results:options.body.targets.map(target=>({...target,ok:true,delivery:{formVersionId:'version-fixture',rosterCount:target.classId==='a'?17:9}})).reverse()}};
  };
  window.assignment=createAssignmentDialog({request,getClasses:()=>[{class_id:'a',class_name:'Lớp mẫu A'},{class_id:'b',class_name:'Lớp mẫu B'},{class_id:'c',class_name:'Lớp mẫu C'}],getPreferredClass:()=> 'a'});
  window.assignment.open({title:'Phiếu mẫu cách ly',sessionNumber:7,publication:{id:'pub-fixture',formVersionId:'version-fixture'}});
 });
 const dialog=page.locator('.thuy-assignment-dialog');
 await dialog.getByRole('button',{name:'Giao bài',exact:true}).click();
 await dialog.getByText('Đã giao · 17 học viên',{exact:true}).waitFor();
 await dialog.getByRole('button',{name:'+ Thêm lớp nhận bài tập',exact:true}).click();
 await dialog.getByLabel('Chọn lớp nhận bài 2',{exact:true}).selectOption('b');
 await dialog.getByLabel('Chọn buổi học 2',{exact:true}).selectOption('8');
 assert.equal(await dialog.getByRole('button',{name:'Giao bài',exact:true}).isEnabled(),true,'Đích mới phải mở lại nút');
 await dialog.getByRole('button',{name:'+ Thêm lớp nhận bài tập',exact:true}).click();
 await dialog.getByLabel('Chọn lớp nhận bài 3',{exact:true}).selectOption('c');
 await dialog.getByLabel('Chọn buổi học 3',{exact:true}).selectOption('9');
 await dialog.getByRole('button',{name:'Giao bài',exact:true}).click();
 await dialog.getByText('Đã giao · 9 học viên',{exact:true}).first().waitFor();
 assert.deepEqual(await page.evaluate(()=>window.deliveryCalls.map(c=>c.targets)),[[{classId:'a',sessionNumber:7}],[{classId:'b',sessionNumber:8},{classId:'c',sessionNumber:9}]]);
 assert.equal(await dialog.locator('[role=status]').evaluate(e=>e.classList.contains('success')),true);
 await readable(dialog.locator('[role=status]'));
 await shot(page,'assignment-success');
});

test('T17 Phiếu đã giao bỏ nút giao ở cả hàng và chi tiết',{timeout:30000},async t=>{
 const {page}=await fixture(t);
 await page.evaluate(async()=>{
  const {createFormLibrary}=await import('/progress-log/teacher-form-library.js');
  const host=document.querySelector('#formDraftEditor');for(let parent=host;parent;parent=parent.parentElement)parent.hidden=false;window.libraryHost=host;
  window.library=createFormLibrary({host,request:async path=>{
   if(path.startsWith('/teacher/dashboard'))return {dashboard:{assignmentId:'used-fixture',definition:{blocks:[]}}};
   if(path==='/teacher/demo-grants')return {grant:'fixture'};
   return {entries:[]};
  }});
  window.library.setUsed([{assignment_id:'used-fixture',title:'Phiếu đã dùng mẫu',class_id:'a',class_name:'Lớp mẫu',session_number:7}]);
 });
 await page.getByRole('tab',{name:/Phiếu đã giao/}).click();
 assert.equal(await page.locator('.thuy-library-scroll').getByRole('button',{name:'Giao bài',exact:true}).count(),0);
 await page.getByRole('button',{name:'Phiếu đã dùng mẫu',exact:true}).click();
 assert.equal(await page.locator('.thuy-library-detail').getByRole('button',{name:'Giao bài',exact:true}).count(),0);
});

async function editorFixture(t){
 const f=await fixture(t);await f.page.evaluate(async()=>{
  const elements=Object.fromEntries([...document.querySelectorAll('[id]')].map(n=>[n.id,n]));
  const {mountThuyTeacherLayout}=await import('/progress-log/thuy-live/teacher-view.js');
  mountThuyTeacherLayout(elements,{onMode(){},onClass(){},onHome(){}}).setPanel('create');
  elements.teacherWorkspace.hidden=false;elements.createPanel.hidden=false;elements.dashboardPanel.hidden=true;
  const {createFormDraftEditor,newEditorPayload,newEditorItem}=await import('/progress-log/teacher-form-editor.js');
  window.calls=[];window.publications=[];window.saved=null;
  const request=async(path,options={})=>{
   const body=structuredClone(options.body);window.calls.push({path,body});
   if(path.startsWith('/teacher/form-library?'))return {entries:[]};
   if(path==='/teacher/form-publications')return {publications:window.publications};
   if(path.startsWith('/teacher/form-drafts/review-queue'))return {drafts:[]};
   if(path.startsWith('/teacher/form-drafts?'))return {drafts:window.saved?[structuredClone(window.saved)]:[]};
   if(path==='/teacher/form-drafts'&&options.method==='POST'){window.saved={...body,id:'draft-fixture',revision:1,status:'draft',contentHash:'h1'};return {draft:structuredClone(window.saved)};}
   if(path.endsWith('/ai-import-preview')){
    if(window.holdAi)await new Promise(done=>{window.releaseAi=done;});
    const payload={definition:structuredClone(window.saved.definition),gradingKey:structuredClone(window.saved.gradingKey)};
    // JSONB có thể trả thứ tự khóa object khác dù nội dung/ID của câu cũ không đổi.
    payload.definition.blocks[0].items[0]=Object.fromEntries(Object.entries(payload.definition.blocks[0].items[0]).reverse());
    const added=[newEditorItem('mcq',2),newEditorItem('reflection',3)];added[0].prompt='Question alpha';added[0].skillCodes=['reading'];added[1].prompt='Question beta';added[1].skillCodes=['speaking'];
    payload.definition.blocks[0].items.push(...added);payload.gradingKey.items[added[0].itemVersionId]={graderType:'exact_option',expectedOptionId:'B'};
    window.failedAiSave=Boolean(window.failAiSave);return {preview:{baseRevision:window.saved.revision,payload,rows:[],errors:[],warnings:[],unmappedText:''}};
   }
   if(path==='/teacher/form-drafts/draft-fixture'){
    if(options.method==='PUT'){if(window.failedAiSave){window.failedAiSave=false;throw Error('Mất kết nối khi lưu câu AI');}window.saved={...window.saved,...body,revision:window.saved.revision+1,contentHash:'updated'};}
    return {draft:structuredClone(window.saved)};
   }
   if(path.endsWith('/preview-grant')){if(window.failGrant){window.failGrant=false;throw Error('Tạm thời chưa cấp được quyền demo');}return {grant:'fixture'};}
   if(path.endsWith('/approve')){window.saved.status='approved';return {draft:structuredClone(window.saved)};}
   if(path.endsWith('/publish-library')){window.saved.status='published';const publication={id:'publication',draftId:window.saved.id,revision:window.saved.revision};window.publications.push(publication);return {publication};}
   throw Error('Ngoài fixture '+path);
  };
  window.editor=createFormDraftEditor({host:elements.formDraftEditor,apiRequest:request,libraryEnabled:true});
  window.editor.setWorkspace({classes:[{class_id:'a',class_name:'Lớp mẫu'}],assignments:[],classId:'a',sessionNumber:7});
  const payload=newEditorPayload('Phiếu đang soạn mẫu');payload.definition.blocks[0].items[0].skillCodes=['general'];
  window.saved={...payload,id:'draft-fixture',classId:'a',sessionNumber:7,revision:1,status:'draft',contentHash:'h1'};window.editor.openDraft(window.saved);
 });return f;
}
test('T18 Tạo bài thêm một lần vào nháp giữ câu cũ; lưu lỗi thử lại không gọi AI lần hai',{timeout:45000},async t=>{
 const {page}=await editorFixture(t);
 const before=await page.evaluate(()=>window.editor.getPayload().definition.blocks[0].items[0].itemVersionId);
 await page.evaluate(()=>{window.failAiSave=true;});
 await page.getByRole('button',{name:'AI chuyển nội dung có sẵn',exact:true}).click();
 const ai=page.locator('.thuy-editor-ai');assert.equal(await ai.locator('input[type=file],input[type=url]').count(),0);
 await ai.getByLabel('Nội dung câu hỏi có sẵn',{exact:true}).fill('Question alpha\nAnswer: B\nQuestion beta');
 await ai.getByRole('button',{name:'Tạo bài',exact:true}).click();
 await ai.getByRole('button',{name:'Thử lưu nháp',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.editor.getPayload().definition.blocks[0].items.length),3);
 await ai.getByRole('button',{name:'Thử lưu nháp',exact:true}).click();await ai.getByText('Đã lưu các câu vừa tạo. Bạn có thể đóng để kiểm nội dung.',{exact:true}).waitFor();
 await readable(ai.getByRole('status'));
 assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.path.endsWith('/ai-import-preview')).length),1);
 assert.equal(await page.evaluate(()=>window.saved.definition.blocks[0].items[0].itemVersionId),before);
 assert.equal(await page.evaluate(()=>window.saved.definition.blocks.length),1);
 await shot(page,'ai-recovered');await ai.getByRole('button',{name:'Đóng AI',exact:true}).click();
 await page.getByRole('button',{name:'Xuất bản',exact:true}).click();
 await page.locator('.thuy-publication-notice').getByText(/Đã xuất bản thành công/).waitFor();
 await readable(page.locator('.thuy-publication-notice'));
 assert.equal(await page.getByRole('tab',{name:/Kho cá nhân/}).getAttribute('aria-selected'),'true');
 assert.equal(await page.getByRole('button',{name:'Phiếu đang soạn mẫu',exact:true}).isVisible(),true);
 assert.equal(await page.locator('.thuy-authoring').isVisible(),false);await shot(page,'publish-personal-library');
});

test('T19 Xem trước tại chỗ lỗi grant thử lại và Escape trả focus không mở tab mới',{timeout:30000},async t=>{
 const {page,context}=await editorFixture(t);await page.evaluate(()=>{window.failGrant=true;});
 await page.getByRole('button',{name:'Xem trước',exact:true}).click();
 const preview=page.locator('.thuy-worksheet-preview');await preview.getByRole('button',{name:'Thử mở lại',exact:true}).waitFor();
 await preview.getByRole('button',{name:'Thử mở lại',exact:true}).click();
 await preview.locator('iframe').waitFor();assert.match(await preview.locator('iframe').getAttribute('src'),/view=worksheet#grant=fixture/);
 assert.equal(context.pages().length,1);await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('button',{name:'Xem trước',exact:true}).evaluate(e=>e===document.activeElement),true);
});

test('T19 lỗi dịch vụ demo hiện trong iframe và thử lại tại chỗ không gọi lớp thật',{timeout:45000},async t=>{
 const {page,context,origin}=await editorFixture(t);let calls=0;
 await context.route('**/progress-log/demo/config.js*',route=>route.fulfill({contentType:'text/javascript',body:'window.PROGRESS_LOG_CONFIG={API_BASE_URL:'+JSON.stringify(origin) +',DEMO_MODE:true};'}));
 await context.route('**/api/demo/runs',route=>{calls++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,message:'Dịch vụ demo mẫu tạm lỗi'})});});
 await page.getByRole('button',{name:'Xem trước',exact:true}).click();const frame=page.frameLocator('.thuy-worksheet-preview iframe');
 const retry=frame.getByRole('button',{name:'Thử mở lại phiếu',exact:true});await retry.waitFor();await readable(frame.locator('#notice'));
 await retry.click();await retry.waitFor();assert.equal(calls,2);assert.equal(context.pages().length,1);
});

test('T18 đóng AI khi đang chờ không áp phản hồi muộn vào phiếu',{timeout:30000},async t=>{
 const {page}=await editorFixture(t);await page.evaluate(()=>{window.holdAi=true;});
 await page.getByRole('button',{name:'AI chuyển nội dung có sẵn',exact:true}).click();const ai=page.locator('.thuy-editor-ai');
 await ai.getByLabel('Nội dung câu hỏi có sẵn').fill('Nội dung giữ khi đóng');await ai.getByRole('button',{name:'Tạo bài',exact:true}).click();
 await page.waitForFunction(()=>Boolean(window.releaseAi));await ai.getByRole('button',{name:'Đóng AI',exact:true}).click();await page.evaluate(()=>window.releaseAi());
 await page.waitForFunction(()=>!document.querySelector('.editor-actions').getAttribute('aria-busy')||document.querySelector('.editor-actions').getAttribute('aria-busy')==='false');
 assert.equal(await page.evaluate(()=>window.editor.getPayload().definition.blocks[0].items.length),1);
});

test('T17 tab loại trừ panel trong vùng kết quả; ba cập nhật giữ node và vị trí; tiến độ không mở người',{timeout:30000},async t=>{
 const {page}=await fixture(t);
 await page.evaluate(async()=>{
  const e=Object.fromEntries([...document.querySelectorAll('[id]')].map(n=>[n.id,n]));
  const {mountThuyTeacherLayout,renderThuyRoster,showThuyDetail}=await import('/progress-log/thuy-live/teacher-view.js');
  window.layout=mountThuyTeacherLayout(e,{onMode:mode=>{window.layout.setMode(mode);window.render(mode);},onClass(){},onHome(){}});
  e.teacherWorkspace.hidden=e.dashboardPanel.hidden=false;window.layout.setPanel('dashboard');
  e.dashboardTitle.textContent='Buổi 7 Phiếu mẫu';e.blockControls.textContent='Phần 1 mở · Phần 2 mở';
  window.people=Array.from({length:20},(_,i)=>({studentRef:'s'+i,name:'Học viên '+i,checkpoints:[]}));
  window.render=mode=>renderThuyRoster(e.studentList,{dashboard:{assignmentId:'sample',students:window.people,definition:{blocks:[]}},liveByStudent:new Map(),mode,onQuery(){},onFilter(){},onOpen:s=>{e.draftStudentName.textContent=s.name;e.draftAnswers.innerHTML='<textarea aria-label="Nhận xét mẫu"></textarea>';showThuyDetail(e.draftDialog);}});
  window.render('progress');
 });
 await page.locator('[data-student=s0]').click();assert.equal(await page.locator('#draftDialog').isVisible(),false);
 await page.getByRole('button',{name:'Kết quả',exact:true}).click();
 assert.equal(await page.locator('#classInsightSection').isVisible(),true);assert.equal(await page.locator('#studentList').isVisible(),false);
 await page.getByRole('tab',{name:'Nhận xét cá nhân',exact:true}).click();
 assert.equal(await page.locator('#classInsightSection').isVisible(),false);
 const hero=await page.locator('.thuy-session-header').boundingBox();await page.locator('[data-student=s0]').click();
 const list=await page.locator('#studentList').boundingBox(),panel=await page.locator('#draftDialog').boundingBox(),after=await page.locator('.thuy-session-header').boundingBox();
 assert.deepEqual(after,hero);assert.ok(panel.x>list.x);assert.ok(Math.abs(panel.y-list.y)<3);assert.ok(Math.abs(panel.width-list.width)<3);
 await page.getByLabel('Nhận xét mẫu').fill('Giữ đúng nháp và vùng đọc');
 await page.evaluate(()=>{window.stable=document.querySelector('[data-student=s0]');});
 for(let i=0;i<3;i++)await page.evaluate(()=>window.render('results'));
 assert.equal(await page.evaluate(()=>window.stable===document.querySelector('[data-student=s0]')),true);
 assert.equal(await page.getByLabel('Nhận xét mẫu').inputValue(),'Giữ đúng nháp và vùng đọc');
 await shot(page,'results-split-desktop');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(page,'results-split-mobile');
});

test('T17 thống kê câu trái tỷ lệ phải và cấu trúc câu dùng chung bản học viên',{timeout:30000},async t=>{
 const {page}=await fixture(t);
 await page.evaluate(async()=>{
  const e=Object.fromEntries([...document.querySelectorAll('[id]')].map(n=>[n.id,n]));
  const {mountThuyTeacherLayout}=await import('/progress-log/thuy-live/teacher-view.js');
  const layout=mountThuyTeacherLayout(e,{onMode(){},onClass(){},onHome(){}});layout.setPanel('dashboard');layout.setMode('results');
  const host=document.querySelector('#questionAnalytics');for(let p=host;p;p=p.parentElement)p.hidden=false;
  const {renderThuyAnalytics}=await import('/progress-log/thuy-live/question-analytics.js');
  const {newEditorItem}=await import('/progress-log/teacher-form-editor.js');
  const types=['mcq','multi','matching','dropdown','gapfill','numbered_short_texts','reflection','self_reported_score'];
  const items=types.map((type,index)=>{const i=newEditorItem(type,index+1);i.skillCodes=['reading'];i.prompt='Đề nguyên văn dạng '+type;return i;});
  window.analyticsDefinition={blocks:[{title:'Phần bài tập',items}]};
  window.analyticsData={submittedCount:14,rosterCount:18,items:items.map(i=>({...i,objective:i.graderType!=='none',correctOptionIds:['B'],correctAnswer:['Phương án B'],counts:{incorrect:9,graded:14,answered:14,visible:18,pending:0,manual:0,ungraded:0,hidden:0}}))};
  window.renderStats=()=>renderThuyAnalytics(host,window.analyticsData,{definition:window.analyticsDefinition});window.renderStats();
 });
 assert.equal(await page.getByText('Thống kê theo câu hỏi · 4',{exact:true}).count(),1);
 const first=page.locator('.thuy-question-select').first();const left=await first.locator('.thuy-question-copy').boundingBox(),right=await first.locator('.thuy-question-stats').boundingBox();assert.ok(right.x>left.x+left.width);
 assert.match(await first.locator('.thuy-question-stats').innerText(),/9\/14 sai/);assert.match(await first.locator('.thuy-question-stats').innerText(),/64,3% sai/);
 assert.deepEqual(await page.locator('.thuy-question-detail .choice-key').allTextContents(),['A','B']);
 assert.equal(await page.locator('.thuy-question-detail .feedback-correct .choice-feedback').innerText(),'Đáp án đúng');
 await page.evaluate(()=>{window.statsNode=document.querySelector('.thuy-question-card');});for(let i=0;i<3;i++)await page.evaluate(()=>window.renderStats());
 assert.equal(await page.evaluate(()=>window.statsNode===document.querySelector('.thuy-question-card')),true);
 for(const row of await page.locator('.thuy-question-select').all())await row.click();
 await shot(page,'question-statistics');
});
