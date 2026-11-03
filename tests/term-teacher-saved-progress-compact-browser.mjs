import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
assert.ok(process.env.TERM_K67_SOURCE_DIR);assert.ok(process.env.PLAYWRIGHT_MODULE);
const product=resolve(process.env.TERM_K67_SOURCE_DIR),root=fileURLToPath(new URL('../',import.meta.url));
const {createMiniFixture}=await import(pathToFileURL(resolve(product,'test/helpers/mini-answer-sheet-fixture.js')).href);
const imported=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),{chromium}=imported.chromium?imported:imported.default;
const ref='11111111-1111-4111-8111-111111111111',old='60000000-0000-4000-8000-000000000001',latest='60000000-0000-4000-8000-000000000002';
const view=id=>createHash('sha256').update('teacher-saved-progress:'+id).digest('hex'),realCycles=process.env.TERM_STATE_REAL_CYCLES==='1';

// Cả hai HTML giảng viên dùng chung renderer. Database/API ở đây là K67/PGlite;
// quyền/schema/profile K56 thật/demo được kiểm riêng bằng PostgreSQL16, không
// suy việc chạy teacher-k56 HTML với slug K67 thành một lượt native K56.
for(const folder of ['teacher','teacher-k56'])for(const viewport of [{width:1440,height:1000},{width:390,height:844}])
test(`Saved progress compact ${folder}/${viewport.width}: chosen history only, three intervals, edits/outage/late response/revocation`,async t=>{
 const origins=new Set(),f=await createMiniFixture({examOrder:true,completeSchema:true,allowedOrigins:origins});
 let browser,server,contextTimer,metadataDown=false,detailDown=false,delayOld=false,signedOut=false,ended=false;
 const streams=new Set(),calls=[],errors=[],external=[];
 t.after(async()=>{ended=true;clearInterval(contextTimer);await browser?.close();for(const stream of streams)stream.end();
  await f.app.locals.termTeacherObservation.close();await f.app.locals.termTestResultStream.close();
  if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}await f.db.close();});
 const originalConnect=f.pool.connect.bind(f.pool);
 f.pool.connect=async()=>{const c=await originalConnect();return{async query(q,...args){
  if(metadataDown&&typeof q==='object'&&q.text.startsWith('WITH watched AS MATERIALIZED'))throw Error('fixture metadata outage');
  return c.query(q,...args);
 },release:(...args)=>c.release(...args)};};
 const mutate=async(sql,args)=>{const c=await originalConnect();try{return await c.query(sql,args);}finally{c.release();}};
 const schema=await readFile(resolve(product,'db/001-context.sql'),'utf8');
 for(const name of ['reviewer_account','reviewer_class_access','reviewer_session'])await f.db.exec(schema.match(new RegExp(String.raw`CREATE TABLE mapping\.${name} \([\s\S]*?\n\);`))[0].replace('CREATE TABLE mapping.','CREATE TABLE IF NOT EXISTS mapping.'));
 const questions={questions:[{number:1,accepted:['A']}]};
 await f.db.query(`INSERT INTO assessment.test_definition(slug,title,version,listening_definition,reading_definition,is_active)
  VALUES('term-test-1','Đề mô phỏng lịch sử',1,$1,$1,true)`,[JSON.stringify(questions)]);
 for(const [id,created,superseded,prefix] of [[old,'2026-10-19T00:00:00Z','2026-10-20T00:00:00Z','Lượt cũ'],[latest,'2026-10-20T00:00:00Z',null,'Lượt mới']])
  await f.db.query(`INSERT INTO assessment.term_test_exam_session(id,test_slug,definition_version,erp_course_class_id,class_name_snapshot,
   erp_student_contact_id,student_name_snapshot,attempt_mode,created_at,superseded_at,listening_started_at,listening_deadline_at,listening_draft,listening_draft_updated_at)
   VALUES($1,'term-test-1',1,1293,'IC2304',900001,'Học viên mô phỏng','cbt',$2,$3,now(),now()+interval '30 minutes',$4,'2026-11-01T00:00:00Z')`,
   [id,created,superseded,JSON.stringify(Object.fromEntries(Array.from({length:40},(_,i)=>[String(i+1),prefix+' '+(i+1)])))]);
 server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/fixture-api/')){
   const path=u.pathname.slice('/fixture-api'.length),mode=u.searchParams.get('mode');calls.push({path,mode,viewId:u.searchParams.get('viewId'),method:req.method});
   if(signedOut)return res.writeHead(401,{'content-type':'application/json'}).end('{"ok":false,"error":"FIXTURE_REVOKED"}');
   if(mode==='view'&&detailDown)return res.writeHead(503,{'content-type':'application/json'}).end('{"ok":false,"message":"fixture detail outage"}');
   if(mode==='view'&&delayOld&&u.searchParams.get('viewId')===view(old))await new Promise(done=>setTimeout(done,450));
   if(path.endsWith('/state/stream')){streams.add(res);res.on('close',()=>streams.delete(res));}
   req.headers['x-review-token']='fixture-only-key';req.url=req.url.slice('/fixture-api'.length);return f.app(req,res);
  }
  const path=resolve(root,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root.replace(/[\\/]$/,'')+sep))return res.writeHead(403).end();
  try{res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[extname(path)]||'application/octet-stream'}).end(await readFile(path));}catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${server.address().port}`;origins.add(base);
 contextTimer=setInterval(()=>{if(!ended)void mutate('UPDATE mapping.k67_context_state SET captured_at=now()').catch(e=>errors.push(e.message));},25000);
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());
  if(u.origin===base&&/\/(?:k67|k56)-shared\/config.js$/.test(u.pathname))return route.fulfill({contentType:'text/javascript',body:`window.TERM_TEST_APP_CONFIG={API_BASE_URL:${JSON.stringify(base+'/fixture-api')},GOOGLE_CLIENT_ID:'fixture-only'};`});
  if(u.origin===base)return route.continue();
  if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){},disableAutoSelect(){}}}};'});
  external.push(u.origin);return route.abort();
 });
 const count=mode=>calls.filter(c=>c.path.endsWith('/saved-progress')&&c.mode===mode).length;
 const until=async predicate=>{const start=Date.now();while(!predicate()&&Date.now()-start<10000)await new Promise(r=>setTimeout(r,20));assert.ok(predicate());};
 const force=async()=>{const r=await fetch(base+'/fixture-api/api/term-tests/teacher/state?class=IC2304&test=term-test-1&student='+ref);await r.arrayBuffer();return r.status;};
 await page.goto(base+`/term-tests/${folder}/?class=IC2304&test=term-test-1&student=${ref}`);
 await page.getByRole('button',{name:'Xem tiến trình đã lưu'}).click();const dialog=page.getByRole('dialog');
 await dialog.getByText('Lượt mới 40',{exact:true}).waitFor();assert.equal(count('index'),1);assert.equal(count('view'),1);assert.equal(count(null),0);
 await dialog.getByLabel('Lượt làm').selectOption(view(old));await dialog.getByText('Lượt cũ 40',{exact:true}).waitFor();assert.equal(count('view'),2);
 await until(()=>f.app.locals.termTeacherObservation.snapshot().connections>=2);
 await page.evaluate(()=>{const section=document.querySelector('dialog section[data-reading-key="listening"]');globalThis.savedReadingSection=section;
  const select=document.querySelector('dialog select');select.focus();globalThis.savedSelect=select;
  const range=document.createRange();range.selectNodeContents(section.querySelector('td:nth-child(2)'));getSelection().removeAllRanges();getSelection().addRange(range);
  globalThis.savedSelection=getSelection().toString();const dialog=document.querySelector('dialog');dialog.scrollTop=230;globalThis.savedScroll=dialog.scrollTop;});
 if(realCycles){const start=Date.now();while(Date.now()-start<93000)await new Promise(r=>setTimeout(r,1000));}else for(let i=0;i<3;i++)assert.equal(await force(),200);
 assert.equal(count('index'),1);assert.equal(count('view'),2);assert.equal(count(null),0);
 const retained=()=>page.evaluate(()=>({same:savedReadingSection===document.querySelector('dialog section[data-reading-key="listening"]'),
  focus:document.activeElement===savedSelect,selection:getSelection().toString()===savedSelection,scroll:document.querySelector('dialog').scrollTop===savedScroll}));
 assert.deepEqual(await retained(),{same:true,focus:true,selection:true,scroll:true});
 await mutate(`UPDATE assessment.term_test_exam_session SET listening_draft=jsonb_set(listening_draft,'{1}','"Lượt mới đã đổi"') WHERE id=$1`,[latest]);assert.equal(await force(),200);
 await until(()=>count('index')===2);await page.waitForTimeout(150);assert.equal(count('view'),2);assert.deepEqual(await retained(),{same:true,focus:true,selection:true,scroll:true});
 await mutate(`UPDATE assessment.term_test_exam_session SET listening_draft=jsonb_set(listening_draft,'{1}','"Lượt cũ vừa sửa"') WHERE id=$1`,[old]);assert.equal(await force(),200);
 await dialog.getByText('Lượt cũ vừa sửa',{exact:true}).waitFor();assert.equal(count('view'),3);assert.equal(await dialog.getByLabel('Lượt làm').inputValue(),view(old));
 metadataDown=true;assert.equal(await force(),503);await dialog.getByText(/Chưa kiểm tra được thay đổi/).waitFor();assert.equal(await dialog.getByText('Lượt cũ vừa sửa',{exact:true}).count(),1);
 metadataDown=false;assert.equal(await force(),200);await dialog.getByText(/Theo dõi thay đổi mỗi 30 giây/).waitFor();assert.equal(count('view'),3);
 detailDown=true;await mutate(`UPDATE assessment.term_test_exam_session SET listening_draft=jsonb_set(listening_draft,'{1}','"Lượt cũ hồi phục"') WHERE id=$1`,[old]);assert.equal(await force(),200);
 await dialog.getByText(/Chưa cập nhật được/).waitFor();assert.equal(await dialog.getByText('Lượt cũ vừa sửa',{exact:true}).count(),1);
 detailDown=false;await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();await dialog.getByText('Lượt cũ hồi phục',{exact:true}).waitFor();
 delayOld=true;await mutate(`UPDATE assessment.term_test_exam_session SET listening_draft=jsonb_set(listening_draft,'{1}','"Phản hồi cũ trả muộn"') WHERE id=$1`,[old]);
 const requests=count('view');assert.equal(await force(),200);await until(()=>count('view')>requests);
 await dialog.getByLabel('Lượt làm').selectOption(view(latest));await dialog.getByText('Lượt mới đã đổi',{exact:true}).waitFor();await page.waitForTimeout(600);
 assert.equal(await dialog.getByLabel('Lượt làm').inputValue(),view(latest));assert.equal(await dialog.getByText('Phản hồi cũ trả muộn',{exact:true}).count(),0);
 signedOut=true;for(const stream of streams)stream.end();await dialog.waitFor({state:'detached'});
 assert.equal((await page.locator('body').innerText()).includes('Lượt mới đã đổi'),false);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(calls.some(c=>c.method!=='GET'),false);
 t.diagnostic(JSON.stringify({realCycles,fixture:'K67 real app/SQL in PGlite; both teacher HTML',initialSteadyIndex:1,initialSteadyViews:2,legacyHistoryDownloads:count(null),outsideRequests:0}));
});
