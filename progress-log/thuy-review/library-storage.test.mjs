// Giả lập bộ nhớ trình duyệt để kiểm tải lại, lỗi lưu và hai tab không làm mất phiếu.
import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryStorage,LIBRARY_PREFIX} from './library-storage.mjs';
const memory=()=>{const data=new Map();return {get length(){return data.size},key:n=>[...data.keys()][n],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const form=(id='one',revision=1)=>({schemaVersion:3,id,title:'Phiếu thử',source:'mine',status:'draft',revision,sections:[],questions:[]});
test('Lưu/mở lại giữ đầy đủ câu, gợi ý và ký tự; mỗi phiếu không chạm khóa khác',()=>{
 const storage=memory(),writer=libraryStorage(()=>storage),first=form();
 first.questions=[{id:'q',type:'open',prompt:'Kế hoạch?',answer:'Dòng 1\nDòng 2 <&>'}];
 storage.setItem('other-app','giữ nguyên');writer.save(first);writer.save(form('two'));
 const loaded=libraryStorage(()=>storage).load();
 assert.deepEqual(loaded.library.forms.find(f=>f.id==='one'),first);assert.equal(loaded.library.forms.length,2);assert.equal(storage.getItem('other-app'),'giữ nguyên');
});
test('Tự giữ phần đang sửa không thay bản đã xuất bản; lưu chủ động mới thay',()=>{
 const storage=memory(),writer=libraryStorage(()=>storage),published={...form(),status:'published'},working={...published,title:'Đang sửa',questions:[{id:'q',answer:'Gợi ý mới'}]};
 writer.save(published);writer.save(published,working);
 let loaded=writer.load();assert.deepEqual(loaded.library.forms[0],published);assert.equal(loaded.working.one.status,'draft');assert.equal(loaded.working.one.title,'Đang sửa');
 writer.save({...working,status:'published',revision:2});loaded=writer.load();assert.deepEqual(loaded.working,{});assert.equal(loaded.library.forms[0].title,'Đang sửa');
});
test('Tab cũ không ghi đè bản mới; lưu phiếu khác giữ cả hai',()=>{
 const storage=memory(),a=libraryStorage(()=>storage),b=libraryStorage(()=>storage);a.save(form());b.save(form('two'));b.save({...form('one',2),title:'Bản mới'});
 assert.throws(()=>a.save(form(),form()),/tab khác/);assert.throws(()=>a.save(form('one',2)),/tab khác/);
 assert.equal(a.load().library.forms.length,2);assert.equal(a.load().library.forms.find(f=>f.id==='one').title,'Bản mới');
});
test('Bộ nhớ bị chặn, đầy hoặc JSON hỏng không báo thành công, không xóa bản cũ',()=>{
 assert.throws(()=>libraryStorage(()=>{throw Error('blocked')}).load(),/blocked/);
 const storage=memory(),writer=libraryStorage(()=>storage);writer.save(form());const old=storage.getItem(LIBRARY_PREFIX+'one');storage.setItem=()=>{throw Error('quota')};
 assert.throws(()=>writer.save(form('one',2)),/Chưa lưu được nháp/);assert.equal(storage.getItem(LIBRARY_PREFIX+'one'),old);
 const broken=memory();broken.setItem(LIBRARY_PREFIX+'one','not-json');assert.throws(()=>libraryStorage(()=>broken).load());assert.equal(broken.getItem(LIBRARY_PREFIX+'one'),'not-json');
});
