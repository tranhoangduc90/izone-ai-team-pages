import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const baseline=process.env.K56_MINI_PARALLEL_BASELINE==='1';
const {OfflineRuntime,ExamStore,exportHtml}=await import('../term-tests/mini-test-k56-computer-based/'+(baseline?'offline-audio-status-v2.mjs':'offline-mini-parallel-entry-v1.mjs'));
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
async function fixture(fetcher){
 const store=await new ExamStore({local:memory(),idb:null}).open();
 const r=new OfflineRuntime({apiBase:'https://synthetic.invalid',classCode:'FIXTURE',store,fetchImpl:fetcher});
 r.record={ready:true,classCode:'FIXTURE',studentRef:randomUUID(),prepared:{attemptToken:randomUUID(),examSessionToken:randomUUID(),generation:2,
  miniCbtParallelEntry:true,examMode:'read_first',serverNow:new Date().toISOString(),timing:{readingDurationMinutes:25,writingDurationMinutes:15},
  offline:{ownerId:randomUUID(),permit:'synthetic-permit'}},sections:{},operations:[],receipts:{},player:{position:0,ended:false},
  snapshot:{drafts:{reading:{'1':'Local Mini reading'},writing:{task2:'Retained Mini paragraph'}}}};
 r.key='run:'+r.record.prepared.attemptToken;r.owned=true;r.anchor();return r;
}
test('Mini explicit skill conflict keeps local answers without inventing a native receipt',async()=>{
 const r=await fixture();assert.equal(typeof r.acceptOfficialProgress,'function','Mini needs native official progress support');
 const id=randomUUID();r.record.sections.reading={operationId:id,startedAt:new Date().toISOString()};
 r.record.operations=[{...r.scope,operationId:id,section:'reading',kind:'seal',revision:1,payload:{answers:{'1':'Retained losing Mini answer'}}}];
 assert.equal(r.acceptOfficialProgress({reading:'sealed',listening:'open',writing:'open'},'reading'),true);
 assert.equal(r.pending,0);assert.equal(r.sectionResponse().nextSection,'listening');assert.deepEqual(r.record.receipts,{});
 assert.equal(r.record.supersededLocalOperations[0].payload.answers['1'],'Retained losing Mini answer');
 const html=exportHtml(r.record);assert.match(html,/Retained losing Mini answer/);assert.match(html,/Retained Mini paragraph/);
 for(const value of [r.scope.attemptToken,r.scope.examSessionToken,r.scope.ownerId,'synthetic-permit'])assert.equal(html.includes(value),false);
 assert.equal(r.record.supersededLocalOperations[0].attemptToken,r.scope.attemptToken);
});
test('Mini warm refresh adopts only its exact native scope and keeps drafts and clocks',async()=>{
 let sent;
 const r=await fixture(async(url,options)=>{sent=JSON.parse(options.body);return{ok:true,json:async()=>({ok:true,...r.scope,attemptMode:'cbt',examMode:'read_first',miniCbtParallelEntry:true,officialProgress:{reading:'sealed',listening:'open',writing:'open'}})};});
 delete r.record.prepared.miniCbtParallelEntry;
 const startedAt=new Date().toISOString(),deadlineAt=new Date(Date.now()+25*60000).toISOString();
 r.record.sections.reading={startedAt,deadlineAt};
 assert.equal(await r.refreshOfficialProgress(),true);
 assert.equal(sent.miniCbtContinuationVersion,1);assert.equal(sent.studentRef,r.record.studentRef);assert.equal(sent.attemptToken,r.scope.attemptToken);
 assert.equal(r.record.prepared.miniCbtParallelEntry,true);assert.equal(r.record.sections.reading.startedAt,startedAt);assert.equal(r.record.sections.reading.deadlineAt,deadlineAt);
 assert.equal(r.record.snapshot.drafts.reading['1'],'Local Mini reading');assert.deepEqual(r.record.receipts,{});
 assert.equal((await r.store.get(r.key)).snapshot.drafts.writing.task2,'Retained Mini paragraph');
});
test('Mini refresh rejects another scope and keeps pending work after API failure',async()=>{
 const r=await fixture(async()=>({ok:true,json:async()=>({ok:true,...r.scope,attemptToken:randomUUID(),attemptMode:'cbt',examMode:'read_first',miniCbtParallelEntry:true})}));
 delete r.record.prepared.miniCbtParallelEntry;
 const id=randomUUID();r.record.operations=[{...r.scope,operationId:id,section:'reading',kind:'draft',payload:{answers:{'1':'Pending local answer'}}}];
 assert.equal(await r.refreshOfficialProgress(),false);assert.equal(r.record.prepared.miniCbtParallelEntry,undefined);assert.equal(r.pending,1);
 r.fetchImpl=async()=>{throw Error('Synthetic API unavailable');};
 assert.equal(await r.refreshOfficialProgress(),false);assert.equal(r.record.operations[0].operationId,id);assert.equal(r.record.review,undefined);
});
test('Mini flush reads an official skill without submitting or fabricating its losing local operation',async()=>{
 const requests=[];
 const r=await fixture(async(url,options)=>{requests.push(url);return{ok:true,status:200,json:async()=>({ok:true,persisted:false,receipt:null,officialProgress:{reading:'sealed',listening:'open',writing:'open'}})};});
 r.needsCapabilityCheck=false;
 const id=randomUUID();r.record.sections.reading={operationId:id,startedAt:new Date().toISOString()};
 r.record.operations=[{...r.scope,operationId:id,section:'reading',kind:'seal',revision:1,payload:{answers:{'1':'Read retained after conflict'}}}];
 await r.flush();assert.equal(r.pending,0);assert.equal(requests.length,1);assert.ok(requests[0].endsWith('/offline/status'));
 assert.deepEqual(r.record.receipts,{});assert.equal(r.record.supersededLocalOperations[0].operationId,id);assert.equal(r.record.review,undefined);
});

test('Mini resume progress keeps its pending first seal until status identifies the native receipt',async()=>{
 const r=await fixture();r.needsCapabilityCheck=false;
 const id=randomUUID(),startedAt=new Date().toISOString();
 const op={...r.scope,operationId:id,section:'reading',kind:'seal',revision:1,occurredAt:startedAt,dependency:null,
  payload:{answers:{'1':'First official Mini answer'},startedAt,deadlineAt:new Date(Date.now()+25*60000).toISOString(),timeValid:true}};
 r.record.sections.reading={operationId:id,sealed:true,startedAt};r.record.operations=[op];
 assert.equal(r.acceptOfficialProgress({reading:'sealed',listening:'open',writing:'open'}),false);
 assert.equal(r.pending,1);assert.equal(r.record.sections.reading.operationId,id);
 const {hash}=await import('../term-tests/mini-test-k56-computer-based/offline-mini-parallel-entry-v1.mjs');
 const receipt={operationId:id,...r.scope,receiptId:randomUUID(),payloadHash:await hash(op),acceptedRevision:1,status:'accepted'};
 r.fetchImpl=async url=>{assert.ok(url.endsWith('/offline/status'));return{ok:true,status:200,json:async()=>({ok:true,persisted:true,receipt,
  officialProgress:{reading:'sealed',listening:'open',writing:'open'}})};};
 await r.flush();assert.equal(r.pending,0);assert.deepEqual(r.record.receipts[id],receipt);
 assert.equal(r.record.sections.reading.operationId,id);assert.equal(r.record.sections.reading.confirmedElsewhere,undefined);
 r.flush=async()=>{};await r.start('listening');
 assert.equal(r.record.operations[0].dependency,id,'The next skill links the actual first seal');
});
test('Mini Listening recovers a first durable-save failure with one retained seal and its answer',async()=>{
 const r=await fixture();r.flush=async()=>{};
 r.record.prepared.examMode='lis_first';r.record.sections.listening={startedAt:new Date().toISOString(),deadlineAt:null,revision:0};
 r.record.player={position:5,ended:true};
 const put=r.store.put.bind(r.store);let failed=false;
 r.store.put=async(...args)=>{if(!failed){failed=true;throw Object.assign(Error('Synthetic full storage'),{storage:'local_and_indexeddb'});}return put(...args);};
 await r.seal('listening',{answers:{'1':'Mini seal survives storage failure'}},1,'manual');
 assert.equal(failed,true);assert.equal(r.pendingListeningSealId,null);
 const saved=await r.store.get(r.key),seals=saved.operations.filter(o=>o.kind==='seal'&&o.section==='listening');
 assert.equal(seals.length,1);assert.equal(seals[0].payload.answers['1'],'Mini seal survives storage failure');
});
test('Mini parallel immutable shell pins its entire dependency closure',{skip:baseline},async()=>{
 const route=new URL('../term-tests/mini-test-k56-computer-based/',import.meta.url);
 const {ASSETS,ASSET_HASHES}=await import(new URL('offline-assets-mini-parallel-entry-v1.mjs',route));
 assert.equal(ASSETS.includes('index.html'),false);assert.ok(ASSETS.includes('offline-mini-parallel-entry-v1.mjs'));
 const {createHash}=await import('node:crypto');
 for(const name of ASSETS){const raw=await readFile(new URL(name,route)),bytes=/\.(png|woff2)$/.test(name)?raw:raw.toString().replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),ASSET_HASHES[name],name);}
});
