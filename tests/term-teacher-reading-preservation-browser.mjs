import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';
const imported=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=imported.chromium?imported:imported.default;
const A='70000000-0000-4000-8000-000000000001',B='70000000-0000-4000-8000-000000000002';
const realCycles=process.env.TERM_TRACKING_REAL_CYCLES==='1';

for(const family of ['k67','k56'])for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`Teacher ${family} ${viewport.width}: preserve reading DOM, accept new data, discard late class response`,async t=>{
 const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true});
 t.after(async()=>{await browser.close();await server.close();});
 const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage();
 const slug=family==='k67'?'term-test-1':'term-test-1-k56',folder=family==='k67'?'teacher':'teacher-k56';
 let results=0,saved=0,otherName='Học viên B',writing='Bài Writing đang đọc\n'.repeat(90),delayed=null,delayClass='IC2304',delayedStatus=0,failStatus=0,completed=false,writingReady=false,answer='Đáp án đang đọc';
 const classes=[{id:'1293',name:'IC2304'},{id:'1294',name:'IC2305'}].map(c=>({...c,accessMode:'assigned_teacher',isAssignedTeacher:true}));
 const errors=[],forbidden=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;
  if(u.hostname==='127.0.0.1')return route.continue();
  if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){},disableAutoSelect(){}}}};'});
  if(u.hostname!=='ducizone.ddns.net'||req.method()!=='GET'){forbidden.push(req.method()+' '+u.href);return route.abort();}
  const reviewer={email:'teacher@fixture.test',displayName:'Giảng viên thử',role:'teacher'};
  if(path.endsWith('/api/auth/session'))return route.fulfill({json:{ok:true,reviewer}});
  if(path.endsWith('/teacher/options'))return route.fulfill({json:{ok:true,reviewer,classes,tests:[{slug,title:'Đề thử',version:1}]}});
  if(path.endsWith('/teacher/results')){
   results++;const cls=classes.find(c=>c.name===u.searchParams.get('class'));
   const section=()=>({correct:0,total:1,band:4,details:[{number:1,studentAnswer:answer,correctAnswer:'A',result:'incorrect'}]});
   const data={ok:true,reviewer,class:cls,test:{slug,title:'Đề thử',version:1},students:[{ref:A,name:cls.name==='IC2304'?'Học viên A':'Học viên lớp mới',status:completed?'completed':'incomplete',
    ...(completed?{completedAt:'2026-11-01T00:00:00Z',result:{testTitle:'Đề thử',listening:section(),reading:section(),performance:{},typeStats:[]},
     writing:{status:writingReady?'ready':'processing',task2State:writingReady?'ready':'processing',task2Score:writingReady?6:null,writingScore:writingReady?6:null,updatedAt:writingReady?'2026-11-01T01:00:00Z':null}}:{})},
    {ref:B,name:otherName,status:'not_started'}]};
   if(delayed&&cls.name===delayClass){const wait=delayed,status=delayedStatus;delayed=null;await wait;
    if(status)return route.fulfill({status,json:{ok:false,error:'OLD_SCOPE_REVOKED'}}).catch(()=>{});}
   return route.fulfill({json:data}).catch(()=>{});
  }
  if(path.endsWith('/teacher/saved-progress')){
   saved++;if(failStatus)return route.fulfill({status:failStatus,json:{ok:false,error:'FIXTURE_FAILURE',message:'Lỗi đọc thử'}});
   return route.fulfill({json:{ok:true,test:{slug,title:'Đề thử'},student:{ref:A,name:'Học viên A'},attempts:[{
    viewId:'a'.repeat(64),definitionVersion:1,createdAt:'2026-11-01T00:00:00Z',order:'read_first',delivery:'cbt',
    listening:{answers:{'11':'A'},savedAt:'2026-11-01T00:00:00Z'},reading:{answers:{'14':'B'}},writing:{task2:writing}}]}});
  }
  return route.fulfill({status:404,json:{ok:false,error:'FIXTURE_UNSUPPORTED'}});
 });
 await page.goto(`${server.base}term-tests/${folder}/?class=IC2304&test=${slug}&student=${A}`);
 await page.locator('#studentView h2').filter({hasText:'Học viên A'}).waitFor();
 await page.evaluate(()=>{globalThis.readingHeading=document.querySelector('#studentView h2');});
 otherName='Học viên B vừa cập nhật';await page.locator('#refreshButton').click();
 await page.getByRole('tab',{name:/Học viên B vừa cập nhật/}).waitFor();
 assert.equal(await page.evaluate(()=>readingHeading===document.querySelector('#studentView h2')),true,'another student update must preserve the selected student DOM');
 await page.getByRole('button',{name:'Xem tiến trình đã lưu'}).click();
 const dialog=page.getByRole('dialog');await dialog.locator('pre').waitFor();
 await page.evaluate(()=>{
  const pre=document.querySelector('dialog pre');globalThis.readingPre=pre;
  const range=document.createRange();range.setStart(pre.firstChild,5);range.setEnd(pre.firstChild,25);
  getSelection().removeAllRanges();getSelection().addRange(range);
  document.querySelector('dialog select').focus();document.querySelector('dialog').scrollTop=300;
  globalThis.readingSelection=getSelection().toString();globalThis.readingScroll=document.querySelector('dialog').scrollTop;
 });
 if(realCycles){
  const started=Date.now();while(saved<4&&Date.now()-started<110000)await new Promise(r=>setTimeout(r,1000));
  assert.ok(saved>=4,'initial read plus three native thirty-second cycles');
 }else await Promise.all([page.waitForResponse(r=>r.url().includes('/teacher/saved-progress')),
  dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).evaluate(el=>el.click())]);
 await page.waitForFunction(()=>document.querySelector('dialog')?.textContent.includes('Đã đọc lúc'));
 assert.deepEqual(await page.evaluate(()=>({same:readingPre===document.querySelector('dialog pre'),selection:getSelection().toString()===readingSelection,
  scroll:document.querySelector('dialog').scrollTop===readingScroll})),{same:true,selection:true,scroll:true});
 writing+='Dòng mới cùng lượt';await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();
 await dialog.getByText(/Dòng mới cùng lượt/).waitFor();
 failStatus=503;await dialog.getByRole('button',{name:'Cập nhật bản đã lưu'}).click();await dialog.getByText(/Chưa cập nhật được/).waitFor();
 assert.ok((await dialog.locator('pre').innerText()).includes('Dòng mới cùng lượt'));
 failStatus=0;await page.setViewportSize({width:390,height:844});assert.ok(await dialog.evaluate(el=>el.getBoundingClientRect().width<=innerWidth));
 await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
 completed=true;await page.locator('#refreshButton').click();await page.locator('#studentView .detail-block').first().waitFor();
 await page.evaluate(()=>{
  const block=document.querySelector('#studentView .detail-block');block.open=true;globalThis.resultBlock=block;
  const cell=block.querySelector('tbody td:nth-child(2)'),range=document.createRange();range.selectNodeContents(cell);
  getSelection().removeAllRanges();getSelection().addRange(range);globalThis.resultSelection=getSelection().toString();
  block.querySelector('summary').focus();
 });
 writingReady=true;await Promise.all([page.waitForResponse(r=>r.url().includes('/teacher/results')),page.locator('#refreshButton').evaluate(el=>el.click())]);
 await page.locator('#studentView .teacher-writing-score-button').waitFor();
 assert.deepEqual(await page.evaluate(()=>({same:resultBlock===document.querySelector('#studentView .detail-block'),open:resultBlock.open,
  selection:getSelection().toString()===resultSelection,focus:document.activeElement===resultBlock.querySelector('summary')})),{same:true,open:true,selection:true,focus:true});
 answer='Đáp án mới cùng lượt';await page.locator('#refreshButton').click();await page.locator('#studentView').getByText(answer,{exact:true}).first().waitFor();
 let release;delayed=new Promise(r=>release=r);const before=results;await page.locator('#refreshButton').click();
 await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Đang tải'));
 await page.locator('#classSelect').selectOption('1294');
 const started=Date.now();while(results<before+2&&Date.now()-started<3000)await new Promise(r=>setTimeout(r,50));
 release();await page.getByRole('tab',{name:/Học viên lớp mới/}).waitFor();
 await page.waitForTimeout(150);assert.equal(await page.getByRole('tab',{name:'Học viên A',exact:true}).count(),0);
 delayClass='IC2305';delayedStatus=403;delayed=new Promise(r=>release=r);const beforeDenied=results;
 await page.locator('#refreshButton').click();await page.locator('#classSelect').selectOption('1293');
 const denialStarted=Date.now();while(results<beforeDenied+2&&Date.now()-denialStarted<3000)await new Promise(r=>setTimeout(r,50));
 release();await page.getByRole('tab',{name:'Học viên A',exact:true}).waitFor();await page.waitForTimeout(150);
 assert.equal(await page.locator('#dashboardView').isVisible(),true,'an obsolete class denial cannot sign out the current authorized scope');
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 t.diagnostic(JSON.stringify({results,saved,realCycles}));
});
