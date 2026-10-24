// Exercise the actual student pages with synthetic identity/session responses.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createState,EXAMPLE} from '../writing-handouts/lesson5-demo/core.mjs';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await serveDirectory(process.env.SOURCE_ROOT||repository),origin=server.origin;
const out=process.env.HANDOUT67_EVIDENCE_DIR;assert(out,'Set HANDOUT67_EVIDENCE_DIR outside Git.');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[],traces=[];
const studentRef='11111111-1111-4111-8111-111111111111',classRef='33333333-3333-4333-8333-333333333333',sessionRef='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
try{for(const n of [5,7,9]){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(12000);
 const errors=[],unexpected=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 const lesson={activity:'lesson'+n,number:n,title:'Đề giả để kiểm thanh đầu trang Lesson '+n,shortTitle:'Handout thử '+n,topic:'Synthetic question for header verification.',defaultClass:classRef,classes:[classRef],body:n===9?1:2,aInstruction:'Hướng dẫn giả cho điểm A.',whyOptions:['Lý do 1','Lý do 2'],ideaHint:'Ý bạn tự viết.',...(n===9?{workflowMode:'whole-chain-v1'}:{})};
 const state={...createState(0,lesson),ref:sessionRef,sessionRef,activity:lesson.activity,activitySlug:lesson.activity,classRef,studentRef,responses:{...EXAMPLE},updatedAt:'2026-10-23T00:00:00Z',savedAt:'2026-10-23T00:00:00Z',submittedSections:[],vocabulary:{},commentThreads:[],processing:{}};
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type,authorization,if-match','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
  const send=(body,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(p==='/mapping-api/api/student-identity/resolve')return send({ok:true,status:'unique',identity:{authority:'erp-contact',id:'900001'},aliases:[{classId:'1293',classCode:'IC2304',studentRef,studentName:'HV giả'}]});
  if(p.startsWith('/api/handout67/v1')){
   const rp=p.slice('/api/handout67/v1'.length);
   if(rp==='/lessons/'+lesson.activity)return send({ok:true,lesson});
   if(rp==='/roster')return send({ok:true,classes:[{classRef,className:'IC2304',students:[{studentRef,displayName:'Học viên giả có tên dài để kiểm đầy đủ dấu tiếng Việt'}]}]});
   if(req.method()!=='GET')writes.push({path:rp,method:req.method(),body:req.postDataJSON()});
   if(rp==='/sessions')return send({ok:true,session:state,token:'fixture-only-token'},201);
   if(rp==='/sessions/'+sessionRef)return send({ok:true,session:state});
   unexpected.push(rp);return send({ok:false,error:'UNCONFIGURED_FIXTURE'},503);
  }
  if(url.origin===origin)return route.continue();unexpected.push(url.origin);return route.abort();
 });
 await page.goto(origin+`/writing-handouts/lesson${n}/`);
 await page.locator('#class-select option[value="'+classRef+'"]').waitFor({state:'attached'});
 async function capture(stage){for(const width of [1440,1024,760,600,390,320]){
  await page.setViewportSize({width,height:width>760?1000:844});await page.evaluate(async()=>{await document.fonts.ready;scrollTo(0,0);});
  const metrics=await page.evaluate(()=>{
   const bar=document.querySelector('.topbar'),bounds=bar.getBoundingClientRect(),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   const children=[...bar.children].filter(e=>e.getBoundingClientRect().width>0).map(e=>({text:e.textContent.trim(),rect:rect(e)}));
   const contained=children.every(e=>e.rect.x>=bounds.x-1&&e.rect.right<=bounds.right+1&&e.rect.y>=bounds.y-1&&e.rect.bottom<=bounds.bottom+1);
   const overlap=children.some((a,i)=>children.slice(i+1).some(b=>Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.x,b.rect.x)>1&&Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.y,b.rect.y)>1));
   const teacher=bar.querySelector('[data-teacher-entry]');const r=teacher.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return{bar:rect(bar),children,contained,overlap,teacherHit:hit===teacher||teacher.contains(hit),overflow:document.documentElement.scrollWidth>innerWidth,copy:{title:document.title,header:bar.textContent.trim(),teacherHref:teacher.getAttribute('href'),fields:[...document.querySelectorAll('[data-field]')].map(e=>({field:e.dataset.field,value:e.value})),buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent.trim(),disabled:e.disabled})),font:getComputedStyle(document.body).fontFamily,logo:[...document.querySelectorAll('.m170-logo')].map(e=>({loaded:e.complete&&e.naturalWidth>0,height:e.getBoundingClientRect().height}))}};
  });
  assert.match(metrics.copy.font,/Source Sans 3/);assert(metrics.copy.logo.every(x=>x.loaded));
  const passed=metrics.contained&&!metrics.overlap&&metrics.teacherHit&&!metrics.overflow;
  await page.screenshot({path:`${out}/lesson${n}-${stage}-${width}.png`,clip:{x:0,y:0,width,height:Math.max(240,Math.ceil(metrics.bar.bottom+85))},timeout:20000});
  records.push({n,stage,width,passed,...metrics});
 }}
 await capture('choose');await page.selectOption('#class-select',classRef);await page.locator('#student-select option[value="'+studentRef+'"]').waitFor({state:'attached'});await page.selectOption('#student-select',studentRef);await page.locator('#login-form [type=submit]').click();await page.locator('#confirm-button').waitFor();await capture('confirm');
 await page.locator('#confirm-button').click();await page.locator('#workspace:not([hidden])').waitFor();await capture('workspace');
 const teacher=page.locator('.topbar [data-teacher-entry]');await teacher.focus();assert(await teacher.evaluate(e=>document.activeElement===e));assert.match(await teacher.getAttribute('href'),/teacher\.html/);
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert(writes.every(x=>x.path==='/sessions'));
 traces.push({n,writes,errors,unexpected,teacherKeyboardFocus:true});await context.close();
 await fs.writeFile(out+'/results.json',JSON.stringify({outcome:'running',records,traces},null,2));
}
 const failures=records.filter(x=>!x.passed);await fs.writeFile(out+'/results.json',JSON.stringify({outcome:failures.length?'partial':'passed',records,traces,scope:'Header/identity containment at six widths, three entry stages and three real lessons. Synthetic session API; no actual business writes.'},null,2));console.log(JSON.stringify({cases:records.length,failures:failures.length}));if(failures.length)process.exitCode=1;
}finally{await browser.close();await server.close();}
