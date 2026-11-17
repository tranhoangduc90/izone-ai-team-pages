import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const baseline=process.env.K56_TERM2_EXPORT_BASELINE==='1';
const {Term2Offline,ExamStore,exportHtml}=await import('../term-tests/term-test-2-k56-computer-based/'+(baseline?'offline-term2-parallel-entry-v1.mjs':'offline-term2-export-v2.mjs'));
const memory=()=>{const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};

test('Term2 export preserves retained local answers and Task1 without exporting native scope',async()=>{
 const store=await new ExamStore({local:memory(),idb:null}).open();
 const r=new Term2Offline({apiBase:'https://synthetic.invalid',classCode:'FIXTURE',store});
 const permit='synthetic-permit-that-stays-in-the-run',operationId=randomUUID();
 r.record={ready:true,classCode:'FIXTURE',prepared:{attemptToken:randomUUID(),examSessionToken:randomUUID(),generation:4,
  term2ParallelEntry:true,examMode:'read_first',offline:{ownerId:randomUUID(),permit}},sections:{reading:{operationId}},
  operations:[],receipts:{},player:{position:0,ended:false},snapshot:{drafts:{reading:{'1':'Local reading answer'},
   writing:{task1:'Local Task 1 before <review> & submission.'}}}};
 r.record.operations=[{...r.scope,operationId,section:'reading',kind:'seal',revision:2,occurredAt:new Date().toISOString(),dependency:null,
  payload:{answers:{'1':'Retained local answer'},startedAt:new Date().toISOString(),deadlineAt:new Date(Date.now()+60000).toISOString()}}];
 assert.equal(r.acceptOfficialProgress({reading:'sealed',listening:'open',writing:'open'}),true);
 assert.equal(r.record.operations.length,0);assert.equal(Object.keys(r.record.receipts).length,0);
 const retained=structuredClone(r.record),html=exportHtml(r.record);
 assert.match(html,/Retained local answer/);assert.match(html,/Local Task 1/);
 for(const value of [r.scope.attemptToken,r.scope.examSessionToken,r.scope.ownerId,permit])
  assert.equal(html.includes(value),false,'Export must omit native authentication scope');
 assert.deepEqual(r.record,retained,'Export must not change the stored source run or retained operations');
 assert.equal(r.record.supersededLocalOperations[0].attemptToken,r.scope.attemptToken);
 assert.equal(r.record.snapshot.drafts.writing.task1,'Local Task 1 before <review> & submission.');
});

test('Term2 v4 shell pins every immutable dependency and leaves v3 frozen',{skip:baseline},async()=>{
 const route=new URL('../term-tests/term-test-2-k56-computer-based/',import.meta.url);
 const {ASSETS,ASSET_HASHES,ASSET_BUILD_ID}=await import(new URL('offline-assets-listening-report-v4.mjs',route));
 assert.equal(ASSETS.includes('index.html'),false);assert.ok(ASSETS.includes('offline-term2-export-v2.mjs'));
 assert.ok(ASSETS.includes('../k56-offline-shared/runtime-parallel-entry-v2.mjs'));
 for(const name of ASSETS){const raw=await readFile(new URL(name,route)),bytes=/\.(png|woff2)$/.test(name)?raw:raw.toString().replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),ASSET_HASHES[name],name);}
 assert.equal(createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(ASSET_HASHES).sort().map(k=>[k,ASSET_HASHES[k]])))).digest('hex'),ASSET_BUILD_ID);
});
