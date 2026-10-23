// Visual contract only: real legacy CSS plus the K67 font/color layer.
// Synthetic content; no learner, Google, AI, audio or production API requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {serve} from './helpers/result-details-browser-fixture.mjs';
const root=process.env.K67_STYLE_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const modules=process.env.CODEX_NODE_MODULES||join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(join(modules,'playwright/package.json')))('playwright');
const styles=['shared/styles.css','term-test-2-computer-based/styles.css','design-demo/skin.css','design-demo/theme.css','design-full/native.css','k67-design/appearance.css','k67-shared/answer-explanations.css','k67-design/master170-font-colors.css'];
let server,browser;
test.before(async()=>{server=await serve(root);browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await server?.close();});

test('K67 renders real Source Sans 3, role colors and preserves the existing type/box properties',async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 try{
  await context.route('**/*',r=>r.request().url().startsWith(server.base)?r.continue():r.abort());
  const page=await context.newPage();
  await page.route(server.base+'font-color-fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="vi" data-lab-option="reading"><head><meta charset="utf-8">${styles.map(s=>`<link rel="stylesheet" href="${server.base}term-tests/${s}">`).join('')}</head><body class="design67"><main>
   <span class="design-brand">IZONE</span>
   <p id="sample" class="cbt-passage-body">Tiếng Việt: đ Đ ă â ê ô ơ ư, giữ nguyên nội dung.</p>
   <p id="italic" class="writing-prompt-body"><em>Bài đọc có chữ nghiêng.</em></p>
   <section class="design-question-group"><div class="cbt-section-intro"><h3 id="questions">Questions 1–7</h3></div></section>
   <button id="primary" class="button button-primary">Nộp bài</button>
   <button id="active" class="cbt-question-button is-active">1</button>
   <button id="selected" class="cbt-question-button is-answered">2</button>
   <button id="flag" class="cbt-flag-button is-flagged">Cờ</button>
   <div class="cbt-inline-answer"><input id="control" value="Tiếng Việt"></div>
   <label id="choice" class="cbt-choice"><input type="radio" name="answer">Chưa chọn</label>
   <p id="success" class="notice success">Đã xác nhận lưu</p><p id="error" class="notice error">Chưa lưu được</p>
   <span id="pending" class="autosave-status" data-design-status="pending">Đang lưu</span>
   <span id="saved" class="autosave-status" data-design-status="saved">Đã lưu trên hệ thống</span>
   <dialog id="explanation-dialog" open><h2>Lời giải</h2><span id="authored" class="ex-bg-ffff00 ex-fg-ff0000">Dẫn chứng gốc</span><button class="explanation-open">Xem lời giải</button></dialog>
  </main></body></html>`}));
  await page.goto(server.base+'font-color-fixture');await page.evaluate(()=>document.fonts.ready);
  const result=await page.evaluate(async()=>{
   const properties=['fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','borderTopWidth','borderRightWidth','borderRadius','position','display','zIndex'];
   const nodes=[...document.querySelectorAll('main *')],read=()=>nodes.map(e=>{const s=getComputedStyle(e);return{family:s.fontFamily,values:properties.map(p=>s[p])};});
   const after=read(),sheet=[...document.styleSheets].find(s=>s.href?.includes('master170-font-colors.css'));
   if(!sheet)throw Error('Missing K67 stylesheet');
   sheet.disabled=true;const before=read();sheet.disabled=false;
   const changed=nodes.flatMap((e,i)=>properties.filter((p,j)=>after[i].values[j]!==before[i].values[j]).map(p=>({id:e.id,property:p})));
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await document.fonts.ready;
   const colors=Object.fromEntries(['sample','questions','primary','active','selected','flag','success','error','pending','saved','authored'].map(id=>{const s=getComputedStyle(document.getElementById(id));return[id,{fg:s.color,bg:s.backgroundColor}];}));
   return{changed,colors,borders:['control','choice'].map(id=>getComputedStyle(document.getElementById(id)).borderTopColor),font:getComputedStyle(document.querySelector('#sample')).fontFamily,questionSize:getComputedStyle(document.querySelector('#questions')).fontSize,brandBefore:before[nodes.indexOf(document.querySelector('.design-brand'))].family,brandAfter:after[nodes.indexOf(document.querySelector('.design-brand'))].family};
  });
  assert.deepEqual(result.changed,[]);assert.match(result.font,/Source Sans 3/);assert.equal(result.questionSize,'20px');assert.equal(result.brandBefore,result.brandAfter);
  assert.deepEqual(result.borders,['rgb(124, 135, 152)','rgb(124, 135, 152)']);
  assert.deepEqual(result.colors.sample,{fg:'rgb(31, 41, 55)',bg:'rgb(255, 255, 255)'});
  assert.deepEqual(result.colors.questions,{fg:'rgb(255, 255, 255)',bg:'rgb(23, 66, 101)'});
  assert.deepEqual(result.colors.primary,{fg:'rgb(255, 255, 255)',bg:'rgb(21, 43, 78)'});
  assert.deepEqual(result.colors.active,result.colors.primary);
  assert.deepEqual(result.colors.selected,{fg:'rgb(21, 43, 78)',bg:'rgb(237, 241, 247)'});
  assert.deepEqual(result.colors.flag,{fg:'rgb(138, 83, 0)',bg:'rgb(255, 244, 224)'});
  assert.deepEqual(result.colors.success,{fg:'rgb(22, 101, 52)',bg:'rgb(228, 245, 234)'});
  assert.deepEqual(result.colors.error,{fg:'rgb(155, 10, 34)',bg:'rgb(253, 232, 235)'});
  assert.deepEqual(result.colors.pending,{fg:'rgb(23, 66, 101)',bg:'rgb(230, 238, 245)'});
  assert.equal(result.colors.saved.fg,'rgb(22, 101, 52)');
  assert.deepEqual(result.colors.authored,{fg:'rgb(255, 0, 0)',bg:'rgb(255, 255, 0)'});
  await page.locator('#explanation-dialog').evaluate(e=>e.close());
  await page.locator('#primary').hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#primary')).backgroundColor==='rgb(16, 33, 60)');
  assert.equal(await page.locator('#primary').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(16, 33, 60)');
  await page.locator('#primary').focus();assert.equal(await page.locator('#primary').evaluate(e=>getComputedStyle(e).outlineColor),'rgb(219, 8, 41)');
  const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const doc=await cdp.send('DOM.getDocument');
  for(const selector of ['#sample','#italic em']){
   const node=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});
   const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});
   assert(fonts.some(f=>f.isCustomFont&&/SourceSans3/i.test(f.postScriptName)),JSON.stringify({selector,fonts}));
  }
 }finally{await context.close();}
});

test('K67 font/color CSS declares no layout, type-scale or interaction changes',async()=>{
 const css=(await readFile(join(root,'term-tests/k67-design/master170-font-colors.css'),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
 const allowed=new Set(['font-family','color','background-color','border-color','border-top-color','outline-color','accent-color','box-shadow']);
 for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  if(match[1].includes('@font-face'))continue;
  for(const declaration of match[2].split(';')){
   if(!declaration.trim())continue;const property=declaration.slice(0,declaration.indexOf(':')).trim();
   assert(property.startsWith('--')||allowed.has(property),'Outside font/color scope: '+property);
   if(property==='box-shadow')assert.equal(declaration.trim(),'box-shadow: inset 0 -3px var(--k67-attention-ink)');
  }
 }
});

test('K67 entry fonts load locally; shared demo and K56 never load this stylesheet',async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{
  await context.route('**/*',async r=>{
   if(r.request().url().includes('/api/'))return r.fulfill({status:503,json:{ok:false,message:'Isolated visual fixture'}});
   if(r.request().url().startsWith(server.base))return r.continue();
   return r.abort();
  });
  const page=await context.newPage();
  for(const entry of ['','teacher/','term-test-1-listening-retake/']){
   await page.goto(server.base+'term-tests/'+entry);await page.evaluate(()=>document.fonts.ready);
   assert.match(await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily),/Source Sans 3/);
   assert.equal(await page.locator('link[href*="k67-design/master170-font-colors.css"]').count(),1);
  }
  for(const entry of ['demo/','term-test-1-k56-computer-based/','teacher-k56/','substitute-test-1-k67-computer-based/']){
   await page.goto(server.base+'term-tests/'+entry);
   assert.equal(await page.locator('link[href*="k67-design/master170-font-colors.css"]').count(),0);
  }
 }finally{await context.close();}
});

test('Font failure keeps native text entry usable; zoom does not change the protected type scale',async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try{
  await context.route('**/*',r=>r.request().url().includes('SourceSans3-')?r.abort():r.request().url().startsWith(server.base)?r.continue():r.abort());
  const page=await context.newPage();
  await page.route(server.base+'fallback-fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="vi"><head><meta charset="utf-8">${styles.map(s=>`<link rel="stylesheet" href="${server.base}term-tests/${s}">`).join('')}</head><body class="design67"><main><div class="design-question-group"><div class="cbt-section-intro"><h3 id="questions">Questions 1–7</h3></div></div><label>Ghi chú <textarea id="note"></textarea></label><button id="action" type="button">Giữ nội dung</button></main></body></html>`}));
  await page.goto(server.base+'fallback-fixture');await page.evaluate(()=>document.fonts.ready);
  await page.locator('#note').fill('Nháp có dấu tiếng Việt vẫn giữ nguyên.');
  await page.locator('#action').click();assert.equal(await page.locator('#note').inputValue(),'Nháp có dấu tiếng Việt vẫn giữ nguyên.');
  assert.equal(await page.locator('#questions').evaluate(e=>getComputedStyle(e).fontSize),'20px');
  // CSS zoom is an isolated simulation, not a claim about a physical browser/device.
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  assert.equal(await page.locator('#questions').evaluate(e=>getComputedStyle(e).fontSize),'20px');
  assert.equal(await page.locator('#note').inputValue(),'Nháp có dấu tiếng Việt vẫn giữ nguyên.');
 }finally{await context.close();}
});

test('Landing and teacher legacy selectors use the same role colors',async()=>{
 const context=await browser.newContext({viewport:{width:1024,height:900}});
 try{
  await context.route('**/*',r=>r.request().url().startsWith(server.base)?r.continue():r.abort());
  const page=await context.newPage();
  for(const kind of ['landing','teacher']){
   const files=kind==='landing'?['shared/styles.css','k67-landing.css','reading-landing.css']:['shared/styles.css','teacher/styles.css','teacher/reading-appearance.css','shared/teacher-saved-progress.css'];
   await page.route(server.base+kind+'-roles',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head>${[...files,'k67-design/master170-font-colors.css'].map(s=>`<link rel="stylesheet" href="${server.base}term-tests/${s}">`).join('')}</head><body class="${kind==='landing'?'reading-landing':'teacher-reading'}">
    <main class="landing-card"><section class="landing-link-group"><h2 id="heading">Bài kiểm tra</h2></section><input id="field" value="Giữ nguyên chữ"><button id="primary" class="button button-primary">Tiếp tục</button><button id="order" class="button button-secondary order-choice" aria-pressed="true">Reading trước</button>
    <header class="writing-feedback-header"><h2 id="dialog-heading">Phân tích</h2></header><button id="toggle" class="writing-component-toggle">Xem phân tích</button><button id="scroll" class="teacher-tabs-scroll">›</button><button id="disabled" class="teacher-tabs-scroll" disabled>‹</button><div id="access" class="teacher-access-notice">Quyền truy cập</div>
    <span id="complete-dot" class="teacher-tab-status completed"></span><span id="incomplete-dot" class="teacher-tab-status incomplete"></span></main></body></html>`}));
   await page.goto(server.base+kind+'-roles');await page.evaluate(()=>document.fonts.ready);
   const color=async(id,property)=>page.locator('#'+id).evaluate((e,p)=>getComputedStyle(e)[p],property);
   assert.equal(await color('heading','color'),'rgb(23, 66, 101)',kind+' structure heading');
   assert.equal(await color('field','borderTopColor'),'rgb(124, 135, 152)',kind+' control border');
   await page.locator('#field').focus();assert.equal(await color('field','borderTopColor'),'rgb(21, 43, 78)',kind+' focus border');
   if(kind==='landing'){
    await page.locator('#order').hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#order')).backgroundColor==='rgb(16, 33, 60)');
   }else{
    assert.equal(await color('dialog-heading','color'),'rgb(23, 66, 101)');
    assert.equal(await color('toggle','borderTopColor'),'rgb(124, 135, 152)');
    assert.equal(await color('access','backgroundColor'),'rgb(255, 244, 224)');
    assert.equal(await color('complete-dot','backgroundColor'),'rgb(22, 101, 52)');
    assert.equal(await color('incomplete-dot','backgroundColor'),'rgb(138, 83, 0)');
    assert.equal(await color('disabled','backgroundColor'),'rgb(234, 237, 242)');
    assert.equal(await color('disabled','color'),'rgb(88, 100, 119)');
    await page.locator('#scroll').hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#scroll')).backgroundColor==='rgb(16, 33, 60)');
   }
  }
 }finally{await context.close();}
});
