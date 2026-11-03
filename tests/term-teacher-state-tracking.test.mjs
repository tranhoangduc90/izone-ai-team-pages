import test from 'node:test';
import assert from 'node:assert/strict';
import {createTermTeacherTracker,createTermTeacherDashboardTracking} from '../term-tests/shared/teacher-state-tracking.mjs';
const scope={className:'IC2304',testSlug:'term-test-1',studentRef:null},settle=()=>new Promise(r=>setImmediate(r));
const frame=(content=1,access=2)=>({kind:'term-teacher-state-v1',...scope,definitionVersion:1,contentRevision:String(content).repeat(32),accessRevision:String(access).repeat(32),revision:String(content).repeat(32)+String(access).repeat(32)});
function fixture(options={}){
 let callbacks,closed=false,reads=0,synchronized=0,unsupported=0;const errors=[],unavailable=[],timers=[];
 const tracker=createTermTeacherTracker({scope,url:'https://fixture.invalid/stream',poll:async()=>frame(),loadContent:async()=>{reads++;},
  onError:error=>errors.push(error),onUnavailable:value=>unavailable.push(value),onSynchronized:()=>synchronized++,onUnsupported:()=>unsupported++,
  observerFactory:input=>{callbacks=input;return{close(){closed=true;}};},setTimer(fn,delay){const timer={fn,delay,active:true,unref(){}};timers.push(timer);return timer;},clearTimer(timer){if(timer)timer.active=false;},...options});
 return{tracker,errors,unavailable,timers,get callbacks(){return callbacks;},get reads(){return reads;},get synchronized(){return synchronized;},get unsupported(){return unsupported;},get transportClosed(){return closed;}};
}
test('Term teacher metadata: unchanged state avoids content; new content or access still loads at the native thirty-second fallback',async()=>{
 const f=fixture({initialState:frame()});assert.equal(f.callbacks.pollInterval,30000);assert.equal(f.callbacks.pollErrorInterval,30000);
 f.callbacks.onState(frame());await settle();assert.equal(f.reads,0);
 f.callbacks.onState(frame(3));await settle();assert.equal(f.reads,1);
 f.callbacks.onState(frame(3,4));await settle();assert.equal(f.reads,2);
 f.callbacks.onState(frame(3,4));await settle();assert.equal(f.reads,2);f.tracker.close();
});
test('Term teacher metadata: foreign scopes and malformed revisions close before reading full content',async()=>{
 for(const value of [{...frame(),className:'IC2305'},{...frame(),testSlug:'term-test-2'},{...frame(),studentRef:'other'},
  {...frame(),contentRevision:'wrong'},{...frame(),accessRevision:null}]){
  const f=fixture();f.callbacks.onState(value);await settle();assert.equal(f.reads,0);assert.equal(f.unsupported,1);assert.equal(f.transportClosed,true);
 }
});
test('Term teacher metadata: failed content retries the same revision before marking it applied',async()=>{
 let tries=0;const loaded=[];const f=fixture({loadContent:async({state})=>{if(++tries===1)throw Error('fixture transient');loaded.push(state.contentRevision);}});
 f.callbacks.onState(frame());await settle();assert.equal(f.errors.length,1);assert.equal(f.synchronized,0);
 const timer=f.timers.find(t=>t.active);assert.equal(timer.delay,30000);timer.active=false;timer.fn();await settle();
 assert.deepEqual(loaded,['1'.repeat(32)]);assert.equal(f.synchronized,1);f.tracker.close();
});
test('Term teacher metadata: pending reads retain only the newest revision and never acknowledge an intermediate state',async()=>{
 let release;const first=new Promise(r=>release=r),loaded=[];
 const f=fixture({loadContent:({state})=>{loaded.push(state.contentRevision);return loaded.length===1?first:Promise.resolve();}});
 f.callbacks.onState(frame());await settle();f.callbacks.onState(frame(3));f.callbacks.onState(frame(5));release();await settle();
 assert.deepEqual(loaded,['1'.repeat(32),'5'.repeat(32)]);assert.equal(f.synchronized,1);f.tracker.close();
});
test('Term teacher metadata: disposal or changed current scope aborts content and discards late completion',async()=>{
 let release,signal,valid=true;const pending=new Promise(r=>release=r),f=fixture({isCurrent:()=>valid,loadContent:input=>{signal=input.signal;return pending;}});
 f.callbacks.onState(frame());await settle();valid=false;f.callbacks.onState(frame(3));assert.equal(signal.aborted,true);
 release();await settle();assert.equal(f.synchronized,0);assert.equal(f.transportClosed,true);
});
test('Term teacher metadata: a slow read cannot clear a newer outage; recovery does not redownload unchanged content',async()=>{
 let release;const pending=new Promise(r=>release=r),f=fixture({loadContent:()=>pending});
 f.callbacks.onState(frame());await settle();f.callbacks.onUnavailable({code:'FIXTURE_OFFLINE',status:503});release();await settle();assert.equal(f.synchronized,0);
 f.callbacks.onState(frame());await settle();assert.equal(f.synchronized,1);assert.equal(f.tracker.snapshot().contentReads,1);f.tracker.close();
});
test('Term teacher metadata: revocation closes the observer and does not become a content success',async()=>{
 const f=fixture();f.callbacks.onRevoked({status:403,code:'ACCESS_DENIED'});await settle();
 assert.equal(f.errors[0].status,403);assert.equal(f.transportClosed,true);f.callbacks.onState(frame());await settle();assert.equal(f.reads,0);
});

const dashboardScope=(className='IC2304',enabled=true)=>({enabled,generation:0,apiBase:'https://fixture.invalid',className,testSlug:'term-test-1',studentRef:null});
test('Term teacher dashboard: legacy capability retains full reads; supported startup coalesces and skips steady full polling',async()=>{
 let current=dashboardScope('IC2304',false),metadata=0,full=0,closed=0,created=[];
 const tracking=createTermTeacherDashboardTracking({current:()=>current,request:async()=>{metadata++;return{state:frame()};},
  loadContent:async()=>{full++;},onError:assert.fail,trackerFactory:options=>{created.push(options);return{close(){closed++;},snapshot(){return{live:true};}};}});
 await tracking.load();await tracking.load({quiet:true});assert.deepEqual([metadata,full,created.length],[0,2,0]);
 current=dashboardScope();await Promise.all([tracking.load(),tracking.load()]);assert.deepEqual([metadata,full,created.length],[1,3,1]);
 assert.deepEqual(created[0].initialState,frame());await tracking.load({quiet:true});await tracking.load({quiet:true});assert.equal(full,3);
 await created[0].loadContent({});assert.equal(full,4);tracking.close();assert.equal(closed,1);
});
test('Term teacher dashboard: unsupported API falls back without masking full-content reads or retrying unknown routes each tick',async()=>{
 let metadata=0,full=0,created=0;const tracking=createTermTeacherDashboardTracking({current:()=>dashboardScope(),
  request:async()=>{metadata++;throw Object.assign(Error('old API'),{status:404});},loadContent:async()=>{full++;},onError:assert.fail,
  trackerFactory:()=>{created++;throw Error('must not start');}});
 await tracking.load();await tracking.load({quiet:true});await tracking.load({quiet:true});assert.deepEqual([metadata,full,created],[1,3,0]);tracking.close();
});
test('Term teacher dashboard: temporary metadata failure keeps full content available and starts recovery without a false baseline',async()=>{
 const notices=[];let full=0,created;const tracking=createTermTeacherDashboardTracking({current:()=>dashboardScope(),
  request:async()=>{throw Object.assign(Error('metadata down'),{status:503});},loadContent:async()=>{full++;},onError:assert.fail,
  onUnavailable:e=>notices.push(e.status),trackerFactory:options=>{created=options;return{close(){}};}});
 await tracking.load();assert.equal(full,1);assert.deepEqual(notices,[503]);assert.equal(created.initialState,null);tracking.close();
});
test('Term teacher dashboard: changing scope aborts old initialization and late denial cannot touch current content',async()=>{
 let current=dashboardScope(),release,oldSignal;const first=new Promise(resolve=>release=resolve),loaded=[],created=[];
 const tracking=createTermTeacherDashboardTracking({current:()=>current,request:async(_path,{signal})=>{
  if(current.className==='IC2304'){oldSignal=signal;return first;}return{state:{...frame(),className:current.className}};
 },loadContent:async()=>{loaded.push(current.className);},onError:assert.fail,
  trackerFactory:options=>{created.push(options);return{close(){}};}});
 const old=tracking.load();await settle();current=dashboardScope('IC2305');await tracking.load();assert.equal(oldSignal.aborted,true);
 release({state:frame()});await old;assert.deepEqual(loaded,['IC2305']);assert.equal(created.length,1);
 const before=loaded.length;created[0].onUnsupported();await settle();assert.equal(loaded.length,before+1);tracking.close();
});
test('Term teacher dashboard: authorization denial cannot fall through to content loading',async()=>{
 let full=0;const tracking=createTermTeacherDashboardTracking({current:()=>dashboardScope(),request:async()=>{throw Object.assign(Error('denied'),{status:403});},
  loadContent:async()=>{full++;},onError:assert.fail});
 await assert.rejects(tracking.load(),e=>e.status===403);assert.equal(full,0);tracking.close();
});
