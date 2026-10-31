import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

// Chạy hàm khởi động thật với phiên/link/nháp giả, không gọi mạng ngoài.
// Kiểm đúng người, thứ tự xử lý lỗi, giữ dữ liệu và không tự bắt đầu/audio.
async function boot(kind,{mode='same',n=0}={}){
 const source=await fs.readFile(new URL(`../${kind}-practice/app.js`,import.meta.url),'utf8');
 const start=source.indexOf('async function bootstrap(){'),end=source.indexOf('\nbootstrap();',start);
 assert.ok(start>0&&end>start);
 const events=[],storage=new Map(),binding='binding-'+n;
 const hasSession=!['new','none'].includes(mode),hasEntry=mode!=='session-only'&&mode!=='none';
 if(hasSession)storage.set('session','token-'+n);if(hasEntry)storage.set('entry','entry-'+n);
 const context={app:{innerHTML:''},location:{pathname:`/${kind}-practice/`,hash:'#login',search:''},
  history:{replaceState(){}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  ENTRY:'entry',SESSION:'session',entryToken:'',sessionToken:'',studentId:'',identity:null,entryInfo:null,STUDENTS:[],ready:false,
  sharedEntry:false,personalEntry:true,entryValidated:false,docId:'fixture-document',entryQuery:new URLSearchParams('documentId=fixture-document'),requestedLesson:'9',CLASSES:[],selectedClassId:'',
  URLSearchParams,Promise,escape:String,
  courseIdentity:{canRestoreSession:()=>true,pin(){}},autoLoginRemembered:async()=>false,notify(){},
  async request(path,body){
   events.push({path,body,at:performance.now(),phase:'start'});await new Promise(r=>setTimeout(r,20));
   events.push({path,at:performance.now(),phase:'end'});
   if(path==='/state'){
    if(mode==='different')throw Object.assign(Error('Phiên khác chủ link'),{code:'ENTRY_OWNER_MISMATCH'});
    if(mode==='unauthorized')throw Object.assign(Error('Phiên hết hạn'),{code:'UNAUTHORIZED'});
    if(mode==='state-error'||mode==='both-error')throw Object.assign(Error('Nguồn phiên lỗi'),{code:'SOURCE_ERROR'});
    return {identity:{bindingId:binding,studentRef:'student-'+n},attempts:[]};
   }
   if(mode==='entry-error'||mode==='both-error')throw Error('Link bài lỗi');
   return {documentId:'fixture-document',assignmentCode:'fixture-code',entryMode:'homework',selectedStudentRef:'student-'+n,bindingId:mode==='different'?'other-'+n:binding,students:[{id:'student-'+n,name:'Người giả'}]};
  },apply(value){context.identity=value.identity;context.studentId=value.identity.studentRef;},
  recoverLocal(){events.push({phase:'recover'});},setLesson(){},setAuthoredLesson(){},current:()=>null,
  navigate(route){context.route=route;},teacherScreen:async()=>{}
 };
 vm.createContext(context);await vm.runInContext(source.slice(start,end)+'\nbootstrap()',context);
 return {context,events,storage};
}
for(const kind of ['reading','listening']){
 for(const mode of ['same','different','new','unauthorized','session-only','none','state-error','entry-error','both-error'])test(`${kind} · mở bài ${mode}`,async()=>{
  const f=await boot(kind,{mode});
  assert.ok(f.events.every(e=>!e.path||['/state','/open'].includes(e.path)||e.path.startsWith('/entry-context')));
  if(['same','session-only'].includes(mode))assert.equal(f.context.route,'prep');
  else if(['different','new','unauthorized'].includes(mode)){assert.equal(f.context.route,'login');assert.equal(f.context.sessionToken,'');}
  else {assert.equal(f.context.ready,false);assert.match(f.context.app.innerHTML,/Chưa mở được bài/);}
  if(mode==='both-error')assert.match(f.context.app.innerHTML,/Link bài lỗi/);
  const requests=f.events.filter(e=>e.phase==='start');
  if(requests.length===2)assert.ok(requests[1].at>=f.events.find(e=>e.phase==='end').at,'Kiểm chủ link xong mới đọc phiên/bài');
 });
 test(`${kind} · 100 phiên giả giữ riêng danh tính và link`,async()=>{
  const results=await Promise.all(Array.from({length:100},(_,n)=>boot(kind,{n})));
  results.forEach((f,n)=>{assert.equal(f.context.identity.studentRef,'student-'+n);assert.equal(f.context.entryInfo.bindingId,'binding-'+n);assert.equal(f.context.route,'prep');});
 });
}
