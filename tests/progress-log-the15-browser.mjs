// Bộ soạn thật, API nháp giả có trạng thái; chặn mọi mạng ngoài fixture.
import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
test('T15: mode từng câu, placeholder, popup vùng chọn, chữ gốc, đáp án riêng và tự lưu giữ vùng đọc',{timeout:90000},async()=>{
 const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/fixture'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/progress-log/styles.css"><link rel="stylesheet" href="/progress-log/teacher.css"><link rel="stylesheet" href="/progress-log/thuy-live/styles.css"><link rel="stylesheet" href="/progress-log/thuy-live/revisions.css"><body class="thuy-live thuy-teacher"><main id="formDraftEditor"></main>');}
  const file=resolve(root,'.'+path);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',{'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'text/plain');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);page.on('dialog',d=>d.accept());await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 try{
  await page.goto(origin+'/fixture');await page.evaluate(async()=>{
   const {createFormDraftEditor}=await import('/progress-log/teacher-form-editor.js');window.savedDraft=null;window.calls=[];
   const request=async(path,options={})=>{const body=structuredClone(options.body);window.calls.push({path,...options,body});
    if(path.startsWith('/teacher/form-library?'))return {entries:[]};if(path==='/teacher/form-publications')return {publications:[]};
    if(path.startsWith('/teacher/form-drafts/review-queue'))return {drafts:[]};if(path.startsWith('/teacher/form-drafts?'))return {drafts:[]};
    if(path==='/teacher/form-drafts'&&options.method==='POST'){window.savedDraft={...body,id:'draft-a',revision:1,status:'draft'};return {draft:structuredClone(window.savedDraft)};}
    if(path==='/teacher/form-drafts/draft-a'){if(options.method==='PUT')window.savedDraft={...window.savedDraft,...body,revision:window.savedDraft.revision+1};return {draft:structuredClone(window.savedDraft)};}
    throw Error('Ngoài fixture: '+path);
   };window.editor=createFormDraftEditor({host:document.querySelector('#formDraftEditor'),apiRequest:request,libraryEnabled:true});window.editor.setWorkspace({classes:[{class_id:'1294',class_name:'Lớp giả'}],assignments:[],classId:'1294',sessionNumber:3});
  });
  await page.getByRole('button',{name:'+ Tạo bài tập',exact:true}).click();await page.getByLabel('Tên bài tập',{exact:true}).fill('Thẻ 15 · Phiếu dữ liệu giả');
  await page.getByRole('button',{name:'+ Trắc nghiệm',exact:true}).click();await page.getByRole('button',{name:'+ Điền từ',exact:true}).click();
  for(const n of [1,2])await page.getByLabel('Kỹ năng câu '+n,{exact:true}).selectOption('general');
  const q1=page.locator('[data-question]').nth(0),q2=page.locator('[data-question]').nth(1);
  const option=q1.getByLabel('Lựa chọn A câu 1',{exact:true});assert.equal(await option.inputValue(),'');assert.equal(await option.getAttribute('placeholder'),'Phương án 1');await option.focus();assert.equal(await option.evaluate(e=>getComputedStyle(e,'::placeholder').color),'rgba(0, 0, 0, 0)');
  await option.fill('Ý một');await q1.getByLabel('Lựa chọn B câu 1').fill('Ý hai');await q1.getByLabel('Lựa chọn C câu 1').fill('Ý ba');await q1.getByLabel('Lựa chọn D câu 1').fill('Ý bốn');await q1.getByLabel('Đáp án đúng A câu 1').check();
  await q2.getByRole('button',{name:'Khảo sát',exact:true}).click();assert.equal(await q1.getByRole('button',{name:'Bài tập',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await q2.getByRole('button',{name:'Khảo sát',exact:true}).getAttribute('aria-pressed'),'true');
  const content=q2.getByRole('textbox',{name:'Nội dung câu hỏi',exact:true}),source='moment and moment 🙂\nDòng chữ tiếng Việt';await content.fill(source);
  const select=async(start,end,part=0)=>{await q2.locator('.thuy-gap-segment').nth(part).evaluate((segment,{start,end})=>{const node=segment.firstChild,range=document.createRange();range.setStart(node,start);range.setEnd(node,end);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);},{start,end});};
  await select(11,17);const popup=q2.getByRole('button',{name:'Tạo chỗ trống câu 2',exact:true});await popup.waitFor({state:'visible'});const rect=await popup.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=1440);await popup.click();
  assert.equal(await q2.locator('.thuy-gap-text').count(),1);assert.equal(await q2.locator('.thuy-gap-chip').count(),1);const originalId=await q2.locator('.thuy-gap-chip').getAttribute('data-blank-id');
  await q2.getByRole('button',{name:'Thêm đáp án',exact:true}).click();const fields=q2.locator('[data-answer-row]');await fields.nth(1).fill('  ');await content.click();assert.equal(await q2.locator('.thuy-answer-error:visible').count(),1);
  await page.getByRole('button',{name:'Xem trước',exact:true}).click();await page.getByRole('status').filter({hasText:'hãy nhập đáp án'}).waitFor();assert.equal(await page.evaluate(()=>window.calls.some(c=>c.path.endsWith('/preview-grant'))),false);
  await page.waitForFunction(()=>window.savedDraft?.gradingKey.authoringState&&Object.values(window.savedDraft.gradingKey.authoringState).some(s=>Object.values(s.answerRows||{}).flat().some(row=>row.value==='  ')));
  await page.getByRole('button',{name:'Lưu nháp',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu nháp'}).waitFor();assert.equal(await q2.locator('.thuy-answer-error:visible').count(),1);
  await fields.nth(0).fill('instant');await fields.nth(1).fill('moment');
  await content.evaluate(e=>e.dispatchEvent(new InputEvent('beforeinput',{inputType:'historyUndo',bubbles:true,cancelable:true})));assert.equal(await fields.nth(1).inputValue(),'  ');await content.evaluate(e=>e.dispatchEvent(new InputEvent('beforeinput',{inputType:'historyRedo',bubbles:true,cancelable:true})));assert.equal(await fields.nth(1).inputValue(),'moment');
  await select(0,6);await popup.click();assert.equal(await q2.locator('.thuy-gap-chip').count(),2);assert.equal(await q2.locator('.thuy-gap-chip').nth(1).getAttribute('data-blank-id'),originalId);assert.equal(await q2.getByLabel('Đáp án 1 ô 2 câu 2',{exact:true}).inputValue(),'instant');
  const gapEvidence=process.env.PROGRESS_LOG_QA_DIR||'E:/Codex-Data/progress-thuy-the15-20261028/qa';await mkdir(gapEvidence,{recursive:true});await q2.screenshot({path:resolve(gapEvidence,'editor-gap-answers.png')});
  await q2.getByRole('button',{name:'Bỏ ô trống 1 câu 2',exact:true}).click();await content.focus();await page.keyboard.press('Control+z');assert.equal(await q2.locator('.thuy-gap-chip').count(),2);await page.keyboard.press('Control+y');assert.equal(await q2.locator('.thuy-gap-chip').count(),1);
  await q2.getByRole('button',{name:'Bỏ ô trống 1 câu 2',exact:true}).click();assert.equal(await content.innerText(),source);assert.equal(await q2.locator('.thuy-gap-chip').count(),0);
  // Chuyển từng câu qua lại giữ khóa đúng; không phục hồi khóa sau khi cấu trúc ô đổi.
  await q1.getByRole('button',{name:'Khảo sát',exact:true}).click();await q1.getByRole('button',{name:'Bài tập',exact:true}).click();assert.equal(await q1.getByLabel('Đáp án đúng A câu 1').isChecked(),true);
  const current=page.locator('[data-question]').nth(1).getByRole('textbox',{name:'Nội dung câu hỏi',exact:true});await current.evaluate(e=>window.readingNode=e);
  for(let i=1;i<=3;i++){await current.fill(source+' '+i);await page.waitForFunction(value=>window.savedDraft?.definition.blocks[0].items[1].prompt===value,source+' '+i);assert.equal(await current.evaluate(e=>e===window.readingNode&&e===document.activeElement),true);}
  const output=process.env.PROGRESS_LOG_QA_DIR||'E:/Codex-Data/progress-thuy-the15-20261028/qa';await mkdir(output,{recursive:true});await page.screenshot({path:resolve(output,'editor-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await current.scrollIntoViewIfNeeded();await current.fill('Xin chào tiếng Việt');await select(4,8);await popup.waitFor({state:'visible'});const mobile=await popup.boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(output,'editor-mobile.png'),fullPage:true});
  const mixed=await page.evaluate(async()=>{
   const {partFeedback}=await import('/progress-log/thuy-live/part-feedback.js'),{reviewItems}=await import('/progress-log/answer-review.js');
   const base={position:1,prompt:'Câu giả',options:[],layoutType:'numbered_short_texts',interactionConfig:{responseCount:1}},block={kind:'survey',items:[{...base,itemVersionId:'e',kind:'exercise'},{...base,position:2,itemVersionId:'s',kind:'survey'}]},items=[{itemVersionId:'e',maxScore:1,verdict:'correct',rawAnswer:['bài làm riêng'],expectedAnswer:['SECRET']},{itemVersionId:'s',maxScore:0,verdict:'ungraded',rawAnswer:['ý riêng'],referenceSlots:[{slot:0,rawAnswer:'ý riêng',expectedAnswer:['tham khảo một','<tham khảo hai>']}]}];
   const feedback=partFeedback(block,{answerRelease:'hidden',items}),detail={definition:{blocks:[block]},responses:{e:['bài làm riêng'],s:['ý riêng']},submissionId:'fake',gradingItems:items},host=document.createElement('section');host.innerHTML=reviewItems(detail);document.body.append(feedback,host);
   return {feedback:feedback.textContent,survey:host.querySelector('[data-review-item="s"]').textContent,scripts:host.querySelectorAll('script').length};
  });assert.match(mixed.feedback,/tham khảo một \/ <tham khảo hai>/);assert.match(mixed.feedback,/bài làm riêng/);assert.doesNotMatch(mixed.feedback,/SECRET|✓ Đúng|✕ Sai|đã chấm/);assert.match(mixed.survey,/Không chấm đúng\/sai/);assert.doesNotMatch(mixed.survey,/✓ Đúng|✕ Sai/);assert.equal(mixed.scripts,0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(done=>server.close(done));}
});
