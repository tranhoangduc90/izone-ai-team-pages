import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../term-tests/design-demo/real-compact.js',import.meta.url),'utf8');
test('Listening keeps its original controls and handlers when arranged repeatedly',()=>{
 let mutate,moves=0;
 const title={textContent:'Listening - Câu 1–40'},actions={},notes={handler:'original'},controls={notes,parentElement:null};
 const heading={insertBefore(node,before){assert.equal(before,actions);assert.equal(node,controls);node.parentElement=this;moves++;}};
 const form={querySelector:selector=>({'.cbt-test-heading':heading,'.cbt-toolbar-controls':controls,'.cbt-heading-actions':actions})[selector]};
 vm.runInNewContext(source,{document:{getElementById:id=>({listeningView:form,listeningTitle:title,app:{}})[id]},MutationObserver:class{constructor(fn){mutate=fn;}observe(){}}});
 assert.equal(title.textContent,'Listening - 40 câu');assert.equal(controls.parentElement,heading);
 mutate();mutate();
 assert.equal(moves,1);assert.equal(controls.notes,notes);assert.equal(controls.notes.handler,'original');
});
