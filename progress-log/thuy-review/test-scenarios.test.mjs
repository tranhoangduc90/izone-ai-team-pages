// Kiểm số giả ổn định, đúng đơn vị và luôn có nhãn, không đọc dữ liệu lớp thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {testScenario} from './test-scenarios.mjs';
test('Cùng người/Test luôn cùng số giả; đủ ba kỹ năng và nhận xét nguyên văn có nhãn',()=>{
 for(const slug of ['mini-test-lesson-5','term-test-1','term-test-2']){
  for(const ref of ['người thử A','người thử B']){
   const value=testScenario(ref,slug);assert.deepEqual(value,testScenario(ref,slug));assert.equal(value.synthetic,true);
   for(const skill of ['listening','reading']){assert.ok(value[skill].correct>=0&&value[skill].correct<=value[skill].total);assert.equal(value[skill].total,slug==='mini-test-lesson-5'?20:40);}
   assert.ok(value.writing.score>=0&&value.writing.score<=9);
   for(const task of [1,2])assert.match(value.writing.tasks[task].feedback,/Dữ liệu giả/);
  }
 }
 assert.equal(testScenario('người thử','bài không có'),null);
});
