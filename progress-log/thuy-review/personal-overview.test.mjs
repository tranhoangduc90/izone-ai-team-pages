// Kiểm tổng hợp Speaking không lẫn người, nháp hoặc nhận xét chưa công bố.
import test from 'node:test';
import assert from 'node:assert/strict';
import {speakingSummary} from './model.mjs';
const question={itemVersionId:'q',skillCodes:['speaking'],graderType:'none',options:[{id:'a',label:'Khó mở rộng ý'},{id:'b',label:'Thiếu từ vựng'}],interactionConfig:{}};
const session=(number,value,extra={})=>({number,date:'2026-01-01',definition:{blocks:[{items:[question]}]},students:[{studentRef:'one',submitted:true,detail:{responses:{q:value}},...extra},{studentRef:'other',submitted:true,detail:{responses:{q:'b'}}}]});
test('Đếm đúng lựa chọn đã nộp của từng người, sắp vấn đề thường gặp trước',()=>{
 const result=speakingSummary([session(10,'a'),session(9,'b'),session(8,'a'),session(6,'b',{submitted:false})],'one');
 assert.deepEqual(result.frequencies,[{label:'Khó mở rộng ý',count:2},{label:'Thiếu từ vựng',count:1}]);
 assert.equal(result.latest,null);
});
test('Không đếm câu điều kiện ẩn, câu chấm điểm hoặc hai bản cùng buổi',()=>{
 const current=session(10,'a'),hidden=session(9,'b'),scored=session(8,'b');
 hidden.definition={blocks:[{items:[{...question,interactionConfig:{visibleWhenItemVersionId:'gate',visibleWhenValue:'yes'}}]}]};
 scored.definition={blocks:[{items:[{...question,graderType:'exact_option'}]}]};
 assert.deepEqual(speakingSummary([current,current,hidden,scored],'one').frequencies,[{label:'Khó mở rộng ý',count:1}]);
});
test('Nhận xét mới nhất có thể ở phiếu chưa nộp; bản nháp không thay bản công bố',()=>{
 const sessions=[session(8,'a',{publishedFeedback:'Nhận xét cũ'}),session(10,null,{submitted:false,publishedFeedback:'Bản nguồn'})];
 const notes={8:{published:'Nhận xét cũ'},10:{published:'Bản đã công bố',draft:'Đang viết dở'}};
 const result=speakingSummary(sessions,'one',s=>notes[s.number].published);
 assert.equal(result.latest.number,10);assert.equal(result.latest.text,'Bản đã công bố');
 assert.doesNotMatch(JSON.stringify(result),/Đang viết dở/);
 const hidden=speakingSummary(sessions,'one',s=>s.number===10?'':'Nhận xét cũ');
 assert.equal(hidden.latest.number,8);
});
test('Giữ nguyên văn nhiều lựa chọn, bỏ giá trị lạ, không sửa dữ liệu nguồn',()=>{
 const sessions=[session(10,['b','a','không tồn tại'])],before=JSON.stringify(sessions);
 assert.equal(speakingSummary(sessions,'one').frequencies.length,2);
 assert.deepEqual(speakingSummary(sessions,'không có'),{frequencies:[],latest:null});
 assert.equal(JSON.stringify(sessions),before);
});
