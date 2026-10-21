// Dữ liệu tối thiểu để kiểm cách gom nhóm và mẫu số, không dùng hồ sơ học viên thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {speakingAnalytics,speakingGroup,speakingSummary} from './model.mjs';
const item=(label,extra={})=>({itemVersionId:'q',skillCodes:['speaking'],graderType:'none',options:[{id:'x',label}],interactionConfig:{},...extra});
const session=(number,label,extra={})=>({number,definition:{blocks:[{items:[item(label)]}]},students:[{studentRef:'one',submitted:true,detail:{responses:{q:'x'}},...extra}]});
test('Gom dấu chấm, khoảng trắng và các cách viết đã biết nhưng giữ câu chữ nguồn',()=>{
 const sessions=[session(10,'Khó phát triển ý và nói đủ dài.'),session(9,'Em thiếu ý hoặc chưa biết cách phát triển câu trả lời.'),session(8,' KHÓ PHÁT TRIỂN Ý VÀ NÓI ĐỦ DÀI  ')];
 const before=JSON.stringify(sessions),result=speakingAnalytics(sessions);
 assert.equal(result.groups.length,1);assert.equal(result.groups[0].label,'Khó mở rộng ý');assert.equal(result.groups[0].count,3);
 assert.equal(result.groups[0].originals.length,3);assert.equal(result.contributors,1);assert.equal(result.forms,3);
 assert.equal(JSON.stringify(sessions),before);
 assert.deepEqual(speakingSummary(sessions,'one').frequencies,[{label:'Khó mở rộng ý',count:3}]);
});
test('Không biến chưa nhận thấy vấn đề thành tự tin, không ép nhãn mới vào nhóm khác',()=>{
 assert.notEqual(speakingGroup('Em chưa nhận thấy vấn đề lớn.').id,speakingGroup('Diễn đạt tự tin hơn').id);
 const result=speakingAnalytics([session(10,'Em chưa nhận thấy vấn đề lớn.'),session(9,'Diễn đạt tự tin hơn'),session(8,'Khó kiểm soát tốc độ')]);
 assert.equal(result.groups.length,3);assert.equal(result.groups.find(g=>g.unmapped).label,'Khó kiểm soát tốc độ');
});
test('Mẫu số chỉ gồm đúng người và phiếu đã nộp có lựa chọn hợp lệ',()=>{
 const submitted=session(10,'Thiếu từ vựng để diễn đạt ý'),draft=session(9,'Thiếu từ vựng',{submitted:false}),blank=session(8,'Thiếu từ vựng',{detail:{responses:{}}}),other=session(6,'Thiếu từ vựng',{studentRef:'other'});
 const result=speakingAnalytics([submitted,draft,blank,other],['one']);
 assert.equal(result.contributors,1);assert.equal(result.forms,1);assert.equal(result.selections,1);
 assert.deepEqual(speakingAnalytics([submitted],[]),{groups:[],contributors:0,forms:0,selections:0});
});
test('Không đếm trùng bản buổi; nhiều cách viết cùng nhóm trong một phiếu chỉ tính một lần',()=>{
 const s=session(10,'Khó phát triển ý và nói đủ dài');
 s.definition.blocks[0].items.push({...item('Em thiếu ý hoặc chưa biết cách phát triển câu trả lời'),itemVersionId:'q2'});s.students[0].detail.responses.q2='x';
 const result=speakingAnalytics([s,s]);assert.equal(result.forms,1);assert.equal(result.groups[0].count,1);assert.equal(result.groups[0].originals.length,2);
});
test('Nhiều nhóm trong một phiếu không làm tăng số phiếu, bỏ câu ẩn và câu chấm điểm',()=>{
 const s=session(10,'Khó phát triển ý và nói đủ dài');
 s.definition.blocks[0].items.push({...item('Thiếu từ vựng'),itemVersionId:'q2'},{...item('Cần luyện phát âm',{graderType:'exact_option'}),itemVersionId:'q3'},{...item('Còn ngập ngừng',{interactionConfig:{visibleWhenItemVersionId:'gate',visibleWhenValue:'yes'}}),itemVersionId:'q4'});
 Object.assign(s.students[0].detail.responses,{q2:'x',q3:'x',q4:'x'});
 const result=speakingAnalytics([s]);assert.equal(result.forms,1);assert.equal(result.contributors,1);assert.equal(result.selections,2);assert.equal(result.groups.length,2);
});
