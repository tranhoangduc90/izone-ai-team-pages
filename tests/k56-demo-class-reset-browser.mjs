// Chrome kiểm nút reset riêng từng học viên, giữ người khác; API được giả lập.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')).href)('playwright');
const a='fe44d852-9523-40b3-9bec-dd2cfdbda001',b='fe44d852-9523-40b3-9bec-dd2cfdbda002';
test('Chrome desktop/mobile: chỉ reset người được chọn, dữ liệu người khác và lớp thật được giữ',async()=>{
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://local').pathname;
    if(path.endsWith('.js')||path.endsWith('.css')){
      try{return res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':'text/css'}).end(await readFile(new URL('..'+path,import.meta.url)));}catch{return res.writeHead(404).end();}
    }
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}).end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/term-tests/k56-demo-reset/styles.css"><div id="app"><header class="topbar">Demo</header><select id="bootstrapStudent"><option value="">Chọn tên</option><option value="${a}">Học viên demo 01</option><option value="${b}">Học viên demo 02</option></select></div><script>window.TERM_TEST_CONFIG={slug:'term-test-1-k56',title:'Term Test 1'};</script><script src="/term-tests/k56-demo-reset/app.js"></script>`);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try{browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
    const context=await browser.newContext({viewport}),calls=[];
    await context.route('https://ducizone.ddns.net/mapping-api-demo/**',async route=>{
      if(route.request().method()==='GET')return route.fulfill({json:{ok:true,class:{name:'CODEXDEMO56'},students:[{ref:a,name:'Học viên demo 01'},{ref:b,name:'Học viên demo 02'}]}});
      calls.push(route.request().postDataJSON());return route.fulfill({json:{ok:true,reset:{attempts:1,sessions:1}}});
    });
    const page=await context.newPage();await page.goto(origin+'/?class=CODEXDEMO56');
    const button=page.getByRole('button',{name:'Reset học viên đang chọn'});await button.waitFor();assert.equal(await button.isEnabled(),false);
    await page.locator('#bootstrapStudent').selectOption(a);
    await page.evaluate(({a,b})=>{localStorage.setItem('izone-test:term-test-1-k56:CODEXDEMO56',JSON.stringify({studentRef:a}));localStorage.setItem('izone-test:term-test-1-k56:CODEXDEMO56:other',JSON.stringify({studentRef:b}));localStorage.setItem('izone-test:term-test-1-k56:IC2264','real');},{a,b});
    const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width);
    page.once('dialog',d=>d.accept());await button.click();await page.waitForURL(/reset=1/);
    assert.equal(calls.length,1);assert.equal(calls[0].studentRef,a);assert.equal(calls[0].testSlug,'term-test-1-k56');
    const values=await page.evaluate(()=>({a:localStorage.getItem('izone-test:term-test-1-k56:CODEXDEMO56'),b:localStorage.getItem('izone-test:term-test-1-k56:CODEXDEMO56:other'),real:localStorage.getItem('izone-test:term-test-1-k56:IC2264')}));
    assert.equal(values.a,null);assert.equal(JSON.parse(values.b).studentRef,b);assert.equal(values.real,'real');await context.close();
  }}finally{await browser?.close();await new Promise(r=>server.close(r));}
});
