// Client thật trong VM; chỉ mô phỏng transport để kiểm đường đọc và dữ liệu nhận.
// Phần SSE/API/PG native được kiểm riêng, không gắn kết quả unit vào production.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=await fs.readFile(new URL('../reading-skills67/web-client.js',import.meta.url),'utf8');
const id='attempt-fixture',base='https://fixture.invalid/api/reading-skills67';
const detail=(status='processing')=>({attemptId:id,jobId:'job-fixture',status,errorCode:null,snapshot:{answers:{one:'Giữ bài giả → nguyên vẹn.'},notes:'Ghi chú'},result:status==='done'?{grading:{summary:'Kết quả giả'}}:null,validationProgress:{phase:'review',round:'2',pending:0},recovery:null});
const meta=(status='processing')=>({attemptId:id,status,errorCode:null,revision:'metadata-'+status,resultRevision:'result-'+status,validationRevision:'validation-fixture',recoveryRevision:'none',jobs:[],hasDocumentTarget:false});
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
async function fixture(t,{teacher=false,readMeta=()=>json(meta()),readDetail=()=>json(detail())}={}){
  const requests=[],observers=[],timers=new Map(),storage=new Map();let nextTimer=0;
  const identity={ownerId:'owner-fixture',courseId:'class-fixture'},content={code:'lesson-fixture',version:'v1',type:'materials'},draft={revision:1,runNo:1,body:{answers:{}},savedAt:null};
  const access={config:{capabilities:{stateStream:true},homeworkEnabled:true},...(teacher?{teacher:true,work:{identity,content,draft,attempts:[]}}:{})};
  const window={READING67_API_BASE:base,Reading67Access:{headers:{authorization:'Bearer synthetic-fixture'},teacherPath:'/teacher/work/class-fixture/owner-fixture',open:async()=>access},dispatchEvent(){}};
  const context=vm.createContext({window,URL,URLSearchParams,AbortSignal,AbortController,TextDecoder,TextEncoder,crypto:webcrypto,console,
    location:{href:'https://fixture.invalid/reading-skills67/?server=1',search:'?server=1',pathname:'/reading-skills67/'},document:{currentScript:{src:'https://fixture.invalid/reading-skills67/web-client.js'}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    setTimeout(fn,ms){const key=++nextTimer;timers.set(key,{fn,ms});return key;},clearTimeout:key=>timers.delete(key),
    __observer(options){const record={options,closed:false};observers.push(record);return{close(){record.closed=true;}};},
    fetch:async(url,options={})=>{const parsed=new URL(url);assert.equal(parsed.origin,'https://fixture.invalid');requests.push({path:parsed.pathname,headers:options.headers});
      if(parsed.pathname.endsWith('/status'))return readMeta();if(parsed.pathname.endsWith('/attempts/'+id))return readDetail();
      if(parsed.pathname.endsWith('/lesson'))return json({identity,content});if(parsed.pathname.endsWith('/draft'))return json(draft);if(parsed.pathname.endsWith('/attempts'))return json({attempts:[]});
      throw Error('UNEXPECTED_FIXTURE_REQUEST:'+parsed.pathname);}});
  let module;
  new vm.Script(source,{importModuleDynamically:async specifier=>{assert.ok(specifier.includes('test-state-observer.mjs'));if(!module){module=new vm.SourceTextModule('export const createTestStateObserver=globalThis.__observer',{context});await module.link(()=>{throw Error('UNEXPECTED_IMPORT');});await module.evaluate();}return module;}}).runInContext(context);
  const client=window.ReadingServerClient;await client.initialize();const updates=[];client.poll(id,value=>updates.push(JSON.parse(JSON.stringify(value))));
  for(let i=0;i<8;i++){for(const [key,timer]of [...timers])if(timer.ms===0){timers.delete(key);timer.fn();}await new Promise(setImmediate);}
  const observer=observers.at(-1);assert.ok(observer&&!observer.closed);t.after(()=>{client.stopPoll();timers.clear();});
  return {requests,updates,observer:observer.options,client};
}
for(const teacher of [false,true])test(`Fallback khởi động đọc bài cùng metadata, giữ đầy đủ dữ liệu · ${teacher?'GV':'HV'}`,async t=>{
  let release;const pendingMeta=new Promise(resolve=>release=resolve),f=await fixture(t,{teacher,readMeta:()=>pendingMeta});const work=f.observer.poll({signal:new AbortController().signal});
  try{await new Promise(setImmediate);assert.ok(f.requests.some(x=>x.path.endsWith('/attempts/'+id)),'Không chờ metadata mới bắt đầu đọc chi tiết');release(json(meta()));const value=await work;f.observer.onState(value);await new Promise(setImmediate);assert.deepEqual(f.updates.at(-1),detail());}
  finally{release(json(meta()));await work.catch(()=>{});}
});
test('Bài đã kết thúc đối chiếu một lần rồi quay về metadata, không tải lặp kết quả',async t=>{
  const f=await fixture(t,{readMeta:()=>json(meta('done')),readDetail:()=>json(detail('done'))});
  for(let i=0;i<3;i++){const value=await f.observer.poll({signal:new AbortController().signal});f.observer.onState(value);await new Promise(setImmediate);}
  assert.deepEqual(f.updates.at(-1),detail('done'));assert.equal(f.requests.filter(x=>x.path.endsWith('/attempts/'+id)).length,2);
});
test('Lượt đọc song song không ghép chi tiết sai mã bài vào frame hiện hành',async t=>{
  const f=await fixture(t,{readDetail:()=>json({...detail(),attemptId:'other-attempt'})});
  await assert.rejects(f.observer.poll({signal:new AbortController().signal}),{code:'ATTEMPT_IDENTITY_MISMATCH'});assert.equal(f.updates.length,0);
});
test('Lỗi quyền ở API chi tiết được trả cho observer, không phát snapshot thành công',async t=>{
  const f=await fixture(t,{readDetail:()=>new Response(JSON.stringify({error:'ACCESS_DENIED'}),{status:403,headers:{'content-type':'application/json'}})});
  await assert.rejects(f.observer.poll({signal:new AbortController().signal}),{status:403,code:'ACCESS_DENIED'});assert.equal(f.updates.length,0);
});
for(const lateFailure of [false,true])test(`Phản hồi chi tiết cũ không phủ snapshot dự phòng mới · ${lateFailure?'lỗi tới muộn':'dữ liệu tới muộn'}`,async t=>{
  let release,calls=0;const old=new Promise(resolve=>release=resolve),fresh={...detail(),validationProgress:{phase:'review',round:'3',pending:0}};
  const f=await fixture(t,{readDetail:()=>++calls===1?old:json(fresh)});
  f.observer.onState(meta());await new Promise(setImmediate);assert.equal(calls,1);
  const value=await f.observer.poll({signal:new AbortController().signal});f.observer.onState(value);assert.deepEqual(f.updates.at(-1),fresh);
  release(lateFailure?new Response(JSON.stringify({error:'FIXTURE_OLD_ERROR'}),{status:503,headers:{'content-type':'application/json'}}):json(detail()));
  for(let i=0;i<5;i++)await new Promise(setImmediate);
  assert.deepEqual(f.updates.at(-1),fresh,'Không nhận lại dữ liệu/lỗi của lượt đọc đã bị thay thế');
});
test('Snapshot đầy đủ có trạng thái mới hơn metadata vẫn được tiếp tục theo dõi sau đó',async t=>{
  let calls=0;const f=await fixture(t,{readDetail:()=>json(detail(++calls===1?'queued':'processing'))});
  const value=await f.observer.poll({signal:new AbortController().signal});f.observer.onState(value);assert.equal(f.updates.at(-1).status,'queued');
  f.observer.onState({...meta(),revision:'later-stream'});for(let i=0;i<5;i++)await new Promise(setImmediate);
  assert.equal(f.updates.at(-1).status,'processing');
});
test('Metadata cùng trạng thái không xác nhận nhầm revision của chi tiết đọc song song',async t=>{
  let calls=0;const fresh={...detail(),validationProgress:{phase:'review',round:'3',pending:0}},f=await fixture(t,{readDetail:()=>json(++calls===1?detail():fresh)});
  const value=await f.observer.poll({signal:new AbortController().signal});f.observer.onState(value);assert.deepEqual(f.updates.at(-1),detail());
  f.observer.onState(meta());for(let i=0;i<5;i++)await new Promise(setImmediate);
  assert.deepEqual(f.updates.at(-1),fresh);
});
