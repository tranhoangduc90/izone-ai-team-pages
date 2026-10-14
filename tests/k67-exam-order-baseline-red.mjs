import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
// Chạy giao diện baseline Git với API giả local để chứng minh assertion mới thật sự phát hiện hành vi cũ.
// Lệnh này chủ đích trả exit 1 ở baseline (RED); không gọi production hay sửa source.
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const ctx=await browser.newContext();const base='http://127.0.0.1:8877';
const original=['term-tests/term-test-1-computer-based/index.html','term-tests/term-test-2-computer-based/bootstrap.js','term-tests/shared/app.js'];
await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
  let name=u.pathname.slice(1);if(name.endsWith('/'))name+='index.html';
  if(original.includes(name))return route.fulfill({contentType:name.endsWith('.html')?'text/html':'application/javascript',body:execFileSync('git',['show','HEAD:'+name],{cwd:root,encoding:'utf8'})});
  return route.continue();
});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await ctx.request.post(base+'/preview/reset',{data:{}});
  await page.goto(base+'/term-tests/term-test-1-computer-based/?class=IC2304&mode=read_first');
  await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('bootstrapPreview')?.disabled);
  assert.deepEqual(errors,[],'Baseline phải chạy đúng, không dùng lỗi setup làm RED');
  const actual=await page.locator('#startReading').count()?'reading':'listening';
  await writeFile('E:/Codex-Data/k67-reading-first-plan-20261014/preview-evidence/baseline-red.json',JSON.stringify({status:'RED',expected:'reading',actual,pageErrors:errors,baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()},null,2),'utf8');
  assert.equal(actual,'reading','Baseline chưa hỗ trợ Reading trước');
}finally{await browser.close();}
