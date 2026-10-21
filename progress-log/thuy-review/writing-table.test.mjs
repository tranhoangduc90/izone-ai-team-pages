// Kiểm đúng định nghĩa thiếu dữ liệu và thứ tự Writing, không dùng bài thi thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {writingSummary,compareWritingPeople} from './model.mjs';
const result=(slug,score,feedback='')=>({testSlug:slug,writing:{score,tasks:{1:{feedback}}}});
const person=(name,results)=>({name,writing:writingSummary(results)});
test('Điểm 0, một Test có điểm hoặc chỉ có nhận xét vẫn là có dữ liệu',()=>{
 assert.equal(writingSummary([result('mini',0)]).hasData,true);
 assert.equal(writingSummary([result('term1',null,'Nhận xét gốc')]).hasData,true);
 assert.equal(writingSummary([{testSlug:'term2',writing:{tasks:{2:{feedback:'Nhận xét Task 2'}}}}]).hasData,true);
 assert.equal(writingSummary([null,result('term2',undefined,'  ')]).hasData,false);
 assert.equal(writingSummary([result('mini',NaN)]).hasData,false);
});
test('Sắp theo từng Test giảm dần, hòa điểm theo tên; thiếu điểm không thành 0',()=>{
 const rows=[person('Bình',[result('mini',7)]),person('An',[result('mini',7)]),person('Dũng',[result('mini',0)]),person('Cúc',[result('term2',8)]),person('Anh',[])];
 const before=JSON.stringify(rows);
 assert.deepEqual([...rows].sort((a,b)=>compareWritingPeople(a,b,'test:mini')).map(v=>v.name),['An','Bình','Dũng','Cúc','Anh']);
 assert.deepEqual([...rows].sort((a,b)=>compareWritingPeople(a,b,'test:term2')).map(v=>v.name),['Cúc','An','Bình','Dũng','Anh']);
 assert.equal(JSON.stringify(rows),before);
});
test('Tên A–Z trong từng nhóm, người chưa có toàn bộ dữ liệu ở cuối giống mẫu',()=>{
 const rows=[person('An',[]),person('Châu',[result('mini',null,'Chỉ nhận xét')]),person('Bình',[result('mini',5)])];
 assert.deepEqual([...rows].sort(compareWritingPeople).map(v=>v.name),['Bình','Châu','An']);
 assert.deepEqual(writingSummary([]),{hasData:false,scores:{}});
});
test('Hai Term Test tăng dần vẫn giữ điểm 0, hòa theo tên và ô thiếu cuối',()=>{
 for(const slug of ['term-test-1','term-test-2']){
  const rows=[person('Bình',[result(slug,4)]),person('An',[result(slug,4)]),person('Dũng',[result(slug,0)]),person('Châu',[result(slug,8)]),person('Anh',[]),person('Hà',[result('mini',7)])];
  assert.deepEqual([...rows].sort((a,b)=>compareWritingPeople(a,b,'test-asc:'+slug)).map(v=>v.name),['Dũng','An','Bình','Châu','Hà','Anh']);
  assert.deepEqual([...rows].sort((a,b)=>compareWritingPeople(a,b,'test:'+slug)).map(v=>v.name),['Châu','An','Bình','Dũng','Hà','Anh']);
 }
});
