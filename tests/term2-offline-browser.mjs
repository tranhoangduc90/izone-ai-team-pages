// Trình duyệt thật, API/danh tính giả, source giao diện thật. Không nộp bài học viên.
import {createServer} from 'node:http';
import {appendFile,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {canonical} from '../term-tests/term-test-2-k56-computer-based/offline.mjs';
import {ASSETS as audioCatalog} from '../shared/audio/catalog.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),output=process.env.TERM2_EVIDENCE||resolve(root,'output/term2-offline');
const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')))('playwright');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'};
export async function fixture(mode,{profile,native,product=2,paper=false,demo=false,port=0,defaultAutoplay=false,headed=false,
 allowBackForwardCache=false}={}){
 await mkdir(output,{recursive:true});
 const controls={assetFailures:new Set(),assetOverrides:new Map(),realAudio:false,r2Audio:false,primaryAudioFail:false,audioCalls:[],apiDelayMs:0};
 const blockJournalAssets=process.env.K56_BLOCK_JOURNAL_ASSETS==='1';
 const blockedJournalAssets=new Set();
 const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost'),p=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(!p.startsWith(root+sep)&&p!==root)return res.writeHead(403).end();
  if(blockJournalAssets&&url.pathname.startsWith('/term-tests/shared/exam-journal/')){
   blockedJournalAssets.add(url.pathname);
   return res.writeHead(503,{'cache-control':'no-store'}).end('Fixture unavailable journal asset');
  }
  if(controls.assetFailures.has(url.pathname))return res.writeHead(503).end('Fixture unavailable asset');
  try{let data=controls.assetOverrides.has(url.pathname)?Buffer.from(controls.assetOverrides.get(url.pathname)):await readFile(p);if(['.html','.js','.mjs','.css','.svg'].includes(extname(p)))data=Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'));res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end();}});
 await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});const base=`http://127.0.0.1:${server.address().port}`;
 const launchOptions={channel:process.env.TERM2_BROWSER_CHANNEL||'msedge',headless:!headed,
 ...(allowBackForwardCache?{ignoreDefaultArgs:['--disable-back-forward-cache']}:{}),
  args:defaultAutoplay?[]:['--autoplay-policy=no-user-gesture-required']},contextOptions={acceptDownloads:true,viewport:{width:1440,height:1000}};
 const profileDir=profile?resolve(output,profile):null;
 let browser,context,page;
 if(profileDir){context=await chromium.launchPersistentContext(profileDir,{...launchOptions,...contextOptions});browser=context.browser();}
 else{browser=await chromium.launch(launchOptions);context=await browser.newContext(contextOptions);}
 page=await context.newPage();
 const id=native?.a||randomUUID(),session=native?.s||randomUUID(),student=native?.student||randomUUID(),receipts=new Map(),calls=[],errors=[];let disconnected=false,fixtureContent,onlineRevision=0;
 let onlineReadingStartedAt=null, onlineListeningStartedAt=null, onlineReadingSubmitted=false;
 const journalBindings=new Map(),journalBatches=new Set();
 function handleDialog(dialog){
  if(dialog.type()==='beforeunload'&&controls.beforeUnloadSpies){
   controls.beforeUnloadSpies.push({message:dialog.message(),decision:controls.beforeUnloadDecision});
   return controls.beforeUnloadDecision==='stay'?dialog.dismiss():dialog.accept();
  }
  if(dialog.type()==='confirm'&&controls.dismissNextConfirmation){controls.dismissNextConfirmation=false;return dialog.dismiss();}
  return dialog.accept();
 }
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',handleDialog);
 const mini=product==='mini';
 const slug=mini?'mini-test-k56':'term-test-'+product+'-k56';
 const classCode=demo?'CODEXDEMO56':'IC5601';
 const asset=audioCatalog[slug];
 const audio=await readFile(resolve(root,'term-tests/k56-audio-assets',new URL(asset.url).pathname.split('/').pop()));
 const routeHandler=async route=>{
  const request=route.request(),u=new URL(request.url());
  const fulfill=route.fulfill.bind(route);route.fulfill=options=>fulfill({...options,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS',...options.headers}});
  if(u.origin===base)return route.continue();
  if(disconnected)return route.abort('internetdisconnected');
  if(u.pathname.endsWith('.mp3')){
   controls.audioCalls.push(u.origin+u.pathname);
   if(controls.realAudio)return route.continue();
   const isR2=u.hostname.endsWith('.r2.cloudflarestorage.com');
   if(controls.primaryAudioFail&&isR2)return route.fulfill({status:403,body:'Expired'});
   if(controls.pagesAudioFail&&!isR2)return route.fulfill({status:503,body:'Unavailable'});
   if(controls.corruptR2&&isR2)return route.fulfill({body:Buffer.alloc(audio.length,1),contentType:'audio/mpeg'});
   return route.fulfill({body:audio,contentType:'audio/mpeg'});
  }
  if(!u.pathname.includes('/api/term-tests/'))return route.abort();
  const endpoint=u.pathname.split('/api/term-tests/')[1],body=request.method()==='POST'?request.postDataJSON():{};calls.push(endpoint);
  if(controls.journalBatchFile&&endpoint.endsWith('/journal-context')){
   if(body.examSessionToken&&body.examSessionToken!==session||body.attemptToken&&body.attemptToken!==id){
    return route.fulfill({status:403,json:{ok:false,error:'FIXTURE_JOURNAL_SCOPE'}});
   }
   const bindingId=createHash('sha256').update(canonical(body)).digest('hex');
   let binding=journalBindings.get(bindingId);
   if(!binding){
    binding={ok:true,bindingId,ticket:'local-test-only',ticketId:randomUUID(),issuedAt:Date.now(),expiresAt:Date.now()+3600000,
     identityConfirmed:Boolean(body.examSessionToken||body.attemptToken),versions:{definitionVersion:'fixture'}};
    journalBindings.set(bindingId,binding);
   }
   return route.fulfill({json:binding});
  }
  if(controls.journalBatchFile&&endpoint.endsWith('/journal-pilot-context')){
   return route.fulfill({json:{ok:true,destination:'collector-v1'}});
  }
  if(controls.journalBatchFile&&endpoint.endsWith('/journal-collector-sealed')){
   const binding=journalBindings.get(body.bindingId);
   const ids=body.events.map(event=>event.id);
   const payloadHash=createHash('sha256').update(canonical(body.events)).digest('hex');
   const batchId=createHash('sha256').update(canonical([body.bindingId,[...ids].sort()])).digest('hex');
   if(!binding||binding.ticketId!==body.auth?.ticketId||body.eventPayloadSha256!==payloadHash||body.batchId!==batchId){
    return route.fulfill({status:403,json:{ok:false,error:'FIXTURE_JOURNAL_SCOPE'}});
   }
   if(controls.failFirstPlayerAnomalyBatch&&!controls.failedJournalBatch&&body.events.some(event=>
    event.data.checkpointState?.action==='audio_anomaly'&&event.data.checkpointState.playerId)){
    controls.failedJournalBatch=batchId;
    return route.fulfill({status:503,json:{ok:false,error:'FIXTURE_JOURNAL_RETRY'}});
   }
   if(!journalBatches.has(batchId)){
    journalBatches.add(batchId);
    try{
     const rows=body.events.filter(event=>event.data.checkpointState?.playerId);
     await appendFile(controls.journalBatchFile,JSON.stringify({bindingId:body.bindingId,batchId,identityConfirmed:binding.identityConfirmed,rows})+'\n');
    }catch(error){journalBatches.delete(batchId);throw error;}
   }
   return route.fulfill({json:{ok:true,persisted:true,storage:'collector',scopeId:body.bindingId,batchId,
    eventPayloadSha256:payloadHash,acknowledgedIds:ids}});
  }
  if(controls.apiDelayMs&&endpoint.includes('/offline/')){await new Promise(ok=>setTimeout(ok,controls.apiDelayMs));return route.fulfill({status:503,json:{ok:false,error:'FIXTURE_SLOW_UNAVAILABLE'}}).catch(()=>{});}
  if(endpoint.startsWith('roster'))return route.fulfill({json:{class:{name:classCode},students:[{ref:student,name:'Học viên giả Term 2'}]}});
  if(endpoint.endsWith('student-identity'))return route.fulfill({json:{ok:true,status:'missing'}});
  if(endpoint==='result'&&controls.resultResponse)return route.fulfill({json:controls.resultResponse});
  if(endpoint==='result/stream')return route.fulfill({status:404,json:{ok:false}});
  const content=fixtureContent||(fixtureContent=await page.evaluate(()=>window.K56_TERM_TEST_CONTENT));
  if(native&&(endpoint.includes('/offline/')||(native.admission&&endpoint.endsWith('/attempt/prepare'))||(mini&&endpoint.endsWith('/listening/report')))){
   Object.assign(native.content,content);
   const response=await fetch(native.base+endpoint.slice(slug.length),{method:'POST',headers:{'content-type':'application/json','x-term2-permit':request.headers()['x-term2-permit']||'','x-exam-journal-request-id':request.headers()['x-exam-journal-request-id']||''},body:request.postData()});
   const json=await response.json();
   if((controls.loseAck===true?'seal':controls.loseAck)===body.kind&&!controls.ackLost&&endpoint.endsWith('/offline/operation')&&json.receipt?.status==='accepted'){
    controls.ackLost=true;return route.abort();
   }
   return route.fulfill({status:response.status,json});
  }
  const timing=mini?{listeningDurationSeconds:446,listeningReviewSeconds:0,readingDurationMinutes:25,writingDurationMinutes:15}
   :product===2?{listeningDurationSeconds:1824,listeningReviewSeconds:0,readingDurationMinutes:60,writingDurationMinutes:30}:{listeningDurationSeconds:1848,listeningReviewSeconds:0,readingDurationMinutes:40,writingDurationMinutes:55};
  const prepared={ok:true,attemptToken:id,examSessionToken:session,studentRef:student,studentName:'Học viên giả Term 2',generation:native?.generation??0,examMode:mode,nextSection:mode==='read_first'&&!onlineReadingSubmitted?'reading':'listening',serverNow:new Date().toISOString(),
   listeningSubmitted:false,readingSubmitted:false,content,timing,attemptMode:paper?'answer_sheet':'cbt',policy:{timed:!paper,autoSubmit:!paper},...controls.preparedOverride};
  if(controls.onlineTerm2){
   Object.assign(prepared,{readingStartedAt:onlineReadingStartedAt,readingSubmitted:onlineReadingSubmitted});
   if(endpoint.endsWith('/attempt/active'))return route.fulfill({json:{...prepared,found:onlineReadingStartedAt!==null||onlineListeningStartedAt!==null}});
   if(endpoint.endsWith('/offline/prepare'))return route.fulfill({status:503,json:{ok:false,error:'OFFLINE_NEW_DISABLED'}});
   if(endpoint.endsWith('/reading/start')){
    onlineReadingStartedAt=prepared.serverNow;
    return route.fulfill({json:{...prepared,readingStartedAt:onlineReadingStartedAt,readingDeadlineAt:new Date(Date.now()+3600000).toISOString()}});
   }
   if(endpoint.endsWith('/reading')){
    onlineReadingSubmitted=true;
    return route.fulfill({json:{...prepared,readingSubmitted:true,nextSection:'listening',completed:false}});
   }
   if(endpoint.endsWith('/session/start')||endpoint.endsWith('/session/audio-progress')){
    onlineListeningStartedAt??=prepared.serverNow;
    return route.fulfill({json:{...prepared,audioRecoveryVersion:2,audioStateRevision:++onlineRevision,
     listeningResumeAtSeconds:Number(body.heardSeconds)||0,listeningStartedAt:onlineListeningStartedAt,
     listeningDeadlineAt:new Date(Date.now()+1824000).toISOString(),listeningHardDeadlineAt:new Date(Date.now()+2724000).toISOString()}});
   }
   if(endpoint.endsWith('/listening')){
    controls.onlineListeningSeals??=[];
    controls.onlineListeningSeals.push({answers:body.answers,studentRef:body.studentRef});
    return route.fulfill({json:{...prepared,listeningSubmitted:true,completed:onlineReadingSubmitted,
     nextSection:onlineReadingSubmitted?'writing':'reading',portalSyncStatus:'pending'}});
   }
   if(endpoint.endsWith('/draft')||endpoint.endsWith('/client-event'))return route.fulfill({json:{ok:true,revision:1}});
  }
  if(endpoint.endsWith('/attempt/prepare')){
   if(controls.redactListening)prepared.content={...content,listening:{...content.listening,sections:[]}};
   if(mini&&controls.onlineMini){
    const chunkSize=1_048_576,chunks=[];
    for(let start=0;start<audio.byteLength;start+=chunkSize){
     const bytes=audio.subarray(start,start+chunkSize);
     chunks.push({byteLength:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
    prepared.audioManifest={...asset,envelopeVersion:'MP3',assetVersion:'sha256-'+asset.sha256,
     encryptedByteLength:asset.byteLength,chunkSize,chunks};
   }
   return route.fulfill({json:prepared});
  }
  if(mini&&controls.onlineMini){
   const audioState={ok:true,audioRecoveryVersion:2,audioStateRevision:++onlineRevision,generation:0,
    listeningResumeAtSeconds:Number(body.heardSeconds)||0,listeningStartedAt:prepared.serverNow,
    listeningDeadlineAt:new Date(Date.now()+446000).toISOString(),listeningHardDeadlineAt:new Date(Date.now()+1346000).toISOString(),
    serverNow:prepared.serverNow};
   if(endpoint.endsWith('/session/start'))return route.fulfill({json:{...prepared,...audioState}});
   if(endpoint.endsWith('/session/audio-progress')){
    if(body.manualListeningReport){
     controls.manualCheckpoint=body;
     audioState.miniListeningReportGrant={attemptToken:id,examSessionToken:session,generation:0,
      ownerId:body.audioOwnerId,operationId:body.recoveryId,capability:'synthetic-online-scoped-grant'};
    }
    return route.fulfill({json:audioState});
   }
  }
  if(endpoint.endsWith('/offline/prepare')){
   if(mini&&controls.onlineMini)return route.fulfill({status:503,json:{ok:false,error:'OFFLINE_NEW_DISABLED'}});
   if(controls.denyOfflinePrepare)return route.fulfill({status:403,json:{ok:false,error:'FIXTURE_ACCESS_DENIED',message:'Fixture từ chối quyền thi.'}});
   const audioDownload=controls.r2Audio&&body.audioTransport==='r2-direct-v1'
    ? {version:1,policy:'r2-direct-v1',method:'GET',url:`https://e340869dcc6ff285504947407d148104.r2.cloudflarestorage.com/izone-audio-r2-lab-20261023/${asset.key}?X-Amz-Signature=fixture`,sha256:asset.sha256,byteLength:asset.byteLength,validForSeconds:600,fallback:'public-pages'}
    : undefined;
   return route.fulfill({json:{...prepared,audioDownload,offline:{policy:mini?'mini-k56-offline-v1':`term${product}-offline-v1`,permit:'fixture-permit-no-production-authority',ownerId:body.ownerId,preparedAt:prepared.serverNow,...(controls.listeningReportsEnabled?{listeningReportsEnabled:true}:{})}}});
  }
  if(endpoint.endsWith('/offline/status'))return route.fulfill({json:{ok:true,persisted:receipts.has(body.operationId),receipt:receipts.get(body.operationId)||null}});
  if(product===1&&endpoint.endsWith('/offline/resume'))return route.fulfill({json:{ok:true,completedElsewhere:controls.completedElsewhere||{}}});
  if(endpoint.endsWith('/offline/operation')){
   const payloadHash=createHash('sha256').update(canonical(body)).digest('hex');
   const existing=receipts.get(body.operationId);
   if(existing)return existing.payloadHash===payloadHash
    ?route.fulfill({json:{ok:true,persisted:true,receipt:existing}})
    :route.fulfill({status:409,json:{ok:false,error:'FIXTURE_OPERATION_CONFLICT'}});
   const receipt={version:1,receiptId:randomUUID(),operationId:body.operationId,payloadHash,attemptToken:id,examSessionToken:session,generation:0,...controls.recoveredRun,section:body.section,kind:body.kind,acceptedRevision:body.revision,status:'accepted',serverCommittedAt:new Date().toISOString()};
   if(mini&&body.kind==='seal'&&body.section==='writing'&&!body.payload.task2.replace(/[\s\p{Default_Ignorable_Code_Point}]/gu,''))receipt.writingBlank=true;
   receipts.set(body.operationId,receipt);
   if((controls.loseAck===true?'seal':controls.loseAck)===body.kind&&!controls.ackLost){controls.ackLost=true;return route.abort();}
   return route.fulfill({json:{ok:true,persisted:true,receipt}});
  }
  return route.fulfill({status:404,json:{ok:false,error:'FIXTURE_UNEXPECTED',message:endpoint}});
 };
 await context.route('**/*',routeHandler);
 const url=base+`/term-tests/${slug}${paper?'':'-computer-based'}/${demo?'demo-journal-v1/':''}?class=${classCode}&mode=${mode}`;
 return {get page(){return page;},get context(){return context;},get browser(){return browser;},server,url,student,calls,errors,receipts,controls,get disconnected(){return disconnected;},set disconnected(v){disconnected=v;},
  assertJournalFaultExercised(){if(blockJournalAssets)assert.ok(blockedJournalAssets.has('/term-tests/shared/exam-journal/bridge.mjs'),'Expected the exam journal bridge request to fail');},
  reopen:async({offline=false}={})=>{assert.ok(profileDir);await browser.close();context=await chromium.launchPersistentContext(profileDir,{...launchOptions,...contextOptions});browser=context.browser();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',handleDialog);await context.route('**/*',routeHandler);await context.setOffline(offline);},
  close:async()=>{await browser.close();await new Promise(ok=>server.close(ok));}};
}
export async function wait(page,fn,label,timeout=60000){try{await page.waitForFunction(fn,{},{timeout});}catch(e){throw Error(label+': '+JSON.stringify({text:(await page.locator('body').innerText()).slice(0,2000),errors:await page.evaluate(()=>window.__errors||[])}),{cause:e});}}
export async function activateWorkerUpdate(page) {
  await page.evaluate(async () => {
   const registration = await navigator.serviceWorker.getRegistration();
   const previous = navigator.serviceWorker.controller;
   const deadline = performance.now() + 40000;
   await registration.update();
   while (navigator.serviceWorker.controller === previous && !registration.waiting) {
    if (performance.now() >= deadline) throw new Error('Vỏ offline mới chưa cài xong.');
    await new Promise(resolve => setTimeout(resolve, 100));
   }
   const waiting = registration.waiting;
   if (waiting) await new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('Không nhận được phản hồi ACTIVATE.')), 5000);
    channel.port1.onmessage = event => {
     clearTimeout(timeout);
     if (event.data.ok) resolve();
     else reject(new Error(event.data.error));
    };
    waiting.postMessage({ type: 'ACTIVATE' }, [channel.port2]);
   });
   while (navigator.serviceWorker.controller === previous) {
    if (performance.now() >= deadline) throw new Error('Vỏ offline mới chưa nắm quyền điều khiển.');
    await new Promise(resolve => setTimeout(resolve, 100));
   }
  });
}
if(!process.env.TERM2_FULL_ROUND&&!process.env.K56_FIXTURE_IMPORT_ONLY)for(const mode of ['lis_first','read_first'])test('Term 2 offline/phục hồi/tải file: '+mode,{timeout:180000},async()=>{
 const f=await fixture(mode),p=f.page;f.controls.r2Audio=true;
 try{
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM2_OFFLINE?.active,'Chuẩn bị offline');
  assert.equal(f.controls.audioCalls.length,1);
  assert.match(f.controls.audioCalls[0],/\.r2\.cloudflarestorage\.com/);
  assert.equal(await p.evaluate(()=>JSON.stringify(window.K56_TERM2_OFFLINE.record).includes('X-Amz-Signature')),false);
  f.disconnected=true;await f.context.setOffline(true);
  if(mode==='lis_first'){
   await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');
   await wait(p,()=>window.K56_TERM2_APP_READY&&window.K56_LISTENING_AUDIO,'Màn Listening sẵn sàng');
   await p.locator('#listeningQuestions input[data-number]').first().fill('answer kept offline');
   const before=await p.evaluate(()=>window.K56_TERM2_OFFLINE.player.currentTime);await p.waitForTimeout(2200);
   const after=await p.evaluate(()=>window.K56_TERM2_OFFLINE.player.currentTime);assert.ok(after>before+1,'Audio không tiến khi mất mạng');
   await p.evaluate(()=>window.K56_TERM2_OFFLINE.player.dispatchEvent(new Event('error')));
   await p.waitForTimeout(1000);assert.equal(await p.locator('#listeningView').isVisible(),true);assert.equal(await p.evaluate(()=>window.K56_TERM2_OFFLINE.record.sections.listening.sealed),false);
   const decision=await p.evaluate(()=>window.K56_LISTENING_AUDIO.beforeAutoSubmit());assert.equal(decision.submit,false);
   await p.reload();
   const acknowledge=p.getByRole('button',{name:'Tôi đã hiểu. Đến phần thi tiếp theo.'});
   await acknowledge.waitFor();
   assert.ok(Object.values(await p.evaluate(()=>window.K56_TERM2_OFFLINE.record.snapshot.drafts.listening)).includes('answer kept offline'));
   assert.equal(await p.evaluate(()=>window.K56_TERM2_OFFLINE.record.sections.listening.interrupted),true);
   assert.equal(await p.evaluate(()=>Boolean(window.K56_TERM2_OFFLINE.record.sections.listening.sealed)),false);
   await acknowledge.click();await p.getByRole('button',{name:'Bắt đầu Reading',exact:true}).click();
  } else {await wait(p,()=>window.K56_TERM2_APP_READY,'Reading trước ready');await p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first().click();}
  await p.locator('#readingQuestions input[data-number]').first().fill('reading kept offline');
  await p.reload();await wait(p,()=>window.K56_TERM2_APP_READY,'Reload Reading offline');
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'reading kept offline');
  await p.click('#submitReading');
  if(mode==='read_first'){
   await p.waitForTimeout(500);await wait(p,()=>Boolean(document.getElementById('bootstrapPreview')),'Phòng nghe sau Reading');
   await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');
   await wait(p,()=>window.K56_TERM2_APP_READY&&window.K56_TERM2_OFFLINE.playerReady,'Listening sau Reading');await p.click('#submitListening');
  }
  assert.equal(f.controls.audioCalls.length,1);
  await p.click('#startWriting');await wait(p,()=>!document.getElementById('writingView').hidden,'Writing bắt đầu offline');
  assert.equal(await p.locator('textarea[data-writing-outline]:not([readonly])').count(),0);
  await p.locator('[data-writing-task="task1"]').fill('Unicode giữ bài — <script>alert(1)</script>\nNew paragraph.');
  const d=p.waitForEvent('download');await p.getByRole('button',{name:'Tải bài làm về máy'}).click();const download=await d;
  const file=resolve(output,mode+'-answer.html');await download.saveAs(file);const html=await readFile(file,'utf8');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('fixture-permit'));
  await p.reload();await wait(p,()=>window.K56_TERM2_APP_READY,'Reload Writing offline');assert.ok((await p.locator('[data-writing-task="task1"]').inputValue()).includes('Unicode giữ bài'));
  // Kiểm bài trắng: xóa có chủ đích, nộp và xác nhận theo quy tắc 0; không có endpoint AI.
  await p.locator('[data-writing-task="task1"]').fill('');await p.click('#submitWriting');
  await wait(p,()=>window.K56_TERM2_OFFLINE.record.sections.writing?.sealed,'Khóa Writing offline');
  await wait(p,()=>{
    const notice=document.getElementById('notice');
    const status=document.querySelector('.page-shell > .writing-save-status > span')?.textContent;
    return Boolean(status&&!status.startsWith('Đang lưu')&&notice?.textContent===status);
  },'Thông báo chính theo đúng trạng thái lưu/đồng bộ',5000);
  await p.screenshot({path:resolve(output,mode+'-pending.png'),fullPage:true});
  assert.ok(await p.evaluate(()=>window.K56_TERM2_OFFLINE.pending)>0);
  assert.equal(await p.locator('#viewResult').isDisabled(),true,'Bài chờ biên nhận chưa được mở kết quả');
  f.disconnected=false;await f.context.setOffline(false);await p.evaluate(()=>{window.K56_TERM2_OFFLINE.retryAt=0;return window.K56_TERM2_OFFLINE.flush();});
  await wait(p,()=>window.K56_TERM2_OFFLINE.pending===0,'Gửi lại đủ operation');
  assert.equal(await p.locator('#viewResult').isEnabled(),true);
  assert.equal(await p.locator('#resultReadyView h2').textContent(),'Kết quả của bạn đã sẵn sàng');
  f.assertJournalFaultExercised();
  assert.equal(f.calls.some(x=>x.includes('writing-grading')),false);
  await writeFile(resolve(output,mode+'-result.json'),JSON.stringify({mode,calls:f.calls,errors:f.errors,receipts:[...f.receipts.values()]},null,2));
  assert.deepEqual(f.errors,[]);
 }catch(e){console.error('BROWSER_FAILURE',mode,e.message,JSON.stringify(f.errors));await p.screenshot({path:resolve(output,mode+'-failure.png'),fullPage:true});throw e;}
 finally{await f.close();}
});
