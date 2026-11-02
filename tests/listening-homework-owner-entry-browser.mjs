// Real Homework controller/renderer; all API, identity and media are isolated fixtures.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/ADMIN/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true});
after(async()=>{await browser.close();await site.close();});
const refs={A:'11111111-1111-4111-8111-111111111111',B:'22222222-2222-4222-8222-222222222222'},erp={A:'900001',B:'900002'},key='izone:student-identity:v1';
const documentId='fixture-homework-document-owner-b-123456789';
const record=id=>({version:1,identity:{authority:'erp-contact',id},revision:'fixture_initial_revision_'+id,updatedAt:new Date().toISOString()});
const rows=[['scandinavian-studies','interactive-content.json'],['horton-castle','horton-castle-content.json']];
async function fixture(t,slug,{remembered,storageBlocked=false,teacher=false,teacherStatus=200,entryStatus=200,polling=false,entryDelay=0,historyBlocked=false}={}){
 const presentation=JSON.parse(await readFile(path.join(root,'listening-homework',rows.find(x=>x[0]===slug)[1]),'utf8'));
 const content={code:presentation.code,version:presentation.runtimeVersion,title:presentation.title,minimumCompletion:.8,items:presentation.items.map(({id,group,question})=>({id,group,question}))};
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}}),requests=[],errors=[],external=[],drafts=new Map();
 let teacherActive=teacher,attemptReads=0;
 context.on('page',p=>{p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));});
 await context.addInitScript(({key,initial,blocked,origin,historyBlocked})=>{
  if(location.origin!==origin)return;
  if(initial&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(initial));
  window.__fixturePlays=0;HTMLMediaElement.prototype.play=function(){window.__fixturePlays++;return Promise.resolve();};
  if(historyBlocked)history.replaceState=()=>{throw new DOMException('Fixture History API denied','SecurityError');};
  if(blocked)for(const name of ['sessionStorage','localStorage'])Object.defineProperty(window,name,{configurable:true,get(){throw new DOMException('Fixture storage blocked','SecurityError');}});
 },{key,initial:remembered?record(erp[remembered]):null,blocked:storageBlocked,origin:site.origin,historyBlocked});
 const who=ref=>({ownerId:ref,courseId:'1293',name:ref===refs.A?'Fixture A':'Fixture B',className:'IC2304'});
 const entry={documentId,classId:'1293',studentRef:refs.B,name:'Fixture B',classCode:'IC2304',code:content.code,version:content.version};
 const draft=ref=>{if(!drafts.has(ref))drafts.set(ref,{revision:1,runNo:1,body:{answers:{D1:ref===refs.A?'Draft A':'Draft B'},annotations:[],notes:'',flags:[]},savedAt:new Date().toISOString()});return drafts.get(ref);};
 const attempts=()=>polling?[{attemptId:'33333333-3333-4333-8333-333333333333',runNo:1,draftRevision:1,status:'processing',createdAt:new Date().toISOString()}]:[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(/\.(mp3|wav|m4a|enc|ogg)$/.test(url.pathname)){external.push('media');return route.abort();}
  if(process.env.BASE_REVISION&&url.origin===site.origin&&/^\/listening-homework\/(app\.mjs|scandinavian-studies\.html|horton-castle\.html)$/.test(url.pathname))return route.fulfill({contentType:url.pathname.endsWith('.mjs')?'text/javascript':'text/html',body:execFileSync('git',['show',process.env.BASE_REVISION+':'+url.pathname.slice(1)],{cwd:root})});
  if(url.origin===site.origin&&!url.pathname.startsWith('/api/'))return route.continue();
  if(!url.pathname.includes('/api/listening-homework67')&&!url.pathname.includes('/teacher-session-api/')){external.push(url.origin);return route.abort();}
  const api=url.pathname.includes('/api/listening-homework67')?url.pathname.split('/api/listening-homework67')[1]:'/sso';
  const body=req.postDataJSON(),ref=req.headers().authorization==='Bearer fixture-token-A'?refs.A:refs.B;
  requests.push({api,method:req.method(),ref,document:req.headers()['x-reading-homework-document'],body});
  const send=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(api==='/config')return send({ok:true,fixture:true,product:'listeninghomework',code:content.code,title:content.title,studentsOpen:true,ownerEntry:{classes:[{classId:'1293',classCode:'IC2304'}]}});
  if(api==='/entry'||api==='/teacher/entry'){
   if(entryDelay)await new Promise(r=>setTimeout(r,entryDelay));
   if(api==='/teacher/entry'&&!teacherActive)return send({error:'TEACHER_LOGIN_REQUIRED'},401);
   return entryStatus===200&&url.searchParams.get('documentId')===documentId?send({ok:true,entry}):send({error:entryStatus===503?'OWNER_SOURCE_UNAVAILABLE':'HOMEWORK_ENTRY_NOT_FOUND'},entryStatus===200?403:entryStatus);
  }
  if(api==='/identity/resolve'){
   const id=body.identity?.id||(body.studentRef===refs.A?erp.A:erp.B),studentRef=id===erp.A?refs.A:refs.B;
   return send({ok:true,status:'unique',identity:{authority:'erp-contact',id},aliases:[{classId:'1293',classCode:'IC2304',studentRef,studentName:who(studentRef).name}]});
  }
  if(api==='/classes'||api==='/teacher/classes')return api.startsWith('/teacher')&&(!teacherActive||teacherStatus!==200)?send({error:teacherStatus===503?'SSO_UNAVAILABLE':'ACCESS_DENIED'},teacherActive?teacherStatus:401):send({ok:true,classes:[{id:'1293',classCode:'IC2304'}]});
  if(/\/students$|^\/teacher\/students\//.test(api))return send({ok:true,students:Object.values(refs).map(studentRef=>({studentRef,name:who(studentRef).name}))});
  if(api==='/student/login')return send({token:'fixture-token-'+(body.studentRef===refs.A?'A':'B'),identity:who(body.studentRef)});
  if(api==='/student/logout')return send({ok:true});
  if(api==='/teacher/login'){teacherActive=true;return send({ok:true});}
  if(api==='/teacher/logout'){teacherActive=false;return send({ok:true});}
  if(api==='/lesson')return send({ok:true,content,identity:who(ref)});
  if(api==='/draft'&&req.method()==='GET')return send(draft(ref));
  if(api==='/draft'&&req.method()==='PUT'){const value={...draft(ref),revision:draft(ref).revision+1,body:body.body};drafts.set(ref,value);return send(value);}
  if(api==='/attempts')return send({attempts:attempts()});
  if(api.startsWith('/attempts/')){attemptReads++;return send({...attempts()[0],validationProgress:{phase:'review'},snapshot:{answers:{D1:'Older draft'}},result:null});}
  if(api==='/homework')return send({ok:true,status:'not_applicable'});
  if(/^\/teacher\/work\//.test(api)){const selected=api.includes(refs.A)?refs.A:refs.B;return send({ok:true,content,identity:who(selected),draft:draft(selected),attempts:[],readonly:true});}
  if(api==='/audio')return send({error:'AUDIO_UNAVAILABLE'},503);
  if(api==='/sso')return send({ok:false,error:'TEACHER_LOGIN_REQUIRED'},401);
  return send({error:'UNEXPECTED_FIXTURE_ROUTE'},500);
 });
 const page=await context.newPage(),url=(personal=false,tail='')=>`${site.origin}/listening-homework/${slug}.html?assignmentCode=${content.code}${personal?'&mode=student&class=IC2304&documentId='+documentId:''}${tail}`;
 t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);for(const p of context.pages())assert.equal(await p.evaluate(()=>window.__fixturePlays||0).catch(()=>0),0);}finally{await context.close();}});
 return {context,page,url,requests,drafts,content,get attemptReads(){return attemptReads;}};
}
const memoryId=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.identity?.id,key);
const privateReads=requests=>requests.filter(r=>/^\/(lesson|draft|attempts|homework|audio)(\/|$)/.test(r.api));
const loaded=page=>page.locator('#field-D1').waitFor({state:'visible'});
for(const [slug]of rows){
 test(slug+': first Doc confirmation automatically remembers ERP without student checkbox or Google',async t=>{
  const f=await fixture(t,slug);await f.page.goto(f.url(true));await f.page.locator('#student-form').waitFor({state:'visible'});
  assert.equal(await f.page.locator('#remember').count(),0);assert.equal(await f.page.locator('#class').isDisabled(),true);assert.equal(await f.page.locator('#student option:not([value=""])').count(),1);assert.equal(privateReads(f.requests).length,0);
  await f.page.locator('#entry-submit').click();await loaded(f.page);assert.equal(await memoryId(f.page),erp.B);assert.match(await f.page.locator('#person').innerText(),/Fixture B/);
  assert.ok(f.requests.filter(r=>['/student/login','/lesson','/draft'].includes(r.api)).every(r=>r.document===documentId));
  assert.equal(f.requests.filter(r=>r.api==='/teacher/login').length,0);
 });
 test(slug+': remembered A opening Doc B waits for owner confirmation; two tabs and reload preserve A draft and global B memory',async t=>{
  const f=await fixture(t,slug,{remembered:'A'});await f.page.goto(f.url());await loaded(f.page);assert.equal(await f.page.locator('#field-D1').inputValue(),'Draft A');
  await f.page.locator('#field-D1').fill('Saved in tab A');
  // Chờ đúng bản ghi mới ở biên lưu; dòng “Đã lưu nháp” có thể còn là ACK của bản trước.
  const saveDeadline=Date.now()+8000;while(f.drafts.get(refs.A)?.body.answers.D1!=='Saved in tab A'&&Date.now()<saveDeadline)await new Promise(r=>setTimeout(r,20));
  assert.equal(f.drafts.get(refs.A)?.body.answers.D1,'Saved in tab A');await f.page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('Đã lưu nháp'));
  const before=f.requests.length,p=await f.context.newPage();await p.goto(f.url(true));await p.waitForFunction(()=>document.querySelector('#access-title')?.textContent==='Xác nhận người học'||document.querySelector('#field-D1'));assert.equal(privateReads(f.requests.slice(before)).length,0);await p.locator('#student-form').waitFor({state:'visible'});assert.equal(await memoryId(p),erp.A);assert.equal(await p.locator('#student').inputValue(),refs.B);
  await p.locator('#entry-submit').click();await loaded(p);assert.equal(await memoryId(p),erp.B);assert.equal(await f.page.locator('#field-D1').inputValue(),'Saved in tab A');
  await f.page.reload();await loaded(f.page);assert.match(await f.page.locator('#person').innerText(),/Fixture A/);assert.equal(await f.page.locator('#field-D1').inputValue(),'Saved in tab A');assert.equal(await memoryId(f.page),erp.B);
 });
 test(slug+': correct owner restores automatically while blocked storage keeps a valid RAM session and reports the limit',async t=>{
  const f=await fixture(t,slug,{remembered:'B'});await f.page.goto(f.url(true));await loaded(f.page);assert.equal(await memoryId(f.page),erp.B);
  const g=await fixture(t,slug,{storageBlocked:true});await g.page.goto(g.url(true));await g.page.locator('#student-form').waitFor({state:'visible'});await g.page.locator('#entry-submit').click();await loaded(g.page);await g.page.locator('#global-error').waitFor({state:'visible'});assert.match(await g.page.locator('#global-error').innerText(),/chưa giữ được phiên/);
 });
 test(slug+': owner-source error and unknown Doc block before lesson/draft/session; teacher cookie alone remains student intent',async t=>{
  const f=await fixture(t,slug,{remembered:'A',entryStatus:503,teacher:true});await f.page.goto(f.url(true));await f.page.locator('#access-retry').waitFor({state:'visible'});assert.equal(privateReads(f.requests).length,0);assert.equal(f.requests.filter(r=>r.api==='/student/login'||r.api.startsWith('/teacher/')).length,0);assert.equal(await memoryId(f.page),erp.A);
  const g=await fixture(t,slug,{remembered:'A'});await g.page.goto(g.url(true).replace(documentId,'fixture-unknown-document-123456789'));await g.page.locator('#access-retry').waitFor({state:'visible'});assert.equal(privateReads(g.requests).length,0);assert.equal(g.requests.filter(r=>r.api==='/student/login').length,0);
 });
 test(slug+': teacher opens bound B before any student login, preserves code/Doc on logout and keeps denied/error roles blocked',async t=>{
  const f=await fixture(t,slug,{teacher:true,remembered:'A'});await f.page.goto(f.url(true,'&teacher=1'));await loaded(f.page);assert.match(await f.page.locator('#person').innerText(),/Fixture B/);assert.equal(await f.page.locator('#submit').isVisible(),false);assert.equal(f.requests.filter(r=>r.api==='/student/login').length,0);assert.equal(await memoryId(f.page),erp.A);
  await f.page.locator('#teacher-logout').click();await f.page.locator('#teacher-login').waitFor({state:'visible'});const next=new URL(f.page.url());assert.equal(next.searchParams.get('documentId'),documentId);assert.equal(next.searchParams.get('assignmentCode'),f.content.code);
  for(const status of [403,503]){const g=await fixture(t,slug,{teacher:true,teacherStatus:status});await g.page.goto(g.url(true,'&teacher=1'));await g.page.locator('#teacher-login').waitFor({state:'visible'});assert.equal(g.requests.filter(r=>r.api==='/student/login').length,0);assert.equal(await g.page.locator('#google-button').isVisible(),false);assert.equal(privateReads(g.requests).length,0);}
 });
 test(slug+': switching learner retains assignment and Doc, and unchanged native polls preserve DOM, focus, selection and scroll',async t=>{
  const f=await fixture(t,slug,{remembered:'B',polling:true});await f.page.goto(f.url(true));await loaded(f.page);await f.page.locator('#field-D1').fill('Draft kept across unchanged polls');await f.page.locator('#field-D1').evaluate(e=>{e.focus();e.setSelectionRange(2,8);e.scrollIntoView({block:'center'});window.__entryNode=e;});
  const initial=await f.page.locator('#field-D1').evaluate(e=>({top:e.getBoundingClientRect().top,selection:[e.selectionStart,e.selectionEnd]}));
  const deadline=Date.now()+12000;while(f.attemptReads<4&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));assert.ok(f.attemptReads>=4);
  const final=await f.page.locator('#field-D1').evaluate(e=>({same:e===window.__entryNode,focused:document.activeElement===e,top:e.getBoundingClientRect().top,selection:[e.selectionStart,e.selectionEnd]}));assert.equal(final.same,true);assert.equal(final.focused,true);assert.deepEqual(final.selection,initial.selection);assert.ok(Math.abs(final.top-initial.top)<=1);
  await f.page.locator('#change-person').click();await f.page.locator('#student-form').waitFor({state:'visible'});const next=new URL(f.page.url());assert.equal(next.searchParams.get('documentId'),documentId);assert.equal(next.searchParams.get('assignmentCode'),f.content.code);assert.equal(await f.page.locator('#class').isDisabled(),true);
 });
}
test('Legacy Lesson 2 alias preserves bound context while reaching canonical Scandinavian page',async t=>{
 const f=await fixture(t,'scandinavian-studies',{remembered:'B'});await f.page.goto(f.url(true).replace('scandinavian-studies.html','lesson-2.html').replace(f.content.code,'67-listening-02'));await loaded(f.page);assert.equal(new URL(f.page.url()).searchParams.get('assignmentCode'),f.content.code);assert.equal(new URL(f.page.url()).searchParams.get('documentId'),documentId);
});
test('History API denied: legacy alias still verifies owner and loads saved Homework',async t=>{
 const f=await fixture(t,'scandinavian-studies',{remembered:'B',historyBlocked:true});
 await f.page.goto(f.url(true).replace(f.content.code,'67-listening-02'));
 await loaded(f.page);assert.equal(await f.page.locator('#field-D1').inputValue(),'Draft B');assert.match(await f.page.locator('#person').innerText(),/Fixture B/);assert.equal(f.requests.filter(r=>r.api==='/teacher/login').length,0);
});
for(const [slug]of rows)test('History API denied: '+slug+' teacher switch still verifies role and stays readonly',async t=>{
 const f=await fixture(t,slug,{teacher:true,historyBlocked:true});await f.page.goto(f.url(true));await f.page.locator('#student-form').waitFor({state:'visible'});
 await f.page.locator('#teacher-entry').click();await loaded(f.page);assert.match(await f.page.locator('#person').innerText(),/Fixture B/);assert.equal(await f.page.locator('#submit').isVisible(),false);assert.equal(f.requests.filter(r=>r.api==='/student/login').length,0);
});
