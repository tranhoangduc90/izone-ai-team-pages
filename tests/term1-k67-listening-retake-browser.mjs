import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const pages=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.K67_BACKEND;
assert.ok(backend,'Set K67_BACKEND to the isolated K67 backend package.');
const require=createRequire(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');
const realClock=process.env.K67_RETAKE_REAL_CLOCK==='1';
const studentRef='11111111-1111-4111-8111-111111111111';
const sessionToken=randomUUID();
const signingKey='synthetic-retake-ticket-key-at-least-32-characters';
const ticketPayload=Buffer.from(JSON.stringify({v:1,purpose:'listening-retake',testSlug:'term-test-1',classCode:'IC2304',studentRef,sessionToken,
  expiresAt:Math.floor(Date.now()/1000)+3600})).toString('base64url');
const signedTicket=ticketPayload+'.'+createHmac('sha256',signingKey).update('izone-listening-retake-v1:'+ticketPayload).digest('base64url');

test('Term 1 retake keeps its ticket, offline attempt and result separate', {timeout:realClock?2_160_000:125_000},async()=>{
  const listener=createServer().listen(0,'127.0.0.1');
  await once(listener,'listening');
  const port=listener.address().port,base=`http://127.0.0.1:${port}`;
  await new Promise(resolve=>listener.close(resolve));
  const fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_TERM1_RETAKE:'on',
      K67_PREVIEW_REAL_TERM1_AUDIO:realClock?'true':'false',K67_PREVIEW_AUDIO_SECONDS:'18'},
    stdio:['ignore','ignore','pipe']});
  let browser, page, fixtureError='', lostAck=false;
  const report=(phase,details={})=>console.log(JSON.stringify({at:new Date().toISOString(),phase,realClock,...details}));
  const heartbeat=realClock?setInterval(async()=>{
    const media=await page?.evaluate(()=>{
      const audio=document.getElementById('miniJourneyAudio');
      return audio?{position:audio.currentTime,duration:audio.duration,rate:audio.playbackRate,ended:audio.ended}:null;
    }).catch(()=>null);
    report('heartbeat',{media});
  },60_000).unref():null;
  fixture.stderr.on('data',chunk=>{fixtureError=(fixtureError+String(chunk)).slice(-2000);});
  try{
    let ready=false;
    for(let i=0;i<100&&!ready;i++){
      if(fixture.exitCode!==null)throw new Error(fixtureError);
      try{ready=(await fetch(base+'/preview/status')).ok;}catch{}
      if(!ready)await delay(250);
    }
    assert.ok(ready,fixtureError);
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext({acceptDownloads:true});
    const errors=[],requests=[];
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==base||url.pathname.includes('/exam-journal'))return route.abort();
      requests.push(url.pathname);
      if(url.pathname.endsWith('/listening-retake/seal')&&!lostAck){
        const response=await route.fetch();
        if(response.ok()){lostAck=true;return route.abort();}
        return route.fulfill({response});
      }
      return route.continue();
    });
    const open=async()=>{
      const page=await context.newPage();page.setDefaultTimeout(22_000);
      page.on('dialog',dialog=>dialog.accept());page.on('pageerror',error=>errors.push(error.message));
      return page;
    };
    page=await open();
    const entry=base+'/term-tests/term-test-1-listening-retake/?class=IC2304&mode=read_first&retake=';
    const select=async()=>{
      await page.locator('#bootstrapStudent').selectOption(studentRef);
      await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    };
    await page.goto(entry+ticketPayload+'.'+'a'.repeat(43));
    await select();
    await page.getByText('Liên kết thi bù không hợp lệ hoặc đã hết hạn.',{exact:false}).waitFor();
    assert.ok(await page.locator('#bootstrapStart').isDisabled());
    await page.goto(entry+signedTicket);
    await select();
    await page.locator('#bootstrapPreview').click();
    await page.getByRole('button',{name:'Bắt đầu bài thi bù Listening',exact:true}).click();
    report('started');
    const player=page.locator('#listeningView .cbt-toolbar #miniJourneyPlayer');
    await player.locator('progress[aria-label="Tiến độ phát audio"]').waitFor({timeout:5_000});
    await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.currentTime>0.25);
    assert.equal(await player.getByRole('button',{name:'Nghe tiếp',exact:true}).isVisible(),false);
    await player.getByRole('button',{name:'Tôi không nghe được',exact:true}).waitFor();
    const answer='#listeningQuestions [data-number="1"]';
    await page.locator(answer).fill('Bài lưu <thử>');
    await page.getByText('Đã lưu nháp trên máy',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.getElementById('miniJourneyAudio').currentTime>3.3);
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Tải bài làm về máy',exact:true}).click();
    const html=await readFile(await (await download).path(),'utf8');
    assert.match(html,/Bài lưu &lt;thử&gt;/);
    assert.doesNotMatch(html,/examSessionToken|permit|<h2>(reading|writing)<\/h2>/i);
    await context.setOffline(true);
    await page.close();
    page=await open();
    await page.goto(entry+signedTicket,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator(answer).inputValue(),'Bài lưu <thử>');
    await page.getByText('1/40 đã nhập',{exact:true}).waitFor();
    assert.ok(await page.locator('#readingView').isHidden());
    assert.equal(await page.locator('textarea[data-writing-task]').count(),0);
    if(realClock)await page.locator('#miniJourneyAudio').evaluate(audio=>{
      audio.addEventListener('ended',event=>{if(event.isTrusted)window.retakeEof=performance.now();},{once:true});
    });
    await page.getByRole('button',{name:'Nghe tiếp',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('miniJourneyAudio').currentTime>1.4);
    report('offline_audio_resumed');
    if(realClock){
      const audio=page.locator('#miniJourneyAudio');
      assert.equal(await audio.evaluate(element=>element.playbackRate),1);
      assert.ok(await audio.evaluate(element=>Math.abs(element.duration-1734.765714)<.2));
      await page.waitForFunction(()=>Number.isFinite(window.retakeEof),null,{timeout:1_850_000});
      report('native_eof');
      await page.waitForFunction(()=>performance.now()-window.retakeEof>=118_000,null,{timeout:125_000});
      assert.ok(await page.locator('#listeningView').isVisible());
    }else await page.locator('#submitListening').click();
    await page.getByText('Bài Listening đã lưu trên thiết bị',{exact:true}).waitFor();
    if(realClock){
      const reviewMs=await page.evaluate(()=>performance.now()-window.retakeEof);
      assert.ok(reviewMs>=119_800);
      report('section_sealed_offline',{reviewMs});
    }
    assert.ok(await page.locator('#viewListeningResult').isDisabled());
    await context.setOffline(false);
    await page.locator('#viewListeningResult').click({timeout:30_000});
    await page.locator('#resultView').waitFor();
    assert.ok(lostAck);
    assert.ok(requests.includes('/api/term-tests/term-test-1/listening-retake/result'));
    assert.ok(!requests.includes('/api/term-tests/term-test-1/session/prepare'));
    assert.ok(!requests.includes('/api/term-tests/result'));
    assert.deepEqual(errors,[]);
    report('passed');
  }finally{
    clearInterval(heartbeat);
    await browser?.close();
    if(fixture.exitCode===null)fixture.kill();
  }
});
