// Các trang/module thật; phiên/người/lớp và phản hồi trong RAM. Mọi mạng ngoài bị chặn.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
import {createState,EXAMPLE} from '../writing-handouts/lesson5-demo/core.mjs';
import {workflowFor} from '../writing-handouts/shared/workflow.mjs';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const server=process.env.SITE_ORIGIN?null:await serveDirectory(process.env.SOURCE_ROOT||repository);
const origin=process.env.SITE_ORIGIN||server.origin;
const out=process.env.HANDOUT67_EVIDENCE_DIR;assert(out,'Set HANDOUT67_EVIDENCE_DIR outside Git.');
const baseline=false;await fs.mkdir(out,{recursive:true});
function contrast(foreground,background){const lum=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const a=lum(foreground),b=lum(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
const studentRef='11111111-1111-4111-8111-111111111111',classRef='33333333-3333-4333-8333-333333333333',sessionRef='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
let currentPage;
try{for(const n of [5,7,9].filter(n=>!process.env.LESSON_FILTER||String(n)===process.env.LESSON_FILTER)){
 const lesson={activity:'lesson'+n,number:n,title:'Đề giả có tên dài để kiểm đầy đủ dấu tiếng Việt và bố cục của Lesson '+n,shortTitle:'Handout thử '+n,topic:'Synthetic question. Explain two reasons with connected examples.',defaultClass:classRef,classes:[classRef],body:n===9?1:2,aInstruction:'Hướng dẫn giả cho điểm A.',whyOptions:['Lý do 1','Lý do 2'],ideaHint:'Ý bạn tự viết.',...(n===9?{workflowMode:'whole-chain-v1'}:{})};
 const policy=workflowFor(lesson);
 for(const key of policy.order)for(const status of ['draft','revision','pending','technical_error','passed']){
  const label=`lesson${n}-${key}-${status}`,context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();currentPage=page;page.setDefaultTimeout(12000);
  const errors=[],unexpected=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  const state={...createState(0,lesson),ref:sessionRef,sessionRef,activity:lesson.activity,activitySlug:lesson.activity,classRef,studentRef,responses:{...EXAMPLE},updatedAt:'2026-10-23T00:00:00Z',savedAt:'2026-10-23T00:00:00Z',submittedSections:[],vocabulary:{},commentThreads:[],processing:{}};
  state.idea2Open=n===9?key==='si2':policy.order.indexOf(key)>=policy.order.length-3;
  for(const k of policy.order){
   const s=state.steps[k];s.status=policy.order.indexOf(k)<policy.order.indexOf(key)?'passed':k===key?status:'draft';
   if(s.status!=='draft'){
    state.submittedSections.push(k);
    s.history=[{number:1,status:'revision',snapshot:{...EXAMPLE},feedback:'Nhận xét bản trước: hãy nối ý cụ thể hơn.',jobRef:'fake-'+k+'-old'},...(s.status==='passed'?[{number:2,status:'passed',snapshot:{...EXAMPLE},feedback:'Bản giả đã đạt; nội dung và tiến độ được giữ.',jobRef:'fake-'+k}]:[])];
    if(s.status==='passed')s.approval={source:'ai'};
    if(s.status==='pending')s.pending={jobRef:'fake-'+k,requestId:'fake-'+k};
    if(s.status==='technical_error')s.error='Lỗi xử lý giả; bài đã nhập vẫn được giữ.';
   }
  }
  const vocab={status:'ready',groups:Object.fromEntries(['A','X','B'].map(p=>[p,[{phrase:'A long sample expression for '+p,meaningVi:'Nghĩa tiếng Việt có dấu đầy đủ.'}]]))};
  for(const number of [0,1,2])state.vocabulary[number]=structuredClone(vocab);
  const field=policy.fields[key][0];
  state.commentThreads=[{ref:'thread-'+key,section:key,field,status:'open',quote:EXAMPLE[field].slice(0,10),anchor:{kind:'quote',start:0,end:10},originalContent:EXAMPLE[field],messages:[{role:'teacher',authorName:'GV giả',createdAt:'2026-10-23T00:00:00Z',body:'Gợi ý giả dài: '+('Giữ đúng quan hệ của hai ý. '.repeat(8))}]}];
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname;
   const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type,authorization,if-match','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
   const send=(body,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(p==='/mapping-api/api/student-identity/resolve')return send({ok:true,status:'unique',identity:{authority:'erp-contact',id:'900001'},aliases:[{classId:'1293',classCode:'IC2304',studentRef,studentName:'HV giả'}]});
   if(p.startsWith('/api/handout67/v1')){
    const rp=p.slice('/api/handout67/v1'.length);
    if(rp==='/lessons/'+lesson.activity)return send({ok:true,lesson});
    if(rp==='/roster')return send({ok:true,classes:[{classRef,className:'IC2304',students:[{studentRef,displayName:'HV giả có tên dài để kiểm giao diện'}]}]});
    if(req.method()!=='GET')writes.push({path:rp,method:req.method(),body:req.postDataJSON()});
    if(rp==='/sessions')return send({ok:true,session:state,token:'fixture-only-token'},201);
    if(rp==='/sessions/'+sessionRef)return send({ok:true,session:state});
    if(rp.endsWith('/responses')){Object.assign(state.responses,req.postDataJSON().responses);state.version++;return send({ok:true,session:state});}
    unexpected.push(rp);return send({ok:false,error:'UNCONFIGURED_FIXTURE'},503);
   }
   if(url.origin===origin)return route.continue();unexpected.push(url.origin);return route.abort();
  });
  await page.goto(origin+`/writing-handouts/lesson${n}/`);
  await page.locator('#class-select option[value="'+classRef+'"]').waitFor({state:'attached'});await page.selectOption('#class-select',classRef);
  await page.locator('#student-select option[value="'+studentRef+'"]').waitFor({state:'attached'});
  await page.selectOption('#student-select',studentRef);await page.locator('#login-form [type=submit]').click();await page.locator('#confirm-button').click();
  await page.locator('#workspace:not([hidden])').waitFor();
  const step=page.locator('#step-'+key);if(await step.evaluate(e=>e.tagName==='DETAILS'))await step.evaluate(e=>e.open=true);
  await step.scrollIntoViewIfNeeded();
  const history=step.locator('details.history');for(let i=0;i<await history.count();i++)await history.nth(i).evaluate(e=>e.open=true);
  assert.match(await step.innerText(),new RegExp(({draft:'Chưa check',revision:'Cần sửa',pending:'Đang chấm',technical_error:'Chưa chấm xong',passed:'Đã đạt'})[status],'i'));
  const metadata={label,n,key,status,writes:[],screens:[],errors,unexpected};
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:width===1440?1000:844});await page.evaluate(()=>document.fonts.ready);
   const metrics=await page.evaluate(()=>({font:getComputedStyle(document.body).fontFamily,overflow:document.documentElement.scrollWidth>innerWidth,logos:[...document.querySelectorAll('.m170-logo')].map(e=>({loaded:e.complete&&e.naturalWidth>0,height:e.getBoundingClientRect().height})),fields:[...document.querySelectorAll('[data-field]')].map(e=>({field:e.dataset.field,value:e.value,font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize})),saved:[...document.querySelectorAll('.saved-text')].map(e=>e.textContent),buttons:[...document.querySelectorAll('#workspace button')].map(e=>({text:e.textContent.trim(),disabled:e.disabled})),status:[...document.querySelectorAll('.badge')].map(e=>({text:e.textContent.trim(),bg:getComputedStyle(e).backgroundColor,fg:getComputedStyle(e).color}))}));
   if(!baseline){assert.match(metrics.font,/Source Sans 3/);assert.equal(metrics.logos.length,1);assert.equal(metrics.logos[0].loaded,true);assert.equal(metrics.logos[0].height,width>600?48:36);}
   assert.equal(metrics.overflow,false,label+' '+width);
   const heading=step.locator('.step-heading h3').first();const title=await heading.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{text:e.textContent,color:s.color,background:s.backgroundColor,fontSize:s.fontSize,fontWeight:s.fontWeight,rect:{width:r.width,height:r.height},textFits:e.scrollWidth<=e.clientWidth};});title.contrast=contrast(title.color,title.background);title.passed=title.contrast>=4.5&&title.textFits;await heading.screenshot({path:`${out}/${label}-${width}.png`,timeout:20000});metadata.screens.push({width,...metrics,title});
  }
  if(status==='passed'){
   const edit=step.locator('[data-edit]').first();await edit.click();await page.locator('.inline-edit-box').waitFor();
   const before=await page.locator('.inline-edit-box textarea').inputValue();await page.locator('.inline-edit-box textarea').fill(before+' · Nháp chưa lưu');
   await page.locator('[data-cancel-inline]').click();assert.equal(await page.locator('.inline-edit-box').count(),0);assert.equal(state.responses[field],EXAMPLE[field]);
   assert.equal(await edit.evaluate(e=>document.activeElement===e),true);
   metadata.editCancel='passed';
  }else if(status!=='draft'){
   await step.locator('[data-attest]').click();const dialog=page.locator('dialog.feature-dialog[open]');await dialog.waitFor();
   assert.equal(await dialog.locator('[data-submit]').isDisabled(),true);await dialog.locator('input[type=checkbox]').check();assert.equal(await dialog.locator('[data-submit]').isEnabled(),true);
   await dialog.locator('[data-cancel]').click();await page.locator('dialog.feature-dialog').waitFor({state:'detached'});assert.equal(await page.locator('dialog.feature-dialog').count(),0);metadata.attestationCancel='passed';
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.equal(writes.some(w=>/checks|attest|edit|vocabulary/.test(w.path)),false);
  metadata.writes=writes;records.push(metadata);await context.close();
  await fs.writeFile(out+'/results.json',JSON.stringify({outcome:'running',records},null,2));
 }
 console.log(JSON.stringify({lesson:n,cases:records.filter(r=>r.n===n).length}));
}
const green=records.every(r=>r.screens.every(s=>s.title.passed));await fs.writeFile(out+'/results.json',JSON.stringify({outcome:green?'passed':'partial',records,scope:'Real L5/L7/L9 UI and synthetic API.17steps ×5statuses ×3viewports. Heading contrast/fit, original content and buttons, Edit/attestation cancel. No actual learner/AI/Docs/QM writes.'},null,2));console.log(JSON.stringify({outcome:green?'passed':'partial',states:records.length,observations:records.reduce((n,r)=>n+r.screens.length,0),contrastFailures:records.flatMap(r=>r.screens.filter(s=>!s.title.passed).map(s=>({label:r.label,width:s.width,contrast:s.title.contrast}))).length}));if(!green)process.exitCode=1;
}catch(error){await fs.writeFile(out+'/failure.json',JSON.stringify({error:error.message,text:await currentPage?.locator('body').innerText().catch(()=>''),completed:records.length},null,2));throw error;}finally{await browser.close();await server?.close();}
