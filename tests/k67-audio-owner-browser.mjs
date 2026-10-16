import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),pages=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backend=process.env.K67_BACKEND_FIXTURE_ROOT||path.resolve(pages,'../classroom-mapping-review/products/term-mini-k67');
const evidence=path.join(pages,'output/playwright/k67-audio-owner');
let fixture,browser,base,log='';
before(async()=>{
  await mkdir(evidence,{recursive:true});const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));base=`http://127.0.0.1:${port}`;
  fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_AUDIO_SECONDS:'90',K67_PREVIEW_AUDIO_PROTECTION:'true',K67_PREVIEW_AUDIO_OWNER:'true'},stdio:['ignore','pipe','pipe']});
  fixture.stdout.on('data',x=>log+=x);fixture.stderr.on('data',x=>log+=x);
  for(let i=0;i<150;i++){if(fixture.exitCode!==null)throw new Error(log);try{if((await fetch(base+'/preview/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,channel:process.env.K67_BROWSER_CHANNEL||'chrome'});
});
after(async()=>{await browser?.close();fixture?.kill();await writeFile(path.join(evidence,'fixture.log'),log,'utf8');});
async function context(init){const c=await browser.newContext();await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());if(init)await c.addInitScript(init);return c;}
async function pageIn(c){const p=await c.newPage();p.setDefaultTimeout(15000);p.on('dialog',d=>d.accept());return p;}
async function open(slug='term-test-1',mode='lis_first',init){
  const c=await context(init);assert.equal((await c.request.post(base+'/preview/reset',{data:{}})).status(),200);
  const p=await pageIn(c),errors=[];p.on('pageerror',e=>errors.push(e.message));const url=base+`/term-tests/${slug}-computer-based/?class=IC2304&mode=${mode}`;
  await p.goto(url);await p.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');await p.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  if(mode==='read_first'){await p.locator('#startReading').click();await p.locator('#readingView').waitFor({state:'visible'});await p.locator('#submitReading').click();}
  await p.locator('#bootstrapPreview').click();await p.locator('#bootstrapStart').click();await p.locator('#listeningView').waitFor({state:'visible'});
  const token=await p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.examSessionToken);
  const read=()=>c.request.get(base+'/preview/audio-state?id='+token).then(r=>r.json());
  return{p,c,url,token,read,errors};
}
async function resume(p){await p.locator('#k67TestSound').click();await p.locator('#k67ResumeAudio').click();await p.waitForFunction(()=>!window.K67_ACTIVE_LISTENING.isHeld());}
async function cloneState(p,c){const state=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('izone-test'))));await c.addInitScript(state=>{for(const[k,v]of Object.entries(state))localStorage.setItem(k,v);},state);}
test('Claim đã ghi nhưng mất phản hồi: thử lại cùng quyền, không kẹt chủ cũ',async()=>{
  const c=await context();try{
    await c.request.post(base+'/preview/reset',{data:{}});let lost=false,first;
    await c.route('**/session/audio-owner',async route=>{const body=route.request().postDataJSON();if(body.action==='claim'&&!lost){lost=true;first=body;const response=await route.fetch();assert.equal(response.status(),200);await route.abort();}else await route.continue();});
    const p=await pageIn(c);await p.goto(base+'/term-tests/term-test-1-computer-based/?class=IC2304&mode=lis_first');await p.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');await p.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    await p.locator('#bootstrapRetry').waitFor({state:'visible'});assert.ok(lost);await p.locator('#bootstrapRetry').click();await p.locator('#bootstrapPreview').click();await p.locator('#bootstrapStart').click();await p.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(await p.evaluate(()=>window.K67_AUDIO_OWNER.fields().ownerProof),first.ownerProof);assert.equal(await p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);
  }finally{await c.close();}
});
test('Không lưu được quyền bền: chặn trước claim, không tạo phiên bị kẹt sau reload',async()=>{
  const c=await context(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('izone-k67-audio-owner'))throw new DOMException('Fixture','QuotaExceededError');return set.call(this,k,v);};});try{
    await c.request.post(base+'/preview/reset',{data:{}});let claims=0;await c.route('**/session/audio-owner',route=>{if(route.request().postDataJSON().action==='claim')claims++;return route.continue();});
    const p=await pageIn(c);await p.goto(base+'/term-tests/term-test-1-computer-based/?class=IC2304&mode=lis_first');await p.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');await p.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();await p.locator('#bootstrapRetry').waitFor({state:'visible'});
    assert.match(await p.locator('#bootstrapNotice').innerText(),/chưa lưu được quyền phát/);assert.equal(claims,0);assert.equal(await p.locator('#bootstrapStart').isDisabled(),true);
  }finally{await c.close();}
});
test('Tiếng thử cùng đầu ra bài thi; phím play/seek không thoát giữ bài',async()=>{
  const f=await open('term-test-1','lis_first',()=>{
    window.testMediaActions={};Object.defineProperty(navigator,'mediaSession',{value:{setActionHandler:(a,fn)=>window.testMediaActions[a]=fn}});
    Object.defineProperty(HTMLMediaElement.prototype,'sinkId',{get(){return this.testSink||'';}});HTMLMediaElement.prototype.setSinkId=async function(id){this.testSink=id;};
    navigator.mediaDevices.selectAudioOutput=async()=>({deviceId:'headset'});window.sampleSinks=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src?.startsWith('blob:')&&this!==window.TERM_TEST_BOOTSTRAP?.officialAudioElement)window.sampleSinks.push(this.sinkId);return play.call(this);};
  });try{
    await f.p.locator('#k67SelectOutput').click();await f.p.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await f.p.evaluate(()=>window.testMediaActions.seekforward());await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.play().catch(()=>{}));await f.p.waitForTimeout(150);assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),true);
    await f.p.evaluate(()=>{window.sampleSinks=[];});await f.p.locator('#k67TestSound').click();assert.deepEqual(await f.p.evaluate(()=>window.sampleSinks),['headset']);await f.p.locator('#k67ResumeAudio').click();await f.p.waitForFunction(()=>!window.K67_ACTIVE_LISTENING.isHeld());
  }finally{await f.c.close();}
});
test('Audio kết thúc tự nhiên: mute/freeze/resume/media/output không khóa phần kiểm tra đáp án',async()=>{
  const f=await open('term-test-1','lis_first',()=>{window.testMediaActions={};Object.defineProperty(navigator,'mediaSession',{value:{setActionHandler:(a,fn)=>window.testMediaActions[a]=fn}});});try{
    await f.p.getByRole('textbox',{name:'Câu 1',exact:true}).fill('A');
    // Nghe hết fixture theo đồng hồ thật để checkpoint server cũng tới cuối bài.
    await f.p.waitForFunction(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.ended,null,{timeout:105000});
    await f.p.evaluate(()=>{document.dispatchEvent(new Event('freeze'));document.dispatchEvent(new Event('resume'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));window.TERM_TEST_BOOTSTRAP.officialAudioElement.muted=true;window.testMediaActions.pause();window.testMediaActions.seekto();navigator.mediaDevices.dispatchEvent(new Event('devicechange'));});await f.p.waitForTimeout(250);
    assert.equal(await f.p.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),false);assert.equal((await f.read()).listening_audio_incident_id,null);
    const finished=await f.read();
    await f.p.reload();await f.p.locator('#bootstrapStart').click();await f.p.locator('#listeningView').waitFor({state:'visible'});
    const beforeSignal=await f.p.evaluate(()=>{const s=window.K67_ACTIVE_LISTENING.getSnapshot();return{held:s.held,checkpoint:s.listeningResumeAtSeconds,duration:s.timing?.listeningDurationSeconds};});
    await f.p.evaluate(()=>{document.dispatchEvent(new Event('resume'));window.TERM_TEST_BOOTSTRAP.officialAudioElement.muted=true;window.testMediaActions.pause();});await f.p.waitForTimeout(250);
    // Mốc máy chủ đã hết bài phải hiện đủ thời lượng, dù player mới còn paused sau reload.
    assert.equal(await f.p.locator('.k67-inline-audio .cbt-audio-status').innerText(),'Đã phát xong · 01:30 / 01:30');
    assert.equal(await f.p.locator('.k67-inline-audio .cbt-audio-progress').evaluate(n=>n.value),90);
    assert.equal(await f.p.getByRole('textbox',{name:'Câu 1',exact:true}).inputValue(),'A');
    assert.equal((await f.read()).listening_recovery_seconds,finished.listening_recovery_seconds);
    assert.equal((await f.read()).listening_deadline_at,finished.listening_deadline_at);
    assert.equal(await f.p.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),false,JSON.stringify(beforeSignal));assert.equal((await f.read()).listening_audio_incident_id,null);assert.equal(await f.p.locator('#submitListening').isDisabled(),false);await f.p.locator('#submitListening').click();await f.p.waitForFunction(()=>document.getElementById('listeningView').hidden);assert.ok((await f.read()).listening_submitted_at);
  }finally{await f.c.close();}
});
for(const slug of ['term-test-1','term-test-2','mini-test-lesson-5'])for(const mode of ['lis_first','read_first'])test(`${slug}/${mode}: tab thứ hai không phát; reload tab chủ giữ mốc/nháp và nộp được`,async()=>{
  const f=await open(slug,mode);
  try{
    const field=f.p.locator('#listeningQuestions [data-number]').first(),n=await field.getAttribute('data-number');if(await field.evaluate(n=>n.tagName)==='SELECT')await field.selectOption({index:1});else await field.fill('A');const answer=await field.inputValue();
    const second=await pageIn(f.c);await second.goto(f.url);await second.locator('#bootstrapRetry').waitFor({state:'visible'});
    assert.match(await second.locator('#bootstrapNotice').innerText(),/tab khác|thiết bị khác/);assert.equal(await second.evaluate(()=>Boolean(window.TERM_TEST_BOOTSTRAP?.officialAudioElement)),false);
    assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);await second.close();
    await f.p.locator('#k67ReportAudio').click();await f.p.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    const held=await f.read();await f.p.reload();await f.p.locator('#bootstrapStart').click();await f.p.locator('#listeningView').waitFor({state:'visible'});
    assert.equal((await f.read()).listening_audio_incident_id,held.listening_audio_incident_id);assert.equal(await f.p.locator(`[data-number="${n}"]`).first().inputValue(),answer);
    await resume(f.p);await f.p.locator('#submitListening').click();await f.p.waitForFunction(()=>document.getElementById('listeningView').hidden);assert.ok((await f.read()).listening_submitted_at);assert.deepEqual(f.errors,[]);
  }finally{await f.c.close();}
});
test('Khác profile mô phỏng thiết bị: không chiếm khi chủ offline; dừng/chuyển giữ cùng bài và chặn epoch cũ',async()=>{
  const f=await open(),other=await context();
  try{
    await cloneState(f.p,other);await f.c.setOffline(true);const p2=await pageIn(other);await p2.goto(f.url);await p2.locator('#bootstrapRetry').waitFor({state:'visible'});
    assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);
    assert.equal(await p2.evaluate(()=>Boolean(window.TERM_TEST_BOOTSTRAP?.officialAudioElement)),false);
    await f.c.setOffline(false);await f.p.locator('#k67StopForTransfer').click();await f.p.waitForFunction(()=>!window.K67_AUDIO_OWNER.canPlay());
    assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),true);
    await p2.locator('#bootstrapRetry').click();await p2.locator('#bootstrapStart').click();await p2.locator('#listeningView').waitFor({state:'visible'});await resume(p2);
    const stale=await f.p.evaluate(async()=>{const r=await fetch(`/api/term-tests/term-test-1/session/audio-progress`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({examSessionToken:window.TERM_TEST_BOOTSTRAP.examSessionToken,...window.K67_AUDIO_OWNER.fields(),state:'playing',heardSeconds:0})});return r.status;});assert.equal(stale,409);
    assert.equal(await f.p.locator('#k67ResumeAudio').isDisabled(),true);assert.equal(await p2.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);
  }finally{await other.close();await f.c.close();}
});
test('Không có Web Locks/BroadcastChannel: server vẫn chặn tab thứ hai, không dùng localStorage làm khóa giả',async()=>{
  const f=await open('term-test-1','lis_first',()=>{Object.defineProperty(navigator,'locks',{value:undefined});window.BroadcastChannel=undefined;});
  try{const p2=await pageIn(f.c);await p2.goto(f.url);await p2.locator('#bootstrapRetry').waitFor({state:'visible'});assert.equal(await p2.locator('#bootstrapStart').isDisabled(),true);assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);}
  finally{await f.c.close();}
});
for(const signal of ['muted','freeze','resume'])test(`Tín hiệu ${signal}: giữ bài, giữ đáp án, thử âm thanh và tiếp tục một lần`,async()=>{
  const f=await open();try{
    await f.p.evaluate(signal=>{if(signal==='muted')window.TERM_TEST_BOOTSTRAP.officialAudioElement.muted=true;else document.dispatchEvent(new Event(signal));},signal);
    await f.p.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);assert.equal(await f.p.locator('#submitListening').isDisabled(),true);
    assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),true);
    if(signal==='muted')await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.muted=false);
    await resume(f.p);assert.equal((await f.read()).listening_audio_incident_id,null);assert.deepEqual(f.errors,[]);
  }finally{await f.c.close();}
});
test('devicechange chung không dừng audio; đầu ra đã chọn biến mất thì giữ bài',async()=>{
  const f=await open('term-test-1','lis_first',()=>{
    window.testOutputs=[{kind:'audiooutput',deviceId:'headset'}];navigator.mediaDevices.enumerateDevices=async()=>window.testOutputs;
    Object.defineProperty(HTMLMediaElement.prototype,'sinkId',{get(){return'headset';}});
  });
  try{
    await f.p.evaluate(()=>navigator.mediaDevices.dispatchEvent(new Event('devicechange')));await f.p.waitForTimeout(250);
    assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);
    await f.p.evaluate(()=>{window.testOutputs=[];navigator.mediaDevices.dispatchEvent(new Event('devicechange'));});
    await f.p.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);assert.equal(await f.p.locator('#submitListening').isDisabled(),true);
  }finally{await f.c.close();}
});
test('Wake Lock bị từ chối không dừng audio; media pause đi qua giữ bài thay vì phát lại vô hạn',async()=>{
  const f=await open('term-test-1','lis_first',()=>{
    Object.defineProperty(navigator,'wakeLock',{value:{request:async()=>{throw new DOMException('Thử từ chối','NotAllowedError');}}});
    window.testMediaActions={};Object.defineProperty(navigator,'mediaSession',{value:{setActionHandler:(action,fn)=>window.testMediaActions[action]=fn}});
  });
  try{
    assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);
    await f.p.evaluate(()=>window.testMediaActions.pause());await f.p.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await f.p.waitForTimeout(700);assert.equal(await f.p.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),true);await resume(f.p);
  }finally{await f.c.close();}
});
for(const width of [1440,390])test(`Giao diện ${width}px: tất cả nút audio cùng dòng tiêu đề khi nghe và giữ bài`,async()=>{
  const f=await open();try{
    await f.p.setViewportSize({width,height:900});
    // Edge hiện cửa sổ có thể dùng scrollbar Windows chiếm chỗ; đo hàng nội dung riêng, giữ ngưỡng 70px.
    const measure=()=>f.p.evaluate(()=>{const bar=document.querySelector('#listeningView .k67-single-row'),r=bar.getBoundingClientRect(),style=getComputedStyle(bar);const controls=[...bar.querySelectorAll('button')].filter(n=>!n.hidden&&n.getBoundingClientRect().height).map(n=>({id:n.id,y:n.getBoundingClientRect().y+n.getBoundingClientRect().height/2}));return{height:bar.clientHeight+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth),outerHeight:r.height,delta:Math.max(...controls.map(x=>x.y))-Math.min(...controls.map(x=>x.y)),bodyWidth:document.documentElement.scrollWidth,controls};});
    let m=await measure();assert.ok(m.delta<=3,JSON.stringify(m));assert.ok(m.height<=70,JSON.stringify(m));assert.ok(m.bodyWidth<=width,JSON.stringify(m));
    await f.p.locator('#k67ReportAudio').click();await f.p.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);m=await measure();assert.ok(m.delta<=3,JSON.stringify(m));assert.ok(m.height<=70,JSON.stringify(m));
    await f.p.screenshot({path:path.join(evidence,`toolbar-${width}.png`),fullPage:true});
  }finally{await f.c.close();}
});
