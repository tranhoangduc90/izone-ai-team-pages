import test from 'node:test';
import assert from 'node:assert/strict';
import {ordered,approval,card} from './teacher-dashboard.mjs';
const row=(id,priority,lastAt)=>({studentRef:id,displayName:id,sessionRef:'session',dashboard:{priority,activity:{lastAt},stepStates:{},processing:{}}});
test('H67-GV-SORT · hỗ trợ/lỗi/bài sửa trước; thời gian thực và ID ổn định, không dùng giờ poll/GV',()=>{
 const rows=[row('old',3,10),row('support',0,1),row('new',3,100),row('error',1,50),row('edited',2,70),row('a',3,100)];
 assert.deepEqual(ordered(rows).map(r=>r.studentRef),['support','error','edited','a','new','old']);
 rows[0].updatedAt='2099-01-01';assert.equal(ordered(rows).at(-1).studentRef,'old');
});
test('H67-GV-SOURCE · nguồn cũ không giả AI; HV xác nhận giữ đúng ý nghĩa',()=>{
 assert.match(approval({status:'passed'}),/chưa có dữ liệu/);
 assert.match(approval({status:'passed',approval:{source:'student_attested_teacher_permission'}}),/HV xác nhận/);
 assert.equal(approval({status:'passed',approval:{source:'ai'}}),'AI chấm đạt');
});
test('H67-GV-CARD · tên escape và ô viết khác phần thông qua',()=>{
 const r=row('<script>',3,10);Object.assign(r.dashboard,{filled:9,passed:2,checks:4,aiComments:1,openThreads:1});
 const html=card(r);assert.match(html,/9\/9/);assert.match(html,/2\/7/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));
});
