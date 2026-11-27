import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {mountAssignmentWaiting} from '../term-tests/substitute-assignment-full/assignment-browser-journey-v2.mjs';
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function fixture(){
  const window={};
  const source=await readFile(new URL('../term-tests/substitute-shared/audio-lobby-20261127-v2.js',import.meta.url),'utf8');
  vm.runInNewContext(source,{window,setTimeout,clearTimeout,AbortController,document:{},performance});
  return window.SUBSTITUTE_PREPARATION_DEADLINE;
}
test('một hạn chung cho cả cấp lượt và tải; quá hạn hủy và cho thử cùng lượt',async()=>{
  const run=await fixture();let timedOut=0,aborted=false,ready=false;
  const identity={run:'same-run'};
  await assert.rejects(run(async signal=>{
    await wait(15);signal.throwIfAborted();
    await wait(30);aborted=signal.aborted;signal.throwIfAborted();ready=true;
  },{timeoutMs:25,onTimeout:()=>timedOut++}),e=>e.code==='ASSIGNMENT_PREPARATION_TIMEOUT');
  assert.equal(timedOut,1);assert.equal(ready,false);
  assert.equal(await run(async signal=>{signal.throwIfAborted();return identity;}),identity);
  await wait(35);assert.equal(aborted,true);assert.equal(ready,false);
});
test('chuẩn bị xong giải phóng timer, không hủy nghe thử hoặc bài đang làm',async()=>{
  const run=await fixture();let captured,timedOut=0;
  assert.equal(await run(async signal=>{captured=signal;return true;},{timeoutMs:10,onTimeout:()=>timedOut++}),true);
  await wait(20);assert.equal(captured.aborted,false);assert.equal(timedOut,0);
});
test('lỗi thật vẫn giữ mã gốc và không bị đổi thành lỗi chờ',async()=>{
  const run=await fixture();const original=Object.assign(Error('closed'),{code:'SITTING_CLOSED'});
  await assert.rejects(run(async()=>{throw original;}),e=>e===original);
});
test('quá hạn bật thử lại ngay, không chờ thêm một request trạng thái',async t=>{
  const original=globalThis.document;let statusCalls=0;
  globalThis.document={hidden:false,createElement:()=>({setAttribute(){}})};
  t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
  const target={replaceChildren(message,button){Object.assign(this,{message,button});}};
  const stop=await mountAssignmentWaiting(target,{
    scope:{sittingId:'window-fixture',testId:'test-fixture',classCode:'IC99001',studentRef:'fixture'},
    api:async route=>{if(route==='student/join')return {token:'fixture'};statusCalls++;return {state:'assigned',canStart:true};},
    start:async()=>{throw Object.assign(Error('timeout'),{code:'ASSIGNMENT_PREPARATION_TIMEOUT'});},
    storage:{getItem:()=>null,setItem(){}},keepMonitoring:true,requirePrepared:true
  });t.after(stop);
  assert.equal(statusCalls,1);await target.button.onclick();
  assert.equal(statusCalls,1);assert.equal(target.button.disabled,false);
  assert.equal(target.button.textContent,'Thử chuẩn bị lại');assert.match(target.message.textContent,/10 giây/);
});
