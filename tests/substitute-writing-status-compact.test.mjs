import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const cores=['substitute-k67-shared','substitute-k56-shared','substitute-test-2-k56-shared'];
function fixture(core,{server=true,request}={}){
 const text=readFileSync(new URL(`../term-tests/${core}/app.js`,import.meta.url),'utf8');
 const start=text.indexOf('  async function refreshWritingGrading()');
 const end=text.indexOf('\n  function scheduleWritingGradingRefresh()',start);
 assert.ok(start>=0&&end>start,'Run the actual app refresh function');
 const calls=[],rendered=[],notices=[];
 const state={attemptToken:'synthetic-attempt-A',studentRef:'101',writingSubmitted:true,
  drafts:{listening:{1:'Synthetic private answer'},reading:{1:'Another private answer'},
   writing:{task1:'Synthetic Task 1 '.repeat(200),task2:'Synthetic Task 2 '.repeat(400)}},
  result:{writing:{grading:{ready:false,status:'processing'}}},testGrades:{}};
 const context={state,classCode:'SYNTHETIC',promptVersion:'fixture-v1',demoMode:false,serverGradingMode:server,
  writingSubmission:{owner:()=>state.studentRef+':'+state.attemptToken,current:value=>value===state.studentRef+':'+state.attemptToken,
    readAvailable(){},readUnavailable(){}},
  writingGradingPollInFlight:false,elements:{resultView:{hidden:true}},document:{hidden:false},navigator:{onLine:true},window:{SUBSTITUTE_STATE:{blocked:false}},
  apiRequest:async(path,options)=>{calls.push({path,options,body:JSON.parse(options.body)});return request?request():{accepted:true,grading:{ready:false,status:'processing'}};},
  saveSession(){},buildDemoPayload:()=>({writing:{grading:state.testGrades.writing.grading}}),
  renderResult:value=>{rendered.push(value);state.result=value;},applyWritingFromServer(){},
  stopWritingGradingPolling(){context.stops++;},showNotice:(...args)=>notices.push(args),
  scheduleWritingGradingRefresh(){context.schedules++;},stops:0,schedules:0};
 vm.createContext(context);vm.runInContext(text.slice(start,end),context);
 return{context,state,calls,rendered,notices,refresh:()=>context.refreshWritingGrading()};
}
for(const core of cores){
 test(`${core}: repeated status requests contain identity only; drafts, legacy read and ready outcome survive`,async t=>{
  let ready=false;
  const f=fixture(core,{request:()=>({accepted:true,grading:{ready,status:ready?'ready':'processing'},portalSync:{status:'pending'}})});
  const drafts=structuredClone(f.state.drafts);
  for(let i=0;i<3;i++)await f.refresh();
  assert.equal(f.calls.length,3);assert.equal(f.context.schedules,3);
  const expected={classCode:'SYNTHETIC',studentRef:'101',attemptToken:'synthetic-attempt-A',...(core==='substitute-k67-shared'?{promptVersion:'fixture-v1'}:{})};
  for(const call of f.calls){
   assert.equal(call.path,'/api/test/writing/status');assert.equal(call.options.method,'POST');
   assert.deepEqual(call.body,expected);assert.ok(Buffer.byteLength(call.options.body)<256);
  }
  assert.deepEqual(f.state.drafts,drafts);
  ready=true;await f.refresh();assert.equal(f.context.stops,1);assert.equal(f.context.schedules,3);
  assert.ok(f.notices[0][0].includes('chấm xong'));assert.ok(!f.notices[0][0].includes('đồng bộ lên Portal'));
  const legacy=fixture(core,{server:false,request:()=>({writing:{submitted:true,grading:{ready:false,status:'processing'}}})});
  await legacy.refresh();assert.equal(legacy.calls[0].path,'/api/term-tests/result');
  assert.deepEqual(legacy.calls[0].body,{attemptToken:'synthetic-attempt-A'});
  t.diagnostic(`status bytes=${Buffer.byteLength(f.calls[0].options.body)}; synthetic drafts preserved`);
 });
 test(`${core}: in-flight status does not overlap or apply a late different-attempt response`,async()=>{
  let resolve;const f=fixture(core,{request:()=>new Promise(done=>{resolve=done;})});
  const pending=f.refresh();await f.refresh();assert.equal(f.calls.length,1);
  f.state.attemptToken='synthetic-attempt-B';f.state.studentRef='202';
  resolve({accepted:true,grading:{ready:true,status:'ready'}});await pending;
  assert.equal(f.rendered.length,0);assert.equal(f.state.testGrades.writing,undefined);
  assert.equal(f.context.writingGradingPollInFlight,false);
 });
}
