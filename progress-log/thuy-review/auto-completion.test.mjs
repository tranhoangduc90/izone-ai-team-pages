// Kiểm vòng đời phiếu giả: nhận từng phần, tự hoàn tất và giữ bài khi thử lại.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoStore} from './demo-store.mjs';
const definition={blocks:[
  {blockId:'review',title:'Ôn tập',items:[{itemVersionId:'quiz',interactionType:'single_choice',options:[{id:'A',label:'A'},{id:'B',label:'B'}],graderType:'exact_option',maxScore:1,required:true,interactionConfig:{}},{itemVersionId:'conditional',interactionType:'short_text',graderType:'exact_text',maxScore:1,interactionConfig:{visibleWhenItemVersionId:'quiz',visibleWhenValue:'B'}}]},
  {blockId:'reflection',title:'Bài mới',items:[{itemVersionId:'writing',interactionType:'long_text',graderType:'none',maxScore:0,required:true,interactionConfig:{}}]}
]};
const pack=()=>({format:'thuy-review-data-v1',keys:{},data:{className:'IC2305',sessions:[{number:10,date:'2026-01-01',generation:0,title:'Phiếu thử',definition:structuredClone(definition),answerKey:{quiz:{graderType:'exact_option',expectedOptionId:'A'},conditional:{graderType:'exact_text',expectedText:'Có'}},students:[],retired:[],releases:definition.blocks.map(b=>({blockId:b.blockId,status:'open'}))}]}});
const act=(store,body)=>store.mutate({number:10,generation:0,ref:'demo-a',...body});
test('Nộp phần bất kỳ ghi nhận tham gia; đủ phần tự hoàn tất dù còn trống',()=>{
  const store=createDemoStore(pack());
  act(store,{action:'draft',responses:{writing:'Nháp'}});
  assert.equal(store.student(10,'demo-a').participated,false);
  act(store,{action:'checkpoint',blockId:'reflection',responses:{writing:''}});
  let state=store.student(10,'demo-a');
  assert.equal(state.participated,true);assert.equal(state.submitted,false);
  act(store,{action:'checkpoint',blockId:'review',responses:{}});
  state=store.student(10,'demo-a');
  assert.equal(state.submitted,true);assert.equal(state.completeness,'partial');assert.equal(state.checkpoints.length,2);
  act(store,{action:'showAnswers',open:true});
  const graded=store.student(10,'demo-a').gradingItems;
  assert.equal(graded.find(g=>g.itemVersionId==='quiz').scoreEarned,0);
  assert.equal(graded.some(g=>g.itemVersionId==='conditional'),false);
});
test('Phiếu đủ câu tự hoàn tất; gửi lại không sửa câu đã khóa hoặc nhân checkpoint',()=>{
  const store=createDemoStore(pack());
  act(store,{action:'checkpoint',blockId:'review',responses:{quiz:'A'}});
  act(store,{action:'checkpoint',blockId:'reflection',responses:{quiz:'B',writing:'Hai buổi luyện tập.'}});
  const before=store.student(10,'demo-a');assert.equal(before.submitted,true);assert.equal(before.completeness,'complete');
  act(store,{action:'checkpoint',blockId:'reflection',responses:{writing:'Không ghi đè'}});
  act(store,{action:'final',responses:{quiz:'B'}});
  assert.deepEqual(store.student(10,'demo-a'),before);
  assert.equal(store.student(10,'demo-b').participated,false);
  assert.throws(()=>act(store,{action:'draft',responses:{writing:'Khác'}}),/chỉ được xem lại/);
});
test('Lỗi nhận phần cuối giữ nguyên phần trước và tham gia; thử lại hoàn tất một lần',()=>{
  const store=createDemoStore(pack());
  act(store,{action:'checkpoint',blockId:'review',responses:{quiz:'A'}});
  const before=store.student(10,'demo-a');
  assert.throws(()=>act(store,{action:'checkpoint',blockId:'reflection',responses:{writing:'Nháp còn giữ'},failSave:true}),/Lỗi lưu/);
  assert.deepEqual(store.student(10,'demo-a'),before);
  act(store,{action:'checkpoint',blockId:'reflection',responses:{writing:'Nháp còn giữ'}});
  const after=store.student(10,'demo-a');assert.equal(after.submitted,true);assert.equal(after.responses.writing,'Nháp còn giữ');assert.equal(after.checkpoints.length,2);
});
test('Không chốt sớm; phiếu cũ đủ checkpoint được hoàn tất tương thích và thử lại an toàn',()=>{
  const store=createDemoStore(pack());
  assert.throws(()=>act(store,{action:'final',responses:{}}),/nộp.*phần/i);
  act(store,{action:'checkpoint',blockId:'review',responses:{quiz:'A'}});
  act(store,{action:'checkpoint',blockId:'reflection',responses:{writing:'Bài cũ'}});
  const old=store.exportPackage();old.demoState.fake[0][1].submitted=false;delete old.demoState.fake[0][1].completeness;
  const restored=createDemoStore(old),before=restored.student(10,'demo-a');
  assert.equal(before.submitted,false); // Đọc dữ liệu không tự ghi lại.
  assert.throws(()=>act(restored,{action:'final',failSave:true}),/Lỗi lưu/);
  assert.deepEqual(restored.student(10,'demo-a'),before);
  act(restored,{action:'final'});
  const after=restored.student(10,'demo-a');assert.equal(after.submitted,true);assert.equal(after.responses.writing,'Bài cũ');
  assert.equal(createDemoStore(restored.exportPackage()).student(10,'demo-a').submitted,true);
});
test('Đếm theo đúng mã phần, không coi hai checkpoint trùng là đủ phiếu',()=>{
  const store=createDemoStore(pack());act(store,{action:'checkpoint',blockId:'review',responses:{quiz:'A'}});
  const old=store.exportPackage();old.demoState.fake[0][1].checkpoints.push({...old.demoState.fake[0][1].checkpoints[0]});
  const restored=createDemoStore(old);assert.throws(()=>act(restored,{action:'final'}),/nộp.*phần/i);assert.equal(restored.student(10,'demo-a').submitted,false);
});
test('Phần còn đóng chưa được nộp và không làm phiếu hoàn tất sớm',()=>{
  const input=pack();input.data.sessions[0].releases[1].status='closed';const store=createDemoStore(input);
  act(store,{action:'checkpoint',blockId:'review',responses:{quiz:'A'}});
  assert.throws(()=>act(store,{action:'checkpoint',blockId:'reflection',responses:{}}),/đang đóng/);
  assert.equal(store.student(10,'demo-a').submitted,false);assert.equal(store.student(10,'demo-a').participated,true);
});
test('Phiếu một phần trống cũng tự hoàn tất; không cần nộp thêm lần cuối',()=>{
  const input=pack();input.data.sessions[0].definition.blocks.pop();input.data.sessions[0].releases.pop();const store=createDemoStore(input);
  act(store,{action:'checkpoint',blockId:'review',responses:{}});
  const state=store.student(10,'demo-a');assert.equal(state.submitted,true);assert.equal(state.participated,true);assert.equal(state.completeness,'partial');
});
