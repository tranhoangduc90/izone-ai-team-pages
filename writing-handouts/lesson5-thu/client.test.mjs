// Kiểm mất phần nội dung ACK sau commit: cùng requestId phải được gửi lại, không tạo lượt mới.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from './client.mjs';
test('UI-ACK · mất body ACK retry đúng request cũ',async()=>{
 const sent=[];const client=createClient('https://fixture.invalid',async(url,options)=>{sent.push({url,body:options.body,authorization:options.headers.Authorization});return {ok:true,status:200,json:async()=>{if(sent.length===1)throw new TypeError('body connection lost');return {ok:true,session:{version:1}};}};});
 client.setToken('fixture-capability');const value=await client.save('fixture-ref',{requestId:'same-request',baseVersion:0,responses:{idea1:'Bài giả'}});
 assert.equal(sent.length,2);assert.deepEqual(sent[0],sent[1]);assert.equal(value.session.version,1);
});
test('UI-CONFLICT · HTTP409 không retry ghi đè',async()=>{
 let calls=0;const client=createClient('https://fixture.invalid',async()=>{calls++;return {ok:false,status:409,json:async()=>({ok:false,error:'VERSION_CONFLICT'})};});
 await assert.rejects(client.save('ref',{requestId:'id',baseVersion:0,responses:{}}),error=>error.status===409);assert.equal(calls,1);
});
