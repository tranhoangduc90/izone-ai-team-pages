import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
  constructor(tag) { this.tag=tag; this.children=[]; this.textContent=''; this.events={}; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute() {}
  addEventListener(name,fn) { this.events[name]=fn; }
  querySelector(tag) { return flatten(this).find(node=>node.tag===tag); }
  showModal() { this.open=true; }
  close() { this.open=false; }
  remove() {}
}
const flatten=node=>[node,...node.children.flatMap(flatten)];
const tree=node=>({tag:node.tag,className:node.className||'',text:node.textContent,children:node.children.map(tree)});
const teacher=fs.readFileSync('term-tests/teacher-k56/app.js','utf8');
const teacherBody=teacher.slice(teacher.indexOf('function cleanWritingFeedback('),teacher.indexOf('async function loadTeacherWritingDetail('));

function render(module,taskNumber,classCode,teacherMode=false,components=true) {
  const body=new Element('body');
  const task={id:'task'+taskNumber,label:'Task '+taskNumber,prompt:'Synthetic question'};
  const essay='  Synthetic essay.\n\nOriginal paragraph spacing.  ';
  const input={taskNumber,taskScore:7.5,wordCount:12,prompt:task.prompt,essay,
    report:'Overall summary\n---\n## Nhận xét từng tiêu chí\nDo not duplicate',
    criteria:['TR','CC','LR','GRA'].map(code=>({code,name:code,bandScore:7,
      feedback:'Full criterion feedback\n\n### KẾT LUẬN\nKeep this conclusion too.',
      components:components?[{label:'Synthetic aspect',summary:'Aspect summary',feedback:'Full aspect analysis'}]:[]}))};
  const context=vm.createContext({document:{body,createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text})},
    crypto:{randomUUID:()=> 'synthetic'},appConfig:{API_BASE_URL:'https://example.invalid'},
    writingConfig:{tasks:[task]},state:{studentName:'Synthetic learner',classCode,selectedTestSlug:module==='k56-mini-shared'?'mini-test-k56':'term-test-1-k56',drafts:{writing:{[task.id]:essay}},result:{writing:{[task.id]:essay}}},
    formatBand:value=>Number(value).toFixed(1),countWords:()=>12,criterionTitle:code=>code,
    writingTaskLabel:()=>task.label,writingScoreLabel:()=>module==='k56-mini-shared'?'Điểm đoạn văn':'Band',
    createNode:(tag,className='',text='')=>Object.assign(new Element(tag),{className,textContent:text})});
  const source=fs.readFileSync('term-tests/'+module+'/app.js','utf8');
  vm.runInContext(teacherMode?teacherBody:source.slice(source.indexOf('  function cleanWritingFeedback('),source.indexOf('  function renderWritingSubmission(')),context);
  context.input=input;
  vm.runInContext(teacherMode?'openTeacherWritingFeedback("Synthetic learner",input)':'openWritingFeedback(input)',context);
  return flatten(body);
}

for(const module of ['k56-shared','k56-test2-shared','k56-mini-shared']) {
  for(const classCode of ['CODEXDEMO56','IC2264']) {
    for(const taskNumber of module==='k56-test2-shared'?[1,2]:[2]) {
      test(`${module} ${classCode} Task ${taskNumber}: hai cột và nội dung giống giáo viên`,()=>{
        const student=render(module,taskNumber,classCode),staff=render(module,taskNumber,classCode,true);
        for(const name of ['writing-feedback-source','writing-feedback-scores'])
          assert.deepEqual(tree(student.find(n=>n.className===name)),tree(staff.find(n=>n.className===name)));
        const toggle=student.find(n=>n.className==='writing-component-toggle');
        const detail=student.find(n=>n.className?.startsWith('writing-component-detail '));
        assert.equal(detail.hidden,true);toggle.events.click();assert.equal(detail.hidden,false);toggle.events.click();assert.equal(detail.hidden,true);
      });
    }
  }
  test(module+': nhận xét không có component vẫn giữ đầy đủ như giáo viên',()=>{
    const student=render(module,2,'CODEXDEMO56',false,false),staff=render(module,2,'CODEXDEMO56',true,false);
    assert.deepEqual(tree(student.find(n=>n.className==='writing-feedback-scores')),tree(staff.find(n=>n.className==='writing-feedback-scores')));
  });
}

test('CSS cửa sổ học viên sao chép đúng mẫu giáo viên, không nạp CSS quản trị',()=>{
  const staff=fs.readFileSync('term-tests/teacher-k56/styles.css','utf8').replace(/\r/g,'');
  const student=fs.readFileSync('term-tests/k56-writing-feedback/styles.css','utf8').replace(/\r/g,'');
  assert.ok(student.includes(staff.slice(staff.indexOf('.writing-feedback-dialog {'),staff.indexOf('@media (max-width: 900px)')).trim()));
  assert.ok(student.includes(staff.slice(staff.lastIndexOf('  .writing-feedback-dialog {')).trim()));
  assert.ok(!student.includes('.teacher-'));
  for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56']) {
    const bootstrap=fs.readFileSync('term-tests/'+slug+'-computer-based/bootstrap.js','utf8');
    assert.equal(bootstrap.split('\n').filter(line=>line.includes('app.js?v=')&&line.includes('teacher-parity-v1')).length,2);
    assert.match(fs.readFileSync('term-tests/'+slug+'-computer-based/index.html','utf8'),/styles.css\?rev=[^"\s]*teacher-parity-v1/);
  }
});
