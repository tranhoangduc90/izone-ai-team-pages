import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../term-tests/design-demo/'+name,import.meta.url),'utf8');
function host(tools=false,search='?labOption=pink&screen=result'){
 const nodes=new Map(),events={},requests=[];
 const element=()=>({value:'blank',dataset:{},listeners:{},contentWindow:{},replaceChildren(...c){this.firstElementChild=c[0];},addEventListener(n,f){this.listeners[n]=f;}});
 const required=new Set(['workspace','frame-slot','real-status']);
 const document={body:{dataset:{demoTools:tools?'on':'off',demoAssets:tools?'../design-demo':'.'}},getElementById(id){if(!tools&&!required.has(id))return null;if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element};
 const window={TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://api.example'},addEventListener(n,f){events[n]=f;}};
 vm.runInNewContext(read('real-host.js'),{document,window,location:{search},URLSearchParams,URL,Date,AbortController,DOMException,fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.includes('/content')?{ok:true,content:{},definitionVersion:1}:{ok:true,attempts:[]}};}});
 return {nodes,events,requests,window,settle:()=>new Promise(r=>setImmediate(r))};
}
test('clean entry always starts at lobby and ignores palette/screen queries without loading student attempts',async()=>{
 const h=host();await h.settle();const frame=h.nodes.get('frame-slot').firstElementChild;const url=new URL(frame.src,'https://demo.example/');
 assert.equal(url.searchParams.get('screen'),'lobby');assert.equal(url.searchParams.get('labOption'),null);assert.equal(h.requests.length,1);assert.match(h.requests[0].url,/\/content/);
 const ctx=h.window.getRealDemoContext(frame.contentWindow);assert.equal(ctx.mode,'blank');assert.equal(ctx.toolsEnabled,false);
 for(const screen of ['listening','reading','writing','result']){ctx.navigate(screen);assert.equal(new URL(h.nodes.get('frame-slot').firstElementChild.src,'https://demo.example/').searchParams.get('screen'),screen);}
 const reloaded=host();await reloaded.settle();assert.match(reloaded.nodes.get('frame-slot').firstElementChild.src,/screen=lobby$/);
});
test('lab uses the shared frame and keeps screen switching plus palette links',async()=>{
 const h=host(true,'?labOption=sage');await h.settle();assert.equal(h.requests.length,2);
 assert.match(h.nodes.get('frame-slot').firstElementChild.src,/^\.\.\/design-demo\/real-exam/);
 h.nodes.get('screen').value='writing';h.nodes.get('screen').listeners.change();assert.match(h.nodes.get('frame-slot').firstElementChild.src,/screen=writing&labOption=sage/);
});
test('theme applies all 19 Reading tokens without consulting queries or browser storage',()=>{
 const applied=new Map(),document={styleSheets:[{href:'https://demo.example/theme.css?v=split',cssRules:[{selectorText:':root',style:{setProperty:(key,value)=>applied.set(key,value)}}]}],documentElement:{dataset:{}}};
 const window={};const fail=()=>{throw Error('clean theme read testing preferences');};
 vm.runInNewContext(read('theme.js'),{window,document,location:{get search(){return fail();}},get localStorage(){return fail();}});
 assert.equal(applied.size,19);assert.equal(applied.get('--lab-header'),'#f5f6f8');assert.equal(applied.get('--lab-edge'),'#db0829');assert.equal(applied.get('--lab-selectedLine'),'#152b4e');assert.equal(document.documentElement.dataset.labOption,'reading');
 const css=read('theme.css');for(const [key,value]of applied)assert.ok(css.includes(key+':'+value),key+' missing from initial theme');
 assert.equal(window.IZONE_DEMO_THEME.presets.length,12);
 window.IZONE_DEMO_THEME.apply(window.IZONE_DEMO_THEME.alternatives.find(p=>p[0]==='sage')[2],'sage');assert.equal(applied.get('--lab-header'),'#e3ebe5');
});
test('loader keeps palette UI isolated to the lab while both modes use the same exam renderer and theme',async()=>{
 for(const toolsEnabled of [false,true]){
  const scripts=[],styles=[],ctx={toolsEnabled,screen:'reading'};
  const document={head:{append:n=>styles.push(n.href)},body:{append:n=>{scripts.push(n.src);queueMicrotask(()=>n.onload());}},createElement:()=>({}),getElementById:()=>({})};
  const window={};await vm.runInNewContext(read('real-loader.js'),{window,parent:{getRealDemoContext:()=>ctx},document,Promise});
  assert.ok(scripts.includes('../shared/app.js'));assert.equal(scripts.some(x=>x.startsWith('color-lab.js')),toolsEnabled);assert.equal(scripts.some(x=>x.startsWith('color-locator.js')),toolsEnabled);assert.equal(styles.length,toolsEnabled?1:0);
 }
 assert.match(read('real-exam.html'),/href="theme.css\?v=/);assert.match(read('real-exam.html'),/src="theme.js\?v=/);assert.doesNotMatch(read('real-exam.html'),/href="color-lab.css/);
});
test('clean HTML contains no testing controls; lab retains both blank and saved versions',()=>{
 for(const name of ['index.html','real.html']){
  assert.doesNotMatch(read(name),/demo-controls|id="mode"|id="attempt"|id="screen"|real-controls.js|color-lab.js/);
  const lab=fs.readFileSync(new URL('../term-tests/design-lab/'+name,import.meta.url),'utf8');assert.match(lab,/value="saved"/);assert.match(lab,/demo-controls-toggle/);assert.match(lab,/data-demo-assets="\.\.\/design-demo"/);
 }
});
