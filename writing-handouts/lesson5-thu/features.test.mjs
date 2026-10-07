import test from 'node:test';
import assert from 'node:assert/strict';
import {annotate,savedContent,threadsView,approvalLabel,fieldHash} from './features.mjs';
import {createClient} from './client.mjs';
import {renderActivityList} from '../lesson5/activity-ui.mjs';
test('H67-UI-MARK · comment chồng lấn giữ đủ luồng và escape bài, không highlight bản sai',()=>{
 const text='A <x> B',threads=[{ref:'one',quote:'<x>',anchor:{kind:'quote',start:2,end:5}},{ref:'two',quote:'x> B',anchor:{kind:'quote',start:3,end:7}}];
 const html=annotate(text,threads);assert.match(html,/data-threads="one,two"/);assert.ok(!html.includes('<x>'));assert.match(html,/&lt;/);assert.equal(annotate('Nội dung khác',threads),'Nội dung khác');
});
test('H67-UI-CONTENT · Edit ở nội dung chuẩn và nhãn phê chuẩn không giả kết quả AI',()=>{
 const session={responses:{a1:'Nội dung mới'},commentThreads:[]};assert.match(savedContent(session,'a1',{editable:true}),/data-edit="a1"/);assert.match(savedContent(session,'a1',{teacher:true}),/data-select-field="a1"/);
 assert.match(approvalLabel({status:'passed',approval:{source:'student_attested_teacher_permission'}}),/HV xác nhận/);
 assert.equal(approvalLabel({status:'pending'}),'');
 assert.equal(approvalLabel({status:'passed'}),'');
 assert.equal(approvalLabel({status:'passed',approval:{source:'ai'}}),'AI thông qua');
});
test('H67-UI-THREAD · trích bản cũ, HV reply, GV xử lý giữ nội dung an toàn',()=>{
 const t={ref:'one',status:'open',quote:'<script>',originalContent:'Bản gốc có <script> và câu trước đó.',anchor:{detached:true},messages:[{role:'teacher',authorName:'GV',createdAt:'2026-10-06T00:00:00Z',body:'<img>'}]};
 const student=threadsView([t]);assert.match(student,/thuộc bản bài cũ/);assert.match(student,/Xem nội dung lúc GV góp ý/);assert.match(student,/và câu trước đó/);assert.match(student,/data-thread-reply="one"/);assert.ok(!student.includes('data-thread-status'));assert.ok(!student.includes('<script>'));assert.match(threadsView([t],{teacher:true}),/Đánh dấu đã xử lý/);
});
test('H67-UI-API · cho qua/Edit/reply retry nguyên body và header phiên',async()=>{
 const captured=[];let fail=true;const client=createClient('https://fixture.test',async(url,options)=>{captured.push({url,body:options.body,authorization:options.headers.Authorization});if(fail){fail=false;throw new Error('Lost ACK');}return {ok:true,json:async()=>({ok:true,session:{}})};});client.setToken('fake-token');
 await client.attest('s',{requestId:'one',baseVersion:1,section:'a1',teacherPermission:true});assert.deepEqual(captured[0],captured[1]);assert.ok(captured[0].url.endsWith('/attest'));assert.equal(captured[0].authorization,'Bearer fake-token');
 await client.edit('s',{requestId:'two',field:'a1',value:'New'});await client.thread('s',{requestId:'three',action:'reply',threadRef:'t',body:'Reply'});assert.ok(captured[2].url.endsWith('/edit'));assert.ok(captured[3].url.endsWith('/threads'));
 assert.equal((await fieldHash('điểm đầu')).length,64);
});
test('H67-UI-LOG · GV đọc được nội dung trước sau Edit và lời trao đổi an toàn',()=>{
 const html=renderActivityList([{kind:'content_edited',event_at:'2026-10-06T00:00:00Z',details:{before:{a1:'Bản cũ <script>'},after:{a1:'Bản mới'}}},{kind:'comment_student',event_at:'2026-10-06T00:00:00Z',details:{field:'a1',quote:'<img>',message:{authorName:'HV',body:'Em trả lời'}}},{kind:'student_attested_teacher_permission',event_at:'2026-10-06T00:00:00Z',details:{section:'x1'}}],null);
 assert.match(html,/Xem nội dung trước và sau Edit/);assert.match(html,/Trước: Bản cũ &lt;script&gt;/);assert.match(html,/Sau: Bản mới/);assert.match(html,/HV trả lời góp ý/);assert.match(html,/HV xác nhận GV đồng ý cho qua/);assert.match(html,/Em trả lời/);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img>'));
});
