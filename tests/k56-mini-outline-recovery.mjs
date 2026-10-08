import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture} from './fixtures/d08-writing-revision-vm.mjs';
const source=fs.readFileSync('term-tests/k56-mini-shared/app.js','utf8');
test('E04 Mini: fresh client khôi phục dàn ý canonical riêng với essay',()=>{
 const h=fixture(source,{writingDirty:false,writingConfirmedDraft:null,drafts:{writing:{outline:'',task1:'',task2:''}}});
 h.run(`applyWritingFromServer({outline:'Server outline',task1:'',task2:'Server essay',revision:5,started:true})`);
 assert.deepEqual(h.state().drafts.writing,{outline:'Server outline',task1:'',task2:'Server essay'});
});
test('E04 Mini: ACK sai/thiếu dàn ý không báo đã lưu và không bỏ dirty',async()=>{
 for(const outline of ['wrong outline',undefined]){
  const h=fixture(source);h.reply({ok:true,writing:{accepted:true,revision:6,outline,task1:'local task 1',task2:'local task 2',started:true}});
  await assert.rejects(h.run("saveWritingToServer('draft')"));assert.equal(h.state().writingDirty,true);assert.equal(h.state().drafts.writing.outline,'local outline');
 }
});
test('E04 Mini: outline-only thay đổi tạo conflict; không tự đè server/tab cũ',()=>{
 const h=fixture(source,{writingDirty:true,writingConfirmedDraft:{task1:'local task 1',task2:'local task 2',outline:'old outline'}});
 h.run(`applyWritingFromServer({outline:'Other tab outline',task1:'local task 1',task2:'local task 2',revision:6,started:true})`);
 assert.equal(h.state().writingConflict.outline,'Other tab outline');assert.equal(h.state().drafts.writing.outline,'local outline');
});
test('E04 Mini: chọn server giữ dàn ý local trong mục phục hồi',()=>{
 const h=fixture(source);h.run(`setWritingConflict({outline:'Server outline',task1:'server task 1',task2:'server task 2',revision:6,started:true});resolveWritingConflict(true)`);
 assert.equal(h.state().drafts.writing.outline,'Server outline');assert.ok(h.state().writingRecovery.some(d=>d.outline==='local outline'));
});
