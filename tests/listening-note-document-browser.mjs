// App/renderer/handler thật, API giả cách ly. Không gọi audio, bài hoặc tài khoản thật.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=process.env.LISTENING_DOCUMENT_EVIDENCE_DIR;
assert.ok(out);await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const code='fixture-inclusive-notes',instruction='Complete the notes below. Write ONE WORD ONLY for each answer.';
const groups=[
 {id:'definition',kind:'completion',label:'Definition',start:31,end:32,questions:[31,32]},
 {id:'examples',kind:'completion',label:'Examples of inclusive design',start:33,end:36,questions:[33,34,35,36]},
 {id:'impact',kind:'completion',label:'Impact of non-inclusive designs',start:37,end:40,introduction:'Access\nLoss of independence for disabled people.',questions:[37,38,39,40]}
].map(g=>({...g,instruction,questions:g.questions.map(n=>({n,text:`Source statement ${n} keeps the surrounding context before {blank} and after the answer.`}))}));
const lesson={authored:true,code,lesson:10,title:'Inclusive design · fixture',part:4,questionIds:Array.from({length:10},(_,i)=>String(i+31)),groups:groups.map(({questions,...g})=>g),totalMs:606322,audioMs:486322,reviewMs:120000};
let attempt={id:'fixture-attempt',no:1,status:'paused',phase:'review',audioPosition:486.322,remainingMs:120000,reviewRemainingMs:120000,usedMs:486322,answers:{31:'saved'},flags:[35],notes:'Saved general note',annotations:[],sequence:1,activeQuestion:31,tab:'completion',scroll:{passage:0,questions:{}},mobilePane:'passage'};
const identity={studentRef:'11111111-1111-4111-8111-111111111111',name:'Học viên giả',classCode:'LOPTHU',bindingId:'fixture-binding',entryMode:'shared'};
const state=lease=>({lesson,identity,attempts:[structuredClone(attempt)],events:[],definition:{groups},firstCompleted:null,...(lease?{lease:{id:'fixture-lease'}}:{})});
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),records=[],errors=[],unexpected=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
await ctx.addInitScript(()=>{window.__pulses=0;const fetchOriginal=window.fetch;window.fetch=(url,options)=>{if(String(url).endsWith('/pulse'))window.__pulses++;return fetchOriginal(url,options);};});
await ctx.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());
 if(u.pathname==='/mapping-api/api/student-identity/resolve'){
  const headers={'Access-Control-Allow-Origin':site.origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  return route.fulfill({headers,json:{ok:true,status:'unique',identity:{authority:'erp-contact',id:'900001'},aliases:[{studentRef:identity.studentRef,studentName:identity.name,classId:'fixture-class',classCode:identity.classCode}]}});
 }
 if(u.origin!==site.origin){unexpected.push(u.origin+u.pathname);return route.abort();}
 if(!u.pathname.startsWith('/api/'))return route.continue();
 const body=req.postData()?req.postDataJSON():null,send=value=>route.fulfill({json:value});
 if(u.pathname==='/api/library/'+code)return send({lesson,classes:[{id:'fixture-class',classCode:'LOPTHU'}]});
 if(u.pathname.endsWith('/classes/fixture-class'))return send({students:[{id:identity.studentRef,name:identity.name}]});
 if(u.pathname==='/api/shared-login')return send({...state(),token:'fixture-token'});
 if(u.pathname==='/api/state')return send(state());
 if(u.pathname==='/api/resume'){attempt.status='running';return send(state(true));}
 if(['/api/pulse','/api/pause'].includes(u.pathname)){if(body.snapshot)Object.assign(attempt,body.snapshot);if(u.pathname.endsWith('/pause'))attempt.status='paused';return send(state());}
 if(u.pathname==='/api/activate')return send(state());
 unexpected.push(u.pathname);return route.fulfill({status:503,json:{error:{code:'FIXTURE_ONLY',message:'Unexpected fixture request'}}});
});
let failure;
try{
 await page.goto(site.origin+'/listening-practice/?lesson='+code);
 await page.locator('#class-select').selectOption('fixture-class');await page.waitForFunction(()=>document.querySelector('#student-select')?.options.length>1);
 await page.locator('#student-select').selectOption(identity.studentRef);await page.locator('#remember-student').uncheck();await page.locator('#login-submit').click();
 await page.locator('[data-action="resume"]').click();await page.locator('#answer-31').waitFor();await page.waitForFunction(()=>document.querySelector('[data-action="request-submit"]')?.disabled===false);await page.evaluate(()=>document.fonts.ready);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:width===1440?1000:844});
  const observed=await page.evaluate(()=>{const root=document.querySelector('#readingView'),p=document.querySelector('#stem-31'),frame=p.closest('.design-question-group'),intro=document.querySelector('.authored-introduction');const textRect=e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect();};return{width:innerWidth,merged:root.classList.contains('listening-note-document'),inputs:root.querySelectorAll('input[data-answer]').length,overflow:document.documentElement.scrollWidth>innerWidth,commonHeadings:root.querySelectorAll('.authored-notes-heading').length,textInset:textRect(p).left-frame.getBoundingClientRect().left,introInset:textRect(intro).left-intro.closest('.design-question-group').getBoundingClientRect().left,lastVisible:!!document.querySelector('#q-40')?.getClientRects().length,answers:window.ReadingInteractionBridge.current().answers,flags:window.ReadingInteractionBridge.current().flags};});
  records.push(observed);await page.screenshot({path:path.join(out,'document-'+width+'.png')});
  const columns=await page.evaluate(()=>({width:document.querySelector('#question-scroll').clientWidth,groups:[...document.querySelectorAll('.design-question-group')].map(g=>g.getBoundingClientRect().width),fonts:[...document.querySelectorAll('.authored-stem')].map(p=>getComputedStyle(p).fontSize)}));
  assert.ok(columns.groups.every(w=>w>=columns.width*.9),'Every section must use the same full-width note document: '+JSON.stringify(columns));assert.equal(new Set(columns.fonts).size,1);records.push({columns});
  assert.equal(observed.merged,true,'All ten notes use one document, including the first group.');assert.equal(observed.commonHeadings,1);assert.equal(observed.inputs,10);assert.equal(observed.overflow,false);assert.ok(observed.textInset>=15,JSON.stringify(observed));assert.ok(observed.introInset>=15,JSON.stringify(observed));assert.equal(observed.lastVisible,true);
  await page.locator('.cbt-question-nav [data-question="31"]').click();await page.locator('#answer-31').fill('preserved');await page.locator('.cbt-question-nav [data-question="40"]').click();assert.equal(await page.locator('#answer-40').isVisible(),true);
 }
 await page.setViewportSize({width:1440,height:1000});
 // Các gốc cũ phải giữ nguyên chuỗi chữ kể cả sau khi đặt chung một vùng cuộn.
 const annotations=await page.evaluate(async groups=>{
  const ui=await import('./authored-ui.js?v=20261029-notes-document1');
  const excluded='button,input,select,textarea,script,style,[contenteditable=true],.cbt-annotation-toolbar,.cbt-note-panel,.cbt-blank-number,.cbt-question-number,.cbt-choice-letter,.cbt-paragraph-label';
  const text=root=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),parts=[];while(walker.nextNode()){const n=walker.currentNode;if(n.parentElement.closest(excluded)||n.parentElement.closest('.cbt-reading-passage,.cbt-reading-questions')!==root)continue;parts.push(n.data);}return parts.join('');};
  const entries=[['reading-passage-0','cbt-reading-passage',groups.slice(0,1),31],['reading-questions-0','cbt-reading-questions',groups.slice(1),33]],saved=[];
  for(const [key,className,source,n]of entries){const old=document.createElement('article');old.className=className;old.innerHTML=ui.groupsHtml(source,{answers:{}},()=>'<button>Flag</button>');const original=text(old),current=document.querySelector('[data-annotation-root-key="'+key+'"]');if(text(current)!==original)throw Error('Annotation source text changed: '+key);const quote='Source statement '+n,start=original.indexOf(quote);if(start<0)throw Error('Fixture quote missing');saved.push({id:'legacy-note-'+n,rootKey:key,start,end:start+quote.length,quote,kind:'note',note:'Old saved note '+n,skill:'reading',questionRef:String(n)});}
  window.ReadingInteractionBridge.current().annotations=saved;window.ReadingAnnotations.install();return saved;
 },groups);
 for(const a of annotations)assert.equal(await page.locator('mark[data-annotation-id="'+a.id+'"]').textContent(),a.quote);
 await page.locator('.cbt-question-nav [data-question="40"]').click();await page.locator('#answer-40').fill('last draft');
 const old=await page.evaluate(()=>{const f=document.querySelector('#answer-40'),r=document.querySelector('#question-scroll');f.focus();f.setSelectionRange(2,5);window.__keptField=f;window.__keptPane=r;return{scroll:r.scrollTop,selection:[f.selectionStart,f.selectionEnd],pulses:window.__pulses};});
 await page.waitForFunction(n=>window.__pulses>=n+3,old.pulses,{timeout:25000});
 const after=await page.evaluate(()=>({sameField:window.__keptField===document.querySelector('#answer-40'),samePane:window.__keptPane===document.querySelector('#question-scroll'),focused:document.activeElement===window.__keptField,selection:[window.__keptField.selectionStart,window.__keptField.selectionEnd],scroll:window.__keptPane.scrollTop,answers:window.ReadingInteractionBridge.current().answers,flags:window.ReadingInteractionBridge.current().flags,notes:window.ReadingInteractionBridge.current().notes}));
 assert.equal(after.sameField,true);assert.equal(after.samePane,true);assert.equal(after.focused,true);assert.deepEqual(after.selection,old.selection);assert.ok(Math.abs(after.scroll-old.scroll)<1);assert.equal(after.answers[31],'preserved');assert.equal(after.answers[40],'last draft');assert.deepEqual(after.flags,[35]);assert.equal(after.notes,'Saved general note');records.push({background:after});
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
}catch(e){failure=e.stack;await page.screenshot({path:path.join(out,'failure.png')});}
finally{await ctx.close();await browser.close();await site.close();}
await fs.writeFile(path.join(out,'results.json'),JSON.stringify({outcome:failure?'failed':'passed',failure,records,errors,unexpected,scope:'Actual Listening app, native UI handlers; fictional API and review phase only. No real audio, learner, submission or grading.'},null,2));
console.log(JSON.stringify({outcome:failure?'failed':'passed',failure,records}));if(failure)process.exitCode=1;
