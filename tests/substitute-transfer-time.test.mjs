import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connectExamJournal} from '../term-tests/shared/exam-journal/bridge.mjs';
const source=fs.readFileSync(process.env.SUBSTITUTE_TIMING_SOURCE||new URL('../term-tests/substitute-shared/exam-timing.js',import.meta.url),'utf8');
function fixture(){
 let now=Date.parse('2026-10-14T00:00:00Z');const events=[],requests=[],timers=[];
 const state={classCode:'DEMO',studentRef:'fictional-01',clientRunId:'11111111-1111-4111-8111-111111111111'};
 const date=class extends Date{constructor(v){super(v===undefined?now:v);}static now(){return now;}};
 const window={TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://fixture.invalid'},SUBSTITUTE_STATE:{meta:{examTimingVersion:'substitute-audio-transfer-20261014-v1'},blocked:false,track:()=>()=>{},payload:x=>x},dispatchEvent:e=>events.push(e)};
 const context=vm.createContext({window,Map,URL,Date:date,AbortController,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},
 fetch:async(_,o)=>{const req=JSON.parse(o.body);requests.push(req);const data={...state,timingVersion:'substitute-audio-transfer-20261014-v1',serverNow:new date().toISOString(),listeningStartedAt:new date().toISOString(),listeningDeadlineAt:''};
 if(req.route.endsWith('audio-ended'))Object.assign(data,{audioEndedAt:req.payload.audioEndedAt,listeningDeadlineAt:new date(Date.parse(req.payload.audioEndedAt)+300000).toISOString()});
 if(req.route.endsWith('/session'))Object.assign(data,window.fixtureSessionOverride||{});return{ok:true,json:async()=>data};}});
 vm.runInContext(source,context);return{window,state,events,requests,timers,advance:ms=>{now+=ms;}};
}
test('Lượt mới xin thời gian server; phiên Listening legacy không bị đổi giữa bài',async()=>{
 const f=fixture(),value=await f.window.SUBSTITUTE_EXAM.start(f.state);assert.equal(value.examSessionId,f.state.clientRunId);assert.equal(value.listeningDeadlineAt,'');
 assert.equal(await f.window.SUBSTITUTE_EXAM.start({...f.state,listeningStartedAt:'2026-10-14T00:00:00Z'}),null);
 assert.equal(f.requests.length,1);
});
test('Reload trước khi server xác nhận vẫn giữ mốc audio-end gốc; mốc đã xác nhận trên server thắng provisional',async()=>{
 const f=fixture(),audioEndedAt='2026-10-14T00:28:48.536Z',listeningDeadlineAt='2026-10-14T00:33:48.536Z';
 const state={...f.state,examSessionId:f.state.clientRunId,listeningStartedAt:'2026-10-14T00:00:00Z',audioEndedAt,listeningDeadlineAt};
 f.advance(1788536);const resumed={...state,...await f.window.SUBSTITUTE_EXAM.start(state)};
 assert.equal(resumed.audioEndedAt,audioEndedAt);assert.equal(resumed.listeningDeadlineAt,listeningDeadlineAt);
 f.window.TERM_TEST_BOOTSTRAP=Object.freeze(resumed);f.window.SUBSTITUTE_EXAM.ended({duration:1728.535488},resumed.audioEndedAt);await new Promise(r=>setImmediate(r));
 assert.equal(f.events.at(-1).detail.listeningDeadlineAt,listeningDeadlineAt);
 const confirmed={audioEndedAt:'2026-10-14T00:28:48.000Z',listeningDeadlineAt:'2026-10-14T00:33:48.000Z'};f.window.fixtureSessionOverride=confirmed;
 assert.equal((await f.window.SUBSTITUTE_EXAM.start(state)).listeningDeadlineAt,confirmed.listeningDeadlineAt);
});
test('Audio preview/không có phiên thật không mở 5 phút; audio chính mở 300 giây, không gia hạn do sự kiện lặp',async()=>{
 const f=fixture();f.window.TERM_TEST_BOOTSTRAP=Object.freeze({...f.state});f.window.SUBSTITUTE_EXAM.ended({duration:1728.535488});assert.equal(f.events.length,0);
 f.window.TERM_TEST_BOOTSTRAP=Object.freeze({...f.state,examSessionId:f.state.clientRunId});f.advance(1728536);
 f.window.SUBSTITUTE_EXAM.ended({duration:1728.535488});await new Promise(r=>setImmediate(r));
 const end=f.events[0].detail;assert.equal(Date.parse(end.listeningDeadlineAt)-Date.parse(end.audioEndedAt),300000);
 f.advance(30000);f.window.SUBSTITUTE_EXAM.ended({duration:1728.535488});await new Promise(r=>setImmediate(r));
 assert.equal(f.events.at(-1).detail.listeningDeadlineAt,end.listeningDeadlineAt);
 f.window.SUBSTITUTE_STATE.blocked=true;const n=f.events.length;f.window.SUBSTITUTE_EXAM.ended({duration:1728.535488});assert.equal(f.events.length,n);
});
test('Kết thúc audio khi chưa đối soát được giờ không tạo ngày lỗi hoặc giả mốc server đã xác nhận',async()=>{
 const f=fixture();f.advance(1728536);
 f.window.IZONE_EXAM_CLOCK={now:()=>NaN,estimate:()=>Date.parse('2026-10-14T00:28:48.536Z')};
 f.window.TERM_TEST_BOOTSTRAP={...f.state,examSessionId:f.state.clientRunId};
 assert.doesNotThrow(()=>f.window.SUBSTITUTE_EXAM.ended({duration:1728.535488}));
 assert.equal(f.events[0].detail.audioEndedAt,'2026-10-14T00:28:48.536Z');assert.equal(f.events[0].detail.serverNow,undefined);
 await new Promise(r=>setImmediate(r));assert.ok(f.events.at(-1).detail.serverNow);
});

test('Substitute 2 K67: audio ngắn hoặc ended sớm không tạo mốc tự thu',async()=>{
 const f=fixture();f.window.TERM_TEST_CONFIG={slug:'substitute-test-2-k67',listening:{durationSeconds:1745}};
 f.window.TERM_TEST_BOOTSTRAP={...f.state,examSessionId:f.state.clientRunId};
 f.advance(1745058);
 assert.equal(f.window.SUBSTITUTE_EXAM.ended({duration:1200,currentTime:1200}),false);
 assert.equal(f.window.SUBSTITUTE_EXAM.ended({duration:1745.057958,currentTime:1200}),false);
 assert.equal(f.events.length,0);
 assert.equal(f.requests.length,0);
 const audio={duration:1745.057958,currentTime:1745.057958};
 assert.equal(f.window.SUBSTITUTE_EXAM.ended(audio),true);
 await new Promise(r=>setImmediate(r));
 assert.equal(f.requests.length,1);
 assert.equal(Date.parse(f.events[0].detail.listeningDeadlineAt)-Date.parse(f.events[0].detail.audioEndedAt),300000);
});

for (const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']) {
 test(slug+': đo nguyên nhân chặn, giờ rà và giữ đúng lượt',async t=>{
  const f=fixture(),win=f.window,doc=new EventTarget(),events=[],a='a'.repeat(64),b='b'.repeat(64);
  const target=new EventTarget(),otherRun='22222222-2222-4222-8222-222222222222';
  const apiOrigin='https://fixture.invalid';
  Object.assign(win,{location:{href:apiOrigin},navigator:{userAgent:'Fixture',languages:[],onLine:true},
   screen:{width:1024,height:768},performance,innerWidth:1024,innerHeight:768,
   MutationObserver:class{observe(){}disconnect(){}},
   addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),
   TERM_TEST_CONFIG:{slug,listening:{durationSeconds:1700}}});
  win.TERM_TEST_APP_CONFIG.EXAM_JOURNAL_ENABLED=true;
  Object.assign(doc,{body:{},querySelectorAll:()=>[],visibilityState:'visible'});
  const bridge=connectExamJournal({enabled:true,endpoint:apiOrigin+'/substitute-journal-api/'+slug,testSlug:slug,
   document:doc,window:win,getState:()=>win.TERM_TEST_BOOTSTRAP||{classCode:'FIXTURE'},
   outbox:{async renewBinding(){},async put(binding,event){events.push({binding,event});},
    async list(){return[];},async size(){return 0;},async close(){}},
   fetcher:async(_url,options)=>{const proof=JSON.parse(options.body),binding=proof.clientRunId===otherRun?b:a;
    return {ok:true,json:async()=>({ok:true,bindingId:binding,ticket:'fixture',ticketId:randomUUID(),
     issuedAt:Date.now(),expiresAt:Date.now()+60000,identityConfirmed:!!proof.clientRunId})};}});
  t.after(()=>bridge.stop());
  const wait=async(binding,confirmed)=>{for(let i=0;i<40;i++){
   if(events.some(row=>row.binding===binding&&row.event.type==='identity_observed'
    &&row.event.data.identityConfirmed===confirmed))return;
   await new Promise(setImmediate);
  }assert.fail('no bound fixture ticket');};
  await wait(a,false);
  const end='2026-11-07T16:00:00.000Z';
  const fixtureAudio={duration:1700,currentTime:1700,ended:true};
  const owner={...f.state,examSessionId:f.state.clientRunId,officialAudioElement:fixtureAudio};
  win.TERM_TEST_BOOTSTRAP=owner;
  const wrongDuration={...fixtureAudio,duration:1749.7,currentTime:1749.7};
  const wrongPosition={...fixtureAudio,currentTime:1670};
  assert.equal(win.SUBSTITUTE_EXAM.validAudioEnd(wrongDuration,owner),false);
  bridge.stateChanged('native_learner');await wait(a,true);
  assert.equal(win.SUBSTITUTE_EXAM.validAudioEnd(wrongDuration,owner),false);
  assert.equal(win.SUBSTITUTE_EXAM.validAudioEnd(wrongDuration,owner),false);
  assert.equal(win.SUBSTITUTE_EXAM.validAudioEnd(wrongPosition,owner),false);
  assert.equal(win.SUBSTITUTE_EXAM.ended(fixtureAudio,end,owner),true);
  await new Promise(setImmediate);
  win.SUBSTITUTE_EXAM.ended(fixtureAudio,end,owner);
  await bridge.recorder.idle();
  assert.equal(f.requests.length,1);
  assert.equal(f.requests[0].route,'/api/test/exam/audio-ended');
  assert.equal(f.requests[0].payload.heardSeconds,1700);
  const decisions=()=>events.filter(row=>row.event.data.action==='listening_end_decision');
  assert.deepEqual(decisions().map(row=>[row.binding,row.event.data.checkpointState.decision]),[
   [a,'duration_mismatch'],[a,'position_outside_end'],[a,'review_started'],[a,'review_confirmed']]);
  assert.equal(decisions()[0].event.data.durationSeconds,1749.7);
  assert.equal(decisions()[0].event.data.checkpointState.configuredDurationSeconds,1700);
  assert.equal(decisions()[1].event.data.positionSeconds,1670);
  assert.equal(decisions()[2].event.data.checkpointState.clockSource,'media_end_sample');
  assert.equal(decisions()[3].event.data.checkpointState.clockSource,'server_ack');
  assert.equal(decisions()[3].event.data.checkpointState.reviewDeadlineAt,'2026-11-07T16:05:00.000Z');
  const nextOwner={...f.state,clientRunId:otherRun,examSessionId:otherRun};
  win.TERM_TEST_BOOTSTRAP=nextOwner;
  assert.equal(win.SUBSTITUTE_EXAM.validAudioEnd(wrongDuration,owner),false);
  bridge.stateChanged('new_owner');await wait(b,true);
  assert.equal(win.SUBSTITUTE_EXAM.validAudioEnd(wrongDuration,owner),false);
  assert.equal(win.SUBSTITUTE_EXAM.validAudioEnd(wrongDuration,nextOwner),false);
  await bridge.recorder.idle();
  assert.deepEqual(decisions().filter(row=>row.binding===b).map(row=>row.event.data.checkpointState.decision),['duration_mismatch']);
 });
}
