import test from 'node:test';
import assert from 'node:assert/strict';
import {latestAssignedSession,visibleStudentSessions,dashboardSessionState,studentEntryState} from '../progress-log/student-session-dashboard.js';
import {handoffProgressStudent,consumeProgressStudentHandoff,markProgressLogout} from '../progress-log/student-session-memory.js';
const now=Date.parse('2026-11-02T12:00:00Z');
const old={sessionNumber:6,sessionDate:'2026-10-30',assignmentId:'old',assignmentStatus:'published'};
const next={sessionNumber:7,sessionDate:'2026-11-03',assignmentId:'next',assignmentStatus:'published'};
test('Thẻ 25 chọn buổi gần nhất có phiếu đã giao, gồm hôm nay theo ngày Việt Nam',()=>{
  assert.equal(latestAssignedSession([next,old],now),old);
  const today={...next,sessionNumber:8,sessionDate:'2026-11-02',completeness:'complete'};
  assert.equal(latestAssignedSession([next,old,today],now),today);
  assert.equal(dashboardSessionState(today,now).readOnly,true);
  const unassigned={sessionNumber:7,sessionDate:'2026-11-02'};
  assert.equal(latestAssignedSession([next,unassigned],now),null);
  assert.equal(dashboardSessionState(unassigned,now).canLearn,false);
});
test('Thẻ 25 mốc nửa đêm Việt Nam, thứ tự ổn định và lịch thiếu',()=>{
  const today={...old,sessionNumber:8,sessionDate:'2026-11-02'},tomorrow={...next,sessionNumber:9};
  assert.equal(latestAssignedSession([tomorrow,today],Date.parse('2026-11-02T16:59:59Z')),today);
  assert.equal(latestAssignedSession([tomorrow,today],Date.parse('2026-11-02T17:00:00Z')),tomorrow);
  assert.deepEqual(visibleStudentSessions([old,{...next,sessionDate:'2026-02-30'}, {...today,attemptStatus:'not_assigned'}],now),[old]);
  assert.equal(latestAssignedSession([{...today,sessionNumber:10},today],now).sessionNumber,10);
  assert.equal(latestAssignedSession([{...today,sessionNumber:10,sessionStartTime:'08:00:00'},
    {...today,sessionStartTime:'16:00:00'}],now).sessionNumber,8);
});
test('Thẻ 25 chỉ mở bài khi phần đầu mở và còn quyền, kể cả trước 18:25',()=>{
  const active={...old,sessionDate:'2026-11-02',firstBlockStatus:'open',publicToken:'40000000-0000-4000-8000-000000000001',
    submissionWindow:{canSubmit:true,effectiveClosesAt:'2026-11-02T14:00:00Z'}};
  assert.equal(studentEntryState(active,Date.parse('2026-11-02T03:00:00Z')).canLearn,true);
  for(const firstBlockStatus of ['closed','locked',null,undefined])assert.equal(studentEntryState({...active,firstBlockStatus},now).canLearn,false);
  assert.equal(studentEntryState(active,Date.parse('2026-11-02T14:00:00Z')).canLearn,false);
  assert.equal(studentEntryState(active,now,false).canLearn,false);
  assert.equal(studentEntryState({...active,completeness:'complete'},now).action,'Xem bài đã nộp');
});
test('Thẻ 24 không cho bắt đầu phiếu đóng hoặc chưa tới giờ; nhận xét không biến thành đã hoàn thành',()=>{
  const active={...next,sessionDate:'2026-11-02',sessionComment:{noteText:'Đã nhận xét'}};
  assert.equal(dashboardSessionState(active,now).canLearn,true);
  for(const value of [{...active,assignmentStatus:'closed'},{...active,submissionWindow:{canSubmit:false,reason:'closed'}},next])assert.equal(dashboardSessionState(value,now).canLearn,false);
});
test('Thẻ 24 chuyển lựa chọn cùng tab: một lần, đúng lớp/người, có hạn và vô hiệu sau đăng xuất',()=>{
  const prior={local:globalThis.localStorage,session:globalThis.sessionStorage,now:Date.now};
  const storage=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();let clock=now;Date.now=()=>clock;
  const choice={classId:'1294',studentRef:'student-a',remember:false};
  const context={...choice,expectedRef:choice.studentRef,studentRefs:['student-a','student-b']};
  try{
    assert.equal(handoffProgressStudent(choice),true);assert.equal(consumeProgressStudentHandoff(context).remember,false);assert.equal(consumeProgressStudentHandoff(context),null);
    for(const wrong of [{classId:'wrong'},{expectedRef:'student-b'},{studentRefs:['student-b']}]){handoffProgressStudent(choice);assert.equal(consumeProgressStudentHandoff({...context,...wrong}),null);}
    handoffProgressStudent(choice);clock+=120001;assert.equal(consumeProgressStudentHandoff(context),null);
    handoffProgressStudent(choice);clock-=1;assert.equal(consumeProgressStudentHandoff(context),null);
    handoffProgressStudent(choice);markProgressLogout();assert.equal(consumeProgressStudentHandoff(context),null);
    globalThis.sessionStorage={setItem(){throw Error('blocked');},getItem(){throw Error('blocked');}};
    assert.equal(handoffProgressStudent(choice),false);assert.equal(consumeProgressStudentHandoff(context),null);
  }finally{globalThis.localStorage=prior.local;globalThis.sessionStorage=prior.session;Date.now=prior.now;}
});
