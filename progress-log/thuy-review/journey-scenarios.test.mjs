// Kiểm tình huống giả đúng quy tắc và không ghi vào nguồn học viên thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyScenarios,scenarioSummary} from './journey-scenarios.mjs';

test('Bảy tình huống có ba người ưu tiên; dùng được độc lập cho Listening và Reading',()=>{
  assert.equal(new Set(journeyScenarios.map(p=>p.studentRef)).size,7);
  for(const skill of ['listening','reading']){
    const flagged=journeyScenarios.filter(p=>scenarioSummary(p,skill).flagged).map(p=>p.id);
    assert.deepEqual(flagged,['low','decline','zero']);
  }
  assert.ok(journeyScenarios.every(p=>p.synthetic&&p.name.startsWith('Học viên giả')));
});
test('Tiến bộ, mới giảm và ngưỡng 60% xét ba buổi gần nhất, không xét TB cả khóa',()=>{
  const get=id=>scenarioSummary(journeyScenarios.find(p=>p.id===id),'listening');
  assert.equal(get('decline').average,65);assert.equal(get('decline').recentAverage,45);
  assert.ok(get('recovery').average<60);assert.equal(get('recovery').recentAverage,75);
  assert.equal(get('boundary').recentAverage,60);assert.equal(get('boundary').flagged,false);
});
test('Thiếu khác 0%; tính toán không làm đổi bộ dữ liệu giả hoặc ảnh hưởng kỹ năng khác',()=>{
  const before=JSON.stringify(journeyScenarios);
  const get=id=>scenarioSummary(journeyScenarios.find(p=>p.id===id),'reading');
  assert.equal(get('insufficient').count,2);assert.equal(get('insufficient').recentAverage,null);
  assert.equal(get('missing').count,0);assert.equal(get('missing').average,null);
  assert.equal(get('zero').count,3);assert.equal(get('zero').recentAverage,100/3);
  assert.equal(scenarioSummary(journeyScenarios[0],'speaking').count,0);
  assert.equal(JSON.stringify(journeyScenarios),before);
});
