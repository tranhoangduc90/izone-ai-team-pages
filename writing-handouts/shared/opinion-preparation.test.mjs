// Link lớp mới chỉ chọn lớp trong cấu hình server; không thay default/luồng thử của bài cũ.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonEntryClass} from './test-class-entry.mjs';
import {card} from '../lesson5/teacher-dashboard.mjs';
test('Lesson13 giữ lớp trong link, từ chối lớp sai; Lesson11 giữ default cũ',()=>{
 const fresh={rosterScope:'lesson',classes:['IC2304','IC2340']};
 assert.equal(lessonEntryClass(fresh,'?class=ic2340'),'IC2340');assert.equal(lessonEntryClass(fresh,''),'');
 assert.throws(()=>lessonEntryClass(fresh,'?class=PRIVATE'),/CLASS_NOT_OPEN/);
 assert.equal(lessonEntryClass({classes:['IC2304'],defaultClass:'IC2304'},'?class=IC2340'),'IC2304');
});
test('Thẻ GV dùng tổng ô bắt buộc từ projection để mức hoàn toàn đủ100%',()=>{
 const row={studentRef:'sample',displayName:'Học viên mẫu',sessionRef:'session',dashboard:{totalFields:20,filled:20,passed:7,totalSections:7,activity:{},stepStates:{}}};
 const html=card(row,{totalFields:21});assert.match(html,/>100%/);assert.match(html,/>20\/20</);assert.doesNotMatch(html,/>95%/);
});
