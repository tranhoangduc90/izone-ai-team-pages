// Real Homework entries and access code; all HTTP/Google APIs are isolated fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,
 '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const site='https://tranhoangduc90.github.io/izone-ai-team-pages';
const api='/reading67-materials/api/reading-skills67/lesson12';
const code='67-reading-homework-butterflies-britain-tfng';
const entry='/reading-skills67/butterflies-britain-tfng/';
const person={ownerId:'11111111-1111-4111-8111-111111111111',courseId:'1293',erpId:'900001',name:'Synthetic learner',className:'LOPTHU'};
const saved={token:'synthetic-session',person};
const cases=[
 ['native denial',{nativeStatus:403}],
 ['shared denial',{sharedStatus:403}]
];
async function fixture(browser,options={}){
 const context=await browser.newContext({serviceWorkers:'block'}),calls=[],errors=[],escaped=[];
 await context.addInitScript(({saved,code,restore})=>{
  if(restore){
   sessionStorage.setItem('reading67:session:'+code,JSON.stringify(saved));
   history.replaceState({izoneCourseStudentIdentityV1:{product:'reading-skills67',entry:code,studentRef:saved.person.ownerId,classRef:saved.person.courseId}},'');
  }
 },{saved,code,restore:options.restore});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  const send=(json,status=200)=>route.fulfill({json,status});
  if(url.href.startsWith(site+'/')){
   let file=resolve(root,p.slice('/izone-ai-team-pages/'.length));
   if(p.endsWith('/'))file=resolve(file,'index.html');
   if(!file.startsWith(resolve(root)+ (process.platform==='win32'?'\\':'/')))return route.abort();
   try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream'});}
   catch{return send({},404);}
  }
  if(url.origin!=='https://ducizone.ddns.net'){escaped.push(url.origin);return route.abort();}
  if(req.method()==='OPTIONS')return route.fulfill({status:204});
  calls.push({path:p,method:req.method()});
  if(p.startsWith('/teacher-session-api/v1/restore/'))return send({ok:options.sharedStatus===200,error:'SSO_REQUIRED'},options.sharedStatus||401);
  if(p.endsWith('/shared-session'))return send({error:'SSO_REQUIRED'},401);
  if(p===api+'/config')return send({code,title:'Synthetic reading fixture',type:'tfng',autoRole:true,studentsOpen:!options.closed});
  if(p.startsWith(api+'/teacher/')){
   const status=options.nativeStatus||401;
   if(status!==200)return send({error:status===401?'TEACHER_LOGIN_REQUIRED':'ACCESS_DENIED'},status);
   return send(p.endsWith('/classes')?{classes:[{id:'1293',classCode:'LOPTHU'}]}:{readonly:true,identity:person});
  }
  if(p===api+'/classes')return send({classes:[{id:'1293',classCode:'LOPTHU'}]});
  if(p===api+'/classes/1293/students')return send({students:[{studentRef:person.ownerId,name:person.name}]});
  if(p===api+'/identity/resolve')return send({status:'unique',identity:{authority:'erp-contact',id:person.erpId},aliases:[{classId:person.courseId,classCode:person.className,studentRef:person.ownerId,studentName:person.name}]});
  if(p===api+'/student/login')return send({error:'STUDENT_ACCESS_DENIED'},403);
  if(p===api+'/lesson')return send({identity:person});
  escaped.push(req.method()+' '+p);return send({error:'UNEXPECTED_FIXTURE_ROUTE'},503);
 });
 const page=await context.newPage();page.setDefaultTimeout(5000);
 page.on('pageerror',e=>errors.push(e.message));
 return {context,page,calls,errors,escaped};
}
function noBusinessWrites(f){
 assert.equal(f.calls.some(c=>/\/(draft|submit|reset|practice|student\/logout)$/.test(c.path)&&c.method!=='GET'),false);
 assert.deepEqual(f.errors,[]);assert.deepEqual(f.escaped,[]);
}
test('Homework role detection preserves independent student and teacher access',async t=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const [name,options]of cases)for(const assignment of [false,true]){
   await t.test(`${name}: student link ${assignment?'with':'without'} assignmentCode`,async()=>{
    const f=await fixture(browser,options);
    try{
     await f.page.goto(site+entry+'?server=1'+(assignment?'&assignmentCode='+code:''));
     await f.page.locator('#entry-class').waitFor();
     assert.equal(await f.page.locator('#entry-open').isDisabled(),true);
     assert.equal(await f.page.evaluate(()=>Reading67Access.teacher),false);
     assert.equal(f.calls.some(c=>c.path===api+'/lesson'||c.path.endsWith('/student/login')),false);
     await f.page.selectOption('#entry-class','1293');
     await f.page.selectOption('#entry-student',person.ownerId);
     await f.page.locator('#entry-open').click();
     await f.page.locator('#entry-error').filter({hasText:'Học viên không còn quyền'}).waitFor();
     assert.equal(f.calls.some(c=>c.path===api+'/lesson'),false,'Student membership denial must still block lesson data');
     noBusinessWrites(f);
    }finally{await f.context.close();}
   });
  }
  for(const [name,options]of cases)for(const query of ['teacher=1','mode=teacher','classId=1293&studentRef='+person.ownerId,'classId=1293']){
   await t.test(`${name}: explicit teacher scope stays denied: ${query}`,async()=>{
    const f=await fixture(browser,options);
    try{
     await f.page.goto(site+entry+'?server=1&'+query);
     await f.page.getByText(/chưa có quyền/).first().waitFor();
     assert.equal(await f.page.locator('#entry-class').count(),0);
     assert.equal(f.calls.some(c=>c.path===api+'/classes'||c.path.endsWith('/student/login')),false);
     noBusinessWrites(f);
    }finally{await f.context.close();}
   });
  }
  for(const options of [{nativeStatus:503},{sharedStatus:503}]){
   await t.test('Service failure must stay blocked: '+JSON.stringify(options),async()=>{
    const f=await fixture(browser,options);
    try{
     await f.page.goto(site+entry+'?server=1');await f.page.getByText('Chưa mở được bài',{exact:true}).waitFor();
     assert.equal(await f.page.locator('#entry-class').count(),0);
     assert.equal(f.calls.some(c=>c.path===api+'/classes'),false);noBusinessWrites(f);
    }finally{await f.context.close();}
   });
  }
  await t.test('Closed lesson remains closed after rejected teacher probe',async()=>{
   const f=await fixture(browser,{nativeStatus:403,closed:true});
   try{
    await f.page.goto(site+entry+'?server=1');await f.page.getByText(/chưa mở cho học viên/).waitFor();
    assert.equal(f.calls.some(c=>c.path===api+'/classes'),false);noBusinessWrites(f);
   }finally{await f.context.close();}
  });
  await t.test('Allowed teacher still enters the read-only teacher dashboard',async()=>{
   const f=await fixture(browser,{nativeStatus:200,sharedStatus:200});
   try{
    await f.page.goto(site+entry+'?server=1&assignmentCode='+code);await f.page.locator('#teacher-class').waitFor();
    assert.ok(f.page.url().endsWith('/teacher.html'));
    assert.equal(f.calls.some(c=>c.path===api+'/classes'),false);noBusinessWrites(f);
   }finally{await f.context.close();}
  });
  await t.test('Existing student session survives rejection of teacher probe',async()=>{
   const f=await fixture(browser,{nativeStatus:403,restore:true});
   try{
    // Exercise access.open directly so a renderer cannot trigger autosave in this session test.
    await f.page.route(site+'/access-harness.html',route=>route.fulfill({contentType:'text/html',body:`<main id="app"></main><script>window.READING67_API_BASE='https://ducizone.ddns.net${api}'</script><script src="${site}/shared/teacher-single-sign-on.js"></script><script src="${site}/reading-skills67/access.js"></script>`}));
    await f.page.goto(site+'/access-harness.html');
    const result=await f.page.evaluate(async()=>{
     const before=sessionStorage.getItem('reading67:session:'+ '67-reading-homework-butterflies-britain-tfng');
     const opened=await Reading67Access.open();
     return {before,after:sessionStorage.getItem('reading67:session:'+opened.config.code),person:Reading67Access.person,teacher:Reading67Access.teacher};
    });
    assert.equal(result.after,result.before);assert.deepEqual(result.person,person);assert.equal(result.teacher,false);
    assert.equal(f.calls.filter(c=>c.path===api+'/lesson').length,1);
    assert.equal(f.calls.some(c=>c.path.endsWith('/student/login')||c.path===api+'/classes'),false);noBusinessWrites(f);
   }finally{await f.context.close();}
  });
 }finally{await browser.close();}
});
