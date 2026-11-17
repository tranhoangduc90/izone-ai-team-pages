// Browser Mini -> native interruption and actual owner/context/collect in an isolated store.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';process.env.K56_REAL_ROSTER_FIXTURE='1';
process.env.K56_MINI_CBT_PARALLEL_ENTRY_MODE='on';process.env.MINI_K56_CBT_OFFLINE_NEW='true';
for(const key of ['MINI_K56_OFFLINE_CONFIG_FILE','MINI_K56_LISTENING_REPORT_TELEGRAM_FILE','MINI_K56_LISTENING_REPORT_POLICY_FILE'])delete process.env[key];
assert.ok(process.env.MINI_NATIVE_FIXTURE?.includes('mini-k56-cbt-parallel-entry-20261118/native-fixture.mjs'));
assert.ok(process.env.TERM2_RUNTIME_ROOT?.includes('mini-cbt-candidate-v6-20261118'));
const {fixture:nativeFixture}=await import(pathToFileURL(process.env.MINI_NATIVE_FIXTURE));
const {createProductJournal}=await import(pathToFileURL(process.env.TERM2_RUNTIME_ROOT+'/src/exam-journal-runtime/src/product.mjs'));
const {termOwnerResolver}=await import(pathToFileURL(process.env.TERM2_RUNTIME_ROOT+'/src/exam-journal-runtime/adapters/term.mjs'));
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
const seed={window:{}};
for(const name of ['passages.js','content.js'])vm.runInNewContext(await readFile(new URL('../term-tests/mini-test-k56-computer-based/'+name,import.meta.url),'utf8'),seed);
test('Mini real report choices keep native receipt metadata in the submitting session',{timeout:80000},async()=>{
 const native=await nativeFixture('lis_first',{skipPrepare:true,realtime:true,listeningInterruption:true});let f,journal;
 try{
  native.admission=true;Object.assign(native.content,JSON.parse(JSON.stringify(seed.window.K56_TERM_TEST_CONTENT)));
  await native.db.exec('DELETE FROM assessment.term_test_attempt;DELETE FROM assessment.term_test_exam_session;');
  await native.db.exec(await readFile(process.env.MINI_NATIVE_MIGRATION,'utf8'));
  await native.db.exec("UPDATE mapping.classroom_course_mapping SET erp_class_name_snapshot='IC5601'");
  const identity={classCode:'IC5601',studentRef:native.student,attemptMode:'cbt',miniCbtContinuationVersion:1,mode:'lis_first',identityConfirmed:true};
  const a=await native.request('/attempt/prepare',identity);assert.equal(a.status,200);
  f=await fixture('lis_first',{product:'mini',native});const p=f.page;
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_MINI_OFFLINE?.record?.ready,'Mini native scope and new shell ready');
  const b=await p.evaluate(()=>window.K56_MINI_OFFLINE.scope);assert.notEqual(b.examSessionToken,a.examSessionToken);
  await p.evaluate(()=>{const r=window.K56_MINI_OFFLINE,observe=r.observe.bind(r);window.__nativeMiniReports=[];
   r.observe=(action,details,...rest)=>{if(action==='mini_player_observation'&&/report/.test(details?.phase||''))
    window.__nativeMiniReports.push({observedAt:new Date().toISOString(),...structuredClone(details)});return observe(action,details,...rest);};});
  await p.click('#bootstrapPreview');await p.click('#bootstrapStart');
  await wait(p,()=>window.K56_MINI_OFFLINE?.player?.currentTime>1,'Real Mini audio advancing');
  await p.getByRole('button',{name:'Báo lỗi âm thanh',exact:true}).click();
  await p.getByRole('button',{name:'Tôi nghe thấy âm thanh nhưng bị rè',exact:true}).click();
  await p.getByRole('button',{name:'Loa ngoài',exact:true}).click();
  await p.getByRole('dialog',{name:'Listening gián đoạn',exact:true}).waitFor();
  await wait(p,()=>window.K56_MINI_OFFLINE?.pending===0,'Native Mini interrupt receipt read');
  const interrupts=(await native.db.query("SELECT operation_id,receipt FROM assessment.mini_k56_offline_operation WHERE kind='interrupt'")).rows;
  assert.equal(interrupts.length,1);const interrupt=interrupts[0];
  assert.equal(interrupt.receipt.status,'accepted');assert.equal(interrupt.receipt.attemptToken,b.attemptToken);
  assert.equal((await native.db.query('SELECT count(*)::int AS n FROM assessment.term_test_attempt WHERE mini_cbt_official_submission')).rows[0].n,0);
  const rows=await p.evaluate(()=>window.__nativeMiniReports);
  const linked=rows.find(row=>row.phase==='report_interruption_device_saved');assert.equal(linked?.operationId,interrupt.operation_id);
  const selected=rows.find(row=>row.phase==='report_device_selected');assert.equal(selected?.device,'external_speaker');assert.equal(selected.reportId,linked.reportId);
  await p.getByRole('button',{name:'Tôi đã hiểu. Đến phần thi tiếp theo.',exact:true}).click();
  await p.locator('#k56SectionReady button').click();
  await p.locator('#readingQuestions input[data-number]').first().fill('Reading after native Mini speaker interruption');
  const resolveOwner=termOwnerResolver({schema:'assessment',query:(...args)=>native.db.query(...args)});
  const origin='https://synthetic.invalid',product='term-mini-k56';
  journal=createProductJournal({productId:product,fixtureMode:true,resolveOwner,allowedOrigins:[origin],build:'mini-native-report-fixture',
   fixtureConfig:{version:1,dataRoot:resolve(output,'collector-'+randomUUID()),encryptionKeys:{fixture:Buffer.alloc(32,7)},
    ticketKeys:{fixture:Buffer.alloc(32,8)},identityKey:Buffer.alloc(32,9),currentEncryptionKeyId:'fixture',currentTicketKeyId:'fixture',products:{[product]:{maxPhysicalBytes:50000000}}}});
  await journal.ready;assert.equal(journal.status().ready,true);
  const proof={attemptToken:b.attemptToken,examSessionToken:b.examSessionToken};
  const context=await journal.context(proof,{origin,testSlug:'mini-test-k56'});
  const scope=journal.scopeForOwner(await resolveOwner(proof,{testSlug:'mini-test-k56'}));
  const events=rows.map(({observedAt,...detail},i)=>({id:randomUUID(),pageVisitId:linked.reportId,sequence:i+1,schemaVersion:1,eventVersion:1,type:'state_observed',
   occurredAt:observedAt,elapsedMs:i,build:'mini-native-report-fixture',data:{cause:'mini_offline',checkpointState:{action:'mini_player_observation',offlineVersion:1,...detail}}}));
  const body={schemaVersion:1,bindingId:context.bindingId,auth:{ticket:context.ticket},events};
  const accepted=await journal.collect({method:'POST',headers:{origin},body});assert.equal(accepted.status,202,JSON.stringify(accepted));
  const saved=await journal.store.read(scope);assert.equal(saved.length,events.length);
  assert.equal(saved.find(row=>row.data.checkpointState.phase==='report_device_selected').data.checkpointState.device,'external_speaker');
  assert.equal(saved.find(row=>row.data.checkpointState.phase==='report_interruption_device_saved').data.checkpointState.operationId,interrupt.operation_id);
  const aScope=journal.scopeForOwner(await resolveOwner({examSessionToken:a.examSessionToken},{testSlug:'mini-test-k56'}));
  assert.equal((await journal.store.read(aScope)).length,0);
  const rejected=await journal.collect({method:'POST',headers:{origin},body:{...body,bindingId:'f'.repeat(64)}});assert.equal(rejected.status,403);
  assert.equal((await journal.store.read(scope)).length,events.length);assert.deepEqual(f.errors,[]);
  await writeFile(resolve(output,'MINI_REPORT_NATIVE_COLLECTOR_PROOF.json'),JSON.stringify({at:new Date().toISOString(),sourceSession:b.examSessionToken,otherSession:a.examSessionToken,
   reportId:linked.reportId,operationId:interrupt.operation_id,receiptId:interrupt.receipt.receiptId,eventIds:saved.map(row=>row.id),nativeInterruptAccepted:true,
   interruptionDidNotReserveOfficial:true,readingOpened:true,issueAndDeviceRetained:true,crossSessionDenied:true,
   boundary:'Real isolated browser/native HTTP/PGlite. Actual browser observations enveloped by the fixture into serving owner/context/collect with a local encrypted store. Not browser network -> VPS Collector/cloud, full audio, real device or Telegram proof.'},null,2));
 }finally{if(f)await f.close();await journal?.close();await native.close();}
});
