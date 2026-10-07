// Chạy trình duyệt thật với API giả; cấm mọi request ngoài fixture/local.
import {createServer} from 'node:http';import fs from 'node:fs';import {createRequire} from 'node:module';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=createRequire('C:/Users/vukha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),pathname=u.pathname.replace(/^\/izone-ai-team-pages/,'');const p=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css'};res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),out=process.env.SUBSTITUTE_BROWSER_OUTPUT||path.join(root,'output/playwright/substitute-fresh');fs.mkdirSync(out,{recursive:true});const results=[];
try{
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport:size});
  await context.route('**/*',async route=>{const u=route.request().url();if(u.startsWith(base))return route.continue();
   if(u.includes('/webhook/')){let body={};try{body=route.request().postDataJSON();}catch{}const slug=body?.testSlug||u.match(/substitute-test-[12]-k(?:56|67)/)?.[0];let response={};
    if(body.route==='/api/test/history')response={testSlug:slug,historyEpoch:'11111111-1111-4111-8111-111111111111',stateVersion:2,maintenance:false};
    else if(body.route==='/api/test/roster')response={students:[{ref:'fictional-01',name:'Học viên kiểm thử'}]};
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
   }return route.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/term-tests/substitute-test-1-k56-dashboard/');
  assert.deepEqual(await page.locator('.test-number').allTextContents(),['01','02','03','04']);
  await page.locator('#course-filter').selectOption('k67');assert.deepEqual(await page.locator('.test-row:visible .test-number').allTextContents(),['01','02']);
  await page.locator('#course-filter').selectOption('all');await page.screenshot({path:path.join(out,'dashboard-'+size.width+'.png'),fullPage:true});
  for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
   await page.goto(base+'/term-tests/'+slug+'-computer-based/?demo=writing&class=DEMO');
   await page.locator('#writingView').waitFor({state:'visible'});
   assert.equal(await page.locator('.writing-task-label').count(),0);
   assert.equal(await page.locator('#writingView button').filter({hasText:'Nộp bài'}).count(),1);
   assert.equal(await page.locator('.writing-toolbar button').filter({hasText:'Notes'}).count(),0);
   assert.equal(await page.locator('.writing-outline-card').filter({hasText:'15 phút'}).count(),0);
   await page.screenshot({path:path.join(out,slug+'-writing-'+size.width+'.png'),fullPage:true});
   await page.goto(base+'/term-tests/'+slug+'-computer-based/?demo=exam&grading=server&class=DEMO');
   await page.locator('#bootstrapStudent').waitFor({state:'visible'});
   assert.equal(await page.locator('#bootstrapStudent').inputValue(),'');
   assert.equal(await page.locator('textarea').count(),0);
   assert.equal(await page.locator('body').filter({hasText:/Backend test đã chấm Listening:|\/40 câu đúng/}).count(),0);
   await page.locator('.k56-reset-button').click();await page.locator('[data-reset-confirm]').click();
   await page.waitForURL(u=>!u.searchParams.has('reset'));
   await page.locator('#bootstrapClass').waitFor({state:'visible'});
   assert.equal(await page.locator('#bootstrapStudent').inputValue(),'');
   assert.equal(await page.locator('#bootstrapClass').isEnabled(),true);
   results.push({slug,width:size.width,writingSimplified:true,newRunEmpty:true,resetRoom:true});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({ok:true,results,screenshots:out,aiCalls:0,portalWrites:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
