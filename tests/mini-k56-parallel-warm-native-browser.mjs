import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';process.env.K56_REAL_ROSTER_FIXTURE='1';
process.env.K56_MINI_CBT_PARALLEL_ENTRY_MODE='on';process.env.MINI_K56_CBT_OFFLINE_NEW='true';
delete process.env.MINI_K56_OFFLINE_CONFIG_FILE;delete process.env.MINI_K56_LISTENING_REPORT_TELEGRAM_FILE;
assert.ok(process.env.MINI_NATIVE_FIXTURE?.includes('mini-k56-cbt-parallel-entry-20261118/native-fixture.mjs'));
const {fixture:nativeFixture}=await import(pathToFileURL(process.env.MINI_NATIVE_FIXTURE));
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);assert.ok(process.env.MINI_OLD_BYTES);
const seed={window:{}};
for(const name of ['passages.js','content.js'])vm.runInNewContext(await readFile(new URL('../term-tests/mini-test-k56-computer-based/'+name,import.meta.url),'utf8'),seed);
test('Mini live v3 native Reading upgrades in place, restores offline after F5/reopen, and submits Task2 once after ACK loss',{timeout:120000},async()=>{
 const native=await nativeFixture('read_first',{skipPrepare:true,realtime:true,listeningInterruption:true});
 let f;const checkpoints=[];
 const checkpoint=async label=>checkpoints.push({label,
  browser:f&&await f.page.evaluate(()=>{const r=window.K56_MINI_OFFLINE;return{sections:r?.record?.sections,prepared:r?.record?.prepared,operations:r?.record?.operations,receipts:r?.record?.receipts};}),
  attempts:(await native.db.query('SELECT id,reading_submitted_at,listening_submitted_at,writing_submitted_at,mini_cbt_official_submission FROM assessment.term_test_attempt')).rows,
  runs:(await native.db.query('SELECT state FROM assessment.mini_k56_offline_run')).rows});
 try{
  native.admission=true;Object.assign(native.content,JSON.parse(JSON.stringify(seed.window.K56_TERM_TEST_CONTENT)));
  await native.db.exec('DELETE FROM assessment.term_test_attempt;DELETE FROM assessment.term_test_exam_session;');
  await native.db.exec(await readFile(process.env.MINI_NATIVE_MIGRATION,'utf8'));
  await native.db.exec("UPDATE mapping.classroom_course_mapping SET erp_class_name_snapshot='IC5601'");
  f=await fixture('read_first',{product:'mini',native,profile:'mini-warm-'+randomUUID()});let p=f.page;
  const entry='/term-tests/mini-test-k56-computer-based/';
  const old=await readFile(new URL('../term-tests/mini-test-k56-computer-based/index-shell-v3.html',import.meta.url),'utf8');
  const current=await readFile(new URL('../term-tests/mini-test-k56-computer-based/index-mini-parallel-entry-v1.html',import.meta.url),'utf8');
  const historical=JSON.parse(await readFile(process.env.MINI_OLD_BYTES,'utf8'));
  for(const item of historical){
   const bytes=await readFile(item.fixtureFile);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
   f.controls.assetOverrides.set(new URL(item.asset,f.url).pathname,bytes.toString('utf8'));
  }
  f.controls.assetOverrides.set(entry,old);f.controls.assetOverrides.set(entry+'index.html',old);
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_MINI_APP_READY&&window.K56_MINI_OFFLINE?.record?.ready,'Verified original Mini v3 Reading shell',20000);
  assert.match(await p.evaluate(()=>navigator.serviceWorker.controller.scriptURL),/offline-worker-shell-v3\.js/);
  await p.locator('#k56SectionReady button').click();
  await p.locator('#readingQuestions input[data-number]').first().fill('Mini Reading kept through the version change');
  await wait(p,()=>window.K56_MINI_OFFLINE.record.snapshot?.drafts?.reading?.['1']==='Mini Reading kept through the version change','Normal Mini autosave captured the typed answer');
  const before=await p.evaluate(()=>{const r=window.K56_MINI_OFFLINE,s=r.record.sections.reading;return{scope:r.scope,startedAt:s.startedAt,deadlineAt:s.deadlineAt};});
  assert.equal((await native.db.query('SELECT mini_cbt_parallel_entry FROM assessment.term_test_attempt WHERE id=$1',[before.scope.attemptToken])).rows[0].mini_cbt_parallel_entry,false);
  await checkpoint('legacy Reading draft');
  for(const item of historical)f.controls.assetOverrides.delete(new URL(item.asset,f.url).pathname);
  f.controls.assetOverrides.set(entry,current);f.controls.assetOverrides.set(entry+'index.html',current);
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Mini Reading kept through the version change');
  await p.reload();await wait(p,()=>window.K56_MINI_APP_READY&&window.K56_MINI_OFFLINE?.record?.prepared?.miniCbtParallelEntry===true,'Existing native Mini scope adopts the capability');
  await wait(p,()=>navigator.serviceWorker.controller?.scriptURL.includes('offline-worker-mini-parallel-entry-v1.js'),'Restored Mini verifies the new immutable shell',15000);
  assert.equal((await native.db.query('SELECT mini_cbt_parallel_entry FROM assessment.term_test_attempt WHERE id=$1',[before.scope.attemptToken])).rows[0].mini_cbt_parallel_entry,true);
  await checkpoint('after capability upgrade');
  const same=async()=>{
   assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Mini Reading kept through the version change');
   assert.deepEqual(await p.evaluate(()=>{const r=window.K56_MINI_OFFLINE,s=r.record.sections.reading;return{scope:r.scope,startedAt:s.startedAt,deadlineAt:s.deadlineAt};}),before);
  };
  f.disconnected=true;await f.context.setOffline(true);await p.reload();
  await wait(p,()=>window.K56_MINI_APP_READY,'Mini upgraded Reading F5 offline');await same();
  await f.reopen({offline:true});p=f.page;await p.goto(f.url);
  await wait(p,()=>window.K56_MINI_APP_READY,'Mini same profile closes and reopens offline');await same();
  const download=async name=>{
   const [file]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Tải bài làm về máy',exact:true}).click()]);
   const html=await readFile(await file.path(),'utf8');
   for(const value of Object.values(before.scope).filter(value=>typeof value==='string'))assert.equal(html.includes(value),false,'Native scope stays out of answer export');
   await writeFile(resolve(output,name+'.html'),html);return html;
  };
  assert.match(await download('MINI_WARM_READING_EXPORT'),/Mini Reading kept through the version change/);
  f.disconnected=false;await f.context.setOffline(false);await p.click('#submitReading');
  await wait(p,()=>window.K56_MINI_OFFLINE?.record?.sections.reading?.sealed&&window.K56_MINI_OFFLINE.pending===0,'Native Reading receipt recovered');
  await checkpoint('after Reading submit');
  await p.click('#bootstrapPreview');await p.click('#bootstrapStart');
  await wait(p,()=>window.K56_MINI_OFFLINE?.player?.currentTime>.5,'Mini Listening still uses its native initial-play path');
  await p.click('#submitListening');await p.click('#startWriting');
  const essay='Mini Task 2 typed after the live v3 scope and cache upgrade.';
  await p.locator('[data-writing-task="task2"]').fill(essay);
  assert.match(await download('MINI_WARM_TASK2_EXPORT'),/Mini Task 2 typed after the live v3 scope and cache upgrade/);
  f.controls.loseAck=true;await p.click('#submitWriting');
  await wait(p,()=>window.K56_MINI_OFFLINE?.record?.sections.writing?.sealed&&window.K56_MINI_OFFLINE.pending===0,'Mini Task2 receipt recovered after ACK loss',20000);
  const row=(await native.db.query('SELECT id,writing_task_2 FROM assessment.term_test_attempt WHERE mini_cbt_official_submission')).rows;
  assert.deepEqual(row,[{id:before.scope.attemptToken,writing_task_2:essay}]);
  assert.equal((await native.db.query('SELECT count(*)::int AS n FROM assessment.term_test_writing_grading_job')).rows[0].n,1);
  const receipts=(await native.db.query("SELECT receipt FROM assessment.mini_k56_offline_operation WHERE kind='seal' AND section='writing'")).rows;
  assert.equal(receipts.length,1);assert.equal(f.controls.ackLost,true);assert.deepEqual(f.errors,[]);
  await writeFile(resolve(output,'MINI_WARM_NATIVE_PROOF.json'),JSON.stringify({at:new Date().toISOString(),oldShell:'v3',newShell:'mini-parallel-v1',oldAssetsReconstructed:historical,
   sameNativeScope:true,sameReadingDraftAndClock:true,legacyCapabilityAdopted:true,f5Offline:true,reopenOffline:true,twoRealDownloads:true,oneTask2ReceiptAndJob:true,lostAck:true,
   boundary:'Real isolated browser/cache/download and native HTTP/PGlite; isolated roster/keys, selected historical bytes, short manual Listening branch, no full audio/device/AI/Portal/production claim'},null,2));
 }catch(error){
  const state=f&&await f.page.evaluate(()=>{const r=window.K56_MINI_OFFLINE;return{record:r?.record,lastError:r?.lastError,pending:r?.pending,diagnostics:r?.diagnostics};}).catch(()=>null);
  const operations=(await native.db.query('SELECT * FROM assessment.mini_k56_offline_operation ORDER BY operation_id')).rows;
  await writeFile(resolve(output,'MINI_WARM_NATIVE_FAILURE.json'),JSON.stringify({error:String(error),state,operations,checkpoints},null,2));
  throw error;
 }finally{if(f)await f.close();await native.close();}
});
