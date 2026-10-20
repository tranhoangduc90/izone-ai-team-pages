// Ca giả chỉ để kiểm tính đúng của bộ soạn và bộ nhớ; không phải dữ liệu IC2305.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDraft,toDefinition} from './editor-bridge.mjs';
import {createDemoStore} from './demo-store.mjs';
import {grade,personJourney,publishedSourceFeedback} from './model.mjs';
const item=(id,extra={})=>({itemVersionId:id,prompt:id,interactionType:'single_choice',skillCodes:['writing'],graderType:'exact_option',maxScore:1,options:[{id:'A',label:'Lựa chọn thử A'},{id:'B',label:'Lựa chọn thử B'}],interactionConfig:{},...extra});
const definition={blocks:[{blockId:'block',title:'Phần thử',items:[item('q1'),item('q2',{interactionType:'short_text',maxScore:0,graderType:'none',options:[],interactionConfig:{visibleWhenItemVersionId:'q1',visibleWhenValue:'B'}})]}]};
const session={number:10,title:'Phiếu kiểm thử',definition,answerKey:{q1:{graderType:'exact_option',expectedOptionId:'A'}},students:[],releases:[{blockId:'block',status:'open'}],generation:0,replacement:null,retired:[],analytics:[]};
const pack=()=>({format:'thuy-review-data-v1',data:{capturedAt:'2026-01-01T00:00:00Z',className:'Lớp kiểm thử',sessions:[structuredClone(session)],people:[],courseSessions:[]},keys:{10:session.answerKey}});
test('Nhận xét ẩn hiện hành không bị bản legacy làm xuất hiện trở lại',()=>{
  assert.equal(publishedSourceFeedback({sessionComment:{visibility:'visible',noteText:'Bản hiện hành'},teacherSessionFeedback:{noteText:'Bản cũ'}}),'Bản hiện hành');
  assert.equal(publishedSourceFeedback({sessionComment:{visibility:'hidden',noteText:'Bản đã ẩn'},teacherSessionFeedback:{noteText:'Bản cũ'}}),'');
});
test('Bản riêng tạo mã câu mới và remap điều kiện đúng câu điều khiển',()=>{
  const draft=sourceDraft(session),output=toDefinition(draft),items=output.definition.blocks[0].items;
  assert.notEqual(items[0].itemVersionId,'q1');
  assert.equal(items[1].interactionConfig.visibleWhenItemVersionId,items[0].itemVersionId);
  assert.equal(output.keys[items[0].itemVersionId].expectedOptionId,'A');
  assert.equal(items[0].skillCodes[0],'writing');
  assert.equal(definition.blocks[0].items[1].interactionConfig.visibleWhenItemVersionId,'q1');
});
test('Sao chép giữ trọng số và trường tùy chọn của câu gốc',()=>{
  const original=structuredClone(session);original.definition.blocks[0].items[0].maxScore=2;original.definition.blocks[0].items[0].required=false;
  const item=toDefinition(sourceDraft(original)).definition.blocks[0].items[0];assert.equal(item.maxScore,2);assert.equal(item.required,false);
});
test('Bỏ câu điều khiển thì chặn xuất bản và giữ bản gốc',()=>{
  const draft=sourceDraft(session);draft.questions.shift();
  assert.throws(()=>toDefinition(draft),/điều kiện/);
});
test('Không tự đoán đáp án cho câu có chấm được nhập mới',()=>{
  const form={title:'Ca kiểm thử',sections:[],questions:[{id:'q',type:'mcq',purpose:'practice',skill:'listening',prompt:'Câu thử',options:['A','B'],answers:[]}]};
  assert.throws(()=>toDefinition(form),/chưa có đáp án/);
});
test('Bỏ lựa chọn điều khiển không được làm câu phụ biến mất âm thầm',()=>{
  const draft=sourceDraft(session);draft.questions[0].options.splice(1,1);draft.questions[0].optionIds.splice(1,1);
  assert.throws(()=>toDefinition(draft),/Phương án điều khiển/);
});
test('Chấm nhiều lựa chọn, điền từ và nối cặp; trống nhận 0 giữ mẫu số',()=>{
  const items=[item('m',{interactionType:'multiple_choice'}),item('g',{interactionType:'short_text'}),item('p',{interactionType:'matching'})];
  const keys={m:{graderType:'exact_options',expectedOptions:['A','B']},g:{graderType:'exact_text',expectedText:'A word\nTừ đúng'},p:{graderType:'exact_matching',pairs:[{},{}]}};
  const ok=grade({blocks:[{items}]},{m:['B','A'],g:'  TỪ   ĐÚNG  ',p:{0:'0',1:'1'}},keys);
  assert.deepEqual(ok.map(v=>v.scoreEarned),[1,1,1]);
  assert.deepEqual(grade({blocks:[{items}]},{},keys).map(v=>[v.scoreEarned,v.maxScore]),[[0,1],[0,1],[0,1]]);
});
test('Nộp phần đầu, nháp đúng người, công bố riêng và kế thừa qua tab mới',()=>{
  const store=createDemoStore(pack());
  store.mutate({action:'draft',number:10,generation:0,ref:'demo-a',responses:{q1:'B'}});
  assert.equal(store.student(10,'demo-a').participated,false);
  store.mutate({action:'checkpoint',number:10,generation:0,ref:'demo-a',blockId:'block',responses:{}});
  store.mutate({action:'feedbackPublish',number:10,generation:0,ref:'demo-a',text:'Nhận xét kiểm thử'});
  store.mutate({action:'feedbackDraft',number:10,generation:0,ref:'demo-a',text:'Đang sửa'});
  const next=createDemoStore(store.exportPackage());
  assert.equal(next.student(10,'demo-a').participated,true);
  assert.equal(next.student(10,'demo-a').publishedFeedback,'Nhận xét kiểm thử');
  assert.equal(next.student(10,'demo-b').responses.q1,undefined);
  assert.doesNotMatch(JSON.stringify(next.student(10,'demo-a')),/Đang sửa|expectedOptionId/);
});
test('Giao phiếu tự soạn giữ lịch sử và loại bài cũ khỏi kết quả hiện hành',()=>{
  const store=createDemoStore(pack());
  store.mutate({action:'draft',number:10,generation:0,ref:'demo-a',responses:{q1:'A'}});
  store.mutate({action:'replace',number:10,generation:0,title:'Bài mới kiểm thử',definition:{blocks:[{blockId:'new',title:'Mới',items:[item('new-item')]}]},keys:{'new-item':{graderType:'exact_option',expectedOptionId:'B'}}});
  assert.equal(store.teacher().sessions[0].retired[0].fake[0][1].responses.q1,'A');
  assert.deepEqual(store.student(10,'demo-a').responses,{});
  assert.throws(()=>store.student(10,'demo-a',0),/thu hồi/);
  assert.equal(store.student(10,'demo-a').retired,undefined);
  const nextTab=createDemoStore(store.exportPackage());nextTab.mutate({action:'reset'});
  assert.equal(nextTab.teacher().sessions[0].generation,0);assert.equal(nextTab.teacher().sessions[0].title,'Phiếu kiểm thử');
});
test('TB cả khóa dùng cả lịch sử, lấy ba buổi mới nhất cho nhãn riêng',()=>{
  const s=(number,percent)=>({number,date:'2026-01-01',students:[{studentRef:'test',reports:{listening:{percent}}}]});
  const result=personJourney({sessions:[s(10,80)],courseSessions:[s(8,70),s(6,65),s(3,10)]},'test','listening');
  assert.equal(result.average,56.25);assert.equal(result.recentAverage,215/3);assert.equal(result.flagged,false);
});
