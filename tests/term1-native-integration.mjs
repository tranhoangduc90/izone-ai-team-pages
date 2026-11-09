// Browser → transport HTTP thật → transaction/receipt/grading SQL; API/danh tính cách ly.
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import { execFileSync } from 'node:child_process';
process.env.TERM2_FULL_ROUND='1';process.env.TERM2_FIXTURE_IMPORT_ONLY='1';
assert.ok(process.env.TERM2_NATIVE_FIXTURE,'Cần đường dẫn release/test.mjs đã ghép native source');
const {fixture:nativeFixture}=await import(pathToFileURL(process.env.TERM2_NATIVE_FIXTURE));
const {fixture,wait,activateWorkerUpdate}=await import('./term2-offline-browser.mjs');

const previousPagesRevision = process.env.TERM1_PREVIOUS_PAGES_REVISION;
test('Bài khóa offline từ Pages cũ đồng bộ qua Pages mới dù mất ACK', {
 timeout: 180000, skip: !previousPagesRevision
}, async () => {
 const native = await nativeFixture('lis_first', { skipPrepare: true, realtime: true, listeningInterruption: true });
 const f = await fixture('lis_first', { native, product: 1, defaultAutoplay: true });
 const p = f.page;
 try {
  const shell = 'term-tests/term-test-1-k56-computer-based';
  const changed = [
   ...['bootstrap.js', 'enhance.js', 'offline.mjs', 'offline-assets.mjs'].map(name => `${shell}/${name}`),
   'term-tests/k56-offline-shared/runtime.mjs', 'term-tests/k56-shared/app.js'
  ];
  for (const path of changed) {
   f.controls.assetOverrides.set('/' + path, execFileSync('git', ['show', `${previousPagesRevision}:${path}`]));
  }
  await p.goto(f.url);
  await p.locator('#bootstrapStudent option[value="' + f.student + '"]').waitFor({ state: 'attached' });
  await p.selectOption('#bootstrapStudent', f.student);
  await p.click('#confirmIdentity');
  await p.click('#bootstrapPreview');
  await p.click('#bootstrapStart');
  await wait(p, () => window.K56_TERM1_OFFLINE?.player?.currentTime > 0, 'Pages cũ phát audio');
  assert.equal(await p.evaluate(() => typeof window.K56_TERM1_OFFLINE.interruptListening), 'undefined');
  await p.locator('#listeningQuestions input[data-number]').first().fill('A');
  f.disconnected = true;
  await p.click('#submitListening');
  await wait(p, () => window.K56_TERM1_OFFLINE.record.sections.listening.sealed, 'Pages cũ khóa bài trên máy');
  const oldSeal = await p.evaluate(async () => {
   const runtime = window.K56_TERM1_OFFLINE;
   const stored = await runtime.store.get(runtime.key);
   return stored.operations.find(operation => operation.kind === 'seal' && operation.section === 'listening');
  });
  assert.ok(oldSeal?.operationId);
  assert.equal((await native.db.query('SELECT listening_submitted_at FROM assessment.term_test_attempt')).rows[0].listening_submitted_at, null);

  f.controls.assetOverrides.clear();
  await activateWorkerUpdate(p);
  await f.context.setOffline(true);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(p, () => typeof window.K56_TERM1_OFFLINE?.interruptListening === 'function' && window.K56_TERM1_APP_READY, 'Pages mới mở lại bài khi offline');
  const pending = await p.evaluate(() => window.K56_TERM1_OFFLINE.record.operations.find(operation => operation.kind === 'seal' && operation.section === 'listening'));
  assert.deepEqual(pending, oldSeal);
  assert.equal(await p.evaluate(() => window.K56_TERM1_OFFLINE.sectionResponse().nextSection), 'reading');
  f.controls.loseAck = true;
  f.disconnected = false;
  await f.context.setOffline(false);
  await wait(p, () => window.K56_TERM1_OFFLINE.pending === 0, 'Đọc lại biên nhận sau khi mất ACK');
  assert.equal(f.controls.ackLost, true);
  const stored = (await native.db.query("SELECT payload, receipt FROM assessment.term1_offline_operation WHERE section='listening' AND kind='seal'")).rows;
  assert.equal(stored.length, 1);
  assert.deepEqual(stored[0].payload, oldSeal);
  assert.equal(stored[0].receipt.status, 'accepted');
  assert.equal((await native.db.query("SELECT field FROM assessment.k56_portal_field_dispatch WHERE field='listening'")).rows.length, 1);
  assert.deepEqual(f.errors, []);
 } finally { await f.close(); await native.close(); }
});

for(const mode of ['lis_first','read_first'])test('Browser/native SQL end-to-end '+mode,{timeout:180000},async(t)=>{
 const native=await nativeFixture(mode,{skipPrepare:true,realtime:true}),f=await fixture(mode,{native,product:1,defaultAutoplay:true}),p=f.page;
 try{await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');await wait(p,()=>window.K56_TERM1_OFFLINE?.active,'Native prepare');
  for(const skill of mode==='read_first'?['reading','listening','writing']:['listening','reading','writing']){
   if(skill==='listening'){
    await wait(p,()=>[...document.querySelectorAll('audio')].some(audio=>audio.preload==='auto'&&audio.src.startsWith('blob:')&&audio.readyState>=3),'Trình phát chính sẵn sàng trước khi nghe thử');
    const preloadMs = await p.evaluate(() => {
     window.fixturePreloadedAudio=[...document.querySelectorAll('audio')].find(audio=>audio.preload==='auto'&&audio.src.startsWith('blob:')&&audio.readyState>=3);
     const runtime = window.K56_TERM1_OFFLINE;
     const observe = runtime.observe.bind(runtime);
     runtime.observe = (action, details) => {
      if (action === 'audio_playing') window.fixtureStartMs = details.elapsedMs;
      observe(action, details);
     };
     return runtime.diagnostics.findLast(event => event.action === 'audio_player_ready')?.elapsedMs;
    });
    assert.equal(await p.locator('#bootstrapStart').isDisabled(),true);
    await p.click('#bootstrapPreview');await p.waitForTimeout(1000);await p.click('#bootstrapPreview');
    assert.equal(await p.locator('#bootstrapStart').isDisabled(),true);
    await p.click('#bootstrapPreview');await p.waitForTimeout(11000);
    const downloads=f.controls.audioCalls.length;
    await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM1_OFFLINE.playerReady,'Native Listening');
    assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.player===window.fixturePreloadedAudio),true);
    assert.equal(f.controls.audioCalls.length,downloads);
    await wait(p,()=>window.K56_TERM1_OFFLINE.player.currentTime>0,'Listening thực sự phát');
    const startMs = await p.evaluate(() => window.fixtureStartMs);
    assert.ok(Number.isFinite(preloadMs) && preloadMs >= 0);
    assert.ok(Number.isFinite(startMs) && startMs >= 0);
    t.diagnostic(`player preload ${preloadMs.toFixed(1)} ms, click → playing ${startMs.toFixed(1)} ms`);
    await p.locator('#listeningQuestions input[data-number]').first().fill('A');
    f.controls.dismissNextConfirmation=true;
    await p.click('#submitListening');
    assert.equal(f.controls.dismissNextConfirmation,false);
    assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.paused),false);
    assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.record.sections.listening.sealed),false);
    await p.click('#submitListening');
   }
   else if(skill==='reading'){if(mode==='read_first')await wait(p,()=>window.K56_TERM1_APP_READY,'Native Reading ready');await(mode==='read_first'?p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first():p.locator('#startReading')).click();await p.locator('#readingQuestions input[data-number]').first().fill('A');await p.click('#submitReading');if(mode==='read_first')await wait(p,()=>Boolean(document.getElementById('bootstrapPreview')),'Native Listening lobby');}
   else {await p.click('#startWriting');f.disconnected=true;await f.context.setOffline(true);await p.locator('[data-writing-task="task2"]').fill('\u00a0\u200b');await p.click('#submitWriting');await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.writing?.sealed,'Native Writing sealed offline');}
  }
  f.disconnected=false;await f.context.setOffline(false);await p.evaluate(()=>{window.K56_TERM1_OFFLINE.retryAt=0;return window.K56_TERM1_OFFLINE.flush();});await wait(p,()=>window.K56_TERM1_OFFLINE.pending===0,'Native receipts khớp');
  const result=(await native.db.query('SELECT writing_score,status FROM assessment.term_test_writing_grading_final')).rows[0];assert.equal(Number(result?.writing_score),0);assert.equal(result.status,'ready');assert.equal((await native.db.query('SELECT * FROM assessment.term_test_writing_grading_job')).rows.length,0);
  assert.equal((await native.db.query("SELECT count(*)::int AS count FROM assessment.term1_offline_operation WHERE receipt->>'status'<>'accepted'")).rows[0].count,0);assert.deepEqual(f.errors,[]);
 }finally{await f.close();await native.close();}
});

for (const mode of ['lis_first', 'read_first']) test('Listening gián đoạn offline, đúng màn kế tiếp ' + mode, { timeout: 180000 }, async () => {
 const native = await nativeFixture(mode, { skipPrepare: true, realtime: true, listeningInterruption: true });
 const f = await fixture(mode, { native, product: 1 }), p = f.page;
 try {
  await p.goto(f.url);
  await p.locator('#bootstrapStudent option[value="' + f.student + '"]').waitFor({ state: 'attached' });
  await p.selectOption('#bootstrapStudent', f.student);
  await p.click('#confirmIdentity');
  if (mode === 'read_first') {
   await p.getByRole('button', { name: 'Bắt đầu Reading', exact: true }).first().click();
   await p.locator('#readingQuestions input[data-number]').first().fill('A');
   await p.click('#submitReading');
  }
  await p.click('#bootstrapPreview');
  await p.click('#bootstrapStart');
  await wait(p, () => window.K56_TERM1_OFFLINE?.player?.currentTime > 0, 'Listening thực sự phát');
  f.disconnected = true;
  await f.context.setOffline(true);
  if (mode === 'read_first') {
   await p.reload({ waitUntil: 'domcontentloaded' });
  } else {
   await p.getByRole('button', { name: 'Tôi không nghe được', exact: true }).click();
  }
  const confirm = p.getByRole('button', { name: 'Tôi đã hiểu. Đến phần thi tiếp theo.', exact: true });
  await confirm.waitFor();
  assert.equal(await p.evaluate(() => window.K56_TERM1_OFFLINE.record.operations.filter(op => op.kind === 'interrupt').length), 1);
  await confirm.click();
  const next = mode === 'read_first' ? 'writing' : 'reading';
  const nextButton = next === 'writing' ? p.locator('#startWriting') : p.getByRole('button', { name: 'Bắt đầu Reading', exact: true });
  await nextButton.first().waitFor();
  assert.equal(await p.evaluate(skill => Boolean(window.K56_TERM1_OFFLINE.record.sections[skill]?.startedAt), next), false);
  f.disconnected = false;
  await f.context.setOffline(false);
  await p.evaluate(() => { const runtime = window.K56_TERM1_OFFLINE; runtime.retryAt = 0; return runtime.flush(); });
  await wait(p, () => window.K56_TERM1_OFFLINE.pending === 0, 'Gián đoạn đã đồng bộ');
  const row = (await native.db.query('SELECT listening_submitted_at, listening_interrupted_at, listening_result FROM assessment.term_test_attempt')).rows[0];
  assert.ok(row.listening_interrupted_at);
  assert.equal(row.listening_submitted_at, null);
  assert.equal(row.listening_result, null);
  assert.deepEqual((await native.db.query("SELECT field FROM assessment.k56_portal_field_dispatch WHERE field='listening'")).rows, []);
  assert.deepEqual(f.errors, []);
 } finally { await f.close(); await native.close(); }
});

test('Listening tiếp tục khi trễ callback, rồi thu một lần ở ended thật khi offline', { timeout: 180000 }, async () => {
 const native = await nativeFixture('lis_first', { skipPrepare: true, realtime: true });
 const f = await fixture('lis_first', { native, product: 1 }), p = f.page;
 try {
  await p.goto(f.url);
  await p.locator('#bootstrapStudent option[value="' + f.student + '"]').waitFor({ state: 'attached' });
  await p.selectOption('#bootstrapStudent', f.student);
  await p.click('#confirmIdentity');
  await p.click('#bootstrapPreview');
  await p.click('#bootstrapStart');
  await wait(p, () => window.K56_TERM1_OFFLINE?.player?.currentTime > 0, 'Listening thực sự phát');
  await p.locator('#listeningQuestions input[data-number]').first().fill('A');
  f.disconnected = true;
  await f.context.setOffline(true);
  const initial = await p.evaluate(() => {
   const audio = window.K56_TERM1_OFFLINE.player;
   audio.addEventListener('timeupdate', event => event.stopImmediatePropagation(), true);
   audio.dispatchEvent(new Event('waiting'));
   window.dispatchEvent(new Event('blur'));
   return { position: audio.currentTime, source: audio.currentSrc };
  });
  await p.waitForTimeout(6200);
  const later = await p.evaluate(() => {
   const audio = window.K56_TERM1_OFFLINE.player;
   return { position: audio.currentTime, source: audio.currentSrc, paused: audio.paused };
  });
  assert.equal(later.paused, false);
  assert.ok(later.position > initial.position + 5);
  assert.equal(later.source, initial.source);
  assert.equal(await p.evaluate(() => window.K56_TERM1_OFFLINE.record.player.position), 0);
  // Accelerate this fixture only. Chromium dispatches a trusted ended after playing the last segment.
  await p.evaluate(() => { const audio = window.K56_TERM1_OFFLINE.player; audio.currentTime = audio.duration - 1; });
  await wait(p, () => window.K56_TERM1_OFFLINE.record.sections.listening?.sealed, 'Đã khóa Listening trên máy');
  assert.equal(await p.evaluate(() => window.K56_TERM1_OFFLINE.record.operations.filter(op => op.section === 'listening' && op.kind === 'seal').length), 1);
  assert.equal((await native.db.query('SELECT listening_submitted_at FROM assessment.term_test_attempt')).rows[0].listening_submitted_at, null);
  f.disconnected = false;
  await f.context.setOffline(false);
  await p.evaluate(() => { const runtime = window.K56_TERM1_OFFLINE; runtime.retryAt = 0; return runtime.flush(); });
  await wait(p, () => window.K56_TERM1_OFFLINE.pending === 0, 'Máy chủ đã nhận bài');
  const rows = (await native.db.query("SELECT field FROM assessment.k56_portal_field_dispatch WHERE field='listening'")).rows;
  assert.deepEqual(rows, [{ field: 'listening' }]);
  assert.deepEqual(f.errors, []);
 } finally { await f.close(); await native.close(); }
});
