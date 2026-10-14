// Trang, bootstrap, storage và renderer thật local/online; API trả dữ liệu giả.
// Mỗi bảng chờ đủ 35 giây theo đồng hồ thật. Không gọi môi trường ngoài.
import assert from 'node:assert/strict';import test from 'node:test';import {createRequire} from 'node:module';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {serve,completedPage,routes} from './helpers/result-details-browser-fixture.mjs';
const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')))('playwright');
let browser,server;
test.before(async()=>{server=process.env.RESULT_DETAILS_BASE_URL?{base:process.env.RESULT_DETAILS_BASE_URL,close:async()=>{}}:await serve(process.env.RESULT_DETAILS_SOURCE_ROOT);browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await server?.close();});
test('K56/Substitute: các tuyến giữ thao tác kết quả', {concurrency:2}, async t=>{
 await Promise.all(routes.map(route=>t.test(route,async()=>{
  const f=await completedPage(browser,server.base,route);
  try{
   for(const index of [0,1]){
    for(let i=0;i<2;i++)if(await f.details.nth(i).evaluate(n=>n.open)!==(i===index))await f.details.nth(i).locator('summary').click();
    await f.details.nth(index).locator('summary').focus();
    await f.page.evaluate(index=>{window.detailsBefore=[...document.querySelectorAll('#questionDetails > details')];window.focusBefore=document.activeElement;window.scrollTo(0,700);},index);
    await f.page.waitForTimeout(1000);await f.page.evaluate(()=>{window.scrollBefore=scrollY;});
    const start=f.polls();await f.page.waitForTimeout(35000);
    if(!f.paperMini)for(let n=0;f.polls()-start<3&&n<12;n++)await f.page.waitForTimeout(1000);
    assert.equal(f.paperMini?f.polls()===start:f.polls()-start>=3,true,'Paper không poll Writing; tuyến khác phải nhận ít nhất ba lần cập nhật');
    assert.deepEqual(await f.details.evaluateAll(ns=>ns.map(n=>n.open)),index===0?[true,false]:[false,true]);
    assert.ok(await f.page.evaluate(()=>window.detailsBefore.every((n,i)=>n===document.querySelectorAll('#questionDetails > details')[i])&&window.focusBefore===document.activeElement&&window.scrollBefore===scrollY),'Dữ liệu không đổi phải giữ bảng, focus và vị trí cuộn');
   }
   if(f.paperMini){
    // Tuyến không polling: gọi đúng handler đọc kết quả trong cùng trang thử.
    await f.page.evaluate(()=>document.querySelector('#viewResult').click());await f.page.waitForTimeout(100);
    assert.deepEqual(await f.details.evaluateAll(ns=>ns.map(n=>n.open)),[false,true]);
    t.diagnostic(route+': chuyển điểm Writing không áp dụng; đã kiểm handler tải kết quả');
   }else{
    f.ready();await f.page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await f.page.waitForFunction(()=>/hoàn tất|Link LMS/.test(document.querySelector('#resultStatus')?.textContent||''),null,{timeout:35000});
    assert.deepEqual(await f.details.evaluateAll(ns=>ns.map(n=>n.open)),[false,true],'Writing ready giữ Listening đóng và Reading mở');
   }
   // Kiểm từng chiều định danh độc lập, giữ kho cũ qua bootstrap/storage thật.
   let previousMarker='OLD-RUN';
   for(const change of [
    {student:true,group:false,attempt:false,marker:'NEW-STUDENT'},
    {student:false,group:true,attempt:false,marker:'NEW-CLASS'},
    {student:false,group:false,attempt:true,marker:'NEW-ATTEMPT'}
   ]){
    for(let i=0;i<2;i++)if(!(await f.details.nth(i).evaluate(n=>n.open)))await f.details.nth(i).locator('summary').click();await f.page.waitForTimeout(50);
    await f.switchSession(change);
    assert.deepEqual(await f.details.evaluateAll(ns=>ns.map(n=>n.open)),[false,false],change.marker+': định danh mới phải đặt lại toggle');
    assert.equal(await f.page.locator('#resultStudentName').innerText(),'Học viên giả B');
    const data=await f.page.locator('#questionDetails').textContent();assert.ok(data.includes(change.marker));assert.ok(!data.includes(previousMarker));previousMarker=change.marker;
   }
   assert.deepEqual(f.errors,[],'Không chấp nhận lỗi JS hoặc API ngoài fixture');
  }finally{await f.close();}
 })));
});
