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

test('Term 2 CBT flag off keeps online entrance and can recover after a confirmed audio report', {timeout:90_000}, async()=>{
  const socket=createServer().listen(0,'127.0.0.1');
  await once(socket,'listening');
  const port=socket.address().port;
  await new Promise(done=>socket.close(done));
  const base=`http://127.0.0.1:${port}`;
  const fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_MINI_CBT_JOURNEY:'off',
      K67_PREVIEW_TERM2_CBT_JOURNEY:'off',
      K67_PREVIEW_AUDIO_PROTECTION:'true',K67_PREVIEW_AUDIO_SECONDS:'90'},stdio:['ignore','ignore','pipe']});
  let browser;
  try{
    const ready=async()=>{
      for(let attempt=0;attempt<100;attempt++){
        try{const response=await fetch(base+'/term-tests/term-test-2-computer-based/');if(response.ok)return;}catch{}
        await new Promise(done=>setTimeout(done,100));
      }
      throw new Error('Preview fixture did not start.');
    };
    await ready();
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/term-tests/term-test-2-computer-based/?class=IC2304&mode=lis_first');
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
    await page.locator('#listeningView').waitFor({state:'visible'});
    const field=page.locator('#listeningQuestions input[data-number]').first();
    await field.fill('Online draft before reporting audio');
    const report=page.getByRole('button',{name:'Báo lỗi âm thanh',exact:true});
    await report.click();
    const dialog=page.locator('#k67ListeningReportChoices');
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.isHeld()),false);
    assert.equal(await field.inputValue(),'Online draft before reporting audio');
    await report.click();
    const acknowledged=page.waitForResponse(response=>response.ok()
      && response.url()===base+'/api/term-tests/term-test-2/session/audio-incident');
    await dialog.getByRole('button',{name:'Tôi không nghe thấy âm thanh',exact:true}).click();
    const {activeIncident}=await (await acknowledged).json();
    assert.match(activeIncident.incidentId,/^[a-f0-9-]{36}$/);
    await page.locator('#k67TestSound').click();
    await page.locator('#k67ResumeAudio').click();
    await page.waitForFunction(()=>!window.K67_ACTIVE_LISTENING.isHeld());
    assert.equal(await field.inputValue(),'Online draft before reporting audio');
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();fixture.kill();}
});
