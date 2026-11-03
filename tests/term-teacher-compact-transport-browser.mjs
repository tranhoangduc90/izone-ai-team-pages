import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
assert.ok(process.env.TERM_K67_SOURCE_DIR);assert.ok(process.env.PLAYWRIGHT_MODULE);
const product=resolve(process.env.TERM_K67_SOURCE_DIR),root=fileURLToPath(new URL('../',import.meta.url));
const {createMiniFixture}=await import(pathToFileURL(resolve(product,'test/helpers/mini-answer-sheet-fixture.js')).href);
const imported=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),{chromium}=imported.chromium?imported:imported.default;
const ref='11111111-1111-4111-8111-111111111111',attempt='60000000-0000-4000-8000-000000000001';
const realCycles=process.env.TERM_STATE_REAL_CYCLES==='1';

for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`Term teacher compact transport ${viewport.width}: real app/SQL/SSE avoids steady full payloads and preserves live result regions`,async t=>{
 const origins=new Set(),f=await createMiniFixture({examOrder:true,completeSchema:true,allowedOrigins:origins});
 let browser,server,contextTimer,ended=false,metadataDown=false,signedOut=false;
 const streams=new Set(),calls=[],errors=[],external=[];
 t.after(async()=>{
  ended=true;clearInterval(contextTimer);await browser?.close();for(const stream of streams)stream.end();
  await f.app.locals.termTeacherObservation.close();await f.app.locals.termTestResultStream.close();
  if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}await f.db.close();
 });
 const originalConnect=f.pool.connect.bind(f.pool);
 f.pool.connect=async()=>{const c=await originalConnect();return{async query(q,...args){
  if(metadataDown&&typeof q==='object'&&q.text.startsWith('WITH watched AS MATERIALIZED'))throw Object.assign(Error('fixture metadata outage'),{code:'FIXTURE_METADATA_DOWN'});
  return c.query(q,...args);
 },release:(...args)=>c.release(...args)};};
 const mutate=async work=>{const c=await originalConnect();try{return await work(c);}finally{c.release();}};
 const schema=await readFile(resolve(product,'db/001-context.sql'),'utf8');
 for(const name of ['reviewer_account','reviewer_class_access','reviewer_session'])await f.db.exec(schema.match(new RegExp(`CREATE TABLE mapping\\.${name} \\([\\s\\S]*?\\n\\);`))[0].replace('CREATE TABLE mapping.','CREATE TABLE IF NOT EXISTS mapping.'));
 const questions={questions:Array.from({length:40},(_,i)=>({number:i+1,type:'Dạng thử',accepted:['A']}))};
 await f.db.query(`INSERT INTO assessment.test_definition(slug,title,version,listening_definition,reading_definition,is_active)
  VALUES('term-test-1','Đề tích hợp giả',1,$1,$1,true)`,[JSON.stringify(questions)]);
 const section=()=>({correct:0,total:40,band:4,details:Array.from({length:40},(_,i)=>({number:i+1,studentAnswer:'Bài làm đang đọc '+(i+1),correctAnswer:'A',result:'incorrect'}))});
 const combined={testTitle:'Đề tích hợp giả',listening:section(),reading:section(),performance:{},typeStats:[]};
 await f.db.query(`INSERT INTO assessment.term_test_attempt(id,client_submission_id,test_slug,definition_version,erp_course_class_id,class_name_snapshot,
  erp_student_contact_id,student_name_snapshot,listening_submitted_at,reading_submitted_at,completed_at,listening_answers,listening_result,reading_result,reading_answers,combined_result,
  writing_started_at,writing_submitted_at,writing_updated_at,writing_task_2)
  VALUES($1,$1,'term-test-1',1,1293,'IC2304',900001,'Học viên mô phỏng',now(),now(),now(),'{}','{}','{}','{}',$2,now(),now(),now(),'Bài Writing giả')`,[attempt,JSON.stringify(combined)]);
 server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/fixture-api/')){
   const path=u.pathname.slice('/fixture-api'.length);calls.push(path);
   if(signedOut)return res.writeHead(401,{'content-type':'application/json'}).end('{"ok":false,"error":"FIXTURE_REVOKED"}');
   if(path.endsWith('/state/stream')){streams.add(res);res.on('close',()=>streams.delete(res));}
   // Vai trò legacy chỉ dành cho fixture cách ly; trình duyệt không nhận khóa này.
   req.headers['x-review-token']='fixture-only-key';req.url=req.url.slice('/fixture-api'.length);return f.app(req,res);
  }
  const path=resolve(root,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root.replace(/[\\/]$/,'')+sep))return res.writeHead(403).end();
  try{const body=await readFile(path);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[extname(path)]||'application/octet-stream'}).end(body);}catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${server.address().port}`;origins.add(base);
 contextTimer=setInterval(()=>{if(!ended)void mutate(c=>c.query('UPDATE mapping.k67_context_state SET captured_at=now()')).catch(error=>errors.push(error.message));},25000);
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin===base&&u.pathname.endsWith('/k67-shared/config.js'))return route.fulfill({contentType:'text/javascript',body:`window.TERM_TEST_APP_CONFIG={API_BASE_URL:${JSON.stringify(base+'/fixture-api')},GOOGLE_CLIENT_ID:'fixture-only'};`});
  if(u.origin===base)return route.continue();
  if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){},disableAutoSelect(){}}}};'});
  external.push(u.origin);return route.abort();
 });
 await page.goto(base+`/term-tests/teacher/?class=IC2304&test=term-test-1&student=${ref}`);
 await page.locator('#studentView .detail-block').first().waitFor();
 await page.waitForFunction(()=>document.querySelector('#notice').classList.contains('success'));
 const until=async predicate=>{const start=Date.now();while(!predicate()&&Date.now()-start<10000)await new Promise(r=>setTimeout(r,20));assert.ok(predicate());};
 await until(()=>f.app.locals.termTeacherObservation.snapshot().connections>0);
 await page.evaluate(()=>{const block=document.querySelector('#studentView .detail-block');block.open=true;globalThis.readingBlock=block;
  block.querySelector('summary').focus();const range=document.createRange();range.selectNodeContents(block.querySelector('tbody td:nth-child(2)'));
  getSelection().removeAllRanges();getSelection().addRange(range);globalThis.readingSelection=getSelection().toString();window.scrollTo(0,400);globalThis.readingTop=scrollY;});
 const forceRead=async()=>{const response=await fetch(base+'/fixture-api/api/term-tests/teacher/state?class=IC2304&test=term-test-1');await response.arrayBuffer();return response.status;};
 if(realCycles){const start=Date.now();while(Date.now()-start<93000)await new Promise(r=>setTimeout(r,1000));}
 else for(let i=0;i<3;i++)assert.equal(await forceRead(),200);
 assert.equal(calls.filter(p=>p==='/api/term-tests/teacher/results').length,1,'steady state must not fetch the full class result again');
 assert.deepEqual(await page.evaluate(()=>({same:readingBlock===document.querySelector('#studentView .detail-block'),open:readingBlock.open,
  selection:getSelection().toString()===readingSelection,focus:document.activeElement===readingBlock.querySelector('summary'),scroll:scrollY===readingTop})),
  {same:true,open:true,selection:true,focus:true,scroll:true});
 await mutate(c=>c.query(`INSERT INTO assessment.term_test_writing_grading_final(attempt_id,status,task_2_score,writing_score,ready_at) VALUES($1,'ready',6,6,now())`,[attempt]));
 assert.equal(await forceRead(),200);await page.locator('#studentView .teacher-writing-score-button').waitFor();
 assert.equal(calls.filter(p=>p==='/api/term-tests/teacher/results').length,2);
 assert.equal(await page.evaluate(()=>readingBlock===document.querySelector('#studentView .detail-block')&&readingBlock.open&&getSelection().toString()===readingSelection),true);
 metadataDown=true;assert.equal(await forceRead(),503);await page.locator('#notice.error').waitFor();assert.equal(await page.evaluate(()=>readingBlock.isConnected),true);
 metadataDown=false;assert.equal(await forceRead(),200);await page.locator('#notice.success').waitFor();assert.equal(calls.filter(p=>p==='/api/term-tests/teacher/results').length,2);
 signedOut=true;for(const stream of streams)stream.end();await page.locator('#dashboardView').waitFor({state:'hidden'});
 assert.equal(await page.locator('#studentView').innerText(),'');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 t.diagnostic(JSON.stringify({realCycles,fullResults:2,metadataScans:f.app.locals.termTeacherObservation.snapshot().scans,streamRequests:calls.filter(p=>p.endsWith('/state/stream')).length,fixtureLegacyAuth:true,externalAttempts:0}));
});
