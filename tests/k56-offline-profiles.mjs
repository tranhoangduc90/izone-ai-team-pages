import test from 'node:test';import assert from 'node:assert/strict';
import{ExamStore as Store1,exportHtml as export1}from'../term-tests/term-test-1-k56-computer-based/offline.mjs';
import{ExamStore as Store2,exportHtml as export2}from'../term-tests/term-test-2-k56-computer-based/offline.mjs';
test('Hai profile dùng cùng lõi nhưng kho và Task không lẫn; export Term1 đủ41/26 ô',async()=>{
 const map=new Map(),local={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const one=await new Store1({idb:null,local}).open(),two=await new Store2({idb:null,local}).open();await one.put('run:same-id',{essay:'term1'});assert.equal(await two.get('run:same-id'),null);await two.put('run:same-id',{essay:'term2'});assert.equal((await one.get('run:same-id')).essay,'term1');assert.equal((await two.get('run:same-id')).essay,'term2');
 const record={classCode:'FIXTURE',prepared:{attemptToken:'private-attempt-id',offline:{permit:'private-permit'}},snapshot:{drafts:{listening:{'32a':'first half','32b':'second half'},reading:{26:'last reading'},writing:{task1:'WRONG_TASK',task2:'RIGHT_TASK'}}},sections:{},operations:[]};
 const html=export1(record),term2=export2(record);assert.ok(html.includes('<td>32a</td><td>first half'));assert.ok(html.includes('<td>32b</td><td>second half'));assert.ok(html.includes('<td>26</td><td>last reading'));assert.ok(html.includes('<h2>Writing Task 2</h2><pre>RIGHT_TASK'));assert.ok(term2.includes('<h2>Writing Task 1</h2><pre>WRONG_TASK'));assert.ok(!html.includes('private-permit'));assert.equal((html.match(/<tr><td>/g)||[]).length,67);
});
