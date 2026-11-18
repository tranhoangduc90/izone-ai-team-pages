// Hồi quy hai lỗi đã tới người dùng. API giả; chặn toàn bộ dịch vụ thật.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.SUBSTITUTE_PAGES_ROOT||fileURLToPath(new URL('../',import.meta.url));
const modulePath=process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(modulePath).href);
const sources=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'];
const ids=sources.flatMap((source,i)=>(i===0?['writing']:i===2?['reading','writing']:['listening','reading','writing']).map(skill=>source+'-'+skill+'-makeup'));
const listening=[
 {route:'ic2311-listening-retake-substitute1-k56',source:sources[0],legacy:true},
 {route:'substitute-test-2-k56-listening-makeup',source:sources[1]},
 {route:'k67-term1-listening-makeup-substitute1',source:sources[2],legacy:true},
 {route:'substitute-test-2-k67-listening-makeup',source:sources[3]}
];
const evidence=process.env.SUBSTITUTE_START_SCROLL_EVIDENCE;
const read=rel=>process.env.SUBSTITUTE_BROWSER_BASE_REF
 ?execFileSync('git',['show',process.env.SUBSTITUTE_BROWSER_BASE_REF+':'+rel],{cwd:root,stdio:'pipe',maxBuffer:20*1024*1024})
 :fs.readFileSync(path.resolve(root,rel));
let browser,server,base;
before(async()=>{
 server=createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture'),rel=decodeURIComponent(url.pathname).slice(1)+(url.pathname.endsWith('/')?'index.html':'');
  if(!path.resolve(root,rel).startsWith(path.resolve(root)+path.sep))return res.writeHead(403).end();
  try{const bytes=read(rel);res.writeHead(200,{'content-type':({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'})[path.extname(rel)]||'application/octet-stream'});res.end(bytes);}
  catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:process.env.SUBSTITUTE_BROWSER_CHANNEL||'msedge',headless:true});
 if(evidence)fs.mkdirSync(evidence,{recursive:true});
});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
async function fixture(t,{roster,serviceWorkers='block'}={}){
 const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers});
 t.after(()=>context.close());const calls=[],outside=[],errors=[];
 await context.route('**/*',async route=>{
  const q=route.request(),url=new URL(q.url());if(url.origin===base)return route.continue();
  if(url.origin!=='https://ducizone.ddns.net'){outside.push(url.origin);return route.abort();}
  if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type'}});
  const action=url.pathname.split('/').at(-1);calls.push({action,method:q.method(),classCode:url.searchParams.get('class')});
  if(q.method()!=='GET')return route.abort(); // Không tạo lượt thi, không AI/Portal.
  let data;
  if(action==='classes'||action==='class-directory')data={version:1,testId:url.searchParams.get('testId'),classes:[{code:'IC99001',eligible:true},{code:'IC99002',eligible:true}],demo:{available:true}};
  else if(action==='roster')data=await (roster?.(url.searchParams.get('class'))??{students:[{studentRef:'fixture-1',name:'Học viên giả'}]});
  else return route.abort();
  return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 return {context,page,calls,outside,errors};
}
async function selectLearner(page){
 await page.locator('#student').focus();
 await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Tab'); // Sự kiện trusted, khác page.selectOption().
}

for(const [id,entry,controller]of[
 [ids[0],'writing.mjs','writing-controller.mjs'],
 [ids[1],'objective-listening-report-v1.mjs','objective-controller-listening-report-v1.mjs'],
 [ids[2],'objective.mjs','objective-controller.mjs']
])test(id+': đã cache bản cũ vẫn nhận sửa xác nhận, không xóa nháp',async t=>{
 const f=await fixture(t,{serviceWorkers:'allow'}),prefix='/term-tests/'+id+'/';
 await f.page.route('**/__warm-cache.html',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Cache fixture</title>'}));
 await f.page.goto(base+prefix+'__warm-cache.html');
 const assets=[entry,controller,'native-shell.mjs'].map(name=>({
  path:'/term-tests/substitute-skill-shared/'+name,
  body:execFileSync('git',['show','2963372f332da4364a37173f985beee312341272:term-tests/substitute-skill-shared/'+name],{cwd:root,encoding:'utf8'})
 }));
 await f.page.evaluate(async({prefix,assets,id})=>{
  localStorage.setItem('fixture-preserve-draft:'+id,'Bản nháp phải giữ nguyên');
  await navigator.serviceWorker.register(prefix+'sw.js?build=fixture-old',{scope:prefix});
  await navigator.serviceWorker.ready;
  const cache=await caches.open('substitute-skill:'+id+':fixture-old');
  for(const asset of assets)await cache.put(asset.path,new Response(asset.body,{headers:{'content-type':'text/javascript'}}));
 },{prefix,assets,id});
 await f.page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await f.page.goto(base+prefix);
 await f.page.locator('#class option[value="IC99001"]').waitFor({state:'attached'});await f.page.selectOption('#class','IC99001');
 await f.page.locator('#student option[value="fixture-1"]').waitFor({state:'attached'});await selectLearner(f.page);
 assert.equal(await f.page.locator('#confirm-identity').evaluate(e=>e.open),true);
 assert.equal(await f.page.evaluate(id=>localStorage.getItem('fixture-preserve-draft:'+id),id),'Bản nháp phải giữ nguyên');
 assert.ok(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.outside,[]);assert.deepEqual(f.errors,[]);
});

for(const id of ids)test(id+': chọn tên thật mở xác nhận; hủy/Escape cho chọn lại cùng người',async t=>{
 const f=await fixture(t);await f.page.goto(base+'/term-tests/'+id+'/');
 await f.page.locator('#class option[value="IC99001"]').waitFor({state:'attached'});
 await f.page.selectOption('#class','IC99001');
 await f.page.locator('#student option[value="fixture-1"]').waitFor({state:'attached'});
 for(const cancel of ['button','escape']){
  await selectLearner(f.page);
  assert.equal(await f.page.locator('#confirm-identity').evaluate(e=>e.open),true,'Chọn tên bằng bàn phím phải mở xác nhận');
  assert.match(await f.page.locator('#confirm-name').innerText(),/Học viên giả/);
  assert.equal(await f.page.locator('#start').isDisabled(),true,'Chưa xác nhận/chuẩn bị thì vẫn khóa bắt đầu');
  if(evidence&&cancel==='button')await f.page.screenshot({path:path.join(evidence,id+'-identity.png')});
  if(cancel==='button')await f.page.locator('#confirm-no').click();else await f.page.keyboard.press('Escape');
  assert.equal(await f.page.locator('#student').inputValue(),'','Hủy phải bỏ tên chưa xác nhận');
 }
 await selectLearner(f.page);
 assert.equal(await f.page.locator('#confirm-identity').evaluate(e=>e.open),true);
 assert.ok(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.outside,[]);assert.deepEqual(f.errors,[]);
});
for(const id of [ids[0],ids[1],ids[2]])test(id+': phản hồi roster cũ A→B→A không ghi đè lựa chọn mới',async t=>{
 let first=true,release;
 const gate=new Promise(resolve=>release=resolve);
 const f=await fixture(t,{roster:async code=>{
  if(code==='IC99001'&&first){first=false;await gate;return {students:[{studentRef:'stale',name:'Tên cũ không được hiện'}]};}
  return {students:[{studentRef:'current',name:'Tên hiện hành'}]};
 }});
 t.after(()=>release());await f.page.goto(base+'/term-tests/'+id+'/');
 await f.page.locator('#class option[value="IC99001"]').waitFor({state:'attached'});
 await f.page.selectOption('#class','IC99001');
 await f.page.waitForFunction(()=>document.querySelector('#class').value==='IC99001');
 await f.page.selectOption('#class','IC99002');
 await f.page.locator('#student option[value="current"]').waitFor({state:'attached'});
 await f.page.selectOption('#class','IC99001');
 await f.page.locator('#student option[value="current"]').waitFor({state:'attached'});
 const response=f.page.waitForResponse(r=>r.url().includes('roster?class=IC99001'));release();await response;
 await f.page.waitForTimeout(80);
 assert.equal(await f.page.locator('#student option[value="stale"]').count(),0);
 assert.equal(await f.page.locator('#student option[value="current"]').count(),1);
 await selectLearner(f.page);assert.equal(await f.page.locator('#confirm-name').innerText(),'Tên hiện hành');
});

async function mountListening(page,c){
 const route='term-tests/'+c.route+'/index.html',url=base+'/term-tests/'+c.route+'/';
 const html=read(route).toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 await page.route(url,r=>r.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto(url);
 await page.evaluate(async c=>{
  const controls=Array.from({length:40},(_,i)=>({number:i+1,kind:'text'}));
  const sections=Array.from({length:4},(_,i)=>({label:'Part '+(i+1),range:'Questions '+(i*10+1)+'–'+(i*10+10),html:Array.from({length:10},(_,j)=>'<div data-question-number="'+(i*10+j+1)+'"><p>'+('Nội dung giả dùng kiểm tra cuộn. '.repeat(22))+'</p><span data-answer-slot="'+(i*10+j+1)+'"></span></div>').join('')}));
  const content={sourceSlug:c.source,skill:'listening',controls,listening:{sections},audio:{label:'Fixture'}};
  if(!c.legacy){const shell=await import('../substitute-skill-shared/native-shell.mjs');shell.mountNativeShell();}
  document.querySelector('#lobby').hidden=true;document.querySelector('#exam').hidden=false;document.querySelector('#listeningView').hidden=false;
  const mod=await import(c.legacy?'../ic2311-listening-retake-substitute1-k56/native-ui.mjs':'../substitute-skill-shared/native-listening.mjs');
  mod.mountNativeListening({content,answers:{},grid:document.querySelector('#listeningQuestions'),form:document.querySelector('#listeningView'),heading:document.querySelector(c.legacy?'#exam-heading':'.section-heading'),uiState:{activeSection:{listening:0},fontSize:{listening:100},flags:{listening:{}}},onUiState:()=>{}});
  await mod.nativeLayout(controls,c.source);await document.fonts.ready;
 },c);
}
for(const c of listening)test(c.route+': chuột/bàn phím cuộn từng Part, điều hướng tới câu cuối',async t=>{
 const f=await fixture(t);await mountListening(f.page,c);
 for(const [width,height]of[[1366,768],[1280,720],[1024,768]]){
  await f.page.setViewportSize({width,height});
  for(let part=0;part<4;part++){
   await f.page.locator('.cbt-part-button').nth(part).click();
   const pane=f.page.locator('.cbt-listening-section:not([hidden])');await pane.evaluate(e=>e.scrollTo({top:0,behavior:'instant'}));
   const b=await pane.boundingBox();await f.page.mouse.move(b.x+Math.min(200,b.width/2),Math.min(height-140,b.y+80));
   await f.page.mouse.wheel(0,900);
   await f.page.waitForFunction(e=>e.scrollTop>100,await pane.elementHandle(),{timeout:2500});
   assert.ok(await pane.evaluate(e=>e.scrollTop>100),'Vùng Listening phải cuộn sau lăn chuột');
   await pane.evaluate(e=>{e.scrollTop=0;const field=e.querySelector('input');field.focus({preventScroll:true});});
   await f.page.keyboard.press('Tab');await f.page.keyboard.press('PageDown');await f.page.waitForTimeout(180);
   assert.ok(await pane.evaluate(e=>e.scrollTop>0),'Bàn phím phải cuộn được vùng nội dung');
   await f.page.locator('[data-nav-number="'+((part+1)*10)+'"]').click();
   await f.page.waitForTimeout(350);
   assert.equal(await f.page.locator('.cbt-listening-section:not([hidden]) input').last().evaluate(e=>e===document.activeElement),true);
   assert.ok(await pane.evaluate(e=>e.scrollTop>0),'Điều hướng phải đưa câu cuối vào vùng nhìn thấy');
  }
  if(evidence)await f.page.screenshot({path:path.join(evidence,c.route+'-'+width+'-scroll.png')});
 }
 assert.deepEqual(f.outside,[]);assert.deepEqual(f.errors,[]);
});


for(const source of sources)test(source+': bài toàn phần cuộn được Listening ở ba kích thước',async t=>{
 const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});t.after(()=>context.close());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+new URL(r.url()).pathname);});
 await context.addInitScript(()=>{
  window.IZONE_EXAM_DEVICE_CHECKED=true;
  for(const [key,value]of[['duration',1800],['readyState',4]])Object.defineProperty(HTMLMediaElement.prototype,key,{get:()=>value,configurable:true});
  HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
  HTMLMediaElement.prototype.load=function(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));};
 });
 await context.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());
  if(/\.(mp3|wav|enc|m4a)(?:\?|$)/.test(q.url()))return route.fulfill({contentType:'audio/mpeg',body:Buffer.alloc(64)});
  if(u.origin===base)return route.continue();
  if(!u.pathname.includes('/webhook/'))return route.abort();
  if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type'}});
  const {route:action,payload={}}=q.postDataJSON();let data;
  if(action==='/api/test/history')data={testSlug:source,historyEpoch:'11111111-1111-4111-8111-111111111111',stateVersion:2,maintenance:false,serverNow:new Date().toISOString(),examTimingVersion:'substitute-audio-transfer-20261014-v1',classes:[{code:'DEMO',name:'DEMO'}],writingVersions:{DEMO:'substitute-k67-test2-two-task-20261007-v1'}};
  else if(action==='/api/test/roster')data={students:[{ref:'fictional-01',name:'Học viên giả'}]};
  else if(action==='/api/test/writing/session')data={...payload,testSlug:source,examVersion:'substitute-k67-test2-two-task-20261007-v1',writingSessionId:payload.clientRunId};
  else if(action==='/api/test/exam/session')data={...payload,testSlug:source,examSessionId:'22222222-2222-4222-8222-222222222222',timingVersion:'substitute-audio-transfer-20261014-v1',listeningStartedAt:new Date().toISOString(),listeningDeadlineAt:'',audioEndedAt:'',transferSeconds:300,serverNow:new Date().toISOString()};
  else {errors.push('API ngoài fixture: '+action);return route.abort();}
  return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 await page.goto(base+'/term-tests/'+source+'-computer-based/?class=DEMO');
 await page.locator('#bootstrapClass option[value="DEMO"]').waitFor({state:'attached'});
 await page.selectOption('#bootstrapClass','DEMO');
 await page.locator('#bootstrapStudent option:not([value=""])').first().waitFor({state:'attached'});
 const option=page.locator('#bootstrapStudent option:not([value=""])').first();
 await page.selectOption('#bootstrapStudent',await option.getAttribute('value'));await page.locator('#confirmIdentity').click();
 // Media chỉ là fixture cho phép kiểm bố cục; ca native lifecycle kiểm đủ 10 giây thật.
 await page.evaluate(()=>{window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW=(_audio,_button,onReady)=>onReady();});
 await page.locator('#bootstrapPreview:enabled').click();await page.locator('#bootstrapStart:enabled').click();
 await page.locator('#listeningView .cbt-part-button').last().waitFor().catch(async error=>{
  throw new Error(JSON.stringify({errors,state:await page.evaluate(()=>({notice:document.querySelector('#bootstrapNotice')?.textContent,download:document.querySelector('#bootstrapDownloadStatus')?.textContent,order:window.TERM_TEST_BOOTSTRAP?.examOrder,body:document.body.dataset,views:[...document.querySelectorAll('#loadingView,#listeningView,#readingView,#writingView')].map(e=>({id:e.id,hidden:e.hidden,fields:e.querySelectorAll('[data-number]').length}))}))}),{cause:error});
 });
 t.diagnostic(JSON.stringify(await page.evaluate(()=>({body:document.body.className,dataset:document.body.dataset}))));
 for(const [width,height]of[[1366,768],[1280,720],[1024,768]]){
  await page.setViewportSize({width,height});
  await page.locator('#listeningView .cbt-part-button').last().click();
  await page.evaluate(()=>{scrollTo(0,0);document.querySelector('.cbt-listening-section:not([hidden])').scrollTop=0;});
  const pane=page.locator('.cbt-listening-section:not([hidden])'),box=await pane.boundingBox();
  await page.mouse.move(box.x+100,Math.max(150,Math.min(height-130,box.y+100)));await page.mouse.wheel(0,900);await page.waitForTimeout(200);
  assert.ok(await pane.evaluate(e=>e.scrollTop>0||scrollY>0),'Bài toàn phần phải cuộn được bằng chuột');
  if(evidence)await page.screenshot({path:path.join(evidence,source+'-full-'+width+'.png')});
 }
 assert.deepEqual(errors,[]);
});
