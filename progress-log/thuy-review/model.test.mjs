// Kiểm quy tắc nghiệp vụ bằng dữ liệu tối thiểu: không dùng tên hoặc bài làm thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {priority,practiceReport,validReport,validateResponses,grade} from './model.mjs';
const definition={blocks:[{blockId:'b',items:[
  {itemVersionId:'choice',interactionType:'single_choice',options:[{id:'A'},{id:'B'}],maxScore:1,skillCodes:['reading']},
  {itemVersionId:'other',interactionType:'short_text',maxScore:0,interactionConfig:{visibleWhenItemVersionId:'choice',visibleWhenValue:'B'}},
  {itemVersionId:'report',interactionType:'number_score',skillCodes:['reading'],maxScore:0,interactionConfig:{max:7}},
  {itemVersionId:'report2',interactionType:'number_score',skillCodes:['reading'],maxScore:0,interactionConfig:{max:7}},
  {itemVersionId:'reflection',interactionType:'long_text',maxScore:0}
]}]};
test('Ưu tiên dùng ba buổi mới nhất, bỏ ảnh hưởng điểm cũ khi đã tiến bộ',()=>{
  const r=priority([40,45,45,70,75,80].map((percent,i)=>({sessionNumber:i+1,percent})));
  assert.equal(r.flagged,false);assert.equal(r.recentAverage,75);assert.ok(r.average<60);
});
test('Đủ ba tỷ lệ thấp mới gắn nhãn; đúng 60% không gắn',()=>{
  assert.equal(priority([50,55].map((percent,i)=>({percent,sessionNumber:i}))).flagged,false);
  assert.equal(priority([40,55,50].map((percent,i)=>({percent,sessionNumber:i}))).flagged,true);
  assert.equal(priority([60,60,60].map((percent,i)=>({percent,sessionNumber:i}))).flagged,false);
});
test('Thiếu dữ liệu không thành 0%; giá trị 0 thật vẫn hợp lệ',()=>{
  assert.equal(validReport({correct:0,total:7}),true);
  assert.equal(validReport({correct:null,total:7}),false);
  assert.equal(validReport({correct:8,total:7}),false);
  const result=priority([{sessionNumber:1,percent:0},{sessionNumber:2,percent:null}]);
  assert.equal(result.count,1);assert.equal(result.average,0);assert.equal(result.flagged,false);
});
test('Gộp các bài luyện của cùng buổi; không trộn điểm quiz hoặc nháp',()=>{
  const responses={report:{correct:7,total:7},report2:{correct:6,total:7},choice:'A'};
  assert.equal(practiceReport(definition,{responses},'reading'),null);
  const result=practiceReport(definition,{submissionId:'s',responses},'reading');
  assert.equal(result.correct,13);assert.equal(result.total,14);
  assert.equal(practiceReport(definition,{submissionId:'s',responses},'listening'),null);
});
test('Chấp nhận nộp trống; loại câu có điều kiện không áp dụng khỏi kết quả',()=>{
  assert.doesNotThrow(()=>validateResponses(definition,{}));
  const result=grade(definition,{choice:'A'},{choice:{graderType:'exact_option',expectedOptionId:'B'}});
  assert.equal(result.find(v=>v.itemVersionId==='choice').scoreEarned,0);
  assert.equal(result.some(v=>v.itemVersionId==='other'),false);
  assert.equal(result.find(v=>v.itemVersionId==='reflection').maxScore,0);
});
test('Từ chối số câu sai định dạng và câu trả lời gắn sang bài khác',()=>{
  assert.throws(()=>validateResponses(definition,{report:{correct:8,total:7}}));
  assert.throws(()=>validateResponses(definition,{report:{correct:3,total:6}}));
  assert.throws(()=>validateResponses(definition,{unknown:'A'}));
  assert.throws(()=>validateResponses(definition,{choice:'Z'}));
});
