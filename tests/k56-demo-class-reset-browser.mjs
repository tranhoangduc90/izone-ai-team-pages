// Kiểm DOM/storage/truyền link bằng Chrome thật; HTTP reset được giả lập, không ghi DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const modules=process.env.CODEX_NODE_MODULES || resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')).href)('playwright');
const slugs=['term-test-1-k56','term-test-2-k56','mini-test-k56'];
test('Chrome desktop/mobile: Reset từ mỗi bài xóa cả lớp, giữ lớp thật/K67 và làm mới tab khác',async()=>{
  const js=await readFile(new URL('../term-tests/k56-demo-reset/app.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../term-tests/k56-demo-reset/styles.css',import.meta.url),'utf8');
  const calls=[];
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/reset.js')return res.writeHead(200,{'Content-Type':'text/javascript'}).end(js);
    if(url.pathname==='/styles.css')return res.writeHead(200,{'Content-Type':'text/css'}).end(css);
    if(url.pathname==='/api/term-tests/demo/reset-class'){
      let raw='';for await(const chunk of req)raw+=chunk;calls.push(JSON.parse(raw));
      return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,reset:{classCode:'CODEXDEMO56',remaining:0,generation:'gen-'+calls.length,attempts:6,sessions:6}}));
    }
    const slug=slugs.includes(url.pathname.slice(1))?url.pathname.slice(1):slugs[0];
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><div id="app"><header class="topbar">${slug}</header></div><script>window.TERM_TEST_CONFIG={slug:${JSON.stringify(slug)}};window.TERM_TEST_APP_CONFIG={API_BASE_URL:location.origin};</script><script src="/reset.js"></script>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    for(const viewport of [{width:1280,height:800},{width:390,height:844}])for(const slug of slugs){
      const context=await browser.newContext({viewport});const page=await context.newPage();const other=await context.newPage();
      await page.goto(`${origin}/${slug}?class=CODEXDEMO56&mode=read_first`);
      await other.goto(`${origin}/${slugs.find(s=>s!==slug)}?class=CODEXDEMO56&mode=lis_first`);
      await page.evaluate(slugs=>{
        for(const s of slugs)for(const st of [localStorage,sessionStorage])for(const p of ['izone-test','izone-test-ui','izone-test-annotations'])st.setItem(`${p}:${s}:CODEXDEMO56:v3`,'old');
        localStorage.setItem('izone-test:term-test-1-k56:IC2264','real');localStorage.setItem('izone-test:term-test-1:CODEXDEMO806','k67');
      },slugs);
      await other.evaluate(()=>sessionStorage.setItem('izone-test:mini-test-k56:CODEXDEMO56','old-other'));
      const button=page.getByRole('button',{name:'Reset dữ liệu',exact:true});assert.ok(await button.isEnabled());
      const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height);
      page.once('dialog',d=>d.accept());const before=calls.length;await button.click();
      await page.waitForURL(/reset=1/);await other.waitForURL(/reset=1/);
      assert.equal(calls.length,before+1);assert.deepEqual(calls.at(-1),{classCode:'CODEXDEMO56',confirmation:'RESET_DEMO_CLASS'});
      assert.equal(new URL(page.url()).searchParams.get('mode'),'read_first');
      const stored=await page.evaluate(()=>({demo:Object.keys(localStorage).filter(k=>k.includes(':CODEXDEMO56')&&!k.startsWith('izone-demo-reset:class:')),real:localStorage.getItem('izone-test:term-test-1-k56:IC2264'),k67:localStorage.getItem('izone-test:term-test-1:CODEXDEMO806')}));
      assert.equal(stored.demo.length,0);assert.equal(stored.real,'real');assert.equal(stored.k67,'k67');
      assert.equal(await other.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.includes(':CODEXDEMO56')).length),0);
      await context.close();
    }
    const real=await browser.newPage();await real.goto(`${origin}/?class=IC2264`);assert.equal(await real.getByRole('button',{name:'Reset dữ liệu'}).count(),0);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
