import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {insertBlank,removeBlank,PART_TYPES,selectedLimit,missingSkills} from '../progress-log/authoring-parts.js';
test('R25: bôi chọn đúng chuỗi trùng, Unicode; thêm/bỏ ô giữ ID, đáp án và nguyên văn xung quanh',()=>{
  const id=randomUUID(),item={itemVersionId:id,prompt:'Thủy thích đọc và Thủy thích viết.',layoutType:'plain_prompt',interactionType:'short_text',interactionConfig:{},skillCodes:['reading']},key={items:{}};
  const start=item.prompt.lastIndexOf('Thủy');
  const first=insertBlank(item,key,{start,end:start+4});
  assert.deepEqual(item.interactionConfig.sentenceLines[0].parts,['Thủy thích đọc và ',' thích viết.']);
  assert.deepEqual(key.items[id].acceptedBySlot,[['Thủy']]);
  key.items[id].acceptedBySlot[0].push('Thuỷ');
  const second=insertBlank(item,key,{start:0,end:4,lineIndex:0,partIndex:0});
  assert.deepEqual(item.interactionConfig.blankIds,[second,first]);
  assert.deepEqual(key.items[id].acceptedBySlot,[['Thủy'],['Thủy','Thuỷ']]);
  removeBlank(item,key,{lineIndex:0,partIndex:0});
  assert.deepEqual(item.interactionConfig.blankIds,[first]);assert.deepEqual(key.items[id].acceptedBySlot,[['Thủy','Thuỷ']]);
  removeBlank(item,key,{lineIndex:0,partIndex:0});assert.equal(item.prompt,'Thủy thích đọc và Thủy thích viết.');
  assert.equal(item.layoutType,'plain_prompt');assert.equal(key.items[id],undefined);
});
test('R19/R21/R24: danh mục bốn/sáu dạng, Chung chủ động và giới hạn chỉ áp dụng bài tập',()=>{
  assert.equal(PART_TYPES.exercise.length,4);assert.equal(PART_TYPES.survey.length,6);
  const item={position:1,skillCodes:[],layoutType:'multiple_choice_cards',interactionConfig:{}};
  assert.deepEqual(missingSkills({blocks:[{items:[item]}]}),[1]);item.skillCodes=['general'];
  assert.deepEqual(missingSkills({blocks:[{items:[item]}]}),[]);
  selectedLimit(item,{expectedOptionIds:['A','B','C']},'exercise');assert.equal(item.interactionConfig.maxSelections,3);
  selectedLimit(item,null,'survey');assert.equal('maxSelections'in item.interactionConfig,false);
});
