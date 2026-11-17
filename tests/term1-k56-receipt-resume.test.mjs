import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const name='offline-term1-receipt-resume-v2.mjs';
const {Term1Offline,ExamStore,exportHtml}=await import('../term-tests/term-test-1-k56-computer-based/'+name);
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
async function fixture(progress={}){
 const store=await new ExamStore({local:memory(),idb:null}).open();
 const runtime=new Term1Offline({apiBase:'https://synthetic.invalid',classCode:'FIXTURE',store,
  fetchImpl:async()=>({ok:true,json:async()=>({ok:true,officialProgress:progress,completedElsewhere:{}})})});
 runtime.record={ready:true,prepared:{attemptToken:randomUUID(),examSessionToken:randomUUID(),generation:4,term1ParallelEntry:true,
  examMode:'lis_first',serverNow:new Date().toISOString(),timing:{readingDurationMinutes:40,writingDurationMinutes:55},
  offline:{ownerId:randomUUID(),permit:'fixture-only'}},sections:{},operations:[],receipts:{},player:{position:0,ended:false},
  snapshot:{drafts:{listening:{'32a':'pair a','32b':'pair b'},reading:{'1':'local reading'},writing:{task2:'Local Task 2'}}}};
 runtime.key='run:'+runtime.record.prepared.attemptToken;runtime.owned=true;runtime.anchor();return runtime;
}

test('Term1 official progress preserves the losing local text without inventing a receipt',async()=>{
 const r=await fixture(),id=randomUUID();
 r.record.sections.listening={operationId:id,startedAt:new Date().toISOString()};
 r.record.operations=[{...r.scope,operationId:id,section:'listening',kind:'seal',payload:{answers:{'32a':'pair a','32b':'pair b'}}}];
 assert.equal(typeof r.acceptOfficialProgress,'function','The current Term1 UI must understand the native official progress response');
 assert.equal(r.acceptOfficialProgress({listening:'sealed',reading:'open',writing:'open'},'listening'),true);
 assert.equal(r.sectionResponse().nextSection,'reading');
 assert.equal(r.record.operations.length,0);assert.equal(Object.keys(r.record.receipts).length,0);
 assert.deepEqual(r.record.supersededLocalOperations[0].payload.answers,{'32a':'pair a','32b':'pair b'});
 assert.equal(r.record.snapshot.drafts.writing.task2,'Local Task 2');
 assert.equal(r.record.prepared.generation,4);
 const exported=exportHtml(r.record);assert.match(exported,/pair a/);
 for(const value of [r.scope.attemptToken,r.scope.examSessionToken,r.scope.ownerId])assert.equal(exported.includes(value),false,'Export keeps local answers without native session scope');
});

test('Term1 resume reads official progress and keeps a durable local Reading draft',async()=>{
 const r=await fixture({listening:'sealed',reading:'sealed',writing:'open'});
 await r.refreshCompletedElsewhere();
 assert.equal(r.sectionResponse().nextSection,'writing');
 assert.equal((await r.store.get(r.key)).snapshot.drafts.reading['1'],'local reading');
 assert.equal(Object.keys(r.record.receipts).length,0);
});

test('Term1 progress never replaces a skill already confirmed by its own receipt',async()=>{
 const r=await fixture(),id=randomUUID();
 r.record.sections.listening={operationId:id,sealed:true};r.record.receipts[id]={status:'accepted'};
 assert.equal(r.acceptOfficialProgress({listening:'interrupted'}),false);
 assert.equal(r.record.sections.listening.sealed,true);assert.equal(r.record.sections.listening.operationId,id);
 r.record.prepared.term1ParallelEntry=false;
 assert.equal(r.acceptOfficialProgress({reading:'sealed'}),false,'A legacy or fallback run must not inherit parallel permissions');
});

test('Term1 parallel shell hashes the exact immutable dependency graph',async()=>{
 const {createHash}=await import('node:crypto');
 const route=new URL('../term-tests/term-test-1-k56-computer-based/',import.meta.url);
 const {ASSETS,ASSET_HASHES,ASSET_BUILD_ID}=await import(new URL('offline-assets-term1-receipt-resume-v2.mjs',route));
 assert.equal(ASSETS.includes('index.html'),false);
 assert.ok(ASSETS.includes('index-term1-receipt-resume-v2.html'));
 for(const name of ASSETS){
  const file=new URL(name,route),bytes=await readFile(file);
  const data=/\.(png|woff2)$/.test(name)?bytes:bytes.toString('utf8').replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(data).digest('hex'),ASSET_HASHES[name],name);
 }
 assert.equal(createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(ASSET_HASHES).sort().map(key=>[key,ASSET_HASHES[key]])))).digest('hex'),ASSET_BUILD_ID);
});
