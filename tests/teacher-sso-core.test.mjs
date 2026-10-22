// Kỳ vọng độc lập: chỉ phiên giảng viên, chỉ phát lại GET 401, không đọc credential.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../shared/teacher-single-sign-on.js',import.meta.url),'utf8');
const origin='https://ducizone.ddns.net';
function setup(handler){
 const calls=[];
 const box={URL,Headers,Request,Response,AbortSignal,location:{href:'https://tranhoangduc90.github.io/izone-ai-team-pages/'},localStorage:{setItem(){}},addEventListener(){},fetch:async(input,options)=>{calls.push({url:String(input),options});return handler(String(input),options);}};
 box.window=box;vm.createContext(box);vm.runInContext(code,box);return {box,calls};
}
const response=status=>({status,ok:status>=200&&status<300,json:async()=>({ok:status===200})});
test('First teacher read confirms shared identity; student requests and writes are untouched',async()=>{
 const {box,calls}=setup(()=>response(200));
 for(const [path,method] of [['/reading-practice-api/api/teacher/result/id','GET'],['/reading67-materials/api/reading-skills67/draft','GET'],['/reading67-materials/api/reading-skills67/submit','POST']])await box.fetch(origin+path,{method});
 assert.equal(calls.length,4);assert.equal(calls.filter(c=>c.url.includes('/shared-session')).length,0);
});
test('GET 401 restores exactly once; existing shared session skips source discovery',async()=>{
 let ready=false;const {box,calls}=setup(url=>{if(url.includes('teacher-session-api'))ready=true;return response(ready?200:401);});
 assert.equal((await box.fetch(origin+'/reading67-materials/api/reading-skills67/teacher/classes')).status,200);
 assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith('/restore/materials'));assert.equal(calls[0].options.credentials,'include');
});
test('Missing shared cookie adopts existing Reading cookie without sending a token in JS',async()=>{
 let restored=false,adopted=false;
 const {box,calls}=setup(url=>{
  if(url.endsWith('/teacher/shared-session')){if(url.includes('reading-practice-api'))adopted=true;return response(adopted?200:401);}
  if(url.includes('/restore/')){restored=adopted;return response(restored?200:401);}
  return response(restored?200:401);
 });
 await box.fetch(origin+'/reading67-materials/api/reading-skills67/teacher/classes');
 assert.ok(adopted);assert.equal(calls.filter(c=>c.url.includes('/shared-session')).length,2);
 assert.ok(calls.filter(c=>c.url.includes('/shared-session')).every(c=>c.options.body==='{}'));
});
test('Native forbidden does not bypass permission; teacher mutations are never replayed',async()=>{
 const {box,calls}=setup(url=>response(url.includes('teacher-session-api')?200:403));await box.fetch(origin+'/reading-practice-api/api/teacher/result/id');assert.equal(calls.length,2);
 const other=setup(()=>response(401));await other.box.fetch(origin+'/reading-practice-api/api/teacher/update',{method:'POST',body:'private-change'});assert.equal(other.calls.length,1);
});
test('Google login success shares native cookie without forwarding Google credential',async()=>{
 const {box,calls}=setup(()=>response(200));await box.fetch(origin+'/reading-practice-api/api/teacher/login',{method:'POST',body:'private-google-credential'});
 assert.equal(calls.length,2);assert.equal(calls[1].options.body,'{"replace":true}');assert.ok(calls[1].url.endsWith('/teacher/shared-session'));
});
test('Logout revokes shared session after native response and cannot be retried as login',async()=>{
 const {box,calls}=setup(()=>response(200));await box.fetch(origin+'/writing-api/api/v1/auth/session',{method:'DELETE'});
 assert.equal(calls.length,2);assert.ok(calls[1].url.endsWith('/v1/logout'));assert.equal(calls[1].options.headers['X-Izone-Csrf'],'1');
});
test('Broker/source outage is visible; it cannot silently become an authenticated response',async()=>{
 const {box}=setup(url=>response(url.includes('/restore/')?503:401));await assert.rejects(box.fetch(origin+'/reading-practice-api/api/teacher/result/id'),/Chưa khôi phục/);
});
test('Stale native account cannot bypass a different shared account or a shared denial',async()=>{
 let identity='old-account';const {box}=setup(url=>{if(url.includes('/restore/'))identity='shared-account';return {...response(200),json:async()=>({identity})};});
 const result=await box.fetch(origin+'/reading67-materials/api/reading-skills67/teacher/classes');assert.equal((await result.json()).identity,'shared-account');
 const denied=setup(url=>response(url.includes('/restore/')?403:200));await assert.rejects(denied.box.fetch(origin+'/reading67-materials/api/reading-skills67/teacher/classes'),/chưa có quyền/);assert.equal(denied.calls.length,1);
});

test('Mapping, Term67, K56 và demo nối đúng sản phẩm; Handout dùng endpoint phiên riêng',async()=>{
 for(const [path,id] of [['/mapping-api/api/auth/session','mapping'],['/term-mini-k67-api/api/auth/session','term67'],['/mapping-api-k56/api/auth/session','k56'],['/mapping-api-demo/api/auth/session','k56demo'],['/api/handout67/v1/teacher/session','handout67'],['/substitute-teacher-api/teacher/scopes','substitute']]){
  const {box,calls}=setup(()=>response(200));await box.fetch(origin+path,{credentials:'include'});
  assert.ok(calls[0].url.endsWith('/restore/'+id),path);assert.equal(calls.length,2);
 }
});
test('Handout login đổi Google lấy phiên chung, rồi đọc quyền gốc; không tạo cookie riêng 12 giờ',async()=>{
 const {box,calls}=setup(()=>response(200));
 await box.fetch(origin+'/api/handout67/v1/teacher/session',{method:'POST',body:JSON.stringify({credential:'fixture-google',remember:false})});
 assert.ok(calls[0].url.endsWith('/login/handout67'));assert.equal(calls[0].options.body,'{"credential":"fixture-google","remember":false}');
 assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.body,undefined);
});
