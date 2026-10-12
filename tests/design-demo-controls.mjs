import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../term-tests/design-demo/'+name,import.meta.url),'utf8');
test('navigation opens fully, toggles repeatedly and does not recreate the exam',()=>{
 const listeners={},attributes={'aria-expanded':'true'},panel={hidden:false},toolbar={hidden:false},body={dataset:{}};
 const button={getAttribute:name=>attributes[name],setAttribute:(name,value)=>attributes[name]=value,addEventListener:(name,fn)=>listeners[name]=fn};
 const frame={attempt:'unchanged'};
 vm.runInNewContext(read('real-controls.js'),{document:{body,getElementById:id=>id==='demo-controls-toggle'?button:id==='demo-controls'?panel:id==='demo-toolbar'?toolbar:frame}});
 assert.equal(panel.hidden,false);
 for(let i=0;i<4;i++){
  listeners.click();assert.equal(panel.hidden,i%2===0);
  assert.equal(toolbar.hidden,panel.hidden);
  assert.equal(body.dataset.navigationCollapsed,String(panel.hidden));
  assert.equal(attributes['aria-expanded'],String(!panel.hidden));
  assert.equal(button.textContent,panel.hidden?'☰ Điều hướng demo':'Thu gọn điều hướng ↑');
  assert.equal(frame.attempt,'unchanged');
 }
});
test('both entry pages expose the toggle and share the responsive frame sizing',()=>{
 for(const page of ['index.html','real.html']){
  assert.match(read(page),/id="demo-controls-toggle" aria-expanded="true" aria-controls="demo-toolbar demo-controls"/);
  assert.match(read(page),/id="demo-controls" class="real-controls"/);
  assert.match(read(page),/src="real-controls.js"/);
  assert.match(read(page),/id="demo-toolbar"/);
 }
 assert.match(read('real.css'),/#frame-slot\{flex:1;min-height:0\}/);
 assert.doesNotMatch(read('real.css'),/height:calc\(100dvh -/);
});
