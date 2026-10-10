// Chạy trình duyệt thật với API giả; cấm mọi request ngoài fixture/local.
import {createServer} from 'node:http';import fs from 'node:fs';import {createRequire} from 'node:module';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=createRequire('C:/Users/vukha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),pathname=u.pathname.replace(/^\/izone-ai-team-pages/,'');const p=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css'};res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.argv.includes('--online')?'https://tranhoangduc90.github.io/izone-ai-team-pages':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),out=process.env.SUBSTITUTE_BROWSER_OUTPUT||path.join(root,'output/playwright/substitute-fresh');fs.mkdirSync(out,{recursive:true});const results=[];
try{
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport:size});
  await context.route('**/*',async route=>{const u=route.request().url();if(u.startsWith(base))return route.continue();
   if(u.includes('/webhook/')){let body={};try{body=route.request().postDataJSON();}catch{}const slug=body?.testSlug||u.match(/substitute-test-[12]-k(?:56|67)/)?.[0];let response={};
    if(body.route==='/api/test/history')response={testSlug:slug,historyEpoch:'11111111-1111-4111-8111-111111111111',stateVersion:2,maintenance:false,classes:[{code:'DEMO',name:'DEMO · Kiểm thử'},{code:'IC9001',name:'IC9001'},{code:'IC9002',name:'IC9002'}]};
    else if(body.route==='/api/test/roster')response={students:[{ref:'fictional-01',name:'Học viên kiểm thử'}]};
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
   }return route.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/term-tests/substitute-test-1-k56-dashboard/');
  await page.evaluate(()=>document.fonts.ready);
  const checkBrand=async()=>{
   const logo=page.locator('.substitute-brandbar img');assert.equal(await logo.count(),1);
   assert.equal(await logo.evaluate(e=>e.complete&&e.naturalWidth>0),true);
   assert.ok((await logo.boundingBox()).height>=(size.width<760?36:44));
   assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(246, 247, 251)');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  };
  await checkBrand();
  assert.deepEqual(await page.locator('.test-number').allTextContents(),['01','02','03','04']);
  await page.locator('#course-filter').selectOption('k67');assert.deepEqual(await page.locator('.test-row:visible .test-number').allTextContents(),['01','02']);
  await page.locator('#course-filter').selectOption('all');await page.screenshot({path:path.join(out,'dashboard-'+size.width+'.png'),fullPage:true});
  for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
   await page.goto(base+'/term-tests/'+slug+'-computer-based/?demo=writing&class=DEMO');
   await page.locator('#writingView').waitFor({state:'visible'});
   await page.evaluate(()=>document.fonts.ready);
   await checkBrand();
   assert.match(await page.locator('.writing-exam-header').evaluate(e=>getComputedStyle(e).fontFamily),/Source Sans Pro/);
   assert.equal(await page.locator('.writing-exam-header').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
   assert.equal(await page.locator('.writing-exam-header h2').evaluate(e=>getComputedStyle(e).color),'rgb(23, 66, 101)');
   assert.equal(await page.locator('#submitWriting').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(219, 8, 41)');
   assert.equal(await page.locator('.writing-task-label').count(),0);
   assert.equal(await page.locator('#writingView button').filter({hasText:'Nộp bài'}).count(),1);
   assert.equal(await page.locator('.writing-toolbar button').filter({hasText:'Notes'}).count(),0);
   assert.equal(await page.locator('.writing-outline-card').filter({hasText:'15 phút'}).count(),0);
   await page.screenshot({path:path.join(out,slug+'-writing-'+size.width+'.png'),fullPage:true});
   await page.goto(base+'/term-tests/'+slug+'-computer-based/?demo=exam&grading=server&class=DEMO');
   await page.locator('#bootstrapStudent').waitFor({state:'visible'});
   assert.equal(await page.locator('#bootstrapStudent').inputValue(),'');
   assert.deepEqual(await page.locator('#bootstrapClass option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean)),['DEMO','IC9001','IC9002']);
   await page.locator('#bootstrapClass').selectOption('IC9002');
   await page.locator('#bootstrapStudent option[value="fictional-01"]').waitFor({state:'attached'});
   assert.equal(await page.locator('#bootstrapStudent').inputValue(),'');
   assert.equal(await page.locator('textarea').count(),0);
   assert.equal(await page.locator('body').filter({hasText:/Backend test đã chấm Listening:|\/40 câu đúng/}).count(),0);
   await page.locator('.k56-reset-button').click();await page.locator('[data-reset-confirm]').click();
   await page.waitForURL(u=>!u.searchParams.has('reset'));
   await page.locator('#bootstrapClass').waitFor({state:'visible'});
   assert.equal(await page.locator('#bootstrapStudent').inputValue(),'');
   assert.equal(await page.locator('#bootstrapClass').isEnabled(),true);
   await page.screenshot({path:path.join(out,slug+'-lobby-'+size.width+'.png'),fullPage:true});
   await page.goto(base+'/term-tests/'+slug+'-computer-based/?demo=complete&class=DEMO');
   await page.locator('#resultView').waitFor({state:'visible'});await checkBrand();
   assert.equal(await page.locator('#resultView').evaluate(e=>getComputedStyle(e).fontFamily.includes('Source Sans Pro')),true);
   await page.screenshot({path:path.join(out,slug+'-result-'+size.width+'.png'),fullPage:true});
   // Fixture complete cũ chỉ có báo cáo Task 2: không mở báo cáo Task 1 không tồn tại.
   if(slug==='substitute-test-2-k67'){
    assert.equal(await page.locator('button.writing-score-card:disabled').count(),1);
    assert.match(await page.locator('button.writing-score-card:disabled').innerText(),/Chưa có dữ liệu bài chấm chi tiết/);
   }
    await page.locator('button.writing-score-card:enabled').first().click();
    await page.locator('.writing-feedback-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('.writing-feedback-header h2').evaluate(e=>getComputedStyle(e).color),'rgb(23, 66, 101)');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(out,slug+'-feedback-'+size.width+'.png'),fullPage:true});
    await page.locator('.writing-feedback-close').click();assert.equal(await page.locator('#resultView').isVisible(),true);
   results.push({slug,width:size.width,writingSimplified:true,newRunEmpty:true,resetRoom:true});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({ok:true,results,screenshots:out,aiCalls:0,portalWrites:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
