import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingSession,dashboardSessionState} from '../progress-log/student-session-dashboard.js';
import {handoffProgressStudent,consumeProgressStudentHandoff,markProgressLogout} from '../progress-log/student-session-memory.js';
const now=Date.parse('2026-11-02T12:00:00Z');
const old={sessionNumber:6,sessionDate:'2026-10-30',assignmentId:'old',assignmentStatus:'published'};
const next={sessionNumber:7,sessionDate:'2026-11-03',assignmentId:'next',assignmentStatus:'published'};
test('Thẻ 24 chọn theo ngày học từ hôm nay, không theo giao gần nhất hoặc bài cũ chưa xong',()=>{
  assert.equal(upcomingSession([next,old],now),next);
  const today={...next,sessionNumber:8,sessionDate:'2026-11-02',completeness:'complete'};
  assert.equal(upcomingSession([next,old,today],now),today);
  assert.equal(dashboardSessionState(today,now).readOnly,true);
  const unassigned={sessionNumber:7,sessionDate:'2026-11-02'};
  assert.equal(upcomingSession([next,unassigned],now),unassigned);
  assert.equal(dashboardSessionState(unassigned,now).canLearn,false);
});
test('Thẻ 24 mốc nửa đêm Việt Nam, thứ tự ổn định và lịch thiếu',()=>{
  const today={sessionNumber:8,sessionDate:'2026-11-02'},tomorrow={sessionNumber:9,sessionDate:'2026-11-03'};
  assert.equal(upcomingSession([tomorrow,today],Date.parse('2026-11-02T16:59:59Z')),today);
  assert.equal(upcomingSession([tomorrow,today],Date.parse('2026-11-02T17:00:00Z')),tomorrow);
  assert.equal(upcomingSession([old,{sessionDate:'2026-02-30'}],now),null);
  assert.equal(upcomingSession([{...today,sessionNumber:10},today],now),today);
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
