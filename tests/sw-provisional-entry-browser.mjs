import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const root=resolve(process.env.SW_ENTRY_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const origin='https://tranhoangduc90.github.io',prefix='/izone-ai-team-pages';
const task='writing-task2-living-alone-development';
const catalog=await fs.readFile(resolve(root,'sw-task2-writing/writing-handouts/shops-review/lesson-config.mjs'),'utf8');
const tasks=[...catalog.matchAll(/^    "slug": "([^"]+)"/gm)].map(m=>m[1]);
const official={studentRef:'official-fixture',displayName:'Học viên có sẵn'};
const temporary={studentRef:'temporary-fixture',displayName:'Học viên mới thử',alias:'Học viên mới thử · TEMP',provisional:true,requiresAccessCode:true};
function session(slug,studentRef,classRef){
 const definitions=[['topic_sentence',['topic_sentence','body1_idea1','body1_idea2','body_choice']],['supporting_idea_1',['idea1_a','idea1_x','idea1_b']],['supporting_idea_2',['idea2_a','idea2_x','idea2_b']],['draft',['draft1','draft2']]].map(([key,inputFields])=>({key,inputFields}));
 return {sessionRef:studentRef+'-session',activitySlug:slug,studentRef,classRef,draftVersion:0,responses:{},sectionDefinitions:definitions,sections:Object.fromEntries(definitions.map(d=>[d.key,{status:'not_started',locked:false}])),attempts:[],comments:[],ui:{version:'sw-task2-lesson9-v1',data:{}},uiEvents:[]};
}
async function fixture(browser,{slug=task,query=true,width=1440,empty=false}={}){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 const classes=[{classRef:'class-fixture',className:'CS-FIXTURE',students:empty?[]:[{...official}]},{classRef:'other-class',className:'CS-OTHER',students:[]}];
 const state={classes,calls:[],errors:[],registerStatus:201,delay:0,wrongPin:false};
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;
  if(u.origin===origin){
   const file=resolve(root,'.'+path.slice(prefix.length)+(path.endsWith('/')?'index.html':''));
   assert(file.startsWith(root+'\\')||file.startsWith(root+'/'));
   try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
  }
  if(u.hostname!=='ducizone.ddns.net'){state.errors.push('Unexpected external origin');return route.abort();}
  const body=req.postDataJSON();state.calls.push({path,method:req.method(),body});
  if(path.endsWith('/sw/status'))return route.fulfill({json:{ok:true}});
  if(path.endsWith('/roster'))return route.fulfill({json:{classes}});
  if(path.endsWith('/provisional-students')){
   if(state.delay)await new Promise(r=>setTimeout(r,state.delay));
   if(state.registerStatus===409)return route.fulfill({status:409,json:{error:'PROVISIONAL_STUDENT_EXISTS',message:'Đã có học viên tạm cùng tên.',current:{studentRef:temporary.studentRef,alias:temporary.alias}}});
   if(state.registerStatus!==201)return route.fulfill({status:state.registerStatus,json:{error:'TEMPORARY_UNAVAILABLE',message:'Máy chủ tạm gián đoạn.'}});
   const group=classes.find(c=>c.classRef===body.classRef);if(!group.students.some(p=>p.studentRef===temporary.studentRef))group.students.push({...temporary});
   return route.fulfill({status:201,json:{ok:true,student:{...temporary}}});
  }
  if(path.endsWith('/lesson9/sessions')&&req.method()==='POST'){
   if(state.wrongPin)return route.fulfill({status:403,json:{error:'INVALID_ACCESS_CODE',message:'Mã truy cập không đúng.'}});
   return route.fulfill({json:{session:session(slug,body.studentRef,body.classRef)}});
  }
  if(path.endsWith('/teacher-comments'))return route.fulfill({json:{threads:[]}});
  if(path.includes('/lesson9/sessions/'))return route.fulfill({json:{session:session(slug,temporary.studentRef,'class-fixture')}});
  state.errors.push('Unexpected API '+req.method()+' '+path);return route.fulfill({status:500,json:{error:'UNEXPECTED_FIXTURE'}});
 });
 page.on('pageerror',error=>state.errors.push(error.message));
 await page.goto(origin+prefix+'/sw-task2-writing/index.html?task='+slug+(query?'&class=CS-FIXTURE':''));
 await page.locator('#identity-form').waitFor();
 return {context,page,state,registrations:()=>state.calls.filter(c=>c.path.endsWith('/provisional-students')),sessions:()=>state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/lesson9/sessions')),async close(){assert.deepEqual(state.errors,[]);await context.close();}};
}
async function show(page){await page.getByRole('button',{name:'Không có tên trong danh sách',exact:true}).click();await page.locator('#provisional-form').waitFor({state:'visible'});}
async function fill(page,pin='4826',confirm=pin){await page.locator('#provisional-name').fill(temporary.displayName);await page.locator('#provisional-pin').fill(pin);await page.locator('#provisional-pin-confirm').fill(confirm);}
async function create(page){await page.getByRole('button',{name:'Tạo hồ sơ tạm',exact:true}).click();}
async function screenshot(page,name){if(process.env.SW_ENTRY_OUTPUT){await fs.mkdir(process.env.SW_ENTRY_OUTPUT,{recursive:true});await page.screenshot({path:resolve(process.env.SW_ENTRY_OUTPUT,name+'.png'),fullPage:true});}}

test('SW: đủ tám đề có lối đăng ký khi thiếu tên, kể cả lớp rỗng và mobile',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{assert.equal(tasks.length,8);for(const slug of tasks){const f=await fixture(browser,{slug,width:390,empty:true});try{
  await show(f.page);assert.equal(await f.page.locator('#identity-class').inputValue(),'class-fixture');
  await fill(f.page);assert.equal(await f.page.locator('#provisional-form').evaluate(el=>el.checkValidity()),true);
  if(slug===task)await screenshot(f.page,'mobile-registration');
  assert(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(f.registrations().length,0);
 }finally{await f.close();}}}finally{await browser.close();}
});

test('SW: tạo hồ sơ, xác nhận vào bài, quay lại phải nhập mã; không lưu mã trên thiết bị',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{
  await show(f.page);await screenshot(f.page,'desktop-registration');await fill(f.page,'4826','1234');await create(f.page);assert.equal(f.registrations().length,0);
  await fill(f.page);await create(f.page);await f.page.locator('#provisional-form').waitFor({state:'hidden'});
  assert.equal(f.registrations().length,1);assert.equal(await f.page.locator('#identity-person').inputValue(),temporary.studentRef);
  assert.equal(await f.page.locator('#access-code').inputValue(),'4826');
  await f.page.getByRole('button',{name:/Tiếp tục/}).click();assert.equal(f.sessions().length,0);
  await f.page.getByRole('button',{name:/Đúng là tôi/}).click();await f.page.locator('#save-state').waitFor();
  assert.equal(f.sessions().length,1);assert.equal(f.sessions()[0].body.accessCode,'4826');
  const stored=await f.page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));assert(!stored.includes('4826'));assert(!stored.includes('"pin"'));
  await f.page.evaluate(()=>localStorage.clear());await f.page.reload();await f.page.locator('#identity-form').waitFor();
  await f.page.locator('#identity-person').selectOption(temporary.studentRef);assert.equal(await f.page.locator('#access-code').inputValue(),'');
  f.state.wrongPin=true;await f.page.locator('#access-code').fill('1111');await f.page.getByRole('button',{name:/Tiếp tục/}).click();await f.page.getByRole('button',{name:/Đúng là tôi/}).click();await f.page.getByText('Mã truy cập không đúng.',{exact:true}).waitFor();
  await f.page.getByRole('button',{name:'Chọn lại tên',exact:true}).click();assert.equal(await f.page.locator('#access-code').inputValue(),'');
  f.state.wrongPin=false;await f.page.locator('#access-code').fill('4826');await f.page.getByRole('button',{name:/Tiếp tục/}).click();await f.page.getByRole('button',{name:/Đúng là tôi/}).click();await f.page.locator('#save-state').waitFor();
 }finally{await f.close();await browser.close();}
});

test('SW: lỗi đăng ký giữ dữ liệu, chống bấm lặp và retry dùng cùng requestId',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{width:390});
 try{
  f.state.registerStatus=503;f.state.delay=300;await show(f.page);await fill(f.page);await create(f.page);
  assert.equal(await f.page.locator('#identity-class').isDisabled(),true);assert.equal(await f.page.locator('#provisional-submit').isDisabled(),true);
  await f.page.getByText('Máy chủ tạm gián đoạn.',{exact:true}).waitFor();assert.equal(await f.page.locator('#provisional-name').inputValue(),temporary.displayName);assert.equal(await f.page.locator('#provisional-pin').inputValue(),'4826');
  assert.equal(f.registrations().length,1);f.state.registerStatus=201;await create(f.page);await f.page.locator('#provisional-form').waitFor({state:'hidden'});
  assert.equal(f.registrations().length,2);assert.equal(f.registrations()[0].body.requestId,f.registrations()[1].body.requestId);assert.equal(f.sessions().length,0);
 }finally{await f.close();await browser.close();}
});

test('SW: trùng tên chọn hồ sơ có sẵn hoặc xác nhận là người khác, không gộp bài',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{
  f.state.registerStatus=409;await show(f.page);await fill(f.page);await create(f.page);await f.page.locator('#provisional-duplicate-row').waitFor({state:'visible'});
  assert.equal(await f.page.locator('#identity-person').inputValue(),temporary.studentRef);assert.equal(await f.page.locator('#access-code').inputValue(),'');
  assert.equal(await f.page.locator('#identity-person option:checked').textContent(),temporary.alias);assert.equal(f.sessions().length,0);
  await f.page.locator('#provisional-duplicate').check();f.state.registerStatus=201;await fill(f.page);await create(f.page);await f.page.locator('#provisional-form').waitFor({state:'hidden'});
  assert.equal(f.registrations()[1].body.duplicateConfirmed,true);assert.notEqual(f.registrations()[0].body.requestId,f.registrations()[1].body.requestId);
 }finally{await f.close();await browser.close();}
});

test('SW: chọn lớp trước, đổi lớp xóa mã và xác nhận trùng tên của lớp cũ',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{query:false});
 try{
  await f.page.getByRole('button',{name:'Không có tên trong danh sách',exact:true}).click();assert.equal(await f.page.locator('#provisional-form').isVisible(),false);
  await f.page.locator('#identity-class').selectOption('class-fixture');await show(f.page);await fill(f.page);
  await f.page.locator('#identity-class').selectOption('other-class');assert.equal(await f.page.locator('#provisional-form').isVisible(),false);
  await show(f.page);assert.equal(await f.page.locator('#provisional-pin').inputValue(),'');await fill(f.page);await create(f.page);await f.page.locator('#provisional-form').waitFor({state:'hidden'});
  assert.equal(f.registrations()[0].body.classRef,'other-class');assert.equal(f.sessions().length,0);
 }finally{await f.close();await browser.close();}
});

test('SW: hủy đăng ký vẫn vào bài bằng tên có sẵn, không gửi đăng ký tạm',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{
  await show(f.page);await fill(f.page);await f.page.getByRole('button',{name:'Quay lại chọn tên',exact:true}).click();
  assert.equal(await f.page.locator('#provisional-pin').inputValue(),'');assert.equal(await f.page.locator('#provisional-form').isVisible(),false);
  await f.page.locator('#identity-person').selectOption(official.studentRef);assert.equal(await f.page.locator('#pin-box').isVisible(),false);
  await f.page.getByRole('button',{name:/Tiếp tục/}).click();await f.page.getByRole('button',{name:/Đúng là tôi/}).click();await f.page.locator('#save-state').waitFor();
  assert.equal(f.registrations().length,0);assert.equal(f.sessions()[0].body.studentRef,official.studentRef);assert.equal(f.sessions()[0].body.accessCode,undefined);
 }finally{await f.close();await browser.close();}
});
