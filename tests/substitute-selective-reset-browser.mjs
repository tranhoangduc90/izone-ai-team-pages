// Browser thật, danh tính/media/API giả; không tạo lượt thật hoặc gọi AI/Portal.
import fs from'node:fs';import path from'node:path';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
import{serve}from'./helpers/result-details-browser-fixture.mjs';
if(!process.env.PLAYWRIGHT_MODULE||!process.env.SUBSTITUTE_RESET_EVIDENCE)throw Error('Cần Playwright và đường dẫn bằng chứng riêng.');
const{chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),server=await serve(),base=process.argv.includes('--online')?'https://tranhoangduc90.github.io/izone-ai-team-pages/':server.base;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],out=process.env.SUBSTITUTE_RESET_EVIDENCE;fs.mkdirSync(out,{recursive:true});
const epoch='11111111-1111-4111-8111-111111111111',oldRun='22222222-2222-4222-8222-222222222222';
try{for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
 const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'}),errors=[],requests=[],startedAt=new Date().toISOString();
 const invalidatedRunHashes=[createHash('sha256').update(JSON.stringify('substitute-run:'+slug+':'+oldRun)).digest('hex')];
 await context.addInitScript(({slug,epoch,oldRun})=>{
  window.IZONE_EXAM_DEVICE_CHECKED=true;
  for(const[key,value]of [['duration',1800],['readyState',4]])Object.defineProperty(HTMLMediaElement.prototype,key,{get:()=>value,configurable:true});
  HTMLMediaElement.prototype.play=function(){return Promise.resolve();};HTMLMediaElement.prototype.load=function(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));};
  const owner={classCode:'IC9999',studentRef:'fake-student',clientRunId:oldRun,examSessionId:oldRun,attemptToken:''};
  const state={...owner,identityConfirmed:true,studentName:'Học viên giả',listeningStartedAt:'2026-10-21T12:00:00.000Z',listeningDeadlineAt:'2026-10-21T12:35:00.000Z',audioEndedAt:'2026-10-21T12:30:00.000Z',drafts:{listening:{1:'Bài cũ'},reading:{1:'Bài cũ'},writing:{task1:'Bài cũ',task2:'Bài cũ',outline:'Dàn ý cũ'}},_substitute:{...owner,testSlug:slug,historyEpoch:epoch,version:2}};
  const keys=[`izone-test:${slug}:RETAKE-LOBBY:server-grade:state-v2:${epoch}:lobby`,`izone-test:${slug}:IC9999:server-grade:state-v2:${epoch}:fake-student:${oldRun}`,`izone-substitute-lobby-v1:${slug}:${epoch}:IC9999:fake-student`];
  for(const storage of[localStorage,sessionStorage]){
   for(const key of keys)storage.setItem(key,JSON.stringify(state));
   storage.setItem(`izone-test-ui:${slug}:IC9999:server-grade:state-v2:${epoch}:fake-student:${oldRun}`,JSON.stringify({...state,activeSection:{listening:3,reading:1},audioStarted:true,audioTime:1680}));
   storage.setItem(`izone-test-annotations:${slug}:IC9999:server-grade:state-v2:${epoch}:fake-student:${oldRun}`,JSON.stringify({...state,notes:'Ghi chú cũ'}));
  }
 },{slug,epoch,oldRun});
 await context.route('**/*',async route=>{
  const request=route.request(),url=request.url();
  if(url.startsWith(base+'shared/audio/transport.mjs'))return route.fulfill({contentType:'text/javascript',body:'export async function downloadSubstitute(){return null;}'});
  if(/\.(mp3|wav|enc|m4a)(?:\?|$)/.test(url))return route.fulfill({contentType:'audio/mpeg',body:Buffer.alloc(64)});
  if(url.startsWith(base))return route.continue();
  if(!url.includes('/webhook/'))return route.abort();
  const{route:api,payload={}}=request.postDataJSON();requests.push({api,payload});let data;
  if(api==='/api/test/history')data={testSlug:slug,historyEpoch:epoch,stateVersion:2,maintenance:false,serverNow:new Date().toISOString(),invalidatedRunHashes,examTimingVersion:'substitute-audio-transfer-20261014-v1',classes:[{code:'IC9999',name:'Lớp giả'}]};
  else if(api==='/api/test/roster')data={students:[{ref:'fake-student',name:'Học viên giả'}]};
  else if(api==='/api/test/writing/session')data={...payload,testSlug:slug,writingSessionId:payload.clientRunId};
  else if(api==='/api/test/exam/session')data={...payload,testSlug:slug,timingVersion:'substitute-audio-transfer-20261014-v1',listeningStartedAt:startedAt,listeningDeadlineAt:'',audioEndedAt:'',transferSeconds:300,serverNow:new Date().toISOString()};
  else return route.abort();
  return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'term-tests/'+slug+'-computer-based/?class=IC9999&demo=exam&grading=server');
  await page.locator('#bootstrapClass').selectOption('IC9999');await page.locator('#bootstrapStudent option[value="fake-student"]').waitFor({state:'attached'});await page.locator('#bootstrapStudent').selectOption('fake-student');await page.locator('#confirmIdentity').click();
  await page.locator('#bootstrapPreview:enabled').click();await page.locator('#bootstrapStart:enabled').click();await page.locator('#listeningView').waitFor({state:'visible'});
  await page.locator('#listeningView .cbt-part-button[aria-current="true"]').waitFor();
  const observed=await page.evaluate(()=>({run:window.TERM_TEST_BOOTSTRAP.clientRunId,startedAt:window.TERM_TEST_BOOTSTRAP.listeningStartedAt,deadline:window.TERM_TEST_BOOTSTRAP.listeningDeadlineAt,answer:document.querySelector('#listeningView [data-number="1"]').value,active:[...document.querySelectorAll('#listeningView .cbt-part-button')].findIndex(b=>b.getAttribute('aria-current')==='true')}));
  const sent=requests.find(r=>r.api==='/api/test/exam/session')?.payload;
  const ok=observed.run!==oldRun&&observed.startedAt===startedAt&&observed.deadline===''&&observed.answer===''&&observed.active===0&&sent?.clientRunId===observed.run&&sent?.classCode==='IC9999'&&sent?.studentRef==='fake-student'&&!requests.some(r=>r.api==='/api/test/grade')&&errors.length===0;
  results.push({slug,ok,observed,errors});await page.screenshot({path:path.join(out,slug+'.png'),fullPage:true});console.log((ok?'PASS ':'FAIL ')+slug);
 }catch(error){results.push({slug,ok:false,error:error.message,errors});console.log('FAIL '+slug+': '+error.message);}
 finally{await context.close();}
}}finally{await browser.close();await server.close();}
const result={ok:results.length===4&&results.every(r=>r.ok),results,aiCalls:0,portalWrites:0};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
