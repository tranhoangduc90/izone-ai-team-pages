import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync('term-tests/k56-test2-shared/app.js','utf8');
const render=source.slice(source.indexOf('  function renderWritingSubmission()'),source.indexOf('  function addSummaryCard('));
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.events={};this.textContent='';this.hidden=false;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
 addEventListener(name,fn){this.events[name]=fn;}
}
function fixture(grading,submitted=true,classCode='CODEXDEMO56'){
 const target=new Element('section');const opened=[];
 const context=vm.createContext({document:{createElement:tag=>new Element(tag)},writingConfig:{tasks:[{id:'task1'}]},elements:{writingSubmissionResult:target},state:{classCode,writingSubmitted:submitted,result:{writing:{grading}}},formatBand:value=>value==null?'—':String(value),openWritingFeedback:task=>opened.push(task),refreshWritingGrading:async()=>{}});
 vm.runInContext(render,context);context.renderWritingSubmission();return {target,opened};
}
function flatten(node){return [node,...node.children.flatMap(flatten)];}
test('Task 1 có điểm và nút xem đúng bài chấm cho cả hai lớp',()=>{
 const task={taskNumber:1,taskScore:7.5,criteria:[]};
 for(const classCode of ['CODEXDEMO56','IC2264']){
  const {target,opened}=fixture({ready:true,status:'ready',writingScore:7.5,tasks:[task]},true,classCode);
  const nodes=flatten(target);const card=nodes.find(n=>n.className==='writing-score-card is-action');assert.ok(card);
  assert.deepEqual(card.children.map(n=>n.textContent),['Writing Task 1','Band 7.5','Xem bài chấm chi tiết →']);
  assert.ok(!nodes.some(n=>n.textContent==='Writing Task 2'||n.textContent==='Band —'));
  card.events.click();assert.equal(opened[0],task);
 }
});
test('đang chấm không tạo thẻ điểm giả',()=>{
 const {target}=fixture({ready:false,status:'processing',tasks:[]});const nodes=flatten(target);
 assert.ok(nodes.some(n=>n.textContent==='Đang chấm Task 1'));assert.ok(!nodes.some(n=>n.className==='writing-score-card is-action'));
});
test('chưa nộp ẩn và xóa phần kết quả Writing',()=>{
 const {target}=fixture(null,false);assert.equal(target.hidden,true);assert.equal(target.children.length,0);
});
test('bộ nạp và Answer Sheet dùng cache mới cho thẻ Task 1',()=>{
 for(const file of ['term-tests/term-test-2-k56-computer-based/bootstrap.js','term-tests/term-test-2-k56-computer-based/index.html','term-tests/term-test-2-k56/index.html'])assert.match(fs.readFileSync(file,'utf8'),/20260913-writing-revision-v1-task1-result-v2/);
});
