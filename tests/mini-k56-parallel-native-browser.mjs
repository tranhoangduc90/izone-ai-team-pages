// Real isolated browser -> native HTTP/PGlite. No learner, AI or Portal writes.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';
process.env.K56_REAL_ROSTER_FIXTURE='1';
process.env.K56_MINI_CBT_PARALLEL_ENTRY_MODE='on';
process.env.MINI_K56_CBT_OFFLINE_NEW='true';
delete process.env.MINI_K56_OFFLINE_CONFIG_FILE;
delete process.env.MINI_K56_LISTENING_REPORT_TELEGRAM_FILE;
assert.ok(process.env.MINI_NATIVE_FIXTURE?.includes('mini-k56-cbt-parallel-entry-20261118/native-fixture.mjs'));
const {fixture:nativeFixture}=await import(pathToFileURL(process.env.MINI_NATIVE_FIXTURE));
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
const seed={window:{}};
for(const file of ['passages.js','content.js'])vm.runInNewContext(await readFile(new URL('../term-tests/mini-test-k56-computer-based/'+file,import.meta.url),'utf8'),seed);
const content=JSON.parse(JSON.stringify(seed.window.K56_TERM_TEST_CONTENT));
for(const first of ['listening','reading'])test('Mini native browser continues after '+first+' was accepted by another profile',{timeout:100000},async()=>{
 const mode=first==='listening'?'lis_first':'read_first';
 const native=await nativeFixture(mode,{skipPrepare:true,realtime:true,listeningInterruption:true});
 let f;
 try{
  native.admission=true;Object.assign(native.content,content);
  await native.db.exec('DELETE FROM assessment.term_test_attempt;DELETE FROM assessment.term_test_exam_session;');
  await native.db.exec(await readFile(process.env.MINI_NATIVE_MIGRATION,'utf8'));
  await native.db.exec("UPDATE mapping.classroom_course_mapping SET erp_class_name_snapshot='IC5601'");
  const identity={classCode:'IC5601',studentRef:native.student,attemptMode:'cbt',miniCbtContinuationVersion:1,mode,identityConfirmed:true};
  const a=await native.request('/attempt/prepare',identity);assert.equal(a.status,200,JSON.stringify(a));
  const scope={attemptToken:a.attemptToken,examSessionToken:a.examSessionToken,generation:a.generation,ownerId:randomUUID()};
  const prepared=await native.request('/offline/prepare',{...identity,...scope});assert.equal(prepared.status,200,JSON.stringify(prepared));
  const startedAt=new Date().toISOString();
  const make=kind=>({...scope,operationId:randomUUID(),section:first,kind,revision:kind==='start'?0:1,occurredAt:new Date().toISOString(),dependency:null,
   payload:{startedAt,deadlineAt:first==='reading'?new Date(Date.parse(startedAt)+25*60000).toISOString():null,timeValid:true,answers:{'1':'A'},...(kind==='seal'?{reason:'manual'}:{})}});
  assert.equal((await native.request('/offline/operation',make('start'),prepared.offline.permit)).receipt?.status,'accepted');
  assert.equal((await native.request('/offline/operation',make('seal'),prepared.offline.permit)).receipt?.status,'accepted');
  f=await fixture(first==='listening'?'read_first':'lis_first',{product:'mini',native});
  const p=f.page;f.controls.loseAck=true;
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_MINI_OFFLINE?.record?.ready,'Independent Mini browser scope and verified shell ready',20000);
  const b=await p.evaluate(()=>window.K56_MINI_OFFLINE.scope);
  assert.notEqual(b.attemptToken,scope.attemptToken);assert.notEqual(b.examSessionToken,scope.examSessionToken);
  const remaining=first==='listening'?'reading':'listening';
  assert.equal(await p.evaluate(()=>window.K56_MINI_OFFLINE.sectionResponse().nextSection),remaining);
  if(remaining==='reading'){
   await wait(p,()=>window.K56_MINI_APP_READY,'Native Mini Reading view');
   await p.locator('#k56SectionReady button').click();
   await p.locator('#readingQuestions input[data-number]').first().fill('A');await p.click('#submitReading');
  }else{
   await p.click('#bootstrapPreview');await p.click('#bootstrapStart');
   await wait(p,()=>window.K56_MINI_OFFLINE?.player?.currentTime>.5,'Mini playback advancing at 1×');
   await p.locator('#listeningQuestions input[data-number]').first().fill('A');await p.click('#submitListening');
  }
  await wait(p,()=>window.K56_MINI_OFFLINE?.pending===0,'Native Mini receipt recovered after lost ACK',20000);
  await p.click('#startWriting');
  const essay='Synthetic Mini paragraph submitted by profile B after the first official '+first+' from A.';
  await p.locator('[data-writing-task="task2"]').fill(essay);await p.click('#submitWriting');
  await wait(p,()=>window.K56_MINI_OFFLINE?.record?.sections.writing?.sealed&&window.K56_MINI_OFFLINE.pending===0,'Native Mini Writing receipt read',20000);
  const seals=(await native.db.query("SELECT section,receipt FROM assessment.mini_k56_offline_operation WHERE kind='seal' ORDER BY section")).rows;
  assert.equal(seals.length,3);const writing=seals.find(row=>row.section==='writing').receipt;
  assert.equal(writing.attemptToken,b.attemptToken);assert.equal(writing.examSessionToken,b.examSessionToken);assert.equal(writing.officialAttemptToken,a.attemptToken);
  const official=(await native.db.query('SELECT id,writing_task_2 FROM assessment.term_test_attempt WHERE mini_cbt_official_submission')).rows;
  assert.deepEqual(official,[{id:a.attemptToken,writing_task_2:essay}]);
  const runs=(await native.db.query('SELECT attempt_id,task_number,essay_text FROM assessment.term_test_writing_grading_run')).rows;
  assert.deepEqual(runs,[{attempt_id:a.attemptToken,task_number:2,essay_text:essay}]);
  assert.equal((await native.db.query('SELECT count(*)::int AS n FROM assessment.term_test_writing_grading_job')).rows[0].n,1);
  assert.equal(f.controls.ackLost,true);assert.deepEqual(f.errors,[]);
  await writeFile(resolve(output,'MINI_K56_NATIVE_BROWSER_'+first+'.json'),JSON.stringify({first,sourceAttempt:b.attemptToken,officialAttempt:a.attemptToken,
   receiptId:writing.receiptId,oneOfficialResult:true,oneTask2RunAndJob:true,lostAck:true,
   boundary:'Actual Mini browser/native HTTP/PGlite and isolated roster/keys. A first seal via native API; B uses UI. Short manual Listening branch, no full-duration audio, AI or Portal claim'},null,2));
 }finally{if(f)await f.close();await native.close();}
});
