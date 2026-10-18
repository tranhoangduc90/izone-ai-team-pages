import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// G09: chạy transport và autosave thật với đồng hồ ảo; không gọi API/học viên thật.
function fixture(module, random = .3) {
  const source = readFileSync(`${process.env.K56_NETWORK_SOURCE_ROOT || 'term-tests'}/${module}/app.js`, 'utf8');
  const start = source.indexOf('  async function apiRequest(');
  const end = source.indexOf('  function setAnswerControlsLocked(', start);
  assert.ok(start >= 0 && end > start);
  let seq = 0, transport = async body => ({ok:true,status:200,body:{accepted:true,revision:body.revision,draft:body.answers}});
  const timers = new Map(), requests = [];
  const state = {studentRef:'fake-a',attemptToken:'attempt-a',examSessionToken:'session-a',completed:false,
    readingSubmitted:false,readingStartedAt:'2026-10-18T00:00:00Z',drafts:{reading:{7:'Giữ nguyên câu trả lời'}},
    draftRevisions:{reading:3},draftAckRevisions:{reading:1}};
  const setTimer=(fn,delay)=>{timers.set(++seq,{fn,delay});return seq;};
  const clearTimer=id=>timers.delete(id);
  const math=Object.create(Math);math.random=()=>random;
  let now=Date.parse('2026-10-18T05:00:00Z');
  class ClockDate extends Date { static now(){return now;} }
  const context=vm.createContext({state,demoMode:false,paperMini:false,paperConfirmed:true,paperEpoch:0,
    storageKey:'fake-a',appConfig:{API_BASE_URL:'https://fake.invalid'},testConfig:{slug:'fake'},Math:math,Date:ClockDate,
    navigator:{onLine:true},AbortController,setTimeout:setTimer,clearTimeout:clearTimer,
    window:{setTimeout:setTimer,clearTimeout:clearTimer},elements:{readingQuestions:{},notice:{scrollIntoView(){}}},
    collectAnswers:()=>({...state.drafts.reading}),saveSession(){},updateAnswerCount(){},showNotice(){},
    async fetch(url,options){const body=JSON.parse(options.body);requests.push(body);
    const response=await transport(body,options.signal);
      return {...response,headers:{get:name=>name.toLowerCase()==='retry-after'?(response.retryAfter??null):null},json:async()=>response.body};}
  });
  vm.runInContext(source.slice(start,end),context);
  const h={state,timers,requests,run:code=>vm.runInContext(code,context),reply:fn=>transport=fn,
    async settle(){for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));},
    async fire(){assert.ok(timers.size,'Phải có lịch gửi lại');const [id,timer]=[...timers].sort((a,b)=>a[1].delay-b[1].delay)[0];timers.delete(id);now+=timer.delay;timer.fn();await h.settle();},
    async send(){h.run("scheduleSectionDraft('reading',0)");await h.fire();}
  };return h;
}

for(const module of ['k56-shared','k56-test2-shared','k56-mini-shared']) {
  test(`${module}: 429 tự gửi lại sau Retry-After và giữ đáp án/revision`,async()=>{
    const h=fixture(module);let first=true;
    h.reply(async body=>first?(first=false,{ok:false,status:429,retryAfter:'17',body:{error:'RATE_LIMITED'}}):
      {ok:true,status:200,body:{accepted:true,revision:body.revision,draft:body.answers}});
    await h.send();
    assert.equal(h.state.draftAckRevisions.reading,1);
    assert.ok(h.timers.size,'Lỗi tạm thời phải tự thử lại khi học viên ngừng gõ');
    assert.ok(Math.min(...[...h.timers.values()].map(t=>t.delay))>=17000,'Tôn trọng Retry-After');
    for(let i=0;i<4&&h.requests.length<2;i++)await h.fire();
    assert.equal(h.requests.length,2);assert.deepEqual(h.requests[1],h.requests[0]);
    assert.equal(h.state.draftAckRevisions.reading,3);
    assert.equal(h.state.drafts.reading[7],'Giữ nguyên câu trả lời');
  });
  test(`${module}: 12 máy không thử lại cùng một nhịp`,async()=>{
    const delays=[];
    for(let i=0;i<12;i++){
      const h=fixture(module,(i+.5)/12);
      h.reply(async()=>({ok:false,status:503,body:{error:'UNAVAILABLE'}}));await h.send();
      assert.ok(h.timers.size,'Phải tự thử lại');
      delays.push(Math.min(...[...h.timers.values()].map(t=>t.delay)));
    }
    assert.ok(new Set(delays).size>=10,'Độ lệch giữa các máy tránh dồn request');
    assert.ok(delays.every(x=>x>=1000&&x<=30000));
  });
  test(`${module}: 429 cùng Retry-After vẫn có độ lệch giữa 12 máy`,async()=>{
    const delays=[];
    for(let i=0;i<12;i++){
      const h=fixture(module,(i+.5)/12);
      h.reply(async()=>({ok:false,status:429,retryAfter:'17',body:{error:'RATE_LIMITED'}}));await h.send();
      assert.ok(h.timers.size);delays.push(Math.min(...[...h.timers.values()].map(t=>t.delay)));
    }
    assert.ok(delays.every(x=>x>=17000));assert.ok(new Set(delays).size>=10);
  });
  test(`${module}: đổi người sau lỗi đã xử lý không mang theo thời gian chờ`,async()=>{
    const h=fixture(module);h.reply(async()=>({ok:false,status:429,retryAfter:'17',body:{error:'RATE_LIMITED'}}));
    await h.send();h.timers.clear();h.state.studentRef='fake-b';h.state.attemptToken='attempt-b';
    h.state.examSessionToken='session-b';h.state.draftAckRevisions.reading=0;h.run('paperEpoch += 1');
    h.run("scheduleSectionDraft('reading',0)");
    assert.equal(Math.min(...[...h.timers.values()].map(t=>t.delay)),0);
  });
  test(`${module}: ACK đến muộn không sửa nháp/trạng thái người mới`,async()=>{
    const h=fixture(module);let resolve;
    h.reply(()=>new Promise(r=>{resolve=r;}));await h.send();
    h.state.studentRef='fake-b';h.state.attemptToken='attempt-b';h.state.examSessionToken='session-b';
    h.state.drafts.reading={7:'Bản B'};h.state.draftAckRevisions.reading=0;h.run('paperEpoch += 1');
    resolve({ok:true,status:200,body:{accepted:true,revision:3,draft:{7:'Giữ nguyên câu trả lời'},deadlineAt:'OLD'}});
    await h.settle();assert.equal(h.state.draftAckRevisions.reading,0);assert.equal(h.state.readingDeadlineAt,undefined);
    assert.equal(h.state.drafts.reading[7],'Bản B');assert.equal(h.timers.size,0);
  });
  test(`${module}: yêu cầu lưu của người mới đang chờ được đánh thức sau request cũ`,async()=>{
    const h=fixture(module);let resolve;
    h.reply(()=>new Promise(r=>{resolve=r;}));await h.send();
    h.state.studentRef='fake-b';h.state.attemptToken='attempt-b';h.state.examSessionToken='session-b';
    h.state.drafts.reading={7:'Bản B'};h.state.draftRevisions.reading=4;h.state.draftAckRevisions.reading=0;h.run('paperEpoch += 1');
    h.run("scheduleSectionDraft('reading',0)");await h.fire();
    h.reply(async body=>({ok:true,status:200,body:{accepted:true,revision:body.revision,draft:body.answers}}));
    resolve({ok:true,status:200,body:{accepted:true,revision:3,draft:{7:'Giữ nguyên câu trả lời'}}});await h.settle();
    for(let i=0;i<4&&h.requests.length<2;i++)await h.fire();
    assert.equal(h.requests.length,2);assert.equal(h.requests[1].attemptToken,'attempt-b');
    assert.equal(h.requests[1].answers[7],'Bản B');assert.equal(h.state.draftAckRevisions.reading,4);
  });
  test(`${module}: timeout 20 giây giữ nháp rồi tự phục hồi`,async()=>{
    const h=fixture(module);let first=true;
    h.reply((body,signal)=>first?(first=false,new Promise((_,reject)=>signal.addEventListener('abort',()=>
      reject(Object.assign(new Error('timeout'),{name:'AbortError'}))))):
      Promise.resolve({ok:true,status:200,body:{accepted:true,revision:body.revision,draft:body.answers}}));
    await h.send();assert.equal(h.requests.length,1);
    assert.equal([...h.timers.values()][0].delay,20000);await h.fire();
    assert.equal(h.state.draftAckRevisions.reading,1);assert.equal(h.state.drafts.reading[7],'Giữ nguyên câu trả lời');
    for(let i=0;i<4&&h.requests.length<2;i++)await h.fire();
    assert.equal(h.requests.length,2);assert.deepEqual(h.requests[1],h.requests[0]);assert.equal(h.state.draftAckRevisions.reading,3);
  });
  test(`${module}: lỗi đến muộn không tạo retry cho học viên mới`,async()=>{
    const h=fixture(module);let reject;
    h.reply(()=>new Promise((_,r)=>{reject=r;}));await h.send();
    h.state.studentRef='fake-b';h.state.attemptToken='attempt-b';h.state.examSessionToken='session-b';
    h.state.drafts.reading={7:'Bản của B'};h.state.draftAckRevisions.reading=0;h.run('paperEpoch += 1');
    reject(new Error('network'));await h.settle();
    assert.equal(h.timers.size,0,'Không hẹn request bằng lỗi của owner cũ');
    assert.equal(h.state.drafts.reading[7],'Bản của B');assert.equal(h.state.draftAckRevisions.reading,0);
  });
}

test('Term 1: request xếp hàng khi đang gửi không vượt Retry-After trả về sau đó',async()=>{
  const h=fixture('k56-shared');let resolve;
  h.reply(()=>new Promise(r=>{resolve=r;}));await h.send();
  h.state.draftRevisions.reading=4;h.state.drafts.reading={7:'Bản mới hơn'};
  h.run("scheduleSectionDraft('reading',0)");await h.fire();
  resolve({ok:false,status:429,retryAfter:'17',body:{error:'RATE_LIMITED'}});await h.settle();
  assert.equal(h.requests.length,1,'Request đang xếp phải chờ cooldown mới nhận');
  assert.ok(Math.min(...[...h.timers.values()].map(t=>t.delay))>=17000);
});

for(const reason of ['submit','READING_LOCKED'])test(`Term 1: ${reason} hủy cả request còn xếp hàng`,async()=>{
  const h=fixture('k56-shared');let resolve;
  h.reply(()=>new Promise(r=>{resolve=r;}));await h.send();
  h.state.draftRevisions.reading=4;h.run("scheduleSectionDraft('reading',0)");await h.fire();
  if(reason==='submit')h.run("stopSectionDraftFlow('reading')");
  resolve(reason==='submit'?{ok:true,status:200,body:{accepted:true,revision:3,draft:{7:'Giữ nguyên câu trả lời'}}}:
    {ok:false,status:409,body:{error:'READING_LOCKED'}});await h.settle();
  assert.equal(h.requests.length,1);assert.equal(h.timers.size,0);
});

for(const module of ['k56-test2-shared','k56-mini-shared'])test(`${module}: Reading khóa hủy timer của lần gõ trong khi request đang chạy`,async()=>{
  const h=fixture(module);let resolve;
  h.reply(()=>new Promise(r=>{resolve=r;}));await h.send();
  h.state.draftRevisions.reading=4;h.run("scheduleSectionDraft('reading')");
  resolve({ok:false,status:409,body:{error:'READING_LOCKED'}});await h.settle();
  assert.equal(h.timers.size,0);h.run("scheduleSectionDraft('reading')");assert.equal(h.timers.size,0);
  h.state.studentRef='fake-b';h.state.attemptToken='attempt-b';h.state.examSessionToken='session-b';
  h.run('paperEpoch += 1');h.run("scheduleSectionDraft('reading',0)");
  assert.equal(h.timers.size,1,'Owner mới không bị khóa bởi owner trước');
});
