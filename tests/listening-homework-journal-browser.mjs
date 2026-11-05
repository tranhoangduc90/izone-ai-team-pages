// Native Homework app/store + Chrome + signed Collector; all people and answers are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {createListeningObservationApp} from './fixtures/listening-observation-app.mjs';
import {WORKER_ORIGIN} from '../shared/audio/config.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.HOMEWORK_JOURNAL_EVIDENCE,jroot=process.env.HOMEWORK_JOURNAL_ROOT;
if(!out||!jroot||!path.isAbsolute(out)||!path.isAbsolute(jroot))throw Error('PRIVATE_EVIDENCE_AND_JOURNAL_SOURCE_REQUIRED');
await fs.mkdir(out,{recursive:true});
const load=file=>import(pathToFileURL(path.join(jroot,file)).href);
const [{createJournalService},{RemoteJournalStore},{ProductLogRegistry,storageScope},adapter]=await Promise.all([
 'src/service.mjs','src/remote-store.mjs','src/product-record.mjs','adapters/homework-lifecycle.mjs',
].map(load));
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const product='listening-homework',key=Buffer.alloc(32,7),records=[];let browser;
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({at:new Date().toISOString(),records},null,2)+'\n',{flag:'wx'});});
async function until(check,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,60));}throw Error('HOMEWORK_JOURNAL_BROWSER_TIMEOUT');}

for(const [name,width,enabled] of [['scandinavian-studies',1440,true],['origami',390,true],['scandinavian-studies',1440,false]])test(`Listening journal native ${name} ${width}px enabled=${enabled}`,{timeout:100000},async t=>{
 const dir=await fs.mkdtemp(path.join(tmpdir(),'listening-homework-journal-'));
 let collector,remote,f,context,page,lastContext;const batches=[],errors=[],external=[],journalStatuses=[],draftReceipts=[];let refuse=false,loseAck=false,cutSubmitReply=false,refusals=0,ackLost=0;
 t.after(async()=>{const browserState=page?await page.evaluate(async ctx=>{
  const databases=await indexedDB.databases();let queued=[];
  if(databases.some(d=>d.name==='izone-listening-homework-journal-v1'))queued=await new Promise((resolve,reject)=>{const request=indexedDB.open('izone-listening-homework-journal-v1');request.onerror=reject;request.onsuccess=()=>{const db=request.result,q=db.transaction('events').objectStore('events').getAll();q.onerror=reject;q.onsuccess=()=>{db.close();resolve(q.result.map(r=>({event:r.event,blocked:r.blocked})));};};});
  return{resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('journal')).map(r=>r.name),databases,queued,
   context:ctx?{bindingLength:ctx.bindingId?.length,ticketType:typeof ctx.ticket,ticketIdLength:ctx.ticketId?.length,expiryInteger:Number.isSafeInteger(ctx.expiresAt),expiryDeltaMs:ctx.expiresAt-Date.now()}:null};
 },lastContext).catch(()=>null):null;await fs.writeFile(path.join(out,`${name}-${enabled}-transport.json`),JSON.stringify({batches:batches.length,journalStatuses,draftReceipts,browserState,nativeRequests:f?.requests,errors,external,refusals,ackLost},null,2)+'\n',{flag:'wx'});await context?.close();await f?.close();await remote?.close();await collector?.close();assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'listening-homework-journal-'));await fs.rm(dir,{recursive:true,force:true});});
 collector=await createJournalService({version:1,role:'primary',dataRoot:dir,maxPhysicalBytes:64*1024*1024,incrementalAccounting:true,
  products:{[product]:{storageEngine:'scoped-drive-v2',encryptionKeys:{fixture:Buffer.alloc(32,4)},currentKeyId:'fixture',ingestKey:key,
   genericSchemas:adapter.listeningHomeworkSchemas,replicas:[{id:'fixture-copy',endpoint:'http://127.0.0.1:1/replica',key}],
   drive:{broker:'http://127.0.0.1:1/fixture-broker',receiptKey:key.toString('base64')}}}},{fixtureMode:true});
 await new Promise(done=>collector.server.listen(0,'127.0.0.1',done));
 remote=new RemoteJournalStore({endpoint:`http://127.0.0.1:${collector.server.address().port}/rpc/${product}`,productId:product,key,fixtureMode:true});await remote.ready;
 const journal=adapter.createListeningHomeworkJournal({append:remote.append.bind(remote)});
 f=await createListeningObservationApp({root,name,journalFactory:enabled?({origins})=>{
  const make=()=>adapter.createListeningHomeworkIntake({journal,keys:{fixture:key},currentKeyId:'fixture',allowedOrigins:origins}),intake=make();
  // The fixture discovers its ephemeral origin after native app construction.
  return{...intake,collect:input=>make().collect(input)};
 }:null});
 context=await browser.newContext({viewport:{width,height:900},locale:'vi-VN'});
 let audioBytes;
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===f.origin){
   if(url.pathname.endsWith('/submit')&&request.method()==='POST'&&cutSubmitReply){cutSubmitReply=false;const response=await route.fetch({maxRetries:0});assert.equal(response.status(),202);return route.abort('failed');}
   if(url.pathname.endsWith('/journal-events')){
    const batch=request.postDataJSON();batches.push(batch);
    if(refuse){refusals++;return route.fulfill({status:503,json:{ok:false,error:'FIXTURE_COLLECTOR_UNAVAILABLE'}});}
    if(loseAck){loseAck=false;ackLost++;const response=await route.fetch();assert.equal(response.status(),202);return route.abort('failed');}
   }
   return route.continue();
  }
  if(url.origin===WORKER_ORIGIN)return route.fulfill({status:503,json:{error:'FIXTURE_PRIMARY_OFFLINE'}});
  if(url.href===f.asset.url){audioBytes??=await fs.readFile(path.join(root,'listening-homework/audio-assets',url.pathname.split('/').at(-1)));const range=/^bytes=(\d+)-(\d+)$/.exec(request.headers().range||''),start=range?Number(range[1]):0,end=range?Math.min(Number(range[2]),audioBytes.length-1):audioBytes.length-1;return route.fulfill({status:206,headers:{'content-type':'audio/mpeg','content-range':`bytes ${start}-${end}/${audioBytes.length}`},body:audioBytes.subarray(start,end+1)});}
  if(url.pathname.includes('teacher-session-api')||url.pathname.includes('shared-session'))return route.fulfill({status:401,json:{error:'TEACHER_LOGIN_REQUIRED'}});
  external.push(url.origin+url.pathname);return route.abort();
 });
 page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('response',async response=>{const p=new URL(response.url()).pathname;if(p.endsWith('/journal-events'))journalStatuses.push(response.status());if(p.endsWith('/draft')&&response.request().method()==='GET'){const v=await response.json().catch(()=>({}));lastContext=v.listeningJournal;draftReceipts.push({runNo:v.runNo,journal:v.listeningJournal?{ownerId:v.listeningJournal.ownerId,courseId:v.listeningJournal.courseId,runNo:v.listeningJournal.runNo}:null});}});
 const routeName=name==='scandinavian-studies'?'lesson-2':name;
 await page.goto(f.origin+'/listening-homework/'+routeName+'.html?fresh=1');
 await page.locator('#class').selectOption('1293');await page.locator('#student').selectOption(f.scope.ownerId);await page.locator('#entry-submit').click();
 await page.locator('#exercise-content input:visible,#exercise-content textarea:visible').first().waitFor();
 const registry=new ProductLogRegistry({product,schemas:adapter.listeningHomeworkSchemas});
 async function read(){await remote.flushRetry();const rows=[];for(const runNo of [1,2]){const scope=storageScope(adapter.listeningHomeworkBinding({...f.scope,runNo}));for(const event of await collector.stores.get(product).read(scope))rows.push(registry.decode(scope,event));}return rows;}
 async function flush(){await page.evaluate(async()=>{await new Promise(done=>setTimeout(done,120));dispatchEvent(new Event('online'));});}
 if(enabled){await until(async()=>{await flush();return (await read()).some(r=>r.kind==='submit.gate');},5000);}
 const input=page.locator('#exercise-content input:not([type=radio]):visible,#exercise-content textarea:visible').first(),before=(await f.store.draft(f.scope)).revision;
 const canary='PRIVATE-ANSWER-'+name;
 f.controls.dropSaveReply=true;await input.fill(canary);
 await until(async()=>(await f.store.draft(f.scope)).revision===before+1);
 await until(async()=>await page.locator('#save-retry').isVisible()||await page.locator('#save-status').getAttribute('aria-label')==='Đã lưu nháp trên hệ thống.');
 if(await page.locator('#save-retry').isVisible())await page.locator('#save-retry').click();
 await page.waitForFunction(()=>document.querySelector('#save-status').getAttribute('aria-label')==='Đã lưu nháp trên hệ thống.');
 const writes=f.requests.filter(r=>r.method==='PUT'&&r.path==='/draft');assert.equal(writes.length,2);assert.equal(new Set(writes.map(r=>r.mutationId)).size,1);
 const jobsBefore=(await f.db.query('SELECT count(*)::int AS n FROM reading_listening67.web_job')).rows[0].n;
 cutSubmitReply=true;await page.locator('#submit').click();
 await until(async()=>(await f.db.query('SELECT count(*)::int AS n FROM reading_listening67.web_job')).rows[0].n===jobsBefore+1);
 await page.waitForFunction(()=>!document.querySelector('#submit').disabled&&document.querySelector('#grade-status').textContent.includes('Kết nối chưa được xác nhận'));await page.locator('#submit').click();
 await until(()=>f.requests.filter(r=>r.path==='/submit'&&r.method==='POST'&&r.requestId).length>=2,5000);
 const submits=f.requests.filter(r=>r.path==='/submit'&&r.method==='POST');assert.equal(new Set(submits.map(r=>r.requestId)).size,1);
 assert.equal((await f.db.query('SELECT count(*)::int AS n FROM reading_listening67.web_job')).rows[0].n,jobsBefore+1);
 await f.completePending();
 await page.locator('#play').click();await page.waitForFunction(()=>!document.querySelector('#audio').paused);
 await page.evaluate(()=>{const audio=document.querySelector('#audio');audio.volume=0;audio.muted=true;});
 if(enabled){await flush();await until(async()=>(await read()).some(r=>r.kind==='audio.state'&&r.data.volumePermille===0&&r.data.muted));}
 if(enabled){
  refuse=true;await page.evaluate(()=>document.querySelector('#audio').playbackRate=1.25);await flush();await until(()=>refusals>0);
  // Collector failure never changes the native save/grade or media state.
  assert.equal(await input.inputValue(),canary);assert.equal((await f.store.draft(f.scope)).revision,before+1);
  refuse=false;loseAck=true;await flush();await until(()=>ackLost===1);await flush();
  await until(async()=>(await read()).some(r=>r.kind==='audio.state'&&r.data.phase==='rate'&&r.data.ratePermille===1250));
  const oldBinding=batches[0].bindingId;await page.locator('#history-button').click();await page.locator('#history-dialog').waitFor({state:'visible'});page.once('dialog',dialog=>dialog.accept());await page.locator('#new-run').click();
  await until(async()=>(await f.store.draft(f.scope)).runNo===2);await page.waitForFunction(()=>document.querySelector('#progress').textContent.startsWith('0/'));
  await page.locator('#close-history-dialog').click();
  await input.fill('PRIVATE-NEW-RUN');await until(async()=>(await f.store.draft(f.scope)).revision===before+3);await flush();
  await until(async()=>(await read()).some(r=>r.generation===2&&r.kind==='draft.exchange'&&r.data.phase==='confirmed'));
  const rows=await read(),own=rows.filter(r=>r.source==='client');
  assert.ok(own.some(r=>r.kind==='submit.exchange'&&r.data.phase==='unknown'));assert.ok(own.some(r=>r.kind==='submit.exchange'&&r.data.phase==='confirmed'));
  assert.ok(own.some(r=>r.kind==='audio.transfer'&&r.data.phase==='verified'&&r.data.source==='pages'&&r.data.expectedHash===f.asset.sha256));
  assert.ok(own.some(r=>r.kind==='submit.gate'&&r.data.requiredCount===Math.ceil(f.data.items.length*.8)));
  assert.ok(own.every(r=>r.subjectRef===f.scope.ownerId&&r.product===product));assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
  assert.equal(JSON.stringify(own).includes(canary),false);assert.equal(JSON.stringify(batches).includes('PRIVATE-'),false);
  assert.ok(batches.some(b=>b.bindingId!==oldBinding));
  await fs.writeFile(path.join(out,name+'-events.json'),JSON.stringify(rows,null,2)+'\n',{flag:'wx'});
  records.push({name,width,enabled,events:own.length,scopes:2,saveRequests:writes.length,submitRequests:submits.length,submitJobs:1,refusals,ackLost,outcome:'passed'});
 }else{
  await flush();assert.equal(batches.length,0);assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('homework-journal.mjs'))),false);
  records.push({name,width,enabled,saveRequests:writes.length,submitRequests:submits.length,submitJobs:1,intakeRequests:0,outcome:'passed'});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
});
