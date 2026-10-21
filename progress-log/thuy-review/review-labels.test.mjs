// Kiểm ý nghĩa nhãn: chưa có bằng chứng chấm khác câu không chấm hoặc tự báo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {studentReviewLabel} from './review-labels.mjs';

test('Câu không chấm giữ ý nghĩa ấy cả khi đã trả lời, trống hoặc chưa nộp',()=>{
  const item={interactionType:'long_text',graderType:'none'};
  for(const verdict of ['ungraded','blank','pending'])assert.equal(studentReviewLabel(item,verdict),'Không chấm đúng/sai');
  assert.equal(studentReviewLabel({...item,interactionType:'multiple_choice'},'ungraded'),'Không chấm đúng/sai');
});
test('Số câu tự báo không là kết quả chấm; để trống không thành0',()=>{
  const item={interactionType:'number_score',graderType:'none'};
  assert.equal(studentReviewLabel(item,'ungraded'),'Số câu tự báo');
  assert.equal(studentReviewLabel(item,'blank'),'Số câu tự báo · Để trống');
});
test('Câu có chấm thiếu kết quả phân biệt bản chụp với lượt thử hiện tại',()=>{
  const item={interactionType:'single_choice',graderType:'exact_option'};
  assert.equal(studentReviewLabel(item,'ungraded',{snapshot:true}),'Bản chụp thiếu kết quả chấm');
  assert.equal(studentReviewLabel(item,'ungraded'),'Chưa có kết quả chấm');
});
test('Thiếu metadata không tự coi là câu không chấm',()=>{
  assert.equal(studentReviewLabel({interactionType:'short_text'},'ungraded',{snapshot:true}),'Bản chụp thiếu kết quả chấm');
});
test('Đúng, sai, chờ chấm thủ công và không áp dụng giữ kết quả nguồn',()=>{
  for(const item of [{graderType:'exact_option'},{graderType:'none'},{interactionType:'number_score'}]){
    for(const verdict of ['correct','incorrect','manual_review','not_applicable'])assert.equal(studentReviewLabel(item,verdict),null);
  }
  assert.equal(studentReviewLabel({graderType:'exact_option'},'pending',{snapshot:true}),null);
  assert.equal(studentReviewLabel({graderType:'exact_option'},'blank',{snapshot:true}),null);
});
test('Chỉ tạo nhãn; không sửa câu, giá trị hoặc trạng thái nguồn',()=>{
  const item={interactionType:'number_score',graderType:'none',response:{correct:0,total:20}},before=structuredClone(item);
  studentReviewLabel(item,'ungraded',{snapshot:true});assert.deepEqual(item,before);
});
