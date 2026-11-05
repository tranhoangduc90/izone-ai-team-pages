import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadCoordinator} from '../progress-log/read-coordinator.js';
import {createReleaseUpdater} from '../progress-log/release-updater.js';
test('Thẻ 26 gộp đọc cùng nguồn, hủy riêng từng người chờ, không giữ dữ liệu cũ',async()=>{
 const read=createReadCoordinator();let calls=0,finish;
 const load=signal=>{calls++;return new Promise((resolve,reject)=>{finish=resolve;signal.addEventListener('abort',()=>reject(Error('cancelled')));});};
 const controller=new AbortController(),a=read('class:student:session',load,{signal:controller.signal}),b=read('class:student:session',load);
 await Promise.resolve();controller.abort();await assert.rejects(a);finish({version:1});assert.deepEqual(await b,{version:1});assert.equal(calls,1);
 const c=read('class:student:session',load);await Promise.resolve();finish({version:2});assert.deepEqual(await c,{version:2});assert.equal(calls,2);
});
test('Thẻ 26 cập nhật: chờ nháp/ghi, giữ phiên khi lỗi, nhận rollback và không chuyển khi phiên bản không đổi',async()=>{
 let safe=false,next='2222222222222222',moves=[],reads=0;
 const updater=createReleaseUpdater({version:'1111111111111111',visible:()=>true,canApply:()=>safe,
 readVersion:async()=>{reads++;if(next==='error')throw Error('offline');return next;},navigate:async v=>moves.push(v),interval:100000});
 try{await updater.check();assert.deepEqual(moves,[]);assert.equal(await updater.apply(),false);
  safe=true;await updater.apply();assert.deepEqual(moves,['2222222222222222']);
  next='1111111111111111';await updater.check();assert.equal(moves.length,1);
  next='error';await updater.check();assert.equal(moves.length,1);
  next='0000000000000000';await updater.check();assert.equal(moves.at(-1),'0000000000000000');assert.equal(reads,4);
 }finally{updater.stop();}
});
