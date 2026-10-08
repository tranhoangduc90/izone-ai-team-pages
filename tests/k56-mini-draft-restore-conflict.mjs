import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(process.env.K56_DRAFT_SOURCE||'term-tests/k56-mini-shared/app.js','utf8');
const local=()=>({studentRef:'fake-a',attemptToken:'attempt-a',generation:2,
 drafts:{listening:{1:'LOCAL-L'},reading:{1:'LOCAL-R'}},
 draftRevisions:{listening:3,reading:3},draftAckRevisions:{listening:1,reading:1}});
const remote=()=>({attemptToken:'attempt-a',generation:2,listeningDraft:{1:'REMOTE-L'},readingDraft:{1:'REMOTE-R'},
 listeningDraftRevision:3,readingDraftRevision:3});

test('D04 Mini giấy: cache dirty cùng revision giữ nháp và ACK cũ, không nhận cache khác chủ/lượt/thế hệ',()=>{
 const start=source.indexOf('        const cached=readSession();');
 const end=source.indexOf('        } else {',start);assert.ok(start>=0&&end>start);
 const code=source.slice(start,end)+'}';
 for(const delta of [{},{studentRef:'fake-b'},{attemptToken:'attempt-b'},{generation:3}]){
  const cached={...local(),...delta},state=local(),response=remote();state.drafts={listening:{},reading:{}};
  state.draftRevisions={listening:0,reading:0};state.draftAckRevisions={listening:0,reading:0};
  vm.runInNewContext(code,{state,response,studentRef:'fake-a',readSession:()=>cached});
  const same=Object.keys(delta).length===0;
  assert.equal(state.drafts.reading[1],same?'LOCAL-R':undefined);
  assert.equal(state.draftAckRevisions.reading,same?1:0);
 }
});

test('D04 Mini: prepare giữ dirty local; lượt khác hoặc đã nộp lấy canonical',()=>{
 const start=source.indexOf('    const sameAttempt =',source.indexOf('  async function showPreparedAttempt('));
 const end=source.indexOf('    saveSession();',start);assert.ok(start>=0&&end>start);
 for(const delta of [{},{readingSubmitted:true,listeningSubmitted:true},{completed:true},{attemptToken:'attempt-b'}]){
  const state=local(),response={...remote(),...delta};
  vm.runInNewContext(source.slice(start,end),{state,response,window:{K56_EXAM_ORDER:{apply:()=>false}},
   applySectionDraft(skill,draft,revision){state.drafts[skill]={...draft};state.draftRevisions[skill]=revision;state.draftAckRevisions[skill]=revision;}});
  const dirty=Object.keys(delta).length===0;
  assert.equal(state.drafts.reading[1],dirty?'LOCAL-R':'REMOTE-R');
  assert.equal(state.draftAckRevisions.reading,dirty?1:3);
 }
});
