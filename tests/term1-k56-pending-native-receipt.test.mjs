import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
process.env.K56_TEST_PRODUCT='1';process.env.K56_REAL_ROSTER_FIXTURE='1';process.env.TERM2_FIXTURE_IMPORT_ONLY='1';
process.env.K56_TERM1_PARALLEL_ENTRY_MODE='on';process.env.TERM1_OFFLINE_NEW_ENABLED='true';
delete process.env.TERM1_K56_LISTENING_REPORT_TELEGRAM_FILE;
assert.ok(process.env.TERM2_NATIVE_FIXTURE?.includes('term1-k56-candidate/candidate/fixture.mjs'));
const {fixture}=await import(pathToFileURL(process.env.TERM2_NATIVE_FIXTURE));
const {Term1Offline,ExamStore}=await import('../term-tests/term-test-1-k56-computer-based/'+(process.env.TERM1_PENDING_BASELINE==='1'?'offline-term1-parallel-entry-v1.mjs':'offline-term1-receipt-resume-v2.mjs'));
test('Term1 resume preserves its pending native first seal until its receipt is read',async()=>{
 const f=await fixture('read_first',{skipPrepare:true,realtime:true,listeningInterruption:true});
 try{
  await f.db.exec('DELETE FROM assessment.term_test_attempt;DELETE FROM assessment.term_test_exam_session;');
  const identity={classCode:'FIXTURE',studentRef:f.student,attemptMode:'cbt',term1ContinuationVersion:1,mode:'read_first',identityConfirmed:true};
  const a=await f.request('/attempt/prepare',identity);assert.equal(a.status,200);
  const scope={attemptToken:a.attemptToken,examSessionToken:a.examSessionToken,generation:a.generation,ownerId:randomUUID()};
  const prepared=await f.request('/offline/prepare',{...identity,...scope});assert.equal(prepared.status,200,JSON.stringify(prepared));
  const startedAt=new Date().toISOString(),deadlineAt=new Date(Date.now()+40*60000).toISOString();
  const make=kind=>({...scope,operationId:randomUUID(),section:'reading',kind,revision:kind==='start'?0:1,occurredAt:new Date().toISOString(),dependency:null,
   payload:{startedAt,deadlineAt,timeValid:true,answers:{'1':'A'},...(kind==='seal'?{reason:'manual'}:{})}});
  assert.equal((await f.request('/offline/operation',make('start'),prepared.offline.permit)).receipt?.status,'accepted');
  const seal=make('seal'),committed=await f.request('/offline/operation',seal,prepared.offline.permit);assert.equal(committed.receipt?.status,'accepted');
  const cache=new Map(),local={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)};
  const store=await new ExamStore({local,idb:null}).open();
  const r=new Term1Offline({classCode:'FIXTURE',store,apiBase:'https://synthetic.invalid',fetchImpl:async(url,options)=>{
   const response=await fetch(f.base+new URL(url).pathname.split('/term-test-1-k56')[1],{
    method:'POST',headers:{'content-type':'application/json','x-term2-permit':prepared.offline.permit},body:options.body});return response;}});
  r.owned=true;r.key='run:'+a.attemptToken;r.record={ready:true,classCode:'FIXTURE',studentRef:f.student,prepared,operations:[seal],receipts:{},
   sections:{reading:{startedAt,deadlineAt,sealed:true,operationId:seal.operationId,revision:1}},player:{}};r.anchor();
  await r.refreshCompletedElsewhere();
  assert.equal(r.pending,1,'A resume response must not remove its own pending native seal');
  assert.equal(r.record.sections.reading.operationId,seal.operationId);
  await r.flush();assert.equal(r.pending,0);assert.deepEqual(r.record.receipts[seal.operationId],committed.receipt);
  r.flush=async()=>{};await r.start('listening');assert.equal(r.record.operations[0].dependency,seal.operationId);
  console.log(JSON.stringify({nativeFirstSealPreserved:true,oneReceiptRead:true,nextSkillDependencyPreserved:true}));
 }finally{await f.close();}
});
