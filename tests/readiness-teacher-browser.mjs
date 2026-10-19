import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';

const imported=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=imported.chromium?imported:imported.default;
const A='a0000000-0000-4000-8000-000000000001',B='a0000000-0000-4000-8000-000000000002',C='a0000000-0000-4000-8000-000000000003';
const when='2026-10-19T02:00:00Z';
test('Làm quen GV: đọc nháp và thiết bị, đúng lượt/A–B/reload, hết phiên ẩn dữ liệu; không audio',async t=>{
 const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true});
 t.after(async()=>{t.diagnostic(JSON.stringify({errors,forbidden,calls,notice:await page.locator('#notice').textContent().catch(()=>null)}));await browser.close();await server.close();});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(8000);
 const errors=[],forbidden=[],calls=[];let signed=true,delayA=false,googleLoads=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{if(location.hostname==='127.0.0.1'&&!localStorage.getItem('fixture-draft'))localStorage.setItem('fixture-draft','Nháp học viên cần giữ');});
 const session=(ref,old=false)=>({viewId:(old?'a':'b').repeat(64),createdAt:when,sameComputer:true,sameHeadphones:false,heardSeconds:12,heardConfirmed:old,submittedAt:old?when:null,
  listeningAnswers:{'1':old?'A cũ':'B mới'},readingAnswers:{'1':'C'},writingText:'Bản Writing '+(ref===A?'A':'B')+(old?' cũ':' mới'),
  webChecks:{checks:[{id:'session',state:'warn',code:'SLOW'}]}});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(req.resourceType()==='media'||/\.(mp3|wav|ogg|enc)(?:$|\?)|\/(?:audio|audio-access)(?:\/|$)/i.test(url.href)){forbidden.push(url.href);return route.abort();}
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname==='accounts.google.com'){googleLoads++;return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{id:{initialize(o){this.cb=o.callback},renderButton(el){const b=document.createElement('button');b.textContent='Google thử';b.onclick=()=>this.cb({credential:'fixture-google'});el.replaceChildren(b)},disableAutoSelect(){}}}};"});}
  if(url.hostname!=='ducizone.ddns.net'){forbidden.push(url.href);return route.abort();}
  calls.push({path,method:req.method()});
  if(path.endsWith('/api/auth/session')&&req.method()==='POST'){signed=true;return route.fulfill({json:{ok:true}});}
  if(req.method()!=='GET'){forbidden.push(req.method()+' '+path);return route.abort();}
  if(!signed)return route.fulfill({status:401,json:{ok:false,message:'Phiên đã hết hạn.'}});
  const root='/api/k67-readiness/v1/teacher';
  if(path.endsWith(root+'/classes'))return route.fulfill({json:{ok:true,classes:[{classId:'1293',classCode:'IC2304'}]}});
  if(path.endsWith(root+'/students'))return route.fulfill({json:{ok:true,students:[A,B,C].map((ref,i)=>({studentRef:ref,name:'Học viên '+['A','B','C'][i],active:true,sessions:ref===C?[]:[{createdAt:when,readingSaved:true,writingSaved:true}]}))}});
  if(path.includes(root+'/students/')){const ref=path.split('/').at(-1);if(ref===A&&delayA)await new Promise(r=>setTimeout(r,300));return route.fulfill({json:{ok:true,student:{studentRef:ref,name:ref===A?'Học viên A':'Học viên B',classCode:'IC2304'},sessions:ref===A?[session(ref,true),session(ref)]:[session(ref)]}}).catch(()=>{});}
  return route.fulfill({status:401,json:{ok:false,error:'FIXTURE_NO_STUDENT_OPEN',message:'Bộ thử không mở phiên học viên.'}});
 });
 await page.goto(server.base+'term-tests/lam-quen-k67/index.html?class=IC2304');
 const entry=page.locator('[data-teacher-entry]');await entry.waitFor();const href=await entry.getAttribute('href');assert.equal(new URL(href).pathname,'/term-tests/lam-quen-k67/teacher.html');
 await page.goto(href);await page.getByRole('button',{name:'Xem bản đã lưu →'}).first().click();await page.getByText('Bản Writing A mới',{exact:true}).waitFor();
 assert.equal(googleLoads,0);assert.match(await page.locator('#detail').innerText(),/Kết nối hệ thống: Cần kiểm tra/);
 await page.getByLabel('Lượt làm quen').selectOption('a'.repeat(64));await page.getByText('Bản Writing A cũ',{exact:true}).waitFor();
 await page.reload();await page.getByText('Bản Writing A cũ',{exact:true}).waitFor();
 delayA=true;await page.getByRole('button',{name:'Xem bản đã lưu →'}).first().click();await page.getByRole('button',{name:'Xem bản đã lưu →'}).nth(1).click();
 await page.getByText('Bản Writing B mới',{exact:true}).waitFor();await page.waitForTimeout(350);assert.equal((await page.locator('#detail').innerText()).includes('Bản Writing A'),false);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const output=process.env.TEACHER_EVIDENCE_DIR;if(output){await mkdir(output,{recursive:true});await page.screenshot({path:join(output,'readiness-teacher-mobile.png'),fullPage:true});}
 signed=false;await page.getByRole('button',{name:'Cập nhật',exact:true}).click();await page.getByRole('button',{name:'Google thử'}).waitFor();
 assert.equal((await page.locator('body').innerText()).includes('Bản Writing B'),false);await page.getByRole('button',{name:'Google thử'}).click();
 await page.getByText('Bản Writing B mới',{exact:true}).waitFor();assert.equal(await page.locator('audio').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-draft')),'Nháp học viên cần giữ');assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 assert.equal(calls.some(c=>/\/(draft|submit|session|checks)$/.test(c.path)&&!c.path.endsWith('/api/auth/session')),false);
});
