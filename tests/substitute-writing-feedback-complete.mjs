import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';

class Element {
  constructor(tag) { this.tag=tag; this.children=[]; this.events={}; this.attrs={}; this.textContent=''; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key,value) { this.attrs[key]=value; }
  addEventListener(key,handler) { this.events[key]=handler; }
  showModal() { this.open=true; }
  close() { this.open=false; this.events.close?.(); }
  remove() { this.removed=true; }
}
const flatten=n=>[n,...n.children.flatMap(flatten)];
const functions=['cleanWritingFeedback','writingReportSummary','looksLikeWritingHtml','appendSanitizedWritingHtml','appendSafeWritingFeedback','writingCriterionSections','writingCriterionFallbackSummary','writingCriterionConclusion','appendWritingComponent','openWritingFeedback'];
function fixture(file,taskNumber) {
  const source=fs.readFileSync(process.env.SUBSTITUTE_TEST_ROOT
    ? path.join(process.env.SUBSTITUTE_TEST_ROOT,'term-tests',file,'app.js')
    : new URL('../term-tests/'+file+'/app.js',import.meta.url),'utf8');
  const body=new Element('body');
  const context=vm.createContext({
    document:{body,createElement:t=>new Element(t),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text})},
    writingConfig:{tasks:[{id:`task${taskNumber}`,label:`Writing Task ${taskNumber}`,prompt:'Đề giả.',image:'old.png'}]},
    state:{drafts:{writing:{[`task${taskNumber}`]:'Synthetic essay <img src=x onerror=alert(1)>\nSecond paragraph.'}}},
    testConfig:{slug:'substitute-test'},formatBand:String,countWords:()=>8,criterionTitle:code=>code
  });
  for(const name of functions) {
    const start=source.indexOf('  function '+name+'(');
    if(start<0) continue;
    const end=source.indexOf('\n  function ',start+1);
    vm.runInContext(source.slice(start,end),context);
  }
  const criteria=['TR','CC','LR','GRA'].map(code=>({code,bandScore:5,feedback:code==='GRA'?'## GRA\nTổng hợp ngữ pháp giả.\n### **KẾT LUẬN**\nGiới hạn điểm giả.':'### **1. Khía cạnh**\nTóm tắt giả.\n### **KẾT LUẬN**\nGiới hạn điểm giả.',components:[{label:'Khía cạnh giả',feedback:'Phân tích chi tiết giả.'}]}));
  context.openWritingFeedback({taskNumber,taskScore:5,report:'Nhận xét tổng hợp giả.\n---\n## Nhận xét từng tiêu chí\nKhông lặp lại phần này.',criteria});
  return {body,nodes:flatten(body)};
}
for(const file of ['substitute-k56-shared','substitute-test-2-k56-shared','substitute-k67-shared']) {
  test(file+': hiện bài gốc và nhận xét tổng hợp, không tạo HTML từ bài làm',()=>{
    const {nodes}=fixture(file,2);
    const essay=nodes.find(n=>n.className==='writing-feedback-essay');
    assert.ok(essay,'Thiếu bài viết gốc');
    assert.match(essay.textContent,/Synthetic essay <img/);
    assert.equal(essay.children.length,0);
    assert.ok(nodes.some(n=>n.textContent==='Nhận xét tổng hợp giả.'));
    assert.ok(!nodes.some(n=>n.textContent.includes('Không lặp lại phần này')));
    assert.ok(!nodes.some(n=>n.tag==='img'),'Task 2 không có hình đề cũ');
  });
  test(file+': đủ bốn kết luận, GRA có tóm tắt và mở được chi tiết',()=>{
    const {nodes}=fixture(file,2);
    assert.equal(nodes.filter(n=>n.textContent==='Kết luận và giới hạn điểm').length,4);
    assert.ok(nodes.some(n=>n.textContent.includes('Tổng hợp ngữ pháp giả.')));
    const buttons=nodes.filter(n=>n.className==='writing-component-toggle');
    assert.equal(buttons.length,4);
    for(const button of buttons) {
      const detail=nodes.find(n=>n.id===button.attrs['aria-controls']);
      assert.equal(detail.hidden,true);button.events.click();assert.equal(detail.hidden,false);
      assert.equal(button.attrs['aria-expanded'],'true');
    }
    const dialog=nodes.find(n=>n.tag==='dialog');
    nodes.find(n=>n.className==='writing-feedback-close').events.click();assert.equal(dialog.removed,true);
  });
  test(file+': Task 1 giữ hình đề',()=>assert.equal(fixture(file,1).nodes.filter(n=>n.tag==='img').length,1));
}
