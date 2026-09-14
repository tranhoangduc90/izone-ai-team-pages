import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const modules=['k56-shared','k56-test2-shared','k56-mini-shared'];
function element(tag,...children){return {nodeType:1,tagName:tag.toUpperCase(),childNodes:children};}
const text=value=>({nodeType:3,textContent:value});
class Output {
  constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
  append(...items){this.children.push(...items);}
}
const flat=node=>[node,...node.children.flatMap(flat)];
for(const module of modules) {
  const source=fs.readFileSync('term-tests/'+module+'/app.js','utf8');
  const at=source.indexOf('  function looksLikeWritingHtml(');
  const end=source.indexOf('  function writingCriterionSections(',at);
  test(module+': HTML report được dựng thành heading/chữ đậm, không nguyên mã HTML',()=>{
    let parsedInput='';
    const parsedNodes=[element('h1',text('Overall: '),element('strong',text('7.5'))),
      element('div',element('h3',element('strong',text('Coherence & Cohesion: 8')))),
      element('script',text('blocked script')),element('iframe'),element('img')];
    const c=vm.createContext({DOMParser:class{parseFromString(input){parsedInput=input;return {body:{childNodes:parsedNodes}};}},
      document:{createElement:tag=>new Output(tag),createTextNode:value=>Object.assign(new Output('#text'),{textContent:value}),createDocumentFragment:()=>new Output('#fragment')},
      cleanWritingFeedback:value=>String(value||'').trim()});
    vm.runInContext(source.slice(at,end),c);
    const target=new Output('section');
    c.target=target;
    c.report='<h1 onclick="bad()">Overall: <strong>7.5</strong></h1><div style="margin-left:20px"><h3>Coherence &amp; Cohesion: 8</h3></div><img src="https://invalid.example/tracker"><script>bad()</script>';
    vm.runInContext('appendSafeWritingFeedback(target,report)',c);
    assert.doesNotMatch(parsedInput,/onclick|style=|src=/i);
    const nodes=flat(target);assert.equal(nodes.filter(n=>n.tag==='h5').length,2);
    assert.ok(nodes.some(n=>n.tag==='strong'&&n.children.some(child=>child.textContent==='7.5')));
    assert.ok(nodes.some(n=>n.textContent==='Coherence & Cohesion: 8'));
    assert.ok(!nodes.some(n=>['script','img','iframe'].includes(n.tag)));
    assert.ok(!nodes.some(n=>n.textContent==='blocked script'));
  });
  test(module+': plain text/Markdown vẫn giữ định dạng cũ',()=>{
    const c=vm.createContext({document:{createElement:tag=>new Output(tag),createTextNode:value=>Object.assign(new Output('#text'),{textContent:value})},
      cleanWritingFeedback:value=>String(value||'').trim()});
    vm.runInContext(source.slice(at,end),c);
    c.target=new Output('section');
    vm.runInContext("appendSafeWritingFeedback(target,'Nhận xét **quan trọng** và nội dung thường.')",c);
    const nodes=flat(c.target);assert.ok(nodes.some(n=>n.tag==='strong'&&n.textContent==='quan trọng'));
    assert.ok(nodes.some(n=>n.tag==='#text'&&n.textContent.includes('nội dung thường')));
  });
}
test('bump cache HTML ở cả ba bộ nạp và trang CBT',()=>{
  for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56']){
    const b=fs.readFileSync('term-tests/'+slug+'-computer-based/bootstrap.js','utf8');
    assert.equal(b.split('\n').filter(line=>line.includes('app.js?v=')&&line.includes('student-feedback-v1-html-v2')).length,2);
    assert.match(fs.readFileSync('term-tests/'+slug+'-computer-based/index.html','utf8'),/student-feedback-v1-html-v2/);
  }
});
