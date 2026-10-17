import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Chạy autosave thật; API chỉ mô phỏng phản hồi khóa, không tự tạo UI mong đợi.
function fixture(module) {
  const source = readFileSync(`${process.env.K56_READING_DRAFT_SOURCE_ROOT || 'term-tests'}/${module}/app.js`, 'utf8');
  const start = source.search(/  const sectionDraft(?:Flows|Timers) =/);
  const end = source.indexOf('  function setAnswerControlsLocked(', start);
  assert.ok(start >= 0 && end > start);
  const timers = new Map(), notices = [], requests = [];
  let seq = 0, transport = async body => ({accepted:true, revision:body.revision, draft:body.answers});
  const state = {studentRef:'fake-a', attemptToken:'attempt-a', examSessionToken:'session-a',
    completed:false, readingSubmitted:false, readingStartedAt:'2026-10-17T00:00:00Z',
    drafts:{reading:{7:'Nháp chưa được nhận'}, listening:{}},
    draftRevisions:{reading:3,listening:0},draftAckRevisions:{reading:1,listening:0}};
  const node = {querySelectorAll:()=>[]};
  const context = vm.createContext({state, demoMode:false, paperMini:false, paperConfirmed:false, paperEpoch:0,
    testConfig:{slug:'fake-k56'}, elements:{readingQuestions:node,listeningQuestions:node,notice:{scrollIntoView(){}}},
    navigator:{onLine:true}, randomDelay:(min)=>min,
    window:{clearTimeout:id=>timers.delete(id),setTimeout(fn,delay){timers.set(++seq,{fn,delay});return seq;}},
    collectAnswers:()=>({...state.drafts.reading}), saveSession(){}, updateAnswerCount(){},
    showNotice:(message,kind)=>notices.push({message,kind}),
    async apiRequest(path,options){const body=JSON.parse(options.body);requests.push(body);return transport(body);}
  });
  vm.runInContext(source.slice(start,end),context);
  return {state,timers,notices,requests,reply:fn=>transport=fn,run:code=>vm.runInContext(code,context),
    async settle(){for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));},
    async send(){vm.runInContext("scheduleSectionDraft('reading',0)",context);const [id,timer]=timers.entries().next().value;timers.delete(id);timer.fn();await this.settle();}
  };
}

for(const module of ['k56-shared','k56-test2-shared','k56-mini-shared']) {
  test(`${module}: Reading đã khóa phải báo nháp chưa lưu và dừng retry tự động`,async()=>{
    const h=fixture(module);
    h.reply(async()=>{throw Object.assign(new Error('Reading đã nộp.'),{code:'READING_LOCKED',status:409});});
    await h.send();
    assert.equal(h.state.draftAckRevisions.reading,1,'Không giả xác nhận lưu');
    assert.equal(h.state.drafts.reading[7],'Nháp chưa được nhận','Giữ bản trên máy');
    assert.ok(h.notices.some(x=>x.kind==='error' && /chưa.*lưu/i.test(x.message)), 'Học viên phải thấy nháp chưa được lưu');
    assert.equal(h.timers.size,0,'Không lặp vô hạn với trạng thái khóa');
    assert.equal(h.state.readingSubmitted,false,'Không tự suy khóa là đã nộp');
  });
  test(`${module}: lỗi khóa đến muộn của owner cũ không cảnh báo owner mới`,async()=>{
    const h=fixture(module);let reject;
    h.reply(()=>new Promise((_,r)=>{reject=r;}));await h.send();
    h.state.studentRef='fake-b';h.state.attemptToken='attempt-b';
    h.state.drafts.reading={7:'Bản của B'};h.state.draftRevisions.reading=4;h.state.draftAckRevisions.reading=0;
    h.run('paperEpoch += 1');
    reject(Object.assign(new Error('Reading đã nộp.'),{code:'READING_LOCKED',status:409}));await h.settle();
    assert.equal(h.notices.length,0);assert.equal(h.state.drafts.reading[7],'Bản của B');
    assert.equal(h.state.draftAckRevisions.reading,0);
  });
  test(`${module}: Reading còn mở vẫn xác nhận lưu bình thường`,async()=>{
    const h=fixture(module);await h.send();
    assert.equal(h.state.draftAckRevisions.reading,3);assert.equal(h.notices.length,0);assert.equal(h.timers.size,0);
  });
  test(`${module}: draft409 đến sau submit200 không ghi đè thông báo thành công`,async()=>{
    const h=fixture(module);let reject;
    h.reply(()=>new Promise((_,r)=>{reject=r;}));await h.send();
    h.state.readingSubmitted=true;
    reject(Object.assign(new Error('Reading đã nộp.'),{code:'READING_LOCKED',status:409}));await h.settle();
    assert.equal(h.notices.length,0,'Bài đã được xác nhận nộp không bị cảnh báo chưa lưu');
    assert.equal(h.timers.size,0);assert.equal(h.state.draftAckRevisions.reading,1);
  });
}
