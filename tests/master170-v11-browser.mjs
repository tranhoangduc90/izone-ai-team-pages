// Native stylesheet chains with synthetic assessment markup. No business API.
// Actual Homework renderer/repair/history tests are separate existing suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const modulePath=process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(modulePath).href);
const out=process.env.MASTER11_EVIDENCE_DIR||path.join(root,'output/playwright/master170-v11');
const base=process.env.MASTER11_BASE_REVISION;
const nativeFiles=['reading-practice/index.html','listening-practice/index.html','term-tests/term-test-1-computer-based/index.html','term-tests/term-test-2-computer-based/index.html','term-tests/mini-test-lesson-5-computer-based/index.html'];
const widths=[1440,1201,1200,1199,1024,981,980,979,800,799,620,600,390,320];
let site,browser;
const records=[];
test.before(async()=>{await fs.mkdir(out,{recursive:true});site=await serveDirectory(root);browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await fs.writeFile(path.join(out,base?'baseline.json':'native-profile.json'),JSON.stringify(records,null,2));await browser?.close();await site?.close();});
for(const route of nativeFiles)test(route+': one row, native scale/focus and local icons across breakpoints',async()=>{
 const source=base?execFileSync('git',['-C',root,'show',base+':'+route],{encoding:'utf8'}):await fs.readFile(path.join(root,route),'utf8');
 const links=[...source.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('\n');
 const body=source.match(/<body\b([^>]*)>/i)[1];
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===site.origin?r.continue():r.abort());
 if(process.env.MASTER11_CSS_OVERRIDE){const css=await fs.readFile(process.env.MASTER11_CSS_OVERRIDE,'utf8');await ctx.route('**/shared/master170/assessment-v1.1.css*',r=>r.fulfill({contentType:'text/css',body:css}));}
 try{
  const p=await ctx.newPage();await p.goto(site.origin+'/');
  await p.setContent(`<!doctype html><html lang="vi" data-izone-theme="master170" data-lab-option="reading"><head><meta charset="utf-8"><base href="${site.origin+'/'+route}">${links}</head><body${body}><main id="app"><section class="test-panel" id="readingView"><header class="cbt-test-heading"><h2>Bản thử giao diện, không phải bài thi</h2></header><div class="cbt-content-viewport" data-font-size="100" style="font-size:16px"><div class="cbt-question-card"><div class="cbt-question-heading"><p>Tiếng Việt: đọc và chọn câu trả lời.</p><button type="button" class="cbt-flag-button" aria-label="Đánh dấu câu 1" aria-pressed="false">⚑</button></div><label class="cbt-choice"><input type="radio" name="q1"><span>Lựa chọn tiếng Việt có dấu và nội dung đủ dài.</span></label><span class="cbt-inline-answer"><input class="cbt-answer-input" aria-label="Câu 2"></span><span class="cbt-select-answer"><select class="cbt-answer-select" aria-label="Câu 3"><option>Nhấn để chọn</option></select></span><button id="action">Nộp bài</button></div></div><footer class="cbt-question-nav-wrap"><nav class="cbt-question-nav" aria-label="Đi đến câu hỏi">${Array.from({length:40},(_,i)=>`<button type="button" class="cbt-question-button" aria-label="Câu ${i+1}">${i+1}</button>`).join('')}</nav></footer></section></main></body></html>`);
  await p.evaluate(isListening=>{document.body.classList.add('reading','cbt-mode');if(isListening)document.body.classList.add('listening-full-test');},route.startsWith('listening'));
  if(!base)await p.evaluate(async url=>{await import(url);},site.origin+'/shared/master170/assessment-v1.1.mjs');
  await p.evaluate(()=>document.fonts.ready);
  for(const width of widths){
   await p.setViewportSize({width,height:900});
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const geometry=await p.locator('.cbt-question-nav').evaluate(e=>({rows:new Set([...e.children].map(b=>Math.round(b.getBoundingClientRect().top))).size,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth+1}));
   records.push({route,width,...geometry});
   assert.equal(geometry.rows,1,`${route} ${width}: contiguous one-row question map`);
   assert.equal(geometry.pageOverflow,false,`${route} ${width}: internal rather than document overflow`);
   const last=p.getByRole('button',{name:'Câu 40',exact:true});await last.focus();
   const focused=await last.evaluate(e=>{const r=e.getBoundingClientRect(),n=e.parentElement.getBoundingClientRect();return {visible:r.left>=n.left-1&&r.right<=n.right+1,left:r.left,right:r.right,navLeft:n.left,navRight:n.right,scroll:e.parentElement.scrollLeft};});
   if(!focused.visible)await p.screenshot({path:path.join(out,route.replaceAll('/','-')+'-failure-'+width+'.png')});
   assert.ok(focused.visible,'Keyboard focus reveals question 40 '+JSON.stringify({width,...focused}));
   if(width===1440||width===390)await p.screenshot({path:path.join(out,route.replaceAll('/','-')+'-'+width+'.png')});
  }
  await p.setViewportSize({width:1440,height:900});
  for(const scale of [90,100,110,120]){
   await p.locator('.cbt-content-viewport').evaluate((e,s)=>{e.style.fontSize=16*s/100+'px';e.dataset.fontSize=String(s);},scale);
   const control=await p.locator('.cbt-answer-input').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
   assert.ok(Math.abs(control-14.08*scale/100)<.03,JSON.stringify({route,scale,control}));
  }
  await p.locator('#action').focus();await p.keyboard.press('Shift+Tab');
  const focus=await p.locator('select').evaluate(e=>({focused:document.activeElement===e,outline:getComputedStyle(e).outlineStyle,shadow:getComputedStyle(e).boxShadow}));
  assert.equal(focus.focused,true);assert.equal(focus.outline,'none');assert.notEqual(focus.shadow,'none');
  const icon=await p.locator('.cbt-flag-button').evaluate(e=>{const c=getComputedStyle(e,'::before');return{mask:c.maskImage,width:c.width,height:c.height,name:e.getAttribute('aria-label')};});
  assert.match(icon.mask,/icons\/flag\.svg/);assert.equal(icon.width,'16px');assert.equal(icon.height,'16px');assert.equal(icon.name,'Đánh dấu câu 1');
  assert.equal((await ctx.request.get(site.origin+'/shared/master170/icons/flag.svg')).status(),200);
  await p.evaluate(()=>{const d=document.createElement('dialog');d.id='explanation-dialog';d.setAttribute('aria-labelledby','fixture-dialog-title');d.innerHTML='<div class="explanation-dialog-shell"><header class="explanation-dialog-header"><h2 id="fixture-dialog-title">Lời giải minh họa</h2><button type="button" class="explanation-dialog-close" aria-label="Đóng giải thích">×</button></header><p>Nội dung giả để kiểm nút đóng.</p><footer class="explanation-dialog-footer"><button type="button">← Câu trước</button><button type="button">Câu sau →</button></footer></div>';document.body.append(d);d.showModal();});
  const close=p.getByRole('button',{name:'Đóng giải thích',exact:true});
  const closeStyle=await close.evaluate(e=>{const c=getComputedStyle(e),icon=getComputedStyle(e,'::before');return{font:c.fontSize,display:c.display,mask:icon.maskImage,width:icon.width,height:icon.height};});
  assert.equal(closeStyle.font,'0px','Legacy × glyph is visually suppressed; only one SVG close icon');
  assert.ok(['flex','inline-flex'].includes(closeStyle.display));assert.match(closeStyle.mask,/icons\/close\.svg/);
  assert.equal(closeStyle.width,'18px');assert.equal(closeStyle.height,'18px');
  if(!base){await p.locator('[data-m170-icon="previous"]').waitFor();assert.equal(await p.getByRole('button',{name:'Câu trước',exact:true}).count(),1);assert.equal(await p.locator('[data-m170-icon="next"] svg use').count(),1);}
  await p.screenshot({path:path.join(out,route.replaceAll('/','-')+'-popup-close.png')});
 }finally{await ctx.close();}
});

test('Homework uses the approved 18px renderer, shared profile, and local flag asset',async()=>{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===site.origin?r.continue():r.abort());
 try{const p=await ctx.newPage();await p.goto(site.origin+'/listening-homework/preview.html');await p.locator('#entry-submit').click();await p.locator('#field-D1').waitFor();await p.evaluate(()=>document.fonts.ready);
  assert.equal(await p.locator('body').getAttribute('data-izone-ui-profile'),'skill-homework');
  assert.equal(await p.locator('#field-D1').evaluate(e=>getComputedStyle(e).fontSize),'18px');
  await p.locator('[data-flag="D1"]').click();assert.equal(await p.locator('[data-flag="D1"]').getAttribute('aria-pressed'),'true');
  await p.screenshot({path:path.join(out,'homework-native-1440.png')});
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,'homework-native-390.png')});
  await p.locator('#next').click();await p.getByRole('button',{name:'Sang câu 25 →',exact:true}).waitFor();
  await p.locator('#next').click();await p.getByRole('button',{name:'Rà lại các mục',exact:true}).waitFor();
  assert.equal(await p.getByRole('button',{name:'Sang câu 24 →',exact:true}).count(),0,'Chapter changes discard only stale helper-generated names');
 }finally{await ctx.close();}
});

test('Presentation observers preserve reading state through unchanged background updates',async()=>{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 try{
  const p=await ctx.newPage();await p.goto(site.origin+'/');
  await p.setContent(`<html><head><link rel="stylesheet" href="${site.origin}/shared/master170/assessment-v1.1.css"></head><body data-izone-design="master170@1.1" data-izone-ui-profile="exam-compact"><main id="readingView"><div id="passage" style="height:150px;overflow:auto"><p id="selected">Đoạn đang đọc được giữ nguyên qua cập nhật nền.</p><div style="height:1200px"></div></div><button class="cbt-tool-button" id="notes">Notes</button><input id="answer" value="Câu trả lời đang sửa"><span id="save">Đã lưu</span><nav class="cbt-question-nav">${Array.from({length:40},(_,i)=>`<button class="cbt-question-button">${i+1}</button>`).join('')}</nav></main></body></html>`);
  await p.evaluate(()=>{window.originalButton=document.querySelector('#notes');window.clicks=[];originalButton.addEventListener('click',e=>clicks.push(e.target===originalButton));});
  await p.evaluate(async url=>{await import(url);},site.origin+'/shared/master170/assessment-v1.1.mjs');
  await p.locator('#notes svg').waitFor();await p.locator('#notes svg').click({force:true});
  assert.deepEqual(await p.evaluate(()=>clicks),[true],'Decorative icon keeps the native button as event target');
  await p.evaluate(()=>{
   const field=document.querySelector('#answer');field.focus();field.setSelectionRange(3,9);document.querySelector('#passage').scrollTop=75;
   const range=document.createRange();range.selectNodeContents(document.querySelector('#selected'));getSelection().removeAllRanges();getSelection().addRange(range);
   window.kept={button:document.querySelector('#notes'),answer:field,paragraph:document.querySelector('#selected')};
  });
  const before=await p.evaluate(()=>({start:kept.answer.selectionStart,end:kept.answer.selectionEnd}));
  for(let tick=0;tick<3;tick++){
   await p.locator('#save').evaluate((e,n)=>{e.textContent='Đã lưu '+n;},tick);
   await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const state=await p.evaluate(()=>({same:kept.button===document.querySelector('#notes')&&kept.answer===document.querySelector('#answer')&&kept.paragraph===document.querySelector('#selected'),focus:document.activeElement.id,start:kept.answer.selectionStart,end:kept.answer.selectionEnd,scroll:document.querySelector('#passage').scrollTop,selection:getSelection().toString(),icons:kept.button.querySelectorAll('svg').length}));
   assert.deepEqual(state,{same:true,focus:'answer',...before,scroll:75,selection:'Đoạn đang đọc được giữ nguyên qua cập nhật nền.',icons:1});
  }
  // Text-field selection is a separate native selection context in Chromium.
  await p.evaluate(()=>{getSelection().removeAllRanges();kept.answer.setSelectionRange(3,9);});
  for(let tick=0;tick<3;tick++){
   await p.locator('#save').evaluate((e,n)=>{e.textContent='Đã lưu lượt '+n;},tick);
   await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.deepEqual(await p.locator('#answer').evaluate(e=>[document.activeElement===e,e.selectionStart,e.selectionEnd,e.value]),[true,3,9,'Câu trả lời đang sửa']);
  }
  await p.evaluate(()=>{const n=document.createElement('nav');n.className='repair-navigation';n.innerHTML='<button data-repair-direction="-1" aria-label="Phần cần sửa trước">← Trước</button><button data-repair-direction="1" aria-label="Phần cần sửa tiếp theo">Tiếp →</button><button class="replay-button">▷ Nghe lại đoạn dẫn chứng</button>';document.body.append(n);});
  await p.locator('[data-repair-direction="1"] svg').waitFor();
  assert.equal(await p.locator('[data-repair-direction="-1"] svg use').getAttribute('href'),site.origin+'/shared/master170/icons.svg?v=20261028-master11#previous');
  assert.equal(await p.locator('[data-repair-direction="1"]').evaluate(e=>e.lastElementChild.tagName.toLowerCase()),'svg');
  await p.locator('.replay-button[data-m170-icon="play"]').waitFor();
  await p.evaluate(()=>{const b=document.createElement('button');b.id='entry-fixture';b.textContent='Bắt đầu làm bài →';document.body.append(b);});
  await p.locator('#entry-fixture svg').waitFor();
  assert.equal(await p.getByRole('button',{name:'Bắt đầu làm bài →',exact:true}).count(),1,'Native accessible names remain stable when a glyph becomes SVG');
 }finally{await ctx.close();}
});
