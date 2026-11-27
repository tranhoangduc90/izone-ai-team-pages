import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationBudget} from '../term-tests/substitute-skill-shared/preparation-budget-20261127-v1.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('một hạn chung chặn promise treo và không nhận kết quả muộn',async()=>{
 const budget=preparationBudget(30);let finish,adopted=false;
 const work=(async()=>{await budget.wait(new Promise(r=>finish=r));adopted=true;})();
 await assert.rejects(work,e=>e.code==='ASSIGNMENT_PREPARATION_TIMEOUT');finish();await pause(10);
 assert.equal(adopted,false);assert.equal(budget.signal.aborted,true);budget.close();
});
test('các bước dùng chung hạn, retry có budget mới',async()=>{
 const first=preparationBudget(40);await first.wait(pause(25));
 await assert.rejects(first.wait(pause(30)),e=>e.code==='ASSIGNMENT_PREPARATION_TIMEOUT');first.close();
 const retry=preparationBudget(40);assert.equal(await retry.wait(Promise.resolve('same attempt')),'same attempt');retry.close();
});
test('đóng hạn sau chuẩn bị không hủy bài đang làm',async()=>{
 const budget=preparationBudget(15);budget.close();await pause(25);assert.equal(budget.signal.aborted,false);
});
