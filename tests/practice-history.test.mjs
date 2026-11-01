import test from 'node:test';
import assert from 'node:assert/strict';
import {expandPracticeHistory,practiceHistoryPath} from '../shared/practice-history.mjs';
const identity={bindingId:'binding-A',studentRef:'student-A',assignmentId:'assignment-A'},rev=n=>String(n).repeat(64);
const full=(id='old',revision=rev(1))=>({id,no:id==='old'?1:2,status:'submitted',answers:{14:'A'},notes:'Private loaded history',result:{score:1},detailsLoaded:true,detailRevision:revision});
const summary=(revision=rev(1))=>({id:'old',no:1,status:'submitted',answeredCount:1,detailsLoaded:false,detailRevision:revision});
const state=(old=summary())=>({historyMode:'on-demand-v1',identity,attempts:[old,full('latest',rev(2))],events:[{docs:'verified'}],firstCompleted:1});
test('History requests preserve compact ACK options and never change audio, teacher or library paths',()=>{
 assert.equal(practiceHistoryPath('/pulse?ack=compact-v1'),'/pulse?ack=compact-v1&history=on-demand-v1');
 assert.equal(practiceHistoryPath('/result/owned-attempt'),'/result/owned-attempt?history=on-demand-v1');
 for(const path of ['/audio/owned','/review-audio/owned','/teacher/result/owned','/library/lesson'])assert.equal(practiceHistoryPath(path),path);
});
test('A loaded historical attempt survives summary refresh only for the same owner and exact content revision',()=>{
 const previous={identity,attempts:[full()]},value=state(),copy=structuredClone(value),expanded=expandPracticeHistory(value,previous);
 assert.equal(expanded.attempts[0].notes,previous.attempts[0].notes);assert.equal(expanded.attempts[0].detailsLoaded,true);assert.deepEqual(expanded.events,value.events);assert.equal(expanded.firstCompleted,1);assert.deepEqual(value,copy);
 const changed=expandPracticeHistory(state(summary(rev(3))),previous);assert.equal(changed.attempts[0].notes,undefined);assert.equal(changed.attempts[0].detailsLoaded,false);
 const foreign=expandPracticeHistory(value,{identity:{...identity,studentRef:'other-student'},attempts:[full()]});assert.equal(foreign.attempts[0].notes,undefined);
});
test('The selected complete result and latest active draft stay complete; unrequested history stays deferred',()=>{
 const value=state(full());value.attempt=value.attempts[0];const expanded=expandPracticeHistory(value);assert.deepEqual(expanded.attempt,full());assert.ok(expanded.attempts.at(-1).answers);
 const deferred=expandPracticeHistory(state());assert.equal(deferred.attempts[0].answers,undefined);assert.equal(deferred.attempts[0].answeredCount,1);
});
test('Malformed projections cannot replace the current draft or mix history records',()=>{
 const invalid=()=>state();const duplicate=invalid();duplicate.attempts[1].id='old';assert.throws(()=>expandPracticeHistory(duplicate),{code:'HISTORY_RESPONSE_INVALID'});
 const missing=invalid();missing.attempts.at(-1).detailsLoaded=false;assert.throws(()=>expandPracticeHistory(missing),{code:'HISTORY_RESPONSE_INVALID'});
 const bad=invalid();bad.attempts[0].detailRevision='bad';assert.throws(()=>expandPracticeHistory(bad),{code:'HISTORY_RESPONSE_INVALID'});
 const payload=invalid();payload.attempts[0].answers={14:'A'};assert.throws(()=>expandPracticeHistory(payload),{code:'HISTORY_RESPONSE_INVALID'});
 const selected=invalid();selected.attempt=selected.attempts[0];assert.throws(()=>expandPracticeHistory(selected),{code:'HISTORY_RESPONSE_INVALID'});
});
test('Legacy full responses pass through unchanged for compatibility',()=>{
 const legacy={identity,attempts:[{id:'old',answers:{14:'A'}}]};assert.equal(expandPracticeHistory(legacy),legacy);
});
