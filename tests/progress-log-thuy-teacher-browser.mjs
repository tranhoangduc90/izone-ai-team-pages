// Phiên giáo viên và bài làm giả kiểm bảng, khung cạnh danh sách và công bố nhận xét.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),uid=n=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('Thủy GV: bảng một cột điểm danh, đổi người giữ nháp, công bố, X/Esc/ngoài khung và không nhầm popup mới',{timeout:60000},async()=>{
 const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',{'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[],writes=[],unexpected=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 const A=uid(1),B=uid(2),id=uid(3),block=uid(4),item=uid(5),comments=new Map();
 let savedDraft=null;
 const definition={title:'Phiếu từ khóa thử',blocks:[{blockId:block,checkpoint:1,title:'Từ khóa',items:[{itemVersionId:item,position:1,prompt:'Câu hỏi gạch chân',interactionType:'multi_choice_group',layoutType:'keyword_selection',options:[{id:'w1',label:'go'},{id:'w2',label:'go'},{id:'w3',label:'home?'}],interactionConfig:{maxSelections:3}}]}]};
 const students=()=>[{studentRef:A,name:'Học viên A',checkpoints:[{blockId:block}],attendanceStatus:'self_confirmed',sessionComment:comments.get(A)||null,portalSync:{status:'complete',readbackAt:new Date().toISOString(),portalStatus:'synced'}},
 {studentRef:B,name:'Học viên B',checkpoints:[],attendanceStatus:null,sessionComment:comments.get(B)||null,portalSync:null}];
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());let body;try{body=req.postDataJSON();}catch{}
  const send=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(u.pathname==='/progress-log/config.js')return route.fulfill({contentType:'text/javascript',body:`window.PROGRESS_LOG_CONFIG={API_BASE_URL:${JSON.stringify(origin)},THUY_PILOT_CLASS_IDS:['1294']};`});
  if(u.origin!==origin)return route.abort();
  if(u.pathname==='/api/auth/session')return send({ok:true,reviewer:{email:'teacher@example.invalid'}});
  if(!u.pathname.startsWith('/api/learning/'))return route.continue();
  const path=u.pathname.slice('/api/learning'.length);
  // Khớp schema router thật: dashboard/live nhận assignment, không nhận assignmentId.
  if(['/teacher/dashboard','/teacher/live-drafts'].includes(path)&&u.searchParams.get('assignment')!==id)
    return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,message:'Dữ liệu gửi lên không hợp lệ.'})});
  if(req.method()!=='GET')writes.push({path,body});
  if(path==='/teacher/options')return send({ok:true,reviewer:{name:'Giảng viên mẫu',email:'teacher@example.invalid'},classes:[{class_id:'1294',class_name:'IC2305'}],assignments:[{assignment_id:id,public_token:id,class_id:'1294',class_name:'IC2305',session_number:11,title:definition.title,status:'published'}]});
  if(path==='/teacher/question-library')return send({ok:true,items:[]});
  if(path==='/teacher/form-drafts'&&req.method()==='POST'){savedDraft={...body,id:uid(90),revision:1,status:'draft'};return send({ok:true,draft:savedDraft});}
  if(path==='/teacher/form-drafts/'+uid(90)){if(req.method()==='PUT')savedDraft={...savedDraft,...body,revision:savedDraft.revision+1};return send({ok:true,draft:savedDraft});}
  if(path==='/teacher/form-drafts'||path==='/teacher/form-drafts/review-queue')return send({ok:true,drafts:path.endsWith('review-queue')||!savedDraft?[]:[savedDraft]});
  if(path==='/teacher/dashboard')return send({ok:true,dashboard:{assignmentId:id,publicToken:id,title:definition.title,classId:'1294',className:'IC2305',sessionNumber:11,definition,journeyCommentsEnabled:true,
   students:students(),blockReleases:[{blockId:block,checkpoint:1,status:'open'}],classInsights:[]}});
  if(path==='/teacher/live-drafts')return send({ok:true,live:{assignmentId:id,generatedAt:new Date().toISOString(),students:[{studentRef:A,attemptId:uid(8),draftRevision:1,draftResponses:{[item]:['w2']},sessionComment:comments.get(A)||null}]}});
  if(path==='/teacher/journey-plan')return send({ok:true,plan:{classId:'1294',className:'IC2305',totalSessions:11,highestKnownSession:11,revision:1,testSessionNumbers:[],testSources:[],sessionDates:[{sessionNumber:11,date:'2026-10-22',erpSessionId:'35822'}]}});
  if(path==='/teacher/classes/1294/overview')return send({ok:true,overview:{classId:'1294',className:'IC2305',totalSessions:11,counts:{currentStudents:2,complete:0},sessions:[{sessionNumber:11,sessionDate:'2026-10-22'}],students:students().map(student=>({...student,cells:[{sessionNumber:11,status:'not_submitted',sessionComment:student.sessionComment}]}))}});
  if(path.endsWith('/question-analytics'))return send({ok:true,analytics:{assignmentId:id,submittedCount:1,rosterCount:2,items:[{itemVersionId:item,position:1,prompt:'Câu hỏi gạch chân',objective:false,counts:{roster:2,submitted:1,visible:1,hidden:0,unanswered:0,answered:1,graded:0,correct:0,incorrect:0},choices:[{label:'go',count:1}],students:[{studentRef:A,name:'Học viên A',verdict:'ungraded'}]}]}});
  if(path==='/teacher/session-comments'&&req.method()==='PUT'){
   assert.equal(req.headers()['x-izone-csrf'],'1');const note={...body,revision:body.expectedRevision+1,visibility:'visible',teacherName:'Giảng viên mẫu',updatedAt:new Date().toISOString()};comments.set(body.studentRef,note);return send({ok:true,comment:note});
  }
  if(path==='/teacher/form-library')return send({ok:true,entries:[]});
  unexpected.push(path);return send({ok:false,message:'Ngoài fixture'});
 });
 try{
  await page.goto(origin+'/progress-log/teacher.html#assignment='+id);await page.locator('.thuy-roster tbody tr').first().waitFor();
  assert.ok(page.url().includes('/teacher-thuy.html#assignment='+id));
  assert.equal(await page.locator('.thuy-roster th').filter({hasText:'Điểm danh'}).count(),1);
  assert.equal(await page.locator('.thuy-roster th').filter({hasText:'Portal'}).count(),0);
  await page.locator('.thuy-roster').getByText('Đã điểm danh',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('[data-thuy-mode=results]').click();
  await page.getByRole('button',{name:'Xem phân bố và học viên',exact:true}).click();
  await page.getByText('1 bài nộp · 1 đã trả lời · 0 để trống · 0 không áp dụng',{exact:true}).waitFor();
  assert.equal(await page.locator('.thuy-question-distribution').getByRole('button',{name:'Học viên A',exact:true}).count(),1);
  await page.locator('.thuy-question-distribution').getByRole('button',{name:'Đóng phân bố',exact:true}).click();
  await page.locator('[data-thuy-mode=progress]').click();
  await page.locator(`[data-student="${A}"]`).click();await page.locator('#draftDialog').waitFor();
  assert.equal(await page.locator('#draftDialog [data-keyword=w2]').getAttribute('aria-pressed'),'true');
  const panelTop=await page.locator('#draftDialog').evaluate(e=>e.getBoundingClientRect().top);
  assert.ok(panelTop>=68,'Khung chi tiết phải nằm dưới thanh đầu trang');
  const draft=page.locator('#draftDialog .session-comment-editor textarea');await draft.fill('Nháp riêng của A');
  await page.locator('#thuyNextStudent').click();assert.match(await page.locator('#draftStudentName').innerText(),/Học viên B/);assert.equal(await draft.inputValue(),'');
  await page.locator('#thuyPreviousStudent').click();assert.equal(await draft.inputValue(),'Nháp riêng của A');assert.equal(writes.length,0);
  await page.locator(`[data-student="${B}"]`).click();assert.equal(await page.locator('#draftDialog').isVisible(),true);assert.match(await page.locator('#draftStudentName').innerText(),/Học viên B/);
  await page.locator(`[data-student="${A}"]`).click();await page.locator('#draftDialog .session-comment-editor').getByRole('button',{name:'Lưu và hiển thị với học viên',exact:true}).click();
  await page.getByText('Đã lưu. Học viên đọc được khi mở hoặc làm mới hành trình.',{exact:true}).waitFor();assert.equal(comments.get(A).noteText,'Nháp riêng của A');assert.equal(writes.length,1);
  await draft.fill('Sửa chưa công bố');await page.keyboard.press('Escape');assert.equal(await page.locator('#draftDialog').isVisible(),false);assert.equal(comments.get(A).noteText,'Nháp riêng của A');
  await page.locator(`[data-student="${A}"]`).click();assert.equal(await draft.inputValue(),'Sửa chưa công bố');
  await page.locator('#dashboardTitle').click();assert.equal(await page.locator('#draftDialog').isVisible(),false);
  await page.locator(`[data-student="${A}"]`).click();await page.locator('#draftDialog button[aria-label="Đóng chi tiết"]').click();assert.equal(await page.locator('#draftDialog').isVisible(),false);
  await page.reload();await page.locator('.thuy-roster tbody tr').first().waitFor();await page.locator(`[data-student="${A}"]`).click();assert.equal(await draft.inputValue(),'Sửa chưa công bố');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.THUY_EVIDENCE_DIR){await mkdir(process.env.THUY_EVIDENCE_DIR,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(process.env.THUY_EVIDENCE_DIR,'teacher-panel.png'),fullPage:true});}
  await page.keyboard.press('Escape');await page.locator('#overviewTab').click();await page.locator('#courseOverview .thuy-skill-tabs').waitFor();
  await page.locator('#courseOverview .thuy-skill-tabs').getByRole('button',{name:'Writing',exact:true}).click();
  assert.equal(await page.locator('#courseOverview tbody tr').count(),2);
  await page.locator('#courseOverview tbody tr').first().getByRole('button',{name:'Học viên A',exact:true}).click();
  assert.equal(await page.locator('#journeyDetailDialog .thuy-four-skills>.card').count(),4);
  if(process.env.THUY_EVIDENCE_DIR){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(process.env.THUY_EVIDENCE_DIR,'teacher-course.png'),fullPage:true});}
  await page.keyboard.press('Escape');await page.locator('#createTab').click();
  assert.equal(await page.locator('.thuy-side .active').count(),1,'Chỉ một mục quản lý được chọn');
  await page.getByRole('heading',{name:'Quản lý bài tập',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).isVisible(),true);
  assert.equal(await page.getByRole('heading',{name:'Soạn và duyệt phiếu học tập',exact:true}).isVisible(),false,'Bộ soạn không trộn vào màn danh sách');
  assert.equal(await page.getByRole('searchbox',{name:'Tìm bài tập',exact:true}).isVisible(),true);
  const geometry=await page.evaluate(()=>({side:document.querySelector('.thuy-side').getBoundingClientRect().width,header:document.querySelector('.teacher-header').getBoundingClientRect().height,search:document.querySelector('.thuy-library-tools input').getBoundingClientRect().width}));
  assert.equal(geometry.side,200);assert.equal(geometry.header,52);assert.equal(geometry.search,380);
  assert.equal(await page.locator('.thuy-side').getByRole('button',{name:'Quản lý lớp',exact:true}).isVisible(),true);
  if(process.env.THUY_EVIDENCE_DIR){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(process.env.THUY_EVIDENCE_DIR,'teacher-library.png'),fullPage:true});}
  await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();
  await page.getByLabel('Tên bài tập',{exact:true}).waitFor();
  assert.equal(await page.locator('.thuy-editor-info').isVisible(),true);
  await page.getByRole('button',{name:'+ Trắc nghiệm',exact:true}).click();
  await page.getByLabel('Đáp án đúng A câu 1',{exact:true}).check();
  assert.equal(await page.getByLabel('Đáp án đúng A câu 1',{exact:true}).getAttribute('type'),'radio');
  await page.getByRole('button',{name:'+ Chọn nhiều đáp án',exact:true}).click();
  await page.getByLabel('Đáp án đúng A câu 2',{exact:true}).check();await page.getByLabel('Đáp án đúng B câu 2',{exact:true}).check();
  assert.equal(await page.getByLabel('Đáp án đúng A câu 2',{exact:true}).getAttribute('type'),'checkbox');
  await page.getByRole('button',{name:'Chia phần',exact:true}).click();
  assert.equal(await page.locator('.thuy-editor-section').count(),2);
  await page.getByLabel('Phần câu 2',{exact:true}).selectOption({label:'Bài học hôm nay'});
  await page.getByRole('button',{name:'Không chia phần',exact:true}).click();await page.getByText('Chuyển các câu về phần đầu trước khi bỏ các phần còn lại.',{exact:true}).waitFor();
  assert.equal(await page.locator('.thuy-editor-section').count(),2);
  if(process.env.THUY_EVIDENCE_DIR){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(process.env.THUY_EVIDENCE_DIR,'teacher-editor.png'),fullPage:true});}
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await ctx.close();await browser.close();await new Promise(done=>server.close(done));}
});
