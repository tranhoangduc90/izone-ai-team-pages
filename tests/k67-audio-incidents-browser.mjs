import assert from 'node:assert/strict';
import test, {before, after} from 'node:test';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdir,access,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Đi qua UI/HTTP/SQL thật trên localhost; chỉ audio/tên/đề là giả, không mock luật bù giờ.
// Backend ứng viên lấy từ repo kề worktree hoặc biến môi trường rõ; thiếu thì fail, không skip.
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const pages=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backend=process.env.K67_BACKEND_FIXTURE_ROOT||path.resolve(pages,'../classroom-mapping-review/products/term-mini-k67');
const evidence=process.env.K67_SLICE1_EVIDENCE||path.join(pages,'output/playwright/k67-audio-incidents');
let fixture,browser,base;let fixtureLog='';
before(async()=>{
  await mkdir(evidence,{recursive:true});await access(path.join(backend,'tools/preview-exam-order.mjs'));
  const portServer=createServer();portServer.listen(0,'127.0.0.1');await once(portServer,'listening');
  const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));base=`http://127.0.0.1:${port}`;
  fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_AUDIO_SECONDS:'90',K67_PREVIEW_AUDIO_PROTECTION:'true'},stdio:['ignore','pipe','pipe']});
  fixture.stdout.on('data',data=>fixtureLog+=data);fixture.stderr.on('data',data=>fixtureLog+=data);
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    if(fixture.exitCode!==null)throw new Error('Fixture không chạy: '+fixtureLog);
    try{if((await fetch(base+'/preview/status')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal((await fetch(base+'/preview/status')).status,200);
  browser=await chromium.launch({headless:true,channel:process.env.K67_BROWSER_CHANNEL||'chrome'});
});
after(async()=>{await browser?.close();fixture?.kill();await writeFile(path.join(evidence,'fixture.log'),fixtureLog,'utf8');});
async function open(slug='term-test-1',mode='lis_first',init){
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  if(init)await page.addInitScript(init);
  assert.equal((await context.request.post(base+'/preview/reset',{data:{}})).status(),200);
  await page.goto(base+`/term-tests/${slug}-computer-based/?class=IC2304&mode=${mode}`);
  await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  if(mode==='read_first'){
    await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
    await page.locator('#submitReading').click();
  }
  await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();
  await page.locator('#listeningView').waitFor({state:'visible'});
  const token=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.examSessionToken);
  const read=async()=>{const r=await context.request.get(base+'/preview/audio-state?id='+token);assert.equal(r.status(),200);return r.json();};
  const clock=async patch=>{const r=await context.request.post(base+'/preview/incident-clock',{data:{id:token,...patch}});assert.equal(r.status(),200);};
  return{page,context,token,read,clock,errors};
}
async function sampleAndResume(page){
  await page.locator('#k67TestSound').click();await page.locator('#k67ResumeAudio').click();
  await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING&&!window.K67_ACTIVE_LISTENING.isHeld());
}
for(const slug of ['term-test-1','term-test-2','mini-test-lesson-5'])for(const mode of ['lis_first','read_first'])test(`${slug}/${mode}: UI giữ qua deadline, khôi phục, bù và nộp đúng bản đã làm`,async()=>{
  const{page,context,read,clock,errors}=await open(slug,mode);
  try{
    const first=page.locator('#listeningQuestions [data-number]').first(),number=await first.getAttribute('data-number');
    if(await first.evaluate(n=>n.tagName)==='SELECT')await first.selectOption({index:1});else await first.fill('A');
    const value=await first.inputValue();
    await clock({deadlineSeconds:1});const before=await read();
    await page.locator('#k67ReportAudio').click();await page.locator('#k67AudioIncident').waitFor({state:'visible'});
    assert.equal(await first.isDisabled(),true);assert.equal(await page.locator('#submitListening').isDisabled(),true);
    await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await page.waitForTimeout(1400);
    const held=await read();assert.equal(held.listening_submitted_at,null);assert.equal(held.listening_draft[number],value);
    await clock({seconds:30});await sampleAndResume(page);
    const resumed=await read();assert.equal(resumed.listening_audio_incident_id,null);
    assert.ok(resumed.listening_recovery_seconds>=29&&resumed.listening_recovery_seconds<=33);
    assert.equal(Date.parse(resumed.listening_deadline_at)-Date.parse(before.listening_deadline_at),resumed.listening_recovery_seconds*1000);
    assert.equal(await first.isDisabled(),false);assert.equal(await first.inputValue(),value);
    await page.locator('#submitListening').click();
    await page.waitForFunction(()=>document.getElementById('listeningView').hidden);
    assert.ok((await read()).listening_submitted_at);assert.deepEqual(errors,[]);
  }finally{await page.screenshot({path:path.join(evidence,slug+'-'+mode+'.png'),fullPage:true});await context.close();}
});

test('Mất mạng khi báo lỗi: giữ ngay tại máy, đồng bộ lại cùng sự cố rồi tiếp tục',async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.route('**/session/audio-incident',r=>r.abort());
    await page.locator('#k67ReportAudio').click();
    assert.equal(await page.locator('#submitListening').isDisabled(),true);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),true);
    await page.waitForTimeout(500);assert.equal((await read()).listening_submitted_at,null);
    await page.unroute('**/session/audio-incident');await sampleAndResume(page);
    assert.equal((await read()).listening_audio_incident_id,null);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Confirm đã ghi nhưng mất ACK: gửi lại nguyên request, không bù lặp',async()=>{
  const{page,context,read,clock,errors}=await open();let lost=false;const confirms=[];
  try{
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await clock({seconds:20});
    await page.route('**/session/audio-resume',async route=>{
      const body=route.request().postDataJSON();
      if(body.phase==='confirm'){confirms.push(body);if(!lost){lost=true;await route.fetch();return route.abort();}}
      return route.continue();
    });
    await sampleAndResume(page);assert.equal(confirms.length,2);assert.deepEqual(confirms[0],confirms[1]);
    const row=await read();assert.ok(row.listening_recovery_seconds>=19&&row.listening_recovery_seconds<=22);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Play bị chặn sau thử âm thanh: giữ bài; tải lại vẫn cùng sự cố/nháp và phục hồi được',async()=>{
  const{page,context,read,token,errors}=await open();
  try{
    const field=page.locator('#listeningQuestions [data-number]').first(),number=await field.getAttribute('data-number');
    if(await field.evaluate(n=>n.tagName)==='SELECT')await field.selectOption({index:1});else await field.fill('Bản nháp trước tải lại');
    const savedAnswer=await field.inputValue();
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    const incident=(await read()).listening_audio_incident_id;
    await page.evaluate(()=>{const audio=window.TERM_TEST_BOOTSTRAP.officialAudioElement;audio.play=()=>Promise.reject(new DOMException('Thử chặn autoplay','NotAllowedError'));});
    await page.locator('#k67TestSound').click();await page.locator('#k67ResumeAudio').click();await page.waitForTimeout(400);
    assert.equal((await read()).listening_audio_incident_id,incident);assert.equal(await page.locator('#submitListening').isDisabled(),true);
    await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.examSessionToken),token);
    assert.equal((await read()).listening_audio_incident_id,incident);
    assert.equal(await page.locator(`#listeningQuestions [data-number="${number}"]`).inputValue(),savedAnswer);
    assert.equal((await read()).listening_draft[number],savedAnswer);
    await sampleAndResume(page);assert.deepEqual(errors,[]);
  }catch(error){
    await page.screenshot({path:path.join(evidence,'reload-failure.png'),fullPage:true});
    await writeFile(path.join(evidence,'reload-failure.json'),JSON.stringify({errors,text:await page.locator('body').innerText(),
      storage:await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))},null,2),'utf8');throw error;
  }finally{await context.close();}
});

test('Tiến độ API lỗi trong khi audio phát không mở sự cố hoặc dừng nghe',async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.route('**/session/audio-progress',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}));
    const before=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime);
    await page.waitForTimeout(5600);
    const after=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime);
    assert.ok(after>before+4);assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),false);
    const row=await read();assert.equal(row.listening_audio_incident_id,null);assert.equal(row.listening_recovery_seconds,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Vượt ngân sách: khóa bài, hiện hỗ trợ giáo viên; giao diện hẹp không tràn',async()=>{
  const{page,context,read,clock,errors}=await open();
  try{
    await page.setViewportSize({width:390,height:844});
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await clock({seconds:901});await page.locator('#k67TestSound').click();await page.locator('#k67ResumeAudio').click();
    await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().needsTeacher);
    assert.equal(await page.locator('#submitListening').isDisabled(),true);assert.equal(await page.locator('#k67ResumeAudio').isDisabled(),true);
    assert.equal((await read()).listening_recovery_seconds,0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(evidence,'held-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Audio chính bị chặn lúc bắt đầu: server đã start nhưng UI giữ bài, thử lại và tiếp tục được',async()=>{
  const{page,context,read,errors}=await open('term-test-1','lis_first',()=>{
    const play=HTMLMediaElement.prototype.play;let blocked=false;
    HTMLMediaElement.prototype.play=function(){if(window.K67_ACTIVE_LISTENING&&!blocked){blocked=true;return Promise.reject(new DOMException('Chặn lúc start','NotAllowedError'));}return play.call(this);};
  });
  try{
    await page.locator('#k67AudioIncident').waitFor({state:'visible'});assert.equal(await page.locator('#submitListening').isDisabled(),true);
    assert.ok((await read()).listening_audio_incident_id);await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Pause và autoplay tiếp tục lỗi: tự thử hữu hạn, sau đó học viên kiểm âm thanh và phục hồi',async()=>{
  const{page,context,read,errors}=await open();
  try{
    await page.evaluate(()=>{
      const audio=window.TERM_TEST_BOOTSTRAP.officialAudioElement;
      window.originalOfficialPlay=audio.play.bind(audio);window.failedPlayAttempts=0;
      audio.play=()=>{window.failedPlayAttempts++;return Promise.reject(new DOMException('Bị chặn','NotAllowedError'));};audio.pause();
    });
    await page.waitForFunction(()=>window.failedPlayAttempts===2);
    await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>window.failedPlayAttempts),2);
    assert.equal(await page.locator('#submitListening').isDisabled(),true);assert.ok((await read()).listening_audio_incident_id);
    await page.evaluate(()=>{window.TERM_TEST_BOOTSTRAP.officialAudioElement.play=window.originalOfficialPlay;});
    await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Sau phục hồi, hết deadline hợp lệ tự nộp đúng một lần',async()=>{
  const{page,context,read,clock,errors}=await open();
  try{
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    await sampleAndResume(page);await clock({deadlineSeconds:1});
    let submissions=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/term-tests/term-test-1/listening')submissions++;});
    await page.waitForFunction(()=>document.getElementById('listeningView').hidden,{},{timeout:15000});
    const row=await read();assert.ok(row.listening_submitted_at);assert.equal(row.listening_audio_incident_id,null);assert.equal(submissions,1);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('Bấm báo lỗi trong khi request nộp đang chờ: nộp bị từ chối vẫn giữ khóa đáp án',async()=>{
  const{page,context,read,errors}=await open();let release;
  const gate=new Promise(resolve=>release=resolve);let reached;
  const requestReached=new Promise(resolve=>reached=resolve);
  try{
    await page.route('**/term-tests/term-test-1/listening',async route=>{reached();await gate;return route.continue();});
    await page.locator('#submitListening').click();await requestReached;
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    release();await page.waitForFunction(()=>document.getElementById('listeningView').dataset.listeningSubmitting!=='true');
    assert.equal(await page.locator('#listeningQuestions [data-number]').first().isDisabled(),true);
    assert.equal(await page.locator('#submitListening').isDisabled(),true);assert.equal((await read()).listening_submitted_at,null);assert.deepEqual(errors,[]);
  }finally{release();await context.close();}
});

test('Progress phản hồi hold cũ sau resume mới không được giữ bài lại hoặc pause audio',async()=>{
  const{page,context,errors}=await open();let releaseFetch,releaseResponse,reached,captured;
  const fetchGate=new Promise(r=>releaseFetch=r),responseGate=new Promise(r=>releaseResponse=r);
  const requestReached=new Promise(r=>reached=r),responseCaptured=new Promise(r=>captured=r);let first=true;
  try{
    await page.route('**/session/audio-progress',async route=>{
      if(!first)return route.continue();first=false;reached();await fetchGate;
      const response=await route.fetch();captured();await responseGate;return route.fulfill({response});
    });
    await requestReached;
    await page.locator('#k67ReportAudio').click();await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    releaseFetch();await responseCaptured;await sampleAndResume(page);
    const revision=await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot().audioRevision);
    releaseResponse();await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),false);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot().audioRevision),revision);
    assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);assert.deepEqual(errors,[]);
  }finally{releaseFetch();releaseResponse();await context.close();}
});

test('Mất toàn bộ ACK confirm qua hai sự cố liên tiếp không tạo vòng tự phục hồi vô hạn',async()=>{
  const{page,context,errors}=await open();const attempts=new Set();
  try{
    await page.route('**/session/audio-resume',async route=>{
      const body=route.request().postDataJSON();
      if(body.phase==='prepare')attempts.add(body.resumeAttemptId);
      if(body.phase==='confirm'){await route.fetch();return route.abort();}
      return route.continue();
    });
    await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.pause());
    const deadline=Date.now()+12000;
    while(attempts.size<2&&Date.now()<deadline)await page.waitForTimeout(100);
    assert.equal(attempts.size,2);await page.waitForTimeout(1600);assert.equal(attempts.size,2);
    assert.equal(await page.locator('#submitListening').isDisabled(),true);
    await page.unroute('**/session/audio-resume');await sampleAndResume(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});
