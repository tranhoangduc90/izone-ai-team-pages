// Renderer native ở ba viewport; API/AI/Docs giả, chặn toàn bộ kết nối ngoài localhost.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.env.READING_HEADINGS_EVIDENCE_DIR;
if(!out)throw Error('EVIDENCE_DIR_REQUIRED');await fs.mkdir(out,{recursive:true});
const letters=['C','D','E','F','G'];
const content={type:'matching_headings',code:'67-reading-the-desolenator',version:'synthetic-v1',title:'The Desolenator: producing clean water',practice:{title:'Luyện nén thông tin cấp 1 với ChatGPT',url:'https://ducizone.short.gy/reading_skimming_lv1'},instruction:'Tự đọc và nén trước khi tra từ.',examples:{headings:{A:'iii',B:'vi'},l1:'Nội dung nén mẫu giả đoạn A.',l2:'Ý đầu → ý tiếp theo'},paragraphs:[...'ABCDEFG'].map(id=>({id,text:('Đây là đoạn '+id+' giả để kiểm giao diện và bảo toàn vị trí đang đọc. ').repeat(12)})),headings:['i','ii','iii','iv','v','vi','vii','viii','ix','x'].map((id,i)=>({id,text:'Heading giả số '+(i+1)})),questions:letters.map((paragraph,i)=>({number:i+1,paragraph,text:'Paragraph '+paragraph,targets:{section:'L3.H.'+paragraph,l1:'L3.L1.'+paragraph,l2:'L3.L2.'+paragraph}})),blankValues:[],dropdownPlaceholders:[],minimumRequired:12};
content.targets=content.questions.flatMap(q=>Object.entries(q.targets).map(([kind,id])=>({id,kind,paragraph:q.paragraph,question:q.number,label:kind+' '+q.paragraph})));
const answers=Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='section'?'ii':'Bản nén giả học viên tự viết '+t.id]));
const attempt={attemptId:'fixture-attempt',runNo:1,status:'done',draftRevision:2,createdAt:'2026-10-29T00:00:00Z',completeness:{filled_cells:15,expected_cells:15,minimum_required:12},snapshot:{answers,annotations:[],notes:'Ghi chú giả',flags:[5]},result:{feedback:Object.fromEntries(content.targets.map((t,i)=>[t.id,{status:i?'correct':'partial',reason:i?'Nhận xét giả đúng.':'Nhận xét giả: cần giữ ý cốt lõi.',modelAnswer:'Nội dung giả để đối chiếu.',nextStep:'Lần sau, giữ đủ ý chính.'}]))}};
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true});const records=[];
try{
 for(const width of [1440,390,320])for(const mode of ['draft','result','teacher','waiting']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==site.origin){external.push(url.origin);return route.abort();}
   if(url.pathname.endsWith('/api-config.js'))return route.fulfill({contentType:'text/javascript',body:''});
   if(url.pathname.endsWith('/web-client.js'))return route.fulfill({contentType:'text/javascript',body:`(()=>{const content=${JSON.stringify(content)},sample=${JSON.stringify(attempt)},teacher=${mode==='teacher'},mode=${JSON.stringify(mode)};const identity={ownerId:'fixture-owner',courseId:'1293',name:'Học viên thử',className:'LỚP THỬ'};let practiceReads=0;window.fixture={practiceReads:0,pollReads:0};window.ReadingServerClient={identity,access:{config:{demo:true}},initialHistory:{attempts:mode==='draft'?[]:[sample]},revision:2,runNo:1,state:{status:'saved',completeness:{filled_cells:15}},initialize:async()=>({content,identity,draft:{body:sample.snapshot,savedAt:sample.createdAt},config:{demo:true},history:mode==='draft'?[]:[{...sample,status:mode==='waiting'?'queued':'done'}],teacher}),getAttempt:async()=>({...sample,status:mode==='waiting'?'queued':'done'}),getHistory:async()=>[],historyDetail:async()=>({attempts:[sample],archives:[]}),schedule(){return true;},flush:async()=>{},practice:async()=>{window.fixture.practiceReads++;return{url:'https://chatgpt.com/share/11111111-1111-4111-8111-111111111111',status:mode==='draft'?'processing':'accepted',message:mode==='draft'?'Đang kiểm tra link giả.':'Đã công nhận · dữ liệu giả'};},savePractice:async body=>({url:body.url,status:'queued',message:'Đã lưu link giả'}),poll(id,update){setInterval(()=>{window.fixture.pollReads++;update({...sample,status:'queued'});},1500);},stopPoll(){}};})();`});
   return route.continue();
  });
  try{
   await page.goto(site.origin+'/reading-skills67/the-desolenator/?server=1'+(mode==='result'||mode==='teacher'?'&attemptId=fixture-attempt':''));
   await page.waitForSelector('.share-practice');await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('[data-target]').count(),15);assert.equal(await page.locator('select[data-target]').count(),5);assert.equal(await page.locator('textarea[data-target]').count(),10);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width>800)assert.ok(await page.locator('.study-grid').evaluate(el=>el.getBoundingClientRect().height)>=540);
   if(width<=800)await page.locator('[data-pane="questions"]').click();
   const bank=await page.locator('.headings-bank').boundingBox(),question=await page.locator('.headings-work .question-block').first().boundingBox();assert(bank.x>question.x+question.width-1,'Options stays to the right');
   const font=await page.locator('textarea[data-target]').first().evaluate(el=>getComputedStyle(el).fontSize);assert.equal(font,'18px');
   if(mode==='draft'){
    await page.locator('#practice-share').fill('https://chatgpt.com/share/22222222-2222-4222-8222-222222222222');
    await page.locator('textarea[data-target]').first().fill('Tôi đang sửa bản nén và giữ vị trí đọc.');
    if(width===1440){
     await page.evaluate(()=>{window.fixture.pane=document.querySelector('#scroll-questions');window.fixture.input=document.querySelector('textarea[data-target]');window.fixture.input.focus();window.fixture.input.setSelectionRange(3,10);window.fixture.pane.scrollTop=140;});
     await page.waitForFunction(()=>window.fixture.practiceReads>=4,{timeout:18000});
     const observation=await page.evaluate(()=>({same:window.fixture.pane===document.querySelector('#scroll-questions'),focus:document.activeElement===window.fixture.input,selection:window.fixture.input.selectionStart,scroll:window.fixture.pane.scrollTop,url:document.querySelector('#practice-share').value}));
     assert.equal(observation.same,true);assert.equal(observation.focus,true);assert.equal(observation.selection,3);assert.equal(observation.scroll,140);assert(observation.url.includes('22222222'));
    }
   }
   if(mode==='waiting'&&width===1440){await page.evaluate(()=>{window.fixture.pane=document.querySelector('#scroll-passage');window.fixture.pane.scrollTop=120;});await page.waitForFunction(()=>window.fixture.pollReads>=3);assert.equal(await page.evaluate(()=>window.fixture.pane===document.querySelector('#scroll-passage')&&window.fixture.pane.scrollTop===120),true);}
   if(mode==='result'||mode==='teacher'){
    assert.equal(await page.locator('[data-target]').evaluateAll(elements=>elements.every(el=>el.tagName==='SELECT'?el.disabled:el.readOnly)),true);
    await page.locator('[data-explain]').first().click();await page.waitForSelector('#explanation-dialog[open]');assert((await page.locator('#explanation-dialog').innerText()).includes('Bài bạn đã gửi'));await page.locator('[data-close-explanation]').click();
    if(mode==='result'){await page.locator('[data-action="repair-start"]').click();assert.equal(await page.locator('#pane-questions').isVisible(),true);assert.equal(await page.locator('[data-target="L3.H.C"]').isVisible(),true);}
   }
   if(mode==='teacher'){assert.equal(await page.locator('#practice-share').getAttribute('readonly'),'');assert.equal(await page.locator('#practice-check').isVisible(),false);assert.equal(await page.locator('#grade-button').count(),0);}
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   await page.screenshot({path:resolve(out,mode+'-'+width+'.png'),fullPage:false});
   records.push({mode,width,status:'passed',font,fields:15});
  }catch(error){await page.screenshot({path:resolve(out,'FAIL-'+mode+'-'+width+'.png'),fullPage:false});records.push({mode,width,status:'failed',error:error.message,errors,external});}
  finally{await context.close();}
 }
}finally{await browser.close();await site.close();}
await fs.writeFile(resolve(out,'results.json'),JSON.stringify(records,null,2));console.log(JSON.stringify({cases:records.length,failed:records.filter(r=>r.status==='failed')}));if(records.some(r=>r.status==='failed'))process.exitCode=1;
