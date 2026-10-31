import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const site='https://tranhoangduc90.github.io/izone-ai-team-pages',entry='/reading-skills67/butterflies-britain-tfng/',api='/reading67-materials/api/reading-skills67/lesson12';
const code='67-reading-homework-butterflies-britain-tfng',doc='synthetic-owner-document-1234567890',a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const person=ref=>({ownerId:ref,courseId:'1293',erpId:ref===a?'900001':'900002',name:ref===a?'Synthetic A':'Synthetic B',className:'IC2304'});
async function fixture(browser,options={}){
 const context=await browser.newContext(),calls=[],errors=[];
 await context.addInitScript(({remembered,saved,code})=>{
  if(remembered)localStorage.setItem('izone:student-identity:v1',JSON.stringify({version:1,identity:{authority:'erp-contact',id:remembered.erpId},revision:'synthetic-revision-123',updatedAt:new Date().toISOString()}));
  if(saved){sessionStorage.setItem('reading67:session:'+code,JSON.stringify({token:'synthetic-'+saved.ownerId,person:saved}));history.replaceState({izoneCourseStudentIdentityV1:{product:'reading-skills67',entry:code,studentRef:saved.ownerId,classRef:saved.courseId}},'');}
 },{remembered:options.remembered?person(options.remembered):null,saved:options.saved?person(options.saved):null,code});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,send=(json,status=200)=>route.fulfill({json,status});
  if(u.href.startsWith(site+'/')){
   if(p.endsWith('/access-harness.html'))return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><main id="app"></main><script>window.READING67_API_BASE='https://ducizone.ddns.net${api}';</script><script src="${site}/shared/teacher-single-sign-on.js"></script><script src="${site}/reading-skills67/access.js"></script><script>Reading67Access.open().then(r=>{window.entryResult={teacher:!!r.teacher,person:Reading67Access.person,readonly:r.work?.readonly};document.querySelector('#app').innerHTML='<p id="ready">Ready</p>';},e=>{document.querySelector('#app').textContent=e.message;});</script>`});
   const file=resolve(root,p.slice('/izone-ai-team-pages/'.length));if(!file.startsWith(resolve(root)))return route.abort();try{return route.fulfill({body:await fs.readFile(file),contentType:({'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8'})[extname(file)]||'application/octet-stream'});}catch{return send({},404);}
  }
  if(u.origin!=='https://ducizone.ddns.net')throw Error('Unexpected outside request '+u.origin);
  calls.push({path:p,method:req.method(),headers:req.headers(),body:req.postDataJSON()});
  if(p.includes('/teacher-session-api/v1/restore/'))return options.teacherSignedOut?send({error:'SSO_REQUIRED'},401):send({ok:true});
  if(p.endsWith('/shared-session'))return send({error:'SSO_REQUIRED'},401);
  if(p===api+'/config')return send({code,title:'Owner entry fixture',type:'tfng',demoGoogle:!!options.teacherSignedOut,autoRole:true,studentsOpen:true,ownerEntry:{classId:'1293',classCode:'IC2304'}});
  if(p===api+'/entry')return u.searchParams.get('documentId')===doc&&!options.revoked?send({entry:{documentId:doc,classId:'1293',studentRef:a,name:'Synthetic A',classCode:'IC2304',code}}):send({error:'HOMEWORK_ENTRY_NOT_FOUND'},403);
  if(p.startsWith(api+'/teacher/'))return options.teacherSignedOut?send({error:'TEACHER_LOGIN_REQUIRED'},401):options.teacherDenied?send({error:'ACCESS_DENIED'},403):send({readonly:true,classes:[]});
  if(p===api+'/classes')return send({classes:[{id:'1293',classCode:'IC2304'},{id:'9999',classCode:'OTHER'}]});
  if(p===api+'/classes/1293/students')return send({students:[a,b].map(ref=>({studentRef:ref,name:person(ref).name}))});
  if(p===api+'/identity/resolve'){const input=req.postDataJSON(),ref=(input.identity?.id==='900002'||input.studentRef===b)?b:a;return send({ok:true,status:'unique',identity:{authority:'erp-contact',id:person(ref).erpId},aliases:[{classId:'1293',classCode:'IC2304',studentRef:ref,studentName:person(ref).name}]});}
  if(p===api+'/student/login'){const ref=req.postDataJSON().studentRef;assert.equal(req.headers()['x-reading-homework-document'],doc);assert.equal(ref,a);return send({token:'synthetic-'+ref,identity:person(ref)});}
  if(p===api+'/lesson'||p===api+'/draft'){assert.equal(req.headers()['x-reading-homework-document'],doc);assert.equal(req.headers().authorization,'Bearer synthetic-'+a);return send(p.endsWith('/lesson')?{identity:person(a)}:{revision:7,body:{answers:{x:'UNMODIFIED DRAFT A'}}});}
  throw Error('Unexpected API '+req.method()+' '+p);
 });
 const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 const open=query=>page.goto(site+entry+'access-harness.html?server=1&mode=student&class=IC2304&documentId='+doc+(query||''));
 return {context,page,calls,errors,open};
}
test('Lesson 12 owner-bound student and teacher entry',async t=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const saved of [undefined,a])await t.test('Correct remembered learner opens directly; saved='+!!saved,async()=>{
   const f=await fixture(browser,{remembered:a,saved});try{await f.open();await f.page.locator('#ready').waitFor();const r=await f.page.evaluate(()=>entryResult);assert.equal(r.teacher,false);assert.equal(r.person.ownerId,a);assert.equal(f.calls.some(c=>c.path.includes('/teacher/')||c.path.includes('/teacher-session-api/')),false);const draft=await f.page.evaluate(()=>Reading67Access.request('/draft'));assert.equal(draft.revision,7);assert.equal(draft.body.answers.x,'UNMODIFIED DRAFT A');assert.deepEqual(f.errors,[]);}finally{await f.context.close();}
  });
  await t.test('Wrong remembered person and stale session require explicit confirmation, before any draft read',async()=>{
   const f=await fixture(browser,{remembered:b,saved:b});try{await f.open();await f.page.locator('#entry-owner').waitFor();assert.match(await f.page.locator('#entry-owner').innerText(),/Synthetic A/);assert.equal(f.calls.some(c=>/\/(lesson|draft|student\/login)$/.test(c.path)),false);assert.equal(await f.page.evaluate(()=>JSON.parse(localStorage.getItem('izone:student-identity:v1')).identity.id),'900002');await f.page.locator('#entry-student option[value="'+a+'"]').waitFor({state:'attached'});assert.equal(await f.page.locator('#entry-student option[value="'+b+'"]').count(),0);await f.page.selectOption('#entry-student',a);await f.page.locator('#entry-open').click();await f.page.locator('#ready').waitFor();assert.equal(await f.page.evaluate(()=>entryResult.person.ownerId),a);assert.equal(await f.page.evaluate(()=>JSON.parse(localStorage.getItem('izone:student-identity:v1')).identity.id),'900001');assert.deepEqual(f.errors,[]);}finally{await f.context.close();}
  });
  await t.test('Teacher switch before student login retains the document owner, not remembered B',async()=>{
   const f=await fixture(browser,{remembered:b});try{await f.open();await f.page.locator('#entry-owner').waitFor();const link=new URL(await f.page.evaluate(()=>Reading67Access.teacherEntryUrl));assert.equal(link.searchParams.get('studentRef'),a);assert.equal(link.searchParams.get('classId'),'1293');assert.equal(link.searchParams.get('mode'),'teacher');assert.equal(f.calls.some(c=>c.path===api+'/student/login'),false);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}
  });
  await t.test('Signed-out teacher intent cannot borrow a remembered student session',async()=>{
   const f=await fixture(browser,{remembered:a,saved:a,teacherSignedOut:true});try{await f.open('&teacher=1&classId=1293&studentRef='+a);await f.page.locator('#demo-teacher').waitFor();assert.equal(await f.page.locator('#entry-class').count(),0);assert.equal(f.calls.some(c=>/\/(lesson|draft|student\/login)$/.test(c.path)),false);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}
  });
  for(const teacherDenied of [false,true])await t.test('Explicit teacher intent stays independent; denied='+teacherDenied,async()=>{
   const f=await fixture(browser,{remembered:b,teacherDenied});try{await f.open('&teacher=1&classId=1293&studentRef='+a);if(teacherDenied){await f.page.getByText('Tài khoản chưa có quyền lớp.',{exact:true}).waitFor();assert.equal(await f.page.locator('#entry-class').count(),0);}else{await f.page.locator('#ready').waitFor();assert.deepEqual(await f.page.evaluate(()=>entryResult),{teacher:true,person:null,readonly:true});}assert.equal(f.calls.some(c=>c.path===api+'/entry'||c.path===api+'/student/login'||c.path===api+'/draft'),false);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}
  });
  await t.test('Unknown/revoked owner link fails closed, preserving memory',async()=>{const f=await fixture(browser,{remembered:b,revoked:true});try{await f.open();await f.page.getByText(/Chưa xác nhận được chủ/).waitFor();assert.equal(f.calls.some(c=>/\/(draft|lesson|student\/login)$/.test(c.path)),false);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 }finally{await browser.close();}
});
