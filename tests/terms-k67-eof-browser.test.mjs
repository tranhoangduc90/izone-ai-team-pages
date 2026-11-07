import assert from 'node:assert/strict';
import test, {before, after} from 'node:test';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Trang, route và PostgreSQL nhúng chạy thật; chỉ audio/đề/tên dùng dữ liệu giả localhost.
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const pages=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backend=process.env.K67_BACKEND_FIXTURE_ROOT;
assert.ok(backend,'Cần K67_BACKEND_FIXTURE_ROOT trỏ tới backend ứng viên Term.');
const slug=process.env.K67_EOF_SLUG||'term-test-1';
assert.ok(['term-test-1','term-test-2'].includes(slug));
const title=slug==='term-test-1'?'Term 1':'Term 2';
let fixture,browser,base,fixtureLog='';
before(async()=>{
  const reservation=createServer().listen(0,'127.0.0.1');
  await once(reservation,'listening');const port=reservation.address().port;
  await new Promise(resolve=>reservation.close(resolve));base=`http://127.0.0.1:${port}`;
  fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_AUDIO_SECONDS:'12',
      K67_PREVIEW_AUDIO_PROTECTION:'true',K67_PREVIEW_TERM1_EOF:slug==='term-test-1'?'true':'false',
      K67_PREVIEW_TERM2_EOF:slug==='term-test-2'?'true':'false'},stdio:['ignore','pipe','pipe']});
  fixture.stdout.on('data',data=>fixtureLog+=data);fixture.stderr.on('data',data=>fixtureLog+=data);
  let ready=false;
  for(let n=0;n<100&&!ready;n++){
    if(fixture.exitCode!==null)throw Error('Fixture dừng: '+fixtureLog.slice(-1200));
    try{ready=(await fetch(base+'/preview/status')).ok;}catch{}
    if(!ready)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'Fixture chưa sẵn sàng: '+fixtureLog.slice(-1200));
  browser=await chromium.launch({headless:true,channel:process.env.K67_BROWSER_CHANNEL||'chrome'});
});
after(async()=>{await browser?.close();fixture?.kill();});

for(const mode of ['lis_first','read_first'])test(`${title} ${mode}: opt-in native EOF, không tự thu sớm và có 120 giây rà`,async()=>{
  const context=await browser.newContext();
  const page=await context.newPage();const errors=[];let listeningPosts=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname===`/api/term-tests/${slug}/listening`)listeningPosts++;});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  try{
    assert.equal((await context.request.post(base+'/preview/reset',{data:{}})).status(),200);
    await page.goto(`${base}/term-tests/${slug}-computer-based/?class=IC2304&mode=${mode}`);
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
    const accessPromise=page.waitForResponse(response=>response.url().includes(`/${slug}/session/audio-access`)
      && response.request().method()==='POST');
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    if(mode==='read_first'){
      await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
      await page.locator('#submitReading').click();
    }
    const access=await accessPromise;
    assert.equal(access.request().postDataJSON().listeningEofVersion,1);
    assert.equal((await access.json()).listeningEofVersion,1);
    await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();
    await page.locator('#listeningView').waitFor({state:'visible'});
    const token=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.examSessionToken);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot().listeningEofVersion),1);
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated',{
      detail:{listeningDeadlineAt:new Date(Date.now()-1000).toISOString(),serverNow:new Date().toISOString()}})));
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.canAutoSubmit()),false);
    assert.equal(listeningPosts,0);
    const early=await (await context.request.get(base+'/preview/audio-state?id='+token)).json();
    assert.equal(early.listening_submitted_at,null);
    await page.waitForFunction(()=>Boolean(window.K67_ACTIVE_LISTENING?.getSnapshot().listeningEofAt),null,{timeout:20_000});
    const snapshot=await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot());
    assert.ok(Date.parse(snapshot.listeningDeadlineAt)-Date.parse(snapshot.listeningEofAt)>=119_999);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.canAutoSubmit()),false);
    const review=await (await context.request.get(base+'/preview/audio-state?id='+token)).json();
    assert.equal(review.listening_submitted_at,null);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test(`${title}: nút nộp tay giữ quyền nộp sớm của lượt đang chạy`,async()=>{
  const context=await browser.newContext();const page=await context.newPage();
  page.on('dialog',dialog=>dialog.accept());
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  try{
    assert.equal((await context.request.post(base+'/preview/reset',{data:{}})).status(),200);
    await page.goto(`${base}/term-tests/${slug}-computer-based/?class=IC2304&mode=lis_first`);
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();
    await page.locator('#listeningView').waitFor({state:'visible'});
    const token=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.examSessionToken);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot().listeningEofVersion),1);
    const responsePromise=page.waitForResponse(response=>response.url().endsWith(`/api/term-tests/${slug}/listening`)
      && response.request().method()==='POST');
    await page.locator('#submitListening').click();
    const response=await responsePromise;
    assert.equal(response.request().postDataJSON().submissionIntent,'manual');
    assert.equal(response.status(),201,await response.text());
    const session=await (await context.request.get(base+'/preview/audio-state?id='+token)).json();
    assert.ok(session.listening_submitted_at);
    assert.ok(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime<12));
  }finally{await context.close();}
});

test(`${title}: đường tự thu thật ghi automatic và server từ chối khi chưa EOF`,async()=>{
  const context=await browser.newContext();const page=await context.newPage();
  page.on('dialog',dialog=>dialog.accept());
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  try{
    assert.equal((await context.request.post(base+'/preview/reset',{data:{}})).status(),200);
    await page.goto(`${base}/term-tests/${slug}-computer-based/?class=IC2304&mode=read_first`);
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
    await page.locator('#submitReading').click();
    await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();
    await page.locator('#listeningView').waitFor({state:'visible'});
    const token=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.examSessionToken);
    const responsePromise=page.waitForResponse(response=>response.url().endsWith(`/api/term-tests/${slug}/listening`)
      && response.request().method()==='POST');
    // Giả riêng một controller lỗi để kiểm chốt server của đúng đường auto requestSubmit.
    await page.evaluate(()=>{
      window.K67_ACTIVE_LISTENING.canAutoSubmit=()=>true;
      window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated',{
        detail:{listeningDeadlineAt:new Date(Date.now()-1000).toISOString(),serverNow:new Date().toISOString()}}));
    });
    const response=await responsePromise;
    assert.equal(response.request().postDataJSON().submissionIntent,'automatic');
    assert.equal(response.status(),409);
    assert.equal((await response.json()).error,'AUDIO_END_NOT_CONFIRMED');
    const session=await (await context.request.get(base+'/preview/audio-state?id='+token)).json();
    assert.equal(session.listening_submitted_at,null);
  }finally{await context.close();}
});
