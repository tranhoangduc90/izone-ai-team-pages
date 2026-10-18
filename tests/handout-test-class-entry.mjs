// Nhận cấu hình ba lesson; kiểm link thường giữ nguyên lớp thật và chỉ lớp thử đã mở được chọn.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonEntryClass} from '../writing-handouts/shared/test-class-entry.mjs';
for(const number of [5,7,9]) {
 const lesson={activity:'lesson'+number,defaultClass:'IC2304',classes:['IC2304','CODEXID261018']};
 test(`Lesson ${number}: link thường và mã ngoài giữ lớp mặc định`,()=>{
  assert.equal(lessonEntryClass(lesson),'IC2304');
  assert.equal(lessonEntryClass(lesson,'?class=IC2304'),'IC2304');
  assert.equal(lessonEntryClass(lesson,'?class=unknown'),'IC2304');
 });
 test(`Lesson ${number}: lớp thử phải có trong cấu hình được mở`,()=>{
  assert.equal(lessonEntryClass(lesson,'?class=CODEXID261018'),'CODEXID261018');
  assert.throws(()=>lessonEntryClass({...lesson,classes:['IC2304']},'?class=CODEXID261018'),/TEST_CLASS_NOT_OPEN/);
 });
}
