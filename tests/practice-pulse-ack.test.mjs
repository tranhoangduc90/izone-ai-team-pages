import test from 'node:test';
import assert from 'node:assert/strict';
import {expandPracticePulseAck} from '../shared/practice-pulse-ack.mjs';

function fixture(listening=false){
 const old={id:'history',status:'submitted',notes:'Immutable prior work'},current={id:'active',no:2,status:'running',sequence:9,usedMs:100,remainingMs:900,notes:'Newer typing',...(listening?{phase:'listening',audioPosition:0.1}:{})};
 const context={identity:{bindingId:'owner-A'},lesson:{code:'lesson-A'},record:{attempts:[old,current],events:[{sequence:1,docs:'verified'}],firstCompleted:1},lease:{id:'lease-A'},snapshot:{sequence:8,notes:'Snapshot in flight',answers:{1:'A'},activeMs:300,...(listening?{phase:'listening',audioPosition:0.3}:{})},capabilities:{compactPulseAck:true}};
 const response={ack:'practice-pulse-v1',bindingId:'owner-A',identity:{bindingId:'owner-A',name:'Fresh display name',documentUrl:'https://example.test/new-target'},events:[{sequence:1,docs:'blocked'}],firstCompleted:1,attempt:{id:'active',no:2,leaseId:'lease-A',status:'running',sequence:8,usedMs:300,remainingMs:700,...(listening?{phase:'listening',audioPosition:0.3,reviewRemainingMs:120000}:{})}};
 return{context,response};
}
for(const listening of [false,true])test(`Checkpoint receipt preserves history and the request snapshot (${listening?'Listening':'Reading'})`,()=>{
 const {context,response}=fixture(listening),before=structuredClone(context),expanded=expandPracticePulseAck(response,context);
 assert.deepEqual(context,before);assert.strictEqual(expanded.attempts[0],context.record.attempts[0]);assert.strictEqual(expanded.events,response.events);assert.strictEqual(expanded.identity,response.identity);assert.equal(expanded.events[0].docs,'blocked');
 assert.equal(expanded.attempts.at(-1).notes,'Snapshot in flight');assert.deepEqual(expanded.attempts.at(-1).answers,{1:'A'});assert.equal(expanded.attempts.at(-1).usedMs,300);assert.equal(expanded.attempts.at(-1).remainingMs,700);assert.equal(expanded.attempts.at(-1).sequence,8);assert.equal(expanded.lease,undefined);
 if(listening){assert.equal(expanded.attempts.at(-1).audioPosition,0.3);assert.equal(expanded.attempts.at(-1).reviewRemainingMs,120000);}
});
test('A full response from the legacy server passes through unchanged',()=>{
 const full={attempts:[{id:'old-server',notes:'All saved text'}]};assert.strictEqual(expandPracticePulseAck(full,{}),full);
});
test('Wrong owner, attempt, lease, revision and malformed timing cannot acknowledge a save',()=>{
 for(const mutate of [r=>r.bindingId='owner-B',r=>r.identity.bindingId='owner-B',r=>r.events=null,r=>r.attempt.id='previous-attempt',r=>r.attempt.no=1,r=>r.attempt.leaseId='lease-B',r=>r.attempt.sequence=7,r=>r.attempt.status='submitted',r=>r.attempt.usedMs=NaN,r=>r.attempt.remainingMs=-1,r=>r.ack='unknown']){
  const {context,response}=fixture();mutate(response);assert.throws(()=>expandPracticePulseAck(response,context),e=>e.code==='PULSE_ACK_INVALID');
 }
 const {context,response}=fixture(true);delete response.attempt.audioPosition;assert.throws(()=>expandPracticePulseAck(response,context),e=>e.code==='PULSE_ACK_INVALID');
});
