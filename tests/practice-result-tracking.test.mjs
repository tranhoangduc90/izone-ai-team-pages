import test from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeResultTracker} from '../shared/practice-result-tracking.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve)),scope={bindingId:'binding',studentRef:'student',assignmentId:'assignment',attemptId:'attempt',code:'lesson',attemptNo:1};
let sequence=0;const identity={bindingId:scope.bindingId,studentRef:scope.studentRef,assignmentId:scope.assignmentId};
const frame=(n=1,docs='pending')=>({kind:'practice-student-state-v1',...scope,epoch:'fixture',sequence:++sequence,resultRevision:String(n).repeat(32),latestAttemptId:'attempt',latestStatus:'submitted',identity,events:[{attempt:1,sequence:2,docs}],firstCompleted:1});
const result=(revision='1'.repeat(32),latest='attempt')=>({identity,resultCode:'lesson',lesson:{code:'lesson'},attempt:{id:'attempt',status:'submitted'},attempts:[{id:latest,status:'submitted'}],resultRevision:revision});
function setup(options={}){let callbacks,reads=0,synchronized=0,latest=frame();const results=[],progress=[],errors=[],unavailable=[],timers=[];const tracker=createPracticeResultTracker({scope,url:'https://fixture.test/events',headers:{Authorization:'Bearer synthetic'},poll:async()=>({...latest,sequence:++sequence}),loadResult:async()=>{reads++;return result(latest.resultRevision,latest.latestAttemptId);},onResult:value=>results.push(value),onProgress:value=>progress.push(value),onError:error=>errors.push(error),onUnavailable:value=>unavailable.push(value),onSynchronized:()=>synchronized++,observerFactory:value=>{callbacks={...value,onState(frame){latest=frame;value.onState(frame);}};return{close(){}};},setTimer(fn,delay){const timer={fn,delay,active:true,unref(){}};timers.push(timer);return timer;},clearTimer(timer){if(timer)timer.active=false;},...options});return{tracker,results,progress,errors,unavailable,timers,get reads(){return reads;},get callbacks(){return callbacks;},get synchronized(){return synchronized;}};}
test('Docs-only frames update progress without repeating result reads; a content or latest-attempt change reads once',async()=>{
 const f=setup();assert.equal(f.callbacks.pollInterval,30000);assert.equal(f.callbacks.headers.Authorization,'Bearer synthetic');f.callbacks.onState(frame());await settle();assert.equal(f.reads,1);
 f.callbacks.onState(frame(1,'verified'));await settle();assert.equal(f.reads,1);assert.equal(f.progress.at(-1).events[0].docs,'verified');f.callbacks.onState(frame(2,'verified'));await settle();assert.equal(f.reads,2);
 f.callbacks.onState({...frame(2),latestAttemptId:'new-attempt'});await settle();assert.equal(f.reads,3);f.tracker.close();
});
test('Foreign frames or full responses never replace the owned result',async()=>{
 const a=setup();a.callbacks.onState({...frame(),studentRef:'foreign'});await settle();assert.equal(a.reads,0);assert.equal(a.tracker.snapshot().closed,true);
 const b=setup({loadResult:async()=>({...result(),attempt:{id:'foreign',status:'submitted'}})});b.callbacks.onState(frame());await settle();assert.equal(b.results.length,0);assert.equal(b.errors[0].status,403);assert.equal(b.tracker.snapshot().closed,true);
});
test('Closing a view aborts and discards a late result; a newer pending revision supersedes an old read',async()=>{
 let release,signal;const first=new Promise(resolve=>release=resolve),a=setup({loadResult:input=>{signal=input.signal;return first;}});a.callbacks.onState(frame());await settle();a.tracker.close();assert.equal(signal.aborted,true);release(result());await settle();assert.equal(a.results.length,0);
 let done,n=0;const slow=new Promise(resolve=>done=resolve),b=setup({loadResult:async({expectedRevision})=>{if(++n===1)await slow;return result(expectedRevision);}});b.callbacks.onState(frame());await settle();b.callbacks.onState(frame(2));done();await settle();assert.equal(b.results.length,0);const retry=b.timers.find(value=>value.active);retry.active=false;retry.fn();await settle();assert.equal(n,2);assert.equal(b.results.length,1);assert.equal(b.progress.at(-1).resultRevision,'2'.repeat(32));b.tracker.close();
});
test('Failed result reads retry unchanged revisions; old content success cannot clear a newer metadata error',async()=>{
 let n=0;const a=setup({loadResult:async()=>{if(++n===1)throw Object.assign(Error('TEMPORARY'),{status:503});return result();}});a.callbacks.onState(frame());await settle();assert.equal(a.results.length,0);const timer=a.timers.find(value=>value.active);assert.equal(timer.delay,30000);timer.active=false;timer.fn();await settle();assert.equal(a.results.length,1);a.tracker.close();
 let release;const slow=new Promise(resolve=>release=resolve),b=setup({poll:()=>slow});b.callbacks.onState(frame());await settle();b.callbacks.onUnavailable({status:503});release(frame());await settle();assert.equal(b.synchronized,0);b.callbacks.onState(frame());await settle();assert.equal(b.synchronized,1);assert.equal(b.results.length,1);b.tracker.close();
});
test('Revocation ends observation and transient errors keep the previous successful result',async()=>{
 const f=setup();f.callbacks.onState(frame());await settle();f.callbacks.onUnavailable({status:503,code:'STATE_UNAVAILABLE'});assert.equal(f.results.length,1);f.callbacks.onRevoked({status:401,code:'UNAUTHORIZED'});assert.equal(f.tracker.snapshot().closed,true);assert.equal(f.errors.at(-1).status,401);
});
test('A fresh metadata barrier prevents a delayed older Docs frame from undoing verified progress',async()=>{
 const fresh=frame(1,'verified'),f=setup({poll:async()=>fresh});f.callbacks.onState({...frame(),sequence:fresh.sequence-1});await settle();assert.equal(f.progress.at(-1).events[0].docs,'verified');
 f.callbacks.onState({...frame(),sequence:fresh.sequence-1});await settle();assert.equal(f.progress.length,1);assert.equal(f.progress.at(-1).events[0].docs,'verified');f.tracker.close();
});
test('A delayed frame from a retired hub must reconcile with the current epoch before it can change Docs',async()=>{
 let latest={...frame(1,'verified'),epoch:'current'},polls=0;const f=setup({poll:async()=>{polls++;return{...latest,sequence:++sequence};}});
 f.callbacks.onState(latest);await settle();const reads=f.reads;
 f.callbacks.onState({...frame(1,'pending'),epoch:'retired'});await settle();assert.equal(f.progress.at(-1).events[0].docs,'verified');assert.equal(f.progress.at(-1).epoch,'current');assert.equal(f.reads,reads);assert.equal(polls,2);f.tracker.close();
});
test('A mismatched content tag cannot pass the metadata barrier, even if the requested revision later returns',async()=>{
 let n=0;const f=setup({loadResult:async()=>{n++;return result(n===1?'2'.repeat(32):'1'.repeat(32));}});f.callbacks.onState(frame());await settle();assert.equal(f.results.length,0);assert.equal(f.errors[0].code,'RESULT_REVISION_CHANGED');
 const timer=f.timers.find(value=>value.active);timer.active=false;timer.fn();await settle();assert.equal(f.results.length,1);assert.equal(f.results[0].resultRevision,'1'.repeat(32));f.tracker.close();
});
test('The just-loaded owned result is reused only when its revision and latest attempt match a fresh barrier',async()=>{
 const f=setup({initialResult:result()});f.callbacks.onState(frame());await settle();assert.equal(f.reads,0);assert.equal(f.results.length,1);assert.equal(f.progress.length,1);f.tracker.close();
 const stale=setup({initialResult:result('2'.repeat(32))});stale.callbacks.onState(frame());await settle();assert.equal(stale.reads,1);assert.equal(stale.results.length,1);stale.tracker.close();
 const foreign=setup({initialResult:{...result(),identity:{...identity,studentRef:'foreign'}}});foreign.callbacks.onState(frame());await settle();assert.equal(foreign.reads,0);assert.equal(foreign.results.length,0);assert.equal(foreign.errors[0].status,403);foreign.tracker.close();
});
