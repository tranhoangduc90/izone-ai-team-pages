// Nhận fixture bài giả; kiểm hành vi học viên cần thấy, không gọi dịch vụ thật.
// Assertion dùng thứ tự người dùng yêu cầu làm chuẩn, không suy đáp án từ renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ORDER,EXAMPLE,VOCAB,createState,available,canEdit,setField,beginCheck,finishCheck,ideaPassed,openIdea2,fixture,restore} from './core.mjs';
const submit=(s,key,id,result='passed')=>{const started=beginCheck(s,key,id);assert.equal(started.ok,true);assert.equal(finishCheck(s,started.ticket,result,'Nhận xét giả '+id),true);return started.ticket;};
test('T-FLOW: Topic rồi B1 A1 X1, chuyển ý, B2 A2 X2',()=>{
 const s=createState();s.responses={...EXAMPLE};
 for(const [i,key] of ORDER.entries()){if(key==='b2')assert.equal(openIdea2(s),true);assert.equal(available(s,key),true);submit(s,key,String(i));assert.equal(canEdit(s,key),false);}
 assert.equal(ideaPassed(s,1),true);assert.equal(ideaPassed(s,2),true);
});
test('T-LOCK: không vượt bước, mở ý2 hoặc sửa phần đạt',()=>{
 const s=createState();s.responses={...EXAMPLE};assert.equal(openIdea2(s),false);
 for(const key of ['b1','a1','x1','b2','a2','x2'])assert.equal(beginCheck(s,key,key).ok,false);
 submit(s,'topic','one');assert.equal(setField(s,'topic','idea1','đổi'),false);
 submit(s,'b1','two');assert.equal(available(s,'x1'),false);assert.equal(available(s,'b2'),false);
 submit(s,'a1','three');assert.equal(openIdea2(s),false);
 submit(s,'x1','four');assert.equal(available(s,'b2'),false);assert.equal(openIdea2(s),true);assert.equal(available(s,'b2'),true);
});
test('T-INVALID: ô trống chặn chấm, dữ liệu khóa ngoài section bị chặn',()=>{
 const s=createState();assert.equal(beginCheck(s,'topic','empty').error,'EMPTY');
 assert.equal(setField(s,'topic','b1','không được ghi'),false);assert.equal(s.steps.topic.history.length,0);
});
test('T-HISTORY: mỗi lượt giữ snapshot cũ và phản hồi tương ứng',()=>{
 const s=createState();s.responses={...EXAMPLE};submit(s,'topic','v1','revision');const first=s.responses.topicSentence;
 setField(s,'topic','topicSentence','Câu đã sửa');submit(s,'topic','v2');assert.equal(s.steps.topic.history.length,2);assert.equal(s.steps.topic.history[0].snapshot.topicSentence,first);assert.equal(s.steps.topic.history[1].snapshot.topicSentence,'Câu đã sửa');
});
test('T-ASYNC: chấm trùng hoặc kết quả muộn sau reset không mở khóa',()=>{
 const s=createState(1);s.responses={...EXAMPLE};const {ticket}=beginCheck(s,'topic','pending');assert.equal(beginCheck(s,'topic','duplicate').ok,false);assert.equal(setField(s,'topic','topicSentence','đổi'),false);
 const newer=fixture('sample',2);assert.equal(finishCheck(newer,ticket,'passed','muộn'),false);assert.equal(newer.steps.topic.status,'draft');
 assert.equal(finishCheck(s,ticket,'passed','đúng'),true);assert.equal(finishCheck(s,ticket,'passed','trùng'),false);assert.equal(s.steps.topic.history.length,1);
});
test('T-RESTORE: giữ tiến độ/lịch sử; pending gián đoạn thành lỗi, JSON hỏng hồi phục',()=>{
 const s=fixture('idea1');const restored=restore(JSON.stringify(s),5);assert.equal(ideaPassed(restored,1),true);assert.equal(restored.idea2Open,false);assert.equal(restored.responses.x1,EXAMPLE.x1);
 const pending=fixture('sample');beginCheck(pending,'topic','in-flight');const r=restore(JSON.stringify(pending),4);assert.equal(r.steps.topic.status,'technical_error');assert.equal(canEdit(r,'topic'),true);
 assert.equal(restore('{oops').steps.topic.status,'draft');
 const done=restore(JSON.stringify(fixture('complete')),7);assert.equal(ideaPassed(done,2),true);
});
test('T-ERROR: lỗi kỹ thuật giữ nháp, không tạo Comment cần sửa; thử lại được',()=>{
 const s=fixture('sample');submit(s,'topic','error','technical_error');assert.equal(s.steps.topic.history.length,0);assert.equal(s.responses.idea1,EXAMPLE.idea1);assert.equal(canEdit(s,'topic'),true);submit(s,'topic','retry');assert.equal(s.steps.topic.history.length,1);
});
test('T-VOCAB: chỉ sau đủ ba điểm đúng ý; 2 cụm mỗi A/X/B, không quá 5 từ',()=>{
 const s=fixture('sample');for(const key of ['topic','b1','a1']){submit(s,key,key);assert.equal(ideaPassed(s,1),false);}submit(s,'x1','x1');assert.equal(ideaPassed(s,1),true);assert.equal(ideaPassed(s,2),false);
 for(const n of [1,2])for(const point of ['A','X','B']){assert.equal(VOCAB[n][point].length,2);for(const [phrase,meaning]of VOCAB[n][point]){assert.ok(phrase.split(' ').length<=5);assert.ok(meaning.length>0);}}
});
