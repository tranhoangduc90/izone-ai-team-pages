import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.SUBSTITUTE_TIMING_SOURCE||new URL('../term-tests/substitute-shared/exam-timing.js',import.meta.url),'utf8');
function fixture(){
 let now=Date.parse('2026-10-14T00:00:00Z');const events=[],requests=[],timers=[];
 const state={classCode:'DEMO',studentRef:'fictional-01',clientRunId:'11111111-1111-4111-8111-111111111111'};
 const date=class extends Date{constructor(v){super(v===undefined?now:v);}static now(){return now;}};
 const window={TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://fixture.invalid'},SUBSTITUTE_STATE:{meta:{examTimingVersion:'substitute-audio-transfer-20261014-v1'},blocked:false,track:()=>()=>{},payload:x=>x},dispatchEvent:e=>events.push(e)};
 const context=vm.createContext({window,Map,Date:date,AbortController,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},
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
