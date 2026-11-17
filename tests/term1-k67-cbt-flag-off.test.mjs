import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const pages=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.K67_BACKEND;
assert.ok(backend,'Set K67_BACKEND to the isolated backend package.');
const require=createRequire(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');

test('Term 1 CBT flag off keeps the online Listening hold and resume', {timeout:90_000}, async()=>{
  const socket=createServer().listen(0,'127.0.0.1');
  await once(socket,'listening');
  const port=socket.address().port;
  await new Promise(done=>socket.close(done));
  const base=`http://127.0.0.1:${port}`;
  const fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_MINI_CBT_JOURNEY:'off',
      K67_PREVIEW_TERM1_CBT_JOURNEY:'off',K67_PREVIEW_TERM2_CBT_JOURNEY:'off',
      K67_PREVIEW_AUDIO_PROTECTION:'true',K67_PREVIEW_AUDIO_SECONDS:'25'},stdio:['ignore','ignore','pipe']});
  let browser;
  try{
    const ready=async()=>{
      for(let attempt=0;attempt<100;attempt++){
        try{const response=await fetch(base+'/term-tests/term-test-1-computer-based/');if(response.ok)return;}catch{}
        await new Promise(done=>setTimeout(done,100));
      }
      throw new Error('Preview fixture did not start.');
    };
    await ready();
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
    await page.goto(base+'/term-tests/term-test-1-computer-based/?class=IC2304&mode=lis_first');
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    await page.waitForFunction(()=>!document.getElementById('bootstrapPreview')?.disabled);
    const state=await page.evaluate(()=>({journey:window.TERM_TEST_BOOTSTRAP?.miniJourney||null,
      start:document.getElementById('bootstrapStart')?.textContent,
      preview:document.getElementById('bootstrapPreview')?.disabled,
      error:document.getElementById('bootstrapNotice')?.textContent}));
    assert.equal(state.journey,null);
    assert.equal(state.preview,false);
    assert.equal(state.error,'');
    await page.locator('#bootstrapPreview').click();
    await page.locator('#bootstrapStart').click();
    const field=page.locator('#listeningQuestions input[data-number]').first();
    await field.fill('Online draft');
    const audio=()=>page.evaluate(()=>{
      const {officialAudioElement:player}=window.TERM_TEST_BOOTSTRAP;
      return {paused:player.paused,position:player.currentTime,rate:player.playbackRate};
    });
    const stateBefore=await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot());
    const report=page.getByRole('button',{name:'Báo lỗi âm thanh',exact:true});
    const choice=page.locator('#k67ListeningReportChoices');
    await report.click();
    await choice.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await field.inputValue(),'Online draft');
    assert.equal((await audio()).paused,false);
    assert.equal((await audio()).rate,1);
    const afterCancel=await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot());
    assert.equal(afterCancel.listeningDeadlineAt,stateBefore.listeningDeadlineAt);
    assert.ok(!afterCancel.activeIncident);
    await report.click();
    await choice.getByRole('button',{name:'Tôi nghe thấy âm thanh nhưng bị rè',exact:true}).click();
    assert.equal((await audio()).paused,false);
    const opened=page.waitForResponse(response=>response.ok()&&response.url().endsWith('/session/audio-incident'));
    await choice.getByRole('button',{name:'Headphone có dây',exact:true}).click();
    const native=await (await opened).json();
    assert.ok(native.activeIncident?.incidentId);
    await page.locator('#k67AudioIncident').waitFor({state:'visible'});
    assert.equal((await audio()).paused,true);
    await page.locator('#k67TestSound').click();
    await page.locator('#k67ResumeAudio').click();
    await page.waitForFunction(()=>!window.K67_ACTIVE_LISTENING.isHeld());
    assert.equal((await audio()).paused,false);
    assert.equal(await field.inputValue(),'Online draft');
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();fixture.kill();}
});
