import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
// Trang và API ứng viên chỉ chạy localhost, dữ liệu giả. Chạy toàn file JS để bắt biến thiếu.
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const url=new URL(process.env.K67_PREVIEW_URL||'http://127.0.0.1:8893');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');
const out=process.env.K67_AUDIO_EVIDENCE_DIR||'E:/Codex-Data/incidents/ic2262-audio-20261014/browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const results=[];
try{
  for(const slug of ['mini-test-lesson-5','term-test-1','term-test-2'])for(const mode of ['lis_first','read_first']){
    const context=await browser.newContext();
    await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    if(process.env.K67_AUDIO_BASELINE_SOURCE)await context.route('**/term-test-2-computer-based/enhance.js*',async route=>route.fulfill({contentType:'application/javascript',body:await readFile(process.env.K67_AUDIO_BASELINE_SOURCE,'utf8')}));
    const page=await context.newPage(),errors=[],calls=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.url().endsWith('/session/audio-progress'))calls.push(r.postDataJSON());});
    page.on('dialog',d=>d.accept());
    const reset=await context.request.post(url.origin+'/preview/reset',{data:{}});assert.equal(reset.status(),200,await reset.text());
    await page.goto(`${url.origin}/term-tests/${slug}-computer-based/?class=IC2304&mode=${mode}`);
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    if(mode==='read_first'){
      await page.locator('#startReading').click();
      await page.locator('#readingView').waitFor({state:'visible'});
      await page.locator('#submitReading').click();
    }
    await page.locator('#bootstrapPreview').waitFor({state:'visible'});
    await page.locator('#bootstrapPreview').click();
    await page.locator('#bootstrapStart').click();
    await page.locator('#listeningView').waitFor({state:'visible'});
    await page.waitForTimeout(6200);
    assert.ok(calls.length>0,`${slug}/${mode}: audio đang phát nhưng không có request checkpoint`);
    assert.ok(calls.every(x=>Number.isFinite(x.heardSeconds)&&x.examSessionToken));
    assert.deepEqual(errors,[]);
    results.push({slug,mode,checkpointRequests:calls.length,status:'passed'});
    await context.close();
  }
  console.log(JSON.stringify({ok:true,results}));
}catch(e){results.push({status:'failed',error:e.message});throw e;}
finally{await writeFile(out+'/checkpoint-results.json',JSON.stringify(results,null,2),'utf8');await browser.close();}
