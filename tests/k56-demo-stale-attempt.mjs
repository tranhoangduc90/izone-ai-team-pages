// Mã lượt demo đã reset trên máy khác phải mở lại roster; lỗi mạng và lớp thật giữ nháp.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const groups=['term-test-1-k56-computer-based','term-test-2-k56-computer-based','mini-test-k56-computer-based'];
function source(group,name){
 const text=readFileSync(new URL(`../term-tests/${group}/bootstrap.js`,import.meta.url),'utf8');
 const found=text.match(new RegExp(`(?:async )?function ${name}\\([^]*?^  }`,'m'));
 assert.ok(found);return found[0];
}
for(const group of groups){
 for(const classCode of ['CODEXDEMO56','SYNTHETIC56'])for(const code of ['DEMO_ATTEMPT_NOT_FOUND','NETWORK_ERROR']){
  test(`${group}: initialize ${classCode}/${code}`,async()=>{
   const calls=[],error={status:code==='NETWORK_ERROR'?503:404,code,message:'fixture'};
   const context={initializing:false,initializeAgain:false,classCode,rememberedClasses:[],
    initializeStudentMemory:async()=>{},localDemo:false,restoreStartedAttempt:async()=>{throw error},
    recoverFromServerReset:e=>{calls.push(e);return e.status===404},showNotice:()=>{},navigator:{onLine:true},
    roster:[],encryptedAudio:null,preparing:false,elements:{bootstrapRetry:{hidden:true}}};
   await vm.runInNewContext(`(${source(group,'initialize')})()`,context);
   assert.equal(calls.length,classCode==='CODEXDEMO56'?1:0);
   assert.equal(context.initializing,false);
  });
 }
 for(const code of ['DEMO_ATTEMPT_NOT_FOUND','ATTEMPT_NOT_FOUND','EXAM_SESSION_NOT_FOUND']){
  test(`${group}: recover ${code} chỉ xóa cache bài đang mở`,()=>{
   const removed=[],queue=[],notice=[],context={state:{audioVolume:.6,studentRef:'old',attemptToken:'old'},
    classCode:'CODEXDEMO56',availableStorages:()=>[{removeItem:key=>removed.push(key)}],
    storageKey:'demo-state',uiStorageKey:'demo-ui',annotationStorageKey:'demo-annotation',
    elements:{bootstrapStudent:{value:'old'}},resetPreparation:()=>{},showNotice:m=>notice.push(m),
    queueMicrotask:fn=>queue.push(fn),legacyListeningResume:true};
   const result=vm.runInNewContext(`(${source(group,'recoverFromServerReset')})({status:404,code:${JSON.stringify(code)}})`,context);
   assert.equal(result,true);assert.deepEqual(removed,['demo-state','demo-ui','demo-annotation']);
   assert.equal(context.state.studentRef,undefined);assert.equal(context.state.audioVolume,.6);
   assert.equal(context.elements.bootstrapStudent.value,'');assert.equal(queue.length,1);
  });
 }
 test(`${group}: lỗi mạng không được xóa dữ liệu`,()=>{
  const context={classCode:'CODEXDEMO56',availableStorages:()=>{throw Error('Không được xóa nháp')}};
  assert.equal(vm.runInNewContext(`(${source(group,'recoverFromServerReset')})({status:503,code:'NETWORK_ERROR'})`,context),false);
 });
}
