// Browser thật + kho SQLite trong RAM. Không kết nối AI, Portal hoặc database production.
import {createServer} from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {createRequire} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const backend=process.env.SUBSTITUTE_BACKEND_ROOT;
// Chế độ nhận diện kiểm UI với biên nhận giả; không giả rằng SQLite cũ là production mới.
const fixture = process.env.SUBSTITUTE_IDENTITY_UI_FIXTURE === 'true';
if(!fixture&&!backend)throw Error('Cần backend đã đối chiếu hoặc chọn fixture UI giả.');
const {SubstituteStore,TESTS,gradingFromReadback}=fixture
 ?await import('./fixtures/substitute-identity-store.mjs')
 :{...(await import(pathToFileURL(path.join(backend,'src/store.mjs')))),
   ...(await import(pathToFileURL(path.join(backend,'src/contract.mjs')))),
   ...(await import(pathToFileURL(path.join(backend,'src/transport-bridge.mjs'))))};
if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Cần đường dẫn Playwright đã cài.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const server=createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{const file=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const slug of Object.keys(TESTS).filter(slug=>!process.env.SUBSTITUTE_TEST_SLUG||slug===process.env.SUBSTITUTE_TEST_SLUG)){
 const store=new SubstituteStore({encryptionKey:randomBytes(32)});store.configureWritingRelease('substitute-test-2-k67','open');
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:slug.endsWith('k67')?390:1440,height:1000}}),errors=[];
 let fault=null,acceptedWriting=0,gradeCalls=0;
 await context.addInitScript(()=>{
  for(const[key,value]of [['duration',1800],['readyState',4]])Object.defineProperty(HTMLMediaElement.prototype,key,{get:()=>value,configurable:true});
  HTMLMediaElement.prototype.play=function(){this._paused=false;this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));return Promise.resolve();};
  HTMLMediaElement.prototype.pause=function(){this._paused=true;};HTMLMediaElement.prototype.load=function(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));};
  Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return this._paused!==false;},configurable:true});
 });
 await context.route('**/*',async route=>{
  const request=route.request(),url=request.url();
  if(/\.(mp3|wav|m4a|ogg|enc)(?:\?|$)/i.test(url))return route.fulfill({status:200,body:Buffer.alloc(64),contentType:'audio/mpeg'});
  if(url.startsWith(base))return route.continue();
  if(/googleusercontent|drive\.google|\/audio/.test(url))return route.fulfill({status:200,body:Buffer.alloc(64),contentType:'audio/mpeg'});
  if(!url.includes('/webhook/'))return route.abort();
  const {route:api,payload={}}=request.postDataJSON(),id={...payload,testSlug:slug};let response={},status=200;
  if(fault&&fault!=='lost-ack'&&['/api/test/grade','/api/test/writing'].includes(api)){
   const value=fault;fault=null;return route.fulfill({status:value==='http'?502:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:value==='empty'?'':JSON.stringify(value==='http'?{ok:false,code:'SUBSTITUTE_SAVE_UNCONFIRMED',message:'Lỗi thử có kiểm soát'}:{accepted:true})});
  }
  try{
   if(api==='/api/test/history')response={...store.historyState(id),examTimingVersion:'substitute-audio-transfer-20261014-v1',classes:[{code:'DEMO',name:'DEMO'}],...(slug==='substitute-test-2-k67'?{writingVersions:{DEMO:'substitute-k67-test2-two-task-20261007-v1'}}:{})};
   else if(api==='/api/test/roster')response={students:[{ref:'fictional-01',name:'Học viên giả'}]};
   else if(api==='/api/test/exam/session')response=store.startExamSession(id);
   else if(api==='/api/test/writing/session')response=store.startWritingSession(id);
   else if(api==='/api/test/exam/section-status')response=store.readSectionSubmission({...id,skill:payload.examId});
   else if(api==='/api/test/grade'){
    gradeCalls++;
    const total=payload.examId==='listening'?40:TESTS[slug].readingMax;
    const section={correct:1,total,band:2.5,typeStats:[{type:'Fixture',correct:1,total,percentage:1/total}],details:Array.from({length:total},(_,i)=>({number:i+1,studentAnswer:String(payload.answers?.[i+1]||''),correctAnswer:'Fixture',result:i===0?'correct':'blank'}))};
    response=store.saveSectionSubmission({...id,clientRunId:payload.examSessionId,skill:payload.examId,section});
    if(fault==='lost-ack'){fault=null;return route.abort();}
   }else if(api==='/api/test/writing'){
    const taskNumber=TESTS[slug].taskNumber,writing={...id,taskNumber,studentName:'Học viên giả',scores:{listening:{raw:1,max:40,band:2.5},reading:{raw:1,max:TESTS[slug].readingMax,band:2.5}},
     ...(payload.examVersion?{tasks:[1,2].map(taskNumber=>({taskNumber,essay:payload['task'+taskNumber]}))}:{essay:payload['task'+taskNumber]})};
    const saved=store.submit(writing);acceptedWriting++;response={accepted:true,grading:gradingFromReadback(saved),portalSync:{status:'not_applicable'}};
   }else if(api==='/api/test/writing/status')response={accepted:true,grading:gradingFromReadback(store.read(id)),portalSync:{status:'not_applicable'}};
   else throw Error('UNEXPECTED_FIXTURE_ROUTE');
  }catch(error){status=error.status||500;response={ok:false,code:error.code||'FIXTURE_FAILED'};}
  return route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
 });
 let cancelSubmit=false;
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>cancelSubmit?d.dismiss():d.accept());
 try{
  await page.goto(base+'/term-tests/'+slug+'-computer-based/?demo=exam&grading=server&class=DEMO');
  await page.locator('#bootstrapClass').selectOption('DEMO');await page.locator('#bootstrapStudent option:not([value=""])').first().waitFor({state:'attached'});
  const selectedStudent=await page.locator('#bootstrapStudent option:not([value=""])').first().getAttribute('value');
  await page.locator('#bootstrapStudent').selectOption(selectedStudent);await page.locator('#confirmIdentity').click();await page.locator('#bootstrapPreview:enabled').click();await page.locator('#bootstrapStart:enabled').click();
  await page.locator('#listeningView').waitFor({state:'visible'});
  // Tái hiện 39/40 câu: câu cuối trống vẫn được nộp sớm sau xác nhận.
  await page.evaluate(()=>{
   for(const field of document.querySelectorAll('#listeningQuestions [data-number]')){
    field.value=Number(field.dataset.number)===40?'':field.tagName==='SELECT'?field.options[1].value:'Fixture';
    field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
   }
  });
  assert.match(await page.locator('#listeningCount').innerText(),/39\/40/);
  // Hủy xác nhận khi còn câu trống phải giữ audio đang chạy và giữ màn làm bài.
  cancelSubmit=true;
  await page.locator('#submitListening').click();
  assert.equal(await page.locator('#listeningView').isVisible(),true);
  assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false,'Hủy nộp không được dừng audio');
  cancelSubmit=false;
  for(const[skill,button]of [['listening','#submitListening'],['reading','#submitReading']]){
   const view=page.locator('#'+skill+'View'),textAnswer=view.locator('input[type="text"]:visible').first();
   const answer=await textAnswer.count()?textAnswer:view.locator('select:visible').first();
   const isSelect=await answer.evaluate(e=>e.tagName==='SELECT');
   if(isSelect)await answer.selectOption({index:1});else await answer.fill('Fixture');
   const originalAnswer=await answer.inputValue();
   for(const failure of ['http','empty','malformed']){
    fault=failure;const response=page.waitForResponse(r=>r.request().postData()?.includes('/api/test/grade'));await page.locator(button).click();await response;
    await page.waitForFunction(selector=>!document.querySelector(selector).disabled,button);
    assert.equal(await view.isVisible(),true);assert.equal(await answer.inputValue(),originalAnswer);
    if(skill==='listening')assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false,'Lưu thất bại không được dừng audio');
   }
   // SQLite đã lưu nhưng phản hồi mất: phải đọc lại, không gửi grade lần thứ hai.
   fault='lost-ack';const beforeCalls=gradeCalls;
   await page.evaluate(skill=>{
    const form=document.querySelector('#'+skill+'View');
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   },skill);
   await view.waitFor({state:'hidden'});
   assert.equal(gradeCalls,beforeCalls+1,'Bấm lặp và mất phản hồi chỉ ghi một lần');
   assert.equal(store.db.prepare('SELECT count(*) n FROM section_submission WHERE skill=?').get(skill).n,1);
   if(skill==='listening'){
    const run=store.db.prepare('SELECT * FROM exam_session').get();
    const saved=store.readSectionSubmission({testSlug:slug,classCode:run.class_code,studentRef:run.student_ref,clientRunId:run.run_id,historyEpoch:run.history_epoch,skill});
    assert.equal(saved.section.details.filter(d=>d.studentAnswer).length,39);
   }
   if(skill==='listening'){assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),true,'Chỉ dừng audio sau xác nhận lưu');assert.equal(store.db.prepare('SELECT audio_ended_at FROM exam_session').get().audio_ended_at,null);await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});}
  }
  await page.locator('#startWriting').click();await page.locator('#writingView').waitFor({state:'visible'});
  const ids=slug==='substitute-test-2-k67'?['task1','task2']:['task'+TESTS[slug].taskNumber];
  for(const [index,task]of ids.entries()){const editor=page.locator(`textarea[data-writing-task="${task}"]`);if(!await editor.isVisible())await page.locator('#writingTaskTabs button').nth(index).click();await editor.fill('Fictional original essay. '.repeat(85));}
  for(const failure of ['http','empty','malformed']){
   fault=failure;const response=page.waitForResponse(r=>r.request().postData()?.includes('/api/test/writing'));await page.locator('#submitWriting').click();await response;
   await page.waitForFunction(()=>document.querySelector('#notice')?.textContent.includes('Writing'));
   assert.equal(await page.locator('#writingView').isVisible(),true);assert.equal(acceptedWriting,0);
  }
  await page.locator('#submitWriting').click();await page.locator('#resultView').waitFor({state:'visible'});
  const summary=await page.locator('#summaryGrid').innerText();assert.match(summary,/Listening/);assert.match(summary,/Reading/);assert.match(summary,/1\/40/);
  assert.equal(await page.locator('#questionDetails details').count(),2);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM attempt').get().n,1);
  await page.reload();await page.locator('#resultView').waitFor({state:'visible'});assert.match(await page.locator('#summaryGrid').innerText(),/1\/40/);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM attempt').get().n,1);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({slug,ok:true,earlyBeforeAudioEnd:true,failuresKeepDrafts:true,lostAckRecovered:true,doubleSubmitNoDuplicate:true,resultsAfterWriting:true,reloadNoDuplicate:true,realAI:false,portalWrites:0}));
 }finally{await context.unrouteAll({behavior:'ignoreErrors'});await context.close();store.close();}
}}finally{await browser.close();await new Promise(r=>server.close(r));}
