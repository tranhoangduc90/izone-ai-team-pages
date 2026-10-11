import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Mô phỏng đăng xuất trong lúc khôi phục phiên chậm: kết quả cũ không được mở lại bài thật.
const source=fs.readFileSync(new URL('../term-tests/design-demo/real-host.js',import.meta.url),'utf8').replace(/^import .*;$/m,'');
function harness(restore){
 const elements=new Map();let logoutCount=0,requests=0;
 const element=()=>({hidden:false,value:'blank',listeners:{},dataset:{},replaceChildren(...c){this.children=c;},addEventListener(n,f){this.listeners[n]=f;}});
 const document={hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,head:{append(){}},addEventListener(){}};
 const window={TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://example.test',GOOGLE_CLIENT_ID:'test'},addEventListener(){},google:{accounts:{id:{disableAutoSelect(){throw new Error('GIS unavailable');}}}}};
 vm.runInNewContext(source,{window,document,createTeacherSessionClient:()=>({restore,logout:async()=>{logoutCount++;}}),teacherSessionRequestOptions:v=>v,AbortController,URL,DOMException,Date,fetch:async()=>{requests++;throw new Error('Unexpected private request');}});
 return {elements,get logoutCount(){return logoutCount;},get requests(){return requests;}};
}
test('logout removes private view even when Google UI fails; stale restore cannot reopen it',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));
 await h.elements.get('logout').listeners.click();
 assert.equal(h.logoutCount,1);assert.equal(h.elements.get('workspace').hidden,true);assert.equal(h.elements.get('frame-slot').children.length,0);
 resolve({ok:true});await new Promise(r=>setImmediate(r));
 assert.equal(h.requests,0);assert.equal(h.elements.get('workspace').hidden,true);
});
test('missing session stays at login without requesting test content',async()=>{
 const h=harness(async()=>null);await new Promise(r=>setImmediate(r));
 assert.equal(h.requests,0);assert.equal(h.elements.get('access').hidden,false);assert.equal(h.elements.get('logout').hidden,true);
});
