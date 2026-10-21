// Kiểm gợi ý đi từ bộ soạn tới phiếu, không biến thành đáp án chấm điểm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {hintMarkup,sourceDraft,toDefinition} from './editor-bridge.mjs';
const form=answer=>({title:'Phiếu thử',sections:[],questions:[{id:'open',type:'open',skill:'writing',purpose:'practice',prompt:'Kế hoạch luyện tập?',answer}]});
test('Gợi ý giữ nguyên dòng và ký tự khi sao chép, xuất bản; câu mở không có điểm',()=>{
 const hint='Nêu việc luyện.\nTự kiểm <kế hoạch> & số buổi.';
 const {definition,keys}=toDefinition(form(hint));
 const item=definition.blocks[0].items[0];
 assert.equal(item.interactionConfig.hintText,hint);
 assert.equal(item.graderType,'none');assert.equal(item.maxScore,0);assert.deepEqual(keys,{});
 const copy=sourceDraft({title:'Phiếu thử',definition,answerKey:keys});
 assert.equal(copy.questions[0].answer,hint);
 assert.equal(toDefinition(copy).definition.blocks[0].items[0].interactionConfig.hintText,hint);
 copy.questions[0].answer='  ';
 assert.equal('hintText' in toDefinition(copy).definition.blocks[0].items[0].interactionConfig,false);
});
test('Không có nút cho gợi ý trống; nội dung HTML chỉ hiện như chữ và mặc định thu gọn',()=>{
 assert.equal(hintMarkup(undefined),'');assert.equal(hintMarkup(' \n '),'');
 const html=hintMarkup('<img src=x onerror=alert(1)>\nDòng 2');
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('\nDòng 2'));
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<details open'));
 assert.ok(html.includes('<summary>Xem gợi ý</summary>'));
});
test('Câu chấm điểm không mang theo gợi ý cũ khi đổi loại',()=>{
 const draft=form('Cũ');const q=draft.questions[0];
 q.original={interactionConfig:{hintText:'Gợi ý cũ'}};
 Object.assign(q,{type:'gap',skill:'reading',answer:'colour\ncolor'});
 const {definition,keys}=toDefinition(draft);
 assert.equal('hintText' in definition.blocks[0].items[0].interactionConfig,false);
 assert.equal(keys.open.expectedText,'colour\ncolor');
 assert.equal(definition.answerReleasePolicy,'hidden');
});
