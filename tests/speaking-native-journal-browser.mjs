import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {startTrackingFixture} from './fixtures/speaking-tracking-server.mjs';
for(const key of ['PLAYWRIGHT_MODULE','SPEAKING_NATIVE_FIXTURE_ROOT','SPEAKING_EVIDENCE_DIR','SPEAKING_JOURNAL_LIBRARY_ROOT'])assert.ok(process.env[key],key);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const {startNativeBrowserFixture}=await import(pathToFileURL(resolve(process.env.SPEAKING_NATIVE_FIXTURE_ROOT,'test/native-browser-fixture.mjs')).href);
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),output=resolve(process.env.SPEAKING_EVIDENCE_DIR);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,
 args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']});
const results=[],errors=[],external=[];let live;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,limit=35000){const end=Date.now()+limit;while(Date.now()<end){if(await check())return;await wait(50);}throw Error('NATIVE_BROWSER_DEADLINE');}
async function create({enabled=true,client=true,loseClientAck=false}={}){
 let api;
 const fixture=await startTrackingFixture(root,{journalEnabled:client,nativeApi:()=>api?.origin+'/api/speaking-homework-independent',nativeRef:()=>api?.ref});
 try{api=await startNativeBrowserFixture({origin:fixture.origin,enabled,loseClientAck});}catch(error){await fixture.close();throw error;}
 const context=await browser.newContext({viewport:{width:390,height:1000}});
 // Do not intercept local requests: interception can bypass Chromium preflight.
 // CSP and the DNS rule constrain external access; request observation is read-only.
 context.on('request',request=>{const origin=new URL(request.url()).origin;
  if(![fixture.origin,api.origin].includes(origin))external.push(origin);});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 async function open(reload=false){
  if(reload)await page.reload();else await page.goto(fixture.origin+'/speaking-homework/lesson-6.html?class=IC2304');
  await page.waitForFunction(ref=>{
   if(!document.getElementById('homework-content').hidden)return true;
   const select=document.getElementById('student-select'),button=document.getElementById('open-homework');
   if(window.__nativeFixtureOpenRequested||select.disabled||![...select.options].some(row=>row.value===ref))return false;
   select.value=ref;select.dispatchEvent(new Event('change',{bubbles:true}));
   if(!button.disabled){window.__nativeFixtureOpenRequested=true;button.click();}return false;
  },api.ref);
  await page.locator('#homework-content').waitFor({state:'visible'});
 }
 const state={fixture,api,page,context,open,close:async()=>{await context.close();await api.close();await fixture.close();}};live=state;return state;
}
async function save(name,details){results.push({name,...details});await writeFile(join(output,name+'.json'),JSON.stringify(details,null,2)+'\n');console.log(JSON.stringify({case:name,passed:true}));}
try{
 const f=await create({loseClientAck:true});assert.notEqual(f.fixture.origin,f.api.origin);await f.open();
 await until(()=>f.api.requests.some(row=>row.path.endsWith('/journal-context')&&row.httpStatus===200));
 await wait(250);await f.page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 await until(()=>f.api.requests.some(row=>row.path.endsWith('/journal-events')&&row.httpStatus===503));
 const lost=f.api.requests.find(row=>row.path.endsWith('/journal-events')&&row.httpStatus===503).eventIds;
 assert.ok(lost.length);assert.ok((await f.api.rows()).length,'Collector already committed before ACK loss');
 await f.open(true);await wait(500);await f.page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 await until(()=>f.api.requests.some(row=>row.path.endsWith('/journal-events')&&row.httpStatus===202&&lost.every(id=>row.eventIds.includes(id))));
 const url='https://chatgpt.com/share/00000000-0000-4000-8000-999999999995';
 await f.page.locator('#reason_action-link').fill(url);await f.page.locator('#reason_action-confirm').click();
 await until(()=>f.api.requests.some(row=>row.path.endsWith('/checks/request')&&row.httpStatus===202));
 await wait(250);await f.page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 await until(async()=>{await f.api.flush();return(await f.api.rows()).some(row=>row.kind==='client.request'&&row.data.route==='check_main');});
 const rows=await f.api.rows(),client=rows.find(row=>row.kind==='client.request'&&row.data.route==='check_main'),api=rows.find(row=>row.kind==='api.request'&&row.data.route==='check_main'),link=rows.find(row=>row.kind==='link.saved');
 assert.ok(client&&api&&link);assert.equal(client.requestId,api.requestId);assert.equal(client.data.serverRequestIdObserved,true);
 assert.equal(client.data.linkId,link.data.linkId);assert.equal(api.data.linkId,link.data.linkId);
 assert.deepEqual(await f.api.counts(),{links:1,jobs:1});assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
 assert.ok(f.api.requests.some(row=>row.method==='OPTIONS'&&row.allowedOrigin===f.fixture.origin));
 assert.ok(f.api.requests.filter(row=>row.method==='POST').every(row=>row.origin===f.fixture.origin));
 for(const secret of [url,f.api.identity.accessToken,'Học viên fixture'])assert.ok(!JSON.stringify(rows).includes(secret));
 await save('native-cross-origin-ack-replay-sql',{events:rows.length,replayedIds:lost,requests:f.api.requests,sql:await f.api.counts(),requestMatched:true,linkMatched:true});
 const before=(await f.api.pool.query('SELECT count(*)::int AS n FROM speaking_independent.work_unit')).rows[0].n;
 const denied=await f.page.evaluate(async({origin,body})=>{const response=await fetch(origin+'/api/speaking-homework-independent/journal-context',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,studentRef:crypto.randomUUID()})});return response.status;},{origin:f.api.origin,body:f.api.identity});
 assert.equal(denied,403);
 const foreign=createServer((_req,res)=>res.end('<!doctype html><body>other local origin</body>'));await new Promise(r=>foreign.listen(0,'127.0.0.1',r));
 const other=await browser.newContext(),page=await other.newPage();
 try{
  await page.goto(`http://127.0.0.1:${foreign.address().port}`);
  const corsBlocked=await page.evaluate(async origin=>{try{await fetch(origin+'/api/speaking-homework-independent/journal-context',{
   method:'POST',headers:{'content-type':'application/json'},body:'{}'});return false;}catch(error){return error.name==='TypeError';}},f.api.origin);
  assert.equal(corsBlocked,true);
 }finally{await other.close();await new Promise(r=>foreign.close(r));}
 assert.equal((await f.api.pool.query('SELECT count(*)::int AS n FROM speaking_independent.work_unit')).rows[0].n,before);
 await save('native-origin-and-owner-denied',{forgedOwnerStatus:denied,foreignOriginBlocked:true,newUnits:0});
 await f.close();live=null;
 for(const client of [false,true]){
  const off=await create({enabled:false,client});await off.open();
  await off.page.locator('#reason_action-link').fill(url);await off.page.locator('#reason_action-confirm').click();
  await until(()=>off.api.requests.some(row=>row.path.endsWith('/checks/request')&&row.httpStatus===202));await wait(500);
  assert.deepEqual(await off.api.counts(),{links:1,jobs:1});assert.equal((await off.api.rows()).length,0);
  const log=off.api.requests.filter(row=>row.path.includes('/journal-'));
  if(!client)assert.equal(log.length,0);else assert.ok(log.some(row=>row.path.endsWith('/journal-context')&&row.httpStatus===404));
  assert.ok(off.api.requests.filter(row=>row.path.endsWith('/checks/request')).every(row=>!row.requestId));
  await save(client?'native-intake-off-keeps-business':'native-client-and-api-off',{sql:await off.api.counts(),logRequests:log.length,events:0});
  await off.close();live=null;
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(join(output,'summary.json'),JSON.stringify({outcome:'passed',results,errors,external,
  qualification:'Real Pages/Edge, different loopback origins and browser CORS, native API/PGlite SQL, startup factory/Agent SQLite/signed Collector. Synthetic membership, no worker AI/Google/real Drive/phone/production.'},null,2)+'\n');
}catch(error){
 if(live?.page){await live.page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});
  const ui=await live.page.evaluate(()=>({text:document.getElementById('login-screen')?.innerText,hidden:document.getElementById('homework-content')?.hidden})).catch(()=>({}));
  await writeFile(join(output,'ui-failure.json'),JSON.stringify(ui,null,2));}
 await writeFile(join(output,'failure.json'),JSON.stringify({error:error.message,stack:error.stack,results,errors,external,requests:live?.api.requests},null,2)+'\n');throw error;
}
finally{await live?.close();await browser.close();}
