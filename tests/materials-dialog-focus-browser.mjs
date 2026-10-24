// Input: actual Materials renderer, synthetic passage/feedback; no real learner data.
// Checks: every explanation opens with a name and focus inside, closes to its trigger.
// Output: JSON evidence; nonzero exit lists the exact target/viewport that failed.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.MATERIALS_FOCUS_EVIDENCE_DIR||resolve(root,'output/playwright/materials-focus');
const prototypeOverride=process.env.MATERIALS_PROTOTYPE_BEFORE?await fs.readFile(process.env.MATERIALS_PROTOTYPE_BEFORE):null;
await fs.mkdir(out,{recursive:true});
const content={version:'fixture-v1',title:'Bài đọc thử Materials — đủ tám đoạn và hai mươi ô',subtitle:'Chỉ dùng dữ liệu thử',instruction:'Nén thông tin và tìm đoạn văn.',blankValues:[],dropdownPlaceholders:[],paragraphs:[...'ABCDEFGH'].map(id=>({id,text:('Đoạn '+id+' mô tả vật liệu, đặc điểm và ứng dụng. ').repeat(12),target:'p.'+id})),questions:[1,2,3,4].map(number=>({number,text:'Câu hỏi thử '+number+' về đặc điểm vật liệu.',hint:'Tìm dẫn chứng trong đoạn.',targets:{radar:`q.${number}.radar`,evidence_l1:`q.${number}.evidence`,section:`q.${number}.section`}}))};
content.targets=[...content.paragraphs.map(p=>({id:p.target,paragraph:p.id,kind:'paragraph',label:'Nén đoạn '+p.id})),...content.questions.flatMap(q=>Object.entries(q.targets).map(([kind,id])=>({id,question:q.number,kind:kind==='evidence_l1'?'evidence':kind,label:'Câu '+q.number+' — '+kind})))];
const fixture={answers:Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='section'?'A':'Bản trả lời thử '+t.label])),feedback:Object.fromEntries(content.targets.map((t,i)=>[t.id,{status:['correct','partial','incorrect','blank'][i%4],reason:'Nhận xét thử có tiếng Việt và dẫn chứng để đối chiếu.',modelAnswer:'Bản nén mẫu thử.',evidence:'Thông tin thử trong đoạn A.',analysis:'Phân tích thử.'}]))};

const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{
 for(const width of [1440,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.origin!==site.origin)return r.abort();if(q.method()!=='GET'){writes.push(u.pathname);return r.abort();}if(prototypeOverride&&u.pathname.endsWith('/prototype.js'))return r.fulfill({contentType:'text/javascript; charset=utf-8',body:prototypeOverride});if(u.pathname==='/__prototype__/content')return r.fulfill({json:content});if(u.pathname==='/__prototype__/review')return r.fulfill({json:fixture});if(u.pathname.endsWith('/api-config.js'))return r.fulfill({contentType:'text/javascript',body:''});return r.continue();});
  await page.goto(site.origin+'/reading-skills67/?scenario=review');await page.locator('#app[aria-busy]').waitFor({state:'detached'});
  for(const target of content.targets){
   let failure=null,focus;
   try{
    if(width<1000)await page.locator(`[data-pane="${target.question?'questions':'passage'}"]`).click();
    const trigger=page.locator(`[data-explain="${target.id}"]`);await trigger.click();
    const dialog=page.locator('#explanation-dialog');await dialog.waitFor({state:'visible'});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
    focus=await dialog.evaluate(e=>{const a=document.activeElement,r=a.getBoundingClientRect();return {inside:e.contains(a),tag:a.tagName,label:a.getAttribute('aria-label'),visible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight,name:document.getElementById(e.getAttribute('aria-labelledby'))?.textContent};});
    assert.equal(focus.name,target.label);assert.equal(focus.inside,true,'Initial focus must stay inside explanation');assert.equal(focus.visible,true);
    if(target===content.targets[0]){
     await dialog.locator('[data-explain-offset="1"]').click();
     assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true,'Next explanation keeps focus inside');
     await dialog.locator('[data-explain-offset="-1"]').click();
     assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true,'Previous explanation keeps focus inside');
    }
   }catch(e){failure=e.message;}
   finally{if(await page.locator('#explanation-dialog').evaluate(e=>e.open)){await page.keyboard.press('Escape');await page.waitForTimeout(30);}}
   const returned=await page.locator(`[data-explain="${target.id}"]`).evaluate(e=>e===document.activeElement);
   if(!returned)failure=[failure,'Close did not return to the same target'].filter(Boolean).join('; ');
   records.push({width,target:target.id,focus,returned,outcome:failure?'failed':'passed',error:failure});
  }
  await page.locator('[data-action=edit]').click();await page.locator('[data-action=history]:visible').click();await page.locator('[data-history]').first().click();
  for(const [label,fn] of [
    ['history-forward-focus-and-snapshot',async()=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));assert.equal(await page.locator('#app h1').evaluate(e=>e===document.activeElement),true);assert.deepEqual(await page.evaluate(()=>ReadingInteractionBridge.current().answers),fixture.answers);}],
    ['history-close-keeps-existing-context',async()=>{const snapshot=await page.evaluate(()=>structuredClone(ReadingInteractionBridge.current()));const trigger=page.locator('[data-action=history]:visible');await trigger.click();await page.locator('#modal [data-close-modal]').first().click();assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);assert.deepEqual(await page.evaluate(()=>ReadingInteractionBridge.current()),snapshot);}]
  ]){try{await fn();records.push({width,target:label,outcome:'passed'});}catch(e){records.push({width,target:label,outcome:'failed',error:e.message});}}
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await ctx.unrouteAll({behavior:'wait'});await ctx.close();
 }
}finally{await browser.close();await site.close();await fs.writeFile(out+'/results.json',JSON.stringify({outcome:records.every(r=>r.outcome==='passed')?'passed':'failed',records,externalWrites:0,scope:'Actual shared Materials explanation renderer via prototype entry, synthetic content/feedback; no live authentication or Read67 call.'},null,2));}
console.log(JSON.stringify({cases:records.length,passed:records.filter(r=>r.outcome==='passed').length}));
if(records.some(r=>r.outcome!=='passed'))process.exitCode=1;
