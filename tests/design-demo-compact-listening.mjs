import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../term-tests/design-demo/real-compact.js',import.meta.url),'utf8');
for(const [skill,label] of [['listening','Listening'],['reading','Reading']]){
 test(label+' retains controls, handlers and timer when arranged repeatedly',()=>{
  let mutate,moves=0;
  const title={textContent:label+' - Câu 1–40'},clock={handler:'original timer'};
  const actions={clock},notes={handler:'original'},controls={notes,parentElement:null};
  const heading={insertBefore(node,before){assert.equal(before,actions);assert.equal(node,controls);node.parentElement=this;moves++;}};
  const form={querySelector:selector=>({'.cbt-test-heading':heading,'.cbt-toolbar-controls':controls,'.cbt-heading-actions':actions})[selector]};
  vm.runInNewContext(source,{document:{getElementById:id=>({[skill+'View']:form,[skill+'Title']:title,app:{}})[id]},MutationObserver:class{constructor(fn){mutate=fn;}observe(){}}});
  assert.equal(title.textContent,label+' - 40 câu');assert.equal(controls.parentElement,heading);
  mutate();mutate();
  assert.equal(moves,1);assert.equal(controls.notes,notes);assert.equal(controls.notes.handler,'original');
  assert.equal(actions.clock,clock);assert.equal(actions.clock.handler,'original timer');
 });
}
