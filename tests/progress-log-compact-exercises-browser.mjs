// Dữ liệu giả: bảo vệ vị trí ô trong notes, ID nháp từng câu, chọn lặp tên và fallback của phiếu cũ.
// Trình duyệt chạy module thật; không gọi API hoặc dùng đáp án/học viên thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
for(const mode of ['notes','names']) {
  test(`Bố cục gọn ${mode}: giữ ID, required, Unicode, màn hẹp và dữ liệu không phù hợp`,{timeout:30000},async()=>{
    const server=createServer(async(req,res)=>{
      try {
        if(req.url==='/')return res.end('<!doctype html><link rel="stylesheet" href="/progress-log/styles.css"><main style="max-width:600px;margin:auto"><div id="sheet"></div></main>');
        const path=resolve(root,'.'+new URL(req.url,'http://local').pathname);
        if(!path.startsWith(root))throw Error('Sai phạm vi');
        res.setHeader('content-type',{'.js':'text/javascript','.css':'text/css'}[extname(path)]||'text/plain');
        res.end(await readFile(path));
      }catch{res.writeHead(404);res.end();}
    });
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate(async mode=>{
        const {buildCompactExercises}=await import('/progress-log/compact-exercises.js');
        window.values={};window.changed=[];
        const callbacks={valueFor:item=>window.values[item.itemVersionId]||'',requiredFor:item=>item.required,
          onChange:(id,value)=>{window.values[id]=value;window.changed.push(id);},resizeInput:()=>{}};
        const items=mode==='notes'?[31,32].map(n=>({itemVersionId:'item-'+n,displayNumber:String(n),
          groupId:'notes-intro',interactionType:'short_text',pedagogicalTypeCode:'sentence_completion',
          helpText:'Notes <script>window.unsafe=true</script>',prompt:`Text before ${n} ............ text after.`,required:true}))
          :[19,20].map(n=>({itemVersionId:'item-'+n,displayNumber:String(n),groupId:'answer-sheet-names',
            interactionType:'single_choice',layoutType:'matching_heading_dropdown',required:true,
            options:[{id:'A',label:'Name A'},{id:'B',label:'Name B'}]}));
        document.querySelector('#sheet').replaceChildren(...buildCompactExercises(items,callbacks));
        window.fallbacks=[buildCompactExercises([],callbacks),buildCompactExercises([{...items[0],groupId:null}],callbacks),
          buildCompactExercises([items[0],{...items[1],displayNumber:items[0].displayNumber}],callbacks)];
      },mode);
      assert.deepEqual(await page.evaluate(()=>window.fallbacks),[null,null,null]);
      if(mode==='notes') {
        await page.locator('textarea').first().fill('Dữ liệu có dấu và nội dung đủ dài');
        assert.equal(await page.locator('textarea').count(),2);
        assert.equal(await page.locator('textarea').first().evaluate(n=>n.required),true);
        assert.match(await page.locator('.sentence-text').first().textContent(),/^Text before 31.*text after\.$/);
        assert.deepEqual(await page.evaluate(()=>window.values),{'item-31':'Dữ liệu có dấu và nội dung đủ dài'});
        assert.equal(await page.evaluate(()=>window.unsafe),undefined);
      } else {
        await page.locator('select').nth(0).selectOption('A');
        await page.locator('select').nth(1).selectOption('A');
        assert.deepEqual(await page.evaluate(()=>window.values),{'item-19':'A','item-20':'A'});
        assert.equal(await page.locator('select').first().getAttribute('aria-label'),'Câu 19');
        assert.equal(await page.locator('.matching-names-bank p').count(),2);
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.deepEqual(errors,[]);
    } finally {await browser.close();await new Promise(done=>server.close(done));}
  });
}
