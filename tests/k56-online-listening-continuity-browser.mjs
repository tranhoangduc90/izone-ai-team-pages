import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const mini=process.env.K56_COMPAT_MINI==='1';
const profiles=process.env.K56_COMPAT_ORDER?[process.env.K56_COMPAT_ORDER]:['lis_first','read_first'];
const actions=['pause','stop','seekbackward','seekforward','seekto','play'];

for(const mode of profiles)test((mini?'Mini':'Term 1')+' K56 online protects the active Listening player '+mode,{timeout:85000},async t=>{
  const exam=await fixture(mode,{product:mini?'mini':1});
  exam.controls.r2Audio=true;
  const collector=process.env.TERM2_EVIDENCE&&resolve(process.env.TERM2_EVIDENCE,mode+'-collector.jsonl');
  if(collector)exam.controls.journalBatchFile=collector;
  exam.controls[mini?'onlineMini':'onlineTerm1']=true;
  exam.controls.preparedOverride={[mini?'miniCbtParallelEntry':'term1ParallelEntry']:false,
    submissionRecoveryVersion:1};
  const {page}=exam;
  page.setDefaultTimeout(12000);
  let step='initialization';
  t.after(()=>exam.close());
  await page.addInitScript(()=>{
    const mediaActions=new Map();
    Object.defineProperty(navigator,'mediaSession',{value:{
      setActionHandler(action,handler){if(handler)mediaActions.set(action,handler);else mediaActions.delete(action);},
      setPositionState(){}
    }});
    window.k56MediaTest={mediaActions};
  });
  try{
    await page.goto(exam.url);
    await page.locator('#bootstrapStudent').selectOption(exam.student);
    await page.click('#confirmIdentity');
    if(mode==='read_first'){
      step='reading';
      await page.getByRole('button',{name:'Bắt đầu Reading',exact:true}).click();
      await page.locator('#readingQuestions input[data-number]').first().fill('Reading draft before Listening');
      await page.click('#submitReading');
    }
    step='preview';
    await page.click('#bootstrapPreview');
    await page.click('#bootstrapStart',{timeout:45000});
    step='online player';
    await wait(page,()=>window.TERM_TEST_BOOTSTRAP?.officialAudioElement?.currentTime>.4,'online audio',12000);
    assert.equal(await page.evaluate(()=>Boolean((window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE)?.active)),false);
    assert.equal(await page.evaluate(()=>Boolean(window.K56_LISTENING_AUDIO?.inspect)),true);
    const before=await page.evaluate(expected=>{
      const audio=window.TERM_TEST_BOOTSTRAP.officialAudioElement;
      const state=window.k56MediaTest;
      const {mediaActions}=state;
      state.audio=audio;
      state.late=mediaActions.get('play');
      const source=audio.getAttribute('src'),position=audio.currentTime;
      for(const action of expected)mediaActions.get(action)?.({action});
      return {position,registered:[...mediaActions.keys()].sort(),same:source===audio.getAttribute('src'),
        paused:audio.paused,rate:audio.playbackRate};
    },actions);
    assert.deepEqual(before.registered,[...actions].sort());
    assert.equal(before.same,true);
    assert.equal(before.paused,false);
    assert.equal(before.rate,1);
    await page.waitForFunction(before=>window.k56MediaTest.audio.currentTime>before+.25,before.position);
    step='physical pause and resume';
    const stoppedAt=await page.evaluate(()=>{
      const audio=window.k56MediaTest.audio;
      audio.pause();
      return audio.currentTime;
    });
    await page.waitForFunction(()=>window.K56_LISTENING_AUDIO.inspect().phase==='awaiting_user');
    await page.getByRole('button',{name:'Nghe tiếp',exact:true}).click();
    await page.waitForFunction(position=>window.k56MediaTest.audio.currentTime>position+.15,stoppedAt);
    const resumed=await page.evaluate(()=>({
      position:window.k56MediaTest.audio.currentTime,rate:window.k56MediaTest.audio.playbackRate
    }));
    assert.equal(resumed.rate,1);
    assert.ok(resumed.position<stoppedAt+2);
    step='answer and submit';
    await page.locator('#listeningQuestions input[data-number]').first().fill('Listening still accepts answers');
    await page.click('#submitListening');
    await wait(page,()=>document.getElementById('listeningView').hidden,'next skill',12000);
    assert.deepEqual(await page.evaluate(()=>{
      const {audio,late,mediaActions}=window.k56MediaTest;
      late?.({action:'play'});
      return {paused:audio.paused,source:audio.hasAttribute('src'),connected:audio.isConnected,registered:mediaActions.size};
    }),{paused:true,source:false,connected:false,registered:0});
    if(collector){
      step='collector readback';
      let rows=[];
      const deadline=Date.now()+14000;
      do{
        const contents=await readFile(collector,'utf8').catch(error=>{
          if(error.code==='ENOENT')return '';
          throw error;
        });
        rows=contents.trim().split('\n').filter(Boolean).flatMap(line=>JSON.parse(line).rows)
          .map(row=>row.data.checkpointState).filter(row=>row?.playerId);
        if(rows.some(row=>row.action==='audio_media_action'&&row.disposition==='inactive')&&
          rows.some(row=>row.action==='audio_anomaly'&&row.event==='pause')&&
          rows.some(row=>row.action==='audio_player_retired'))break;
        await new Promise(resolve=>setTimeout(resolve,250));
      }while(Date.now()<deadline);
      const retired=rows.find(row=>row.action==='audio_player_retired'&&row.sourceCleared);
      assert.ok(retired);
      const player=rows.filter(row=>row.playerId===retired.playerId);
      assert.ok(player.some(row=>row.action==='audio_anomaly'&&row.event==='pause'&&row.source==='unknown'));
      assert.ok(player.some(row=>row.action==='audio_command'&&row.command==='play'&&row.commandId));
      assert.ok(player.some(row=>row.action==='audio_media_action'&&row.disposition==='inactive'));
    }
  }catch(error){
    const note=await page.locator('[role="alert"], #notice, #bootstrapNotice').allTextContents().catch(()=>[]);
    throw Error(step+' '+JSON.stringify({note,errors:exam.errors}),{cause:error});
  }
});
