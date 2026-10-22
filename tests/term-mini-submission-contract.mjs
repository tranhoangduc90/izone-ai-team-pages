// Bảo vệ người/lượt và snapshot qua lỗi nộp; test module thật, dữ liệu/kho là giả trong bộ nhớ.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSubmission,submitSection} from '../term-tests/shared/section-submission.mjs';
const token='33333333-3333-4333-8333-333333333333',session='22222222-2222-4222-8222-222222222222',id='44444444-4444-4444-8444-444444444444';
const input=()=>({section:'listening',testSlug:'term-test-1',body:{examSessionToken:session,clientSubmissionId:id,answers:{1:'A'},generation:0}});
const response=()=>({ok:true,attemptToken:token,completed:false,listeningSubmitted:true});
function receipt(i=input()) {return{ok:true,persisted:true,receipt:{version:1,section:i.section,testSlug:i.testSlug,generation:0,examSessionToken:session,attemptToken:token,clientSubmissionId:id,submittedAt:'2026-10-23T01:00:00Z',answers:{...i.body.answers}},response:response()};}
for(const data of [{},null,{ok:false},response&&{ok:true,completed:false},{...response(),attemptToken:'wrong'},{...response(),listeningSubmitted:false}])test('Không coi gói thiếu xác nhận là đã lưu: '+JSON.stringify(data),()=>assert.throws(()=>validateSubmission(data,input())));
test('Điểm/bài trắng không phải điều kiện được nộp; legacy hợp lệ vẫn nhận',()=>{assert.equal(validateSubmission(response(),{...input(),body:{...input().body,answers:{}}}).attemptToken,token);});
test('Reading trước phải xác nhận chính Reading; token của lượt khác bị từ chối',()=>{
 const i={section:'reading',testSlug:'term-test-1',body:{attemptToken:token}};
 assert.throws(()=>validateSubmission({...response(),examMode:'read_first'},i));
 assert.equal(validateSubmission({...response(),examMode:'read_first',readingSubmitted:true},i).attemptToken,token);
 assert.throws(()=>validateSubmission({...response(),completed:true}, {...i,body:{attemptToken:session}}));
});
function harness(overrides={}){const state={},i=input();let writes=0,reads=0,owner='owner';return{state,get writes(){return writes;},get reads(){return reads;},change(){owner='new';},run:extra=>submitSection({...i,state,owner,getOwner:()=>owner,save(){},send:async()=>{writes++;return response();},read:async()=>{reads++;return{ok:true,persisted:false};},...overrides,...extra})};}
test('Commit rồi mất phản hồi: đọc lại đúng bài, một yêu cầu ghi',async()=>{
 const h=harness({send:async()=>{throw new TypeError('lost response');},read:async()=>receipt()});
 assert.equal((await h.run()).attemptToken,token);assert.deepEqual(h.state.pendingSubmissions,{});
});
test('Phản hồi rỗng và đọc cũng lỗi: giữ snapshot qua reload, retry không gửi bài vừa sửa',async()=>{
 const h=harness({send:async()=>({}),read:async()=>{throw Error('offline');}});
 await assert.rejects(h.run());const restored=JSON.parse(JSON.stringify(h.state));let writes=0;
 const out=await submitSection({...input(),body:{...input().body,answers:{1:'B'}},state:restored,owner:'owner',getOwner:()=>'owner',save(){},send:async b=>{writes++;assert.equal(b.answers[1],'A');return response();},read:async()=>({ok:true,persisted:false})});
 assert.equal(out.attemptToken,token);assert.equal(writes,1);
});
test('Retry đọc thấy đã lưu: không gửi lại/chấm lại',async()=>{const h=harness({send:async()=>({}),read:async()=>{throw Error('offline');}});await assert.rejects(h.run());assert.equal((await h.run({read:async()=>receipt(),send:async()=>assert.fail('must not write')})).attemptToken,token);});
test('Không nhận biên nhận khác snapshot hoặc generation',async()=>{
 for(const mutation of [r=>r.receipt.answers[1]='B',r=>r.receipt.generation=1,r=>r.receipt.examSessionToken=token,r=>r.receipt.testSlug='term-test-2']){
  const r=receipt();mutation(r);const h=harness({send:async()=>({}),read:async()=>r});await assert.rejects(h.run());assert.ok(h.state.pendingSubmissions.listening);
 }
});
test('Đổi người lúc response đang về: không áp kết quả cho người mới',async()=>{let finish;const h=harness({send:()=>new Promise(r=>finish=r)});const p=h.run();await Promise.resolve();h.change();finish(response());await assert.rejects(p,/Chưa nhận/);});
test('HTTP lỗi và đã đọc chắc chưa lưu: cho sửa tiếp theo deadline',async()=>{const h=harness({send:async()=>{throw Object.assign(Error('HTTP502'),{status:502});}});await assert.rejects(h.run(),/HTTP502/);assert.equal(h.state.pendingSubmissions.listening,undefined);});
