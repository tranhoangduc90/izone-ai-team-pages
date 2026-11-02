import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeakingTeacherTracker} from '../shared/speaking-teacher-tracking.mjs';
const id='78000000-0000-4000-8000-000000000001',rev=n=>n.toString(16).padStart(64,'0'),settle=()=>new Promise(resolve=>setImmediate(resolve));
const normal={classId:'2304',classCode:'IC2304',code:'67-speaking-test',unitId:id};
const classBody=(tag=1)=>({assignment:{code:normal.code,title:'Bài giả'},class:{classId:normal.classId,classCode:normal.classCode},students:[],tag});
const detailBody=(unitId=id)=>({id:unitId,assignment:{code:normal.code},student:{classCode:normal.classCode},links:[],processing:[]});
function clock(){let now=0,next=0;const tasks=new Map();return{setTimer(fn,delay){const id=++next;tasks.set(id,{fn,at:now+delay});return id;},clearTimer:id=>tasks.delete(id),async advance(ms){const end=now+ms;for(let n=0;n<500;n++){const first=[...tasks].filter(([,task])=>task.at<=end).sort(([,a],[,b])=>a.at-b.at)[0];if(!first)break;tasks.delete(first[0]);now=first[1].at;first[1].fn();await settle();}now=end;await settle();}};}
function setup(options={}){
 const scope=options.scope||normal,time=clock(),transport=new Map(),closed=[],values=[],details=[],docs=[],errors=[],unavailable=[];let unsupported=0,synced=0;
 const tracker=createSpeakingTeacherTracker({scope,stores:['independent','legacy'].map(id=>({id,url:'https://fixture.test/'+id,poll:async()=>{throw Error('unexpected poll');}})),
  loadStudents:async()=>classBody(),loadDetail:async()=>detailBody(scope.unitId),onStudents:value=>values.push(value),onDetail:value=>details.push(value),onDocs:value=>docs.push(value),onError:error=>errors.push(error),
  onUnavailable:error=>unavailable.push(error),onUnsupported:()=>{unsupported++;},onSynchronized:()=>{synced++;},...time,...options,
  observerFactory:config=>{const store=config.url.split('/').at(-1);transport.set(store,config);return{close:()=>closed.push(store),snapshot:()=>({})};}});
 function frame(store,sequence=1,{list=1,content=1,doc=1}={}){
  const selected=scope.unitId&&(scope.unitId.startsWith('legacy_')?store==='legacy':store==='independent'),unitId=selected?scope.unitId.replace(/^legacy_/,''):null;
  return{kind:'speaking-teacher-state-v1',classId:scope.classId,code:scope.code,unitId,classRevision:rev(list),unitContentRevision:selected?rev(content):null,
   unitDocsRevision:selected?rev(doc):null,unitDocs:selected?{docsProgress:{status:doc===1?'pending':'verified',sequence:String(doc),applied_sequence:String(doc-1)},docsJobs:[]}:null,
   revision:rev(sequence*100+list*10+doc),epoch:store+'-server',sequence};
 }
 return{tracker,time,transport,closed,values,details,docs,errors,unavailable,frame,emit:(store,sequence,fields)=>transport.get(store).onState(frame(store,sequence,fields)),
  get unsupported(){return unsupported;},get synced(){return synced;}};
}
test('Speaking teacher coalesces two stores into one native list read and keeps Docs-only separate from content',async()=>{
 const f=setup();try{
  f.emit('independent',1);f.emit('legacy',1);await f.time.advance(250);assert.equal(f.values.length,1);assert.equal(f.details.length,1);assert.equal(f.docs.length,1);
  f.emit('independent',2,{doc:2});await f.time.advance(500);assert.equal(f.values.length,1);assert.equal(f.details.length,1);assert.equal(f.docs.length,2);
  f.emit('independent',3,{content:2,doc:2});await f.time.advance(100);assert.equal(f.values.length,1);assert.equal(f.details.length,2);
  f.emit('legacy',2,{list:2});f.emit('independent',4,{list:2,content:2,doc:2});await f.time.advance(100);assert.equal(f.values.length,2);
 }finally{f.tracker.close();}
});
test('Speaking teacher keeps one in-flight class read under a dense metadata burst and still applies then reconciles progress',async()=>{
 let complete,calls=0;const f=setup({scope:{...normal,unitId:null},loadStudents:async()=>{calls++;return calls===1?new Promise(resolve=>{complete=resolve;}):classBody(100);}});
 try{
  f.emit('independent',1);f.emit('legacy',1);await f.time.advance(250);assert.equal(calls,1);
  for(let n=2;n<=100;n++)f.emit('independent',n,{list:n});await f.time.advance(1000);assert.equal(calls,1);
  complete(classBody(1));await settle();assert.equal(f.values.length,1,'Do not starve the view by dropping every completed native response');
  await f.time.advance(100);assert.equal(calls,2);assert.deepEqual(f.values.map(value=>value.tag),[1,100]);
  await f.time.advance(1000);assert.equal(calls,2);
 }finally{f.tracker.close();}
});
test('Speaking teacher binds a legacy selection to the legacy store and rejects a cross-scope native body',async()=>{
 const f=setup({scope:{...normal,unitId:'legacy_'+id},loadDetail:async()=>detailBody('legacy_'+id)});try{
  f.emit('independent',1);f.emit('legacy',1);await f.time.advance(250);assert.equal(f.details[0].id,'legacy_'+id);assert.equal(f.docs[0].unitId,'legacy_'+id);
  f.transport.get('independent').onState({...f.frame('independent',2),unitId:id});assert.equal(f.unsupported,1);assert.equal(f.tracker.snapshot().closed,true);
 }finally{f.tracker.close();}
 const bad=setup({loadStudents:async()=>({...classBody(),class:{classId:'9999',classCode:'OTHER'}})});try{
  bad.emit('independent',1);bad.emit('legacy',1);await bad.time.advance(250);assert.equal(bad.values.length,0);assert.equal(bad.unsupported,1);
 }finally{bad.tracker.close();}
});
test('Speaking teacher body errors respect Retry-After and do not block the other body lane or accept metadata as an early retry',async()=>{
 let calls=0;const f=setup({loadStudents:async()=>{if(++calls===1)throw Object.assign(Error('quota'),{status:429,retryAfterMs:90000});return classBody(2);}});
 try{
  f.emit('independent',1);f.emit('legacy',1);await f.time.advance(250);assert.equal(calls,1);assert.equal(f.details.length,1);assert.equal(f.errors.length,1);
  f.emit('legacy',2,{list:2});f.emit('independent',2,{doc:2});await f.time.advance(89999);assert.equal(calls,1);
  await f.time.advance(1);assert.equal(calls,2);assert.equal(f.values[0].tag,2);
 }finally{f.tracker.close();}
});
test('Speaking teacher metadata recovery with the identical current frame clears unavailable without another body read',async()=>{
 const f=setup();try{
  f.emit('independent',1);f.emit('legacy',1);await f.time.advance(250);const synced=f.synced;
  f.transport.get('legacy').onUnavailable({code:'TEMPORARY',status:503});assert.equal(f.unavailable.length,1);
  f.transport.get('legacy').onState(f.frame('legacy',1));assert.ok(f.synced>synced);await f.time.advance(500);
  assert.equal(f.values.length,1);assert.equal(f.details.length,1);
 }finally{f.tracker.close();}
});
test('Speaking teacher revoked permissions close both stores without a weaker fallback',async()=>{
 for(const status of [401,403,423]){
  const f=setup();try{f.emit('independent',1);f.emit('legacy',1);await f.time.advance(250);
   f.transport.get('legacy').onRevoked({code:'ACCESS_DENIED',status});assert.equal(f.errors.at(-1).status,status);assert.equal(f.unsupported,0);assert.deepEqual(new Set(f.closed),new Set(['independent','legacy']));
   const reads=f.values.length;await f.time.advance(120000);assert.equal(f.values.length,reads);
  }finally{f.tracker.close();}
 }
});
test('Speaking teacher old endpoints fall back once, and a closed or replaced owner ignores late native bodies',async()=>{
 const old=setup();try{old.transport.get('legacy').onUnsupported();assert.equal(old.unsupported,1);assert.equal(old.tracker.snapshot().closed,true);}finally{old.tracker.close();}
 let complete,current=true,signal;const f=setup({scope:{...normal,unitId:null},isCurrent:()=>current,loadStudents:async options=>{signal=options.signal;return new Promise(resolve=>{complete=resolve;});}});
 try{f.emit('independent',1);f.emit('legacy',1);await f.time.advance(250);current=false;f.emit('legacy',2,{list:2});assert.equal(signal.aborted,true);
  complete(classBody());await settle();await f.time.advance(120000);assert.equal(f.values.length,0);
 }finally{f.tracker.close();}
});
test('Speaking teacher stalled body reads abort at the deadline and retry without blocking the selected detail',async()=>{
 let calls=0;const f=setup({loadStudents:async({signal})=>{
  if(++calls>1)return classBody(2);
  return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})),{once:true}));
 }});
 try{
  f.emit('independent',1);f.emit('legacy',1);await f.time.advance(250);assert.equal(f.details.length,1);
  await f.time.advance(14999);assert.equal(f.errors.length,0);await f.time.advance(1);
  assert.equal(f.errors.at(-1).code,'SPEAKING_TEACHER_READ_TIMEOUT');assert.equal(f.errors.at(-1).status,503);assert.notEqual(f.errors.at(-1).name,'AbortError');
  await f.time.advance(29999);assert.equal(calls,1);await f.time.advance(1);assert.equal(calls,2);assert.equal(f.values[0].tag,2);
 }finally{f.tracker.close();}
});
