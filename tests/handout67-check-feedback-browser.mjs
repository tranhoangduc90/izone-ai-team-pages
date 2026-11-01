// HTML/controller thật, dữ liệu và API cách ly. Không gửi bài hoặc gọi AI thật.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createState} from '../writing-handouts/lesson5-demo/core.mjs';
import {workflowFor} from '../writing-handouts/shared/workflow.mjs';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const lessons=[5,7,9,11].map(number=>({activity:'lesson'+number,number,title:'Bài thử cách ly',topic:'Synthetic topic.',classes:['fixture-class'],body:2,aInstruction:'Điểm đầu',...(number===9?{workflowMode:'whole-chain-v1'}:number===11?{workflowMode:'whole-chain-v1',handoutMode:'two-bodies-v1',preparationMode:'ideas-first-v1',description:'Hai thân bài',helpTitle:'Hướng dẫn',bodies:[{body:1,title:'Thân bài 1',focus:'Quan điểm thứ nhất'},{body:2,title:'Thân bài 2',focus:'Quan điểm thứ hai'}]}:{})}));
test('mọi nút Check Writing 67: liệt kê đủ ô thiếu, focus đúng, giữ nháp và gửi được sau bổ sung',async()=>{
 const server=await serveDirectory(process.env.CHECK_SOURCE_ROOT||resolve(import.meta.dirname,'..'));
 const browser=await chromium.launch({channel:'chrome',headless:true});let count=0;
 try{for(const lesson of lessons){const policy=workflowFor(lesson);for(const key of policy.order){
  const context=await browser.newContext({viewport:{width:count%2?390:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(6000);
  const raw={...createState(0,lesson),ref:'fixture-session',activity:lesson.activity,classRef:'fixture-class',studentRef:'fixture-student',submittedSections:[],vocabulary:{},commentThreads:[],processing:{},idea2Open:true};
  if(raw.bodyProgress)for(const n of [1,2])raw.bodyProgress[n].idea2Open=true;
  for(const field of Object.keys(raw.responses))raw.responses[field]='Nội dung thử đã giữ.';
  raw.responses.chosenSolution='Đường tàu và tàu điện ngầm';
  for(const section of policy.order)raw.steps[section].status=section===key?'revision':'passed';
  for(const field of policy.fields[key])raw.responses[field]='';
  const calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url()),p=url.pathname;
   const headers={'access-control-allow-origin':server.origin,'access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
   const send=(body,status=200)=>route.fulfill({status,headers,json:body});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(p.startsWith('/api/handout67/v1')){calls.push({path:p,method:req.method()});
    if(p.includes('/lessons/'))return send({ok:true,lesson});
    if(p.endsWith('/roster'))return send({ok:true,classes:[{classRef:'fixture-class',className:'Lớp thử',students:[{studentRef:'fixture-student',displayName:'Học viên thử'}]}]});
    if(p.endsWith('/responses')){Object.assign(raw.responses,req.postDataJSON().responses);raw.version++;return send({ok:true,session:raw});}
    if(p.endsWith('/checks'))return send({ok:true,session:raw});
    if(p.endsWith('/sessions'))return send({ok:true,session:raw,token:'isolated-fixture-token'});
    if(p.endsWith('/fixture-session'))return send({ok:true,session:raw});
    throw Error('Unexpected fixture: '+p);
   }
   if(url.origin===server.origin)return route.continue();return route.abort();
  });
  try{
   await page.goto(server.origin+'/writing-handouts/'+lesson.activity+'/');
   await page.locator('#student-select').selectOption('fixture-student');await page.locator('#login-form button').click();await page.locator('#confirm-button').click();
   const button=page.locator(`[data-check="${key}"]`);await button.click();
   const dialog=page.locator('#writing-check-dialog');await dialog.waitFor();
   assert.equal(await dialog.locator('li').count(),policy.fields[key].length,lesson.activity+' '+key);
   assert.doesNotMatch(await dialog.innerText(),/undefined|body[12]_[axbt]|topicSentence/);
   assert.equal(calls.filter(c=>c.path.endsWith('/checks')).length,0);
   assert.equal(await firstStyle(page),true);if(process.env.CHECK_SCREEN_DIR&&count===0){await page.screenshot({path:resolve(process.env.CHECK_SCREEN_DIR,'writing67-missing.png')});await page.setViewportSize({width:390,height:900});await page.screenshot({path:resolve(process.env.CHECK_SCREEN_DIR,'writing67-missing-mobile.png')});}
   await dialog.getByRole('button',{name:'Đến ô cần bổ sung'}).click();
   const first=page.locator('#field-'+policy.fields[key][0]);assert.equal(await first.evaluate(e=>document.activeElement===e),true);
   for(const field of policy.fields[key]){const input=page.locator('#field-'+field);if(await input.evaluate(e=>e.tagName==='SELECT'))await input.selectOption({index:1});else await input.fill('Nội dung vừa bổ sung.');}
   assert.equal(await page.locator('[aria-invalid="true"]').count(),0);
   await button.click();await page.waitForFunction(()=>!document.querySelector('[data-check][aria-busy="true"]'));
   for(let i=0;i<100&&!calls.some(c=>c.path.endsWith('/checks'));i++)await page.waitForTimeout(30);
   assert.equal(calls.filter(c=>c.path.endsWith('/checks')).length,1,lesson.activity+' '+key+' after filling');
   assert.deepEqual(errors,[]);count++;
  }finally{await context.close();}
 }}assert.equal(count,24);
 }finally{await browser.close();await server.close();}
});

async function firstStyle(page){await page.locator('link[data-writing-check-style]').evaluate(el=>new Promise((resolve,reject)=>{if(el.sheet)return resolve();el.addEventListener('load',resolve,{once:true});el.addEventListener('error',reject,{once:true});}));return page.locator('#writing-check-dialog').evaluate(el=>getComputedStyle(el).borderTopColor==='rgb(180, 35, 24)');}
