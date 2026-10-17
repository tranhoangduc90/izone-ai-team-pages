import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Oracle là nội dung nguồn giả độc lập: UI phải giữ kết luận có sẵn, không tự chấm.
class Element {
  constructor(tag) { this.tag=tag;this.children=[];this.events={};this.textContent=''; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute() {} addEventListener(name,fn) { this.events[name]=fn; }
  querySelector(tag) { return flatten(this).find(node=>node.tag===tag); }
  showModal() {} close() {} remove() {}
}
const flatten=node=>[node,...node.children.flatMap(flatten)];
const cases=[['k56-shared',2],['k56-test2-shared',1],['k56-mini-shared',2],['teacher-k56',1],['teacher-k56',2]];
function render(module,taskNumber,variant) {
  const teacher=module==='teacher-k56',source=fs.readFileSync(`term-tests/${module}/app.js`,'utf8');
  const start=source.indexOf((teacher?'':'  ')+'function cleanWritingFeedback(');
  const end=source.indexOf(teacher?'async function loadTeacherWritingDetail(':'  function renderWritingSubmission(');
  assert.ok(start>=0&&end>start);
  const root=new Element('body'),task={id:`task${taskNumber}`,label:`Task ${taskNumber}`,prompt:'Đề giả'};
  const context=vm.createContext({
    document:{body:root,createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text})},
    crypto:{randomUUID:()=> 'fake-detail'},appConfig:{API_BASE_URL:'https://example.invalid'},
    writingConfig:{tasks:[task]},state:{studentName:'Học viên giả',classCode:'CODEXDEMO56',selectedTestSlug:`term-test-${taskNumber===1?2:1}-k56`,drafts:{writing:{[task.id]:'Bài giả'}},result:{writing:{[task.id]:'Bài giả'}}},
    formatBand:value=>Number(value).toFixed(1),countWords:()=>2,criterionTitle:code=>code,
    writingTaskLabel:()=>task.label,writingScoreLabel:()=> 'Band',
    createNode:(tag,className='',text='')=>Object.assign(new Element(tag),{className,textContent:text})
  });
  const base=taskNumber===1?'TA':'TR';
  const criteria=[base,'CC','LR','GRA'].map(code=>({code,bandScore:6.5,
    feedback:variant==='absent'?'Nhận xét nguồn không có kết luận.':`## ${code}\nNhận xét chung độc lập ${code}.\n### 1. Khía cạnh\nTóm tắt nguồn ${code}.\n### **KẾT LUẬN**\n**Band 3**\nGiới hạn nguồn ${code}: bài dưới 120 từ.`,
    components:[{code:code+'_fake',label:'Khía cạnh giả',summary:'Tóm tắt component.',feedback:'Chi tiết component.'}]}));
  if(variant==='gra')criteria[3].feedback='## GRA\nNhận xét GRA tổng hợp cần giữ.\n### **KẾT LUẬN**\n**Band 5**\nGiới hạn GRA từ nguồn: độ dài.';
  if(variant.startsWith('indent'))for(const criterion of criteria) {
    criterion.feedback=variant==='indent'
      ?criterion.feedback.replace(/^### \*\*KẾT LUẬN/gm,'  ### **KẾT LUẬN')
      :criterion.feedback.replace(/^#/gm,'  #');
    if(variant==='indent-summary')criterion.components[0].summary='';
  }
  context.input={taskNumber,taskScore:6.5,wordCount:2,prompt:task.prompt,essay:'Bài giả',report:'',criteria};
  vm.runInContext(source.slice(start,end),context);
  vm.runInContext(teacher?'openTeacherWritingFeedback("Học viên giả",input)':'openWritingFeedback(input)',context);
  return flatten(root);
}
for(const [module,task] of cases) {
  test(`${module} Task${task}: giữ kết luận band cap nguồn khi có component`,()=>{
    const nodes=render(module,task,'present'),cards=nodes.filter(n=>n.className==='writing-criterion-card');
    assert.equal(cards.length,4);
    for(const [index,code] of [task===1?'TA':'TR','CC','LR','GRA'].entries()) {
      const text=flatten(cards[index]).map(n=>n.textContent).join('\n');
      assert.ok(text.includes(`Giới hạn nguồn ${code}: bài dưới 120 từ.`),`Thiếu kết luận nguồn ${code}`);
      assert.ok(text.includes('Chi tiết component.'));
    }
  });
  test(`${module} Task${task}: GRA một component giữ cả nhận xét chung và kết luận`,()=>{
    const card=render(module,task,'gra').filter(n=>n.className==='writing-criterion-card')[3];
    const text=flatten(card).map(n=>n.textContent).join('\n');
    assert.ok(text.includes('Nhận xét GRA tổng hợp cần giữ.'));
    assert.ok(text.includes('Giới hạn GRA từ nguồn: độ dài.'));
  });
  test(`${module} Task${task}: nguồn không có kết luận thì không bịa band cap`,()=>{
    const nodes=render(module,task,'absent'),text=nodes.map(n=>n.textContent).join('\n');
    assert.doesNotMatch(text,/KẾT LUẬN|Giới hạn nguồn|Giới hạn GRA/);
    assert.equal(nodes.filter(n=>n.className==='writing-criterion-card').length,4);
  });
  test(`${module} Task${task}: heading có khoảng trắng vẫn giữ kết luận nguồn đúng một lần`,()=>{
    const cards=render(module,task,'indent').filter(n=>n.className==='writing-criterion-card');
    for(const [index,code] of [task===1?'TA':'TR','CC','LR','GRA'].entries()) {
      const text=flatten(cards[index]).map(n=>n.textContent).join('\n');
      assert.equal(text.split(`Giới hạn nguồn ${code}: bài dưới 120 từ.`).length-1,1);
    }
  });
  test(`${module} Task${task}: heading thụt dòng và summary rỗng không lặp nội dung khía cạnh`,()=>{
    const cards=render(module,task,'indent-summary').filter(n=>n.className==='writing-criterion-card');
    for(const [index,code] of [task===1?'TA':'TR','CC','LR','GRA'].entries()) {
      const text=flatten(cards[index]).map(n=>n.textContent).join('\n');
      assert.equal(text.split(`Tóm tắt nguồn ${code}.`).length-1,1);
      assert.equal(text.split(`Giới hạn nguồn ${code}: bài dưới 120 từ.`).length-1,1);
    }
  });
}
