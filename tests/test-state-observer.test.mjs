import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestStateObserver} from '../shared/test-state-observer.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fakeClock(){let now=0,id=0;const pending=new Map();return {setTimer(fn,delay){const t={id:++id,unref(){}};pending.set(t.id,{fn,at:now+delay});return t;},clearTimer(t){if(t)pending.delete(t.id);},async advance(ms){const end=now+ms;let steps=0;while(true){const next=[...pending].filter(([,t])=>t.at<=end).sort(([,a],[,b])=>a.at-b.at)[0];if(!next)break;if(++steps>100)throw Error('Timer loop');now=next[1].at;pending.delete(next[0]);next[1].fn();await settle();}now=end;await settle();}};}
function pipe(){let control;const body=new ReadableStream({start(c){control=c;}}),encoder=new TextEncoder();return {response:new Response(body,{headers:{'Content-Type':'text/event-stream'}}),write:text=>control.enqueue(encoder.encode(text)),end:()=>control.close()};}

test('Fetch stream keeps authorization in headers, parses split CRLF/Unicode frames and suppresses unchanged snapshots',async()=>{
 const time=fakeClock(),wire=pipe(),states=[],requests=[];let polls=0;
 const observer=createTestStateObserver({url:'https://fixture.test/events?attemptId=synthetic',headers:{Authorization:'Bearer synthetic-memory-only'},poll:async()=>{polls++;return {revision:'initial'};},onState:v=>states.push(v),fetcher:async(url,options)=>{requests.push({url,options});return wire.response;},...time});
 await settle();wire.write('event: state\r');wire.write('\ndata: {"revision":"one","label":"Tiếng Việt"}\r\n\r');wire.write('\n');await settle();assert.equal(states[0].label,'Tiếng Việt');assert.equal(observer.snapshot().live,true);
 wire.write('event: state\ndata: {"revision":"one"}\n\n: heartbeat\n\n');await time.advance(4500);assert.equal(states.length,1);assert.equal(polls,0);
 assert.equal(requests[0].options.headers.Authorization,'Bearer synthetic-memory-only');assert.equal(requests[0].url.includes('Bearer'),false);
 wire.write('event: state\ndata: {"revision":"late"}\n\n');observer.close();await settle();assert.equal(states.length,1);
});

test('A lost stream polls at the original interval and reconnects with a fresh snapshot',async()=>{
 const time=fakeClock(),first=pipe(),second=pipe(),states=[];let streams=0,polls=0;
 const observer=createTestStateObserver({url:'https://fixture.test/events',poll:async()=>({revision:'poll-'+(++polls)}),onState:v=>states.push(v),fetcher:async()=>++streams===1?first.response:second.response,...time});
 await settle();first.write('event: state\ndata: {"revision":"first"}\n\n');await settle();first.end();await settle();await time.advance(0);assert.equal(polls,1);
 await time.advance(1500);assert.equal(streams,2);assert.equal(polls,2);
 second.write('event: state\ndata: {"revision":"reconnected"}\n\n');await settle();const before=polls;await time.advance(4500);assert.equal(polls,before);assert.equal(states.at(-1).revision,'reconnected');observer.close();await settle();
});

test('Access revocation stops both stream reconnect and polling, and late data is ignored',async()=>{
 const time=fakeClock(),wire=pipe(),revoked=[],states=[];let calls=0;
 const observer=createTestStateObserver({url:'https://fixture.test/events',poll:async()=>{calls++;return {revision:'poll'};},onState:v=>states.push(v),onRevoked:v=>revoked.push(v),fetcher:async()=>wire.response,...time});
 await settle();wire.write('event: access_revoked\ndata: {"code":"STUDENT_ACCESS_DENIED","status":403}\n\n');await settle();await time.advance(30000);assert.equal(revoked.length,1);assert.equal(calls,0);assert.equal(observer.snapshot().closed,true);assert.deepEqual(states,[]);
});

test('An unavailable event preserves the previous snapshot and recovers even when its revision stays the same',async()=>{
 const time=fakeClock(),wire=pipe(),states=[],errors=[];
 const observer=createTestStateObserver({url:'https://fixture.test/events',poll:async()=>{throw Object.assign(Error('offline'),{code:'OFFLINE'});},onState:v=>states.push(v),onUnavailable:e=>errors.push(e),fetcher:async()=>wire.response,...time});
 await settle();wire.write('event: state\ndata: {"revision":"same"}\n\nevent: unavailable\ndata: {"code":"SQL_UNAVAILABLE"}\n\n');await settle();assert.equal(states.length,1);assert.equal(errors[0].code,'SQL_UNAVAILABLE');
 wire.write('event: state\ndata: {"revision":"same"}\n\n');await settle();assert.equal(states.length,2);assert.equal(observer.snapshot().live,true);observer.close();await settle();
});

test('An old endpoint hands control to the legacy fallback and never sends authorization in a URL',async()=>{
 const time=fakeClock();let unsupported=0,polls=0;
 const observer=createTestStateObserver({url:'https://fixture.test/events',poll:async()=>{polls++;return {revision:'x'};},onState(){},onUnsupported(){unsupported++;},fetcher:async()=>new Response('{}',{status:404}),...time});
 await settle();await time.advance(30000);assert.equal(unsupported,1);assert.equal(polls,0);assert.equal(observer.snapshot().closed,true);
});

test('A silent connection falls back after its deadline and respects the existing error delay and Retry-After',async()=>{
 const time=fakeClock(),first=pipe(),second=pipe(),errors=[];let streams=0,polls=0;
 const observer=createTestStateObserver({url:'https://fixture.test/events',stallMs:5000,poll:async()=>{polls++;throw Object.assign(Error('rate limited'),{status:429,code:'RATE_LIMITED',retryAfterMs:10000});},onState(){},onUnavailable:e=>errors.push(e),fetcher:async()=>++streams===1?first.response:second.response,...time});
 await settle();first.write('event: state\ndata: {"revision":"first"}\n\n');await settle();await time.advance(5000);assert.equal(polls,1);assert.ok(errors.some(e=>e.code==='STATE_STREAM_TIMEOUT'));
 // Keep the replacement connection alive while its rate-limited fallback waits.
 await time.advance(1000);second.write(': heartbeat\n\n');await settle();await time.advance(4000);assert.equal(polls,1);second.write(': heartbeat\n\n');await settle();await time.advance(4999);assert.equal(polls,1);await time.advance(1);assert.equal(polls,2);observer.close();await settle();
});
