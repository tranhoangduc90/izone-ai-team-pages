import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';

const imported=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=imported.chromium?imported:imported.default;
const A='70000000-0000-4000-8000-000000000001',B='70000000-0000-4000-8000-000000000002';
const old='a'.repeat(64),latest='b'.repeat(64),when='2026-10-19T02:00:00.000Z';

// Hai HTML thật; chỉ API/Google được mô phỏng và mọi mạng ngoài bị chặn.
// API cũ dùng schema query strict: mode/viewId bị400, bản đầy đủ không có revision/format.
// Đây là kiểm tương thích giao thức, không nhận là native K56/K67 hoặc Google thật.
for(const family of ['k67','k56'])test(`Saved progress ${family}: open compact modal survives API rollback, validates legacy binding and still locks on revocation`,async t=>{
 const slug=family==='k67'?'term-test-1':'term-test-1-k56',folder=family==='k67'?'teacher':'teacher-k56';
 const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true});
 t.after(async()=>{await browser.close();await server.close();});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(6000);
 const calls=[],errors=[],outside=[];let rollback=false,unavailable=false,wrongBinding=false,revoked=false,delayedA=false,answer='Bản cũ giữ nguyên';
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;
  if(u.hostname==='127.0.0.1')return route.continue();
  if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){},disableAutoSelect(){}}}};'});
  if(u.hostname!=='ducizone.ddns.net'){outside.push(u.origin);return route.abort();}
  calls.push({path,mode:u.searchParams.get('mode'),student:u.searchParams.get('student'),method:req.method()});
  if(req.method()!=='GET'){outside.push(req.method()+' '+path);return route.abort();}
  const reply=(status,json)=>route.fulfill({status,json}).catch(()=>{});
  if(revoked)return reply(403,{ok:false,error:'ACCESS_DENIED',message:'Quyền xem lớp đã bị thu hồi.'});
  const reviewer={email:'teacher@fixture.test',displayName:'GV thử',role:'teacher'},cls={id:'1293',name:'IC2304',accessMode:'assigned_teacher',isAssignedTeacher:true};
  if(path.endsWith('/api/auth/session'))return reply(200,{ok:true,reviewer});
  if(path.endsWith('/teacher/options'))return reply(200,{ok:true,reviewer,classes:[cls],tests:[{slug,title:'Đề thử',version:1}],capabilities:{teacherStateVersion:1,teacherSavedProgressVersion:1}});
  if(path.endsWith('/teacher/results'))return reply(200,{ok:true,reviewer,class:cls,test:{slug,title:'Đề thử'},students:[{ref:A,name:'Học viên A',status:'incomplete'},{ref:B,name:'Học viên B',status:'not_started'}]});
  if(path.endsWith('/teacher/state')){
   if(rollback)return reply(404,{ok:false,error:'NOT_FOUND'});
   return reply(200,{ok:true,state:{kind:'term-teacher-state-v1',className:'IC2304',testSlug:slug,studentRef:u.searchParams.get('student'),definitionVersion:1,contentRevision:'1'.repeat(32),accessRevision:'2'.repeat(32)}});
  }
  if(path.endsWith('/teacher/state/stream'))return route.fulfill({contentType:'text/event-stream',body:': fixture stream closed\n\n'});
  if(path.endsWith('/teacher/saved-progress')){
   const mode=u.searchParams.get('mode'),ref=u.searchParams.get('student');
   if(mode&&unavailable)return reply(503,{ok:false,error:'FIXTURE_TEMPORARY'});
   if(rollback&&mode)return reply(400,{ok:false,error:'INVALID_QUERY',message:'Yêu cầu xem tiến trình không hợp lệ.'});
   const attempts=[true,false].map(isOld=>({viewId:isOld?old:latest,...(mode?{revision:'3'.repeat(32)}:{}),createdAt:when,definitionVersion:1,superseded:isOld,order:'read_first',delivery:'cbt',
    ...(mode==='index'?{}:{listening:{answers:{'1':ref===A?(isOld?answer:'Bản mới A'):'Bản riêng B'},savedAt:when,startedAt:when},reading:{answers:{}},writing:{}})}));
   const payload={ok:true,student:{ref,name:ref===A?'Học viên A':'Học viên B'},test:{slug:wrongBinding?'term-test-foreign':slug},attempts:mode==='view'?attempts.filter(a=>a.viewId===u.searchParams.get('viewId')):attempts,
    ...(mode?{format:'saved-progress-'+mode+'-v1'}:{})};
   if(!mode&&delayedA&&ref===A)await new Promise(done=>setTimeout(done,450));
   return reply(200,payload);
  }
  return reply(404,{ok:false,error:'FIXTURE_UNHANDLED'});
 });
 const count=mode=>calls.filter(c=>c.path.endsWith('/saved-progress')&&c.mode===mode).length;
 await page.goto(server.base+`term-tests/${folder}/?class=IC2304&test=${slug}&student=${A}`);
 await page.getByRole('button',{name:'Xem tiến trình đã lưu'}).click();let dialog=page.getByRole('dialog');
 await dialog.getByText('Bản mới A',{exact:true}).waitFor();await dialog.getByLabel('Lượt làm').selectOption(old);
 await dialog.getByText(answer,{exact:true}).waitFor();assert.equal(count(null),0);assert.ok(count('index')>=1);
 unavailable=true;await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();await dialog.getByText(/Chưa cập nhật được/).waitFor();
 assert.equal(await dialog.getByText(answer,{exact:true}).count(),1);assert.equal(count(null),0);
 unavailable=false;rollback=true;wrongBinding=true;await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();
 await dialog.getByText(/Dữ liệu trả về chưa khớp học viên và bài đang chọn/).waitFor();assert.equal(await dialog.getByText(answer,{exact:true}).count(),1);
 const before=count(null);wrongBinding=false;answer='Bản cũ sau quay lui';await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();
 await dialog.getByText(answer,{exact:true}).waitFor();assert.ok(count(null)>before);assert.equal(await dialog.getByLabel('Lượt làm').inputValue(),old);
 const compactReads=count('index')+count('view');answer='Bản cũ tiếp tục cập nhật';await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();
 await dialog.getByText(answer,{exact:true}).waitFor();assert.equal(count('index')+count('view'),compactReads);
 await dialog.getByRole('button',{name:'Đóng',exact:true}).click();delayedA=true;
 const rejectedCompact=page.waitForResponse(r=>r.url().includes('/saved-progress?')&&new URL(r.url()).searchParams.get('mode')==='index');
 await page.getByRole('button',{name:'Xem tiến trình đã lưu'}).click();await rejectedCompact;
 await dialog.getByRole('button',{name:'Đóng',exact:true}).click();await page.getByRole('tab',{name:/Học viên B/}).click();
 await page.getByRole('button',{name:'Xem tiến trình đã lưu'}).click();dialog=page.getByRole('dialog');await dialog.getByText('Bản riêng B',{exact:true}).waitFor();
 await page.waitForTimeout(500);assert.equal((await dialog.innerText()).includes('Bản cũ tiếp tục cập nhật'),false);
 revoked=true;await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();await dialog.waitFor({state:'detached'});
 assert.equal((await page.locator('body').innerText()).includes('Bản riêng B'),false);
 assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);assert.equal(calls.some(c=>c.method!=='GET'),false);
 t.diagnostic(JSON.stringify({family,fixture:'actual teacher HTML; strict legacy wire protocol; mocked auth/API',legacyReads:count(null),externalRequests:0}));
});
