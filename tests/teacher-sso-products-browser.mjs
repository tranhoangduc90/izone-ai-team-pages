// Giao diện thật, phiên chung thật trong SQLite riêng; danh tính Google và danh sách lớp là fixture.
// Mọi URL mạng được chặn/định tuyến về bản thử, không gọi production hoặc AI/Portal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.SSO_TEST_BACKEND;
if(!backend)throw Error('Thiếu đường source thử đã ghim.');
const {createSharedTeacherSession}=await import(pathToFileURL(backend+'/backend/src/teacher-sso/service.js'));
const {digest}=await import(pathToFileURL(backend+'/backend/src/teacher-sso/native-session.js'));
const handout=process.env.SSO_TEST_HANDOUT||backend+'/handout-writing67';
const {createTeacher}=await import(pathToFileURL(handout+'/src/teacher.mjs'));
const {LEGACY_LESSON5}=await import(pathToFileURL(handout+'/src/lessons.mjs'));
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const pageOrigin='https://tranhoangduc90.github.io',pageBase=pageOrigin+'/izone-ai-team-pages',apiOrigin='https://ducizone.ddns.net';
const identity={email:'teacher@example.test',sub:'fixture-teacher',email_verified:true};
const gis="window.google={accounts:{id:{initialize(o){this.cb=o.callback},renderButton(el){let b=document.createElement('button');b.textContent='Google giả';b.onclick=()=>this.cb({credential:'fixture-google'});el.append(b)},disableAutoSelect(){}}}}";
let browser;
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>browser?.close());
for(const width of [1440,390])test('Phiên chung mở Handout, K56 thật/demo và bốn Substitute; tải lại, đăng xuất · '+width,async t=>{
 const nativeRows=new Map(),sources={handout67:{kind:'identity'},substitute:{kind:'identity'}};
 for(const [id,path] of [['k56','/mapping-api-k56'],['k56demo','/mapping-api-demo']])sources[id]={cookieName:'izone_teacher_session',cookiePath:path,native:{issue:async value=>{nativeRows.set(digest(value),true);return true;},revokeHash:async hash=>nativeRows.delete(hash)}};
 const service=createSharedTeacherSession({file:':memory:',key:Buffer.alloc(32,2),sources});t.after(()=>service.close());
 const context=await browser.newContext({viewport:{width,height:900}});t.after(()=>context.close());
 await context.addInitScript(()=>{window.__loginFrames=0;const watch=()=>{const el=document.querySelector('#login,#accessView');if(el&&el.getBoundingClientRect().height)window.__loginFrames++;requestAnimationFrame(watch);};requestAnimationFrame(watch);});
 const calls=[],errors=[];const jar=[];let cookieDebug;
 const output=()=>({cookie(name,value,options){jar.push({name,value,options});}});
 const teacher=createTeacher({db:{query:async()=>({rows:[]})},store:{},roster:async()=>[{classRef:'IC2304',className:'IC2304',students:[{studentRef:'fixture-student',displayName:'Học viên thử'}]}],registry:()=>({clientId:'fixture.apps.googleusercontent.com',teachers:[{email:identity.email,subject:identity.sub,displayName:'Giảng viên thử',classes:['IC2304']}]}),secret:'s'.repeat(40),verifyGoogleToken:async()=>identity});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),headers=await req.allHeaders();calls.push({path:url.pathname,method:req.method()});
  if(url.origin===apiOrigin){
   // Mô phỏng phần truyền mạng từ kho cookie thật: route interception không cung cấp
   // Cookie của CHIPS ở request bị chặn. Không dùng ca này thay canary HTTPS/Nginx.
   const stored=(await cookieDebug.send('Network.getAllCookies')).cookies;
   headers.cookie=stored.filter(c=>c.domain.replace(/^\./,'')===url.hostname&&c.partitionKey?.topLevelSite===pageOrigin&&(url.pathname===c.path||url.pathname.startsWith(c.path.endsWith('/')?c.path:c.path+'/'))).map(c=>c.name+'='+c.value).join('; ');
  }
  const reply=async(body,status=200)=>{
   // Cài cookie phân vùng của fixture vào Chrome theo các thuộc tính do
   // service tạo vào Chrome. Request khởi tạo từ top frame, không qua iframe khác site;
   // HTTP header được kiểm riêng bằng máy chủ thật trong teacher-sso-http.test.js.
   for(const c of jar.splice(0))await cookieDebug.send('Network.setCookie',{name:c.name,value:c.value,domain:'ducizone.ddns.net',path:c.options.path,httpOnly:true,secure:true,sameSite:'None',expires:c.value?Date.now()/1000+Math.floor(c.options.maxAge/1000):1,partitionKey:{topLevelSite:pageOrigin,hasCrossSiteAncestor:false}});
   return route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':pageOrigin,'access-control-allow-credentials':'true'},body:JSON.stringify({ok:status<400,...body})});
  };
  if(url.origin===pageOrigin){const name=url.pathname.slice('/izone-ai-team-pages/'.length),p=resolve(root,name+(name.endsWith('/')?'index.html':''));if(!p.startsWith(resolve(root)))throw Error('Sai đích file');try{return route.fulfill({contentType:({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css'})[extname(p)]||'application/octet-stream',body:fs.readFileSync(p)});}catch{return route.fulfill({status:404,body:''});}}
  if(url.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:gis});
  if(url.origin!==apiOrigin)throw Error('Yêu cầu ngoài phạm vi: '+url.origin);
  const q={headers,secure:true},r=output();
  try{
   if(url.pathname==='/api/handout67/v1/lessons/lesson5')return reply({ok:true,lesson:{...LEGACY_LESSON5,classes:['IC2304']}});
   if(url.pathname.endsWith('/shared-session'))return reply({error:'SSO_LOGIN_REQUIRED'},401);
   if(url.pathname.startsWith('/teacher-session-api/v1/')){
    let body;const id=url.pathname.split('/').pop();
    if(url.pathname.includes('/restore/'))body=await service.restore(q,r,id);
    else if(id==='logout')body=await service.logout(q,r);
    else if(url.pathname.includes('/login/'))body=await service.login(q,r,identity,true);
    else return reply({error:'SSO_LOGIN_REQUIRED'},401);
    return reply(body);
   }
   if(url.pathname.startsWith('/api/handout67/v1/teacher/')){
    if(url.pathname.endsWith('/config'))return reply({clientId:'fixture.apps.googleusercontent.com'});
    const p=service.inspect(q),actor=teacher.fromVerifiedIdentity({email:p.email,sub:p.google_subject,emailVerified:true});
    if(url.pathname.endsWith('/session'))return reply({reviewer:teacher.actor(actor)});
    if(url.pathname.endsWith('/classes'))return reply({classes:await teacher.classes(actor)});
    if(url.pathname.endsWith('/students'))return reply(await teacher.summary(actor,url.searchParams.get('class')));
   }
   if(/^\/mapping-api-(k56|demo)\/api\//.test(url.pathname)){
    const value=(headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('izone_teacher_session='))?.slice('izone_teacher_session='.length);
    if(!value||!nativeRows.has(digest(value)))return reply({},401);
    const demo=url.pathname.startsWith('/mapping-api-demo/'),name=demo?'CODEXDEMO56':'IC2264';
    if(url.pathname.endsWith('/auth/session'))return reply({});
    if(url.pathname.endsWith('/teacher/options'))return reply({reviewer:{displayName:'Giảng viên thử'},classes:[{id:'class-'+name,name}],tests:[{slug:'term-test-1-k56',title:'Bài thi giả',scoreMode:'raw',sectionTotals:{listening:40,reading:26},writingTasks:[2]}]});
    if(url.pathname.endsWith('/teacher/results'))return reply({students:[]});
   }
   if(url.pathname.startsWith('/substitute-teacher-api/teacher/')){
    if(url.pathname.endsWith('/config'))return reply({googleClientId:'fixture.apps.googleusercontent.com'});
    service.inspect(q);
    const slugs=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'];
    if(url.pathname.endsWith('/scopes'))return reply({scopes:slugs.map(testSlug=>({testSlug,classCode:'DEMO'}))});
    if(url.pathname.endsWith('/results'))return reply({testSlug:url.searchParams.get('test'),classCode:'DEMO',hasMore:false,results:[]});
   }
   throw Error('Chưa mô tả route: '+url.pathname);
  }catch(e){return reply({error:e.code||e.message},e.status||500);}
 });
 const page=await context.newPage();cookieDebug=await context.newCDPSession(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pageBase+'/writing-handouts/lesson5/teacher.html?class=IC2304');
 await page.getByRole('button',{name:'Google giả'}).waitFor({state:'visible'});await page.getByRole('button',{name:'Google giả'}).click();
 try{await page.locator('#dashboard').waitFor({state:'visible',timeout:8000});}catch(error){console.log(JSON.stringify({errors,calls,lastText:await page.locator('body').innerText()}));throw error;}
 await page.locator('#students').filter({hasText:'Học viên thử'}).waitFor({state:'visible'});
 const actualCookie=(await context.cookies(apiOrigin)).find(c=>c.name==='izone_teacher_shared');
 assert.ok(actualCookie?.httpOnly&&actualCookie.secure);
 const debug=await context.newCDPSession(page),rawCookies=await debug.send('Network.getAllCookies');await debug.detach();
 const partition=rawCookies.cookies.find(c=>c.name==='izone_teacher_shared')?.partitionKey;
 assert.equal(partition?.topLevelSite,pageOrigin);
 assert.ok(actualCookie.expires>Date.now()/1000+89*86400);
 fs.writeFileSync(resolve(process.env.SSO_TEST_OUTPUT||root,'cookie-proof-'+width+'.json'),JSON.stringify({installation:'CDP_fixture',transport:'mock_from_browser_cookie_store',httpOnly:actualCookie.httpOnly,secure:actualCookie.secure,partitionKey:partition,remainingDays:(actualCookie.expires-Date.now()/1000)/86400},null,2));
 await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>window.__loginFrames),0);
 assert.equal(await page.locator('script[src^="https://accounts.google.com"]').count(),0);
 for(const classCode of ['IC2264','CODEXDEMO56']){
  await page.goto(pageBase+'/term-tests/teacher-k56/?class='+classCode);await page.locator('#dashboardView').waitFor({state:'visible'});
  assert.match(await page.locator('#loginBadge').innerText(),/Đã đăng nhập/);
  await page.reload();await page.locator('#dashboardView').waitFor({state:'visible'});
 }
 for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
  await page.goto(pageBase+'/term-tests/'+slug+'-results/?class=DEMO');await page.locator('#filter-section').waitFor({state:'visible'});
  assert.equal(await page.locator('#test-select').inputValue(),slug);
 }
 await page.reload();await page.locator('#filter-section').waitFor({state:'visible'});
 await page.screenshot({path:resolve(process.env.SSO_TEST_OUTPUT||root,'substitute-sso-'+width+'.png'),fullPage:true});
 await page.locator('#logout').click();await page.getByRole('button',{name:'Google giả'}).waitFor({state:'visible'});
 await page.goto(pageBase+'/writing-handouts/lesson5/teacher.html?class=IC2304');await page.locator('#login').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Google giả'}).waitFor({state:'visible'});
 await page.getByRole('button',{name:'Google giả'}).click();await page.locator('#dashboard').waitFor({state:'visible'});
 await page.goto(pageBase+'/term-tests/substitute-test-1-k67-results/?class=DEMO');await page.locator('#filter-section').waitFor({state:'visible'});
 await page.locator('#logout').click();await page.getByRole('button',{name:'Google giả'}).waitFor({state:'visible'});
 await page.getByRole('button',{name:'Google giả'}).click();await page.locator('#filter-section').waitFor({state:'visible'});
 await page.goto(pageBase+'/writing-handouts/lesson5/teacher.html?class=IC2304');await page.locator('#dashboard').waitFor({state:'visible'});
 assert.equal(calls.some(c=>/submit|checkpoint|grade|portal/.test(c.path)),false);assert.deepEqual(errors,[]);
});
