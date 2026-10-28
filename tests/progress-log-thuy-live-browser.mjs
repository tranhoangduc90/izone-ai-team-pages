// Đi trọn giao diện mới với API giả có trạng thái. Mọi mạng ngoài đều bị chặn; không nộp vào lớp thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const uid=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=uid(1),B=uid(2),assignmentId=uid(3),block1=uid(4),block2=uid(5),wordItem=uid(6),scanId=uid(7),skimId=uid(8);
const base={itemFamilyId:uid(20),required:true,maxScore:0,graderType:'none',skillCodes:['reading'],helpText:'',options:[],interactionConfig:{}};
const definition={schemaVersion:'FormDefinitionV1',formVersionId:uid(9),title:'Phiếu kiểm giao diện mới',kind:'mixed',answerReleasePolicy:'hidden',blocks:[
 {blockId:block1,checkpoint:1,title:'Listening · Từ khóa',instructions:'Gạch chân từ quan trọng.',items:[{...base,itemVersionId:wordItem,position:1,displayNumber:'1',prompt:'Câu 1 · Câu hỏi',interactionType:'multi_choice_group',layoutType:'keyword_selection',
  options:[{id:'w1',label:'test'},{id:'w2',label:'test'},{id:'w3',label:'again?'}],interactionConfig:{maxSelections:2}},...['A','B','C'].map((letter,index)=>({...base,itemVersionId:uid(80+index),position:2+index,displayNumber:'1'+letter,prompt:'Câu 1 · '+letter,interactionType:'multi_choice_group',layoutType:'keyword_selection',options:[{id:letter+'1',label:'other'},{id:letter+'2',label:'words'}],interactionConfig:{maxSelections:2}}))]},
 {blockId:block2,checkpoint:2,kind:'survey',title:'Reading · Bảng so sánh',instructions:'Điền bảng.',items:[
 {...base,itemVersionId:scanId,position:2,prompt:'Scanning',interactionType:'short_text',layoutType:'numbered_short_texts',groupId:'comparison-reading',interactionConfig:{responseCount:2,sentenceLines:[{title:'Mục tiêu',parts:['Tìm ',' và ','.']},{title:'Dạng bài áp dụng',parts:['Câu có sẵn.']}]}},
 {...base,itemVersionId:skimId,position:3,prompt:'Skimming',interactionType:'short_text',layoutType:'numbered_short_texts',groupId:'comparison-reading',interactionConfig:{responseCount:2,sentenceLines:[{title:'Mục tiêu',parts:['Hiểu ',' trong ','.']},{title:'Dạng bài áp dụng',parts:['Dòng nguồn giữ nguyên.']}] }},
 {...base,itemVersionId:uid(90),position:9,displayNumber:'2',prompt:'Em muốn luyện thêm điều gì?',interactionType:'single_choice',layoutType:'choice_cards',skillCodes:['speaking'],options:[{id:'A',label:'Phát triển ý và diễn đạt câu trả lời dài, rõ ràng hơn trong buổi luyện nói'},{id:'B',label:'Phát âm và trọng âm'}]}]}]};

test('Bản Thủy thật: gạch chân, bảng điền, nháp riêng, nộp độc lập, tự hoàn tất và xem lại không tạo lượt',{timeout:120000},async()=>{
 const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');const file=resolve(root,'.'+u.pathname);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',{'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 const states=new Map(),requests=[],errors=[],unexpected=[];let failSave=false,closed=false,journeyFailure=false;
 const person=ref=>({studentRef:ref,name:ref===A?'Học viên A':'Học viên B'});
 const state=ref=>{if(!states.has(ref))states.set(ref,{draft:{},rev:0,checkpoints:[],final:false,attemptToken:ref===A?uid(30):uid(31)});return states.get(ref);};
 const owner=token=>token===uid(30)?A:B;
 const window=()=>({canSubmit:!closed,reason:closed?'manual_cutoff':null,completeStudents:0,serverNow:new Date().toISOString(),effectiveClosesAt:null});
 const result=s=>({answerRelease:'hidden',summary:{maxScore:0},items:definition.blocks.flatMap(b=>b.items).map(i=>({itemVersionId:i.itemVersionId,rawAnswer:s.draft[i.itemVersionId]??null,maxScore:0,verdict:'ungraded'}))});
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());let body;try{body=req.postDataJSON();}catch{}
  const send=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(u.pathname==='/progress-log/config.js')return route.fulfill({contentType:'text/javascript',body:`window.PROGRESS_LOG_CONFIG={API_BASE_URL:${JSON.stringify(origin)},THUY_PILOT_CLASS_IDS:['1294'],STUDENT_MEMORY:{enabled:true,allClasses:true}};`});
  if(u.pathname.endsWith('/api/student-identity/resolve'))return send({ok:true,status:'unique',identity:{authority:'erp-contact',id:body.studentRef===B?'900002':'900001'},aliases:[{classId:'1294',classCode:'IC2305',studentRef:body.identity?.id==='900002'||body.studentRef===B?B:A,studentName:'Học viên'}]});
  if(u.origin!==origin){unexpected.push(u.origin);return route.abort();}
  if(!u.pathname.startsWith('/api/learning/'))return route.continue();
  const path=u.pathname.slice('/api/learning'.length);requests.push({path,body});
  if(path==='/assignments/open')return send({ok:true,assignment:{assignmentId,publicToken:assignmentId,class:{id:'1294',name:'IC2305'},courseCode:'56',sessionNumber:11,definition,definitionHash:'a'.repeat(64),roster:[person(A),person(B)],blockReleases:[{blockId:block1,status:'open'},{blockId:block2,status:'open'}],submissionWindow:window()}});
  if(path==='/student/course-journey'){if(journeyFailure==='denied')return send({ok:false,message:'Quyền đọc đã bị thu hồi'},403);if(journeyFailure)return send({ok:false,message:'Nguồn danh sách tạm lỗi'},503);return send({ok:true,journey:{student:person(body.studentRef),class:{classId:'1294',name:'IC2305'},summary:{totalSessions:11,submittedComplete:0,attendedSessions:0,availableReports:0},sessions:[{assignmentId,publicToken:assignmentId,sessionNumber:11,sessionDate:'2026-01-01',title:definition.title,assignmentStatus:'published',submissionWindow:window(),completeness:state(body.studentRef).final?'incomplete':null}],reports:[]}});}
  if(path==='/student/course-session-detail'){
   const s=state(body.studentRef);if(!s.final)return send({ok:false,error:'JOURNEY_SUBMISSION_NOT_READY',message:'Buổi này chưa có bài nộp cuối'},409);
   return send({ok:true,detail:{classId:'1294',sessionNumber:11,student:person(body.studentRef),submissionId:uid(40),definition,responses:s.draft,gradingItems:result(s).items.map(item=>item.itemVersionId===uid(90)?{...item,expectedAnswer:['Tham khảo sau khi mở lại']}:item),status:'incomplete'}});
  }
  if(path==='/attempts/start'){
   const s=state(body.studentRef);return send({ok:true,attempt:{attemptToken:s.attemptToken,assignmentId,definitionHash:'a'.repeat(64),draft:s.draft,draftRevision:s.rev,checkpointSubmissions:s.checkpoints,
    identity:{studentRef:body.studentRef,studentName:person(body.studentRef).name,classId:'1294',className:'IC2305',sessionNumber:11}}});
  }
  if(path==='/attempts/draft'){
   if(failSave)return send({ok:false,message:'Lỗi lưu giả'},503);
   const s=state(owner(body.attemptToken));s.draft=structuredClone(body.responses);s.rev=body.revision;return send({ok:true,draft:{revision:s.rev}});
  }
  if(path==='/attempts/checkpoints/submit'){
   const s=state(owner(body.attemptToken));let cp=s.checkpoints.find(c=>c.blockId===body.blockId);if(!cp){cp={blockId:body.blockId,checkpoint:body.checkpoint,checkpointSubmissionId:body.checkpointSubmissionId,attendance:{status:'self_confirmed'},result:result(s)};s.checkpoints.push(cp);}return send({ok:true,checkpointSubmission:cp},201);
  }
  if(path==='/attempts/submit'){const s=state(owner(body.attemptToken));assert.equal(s.checkpoints.length,2);s.final=true;return send({ok:true,receipt:{message:'Đã nhận',completeness:'incomplete',attendanceStatus:'self_confirmed'},result:result(s),submissionWindow:window()});}
  if(path==='/attempts/result'){const s=state(owner(body.attemptToken));return s.final?send({ok:true,receipt:{message:'Đã nhận',completeness:'incomplete',attendanceStatus:'self_confirmed'},result:result(s)}):send({ok:false,error:'RESULT_NOT_READY',message:'Chưa hoàn tất'},409);}
  if(path==='/student/session-comments')return send({ok:true,classId:'1294',studentRef:body.studentRef||owner(body.attemptToken),comments:[]});
  unexpected.push(path);return send({ok:false,message:'Ngoài phạm vi fixture'},503);
 });
 ctx.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);});
 let page=await ctx.newPage();await page.clock.install();const url=origin+'/progress-log/index.html#assignment='+assignmentId;
 async function openManual(ref=A){await page.goto(url);await page.locator('#studentSelect').selectOption(ref);await page.locator('#chooseStudentButton').click();await page.locator('#confirmButton').click();await page.locator('#formView').waitFor();}
 try{
  await openManual();assert.equal(requests.filter(r=>r.path.includes('/submit')).length,0);
  await page.locator('#studentDashboardSessions').getByRole('heading',{name:'Tất cả buổi học',exact:true}).waitFor();
  await page.locator('#studentDashboardLatest [data-session-number="11"]').waitFor();assert.equal(await page.locator('#journeyView').isVisible(),false);
  await page.locator('#thuyLessonNav').click();assert.equal(await page.locator('#formView').isVisible(),true);assert.equal(await page.locator('#confirmView').isVisible(),false);
  journeyFailure='denied';await page.clock.fastForward(31_000);await page.locator('#studentDashboardLatest').getByText(/Quyền đọc đã bị thu hồi/).waitFor();
  assert.equal(await page.locator('#reflectionForm').isVisible(),false);await page.locator('#thuyLessonNav').click();assert.equal(await page.locator('#reflectionForm').isVisible(),false);
  journeyFailure=false;await page.locator('#studentDashboardLatest').getByRole('button',{name:'Thử lại',exact:true}).click();await page.locator('.thuy-part').first().waitFor();
  await page.locator(`[data-part="${block1}"]`).getByRole('button',{name:'Bắt đầu làm',exact:true}).click();
  assert.equal(await page.locator('.thuy-keyword-question>.thuy-question-heading').innerText(),'Câu 1','Số câu phải hiển thị riêng khỏi nội dung');
  assert.deepEqual(await page.locator('.thuy-keyword-subitem h3').allTextContents(),['Câu hỏi','A','B','C']);
  assert.equal(await page.locator('.thuy-keyword-subitem').count(),4);
  await page.locator('[data-keyword=w2]').click();assert.equal(await page.locator('[data-keyword=w1]').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('[data-keyword=w2]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-keyword=w3]').focus();await page.keyboard.press('Space');assert.equal(await page.locator('[data-keyword=w3]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-keyword=w1]').click();assert.equal(await page.locator('[data-keyword=w1]').getAttribute('aria-pressed'),'false');await page.getByRole('status').filter({hasText:'Mỗi câu chọn tối đa 2 từ'}).waitFor();
  await page.locator('[data-keyword=w2]').click();assert.equal(await page.locator('[data-keyword=w2]').getAttribute('aria-pressed'),'false');
  await page.locator(`[data-part="${block2}"]`).getByRole('button',{name:'Bắt đầu làm',exact:true}).click();assert.equal(await page.locator('.thuy-comparison textarea').count(),4);
  await page.locator('.thuy-comparison textarea').nth(0).fill('Nháp A giữ đủ dấu');
  // Phương án là nội dung form học viên: phải đủ 16/24px theo preset, kể cả khi xuống dòng trên điện thoại.
  const speaking=page.locator(`[data-item-version-id="${uid(90)}"]`);
  for(const width of [1440,768,390]){
   await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(process.env.THUY_EVIDENCE_DIR){await mkdir(process.env.THUY_EVIDENCE_DIR,{recursive:true});await speaking.screenshot({path:resolve(process.env.THUY_EVIDENCE_DIR,`speaking-choice-${width}.png`)});}
   const typography=await speaking.locator('.choice-text').first().evaluate(el=>({size:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight}));
   assert.deepEqual(typography,{size:'16px',line:'24px'},'Phương án Speaking phải đúng preset form học viên 16/24px');
   assert.ok(await speaking.locator('.choice').first().evaluate(el=>el.getBoundingClientRect().height>=48));
  }
  await speaking.locator('input[value=B]').check();assert.equal(await speaking.locator('input[value=B]').isChecked(),true);
  await page.setViewportSize({width:1440,height:1000});
  failSave=true;await page.getByRole('button',{name:'Đổi người học',exact:true}).click();await page.locator('#notice').filter({hasText:'Chưa lưu xong'}).waitFor();
  assert.match(await page.locator('#studentNameLabel').innerText(),/Học viên A/);assert.equal(await page.locator('#thuyRetrySave').isVisible(),true);
  failSave=false;await page.locator('#thuyRetrySave').click();await page.locator('#saveState').filter({hasText:'Đã lưu'}).waitFor();
  await page.getByRole('button',{name:'Đổi người học',exact:true}).click();await page.locator('#studentSelect').selectOption(B);await page.locator('#chooseStudentButton').click();await page.locator('#confirmButton').click();
  await page.locator(`[data-part="${block2}"]`).getByRole('button',{name:'Bắt đầu làm',exact:true}).click();assert.equal(await page.locator('.thuy-comparison textarea').nth(0).inputValue(),'');
  await page.getByRole('button',{name:'Đổi người học',exact:true}).click();await page.locator('#studentSelect').selectOption(A);await page.locator('#chooseStudentButton').click();await page.locator('#confirmButton').click();
  await page.locator(`[data-part="${block2}"]`).getByRole('button',{name:'Tiếp tục làm',exact:true}).click();assert.equal(await page.locator('.thuy-comparison textarea').nth(0).inputValue(),'Nháp A giữ đủ dấu');
  await page.locator(`[data-part="${block2}"]`).getByRole('button',{name:'Nộp phần này',exact:true}).click();await page.getByText('Đã nộp 1/2 phần',{exact:true}).waitFor();assert.equal(state(A).final,false);assert.equal(await page.locator('.thuy-comparison textarea').nth(0).isDisabled(),true);
  await page.locator(`[data-part="${block1}"]`).getByRole('button',{name:'Tiếp tục làm',exact:true}).click();assert.equal(await page.locator('[data-keyword=w3]').getAttribute('aria-pressed'),'true');
  await page.locator(`[data-part="${block1}"]`).getByRole('button',{name:'Nộp phần này',exact:true}).click();await page.getByText('Đã nộp 2/2 phần',{exact:true}).waitFor();assert.equal(state(A).final,true);
  assert.equal(await page.locator('#submitButton').isVisible(),false);assert.equal(requests.filter(r=>r.path==='/attempts/submit').length,1);
  const starts=requests.filter(r=>r.path==='/attempts/start').length;await page.close();page=await ctx.newPage();await page.goto(url);await page.locator('#formView').waitFor();
  await page.getByText('Phiếu đã nộp · Chỉ đọc',{exact:true}).waitFor();assert.equal(requests.filter(r=>r.path==='/attempts/start').length,starts);
  await page.locator(`[data-part="${block2}"]`).getByRole('button',{name:'Xem bài đã nộp',exact:true}).click();
  await page.getByText('Đáp án tham khảo: Tham khảo sau khi mở lại',{exact:true}).waitFor();
  assert.equal(requests.filter(r=>r.path==='/attempts/submit').length,1);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  if(process.env.THUY_EVIDENCE_DIR){await mkdir(process.env.THUY_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.THUY_EVIDENCE_DIR,'learner-completed.png'),fullPage:true});}
  closed=true;journeyFailure=true;await page.getByRole('button',{name:'Đổi người học',exact:true}).click();await page.reload();
  await page.locator('#studentSelect').selectOption(B);await page.locator('#chooseStudentButton').click();
  await page.getByRole('button',{name:'Đúng là em · xem các buổi học',exact:true}).click();
  await page.locator('#studentDashboardLatest').getByText(/Chưa tải được danh sách: Nguồn danh sách tạm lỗi/).waitFor();
  assert.equal(await page.locator('#reflectionForm').isVisible(),false);assert.match(await page.locator('#studentNameLabel').innerText(),/Học viên B/);
  journeyFailure=false;await page.locator('#studentDashboardLatest').getByRole('button',{name:'Thử lại',exact:true}).click();
  await page.locator('#studentDashboardLatest').getByText('Phiếu đã đóng nhận bài',{exact:true}).waitFor();
  assert.equal(requests.filter(r=>r.path==='/attempts/start').length,starts,'Vẽ dashboard phiếu đóng không tạo lượt làm mới');
  assert.equal(await page.locator('#studentDashboardLatest').getByRole('button',{name:'Mở phiếu',exact:true}).count(),0);
 }finally{await ctx.close();await browser.close();await new Promise(done=>server.close(done));}
});
