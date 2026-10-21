// Mô phỏng phản hồi giữa tab: giảng viên chậm và học viên cũ trả lời trước.
// Chạy adapter thật; kiểm phiếu nhận được, số lần tải bản gốc và đường thử lại.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const baseline=JSON.parse(await readFile(new URL('./demo-data.json',import.meta.url),'utf8'));
const current=structuredClone(baseline);
const session=current.data.sessions.find(s=>s.number===10);
session.generation+=1;session.title='Bài thay thế · Phiếu đang giao';
session.releases[1].status='closed';
let serial=0;
async function environment({bound=true,responses=[]},run){
 const names=['location','document','BroadcastChannel','fetch'],saved=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const timers=[],nodes=new Map(),requests=[];let fetches=0,channel;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:true,addEventListener:(type,callback)=>nodes.get(id)[type]=callback});return nodes.get(id)};
 globalThis.location=new URL('https://example.test/progress-log/thuy-review/'+(bound?'#view=student&ref=demo-a&number=10&generation='+session.generation:''));
 globalThis.document={querySelector:node};
 globalThis.BroadcastChannel=class{
  listeners=new Set();constructor(){channel=this}
  addEventListener(type,fn){this.listeners.add(fn)}removeEventListener(type,fn){this.listeners.delete(fn)}
  postMessage(message){requests.push(message);if(message.kind==='request')for(const response of responses)timers.push(setTimeout(()=>this.deliver({kind:'snapshot',id:message.id,package:response.package,role:response.role}),response.delay));}
  deliver(data){for(const listener of [...this.listeners])listener({data})}
 };
 globalThis.fetch=async()=>{fetches++;return {ok:true,json:async()=>structuredClone(baseline)}};
 try{const adapter=await import('./pages-adapter.mjs?case='+serial++);await run({adapter,node,requests,get fetches(){return fetches},get channel(){return channel}})}
 finally{for(const timer of timers)clearTimeout(timer);for(const name of names){if(saved[name])Object.defineProperty(globalThis,name,saved[name]);else delete globalThis[name];}}
}
test('Tab giảng viên cũ trả sau 800ms: vẫn nhận đúng phiếu, không tải bản gốc',()=>environment({responses:[{delay:800,package:current}]},async env=>{
 await env.adapter.preparePages();const data=await env.adapter.pagesAPI('/api/student?number=10&ref=demo-a');
 assert.equal(data.title,session.title);assert.equal(data.releases[1].status,'closed');assert.equal(env.fetches,0);
}));
test('Học viên cũ trả trước giảng viên: không chọn snapshot sai phiên giao bài',()=>environment({responses:[{delay:10,package:baseline,role:'student'},{delay:800,package:current,role:'teacher'}]},async env=>{
 await env.adapter.preparePages();const data=await env.adapter.pagesAPI('/api/student?number=10&ref=demo-a');
 assert.equal(data.generation,session.generation);assert.equal(data.title,session.title);assert.equal(env.fetches,0);
}));
test('Link có phiên giao bài nhưng chỉ học viên trả lời: báo thử lại, không mở bài gốc',()=>environment({responses:[{delay:10,package:current,role:'student'}]},async env=>{
 let ready=false;const pending=env.adapter.preparePages().then(()=>ready=true);
 await new Promise(resolve=>setTimeout(resolve,3300));
 assert.equal(ready,false);assert.equal(env.fetches,0);assert.equal(env.node('#retry-data').hidden,false);
 assert.match(env.node('#load-status').textContent,/giảng viên|bài đang giao/);
 const retry=env.node('#retry-data').click;assert.equal(typeof retry,'function');retry();
 const request=env.requests.filter(r=>r.kind==='request').at(-1);
 env.channel.deliver({kind:'snapshot',id:request.id,role:'teacher',package:current});
 await pending;assert.equal((await env.adapter.pagesAPI('/api/student?number=10&ref=demo-a')).title,session.title);
}));
test('Mở demo độc lập vẫn đọc được bản chụp khi không có tab khác',()=>environment({bound:false},async env=>{
 await env.adapter.preparePages();assert.equal(env.fetches,1);
 assert.equal((await env.adapter.pagesAPI('/api/teacher')).className,'IC2305');
}));
