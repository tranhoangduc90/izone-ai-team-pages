// Local browser + synthetic identities only; no calls to an exam service.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modules=process.env.CODEX_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(path.join(modules,'playwright/package.json'))('playwright');
const evidence=process.env.JOURNAL_EVIDENCE||path.join(root,'output/exam-journal-startup');
fs.mkdirSync(evidence,{recursive:true});
const entry=fs.readFileSync(path.join(root,'term-tests/term-test-2-computer-based/index.html'),'utf8');
// An older entry legitimately has no early observer. Still exercise its real audio bridge,
// so RED means lost behavior, rather than a missing import or a broken harness.
const configSrc=entry.match(/<script src="([^"]*test-config\.js[^\"]*)"><\/script>/)?.[1];
assert.ok(configSrc,'A real entry must load its test definition');
const logs=[],proofs=[],requests=[];let releaseContext=false,denyContext=false;
const server=createServer(async(q,s)=>{
 const u=new URL(q.url,'http://local');requests.push({method:q.method,path:u.pathname});
 const json=body=>{s.setHeader('Content-Type','application/json');s.end(JSON.stringify(body));};
 if(u.pathname.endsWith('/journal-context')){
  const parts=[];for await(const chunk of q)parts.push(chunk);
  const proof=JSON.parse(Buffer.concat(parts));proofs.push(proof);
  while(!releaseContext&&!s.destroyed)await new Promise(r=>setTimeout(r,10));
  if(denyContext){s.statusCode=503;return json({ok:false});}
  const bindingId=(proof.classCode==='ICFIXB'?'b':'a').repeat(64);
  return json({ok:true,bindingId,ticket:'synthetic-ticket',ticketId:randomUUID(),issuedAt:Date.now(),expiresAt:Date.now()+3600000,identityConfirmed:false,
   versions:{classVerified:false,definitionVersion:'unknown'}});
 }
 if(u.pathname.endsWith('/journal-events')){
  const parts=[];for await(const chunk of q)parts.push(chunk);const p=JSON.parse(Buffer.concat(parts));
  for(const event of p.events)if(!logs.some(r=>r.event.id===event.id))logs.push({bindingId:p.bindingId,event});
  return json({ok:true,persisted:true,scopeId:p.bindingId,acknowledgedIds:p.events.map(e=>e.id)});
 }
 if(u.pathname==='/fixture'){
  s.setHeader('Content-Type','text/html; charset=utf-8');return s.end(`<!doctype html><meta charset="utf-8"><body><div id="app"></div><script>
   window.TERM_TEST_CONFIG={slug:'term-test-2'};
   window.TERM_TEST_APP_CONFIG={EXAM_JOURNAL_ENABLED:${u.searchParams.get('enabled')!=='false'},API_BASE_URL:location.origin,EXAM_JOURNAL_BUILD:'synthetic'};
   </script><script src="/term-tests/term-test-2-computer-based/${configSrc}"></script>
   <select id="bootstrapStudent"><option value="">Chọn tên</option><option value="fixture-A">Học viên A giả</option><option value="fixture-B">Học viên B giả</option></select>
   <button id="bootstrap-change-remembered-student">Đổi người học</button><button id="confirmIdentity">Xác nhận giả</button><input id="unrelatedSecret" type="password" value="never-capture-this">
   <input id="answer" value="unchanged"><button id="bootstrapStart" disabled>Bắt đầu</button></body>`);
 }
 const p=path.resolve(root,'.'+u.pathname);
 if(p.startsWith(root+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()){
  s.setHeader('Content-Type',p.endsWith('.mjs')||p.endsWith('.js')?'text/javascript':'text/plain');return s.end(fs.readFileSync(p));
 }
 s.statusCode=404;s.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
const url='http://127.0.0.1:'+server.address().port;
// Normal observations may wait for the adaptive <=15s batch; this is not an exit deadline.
async function until(predicate){const deadline=Date.now()+20000;while(!predicate()){if(Date.now()>deadline)throw Error('Expected journal evidence did not arrive');await new Promise(r=>setTimeout(r,50));}}
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
 await page.goto(url+'/fixture?class=ICFIXA');
 await page.locator('#bootstrapStudent').focus();
 await page.selectOption('#bootstrapStudent','fixture-A');
 await page.selectOption('#bootstrapStudent','fixture-B');
 await page.locator('#confirmIdentity').click();
 const selectedAt=Date.now();
 // Audio was the first journal attachment in the old implementation.
 await page.evaluate(async()=>{
  const {connectAudioCapture}=await import('/term-tests/shared/exam-journal/bootstrap-capture.mjs');
  connectAudioCapture({assetId:'fixture-audio',byteLength:32},{classCodeHint:'ICFIXA'});
 });
 releaseContext=true;
 await page.waitForFunction(()=>!!window.EXAM_JOURNAL_AUDIO_TRANSFER);
 await until(()=>logs.filter(r=>r.event.type==='identity_observed'&&r.event.data.action==='selection_changed').length===2);
 // Durable batches may arrive out of order; reconstruct the UI timeline by capture ordinal.
 const changes=logs.filter(r=>r.event.type==='identity_observed'&&r.event.data.action==='selection_changed')
  .sort((a,b)=>a.event.data.checkpointState.captureOrdinal-b.event.data.checkpointState.captureOrdinal);
 assert.equal(changes.length,2,'both pre-audio learner changes must be retained');
 assert.deepEqual(changes.map(r=>r.event.data.checkpointState.selected.label),['Học viên A giả','Học viên B giả']);
 assert.equal(changes[1].event.data.checkpointState.previous.value,'fixture-A');
 assert.ok(changes.every(r=>r.event.data.identityConfirmed===false&&Date.parse(r.event.data.checkpointState.observedAt)<=selectedAt));
 assert.ok(proofs.every(p=>!p.attemptToken&&!p.examSessionToken&&!p.studentRef),'DOM selection must not mint student authority');
 assert.ok(logs.some(r=>r.event.data.action==='capture_started'));
 await until(()=>logs.some(r=>r.event.type==='button_clicked'&&r.event.data.action==='confirmIdentity'));
 assert.equal(await page.locator('#answer').inputValue(),'unchanged');
 assert.equal(await page.locator('#bootstrapStart').isDisabled(),true);
 assert.equal(JSON.stringify(logs).includes('never-capture-this'),false);
 assert.deepEqual(errors,[]);
 results.push({case:'pre-audio selection history',status:'PASS',changes:changes.length});
 // Observe restored values without inventing a trusted user event; distinguish clear/change.
 const offset=logs.length;
 await page.evaluate(()=>{document.querySelector('#bootstrapStudent').value='fixture-A';});
 await page.waitForTimeout(1150);
 await page.selectOption('#bootstrapStudent','');
 await page.locator('#bootstrap-change-remembered-student').click();
 await until(()=>logs.slice(offset).some(r=>r.event.data.action==='change_learner_requested'));
 const restored=logs.slice(offset).find(r=>r.event.data.action==='selection_changed'&&r.event.data.checkpointState.selected.value==='fixture-A');
 assert.equal(restored?.event.data.checkpointState.source,'programmatic_or_initial');
 assert.equal(restored?.event.data.trusted,false);
 assert.ok(logs.slice(offset).some(r=>r.event.data.action==='selection_changed'&&r.event.data.checkpointState.selected.value===''));
 assert.ok(logs.slice(offset).some(r=>r.event.data.action==='change_learner_requested'));
 results.push({case:'programmatic restore, clear, change learner',status:'PASS'});
 // A request finishing after class navigation stays with its class at start.
 const crossing=await page.evaluate(()=>{
  const request=window.EXAM_JOURNAL_STARTUP.startRequest('/api/term-tests/roster?secret=do-not-log',{method:'GET'});
  history.replaceState({},'',location.pathname+'?class=ICFIXB');
  request.done({},undefined,200);
  return document.querySelector('#answer').value;
 });
 await page.selectOption('#bootstrapStudent','fixture-B');
 await until(()=>logs.some(r=>r.event.type==='request_finished'&&r.event.data.route==='/api/term-tests/roster')&&logs.some(r=>r.bindingId==='b'.repeat(64)&&r.event.data.action==='selection_changed'));
 const start=logs.findLast(r=>r.event.type==='request_started'&&r.event.data.route==='/api/term-tests/roster');
 const finish=logs.find(r=>r.event.type==='request_finished'&&r.event.data.requestId===start?.event.data.requestId);
 assert.equal(start?.bindingId,'a'.repeat(64));assert.equal(finish?.bindingId,start?.bindingId);
 assert.ok(logs.some(r=>r.bindingId==='b'.repeat(64)&&r.event.data.action==='selection_changed'));
 assert.equal(crossing,'unchanged');assert.equal(JSON.stringify(logs).includes('do-not-log'),false);
 results.push({case:'request and choice class isolation',status:'PASS'});
 await page.close();
 // Disabled capture must leave no producer, requests, or UI differences.
 const disabled=await browser.newPage();const beforeDisabled=requests.length;
 await disabled.goto(url+'/fixture?class=ICFIXA&enabled=false');
 await disabled.selectOption('#bootstrapStudent','fixture-A');
 assert.equal(await disabled.evaluate(()=>typeof window.EXAM_JOURNAL_STARTUP),'undefined');
 assert.equal(requests.slice(beforeDisabled).some(r=>r.path.includes('/journal-')),false);
 await disabled.close();results.push({case:'disabled producer',status:'PASS'});
 // Collector outage: bounded buffer, no dependency on UI, loss is explicit after recovery.
 denyContext=true;
 const offline=await browser.newPage();await offline.goto(url+'/fixture?class=ICFIXA');
 const stressed=await offline.evaluate(()=>{
  const began=performance.now(),el=document.querySelector('#bootstrapStudent');
  for(let n=0;n<800;n++){el.value=n%2?'fixture-A':'fixture-B';el.dispatchEvent(new Event('change',{bubbles:true}));}
  const status=window.EXAM_JOURNAL_STARTUP.status();
  return {...status,elapsed:performance.now()-began,value:el.value};
 });
 assert.ok(stressed.queued<=128&&stressed.bytes<=64*1024&&stressed.lostCount>0);
 assert.equal(stressed.value,'fixture-A');assert.ok(stressed.elapsed<2000);
 denyContext=false;
 await offline.waitForFunction(()=>window.EXAM_JOURNAL_STARTUP.status().queued===0,{},{timeout:20000});
 await until(()=>logs.some(r=>r.event.type==='sequence_gap'&&r.event.data.cause==='initialization_buffer_budget'));
 assert.ok(logs.some(r=>r.event.type==='sequence_gap'&&r.event.data.cause==='initialization_buffer_budget'&&r.event.data.lostCount>0));
 assert.equal(await offline.locator('#bootstrapStart').isDisabled(),true);
 await offline.close();results.push({case:'collector outage, budget, recovery and unchanged UI',status:'PASS',buffer:stressed});
 const noClass=await browser.newPage();const beforeClass=logs.length,proofBefore=proofs.length;
 await noClass.goto(url+'/fixture');await noClass.selectOption('#bootstrapStudent','fixture-A');
 assert.equal(proofs.length,proofBefore,'unknown class must not mint a fabricated class proof');
 await noClass.evaluate(()=>{
  const picker=document.createElement('select');picker.id='bootstrapClass';picker.innerHTML='<option value="">Chọn lớp</option><option value="ICFIXA">Lớp A giả</option>';
  document.body.append(picker);
 });
 await noClass.selectOption('#bootstrapClass','ICFIXA');
 await until(()=>logs.slice(beforeClass).some(r=>r.event.data.checkpointState?.scopeClassSource==='later_page_hint'));
 assert.ok(logs.slice(beforeClass).some(r=>r.event.data.checkpointState?.classCodeAtObservation===''&&r.event.data.checkpointState?.scopeClassSource==='later_page_hint'));
 await noClass.close();results.push({case:'unknown initial class is explicit and recoverable',status:'PASS'});
}catch(error){results.push({status:'FAIL',message:error.message});process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(evidence,'browser.json'),JSON.stringify({results,proofs,logs,requests},null,2));}
console.log(JSON.stringify(results));
