import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]??'.');
const fallback=process.env.PAGES_FIXTURE_FALLBACK?resolve(process.env.PAGES_FIXTURE_FALLBACK):root;
const modules=process.env.CODEX_NODE_MODULES??resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=await import(pathToFileURL(resolve(modules,'playwright/index.mjs')));
const browser=await chromium.launch({channel:'msedge',headless:true});
const scope={sittingId:'fixture-sitting',testId:'substitute-test-1-k56',classCode:'IC99000',label:'IC99000 · Ca giả · Toàn bài',canAssign:true,acceptsAssignments:true};
const catalog={schemaVersion:1,revision:'fixture',entries:[{id:'substitute-test-1-k56',sourceSlug:'substitute-test-1-k56',course:56,examNumber:1,skill:'full',status:'open',studentUrl:'https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/substitute-test-1-k56-computer-based/?demo=exam&grading=server'}]};
async function fixture({initial=false,mode='ok',canAssign=true}={}){
 const state={signedIn:initial,mode,canAssign,scopeReads:0,actions:0,external:[],errors:[],held:undefined};
 const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://local').pathname;
  if(path.startsWith('/fixture/')){
   if(path==='/fixture/login')state.signedIn=true;
   if(path==='/fixture/logout')state.signedIn=false;
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({signedIn:state.signedIn}));return;
  }
  if(path.endsWith('/shared/teacher-single-sign-on.js')){
   res.setHeader('Content-Type','text/javascript');res.end(`window.IzoneTeacherSso={restore:async()=>{const r=await fetch('/fixture/state');return (await r.json()).signedIn;},login:async()=>{await fetch('/fixture/login',{method:'POST'});},logout:async()=>{await fetch('/fixture/logout',{method:'POST'});}};`);return;
  }
  if(path.endsWith('/exam-journal/substitute-catalog-session.mjs')){
   res.setHeader('Content-Type','text/javascript');res.end('export function recordCatalogJournal() {}');return;
  }
  const rel=decodeURIComponent(path).replace(/^\/izone-ai-team-pages\//,'').replace(/^\//,'');
  let file=resolve(root,rel.endsWith('/')?rel+'index.html':rel);
  if(!file.startsWith(root))return res.writeHead(403).end();
  if(!existsSync(file))file=resolve(fallback,rel.endsWith('/')?rel+'index.html':rel);
  if(!file.startsWith(fallback)&&!file.startsWith(root)||!existsSync(file))return res.writeHead(404).end();
  const type={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'}[extname(file)]??'application/octet-stream';
  res.setHeader('Content-Type',type);res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({viewport:{width:1200,height:850}});
 context.setDefaultTimeout(3500);
 await context.addInitScript(()=>{
  let callback;
  window.google={accounts:{id:{initialize:options=>{callback=options.callback;},renderButton:target=>{const button=document.createElement('button');button.textContent='Đăng nhập mẫu';button.onclick=()=>callback({credential:'fixture-only-not-google'});target.append(button);}}}};
 });
 await context.route('https://**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!=='https://ducizone.ddns.net'){state.external.push(url.origin);return route.abort();}
  const path=url.pathname;
  let status=200,body={};
  if(path.endsWith('/teacher/config'))body={googleClientId:'fixture-only'};
  else if(path.endsWith('/teacher/skill-tests')){status=state.signedIn?200:401;body=state.signedIn?catalog:{code:'LOGIN_REQUIRED'};}
  else if(path.endsWith('/teacher/scopes')){
   state.scopeReads++;
   if(state.mode==='held')await new Promise(r=>{state.held=r;});
   if(!state.signedIn){status=401;body={code:'LOGIN_REQUIRED'};}
   else if(state.mode==='error'){status=503;body={code:'SSO_UNAVAILABLE'};}
   else body={scopes:[{...scope,canAssign:state.canAssign}]};
  }else if(path.endsWith('/teacher/list'))body={rows:[{id:'fixture-a',version:1,name:'Học viên giả A',classCode:'IC99000',active:true,state:'pending'}],blocked:[]};
  else if(path.endsWith('/teacher/actions')){state.actions++;status=403;body={code:'UNEXPECTED_MUTATION'};}
  else if(path.includes('/exam-journal/'))body={ok:true};
  else {state.external.push(path);return route.abort();}
  await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':request.headers().origin??'null','Access-Control-Allow-Credentials':'true'},body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>state.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/izone-ai-team-pages/term-tests/substitute-test-1-k56-dashboard/`,{waitUntil:'load'});
 const login=async()=>{
  await page.getByRole('button',{name:'Khu vực giảng viên',exact:true}).click();
  try{await page.getByRole('button',{name:'Đăng nhập mẫu',exact:true}).click();}
  catch(error){console.error(JSON.stringify({fixtureErrors:state.errors,external:state.external,auth:await page.locator('#auth-status').textContent()}));throw error;}
  await page.getByRole('button',{name:'Đăng xuất giảng viên',exact:true}).waitFor();
 };
 const close=async()=>{state.held?.();await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));};
 return {state,page,login,close};
}
try{
 await test('Cùng tab: đăng nhập xong đọc lại quyền và có lối Giao bài ngay trong Khu vực giảng viên',async()=>{
  const f=await fixture();try{
   await f.login();
   const teacher=f.page.locator('#teacher-dialog');
   await teacher.getByRole('button',{name:'Giao bài',exact:true}).click({timeout:2500});
   await f.page.getByText('Học viên giả A',{exact:true}).waitFor({timeout:4000});
   assert.ok(f.state.scopeReads>=2,'Phải đọc lại quyền sau đăng nhập cùng tab');
   assert.equal(await teacher.evaluate(el=>el.open),false);
   assert.deepEqual(f.state.errors,[]);assert.equal(f.state.actions,0);
  }finally{await f.close();}
 });
 await test('Lỗi API không làm mất nút; báo lỗi, thử lại và đọc được danh sách',async()=>{
  const f=await fixture({initial:true,mode:'error'});try{
   await f.page.getByRole('button',{name:'Giao bài',exact:true}).first().click({timeout:2500});
   await f.page.locator('#assignment-access-status').getByText(/Chưa kiểm tra được quyền/).waitFor({timeout:4000});
   assert.equal(await f.page.getByText('Học viên giả A',{exact:true}).count(),0);
   f.state.mode='ok';
   await f.page.getByRole('button',{name:'Kiểm tra lại quyền',exact:true}).click();
   await f.page.getByText('Học viên giả A',{exact:true}).waitFor({timeout:4000});
   assert.deepEqual(f.state.errors,[]);assert.equal(f.state.actions,0);
  }finally{await f.close();}
 });
 await test('Tài khoản chỉ xem không có nút giao từng dòng; đăng xuất xóa danh sách',async()=>{
  const f=await fixture({initial:true,canAssign:false});try{
   await f.page.getByRole('button',{name:'Giao bài',exact:true}).first().click({timeout:2500});
   await f.page.getByText('Học viên giả A',{exact:true}).waitFor({timeout:4000});
   assert.equal(await f.page.getByRole('button',{name:'Giao bài cho Học viên giả A',exact:true}).count(),0);
   assert.equal(await f.page.getByRole('button',{name:'Giao bài đã chọn',exact:true}).isDisabled(),true);
   await f.page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
   await f.page.getByRole('button',{name:'Khu vực giảng viên',exact:true}).click();
   await f.page.getByRole('button',{name:'Đăng xuất giảng viên',exact:true}).click();
   await f.page.getByRole('button',{name:'Đăng nhập mẫu',exact:true}).waitFor();
   assert.equal(await f.page.getByText('Học viên giả A',{exact:true}).count(),0);
   assert.deepEqual(f.state.errors,[]);assert.equal(f.state.actions,0);
  }finally{await f.close();}
 });
 await test('Phản hồi quyền cũ sau đăng xuất không hiện lại dữ liệu; nút mobile vẫn có',async()=>{
  const f=await fixture({initial:true});try{
   await f.page.getByRole('button',{name:'Giao bài',exact:true}).first().click({timeout:2500});
   await f.page.getByText('Học viên giả A',{exact:true}).waitFor({timeout:4000});
   await f.page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
   f.state.mode='held';
   await f.page.evaluate(()=>dispatchEvent(new Event('focus')));
   await f.page.getByRole('button',{name:'Khu vực giảng viên',exact:true}).click();
   await f.page.getByRole('button',{name:'Đăng xuất giảng viên',exact:true}).click();
   f.state.signedIn=true;f.state.held?.();
   await f.page.waitForTimeout(200);
   assert.equal(await f.page.getByText('Học viên giả A',{exact:true}).count(),0);
   await f.page.locator('#teacher-dialog .close').click();
   await f.page.setViewportSize({width:390,height:844});
   assert.equal(await f.page.locator('#listening-assignment-open').isVisible(),true);
   assert.deepEqual(f.state.errors,[]);assert.equal(f.state.actions,0);
  }finally{await f.close();}
 });
}finally{await browser.close();}
