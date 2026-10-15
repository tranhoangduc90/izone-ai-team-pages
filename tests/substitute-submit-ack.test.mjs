import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const modules=['substitute-k56-shared','substitute-test-2-k56-shared','substitute-k67-shared'];
function harness(module,response){
 const source=fs.readFileSync(new URL('../term-tests/'+module+'/app.js',import.meta.url),'utf8');
 const start=source.indexOf('  async function apiRequest('),end=source.indexOf('\n  window.addEventListener',start);
 const context=vm.createContext({URL,AbortController,setTimeout,clearTimeout,window:{location:{origin:'https://fixture.invalid'},SUBSTITUTE_STATE:{blocked:false,track:()=>()=>{},payload:x=>x,stop(){}},TERM_TEST_BOOTSTRAP:{examSessionId:'fixture'}},
  appConfig:{API_BASE_URL:'https://fixture.invalid'},serverGradingMode:true,location:{origin:'https://fixture.invalid'},testConfig:{slug:'substitute-test-2-k56',reading:{totalQuestions:40}},
  fetch:async()=>({ok:true,status:200,json:async()=>response})});
 vm.runInContext(source.slice(start,end),context);return context.apiRequest;
}
for(const module of modules){
 for(const response of [{},{ok:false,code:'SECTIONS_NOT_SUBMITTED'},{section:null}])test(`${module}: không nhận thành công phản hồi rỗng/sai của Listening và Writing`,async()=>{
  const request=harness(module,response);
  for(const [route,body]of [['/api/test/grade',{examId:'listening'}],['/api/test/writing',{}]])
   await assert.rejects(request(route,{body:JSON.stringify(body)}));
 });
 test(`${module}: nhận điểm 0 thật, từ chối phần lưu chưa xác nhận`,async()=>{
  const section={correct:0,total:40,typeStats:[],details:Array.from({length:40},(_,i)=>({number:i+1,result:'blank',studentAnswer:'',correctAnswer:'Fixture'}))};
  const request=harness(module,{persisted:true,snapshotHash:'a'.repeat(64),submittedAt:'2026-10-15T00:00:00Z',section});
  assert.equal((await request('/api/test/grade',{body:JSON.stringify({examId:'listening'})})).section.correct,0);
  await assert.rejects(harness(module,{section})('/api/test/grade',{body:JSON.stringify({examId:'listening'})}));
 });
 test(`${module}: từ chối chi tiết hỏng trước chuyển bước, không để nổ trang kết quả`,async()=>{
  const receipt={persisted:true,snapshotHash:'a'.repeat(64),submittedAt:'2026-10-15T00:00:00Z',section:{correct:0,total:40,typeStats:[null],details:Array(40).fill(null)}};
  await assert.rejects(harness(module,receipt)('/api/test/grade',{body:JSON.stringify({examId:'listening'})}));
 });
}
