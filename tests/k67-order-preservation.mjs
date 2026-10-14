import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../term-tests/shared/app.js',import.meta.url),'utf8');
const helper=await readFile(new URL('../term-tests/shared/exam-order.js',import.meta.url),'utf8');
const flush=app.slice(app.indexOf('  function flushDraftsOnPageHide()'),app.indexOf('  async function resumeActiveAttemptForSelectedStudent()'));
// Chạy đúng callback đóng trang với fetch giả để đọc hợp đồng keepalive.
// Không phụ thuộc sự kiện mạng của tài liệu đã bị trình duyệt bỏ khi reload.
test('Đóng trang gửi hai nháp RF đúng phiên bản, không đổi hợp đồng Writing hoặc gửi lại phần đã thu',()=>{
  const calls=[],state={examSessionToken:'session',attemptToken:'attempt',listeningSubmitted:false,readingSubmitted:false,completed:false,
    draftRevisions:{listening:4,reading:7},draftAckRevisions:{listening:3,reading:6},drafts:{listening:{11:'A'},reading:{14:'i'}},
    writingDirty:true,writingSubmitted:false,writingConflict:null,writingServerRevision:2};
  const ctx=vm.createContext({window:{},location:{search:'?mode=read_first'},URLSearchParams,document:{body:{classList:{contains:()=>true}}},
    state,miniAnswerSheet:false,appConfig:{API_BASE_URL:'http://localhost'},testConfig:{slug:'term-test-1'},
    fetch:(url,options)=>{calls.push({url,...options,body:JSON.parse(options.body)});return Promise.resolve({});},
    validWritingRevision:()=>true,writingPayload:()=>({action:'draft',revision:2})});
  vm.runInContext(helper,ctx);vm.runInContext(flush+'\nflushDraftsOnPageHide();',ctx);
  assert.equal(calls.length,3);
  for(const call of calls.slice(0,2)){assert.equal(call.keepalive,true);assert.equal(call.body.orderClientVersion,1);assert.equal(call.body.examMode,'read_first');assert.equal(call.body.examDelivery,'cbt');}
  assert.equal(calls[2].body.orderClientVersion,undefined);assert.equal(calls[2].body.action,'draft');
  calls.length=0;state.readingSubmitted=true;state.listeningSubmitted=true;state.writingSubmitted=true;
  vm.runInContext('flushDraftsOnPageHide();',ctx);assert.deepEqual(calls,[]);
});
test('Nháp ACK máy chủ thắng bản máy cũ; bản máy mới hơn giữ revision và không ACK giả',()=>{
  const ctx=vm.createContext({window:{}});vm.runInContext(helper,ctx);
  const state={drafts:{listening:{11:'C'},reading:{14:'i'}},draftRevisions:{listening:8,reading:2},draftAckRevisions:{listening:6,reading:1}};
  const merged=ctx.window.K67_EXAM_ORDER.restoreDrafts(state,{listeningDraft:{11:'A'},listeningDraftRevision:7,readingDraft:{14:'ii'},readingDraftRevision:3});
  assert.equal(merged.drafts.listening[11],'C');assert.equal(merged.draftRevisions.listening,8);assert.equal(merged.draftAckRevisions.listening,7);
  assert.equal(merged.drafts.reading[14],'ii');assert.equal(merged.draftRevisions.reading,3);assert.equal(merged.draftAckRevisions.reading,3);
});
