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
const writingOnly=process.env.K67_JOURNEY_WRITING_ONLY==='1';
const term1=process.env.K67_JOURNEY_TERM1==='1';
const term2=process.env.K67_JOURNEY_TERM2==='1';
const term=term1||term2;
assert.ok(!(term1&&term2),'Select only one Term profile.');
assert.ok(!writingOnly||(term2&&!full),'Writing-only fixture targets Term 2 without real audio.');
const slug=term1?'term-test-1':term2?'term-test-2':'mini-test-lesson-5';
const reopenTab=process.env.K67_JOURNEY_REOPEN_TAB==='1';
const breakAudio=process.env.K67_JOURNEY_AUDIO_FAULT==='1';
const r2Smoke=process.env.K67_JOURNEY_R2_SMOKE==='1';
const r2Fail=process.env.K67_JOURNEY_R2_FAIL==='1';
const rescueClass=process.env.K67_JOURNEY_RESCUE_CLASS||'';
assert.ok(!rescueClass||(term2&&['IC2213','IC2207'].includes(rescueClass)),'Select Term 2 and a rescue fixture class.');
const modes=process.env.K67_JOURNEY_ORDER?[process.env.K67_JOURNEY_ORDER]:['lis_first','read_first'];
const require=createRequire(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');

for(const mode of modes)test(slug+' journey '+mode,{timeout:full?(term2?10_500_000:term1?8_300_000:2_650_000):writingOnly?4_200_000:120_000},async()=>{
  assert.ok(['lis_first','read_first'].includes(mode));
  const listener=createServer().listen(0,'127.0.0.1');
  await once(listener,'listening');
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  const fixture=spawn(process.execPath,[process.env.K67_JOURNEY_PREVIEW_TOOL||'tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_MINI_CBT_JOURNEY:term?'off':'on',
      K67_PREVIEW_TERM1_CBT_JOURNEY:term1?'on':'off',
      K67_PREVIEW_TERM2_CBT_JOURNEY:term2?'on':'off',
      K67_PREVIEW_RESCUE_CLASS:rescueClass,
      K67_PREVIEW_AUDIO_PROTECTION:'true',K67_PREVIEW_REAL_MINI_AUDIO:full&&!term?'true':'false',
      K67_PREVIEW_REAL_TERM1_AUDIO:(full||r2Smoke)&&term1?'true':'false',K67_PREVIEW_AUDIO_SECONDS:'8',
      K67_PREVIEW_REAL_TERM2_AUDIO:(full||r2Smoke)&&term2?'true':'false',
      K67_PREVIEW_TERM2_R2_CONFIG:process.env.K67_JOURNEY_TERM2_R2_CONFIG||'',
      K67_PREVIEW_TERM1_R2_CONFIG:process.env.K67_JOURNEY_TERM1_R2_CONFIG||'',
      K67_PREVIEW_MINI_REVIEW_SECONDS:full?'120':'3',K67_PREVIEW_MINI_READING_MINUTES:full?'20':'.12'},stdio:['ignore','ignore','pipe']});
  let browser,page,fixtureError='';
  let sectionInProgress;
  fixture.stderr.on('data',chunk=>{fixtureError=(fixtureError+String(chunk)).slice(-3_000);});
  const log=(phase,details={})=>console.log(JSON.stringify({at:new Date().toISOString(),mode,full,writingOnly,phase,...details}));
  const heartbeat=(full||writingOnly)?setInterval(async()=>{
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
      if(r2Fail&&url.hostname.endsWith('.r2.cloudflarestorage.com'))return route.abort();
      return (url.origin===base&&!url.pathname.includes('/exam-journal'))
        ||(r2Smoke&&(url.hostname.endsWith('.r2.cloudflarestorage.com')||url.hostname==='tranhoangduc90.github.io'))
        ?route.continue():route.abort();
    });
    const errors=[],seals=[],rejections=[],r2Requests=[],pagesRequests=[],offers=[];
    const openPage=async()=>{
      const target=await context.newPage();
      target.on('pageerror',error=>errors.push(error.message));
      target.on('dialog',dialog=>dialog.accept());
      target.on('request',request=>{if(request.url().includes('.r2.cloudflarestorage.com'))r2Requests.push(request.url());});
      target.on('request',request=>{if(request.url().includes('github.io/izone-ai-team-pages/term-tests/k67-audio-assets/'))pagesRequests.push(request.url());});
      target.on('response',async response=>{
        if(response.url().endsWith('/cbt-journey/prepare'))offers.push(await response.json().catch(()=>({})));
        if(!response.url().endsWith('/cbt-journey/seal'))return;
        const section=response.request().postDataJSON().section;
        if(response.ok())seals.push(section);
        else rejections.push({section,status:response.status(),code:(await response.json().catch(()=>({}))).error});
      });
      return target;
    };
    page=await openPage();
    const entry=rescueClass?'term-test-2-rescue':`${slug}-computer-based`;
    const url=base+`/term-tests/${entry}/?class=${rescueClass||'IC2304'}&mode=${mode}`;
    if(rescueClass){
      await page.goto(url.replace(rescueClass,'OTHER'));
      await page.getByText('Link dự phòng này dành cho Term Test 2',{exact:false}).waitFor();
      assert.equal(await page.locator('#bootstrapStudent').count(),0);
    }
    await page.goto(url);
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
    const studentName=(await page.locator('#bootstrapStudent option:checked').textContent()).trim();
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    if(r2Smoke){
      await page.getByRole('button',{name:'Bắt đầu Term Test '+(term1?'1':'2'),exact:true}).waitFor({timeout:120_000});
      assert.equal(offers.at(-1)?.audioDownload?.sha256,term1
        ?'9af027eaaf402acc230fdaeff11bcc1b792b62e55d75067f1a2bcf2392b485f8'
        :'656921dc9888dcfe778eb0cfa6b61491fd906500edde28054d53d26194df219e');
      if(rescueClass)assert.equal(r2Requests.length,0,'Rescue must use Pages even if a signed R2 offer exists.');
      else assert.ok(r2Requests.length>0,'Browser should fetch signed R2 audio.');
      if(r2Fail||rescueClass)assert.ok(pagesRequests.length>0,'Browser should use the pinned Pages audio.');
      assert.deepEqual(errors,[]);
      log('r2_verified',{requests:r2Requests.length,pagesFallbackRequests:pagesRequests.length});
      return;
    }
    if(mode==='lis_first')await page.locator('#bootstrapPreview').click({timeout:50_000});
    await page.getByRole('button',{name:term?'Bắt đầu Term Test '+(term1?'1':'2'):'Bắt đầu bài Mini K67',exact:true}).click({timeout:50_000});
    log('started');
    await page.getByRole('button',{name:'Tải bài làm về máy'}).waitFor();
    await context.setOffline(true);
    const order=mode==='read_first'?['reading','listening']:['listening','reading'];
    if(term)order.push('writing');
    for(const section of order){
      sectionInProgress=section;
      let form=page.locator('#'+section+'View');
      if(section==='reading'&&!(await form.isVisible()))await page.locator('#startReading').click();
      if(section==='writing'){
        await page.locator('#startWriting').click();
        await form.waitFor({state:'visible'});
        log('section_started',{section});
        const essay='Bài luận giả <để kiểm xuất file>.';
        const editor='textarea[data-writing-task="task2"]';
        if(term2)await form.locator('textarea[data-writing-task="task1"]').fill('Báo cáo Task 1 giả để kiểm khôi phục.');
        if(term2)await form.locator('.writing-task-tab').last().click();
        await form.locator(editor).fill(essay);
        await form.getByText('Đã lưu nháp trên máy',{exact:true}).last().waitFor();
        if(reopenTab){
          await page.close();
          page=await openPage();
          await page.goto(url,{waitUntil:'domcontentloaded'});
          await page.getByLabel('Họ và tên dùng khi vào thi').fill(studentName);
          await page.getByRole('button',{name:'Mở bài đã lưu',exact:true}).click();
          form=page.locator('#writingView');
          await form.waitFor({state:'visible'});
          assert.equal(await form.locator(editor).inputValue(),essay);
          if(term2)assert.equal(await form.locator('textarea[data-writing-task="task1"]').inputValue(),'Báo cáo Task 1 giả để kiểm khôi phục.');
          log('offline_writing_resumed');
        }
        await form.waitFor({state:'hidden',timeout:(full||writingOnly)?(term2?3_900_000:2_500_000):25_000});
        assert.deepEqual(seals,[]);
        log('section_sealed_offline',{section});
        continue;
      }
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
        if(breakAudio){
          await page.evaluate(()=>{
            const audio=document.getElementById('miniJourneyAudio');
            audio.src=URL.createObjectURL(new Blob(['unplayable'],{type:'audio/mpeg'}));
            audio.load();
          });
          await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.error?.code===4);
          await new Promise(resolve=>setTimeout(resolve,12_000));
          assert.equal(await form.isVisible(),true);
          assert.deepEqual(seals,[]);
          log('audio_fault_held_listening');
        }
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
          null,{timeout:full?(term?2_000_000:1_100_000):20_000});
        assert.equal(await form.isVisible(),true);
        const duration=await page.evaluate(()=>document.getElementById('miniJourneyAudio').duration);
        log('native_eof',{duration});
      }
      const timeout=full?(section==='listening'?180_000:term?3_700_000:1_250_000):25_000;
      await form.waitFor({state:'hidden',timeout});
      assert.deepEqual(seals,[]);
      log('section_sealed_offline',{section});
    }
    await page.locator('#resultReadyView').waitFor({state:'visible'});
    const exported=page.waitForEvent('download');
    await page.getByRole('button',{name:'Tải bài làm về máy'}).click();
    const download=await exported;
    assert.equal(download.suggestedFilename(),term?'Term-'+(term1?'1':'2')+'-K67.html':'Mini-K67.html');
    const html=await readFile(await download.path(),'utf8');
    for(const skill of order.filter(section=>section!=='writing'))assert.match(html,new RegExp(`<h2>${skill}</h2><dl><dt>\\d+</dt><dd>[^<]+</dd>`));
    if(term)assert.match(html,/Bài luận giả &lt;để kiểm xuất file&gt;\./);
    if(term2)assert.match(html,/Báo cáo Task 1 giả để kiểm khôi phục\./);
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
