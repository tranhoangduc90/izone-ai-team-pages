// Substitute only. Public question content; isolated renderer and no real APIs.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.SUBSTITUTE_PAGES_ROOT||fileURLToPath(new URL('../',import.meta.url));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const read=rel=>process.env.SUBSTITUTE_BROWSER_BASE_REF
 ?execFileSync('git',['show',process.env.SUBSTITUTE_BROWSER_BASE_REF+':'+rel],{cwd:root,maxBuffer:16*1024*1024})
 :fs.readFileSync(path.join(root,rel));
let server,browser,base;
before(async()=>{
 server=createServer((req,res)=>{
  const u=new URL(req.url,'http://fixture'),rel=decodeURIComponent(u.pathname).slice(1)+(u.pathname.endsWith('/')?'index.html':'');
  if(!path.resolve(root,rel).startsWith(path.resolve(root)+path.sep))return res.writeHead(403).end();
  try{let bytes=read(rel);if(rel.endsWith('index.html'))bytes=Buffer.from(bytes.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
   res.writeHead(200,{'content-type':({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'})[path.extname(rel)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:process.env.SUBSTITUTE_BROWSER_CHANNEL||'msedge',headless:true});
});
after(async()=>{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));});

test('Listening 1 K67: dropdown nằm trong thẻ, Suggestions tách ký hiệu và giữ hai cột',async t=>{
 const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});t.after(()=>context.close());
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const sandbox={window:{}};
 vm.runInNewContext(read('term-tests/substitute-test-1-k67-computer-based/content.js').toString(),sandbox);
 vm.runInNewContext(read('term-tests/substitute-test-1-k67/test-config.js').toString(),sandbox);
 const content={sourceSlug:'substitute-test-1-k67',listening:sandbox.window.K67_SUBSTITUTE_TEST_1_CONTENT.listening,controls:sandbox.window.TERM_TEST_CONFIG.listening.controls};
 const page=await context.newPage();await page.goto(base+'/term-tests/k67-term1-listening-makeup-substitute1/');
 await page.evaluate(async content=>{
  document.getElementById('lobby').hidden=true;document.getElementById('exam').hidden=false;document.getElementById('listeningView').hidden=false;
  document.getElementById('page-shell').classList.remove('cbt-bootstrap-shell');
  const ui=await import('../ic2311-listening-retake-substitute1-k56/native-ui.mjs');
  ui.mountNativeListening({content,grid:document.getElementById('listeningQuestions'),form:document.getElementById('listeningView'),heading:document.getElementById('exam-heading'),uiState:{flags:{listening:{}},activeSection:{listening:0},fontSize:{listening:100}},onUiState(){}});
  await ui.nativeLayout(content.controls,content.sourceSlug);
  await import('../../shared/master170/assessment-v1.1.mjs?v=20261029-approved-r3');
  await import('../../shared/master170/substitute-v1.1.mjs?v=20261028-master11');
  await document.fonts.ready;
 },content);
 await page.locator('.cbt-part-button').nth(1).click();
 const overflow=await page.locator('select[data-number="11"]').evaluate(e=>e.getBoundingClientRect().right-e.closest('.cbt-question-card').getBoundingClientRect().right);
 assert.ok(overflow<=2,'Dropdown Q11 vượt thẻ '+overflow+' px');
 await page.locator('.cbt-part-button').nth(2).click();
 const bank=await page.locator('.k67-option-bank,.cbt-option-bank').filter({hasText:'Suggestions'}).evaluate(e=>({display:getComputedStyle(e.parentElement).display,letter:getComputedStyle(e.querySelector('strong,b')).display,layout:e.closest('.m170-option-columns')!==null}));
 assert.equal(bank.layout,true,'Options phải nằm trong bố cục của nguồn');
 assert.notEqual(bank.letter,'inline','Ký hiệu phải là ô riêng');
 if(process.env.SUBSTITUTE_PARITY_EVIDENCE){fs.mkdirSync(process.env.SUBSTITUTE_PARITY_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.SUBSTITUTE_PARITY_EVIDENCE,'k67-listening-options.png')});}
});
