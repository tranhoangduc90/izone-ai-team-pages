import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const backend=process.env.K67_BACKEND;
const journal=process.env.K67_EXAM_JOURNAL;
assert.ok(backend&&journal,'Set K67_BACKEND and K67_EXAM_JOURNAL to the isolated fixture sources.');
const pages=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');
const entry='/term-tests/term-test-2-computer-based/?class=IC2200&mode=';
const api='/api/term-tests/term-test-2';
const label='Báo lỗi âm thanh';
const issues=['Tôi không nghe thấy âm thanh','Tôi nghe thấy âm thanh nhưng bị rè','Cancel'];
const devices=['Headphone có dây','Headphone không dây','Loa ngoài'];
const deviceIds=['wired_headphones','wireless_headphones','external_speaker'];

test('Term 2 audio reporting preserves active Listening and links each confirmed interruption to its receipt',
  {timeout:210_000},async()=>{
  const socket=createServer().listen(0,'127.0.0.1');
  await once(socket,'listening');
  const {port}=socket.address();
  await new Promise(done=>socket.close(done));
  const base='http://127.0.0.1:'+port;
  const fixture=spawn(process.execPath,['tools/preview-exam-order.mjs',pages],{
    cwd:backend,windowsHide:true,stdio:['ignore','ignore','pipe'],
    env:{...Object.fromEntries(Object.entries(process.env).filter(([key])=>!(/^(?:K67_|DATABASE_URL$)/.test(key)))),K67_PREVIEW_PORT:String(port),K67_PREVIEW_REAL_TERM2_AUDIO:'true',
      K67_PREVIEW_TERM2_CBT_JOURNEY:'on',K67_PREVIEW_TERM2_PARALLEL_ENTRY:'true',
      K67_PREVIEW_TERM2_REPORT_CASES:'true',K67_PREVIEW_LISTENING_CONTINUITY:'true',
      K67_PREVIEW_TERM2_WRITING_HOLD:'true',K67_PREVIEW_AUDIO_PROTECTION:'true',K67_PREVIEW_WRITING_RESULT:'true',
      K67_PREVIEW_EXAM_JOURNAL:journal}
  });
  let browser,diagnostics='';
  fixture.stderr.setEncoding('utf8').on('data',data=>{diagnostics=(diagnostics+data).slice(-3500);});
  try{
    let ready=false;
    for(let i=0;i<180&&!ready&&fixture.exitCode===null;i++){
      try{ready=(await fetch(base+'/preview/status')).ok;}catch{}
      if(!ready)await delay(100);
    }
    assert.ok(ready,diagnostics||'Preview fixture did not start.');
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
    const errors=[];
    const studentRef=number=>'91000000-0000-4000-8000-'+String(number).padStart(12,'0');
    async function selectLearner(number,mode){
      const context=await browser.newContext({baseURL:base,viewport:{width:1024,height:600}});
      await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
      const page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(entry+mode);
      await page.locator('#bootstrapStudent').selectOption(studentRef(number));
      await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
      return {context,page};
    }
    async function open(number){
      const {context,page}=await selectLearner(number,'lis_first');
      await page.locator('#bootstrapPreview').click();
      await page.locator('#bootstrapStart').click();
      const audio=page.locator('#miniJourneyAudio');
      await page.waitForFunction(()=>document.querySelector('#miniJourneyAudio')?.currentTime>0.65);
      assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.continuity()),true);
      const report=page.getByRole('button',{name:label,exact:true});
      assert.equal(await report.count(),1, 'Expected the approved audio report button after playback starts.');
      const dialog=page.locator('#k67ListeningReportChoices');
      return {context,page,audio,report,dialog};
    }
    const view=page=>page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.miniJourney.view());
    const activeAudio=audio=>audio.evaluate(player=>({position:player.currentTime,paused:player.paused,rate:player.playbackRate}));
    async function seek(audio,second){
      await audio.evaluate((player,time)=>new Promise(done=>{
        player.addEventListener('seeked',done,{once:true});
        player.currentTime=time;
      }),second);
    }
    async function waitForLog(context,receipt,accept){
      let checkpoints=[];
      for(let i=0;i<45;i++){
        const lookup=receipt.continuationSection?'session='+receipt.examSessionToken:'attempt='+receipt.attemptToken;
        const response=await context.request.get('/preview/writing-journal?'+lookup);
        const data=await response.json();
        assert.ok(response.ok(),data.error);
        checkpoints=data.events.map(row=>row.data?.checkpointState).filter(Boolean);
        if(accept(checkpoints))return checkpoints;
        await delay(500);
      }
      assert.fail('Missing report checkpoints: '+JSON.stringify(checkpoints.filter(row=>row.action==='term2_k67_listening_reporting')));
    }

    for(let number=1;number<=4;number++){
      const {context,page,audio,report,dialog}=await open(number);
      const before=await view(page);
      const sealAttempts=[];
      page.on('request',request=>{
        if(['/cbt-journey/seal','/cbt-journey/interrupt'].some(path=>request.url()===base+api+path))
          sealAttempts.push(request.postDataJSON());
      });
      if(number===1){
        const input=page.locator('#listeningQuestions input[data-number]').first();
        await input.fill('Draft stays with this learner');
        const question=await input.getAttribute('data-number');
        await page.waitForFunction(key=>window.TERM_TEST_BOOTSTRAP.miniJourney.drafts().listening?.[key],question);
        await seek(audio,60);
        await page.waitForFunction(()=>{
          const player=document.querySelector('#miniJourneyAudio');
          return player.currentTime>60.35&&player.readyState>=3&&!player.paused;
        });
        await report.click();
        const notice=page.locator('.substitute-listening-report');
        assert.ok(await notice.isVisible(),await dialog.textContent({timeout:1000}).catch(()=>'<no dialog>'));
        assert.match(await notice.textContent(),/câu hỏi 1–5 của part 1.*giây/);
        assert.equal(await dialog.count(),0);
        assert.equal((await activeAudio(audio)).paused,false);
        await seek(audio,82.55);
        await report.click();
        await dialog.getByText('Hãy nghe thêm một chút', {exact:false}).waitFor();
        await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
        await dialog.waitFor({state:'detached'});
        assert.equal(await input.inputValue(),'Draft stays with this learner');
        assert.equal((await view(page)).listeningStartedAt,before.listeningStartedAt);
        assert.equal((await view(page)).listeningDeadlineAt,before.listeningDeadlineAt);
        assert.equal((await view(page)).listeningInterrupted,false);
        assert.equal(sealAttempts.length,0);
        await seek(audio,57.05);
        await report.click();
        await dialog.getByText('Hãy nghe thêm một chút',{exact:false}).waitFor();
        await page.keyboard.press('Escape');
        await dialog.waitFor({state:'detached'});
        await seek(audio,8);
        await report.click();
        await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
        const afterCancel=await activeAudio(audio);
        assert.ok(afterCancel.position>=8&&afterCancel.position<12);
        assert.equal(afterCancel.paused,false);
        assert.equal(await input.inputValue(),'Draft stays with this learner');
        assert.equal((await view(page)).listeningStartedAt,before.listeningStartedAt);
        assert.equal((await view(page)).listeningDeadlineAt,before.listeningDeadlineAt);
      }

      await seek(audio,8+number);
      const advancing=await activeAudio(audio);
      await report.click();
      await dialog.waitFor();
      assert.deepEqual(await dialog.getByRole('button').allTextContents(),issues);
      const bounds=await dialog.boundingBox();
      assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=600);
      await page.waitForFunction(position=>document.querySelector('#miniJourneyAudio')?.currentTime>position+0.25,advancing.position);
      assert.equal((await activeAudio(audio)).rate,1);
      assert.equal(sealAttempts.length,0);
      if(number>1){
        await dialog.getByRole('button',{name:issues[1],exact:true}).click();
        await dialog.getByRole('heading',{name:'Bạn đang dùng thiết bị âm thanh nào?'}).waitFor();
        assert.deepEqual(await dialog.getByRole('button').allTextContents(),devices);
        assert.equal((await activeAudio(audio)).paused,false);
        assert.equal(sealAttempts.length,0);
      }
      let logFailure;
      if(number===4){
        assert.ok((await context.request.post('/preview/term2-report-journal',{data:{paused:true}})).ok());
        logFailure=page.waitForResponse(response=>response.status()===503&&response.url()===base+api+'/journal-events');
      }
      const sealed=page.waitForResponse(response=>response.ok()&&response.url()===base+api+'/cbt-journey/interrupt');
      await dialog.getByRole('button',{name:number===1?issues[0]:devices[number-2],exact:true}).click();
      const interruption=page.getByRole('dialog',{name:'Listening gián đoạn'});
      await interruption.waitFor();
      const {receipt}=await (await sealed).json();
      assert.equal(receipt.outcome,'interrupted');
      assert.equal(receipt.examSessionToken,before.examSessionToken);
      assert.equal(sealAttempts.length,1);
      assert.equal(sealAttempts[0].operationId,receipt.operationId);
      assert.deepEqual(sealAttempts[0].answers,{});
      await interruption.getByRole('button',{name:'Tôi đã hiểu. Đến phần thi tiếp theo.',exact:true}).click();
      await page.locator('#startReading').click();
      await page.locator('#readingView').waitFor({state:'visible'});
      if(number===4){
        await logFailure;
        assert.ok((await context.request.post('/preview/term2-report-journal',{data:{paused:false}})).ok());
      }

      const confirmedPhases=['manual_report_classified','report_dialog_opened','report_issue_selected',
        'report_interruption_device_saved','report_interruption_server_received',
        ...(number>1?['report_device_selected']:[])];
      const rows=await waitForLog(context,receipt,logs=>confirmedPhases.every(phase=>logs.some(row=>
        row.phase===phase&&row.reportId===receipt.operationId)));
      const correlated=rows.filter(row=>row.reportId===receipt.operationId);
      const byPhase=phase=>correlated.find(row=>row.phase===phase);
      assert.equal(byPhase('manual_report_classified').decision,'expected_audible');
      assert.equal(byPhase('manual_report_classified').playbackRate,1);
      assert.ok(byPhase('report_dialog_opened'));
      assert.equal(byPhase('report_issue_selected').issue,number===1?'no_sound':'distorted');
      if(number>1)assert.equal(byPhase('report_device_selected').device,deviceIds[number-2]);
      assert.equal(byPhase('report_interruption_device_saved').operationId,receipt.operationId);
      assert.match(receipt.payloadHash,/^[a-f0-9]{64}$/);
      assert.equal(byPhase('report_interruption_server_received').payloadHash,receipt.payloadHash);
      if(number===1){
        const silence=rows.find(row=>row.phase==='manual_report_classified'&&row.decision==='planned_silence');
        assert.equal(silence.gapId,'before-q1');
        assert.ok(silence.offsetFromStartSeconds>0.5&&silence.offsetFromEndSeconds< -0.5);
        assert.ok(rows.some(row=>row.reportId===silence.reportId&&row.phase==='report_silence_notice_shown'));
        const cancelled=rows.filter(row=>row.phase==='report_cancelled');
        assert.equal(cancelled.length,3);
        let borderline=0;
        for(const row of cancelled){
          const classified=rows.find(log=>log.reportId===row.reportId&&log.phase==='manual_report_classified');
          if(classified.decision==='unverified'){
            borderline++;
            assert.ok(Math.min(Math.abs(classified.offsetFromStartSeconds),Math.abs(classified.offsetFromEndSeconds))<=0.6);
          }else assert.equal(classified.decision,'expected_audible');
          assert.ok(!rows.some(log=>log.reportId===row.reportId&&log.phase==='report_interruption_device_saved'));
        }
        assert.equal(borderline,2);
      }
      assert.ok(!JSON.stringify(rows.filter(row=>row.reportVersion===2)).includes('Draft stays with this learner'));
      await context.close();
    }

    const reading=await selectLearner(5,'read_first');
    await reading.page.locator('#bootstrapStart').click();
    await reading.page.locator('#readingView:visible, #startReading:visible').first().waitFor();
    if(await reading.page.locator('#startReading').isVisible())await reading.page.locator('#startReading').click();
    const readingAnswer=reading.page.locator('#readingQuestions input[data-number]').first();
    const number=Number(await readingAnswer.getAttribute('data-number'));
    await readingAnswer.fill('Reading before the audio interruption');
    reading.page.once('dialog',dialog=>dialog.accept());
    const readingSeal=reading.page.waitForResponse(response=>response.ok()&&response.url()===base+api+'/cbt-journey/seal');
    await reading.page.locator('#submitReading').click();
    const {receipt:readingReceipt}=await (await readingSeal).json();
    await reading.context.close();

    const {context,page,report,dialog}=await open(5);
    const scope=await view(page);
    assert.equal(scope.continuationSection,'listening');
    assert.notEqual(scope.examSessionToken,readingReceipt.examSessionToken);
    await report.click();
    await dialog.getByRole('button',{name:issues[0],exact:true}).waitFor();
    await context.setOffline(true);
    await dialog.getByRole('button',{name:issues[0],exact:true}).click();
    const interruption=page.getByRole('dialog',{name:'Listening gián đoạn'});
    await interruption.getByRole('button',{name:'Tôi đã hiểu. Đến phần thi tiếp theo.',exact:true}).click();
    const continueWriting=page.getByRole('button',{name:'Tiếp tục Writing',exact:true});
    assert.equal(await continueWriting.isVisible(),false);
    assert.equal((await view(page)).localOnly,true);
    const interruptionSeal=page.waitForResponse(response=>response.ok()&&response.url()===base+api+'/cbt-journey/interrupt');
    await context.setOffline(false);
    const {receipt:interruptionReceipt}=await (await interruptionSeal).json();
    assert.equal(interruptionReceipt.nextSection,'writing');
    assert.equal(interruptionReceipt.examSessionToken,scope.examSessionToken);
    assert.equal(interruptionReceipt.outcome,'interrupted');
    await waitForLog(context,interruptionReceipt,logs=>logs.some(row=>row.phase==='report_interruption_server_received'
      &&row.reportId===interruptionReceipt.operationId&&row.receiptId===interruptionReceipt.receiptId));
    await continueWriting.click();
    const writingEntry=page.locator('#writingView:visible, #startWriting:visible:enabled, #bootstrapStart:enabled');
    await writingEntry.first().waitFor({timeout:12000}).catch(async error=>{
      throw new Error((await page.locator('body').innerText()).slice(0,1200),{cause:error});
    });
    if(await page.locator('#bootstrapStart:enabled').count())await page.locator('#bootstrapStart').click();
    if(await page.locator('#startWriting:visible').count())await page.locator('#startWriting').click();
    await page.locator('#writingView').waitFor({state:'visible'});
    const writingScope=await view(page);
    assert.equal(writingScope.continuationSection,'writing');
    assert.equal(writingScope.listeningInterrupted,true);
    assert.equal(writingScope.listeningSubmitted,false);
    assert.notEqual(writingScope.examSessionToken,scope.examSessionToken);
    const answer='Writing from the authorized continuation.';
    await page.locator('textarea[data-writing-task="task1"]').fill('Task 1 from the authorized continuation.');
    await page.locator('.writing-task-tab').last().click();
    await page.locator('textarea[data-writing-task="task2"]').fill(answer);
    page.once('dialog',dialog=>dialog.accept());
    const writingSeal=page.waitForResponse(response=>response.ok()&&response.url()===base+api+'/cbt-journey/seal');
    await page.locator('#submitWriting').click();
    const {receipt:writingReceipt}=await (await writingSeal).json();
    assert.equal(writingReceipt.nextSection,'result');
    const official=await context.request.post('/api/term-tests/result',{
      data:{officialTerm2:{classCode:'IC2200',studentRef:studentRef(5)}}
    });
    assert.ok(official.ok(),await official.text());
    const persisted=await official.json();
    assert.equal(persisted.result.listeningStatus,'interrupted');
    assert.equal(persisted.result.listening,null);
    assert.equal(persisted.result.reading.details.find(item=>item.number===number).studentAnswer,'Reading before the audio interruption');
    assert.equal(persisted.writing.task2,answer);
    await context.close();
    assert.deepEqual(errors,[]);
  }finally{
    await browser?.close();
    fixture.kill();
  }
});
