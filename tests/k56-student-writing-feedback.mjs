import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const modules=['k56-shared','k56-test2-shared','k56-mini-shared'];
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.textContent='';}
  append(...items){this.children.push(...items);}
  setAttribute(){} addEventListener(type,fn){this.events[type]=fn;}
  showModal(){this.open=true;} close(){this.open=false;} remove(){}
}
const flatten=node=>[node,...node.children.flatMap(flatten)];
function fixture(module,{classCode='CODEXDEMO56',essay='  Synthetic essay\n\nSecond paragraph.  ',report='Synthetic overall feedback',serverEssay}={}) {
  const source=fs.readFileSync('term-tests/'+module+'/app.js','utf8');
  const body=source.slice(source.indexOf('  function writingReportSummary('),source.indexOf('  function renderWritingSubmission('));
  const root=new Element('body');const taskNumber=module==='k56-test2-shared'?1:2;
  const task={id:'task'+taskNumber,label:'Task '+taskNumber,prompt:'Synthetic question'};
  const context=vm.createContext({document:{body:root,createElement:tag=>new Element(tag)},
    writingConfig:{tasks:[task]},state:{classCode,drafts:{writing:{[task.id]:essay}},result:{writing:serverEssay===undefined?{}:{[task.id]:serverEssay}}},
    cleanWritingFeedback:value=>String(value||'').trim(),formatBand:n=>n==null?'—':Number(n).toFixed(1),
    countWords:text=>text.trim().split(/\s+/).length,criterionTitle:code=>code,writingCriterionSections:()=>[],writingCriterionFallbackSummary:value=>value,
    appendSafeWritingFeedback:(node,text)=>node.textContent=text,
    appendWritingComponent:()=>{}});
  vm.runInContext(body,context);
  context.input={taskNumber,taskScore:7.5,report,criteria:['TA','CC','LR','GRA'].map((code,i)=>({code,bandScore:i===0?7:8,feedback:'Synthetic criterion'}))};
  context.openWritingFeedback(context.input);
  return {nodes:flatten(root),context,taskNumber};
}
for(const module of modules) {
  for(const classCode of ['CODEXDEMO56','IC2264'])test(module+': cửa sổ học viên '+classCode+' hiện tổng điểm, 4 tiêu chí, nhận xét và bài gốc',()=>{
    const {nodes}=fixture(module,{classCode});
    const summary=nodes.find(n=>n.className==='k56-writing-band-summary');
    const grid=summary.children[1];assert.equal(grid.children.length,5);
    const label=module==='k56-mini-shared'?'Điểm đoạn văn':'Band';
    assert.equal(grid.children[0].children[1].textContent,label+' 7.5');
    assert.deepEqual(grid.children.slice(1).map(n=>n.children[0].textContent),['TA','CC','LR','GRA']);
    assert.ok(nodes.some(n=>n.textContent==='Nhận xét tổng hợp'));
    assert.ok(nodes.some(n=>n.textContent==='Synthetic overall feedback'));
    assert.equal(nodes.find(n=>n.className==='writing-feedback-essay').textContent,'  Synthetic essay\n\nSecond paragraph.  ');
    assert.equal(nodes.filter(n=>n.className==='writing-criterion-card').length,4);
  });
  test(module+': ưu tiên bài server và hiển thị essay bằng text, không HTML',()=>{
    const essay='<img src=x onerror=alert(1)>\nOriginal synthetic text.';
    const {nodes}=fixture(module,{serverEssay:essay});
    const node=nodes.find(n=>n.className==='writing-feedback-essay');
    assert.equal(node.textContent,essay);assert.equal(node.children.length,0);
  });
  test(module+': không tạo nhận xét giả khi report trống; bài trống có thông báo',()=>{
    const {nodes}=fixture(module,{report:'',essay:''});
    assert.ok(!nodes.some(n=>n.textContent==='Nhận xét tổng hợp'));
    assert.ok(nodes.some(n=>n.textContent==='Chưa có nội dung bài viết.'));
  });
  test(module+': nhận xét tổng hợp không lặp khối từng tiêu chí',()=>{
    const {context}=fixture(module);
    assert.equal(context.writingReportSummary('Overall\n---\n## Nhận xét từng tiêu chí\nDuplicate'),'Overall');
  });
}
test('cả hai nhánh bootstrap và HTML dùng bản cửa sổ học viên mới',()=>{
  for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56']){
    const bootstrap=fs.readFileSync('term-tests/'+slug+'-computer-based/bootstrap.js','utf8');
    assert.equal((bootstrap.match(/app\.js\?v=[^'"]*student-feedback-v1/g)||[]).length,2);
    const html=fs.readFileSync('term-tests/'+slug+'-computer-based/index.html','utf8');
    assert.match(html,/bootstrap\.js\?v=[^"]*student-feedback-v1/);
    assert.match(html,/k56-writing-feedback\/styles.css\?rev=20260914-student-feedback-v1/);
  }
});
