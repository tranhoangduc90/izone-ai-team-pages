import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../term-tests/design-demo/real-ui.js',import.meta.url),'utf8');
function harness(){
 const make=tag=>({tagName:tag.toUpperCase(),children:[],listeners:{},append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;}});
 const body=make('body');body.prepend=()=>{throw Error('Audio must not be above the demo header');};
 let toolbar=null,mutate;
 const document={body,createElement:make,getElementById:()=>null,querySelector:selector=>selector==='#listeningView .cbt-toolbar'?toolbar:null,querySelectorAll:()=>[]};
 const ctx={mode:'blank',screen:'listening',trial:{},audio:async()=> 'blob:real-test-audio'};
 vm.runInNewContext(source,{window:{REAL_DEMO:ctx},document,MutationObserver:class{constructor(fn){mutate=fn;}observe(){}}});
 return {ctx,make,render(){toolbar=make('div');mutate();return toolbar;}};
}
test('audio waits for the Listening content and follows rebuilt content without replacing its player',async()=>{
 const h=harness();const first=h.render(),box=first.children[0],audio=box.children[1];
 assert.equal(box.className,'real-audio');
 await box.children[0].listeners.click();
 assert.equal(audio.src,'blob:real-test-audio');assert.equal(audio.hidden,false);
 audio.currentTime=12;const second=h.render();
 assert.equal(second.children[0],box);assert.equal(second.children[0].children[1],audio);
 assert.equal(audio.currentTime,12);
});
