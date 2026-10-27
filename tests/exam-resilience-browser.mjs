import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const evidence=process.env.EXAM_RESILIENCE_EVIDENCE||path.join(root,'output/playwright/exam-resilience');let server,browser,base;
before(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 server=createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture');if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html;charset=UTF-8');return res.end('<!doctype html><html><head><meta charset="UTF-8"></head><body><main id="app"></main></body></html>');}
  const p=path.resolve(root,'.'+url.pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({channel:'msedge',headless:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function context(width=1280){const c=await browser.newContext({viewport:{width,height:900}});await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());return c;}
async function page(c,script){const p=await c.newPage();p.on('dialog',d=>d.accept());await p.goto(base+'/fixture');await p.addScriptTag({url:base+script});return p;}

test('K56: real Web Locks preserve owner across lost start ACK/reload and exclude a second tab, including BFCache return',async()=>{
 const c=await context(),other=await context();
 try{
  const a=await page(c,'/term-tests/k56-audio-recovery.js');
  const options={apiBase:base,classCode:'FIXTURE',slug:'term-test-1-k56',studentRef:'fictional',token:'11111111-1111-4111-8111-111111111111',generation:0};
  const first=await a.evaluate(x=>window.K56AudioRecovery.prepare(x),options);
  const b=await page(c,'/term-tests/k56-audio-recovery.js');
  await assert.rejects(b.evaluate(x=>window.K56AudioRecovery.prepare(x),options),/tab khác/);
  await a.reload();await a.addScriptTag({url:base+'/term-tests/k56-audio-recovery.js'});
  assert.equal((await a.evaluate(x=>window.K56AudioRecovery.prepare(x),options)).ownerId,first.ownerId);
  await a.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  assert.equal((await b.evaluate(x=>window.K56AudioRecovery.prepare(x),options)).ownerId,first.ownerId);
  await assert.rejects(a.evaluate(x=>window.K56AudioRecovery.prepare(x),options),/tab khác/);
  const device=await page(other,'/term-tests/k56-audio-recovery.js');
  assert.notEqual((await device.evaluate(x=>window.K56AudioRecovery.prepare(x),options)).ownerId,first.ownerId);
 }finally{await c.close();await other.close();}
});

for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56'])test(`${slug}: the real bootstrap loading request keeps the recovered owner after reload`,async()=>{
 const c=await context();try{
  const p=await page(c,'/term-tests/k56-audio-recovery.js');
  const options={apiBase:base,classCode:'FIXTURE',slug,studentRef:'synthetic',token:'11111111-1111-4111-8111-111111111111',generation:0};
  const first=await p.evaluate(x=>window.K56AudioRecovery.prepare(x),options);
  await p.reload();await p.addScriptTag({url:base+'/term-tests/k56-audio-recovery.js'});
  const source=fs.readFileSync(path.join(root,`term-tests/${slug}-computer-based/bootstrap.js`),'utf8');
  const start=source.indexOf('      const loading = window.K56AudioRecovery.beginLoading('),end=source.indexOf('      Object.assign(started, loadingResponse);',start);assert.ok(start>0&&end>start);
  const snippet=source.slice(start,end+'      Object.assign(started, loadingResponse);'.length);
  const result=await p.evaluate(async({options,expected,snippet})=>{
   const resumed=await window.K56AudioRecovery.prepare(options);
   if(resumed.ownerId!==expected||window.K56AudioRecovery.ownerId===expected)throw Error('reload fixture did not create a distinct page ID');
   const state={examSessionToken:options.token,studentRef:options.studentRef,generation:0},started={generation:0,audioStateRevision:4,listeningResumeAtSeconds:23,listeningDeadlineAt:'2026-10-27T01:00:00Z'};
   let request;const apiRequest=async(_url,init)=>{request=JSON.parse(init.body);if(request.audioOwnerId!==expected)throw Error('native AUDIO_OWNER_CONFLICT: loading pause used a different owner');return{audioStateRevision:5};};
   await new (Object.getPrototypeOf(async function(){}).constructor)('appConfig','classCode','testConfig','state','started','apiRequest',snippet)({API_BASE_URL:options.apiBase},options.classCode,{slug:options.slug},state,started,apiRequest);
   return{owner:request.audioOwnerId,heard:request.heardSeconds,revision:started.audioStateRevision,deadline:started.listeningDeadlineAt};
  },{options,expected:first.ownerId,snippet});
  assert.deepEqual(result,{owner:first.ownerId,heard:23,revision:5,deadline:'2026-10-27T01:00:00Z'});
 }finally{await c.close();}
});

test('source retry offers a fallback only after a source failure and keeps the existing retry/session path',async()=>{
 const c=await context();try{
  const p=await c.newPage();await p.goto(base+'/fixture');
  await p.evaluate(()=>{document.getElementById('app').innerHTML='<p id="bootstrapDownloadStatus"></p><button id="bootstrapRetry" hidden>Thử tải lại audio</button>';window.fixtureRetryCount=0;localStorage.setItem('fixture-session','kept');document.getElementById('bootstrapRetry').addEventListener('click',()=>window.fixtureRetryCount++);});
  await p.addScriptTag({url:base+'/term-tests/shared/audio-source-choice.js'});
  assert.equal(await p.locator('#bootstrapFallback').isVisible(),false);
  await p.evaluate(()=>{document.getElementById('bootstrapRetry').hidden=false;});
  assert.equal(await p.locator('#bootstrapFallback').isVisible(),false,'authorization errors never offer a source bypass');
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('term-test:audio-source',{detail:{source:'primary-error'}})));
  await p.getByRole('button',{name:'Tải bằng nguồn dự phòng',exact:true}).click();
  assert.deepEqual(await p.evaluate(()=>({count:window.fixtureRetryCount,source:window.IZONE_AUDIO_PREFER_FALLBACK,state:localStorage.getItem('fixture-session')})),{count:1,source:true,state:'kept'});
 }finally{await c.close();}
});

for(const width of [1280,390])test(`teacher recovery ${width}px: confirmation, stable retry identity and preserved pending payload`,async()=>{
 const c=await context(width);
 try{
  const p=await page(c,'/term-tests/shared/exam-clock.js');
  await p.addStyleTag({url:base+'/term-tests/shared/styles.css'});
  await p.addStyleTag({url:base+'/term-tests/teacher/styles.css'});
  await p.evaluate(async()=>{
   const {openTeacherAudioRecovery}=await import('/term-tests/shared/teacher-audio-recovery.js');
   window.fixtureCalls=[];window.fixtureCurrent=true;window.fixtureWrites=0;
   const state={found:true,version:'a'.repeat(64),generation:0,name:'Học viên giả',startedAt:'2026-10-26T12:00:00Z',submittedAt:null,deadlineAt:'2026-10-26T12:30:00Z',checkpointSeconds:77,draftRevision:9,answeredCount:12,occupied:true,canReleasePreparation:false,canTransferActive:true};
   openTeacherAudioRecovery({student:{ref:'11111111-1111-4111-8111-111111111111',name:'Học viên giả'},className:'FIXTURE',testSlug:'term-test-2',request:async(url,options={})=>{
    window.fixtureCalls.push({url,...options});if(options.method!=='POST')return {ok:true,state};
    if(window.fixtureWrites++===0)throw new TypeError('lost response after commit');
    return {ok:true,recovered:true,replayed:true,state:{...state,occupied:false,canTransferActive:false}};
   },isCurrent:()=>window.fixtureCurrent});
  });
  await p.getByLabel('Lý do hỗ trợ').fill('Thiết bị cũ đã đóng');await p.getByRole('button',{name:'Hỗ trợ chuyển thiết bị',exact:true}).click();
  assert.equal(await p.evaluate(()=>window.fixtureWrites),0,'active transfer requires stopped-device acknowledgement');
  await p.getByLabel('Tôi đã xác nhận tab hoặc thiết bị cũ đã dừng/đóng.').check();await p.getByRole('button',{name:'Hỗ trợ chuyển thiết bị',exact:true}).click();
  await p.getByRole('button',{name:'Kiểm tra lại thao tác vừa gửi'}).waitFor({state:'visible'});
  await p.getByLabel('Lý do hỗ trợ').fill('Changed text must not change the pending request');
  await p.getByRole('button',{name:'Kiểm tra lại thao tác vừa gửi'}).click();
  await p.getByText('Đã lưu thao tác hỗ trợ.',{exact:false}).waitFor();
  const writes=await p.evaluate(()=>window.fixtureCalls.filter(x=>x.method==='POST').map(x=>JSON.parse(x.body)));
  assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);assert.equal(writes[0].class,'FIXTURE');assert.equal(writes[0].test,'term-test-2');
  await p.screenshot({path:path.join(evidence,`teacher-recovery-${width}.png`)});
  const size=await p.locator('dialog').evaluate(n=>({scroll:n.scrollWidth,client:n.clientWidth,children:[...n.children].map(x=>({tag:x.tagName,w:x.getBoundingClientRect().width,scroll:x.scrollWidth,client:x.clientWidth}))}));
  assert.ok(size.scroll<=size.client,JSON.stringify(size));
 }finally{await c.close();}
});

test('clock wake after network failure shows retry and resumes from a fresh server sample',async()=>{
 const c=await context();try{
  const p=await page(c,'/term-tests/shared/exam-clock.js');
  await p.evaluate(async()=>{window.failClock=false;await window.IZONE_EXAM_CLOCK.configure(async()=>{if(window.failClock)throw Error('offline');return {serverNow:new Date().toISOString()};});window.failClock=true;document.dispatchEvent(new Event('resume'));});
  await p.getByRole('button',{name:'Đối chiếu lại giờ'}).waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>Number.isNaN(window.IZONE_EXAM_CLOCK.now())),true);
  await p.evaluate(()=>window.failClock=false);await p.getByRole('button',{name:'Đối chiếu lại giờ'}).click();
  await p.waitForFunction(()=>window.IZONE_EXAM_CLOCK.ready);assert.equal(await p.locator('#examClockNotice').isVisible(),false);
 }finally{await c.close();}
});
