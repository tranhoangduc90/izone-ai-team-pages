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

function render(module,taskNumber,classCode,teacherMode=false,components=true,promptImage) {
  const body=new Element('body');
  const task={id:'task'+taskNumber,label:'Task '+taskNumber,prompt:'Synthetic question'};
  const essay='  Synthetic essay.\n\nOriginal paragraph spacing.  ';
  const input={promptImage,taskNumber,taskScore:7.5,wordCount:12,prompt:task.prompt,essay,
    report:'Overall summary\n---\n## Nhận xét từng tiêu chí\nDo not duplicate',
    criteria:['TR','CC','LR','GRA'].map(code=>({code,name:code,bandScore:7,
      feedback:'Full criterion feedback\n\n### KẾT LUẬN\nKeep this conclusion too.',
      components:components?[{label:'Synthetic aspect',summary:'Aspect summary',feedback:'Full aspect analysis'}]:[]}))};
  const context=vm.createContext({URL,document:{body,createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text})},
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


for (const [label,image] of [['không có ảnh',undefined],['ảnh trống',null],['chỉ khoảng trắng','   ']]) test('Task2 '+label+': popup không tạo ảnh hỏng',()=>{const nodes=render('k56-shared',2,'CODEXDEMO56',true,true,image);assert.equal(nodes.filter(n=>n.tag==='img').length,0);assert.equal(nodes.filter(n=>n.className==='writing-component-toggle').length,4);});
for (const [label,image,expected] of [['Task1 data PNG','data:image/png;base64,aGVsbG8=','data:image/png;base64,aGVsbG8='],['Task1 ảnh cùng API','/api/chart.png','https://example.invalid/api/chart.png']]) test(label+': giữ ảnh đề',()=>{const nodes=render('k56-test2-shared',1,'CODEXDEMO56',true,true,image),imgs=nodes.filter(n=>n.tag==='img');assert.equal(imgs.length,1);assert.equal(imgs[0].src,expected);});
test('URL ngoài API và protocol không an toàn: không dựng ảnh',()=>{for(const image of ['https://outside.invalid/chart.png','javascript:alert(1)','data:text/html;base64,aGVsbG8='])assert.equal(render('k56-shared',2,'CODEXDEMO56',true,true,image).filter(n=>n.tag==='img').length,0);});
