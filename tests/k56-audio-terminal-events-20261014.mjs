import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../term-tests/k56-audio-recovery.js',import.meta.url),'utf8');
console.log(JSON.stringify({controllerSha256:crypto.createHash('sha256').update(source).digest('hex'),scope:'Actual controller source callbacks in VM with deferred synthetic API. Does not prove browser or database.'}));
function harness() {
  const identity=['https://synthetic.invalid','SYNTHETIC','term-test-1-k56','synthetic-student','00000000-0000-4000-8000-000000000101',0];
  const memory=new Map([['izone-k56-audio:v2:'+encodeURIComponent(JSON.stringify(identity)),JSON.stringify({identity,pending:true,recoveryId:'00000000-0000-4000-8000-000000000201',heardSeconds:10})]]);
  const events={},audioEvents={},manual={},resume={},sent=[];
  let resolveResponse,rejectResponse,playCount=0,revision=0,reloadCount=0;
  const deferred=new Promise((resolve,reject)=>{resolveResponse=resolve;rejectResponse=reject;});
  const payload=()=>({ok:true,audioRecoveryVersion:2,audioStateRevision:++revision,generation:0,listeningResumeAtSeconds:10,
    listeningDeadlineAt:new Date(Date.now()-10000).toISOString(),listeningHardDeadlineAt:new Date(Date.now()+900000).toISOString(),serverNow:new Date().toISOString()});
  const audio={currentTime:10,duration:1800,paused:true,ended:false,readyState:4,error:null,
    addEventListener:(name,fn)=>audioEvents[name]=fn,pause(){this.paused=true;audioEvents.pause?.();},async play(){playCount++;this.paused=false;}};
  const ctx=vm.createContext({crypto,URL,AbortSignal,performance:{now:()=>0,getEntriesByType:()=>[]},navigator:{onLine:true},
    localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    window:{addEventListener:(name,fn)=>events[name]=fn,dispatchEvent(){},setInterval:()=>1,clearInterval(){},setTimeout(){},location:{reload(){reloadCount++;}}},
    fetch:async(url,options)=>{
      if(url.endsWith('/client-event'))return {ok:true,json:async()=>({ok:true})};
      const body=JSON.parse(options.body);sent.push(body);
      if(sent.length===1)await deferred;
      return {ok:true,status:200,json:async()=>payload()};
    }});
  vm.runInContext(source,ctx);
  const controller=ctx.window.K56AudioRecovery.create({audio,token:identity[4],slug:identity[2],studentRef:identity[3],classCode:identity[1],apiBase:identity[0],generation:0,
    initial:{...payload(),audioStateRevision:0},resumeButton:{hidden:true,addEventListener:(n,fn)=>resume[n]=fn},manualButton:{disabled:false,addEventListener:(n,fn)=>manual[n]=fn},render(){}});
  return {controller,events,audio,audioEvents,manual,resume,sent,memory,identity,ctx,resolveResponse,rejectResponse,playCount:()=>playCount,reloadCount:()=>reloadCount};
}
async function flush(){for(let n=0;n<12;n++)await Promise.resolve();}

test('ended audio must not rewind when an in-flight recovery reply arrives',async()=>{
 const h=harness();await flush();h.audio.currentTime=h.audio.duration;h.audio.ended=true;h.audioEvents.ended();h.resolveResponse();await flush();
 assert.equal(h.audio.currentTime,h.audio.duration);assert.equal(h.controller.inspect().phase,'ended');assert.equal(h.playCount(),0);
});
test('ended audio must not reopen recovery after an in-flight network failure',async()=>{
 const h=harness();await flush();h.audio.currentTime=h.audio.duration;h.audio.ended=true;h.audioEvents.ended();h.rejectResponse(new Error('Synthetic network failure'));await flush();
 assert.equal(h.controller.inspect().phase,'ended');assert.equal(h.controller.inspect().watchdogActive,false);
});
test('submitted listening ignores late media error',async()=>{
 const h=harness();await flush();h.controller.finish();h.resolveResponse();await flush();h.audio.error={code:4};h.audioEvents.error();
 assert.equal(h.controller.inspect().phase,'submitted');assert.equal(h.controller.inspect().pending,false);assert.equal(h.controller.inspect().watchdogActive,false);
});
test('submitted listening ignores late ended and recovery signals',async()=>{
 const h=harness();await flush();h.controller.finish();h.resolveResponse();await flush();const requests=h.sent.length;h.audioEvents.ended();h.events.online();h.events.pageshow({persisted:true});await flush();
 assert.equal(h.controller.inspect().phase,'submitted');assert.equal(h.controller.inspect().watchdogActive,false);assert.equal(h.sent.length,requests);assert.equal(h.playCount(),0);
});

test('ended deadline decision does not await an irrelevant pending recovery',async()=>{
 const h=harness();await flush();h.audio.currentTime=h.audio.duration;h.audio.ended=true;h.audioEvents.ended();let settled=false;const decision=h.controller.beforeAutoSubmit().then(value=>{settled=true;return value;});await flush();const early=settled;h.resolveResponse();const result=await decision;assert.equal(early,true);assert.equal(result.submit,true);assert.equal(h.controller.inspect().phase,'ended');assert.equal(h.playCount(),0);
});
test('disposing after submission preserves terminal state without new progress request',async()=>{
 const h=harness();await flush();h.controller.finish();h.resolveResponse();await flush();const count=h.sent.length;h.controller.dispose();await flush();assert.equal(h.controller.inspect().phase,'submitted');assert.equal(h.controller.inspect().pending,false);assert.equal(h.sent.length,count);assert.equal(h.playCount(),0);
});

test('failed submission after ended audio never rewinds or resumes audio',async()=>{
 const h=harness();await flush();h.audio.currentTime=h.audio.duration;h.audio.ended=true;h.audioEvents.ended();h.resolveResponse();await flush();const requests=h.sent.length;h.controller.submitting();h.controller.submitFailed();await flush();assert.equal(h.audio.currentTime,h.audio.duration);assert.equal(h.controller.inspect().phase,'ended');assert.equal(h.controller.inspect().watchdogActive,false);assert.equal(h.sent.length,requests);assert.equal(h.playCount(),0);
});
