// Kỳ vọng độc lập: chỉ phiên giảng viên, chỉ phát lại GET 401, không đọc credential.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(process.env.SSO_SCRIPT||new URL('../shared/teacher-single-sign-on.js',import.meta.url),'utf8');
const origin='https://ducizone.ddns.net';
function setup(handler,entryProduct,entryUrl='https://tranhoangduc90.github.io/izone-ai-team-pages/'){
 const calls=[],listeners=new Map();
 const box={URL,Headers,Request,Response,AbortSignal,location:{href:entryUrl},localStorage:{setItem(){}},addEventListener(name,fn){listeners.set(name,fn);},fetch:async(input,options)=>{calls.push({url:String(input),options});return handler(String(input),options);}};
 if(entryProduct)box.document={currentScript:{dataset:{izoneTeacherProduct:entryProduct}}};
 box.window=box;vm.createContext(box);vm.runInContext(code,box);return {box,calls,listeners};
}
const response=status=>({status,ok:status>=200&&status<300,json:async()=>({ok:status===200})});

test('Lesson 12 restores the shared teacher account; student requests keep their own session',async()=>{
 const {box,calls}=setup(()=>response(200));
 const prefix=origin+'/reading67-materials/api/reading-skills67/lesson12';
 await box.fetch(prefix+'/classes');assert.equal(calls.length,1);
 await box.fetch(prefix+'/teacher/classes');
 assert.deepEqual(calls.slice(1).map(c=>c.url),[origin+'/teacher-session-api/v1/restore/materials',prefix+'/teacher/classes']);
});

test('Listening Homework restores its own source without changing discovery on other product entries',async()=>{
 const {box,calls}=setup(()=>response(200),'listeninghomework','https://tranhoangduc90.github.io/izone-ai-team-pages/listening-homework/lesson-2.html?teacher=1');
 assert.equal(await box.IzoneTeacherSso.restore('listeninghomework'),true);
 const url=origin+'/listening-homework67/api/listening-homework67/teacher/classes';
 assert.equal((await box.fetch(url)).status,200);
 assert.deepEqual(calls.map(c=>c.url),[origin+'/teacher-session-api/v1/restore/listeninghomework',url]);
 const before=calls.length;await box.fetch(origin+'/listening-homework67/api/listening-homework67/draft',{method:'PUT',body:'fixture-student'});
 assert.equal(calls.length,before+1);
 const other=setup(()=>response(200));await assert.rejects(other.box.IzoneTeacherSso.restore('listeninghomework'));
});

test('Shops native session shares the common startup result and retains its own adapter',async()=>{
 const {box,calls}=setup(()=>response(200),'shops');
 assert.equal(await box.IzoneTeacherSso.restore('shops'),true);
 const url=origin+'/shops-writing-api/api/v1/auth/session';
 assert.equal((await box.fetch(url)).status,200);
 assert.deepEqual(calls.map(c=>c.url),[origin+'/teacher-session-api/v1/restore/shops',url]);
 await box.fetch(url,{method:'POST',body:JSON.stringify({credential:'fixture-only-google'})});
 assert.equal(calls.at(-1).url,origin+'/shops-writing-api/api/v1/auth/session/shared-session');
 assert.ok(!calls.at(-1).options.body.includes('fixture-only-google'));
});

test('Both deployed Shops/SW consumers use the current shared-session runtime',()=>{
 const canonical=fs.readFileSync(new URL('../shared/teacher-single-sign-on.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
 for(const file of ['shops-writing','sw-task2-writing'])assert.equal(fs.readFileSync(new URL('../'+file+'/shared/teacher-single-sign-on.js',import.meta.url),'utf8').replaceAll('\r\n','\n'),canonical);
});

// Bảo vệ lượt mở thật: khôi phục trực tiếp và đọc quyền phải dùng cùng phiên;
// kiểm qua request ở biên mạng, không phụ thuộc tên hàm hoặc biến bên trong.
test('Explicit restore followed by first teacher read uses one restore request',async()=>{
 const {box,calls}=setup(()=>response(200));
 assert.equal(await box.IzoneTeacherSso.restore('substitute'),true);
 assert.equal((await box.fetch(origin+'/substitute-teacher-api/teacher/scopes')).status,200);
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,1);
});

test('Teacher entry starts restoration before app loads and reuses its completed result',async()=>{
 const {box,calls}=setup(()=>response(200),'term67');
 assert.equal(calls.length,1,'Khôi phục phải bắt đầu ngay khi script đầu trang chạy');
 await new Promise(r=>setImmediate(r));
 assert.equal(await box.IzoneTeacherSso.restore('term67'),true);
 assert.equal((await box.fetch('https://ducizone.ddns.net:18869/term-mini-k67-api/api/auth/session')).status,200);
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,1);
});

test('Eager signed-out result is consumed once; a later login can be discovered',async()=>{
 let signedIn=false;
 const {box,calls}=setup(()=>response(signedIn?200:401),'reading');
 await new Promise(r=>setImmediate(r));
 assert.equal((await box.fetch(origin+'/reading-practice-api/api/teacher/classes')).status,401);
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,1);
 signedIn=true;
 assert.equal((await box.fetch(origin+'/reading-practice-api/api/teacher/classes')).status,200);
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,2);
});

test('Eager outage reaches the consumer and retry can recover',async()=>{
 let offline=true;
 const {box,calls}=setup(()=>response(offline?503:200),'substitute');
 await new Promise(r=>setImmediate(r));
 await assert.rejects(box.IzoneTeacherSso.restore('substitute'),/Chưa khôi phục/);
 offline=false;
 assert.equal(await box.IzoneTeacherSso.restore('substitute'),true);
 assert.equal((await box.fetch(origin+'/substitute-teacher-api/teacher/scopes')).status,200);
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,2);
});
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

test('Term67 dùng HTTPS 18869 thật: khôi phục, nối Google và đăng xuất cùng phiên; cổng lạ không bị can thiệp',async()=>{
 const api='https://ducizone.ddns.net:18869/term-mini-k67-api/api';
 const {box,calls}=setup(()=>response(200));
 await box.fetch(api+'/auth/session',{credentials:'include'});
 assert.equal(calls[0].url,origin+'/teacher-session-api/v1/restore/term67');
 assert.equal(calls[1].url,api+'/auth/session');
 await box.fetch(api+'/auth/session',{method:'POST',body:'fixture-google'});
 assert.equal(calls[3].url,origin+'/term-mini-k67-api/api/auth/session/shared-session');
 await box.fetch(api+'/auth/session',{method:'DELETE'});
 assert.equal(calls[5].url,origin+'/teacher-session-api/v1/logout');
 for(const url of [api+'/student/session','https://ducizone.ddns.net:19999/term-mini-k67-api/api/auth/session','https://ducizone.ddns.net:18869/mapping-api/api/auth/session']){
  const before=calls.length;await box.fetch(url);assert.equal(calls.length,before+1);assert.equal(calls.at(-1).url,url);
 }
});

test('Signed-out GET scans each legacy source once; the next request can discover a new login',async()=>{
 let signedIn=false;
 const {box,calls}=setup(url=>response(signedIn?200:401));
 const url=origin+'/reading-practice-api/api/teacher/classes';
 assert.equal((await box.fetch(url)).status,401);
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,1);
 assert.equal(calls.filter(c=>c.url.includes('/shared-session')).length,10);
 signedIn=true;assert.equal((await box.fetch(url)).status,200);
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,2);
});

test('Concurrent teacher reads coalesce restore; a native 401 after success can still retry',async()=>{
 let release;const ready=new Promise(r=>release=r);let native=0;
 const {box,calls}=setup(async url=>{
  if(url.includes('/restore/')){await ready;return response(200);}
  return response(++native===1?401:200);
 });
 const first=box.fetch(origin+'/reading-practice-api/api/teacher/classes');
 const second=box.fetch(origin+'/reading-practice-api/api/teacher/result/id');
 release();assert.equal((await first).status,200);assert.equal((await second).status,200);
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,2);
 assert.equal(native,3);
});

test('Cross-tab account change starts fresh work and rejects an older in-flight read',async()=>{
 let release,restores=0;
 const old=new Promise(r=>release=r);
 const {box,listeners}=setup(async url=>{
  if(url.includes('/restore/')&&++restores===1)await old;
  return response(200);
 });
 const url=origin+'/reading67-materials/api/reading-skills67/teacher/classes';
 const first=box.fetch(url);const rejected=assert.rejects(first,/Phiên giảng viên vừa thay đổi/);
 listeners.get('storage')({key:'izone:teacher-sso-login'});
 const second=box.fetch(url);
 // Resolve the old request only after the new generation has started its own restore.
 await new Promise(r=>setImmediate(r));const count=restores;
 const result=second.catch(e=>e);release();await rejected;
 assert.equal(count,2);assert.equal((await result).status,200);
});

test('A source outage is retried on the next request, never retained as signed out',async()=>{
 let offline=true;
 const {box}=setup(url=>response(url.includes('/restore/')?401:offline?503:401));
 const url=origin+'/reading-practice-api/api/teacher/classes';
 await assert.rejects(box.fetch(url),/Chưa xác minh/);
 offline=false;assert.equal((await box.fetch(url)).status,401);
});

test('A late old 401 cannot discard source discovery already running for the new account',async()=>{
 let releaseOld,releaseSource,scans=0;
 const old=new Promise(r=>releaseOld=r),sources=new Promise(r=>releaseSource=r);
 const {box,listeners}=setup(async url=>{
  if(url.endsWith('/restore/reading'))await old;
  if(url.endsWith('/shared-session')){scans++;await sources;}
  return response(401);
 });
 const first=box.fetch(origin+'/reading-practice-api/api/teacher/classes');
 const rejected=assert.rejects(first,/Phiên giảng viên vừa thay đổi/);
 listeners.get('storage')({key:'izone:teacher-sso-login'});
 const second=box.fetch(origin+'/listening-practice-api/api/teacher/classes');
 await new Promise(r=>setImmediate(r));assert.equal(scans,1);
 releaseOld();await rejected;
 const third=box.fetch(origin+'/reading67-materials/api/reading-skills67/teacher/classes');
 await new Promise(r=>setImmediate(r));const parallelScans=scans;
 releaseSource();await Promise.all([second,third]);assert.equal(parallelScans,1);
});

test('An old native 401 after an account change is rejected without borrowing the new account',async()=>{
 let native=0,release;
 const wait=new Promise(r=>release=r);
 const {box,calls,listeners}=setup(async url=>{
  if(url.includes('/restore/'))return response(200);
  if(++native===2){await wait;return response(401);}
  return response(200);
 });
 const url=origin+'/reading-practice-api/api/teacher/classes';
 await box.fetch(url);
 const old=box.fetch(url),rejected=assert.rejects(old,/Phiên giảng viên vừa thay đổi/);
 listeners.get('storage')({key:'izone:teacher-sso-login'});release();await rejected;
 assert.equal(calls.filter(c=>c.url.includes('/restore/')).length,1);
 assert.equal(native,2);
});
