// Trang và renderer thật, kết quả/API giả. Chỉ đọc trạng thái, chặn dịch vụ ngoài fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
import {serve,completedPage} from './helpers/result-details-browser-fixture.mjs';
const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(resolve(modules,'playwright/package.json'))('playwright');
const evidence=process.env.WRITING_UX_EVIDENCE||resolve('output/writing-submit-ux');mkdirSync(evidence,{recursive:true});
// Bốn Substitute đi trọn hành trình ở substitute-submit-browser.mjs; không dựng lại lobby trong fixture kết quả.
const slugs=['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56'];
let server,browser;
test.before(async()=>{
 server=process.env.WRITING_UX_PUBLIC_BASE
  ?{base:new URL(process.env.WRITING_UX_PUBLIC_BASE).href,close:async()=>{}}
  :await serve();
 browser=await chromium.launch({headless:true,channel:'chrome'});
});
test.after(async()=>{await browser?.close();await server?.close();});
test('Sáu Term/Mini: xác nhận rõ, kiểm tra chỉ đọc, giữ vùng đọc qua các nhịp', {concurrency:2}, async t=>{
 await Promise.all(slugs.filter(slug=>!process.env.WRITING_UX_SLUG||slug===process.env.WRITING_UX_SLUG).map(slug=>t.test(slug,async()=>{
  const f=await completedPage(browser,server.base,slug+'-computer-based',{waitTimeout:20000});
  try{
   const panels=f.page.locator('.writing-submission-status:visible');await panels.first().waitFor();
   assert.match(await panels.first().innerText(),/đã được nhận.*đang chấm/);
   await panels.first().evaluate(el=>{window.statusNode=el;window.statusCopy=el.querySelector('[data-writing-receipt-copy]');});
   const reads=f.polls();
   for(let i=0;i<3;i++){
    await panels.first().getByRole('button',{name:'Kiểm tra trạng thái Writing'}).click();
    await panels.first().getByRole('button',{name:'Kiểm tra trạng thái Writing'}).waitFor();
   }
   assert.ok(f.polls()>=reads+3);
   assert.equal(await panels.first().evaluate(el=>el===window.statusNode&&el.querySelector('[data-writing-receipt-copy]')===window.statusCopy),true);
   assert.equal(f.requests.some(r=>/\/writing$/.test(r)),false,'Kiểm tra không gọi nộp/chấm lại');
   await f.page.screenshot({path:resolve(evidence,slug+'-processing.png'),fullPage:true});
   if(!slug.startsWith('substitute')||slug.includes('test-1')){
    for(let cycle=0;cycle<3;cycle++){
      const before=f.polls();
      for(let i=0;i<130&&f.polls()===before;i++)await new Promise(r=>setTimeout(r,250));
      assert.ok(f.polls()>before,'Polling tự động vẫn hoạt động');
      assert.equal(await panels.first().evaluate(el=>el===window.statusNode),true);
    }
   }
   f.ready();await panels.first().getByRole('button',{name:'Kiểm tra trạng thái Writing'}).click();
   await f.page.waitForFunction(()=>document.querySelector('#notice')?.textContent.includes('chấm xong'));
   assert.equal(f.requests.some(r=>/\/writing$/.test(r)),false);
   assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
 })));
});
