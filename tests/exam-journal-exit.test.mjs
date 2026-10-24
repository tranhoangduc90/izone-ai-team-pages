import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecorder} from '../term-tests/shared/exam-journal/recorder.mjs';

const context=()=>({bindingId:'a'.repeat(64),auth:{ticket:'synthetic',ticketId:crypto.randomUUID()},versions:{}});
const ack=body=>({ok:true,persisted:true,scopeId:body.bindingId,acknowledgedIds:body.events.map(e=>e.id)});
const bytes=body=>new TextEncoder().encode(JSON.stringify(body)).length;
function blockedRecorder(){
 const calls=[],binding=context();let releaseStorage;
 const waiting=new Promise(r=>releaseStorage=r);
 const recorder=createRecorder({outbox:{putMany:()=>waiting},context:()=>binding,build:'synthetic',transport:(body,options)=>{
  let resolve;const promise=new Promise(r=>resolve=r);calls.push({body,options,resolve:()=>resolve(ack(body))});return promise;
 }});
 return {recorder,calls,releaseStorage};
}

test('a later pagehide sends before an earlier visibility ACK or blocked local write',async()=>{
 const {recorder,calls,releaseStorage}=blockedRecorder();
 recorder.record('page_visibility',{visibility:'hidden'});
 const first=recorder.flush({force:true,keepalive:true});
 recorder.record('page_hidden',{persisted:false});
 const second=recorder.flush({force:true,keepalive:true});
 assert.equal(calls.length,2,'the second send starts synchronously, before any ACK');
 assert.deepEqual(calls.map(c=>c.body.events.map(e=>e.type)),[['page_visibility'],['page_hidden']]);
 assert.equal(new Set(calls.flatMap(c=>c.body.events.map(e=>e.id))).size,2);
 for(const call of calls)call.resolve();await Promise.all([first,second]);releaseStorage();await recorder.idle();recorder.stop();
});

test('exit requests share a bounded budget and prioritize lifecycle over old backlog',async()=>{
 const {recorder,calls,releaseStorage}=blockedRecorder();
 for(let n=0;n<80;n++)recorder.record('state_observed',{label:'x'.repeat(2600)});
 const first=recorder.flush({force:true,keepalive:true});
 recorder.record('page_hidden',{persisted:false});
 const second=recorder.flush({force:true,keepalive:true});
 assert.ok(calls[1]?.body.events.some(e=>e.type==='page_hidden'));
 assert.ok(calls.reduce((n,c)=>n+bytes(c.body),0)<=60*1024);
 const ids=calls.flatMap(c=>c.body.events.map(e=>e.id));assert.equal(new Set(ids).size,ids.length);
 assert.ok(calls.every(c=>c.options.keepalive===true));
 for(const call of calls)call.resolve();await Promise.all([first,second]);releaseStorage();await recorder.idle();recorder.stop();
});

test('durable keepalive and new in-memory tail share the same request budget',async()=>{
 const calls=[],binding=context(),durable=Array.from({length:20},(_,i)=>({id:crypto.randomUUID(),type:'state_observed',data:{label:'x'.repeat(2200)},sequence:i+1}));
 let block=false,releaseStorage;
 const waiting=new Promise(r=>releaseStorage=r);
 const recorder=createRecorder({context:()=>binding,build:'synthetic',outbox:{
  putMany:()=>block?waiting:Promise.resolve(),nextBatch:async()=>({...binding,events:durable}),acknowledge:async()=>{},size:async()=>0
 },transport:(body,options)=>{let release;const p=new Promise(r=>release=r);calls.push({body,options,resolve:()=>release(ack(body))});return p;}});
 const first=recorder.flush({force:true,keepalive:true});await new Promise(setImmediate);
 block=true;recorder.record('page_hidden',{persisted:false});const second=recorder.flush({force:true,keepalive:true});
 assert.equal(calls.length,2);assert.ok(calls[1].body.events.some(e=>e.type==='page_hidden'));
 assert.ok(calls.reduce((n,c)=>n+bytes(c.body),0)<=60*1024);
 for(const call of calls)call.resolve();await Promise.all([first,second]);releaseStorage();await recorder.idle();recorder.stop();
});
