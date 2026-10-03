import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const routes=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'];
async function run(slug,{record,blocked=false,localDemo=true,confirmed=true}={}) {
 const source=fs.readFileSync(new URL('../term-tests/'+slug+'-computer-based/bootstrap.js',import.meta.url),'utf8');
 const calls=[];
 const saved=record===undefined?{studentRef:'demo-01',attemptToken:'12345678-1234-4234-8234-123456789abc',testGrades:{listening:{correct:2,total:40}},writingSubmitted:true}:record;
 const storage={getItem(key){assert.equal(key,`izone-test:${slug}:DEMO:server-grade`);if(blocked)throw new Error('blocked');return typeof saved==='string'?saved:JSON.stringify(saved);}};
 const c=vm.createContext({sessionStorage:storage,localStorage:storage,Date,crypto:{randomUUID:()=> 'fake-id'},
 testConfig:{slug},classCode:'DEMO',localDemo,state:{classCode:'DEMO',studentRef:'demo-01',identityConfirmed:confirmed,listeningStartedAt:'2026-09-30T08:00:00Z'},
 roster:[{ref:'demo-01',name:'DEMO'}],elements:{bootstrapStudent:{value:'demo-01'},bootstrapClass:{}},preparing:false,legacyListeningResume:false,
 saveState:delta=>Object.assign(c.state,delta),enterExam:async value=>calls.push({kind:'enter',value}),downloadLocalDemoAudio:async()=>calls.push({kind:'audio'}),
 apiRequest:async()=>{calls.push({kind:'server'});return{};},downloadForSession:async()=>{},resumeAfterListening:async()=>{},showNotice:()=>{},setStartAvailability:()=>{},
 window:{K56_SUBSTITUTE_TEST_CONTENT:{},K56_SUBSTITUTE_TEST_2_CONTENT:{},K67_SUBSTITUTE_TEST_1_CONTENT:{},K67_SUBSTITUTE_TEST_2_CONTENT:{}}
 });
 for(const name of ['hasSavedGradedProgress','prepareSelectedStudent']){
  const prefix=name==='prepareSelectedStudent'?'  async function ':'  function ';
  const at=source.indexOf(prefix+name+'(');if(at<0)continue;
  const rest=source.slice(at);const next=rest.slice(1).search(/\n  (?:async )?function /);
  vm.runInContext(next<0?rest:rest.slice(0,next+1),c);
 }
 await c.prepareSelectedStudent();return calls;
}
for(const slug of routes){
 test(slug+': reload bài đã chấm mở app kết quả, không tải/phát lại audio hoặc gọi submit',async()=>{
  const calls=await run(slug);assert.deepEqual(calls.map(c=>c.kind),['enter']);assert.equal(calls[0].value.listeningSubmitted,true);
 });
 test(slug+': không khôi phục bài của học viên khác',async()=>assert.deepEqual((await run(slug,{record:{studentRef:'other',attemptToken:'12345678-1234-4234-8234-123456789abc',testGrades:{listening:{correct:2,total:40}}}})).map(c=>c.kind),['audio']));
 test(slug+': không mở kết quả từ dữ liệu hỏng hoặc storage bị chặn',async()=>{
  for(const options of [{record:'bad-json'},{blocked:true},{record:{studentRef:'demo-01',testGrades:{listening:{}}}}])assert.deepEqual((await run(slug,options)).map(c=>c.kind),['audio']);
 });
 test(slug+': nhánh thi thật không đọc trạng thái chấm DEMO',async()=>assert.deepEqual((await run(slug,{localDemo:false,blocked:true})).map(c=>c.kind),['server']));
}
