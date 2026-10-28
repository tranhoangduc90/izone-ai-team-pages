// HTML giảng viên, khung Thủy, bộ soạn và CSS thật; API giả có trạng thái, chặn mọi dịch vụ lớp thật.
// Bảo vệ lỗi thao tác không có phản hồi tại chỗ, khóa nút qua autosave và tác động icon đúng ô.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=process.env.PROGRESS_LOG_TEST_ROOT||fileURLToPath(new URL('../',import.meta.url));
const evidence=process.env.PROGRESS_LOG_QA_DIR||'E:/Codex-Data/progress-thuy-the16-20261028/qa';
async function fixture(t){
 const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/progress-log/fixture.html'){
   // Chỉ bỏ khởi động đăng nhập/API thật. Giữ nguyên HTML, mọi wrapper và thứ tự CSS của entry đang phát.
   const html=(await readFile(resolve(root,'progress-log/teacher.html'),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   res.setHeader('content-type','text/html; charset=utf-8');return res.end(html);
  }
  if(path==='/progress-log/demo/thuy.html'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<h1>Đích xem thử giả</h1>');}
  const file=resolve(root,'.'+path);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');
  res.setHeader('content-type',{'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'text/plain');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);page.on('dialog',d=>d.accept());
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.goto(origin+'/progress-log/fixture.html');
 await page.evaluate(async()=>{
  document.body.className='thuy-live thuy-teacher';
  const elements=Object.fromEntries([...document.querySelectorAll('[id]')].map(n=>[n.id,n]));
  const {mountThuyTeacherLayout}=await import('/progress-log/thuy-live/teacher-view.js');
  mountThuyTeacherLayout(elements,{onMode(){},onClass(){},onHome(){}}).setPanel('create');
  elements.teacherWorkspace.hidden=false;elements.createPanel.hidden=false;elements.dashboardPanel.hidden=true;elements.overviewPanel.hidden=true;
  elements.teacherNotice.textContent='Sẵn sàng.';elements.teacherNotice.setAttribute('data-idle','');elements.teacherName.textContent='Giảng viên mẫu';
  const {createFormDraftEditor}=await import('/progress-log/teacher-form-editor.js');
  window.calls=[];window.savedDraft=null;window.hold=false;window.failNext=false;window.publications=[];
  const request=async(path,options={})=>{
   const body=structuredClone(options.body);window.calls.push({path,method:options.method||'GET',body});
   if(path.startsWith('/teacher/form-library?'))return {entries:[]};
   if(path==='/teacher/form-publications')return {publications:window.publications};
   if(path.startsWith('/teacher/form-drafts/review-queue'))return {drafts:[]};
   if(path.startsWith('/teacher/form-drafts?'))return {drafts:window.savedDraft?[structuredClone(window.savedDraft)]:[]};
   if(path==='/teacher/form-drafts'&&options.method==='POST'){
    if(window.failNext){window.failNext=false;throw Error('Không lưu được do mất kết nối');}
    window.savedDraft={...body,id:'draft-the16',status:'draft',revision:1,contentHash:'hash-1'};return {draft:structuredClone(window.savedDraft)};
   }
   if(path==='/teacher/form-drafts/draft-the16'){
    if(options.method==='PUT'){
     if(window.hold)await new Promise((done,reject)=>{window.releaseSave=()=>{window.hold=false;done();};options.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
     if(window.failNext){window.failNext=false;throw Error('Không lưu được do mất kết nối');}
     if(window.conflictNext){window.conflictNext=false;window.savedDraft.revision++;window.savedDraft.definition.title='Bản trên máy chủ';const error=Error('Máy chủ có bản mới');error.status=409;throw error;}
     window.savedDraft={...window.savedDraft,...body,revision:window.savedDraft.revision+1,contentHash:'hash-'+(window.savedDraft.revision+1)};
    }return {draft:structuredClone(window.savedDraft)};
   }
   if(path.endsWith('/preview-grant'))return {grant:'fixture-only-demo-grant'};
   if(path.endsWith('/approve')){window.savedDraft.status='approved';return {draft:structuredClone(window.savedDraft)};}
   if(path.endsWith('/publish-library')){window.savedDraft.status='published';const publication={id:'publication-the16',draftId:'draft-the16',revision:window.savedDraft.revision};window.publications.push(publication);return {publication};}
   throw Error('Ngoài fixture: '+path);
  };
  window.editor=createFormDraftEditor({host:document.querySelector('#formDraftEditor'),apiRequest:request,libraryEnabled:true});
  window.editor.setWorkspace({classes:[{class_id:'1294',class_name:'Lớp giả'}],assignments:[],classId:'1294',sessionNumber:3});
 });
 await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();
 t.after(async()=>{assert.deepEqual(errors,[]);await browser.close();await new Promise(done=>server.close(done));});
 return {page,context};
}

test('T16 R01 R05: cả ba nút đưa lỗi kỹ năng đến đúng câu và phục hồi thao tác sau sửa',{timeout:60000},async t=>{
 const {page,context}=await fixture(t);
 await page.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();
 for(const name of ['Xem trước','Lưu nháp','Xuất bản']){
  await page.getByRole('button',{name,exact:true}).click();
  const skill=page.getByLabel('Kỹ năng câu 1',{exact:true});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Kỹ năng câu 1');
  assert.equal(await skill.getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('[data-question] .thuy-skill-error:visible').count(),1);
  assert.equal(await page.getByRole('button',{name:'Thử lưu lại',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.calls.some(c=>c.method==='POST'&&c.path==='/teacher/form-drafts')),false);
 }
 await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('general');
 await page.getByLabel('Tên bài tập',{exact:true}).fill('Phiếu giả Thẻ 16');
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
 const popup=context.waitForEvent('page');await page.getByRole('button',{name:'Xem trước',exact:true}).click();const preview=await popup;await preview.waitForURL('**/demo/thuy.html#grant=fixture-only-demo-grant');await preview.close();
 await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Nội dung trước lỗi lưu từ Xem trước');await page.evaluate(()=>{window.failNext=true;});
 const failedPopup=context.waitForEvent('page');await page.getByRole('button',{name:'Xem trước',exact:true}).click();const failedPreview=await failedPopup;
 await page.getByRole('button',{name:'Thử lưu lại',exact:true}).waitFor();assert.equal(failedPreview.isClosed(),true);
 await page.getByRole('button',{name:'Thử lưu lại',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
 await page.getByRole('button',{name:'Xuất bản',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã xuất bản vào kho'}).waitFor();
 assert.equal(await page.evaluate(()=>window.publications.length),1);
 assert.equal(await page.evaluate(()=>window.calls.some(c=>/assign/.test(c.path))),false);
});

test('T16 R01: nút và vùng đọc sống qua ba nhịp tự lưu, lỗi lưu và thử lại',{timeout:60000},async t=>{
 const {page}=await fixture(t);
 await page.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('general');
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
 await page.evaluate(()=>{window.originalSave=[...document.querySelectorAll('button')].find(n=>n.textContent==='Lưu nháp');window.originalQuestion=document.querySelector('[aria-label="Nội dung câu hỏi"]');});
 for(let i=1;i<=3;i++){
  await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Nội dung qua nhịp '+i);
  await page.waitForFunction(text=>window.savedDraft.definition.blocks[0].items[0].prompt===text,'Nội dung qua nhịp '+i);
  assert.equal(await page.evaluate(()=>document.activeElement===window.originalQuestion&&document.contains(window.originalSave)),true);
  assert.equal(await page.getByRole('button',{name:'Lưu nháp',exact:true}).isEnabled(),true);
 }
 await page.evaluate(()=>{window.hold=true;delete window.releaseSave;});await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Bản đang gửi nền');
 await page.waitForFunction(()=>typeof window.releaseSave==='function');
 assert.equal(await page.getByRole('button',{name:'Lưu nháp',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).focus();
 assert.equal(await page.evaluate(()=>document.activeElement===window.originalSave),true);
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
 await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Bản mới nhất khi chờ tự lưu');await page.evaluate(()=>window.releaseSave());
 await page.waitForFunction(()=>window.savedDraft.definition.blocks[0].items[0].prompt==='Bản mới nhất khi chờ tự lưu');
 await page.evaluate(()=>{window.failNext=true;});await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Nội dung không được mất khi lưu lỗi');
 await page.getByRole('button',{name:'Thử lưu lại',exact:true}).waitFor();await page.getByRole('button',{name:'Thử lưu lại',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
 assert.equal(await page.evaluate(()=>window.savedDraft.definition.blocks[0].items[0].prompt),'Nội dung không được mất khi lưu lỗi');
 await page.evaluate(()=>{window.hold=true;});await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Thao tác quá lâu'}).waitFor({timeout:30000});
 assert.equal(await page.getByRole('button',{name:'Lưu nháp',exact:true}).isEnabled(),true);
 await page.evaluate(()=>{window.hold=false;});await page.getByRole('button',{name:'Thử lưu lại',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
});

test('T16 R01 R04: rời màn trong lúc tự lưu không gắn phản hồi cũ vào nháp mới',{timeout:30000},async t=>{
 const {page}=await fixture(t);await page.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('general');
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
 await page.evaluate(()=>{window.hold=true;});await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Bản cũ đang tự lưu');await page.waitForFunction(()=>typeof window.releaseSave==='function');
 await page.getByRole('button',{name:'Quay lại Quản lý bài tập',exact:true}).click();await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();
 await page.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('general');
 await page.getByLabel('Tên bài tập',{exact:true}).fill('Nháp mới phải có định danh riêng');await page.evaluate(()=>window.releaseSave());
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.path==='/teacher/form-drafts'&&c.method==='POST').length),2);
});

test('T16 R01: xung đột giữ bản đang sửa và cho đối chiếu trước khi ghi tiếp',{timeout:30000},async t=>{
 const {page}=await fixture(t);await page.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('general');
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
 await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Nội dung riêng chưa được ghi đè');await page.evaluate(()=>{window.conflictNext=true;});
 await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.getByText('Đối chiếu bản mới trên máy chủ',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Nội dung câu hỏi',{exact:true}).inputValue(),'Nội dung riêng chưa được ghi đè');
 await page.getByRole('button',{name:'Giữ phần đang soạn và lưu trên bản mới',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();
 assert.equal(await page.evaluate(()=>window.savedDraft.definition.blocks[0].items[0].prompt),'Nội dung riêng chưa được ghi đè');
});

test('T16 R02 R04 R06: thanh tiêu đề ghim, icon đúng ô, màn hẹp và focus khi thêm đáp án',{timeout:60000},async t=>{
 const {page}=await fixture(t);await mkdir(evidence,{recursive:true});
 assert.equal(await page.locator('#teacherNotice').isVisible(),false);
 await page.evaluate(()=>{document.querySelector('#createPanel').hidden=true;});assert.equal(await page.locator('#teacherNotice').isVisible(),true);
 await page.evaluate(()=>{document.querySelector('#createPanel').hidden=false;});
 await page.getByRole('button',{name:'+ Điền từ',exact:true}).click();await page.getByLabel('Kỹ năng câu 1',{exact:true}).selectOption('general');
 const q=page.locator('[data-question]').first(),content=q.getByRole('textbox',{name:'Nội dung câu hỏi',exact:true});await content.fill('Đây là nội dung mẫu để tạo ô trống.');
 await q.locator('.thuy-gap-segment').first().evaluate(n=>{const range=document.createRange();range.setStart(n.firstChild,0);range.setEnd(n.firstChild,3);const s=getSelection();s.removeAllRanges();s.addRange(range);});
 await q.getByRole('button',{name:'Tạo chỗ trống câu 1',exact:true}).click();
 const add=q.getByRole('button',{name:'Thêm đáp án cho ô 1 câu 1',exact:true});assert.equal(await add.innerText(),'+');
 assert.deepEqual(await add.evaluate(n=>{const s=getComputedStyle(n);return [s.color,s.backgroundColor,s.borderTopColor];}),['rgb(21, 43, 78)','rgb(237, 241, 247)','rgb(21, 43, 78)']);await add.click();
 assert.equal(await q.getByLabel('Đáp án 2 ô 1 câu 1',{exact:true}).evaluate(n=>n===document.activeElement),true);
 const remove=q.getByRole('button',{name:'Bỏ đáp án 2 ô 1 câu 1',exact:true});assert.equal(await remove.locator('svg[aria-hidden="true"]').count(),1);
 assert.equal(await remove.evaluate(n=>getComputedStyle(n).color),'rgb(155, 10, 34)');
 for(const width of [1440,390]){await page.setViewportSize({width,height:760});await page.mouse.move(0,0);await q.locator('.thuy-answer-group').first().screenshot({path:resolve(evidence,'answer-buttons-'+width+'.png')});}
 await page.setViewportSize({width:1440,height:950});await remove.click();
 assert.equal(await q.locator('[data-answer-row]').count(),1);
 await q.getByRole('button',{name:'Bỏ ô trống 1 câu 1',exact:true}).press('Space');assert.equal(await q.locator('.thuy-gap-chip').count(),0);
 assert.equal(await content.evaluate(n=>n===document.activeElement),true);await content.press('Control+z');assert.equal(await q.locator('.thuy-gap-chip').count(),1);
 for(let i=0;i<8;i++)await page.getByRole('button',{name:'+ Trả lời mở',exact:true}).click();
 const measurements=[];
 for(const width of [1440,1024,768,390,360]){
  await page.setViewportSize({width,height:760});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  const gap=await page.locator('.thuy-editor-titlebar').evaluate(n=>n.getBoundingClientRect().top-document.querySelector('.teacher-header').getBoundingClientRect().bottom);
  assert.ok(gap>=-1&&gap<=8,`Khoảng trống trên tiêu đề ở ${width}px: ${gap}px`);
  await page.evaluate(()=>scrollTo({top:900,behavior:'instant'}));
  const result=await page.locator('.thuy-editor-titlebar').evaluate(n=>{const r=n.getBoundingClientRect(),header=document.querySelector('.teacher-header').getBoundingClientRect();return {top:r.top,bottom:r.bottom,headerBottom:header.bottom,width:r.width,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...n.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {name:b.getAttribute('aria-label')||b.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};})};});
  assert.ok(result.top>=result.headerBottom-1&&result.top<result.headerBottom+4,JSON.stringify({width,...result}));assert.equal(result.overflow,false);
  assert.equal(result.buttons.length,4);assert.ok(result.buttons.every(b=>b.left>=0&&b.right<=width&&b.top>=result.top&&b.bottom<=result.bottom));
  const middleTop=result.top;await page.evaluate(()=>scrollTo({top:2200,behavior:'instant'}));
  const deepTop=await page.locator('.thuy-editor-titlebar').evaluate(n=>n.getBoundingClientRect().top);assert.ok(Math.abs(deepTop-middleTop)<=1,'Tiêu đề phải giữ vị trí qua nhiều mức cuộn');
  measurements.push({viewportWidth:width,gapAbove:gap,deepTop,...result});await page.screenshot({path:resolve(evidence,'toolbar-'+width+'.png')});
 }
 await writeFile(resolve(evidence,'toolbar-measurements.json'),JSON.stringify(measurements,null,2));
 await page.evaluate(()=>window.editor.openDraft({...window.editor.getPayload(),id:'readonly-draft',revision:1,status:'published'}));
 assert.equal(await page.getByRole('button',{name:'Lưu nháp',exact:true}).isEnabled(),false);assert.equal(await page.getByRole('button',{name:'Xuất bản',exact:true}).isEnabled(),false);
 assert.equal(await page.locator('.thuy-answer-icon').count(),0);assert.equal(await page.getByRole('button',{name:'Quay lại Quản lý bài tập',exact:true}).isEnabled(),true);
});
