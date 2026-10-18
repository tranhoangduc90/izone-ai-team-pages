import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../recordings/action-receipts.js',import.meta.url),'utf8');
const fixture=request=>{const window={recordingAuth:{request}};vm.runInNewContext(source,{window,crypto,setTimeout,clearTimeout,Error});return window.recordingRequests;};
const command={action:'confirm_publish',date:'2026-10-18',id:'Zoom 6:fixture',requestId:crypto.randomUUID()};
test('Mất phản hồi: chỉ đọc biên nhận, không gửi lại lệnh đăng',async()=>{
 const calls=[],api=fixture(async b=>{calls.push(b);if(calls.length===1)throw Error('network');return {ok:true,json:async()=>({ok:true,accepted:true,requestId:b.requestId,record:{stage:'queued'}})};});
 assert.equal((await api.submit(command)).accepted,true);assert.deepEqual(calls.map(c=>c.action),['confirm_publish','publish_status']);assert.equal(calls[1].requestId,command.requestId);
});
test('Từ chối xác định được trả về; không để pending và không đọc nhầm là accepted',async()=>{
 for(const code of ['SCAN_BUSY','RECORD_BUSY','PUBLISHED_GROUP_REQUIRES_REVIEW','PLAYLIST_AMBIGUOUS']){
  const api=fixture(async()=>({ok:true,json:async()=>({ok:false,error:code})}));
  await assert.rejects(api.submit(command),e=>api.rejected(e)&&e.message===code);
 }
});
test('Không có biên nhận: outcome vẫn chưa rõ, không tự POST upload lần hai',async()=>{
 const calls=[],api=fixture(async b=>{calls.push(b.action);if(calls.length===1)throw Error('network');return {ok:true,json:async()=>({ok:true,accepted:false})};});
 await assert.rejects(api.submit(command),/ACTION_RECEIPT_UNKNOWN/);assert.deepEqual(calls,['confirm_publish','publish_status']);
});
test('B và kiểm tra C có thể gửi trong lúc phản hồi A chưa về',async()=>{
 let resolve;const calls=[],api=fixture(b=>{calls.push(b.id);if(b.id==='A')return new Promise(r=>resolve=r);return Promise.resolve({ok:true,json:async()=>({ok:true,record:{id:b.id},accepted:true})});});
 const a=api.submit({...command,id:'A'});assert.equal((await api.submit({...command,id:'B'})).record.id,'B');assert.equal((await api.submit({...command,id:'C',action:'refresh_file'})).record.id,'C');
 resolve({ok:true,json:async()=>({ok:true,accepted:true,record:{id:'A'}})});await a;assert.deepEqual(calls,['A','B','C']);
});
