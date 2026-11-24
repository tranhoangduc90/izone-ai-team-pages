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
const checkListeningLayout=process.env.K67_JOURNEY_CHECK_LISTENING_LAYOUT==='1';
const eofJournal=process.env.K67_JOURNEY_EOF_JOURNAL==='1';
const recorderOutage=process.env.K67_PREVIEW_TERM2_JOURNAL_RECORDER_DOWN==='1';
const writingOnly=process.env.K67_JOURNEY_WRITING_ONLY==='1';
const testDeparture=process.env.K67_JOURNEY_CONFIRMED_DEPARTURE==='1';
const departureAction=process.env.K67_JOURNEY_DEPARTURE_ACTION||'';
const testDepartureCache=process.env.K67_JOURNEY_DEPARTURE_CACHE==='1';
assert.ok(['','controlled','back','close','cancel_close','crash','writing','leave','final'].includes(departureAction));
const term1=process.env.K67_JOURNEY_TERM1==='1';
const term2=process.env.K67_JOURNEY_TERM2==='1';
const term=term1||term2;
const pretest=process.env.K67_JOURNEY_PRETEST==='1';
const continuity=process.env.K67_JOURNEY_CONTINUITY||'';
assert.ok(!continuity||['eof','manual','interrupt','reload','upgrade','recovery'].includes(continuity));
const recovery=continuity==='recovery';
const demoRecovery=recovery&&process.env.K67_JOURNEY_DEMO_CBT==='1';
const recoveryTail=process.env.K67_JOURNEY_RECOVERY_TAIL||'';
const simulateOutput=recovery&&process.env.K67_JOURNEY_SIMULATE_OUTPUT==='1';
assert.ok(['','eof','report'].includes(recoveryTail));
const interrupted=['interrupt','reload'].includes(continuity);
const upgrade=continuity==='upgrade';
const studentShellRepair=process.env.K67_JOURNEY_MINI_STUDENT_SHELL==='1';
assert.ok([term1,term2,pretest].filter(Boolean).length<=1,'Select only one K67 profile.');
assert.ok(!studentShellRepair||(upgrade&&!term),'The student shell upgrade targets Mini K67 CBT.');
assert.ok(!writingOnly||(term2&&!full),'Writing-only fixture targets Term 2 without real audio.');
const slug=pretest?'pretest-lesson-16':term1?'term-test-1':term2?'term-test-2':'mini-test-lesson-5';
const reopenTab=process.env.K67_JOURNEY_REOPEN_TAB==='1';
const breakAudio=process.env.K67_JOURNEY_AUDIO_FAULT==='1';
const r2Smoke=process.env.K67_JOURNEY_R2_SMOKE==='1';
const r2Fail=process.env.K67_JOURNEY_R2_FAIL==='1';
const rescueClass=process.env.K67_JOURNEY_RESCUE_CLASS||'';
assert.ok(!rescueClass||(term2&&['IC2213','IC2207'].includes(rescueClass)),'Select Term 2 and a rescue fixture class.');
const modes=process.env.K67_JOURNEY_ORDER?[process.env.K67_JOURNEY_ORDER]:['lis_first','read_first'];
const require=createRequire(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');

async function verifyListeningLayout(page) {
  const viewport=page.viewportSize();
  try {
    for (const [width,height] of [[1024,600],[1280,560],[1366,768]]) {
      await page.setViewportSize({width,height});
      const layout=await page.locator('#listeningView').evaluate(form=>{
        const nav=form.querySelector('.cbt-question-nav-wrap');
        const part=form.querySelector('.cbt-listening-section:not([hidden])');
        const fields=[...part.querySelectorAll('input[data-number],select[data-number]')]
          .filter(field=>field.getClientRects().length);
        const gaps=[fields[0],fields.at(-1)].filter(Boolean).map(field=>{
          field.scrollIntoView({block:'center',behavior:'instant'});
          const rect=field.getBoundingClientRect();
          return document.elementFromPoint((rect.left+rect.right)/2,(rect.top+rect.bottom)/2)===field;
        });
        return {gap:nav.getBoundingClientRect().top-part.getBoundingClientRect().bottom,
          accessible:gaps.length===2&&gaps.every(Boolean)};
      });
      assert.ok(layout.gap>=-1&&layout.accessible,JSON.stringify({width,height,...layout}));
    }
  } finally {
    await page.setViewportSize(viewport);
  }
}

for(const mode of modes)test(slug+' journey '+mode,{timeout:full?(term2?10_500_000:term1?8_300_000:2_650_000):writingOnly?4_200_000:upgrade?180_000:120_000},async()=>{
  assert.ok(['lis_first','read_first'].includes(mode));
  const listener=createServer().listen(0,'127.0.0.1');
  await once(listener,'listening');
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  const fixture=spawn(process.execPath,[process.env.K67_JOURNEY_PREVIEW_TOOL||'tools/preview-exam-order.mjs',pages],{cwd:backend,windowsHide:true,
    env:{...process.env,K67_ORDER_NATIVE_URL:'',K67_PREVIEW_PORT:String(port),K67_PREVIEW_MINI_CBT_JOURNEY:term||pretest?'off':'on',
      K67_PREVIEW_PRETEST_CBT_JOURNEY:pretest?'on':process.env.K67_PREVIEW_PRETEST_CBT_JOURNEY,
      K67_PREVIEW_TERM1_CBT_JOURNEY:term1?'on':'off',
      K67_PREVIEW_TERM2_CBT_JOURNEY:term2?'on':'off',K67_PREVIEW_LISTENING_CONTINUITY:continuity?'true':'false',
      K67_PREVIEW_TERM1_LISTENING_RECOVERY:recovery?'true':'false',
      K67_PREVIEW_TERM1_DEMO_CBT:demoRecovery?'true':'false',
      K67_PREVIEW_TERM2_LISTENING_RECOVERY:recovery?'true':'false',
      K67_PREVIEW_TERM2_DEMO_CBT:demoRecovery?'true':'false',
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
    if(simulateOutput)await context.addInitScript(()=>{
      const actions=new Map(),devices=new EventTarget();
      const lab=window.k67TestMedia={actions,devices,outputs:['default','stereo','speaker'],sink:'',switches:[],permissions:[]};
      devices.enumerateDevices=async()=>lab.outputs.map(deviceId=>({deviceId,kind:'audiooutput'}));
      for(const method of ['getUserMedia','selectAudioOutput'])devices[method]=()=>{
        lab.permissions.push(method);
        return Promise.reject(new DOMException('Unexpected prompt','NotAllowedError'));
      };
      Object.defineProperty(navigator,'mediaDevices',{value:devices});
      Object.defineProperty(navigator,'mediaSession',{value:{setActionHandler(action,handler){
        if(handler)actions.set(action,handler);else actions.delete(action);
      }}});
      Object.defineProperty(HTMLMediaElement.prototype,'sinkId',{get:()=>lab.sink,configurable:true});
      Object.defineProperty(HTMLMediaElement.prototype,'setSinkId',{configurable:true,value:async function(sink){
        lab.switches.push({same:this===lab.audio,sink});
        lab.sink=sink;
      }});
    });
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(r2Fail&&url.hostname.endsWith('.r2.cloudflarestorage.com'))return route.abort();
      const journalRequest=url.pathname.startsWith('/api/')&&/\/(?:exam-journal|journal-[^/]+)(?:\/|$)/.test(url.pathname);
      return (url.origin===base&&(eofJournal||!journalRequest))
        ||(r2Smoke&&(url.hostname.endsWith('.r2.cloudflarestorage.com')||url.hostname==='tranhoangduc90.github.io'))
        ?route.continue():route.abort();
    });
    const clockReplies=[];
    const missAck=new Set(['paused','running']);
    if(recovery)await context.route('**/cbt-journey/listening-clock',async route=>{
      const phase=route.request().postDataJSON().phase;
      const response=await route.fetch({maxRetries:0});
      if(response.ok()){
        clockReplies.push(await response.json());
        if(missAck.delete(phase))return route.abort('failed');
      }
      return route.fulfill({response});
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
      await context.route(new RegExp('/api/term-tests/'+slug+'/journal-(context|events|pilot-context|collector-sealed)$'),route=>{
        const body=route.request().postDataJSON();
        const path=new URL(route.request().url()).pathname;
        if(path.endsWith('/journal-context')){
          const identityConfirmed=Boolean(body.examSessionToken||body.attemptToken);
          return route.fulfill({json:{ok:true,identityConfirmed,ticket:'fixture',ticketId:randomUUID(),
            bindingId:identityConfirmed?learnerBinding:'a'.repeat(64),issuedAt:Date.now(),expiresAt:Date.now()+90000}});
        }
        if(path.endsWith('/journal-pilot-context'))return route.fulfill({json:{ok:true,destination:'collector-v1'}});
        for(const event of body.events)journalRows.push({bindingId:body.bindingId,event});
        return route.fulfill({json:{ok:true,persisted:true,scopeId:body.bindingId,acknowledgedIds:body.events.map(event=>event.id),
          ...(path.endsWith('/journal-collector-sealed')?{storage:'collector',batchId:body.batchId,eventPayloadSha256:body.eventPayloadSha256}:{})}});
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
    const url=base+`/term-tests/${entry}/?class=${demoRecovery?'CODEXDEMO806':rescueClass||'IC2304'}&mode=${mode}`;
    if(rescueClass){
      await page.goto(url.replace(rescueClass,'OTHER'));
      await page.getByText('Hãy mở đường dẫn chính do giảng viên gửi.',{exact:false}).waitFor();
      assert.equal(await page.locator('#bootstrapStudent').count(),0);
    }
    if(departureAction==='back')await page.goto('data:text/html,<title>Trang truoc bai thi</title>');
    await page.goto(url);
    await page.locator('#bootstrapStudent').selectOption(demoRecovery
      ?'66666666-6666-4666-8666-666666666666':'11111111-1111-4111-8111-111111111111');
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
    const startButton=pretest && mode==='read_first'?page.locator('#bootstrapStart'):page.getByRole('button',{
      name: mode === 'lis_first' ? confirmedStartName : startName, exact:true,
    });
    await startButton.click({timeout:50_000});
    log('started');
    await page.getByRole('button',{name:'Tải bài làm về máy'}).waitFor();
    if(eofJournal){
      for(let i=0;i<100&&!journalRows.some(row=>row.bindingId===learnerBinding&&row.event.type==='identity_observed');i++)
        await new Promise(resolve=>setTimeout(resolve,100));
      assert.ok(journalRows.some(row=>row.bindingId===learnerBinding&&row.event.type==='identity_observed'));
    }
    await context.setOffline(true);
    const order=mode==='read_first'?['reading','listening']:['listening','reading'];
    if(term)order.push('writing');

    async function verifyDeparture(section,field) {
      const answer=await field.inputValue();
      const label={reading:'Reading',listening:'Listening',writing:'Writing'}[section];
      const nextSkill=order[order.indexOf(section)+1]||'result';
      const action=departureAction||(section==='reading'?'controlled':'reload');
      if(section==='listening')await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.currentTime>.3);
      const before=await page.evaluate(()=>{
        const journey=window.TERM_TEST_BOOTSTRAP.miniJourney;
        return {view:journey.view(),origin:performance.timeOrigin,position:document.getElementById('miniJourneyAudio')?.currentTime};
      });
      if(testDepartureCache){
        const previousEntry=pretest?'index-pretest-student-cache-v2.html':term?'index-student-cache-v2-preview-verified-v1.html':'index-mini-student-cache-v3-preview-verified-v1.html';
        const number=term1?1:2;
        const bootName=pretest?'bootstrap-pretest-k67-student-cache-v2.js':term?'bootstrap-term'+number+'-k67-student-cache-v2-preview-verified-v1.js':'bootstrap-mini-k67-student-cache-v3-preview-verified-v1.js';
        const files=[previousEntry,term2?bootName:'../term-test-2-computer-based/'+bootName,
          pretest?'../shared/app-pretest-k67-content-journal-v1.js':term1?'../shared/app-term1-k67-parallel-v1-log-renewal-v1-preview-verified-v1.js':term2?'../shared/app-term2-k67-browser-cloud-v1-preview-verified-v1.js':'../shared/app-mini-k67-parallel-log-renewal-v1-preview-verified-v1.js',
          pretest?'../mini-test-lesson-5-computer-based/journey-pretest-k67-student-cache-v2.mjs':term?'../mini-test-lesson-5-computer-based/journey-term'+number+'-k67-student-cache-v2-preview-verified-v1.mjs':'journey-mini-k67-student-cache-v3-preview-verified-v1.mjs'];
        const retained=await page.evaluate(async ({paths,prefix,newEntry})=>{
          const worker=navigator.serviceWorker.controller.scriptURL;
          if(!worker.includes('confirmed-departure'))return false;
          const entry=new URL(newEntry,worker);
          for(const name of await caches.keys()){
            if(!name.startsWith(prefix))continue;
            const cache=await caches.open(name);
            if((await cache.match(entry))?.ok)
              return (await Promise.all(paths.map(path=>cache.match(new URL(path,worker))))).every(response=>response?.ok);
          }
          return false;
        },{paths:files,prefix:pretest?'pretest-lesson-16-k67-cbt-v1-':term?'term'+number+'-k67-cbt-shell-v1-parallel-':'mini-k67-cbt-shell-v1-',
          newEntry:previousEntry.replace('.html','-confirmed-departure-v1.html')});
        assert.ok(retained,'New worker cache retains all paths needed by an already-open older app');
        const restoredContext=await browser.newContext({serviceWorkers:'block'});
        try{
          await restoredContext.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
          const oldHtml=await readFile(resolve(pages,'term-tests',slug+'-computer-based',previousEntry),'utf8');
          await restoredContext.route(url,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:oldHtml}));
          const restoredPage=await restoredContext.newPage();
          await restoredPage.goto(url);
          await restoredPage.locator('#bootstrapStudent').waitFor({state:'visible'});
          assert.equal(await restoredPage.locator(`script[src*="${bootName}"]`).count(),1);
        }finally{await restoredContext.close();}
        assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.view().examSessionToken),before.view.examSessionToken);
        log('departure_rollback_verified',{olderShellLoads:true,olderPathsCached:true,scopeKept:true});
      }
      await page.waitForFunction(({skill,value})=>
        Object.values(window.TERM_TEST_BOOTSTRAP.miniJourney.drafts()[skill]||{}).includes(value),{skill:section,value:answer});
      const explicitButton=action==='leave'
        ? term2?page.getByRole('button',{name:'Rời trang',exact:true}):page.locator('#termTestChangeStudent')
        : page.getByRole('button',{name:'Tải lại trang',exact:true});
      const modal=page.getByRole('dialog',{name:'Xác nhận rời bài thi'});
      const explicit=['controlled','writing','leave','final'].includes(action);
      const unverifiedNative=term2&&!explicit;
      const history=action==='back'?await context.newCDPSession(page):null;
      const prior=history?await history.send('Page.getNavigationHistory'):null;
      const backEntry=prior?.entries[prior.currentIndex-1]?.id;
      const native=async (stay)=>{
        dismissNextDialog=stay;
        const prompt=page.waitForEvent('dialog',{predicate:dialog=>dialog.type()==='beforeunload',timeout:7000});
        const move=action==='back'?history.send('Page.navigateToHistoryEntry',{entryId:backEntry})
          :action==='close'?page.close({runBeforeUnload:true}):page.reload({waitUntil:'commit',timeout:10000});
        await Promise.all([prompt,move.catch(error=>{
          if(!stay||!/ERR_ABORTED|Timeout/.test(error.message))throw error;
        })]);
        assert.equal(dismissNextDialog,false);
      };
      if(explicit){
        await explicitButton.click();
        if(nextSkill==='result')await modal.getByText(/Khi mở lại, bạn sẽ thấy màn hình kết thúc bài thi/).waitFor();
        await modal.getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
      }else await native(true);
      assert.equal(await field.inputValue(),answer);
      assert.equal(await page.evaluate(()=>performance.timeOrigin),before.origin);
      if(section==='listening')assert.ok(await page.evaluate(()=>document.getElementById('miniJourneyAudio').currentTime)>=before.position);
      await page.evaluate(()=>{
        document.dispatchEvent(new Event('visibilitychange'));
        document.getElementById('miniJourneyAudio')?.dispatchEvent(new Event('waiting'));
      });
      assert.equal(await page.evaluate(()=>Boolean(window.TERM_TEST_BOOTSTRAP.miniJourney.departure.state().departed)),false);
      if(explicit){
        await explicitButton.click();
        await modal.getByRole('button',{name:action==='leave'?'Rời trang và nộp phần này':'Tải lại và nộp phần này',exact:true}).click();
      }else if(action==='cancel_close'||action==='crash'){
        assert.ok(unverifiedNative);
        if(action==='crash'){
          const renderer=await context.newCDPSession(page);
          const crashed=page.waitForEvent('crash',{timeout:10000});
          void renderer.send('Page.crash').catch(()=>{});
          await crashed;
        }
        await page.close({runBeforeUnload:false});
        page=await openPage();
        await page.goto(url,{waitUntil:'domcontentloaded'});
        await page.getByLabel('Họ và tên dùng khi vào thi').fill(studentName);
        await page.getByRole('button',{name:'Mở bài đã lưu',exact:true}).click();
      }else if(action==='close'){
        const closed=page.waitForEvent('close');
        await native(false);
        await closed;
        page=await openPage();
        await page.goto(url,{waitUntil:'domcontentloaded'});
        await page.getByLabel('Họ và tên dùng khi vào thi').fill(studentName);
        await page.getByRole('button',{name:'Mở bài đã lưu',exact:true}).click();
      }else{
        await native(false);
        if(action==='back'){
          await page.waitForURL('data:**',{waitUntil:'commit',timeout:12000});
          await page.goForward({waitUntil:'commit',timeout:12000});
        }
      }
      if(action==='leave'){
        if(term2){
          await page.waitForURL(new URL('../',url).href);
          await page.goto(url,{waitUntil:'domcontentloaded'});
        }
        await page.getByLabel('Họ và tên dùng khi vào thi').fill(studentName);
        await page.getByRole('button',{name:'Mở bài đã lưu',exact:true}).click();
      }
      if(!(unverifiedNative&&action==='back'))await page.waitForFunction(origin=>performance.timeOrigin!==origin,before.origin);
      await page.waitForFunction(skill=>window.TERM_TEST_BOOTSTRAP?.miniJourney?.view().nextSection===skill,unverifiedNative?section:nextSkill);
      const after=await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.view());
      assert.equal(after.examSessionToken,before.view.examSessionToken);
      if(unverifiedNative){
        assert.equal(after.generation,before.view.generation);
        assert.equal(after[section+'DeadlineAt'],before.view[section+'DeadlineAt']);
        assert.equal(await page.evaluate(()=>Boolean(window.TERM_TEST_BOOTSTRAP.miniJourney.departure.state().departed)),false);
        await page.waitForFunction(({skill,value})=>Object.values(window.TERM_TEST_BOOTSTRAP.miniJourney.drafts()[skill]||{}).includes(value),
          {skill:section,value:answer});
        await context.setOffline(false);
        const snapshot=await (await context.request.get(base+'/preview/rehearsal-receipt-readback?slug='+slug)).json();
        assert.ok(snapshot.rows.every(row=>!row[section+'_submitted']));
        log('departure_unverified_preserved',{section,action,scopeKept:true,sqlSeals:0});
        return;
      }
      await page.getByText('Phần '+label+' đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.',{exact:true}).waitFor();
      let lost=false,operationId;
      await context.route('**/cbt-journey/seal',async request=>{
        const body=request.request().postDataJSON();
        if(body.section!==section)return request.continue();
        if(!operationId)operationId=body.operationId;
        else assert.equal(body.operationId,operationId);
        const response=await request.fetch();
        if(!lost&&response.ok()){lost=true;return request.abort('failed');}
        return request.fulfill({response});
      });
      await context.setOffline(false);
      await page.getByText('Máy chủ đã nhận phần '+label+'.',{exact:true}).waitFor({timeout:25000});
      assert.equal(lost,true);
      const snapshot=await (await context.request.get(base+'/preview/rehearsal-receipt-readback?slug='+slug)).json();
      assert.equal(snapshot.rows.length,1);
      assert.equal(snapshot.rows[0][section[0]],operationId);
      assert.equal(snapshot.rows[0][section+'_submitted'],true);
      if(nextSkill!=='result')assert.equal(snapshot.rows[0][nextSkill+'_submitted'],false);
      if(section==='writing'){
        assert.equal(snapshot.rows[0].writing,answer);
        if(term2)assert.equal(snapshot.rows[0].writing_task_1,'Báo cáo Task 1 giả để kiểm khôi phục.');
        assert.equal(await page.locator('#writingView').isVisible(),false);
      }else assert.ok(Object.values(snapshot.rows[0][section+'_answers']).includes(answer));
      log('departure_passed',{section,action,scopeKept:true,receiptLost:true,sqlReadback:true});
    }

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
        if(testDeparture&&departureAction==='writing'){
          await verifyDeparture(section,form.locator(editor));
          return;
        }
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
      if(testDeparture&&(departureAction==='final'?section===order.at(-1):departureAction!=='writing'&&section===order[0])){
        await verifyDeparture(section,field);
        return;
      }
      if(section==='listening'&&continuity){
        const audio=page.locator('#miniJourneyAudio');
        await page.waitForFunction(()=>document.getElementById('miniJourneyAudio')?.currentTime>.25);
        assert.equal(await audio.evaluate(player=>player.controls),false);
        assert.equal(await page.getByRole('button',{name:'Nghe tiếp',exact:true}).isVisible(),false);
        const submit=form.getByRole('button',{name:'Nộp bài Listening',exact:true});
        if(recovery){
          const answer=await field.inputValue();
          assert.equal(offers.find(offer=>offer.listeningRecoveryVersion)?.listeningRecoveryVersion,1);
          const storagePrefix=term2?'term2-k67-cbt-journey-v1:':'term1-k67-cbt-journey-v1:';
          const onDisk=()=>page.evaluate(prefix=>{
            const saved=Object.keys(localStorage).filter(key=>key.startsWith(prefix))
              .map(key=>JSON.parse(localStorage.getItem(key))).find(record=>record?.sections?.listening);
            return saved?{checkpoint:saved.sections.listening.listeningCheckpoint,clock:saved.listeningClockSync}:null;
          },storagePrefix);
          const readClock=async()=>{
            const reply=await fetch(base+'/preview/listening-recovery-clock');
            return (await reply.json()).rows[0];
          };
          assert.equal((await readClock()).revision,0);
          if(simulateOutput){
            const initial=await audio.evaluate(player=>{
              const lab=window.k67TestMedia;
              lab.audio=player;
              lab.source=player.getAttribute('src');
              lab.sink='stereo';
              lab.devices.dispatchEvent(new Event('devicechange'));
              for(const action of ['pause','stop','play','seekbackward','seekforward','seekto'])lab.actions.get(action)({action});
              return player.currentTime;
            });
            await page.waitForFunction(position=>window.k67TestMedia.audio.currentTime>position+0.2,initial);
            await page.evaluate(()=>{
              const lab=window.k67TestMedia;
              lab.outputs=['default','speaker','handsfree'];
              lab.devices.dispatchEvent(new Event('devicechange'));
              lab.actions.get('pause')({action:'pause'});
            });
            await page.waitForFunction(()=>window.k67TestMedia.switches.length===1);
            assert.deepEqual(await audio.evaluate(player=>{
              const lab=window.k67TestMedia;
              return {same:player===lab.audio,source:player.getAttribute('src')===lab.source,rate:player.playbackRate,
                paused:player.paused,switches:lab.switches,permissions:lab.permissions};
            }),{same:true,source:true,rate:1,paused:false,switches:[{same:true,sink:''}],permissions:[]});
            log('simulated_output_continued',{physicalSignalMeasured:false});
          }
          await audio.evaluate(player=>player.pause());
          await page.getByText('Đồng hồ Listening đang tạm dừng',{exact:true}).waitFor();
          await page.waitForFunction(prefix=>Object.keys(localStorage).filter(key=>key.startsWith(prefix))
            .some(key=>JSON.parse(localStorage.getItem(key)).listeningClockSync?.pending?.[0]?.phase==='paused'),storagePrefix);
          const before=await onDisk();
          await page.close();
          page=await openPage();
          await page.goto(url,{waitUntil:'domcontentloaded'});
          const resume=page.getByRole('button',{name:'Nghe tiếp',exact:true});
          const recover=page.getByRole('button',{name:'Mở bài đã lưu',exact:true});
          await resume.or(recover).first().waitFor();
          if(await recover.isVisible()){
            await page.getByLabel('Họ và tên dùng khi vào thi').fill(studentName);
            await recover.click();
          }
          await resume.waitFor({timeout:12000}).catch(async error=>{
            const reopen=await page.evaluate(()=>({
              text:document.body.innerText.slice(0,1300),registered:navigator.serviceWorker.controller?.scriptURL,
              run:window.TERM_TEST_BOOTSTRAP?.miniJourney?.view()?.nextSection,
              player:document.getElementById('miniJourneyAudio')?.readyState
            }));
            throw Error('Offline Listening resume did not reopen: '+JSON.stringify({reopen,errors}),{cause:error});
          });
          assert.equal(await page.locator('#listeningView [data-number]:visible').first().inputValue(),answer);
          assert.equal((await onDisk()).checkpoint.positionMs,before.checkpoint.positionMs);
          await resume.click();
          await page.waitForFunction(prefix=>Object.keys(localStorage).filter(key=>key.startsWith(prefix))
            .some(key=>JSON.parse(localStorage.getItem(key)).listeningClockSync?.pending?.[1]?.phase==='running'),storagePrefix);
          assert.equal((await readClock()).operations,0);
          const after=await onDisk();
          assert.equal(after.checkpoint.resumeCount,1);
          assert.ok(after.checkpoint.positionMs>before.checkpoint.positionMs);
          await context.setOffline(false);
          await page.waitForFunction(prefix=>Object.keys(localStorage).filter(key=>key.startsWith(prefix))
            .some(key=>JSON.parse(localStorage.getItem(key)).listeningClockSync?.revision===2),storagePrefix,{timeout:30000});
          const stored=await readClock();
          assert.equal(stored.operations,2);
          assert.equal(stored.listening_submitted_at,null);
          assert.equal(stored.listening_eof_at,null);
          assert.equal(stored.snapshot.phase,'running');
          assert.equal(clockReplies.length,4);
          assert.deepEqual(clockReplies[0],clockReplies[1]);
          assert.deepEqual(clockReplies[2],clockReplies[3]);
          const reopenedAudio=page.locator('#miniJourneyAudio');
          assert.equal(await reopenedAudio.evaluate(player=>player.playbackRate),1);
          if(simulateOutput)await page.evaluate(()=>{
            window.k67TestMedia.latePlay=window.k67TestMedia.actions.get('play');
          });
          if(recoveryTail==='eof'){
            await page.getByText(/Đã nghe hết · Còn [1-9]/).waitFor({timeout:25000});
            assert.equal(await reopenedAudio.count(),0);
            assert.equal(await page.locator('#listeningView').isVisible(),true);
            assert.equal((await readClock()).listening_submitted_at,null);
            await page.waitForFunction(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.view().nextSection!=='listening');
            await page.waitForTimeout(1000);
            const ended=await readClock();
            assert.ok(ended.listening_submitted_at&&ended.listening_eof_at);
            assert.equal(ended.operations,2);
            log('listening_review_then_seal_verified',{clockOperations:ended.operations});
          }else if(recoveryTail==='report'){
            await reopenedAudio.evaluate(player=>{
              player.src=URL.createObjectURL(new Blob(['fixture cannot decode'],{type:'audio/mpeg'}));
              player.load();
            });
            const reportDialog=page.getByRole('dialog',{name:'Báo lỗi âm thanh'});
            await reportDialog.waitFor({timeout:12000});
            assert.match(await reportDialog.innerText(),/không thể nghe tiếp/);
            assert.equal(await resume.isVisible(),false);
            assert.equal(await page.locator('#listeningView [data-number]:visible').first().inputValue(),answer);
            await reportDialog.getByRole('button',{name:'Tôi không nghe thấy âm thanh',exact:true}).click();
            const next=page.getByRole('dialog',{name:'Listening gián đoạn'});
            await next.waitFor();
            assert.equal(await reopenedAudio.count(),0);
            await next.getByRole('button',{name:'Tôi đã hiểu. Đến phần thi tiếp theo.',exact:true}).click();
            const advanced=mode==='lis_first'?'reading':'writing';
            assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.view().nextSection),advanced);
            assert.equal((await readClock()).listening_submitted_at,null);
            log('listening_hard_stop_then_report_verified',{next:advanced});
          }
          if(simulateOutput&&recoveryTail){
            await page.evaluate(()=>window.k67TestMedia.latePlay({action:'play'}));
            assert.equal(await page.locator('#miniJourneyAudio').count(),0);
          }
          if(eofJournal&&recoveryTail){
            let observations=[];
            const expected=['audio_command','audio_anomaly','audio_player_retired',
              ...(simulateOutput?['audio_device_change','audio_output_result','audio_media_action']:[])];
            for(let attempt=0;attempt<30;attempt++){
              await page.evaluate(async()=>{
                const slug=window.TERM_TEST_CONFIG.slug;
                const key=JSON.stringify([location.origin+'/api/term-tests/'+slug,slug]);
                const bridge=window[Symbol.for('izone.examJournal.connections.v1')]?.get(key);
                if(!bridge)return;
                await bridge.recorder.idle();
                await bridge.recorder.flush({force:true});
              });
              observations=journalRows.filter(row=>row.bindingId===learnerBinding&&row.event.data.cause==='k67_offline_journey')
                .map(row=>row.event.data.checkpointState);
              if(expected.every(action=>observations.some(row=>row?.action===action)))break;
              await page.waitForTimeout(200);
            }
            for(const action of expected)assert.ok(observations.some(row=>row?.action===action),action);
            assert.ok(observations.some(row=>row?.action==='audio_anomaly'&&row.source==='unknown'&&row.playerId));
            assert.ok(observations.some(row=>row?.action==='audio_player_retired'&&row.playerId&&row.disposalId));
            if(simulateOutput)assert.ok(observations.some(row=>row?.action==='audio_media_action'&&row.mediaAction==='play'&&row.disposition==='inactive'));
            if(recorderOutage){
              const requests=await (await fetch(base+'/preview/recorder-requests')).json();
              assert.ok(requests.primary>0&&requests.fallback>0);
              log('journal_static_outage_verified',requests);
            }
            log('recovery_journal_verified',{scopeKept:true,observations:observations.length,actions:expected});
          }
          assert.deepEqual(errors,[]);
          log('listening_recovery_clock_verified',{requests:clockReplies.length,sqlRows:stored.operations,
            frozenMs:before.checkpoint.positionMs,remainingMs:stored.snapshot.remainingMs,atRate:1});
          return;
        }
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
          const cachedShells=()=>page.evaluate(async ({family,studentShellRepair})=>{
            const keys=(await caches.keys()).filter(key=>key.startsWith(family));
            return Promise.all(keys.map(async key=>{
              const cache=await caches.open(key);
              const entry=studentShellRepair
                ? (await cache.keys()).find(request=>/\/index-(?:listening-first-frame-v1|student-shell-v2)\.html$/.test(new URL(request.url).pathname))
                : new URL('index.html',location.href);
              const response=entry&&await cache.match(entry);
              return [key,await response?.text()];
            }));
          },{family:cacheFamily,studentShellRepair});
          const originalShells=await cachedShells();
          assert.equal(originalShells.length,1);
          assert.ok(originalShells[0][1]);
          assert.ok((await fetch(base+'/preview/switch-pages',{method:'POST'})).ok);
          await context.setOffline(false);
          if(studentShellRepair){
            await page.reload({waitUntil:'domcontentloaded'});
            await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('/offline-worker-student-shell-v2.js?'));
          }else{
            process.env.K56_FIXTURE_IMPORT_ONLY='1';
            const {activateWorkerUpdate}=await import('./term2-offline-browser.mjs');
            await activateWorkerUpdate(page);
          }
          const upgradedShells=await cachedShells();
          assert.equal(upgradedShells.length,2);
          assert.deepEqual(upgradedShells.find(([key])=>key===originalShells[0][0]),originalShells[0]);
          await context.setOffline(true);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.TERM_TEST_BOOTSTRAP?.miniJourney?.continuity?.());
          assert.deepEqual(await savedSeal(),original);
          assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.view().needsListeningAcknowledgment),false);
          if(studentShellRepair){
            await page.close();
            page=await openPage();
            await page.goto(url,{waitUntil:'domcontentloaded'});
            const name=page.getByLabel('Họ và tên dùng khi vào thi');
            const recover=page.getByRole('button',{name:'Mở bài đã lưu',exact:true});
            await name.fill('Tên đối chứng khác');
            await recover.click();
            await page.getByText('Chưa xác định được bài đúng họ tên và lớp.',{exact:false}).waitFor();
            await name.fill(studentName);
            await recover.click();
            await page.waitForFunction(()=>window.TERM_TEST_BOOTSTRAP?.miniJourney?.continuity?.());
            assert.deepEqual(await savedSeal(),original);
            log('student_shell_upgrade_verified',{oldCache:originalShells[0][0],newCache:upgradedShells.find(([key])=>key!==originalShells[0][0])[0]});
          }
        }
        continue;
      }
      if(section==='listening'){
        if(checkListeningLayout) await verifyListeningLayout(page);
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
          if(checkListeningLayout) await verifyListeningLayout(page);
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
