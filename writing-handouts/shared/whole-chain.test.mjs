import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,beginCheck,finishCheck,openIdea2,canEdit} from '../lesson5-demo/core.mjs';
import {wholeSections} from './whole-chain-ui.mjs';
import {renderRecap} from '../lesson5-thu/recovery-ui.mjs';
import {card} from '../lesson5/teacher-dashboard.mjs';
import {renderActivityList} from '../lesson5/activity-ui.mjs';
const mode={workflowMode:'whole-chain-v1'};
test('L9-UI · một ý có ba trường và một nút Check, giữ khóa ý 2',()=>{
 const s=createState(0,mode);s.steps.topic.status='passed';
 assert.equal(canEdit(s,'si1'),true);assert.equal(canEdit(s,'si2'),false);
 s.responses.a1='A';s.responses.b1='B';assert.equal(beginCheck(s,'si1','missing').field,'x1');s.responses.x1='X';
 const {ticket}=beginCheck(s,'si1','once');assert.equal(ticket.snapshot.a1,'A');assert.equal(canEdit(s,'si1'),false);
 finishCheck(s,ticket,'passed','Đã nối được. 👍');assert.equal(openIdea2(s),true);assert.equal(canEdit(s,'si2'),true);
 const html=wholeSections(s,{field:f=>`<textarea data-field="${f}"></textarea>`,comments:()=>'',stepCard:()=>''});
 assert.equal((html.match(/data-check="si2"/g)||[]).length,1);assert.equal((html.match(/data-field="[axb]2"/g)||[]).length,3);assert.ok(!html.includes('data-check="b2"'));
});
test('L9-UI-VOCAB · chỉ một bảng chung sáu nhóm, một lần retry, giữ đúng ý',()=>{
 const s=createState(0,mode);for(const step of Object.values(s.steps))step.status='passed';s.body=1;
 for(const n of [1,2])for(const p of ['a','x','b'])s.responses[p+n]=p+n;
 s.vocabulary={0:{status:'ready',groups:Object.fromEntries(['A1','X1','B1','A2','X2','B2'].map(k=>[k,[{phrase:k+' phrase',meaningVi:'Nghĩa '+k}]]))}};
 const html=renderRecap(s);assert.match(html,/thân bài 1/);for(const k of ['A1','X1','B1','A2','X2','B2'])assert.ok(html.includes(k+' phrase'));
 s.vocabulary[0].status='failed';const failed=renderRecap(s);assert.equal((failed.match(/data-vocab-retry="all"/g)||[]).length,1);assert.ok(!failed.includes('data-vocab-retry="1"'));
});
test('L9-UI-GV · người chưa bắt đầu cũng có ba phần; nhật ký không gọi SI là Topic',()=>{
 const html=card({studentRef:'sample',displayName:'Mẫu',sessionRef:null},{order:['topic','si1','si2']});assert.match(html,/0\/3/);assert.ok(!html.includes('B1'));
 const history=renderActivityList([{kind:'check_queued',section:'si2',event_at:'2026-10-17T00:00:00Z'},{kind:'check_queued',section:null,idea_index:0,event_at:'2026-10-17T00:00:00Z'}]);assert.match(history,/Cả chuỗi ý 2/);assert.match(history,/Từ vựng chung/);
});
