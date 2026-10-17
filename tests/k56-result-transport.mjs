import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const pages=process.env.K56_TRANSPORT_PAGES_ROOT || process.cwd();
const tick=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
function fixture(module='k56-shared'){
 const source=readFileSync(`${pages}/term-tests/${module}/app.js`,'utf8');
 const begin=source.indexOf('  let writingGradingPollTimer ='),end=source.indexOf('  function setWritingSaveStatus(',begin);
 assert.ok(begin>0&&end>begin);
 let sequence=0;const timers=new Map(),streams=[],polls=[],renders=[];
 const state={attemptToken:'synthetic-attempt-A',studentRef:'synthetic-person-A',writingSubmitted:true,result:{writing:{submitted:true,grading:{ready:false,status:'processing'}}}};
 let transport=async()=>({ok:false,status:503}),result=()=>({attemptToken:state.attemptToken,writing:{submitted:true,grading:{ready:false,status:'processing'}}});
 const ctx=vm.createContext({AbortController,TextDecoder,Number,Date,JSON,demoMode:false,state,appConfig:{API_BASE_URL:'https://synthetic.invalid'},
  window:{clearTimeout:id=>timers.delete(id),setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,delay});return id;},queueMicrotask},
  fetch:async(url,options)=>{streams.push({url,options});return transport(url,options);},
  async apiRequest(url,options){polls.push({url,options});return result(url,options);},
  applyWritingFromServer(){},renderResult(payload){renders.push(payload);state.result=payload;},showNotice(){}});
 vm.runInContext(source.slice(begin,end),ctx);
 return {ctx,state,timers,streams,polls,renders,setTransport:f=>transport=f,setResult:f=>result=f,
  async call(name){const value=await ctx[name]();await tick();return value;},
  async fire(delay){const row=[...timers].find(([,v])=>v.delay===delay);assert.ok(row,`Thiếu timer ${delay}`);timers.delete(row[0]);row[1].fn();await tick();},
  delays:()=>[...timers.values()].map(x=>x.delay),get:code=>vm.runInContext(code,ctx)};
}
for(const module of ['k56-shared','k56-test2-shared','k56-mini-shared']){
 test(`${module}: lỗi polling không xóa kết quả cũ; tự phục hồi ready đúng token`,async()=>{
  const f=fixture(module),original=f.state.result;f.setResult(()=>{throw Error('Synthetic disconnected');});
  assert.equal(await f.call('refreshWritingGrading'),'unavailable');assert.equal(f.state.result,original);assert.ok(f.delays().includes(8000));
  f.setResult(()=>({attemptToken:'synthetic-attempt-A',writing:{submitted:true,grading:{ready:true,status:'ready'}}}));
  await f.fire(8000);assert.equal(f.renders.length,1);assert.equal(JSON.parse(f.polls[1].options.body).attemptToken,'synthetic-attempt-A');assert.equal(f.timers.size,0);
 });
 test(`${module}: nhiều lần yêu cầu đồng thời chỉ có một polling đang chạy`,async()=>{
  const f=fixture(module);let release;f.setResult(()=>new Promise(resolve=>release=resolve));
  const pending=f.ctx.refreshWritingGrading();await tick();assert.equal(await f.call('refreshWritingGrading'),'checking');assert.equal(f.polls.length,1);
  release({writing:{submitted:true,grading:{ready:true}}});await pending;await tick();assert.equal(f.renders.length,1);assert.equal(f.timers.size,0);
 });
}
for(const status of [404,405])test(`Term1 stream ${status}: dừng nối lại, polling vẫn hoạt động`,async()=>{
 const f=fixture();f.setTransport(async()=>({ok:false,status}));await f.call('scheduleWritingGradingRefresh');
 assert.equal(f.get('writingGradingStreamUnsupported'),true);assert.deepEqual(f.delays(),[8000]);
 await f.fire(8000);assert.equal(f.polls.length,1);assert.equal(f.streams.length,1);assert.deepEqual(f.delays(),[10000]);
});
test('Term1 stream503: backoff1/2/5/10/30giây, chỉ một lịch nối lại',async()=>{
 const f=fixture();await f.call('startWritingGradingStream');
 for(const delay of [1000,2000,5000,10000,30000,30000]){
  assert.deepEqual(f.delays(),[delay]);await f.call('scheduleWritingGradingStreamReconnect');assert.deepEqual(f.delays(),[delay]);await f.fire(delay);
 }
 assert.equal(f.streams.length,7);await f.call('stopWritingGradingPolling');assert.equal(f.timers.size,0);
});
test('Term1 stream pending: nhiều tín hiệu không tạo request song song',async()=>{
 const f=fixture();let release;f.setTransport(()=>new Promise(resolve=>release=resolve));
 const pending=f.ctx.startWritingGradingStream();await tick();await f.call('startWritingGradingStream');assert.equal(f.streams.length,1);
 release({ok:false,status:503});await pending;await tick();assert.deepEqual(f.delays(),[1000]);
});
test('Term1 ready chia khối tại CRLF: nhận ngay tín hiệu, chỉ tải kết quả một lần',async()=>{
 const f=fixture();const chunks=['event: ready\r','\ndata: {}\r','\n\r','\n'];let n=0;
 f.setTransport(async()=>({ok:true,status:200,body:{getReader:()=>({read:async()=>n<chunks.length?{done:false,value:new TextEncoder().encode(chunks[n++])}:{done:true}})}}));
 f.setResult(()=>({attemptToken:'synthetic-attempt-A',writing:{submitted:true,grading:{ready:true}}}));
 await f.call('startWritingGradingStream');assert.equal(f.polls.length,1,'Phải nhận ready ở cả ranh giới CRLF bị chia giữa hai khối TCP');assert.equal(f.renders.length,1);assert.equal(f.timers.size,0);
});
test('Term1 EOF/ngắt mạng: polling giữ nguyên, stream hẹn nối lại một lần',async()=>{
 const f=fixture();f.setTransport(async()=>({ok:true,status:200,body:{getReader:()=>({read:async()=>({done:true})})}}));
 await f.call('scheduleWritingGradingRefresh');assert.deepEqual(f.delays().sort((a,b)=>a-b),[1000,8000]);assert.equal(f.renders.length,0);
});

test('Term1 polling không vượt lịch nối lại stream503, vẫn đọc kết quả và dừng khi ready',async()=>{
 const f=fixture();await f.call('startWritingGradingStream');
 assert.equal(f.streams.length,1);assert.deepEqual(f.delays(),[1000]);
 await f.call('scheduleWritingGradingRefresh');
 assert.equal(f.streams.length,1,'Polling không được mở stream khi backoff đang chờ');
 assert.deepEqual(f.delays().sort((a,b)=>a-b),[1000,8000]);
 await f.fire(8000);
 assert.equal(f.polls.length,1,'Polling vẫn phải kiểm tra kết quả trong thời gian stream chờ');
 assert.equal(f.streams.length,1,'Kết quả pending không được nối lại stream sớm');
 assert.deepEqual(f.delays().sort((a,b)=>a-b),[1000,10000]);
 await f.fire(1000);assert.equal(f.streams.length,2);
 assert.deepEqual(f.delays().sort((a,b)=>a-b),[2000,10000]);
 f.setResult(()=>({attemptToken:'synthetic-attempt-A',writing:{submitted:true,grading:{ready:true,status:'ready'}}}));
 await f.fire(10000);assert.equal(f.renders.length,2);assert.equal(f.timers.size,0);
});
