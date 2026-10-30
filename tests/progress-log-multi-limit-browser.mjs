// Renderer app thật; chỉ dữ liệu giả và API cách ly, không gọi lớp/AI/Portal.
import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),id=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
test('Bài tập nhiều chọn chặn lựa chọn vượt key; bỏ/đổi được, Khảo sát chọn đủ mọi phương án',{timeout:40000},async()=>{
 const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://fixture').pathname);if(!path.startsWith(root+sep)&&!path.startsWith(root))throw Error('Denied');res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(path)]||'text/plain');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];let saved;
 const base={interactionType:'multi_choice_group',layoutType:'multiple_choice_cards',pedagogicalTypeCode:'multiple_choice',prompt:'Chọn các phương án',required:true,options:'ABCD'.split('').map(id=>({id,label:id})),skillCodes:[]},items=[{...base,itemVersionId:id(1),itemFamilyId:id(1),position:1,kind:'exercise',graderType:'exact_option_set',maxScore:1,interactionConfig:{maxSelections:2}},{...base,itemVersionId:id(2),itemFamilyId:id(2),position:2,kind:'survey',graderType:'none',maxScore:0,interactionConfig:{}}];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url()),json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,...data})});
  if(url.pathname.endsWith('/progress-log/config.js'))return route.fulfill({contentType:'text/javascript',body:`window.PROGRESS_LOG_CONFIG={API_BASE_URL:'${origin}'};`});
  if(!url.pathname.includes('/api/learning/'))return url.origin===origin?route.continue():route.abort();
  if(url.pathname.endsWith('/assignments/open'))return json({assignment:{assignmentId:id(3),publicToken:id(3),sessionNumber:1,class:{id:'fixture',name:'Lớp giả'},roster:[{studentRef:id(4),name:'Người thử giả'}],definitionHash:'a'.repeat(64),definition:{title:'Phiếu giới hạn chọn',kind:'mixed',blocks:[{blockId:id(5),checkpoint:1,title:'Phần giả',items}]},blockReleases:[{blockId:id(5),status:'open'}]}});
  if(url.pathname.endsWith('/attempts/start'))return json({attempt:{attemptToken:id(6),draft:{},draftRevision:0,identity:{studentRef:id(4),studentName:'Người thử giả',classId:'fixture',className:'Lớp giả',sessionNumber:1},checkpointSubmissions:[]}});
  if(url.pathname.endsWith('/attempts/draft')){saved=req.postDataJSON().responses;return json({draft:{revision:req.postDataJSON().revision}});}
  if(url.pathname.endsWith('/student/session-comments'))return json({comments:[]});
  return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"message":"Không có dữ liệu fixture"}'});
 });
 try{await page.goto(origin+'/progress-log/index.html#assignment='+id(3));await page.locator('#studentSelect').selectOption(id(4));await page.locator('#chooseStudentButton').click();await page.locator('#confirmButton').click();
  const exercise=page.locator(`input[name="${id(1)}"]`),survey=page.locator(`input[name="${id(2)}"]`);await exercise.nth(0).check();await exercise.nth(1).check();await exercise.nth(2).click();assert.equal(await exercise.nth(2).isChecked(),false,'Phương án thứ ba phải bị bỏ vì key có hai đáp án');assert.equal(await exercise.locator('xpath=..').filter({has:page.locator('input:checked')}).count(),2);
  await exercise.nth(0).uncheck();await exercise.nth(2).check();for(let i=0;i<4;i++)await survey.nth(i).check();assert.equal(await survey.evaluateAll(es=>es.filter(e=>e.checked).length),4);
  // Autosave có jitter 5–12 giây; giữ đúng ngân sách runtime, không hạ thời gian của sản phẩm để làm test xanh.
  for(let i=0;i<160&&!saved;i++)await new Promise(r=>setTimeout(r,100));assert.deepEqual(saved[id(1)],['B','C']);assert.deepEqual(saved[id(2)],['A','B','C','D']);assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
