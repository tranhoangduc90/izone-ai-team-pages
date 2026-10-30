import test from 'node:test';
import assert from 'node:assert/strict';
import {latestSkillTest,studentTestRecords,resultTime} from '../progress-log/student-test-results.js';
test('mới nhất riêng L/R: bỏ ngày nhập, giữ điểm 0 và không dùng phân tích bài cũ dưới bài mới',()=>{
 const rows=[{testSlug:'mini-test-1',completedAt:null,observedAt:'2026-10-30T10:00:00Z',listening:{correct:10,total:10}},
  {testSlug:'term-test-1',completedAt:'2026-10-01T10:00:00Z',listening:{correct:0,total:10,analysis:{status:'available'}},reading:{correct:4,total:10}},
  {testSlug:'term-test-2',completedAt:'2026-10-20T10:00:00Z',reading:{correct:7,total:10}},
  {testSlug:'term-test-2',completedAt:'2026-10-21T10:00:00Z',listening:{correct:3,total:10}}];
 assert.equal(latestSkillTest(rows,'reading').reading.correct,7);assert.equal(latestSkillTest(rows,'listening').listening.correct,3);
 assert.equal(latestSkillTest(rows,'listening').listening.analysis,undefined);assert.equal(resultTime({completedAt:'2026-10-21T10:00:00'}),null);
 assert.equal(studentTestRecords(rows).length,3);assert.equal(latestSkillTest(rows.slice(0,2),'listening').listening.correct,0);
});
