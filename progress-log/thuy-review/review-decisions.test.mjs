// Kiểm dữ liệu thật, quyền xem nhận xét và hạn/gia hạn qua chính kho phiên demo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDemoStore} from './demo-store.mjs';
import {miniResults} from './mini-test-results.mjs';
import {sessionContext} from './review-decisions.mjs';
const raw=JSON.parse(readFileSync(new URL('./demo-data.json',import.meta.url),'utf8'));
const ref='e988230c-995b-4b23-87b7-fb9ae7f663ac';
test('Mini thật giữ 16 điểm, 2 ô thiếu, mẫu số riêng và không tạo Writing',()=>{
 const data=createDemoStore(raw).teacher();
 assert.equal(miniResults.length,18);assert.equal(new Set(miniResults.map(v=>v.studentRef)).size,18);
 assert.equal(data.testResults.length,18);assert.equal(data.testResults.filter(v=>v.result.listening&&v.result.reading).length,16);
 for(const v of data.testResults){assert.equal(v.result.synthetic,false);assert.equal(v.result.writing,null);if(v.result.listening)assert.equal(v.result.listening.total,10);if(v.result.reading)assert.equal(v.result.reading.total,13);}
 const p=data.testResults.find(v=>v.studentRef==='f5d0d728-bd9f-4da3-beee-060aefc82296').result;
 assert.deepEqual(p.listening,{correct:6,total:10});assert.deepEqual(p.reading,{correct:4,total:13});
});
test('Phiên cũ được bổ sung Mini mà không mất bài thay, nháp hoặc nhận xét',()=>{
 const store=createDemoStore(raw);store.mutate({action:'feedbackDraft',number:10,generation:0,ref:'demo-a',text:'Nháp vẫn còn'});
 const old=store.exportPackage();old.data.testResults=[];
 const restored=createDemoStore(old);assert.equal(restored.teacher().testResults.length,18);
 assert.equal(restored.teacher().feedback['10:0:demo-a'].draft,'Nháp vẫn còn');
 assert.equal(restored.student(10,'demo-a').publishedFeedback,'');
});
test('Nhận xét nguồn cần xác minh chỉ còn ở giảng viên, học viên không nhận ở lịch sử',()=>{
 const store=createDemoStore(raw),teacher=store.teacher();
 assert.equal(teacher.courseSessions.find(s=>s.number===4).students.find(p=>p.studentRef===ref).publishedFeedback,'gjjyuyuy');
 assert.ok(!JSON.stringify(store.student(10,ref)).includes('gjjyuyuy'));
 assert.equal(sessionContext(4),'Ôn Listening; bài mới Reading và Speaking');
 assert.equal(sessionContext(3),'');
});
test('Hết hạn giữ nháp, retry bài đã nhận, từ chối phần mới; gia hạn có lý do và lịch sử',()=>{
 const store=createDemoStore(raw),session=store.teacher().sessions.find(s=>s.number===10),blocks=session.definition.blocks;
 const input={number:10,generation:0,ref:'demo-a'};
 store.mutate({...input,action:'checkpoint',blockId:blocks[0].blockId,responses:{}});
 store.mutate({...input,action:'draft',responses:{}});
 store.mutate({...input,action:'deadlineClock',expectedRevision:0});
 let deadline=store.student(10,'demo-a').deadline;assert.equal(deadline.closed,true);
 assert.equal(store.mutate({...input,action:'checkpoint',blockId:blocks[0].blockId}).ok,true);
 assert.throws(()=>store.mutate({...input,action:'checkpoint',blockId:blocks[1].blockId}),/hết hạn/);
 assert.equal(store.student(10,'demo-a').checkpoints.length,1);assert.equal(store.student(10,'demo-a').participated,true);
 const body={...input,action:'deadlineExtend',expectedRevision:deadline.revision,closesAt:'2026-10-20T05:00:00.000Z',reason:'Sự cố mạng của lớp'};
 assert.throws(()=>store.mutate({...body,reason:' '}),/lý do/);
 assert.throws(()=>store.mutate({...body,closesAt:'2026-10-19T14:00:00.000Z'}),/Hạn mới/);
 store.mutate(body);assert.throws(()=>store.mutate(body),/tab khác/);
 deadline=store.student(10,'demo-a').deadline;assert.equal(deadline.closed,false);assert.equal(deadline.extensions.length,1);
 assert.equal(deadline.originalClosesAt,session.closesAt);assert.equal(deadline.extensions[0].reason,body.reason);
 store.mutate({...input,action:'checkpoint',blockId:blocks[1].blockId,responses:{}});
 assert.equal(store.student(10,'demo-a').submitted,true);
 assert.throws(()=>store.mutate({...input,action:'draft',responses:{}}),/chỉ được xem lại/);
 const restored=createDemoStore(store.exportPackage()).student(10,'demo-a');
 assert.equal(restored.deadline.extensions.length,1);assert.equal(restored.checkpoints.length,2);
});
test('Chỉ người thứ ba nộp đủ nội dung khởi động hạn; nộp phần đầu trống không khởi động',()=>{
 const definition={blocks:[{blockId:'part',items:[{itemVersionId:'q',interactionType:'short_text',graderType:'none',skillCodes:[]}]}]};
 const students=[1,2].map(n=>({studentRef:'real-'+n,name:'Nguồn '+n,submitted:true,completeness:'complete',checkpoints:[{blockId:'part',submittedAt:'2026-10-22T12:00:00Z'}],detail:{responses:{q:'Có'},gradingItems:[]},portal:{status:'not_recorded'}}));
 const session={number:8,date:'2026-10-22',title:'Thử ngưỡng',generation:0,definition,students,closesAt:null,releases:[{blockId:'part',status:'open'}],retired:[]};
 const input={format:'thuy-review-data-v1',data:{className:'IC2305',people:[],sessions:[session]},keys:{}};
 const blank=createDemoStore(input);blank.mutate({action:'checkpoint',number:8,generation:0,ref:'demo-a',blockId:'part',responses:{}});
 assert.equal(blank.student(8,'demo-a').participated,true);assert.equal(blank.student(8,'demo-a').deadline.closesAt,null);
 const full=createDemoStore(input);full.mutate({action:'checkpoint',number:8,generation:0,ref:'demo-a',blockId:'part',responses:{q:'Có'}});
 assert.equal(full.student(8,'demo-a').deadline.closesAt,'2026-10-22T15:00:00.000Z');
});
test('Phiên cũ đã nhận 2/2 phần được hoàn tất sau hạn mà không nhận thêm câu trả lời',()=>{
 const store=createDemoStore(raw),s=store.teacher().sessions.find(v=>v.number===10);
 for(const block of s.definition.blocks)store.mutate({action:'checkpoint',number:10,generation:0,ref:'demo-a',blockId:block.blockId,responses:{}});
 const saved=store.exportPackage(),state=saved.demoState.fake.find(([key])=>key==='10:0:demo-a')[1];state.submitted=false;
 const legacy=createDemoStore(saved);legacy.mutate({action:'deadlineClock',number:10,generation:0,expectedRevision:0});
 legacy.mutate({action:'final',number:10,generation:0,ref:'demo-a',responses:{}});
 assert.equal(legacy.student(10,'demo-a').submitted,true);assert.equal(legacy.student(10,'demo-a').checkpoints.length,2);
});
