// Real browser -> HTTP -> native admission/transactions/receipts/grading queue.
// The roster, questions/keys and database are synthetic. No production writes.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';process.env.TERM2_FIXTURE_IMPORT_ONLY='1';
assert.equal(process.env.K56_REAL_ROSTER_FIXTURE,'1');
assert.equal(process.env.K56_TERM1_PARALLEL_ENTRY_MODE,'on');
assert.ok(process.env.TERM2_NATIVE_FIXTURE?.includes('term1-k56-candidate/candidate/fixture.mjs'));
const {fixture:nativeFixture}=await import(pathToFileURL(process.env.TERM2_NATIVE_FIXTURE));
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
const source=await readFile(new URL('../term-tests/term-test-1-k56-computer-based/content.js',import.meta.url),'utf8');
const seed={window:{}};vm.runInNewContext(source,seed);const content=JSON.parse(JSON.stringify(seed.window.K56_TERM_TEST_CONTENT));

for(const first of ['listening','reading'])test('Term1 native browser continues '+first+' accepted by a different profile',{timeout:100000},async()=>{
 const native=await nativeFixture(first==='listening'?'lis_first':'read_first',{skipPrepare:true,realtime:true,listeningInterruption:true});
 let f;
 try{
  native.admission=true;Object.assign(native.content,content);
  await native.db.exec('DELETE FROM assessment.term_test_attempt;DELETE FROM assessment.term_test_exam_session;');
  await native.db.exec("UPDATE mapping.classroom_course_mapping SET erp_class_name_snapshot='IC5601'");
  const identity={classCode:'IC5601',studentRef:native.student,attemptMode:'cbt',term1ContinuationVersion:1,mode:first==='listening'?'lis_first':'read_first'};
  const a=await native.request('/attempt/prepare',identity);assert.equal(a.status,200,JSON.stringify(a));
  const scope={attemptToken:a.attemptToken,examSessionToken:a.examSessionToken,generation:a.generation,ownerId:randomUUID()};
  const prepared=await native.request('/offline/prepare',{...identity,...scope});assert.equal(prepared.status,200,JSON.stringify(prepared));
  const startedAt=new Date().toISOString();
  const make=kind=>({...scope,operationId:randomUUID(),section:first,kind,revision:kind==='start'?0:1,
   occurredAt:new Date().toISOString(),dependency:null,payload:{startedAt,
    deadlineAt:first==='reading'?new Date(Date.parse(startedAt)+40*60000).toISOString():null,timeValid:true,
    answers:first==='listening'?{'1':'A','32a':'A','32b':'B'}:{'1':'A'},...(kind==='seal'?{reason:'manual'}:{})}});
  assert.equal((await native.request('/offline/operation',make('start'),prepared.offline.permit)).receipt?.status,'accepted');
  const sealed=await native.request('/offline/operation',make('seal'),prepared.offline.permit);assert.equal(sealed.receipt?.status,'accepted',JSON.stringify(sealed));
  f=await fixture(first==='listening'?'read_first':'lis_first',{product:1,native});
  const p=f.page;f.controls.loseAck=true;
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM1_OFFLINE?.record?.ready,'Native Term1 independent browser profile prepared',20000);
  const b=await p.evaluate(()=>window.K56_TERM1_OFFLINE.scope);
  assert.notEqual(b.attemptToken,scope.attemptToken);assert.notEqual(b.examSessionToken,scope.examSessionToken);
  const remaining=first==='listening'?'reading':'listening';
  assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.sectionResponse().nextSection),remaining);
  if(remaining==='reading'){
   await wait(p,()=>window.K56_TERM1_APP_READY,'Native Reading view');
   await p.locator('#k56SectionReady button').click();
   await p.locator('#readingQuestions input[data-number]').first().fill('A');await p.click('#submitReading');
  }else{
   await p.click('#bootstrapPreview');await p.click('#bootstrapStart');
   await wait(p,()=>window.K56_TERM1_OFFLINE.player?.currentTime>.5,'Native Listening 1×');
   await p.locator('#listeningQuestions input[data-number]').first().fill('A');await p.click('#submitListening');
  }
  await wait(p,()=>window.K56_TERM1_OFFLINE.pending===0,'Native receipt recovered after lost ACK',20000);
  await p.click('#startWriting');
  const essay='Synthetic Task 2 from the second profile after '+first+' was accepted by the first.';
  await p.locator('[data-writing-task="task2"]').fill(essay);await p.click('#submitWriting');
  await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.writing?.sealed&&window.K56_TERM1_OFFLINE.pending===0,'Native Task2 receipt read',20000);
  const operations=(await native.db.query("SELECT section,kind,receipt FROM assessment.term1_offline_operation WHERE kind='seal' ORDER BY section")).rows;
  assert.equal(operations.length,3);
  const writing=operations.find(row=>row.section==='writing').receipt;
  assert.equal(writing.attemptToken,b.attemptToken);assert.equal(writing.examSessionToken,b.examSessionToken);
  assert.equal(writing.officialAttemptToken,a.attemptToken);
  const official=(await native.db.query('SELECT id,listening_answers,reading_answers,writing_task_2 FROM assessment.term_test_attempt WHERE listening_submitted_at IS NOT NULL AND reading_submitted_at IS NOT NULL')).rows;
  assert.equal(official.length,1);assert.equal(official[0].id,a.attemptToken);assert.equal(official[0].writing_task_2,essay);
  const runs=(await native.db.query('SELECT attempt_id,task_number,essay_text FROM assessment.term_test_writing_grading_run')).rows;
  assert.deepEqual(runs,[{attempt_id:a.attemptToken,task_number:2,essay_text:essay}]);
  assert.equal((await native.db.query('SELECT count(*)::int AS n FROM assessment.term_test_writing_grading_job')).rows[0].n,1);
  assert.equal(f.controls.ackLost,true);assert.deepEqual(f.errors,[]);
  await writeFile(resolve(output,'TERM1_K56_NATIVE_BROWSER_'+first+'.json'),JSON.stringify({first,
   sourceAttempt:b.attemptToken,officialAttempt:a.attemptToken,receiptId:writing.receiptId,
   oneOfficialResult:true,oneTask2RunAndJob:true,lostAck:true,
   boundary:'Actual native admission/HTTP/SQL and browser; roster/keys isolated, media branch is short, no real AI or Portal write'
  },null,2));
 }finally{if(f)await f.close();await native.close();}
});
