// Kiểm hai trang K56 trong Chrome; Google/API và danh tính hoàn toàn giả.
// Cookie HttpOnly thật của trình duyệt có hạn 90 ngày; không gọi production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=resolve(process.env.K56_SESSION_PAGES||fileURLToPath(new URL('../',import.meta.url)));
const runtime=resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(runtime,'playwright/package.json')))('playwright');
const google="window.google={accounts:{id:{initialize(o){window.qaGoogleCallback=o.callback},renderButton(){},disableAutoSelect(){}}}};";
let browser,server,base;
test.before(async()=>{
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(!file.startsWith(root+sep))return res.writeHead(403).end();
  try{const bytes=await readFile(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream'}).end(bytes);}catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(done=>server?.close(done));});
async function fixture(classCode,{storageState,loginFailureApi,sessionRegistry=new Set(),blockRemove=false,withoutLocks=false}={}){
 const context=await browser.newContext({storageState}),page=await context.newPage();page.setDefaultTimeout(15000);
 if(blockRemove)await context.addInitScript(()=>{Storage.prototype.removeItem=function(){throw new Error('Storage giả chỉ cho phép setItem');};});
 if(withoutLocks)await context.addInitScript(()=>{Object.defineProperty(navigator,'locks',{value:undefined});});
 const calls=[],errors=[],sessions=sessionRegistry;let version=0,logoutFailure=false,pausedApi=null,releaseLogin;
 let loginGate=Promise.resolve();
 const selected=classCode==='CODEXDEMO56'?'demo':'live';
 const api=kind=>base+'/fixture-'+kind;
 const marker=kind=>'izone:teacher-k56:logout-pending:'+api(kind);
 const isAuthenticated=(request,kind)=>{const token=request.headers().cookie?.match(new RegExp('qa_'+kind+'=([^;]+)'))?.[1];return sessions.has(token);};
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  const reply=(data,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(data)});
  if(url.pathname.endsWith('/k56-shared/config.js'))return route.fulfill({contentType:'text/javascript',body:`const real='${api('live')}',demo='${api('demo')}';window.TERM_TEST_APP_CONFIG={API_BASE_URL:new URLSearchParams(location.search).get('class')==='CODEXDEMO56'?demo:real,API_BASE_URLS:[real,demo],API_FOR_CLASS:c=>c==='CODEXDEMO56'?demo:real,GOOGLE_CLIENT_ID:'synthetic'};`});
  if(url.hostname==='accounts.google.com'&&url.pathname==='/gsi/client')return route.fulfill({contentType:'text/javascript',body:google});
  const kind=url.pathname.startsWith('/fixture-live/')?'live':url.pathname.startsWith('/fixture-demo/')?'demo':null;
  if(kind){
   calls.push({kind,method,path:url.pathname});
   if(url.pathname.endsWith('/api/auth/session')){
    if(method==='POST'){
     if(pausedApi===kind){pausedApi=null;await loginGate;}
     if(loginFailureApi===kind)return reply({ok:false,message:'Nguồn đăng nhập giả chưa sẵn sàng'},503);
     const token='synthetic-session-'+(++version);sessions.add(token);
     return reply({ok:true},201,{'set-cookie':`qa_${kind}=${token}; Path=/fixture-${kind}; HttpOnly; SameSite=Lax; Max-Age=7776000`});
    }
    if(method==='DELETE'){
     if(logoutFailure)return reply({ok:false,message:'Mạng lỗi khi đăng xuất giả'},503);
     const token=request.headers().cookie?.match(new RegExp('qa_'+kind+'=([^;]+)'))?.[1];sessions.delete(token);
     return reply({ok:true},200,{'set-cookie':`qa_${kind}=; Path=/fixture-${kind}; Max-Age=0`});
    }
    return isAuthenticated(request,kind)?reply({ok:true}):reply({ok:false},401);
   }
   if(!isAuthenticated(request,kind))return reply({ok:false},401);
   if(url.pathname.endsWith('/teacher/options'))return reply({ok:true,reviewer:{displayName:'Giảng viên giả'},classes:[{id:'class-'+kind,name:kind==='demo'?'CODEXDEMO56':classCode==='CODEXDEMO56'?'IC2264':classCode}],tests:[{slug:'term-test-1-k56',title:'Bài thi giả',scoreMode:'raw',sectionTotals:{listening:40,reading:26},writingTasks:[2]}]});
   if(url.pathname.endsWith('/teacher/results'))return reply({ok:true,students:[]});
   return reply({ok:false},404);
  }
  if(url.origin===base)return route.continue();return route.abort();
 });
 async function landing(){await page.goto(base+'/term-tests/k56-demo/?class='+classCode);await page.waitForFunction(()=>typeof window.qaGoogleCallback==='function');}
 async function login(){await page.evaluate(()=>window.qaGoogleCallback({credential:'synthetic-google-only'}));await page.locator('#loginBadge').filter({hasText:'Đã đăng nhập'}).waitFor();}
 // Còn phiên thì không cần tải/khởi tạo Google lần nữa; chờ kết quả người dùng thấy.
 async function results(){await page.locator('#teacherDashboard').click();await page.locator('#dashboardView').waitFor({state:'visible'});}
 return {context,page,calls,errors,sessions,api,marker,selected,landing,login,results,setLogoutFailure:value=>{logoutFailure=value;},pauseLogin(kind){pausedApi=kind;loginGate=new Promise(done=>{releaseLogin=done;});},releaseLogin(){releaseLogin?.();}};
}
for(const code of ['IC2264','IC2305','CODEXDEMO56']){
 test(`${code}: một lần Google, chuyển trang/F5/tab mới dùng cookie 90 ngày`,async()=>{
  const f=await fixture(code);try{
   await f.landing();await f.login();const posts=f.calls.filter(c=>c.method==='POST').length;
   const cookies=await f.context.cookies();assert.equal(cookies.filter(c=>c.name.startsWith('qa_')).length,2);
   assert(cookies.filter(c=>c.name.startsWith('qa_')).every(c=>c.httpOnly&&c.expires>Date.now()/1000+89*86400));
   await f.results();assert.equal(await f.page.locator('#dashboardView').isVisible(),true);
   await f.page.reload();await f.page.locator('#dashboardView').waitFor({state:'visible'});
   const next=await f.context.newPage();await next.goto(base+'/term-tests/teacher-k56/?class='+code);await next.locator('#dashboardView').waitFor({state:'visible'});await next.close();
   assert.equal(f.calls.filter(c=>c.method==='POST').length,posts);assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 });
 test(`${code}: login mới ở landing không bị dấu logout503 cũ hủy tại kết quả`,async()=>{
  const f=await fixture(code);try{
   await f.landing();await f.login();await f.results();f.setLogoutFailure(true);
   await f.page.locator('#logoutButton').click();await f.page.locator('#notice').filter({hasText:'Máy chủ chưa xác nhận'}).waitFor();
   assert.match(await f.page.evaluate(key=>localStorage.getItem(key),f.marker(f.selected)),/^logout:/);
   f.setLogoutFailure(false);await f.landing();await f.login();const deletes=f.calls.filter(c=>c.method==='DELETE').length;
   await f.results();assert.equal(await f.page.locator('#dashboardView').isVisible(),true,'Không được hủy phiên mới đã xác thực ở landing');
   assert.equal(f.calls.filter(c=>c.method==='DELETE').length,deletes);assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 });
 test(`${code}: đóng phiên trình duyệt rồi mở lại không cần Google lần hai`,async()=>{
  const first=await fixture(code);let state,sessions;
  try{await first.landing();await first.login();state=await first.context.storageState();sessions=first.sessions;}finally{await first.context.close();}
  const reopened=await fixture(code,{storageState:state,sessionRegistry:sessions});
  try{await reopened.landing();await reopened.page.locator('#loginBadge').filter({hasText:'Đã đăng nhập'}).waitFor();await reopened.results();assert.equal(await reopened.page.locator('#dashboardView').isVisible(),true);assert.equal(reopened.calls.filter(c=>c.method==='POST').length,0);assert.deepEqual(reopened.errors,[]);}finally{await reopened.context.close();}
 });
 test(`${code}: tab kết quả cũ còn signed_out không hủy phiên vừa đăng nhập ở tab tổng`,async()=>{
  const f=await fixture(code);try{
   await f.landing();await f.login();await f.results();f.setLogoutFailure(true);
   await f.page.locator('#logoutButton').click();await f.page.locator('#notice').filter({hasText:'Máy chủ chưa xác nhận'}).waitFor();
   assert.equal(new URL(f.page.url()).searchParams.has('signed_out'),true);
   const landing=await f.context.newPage();await landing.goto(base+'/term-tests/k56-demo/?class='+code);await landing.waitForFunction(()=>typeof window.qaGoogleCallback==='function');
   f.setLogoutFailure(false);await landing.evaluate(()=>window.qaGoogleCallback({credential:'synthetic-google-only'}));await landing.locator('#loginBadge').filter({hasText:'Đã đăng nhập'}).waitFor();
   const deletes=f.calls.filter(c=>c.method==='DELETE').length;
   await f.page.reload();await f.page.locator('#dashboardView').waitFor({state:'visible'});assert.equal(f.calls.filter(c=>c.method==='DELETE').length,deletes);
   await landing.close();assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 });
 test(`${code}: logout mới ở tab khác thắng POST đang chờ và login đã xếp hàng`,async()=>{
  const f=await fixture(code);try{
   await f.landing();await f.login();await f.results();
   const landing=await f.context.newPage();await landing.goto(base+'/term-tests/k56-demo/?class='+code);await landing.waitForFunction(()=>typeof window.qaGoogleCallback==='function');
   const posts=f.calls.filter(c=>c.method==='POST'&&c.kind===f.selected).length;f.pauseLogin(f.selected);
   await landing.evaluate(()=>{window.qaGoogleCallback({credential:'synthetic-delayed-only'});});
   for(let n=0;n<200&&f.calls.filter(c=>c.method==='POST'&&c.kind===f.selected).length===posts;n++)await landing.waitForTimeout(20);
   assert.equal(f.calls.filter(c=>c.method==='POST'&&c.kind===f.selected).length,posts+1);
   await landing.evaluate(()=>{window.qaGoogleCallback({credential:'synthetic-queued-only'});});
   await landing.waitForTimeout(100);
   f.setLogoutFailure(true);await f.page.bringToFront();await f.page.locator('#logoutButton').click();await f.page.locator('#accessView').waitFor({state:'visible'});f.releaseLogin();
   await f.page.locator('#notice').filter({hasText:'Máy chủ chưa xác nhận'}).waitFor();
   assert.equal(f.calls.filter(c=>c.method==='POST'&&c.kind===f.selected).length,posts+1,'Login xếp hàng trước logout mới phải bị bỏ trước POST');
   const guard=await landing.evaluate(key=>({pending:localStorage.getItem(key),resolved:JSON.parse(localStorage.getItem(key+':resolved')||'null')}),f.marker(f.selected));
   assert.match(guard.pending,/^logout:/);assert.notEqual(guard.resolved?.intent,guard.pending,'POST cũ không được xác nhận logout mới');
   const fresh=await f.context.newPage();await fresh.goto(base+'/term-tests/teacher-k56/?class='+code);await fresh.locator('#notice').filter({hasText:'Máy chủ chưa xác nhận'}).waitFor();assert.equal(await fresh.locator('#dashboardView').isVisible(),false);
   await fresh.close();await landing.close();assert.deepEqual(f.errors,[]);
  }finally{f.releaseLogin();await f.context.close();}
 });
}
for(const code of ['IC2264','CODEXDEMO56'])test(`${code}: không có Web Locks, POST muộn sau DELETE không hồi sinh phiên`,async()=>{
 const f=await fixture(code,{withoutLocks:true});try{
  await f.landing();await f.login();await f.results();
  const landing=await f.context.newPage();await landing.goto(base+'/term-tests/k56-demo/?class='+code);await landing.waitForFunction(()=>typeof window.qaGoogleCallback==='function');
  f.pauseLogin(f.selected);const count=f.calls.filter(c=>c.method==='POST'&&c.kind===f.selected).length;
  await landing.evaluate(()=>{window.qaGoogleCallback({credential:'synthetic-late-cookie'});});
  for(let n=0;n<200&&f.calls.filter(c=>c.method==='POST'&&c.kind===f.selected).length===count;n++)await landing.waitForTimeout(20);
  assert.equal(f.calls.filter(c=>c.method==='POST'&&c.kind===f.selected).length,count+1);
  await f.page.locator('#logoutButton').click();await f.page.locator('#notice').filter({hasText:'Đã đăng xuất'}).waitFor();
  f.releaseLogin();await landing.waitForTimeout(250);
  const fresh=await f.context.newPage();await fresh.goto(base+'/term-tests/teacher-k56/?class='+code);await fresh.locator('#notice').filter({hasText:'Đã đăng xuất'}).waitFor();
  assert.equal(await fresh.locator('#dashboardView').isVisible(),false);await fresh.close();await landing.close();
 }finally{f.releaseLogin();await f.context.close();}
});
test('removeItem bị chặn: xác nhận phiên mới không cần xóa storage và vẫn chuyển được trang kết quả',async()=>{
 const f=await fixture('CODEXDEMO56',{blockRemove:true});try{
  await f.landing();await f.page.evaluate(key=>localStorage.setItem(key,'1'),f.marker('demo'));await f.login();
  const resolved=await f.page.evaluate(key=>JSON.parse(localStorage.getItem(key+':resolved')),f.marker('demo'));
  assert.equal(resolved.intent,'1');assert.equal(resolved.outcome,'login');
  await f.results();assert.equal(await f.page.locator('#dashboardView').isVisible(),true);
 }finally{await f.context.close();}
});
test('đăng nhập một API lỗi không được xóa dấu đăng xuất của API đó',async()=>{
 const f=await fixture('IC2264',{loginFailureApi:'demo'});try{
  await f.landing();await f.page.evaluate(key=>localStorage.setItem(key,'1'),f.marker('demo'));await f.login();
  assert.equal(await f.page.evaluate(key=>localStorage.getItem(key),f.marker('demo')),'1');
  await f.results();assert.equal(await f.page.locator('#dashboardView').isVisible(),true);
 }finally{await f.context.close();}
});
