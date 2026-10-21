// Kiểm nội dung giảng viên soạn đi tới đúng phiếu và giữ quyền xem lời giải.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as bridge from './editor-bridge.mjs';
import {createDemoStore} from './demo-store.mjs';
const form=()=>({title:'Phiếu thử nội dung',instructions:'Đọc kỹ.\nCó thể nộp thiếu <câu>.',sections:[{id:'review',title:'Ôn tập'},{id:'new',title:'Bài mới'}],sectionMeta:{review:{instructions:'Chỉ dẫn riêng phần ôn tập.'}},questions:[
 {id:'mcq',type:'mcq',skill:'reading',section:'review',purpose:'practice',prompt:'Chọn B',options:['A','B'],answers:[1],explanation:'B là lựa chọn thử.\nGiữ <nguyên văn> & dấu.'},
 {id:'open',type:'open',skill:'writing',section:'new',prompt:'Kế hoạch?',answer:'Nêu kế hoạch.',explanation:'Không phải lời giải chấm điểm.'}
]});
test('Xuất bản giữ hướng dẫn toàn bài tách khỏi hướng dẫn từng phần',()=>{
 const f=form(),{definition,keys}=bridge.toDefinition(f);
 assert.equal(definition.instructions,f.instructions);
 assert.equal(definition.blocks[0].instructions,f.sectionMeta.review.instructions);
 assert.equal(definition.blocks[1].instructions,'');
 const copy=bridge.sourceDraft({title:f.title,definition,answerKey:keys});
 assert.equal(copy.instructions,f.instructions);
 assert.equal(bridge.toDefinition(copy).definition.instructions,f.instructions);
});
test('Lời giải đi theo mã câu qua sao chép và đổi phần; không đưa vào đề hoặc câu tự nhận xét',()=>{
 const f=form(),{definition,keys}=bridge.toDefinition(f);
 assert.equal(keys.mcq.explanation,f.questions[0].explanation);
 assert.equal(JSON.stringify(definition).includes(f.questions[0].explanation),false);
 assert.equal(keys.open,undefined);
 const copy=bridge.sourceDraft({title:f.title,definition,answerKey:keys});
 const q=copy.questions.find(q=>q.prompt==='Chọn B');
 assert.equal(q.explanation,f.questions[0].explanation);
 q.section='new';copy.questions.reverse();
 assert.equal(bridge.toDefinition(copy).keys[q.id].explanation,f.questions[0].explanation);
 q.explanation='';assert.equal(bridge.toDefinition(copy).keys[q.id].explanation,'');
});
test('Chưa nộp hoặc chưa mở đáp án thì chưa nhận lời giải; mở/ẩn vẫn giữ bài',()=>{
 const {definition,keys}=bridge.toDefinition(form());
 const store=createDemoStore({format:'thuy-review-data-v1',keys:{},data:{sessions:[{number:10,title:'Phiếu thử',generation:0,definition,answerKey:keys,students:[],retired:[],releases:definition.blocks.map(b=>({blockId:b.blockId,status:'open'}))}]}});
 const act=body=>store.mutate({number:10,generation:0,...body});
 act({action:'showAnswers',open:true});assert.deepEqual(store.student(10,'demo-a').answerKey,{});
 act({action:'showAnswers',open:false});act({action:'checkpoint',ref:'demo-a',blockId:'review',responses:{mcq:'B'}});
 assert.deepEqual(store.student(10,'demo-a').answerKey,{});
 act({action:'showAnswers',open:true});const visible=store.student(10,'demo-a');
 assert.equal(visible.answerKey.mcq.explanation,form().questions[0].explanation);
 assert.equal(visible.participated,true);
 act({action:'showAnswers',open:false});const hidden=store.student(10,'demo-a');
 assert.deepEqual(hidden.answerKey,{});assert.equal(hidden.responses.mcq,'B');
});
test('Nội dung rỗng không tạo khối; chữ HTML chỉ hiện như văn bản, giữ xuống dòng',()=>{
 for(const render of [bridge.instructionsMarkup,bridge.explanationMarkup]){
  assert.equal(typeof render,'function');assert.equal(render(' \n '),'');
  const html=render('<img src=x onerror=alert(1)>\nDòng 2 & 3');
  assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('\nDòng 2 &amp; 3'));
 }
});
