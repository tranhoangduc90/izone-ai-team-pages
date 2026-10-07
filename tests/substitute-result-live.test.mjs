import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Kiểm hành vi render thật; không thay renderer bằng mock thực hiện điều cần chứng minh.
class Element {
  constructor(tag) { this.tagName=tag;this.children=[];this.dataset={};this.events={};this.open=false; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=nodes; }
  addEventListener(name,fn) { this.events[name]=fn; }
  setAttribute() {}
}
const flatten=node=>[node,...node.children.flatMap(flatten)];
const modules=['substitute-k56-shared','substitute-test-2-k56-shared','substitute-k67-shared'];
function sourceFunction(source,name) {
  const start=source.search(new RegExp('  (?:async )?function '+name+'\\('));
  assert.ok(start>=0,name);
  const rest=source.slice(start),next=rest.slice(1).search(/\n  (?:async )?function /);
  return next<0?rest:rest.slice(0,next+1);
}
function fixture(module) {
  const source=fs.readFileSync(new URL('../term-tests/'+module+'/app.js',import.meta.url),'utf8');
  const elements=Object.fromEntries(['resultStudentName','resultMeta','summaryGrid','resultStatus','continueReadingFromResult','writingSubmissionResult','questionDetails','skillPerformanceSections'].map(k=>[k,new Element('div')]));
  const context=vm.createContext({document:{createElement:t=>new Element(t),hidden:false,addEventListener(){}},navigator:{onLine:true},elements,promptVersion:'fixture-v1',
    twoTaskWriting:false,serverGradingMode:true,demoMode:'exam',storageKey:'fixture-own-attempt',classCode:'DEMO',
    writingConfig:{tasks:[{id:module.includes('test-2-k56')?'task1':'task2'}]},testConfig:{title:'Bài giả'},
    state:{studentRef:'fictional-A',attemptToken:'fictional-run-A',writingSubmitted:true,resultDetailsOpen:{}},
    resultDetailSignature:'',renderSkillPerformance:()=>new Element('section'),sectionScore:()=>'',
    saveSession:()=>{},stopWritingGradingPolling:()=>{},countWords:()=>0,formatBand:String,
    window:{SUBSTITUTE_STATE:{blocked:false},addEventListener(){},clearTimeout(){},setTimeout:()=>{context.timers++;return 1;}},
    timers:0,writingGradingPollTimer:0,writingGradingPollStartedAt:Date.now()-46*60*1000,writingGradingPollCount:100,writingGradingPollInFlight:false,
    refreshWritingGrading:()=>{},Date});
  for(const name of ['renderWritingSubmission','addSummaryCard','renderDetailBlock','renderResult','scheduleWritingGradingRefresh'])vm.runInContext(sourceFunction(source,name),context);
  return context;
}
const payload=ready=>({studentName:'Học viên giả',className:'DEMO',result:{listening:{details:[{number:1,studentAnswer:'x',correctAnswer:'x',result:'correct'}]},reading:{details:[{number:1,studentAnswer:'',correctAnswer:'y',result:'blank'}]}},writing:{grading:ready?{ready:true,writingScore:7,tasks:[]}:{ready:false,status:'processing'}}});
for(const module of modules) {
  test(module+': cập nhật Writing không thay DOM hoặc đóng Listening/Reading',()=>{
    const c=fixture(module);c.renderResult(payload(false));
    const initial=[...c.elements.questionDetails.children];initial[0].open=true;initial[0].events.toggle?.();
    for(const ready of [false,false,true]) {c.renderResult(payload(ready));assert.equal(c.elements.questionDetails.children[0],initial[0]);assert.equal(initial[0].open,true);}
  });
  test(module+': giữ lựa chọn mở đã lưu khi dựng lại cùng lượt',()=>{
    const c=fixture(module);c.state.resultDetailsOpen={listening:true,reading:false};c.renderResult(payload(false));
    assert.equal(c.elements.questionDetails.children[0].open,true);assert.equal(c.elements.questionDetails.children[1].open,false);
  });
  test(module+': chờ Writing tự cập nhật, không có nút kiểm tra thủ công',()=>{
    const c=fixture(module);c.renderResult(payload(false));const nodes=flatten(c.elements.writingSubmissionResult);
    assert.equal(nodes.filter(n=>n.tagName==='button').length,0);
    assert.ok(nodes.some(n=>n.textContent==='Bài làm của học viên đang được chấm, kết quả sẽ hiện lại sau'));
  });
  test(module+': chấm quá 45 phút vẫn tiếp tục theo dõi với nhịp thưa',()=>{
    const c=fixture(module);c.state.result=payload(false);c.scheduleWritingGradingRefresh();assert.equal(c.timers,1);
  });
  test(module+': phản hồi chậm sau đổi lượt không ghi hoặc render vào lượt mới',async()=>{
    const c=fixture(module),source=fs.readFileSync(new URL('../term-tests/'+module+'/app.js',import.meta.url),'utf8');let resolve;
    c.state.drafts={listening:{},reading:{},writing:{task2:''}};c.state.testGrades={};
    c.apiRequest=()=>new Promise(done=>{resolve=done;});c.renderResult=()=>{throw Error('STALE_RENDER');};c.buildDemoPayload=()=>({});
    vm.runInContext(sourceFunction(source,'refreshWritingGrading'),c);
    const pending=c.refreshWritingGrading();c.state.attemptToken='fictional-run-B';resolve({grading:{ready:true}});await pending;
    assert.deepEqual(Object.keys(c.state.testGrades),[]);
  });
  test(module+': mạng offline dừng polling; online tiếp tục chỉ đọc trạng thái',()=>{
    const c=fixture(module),source=fs.readFileSync(new URL('../term-tests/'+module+'/app.js',import.meta.url),'utf8');c.state.result=payload(false);
    c.navigator.onLine=false;c.scheduleWritingGradingRefresh();assert.equal(c.timers,0);
    c.navigator.onLine=true;let reads=0;c.refreshWritingGrading=()=>{reads++;};vm.runInContext(sourceFunction(source,'resumeWritingGrading'),c);c.resumeWritingGrading();assert.equal(reads,1);
    c.state.result.writing.grading={ready:false,status:'failed'};c.resumeWritingGrading();c.scheduleWritingGradingRefresh();assert.equal(reads,1);assert.equal(c.timers,0);
  });
}
