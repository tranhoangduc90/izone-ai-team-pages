import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeakingStudentTracker} from '../shared/speaking-student-tracking.mjs';
import {createSpeakingLivePoller} from '../speaking-homework/live-tracking.js';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const id=n=>`76000000-0000-4000-8000-${String(n).padStart(12,'0')}`,rev=n=>String(n).padStart(64,'a'),identity={accessToken:'t'.repeat(43),studentRef:id(1)};
const frame=(sequence,content=1,docs=1)=>({kind:'speaking-student-state-v1',unitId:id(100),studentRef:id(1),epoch:'server-a',sequence,revision:rev(sequence),
 contentRevision:rev(content),docsRevision:rev(docs),docsProgress:{status:docs===1?'pending':'verified',sequence:String(docs),applied_sequence:String(docs-1)},docsJobs:[],documentId:'fixture-doc'});
const view=content=>({kind:'speaking-student-view-v1',unitId:id(100),contentRevision:rev(content),docsRevision:rev(1),open:{status:'draft'},doctor:{needed:[]}});
function clock(){let now=0,next=0;const tasks=new Map();return{setTimer(fn,delay){const id=++next;tasks.set(id,{fn,at:now+delay});return id;},clearTimer(id){tasks.delete(id);},async advance(ms){const end=now+ms;for(let n=0;n<100;n++){const first=[...tasks].filter(([,t])=>t.at<=end).sort(([,a],[,b])=>a.at-b.at)[0];if(!first)break;tasks.delete(first[0]);now=first[1].at;first[1].fn();await settle();}now=end;await settle();}};}
function low({fetcher=async()=>Response.json({ok:true,view:view(1)}),...options}={}){
 const time=clock(),values=[],docs=[],errors=[];let transport;
 const tracker=createSpeakingStudentTracker({base:'https://fixture.test/speaking',identity,onView:value=>values.push(value),onDocs:value=>docs.push(value),onError:error=>errors.push(error),
  observerFactory:config=>{transport=config;return{close(){},snapshot:()=>({})};},fetcher,...time,...options});
 return{tracker,time,values,docs,errors,get transport(){return transport;}};
}
test('Speaking student tracker reads one combined body, suppresses unchanged content and patches Docs separately',async()=>{
 let requests=0;const f=low({fetcher:async()=>{requests++;return Response.json({ok:true,view:view(1)});}});
 try{f.transport.onState(frame(1));await settle();assert.equal(f.values.length,1);assert.equal(f.docs.length,1);
  f.transport.onState(frame(2,1,2));await settle();assert.equal(requests,1);assert.equal(f.values.length,1);assert.equal(f.docs.length,2);
  f.transport.onState(frame(1,3,3));await settle();assert.equal(requests,1);assert.equal(f.docs.length,2);
 }finally{f.tracker.close();}
});
test('Speaking student tracker drops an older body after newer metadata and retries the current content',async()=>{
 let complete,calls=0;const f=low({fetcher:async()=>{calls++;if(calls===1)return new Promise(resolve=>{complete=resolve;});return Response.json({ok:true,view:view(2)});}});
 try{f.transport.onState(frame(1));await settle();f.transport.onState(frame(2,2));complete(Response.json({ok:true,view:view(1)}));await settle();
  assert.equal(f.values.length,0);await f.time.advance(4000);assert.equal(f.values.length,1);assert.equal(f.values[0].contentRevision,rev(2));
 }finally{f.tracker.close();}
});
test('Speaking student tracker rejects cross-unit body and a native refresh invalidates older background reads',async()=>{
 let complete,epoch=0,calls=0;const f=low({readEpoch:()=>epoch,fetcher:async()=>{calls++;if(calls===1)return new Promise(resolve=>{complete=resolve;});return Response.json({ok:true,view:{...view(1),unitId:id(999)}});}});
 try{f.transport.onState(frame(1));await settle();epoch++;complete(Response.json({ok:true,view:view(1)}));await settle();assert.equal(f.values.length,0);
  await f.time.advance(4000);assert.equal(f.values.length,0);assert.equal(f.errors.at(-1).code,'SPEAKING_VIEW_INVALID');
 }finally{f.tracker.close();}
});
test('Speaking student tracker keeps identity in POST body, honors busy state and ignores late responses after close',async()=>{
 let busy=true,complete;const requests=[],f=low({canRead:()=>!busy,fetcher:async(url,options)=>{requests.push({url,options});return new Promise(resolve=>{complete=resolve;});}});
 try{f.transport.onState(frame(1));await settle();assert.equal(requests.length,0);busy=false;await f.time.advance(4000);assert.equal(requests.length,1);
  assert.equal(requests[0].url.includes(identity.accessToken),false);assert.equal(requests[0].options.method,'POST');assert.equal(JSON.parse(requests[0].options.body).studentRef,id(1));
  f.tracker.close();assert.equal(requests[0].options.signal.aborted,true);complete(Response.json({ok:true,view:view(1)}));await settle();assert.equal(f.values.length,0);
 }finally{f.tracker.close();}
});

function controller(){
 let pending=false,session=true,current={base:'https://fixture.test/speaking',identity:{...identity},unitId:id(100),documentId:'fixture-doc'};
 const modes=[],native=[],applied=[],listeners=new Map(),doc={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const poller=createSpeakingLivePoller({refresh:async()=>{},hasSession:()=>session,isPending:()=>pending,onError:error=>applied.push(error),getContext:()=>current,
  onView:value=>applied.push(value),onDocs:value=>applied.push(value),documentObject:doc,
  trackerFactory:options=>{const item={options,closed:false};modes.push(item);return{close(){item.closed=true;}};},
  nativePollerFactory:()=>Object.fromEntries(['expect','retry','update','settled','stop'].map(name=>[name,()=>native.push(name)]))});
 return{poller,modes,native,applied,doc,listeners,setPending:value=>{pending=value;},setContext:value=>{current=value;},getContext:()=>current,setSession:value=>{session=value;}};
}
const capabilities={studentStateStream:true,studentCombinedView:true};
test('Speaking independent keeps its current stream startup when a save starts',()=>{
 const f=controller();
 try{
  f.setContext({...f.getContext(),base:'https://fixture.test/api/speaking-homework-independent'});
  f.poller.observed({capabilities});
  f.poller.expect();
  assert.equal(f.modes.length,1,'Keep independent stream startup');
 }finally{f.poller.dispose();}
});
test('Speaking legacy starts a new stream after the foreground save and still tracks an uncertain response',()=>{
 const f=controller();
 f.setContext({...f.getContext(),base:'https://fixture.test/api/speaking-homework',unitId:null});
 try{
  f.poller.observed({capabilities});
  f.poller.expect();
  assert.equal(f.modes.length,0,'The save should not compete with a new observer');
  f.poller.update();
  assert.equal(f.modes.length,1,'A settled request with an uncertain response still needs tracking');
  f.poller.expect();
  assert.equal(f.modes[0].closed,false,'Keep an already open stream');
  assert.equal(f.modes.length,1);
 }finally{f.poller.dispose();}
});
test('Speaking live controller stays idle without pending work and keeps native/hidden/unsupported fallback',()=>{
 const f=controller();try{f.poller.observed({capabilities});assert.equal(f.modes.length,0);f.setPending(true);f.poller.update();assert.equal(f.modes.length,1);
  f.doc.hidden=true;f.listeners.get('visibilitychange')();assert.equal(f.modes[0].closed,true);assert.equal(f.native.at(-1),'update');
  f.doc.hidden=false;f.listeners.get('visibilitychange')();assert.equal(f.modes.length,2);f.modes[1].options.onUnsupported();assert.equal(f.poller.snapshot().blocked,true);
  f.poller.observed({capabilities});assert.equal(f.modes.length,2);assert.equal(f.native.at(-1),'expect');
 }finally{f.poller.dispose();}
});
test('Speaking live controller preserves Docs sequence and rejects old identity callbacks before a new native open',()=>{
 const f=controller();try{f.setPending(true);f.poller.observed({capabilities,documentId:'fixture-doc',docsProgress:{sequence:'2',applied_sequence:'2'}});
  const old=f.modes[0].options;old.onDocs({...frame(1),docsProgress:{sequence:'1',applied_sequence:'0'}});assert.equal(f.applied.length,0);
  old.onDocs({...frame(2),docsProgress:{sequence:'3',applied_sequence:'2'}});assert.equal(f.applied.length,1);
  f.setContext({...f.getContext(),identity:{accessToken:'u'.repeat(43),studentRef:id(2)}});old.onDocs(frame(3));assert.equal(f.applied.length,1);
  assert.equal(f.poller.acceptDocs({sequence:'1',applied_sequence:'0'},'fixture-doc'),true);
 }finally{f.poller.dispose();}
});
test('Speaking final Docs completion drains the same-frame content update before becoming idle',async()=>{
 let pending=true,transport,closed=false,requests=0,complete,poller;const applied=[],time=clock();
 const context={base:'https://fixture.test/speaking',identity,unitId:id(100),documentId:'fixture-doc'};
 poller=createSpeakingLivePoller({refresh:async()=>{},hasSession:()=>true,isPending:()=>pending,onError:error=>{throw error;},getContext:()=>context,
  onDocs:value=>{pending=value.docsProgress.status==='pending';},onView:value=>{applied.push(value.contentRevision);poller.settled();},
  documentObject:{hidden:false,addEventListener(){},removeEventListener(){}},
  nativePollerFactory:()=>Object.fromEntries(['expect','retry','update','settled','stop'].map(name=>[name,()=>{}])),
  trackerFactory:options=>createSpeakingStudentTracker({...options,...time,observerFactory:config=>{transport=config;return{close(){closed=true;}};},
   fetcher:async()=>{requests++;return requests===1?Response.json({ok:true,view:view(1)}):new Promise(resolve=>{complete=resolve;});}})});
 try{
  poller.observed({capabilities,docsProgress:frame(1).docsProgress});transport.onState(frame(1));await settle();assert.deepEqual(applied,[rev(1)]);
  transport.onState(frame(2,2,2));await settle();assert.equal(requests,2,'Read the final content despite the Docs callback clearing pending');
  assert.equal(closed,false,'Keep the reader until its final content has been applied');complete(Response.json({ok:true,view:view(2)}));await settle();
  assert.deepEqual(applied,[rev(1),rev(2)]);assert.equal(closed,true);assert.equal(poller.snapshot().tracking,false);
 }finally{poller.dispose();}
});
test('Speaking view errors back off30/60 seconds; new metadata cannot bypass the delay and success resets it',async()=>{
 let requests=0,fail=true;const f=low({fetcher:async()=>{requests++;return fail?Response.json({ok:false,error:'TEMPORARY'},{status:503}):Response.json({ok:true,view:view(1)});}});
 try{
  f.transport.onState(frame(1));await settle();assert.equal(requests,1);
  f.transport.onState(frame(2,1,2));await settle();assert.equal(requests,1,'A Docs frame must not retry a failed body immediately');
  await f.time.advance(29999);assert.equal(requests,1);await f.time.advance(1);assert.equal(requests,2);
  await f.time.advance(59999);assert.equal(requests,2);fail=false;await f.time.advance(1);assert.equal(requests,3);assert.equal(f.values.length,1);
  fail=true;f.transport.onState(frame(3,2,2));await settle();assert.equal(requests,4);await f.time.advance(29999);assert.equal(requests,4);
  await f.time.advance(1);assert.equal(requests,5,'A successful body resets the first error delay');
 }finally{f.tracker.close();}
});
test('Speaking view errors honor Retry-After even when it exceeds the normal backoff cap',async()=>{
 let requests=0;const f=low({fetcher:async()=>{requests++;return requests===1?Response.json({ok:false,error:'RATE_LIMITED'},{status:429,headers:{'retry-after':'90'}}):Response.json({ok:true,view:view(1)});}});
 try{f.transport.onState(frame(1));await settle();await f.time.advance(89999);assert.equal(requests,1);await f.time.advance(1);assert.equal(requests,2);assert.equal(f.values.length,1);}
 finally{f.tracker.close();}
});
test('Speaking unsupported combined-view endpoint returns to native fallback without retrying the missing endpoint',async()=>{
 let unsupported=0,requests=0;const f=low({onUnsupported:()=>{unsupported++;},fetcher:async()=>{requests++;return Response.json({ok:false,error:'OLD_RUNTIME'},{status:409});}});
 try{f.transport.onState(frame(1));await settle();assert.equal(unsupported,1);assert.equal(f.errors.length,0);await f.time.advance(60000);assert.equal(requests,1);assert.equal(f.tracker.snapshot().closed,true);}
 finally{f.tracker.close();}
});
test('Speaking view authorization failures close the observer without falling back to a weaker endpoint',async()=>{
 for(const status of [401,403,423]){
  let requests=0,unsupported=0;const f=low({onUnsupported:()=>{unsupported++;},fetcher:async()=>{requests++;return Response.json({ok:false,error:'ACCESS_DENIED'},{status});}});
  try{f.transport.onState(frame(1));await settle();assert.equal(f.errors.at(-1).status,status);assert.equal(f.tracker.snapshot().closed,true);
   await f.time.advance(60000);assert.equal(requests,1);assert.equal(unsupported,0);
  }finally{f.tracker.close();}
 }
});
test('Speaking unsupported final view forces one native read even after the Docs callback cleared pending',()=>{
 const f=controller();try{
  f.setPending(true);f.poller.observed({capabilities});f.setPending(false);f.modes[0].options.onUnsupported();
  assert.equal(f.native.at(-1),'expect');assert.equal(f.poller.snapshot().expected,true);assert.equal(f.modes[0].closed,true);
  f.poller.settled();assert.equal(f.poller.snapshot().expected,false);assert.equal(f.poller.snapshot().tracking,false);
 }finally{f.poller.dispose();}
});
