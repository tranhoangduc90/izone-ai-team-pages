// Giao diện thật; media/API giả, không AI và không ghi Portal.
import {createServer} from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
if(!process.env.SUBSTITUTE_TIMER_ROOT)throw Error('Cần SUBSTITUTE_TIMER_ROOT trỏ vào source đầy đủ.');
const root=path.resolve(process.env.SUBSTITUTE_TIMER_ROOT);
if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Cần đường dẫn Playwright đã cài.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const server=createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{const file=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
 for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'])for(const caseName of ['full-storage','clock-backward','reading-full-storage','writing-full-storage']){
  const context=await browser.newContext({serviceWorkers:'block'}),sessions=new Map(),grades=[],writingCalls=[];let page,offlineEnd=false,fixtureNow=Date.parse('2026-10-28T10:00:00Z');
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
    }else if(api==='/api/test/writing'){writingCalls.push(payload);response={accepted:true,grading:{ready:false,status:'pending'},portalSync:{status:'not_applicable'}};
    }else if(api==='/api/test/grade'){
     grades.push(payload);if(caseName==='clock-backward')return route.abort();const total=payload.examId==='reading'&&slug==='substitute-test-1-k56'?26:40;
     response={persisted:true,snapshotHash:'a'.repeat(64),submittedAt:new Date(fixtureNow).toISOString(),
      section:{correct:0,total,band:0,typeStats:[],details:Array.from({length:total},(_,i)=>({number:i+1,studentAnswer:'',correctAnswer:'Fixture',result:'blank'}))}};
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
   }
   if(/\.mp3(?:\?|$)|googleusercontent|drive\.google|audio/.test(url))return route.fulfill({status:200,body:Buffer.alloc(64),contentType:'audio/mpeg'});
   return route.abort();
  });

  const errors=[];let observed={};
  try{
   page=await context.newPage();page.setDefaultTimeout(8000);
   await page.clock.install({time:new Date(fixtureNow)});
   await page.clock.pauseAt(new Date(fixtureNow+1000));fixtureNow+=1000;
   page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/term-tests/'+slug+'-computer-based/?demo=exam&grading=server&class=DEMO');
   await page.locator('#bootstrapClass').selectOption('DEMO');
   await page.locator('#bootstrapStudent option:not([value=""])').first().waitFor({state:'attached'});
   const ref=await page.locator('#bootstrapStudent option:not([value=""])').first().getAttribute('value');
   await page.locator('#bootstrapStudent').selectOption(ref);await page.locator('#confirmIdentity').click();
   await page.locator('#bootstrapPreview:enabled').click();await page.locator('#bootstrapStart:enabled').click();
   await page.locator('#listeningView').waitFor({state:'visible'});
   await page.locator('input[name="question-1"]').first().fill('Fictional original answer');
   if(caseName==='reading-full-storage'||caseName==='writing-full-storage'){
    await page.locator('#submitListening').click();await page.locator('#listeningView').waitFor({state:'hidden'});
    if(caseName==='reading-full-storage')await page.evaluate(()=>{
     Storage.prototype.setItem=function(){throw new DOMException('Controlled full-storage fixture','QuotaExceededError');};
    });
    await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
    if(caseName==='reading-full-storage'){
     const durationMs=await page.evaluate(()=>(Number(window.TERM_TEST_CONFIG.reading.durationMinutes)||40)*60000);
     fixtureNow+=durationMs+1000;await page.clock.fastForward(durationMs+1000);
     for(let n=0;n<30&&grades.filter(row=>row.examId==='reading').length<1;n++)await new Promise(resolve=>setTimeout(resolve,25));
     observed={readingGradeCalls:grades.filter(row=>row.examId==='reading').length,readingVisible:await page.locator('#readingView').isVisible(),elapsedMs:durationMs+1000};
     assert.equal(observed.readingGradeCalls,1,'Storage đầy: Reading hết giờ phải tự thu đúng một lần');
     await page.locator('#readingView').waitFor({state:'hidden'});
    }else{
     await page.locator('#submitReading').click();await page.locator('#readingView').waitFor({state:'hidden'});
     await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Controlled full-storage fixture','QuotaExceededError');};});
     await page.locator('#startWriting').click();await page.locator('#writingView').waitFor({state:'visible'});
     await page.evaluate(()=>{for(const editor of document.querySelectorAll('textarea[data-writing-task]')){editor.value='Fictional original essay. '.repeat(90);editor.dispatchEvent(new Event('input',{bubbles:true}));}});
     const durationMs=await page.evaluate(()=>(Number(window.TERM_TEST_CONFIG.writing?.durationMinutes)||55)*60000);
     fixtureNow+=durationMs+1000;await page.clock.fastForward(durationMs+1000);
     for(let n=0;n<30&&writingCalls.length<1;n++)await new Promise(resolve=>setTimeout(resolve,25));
     observed={writingCalls:writingCalls.length,writingVisible:await page.locator('#writingView').isVisible(),elapsedMs:durationMs+1000};
     assert.equal(writingCalls.length,1,'Storage đầy: Writing hết giờ phải tự thu đúng một lần');
     const required=slug==='substitute-test-2-k56'?['task1']:slug==='substitute-test-2-k67'?['task1','task2']:['task2'];
     for(const task of required)assert.match(writingCalls[0][task],/Fictional original essay/,'Phải giữ bài của đúng '+task);
     await page.locator('#writingView').waitFor({state:'hidden'});
    }
   }else{
   if(caseName==='full-storage')await page.evaluate(()=>{
    Storage.prototype.setItem=function(){throw new DOMException('Controlled full-storage fixture','QuotaExceededError');};
   });
   const endConfirmed=page.waitForResponse(r=>r.request().postData()?.includes('/api/test/exam/audio-ended'));
   await page.evaluate(()=>{const a=window.TERM_TEST_BOOTSTRAP.officialAudioElement;a.currentTime=a.duration;a._fixtureEnded=true;a.dispatchEvent(new Event('ended'));});
   await endConfirmed;
   assert.equal(Array.from(sessions.values())[0].listeningDeadlineAt,new Date(fixtureNow+300000).toISOString());
   if(caseName==='full-storage'){
    fixtureNow+=301000;await page.clock.fastForward(301000);
    // Native network callbacks may settle after fake time has finished advancing.
    for(let n=0;n<30&&grades.length<1;n++)await new Promise(resolve=>setTimeout(resolve,25));
    observed={gradeCalls:grades.length,listeningVisible:await page.locator('#listeningView').isVisible(),
     answerDisabled:await page.locator('input[name="question-1"]').first().isDisabled()};
    assert.equal(grades.length,1,'Storage đầy: +301s phải tự thu Listening đúng một lần');
    await page.locator('#listeningView').waitFor({state:'hidden'});
    assert.equal(grades[0].answers['1'],'Fictional original answer');
   }else{
    const firstFailed=page.waitForEvent('requestfailed',r=>r.postData()?.includes('/api/test/grade'));
    fixtureNow+=300000;await page.clock.fastForward(300000);await firstFailed;
    await page.waitForFunction(()=>document.querySelector('#listeningView').dataset.listeningSubmitting!=='true');
    assert.equal(grades.length,1);
    await page.clock.setSystemTime(new Date(fixtureNow-3600000));
    fixtureNow+=20000;await page.clock.fastForward(20000);
    for(let n=0;n<30&&grades.length<2;n++)await new Promise(resolve=>setTimeout(resolve,25));
    observed={gradeCalls:grades.length,serverElapsedSinceFirstAttemptMs:20000,wallRollbackMs:3600000,
      answerDisabled:await page.locator('input[name="question-1"]').first().isDisabled()};
    assert.equal(grades.length,2,'OS lùi một giờ: +20s phải có lần thử nộp thứ hai');
    assert.equal(observed.answerDisabled,true,'Retry không được mở khóa đáp án đã hết giờ');
    assert.deepEqual(grades[0].answers,grades[1].answers,'Retry phải giữ cùng snapshot đáp án');
   }
   }
   assert.deepEqual(errors,[]);
   results.push({slug,caseName,status:'passed',observed});
  }catch(error){results.push({slug,caseName,status:'failed',message:error.message,observed,pageErrors:errors});}
  finally{console.log(JSON.stringify(results.at(-1)));await context.unrouteAll({behavior:'ignoreErrors'});await context.close();}
 }
 const report={sourceRoot:root,ok:results.every(row=>row.status==='passed'),results,externalRequests:'intercepted-before-navigation',aiCalls:0,portalWrites:0};
 fs.writeFileSync(process.env.SUBSTITUTE_TIMER_EVIDENCE||new URL('timer-regression-results.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;

}finally{await browser.close();await new Promise(r=>server.close(r));}
