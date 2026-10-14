// Kiểm bản đọc lịch sử bằng dữ liệu giả: giữ payload và chặn mọi đường ghi/Storage thật.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../term-tests/design-full/'+name,import.meta.url),'utf8');
test('saved renderer keeps exact essay/grade/review payload and rejects mutations and external APIs',async()=>{
 const snapshot={name:'Người giả',task2:' Original essay ',listening:{1:'A'},reading:{1:'B'},result:{listening:{correct:0}},grading:{ready:true,tasks:[{taskNumber:2,taskScore:0,report:'Exact report'}]}};
 const window={REAL_DEMO:{mode:'saved',snapshot,content:{title:'Synthetic'},screen:'result'},TERM_TEST_CONFIG:{slug:'term-test-1'},fetch:async()=>new Response('asset')};
 Object.defineProperty(window,'localStorage',{configurable:true,get(){throw Error('Must not read real storage');}});
 vm.runInNewContext(read('saved-runtime.js'),{window,location:{href:'https://demo.example/term-tests/design-full/saved.html',origin:'https://demo.example'},URL,Map,JSON,Response,Error});
 const base=window.TERM_TEST_APP_CONFIG.API_BASE_URL;
 const result=await(await window.fetch(base+'/api/term-tests/result',{method:'POST'})).json();assert.equal(result.writing.task2,snapshot.task2);assert.deepEqual(result.writing.grading,snapshot.grading);assert.deepEqual(result.result,snapshot.result);
 const review=await(await window.fetch(base+'/api/term-tests/result/review',{method:'POST'})).json();assert.equal(review.review.testSlug,'term-test-1');assert.equal(review.review.answers.writing.task2,snapshot.task2);
 for(const path of ['/api/term-tests/writing','/api/term-tests/writing/planning','/api/term-tests/term-test-1/listening','/api/term-tests/demo/reset'])assert.equal((await window.fetch(base+path,{method:'POST',body:'{}'})).status,403);
 assert.equal((await window.fetch('https://foreign.example/api/term-tests/writing',{method:'POST'})).status,403);
 assert.equal((await window.fetch('https://demo.example/api/term-tests/writing',{method:'POST'})).status,403);
 assert.equal((await window.fetch('https://demo.example/theme.css')).status,200);
});
test('saved adapter rejects trial contexts rather than replacing the native trial engine',()=>{
 assert.throws(()=>vm.runInNewContext(read('saved-runtime.js'),{window:{REAL_DEMO:{mode:'blank'}},Error}),/chỉ dùng/);
});
