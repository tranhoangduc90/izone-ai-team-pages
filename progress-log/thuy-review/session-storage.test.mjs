// Kiểm phần đệm và luật phục hồi bằng dữ liệu demo; IndexedDB thật được kiểm thêm trên browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDemoStore} from './demo-store.mjs';
import {draftJournal,draftKey,JOURNAL_PREFIX,applySessionChange,sessionDatabase} from './session-storage.mjs';
const source=JSON.parse(await readFile(new URL('./demo-data.json',import.meta.url),'utf8'));
const fresh=()=>({version:1,epoch:'epoch-a',revision:0,package:createDemoStore(source).exportPackage()});
const session=source.data.sessions.find(v=>v.number===8),item=session.definition.blocks[0].items[0];
const body=(ref='demo-a',responses={[item.itemVersionId]:'G'})=>({action:'draft',number:8,generation:session.generation,ref,responses});
function memory(){
 const map=new Map();let blocked=false;
 const storage={get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:key=>map.get(key)??null,setItem:(key,value)=>{if(blocked)throw Error('QuotaExceededError');map.set(key,value)},removeItem:key=>map.delete(key)};
 return {map,storage,block:()=>blocked=true};
}
test('Bản đệm giữ ngay các ô độc lập, tách người/buổi/lần giao và không ghi đè cả bài',()=>{
 const env=memory(),journal=draftJournal(()=>env.storage),a=body();
 journal.save(draftKey(a),'epoch-a',a);journal.save(draftKey(a),'epoch-a',body('demo-a',{second:'Phần viết có dấu'}));
 const b=body('demo-b');journal.save(draftKey(b),'epoch-a',b);
 const other={...a,number:10,generation:2};journal.save(draftKey(other),'epoch-a',other);
 assert.deepEqual(journal.get(draftKey(a)).body.responses,{[item.itemVersionId]:'G',second:'Phần viết có dấu'});
 assert.equal(journal.list().length,3);assert.equal(journal.get(draftKey(other)).body.number,10);
});
test('Dọn bản đã nhận không xóa keystroke mới hơn hoặc phiếu tự soạn',()=>{
 const env=memory(),journal=draftJournal(()=>env.storage),a=body();env.storage.setItem('own-form','giữ');
 journal.save(draftKey(a),'epoch-a',a);const accepted=journal.list();
 journal.save(draftKey(a),'epoch-a',body('demo-a',{[item.itemVersionId]:'D'}));journal.clearAccepted(accepted);
 assert.equal(journal.get(draftKey(a)).body.responses[item.itemVersionId],'D');assert.equal(env.storage.getItem('own-form'),'giữ');
 journal.clearAccepted(journal.list());assert.equal(journal.list().length,0);
});
test('Lỗi quota và record hỏng giữ nguyên bản trước, không tự xóa',()=>{
 const env=memory(),journal=draftJournal(()=>env.storage),a=body();journal.save(draftKey(a),'epoch-a',a);const before=[...env.map];env.block();
 assert.throws(()=>journal.save(draftKey(a),'epoch-a',body('demo-a',{[item.itemVersionId]:'D'})),/Chưa lưu được/);assert.deepEqual([...env.map],before);
 env.map.set(JOURNAL_PREFIX+'broken','{sai-json');assert.throws(()=>journal.list());assert.equal(env.map.get(JOURNAL_PREFIX+'broken'),'{sai-json');
});
test('Đặt lại chỉ dọn nháp của phiên lớp; giữ hộp AI và phiếu tự soạn',()=>{
 const env=memory(),journal=draftJournal(()=>env.storage),a=body();journal.save(draftKey(a),'epoch-a',a);
 journal.save('feedbackDraft:8:0:demo-a','epoch-a',{action:'feedbackDraft',number:8,generation:0,ref:'demo-a',text:'Nháp riêng'});
 journal.save('ai:form-a','authoring',{action:'authoringAI',value:{source:'Đề đang dán'}});env.storage.setItem('own-form','không xóa');journal.clearSessionDrafts();
 assert.equal(journal.list().length,1);assert.equal(journal.get('ai:form-a').body.value.source,'Đề đang dán');assert.equal(env.storage.getItem('own-form'),'không xóa');
});
test('Phục hồi nháp trước thao tác khác không tự nộp hoặc ghi nhận tham gia',()=>{
 const env=memory(),journal=draftJournal(()=>env.storage),a=body();journal.save(draftKey(a),'epoch-a',a);const old=fresh(),before=structuredClone(old);
 const restored=applySessionChange(old,undefined,journal.list()),store=createDemoStore(restored.record.package),student=store.student(8,'demo-a');
 assert.equal(student.responses[item.itemVersionId],'G');assert.equal(student.participated,false);assert.equal(student.submitted,false);assert.deepEqual(student.checkpoints,[]);assert.deepEqual(old,before);
 const next=applySessionChange(restored.record,body('demo-b',{[item.itemVersionId]:'D'}));const both=createDemoStore(next.record.package);
 assert.equal(both.student(8,'demo-a').responses[item.itemVersionId],'G');assert.equal(both.student(8,'demo-b').responses[item.itemVersionId],'D');
});
test('Yêu cầu lưu cũ không ghi đè ô mới hơn trong bản đệm; lỗi lưu không commit nửa chừng',()=>{
 const env=memory(),journal=draftJournal(()=>env.storage),a=body();journal.save(draftKey(a),'epoch-a',body('demo-a',{[item.itemVersionId]:'D'}));const original=fresh(),before=structuredClone(original);
 assert.throws(()=>applySessionChange(original,{...a,failSave:true},journal.list()),/Lỗi lưu/);assert.deepEqual(original,before);
 const saved=applySessionChange(original,a,journal.list());assert.equal(createDemoStore(saved.record.package).student(8,'demo-a').responses[item.itemVersionId],'D');
});
test('Thay bài giữ nháp vào archive; reset về baseline nguồn và tạo mã phiên mới',()=>{
 const env=memory(),journal=draftJournal(()=>env.storage),a=body();journal.save(draftKey(a),'epoch-a',a);
 const replaced=applySessionChange(fresh(),{action:'replace',number:8,generation:session.generation,template:9},journal.list());const store=createDemoStore(replaced.record.package),s=store.teacher().sessions.find(v=>v.number===8);
 assert.equal(s.generation,session.generation+1);assert.equal(s.retired[0].fake.find(([key])=>key.endsWith(':demo-a'))[1].responses[item.itemVersionId],'G');assert.equal(store.student(8,'demo-a').participated,false);
 const reset=applySessionChange(replaced.record,{action:'reset'});assert.notEqual(reset.record.epoch,replaced.record.epoch);const initial=createDemoStore(reset.record.package).teacher().sessions.find(v=>v.number===8);
 assert.equal(initial.generation,session.generation);assert.equal(initial.title,session.title);assert.deepEqual(initial.retired,session.retired);
});
test('Nháp sai mã phiên không vào phiên mới; bản lưu khác phiên bản không bị ghi đè',async()=>{
 const env=memory(),journal=draftJournal(()=>env.storage),a=body();journal.save(draftKey(a),'epoch-old',a);const old=fresh();
 const restored=applySessionChange(old,undefined,journal.list());assert.deepEqual(createDemoStore(restored.record.package).student(8,'demo-a').responses,{});assert.equal(restored.accepted.length,0);
 const corrupt={...old,version:9},before=structuredClone(corrupt);assert.throws(()=>applySessionChange(corrupt,a),/phiên bản khác/);assert.deepEqual(corrupt,before);
 await assert.rejects(sessionDatabase(undefined),/Chưa lưu được/);
});
