// Chạy chính khối nhận danh tính của ứng dụng với trạng thái giả; đếm API thay vì so chữ.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const [slug,folder] of [['term-test-1-k56','k56-shared'],['term-test-2-k56','k56-test2-shared'],['mini-test-k56','k56-mini-shared']])
for(const scenario of ['verified','different-person','different-class','different-test','different-attempt','no-proof'])
test(`${slug}: danh tính ${scenario}`,async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../term-tests',folder,'app.js'),'utf8');
  const start=source.indexOf('      const restored = window.TERM_TEST_BOOTSTRAP?.restoredIdentity;');
  const end=source.indexOf('      populateRoster(roster);',start);assert.ok(start>0&&end>start);
  const state={studentRef:'person-A',attemptToken:'attempt-A'};
  const restored={testSlug:slug,classCode:'IC9900',...state,studentName:'Tên máy chủ'};
  if(scenario==='different-person')restored.studentRef='person-B';
  if(scenario==='different-class')restored.classCode='IC9901';
  if(scenario==='different-test')restored.testSlug='other';
  if(scenario==='different-attempt')restored.attemptToken='attempt-B';
  let reads=0,roster;
  const context={window:{TERM_TEST_BOOTSTRAP:{restoredIdentity:scenario==='no-proof'?null:restored}},state,testConfig:{slug},classCode:'IC9900',encodeURIComponent,
    apiRequest:async()=>{reads++;return{students:[{ref:'person-A',name:'Tên mới từ nguồn'}]};},populateRoster:r=>{roster=r;}};
  vm.createContext(context);await vm.runInContext('(async()=>{'+source.slice(start,end+'      populateRoster(roster);'.length)+'})()',context);
  assert.equal(reads,scenario==='verified'?0:1);assert.equal(roster.students[0].name,scenario==='verified'?'Tên máy chủ':'Tên mới từ nguồn');
});
