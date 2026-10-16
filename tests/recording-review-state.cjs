const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(request){
 const listeners={},row={id:'Zoom 51:fixture',kind:'recording',source:'Zoom 51',recordingFileId:'fixture',title:'Tên gốc',className:'IC9001',version:2,reviewStatus:'pending',reviewVersion:0,reviewMetadata:{title:'Tên gốc',className:'IC9001'}};
 const context={state:{records:[row],version:0},nightlyState:{snapshot:{date:'2026-10-08',records:[{...row}]}},localDate:()=> '2026-10-08',isApproved:r=>r.reviewStatus==='approved',window:{},document:{addEventListener:(name,fn)=>listeners[name]=fn},crypto:{randomUUID:()=> 'fixture-request-12345'},toast:()=>{},renderStats:()=>{},renderSections:()=>{},loadData:async()=>{},recordingAuth:{isAuthenticated:()=>true,request}};
 context.window.recordingAuth=context.recordingAuth;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../recordings/review.js'),'utf8'),context);
 return {context,row,tick:approved=>listeners.change({target:{closest:()=>({dataset:{id:row.id},checked:approved,disabled:false})}})};
}
const reply=body=>({ok:body.ok,json:async()=>body});

test('Recording lịch sử dùng phiên bản backend hiện tại để duyệt, không dùng phiên bản cũ trong bảng',async()=>{
 let writes=0,approved=false;
 const f=fixture(async b=>{
  if(b.action==='review_read')return reply({ok:true,reviews:[{id:f.row.id,version:4,reviewMetadata:f.row.reviewMetadata,reviewStatus:approved?'approved':'pending',reviewVersion:approved?2:1}]});
  writes++;assert.equal(b.expectedVersion,4);assert.equal(b.expectedReviewVersion,1);approved=true;
  return reply({ok:true,record:{id:f.row.id}});
 });
 f.context.nightlyState.snapshot={date:'2026-10-09',records:[]};f.row.version=1;
 await f.tick(true);assert.equal(writes,1);assert.equal(approved,true);assert.equal(f.row.reviewStatus,'approved');
});

test('Tên hoặc lớp thay đổi trước lúc duyệt thì không gửi lệnh ghi cho nội dung cũ',async()=>{
 let writes=0,reloads=0;
 const f=fixture(async b=>{if(b.action!=='review_read'){writes++;return reply({ok:true,record:{id:f.row.id}});}return reply({ok:true,reviews:[{id:f.row.id,version:4,reviewMetadata:{title:'Tên mới',className:'IC9001'},reviewStatus:'pending',reviewVersion:1}]});});
 f.context.loadData=async()=>{reloads++;};await f.tick(true);assert.equal(writes,0);assert.equal(reloads,1);assert.equal(f.row.reviewStatus,'pending');
});

test('Cho duyệt ở mọi trạng thái recording và giữ nguyên trạng thái tải hoặc lỗi',async()=>{
 for(const stage of ['queued','downloading','uploading','processing','failed','completed']){
  let saved=false,writes=0;
  const f=fixture(async b=>{if(b.action==='review_read')return reply({ok:true,reviews:[{id:f.row.id,version:4,reviewVersion:saved?1:0,reviewMetadata:f.row.reviewMetadata,reviewStatus:saved?'approved':'pending'}]});writes++;saved=true;return reply({ok:true,record:{id:f.row.id}});});
  f.row.stage=stage;f.row.errorCode='DOWNLOAD_FAILED';assert.doesNotMatch(f.context.recordingReviewAttributes(f.row),/disabled/);
  await f.tick(true);assert.equal(writes,1);assert.equal(f.row.reviewStatus,'approved');assert.equal(f.row.stage,stage);assert.equal(f.row.errorCode,'DOWNLOAD_FAILED');
 }
});

test('Chưa đọc được phiên bản hiện tại thì không gửi duyệt và mở lại ô sau lỗi',async()=>{
 let writes=0;
 const f=fixture(async b=>{if(b.action==='review_read')return reply({ok:true,reviews:[]});writes++;return reply({ok:true,record:{id:f.row.id}});});
 await f.tick(true);assert.equal(writes,0);assert.equal(f.row.reviewStatus,'pending');assert.doesNotMatch(f.context.recordingReviewAttributes(f.row),/disabled/);
});
test('Readback không duyệt tên mới bằng kết quả của tên cũ',()=>{const {context,row}=fixture();const old={reviewMetadata:{...row.reviewMetadata},reviewStatus:'approved',reviewVersion:1};row.reviewMetadata={title:'Tên mới',className:'IC9001'};assert.equal(context.applyRecordingReview(old,row.id),false);assert.equal(row.reviewStatus,'pending');});
test('Mất phản hồi chỉ đọc lại kết quả; không gửi thêm ACK',async()=>{let writes=0;const f=fixture(async b=>{if(b.action==='acknowledge_review'){writes++;throw Error('NETWORK_FAILED');}return reply({ok:true,reviews:[{id:f.row.id,version:2,reviewMetadata:f.row.reviewMetadata,reviewStatus:'approved',reviewVersion:1}]});});await f.tick(true);assert.equal(writes,1);assert.equal(f.row.reviewStatus,'approved');});
test('Conflict tải lại nguồn để lần bấm tiếp theo dùng phiên bản mới',async()=>{let reads=0,writes=0,reloads=0;const f=fixture(async b=>{if(b.action==='acknowledge_review'){writes++;return reply({ok:false,error:'VERSION_CONFLICT'});}reads++;return reply({ok:true,reviews:[{id:f.row.id,version:2,reviewMetadata:f.row.reviewMetadata,reviewStatus:'pending',reviewVersion:0}]});});f.context.loadData=async()=>{reloads++;f.context.nightlyState.snapshot.records[0].version=3;};await f.tick(true);assert.equal(writes,1);assert.equal(reads,2);assert.equal(reloads,1);assert.equal(f.context.recordingReviewTarget(f.row).source.version,3);});
test('Hai click khi đang lưu chỉ gửi một lệnh; render giữ trạng thái pending',async()=>{let release,started,writes=0;const held=new Promise(r=>release=r),reachedWrite=new Promise(r=>started=r);const f=fixture(async b=>{if(b.action==='acknowledge_review'){writes++;started();await held;return reply({ok:true,record:{id:f.row.id}});}return reply({ok:true,reviews:[{id:f.row.id,version:2,reviewMetadata:f.row.reviewMetadata,reviewStatus:'approved',reviewVersion:1}]});});const saving=f.tick(true);await f.tick(true);await reachedWrite;assert.match(f.context.recordingReviewAttributes(f.row),/disabled.*checked/);assert.equal(writes,1);release();await saving;assert.doesNotMatch(f.context.recordingReviewAttributes(f.row),/disabled/);});
