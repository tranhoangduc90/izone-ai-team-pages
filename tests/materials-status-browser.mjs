// Actual Materials renderer with synthetic content and a local WebClient stub.
// Checks operation-state semantics, not a learner's academic result or real AI.
import fs from'node:fs/promises';
import assert from'node:assert/strict';
import{resolve}from'node:path';
import{fileURLToPath,pathToFileURL}from'node:url';
import{createHash}from'node:crypto';
import{execFileSync}from'node:child_process';
import{serveDirectory}from'./fixtures/static-ui-server.mjs';
const{chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.MATERIALS_STATUS_EVIDENCE_DIR||resolve(root,'output/playwright/materials-status');await fs.mkdir(out,{recursive:true});
const revision=process.env.MATERIALS_STATUS_REVISION||null,publicBase=process.env.MATERIALS_STATUS_PUBLIC_BASE||null;
assert.ok(!(revision&&publicBase),'Choose a Git baseline or public assets.');
const overrides=new Map();
for(const path of['reading-skills67/prototype.js','shared/master170/materials.css']){
 if(revision)overrides.set('/'+path,Buffer.from(execFileSync('git',['-C',root,'show',revision+':'+path])));
 if(publicBase){const response=await fetch(publicBase.replace(/\/$/,'')+'/'+path,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);overrides.set('/'+path,Buffer.from(await response.arrayBuffer()));}
}
const content={version:'synthetic-status-v1',title:'Bài đọc giả để kiểm trạng thái',subtitle:'Nội dung giả',instruction:'Nội dung minh họa',blankValues:[],dropdownPlaceholders:[],
 paragraphs:[...'ABCDEFGH'].map(id=>({id,text:'Đoạn giả '+id+' để kiểm bố cục và bảo toàn nội dung.',target:'p.'+id})),
 questions:[1,2,3,4].map(number=>({number,text:'Câu hỏi giả '+number,hint:'Gợi ý giả',targets:{radar:`q.${number}.radar`,evidence_l1:`q.${number}.evidence`,section:`q.${number}.section`}}))};
content.targets=[...content.paragraphs.map(p=>({id:p.target,paragraph:p.id,kind:'paragraph',label:'Nén đoạn '+p.id})),...content.questions.flatMap(q=>Object.entries(q.targets).map(([kind,id])=>({id,question:q.number,kind:kind==='evidence_l1'?'evidence':kind,label:'Câu '+q.number+' — '+kind})))];
const answers=Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='section'?'A':'Nháp giả '+t.id]));
const feedback=Object.fromEntries(content.targets.map((t,i)=>[t.id,{status:['correct','partial','incorrect','blank'][i%4],reason:'Nhận xét giả',modelAnswer:'Mẫu giả',evidence:'Dẫn chứng giả',analysis:'Phân tích giả'}]));
// Expected roles are independently taken from master170's semantic state contract.
const palette={pending:{fg:'rgb(23, 66, 101)',bg:'rgb(230, 238, 245)'},attention:{fg:'rgb(138, 83, 0)',bg:'rgb(255, 244, 224)'},error:{fg:'rgb(155, 10, 34)',bg:'rgb(253, 232, 235)'}};
const cases=[{name:'queued',status:'queued',role:'pending'},{name:'processing',status:'processing',role:'pending'},
 {name:'failed-unknown',status:'failed',errorCode:'AI_OUTCOME_UNKNOWN',role:'attention'},
 {name:'review-unknown',status:'needs_review',errorCode:'AI_OUTCOME_UNKNOWN',role:'attention'},
 {name:'failed-known',status:'failed',errorCode:'AI_PROVIDER_ERROR',role:'error'},
 {name:'review-known',status:'needs_review',errorCode:'AI_PROVIDER_ERROR',role:'attention'},
 {name:'done',status:'done',role:null}];
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];let fatal;
try{
 for(const spec of cases)for(const[width,height]of[[1440,1000],[390,844],[320,568]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  const attempt={attemptId:'synthetic-attempt',runNo:1,draftRevision:1,createdAt:'2026-10-24T00:00:00Z',status:spec.status,errorCode:spec.errorCode||null,snapshot:{answers},completeness:{filled_cells:20,total_cells:20},result:spec.status==='done'?{feedback}:null};
  try{
   await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==site.origin)return route.abort();if(request.method()!=='GET'){writes.push(url.pathname);return route.abort();}
    if(overrides.has(url.pathname))return route.fulfill({body:overrides.get(url.pathname),contentType:url.pathname.endsWith('.js')?'text/javascript':'text/css'});
    if(url.pathname.endsWith('/api-config.js'))return route.fulfill({contentType:'text/javascript',body:''});
    if(url.pathname.endsWith('/web-client.js'))return route.fulfill({contentType:'text/javascript',body:`(()=>{const content=${JSON.stringify(content)},attempt=${JSON.stringify(attempt)},identity={ownerId:'synthetic-owner',name:'Người thử giả',className:'LOPTHU'};window.ReadingServerClient={identity,access:{config:{demo:true}},initialHistory:{attempts:[attempt]},state:{status:'saved',completeness:{filled_cells:20,total_cells:20}},initialize:async()=>({content,identity,draft:{body:{answers:attempt.snapshot.answers},savedAt:attempt.createdAt},config:{demo:true},history:[attempt],restored:false}),getAttempt:async()=>attempt,poll(){},stopPoll(){},schedule(){return true},flush:async()=>{},historyDetail:async()=>({attempts:[attempt],archives:[]})};})();`});
    return route.continue();});
   await page.goto(site.origin+'/reading-skills67/?server=1&attemptId=synthetic-attempt');await page.waitForFunction(()=>document.querySelector('.waiting-card,.server-error,.result-note'));await page.evaluate(()=>document.fonts.ready);
   const row={case:spec.name,width,height,expectedRole:spec.role,outcome:'passed'};
   row.observation=await page.evaluate(()=>{const n=document.querySelector('.waiting-card,.server-error,.result-note'),s=getComputedStyle(n),fields=[...document.querySelectorAll('[data-target]')].map(e=>({id:e.dataset.target,value:e.value,readOnly:e.readOnly,disabled:e.disabled}));return{noticeText:n.textContent.trim().replace(/\s+/g,' '),fg:s.color,bg:s.backgroundColor,border:s.borderLeftColor,fields,overflow:document.documentElement.scrollWidth>innerWidth,returnDraft:document.querySelector('[data-action="server-return-draft"]')?.textContent.trim()||null,gradingButton:document.querySelector('#grade-button')?.textContent.trim()||null};});
   try{assert.equal(row.observation.fields.length,20);assert.equal(row.observation.overflow,false);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);if(spec.role){assert.equal(row.observation.fg,palette[spec.role].fg,'Foreground expresses the operation state.');assert.equal(row.observation.bg,palette[spec.role].bg,'Background expresses the operation state.');assert.equal(row.observation.border,palette[spec.role].fg,'State border matches its foreground.');}}
   catch(e){row.outcome='failed';row.error=e.message;}
   row.image=`${spec.name}-${width}.png`;await page.screenshot({path:out+'/'+row.image});row.errors=errors;row.writes=writes;records.push(row);
  }finally{await context.close();}
 }
}catch(e){fatal=e.stack;}finally{await browser.close();await site.close();}
const sourceHashes={};for(const file of['reading-skills67/prototype.js','shared/master170/materials.css'])sourceHashes[file]=createHash('sha256').update(overrides.get('/'+file)||await fs.readFile(resolve(root,file))).digest('hex');
const result={outcome:fatal||records.some(r=>r.outcome==='failed')?'failed':'passed',records,fatal,revision,publicBase,sourceHashes,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),businessWrites:0,scope:'Actual renderer with synthetic WebClient/content. Public mode downloads JS/CSS only; remaining assets are local. No real API, AI, identity or physical-device acceptance.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(r=>r.outcome==='failed').length,fatal}));if(result.outcome!=='passed')process.exitCode=1;
