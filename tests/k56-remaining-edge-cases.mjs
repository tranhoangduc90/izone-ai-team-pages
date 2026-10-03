// Nhận bài giả đã hoàn thành, Pages/handler backend thật ở revision đã ghim.
// Kiểm phản hồi đọc chậm, nhận xét dài/in và zoom thật qua Cài đặt Chrome.
// Audit kho trước/sau, chặn mạng ngoài; JSON/PNG/PDF giữ ở output/playwright/k56-edge.
// Assertion lỗi trả exit 1, không chuyển unknown thành đạt hoặc gửi dữ liệu thật.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import test,{after} from 'node:test';
import {createCompletedResultFixture} from './fixtures/k56-completed-result-e03-server.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const backendRoot='E:/wt/k56-e03-backend-20261002';
const runtime=resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(runtime,'playwright/package.json')))('playwright');
const fixture=JSON.parse(await readFile(new URL('./fixtures/k56-completed-result-e03.json',import.meta.url),'utf8'));
const output=resolve(root,'output/playwright/k56-edge',process.env.EDGE_EVIDENCE_VARIANT||'.');
await mkdir(output,{recursive:true});
assert.equal(execFileSync('git',['-C',backendRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'6bc48163029fef9a7ebbffb4d50a16167801bcd7');
const feedbackLines=Array.from({length:12},(_,i)=>`E05-L${String(i+1).padStart(2,'0')} Nhận xét giả có dấu: lập luận cần thêm ví dụ, so sánh và giải thích rõ ý. ${'dữ-liệu-giả-'.repeat(5)}`);
const longFeedback=['E05-BEGIN',...feedbackLines,'E05-END'].join('\n\n');
// Mỗi Term giữ một kho RAM dùng chung ba phép đọc; tránh biên dịch WASM sáu lần.
const servers=new Map();
after(async()=>{for(const server of servers.values()) await server.close();});

for(const itemBase of fixture.cases) for(const edge of ['E04','E05','E06']) {
 test(`${edge} ${itemBase.slug}`,{timeout:90_000},async()=>{
  const item={...itemBase,feedback:longFeedback};
  if(!servers.has(item.slug)) servers.set(item.slug,await createCompletedResultFixture({backendRoot,pagesRoot:root,fixture,item}));
  const server=servers.get(item.slug);
  const before=await server.audit();
  assert.equal(before.term_test_writing_grading_job.length,2);
  let browser,context,report,page;const blocked=[],errors=[];const observations={};
  try {
   if(edge==='E06') {
    // Cài đặt zoom native của Chrome: không CSS zoom, pinch hoặc emulation viewport.
    const profile=resolve(output,`profile-${item.slug}-${Date.now()}`);
    context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:null,args:['--window-size=640,900']});
    const baselinePage=await context.newPage();
    observations.zoomBaseline=await baselinePage.evaluate(()=>({innerWidth,outerWidth,dpr:devicePixelRatio}));
    await baselinePage.close();
    const settings=await context.newPage();await settings.goto('chrome://settings/appearance');
    await settings.locator('#zoomLevel').selectOption('2');
    assert.equal(await settings.locator('#zoomLevel').inputValue(),'2');
    await settings.close();
   } else {
    browser=await chromium.launch({channel:'chrome',headless:true});
    context=await browser.newContext({viewport:{width:edge==='E05'?360:1280,height:900}});
   }
   await context.addInitScript(({key,studentRef,studentName,attemptToken})=>{
    localStorage.setItem(key,JSON.stringify({studentRef,studentName,attemptToken,completed:true,writingStarted:true,writingSubmitted:true}));
   },{key:`izone-test:${item.slug}:${fixture.classCode}`,...item,studentName:fixture.studentName});
   let delayed=0;let delayMs=0;
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==server.url){blocked.push(`${request.method()} ${url.origin}${url.pathname}`);return route.abort();}
    if(process.env.EDGE_SOURCE_OVERRIDES&&/^\/term-tests\/term-test-[12]-k56-computer-based\/(?:index\.html|styles\.css)?$/u.test(url.pathname)) {
     const relative=url.pathname.endsWith('/')?`${url.pathname.slice(1)}index.html`:url.pathname.slice(1);
     return route.fulfill({contentType:relative.endsWith('.css')?'text/css':'text/html',body:await readFile(resolve(process.env.EDGE_SOURCE_OVERRIDES,relative))});
    }
    if(/\/k56(?:-test2)?-shared\/config\.js$/u.test(url.pathname)) return route.fulfill({contentType:'text/javascript',body:"window.TERM_TEST_APP_CONFIG={API_BASE_URL:'/fixture-api'};"});
    if(url.pathname==='/fixture-api/api/term-tests/roster'&&request.method()==='GET') return route.fulfill({json:{class:{name:fixture.classCode},students:[{ref:item.studentRef,name:fixture.studentName}]}});
    if(url.pathname===`/fixture-api/api/term-tests/${item.slug}/attempt/prepare`&&request.method()==='POST') {
     // Bản Pages mới hỏi trạng thái phiên trước khi đọc kết quả; fixture đã có đúng lượt này.
     assert.equal(request.postDataJSON().studentRef,item.studentRef);
     const content=await request.frame().evaluate(()=>window.K56_TERM_TEST_CONTENT);
     return route.fulfill({json:{ok:true,content,serverNow:new Date().toISOString(),attemptToken:item.attemptToken,examSessionToken:item.attemptToken,
      examMode:'lis_first',nextSection:'result',completed:true,listeningSubmitted:true,readingSubmitted:true,
      writingSubmittedAt:fixture.completedAt}});
    }
    if(url.pathname===`/fixture-api/api/term-tests/${item.slug}/session/resume-attempt`&&request.method()==='POST') {
     const content=await request.frame().evaluate(()=>window.K56_TERM_TEST_CONTENT);
     return route.fulfill({json:{ok:true,content,attemptToken:item.attemptToken,listeningSubmitted:true,serverNow:new Date().toISOString()}});
    }
    if(url.pathname==='/fixture-api/api/term-tests/result'&&request.method()==='POST') {
     assert.equal(request.postDataJSON().attemptToken,item.attemptToken);
     if(edge==='E04'&&delayed===0) {
      delayed++;const started=Date.now();const response=await route.fetch();
      await new Promise(done=>setTimeout(done,4000));delayMs=Date.now()-started;
      return route.fulfill({response});
     }
     return route.continue();
    }
    if(request.method()==='GET'&&!url.pathname.startsWith('/fixture-api')) return route.continue();
    blocked.push(`${request.method()} ${url.pathname}`);return route.abort();
   });
   page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15_000);
   // Zoom native khiến clip mặc định của Playwright chỉ lấy nửa ảnh vật lý.
   // Chụp surface Chrome trực tiếp, không đặt clip theo tọa độ CSS đã thu nhỏ.
   const screenshot=async(path,fullPage=false)=>{
    if(edge!=='E06') return page.screenshot({path,fullPage});
    const cdp=await context.newCDPSession(page);
    try {
     const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
     await writeFile(path,Buffer.from(shot.data,'base64'));
     const pixels=JSON.parse(execFileSync('python',['-c',"from PIL import Image;import json,sys;im=Image.open(sys.argv[1]).convert('RGB');print(json.dumps({'width':im.width,'height':im.height,'colors':len(im.getcolors(im.width*im.height) or [])}))",path],{encoding:'utf8'}));
     assert.equal(pixels.width,observations.zoomBaseline.innerWidth,'Ảnh phải chứa đủ chiều rộng surface Chrome');
     assert.ok(pixels.colors>20,'Ảnh trống không đủ bằng chứng hiển thị');
     observations.nativeScreenshots=(observations.nativeScreenshots||[]).concat(pixels);
    } finally {await cdp.detach();}
   };
   const started=Date.now();await page.goto(`${server.url}/term-tests/${item.slug}-computer-based/?class=${fixture.classCode}`);
   const score=page.locator('#writingSubmissionResult .writing-score-card.is-action');await score.waitFor({state:'visible'});
   assert.match(await score.innerText(),new RegExp(`Writing Task ${item.taskNumber}`));
   assert.equal(Number((await score.innerText()).match(/Band\s+(\d+(?:\.\d+)?)/u)?.[1]),item.score);
   assert.equal(await page.locator('#resultStudentName').innerText(),fixture.studentName);
   observations.readyAfterMs=Date.now()-started;
   if(edge==='E04') {
    assert.equal(delayed,1);assert.ok(delayMs>=4000);observations.delayedReads=delayed;observations.delayMs=delayMs;
    await page.screenshot({path:resolve(output,`${edge}-${item.slug}-recovered.png`),fullPage:true});
    await page.reload();await score.waitFor({state:'visible'});
    assert.equal(Number((await score.innerText()).match(/Band\s+(\d+(?:\.\d+)?)/u)?.[1]),item.score);
    observations.reloadRecovered=true;
   } else {
    observations.viewport=await page.evaluate(()=>({innerWidth,outerWidth,dpr:devicePixelRatio,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,visualScale:visualViewport.scale}));
    if(edge==='E06') {
     assert.equal(observations.viewport.outerWidth,640);assert.equal(observations.viewport.dpr,2);
     assert.equal(observations.viewport.innerWidth*2,observations.zoomBaseline.innerWidth,'Browser zoom phải giảm layout width đúng một nửa');
     assert.equal(observations.viewport.visualScale,1,'Pinch không phải browser zoom');
    }
    assert.ok(observations.viewport.scrollWidth<=observations.viewport.clientWidth+1,'Trang tràn ngang');
    await screenshot(resolve(output,`${edge}-${item.slug}-result.png`),true);
    await score.click();const dialog=page.locator('.writing-feedback-dialog');await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.locator('.writing-feedback-essay').innerText(),item.essay);
    assert.equal(await dialog.locator('.writing-band-summary-item').count(),4);
    const layout=dialog.locator('.writing-feedback-layout');
    observations.dialog=await dialog.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}));
    assert.ok(observations.dialog.scrollWidth<=observations.dialog.width+1,'Bài chấm tràn ngang');
    await screenshot(resolve(output,`${edge}-${item.slug}-feedback-top.png`));
    if(edge==='E05') {
     const text=await dialog.innerText();for(const line of feedbackLines) assert.ok(text.includes(line),`Thiếu ${line.slice(0,7)}`);
     assert.ok(text.includes('E05-BEGIN')&&text.includes('E05-END'));
     assert.equal(await dialog.locator('script,iframe').count(),0);
     await layout.evaluate(el=>{el.scrollTop=el.scrollHeight;});
     const last=dialog.locator('.writing-feedback-scores .writing-feedback-text').last();await last.scrollIntoViewIfNeeded();
     await screenshot(resolve(output,`${edge}-${item.slug}-feedback-end.png`));
     // Dùng chế độ in thật của Chrome; đọc PDF bằng thư viện độc lập để bắt cắt nội dung.
     const pdfPath=resolve(output,`${edge}-${item.slug}.pdf`);await page.pdf({path:pdfPath,format:'A4',printBackground:true});
     const pdf=JSON.parse(execFileSync('python',['-c',"import fitz,json,sys;d=fitz.open(sys.argv[1]);print(json.dumps({'pages':len(d),'text':' '.join(p.get_text() for p in d)}))",pdfPath],{encoding:'utf8'}));
     const flat=pdf.text.replace(/\s/gu,'');
     observations.printPages=pdf.pages;observations.printMarkersPresent=['E05-BEGIN',...feedbackLines.map(l=>l.slice(0,7)),'E05-END'].filter(m=>flat.includes(m)).length;
     assert.equal(observations.printMarkersPresent,14,'Bản in cắt nhận xét dài');
     observations.printMarkerCounts=Object.fromEntries(['E05-BEGIN',...feedbackLines.map(l=>l.slice(0,7)),'E05-END'].map(m=>[m,flat.split(m).length-1]));
     assert.ok(Object.values(observations.printMarkerCounts).every(n=>n>=4),'Bản in thiếu nhận xét của một hoặc nhiều tiêu chí');
     assert.ok(flat.includes(item.essay.replace(/\s/gu,'')),'Bản in thiếu bài nguồn');
    } else {
     await layout.evaluate(el=>{el.scrollTop=el.scrollHeight;});
     assert.ok(await layout.evaluate(el=>el.scrollTop>0||el.scrollHeight<=el.clientHeight),'Không cuộn được bài chấm');
     observations.screenMedia=await page.evaluate(()=>({print:matchMedia('print').matches,screen:matchMedia('screen').matches}));
     assert.equal(observations.screenMedia.print,false);
     await screenshot(resolve(output,`${edge}-${item.slug}-feedback-end.png`));
    }
    await dialog.getByRole('button',{name:'Đóng bài chấm Writing'}).click();
    // Chrome phát sự kiện close ở lượt event tiếp theo; phải chờ remove thật.
    await dialog.waitFor({state:'detached'});
    assert.equal(await page.locator('.writing-feedback-dialog').count(),0);
   }
   if(process.env.EDGE_EXTRA_JOB_PROBE==='1') await server.injectExtraJobForProbe();
   assert.deepEqual(await server.audit(),before,'Đọc/zoom/in làm đổi kho hoặc thêm job');
   assert.equal(server.counters.portalWrites,0);assert.equal(server.counters.blockedApiWrites,0);
   assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
   report={outcome:'passed',capturedAt:new Date().toISOString(),edge,slug:item.slug,observations,counters:server.counters,jobDelta:0,databaseUnchanged:true,productionRequests:0,fakeOnly:true};
  } catch(error) {
   if(page) observations.failureBody=(await page.locator('body').innerText()).slice(0,2500);
   report={outcome:'failed',capturedAt:new Date().toISOString(),edge,slug:item.slug,reason:error.message,observations,counters:server.counters,blocked,errors};throw error;
  } finally {
   await writeFile(resolve(output,`${edge}-${item.slug}${process.env.EDGE_EXTRA_JOB_PROBE==='1'?'-probe':''}.json`),JSON.stringify(report,null,2)+'\n','utf8');
   await context?.close();await browser?.close();
  }
 });
}
test('T-INVALID: token sai bị từ chối, kho không đổi',async()=>{
 // Gửi khóa lượt sai tới handler thật của kho giả; không gọi hệ thống lớp thật.
 const item={...fixture.cases[0],feedback:longFeedback};
 if(!servers.has(item.slug)) servers.set(item.slug,await createCompletedResultFixture({backendRoot,pagesRoot:root,fixture,item}));
 const server=servers.get(item.slug),before=await server.audit();
 const response=await fetch(`${server.url}/fixture-api/api/term-tests/result`,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attemptToken:'invalid-token'})
 });
 assert.equal(response.status,400);assert.deepEqual(await server.audit(),before);assert.equal(server.counters.portalWrites,0);
 await writeFile(resolve(output,'T-INVALID.json'),JSON.stringify({outcome:'passed',capturedAt:new Date().toISOString(),httpStatus:400,databaseUnchanged:true,productionRequests:0})+'\n','utf8');
});
