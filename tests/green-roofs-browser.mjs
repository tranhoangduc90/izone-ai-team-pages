// Renderer/entry thật + API fixture cách ly. Không đọc phiên, nộp bài hoặc gọi AI/Docs thật.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),privateDir=process.env.GREEN_ROOFS_PRIVATE_DIR,out=privateDir+'/ui';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const content=JSON.parse(await fs.readFile(privateDir+'/content.private.json','utf8'));
await fs.mkdir(out,{recursive:true});
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{
 for(const [width,height] of [[1440,1000],[390,844],[320,568]])for(const scenario of ['draft','waiting','review','teacher']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
  const answers=Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='choice'?'B':'Bản nén giả để kiểm giao diện: giữ bài làm và nhận xét đúng người.']));
  const feedback=Object.fromEntries(content.targets.map((t,i)=>[t.id,{status:i%4===0||t.id.endsWith('e.level_2')?'partial':'correct',reason:'Nhận xét giả để kiểm hành trình sửa bài.',nextStep:i%4===0?'Lần sau, hãy bổ sung ý còn thiếu trong phần nén này.':'',modelAnswer:'Lời giải giả chỉ dùng trong kiểm giao diện.',raw:{source_paragraphs:[t.paragraph||'C']}}]));
  const attempt={attemptId:'11111111-1111-4111-8111-111111111119',runNo:1,draftRevision:1,createdAt:'2026-10-29T06:00:00Z',status:scenario==='waiting'?'queued':'done',snapshot:{answers,annotations:[],flags:[],notes:''},completeness:{filled_cells:14,total_cells:14},result:scenario==='waiting'?null:{feedback}};
  const stub=`(()=>{const content=${JSON.stringify(content)},attempt=${JSON.stringify(attempt)},identity={ownerId:'synthetic-owner',courseId:'synthetic-class',name:'Học viên giả',className:'LOP-THU'};let callback,timer;window.__polls=0;window.__attempt=attempt;const client=window.ReadingServerClient={identity,access:{config:{demo:true}},initialHistory:{attempts:${scenario==='draft'?'[]':'[attempt]'}},state:{status:'saved',savedAt:attempt.createdAt,completeness:{filled_cells:14,total_cells:14}},initialize:async()=>({content,identity,draft:{body:attempt.snapshot,revision:2,savedAt:attempt.createdAt},config:{demo:true},teacher:${scenario==='teacher'},history:${scenario==='draft'?'[]':'[attempt]'},restored:false}),get revision(){return 2},getAttempt:async()=>structuredClone(attempt),getDraft:async()=>({body:attempt.snapshot,revision:2,savedAt:attempt.createdAt}),getHistory:async()=>({attempts:[attempt]}),poll(_id,fn){callback=fn;clearInterval(timer);timer=setInterval(()=>{window.__polls++;fn(structuredClone(attempt));},1500)},stopPoll(){clearInterval(timer)},schedule(source){window.__lastSaved=structuredClone(source);client.state.status='dirty';window.dispatchEvent(new CustomEvent('reading67:server-state'));return true},flush:async()=>{},historyDetail:async()=>({attempts:[attempt],archives:[]})};window.__changeStatus=status=>{attempt.status=status;if(status==='done')attempt.result={feedback:${JSON.stringify(feedback)}};callback?.(structuredClone(attempt));};})();`;
  await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==site.origin)return route.abort();if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}if(url.pathname.endsWith('/api-config.js'))return route.fulfill({body:'',contentType:'text/javascript'});if(url.pathname.endsWith('/web-client.js'))return route.fulfill({body:stub,contentType:'text/javascript'});return route.continue();});
  try{
   await page.goto(site.origin+'/reading-skills67/green-roofs/?server=1'+(scenario==='draft'?'':'&attemptId='+attempt.attemptId));
   await page.waitForSelector('[data-target]');await page.evaluate(()=>document.fonts.ready);
   const facts=await page.evaluate(()=>({title:document.querySelector('h1')?.textContent,fields:document.querySelectorAll('[data-target]').length,textareas:document.querySelectorAll('textarea[data-target]').length,selects:document.querySelectorAll('select[data-target]').length,overflow:document.documentElement.scrollWidth>innerWidth,passageFont:parseFloat(getComputedStyle(document.querySelector('.passage-text')).fontSize),bankFont:parseFloat(getComputedStyle(document.querySelector('.green-options-bank')).fontSize),banks:[...document.querySelectorAll('.green-choice-layout')].map(x=>{const task=x.querySelector('.green-choice-task').getBoundingClientRect(),bank=x.querySelector('.green-options-bank').getBoundingClientRect();return {right:bank.left>=task.right-1,localScroll:x.scrollWidth>x.clientWidth,controls:[...x.querySelectorAll('select')].every(s=>s.getBoundingClientRect().right<=bank.left)};}),readonly:[...document.querySelectorAll('[data-target]')].every(e=>e.tagName==='SELECT'?e.disabled:e.readOnly)}));
   assert.equal(facts.title,'Green roofs');assert.equal(facts.fields,14);assert.equal(facts.textareas,10);assert.equal(facts.selects,4);assert.equal(facts.overflow,false);assert.equal(facts.passageFont,18);assert.equal(facts.bankFont,16);assert.ok(facts.banks.every(b=>b.right&&b.controls));assert.equal(facts.readonly,scenario!=='draft');
   if(width<800)await page.locator('#tab-questions').click();
   await page.locator('[data-question="13"]').click();await page.locator('[data-action="review"]').click();await page.getByRole('button',{name:'Nén cấp 2 đoạn E'}).click();
   if(scenario==='waiting'){
    // jumpTo cuộn ở animation frame kế tiếp; đo sau khi điều hướng đã ổn định.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>{const pane=document.querySelector('#scroll-passage');window.__kept={node:document.querySelector('[data-target="l4.paragraph.e.level_2"]'),pane,scroll:pane.scrollTop};window.__pulseStart=window.__polls;});
    await page.waitForFunction(()=>window.__polls>=window.__pulseStart+3);
    assert.equal(await page.evaluate(()=>window.__kept.node===document.querySelector('[data-target="l4.paragraph.e.level_2"]')&&Math.abs(window.__kept.pane.scrollTop-window.__kept.scroll)<2),true);
    await page.evaluate(()=>window.__changeStatus('processing'));assert.equal(await page.evaluate(()=>window.__kept.node===document.querySelector('[data-target="l4.paragraph.e.level_2"]')),true);
    await page.evaluate(()=>window.__changeStatus('done'));await page.waitForSelector('.result-note');
   }
   if(scenario==='review'||scenario==='teacher'){
    await page.locator('[data-explain="l4.paragraph.e.level_2"]').click();await page.waitForSelector('#explanation-dialog[open]');assert.match(await page.locator('#explanation-dialog').innerText(),/Nén cấp 2 đoạn E/);await page.keyboard.press('Escape');assert.equal(await page.locator('#explanation-dialog').evaluate(d=>d.open),false);
   }
   if(scenario==='draft'){await page.locator('[data-target="l4.paragraph.e.level_2"]').fill('Nháp mới sau khi đi tới nén cấp 2.');assert.equal(await page.evaluate(()=>window.__lastSaved.answers['l4.paragraph.e.level_2']),'Nháp mới sau khi đi tới nén cấp 2.');}
   await page.screenshot({path:out+'/'+scenario+'-'+width+'.png'});
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);records.push({scenario,width,height,outcome:'passed',facts});
  }catch(error){records.push({scenario,width,height,outcome:'failed',error:error.stack});await page.screenshot({path:out+'/FAILED-'+scenario+'-'+width+'.png'});}finally{await context.close();}
 }
}finally{await browser.close();await site.close();}
await fs.writeFile(out+'/results.json',JSON.stringify({records,scope:'Actual entry/renderer; synthetic client and identity. No real AI, Google or production writes.'},null,2));
console.log(JSON.stringify({total:records.length,passed:records.filter(r=>r.outcome==='passed').length,failures:records.filter(r=>r.outcome!=='passed').map(r=>({scenario:r.scenario,width:r.width,error:r.error}))}));
if(records.some(r=>r.outcome!=='passed'))process.exitCode=1;
