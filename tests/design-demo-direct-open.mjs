import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../term-tests/design-demo/real-host.js',import.meta.url),'utf8');
function harness(fetcher,search=''){
 const elements=new Map(),events={},requests=[];
 const element=()=>({hidden:false,value:'blank',listeners:{},dataset:{},replaceChildren(...c){this.children=c;this.firstElementChild=c[0];},addEventListener(n,f){this.listeners[n]=f;}});
 const document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element};
 const window={TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://example.test'},addEventListener(n,f){events[n]=f;}};
 vm.runInNewContext(source,{window,document,location:{search},URLSearchParams,AbortController,URL,DOMException,Date,fetch:async(url,options)=>{requests.push({url,options});return fetcher(url,options);}});
 return {elements,events,requests};
}
const response=url=>({ok:true,json:async()=>url.includes('/content')?{ok:true,content:{},definitionVersion:1}:{ok:true,attempts:[]}});
test('opening the page immediately requests content without Google, session or credentials',async()=>{
 const h=harness(async url=>response(url));await new Promise(r=>setImmediate(r));
 assert.equal(h.requests.length,2);
 assert.ok(h.requests.every(r=>r.options.credentials==='omit'&&!r.url.includes('/session')));
 assert.equal(h.elements.get('workspace').hidden,false);
 assert.match(h.elements.get('frame-slot').children[0].src,/real-exam/);
 assert.equal(h.elements.has('google-login'),false);
});
test('closing the page while content is loading prevents stale responses from reopening the frame',async()=>{
 const pending=[];const h=harness(url=>new Promise(resolve=>pending.push(()=>resolve(response(url)))));
 h.events.pagehide();pending.forEach(resolve=>resolve());await new Promise(r=>setImmediate(r));
 assert.equal(h.elements.get('frame-slot').children.length,0);
});

test('preset links preserve the selected palette when switching screens; unknown palettes are ignored',async()=>{
 for(const [search,palette] of [['?labOption=reading','reading'],['?labOption=mist','mist'],['?labOption=unknown',null],['',null]]){
  const h=harness(async url=>response(url),search);await new Promise(r=>setImmediate(r));
  for(const screen of ['lobby','listening','reading','writing','result']){
   h.elements.get('screen').value=screen;h.elements.get('screen').listeners.change();
   const url=new URL(h.elements.get('frame-slot').firstElementChild.src,'https://example.test/');
   assert.equal(url.searchParams.get('labOption'),palette);assert.equal(url.searchParams.get('screen'),screen);
  }
 }
});
