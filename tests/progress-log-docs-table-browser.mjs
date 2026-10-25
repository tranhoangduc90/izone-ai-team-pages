// Chrome thật kiểm bảng nguồn bằng dữ liệu giả: vị trí DOM không được đổi thứ tự mảng câu trả lời.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
test('Bảng Docs giữ hàng/cột, slot và nháp sau tải lại; cuộn trong bảng trên điện thoại',{timeout:60000},async()=>{
 let saved=['slot zero','slot one','slot two','slot three'];
 const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/state'){if(req.method==='PUT'){let body='';for await(const chunk of req)body+=chunk;saved=JSON.parse(body);}
   res.setHeader('content-type','application/json');res.end(JSON.stringify(saved));return;}
  if(path==='/test'){res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/progress-log/styles.css"><main class="shell" id="host"></main>');return;}
  try{const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+sep))throw Error();res.setHeader('content-type',extname(file)==='.js'?'text/javascript':'text/css');res.end(await readFile(file));}
  catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const render=async()=>page.evaluate(async()=>{const {docsSourceTable}=await import('/progress-log/docs-source-table.js');
   const item={itemVersionId:'fixture-table',interactionConfig:{responseCount:4,sentenceLines:[0,1,2,3].map(i=>({parts:['('+i+') ',' .']})),
    tableLayout:{columnHeaders:['Column A','Column B'],rows:[{label:'First row',cells:[{lineIndexes:[1]},{lineIndexes:[0]}]},
     {label:'Second row',cells:[{text:'Known A'},{text:'Known B'}]},{label:'Third row',cells:[{lineIndexes:[3]},{lineIndexes:[2]}]}]}}};
   document.getElementById('host').replaceChildren(docsSourceTable(item,{values:await(await fetch('/state')).json(),resizeInput:()=>{},
    onChange:async value=>{await fetch('/state',{method:'PUT',body:JSON.stringify(value)});window.lastSaved=value;}}));
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/test');await render();
  assert.deepEqual(await page.locator('textarea').evaluateAll(nodes=>nodes.map(n=>[n.dataset.slot,n.value])),[['1','slot one'],['0','slot zero'],['3','slot three'],['2','slot two']]);
  await page.locator('[data-slot="3"]').fill('changed third slot');await page.waitForFunction(()=>window.lastSaved?.[3]==='changed third slot');
  assert.deepEqual(saved,['slot zero','slot one','slot two','changed third slot']);await page.reload();await render();
  assert.equal(await page.locator('[data-slot="3"]').inputValue(),'changed third slot');assert.equal(await page.getByText('Known A',{exact:true}).count(),1);
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.equal(await page.locator('.docs-source-table').evaluate(node=>node.scrollWidth>node.clientWidth),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
