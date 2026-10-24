// Mở trang Reading thật, làm chậm import và kiểm Highlight sau khi renderer sẵn sàng.
// API và đoạn luyện đều giả; không tạo lượt, gọi AI hoặc ghi hệ thống bên ngoài.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');

test('Reading tải chậm vẫn mở được Highlight và lưu đúng chữ đã chọn',async t=>{
 const root=process.env.READING_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
 const server=await serve(root),browser=await chromium.launch({channel:'chrome',headless:true});
 t.after(async()=>{await browser.close();await server.close();});
 const context=await browser.newContext(),page=await context.newPage();
 page.setDefaultTimeout(5000);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!url.href.startsWith(server.base))return route.abort();
  if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:{code:'FIXTURE_STOP',message:'Dừng API ở bộ thử chọn chữ'}}});
  if(url.pathname.endsWith('/course-student-identity.js'))await new Promise(resolve=>setTimeout(resolve,400));
  return route.continue();
 });
 await page.goto(server.base+'reading-practice/');
 await page.waitForFunction(()=>Boolean(window.ReadingInteractionBridge));
 assert.equal(await page.evaluate(()=>Boolean(window.ReadingAnnotations)),true,'Công cụ bị bỏ qua khi app còn chờ import');
 // Fixture thao tác chọn chữ dùng đúng cầu nối đã được app phát ra, không có nháp học viên thật.
 const quote='Đoạn văn thử để học viên chọn một phần và lưu Highlight đúng vị trí.';
 await page.evaluate(quote=>{
  const attempt={annotations:[]};window.annotationFixture={attempt,saves:0};
  Object.assign(window.ReadingInteractionBridge,{current:()=>attempt,scope:()=> 'annotation-fixture',writable:()=>true,save:()=>{window.annotationFixture.saves++;return true;}});
  document.querySelector('#app').innerHTML='<section id="readingView"><article class="cbt-reading-passage"><p id="fixture-passage"></p></article></section>';
  document.querySelector('#fixture-passage').textContent=quote;
  window.ReadingAnnotations.install();
 },quote);
 await page.locator('#fixture-passage').evaluate(element=>{
  const range=document.createRange();range.setStart(element.firstChild,0);range.setEnd(element.firstChild,12);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
 });
 await page.locator('.cbt-annotation-toolbar').getByRole('button',{name:'Highlight',exact:true}).click();
 assert.equal(await page.locator('#fixture-passage .cbt-annotation-mark').innerText(),quote.slice(0,12));
 const result=await page.evaluate(()=>({count:window.annotationFixture.attempt.annotations.length,saves:window.annotationFixture.saves,text:document.querySelector('#fixture-passage').textContent}));
 assert.equal(result.count,1);assert(result.saves>0);assert.equal(result.text,quote);
});
