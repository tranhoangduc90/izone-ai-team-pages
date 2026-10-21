// Kiểm số tự báo giữ trống khác 0, giới hạn tổng và không cộng vào câu tự chấm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreInputError,scoreMarkup,setScoreValidity,toDefinition} from './editor-bridge.mjs';
import {grade,practiceReport} from './model.mjs';
test('Cho phép trống và số nguyên trong khoảng; số âm, lẻ, vượt tổng có thông báo',()=>{
 for(const value of ['',null,'0','16','20'])assert.equal(scoreInputError(value,20),'');
 for(const value of ['-1','1.5','21','NaN','abc'])assert.equal(scoreInputError(value,20),'Nhập số nguyên từ 0 đến 20, hoặc để trống.');
 assert.equal(scoreInputError('40',40),'');assert.ok(scoreInputError('41',40));
});
test('Cùng ô số có min/max/step và mẫu số; 0 giữ nguyên, trống không tự điền',()=>{
 const empty=scoreMarkup(20,{previewId:'q'}),zero=scoreMarkup(20,{itemId:'q',value:{correct:0,total:20}});
 assert.ok(empty.includes('type="number"'));assert.ok(empty.includes('min="0" max="20" step="1"'));assert.ok(empty.includes('value=""'));assert.ok(empty.includes('/ 20 câu'));assert.ok(empty.includes('data-preview-score'));
 assert.ok(zero.includes('value="0"'));assert.ok(zero.includes('id="item-q"'));assert.ok(zero.includes('data-item="q"'));
 assert.ok(!scoreMarkup(0).includes('<input'));assert.ok(!scoreMarkup(101).includes('<input'));
});
test('Báo/xóa lỗi đúng ở input; số tự báo không chấm điểm và trống không thành tỷ lệ 0%',()=>{
 const input={value:'',validity:{badInput:true},attrs:{},setAttribute(k,v){this.attrs[k]=v},setCustomValidity(v){this.message=v}},error={};
 setScoreValidity(input,20,error);assert.equal(input.attrs['aria-invalid'],'true');assert.equal(error.hidden,false);
 input.validity.badInput=false;input.value='0';setScoreValidity(input,20,error);assert.equal(input.attrs['aria-invalid'],'false');assert.equal(error.hidden,true);assert.equal(input.message,'');
 const {definition,keys}=toDefinition({title:'Phiếu giả',sections:[],questions:[{id:'score',type:'score',skill:'listening',purpose:'practice',prompt:'Đúng bao nhiêu câu?',total:20}]});
 assert.deepEqual(keys,{});assert.equal(definition.blocks[0].items[0].evidenceSource,'student_self_report');assert.equal(grade(definition,{score:{correct:16,total:20}},keys)[0].maxScore,0);
 const report=value=>practiceReport(definition,{submissionId:'checkpoint',responses:{score:value}},'listening');
 assert.equal(report({correct:16,total:20}).percent,80);assert.equal(report({correct:0,total:20}).percent,0);assert.equal(report(''),null);
});
