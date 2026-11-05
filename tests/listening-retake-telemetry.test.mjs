import test from 'node:test';
import assert from 'node:assert/strict';
import {Telemetry} from '../term-tests/ic2311-listening-retake-substitute1-k56/telemetry.mjs';
import {sanitize} from '../term-tests/ic2311-listening-retake-substitute1-k56/log-contract.mjs';
const listeners=new Map();globalThis.addEventListener=(name,fn)=>{const a=listeners.get(name)||[];a.push(fn);listeners.set(name,a);};
const memory=new Map();globalThis.localStorage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)||null};
function make(){const j=new Telemetry({tabId:crypto.randomUUID(),audioOwnerId:crypto.randomUUID()});j.snapshot=()=>({playerCurrentTime:30,paused:false,sourceKind:'local_blob',readyState:4,controllerStateBefore:'playing'});return j;}
function hanging(_url,{signal}){return new Promise((_resolve,reject)=>{if(signal.aborted)reject(new DOMException('fixture','AbortError'));else signal.addEventListener('abort',()=>reject(new DOMException('fixture','AbortError')),{once:true});});}
test('transport distinguishes timeout, user abort and navigation abort without duplicate outcomes',async()=>{
 globalThis.fetch=hanging;
 for(const[kind,expected]of [['timeout','CLIENT_TIMEOUT'],['user','USER_CANCELLED'],['navigation','NAVIGATION_ABORTED']]){
  const j=make(),controller=new AbortController();const work=j.request('/snapshot',{operationId:crypto.randomUUID()},{timeoutMs:kind==='timeout'?20:1000,signal:controller.signal}).catch(e=>e.code);
  if(kind==='user')controller.abort();if(kind==='navigation')for(const fn of listeners.get('pagehide')||[])fn();
  assert.equal(await work,expected);const completed=j.rows.filter(r=>r.eventName==='client_request_completed');assert.equal(completed.length,1);assert.equal(completed[0].errorCode,expected);assert.equal(completed[0].phase,'playing');assert.equal(completed[0].audioAfter.paused,false);
 }
});
test('HTTP 503 with a non-JSON body remains HTTP_ERROR with its status; body is not logged',async()=>{
 globalThis.fetch=async()=>new Response('<html>fixture-private-message</html>',{status:503});const j=make();await assert.rejects(j.request('/snapshot',{}),e=>e.code==='HTTP_ERROR');const r=j.rows.find(r=>r.eventName==='client_request_completed');assert.equal(r.httpStatus,503);assert.equal(r.errorOrigin,'proxy_or_api');assert.equal(JSON.stringify(j.rows).includes('fixture-private-message'),false);
});
test('retry keeps operation ID, changes request ID and preserves readable build/error fields',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,revision:7}),{status:200});const j=make(),operationId=crypto.randomUUID();const a=await j.request('/snapshot',{operationId}),b=await j.request('/snapshot',{operationId});assert.notEqual(a.requestId,b.requestId);const rows=j.rows.filter(r=>r.eventName==='client_request_sent');assert.ok(rows.every(r=>r.operationId===operationId));assert.ok(rows.every(r=>r.buildVersion==='listening-retake-20261105-v1'));
 const clean=sanitize({errorCode:'AUDIO_GENERATION_STALE',buildVersion:'release-v1',exceptionName:'TypeError',body:{answers:{1:'private'}},token:'private',message:'private'});assert.equal(clean.errorCode,'AUDIO_GENERATION_STALE');assert.equal(clean.buildVersion,'release-v1');assert.equal(clean.body,undefined);assert.equal(clean.message,undefined);assert.equal(clean.token,undefined);
});
