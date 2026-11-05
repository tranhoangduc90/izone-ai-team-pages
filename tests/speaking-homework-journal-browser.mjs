import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {startTrackingFixture} from './fixtures/speaking-tracking-server.mjs';
import {learners} from './fixtures/speaking-draft-server.mjs';
assert.ok(process.env.PLAYWRIGHT_MODULE&&process.env.SPEAKING_EVIDENCE_DIR&&process.env.SPEAKING_JOURNAL_LIBRARY_ROOT);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const lib=p=>import(pathToFileURL(resolve(process.env.SPEAKING_JOURNAL_LIBRARY_ROOT,p)).href);
const {createSpeakingHomeworkJournal,createSpeakingHomeworkIntake,speakingHomeworkBinding,speakingHomeworkSchemas}=await lib('adapters/speaking-homework.mjs');
const {createJournalService}=await lib('src/service.mjs'),{RemoteJournalStore}=await lib('src/remote-store.mjs'),{ProductLogRegistry,storageScope}=await lib('src/product-record.mjs');
const output=resolve(process.env.SPEAKING_EVIDENCE_DIR);await mkdir(output,{recursive:true});
const product='speaking-homework',key=Buffer.alloc(32,7),collector=await createJournalService({version:1,role:'primary',
 dataRoot:mkdtempSync(join(tmpdir(),'speaking-browser-collector-')),maxPhysicalBytes:64*1024*1024,incrementalAccounting:true,
 products:{[product]:{storageEngine:'scoped-drive-v2',encryptionKeys:{fixture:Buffer.alloc(32,4)},currentKeyId:'fixture',ingestKey:key,
 genericSchemas:speakingHomeworkSchemas,replicas:[{id:'fixture-copy',endpoint:'http://127.0.0.1:1/replica',key}],drive:{broker:'http://127.0.0.1:1/fixture-broker',receiptKey:key.toString('base64')}}}},{fixtureMode:true});
await new Promise(resolve=>collector.server.listen(0,'127.0.0.1',resolve));
const remote=new RemoteJournalStore({endpoint:`http://127.0.0.1:${collector.server.address().port}/rpc/${product}`,productId:product,key,fixtureMode:true});
const metadata=createSpeakingHomeworkJournal({append:(...args)=>remote.append(...args)}),registry=new ProductLogRegistry({product,schemas:speakingHomeworkSchemas});
let intake,dropBinding,dropCount=0,holdBinding,held=false,releaseHeld;const batches=[],errors=[],external=[],contexts=[];
const owner=current=>({mode:'independent',assignmentRef:current.lesson.code,classRef:'111',subjectRef:current.ref,unitId:current.unitId});
const journal={contextUnavailable:false,context:current=>intake.context(owner(current)),async collect(body,origin){
 const reply=await intake.collect({method:'POST',headers:{origin},body});
 batches.push({bindingId:body.bindingId,ids:body.events?.map(e=>e.id),http:reply.status,error:reply.body?.error,at:Date.now(),
  ...(reply.status>=400?{rejected:body.events?.map(e=>({kind:e.kind,keys:Object.keys(e.data||{}),traceId:e.traceId,requestId:e.requestId}))}:{})});
 if(reply.status===202&&body.bindingId===dropBinding&&!dropCount++){return{status:503,body:{ok:false,error:'FIXTURE_ACK_LOST'}};}
 if(reply.status===202&&body.bindingId===holdBinding){holdBinding=null;held=true;await new Promise(resolve=>{releaseHeld=resolve;});}
 return reply;
}};
const fixture=await startTrackingFixture(root,{journal,journalEnabled:true});
intake=createSpeakingHomeworkIntake({journal:metadata,keys:{fixture:key},currentKeyId:'fixture',allowedOrigins:[fixture.origin]});
dropBinding=intake.context(owner(fixture.record(2,learners[0]))).bindingId;
let browser,offFixture;
const wait=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
async function until(predicate,limit=6000){const end=Date.now()+limit;while(Date.now()<end){if(await predicate())return;await wait(30);}throw Error('BROWSER_JOURNAL_DEADLINE');}
async function read(number,ref=learners[0]){
 const scope=storageScope(speakingHomeworkBinding(owner(fixture.record(number,ref))));
 return(await collector.stores.get(product).read(scope)).map(event=>registry.decode(scope,event));
}
async function open(number,{ref=learners[0],legacy=false,source=fixture,width=1440,stream=true}={}){
 const context=await browser.newContext({viewport:{width,height:1000}});contexts.push(context);
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==source.origin){external.push(route.request().url().split('?')[0]);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const file=number===2?'index.html':`lesson-${number}.html`;
 await page.goto(source.origin+'/speaking-homework/'+file+'?class=IC2304'+(legacy?'&fixtureIntake=legacy':''));
 await page.evaluate(async input=>(await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).startReading(input),{lesson:number,ref,store:legacy?'legacy':'independent',streamExpected:stream});
 return page;
}
async function save(name,value){results.push({name,...value});await writeFile(join(output,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify({event:'speaking_journal_browser',name,passed:true}));}
async function scopeSwitch(){
 journal.contextDelayMs=750;
 const page=await open(3,{width:390});await wait(13000);
 holdBinding=intake.context(owner(fixture.record(3))).bindingId;
 await page.setViewportSize({width:400,height:1000});await wait(600);
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));await until(()=>held);
 fixture.record(3,learners[1]).docsProgress={status:'verified',sequence:'9',applied_sequence:'9'};
 await page.evaluate(async ref=>(await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).select(ref),learners[1]);
 releaseHeld();releaseHeld=null;
 await until(async()=>(await read(3,learners[1])).some(row=>row.kind==='ui.context'),35000);
 const old=await read(3),next=await read(3,learners[1]);
 assert.ok(old.length&&next.length);assert.ok(old.every(row=>row.subjectRef===learners[0]));assert.ok(next.every(row=>row.subjectRef===learners[1]));
 assert.ok(next.some(row=>row.kind==='client.state'&&row.data.phase==='docs_observed'&&row.data.state==='verified'));
 assert.ok(next.some(row=>row.kind==='client.state'&&row.data.observedBeforeContext&&row.data.observationDelayMs>0));
 assert.ok(!old.some(row=>row.kind==='client.state'&&row.data.phase==='docs_observed'&&row.data.state==='verified'));
 await save('scope-switch-with-held-old-ack',{oldEvents:old.length,newEvents:next.length,scopesSeparate:true,oldAckReleasedAfterNewUser:true});
}
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 if(process.env.SPEAKING_JOURNAL_CASE==='scope-switch')await scopeSwitch();else{
 const pages=[];
 for(const [number,width]of [[2,1440],[3,390],[8,1280]]){
  const page=await open(number,{width});pages.push([number,page]);
  await until(()=>fixture.requests.some(row=>row.number===number&&row.path==='/journal-context'));
  await page.locator('#open-share-guide').click();await page.locator('#close-share-guide').click();
  await page.evaluate(async input=>(await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).startReading(input),{lesson:number,ref:learners[0]});
 }
 fixture.record(8,learners[1],'legacy').supported=false;const legacy=await open(8,{ref:learners[1],legacy:true,stream:false,width:390});
 await wait(46000);
 for(const [number,page]of pages){
  const state=await page.evaluate(async()=>(await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).readingResult());
  await until(async()=>(await read(number)).some(row=>row.kind==='ui.context'));
  const rows=await read(number);assert.ok(rows.some(row=>row.kind==='ui.dialog'&&row.data.state==='opened'));
  assert.ok(rows.every(row=>row.subjectRef===learners[0]&&row.sessionRef==='independent:'+fixture.record(number).unitId));
  assert.equal(rows.find(row=>row.kind==='ui.context').data.viewportWidth,[, ,1440,390][number]||1280);
  await save('engine-'+number+'-reading-and-log',{...state,logEvents:rows.length,kinds:[...new Set(rows.map(row=>row.kind))]});
 }
 assert.equal(fixture.requests.filter(row=>row.number===8&&row.ref===learners[1]&&row.path.startsWith('/journal-')).length,0);
 await save('legacy-excluded',{logRequests:0});
 const two=pages[0][1],before=await read(2),ids=new Set(before.map(row=>row.id));
 await two.reload();await two.evaluate(async ref=>(await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).select(ref),learners[0]);
 await wait(14000);const after=await read(2);assert.ok(before.every(row=>after.some(other=>other.id===row.id)));assert.equal(new Set(after.map(row=>row.id)).size,after.length);
 const attempts=batches.filter(row=>row.bindingId===dropBinding);assert.ok(dropCount>0&&attempts.length>=2);assert.ok(attempts.slice(1).some(row=>row.ids.some(id=>ids.has(id))));
 await save('lost-ack-reload',{before:before.length,after:after.length,batches:attempts.length,uniqueIds:true});
 const three=pages[1][1];
 await three.evaluate(()=>fetch('/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({number:3,ref:'11111111-1111-4111-8111-111111111111',part:'clarify_2',patch:{check_status:'rejected',analysis_status:'done'}})}));
 await three.locator('#clarify_2-link').fill('https://chatgpt.com/share/00000000-0000-4000-8000-999999999996');
 await three.locator('#clarify_2-confirm').click();
 // One bounded recorder retry may span the next twelve-second delivery slice.
 await until(async()=>(await read(3)).some(row=>row.kind==='client.request'&&row.data.route==='check_main'&&row.data.serverRequestIdObserved),35000);
 await save('native-renderer-confirm',{requestJoined:true,rows:(await read(3)).length});
 await pages[2][1].evaluate(()=>fetch('/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({number:8,ref:'11111111-1111-4111-8111-111111111111',docs:{status:'verified',sequence:'2',applied_sequence:'2'}})}));
 await until(async()=>(await read(8)).some(row=>row.kind==='client.state'&&row.data.phase==='docs_observed'&&row.data.state==='verified'),35000);
 journal.contextUnavailable=true;const failed=await open(2,{ref:learners[1]});
 await wait(1000);assert.equal(await failed.locator('#homework-content').isHidden(),false);
 assert.equal(fixture.requests.filter(row=>row.number===2&&row.ref===learners[1]&&row.requestId).length,0);
 await save('logger-unavailable-native-open',{opened:true,logHeaders:0});
 offFixture=await startTrackingFixture(root);await open(3,{source:offFixture});
 assert.equal(offFixture.requests.filter(row=>row.path.startsWith('/journal-')).length,0);await save('logger-off',{logRequests:0});
 for(const number of [2,3,8]){
  const rows=await read(number),text=JSON.stringify(rows);
  for(const value of ['chatgpt.com','PRIVATE_',fixture.record(number).token,fixture.record(number).documentId])assert.ok(!text.includes(value));
 }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(join(output,'summary.json'),JSON.stringify({outcome:'passed',results,errors,external,qualification:'Browser uses mock business API, real source/IndexedDB/intake/signed Collector. No native SQL/Google/AI, real phone, cross-origin production or whole-container proof.'},null,2)+'\n');
}catch(error){
 await writeFile(join(output,'failure.json'),JSON.stringify({message:error.message,batches,requests:fixture.requests,
  rows:await Promise.all([2,3,8].map(async number=>({number,rows:await read(number).catch(()=>[])})))},null,2)+'\n');throw error;
}finally{
 releaseHeld?.();
 for(const context of contexts)await context.close();await browser?.close();await fixture.close();await offFixture?.close();await remote.close();await collector.close();
}
