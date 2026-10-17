// Kiểm bộ điều khiển danh tính thật với DOM và API giả; không phải kiểm hình thức trang.
// Ghi thời gian chọn tên và thứ tự gọi, kiểm lỗi không tự mở bài hoặc nối sai người.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=process.env.SPEAKING_LOGIN_EVIDENCE_DIR;
assert.ok(out);await mkdir(out,{recursive:true});
const baseline=process.env.SPEAKING_LOGIN_BASELINE_FILE;
const ref='11111111-1111-4111-8111-111111111111';
const key='izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api';
const html=`<!doctype html><html lang="vi"><meta charset="utf-8"><body>
<select id="class-select"></select><select id="student-select"></select><button id="open-homework">Mở bài</button>
<input type="checkbox" id="remember-student" checked><button id="forget-remembered">Đổi người</button><button id="reload-roster">Thử lại</button><button id="change-student">Đổi học viên</button>
${['identity-message','remembered-identity','lesson-badge','class-code','page-footer','assignment-context','login-screen','lesson-hero','identity-confirmed','homework-content','memory-status','active-student','active-class'].map(id=>'<div id="'+id+'"></div>').join('')}
<script type="module">
import {createSpeakingIdentity} from '/speaking-homework/speaking-identity.js';
window.opens=[];window.controller=createSpeakingIdentity({apiBase:location.origin+'/api',identityBase:'https://ducizone.ddns.net/mapping-api',assignmentCode:'fixture-speaking',lessonNumber:8,classHint:'IC9900',allowWebReceipt:true,validateAssignment:()=>true,onOpened:context=>window.opens.push(context)});
window.controller.start();
</script></body></html>`;
const server=createServer(async(req,res)=>{
 try{
  const rel=new URL(req.url,'http://localhost').pathname;
  if(rel==='/fixture'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(html);}
  const file=path.resolve(root,'.'+rel);assert.ok(file.startsWith(root+path.sep));
  res.setHeader('content-type','text/javascript');res.end(await readFile(baseline&&rel==='/speaking-homework/speaking-identity.js'?baseline:file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{
 for(const scenario of ['unique','ambiguous','identity-error','classes-error','restart']){
  const context=await browser.newContext(),page=await context.newPage(),calls=[],errors=[];let resolves=0;
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({key,ref})=>localStorage.setItem(key,JSON.stringify({version:1,studentRef:ref})),{key,ref});
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!==origin)throw Error('Cấm mạng ngoài trong phép kiểm');
   if(!u.pathname.startsWith('/api/'))return route.continue();
   const c={path:u.pathname,started:performance.now()};calls.push(c);await new Promise(r=>setTimeout(r,150));c.ended=performance.now();
   let status=200,data={ok:true};
   if(u.pathname==='/api/classes'){
    if(scenario==='classes-error'){status=503;data={ok:false,message:'Nguồn lớp giả đang lỗi'};}
    else data.classes=['IC9900','IC9901'].map(classCode=>({classCode,ready:true}));
   }else if(u.pathname==='/api/identity/resolve'){
    resolves++;if(scenario==='identity-error'){status=503;data={ok:false,message:'Nguồn danh tính giả đang lỗi'};}
    else data={ok:true,status:scenario==='ambiguous'?'ambiguous':'unique',classCode:'IC9901'};
   }else if(u.pathname==='/api/assignment/roster'){
    const body=route.request().postDataJSON();data.assignment={assignmentCode:'fixture-speaking',classCode:body.classCode,students:[{student_ref:ref,name:'Học viên giả A'}]};
   }else if(u.pathname==='/api/session/start-selected')data.session={accessToken:'x'.repeat(43),studentRef:ref,classCode:'IC9901',workUnitId:'fake-work'};
   else throw Error('Địa chỉ API ngoài phạm vi');
   try{await route.fulfill({status,json:data});}catch(e){if(scenario!=='restart')throw e;}
  });
  const started=performance.now();await page.goto(origin+'/fixture');
  if(scenario==='restart'){await page.waitForTimeout(50);await page.evaluate(()=>window.controller.start());}
  if(scenario==='classes-error')await page.locator('#identity-message').filter({hasText:'Nguồn lớp giả đang lỗi'}).waitFor();
  else await page.waitForFunction(()=>!document.getElementById('student-select').disabled);
  const readyMs=performance.now()-started;
  assert.equal(calls.some(c=>c.path.endsWith('start-selected')),false);
  if(['unique','restart'].includes(scenario)){
   assert.equal(await page.locator('#student-select').inputValue(),ref);assert.equal(await page.locator('#class-select').inputValue(),'IC9901');
   if(!baseline&&scenario==='unique')assert.ok(calls.find(c=>c.path.endsWith('/identity/resolve')).started<calls.find(c=>c.path.endsWith('/classes')).ended,'Tìm danh tính phải chạy song song tải lớp');
   await page.locator('#open-homework').click();await page.waitForFunction(()=>window.opens.length===1);
   assert.equal(await page.evaluate(()=>window.opens[0].studentRef),ref);
  }else assert.equal(await page.locator('#student-select').inputValue(),'');
  await page.waitForTimeout(180);assert.deepEqual(errors,[]);
  results.push({scenario,passed:true,readyMs,calls,opens:await page.evaluate(()=>window.opens.length)});
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
await writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,baseline:Boolean(baseline),apiDelayMs:150,results,realAudioRequests:0},null,2),'utf8');
console.log(JSON.stringify({passed:true,baseline:Boolean(baseline),cases:results.length,uniqueReadyMs:results[0].readyMs}));
