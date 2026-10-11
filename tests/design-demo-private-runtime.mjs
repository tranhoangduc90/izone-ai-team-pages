// Chạy adapter bằng dữ liệu giả: khóa bài thật, giữ bài thử riêng và không ghi Storage thật.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const script=fs.readFileSync(new URL('../term-tests/design-demo/real-runtime.js',import.meta.url),'utf8');
function fixture(mode='blank',screen='reading'){
 const writes=[],network=[];const trial={listening:{1:'a'},reading:{},task1:'Draft',task2:'',plans:{}};
 const snapshot={listening:{1:'real'},reading:{1:'saved'},task1:'Original essay',task2:'Other essay',name:'Synthetic learner',grading:{ready:true,tasks:[]},result:{listening:{band:'<2.5'}}};
 const ctx={mode,screen,trial,snapshot,content:{baseTestSlug:'term-test-2'},grade:async()=>{trial.result={reading:{correct:0}};return trial.result;}};
 const w={REAL_DEMO:ctx,localStorage:{getItem:()=>null,setItem:(...v)=>writes.push(v)},fetch:async(...args)=>{network.push(args);return new Response('{}');}};
 vm.runInNewContext(script,{window:w,location:{href:'https://demo.example/real-exam.html'},URL,Response,Map,JSON,Date,Object,String,Number});
 const call=(suffix,body={})=>w.fetch(w.TERM_TEST_APP_CONFIG.API_BASE_URL+'/api/term-tests/'+suffix,{method:'POST',body:JSON.stringify(body)});
 return {w,ctx,trial,snapshot,writes,network,call};
}
test('bài thật: mọi đường lưu/nộp bị từ chối, bài và điểm nguyên vẹn',async()=>{
 const f=fixture('saved','result'),before=JSON.stringify(f.snapshot);
 for(const path of ['writing','term-test-2/reading','term-test-2/listening','term-test-2/reading/draft','demo/reset'])assert.equal((await f.call(path,{task1:'overwritten',answers:{1:'wrong'}})).status,403);
 assert.equal(JSON.stringify(f.snapshot),before);assert.equal(f.network.length,0);assert.equal(f.writes.length,0);
 const result=await (await f.call('result')).json();assert.equal(result.writing.task1,'Original essay');assert.equal(result.result.listening.band,'<2.5');
});
test('bản thử: viết/lưu/nộp riêng, Writing không nhận bài chấm giả',async()=>{
 const f=fixture();await f.call('term-test-2/reading/draft',{answers:{1:'trial'},revision:1});assert.equal(f.trial.reading[1],'trial');
 await f.call('writing',{task1:'Trial essay',task2:'Second trial',action:'submit',revision:2});const result=await(await f.call('result')).json();assert.equal(result.writing.grading.ready,false);assert.deepEqual(result.writing.grading.tasks,[]);assert.equal(f.snapshot.task1,'Original essay');assert.equal(f.writes.length,0);
});
test('bản thử: lưu bộ nhớ tab không chạm khóa bài thi trong Storage thật',()=>{
 const f=fixture();f.w.localStorage.setItem('izone-test:term-test-2:DEMO67',JSON.stringify({drafts:{listening:{2:'b'},reading:{},writing:{task1:'Saved draft'}}}));
 assert.equal(f.trial.task1,'Saved draft');assert.equal(f.writes.length,0);f.w.localStorage.setItem('izone-demo-color-lab-v2','palette');assert.equal(f.writes.length,1);
});
test('adapter: đường chưa hỗ trợ hoặc gọi API thật bị từ chối, không trả thành công giả',async()=>{
 const f=fixture();assert.equal((await f.call('unknown')).status,404);assert.equal((await f.w.fetch('https://actual.example/api/term-tests/writing')).status,403);assert.equal(f.network.length,0);
});
