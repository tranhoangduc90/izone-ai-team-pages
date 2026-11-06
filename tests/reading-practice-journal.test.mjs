import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckpointWindow} from '../shared/reading-practice-journal.mjs';

test('checkpoint summary đếm ACK/lỗi/unknown theo cửa sổ, không phát một event mỗi request',()=>{
 let now=0;const rows=[],window=createCheckpointWindow({emit:row=>rows.push(row),now:()=>now});
 const a=window.begin(10);now=20;a('confirmed');const b=window.begin(12);now=50;b('unknown');
 assert.equal(window.flush(),false);assert.equal(rows.length,0);now=60001;assert.equal(window.flush(),true);
 assert.deepEqual(rows,[{requests:2,confirmed:1,rejected:0,unknown:1,pendingRequests:0,firstSequence:10,lastSequence:12,durationMs:60001,maxRequestMs:30}]);
 assert.equal(window.flush(true),false);
});
test('callback đảo thứ tự và gửi finish hai lần không đếm đôi; request pending là số đang chờ',()=>{
 let now=0;const rows=[],window=createCheckpointWindow({emit:row=>rows.push(row),now:()=>now});
 const a=window.begin(5),b=window.begin(8);now=100;b('rejected');assert.equal(b('confirmed'),false);
 window.flush(true);assert.equal(rows[0].requests,1);assert.equal(rows[0].pendingRequests,1);assert.equal(rows[0].firstSequence,5);assert.equal(rows[0].lastSequence,8);
 now=200;a('confirmed');window.flush(true);
 assert.equal(rows.reduce((n,row)=>n+row.requests,0),2);assert.equal(rows[1].maxRequestMs,200);assert.equal(window.pending,0);
});
test('đổi lượt trong lúc chờ: callback cũ vẫn kết thúc bộ đếm cũ',()=>{
 let now=0;const rows=[];
 const old=createCheckpointWindow({emit:row=>rows.push({owner:'old',...row}),now:()=>now});
 const finish=old.begin(7);old.flush(true);
 const next=createCheckpointWindow({emit:row=>rows.push({owner:'next',...row}),now:()=>now});
 now=50;next.begin(1)('confirmed');next.flush(true);now=100;finish('unknown');old.flush(true);
 assert.equal(rows.find(row=>row.owner==='next').unknown,0);assert.equal(rows.filter(row=>row.owner==='old').reduce((n,row)=>n+row.unknown,0),1);
});
test('thời gian chờ trước request đầu không làm sai thời lượng, request rất lâu có trần',()=>{
 let now=0;const rows=[],window=createCheckpointWindow({emit:row=>rows.push(row),now:()=>now});
 now=86400000;const finish=window.begin(1);now+=250;finish('confirmed');window.flush(true);assert.equal(rows[0].durationMs,250);
 const slow=window.begin(2);now+=900000;slow('unknown');window.flush(true);assert.equal(rows[1].durationMs,600000);assert.equal(rows[1].maxRequestMs,600000);
});
