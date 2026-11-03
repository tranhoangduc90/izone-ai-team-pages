import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {serve} from './helpers/result-details-browser-fixture.mjs';
const module=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=module.chromium?module:module.default;
async function fixture(t){
 const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true});
 t.after(async()=>{await browser.close();await server.close();});
 const context=await browser.newContext({viewport:{width:390,height:800}}),page=await context.newPage();
 if(process.env.SUBSTITUTE_PROGRESS_PANEL_BASELINE)await context.route('**/teacher-progress-panel.js*',route=>route.fulfill({contentType:'text/javascript',body:readFileSync(process.env.SUBSTITUTE_PROGRESS_PANEL_BASELINE,'utf8')}));
 await context.route('**/__t5-progress-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body><div style="height:500px"></div><section id="fixture-host"></section><div style="height:1000px"></div></body>'}));
 await page.goto(server.base+'__t5-progress-fixture');
 await page.evaluate(async base=>{
  const {createProgressPanel}=await import(base+'term-tests/substitute-shared/teacher-progress-panel.js');
  const test='substitute-test-1-k67',classCode='DEMO',view='a'.repeat(64),when='2026-10-19T02:00:00.000Z';
  window.fixture={answer:'Synthetic original answer',fault:null,authErrors:0,requests:0};
  const student={studentRef:'fictional-A',studentName:'Học viên giả A',status:'sections_submitted',progress:[{viewId:view,startedAt:when,status:'sections_submitted',historical:false}]};
  window.panel=createProgressPanel({host:document.getElementById('fixture-host'),isCurrent:()=>true,onAuthError:()=>window.fixture.authErrors++,request:async path=>{
   window.fixture.requests++;
   // 503 chỉ xảy ra ở phần chi tiết để chắc chắn kiểm giữ nội dung sau khi danh sách đã đọc thành công.
   if(window.fixture.fault&&(window.fixture.fault!==503||path.endsWith('/detail')))throw Object.assign(Error('Synthetic read failure'),{status:window.fixture.fault});
   if(path.endsWith('/students'))return structuredClone({testSlug:test,classCode,students:[student],offset:0,limit:100,hasMore:false});
   return{testSlug:test,classCode,studentRef:student.studentRef,studentName:student.studentName,progress:{viewId:view,status:'sections_submitted',
    listening:{availability:'available',submittedAt:when,answers:[{number:1,answer:window.fixture.answer}]},reading:{availability:'local_only'},writing:{availability:'local_only'}}};
  }});window.panel.show({test,class:classCode});
 },server.base);
 await page.locator('.progress-student').click();await page.getByText('Synthetic original answer',{exact:true}).waitFor();
 return page;
}
async function refresh(page){
 const before=await page.evaluate(()=>window.fixture.requests);
 await page.evaluate(()=>[...document.querySelectorAll('.substitute-progress button')].find(b=>b.textContent==='Cập nhật tiến trình').click());
 await page.waitForFunction(n=>window.fixture.requests>n,before);
 await page.waitForFunction(()=>document.querySelector('.substitute-progress').hidden||![...document.querySelectorAll('.substitute-progress button')].find(b=>b.textContent==='Cập nhật tiến trình').disabled);
}
test('Unchanged background reads retain real DOM, focus, selection and scroll across three refreshes',async t=>{
 const page=await fixture(t);
 await page.evaluate(()=>{const select=document.querySelector('.progress-detail select'),heading=document.querySelector('.progress-detail h4');select.focus();const r=document.createRange();r.selectNodeContents(heading);getSelection().removeAllRanges();getSelection().addRange(r);scrollTo(0,450);window.before={select,heading,list:document.querySelector('.progress-student'),selection:getSelection().toString(),scrollY};});
 for(let i=0;i<3;i++)await refresh(page);
 const result=await page.evaluate(()=>({selectSame:before.select===document.querySelector('.progress-detail select'),headingSame:before.heading===document.querySelector('.progress-detail h4'),listSame:before.list===document.querySelector('.progress-student'),focus:document.activeElement===before.select,selection:getSelection().toString()===before.selection,scroll:scrollY===before.scrollY}));
 assert.deepEqual(result,{selectSame:true,headingSame:true,listSame:true,focus:true,selection:true,scroll:true});
});
test('Same-timestamp content changes still appear; transient reads retain it and revoked access clears it',async t=>{
 const page=await fixture(t);
 await page.evaluate(()=>window.fixture.answer='Synthetic changed answer');await refresh(page);
 await page.getByText('Synthetic changed answer',{exact:true}).waitFor();
 await page.evaluate(()=>window.fixture.fault=503);await refresh(page);
 assert.equal(await page.getByText('Synthetic changed answer',{exact:true}).count(),1);
 assert.equal(await page.locator('.progress-detail select').count(),1);
 await page.evaluate(()=>window.fixture.fault=403);await refresh(page);
 assert.equal(await page.locator('.substitute-progress').isVisible(),false);
 assert.equal(await page.locator('.progress-detail').innerText(),'');
 assert.equal(await page.evaluate(()=>window.fixture.authErrors),1);
});
