// Native stylesheet chains, authored renderer and fictional answers; no API.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';import {groupsHtml} from '../reading-practice/authored-ui.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.QUESTION_LAYOUT_EVIDENCE_DIR;
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const cases=JSON.parse(await fs.readFile(path.join(root,'design-reference/master170/cases.json'),'utf8'));
const routes=['reading-practice/index.html','listening-practice/index.html','reading-skills67/materials-beyond-concrete/index.html','listening-homework/scandinavian-studies.html','term-tests/term-test-1-computer-based/index.html','term-tests/substitute-test-1-k67-computer-based/index.html'];
let site,browser;const records=[];
test.before(async()=>{await fs.mkdir(out,{recursive:true});site=await serveDirectory(root);browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(records,null,2));await browser?.close();await site?.close();});
for(const route of routes)test(route+': approved rows, banks, tables and focus preservation',async()=>{
 const source=await fs.readFile(path.join(root,route),'utf8'),links=[...source.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('\n'),body=source.match(/<body\b([^>]*)>/i)[1];
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.route('**/*',r=>new URL(r.request().url()).origin===site.origin?r.continue():r.abort());
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(site.origin+'/');
  const html=ids=>ids.map(id=>groupsHtml(cases.find(c=>c.id===id).groups,{answers:{}},n=>`<button type="button" class="cbt-flag-button" data-flag="${n}" aria-pressed="false">Flag</button>`)).join('');
  await p.setContent(`<!doctype html><html data-izone-theme="master170"><head><base href="${site.origin+'/'+route}">${links}<style>html,body{height:auto!important;overflow:auto!important}#readingView{display:block!important;height:auto!important;min-height:0!important}#app{max-width:1100px;margin:auto;padding:16px}#question-scroll{height:600px;overflow:auto;padding:20px}.design-question-group{margin-bottom:20px}#background-status{height:20px}</style></head><body${body}><main id="app"><div id="readingView"><div id="question-scroll">${html(['reading-headings'])}<div style="height:800px"></div><span id="background-status">Saved</span></div></div></main></body></html>`);
  await p.evaluate(()=>{const field=document.querySelector('select');field.value=field.options[1].value;field.focus();window.kept={field,flag:document.querySelector('[data-flag]'),stream:document.querySelector('#question-scroll').textContent};kept.flag.addEventListener('click',()=>kept.flag.setAttribute('aria-pressed','true'));});
  await p.evaluate(async url=>{window.layout=await import(url);window.stopLayout=layout.installQuestionLayout(document.body);},site.origin+'/shared/master170/question-layout-v1.1.mjs');
  await p.evaluate(()=>document.fonts.ready);
  assert.deepEqual(await p.evaluate(()=>({same:kept.field===document.querySelector('select'),focused:document.activeElement===kept.field,value:kept.field.value,stream:document.querySelector('#question-scroll').textContent===kept.stream})),{same:true,focused:true,value:'i',stream:true});
  for(const width of [1440,960,600,390,320]){
   await p.setViewportSize({width,height:1000});
   const result=await p.evaluate(()=>{const bank=document.querySelector('.cbt-option-bank'),q=bank.parentElement.firstElementChild,b=bank.getBoundingClientRect(),a=q.getBoundingClientRect(),s=getComputedStyle(bank),bad=[];for(const n of bank.querySelectorAll('h4,div>span')){const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.left<b.left+10||r.right>b.right-10)bad.push(n.textContent);}return{gap:b.left-a.right,top:b.top-a.top,padding:s.padding,overflow:document.documentElement.scrollWidth>innerWidth+1,bad};});
   assert.ok(result.gap>=10&&Math.abs(result.top)<2,JSON.stringify(result));assert.equal(result.overflow,false);assert.deepEqual(result.bad,[]);records.push({route,width,bank:result});
  }
  await p.setViewportSize({width:390,height:1000});
  await p.evaluate(()=>{const pane=document.querySelector('#question-scroll');pane.scrollTop=80;kept.field.focus();window.keptScroll=pane.scrollTop;});
  for(let pulse=0;pulse<3;pulse++){
   await p.evaluate(n=>{document.querySelector('#background-status').textContent='Saved '+n;layout.applyQuestionLayout(document.body);},pulse);
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.deepEqual(await p.evaluate(()=>({same:kept.field===document.querySelector('select')&&kept.flag===document.querySelector('[data-flag]'),focused:document.activeElement===kept.field,scroll:document.querySelector('#question-scroll').scrollTop,value:kept.field.value,wrappers:document.querySelectorAll('.m170-option-scroll').length})),{same:true,focused:true,scroll:await p.evaluate(()=>keptScroll),value:'i',wrappers:1});
  }
  await p.locator('[data-flag]').first().click();assert.equal(await p.locator('[data-flag]').first().getAttribute('aria-pressed'),'true');
  for(const id of ['reading-mcq','reading-diagram','reading-table']){
   await p.locator('#question-scroll').evaluate((e,value)=>{e.innerHTML=value;},html([id]));
   await p.evaluate(()=>layout.applyQuestionLayout(document.body));
   if(id==='reading-mcq')assert.equal(await p.locator('.cbt-question-card').first().evaluate(e=>getComputedStyle(e).borderLeftWidth),'0px');
   if(id==='reading-diagram')assert.equal(await p.locator('.authored-summary>p').first().evaluate(e=>getComputedStyle(e).borderBottomWidth),'0px');
   if(id==='reading-table'){const table=await p.locator('table').evaluate(e=>({marked:e.classList.contains('m170-completion-table'),min:getComputedStyle(e).minWidth,padding:getComputedStyle(e.querySelector('td')).padding,overflow:[...e.querySelectorAll('td')].some(c=>c.scrollWidth>c.clientWidth+1)}));assert.deepEqual(table,{marked:true,min:'0px',padding:'12px 9px',overflow:false});}
  }
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});
test('K56 remains outside the registered adapter',async()=>{
 const ctx=await browser.newContext(),p=await ctx.newPage();try{await p.goto(site.origin+'/');await p.setContent('<body data-izone-design="master170@1.1" data-izone-consumer="term-mini-k56"><div id="readingView"><div class="cbt-matching-layout"><section>Question</section><aside class="cbt-option-bank"><h4>Options</h4></aside></div></div></body>');
 const result=await p.evaluate(async url=>{const m=await import(url),before=document.body.innerHTML;return{applied:m.applyQuestionLayout(document.body),same:before===document.body.innerHTML,marked:document.body.classList.contains('m170-question-layout')};},site.origin+'/shared/master170/question-layout-v1.1.mjs');assert.deepEqual(result,{applied:false,same:true,marked:false});
 }finally{await ctx.close();}
});
test('inactive native Substitute parts get a right-hand bank before being shown',async()=>{
 const ctx=await browser.newContext({viewport:{width:390,height:900}}),p=await ctx.newPage();
 try{
  await p.goto(site.origin+'/');await p.setContent(`<html><head><link rel="stylesheet" href="${site.origin}/shared/master170/assessment-v1.1.css"></head><body data-izone-design="master170@1.1" data-izone-consumer="substitute-k67"><main id="readingView"><section id="inactive" hidden><div class="k67-matching-columns"><div>Question <select id="saved"><option selected>A</option></select></div><aside class="k67-option-bank"><h4>People</h4><p class="k67-option-line"><strong>A</strong><span>A fictional researcher with a long name</span></p></aside></div></section></main></body></html>`);
  const result=await p.evaluate(async url=>{const m=await import(url),node=document.querySelector('#saved'),text=document.querySelector('#inactive').textContent;m.applyQuestionLayout(document.body);document.querySelector('#inactive').hidden=false;const bank=document.querySelector('.k67-option-bank').getBoundingClientRect(),q=document.querySelector('.k67-matching-columns').firstElementChild.getBoundingClientRect();return{prepared:document.querySelector('.k67-matching-columns').classList.contains('m170-option-columns'),same:node===document.querySelector('#saved'),value:node.value,text:document.querySelector('#inactive').textContent===text,gap:bank.left-q.right,top:bank.top-q.top};},site.origin+'/shared/master170/question-layout-v1.1.mjs');
  assert.equal(result.prepared,true);assert.equal(result.same,true);assert.equal(result.value,'A');assert.equal(result.text,true);assert.ok(result.gap>=10&&Math.abs(result.top)<2,JSON.stringify(result));
 }finally{await ctx.close();}
});
