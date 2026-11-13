import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const pages=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.K67_BACKEND;
assert.ok(backend,'Set K67_BACKEND to the isolated backend package.');
const full=process.env.K67_JOURNEY_FULL==='1';
const eofJournal=process.env.K67_JOURNEY_EOF_JOURNAL==='1';
const writingOnly=process.env.K67_JOURNEY_WRITING_ONLY==='1';
const term1=process.env.K67_JOURNEY_TERM1==='1';
const term2=process.env.K67_JOURNEY_TERM2==='1';
const term=term1||term2;
const mobileReview=process.env.K67_JOURNEY_TERM2_MOBILE_RESULTS==='1';
assert.ok(!mobileReview||term2,'Mobile result pilot is limited to Term 2 K67.');
const continuity=process.env.K67_JOURNEY_CONTINUITY||'';
assert.ok(!continuity||['eof','manual','interrupt','reload','upgrade'].includes(continuity));
const interrupted=['interrupt','reload'].includes(continuity);
const upgrade=continuity==='upgrade';
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

for(const mode of modes)test(slug+' journey '+mode,{timeout:full?(term2?10_500_000:term1?8_300_000:2_650_000):writingOnly?4_200_000:(upgrade||mobileReview)?180_000:120_000},async()=>{
  assert.ok(['lis_first','read_first'].includes(mode));
  const listener=createServer().listen(0,'127.0.0.1');
  await once(listener,'listening');
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  const fixture=spawn(process.execPath,[process.env.K67_JOURNEY_PREVIEW_TOOL||'tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_MINI_CBT_JOURNEY:term?'off':'on',
      K67_PREVIEW_TERM1_CBT_JOURNEY:term1?'on':'off',
      K67_PREVIEW_TERM2_CBT_JOURNEY:term2?'on':'off',K67_PREVIEW_TERM2_MOBILE_RESULTS:String(mobileReview),K67_PREVIEW_LISTENING_CONTINUITY:continuity?'true':'false',
      K67_PREVIEW_RESCUE_CLASS:rescueClass,
      K67_PREVIEW_AUDIO_PROTECTION:'true',K67_PREVIEW_REAL_MINI_AUDIO:full&&!term?'true':'false',
      K67_PREVIEW_REAL_TERM1_AUDIO:(full||r2Smoke)&&term1?'true':'false',K67_PREVIEW_AUDIO_SECONDS:'18',
      K67_PREVIEW_REAL_TERM2_AUDIO:(full||r2Smoke)&&term2?'true':'false',
      K67_PREVIEW_TERM2_R2_CONFIG:process.env.K67_JOURNEY_TERM2_R2_CONFIG||'',
      K67_PREVIEW_TERM1_R2_CONFIG:process.env.K67_JOURNEY_TERM1_R2_CONFIG||'',
      K67_PREVIEW_MINI_REVIEW_SECONDS:full?'120':'3',K67_PREVIEW_MINI_READING_MINUTES:full?'20':'.12'},stdio:['ignore','ignore','pipe']});
  let browser,page,fixtureError='';
  let sectionInProgress,dismissNextDialog=false;
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
      return (url.origin===base&&(eofJournal||!url.pathname.includes('/exam-journal')))
        ||(r2Smoke&&(url.hostname.endsWith('.r2.cloudflarestorage.com')||url.hostname==='tranhoangduc90.github.io'))
        ?route.continue():route.abort();
    });
    let blockQueue=upgrade;
    if(upgrade)await context.route(/\/cbt-journey\/(status|seal|interrupt)$/,route=>blockQueue?route.abort():route.continue());
    const journalRows=[];
    const learnerBinding='b'.repeat(64);
    if(eofJournal){
      await context.addInitScript(()=>{
        Object.defineProperty(window,'TERM_TEST_APP_CONFIG',{configurable:true,set(config){
          Object.defineProperty(window,'TERM_TEST_APP_CONFIG',{configurable:true,writable:true,
            value:{...config,EXAM_JOURNAL_ENABLED:true}});
        }});
      });
      await context.route(new RegExp('/api/term-tests/'+slug+'/journal-(context|events)$'),route=>{
        const body=route.request().postDataJSON();
        if(route.request().url().endsWith('/journal-context')){
          const identityConfirmed=Boolean(body.examSessionToken&&body.attemptToken);
          return route.fulfill({json:{ok:true,identityConfirmed,ticket:'fixture',ticketId:randomUUID(),
            bindingId:identityConfirmed?learnerBinding:'a'.repeat(64),issuedAt:Date.now(),expiresAt:Date.now()+90000}});
        }
        for(const event of body.events)journalRows.push({bindingId:body.bindingId,event});
        return route.fulfill({json:{ok:true,persisted:true,scopeId:body.bindingId,acknowledgedIds:body.events.map(event=>event.id)}});
      });
    }
    const errors=[],seals=[],rejections=[],r2Requests=[],pagesRequests=[],offers=[];
    const openPage=async()=>{
      const target=await context.newPage();
      target.on('pageerror',error=>errors.push(error.message));
      target.on('dialog',dialog=>{
        if(dismissNextDialog){dismissNextDialog=false;return dialog.dismiss();}
        return dialog.accept();
      });
      target.on('request',request=>{if(request.url().includes('.r2.cloudflarestorage.com'))r2Requests.push(request.url());});
      target.on('request',request=>{if(request.url().includes('github.io/izone-ai-team-pages/term-tests/k67-audio-assets/'))pagesRequests.push(request.url());});
      target.on('response',async response=>{
        if(response.url().endsWith('/cbt-journey/prepare'))offers.push(await response.json().catch(()=>({})));
        if(!/\/cbt-journey\/(seal|interrupt)$/.test(response.url()))return;
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
      await page.getByText('Hãy mở đường dẫn chính do giảng viên gửi.',{exact:false}).waitFor();
      assert.equal(await page.locator('#bootstrapStudent').count(),0);
    }
    const checkPhone = async (android = false) => {
      const phone = await browser.newContext({isMobile:true,hasTouch:true,viewport:{width:390,height:844},
        userAgent:android ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/132.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
      await phone.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
      const mobile = await phone.newPage();
      const requests = [];
      mobile.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/'))requests.push(path);});
      await mobile.goto(url);
      await mobile.getByRole('button',{name:'Xem kết quả',exact:true}).waitFor();
      assert.equal(mobile.url(),url);
      assert.equal(await mobile.getByRole('button',{name:/Bắt đầu|Tiếp tục thi|Nghe tiếp/}).count(),0);
      assert.equal(await mobile.evaluate(()=>Boolean(window.TERM_TEST_BOOTSTRAP)),false);
      assert.deepEqual(requests,[]);
      return {phone,mobile,requests};
    };
    if(mobileReview) { const fresh = await checkPhone(); await fresh.phone.close(); log('mobile_start_blocked'); }
    await page.goto(url);
    await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
    const studentName=(await page.locator('#bootstrapStudent option:checked').textContent()).trim();
    await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
    if(r2Smoke){
      await page.getByRole('button',{name:'Bắt đầu Term Test '+(term1?'1':'2'),exact:true}).waitFor({timeout:120_000});
      assert.equal(offers.at(-1)?.audioDownload?.sha256,term1
        ?'9af027eaaf402acc230fdaeff11bcc1b792b62e55d75067f1a2bcf2392b485f8'
        :'656921dc9888dcfe778eb0cfa6b61491fd906500edde28054d53d26194df219e');
      if(rescueClass)assert.equal(new URL(page.url()).pathname,'/term-tests/term-test-2-computer-based/');
      else assert.ok(r2Requests.length>0,'Browser should fetch signed R2 audio.');
      if(r2Fail)assert.ok(pagesRequests.length>0,'Browser should use the pinned Pages audio.');
      assert.deepEqual(errors,[]);
      log('r2_verified',{requests:r2Requests.length,pagesFallbackRequests:pagesRequests.length});
      return;
    }
    if (mode === 'lis_first') {
      if(continuity){
        const preview=page.locator('#bootstrapPreview');
        await preview.click({timeout:50_000});
        await page.locator('[data-audio-start-wait]').waitFor();
        await preview.click();
        await page.locator('[data-audio-start-wait]').waitFor({state:'hidden'});
        assert.equal(await page.locator('#bootstrapStart').isDisabled(),true);
      }
      await page.locator('#bootstrapPreview').click({timeout:50_000});
      const countdown = page.locator('[data-audio-start-wait]');
      await countdown.waitFor();
      assert.equal(await page.locator('#bootstrapStart').isDisabled(), true);
      assert.equal(await countdown.evaluate(hint => hint.nextElementSibling.id), 'bootstrapStart');
    }
    const startName = term ? `Bắt đầu Term Test ${term1 ? 1 : 2}` : 'Bắt đầu bài Mini K67';
    const confirmedStartName = 'Đã nghe rõ Bắt đầu thi Listening';
    await page.getByRole('button',{
      name: mode === 'lis_first' ? confirmedStartName : startName, exact:true,
    }).click({timeout:50_000});
    log('started');
    if(mobileReview) {
      const during = await checkPhone(true);
      await during.phone.close();
      log('mobile_resume_blocked');
    }
    await page.getByRole('button',{name:'Tải bài làm về máy'}).waitFor();
    if(eofJournal){
      for(let i=0;i<100&&!journalRows.some(row=>row.bindingId===learnerBinding&&row.event.type==='identity_observed');i++)
        await new Promise(resolve=>setTimeout(resolve,100));
      assert.ok(journalRows.some(row=>row.bindingId===learnerBinding&&row.event.type==='identity_observed'));
    }
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
        if(continuity&&!upgrade&&mode==='read_first'){
          await page.getByRole('button',{name:'Nghe thử',exact:true}).click();
          await page.locator('[data-audio-start-wait]').waitFor();
          assert.equal(await start.isDisabled(),true);
          await page.getByRole('button',{name:'Đã nghe rõ Bắt đầu thi Listening',exact:true}).click();
        }else if(await start.isVisible())await start.click();
      }
      let field=form.locator('[data-number]:visible').first();
      if(await field.evaluate(node=>node.tagName)==='SELECT')await field.selectOption({index:1});
      else await field.fill('A');
      log('section_started',{section});
      if(section==='listening'&&continuity){
        const audio=page.locator('#miniJourneyAudio');
        await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.currentTime>.25);
        assert.equal(await audio.evaluate(player=>player.controls),false);
        assert.equal(await page.getByRole('button',{name:'Nghe tiếp',exact:true}).isVisible(),false);
        const submit=form.getByRole('button',{name:'Nộp bài Listening',exact:true});
        if(continuity==='manual'||upgrade){
          dismissNextDialog=true;
          await submit.click();
          assert.equal(dismissNextDialog,false);
          assert.equal(await audio.evaluate(player=>player.paused),false);
          await submit.click();
        }else if(interrupted){
          if(continuity==='reload')await page.reload({waitUntil:'domcontentloaded'});
          else await page.getByRole('button',{name:'Tôi không nghe được',exact:true}).click();
          const dialog=page.getByRole('dialog',{name:'Listening gián đoạn'});
          await dialog.waitFor();
          assert.equal(await page.locator('#miniJourneyAudio').count(),0);
          if(continuity==='interrupt'){
            await page.reload({waitUntil:'domcontentloaded'});
            await dialog.waitFor();
          }
          assert.match(await dialog.textContent(),/hãy liên hệ giảng viên để được nhận bài Listening thay thế/);
          const next=mode==='lis_first'?'Reading':term?'Writing':'';
          const label=next?'Tôi đã hiểu. Đến phần thi tiếp theo.':'Tôi đã hiểu.';
          await dialog.getByRole('button',{name:label,exact:true}).click();
          if(next){
            assert.equal(await page.locator('#'+next.toLowerCase()+'View').isVisible(),false);
            await page.locator('#start'+next).waitFor({state:'visible'});
          }else await page.locator('#resultReadyView').waitFor({state:'visible'});
        }else{
          const before=await audio.evaluate(player=>player.currentTime);
          await page.evaluate(()=>{
            const player=document.getElementById('miniJourneyAudio');
            window.addEventListener('timeupdate',event=>{if(event.target===player)event.stopImmediatePropagation();},true);
            window.dispatchEvent(new Event('blur'));
            player.dispatchEvent(new Event('waiting'));
            player.dispatchEvent(new Event('ended'));
          });
          await page.waitForFunction(before=>{
            const player=document.getElementById('miniJourneyAudio');
            return !player.paused&&player.currentTime>before+5.1;
          },before);
          await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.ended,null,{timeout:25_000});
          await page.getByText(/Đã nghe hết · Còn [1-9]/).waitFor();
          assert.equal(await form.isVisible(),true);
        }
        await form.waitFor({state:'hidden',timeout:25_000});
        assert.deepEqual(seals,[]);
        if(upgrade){
          const savedSeal=()=>page.evaluate(()=>Object.keys(localStorage)
            .filter(key=>/^(?:term[12]|mini)-k67-cbt-journey-v1:/.test(key))
            .map(key=>JSON.parse(localStorage.getItem(key)))
            .flatMap(record=>record.pending||[]).find(operation=>operation.section==='listening'));
          const original=await savedSeal();
          assert.ok(original?.operationId);
          assert.equal(original.outcome,undefined);
          const cacheFamily=term1?'term1-k67-cbt-shell-v1-':term2?'term2-k67-cbt-shell-v1-':'mini-k67-cbt-shell-v1-';
          const cachedShells=()=>page.evaluate(async family=>{
            const keys=(await caches.keys()).filter(key=>key.startsWith(family));
            return Promise.all(keys.map(async key=>{
              const response=await (await caches.open(key)).match(new URL('index.html',location.href));
              return [key,await response?.text()];
            }));
          },cacheFamily);
          const originalShells=await cachedShells();
          assert.equal(originalShells.length,1);
          assert.ok(originalShells[0][1]);
          assert.ok((await fetch(base+'/preview/switch-pages',{method:'POST'})).ok);
          await context.setOffline(false);
          process.env.K56_FIXTURE_IMPORT_ONLY='1';
          const {activateWorkerUpdate}=await import('./term2-offline-browser.mjs');
          await activateWorkerUpdate(page);
          const upgradedShells=await cachedShells();
          assert.equal(upgradedShells.length,2);
          assert.deepEqual(upgradedShells.find(([key])=>key===originalShells[0][0]),originalShells[0]);
          await context.setOffline(true);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.TERM_TEST_BOOTSTRAP?.miniJourney?.continuity?.());
          assert.deepEqual(await savedSeal(),original);
          assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.view().needsListeningAcknowledgment),false);
        }
        continue;
      }
      if(section==='listening'){
        const answer=await field.inputValue();
        if(eofJournal)await page.evaluate(()=>{
          const player=document.getElementById('miniJourneyAudio');
          player.dispatchEvent(new Event('ended'));
          player.dispatchEvent(new Event('ended'));
        });
        await page.waitForFunction(() => {
          const audio = document.getElementById('miniJourneyAudio');
          return audio && !audio.paused && audio.currentTime > .25;
        });
        assert.equal(await page.getByRole('button',{name:'Nghe tiếp',exact:true}).isVisible(),false);
        log('first_audio_playing');
        await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.currentTime>2.2);
        log('play_before_reload');
        if(!eofJournal)await page.evaluate(()=>document.getElementById('miniJourneyAudio').dispatchEvent(new Event('ended')));
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
        // The journal test keeps the verified page binding through the outage.
        if(!eofJournal&&reopenTab){
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
        }else if(!eofJournal)await page.reload({waitUntil:'domcontentloaded'});
        if(!eofJournal){
          log('offline_shell_loaded');
          await page.waitForFunction(()=>{const audio=document.getElementById('miniJourneyAudio');return audio?.paused&&audio.currentTime>.75;});
          assert.equal(await field.inputValue(),answer);
          await page.getByRole('button',{name:'Nghe tiếp',exact:true}).click();
          log('offline_audio_resumed');
        }
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
    let droppedReceipt;
    const recoveredReceipts=[];
    if(continuity==='interrupt'){
      await context.route('**/cbt-journey/interrupt',async route=>{
        if(droppedReceipt)return route.continue();
        const response=await route.fetch();
        if(!response.ok())return route.fulfill({response});
        droppedReceipt=(await response.json()).receipt;
        if(term)seals.push('listening');
        await route.abort();
      });
      page.on('response',async response=>{
        if(response.ok()&&response.url().endsWith(term?'/cbt-journey/status':'/cbt-journey/interrupt')){
          const payload=await response.json();
          if(payload.receipt?.outcome==='interrupted')recoveredReceipts.push(payload.receipt);
        }
      });
    }
    blockQueue=false;
    await context.setOffline(false);
    await page.getByText('Máy chủ đã xác nhận nhận bài',{exact:true}).waitFor({timeout:30_000}).catch(error=>{
      throw new Error(`${error.message}\n${JSON.stringify({seals,rejections})}`);
    });
    assert.deepEqual(seals,order);
    if(mobileReview) {
      await page.locator('#viewResult').click();
      await page.locator('#resultView').waitFor();
      const takeCode = page.waitForResponse(response=>response.url().endsWith('/mobile-results/issue'));
      await page.getByRole('button',{name:'Lấy mã xem trên điện thoại'}).click();
      const issued = await takeCode;
      assert.ok(issued.ok(), (await issued.json()).error);
      const code = await page.getByRole('textbox',{name:'Mã xem kết quả trên điện thoại'}).inputValue();
      const {phone,mobile,requests} = await checkPhone(mode === 'read_first');
      try {
        await mobile.getByRole('button',{name:'Xem kết quả',exact:true}).click();
        await mobile.getByLabel('Mã xem kết quả',{exact:true}).fill(code);
        await mobile.getByRole('button',{name:'Mở kết quả'}).click();
        await mobile.getByRole('heading',{name:studentName}).waitFor();
        assert.equal(mobile.url(),url);
        await mobile.locator('[data-skill="Reading"] > summary').click();
        await mobile.getByRole('button',{name:/Reading câu .*Xem giải thích/}).first().click();
        await mobile.getByRole('dialog').waitFor();
        await mobile.getByText(/Phân tích mô phỏng cho câu/).waitFor();
        if (process.env.K67_MOBILE_SCREENSHOT) await mobile.screenshot({path:process.env.K67_MOBILE_SCREENSHOT});
        await mobile.getByRole('button',{name:'Đóng giải thích'}).click();
        await mobile.locator('[data-skill="Listening"] > summary').click();
        await mobile.getByRole('button',{name:/Listening câu .*Xem giải thích/}).first().click();
        const clip = mobile.getByRole('button',{name:/Nghe lại dẫn chứng/});
        await clip.click();
        await mobile.waitForFunction(()=>{const audio=document.querySelector('audio[data-k67-review-audio]');return audio&&!audio.paused&&audio.currentTime>=1;},{},{timeout:20000});
        await mobile.waitForFunction(()=>{const audio=document.querySelector('audio[data-k67-review-audio]');return audio?.paused&&audio.currentTime>=2.3&&audio.currentTime<3.5;},{},{timeout:7000});
        assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        assert.ok(requests.length>=2);
        assert.ok(requests.every(path=>path.includes('/mobile-results/')),JSON.stringify(requests));
        log('mobile_same_url_result_and_explanations');
      } finally { await phone.close(); }
    }
    if(continuity==='interrupt'){
      assert.equal(droppedReceipt?.outcome,'interrupted');
      assert.deepEqual(recoveredReceipts,[droppedReceipt]);
    }
    assert.deepEqual(errors,[]);
    if(continuity&&interrupted){
      const viewResult=page.locator('#viewResult');
      await viewResult.click();
      await page.getByText('Gián đoạn · Cần bài thay thế',{exact:true}).waitFor();
      await page.getByText('Reading',{exact:true}).first().waitFor();
      assert.equal(await page.locator('#resultView details[data-skill="Listening"]').count(),0);
    }
    if(eofJournal){
      const flushJournal=()=>page.evaluate(async()=>{
        const endpoint=location.origin+'/api/term-tests/'+window.TERM_TEST_CONFIG.slug;
        const bridge=window[Symbol.for('izone.examJournal.connections.v1')].get(JSON.stringify([endpoint,window.TERM_TEST_CONFIG.slug]));
        await bridge.recorder.idle();
        await bridge.recorder.flush({force:true});
      });
      const expectedActions=['audio_download_verified','audio_player_ready','audio_playing','audio_ended',
        'listening_local_collected','listening_server_received'];
      for(let attempt=0;attempt<20;attempt++){
        await flushJournal();
        if(!continuity||expectedActions.every(action=>journalRows.some(row=>row.bindingId===learnerBinding
            && row.event.data.cause==='k67_offline_journey'&&row.event.data.checkpointState?.action===action)))break;
        await new Promise(resolve=>setTimeout(resolve,150));
      }
      const rows=journalRows.filter(row=>row.event.data.action==='k67_listening_eof');
      assert.ok(rows.every(row=>row.bindingId===learnerBinding));
      const phases=rows.map(row=>row.event.data.checkpointState.phase).sort();
      assert.deepEqual(phases,['eof_accepted','event_unverified','review_local']);
      if(continuity){
        const milestones=journalRows.filter(row=>row.bindingId===learnerBinding
          && row.event.type==='state_observed'&&row.event.data.cause==='k67_offline_journey')
          .map(row=>row.event.data.checkpointState);
        const actions=new Set(milestones.map(item=>item.action));
        for(const action of expectedActions)assert.ok(actions.has(action),action);
        const playing=milestones.find(item=>item.action==='audio_playing');
        assert.ok(playing.position<0.25);
        assert.ok(Number.isFinite(playing.elapsedMs));
        log('audio_start_measured',{elapsedMs:playing.elapsedMs});
      }
      log('journal_verified',{phases,oneLearnerBinding:true});
    }
    log('passed',{seals});
  }catch(error){
    const media=await page?.evaluate(()=>{const audio=document.getElementById('miniJourneyAudio');return {seconds:audio?.currentTime,
      readyState:audio?.readyState,error:audio?.error?.code,player:document.getElementById('miniJourneyPlayer')?.textContent,
      status:document.getElementById('bootstrapNotice')?.textContent};}).catch(()=>null);
    log('failed',{fixtureError,error:error.message,media});throw error;
  }
  finally{clearInterval(heartbeat);await browser?.close();if(fixture.exitCode===null)fixture.kill();}
});
