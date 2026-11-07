import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const pages=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.K67_BACKEND;
assert.ok(backend,'Set K67_BACKEND to the isolated backend package.');
const full=process.env.K67_JOURNEY_FULL==='1';
const reopenTab=process.env.K67_JOURNEY_REOPEN_TAB==='1';
const modes=process.env.K67_JOURNEY_ORDER?[process.env.K67_JOURNEY_ORDER]:['lis_first','read_first'];
const require=createRequire(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');

for(const mode of modes)test('Mini K67 journey '+mode,{timeout:full?2_650_000:120_000},async()=>{
  assert.ok(['lis_first','read_first'].includes(mode));
  const listener=createServer().listen(0,'127.0.0.1');
  await once(listener,'listening');
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  const fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_MINI_CBT_JOURNEY:'on',
      K67_PREVIEW_AUDIO_PROTECTION:'true',K67_PREVIEW_REAL_MINI_AUDIO:full?'true':'false',K67_PREVIEW_AUDIO_SECONDS:'8',
      K67_PREVIEW_MINI_REVIEW_SECONDS:full?'120':'3',K67_PREVIEW_MINI_READING_MINUTES:full?'20':'.12'},stdio:['ignore','ignore','pipe']});
  let browser,page,fixtureError='';
  let sectionInProgress;
  fixture.stderr.on('data',chunk=>{fixtureError=(fixtureError+String(chunk)).slice(-3_000);});
  const log=(phase,details={})=>console.log(JSON.stringify({at:new Date().toISOString(),mode,full,phase,...details}));
  const heartbeat=full?setInterval(async()=>{
    const media=await page?.evaluate(()=>({position:document.getElementById('miniJourneyAudio')?.currentTime,
      review:document.getElementById('miniJourneyPlayer')?.innerText})).catch(()=>null);
    log('heartbeat',{section:sectionInProgress,...media});
  },60_000).unref():null;
  try{
    let ready=false;
    for(let count=0;count<100&&!ready;count+=1){
      if(fixture.exitCode!==null)throw new Error(fixtureError);
      try{ready=(await fetch(base+'/preview/status')).ok;}catch{}
      if(!ready)await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.ok(ready);
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext();
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      return url.origin===base&&!url.pathname.includes('/exam-journal')?route.continue():route.abort();
    });
    const errors=[],seals=[],rejections=[];
    const openPage=async()=>{
      const target=await context.newPage();
      target.on('pageerror',error=>errors.push(error.message));
      target.on('dialog',dialog=>dialog.accept());
      target.on('response',async response=>{
        if(!response.url().endsWith('/cbt-journey/seal'))return;
        const section=response.request().postDataJSON().section;
        if(response.ok())seals.push(section);
        else rejections.push({section,status:response.status(),code:(await response.json().catch(()=>({}))).error});
      });
      return target;
    };
    page=await openPage();
    const url=base+`/term-tests/mini-test-lesson-5-computer-based/?class=IC2304&mode=${mode}`;
    await page.goto(url);
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
    const studentName=(await page.locator('#bootstrapStudent option:checked').textContent()).trim();
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    if(mode==='lis_first')await page.locator('#bootstrapPreview').click({timeout:50_000});
    await page.getByRole('button',{name:'Bắt đầu bài Mini K67',exact:true}).click({timeout:50_000});
    log('started');
    await page.getByRole('button',{name:'Tải bài làm về máy'}).waitFor();
    await context.setOffline(true);
    const order=mode==='read_first'?['reading','listening']:['listening','reading'];
    for(const section of order){
      sectionInProgress=section;
      let form=page.locator('#'+section+'View');
      if(section==='reading'&&!(await form.isVisible()))await page.locator('#startReading').click();
      await form.waitFor({state:'visible'});
      if(section==='listening'){
        const start=page.getByRole('button',{name:'Bắt đầu Listening',exact:true});
        if(await start.isVisible())await start.click();
      }
      let field=form.locator('[data-number]:visible').first();
      if(await field.evaluate(node=>node.tagName)==='SELECT')await field.selectOption({index:1});
      else await field.fill('A');
      log('section_started',{section});
      if(section==='listening'){
        const answer=await field.inputValue();
        await page.getByRole('button',{name:'Nghe tiếp',exact:true}).click();
        log('play_clicked');
        await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.currentTime>2.2);
        log('play_before_reload');
        await page.evaluate(()=>document.getElementById('miniJourneyAudio').dispatchEvent(new Event('ended')));
        assert.equal(await form.isVisible(),true);
        if(reopenTab){
          await page.close();
          page=await openPage();
          await page.goto(url,{waitUntil:'domcontentloaded'});
          const name=page.getByLabel('Họ và tên dùng khi vào thi');
          const recover=page.getByRole('button',{name:'Mở bài đã lưu',exact:true});
          await name.fill('Sai họ tên');
          await recover.click();
          await page.getByText(/Chưa xác định được bài đúng họ tên và lớp/).waitFor();
          assert.equal(await page.locator('#miniJourneyAudio').count(),0);
          await name.fill(studentName);
          await recover.click();
          form=page.locator('#'+section+'View');
          field=form.locator('[data-number]:visible').first();
        }else await page.reload({waitUntil:'domcontentloaded'});
        log('offline_shell_loaded');
        await page.waitForFunction(()=>{const audio=document.getElementById('miniJourneyAudio');return audio?.paused&&audio.currentTime>.75;});
        assert.equal(await field.inputValue(),answer);
        await page.getByRole('button',{name:'Nghe tiếp',exact:true}).click();
        log('offline_audio_resumed');
        await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.ended,
          null,{timeout:full?1_100_000:20_000});
        assert.equal(await form.isVisible(),true);
        const duration=await page.evaluate(()=>document.getElementById('miniJourneyAudio').duration);
        log('native_eof',{duration});
      }
      const timeout=full?(section==='listening'?1_200_000:1_250_000):25_000;
      await form.waitFor({state:'hidden',timeout});
      assert.deepEqual(seals,[]);
      log('section_sealed_offline',{section});
    }
    await page.locator('#resultReadyView').waitFor({state:'visible'});
    const exported=page.waitForEvent('download');
    await page.getByRole('button',{name:'Tải bài làm về máy'}).click();
    const download=await exported;
    assert.equal(download.suggestedFilename(),'Mini-K67.html');
    const html=await readFile(await download.path(),'utf8');
    for(const skill of order)assert.match(html,new RegExp(`<h2>${skill}</h2><dl><dt>\\d+</dt><dd>[^<]+</dd>`));
    assert.doesNotMatch(html,/deviceProof|examSessionToken|permit/);
    await context.setOffline(false);
    await page.getByText('Máy chủ đã xác nhận nhận bài',{exact:true}).waitFor({timeout:30_000}).catch(error=>{
      throw new Error(`${error.message}\n${JSON.stringify({seals,rejections})}`);
    });
    assert.deepEqual(seals,order);
    assert.deepEqual(errors,[]);
    log('passed',{seals});
  }catch(error){
    const media=await page?.evaluate(()=>{const audio=document.getElementById('miniJourneyAudio');return {seconds:audio?.currentTime,
      readyState:audio?.readyState,error:audio?.error?.code,player:document.getElementById('miniJourneyPlayer')?.textContent,
      status:document.getElementById('bootstrapNotice')?.textContent};}).catch(()=>null);
    log('failed',{fixtureError,error:error.message,media});throw error;
  }
  finally{clearInterval(heartbeat);await browser?.close();if(fixture.exitCode===null)fixture.kill();}
});
