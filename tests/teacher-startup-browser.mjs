// Trang sản phẩm thật; API, Google và độ trễ là fixture. Chặn toàn bộ mạng ngoài.
// Bắt form lóe lên ở từng frame và đo tới lúc dữ liệu đầu tiên đã sẵn sàng.
// Số đo này chỉ so sánh mã trước/sau trong cùng điều kiện, không thay thời gian live.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(process.env.TEACHER_STARTUP_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const out=resolve(process.env.TEACHER_STARTUP_OUTPUT||'output/playwright/teacher-startup');
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const origin='https://tranhoangduc90.github.io',prefix='/izone-ai-team-pages';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const variants=[
 {id:'term67',path:'/term-tests/teacher/',panel:'#accessView',ready:'#notice',text:'Đã tải'},
 {id:'mapping',path:'/progress-log/teacher.html',panel:'#teacherAccessView',ready:'#teacherNotice',text:'Sẵn sàng'},
 {id:'substitute',path:'/term-tests/substitute-test-1-k56-results/',panel:'#google-signin',ready:'#updated-at',text:'Cập nhật'},
 {id:'writing-library',path:'/writing-handouts/library.html',panel:'#google-signin',ready:'#auth-status',text:'Đã đăng nhập',private:'#library-content'}
];
const gis="window.google={accounts:{id:{initialize(o){this.cb=o.callback},renderButton(el){const b=document.createElement('button');b.textContent='Google thử';el.replaceChildren(b)},prompt(){},disableAutoSelect(){}}}};";
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const records=[];
try{
 for(const variant of variants.filter(v=>!process.env.TEACHER_STARTUP_PRODUCTS||process.env.TEACHER_STARTUP_PRODUCTS.split(',').includes(v.id)))for(const scenario of (process.env.TEACHER_STARTUP_SCENARIOS||'active').split(','))for(let round=0;round<Number(process.env.TEACHER_STARTUP_ROUNDS||1);round++){
  let mode=scenario,googleLoads=0;
  const width=Number(process.env.TEACHER_STARTUP_WIDTH||1440);
  const context=await browser.newContext({viewport:{width,height:900}});
  const calls=[],errors=[],escaped=[];
  await context.addInitScript(({panel})=>{
   localStorage.setItem('izone:teacher-auto-login:v1','1');
   window.__startupFrames=[];
   const observe=()=>{const el=document.querySelector(panel);if(el){const r=el.getBoundingClientRect();if(r.width&&r.height&&getComputedStyle(el).visibility!=='hidden')window.__startupFrames.push(performance.now());}requestAnimationFrame(observe);};
   requestAnimationFrame(observe);
  },variant);
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;
   if(u.origin===origin){
    const relative=p.slice(prefix.length)+(p.endsWith('/')?'index.html':'');
    const file=resolve(root,'.'+relative);
    if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/'))throw Error('Sai đích fixture');
    try{if(/\/(teacher\/app|teacher|teacher-results)\.js$/.test(p))await delay(300);
     const body=await fs.readFile(file);return route.fulfill({body,contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream'});
    }catch{return route.fulfill({status:404,body:''});}
   }
   if(u.hostname==='accounts.google.com'){googleLoads++;return route.fulfill({contentType:'text/javascript',body:gis});}
   if(u.hostname!=='ducizone.ddns.net'){escaped.push(u.origin);return route.abort();}
   calls.push({path:p,method:req.method(),at:performance.now()});
   await delay(150);
   if(p.includes('/restore/')&&['missing','forbidden','offline'].includes(mode))return route.fulfill({status:{missing:401,forbidden:403,offline:503}[mode],json:{error:'FIXTURE_'+mode}});
   if(p.endsWith('/shared-session'))return route.fulfill({status:401,json:{error:'SSO_LOGIN_REQUIRED'}});
   if((p.endsWith('/teacher/options')||p.endsWith('/teacher/scopes')||p.endsWith('/admin/me'))&&['api-denied','expired-product'].includes(mode))return route.fulfill({status:mode==='api-denied'?403:401,json:{ok:false,message:'Quyền/phiên fixture đã bị thu hồi'}});
   if(p.endsWith('/teacher/config'))return route.fulfill({json:{googleClientId:'fixture-google',clientId:'fixture-google'}});
   if(p.includes('/teacher-session-api/v1/restore/'))return route.fulfill({json:{ok:true}});
   if(p.endsWith('/auth/session'))return route.fulfill({status:mode==='missing'?401:200,json:{ok:mode!=='missing',reviewer:{name:'Giảng viên thử'}}});
   if(p.endsWith('/admin/me'))return route.fulfill({json:{ok:true,reviewer:{role:'teacher'}}});
   if(p.endsWith('/term-tests/teacher/options'))return route.fulfill({json:{ok:true,reviewer:{displayName:'Giảng viên thử',role:'teacher'},classes:[{id:'fixture-class',name:'IC2304'}],tests:[{slug:'term-test-1',title:'Bài thử',writingTasks:[],sectionTotals:{listening:40,reading:40}}]}});
   if(p.endsWith('/term-tests/teacher/results'))return route.fulfill({json:{ok:true,students:[]}});
   if(p.endsWith('/learning/teacher/options'))return route.fulfill({json:{ok:true,reviewer:{name:'Giảng viên thử'},classes:[{class_id:'101',class_name:'IC2304'}],assignments:[],capabilities:{}}});
   if(req.method()==='GET'&&p.endsWith('/learning/teacher/form-publications'))return route.fulfill({json:{ok:true,publications:[]}});
   if(['/mapping-api/api/learning/teacher/form-drafts','/mapping-api/api/learning/teacher/form-drafts/review-queue','/mapping-api/api/learning/teacher/form-library'].includes(p))return route.fulfill({json:{ok:true,drafts:[],items:[],entries:[],reviews:[]}});
   if(p.endsWith('/teacher/scopes'))return route.fulfill({json:{scopes:[{testSlug:'substitute-test-1-k56',classCode:'DEMO'}]}});
   if(p.endsWith('/teacher/results'))return route.fulfill({json:{testSlug:u.searchParams.get('test'),classCode:u.searchParams.get('class'),results:[],hasMore:false}});
   errors.push('Chưa mô tả API: '+req.method()+' '+p);return route.fulfill({status:500,json:{error:'UNEXPECTED_FIXTURE_ROUTE'}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const started=performance.now();
  await page.goto(origin+prefix+variant.path);
  if(round===0&&scenario==='active')await page.screenshot({path:resolve(out,variant.id+'-loading-'+width+'.png'),fullPage:true});
  try{
   if(['missing','expired-product'].includes(scenario)){
    await page.getByRole('button',{name:'Google thử',exact:true}).waitFor({state:'visible',timeout:15000});
    assert.equal(await page.locator(variant.panel).isVisible(),true);
    if(['term67','mapping'].includes(variant.id))assert.equal(await page.locator('#rememberTeacherLogin').isChecked(),true);
   }else if(['forbidden','offline','api-denied'].includes(scenario)){
    await page.getByRole('button',{name:'Thử lại',exact:true}).waitFor({state:'visible',timeout:15000});
    assert.equal(await page.locator(variant.panel).isVisible(),false);
    assert.equal(await page.locator(variant.private||(variant.id==='mapping'?'#teacherWorkspace':variant.id==='term67'?'#dashboardView':'#roster-section')).isVisible(),false);
    if(scenario==='offline'){mode='active';await page.getByRole('button',{name:'Thử lại',exact:true}).click();await page.locator(variant.ready).filter({hasText:variant.text}).waitFor({state:'visible',timeout:15000});}
   }else await page.locator(variant.ready).filter({hasText:variant.text}).waitFor({state:'visible',timeout:15000});
  }
  catch(error){console.log(JSON.stringify({product:variant.id,calls,errors,escaped,body:await page.locator('body').innerText()}));throw error;}
  const readyMs=Math.round(performance.now()-started),frames=await page.evaluate(()=>window.__startupFrames);
  if(scenario==='active')assert.equal(googleLoads,0,'Phiên còn hiệu lực không tải Google');
  const record={product:variant.id,scenario,width,round,readyMs,loginVisibleFrames:frames.length,restores:calls.filter(c=>c.path.includes('/restore/')).length,sessionReads:calls.filter(c=>c.path.endsWith('/auth/session')).length,requests:calls.map(c=>({path:c.path,method:c.method,startMs:Math.round(c.at-started)})),errors,escaped};
  records.push(record);
  if(round===0)await page.screenshot({path:resolve(out,variant.id+'-'+scenario+'-'+width+'.png'),fullPage:true});
  await context.close();
 }
}finally{await browser.close();}
await fs.writeFile(resolve(out,'results.json'),JSON.stringify({conditions:'API fixture 150 ms/request; main app module delayed 300 ms; real HTML/JS; no production traffic',records},null,2));
console.log(JSON.stringify(records.map(({product,round,readyMs,loginVisibleFrames,restores,sessionReads,errors,escaped})=>({product,round,readyMs,loginVisibleFrames,restores,sessionReads,errors,escaped}))));
assert.ok(records.every(r=>r.errors.length===0&&r.escaped.length===0),'Có lỗi fixture hoặc mạng ngoài phạm vi');
if(process.env.TEACHER_STARTUP_BASELINE!=='1')assert.ok(records.filter(r=>r.scenario==='active').every(r=>r.loginVisibleFrames===0),'Form đăng nhập đã lóe lên khi còn phiên');
