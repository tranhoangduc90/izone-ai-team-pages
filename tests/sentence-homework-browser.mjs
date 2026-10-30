// Entry/renderer thật, client giả cách ly; không có request ghi hoặc AI/Google thật.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),dir=process.env.READING_SENTENCE_PRIVATE_DIR,out=process.env.READING_SENTENCE_UI_OUT||dir+'/ui';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const content=JSON.parse(await fs.readFile(dir+'/content.private.json','utf8'));
await fs.mkdir(out,{recursive:true});
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{
 for(const [width,height] of [[1440,1000],[1024,768],[390,844],[320,568],[844,390]])for(const scenario of ['draft','waiting','review','teacher']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
  const answers=Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='location'?'B':t.kind==='answer'?'fixture':'Nội dung giả để kiểm hành trình Reading Homework.']));answers['l6.sc.q20.polarity.diagnostic']='Tự kiểm giả';
  const feedback=Object.fromEntries(content.targets.map((t,i)=>[t.id,{status:i%4===0?'partial':'correct',reason:'Nhận xét giả: còn thiếu một mối liên hệ trong thông tin.',nextStep:i%4===0?'Lần sau, hãy nêu rõ quan hệ giữa các thông tin được chọn.':'',modelAnswer:'Lời giải giả chỉ dùng để kiểm giao diện.'}]));
  const progress={kind:'sentence_completion',matchingCorrect:3,matchingTotal:4,analysisCorrect:15,analysisTotal:20,paragraphCorrect:3,paragraphTotal:4,compressionCorrect:18,compressionTotal:24,total:28,remainingCount:7,needsRepair:content.targets.filter((t,i)=>i%4===0).map(t=>t.id),allCorrect:false};
  const attempt={attemptId:'11111111-1111-4111-8111-111111111119',runNo:1,draftRevision:1,createdAt:'2026-10-30T08:00:00Z',status:scenario==='waiting'?'queued':'done',snapshot:{answers,annotations:[],flags:[22],notes:''},completeness:{filled_cells:28,expected_cells:28},result:scenario==='waiting'?null:{feedback},progress};
  const stub=`(()=>{const content=${JSON.stringify(content)},attempt=${JSON.stringify(attempt)},identity={ownerId:'synthetic-owner',courseId:'synthetic-class',name:'Học viên giả có họ và tên rất dài để kiểm xuống dòng',className:'LOP-THU'};let callback,timer;window.__polls=0;window.__attempt=attempt;const client=window.ReadingServerClient={identity,access:{config:{demo:true}},initialHistory:{attempts:${scenario==='draft'?'[]':'[attempt]'}},state:{status:'saved',savedAt:attempt.createdAt},initialize:async()=>({content,identity,draft:{body:JSON.parse(sessionStorage.getItem('sentence-ui-draft')||'null')||attempt.snapshot,revision:2,savedAt:attempt.createdAt},config:{demo:true},teacher:${scenario==='teacher'},history:${scenario==='draft'?'[]':'[attempt]'},restored:false}),get revision(){return 2},get runNo(){return 1},getAttempt:async()=>structuredClone(attempt),getDraft:async()=>({body:JSON.parse(sessionStorage.getItem('sentence-ui-draft')||'null')||attempt.snapshot,revision:2,savedAt:attempt.createdAt}),getHistory:async()=>[attempt],poll(_id,fn){callback=fn;clearInterval(timer);timer=setInterval(()=>{window.__polls++;fn(structuredClone(attempt));},1500)},stopPoll(){clearInterval(timer)},schedule(source){sessionStorage.setItem('sentence-ui-draft',JSON.stringify(source));window.__lastSaved=structuredClone(source);client.state.status='dirty';window.dispatchEvent(new CustomEvent('reading67:server-state'));return true},flush:async()=>{},historyDetail:async()=>({attempts:[attempt],archives:[]})};window.__changeStatus=status=>{attempt.status=status;if(status==='done')attempt.result={feedback:${JSON.stringify(feedback)}};callback?.(structuredClone(attempt));};})();`;
  await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==site.origin)return route.abort();if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}if(url.pathname.endsWith('/api-config.js'))return route.fulfill({body:'',contentType:'text/javascript'});if(url.pathname.endsWith('/web-client.js'))return route.fulfill({body:stub,contentType:'text/javascript'});return route.continue();});
  try{
   await page.goto(site.origin+'/reading-skills67/athletes-and-stress/?server=1'+(scenario==='draft'?'':'&attemptId='+attempt.attemptId));
   await page.waitForSelector('[data-target]',{state:'attached'});await page.evaluate(()=>document.fonts.ready);
   const facts=await page.evaluate(()=>({title:document.querySelector('h1')?.textContent,fields:document.querySelectorAll('[data-target]').length,questions:[...document.querySelectorAll('.question-block')].map(q=>Number(q.dataset.questionNumber)),paragraphs:document.querySelectorAll('.passage-block').length,compression:document.querySelectorAll('.sentence-compression [data-target]').length,banks:document.querySelectorAll('.cbt-option-bank,.headings-bank').length,overflow:document.documentElement.scrollWidth>innerWidth,passageFont:parseFloat(getComputedStyle(document.querySelector('.passage-text')).fontSize),inputFont:parseFloat(getComputedStyle(document.querySelector('.sentence-question input')).fontSize),readonly:[...document.querySelectorAll('[data-target]')].every(e=>e.tagName==='SELECT'?e.disabled:e.readOnly)}));
   assert.equal(facts.title,'Athletes and stress');assert.equal(facts.fields,29);assert.deepEqual(facts.questions,[19,20,21,22]);assert.equal(facts.paragraphs,6);assert.equal(facts.compression,4);assert.equal(facts.banks,0);assert.equal(facts.overflow,false);assert.equal(facts.passageFont,18);assert.equal(facts.inputFont,18);assert.equal(facts.readonly,scenario!=='draft');
   if(width<=800||height<500)await page.locator('#tab-questions').click();
   for(const q of content.questions){
    const question=page.locator('#question-'+q.number),answer=question.locator('.question-text [data-target="'+q.targets.answer+'"]');
    assert.equal(await answer.count(),1,'Sentence Completion phải có ô đáp án ngay tại chỗ trống trong câu '+q.number);
    assert.ok((await answer.boundingBox()).width<=205.1,'Ô đáp án phải gọn như mẫu R3');
    assert.ok((await question.locator('.sentence-completion-slot').boundingBox()).width<=273,'Số/ô/cờ phải gọn trong dòng câu, không chiếm một hàng riêng');
    assert.equal(await question.locator('.cbt-blank-number').count(),1,'Chỉ một số câu ở chỗ trống');
    assert.equal(await question.locator('.sentence-completion-slot [data-flag="'+q.number+'"]').count(),1,'Cờ đứng cạnh ô nhập');
    const groups=question.locator('.sentence-keyword-group');assert.equal(await groups.count(),2);
    for(const id of [q.targets.leader,q.targets.location,q.targets.leader_evidence])assert.equal(await groups.nth(0).locator('[data-target="'+id+'"]').count(),1,'Các mục keyword chính phải ở cùng cụm');
    for(const id of [q.targets.supporter,q.targets.supporter_evidence])assert.equal(await groups.nth(1).locator('[data-target="'+id+'"]').count(),1,'Các mục keyword phụ phải ở cùng cụm');
    const source=await question.locator('.question-text').evaluate(root=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest('button,input,select,textarea,.cbt-blank-number,.cbt-question-number')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let value='';while(walker.nextNode())value+=walker.currentNode.textContent;return value;});assert.equal(source,q.text,'Giữ nguyên offset/quote của Highlight/Note đã lưu');
   }
   const frame=await page.locator('.sentence-question').first().evaluate(el=>{const s=getComputedStyle(el);return {left:s.borderLeftWidth,top:s.borderTopWidth,bottom:s.borderBottomWidth,radius:s.borderRadius};});assert.deepEqual(frame,{left:'0px',top:'0px',bottom:'1px',radius:'0px'});
   await page.screenshot({path:out+'/questions-'+scenario+'-'+width+'.png'});
   if(scenario==='draft'){
    const input=page.locator('[data-target="l6.sc.q19.answer"]');await input.focus();
    const focus=await input.evaluate(el=>{const s=getComputedStyle(el);return {outline:s.outlineStyle,ring:s.boxShadow,border:s.borderColor};});assert.equal(focus.outline,'none');assert.match(focus.ring,/33, 86, 160|21, 43, 78/);assert.equal(focus.border,'rgb(21, 43, 78)');
    await page.locator('[data-font="10"]').click();assert.ok(Math.abs(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))-19.8)<.01);await page.locator('[data-font="-10"]').click();
    await input.fill('n/a');assert.match(await page.locator('#progress-label').innerText(),/27\/28/);
    await input.fill('studentword');await page.waitForFunction(()=>window.__lastSaved?.answers['l6.sc.q19.answer']==='studentword');
    const keyword=page.locator('[data-target="l6.sc.q19.leader"]'),oldKeyword=await keyword.inputValue();await keyword.fill('');assert.ok((await keyword.boundingBox()).height<60,'Keyword ngắn không bị ép textarea cao 80px');await keyword.fill(oldKeyword);
    await page.locator('[data-target="l6.sc.q19.location"]').selectOption('F');assert.equal(await page.evaluate(()=>window.__lastSaved.answers['l6.sc.q19.location']),'F');
    await page.locator('[data-flag="19"]').click();assert.equal(await page.locator('[data-flag="19"]').getAttribute('aria-pressed'),'true');
    await page.reload();await page.waitForSelector('[data-target]',{state:'attached'});if(width<=800||height<500)await page.locator('#tab-questions').click();assert.equal(await input.inputValue(),'studentword');assert.equal(await page.locator('[data-target="l6.sc.q19.location"]').inputValue(),'F');
   }
   if(scenario==='review'||scenario==='teacher'){
    await page.locator('[data-explain="l6.sc.q19.answer"]').click();await page.waitForSelector('#explanation-dialog[open]');assert.match(await page.locator('#explanation-dialog').innerText(),/Bài bạn đã gửi/);await page.keyboard.press('Escape');assert.equal(await page.locator('#explanation-dialog').evaluate(d=>d.open),false);
    if(scenario==='teacher'){assert.equal(await page.locator('#grade-button').count(),0);assert.equal(await page.locator('[data-action="edit"]').count(),0);}
    else{await page.locator('[data-action="edit"]').click();await page.waitForSelector('.repair-docked');assert.match(await page.locator('.repair-banner').innerText(),/Phân tích từ khóa/);assert.equal(await page.locator('[data-target="l6.sc.q19.answer"]').evaluate(el=>el.readOnly),false);}
   }
   if(scenario==='waiting'){
    await page.locator('[data-question="22"]').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{const node=document.querySelector('#question-22'),pane=document.querySelector('#scroll-questions'),input=node.querySelector('input');input.focus({preventScroll:true});input.setSelectionRange(0,3);window.__kept={node,pane,input,scroll:pane.scrollTop,y:scrollY};window.__pulseStart=window.__polls;});await page.waitForFunction(()=>window.__polls>=window.__pulseStart+3);
    assert.equal(await page.evaluate(()=>window.__kept.node===document.querySelector('#question-22')&&Math.abs(window.__kept.pane.scrollTop-window.__kept.scroll)<2&&Math.abs(scrollY-window.__kept.y)<2),true);
    assert.equal(await page.evaluate(()=>document.activeElement===window.__kept.input&&window.__kept.input.selectionStart===0&&window.__kept.input.selectionEnd===3),true,'Ba nhịp nền giữ focus và vùng chọn trong ô inline');
    await page.evaluate(()=>window.__changeStatus('processing'));assert.equal(await page.evaluate(()=>window.__kept.node===document.querySelector('#question-22')),true);
    await page.evaluate(()=>window.__changeStatus('done'));await page.waitForSelector('.result-note');
   }
   await page.screenshot({path:out+'/'+scenario+'-'+width+'.png'});assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);records.push({scenario,width,height,outcome:'passed',facts});
  }catch(error){records.push({scenario,width,height,outcome:'failed',error:error.stack});await page.screenshot({path:out+'/FAILED-'+scenario+'-'+width+'.png'});}finally{await context.close();}
 }
}finally{await browser.close();await site.close();}
await fs.writeFile(out+'/results.json',JSON.stringify({records,scope:'Actual entry/renderer with synthetic client; no real AI/Google or production writes.'},null,2));
console.log(JSON.stringify({total:records.length,passed:records.filter(r=>r.outcome==='passed').length,failures:records.filter(r=>r.outcome!=='passed').map(r=>({scenario:r.scenario,width:r.width,error:r.error}))}));
if(records.some(r=>r.outcome!=='passed'))process.exitCode=1;
