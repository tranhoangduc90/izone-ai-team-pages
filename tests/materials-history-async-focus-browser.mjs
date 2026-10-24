// Actual Materials renderer, synthetic content/client, no external writes.
// Check a delayed history load after the user moves focus outside the dialog.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.MATERIALS_ASYNC_EVIDENCE_DIR||resolve(root,'output/playwright/materials-async-focus');
await fs.mkdir(out,{recursive:true});
const revision=process.env.MATERIALS_ASYNC_REVISION||null;
const publicBase=process.env.MATERIALS_ASYNC_PUBLIC_BASE||null;
assert.ok(!(revision&&publicBase));
let prototype=await fs.readFile(resolve(root,'reading-skills67/prototype.js'));
if(revision)prototype=execFileSync('git',['-C',root,'show',revision+':reading-skills67/prototype.js']);
if(publicBase){const response=await fetch(publicBase.replace(/\/$/,'')+'/reading-skills67/prototype.js',{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);prototype=Buffer.from(await response.arrayBuffer());}
const content={version:'synthetic-async-focus-v1',title:'Bài đọc giả kiểm lịch sử',subtitle:'Nội dung giả',instruction:'Câu hỏi giả',blankValues:[],dropdownPlaceholders:[],
 paragraphs:[...'ABCDEFGH'].map(id=>({id,text:'Đoạn giả '+id+' để kiểm lịch sử.',target:'p.'+id})),
 questions:[1,2,3,4].map(number=>({number,text:'Câu hỏi giả '+number,hint:'Gợi ý giả',targets:{radar:`q.${number}.radar`,evidence_l1:`q.${number}.evidence`,section:`q.${number}.section`}}))};
content.targets=[...content.paragraphs.map(p=>({id:p.target,paragraph:p.id,kind:'paragraph',label:'Nén đoạn '+p.id})),...content.questions.flatMap(q=>Object.entries(q.targets).map(([kind,id])=>({id,question:q.number,kind:kind==='evidence_l1'?'evidence':kind,label:'Câu '+q.number+' — '+kind})))];
const answers=Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='section'?'A':'Nháp giả '+t.id]));
const attempt={attemptId:'synthetic-attempt',runNo:1,draftRevision:1,createdAt:'2026-10-24T00:00:00Z',status:'done',snapshot:{answers},completeness:{filled_cells:20,total_cells:20},result:{feedback:Object.fromEntries(content.targets.map(t=>[t.id,{status:'correct',reason:'Nhận xét giả',modelAnswer:'Mẫu giả',evidence:'Dẫn chứng giả',analysis:'Phân tích giả'}]))}};
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{
 for(const width of [1440,390,320])for(const mode of ['external-focus','destination-focus']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],writes=[];
  page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__focusTrace=[];document.addEventListener('focusin',event=>window.__focusTrace.push({event:'focusin',tag:event.target.tagName,id:event.target.id,action:event.target.dataset?.action}));document.addEventListener('close',()=>window.__focusTrace.push({event:'close',tag:document.activeElement.tagName,id:document.activeElement.id}),true);});
  try{
   await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==site.origin)return route.abort();if(request.method()!=='GET'){writes.push(url.pathname);return route.abort();}
    if(url.pathname.endsWith('/prototype.js'))return route.fulfill({contentType:'text/javascript',body:prototype});
    if(url.pathname.endsWith('/api-config.js'))return route.fulfill({contentType:'text/javascript',body:''});
    if(url.pathname.endsWith('/web-client.js'))return route.fulfill({contentType:'text/javascript',body:`(()=>{const content=${JSON.stringify(content)},attempt=${JSON.stringify(attempt)},identity={ownerId:'synthetic-owner',name:'Người thử giả',className:'LOPTHU'};window.ReadingServerClient={identity,access:{config:{demo:true}},initialHistory:{attempts:[attempt]},state:{status:'saved',completeness:{filled_cells:20,total_cells:20}},initialize:async()=>({content,identity,draft:{body:{answers:attempt.snapshot.answers},savedAt:attempt.createdAt},config:{demo:true},history:[attempt],restored:false}),getAttempt:async()=>{window.__historyRequestPending=true;return new Promise(resolve=>window.__releaseHistory=()=>resolve(attempt));},poll(){},stopPoll(){},schedule(){return true},flush:async()=>{},historyDetail:async()=>({attempts:[attempt],archives:[]})};})();`});
    return route.continue();});
   await page.goto(site.origin+'/reading-skills67/?server=1');await page.locator('textarea[data-target]').first().waitFor();
   await page.locator('[data-action=history]').click();await page.locator('#modal[open] [data-server-attempt]').waitFor();
   // Closing a native dialog queues its close event. Moving focus in this same
   // interaction reproduces the observed late-close race without altering app code.
   await page.evaluate(mode=>{document.querySelector('[data-server-attempt]').click();if(mode==='external-focus')document.querySelector('#teacher').focus();},mode);
   await page.waitForFunction(()=>window.__historyRequestPending===true);await page.evaluate(()=>window.__releaseHistory());await page.locator('.result-note').waitFor();
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const row={width,case:mode,outcome:'passed',observation:await page.evaluate(()=>({activeId:document.activeElement.id,activeTag:document.activeElement.tagName,isHeading:document.activeElement===document.querySelector('#app h1'),answers:ReadingInteractionBridge.current().answers,status:ReadingInteractionBridge.current().status,modalOpen:document.querySelector('#modal').open,focusTrace:window.__focusTrace,toast:document.querySelector('#toast').textContent,theme:document.documentElement.dataset.izoneTheme,product:document.body.dataset.m170Product}))};
   try{assert.equal(row.observation.toast,'','No handled fixture or UI error.');assert.equal(mode==='external-focus'?row.observation.activeId==='teacher':row.observation.isHeading,true);assert.deepEqual(row.observation.answers,answers);assert.equal(row.observation.status,'review');assert.equal(row.observation.modalOpen,false);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);}catch(e){row.outcome='failed';row.error=e.message;}
   records.push(row);
  }finally{await context.close();}
 }
}finally{await browser.close();await site.close();}
const result={outcome:records.every(r=>r.outcome==='passed')?'passed':'failed',records,revision,publicBase,prototypeSha256:createHash('sha256').update(prototype).digest('hex'),testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),businessWrites:0,scope:'Actual native dialog and renderer; synthetic delayed WebClient, local assets. Public mode substitutes deployed JS only. No real API, SSO or physical device.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(r=>r.outcome==='failed').length}));if(result.outcome!=='passed')process.exitCode=1;
