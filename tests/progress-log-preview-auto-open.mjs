// Nhận phiếu giả; kiểm thứ tự mở phần, lỗi và reset ngay tại biên API demo.
// Bộ nạp app được thay bằng dấu quan sát; không gọi hoặc ghi tới lớp thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../progress-log/demo/boot.js',import.meta.url),'utf8');
async function run({hash='#grant=fixture',stored=false,fail=false}={}) {
 const calls=[],nodes=new Map(),storage=new Map(stored?[['progress-log-demo:teacher:run-1','teacher-1']]:[]);
 const node=id=>nodes.get(id)||nodes.set(id,{hidden:true,textContent:'',classList:{add(){}},addEventListener(type,fn){this[type]=fn;}}).get(id);
 const window={PROGRESS_LOG_CONFIG:{API_BASE_URL:'https://fixture.test/demo'},
  location:{hash,href:'https://fixture.test/progress-log/demo/'+hash,reload(){calls.push('reload');}},
  sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)},history:{replaceState(){}}};
 const context={window,document:{getElementById:node},URL,URLSearchParams,
  fetch:async(url,request)=>{const path=new URL(url).pathname;calls.push(path);
   assert.equal(request.headers['x-progress-log-demo'],'1');
   if(path.endsWith('open-blocks')||path.endsWith('reset'))assert.equal(request.headers['x-demo-teacher-token'],'teacher-1');
   return {ok:!(fail&&path.endsWith('open-blocks')),json:async()=>fail&&path.endsWith('open-blocks')
    ?{ok:false,message:'Không mở được phần thử'}:{ok:true,run:{publicToken:'run-1',teacherToken:hash.includes('grant')?'teacher-1':undefined}}};},
  loadStudentApp:async()=>calls.push('app-loaded')};
 vm.runInNewContext(source.replace(/await import\('[^']+'\);/,'await loadStudentApp();'),context);
 await new Promise(resolve=>setImmediate(resolve));
 return {calls,nodes};
}
test('Teacher preview opens every demo block before loading the student app',async()=>{
 const r=await run();assert.deepEqual(r.calls,['/demo/api/demo/runs','/demo/api/demo/runs/open-blocks','app-loaded']);
 assert.equal(r.nodes.get('resetDemoButton').hidden,false);
 assert.ok(!r.nodes.get('openDemoBlocksButton')||r.nodes.get('openDemoBlocksButton').hidden);
 await r.nodes.get('resetDemoButton').click();assert.equal(r.calls.at(-2),'/demo/api/demo/runs/reset');assert.equal(r.calls.at(-1),'reload');
});
test('Restored teacher preview opens blocks using the token kept in this tab',async()=>{
 assert.deepEqual((await run({hash:'#assignment=run-1',stored:true})).calls,
 ['/demo/api/demo/runs','/demo/api/demo/runs/open-blocks','app-loaded']);
});
test('Open-blocks failure remains visible and prevents loading a misleading locked preview',async()=>{
 const r=await run({fail:true});assert.equal(r.nodes.get('notice').textContent,'Không mở được phần thử');assert.ok(!r.calls.includes('app-loaded'));
});
test('A student-only demo link does not gain teacher permission',async()=>{
 const r=await run({hash:'#assignment=run-1'});assert.deepEqual(r.calls,['/demo/api/demo/runs','app-loaded']);assert.equal(r.nodes.get('resetDemoButton').hidden,true);
});
