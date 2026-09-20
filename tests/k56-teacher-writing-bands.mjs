import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=fs.readFileSync('term-tests/teacher-k56/app.js','utf8');
const body=source.slice(source.indexOf('function openTeacherWritingFeedback('),source.indexOf('async function loadTeacherWritingDetail('));
test('bài chấm K56 có bài viết nguyên gốc, 4 band tiêu chí và nhận xét',()=>{
  class Element {
    constructor(tag,cls='',text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];}
    append(...items){this.children.push(...items);}
    setAttribute(){} addEventListener(){} showModal(){this.open=true;}
    querySelector(tag){return this.children.find(n=>n.tag===tag);}
  }
  const root=new Element('body');
  const c=vm.createContext({document:{body:root,createElement:t=>new Element(t)},state:{selectedTestSlug:'term-test-1-k56'},
    createNode:(t,cls,text)=>new Element(t,cls,text),writingTaskLabel:n=>'Task '+n,writingScoreLabel:()=>'Band',
    formatBand:n=>n==null?'—':Number(n).toFixed(1),safeWritingImageUrl:()=>'',writingReportSummary:()=>'',criterionTitle:code=>code,
    writingCriterionSections:()=>[],appendSafeWritingFeedback:(el,text)=>el.textContent=text});
  vm.runInContext(body,c);
  const essay='  Synthetic essay\nsecond paragraph.  ';
  c.writing={taskNumber:2,taskScore:6.5,wordCount:250,essay,
    criteria:['TR','CC','LR','GRA'].map((code,i)=>({code,bandScore:6+i*.5,feedback:'Synthetic feedback'}))};
  vm.runInContext("openTeacherWritingFeedback('Demo giả',writing)",c);
  const all=[];function walk(el){all.push(el);el.children.forEach(walk);}walk(root);
  assert.equal(all.find(n=>n.className==='writing-feedback-essay').textContent,essay);
  const summary=all.find(n=>n.className==='writing-band-summary');
  assert.equal(summary.children.length,4);
  assert.deepEqual(summary.children.map(n=>n.children[1].textContent),['Band 6.0','Band 6.5','Band 7.0','Band 7.5']);
  assert.equal(all.filter(n=>n.className==='writing-criterion-card').length,4);
});
test('dashboard K56 giữ CSS Writing và tải JavaScript phiên mới',()=>{
  const html=fs.readFileSync('term-tests/teacher-k56/index.html','utf8');
  assert.equal((html.match(/20260914-writing-bands-v1/g)||[]).length,1);
  assert.equal((html.match(/20260920-teacher-session-v1/g)||[]).length,1);
});
