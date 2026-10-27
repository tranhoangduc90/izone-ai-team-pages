// Giao diện thật; media/API giả, không AI và không ghi Portal.
import {createServer} from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Cần đường dẫn Playwright đã cài.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const server=createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{const file=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
 for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
  const context=await browser.newContext({serviceWorkers:'block'}),sessions=new Map(),grades=[];let page,offlineEnd=false,fixtureNow=Date.parse('2026-10-14T00:00:00Z');
  await context.addInitScript(()=>{
   // Giữ các sự kiện DOM/media của ứng dụng; không chờ 30 phút audio trong test.
   for(const [key,value]of [['duration',1800],['readyState',4]])Object.defineProperty(HTMLMediaElement.prototype,key,{get:()=>value,configurable:true});
   HTMLMediaElement.prototype.play=function(){this._fixturePaused=false;this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));if(window.__fixtureEndBeforeEnhance){this.currentTime=this.duration;this._fixtureEnded=true;queueMicrotask(()=>this.dispatchEvent(new Event('ended')));}return Promise.resolve();};
   HTMLMediaElement.prototype.pause=function(){this._fixturePaused=true;};
   HTMLMediaElement.prototype.load=function(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));};
   Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return this._fixturePaused!==false;},configurable:true});
   Object.defineProperty(HTMLMediaElement.prototype,'ended',{get(){return this._fixtureEnded===true;},configurable:true});
  });
  await context.route('**/*',async route=>{
   const req=route.request(),url=req.url();
   if(url.startsWith(base+'/shared/audio/transport.mjs'))return route.fulfill({status:200,contentType:'text/javascript',body:'export async function downloadSubstitute(){return null;}'});
   if(/\.(mp3|wav|m4a|ogg|enc)(?:\?|$)/i.test(url))return route.fulfill({status:200,body:Buffer.alloc(64),contentType:'audio/mpeg'});
   if(url.startsWith(base))return route.continue();
   if(url.includes('/webhook/')){
    const {route:api,payload={}}=req.postDataJSON();let response={};
    if(api==='/api/test/history')response={testSlug:slug,serverNow:new Date(fixtureNow).toISOString(),historyEpoch:'11111111-1111-4111-8111-111111111111',stateVersion:2,maintenance:false,examTimingVersion:'substitute-audio-transfer-20261014-v1',...(slug==='substitute-test-2-k67'?{writingVersions:{DEMO:'substitute-k67-test2-two-task-20261007-v1'}}:{}),classes:[{code:'DEMO',name:'DEMO'}]};
    else if(api==='/api/test/roster')response={students:[{ref:'fictional-01',name:'Học viên giả'}]};
    else if(api==='/api/test/writing/session')response={testSlug:slug,classCode:payload.classCode,studentRef:payload.studentRef,clientRunId:payload.clientRunId,historyEpoch:payload.historyEpoch,examVersion:'substitute-k67-test2-two-task-20261007-v1',writingSessionId:payload.clientRunId};
    else if(api==='/api/test/exam/session'){
     if(!sessions.has(payload.clientRunId))sessions.set(payload.clientRunId,{testSlug:slug,classCode:'DEMO',studentRef:payload.studentRef,clientRunId:payload.clientRunId,historyEpoch:payload.historyEpoch,timingVersion:'substitute-audio-transfer-20261014-v1',listeningStartedAt:new Date(fixtureNow).toISOString(),audioEndedAt:'',listeningDeadlineAt:'',transferSeconds:300});
     response={...sessions.get(payload.clientRunId),serverNow:new Date(fixtureNow).toISOString()};
    }else if(api==='/api/test/exam/audio-ended'){
     if(offlineEnd)return route.abort();
     const s=sessions.get(payload.clientRunId);if(!s.audioEndedAt){s.audioEndedAt=payload.audioEndedAt;s.listeningDeadlineAt=new Date(Date.parse(s.audioEndedAt)+300000).toISOString();}
     response={...s,serverNow:new Date(fixtureNow).toISOString()};
    }else if(api==='/api/test/exam/section-status'){
     response={testSlug:slug,classCode:payload.classCode,studentRef:payload.studentRef,clientRunId:payload.clientRunId,historyEpoch:payload.historyEpoch,skill:payload.examId,persisted:false};
    }else if(api==='/api/test/grade'){
     grades.push(payload);const total=payload.examId==='reading'&&slug==='substitute-test-1-k56'?26:40;
     response={persisted:true,snapshotHash:'a'.repeat(64),submittedAt:new Date(fixtureNow).toISOString(),
      section:{correct:0,total,band:0,typeStats:[],details:Array.from({length:total},(_,i)=>({number:i+1,studentAnswer:'',correctAnswer:'Fixture',result:'blank'}))}};
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
   }
   if(/\.mp3(?:\?|$)|googleusercontent|drive\.google|audio/.test(url))return route.fulfill({status:200,body:Buffer.alloc(64),contentType:'audio/mpeg'});
   return route.abort();
  });
  page=await context.newPage();await page.clock.install({time:new Date(fixtureNow)});await page.clock.pauseAt(new Date(fixtureNow));page.on('dialog',d=>d.accept());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const url=base+'/term-tests/'+slug+'-computer-based/?demo=exam&grading=server&class=DEMO';
  await page.goto(url);await page.locator('#bootstrapClass').selectOption('DEMO');
  await page.locator('#bootstrapStudent option:not([value=""])').first().waitFor({state:'attached'});
  const studentRef=await page.locator('#bootstrapStudent option:not([value=""])').first().getAttribute('value');
  await page.locator('#bootstrapStudent').selectOption(studentRef);await page.locator('#confirmIdentity').click();
  await page.locator('#bootstrapPreview:enabled').waitFor();await page.locator('#bootstrapPreview').click();
  assert.equal(sessions.size,0,'Nghe thử không bắt đầu phiên thi/5 phút');
  offlineEnd=true;const failedEnd=page.waitForEvent('requestfailed',r=>r.postData()?.includes('/api/test/exam/audio-ended'));
  await page.evaluate(()=>window.__fixtureEndBeforeEnhance=true);
  await page.locator('#bootstrapStart').click();
  try{await page.locator('#listeningView').waitFor({state:'visible'});}catch(e){console.log(JSON.stringify({slug,notice:await page.locator('#bootstrapNotice').textContent(),errors}));throw e;}
  assert.equal(grades.length,0);assert.equal(sessions.size,1);
  if(slug.endsWith('k56'))assert.equal(await page.locator('.cbt-section-intro h3').first().evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  // end xảy ra trước enhance listeners; không được bỏ sót mốc kết thúc.
  await page.evaluate(()=>{const a=window.TERM_TEST_BOOTSTRAP.officialAudioElement;a.currentTime=a.duration;a.dispatchEvent(new Event('ended'));});
  await failedEnd;await page.evaluate(()=>Promise.resolve());
  fixtureNow+=1000;await page.clock.fastForward(1000);const clock=page.locator('[role="timer"]').filter({hasText:'Điền đáp án'});await clock.waitFor();
  assert.match(await clock.innerText(),/04:59|05:00/);assert.equal(grades.length,0);
  const originalDeadline=new Date(fixtureNow-1000+300000).toISOString();
  assert.equal(Array.from(sessions.values())[0].listeningDeadlineAt,'','Server chưa xác nhận audio-end');
  await page.reload();await page.locator('#bootstrapStart:enabled').waitFor();
  const resumeFailure=page.waitForEvent('requestfailed',r=>r.postData()?.includes('/api/test/exam/audio-ended'));
  await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});await resumeFailure;await page.evaluate(()=>Promise.resolve());
  assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.listeningDeadlineAt),originalDeadline,'Reload offline không cộng lại 5 phút');
  const confirmedEnd=page.waitForResponse(r=>r.request().postData()?.includes('/api/test/exam/audio-ended'));
  offlineEnd=false;fixtureNow+=15000;await page.clock.fastForward(15000);await confirmedEnd;
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role="timer"]')).some(e=>e.textContent.includes('04:4')));
  const before=Array.from(sessions.values())[0].listeningDeadlineAt;assert.equal(before,originalDeadline);
  await page.reload();await page.locator('#bootstrapStart:enabled').waitFor();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
  assert.equal(Array.from(sessions.values())[0].listeningDeadlineAt,before);
  await page.locator('input[name="question-1"]').first().fill('Original answer fixture');
  if(slug==='substitute-test-1-k56'){
   await page.locator('#submitListening').click();await page.locator('#listeningView').waitFor({state:'hidden'});
  }else{
   fixtureNow+=300000;await page.clock.fastForward(300000);await page.locator('#listeningView').waitFor({state:'hidden'});
  }
  assert.equal(grades.length,1);assert.equal(grades[0].answers['1'],'Original answer fixture');assert.equal(grades[0].examSessionId,Array.from(sessions.keys())[0]);
  assert.deepEqual(errors,[]);results.push({slug,previewSeparate:true,transferSeconds:300,reloadNoExtension:true,offlineReloadNoExtension:true,endBeforeEnhanceCaptured:true,offlineEndRecovered:true,submit:slug==='substitute-test-1-k56'?'early':'automatic'});console.log(JSON.stringify({slug,ok:true}));await context.unrouteAll({behavior:'ignoreErrors'});await context.close();
 }
 console.log(JSON.stringify({ok:true,results,aiCalls:0,portalWrites:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
