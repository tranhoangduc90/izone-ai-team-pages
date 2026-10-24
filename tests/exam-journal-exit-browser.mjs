// Real navigation and local HTTP receipts; synthetic identities only, no exam API.
// Protects exit delivery before unload, context warm-up and isolation during outages.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=process.env.JOURNAL_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=process.env.JOURNAL_EVIDENCE||path.join(root,'output/exam-journal-exit');
const modules=process.env.CODEX_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(path.join(modules,'playwright/package.json'))('playwright');
const entry=fs.readFileSync(path.join(root,'term-tests/term-test-2-computer-based/index.html'),'utf8');
const definition=entry.match(/src="([^"]*test-config\.js[^\"]*)"/)[1];
const preloads=[...entry.matchAll(/<link rel="modulepreload"[^>]*>/g)].map(m=>m[0].replace('href="../','href="/term-tests/')).join('');
const logs=[],requests=[],proofs=[],results=[];let deny=false,delay=0;
const server=createServer(async(q,s)=>{
 const u=new URL(q.url,'http://local');requests.push({path:u.pathname,at:Date.now()});
 const json=value=>{s.setHeader('Content-Type','application/json');s.end(JSON.stringify(value));};
 if(u.pathname.endsWith('/journal-context')){
  const parts=[];for await(const part of q)parts.push(part);const proof=JSON.parse(Buffer.concat(parts));proofs.push(proof);
  if(delay)await new Promise(r=>setTimeout(r,delay));
  if(deny){s.statusCode=503;return json({ok:false});}
  return json({ok:true,bindingId:'a'.repeat(64),ticket:'synthetic-only',ticketId:crypto.randomUUID(),issuedAt:Date.now(),expiresAt:Date.now()+3600000,identityConfirmed:false,versions:{definitionVersion:'synthetic'}});
 }
 if(u.pathname.endsWith('/journal-events')){
  const parts=[];for await(const part of q)parts.push(part);const body=JSON.parse(Buffer.concat(parts));
  logs.push({at:Date.now(),body});return json({ok:true,persisted:true,scopeId:body.bindingId,acknowledgedIds:body.events.map(e=>e.id)});
 }
 if(u.pathname==='/gone'){s.setHeader('Content-Type','text/html');return s.end('<!doctype html><title>Left fixture</title>');}
 if(u.pathname==='/fixture'){
  s.setHeader('Content-Type','text/html');return s.end(`<!doctype html><head>${preloads}</head><body><script>
   window.TERM_TEST_CONFIG={slug:'term-test-2'};
   window.TERM_TEST_APP_CONFIG={EXAM_JOURNAL_ENABLED:true,API_BASE_URL:location.origin,EXAM_JOURNAL_BUILD:'synthetic'};
   ${u.searchParams.has('blockedStorage')?"Object.defineProperty(window,'indexedDB',{value:{open(){return {};}}});":''}
   </script><script src="/term-tests/term-test-2-computer-based/${definition}"></script>
   <select id="bootstrapStudent"><option value="">Choose</option><option value="fixture-A">Synthetic A</option></select>
   <button id="bootstrap-change-remembered-student" onclick="location.href='/gone'">Change learner</button>
   <input id="answer" value="unchanged"><button id="bootstrapStart" disabled>Start</button></body>`);
 }
 const file=path.resolve(root,'.'+u.pathname);
 if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
  s.setHeader('Content-Type',/\.(mjs|js)$/.test(file)?'text/javascript':'text/plain');return s.end(fs.readFileSync(file));
 }
 s.statusCode=404;s.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});
const events=()=>logs.flatMap(r=>r.body.events);
async function until(fn,ms=4500){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('Missing exit receipt');await new Promise(r=>setTimeout(r,25));}}
async function run(name,fn){try{await fn();results.push({case:name,status:'PASS'});}catch(e){results.push({case:name,status:'FAIL',message:e.message});process.exitCode=1;}}
try{
 for(const blocked of [false,true])await run('real change-learner navigation, storage '+(blocked?'stalled':'normal'),async()=>{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const offset=events().length;await page.goto(url+'/fixture?class=ICFIXA'+(blocked?'&blockedStorage=1':''));
  await until(()=>events().slice(offset).some(e=>e.data.action==='capture_started'));
  const id=events().slice(offset).find(e=>e.data.action==='capture_started').pageVisitId;
  await page.selectOption('#bootstrapStudent','fixture-A');
  assert.equal(await page.locator('#answer').inputValue(),'unchanged');assert.equal(await page.locator('#bootstrapStart').isDisabled(),true);
  await page.locator('#bootstrap-change-remembered-student').click();await page.waitForURL(url+'/gone');
  await until(()=>events().some(e=>e.pageVisitId===id&&e.type==='page_hidden'&&e.data.stage==='initialization'));
  // A normal IDB write can finish before unload while its network ACK is still
  // pending. Reopen the app in the same tab to verify durable replay as well.
  if(!blocked){await page.goto(url+'/fixture?class=ICFIXA');}
  await until(()=>events().some(e=>e.pageVisitId===id&&e.data.action==='change_learner_requested'));
  const rows=events().filter(e=>e.pageVisitId===id);
  assert.ok(rows.some(e=>e.data.action==='change_learner_requested'));
  const exit=rows.find(e=>e.type==='page_hidden'&&e.data.stage==='initialization');
  assert.ok(exit.data.checkpointState.observedAt);assert.ok(['visible','hidden'].includes(exit.data.checkpointState.visibilityState));
  assert.deepEqual(errors,[]);await page.close();
 });
 await run('same-turn visibility/pagehide and return retain distinct lifecycle facts',async()=>{
  const page=await browser.newPage(),offset=events().length;await page.goto(url+'/fixture?class=ICFIXA');
  await until(()=>events().slice(offset).some(e=>e.data.action==='capture_started'));
  const id=events().slice(offset).find(e=>e.data.action==='capture_started').pageVisitId;
  const unchanged=await page.evaluate(()=>{
   Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));
   window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
   return document.querySelector('#answer').value;
  });
  await until(()=>events().some(e=>e.pageVisitId===id&&e.type==='page_hidden'&&e.data.stage==='initialization'&&e.data.persisted===true));
  await until(()=>events().some(e=>e.pageVisitId===id&&e.type==='page_visibility'&&e.data.stage==='initialization'&&e.data.visibility==='hidden'));
  assert.equal(unchanged,'unchanged');await page.close();
 });
 await run('slow context retains early selection without granting learner authority',async()=>{
  delay=600;const page=await browser.newPage(),offset=events().length;
  await page.goto(url+'/fixture?class=ICFIXA');await page.selectOption('#bootstrapStudent','fixture-A');
  await until(()=>events().slice(offset).some(e=>e.data.action==='selection_changed'&&e.data.checkpointState?.selected?.value==='fixture-A'));
  const rows=events().slice(offset);assert.ok(rows.some(e=>e.data.action==='capture_started'));
  assert.ok(proofs.every(p=>!p.attemptToken&&!p.examSessionToken&&!p.studentRef));
  assert.equal(await page.locator('#answer').inputValue(),'unchanged');assert.equal(await page.locator('#bootstrapStart').isDisabled(),true);
  await page.close();delay=0;
 });
 await run('collector outage never holds navigation or changes answers',async()=>{
  deny=true;const page=await browser.newPage();await page.goto(url+'/fixture?class=ICFIXA');
  assert.equal(await page.locator('#answer').inputValue(),'unchanged');
  await page.locator('#bootstrap-change-remembered-student').click();await page.waitForURL(url+'/gone',{timeout:2000});await page.close();deny=false;
 });
 await run('bridge module starts fetching in head before the definition executes',async()=>{
  const page=await browser.newPage(),offset=requests.length;let release;
  const gate=new Promise(r=>release=r);
  await page.route('**/test-config.js?**',async r=>{await gate;await r.continue();});
  const navigation=page.goto(url+'/fixture?class=ICFIXA');
  try{await until(()=>requests.slice(offset).some(r=>r.path.endsWith('/exam-journal/bridge.mjs')),1800);}finally{release();await navigation;}
  await page.close();
 });
}finally{
 await browser.close();await new Promise(r=>server.close(r));fs.mkdirSync(evidence,{recursive:true});
 fs.writeFileSync(path.join(evidence,'exit-browser.json'),JSON.stringify({results,requests,proofs,logs},null,2));
}
console.log(JSON.stringify(results));
