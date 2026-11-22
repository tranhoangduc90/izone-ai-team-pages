import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverAssignmentSession} from '../term-tests/substitute-assignment-full/assignment-student-entry.mjs';
const identity={testId:'substitute-test-1-k56-listening-makeup',classCode:'IC99001',studentRef:'123'};
const scope={...identity,sittingId:'window-11111111-1111-4111-8111-111111111111'};
const key='substitute-assignment:'+ [scope.sittingId,scope.testId,scope.classCode,scope.studentRef].join(':');
const storage={length:1,key:()=>key,getItem:()=> 'fixture-token'};
test('Lượt đã bắt đầu nhưng mất phản hồi được tìm lại bằng token và đúng danh tính',async()=>{
 const calls=[];
 const result=await recoverAssignmentSession({...identity,storage,api:async(route,input)=>{
  calls.push({route,...input});return {state:'running',canStart:true,sittingClosed:true};
 }});
 assert.deepEqual(result,{scope,token:'fixture-token'});
 assert.deepEqual(calls,[{route:'student/status',body:scope,token:'fixture-token'}]);
});
test('Phiên chỉ chuẩn bị hoặc không sở hữu lượt không được vượt ca đã đóng',async()=>{
 for(const status of [{state:'assigned',canStart:false},{state:'assigned',canStart:true},{state:'running',canStart:false},{state:'submitted',canStart:false}]){
  assert.equal(await recoverAssignmentSession({...identity,storage,api:async()=>status}),null);
 }
});
test('Không dùng token của học viên khác và lỗi dịch vụ không tự mở quyền',async()=>{
 assert.equal(await recoverAssignmentSession({...identity,studentRef:'456',storage,api:()=>assert.fail('khác người')}),null);
 await assert.rejects(recoverAssignmentSession({...identity,storage,api:async()=>{throw Error('UNAVAILABLE');}}),/UNAVAILABLE/);
});
