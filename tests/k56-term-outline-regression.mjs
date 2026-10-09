
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fixture} from './fixtures/k56-term-outline-vm.mjs';
const root=process.env.TERM_OUTLINE_PAGES_ROOT || path.resolve(import.meta.dirname,'..');
const canonical={outline:'Dàn ý server — nguyên văn',task1:'local task 1',task2:'local task 2',revision:6,started:true,submitted:false};
for(const app of ['k56-shared','k56-test2-shared']){
 const source=fs.readFileSync(path.join(root,'term-tests',app,'app.js'),'utf8');
 test(`${app}: trình duyệt mới khôi phục outline và essay cùng revision`,()=>{
  const h=fixture(source,{writingDirty:false,writingConfirmedDraft:null,drafts:{writing:{outline:'',task1:'',task2:''}}});
  h.run(`applyWritingFromServer(${JSON.stringify(canonical)},true)`);
  assert.equal(h.state().drafts.writing.outline,canonical.outline);assert.equal(h.state().drafts.writing.task2,canonical.task2);assert.equal(h.state().writingServerRevision,6);
 });
 test(`${app}: ACK sai hoặc thiếu outline không được coi là đã lưu`,async()=>{
  for(const outline of ['Dàn ý khác',undefined]){
   const h=fixture(source);h.reply({ok:true,writing:{...canonical,outline,accepted:true}});
   await assert.rejects(h.run("saveWritingToServer('draft')"));
   assert.equal(h.state().drafts.writing.outline,'local outline');assert.equal(h.state().writingServerRevision,5);assert.equal(h.state().writingDirty,true);
  }
 });
 test(`${app}: ACK muộn không ghi đè dàn ý vừa sửa khi essay không đổi`,async()=>{
  const h=fixture(source);let finish;h.transport(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=h.run("saveWritingToServer('draft')");await h.dispatched();
  h.run("state.writingRevision=4;state.drafts.writing.outline='Ý mới chỉ sửa dàn ý'");
  finish({ok:true,writing:{...canonical,outline:'local outline',accepted:true}});await pending;
  assert.equal(h.state().drafts.writing.outline,'Ý mới chỉ sửa dàn ý');assert.equal(h.state().writingDirty,true);assert.deepEqual(h.scheduled,[0]);
 });
 test(`${app}: late submit dùng canonical, giữ outline local trong bản phục hồi`,async()=>{
  const h=fixture(source);h.reply({ok:true,writing:{...canonical,accepted:false,submitted:true,reason:'deadline_expired'}});
  await h.run("saveWritingToServer('submit')");
  assert.equal(h.state().drafts.writing.outline,canonical.outline);assert.equal(h.state().writingSubmitted,true);
  assert.ok(h.state().writingRecovery.some(x=>x.outline==='local outline'));assert.equal(h.elements.writingRecovery.hidden,false);
 });
 test(`${app}: dàn ý local cũ khác server được giữ để người học chọn`,()=>{
  const h=fixture(source,{writingDirty:false,writingConfirmedDraft:null,drafts:{writing:{outline:'Ý local chưa xác nhận',task1:'',task2:''}}});
  h.run(`applyWritingFromServer(${JSON.stringify({...canonical,task1:'',task2:''})})`);
  assert.equal(h.state().drafts.writing.outline,'Ý local chưa xác nhận');assert.equal(h.state().writingDirty,true);assert.equal(h.state().writingConflict.revision,6);
 });
 test(`${app}: substitute giữ dàn ý local và hợp đồng ACK cũ`,async()=>{
  const h=fixture(source,{testSlug:'substitute-test-1-k56'});h.reply({ok:true,writing:{...canonical,outline:undefined,accepted:true}});
  await h.run("saveWritingToServer('draft')");assert.equal(h.state().drafts.writing.outline,'local outline');assert.equal(h.state().writingDirty,false);
 });
}
