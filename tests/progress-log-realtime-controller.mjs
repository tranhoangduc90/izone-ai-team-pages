// Dữ liệu giả: kiểm thứ tự đọc, response lớp cũ và tín hiệu kết nối; không gửi yêu cầu ghi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeacherLiveUpdates} from '../progress-log/teacher-live-updates.js';
const pause=ms=>new Promise(done=>setTimeout(done,ms));
class Stream{
  static opened=[];
  constructor(){this.handlers=new Map();Stream.opened.push(this);}
  addEventListener(type,callback){this.handlers.set(type,callback);}
  close(){this.closed=true;}
  emit(type,data){this.handlers.get(type)?.({data:JSON.stringify(data)});}
}
test('SSE không báo xanh trước khi áp dụng; response lớp cũ không đổi màn mới; Làm mới gom một lượt',async()=>{
  const pending=[],applied=[],states=[];
  const live=createTeacherLiveUpdates({read:input=>new Promise((resolve,reject)=>pending.push({...input,resolve,reject})),apply:value=>applied.push(value.assignmentId+':'+value.revision),
    url:id=>id,EventSourceClass:Stream,active:()=>true,onState:value=>states.push(value.kind)});
  try{
    const first=live.start('old'),oldStream=Stream.opened.at(-1);oldStream.emit('open');oldStream.emit('change',{assignmentId:'old',revision:'5'});
    assert.ok(!states.includes('connected'));
    const current=live.start('new');Stream.opened.at(-1).emit('open');assert.equal(pending[0].signal.aborted,true);assert.equal(oldStream.closed,true);
    pending[0].resolve({assignmentId:'old',revision:'5'});await first;assert.deepEqual(applied,[]);
    pending[1].resolve({assignmentId:'new',revision:'7'});await current;assert.deepEqual(applied,['new:7']);
    const before=pending.length,a=live.refresh({force:true}),b=live.refresh({force:true});assert.equal(pending.length,before+1);
    pending.at(-1).resolve({assignmentId:'new',revision:'8'});await Promise.all([a,b]);await pause(280);
    assert.equal(pending.length,before+2);pending.at(-1).resolve({assignmentId:'new',revision:'8'});await pause(10);
    Stream.opened.at(-1).emit('heartbeat',{assignmentId:'new',revision:'8'});assert.equal(states.at(-1),'connected');
    const broken=live.refresh({force:true});pending.at(-1).reject(Error('Một vùng dữ liệu bị lỗi'));await broken;
    Stream.opened.at(-1).emit('heartbeat',{assignmentId:'new',revision:'8'});assert.equal(states.at(-1),'partial','Heartbeat không được che lỗi đọc toàn màn');
    await pause(280);assert.equal(pending.at(-1).force,true);pending.at(-1).resolve({assignmentId:'new',revision:'8'});await pause(10);
    Stream.opened.at(-1).emit('heartbeat',{assignmentId:'new',revision:'8',notificationsReady:false});assert.equal(states.at(-1),'fallback');
    Stream.opened.at(-1).emit('change',{assignmentId:'old',revision:'999'});assert.notEqual(states.at(-1),'connected');
  }finally{live.stop();}
});
