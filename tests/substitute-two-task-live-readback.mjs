// Chỉ mở lại đúng lượt DEMO đã chấm. Không nộp bài, gọi AI hoặc ghi Portal.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const folder=path.resolve(process.argv[2]||'');assert.ok(folder.startsWith(path.resolve(process.env.LOCALAPPDATA,'IZONE','SubstituteTestBackups')+path.sep));
const receipt=JSON.parse(fs.readFileSync(path.join(folder,'receipt.json')));assert.equal(receipt.classCode,'DEMO');assert.equal(receipt.testSlug,'substitute-test-2-k67');assert.equal(receipt.fullFinalStored,true);
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.argv.includes('--online')?'https://tranhoangduc90.github.io/izone-ai-team-pages':'http://127.0.0.1:'+server.address().port;
const {chromium}=createRequire('C:/Users/vukha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),out=path.join(root,'output/playwright/substitute-two-task-live');fs.mkdirSync(out,{recursive:true});let reads=0;
try{for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const context=await browser.newContext({viewport}),blockedWrites=[],errors=[];
 await context.route('**/*',async route=>{const req=route.request(),url=req.url();
  if(url.startsWith(base)){
   if(process.argv.includes('--candidate')){
    const relative=new URL(url).pathname.replace('/izone-ai-team-pages/','');
    if(['term-tests/substitute-test-2-k67-computer-based/','term-tests/substitute-test-2-k67-computer-based/index.html','term-tests/substitute-test-2-k67-computer-based/bootstrap.js','term-tests/substitute-shared/state.js','term-tests/substitute-k67-shared/app.js'].includes(relative)){
     return route.fulfill({contentType:relative.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(root,relative+(relative.endsWith('/')?'index.html':'')))});
    }
   }return route.continue();
  }
  if(url==='https://ducizone.ddns.net/webhook/substitute-test-2-k67-public-api'&&req.method()==='POST'){
   let envelope;try{envelope=req.postDataJSON();}catch{return route.abort();}
   if(['/api/test/history','/api/test/roster','/api/test/writing/status'].includes(envelope.route?.split('?')[0])){reads++;return route.continue();}
   blockedWrites.push(envelope.route);return route.abort();
  }return route.abort();
 });
 await context.addInitScript(r=>{
  const b={version:2,testSlug:r.testSlug,historyEpoch:r.historyEpoch,classCode:r.classCode,studentRef:r.studentRef,clientRunId:r.clientRunId,attemptToken:r.attemptToken,examVersion:r.examVersion,writingSessionId:r.writingSessionId};
  const identity={...b,_substitute:b,studentName:'Học viên Demo 01',identityConfirmed:true,listeningStartedAt:r.startedAt,listeningDeadlineAt:r.startedAt};
  const prefix='izone-test:'+r.testSlug+':';
  sessionStorage.setItem(prefix+'RETAKE-LOBBY:server-grade:state-v2:'+r.historyEpoch+':lobby',JSON.stringify(identity));
  // Điểm Listening/Reading chưa đọc: để null, không dựng điểm mặc định.
  const unknown={correct:null,total:40,details:[],typeStats:[]};
  sessionStorage.setItem(prefix+r.classCode+':server-grade:state-v2:'+r.historyEpoch+':'+r.studentRef+':'+r.clientRunId,JSON.stringify({...identity,completed:true,writingSubmitted:true,writingStarted:true,writingStartedAt:r.startedAt,testGrades:{listening:unknown,reading:unknown,writing:null},drafts:{listening:{},reading:{},writing:{task1:'',task2:'',outlines:{}}}}));
 },receipt);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/term-tests/substitute-test-2-k67-computer-based/?demo=exam&grading=server&class=DEMO');
 try{await page.locator('#resultView').waitFor({state:'visible',timeout:45000});}catch(error){
  console.log(JSON.stringify({phase:'open_result',errors,blockedWrites,notice:await page.locator('#bootstrapNotice').textContent({timeout:1000}).catch(()=>null),stateReady:await page.evaluate(()=>!!window.SUBSTITUTE_STATE?.meta),bootstrapReady:await page.evaluate(()=>!!window.TERM_TEST_BOOTSTRAP)}));throw error;
 }
 await page.waitForFunction(()=>document.querySelector('.writing-score-card.is-overall')?.textContent.includes('Band 7.5'),{},{timeout:45000});
 const cards=await page.locator('.writing-score-card.is-action').allTextContents();assert.equal(cards.length,2);
 assert.match(cards[0],/^Writing Task 1Band 6\.5/);assert.match(cards[1],/^Writing Task 2Band 8/);
 await page.locator('.writing-score-card.is-action').nth(0).click();await page.locator('.writing-feedback-dialog').waitFor({state:'visible'});
 await page.screenshot({path:path.join(out,'task1-report-'+viewport.width+'.png'),fullPage:true});
 await page.keyboard.press('Escape');await page.locator('.writing-feedback-dialog').waitFor({state:'hidden'});
 await page.screenshot({path:path.join(out,'result-'+viewport.width+'.png'),fullPage:true});
 // Tải lại lần nữa phải mở đúng kết quả, không quay về phòng chờ hoặc chấm lại.
 await page.reload();await page.locator('#resultView').waitFor({state:'visible',timeout:45000});await page.waitForFunction(()=>document.querySelector('.writing-score-card.is-overall')?.textContent.includes('Band 7.5'),{},{timeout:45000});
 assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[]);await context.close();
}console.log(JSON.stringify({ok:true,online:process.argv.includes('--online'),desktopMobile:true,actualBackendFinal:true,reloadSameAttempt:true,writingScore:receipt.writingScore,readRequests:reads,aiCalls:0,portalWrites:0,screenshots:out}));}
finally{await browser.close();await new Promise(r=>server.close(r));}
