// Kiểm lối vào Mini Test giấy bằng trình duyệt: demo chỉ hiện khi đường dẫn yêu cầu đúng mã.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')).href)('playwright');

test('Mini giấy: link demo tải đủ tên; lớp thật và mã gần giống giữ danh sách thật',async()=>{
  const server=createServer(async(req,res)=>{
    try {
      let path=new URL(req.url,'http://local').pathname;if(path.endsWith('/'))path+='index.html';
      const data=await readFile(new URL('..'+path,import.meta.url));
      res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html;charset=utf-8'})[extname(path)]||'text/plain'}).end(data);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    for(const code of ['CODEXDEMO806','IC2304','CODEXDEMO806X']){
      const context=await browser.newContext();const calls=[],errors=[];
      await context.route('**/api/**',async route=>{
        const url=new URL(route.request().url());calls.push(url);
        assert.equal(route.request().method(),'GET','Lối vào không tự tạo bài');
        if(url.pathname.endsWith('/classes'))return route.fulfill({json:{ok:true,classes:[{name:'IC2304'}]}});
        if(url.pathname.endsWith('/roster'))return route.fulfill({json:{ok:true,class:{name:url.searchParams.get('class')},students:Array.from({length:10},(_,i)=>({ref:`11111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`,name:`Học viên demo ${i+1}`}))}});
        return route.fulfill({status:404,json:{ok:false}});
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/term-tests/mini-test-lesson-5/?class=${code}`);
      await page.locator('#miniClass option[value="IC2304"]').waitFor({state:'attached'});
      if(code==='CODEXDEMO806X'){
        assert.equal(await page.locator('#miniClass').inputValue(),'');
        assert.equal(await page.locator('#miniClass option[value="CODEXDEMO806"]').count(),0);
        assert.equal(calls.filter(url=>url.pathname.endsWith('/roster')).length,0);
      }else{
        await page.locator('#studentSelect option').filter({hasText:'Học viên demo 10'}).waitFor({state:'attached',timeout:5000});
        assert.equal(await page.locator('#miniClass').inputValue(),code);
        assert.equal(calls.filter(url=>url.pathname.endsWith('/roster')).at(-1).searchParams.get('class'),code);
        assert.equal(await page.locator('#studentSelect option').filter({hasText:'Học viên demo'}).count(),10);
      }
      assert.deepEqual(errors,[]);await context.close();
    }
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
