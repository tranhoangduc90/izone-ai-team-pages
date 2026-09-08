import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
// Fixture giả chỉ kiểm việc giữ kết luận, không lưu bài làm hoặc điểm học viên.
const source=fs.readFileSync(new URL('../term-tests/shared/app.js',import.meta.url),'utf8');
function extract(name){const start=source.indexOf('  function '+name+'(');const end=source.indexOf('\n  function ',start+1);assert(start>=0&&end>start);return source.slice(start,end);}
const context=vm.createContext({});
vm.runInContext(extract('cleanWritingFeedback')+'\n'+extract('writingCriterionConclusion')+'\n'+extract('writingCriterionFallbackSummary'),context);
test('kết luận giới hạn điểm không bị mất khi có các khía cạnh',()=>{
 const feedback='## **TASK RESPONSE**\n### **1. Cover đề**\nNhận xét giả.\n### **KẾT LUẬN**\n**Band 3**\nBài dưới 120 từ nên điểm bị giới hạn.';
 assert.match(context.writingCriterionConclusion(feedback),/dưới 120 từ/);
 assert.doesNotMatch(context.writingCriterionConclusion(feedback),/Cover đề/);
});
test('GRA một khía cạnh vẫn có nhận xét tổng hợp và kết luận riêng',()=>{
 const feedback='## GRA\nĐoạn nhận xét ngữ pháp giả.\n### **KẾT LUẬN**\n**Band 5**\nGiới hạn do độ dài.';
 assert.match(context.writingCriterionFallbackSummary(feedback),/Đoạn nhận xét ngữ pháp/);
 assert.match(context.writingCriterionConclusion(feedback),/Giới hạn do độ dài/);
});
test('không bịa kết luận khi nguồn không có',()=>assert.equal(context.writingCriterionConclusion('Nhận xét giả không có heading.'),''));
test('bỏ link nội bộ dư, giữ nhận xét và nút xem chi tiết hiện có',()=>{
 for(const href of ['#tr_position','*#tr_position*',' #cc_organization ','./#lr_range']){
  const input=`Nhận xét cần giữ.\n[(Xem phân tích chi tiết và cách cải thiện)](${href})\nNội dung sau.`;
  const result=context.cleanWritingFeedback(input);
  assert.match(result,/Nhận xét cần giữ/);assert.match(result,/Nội dung sau/);assert.doesNotMatch(result,/Xem phân tích/);
 }
});
