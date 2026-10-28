import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {insertBlank,removeBlank} from '../progress-log/authoring-parts.js';
import {changeQuestionKind} from '../progress-log/authoring-answers.js';
import {newEditorItem} from '../progress-log/teacher-form-editor.js';
test('T15: bỏ ô phục hồi chữ gốc sau khi sửa đáp án, không đổi từ trùng ở chỗ khác',()=>{
 const item={itemVersionId:randomUUID(),prompt:'moment and moment',interactionConfig:{},layoutType:'plain_prompt'},key={items:{}};
 insertBlank(item,key,{start:11,end:17,kind:'exercise'});key.items[item.itemVersionId].acceptedBySlot[0]=['instant'];
 removeBlank(item,key,{lineIndex:0,partIndex:0,kind:'exercise'});assert.equal(item.prompt,'moment and moment');
});
test('T15: sửa phương án khi Khảo sát không phục hồi khóa Bài tập cũ; câu bên cạnh bất biến',()=>{
 const item=newEditorItem('mcq'),other=newEditorItem('mcq'),key={items:{[item.itemVersionId]:{graderType:'exact_option',expectedOptionId:'A'}}},before=structuredClone(other);
 changeQuestionKind(item,key,'survey','mcq');item.options[0].label='Một ý khác';changeQuestionKind(item,key,'exercise','mcq');
 assert.equal(key.items[item.itemVersionId],undefined);assert.deepEqual(other,before);
});
test('T15: đổi chế độ qua lại rồi thêm ô không giữ tham khảo sai số ô',()=>{
 const item=newEditorItem('short_answer'),key={items:{}};item.prompt='one and two';insertBlank(item,key,{start:0,end:3});
 changeQuestionKind(item,key,'survey','gapfill');changeQuestionKind(item,key,'exercise','gapfill');insertBlank(item,key,{partIndex:1,start:5,end:8});
 assert.equal(item.interactionConfig.responseCount,2);assert.equal(key.referenceAnswersBySlot?.[item.itemVersionId],undefined);assert.deepEqual(key.items[item.itemVersionId].acceptedBySlot,[['one'],['two']]);
});
test('T15: nội dung dài và mười ô trên cùng dòng vẫn nguyên vẹn, vùng chọn quá dài không đổi dữ liệu',()=>{
 const item=newEditorItem('short_answer'),key={items:{}};item.prompt='a'.repeat(600)+' word '+'b'.repeat(600);const original=item.prompt;
 insertBlank(item,key,{start:601,end:605});removeBlank(item,key,{lineIndex:0,partIndex:0});assert.equal(item.prompt,original);
 const before=JSON.stringify({item,key});assert.throws(()=>insertBlank(item,key,{start:0,end:301}),/300 ký tự/);assert.equal(JSON.stringify({item,key}),before);
 item.prompt=Array.from({length:10},(_,i)=>'w'+i).join(' ');for(let i=0;i<10;i++)insertBlank(item,key,{partIndex:i,start:i===0?0:1,end:i===0?2:3});assert.equal(item.interactionConfig.responseCount,10);assert.equal(item.interactionConfig.sentenceLines[0].parts.length,11);
});
