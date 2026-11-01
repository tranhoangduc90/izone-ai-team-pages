import test from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeTeacherTracker} from '../shared/practice-teacher-tracking.mjs';
const settle=()=>new Promise(r=>setImmediate(r)),rev=n=>String(n).repeat(64),scope={classId:'1124',code:'synthetic-practice',unitId:'unit-A'};
const frame=(n=1)=>({kind:'practice-teacher-state-v1',...scope,classRevision:rev(n),unitRevision:rev(n)});
function setup(options={}){
 let callbacks,transportClosed=false;const students=[],details=[],errors=[],unavailable=[],timers=[];let unsupported=0,listReads=0,detailReads=0;
 const list={code:scope.code,class:{classId:scope.classId},students:[]},detail={id:scope.unitId,classId:scope.classId,code:scope.code};
 const tracker=createPracticeTeacherTracker({scope,url:'https://fixture.test/events',poll:async()=>frame(),loadStudents:async()=>{listReads++;return list;},loadDetail:async()=>{detailReads++;return detail;},onStudents:value=>students.push(value),onDetail:value=>details.push(value),onError:value=>errors.push(value),onUnavailable:value=>unavailable.push(value),onUnsupported:()=>unsupported++,observerFactory:value=>{callbacks=value;return{close(){transportClosed=true;}};},setTimer(fn,delay){const timer={fn,delay,active:true,unref(){}};timers.push(timer);return timer;},clearTimer(timer){if(timer)timer.active=false;},...options});
 return{tracker,students,details,errors,unavailable,timers,get callbacks(){return callbacks;},get unsupported(){return unsupported;},get transportClosed(){return transportClosed;},get reads(){return[listReads,detailReads];}};
}
test('Teacher metadata loads only changed list/detail and keeps the native thirty-second fallback',async()=>{
 const f=setup();assert.equal(f.callbacks.pollInterval,30000);assert.equal(f.callbacks.pollErrorInterval,30000);
 f.callbacks.onState(frame());await settle();assert.deepEqual(f.reads,[1,1]);f.callbacks.onState(frame());await settle();assert.deepEqual(f.reads,[1,1]);
 f.callbacks.onState({...frame(),classRevision:rev(2)});await settle();assert.deepEqual(f.reads,[2,1]);
 f.callbacks.onState({...frame(),classRevision:rev(2),unitRevision:rev(3)});await settle();assert.deepEqual(f.reads,[2,2]);f.tracker.close();
});
test('A foreign or malformed frame cannot trigger reads; a changed unit response is never applied',async()=>{
 const wrong=setup();wrong.callbacks.onState({...frame(),unitId:'unit-B'});await settle();assert.deepEqual(wrong.reads,[0,0]);assert.equal(wrong.unsupported,1);assert.equal(wrong.transportClosed,true);
 const foreign=setup({loadDetail:async()=>({id:'unit-B',classId:'1131',code:scope.code})});foreign.callbacks.onState(frame());await settle();assert.equal(foreign.details.length,0);assert.equal(foreign.unsupported,1);
});
test('Closing a scope discards late full content and aborts its in-flight request',async()=>{
 let release,signal;const delayed=new Promise(r=>release=r),f=setup({loadDetail:input=>{signal=input.signal;return delayed;}});
 f.callbacks.onState(frame());await settle();f.tracker.close();assert.equal(signal.aborted,true);release({id:scope.unitId,classId:scope.classId,code:scope.code});await settle();assert.equal(f.details.length,0);
 f.callbacks.onState(frame(2));await settle();assert.deepEqual(f.reads,[1,0]);
});
test('A failed full read retries the same compact state even when the server revision stays unchanged',async()=>{
 let attempts=0,synchronized=0;const f=setup({onSynchronized:()=>synchronized++,loadDetail:async()=>{if(++attempts===1)throw Object.assign(Error('TEMPORARY'),{status:503});return{id:scope.unitId,classId:scope.classId,code:scope.code};}});
 f.callbacks.onState(frame());await settle();assert.equal(f.details.length,0);assert.equal(f.errors.length,1);const retry=f.timers.find(timer=>timer.active);assert.equal(retry.delay,30000);
 assert.equal(synchronized,0);retry.active=false;retry.fn();await settle();assert.equal(attempts,2);assert.equal(f.details.length,1);assert.equal(f.students.length,1);assert.equal(synchronized,1);f.tracker.close();
});
test('An unchanged valid revision confirms recovery without downloading full content again',async()=>{
 let synchronized=0;const f=setup({onSynchronized:()=>synchronized++});
 f.callbacks.onState(frame());await settle();assert.equal(synchronized,1);
 f.callbacks.onUnavailable({status:503,code:'STATE_DATA_INVALID'});assert.equal(synchronized,1);
 f.callbacks.onState(frame());await settle();assert.equal(synchronized,2);assert.deepEqual(f.reads,[1,1]);f.tracker.close();
});
test('A slow content read cannot clear a newer metadata failure',async()=>{
 let release,synchronized=0;const pending=new Promise(resolve=>release=resolve),f=setup({onSynchronized:()=>synchronized++,loadDetail:()=>pending});
 f.callbacks.onState(frame());await settle();f.callbacks.onUnavailable({status:503,code:'STATE_DATA_INVALID'});
 release({id:scope.unitId,classId:scope.classId,code:scope.code});await settle();assert.equal(synchronized,0);
 f.callbacks.onState(frame());await settle();assert.equal(synchronized,1);assert.equal(f.students.length,1);assert.equal(f.details.length,1);f.tracker.close();
});
test('Revoked transport or content authorization closes the observer and never retries private data',async()=>{
 const a=setup();a.callbacks.onRevoked({status:401,code:'TEACHER_LOGIN_REQUIRED'});assert.equal(a.tracker.snapshot().closed,true);assert.equal(a.errors[0].status,401);
 const b=setup({loadDetail:async()=>{throw Object.assign(Error('ACCESS_DENIED'),{status:403});}});b.callbacks.onState(frame());await settle();assert.equal(b.transportClosed,true);assert.equal(b.errors[0].status,403);assert.equal(b.timers.filter(timer=>timer.active).length,0);
});
test('A new revision arriving during a slow read is processed afterward using its own scope',async()=>{
 let release,n=0;const first=new Promise(r=>release=r),f=setup({loadStudents:async()=>{if(++n===1)await first;return{code:scope.code,class:{classId:scope.classId},students:[]};}});
 f.callbacks.onState(frame());await settle();f.callbacks.onState(frame(2));release();await settle();await settle();assert.equal(n,2);assert.equal(f.students.length,2);assert.equal(f.details.length,2);f.tracker.close();
});
