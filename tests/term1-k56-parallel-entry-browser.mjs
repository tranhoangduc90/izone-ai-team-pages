// One isolated browser, synthetic API only. Preserve source drafts and deadlines.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;
assert.ok(output,'Evidence stays outside the source checkout');

test('Term1 fresh profile continues official progress, restores Reading offline and retries Task2 receipt', {timeout:150000},async()=>{
 const f=await fixture('lis_first',{product:1}),p=f.page;
 f.controls.r2Audio=true;
 f.controls.preparedOverride={term1ParallelEntry:true,officialProgress:{listening:'sealed',reading:'open',writing:'open'}};
 const prepares=[];
 p.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/attempt/prepare'))prepares.push(request.postDataJSON());});
 try{
  await p.setViewportSize({width:1024,height:600});
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM1_APP_READY&&window.K56_TERM1_OFFLINE?.record?.ready,'Term1 official progress opens the remaining Reading');
  assert.equal(prepares[0].term1ContinuationVersion,1);
  assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.sectionResponse().nextSection),'reading');
  assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.record.sections.listening.confirmedElsewhere),true);
  await p.locator('#k56SectionReady button').click();
  await p.locator('#readingQuestions input[data-number]').first().fill('Reading kept after profile continuation');
  const before=await p.evaluate(()=>({scope:window.K56_TERM1_OFFLINE.scope,section:window.K56_TERM1_OFFLINE.record.sections.reading}));
  assert.equal(await p.locator('#readingQuestions [data-number]').count(),26);
  await p.screenshot({path:resolve(output,'TERM1_K56_PARALLEL_READING_1024x600.png'),fullPage:true});
  f.disconnected=true;await f.context.setOffline(true);await p.reload();
  await wait(p,()=>window.K56_TERM1_APP_READY&&Boolean(window.K56_TERM1_OFFLINE?.record.sections.reading?.startedAt),'Term1 Reading opens from the verified offline shell');
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Reading kept after profile continuation');
  const after=await p.evaluate(()=>({scope:window.K56_TERM1_OFFLINE.scope,section:window.K56_TERM1_OFFLINE.record.sections.reading}));
  assert.deepEqual(after.scope,before.scope);
  assert.equal(after.section.startedAt,before.section.startedAt);assert.equal(after.section.deadlineAt,before.section.deadlineAt);
  f.disconnected=false;await f.context.setOffline(false);
  await p.click('#submitReading');
  await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.reading?.sealed,'Reading sealed locally');
  await p.click('#startWriting');
  await p.locator('[data-writing-task="task2"]').fill('Synthetic Task 2 after another profile submitted Listening.');
  f.controls.loseAck=true;
  await p.click('#submitWriting');
  await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.writing?.sealed,'Writing sealed without losing the essay');
  await wait(p,()=>window.K56_TERM1_OFFLINE.pending===0,'Retry reads the committed receipt');
  assert.equal(f.controls.ackLost,true);
  const writing=[...f.receipts.values()].filter(row=>row.kind==='seal'&&row.section==='writing');
  assert.equal(writing.length,1);
  const result=await p.evaluate(()=>({scope:window.K56_TERM1_OFFLINE.scope,drafts:window.K56_TERM1_OFFLINE.record.snapshot.drafts,
    receipt:window.K56_TERM1_OFFLINE.record.receipts[window.K56_TERM1_OFFLINE.record.sections.writing.operationId]}));
  assert.equal(result.receipt.receiptId,writing[0].receiptId);
  assert.equal(result.drafts.writing.task2,'Synthetic Task 2 after another profile submitted Listening.');
  assert.deepEqual(f.errors,[]);
  await mkdir(output,{recursive:true});
  await writeFile(resolve(output,'TERM1_K56_PARALLEL_BROWSER_PROOF.json'),JSON.stringify({
   capabilitySent:true,officialListeningAcceptedWithoutFakeReceipt:true,readingDraftRestored:true,
   sameScope:after.scope,sameStartedAt:after.section.startedAt,sameDeadlineAt:after.section.deadlineAt,
   lostAck:true,oneTask2Receipt:result.receipt.receiptId,
   boundary:'Synthetic API and real isolated browser; native SQL continuation/grading are separate evidence'
  },null,2));
 }finally{await f.close();}
});

test('Term1 old cache and a live Reading tab keep their scope and deadline through upgrade',{timeout:90000},async()=>{
 const f=await fixture('read_first',{product:1}),p=f.page;
 f.controls.r2Audio=true;
 const entry='/term-tests/term-test-1-k56-computer-based/';
 const oldIndex=await readFile(new URL('../term-tests/term-test-1-k56-computer-based/index-listening-first-frame-v1.html',import.meta.url),'utf8');
 const newIndex=await readFile(new URL('../term-tests/term-test-1-k56-computer-based/index-term1-parallel-entry-v1.html',import.meta.url),'utf8');
 f.controls.assetOverrides.set(entry,oldIndex);f.controls.assetOverrides.set(entry+'index.html',oldIndex);
 // Warm cache represents the valid package installed before the two shared
 // journal files changed. Verify their historical bytes rather than weakening hashes.
 const historical=[['reading-homework-journal.mjs','9ec9b8bdd83c577b26bb9a631f3f77a68bbc005b48f9555e48edd15272721668'],
  ['reading-practice-journal.mjs','2db3d9faf1836cd63683604b57d12663f96597622a4852e0cc7f4f19568ab438']];
 for(const [name,hash] of historical){
  const bytes=execFileSync('git',['show','dd6aa0c05ec95e351e9251c7f40c980e822fa8ba:shared/'+name]);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  f.controls.assetOverrides.set('/shared/'+name,bytes);
 }
 try{
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM1_APP_READY&&window.K56_TERM1_OFFLINE?.record?.ready,'Old Term1 Reading shell ready',15000);
  await p.locator('#k56SectionReady button').click();
  await p.locator('#readingQuestions input[data-number]').first().fill('Draft from the live old tab');
  const before=await p.evaluate(()=>({scope:window.K56_TERM1_OFFLINE.scope,section:window.K56_TERM1_OFFLINE.record.sections.reading}));
  assert.ok((await p.evaluate(()=>navigator.serviceWorker.controller.scriptURL)).includes('offline-worker-listening-first-frame-v1.js'));
  f.controls.assetOverrides.set(entry,newIndex);f.controls.assetOverrides.set(entry+'index.html',newIndex);
  for(const [name] of historical)f.controls.assetOverrides.delete('/shared/'+name);
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Draft from the live old tab');
  await p.reload();
  await wait(p,()=>window.K56_TERM1_APP_READY,'New Term1 loader restores the old Reading draft');
  await wait(p,()=>navigator.serviceWorker.controller?.scriptURL.includes('offline-worker-term1-parallel-entry-v1.js'),'Restored old run installs the new verified offline shell',15000);
  f.disconnected=true;await f.context.setOffline(true);await p.reload();
  await wait(p,()=>window.K56_TERM1_APP_READY,'New shell restores the old Reading offline');
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Draft from the live old tab');
  const after=await p.evaluate(()=>({scope:window.K56_TERM1_OFFLINE.scope,section:window.K56_TERM1_OFFLINE.record.sections.reading}));
  assert.deepEqual(after.scope,before.scope);
  assert.equal(after.section.startedAt,before.section.startedAt);assert.equal(after.section.deadlineAt,before.section.deadlineAt);
  assert.ok(await p.evaluate(()=>[...document.scripts].some(script=>script.src.includes('bootstrap-term1-parallel-entry-v1.js'))));
  assert.deepEqual(f.errors,[]);
  await writeFile(resolve(output,'TERM1_K56_WARM_UPGRADE_PROOF.json'),JSON.stringify({
   oldCache:true,liveTabPreserved:true,newLoaderOffline:true,sameScope:after.scope,sameStartedAt:after.section.startedAt,sameDeadlineAt:after.section.deadlineAt,
   boundary:'Same synthetic profile across actual old and new service workers; no production learner writes'
  },null,2));
 }finally{await f.close();}
});

test('Term1 audible and silent report branches keep native interruption and device evidence aligned',{timeout:150000},async t=>{
 const cases=[['no_sound','Tôi không nghe thấy âm thanh'],['wired_headphones','Headphone có dây'],
  ['wireless_headphones','Headphone không dây'],['external_speaker','Loa ngoài']];
 const proof=[];
 // Deliberately sequential: one browser and one synthetic run at a time.
 for(const [device,label] of cases.filter(([id])=>!process.env.K56_REPORT_CASE||id===process.env.K56_REPORT_CASE))await t.test(label,async()=>{
  const f=await fixture('lis_first',{product:1}),p=f.page;
  f.controls.r2Audio=true;f.controls.listeningReportsEnabled=true;
  f.controls.preparedOverride={term1ParallelEntry:true,officialProgress:null};
  try{
   await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
   await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
   await wait(p,()=>window.K56_TERM1_OFFLINE?.record?.ready,'Term1 native-profile Listening package ready');
   await p.click('#bootstrapPreview');await p.click('#bootstrapStart');
   await wait(p,()=>window.K56_TERM1_APP_READY&&window.K56_TERM1_OFFLINE?.player?.currentTime>.8,'Term1 audio advancing at 1×');
   await p.locator('#listeningQuestions input[data-number]').first().fill('Listening draft kept through reports');
   await p.locator('.cbt-part-button').filter({hasText:'Part 4'}).click();
   await p.locator('[data-number="32a"]').fill('compound a');await p.locator('[data-number="32b"]').fill('compound b');
   assert.equal(await p.locator('#listeningQuestions [data-number]').count(),41);
   await p.evaluate(()=>{
    window.__term1ReportEvents=[];const r=window.K56_TERM1_OFFLINE,observe=r.observe.bind(r);
    r.observe=(event,data)=>{if(event==='term1_listening_report')window.__term1ReportEvents.push(data);return observe(event,data);};
   });
   const seek=async target=>{
    await p.evaluate(async target=>{const a=window.K56_TERM1_OFFLINE.player;const ready=new Promise(resolve=>a.addEventListener('seeked',resolve,{once:true}));a.currentTime=target;await ready;},target);
    await p.waitForTimeout(350);
   };
   if(device==='no_sound'){
    await seek(56);
    await p.getByRole('button',{name:'Báo lỗi âm thanh',exact:true}).click();
    assert.equal(await p.locator('#k67ListeningReportChoices').count(),0);
    assert.match(await p.locator('.substitute-listening-report:not([hidden])').innerText(),/im lặng/);
    assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.paused),false);
   }
   await seek(20);
   await p.getByRole('button',{name:'Báo lỗi âm thanh',exact:true}).click();
   const modal=p.locator('#k67ListeningReportChoices');await modal.waitFor();
   assert.deepEqual(await modal.getByRole('button').allTextContents(),['Tôi không nghe thấy âm thanh','Tôi nghe thấy âm thanh nhưng bị rè','Cancel']);
   assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.paused),false);
   if(device==='no_sound'){
    await modal.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal([...f.receipts.values()].some(receipt=>receipt.kind==='interrupt'),false);
    assert.equal(await p.locator('[data-number="32a"]').inputValue(),'compound a');
    await p.getByRole('button',{name:'Báo lỗi âm thanh',exact:true}).click();
   }else{
    await modal.getByRole('button',{name:'Tôi nghe thấy âm thanh nhưng bị rè',exact:true}).click();
    assert.deepEqual(await modal.getByRole('button').allTextContents(),['Headphone có dây','Headphone không dây','Loa ngoài']);
   }
   await modal.getByRole('button',{name:label,exact:true}).click();
   await p.getByRole('dialog',{name:'Listening gián đoạn',exact:true}).waitFor();
   await wait(p,()=>window.K56_TERM1_OFFLINE.pending===0,'Term1 native-profile interruption receipt read');
   const receipts=[...f.receipts.values()].filter(receipt=>receipt.kind==='interrupt');assert.equal(receipts.length,1);
   const events=await p.evaluate(()=>window.__term1ReportEvents);
   const request=events.find(event=>event.phase==='report_interruption_requested');
   const saved=events.find(event=>event.phase==='report_interruption_device_saved');
   assert.equal(request.issue,device==='no_sound'?'no_sound':'distorted');
   if(device!=='no_sound')assert.equal(request.device,device);
   assert.equal(saved.reportId,request.reportId);assert.equal(saved.operationId,receipts[0].operationId);
   const continueButton=p.getByRole('button',{name:/Tôi đã hiểu\. Đến phần thi tiếp theo/});
   if(device==='external_speaker'){
    const frames=await p.evaluate(()=>new Promise(resolve=>{
     const button=document.querySelector('#offlineListeningInterrupted button'),rows=[];
     const capture=()=>{const rect=button.getBoundingClientRect(),style=getComputedStyle(button);
      rows.push({y:rect.y,height:rect.height,transform:style.transform,hover:button.matches(':hover'),sameElement:button===document.querySelector('#offlineListeningInterrupted button'),
       animations:button.getAnimations().map(a=>({playState:a.playState,currentTime:a.currentTime}))});
      if(rows.length<25)requestAnimationFrame(capture);else resolve(rows);};requestAnimationFrame(capture);
    }));
    await writeFile(resolve(output,'TERM1_K56_SPEAKER_BUTTON_FRAMES.json'),JSON.stringify(frames,null,2));
    const boxes=[];
    for(let i=0;i<5;i++){boxes.push(await continueButton.boundingBox());await p.waitForTimeout(150);}
    await writeFile(resolve(output,'TERM1_K56_SPEAKER_BUTTON_GEOMETRY.json'),JSON.stringify(boxes));
    await p.screenshot({path:resolve(output,'TERM1_K56_SPEAKER_INTERRUPTION.png'),fullPage:true});
   }
   await continueButton.click({timeout:10000});
   await wait(p,()=>Boolean(document.querySelector('#k56SectionReady button')),'Reading ready after acknowledging the interruption',10000);
   assert.deepEqual(f.errors,[]);
   proof.push({device,reportId:request.reportId,operationId:saved.operationId,receiptId:receipts[0].receiptId,questions:41,
    boundary:'Real browser/media at 1× with deliberate seeking to branch windows; synthetic receipt API, not full-duration audio'});
  }finally{await f.close();}
 });
 await writeFile(resolve(output,'TERM1_K56_REPORT_CHOICES_PROOF.json'),JSON.stringify(proof,null,2));
});
