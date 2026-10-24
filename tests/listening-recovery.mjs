import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../listening-practice/app.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
// Chạy hàm UI thật, API giả chỉ tại biên mạng. Bảo vệ lượt hiện có khi người dùng bấm Tiếp tục.
function harness(error){
 const requests=[],session=new Map(),local=new Map(),a={id:'attempt-1',status:'paused',sequence:1},context=vm.createContext({
  navigator:{onLine:true},identity:{bindingId:'binding-1'},TAB:'tab-1',lease:{id:'lease-1'},current:()=>a,
  persist(){},stopLocal(){},notify(){},clearTimeout(){},crypto:{randomUUID:()=> 'operation-1'},serial:fn=>fn(),
  sessionStorage:{setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},localStorage:{getItem:k=>local.get(k)||null},
  begin(){throw new Error('Unexpected begin');},request:async(path,body)=>{requests.push({path,body});throw error;}
 });
 const helper=source.includes('function clearPendingOperation(')?section('function clearPendingOperation(','async function perform('):'';
 vm.runInContext('let busy=false,activating=false,pendingOperation=null,debounce,lastTick=0,lastPulse=0;\n'+helper+section('async function perform(', 'function stopAudio(')+'\n'+section('function resume(){','function pause('),context);
 return{context,requests,session};
}
test('HTTP 400 từ chối Reset được xóa, Tiếp tục gửi Resume và giữ lượt hiện tại',async()=>{
 const h=harness(Object.assign(new Error('Vị trí không hợp lệ'),{code:'AUDIO_POSITION_INVALID',httpStatus:400}));
 await vm.runInContext("perform('reset',{attemptId:'attempt-1'})",h.context);assert.equal(h.session.size,0);
 vm.runInContext('resume()',h.context);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(h.requests.map(r=>r.path),['/reset','/resume']);
});
test('Tiếp tục không tự phát lại Reset cũ còn lưu trong phiên của học viên',async()=>{
 const h=harness(Object.assign(new Error('offline'),{code:'NETWORK'}));
 await vm.runInContext("perform('reset',{attemptId:'attempt-1'})",h.context);assert.equal(h.session.size,1);
 vm.runInContext('resume()',h.context);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(h.requests.map(r=>r.path),['/reset','/resume']);
});
test('Nộp gặp timeout vẫn giữ mã thao tác để đối chiếu/chống nộp trùng',async()=>{
 const h=harness(Object.assign(new Error('timeout'),{code:'NETWORK'}));
 await vm.runInContext("perform('submit',{attemptId:'attempt-1'})",h.context);assert.equal(h.session.size,1);
 vm.runInContext('resume()',h.context);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(h.requests.map(r=>r.path),['/submit','/submit']);assert.equal(h.requests[0].body.operationId,h.requests[1].body.operationId);
});

test('Rời màn khi đang chờ kích hoạt audio vẫn cho Tiếp tục đúng lượt và giữ nháp',()=>{
 const a={id:'attempt-1',status:'running',owner:'tab-1',remainingMs:550000,answers:{21:'B'},notes:'nháp đang nghe'},buttons=[{disabled:true},{disabled:true}],requests=[];
 const context=vm.createContext({current:()=>a,TAB:'tab-1',navigator:{onLine:true},document:{querySelectorAll:()=>buttons},isOnline:()=>true,
  consumeTime(){},stopAudio(){},rememberScroll(){},persist(){},snapshot:()=>({answers:a.answers,notes:a.notes}),clearTimeout(){},closeModal(){},serial(){},navigate(){},
  perform:(action,input)=>requests.push({action,input}),sessionStorage:{getItem:()=>null},localStorage:{getItem:()=>null},cacheKey:()=> 'fixture-cache',identity:{bindingId:'binding-1'}});
 vm.runInContext('let activating=true,lease={id:"lease-1"},lastTick=0,debounce,saveError=false,pendingOperation=null;\n'+section('function setActivating(','async function sendPulse(')+'\n'+section('function resume(){','function pause(')+'\n'+section('function pause(','function finish('),context);
 vm.runInContext("pause('leave',false);resume();",context);
 assert.equal(vm.runInContext('activating',context),false);assert.equal(a.status,'paused');assert.equal(a.pauseReason,'leave');
 assert.equal(requests.length,1);assert.equal(requests[0].action,'resume');assert.equal(requests[0].input.attemptId,a.id);
 assert.equal(a.remainingMs,550000);assert.deepEqual(a.answers,{21:'B'});assert.equal(a.notes,'nháp đang nghe');assert.ok(buttons.every(b=>!b.disabled));
});
