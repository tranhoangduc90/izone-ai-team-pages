// Nguyên hàm render chạy trong Chrome; chỉ mock phần ngoài bảng và API.
// Bảo vệ thao tác người xem khi điểm tổng hợp đổi mà dữ liệu từng câu vẫn như cũ.
// Không thêm hook/export vào sản phẩm; chuyển phiên thật được kiểm ở suite browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')))('playwright');
const sourceRoot=process.env.RESULT_DETAILS_SOURCE_ROOT||new URL('../',import.meta.url);
const clients=['k56-shared','k56-test2-shared','k56-mini-shared','substitute-k56-shared','substitute-test-2-k56-shared','substitute-k67-shared'];
let browser;
test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();});
for(const client of clients)test(`${client}: giữ DOM/focus/cuộn, toggle và dữ liệu mới`,async()=>{
 const source=await readFile(typeof sourceRoot==='string'?resolve(sourceRoot,'term-tests',client,'app.js'):new URL(`term-tests/${client}/app.js`,sourceRoot),'utf8');
 const start=source.indexOf('  function renderDetailBlock('),end=source.indexOf('  function portalNotice(',start);
 assert.ok(start>=0&&end>start,'Không tìm thấy ranh giới render đang dùng');
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 try{
  await page.evaluate(code=>{
   window.probe=new Function(`
    const state={attemptToken:'fake-a',studentRef:'student-a',writingSubmitted:true};
    const elements=Object.fromEntries(['resultStudentName','resultMeta','summaryGrid','resultStatus','continueReadingFromResult','questionDetails','skillPerformanceSections'].map(id=>[id,document.createElement('div')]));
    document.body.append(...Object.values(elements));
    const demoMode=false,serverGradingMode=false,twoTaskWriting=false,storageKey='fake',classCode='FAKE',testConfig={title:'Bài giả',slug:'fake-test'};let resultDetailSignature='';
    const rows=Array.from({length:40},(_,i)=>({number:i+1,studentAnswer:'A',correctAnswer:'A',result:'correct'}));
    const payload={studentName:'Người giả',className:'FAKE',attemptToken:'fake-a',completed:true,writing:{submitted:true,grading:{ready:false,status:'processing'}},result:{listening:{correct:40,total:40,details:rows},reading:{correct:40,total:40,details:structuredClone(rows)}}};
    function addSummaryCard(){return document.createElement('div');}function sectionScore(){return '1/1';}function sectionScoreText(){return '1/1';}function renderSkillPerformance(){return document.createElement('div');}function renderWritingSubmission(){}function stopWritingGradingPolling(){}function saveSession(){}
    ${code}
    const render=()=>renderResult(structuredClone(payload));render();
    return {state,payload,elements,render};
   `)();
  },source.slice(start,end));
  for(const index of [0,1]){
   // Click rồi render ngay trong cùng task: không dựa vào toggle event đã được lưu.
   const actual=await page.evaluate(index=>{
    const p=window.probe,nodes=[...p.elements.questionDetails.children];
    nodes.forEach((n,i)=>{n.open=i===index;});nodes[index].querySelector('summary').focus();window.scrollTo(0,400);
    const before={focused:document.activeElement,scroll:window.scrollY};
    p.payload.result.listening.correct=39;p.payload.result.reading.typeStats=[{type:'Dạng giả',correct:index,total:1}];
    p.render();
    return {open:[...p.elements.questionDetails.children].map(n=>n.open),same:nodes.every((n,i)=>n===p.elements.questionDetails.children[i]),focused:document.activeElement===before.focused,scroll:window.scrollY,beforeScroll:before.scroll};
   },index);
   assert.deepEqual(actual.open,index===0?[true,false]:[false,true],'Điểm tổng hợp không được đổi lựa chọn từng bảng');
   assert.equal(actual.same,true,'Dữ liệu từng câu không đổi phải giữ nguyên DOM cả hai bảng');
   assert.equal(actual.focused,true,'Bảng không đổi phải giữ focus');assert.equal(actual.scroll,actual.beforeScroll,'Bảng không đổi phải giữ vị trí cuộn');
  }
  const changed=await page.evaluate(()=>{
   const p=window.probe;const l=p.elements.questionDetails.children[0],r=p.elements.questionDetails.children[1];l.open=true;r.open=false;
   p.payload.result.listening.details.push({number:41,studentAnswer:'NEW',correctAnswer:'B',result:'incorrect'});p.render();
   return {open:[...p.elements.questionDetails.children].map(n=>n.open),rows:p.elements.questionDetails.children[0].querySelectorAll('tbody tr').length,unchangedReading:r===p.elements.questionDetails.children[1]};
  });
  assert.deepEqual(changed,{open:[true,false],rows:41,unchangedReading:true},'Câu mới cập nhật đúng, giữ lựa chọn và bảng không đổi');
  // Event của node bị thay thế không được ghi đè lựa chọn hiện tại.
  await page.waitForTimeout(50);
  const ready=await page.evaluate(()=>{const p=window.probe;p.payload.writing.grading={ready:true,status:'ready'};p.render();return [...p.elements.questionDetails.children].map(n=>n.open);});
  assert.deepEqual(ready,[true,false],'Writing ready không được đổi toggle');
  const renamed=await page.evaluate(()=>{const p=window.probe,before=[...p.elements.questionDetails.children];p.payload.studentName='Người giả đã sửa tên';p.render();return {same:before.every((n,i)=>n===p.elements.questionDetails.children[i]),open:[...p.elements.questionDetails.children].map(n=>n.open)};});
  assert.deepEqual(renamed,{same:true,open:[true,false]},'Cùng mã học viên/lượt trong phiên: tên hiển thị đổi không phải người mới');
 }finally{await page.close();}
});
