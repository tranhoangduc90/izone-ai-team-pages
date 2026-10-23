// Hợp đồng nhìn thấy được: font/token thực nạp, reflow, cùng control khi đổi vùng,
// đáp án/annotation/scroll còn nguyên. Không kiểm tên hàm hay cách viết CSS.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium,serve,readingPage,slugs,completedPage} from './helpers/k56-design-fixture.mjs';
let browser, server;
const baseline = process.env.K56_DESIGN_BASELINE === '1';
const output = resolve(process.env.K56_DESIGN_OUTPUT || 'output/playwright/k56-master170');
before(async()=>{await mkdir(output,{recursive:true});server=await serve();browser=await chromium.launch({channel:'msedge',headless:true});});
after(async()=>{await browser?.close();await server?.close();});
for(const slug of slugs) test(slug+': Reading giữ control/đáp án khi reflow',async()=>{
  const f=await readingPage(browser,server.base,slug);
  try {
    await f.page.screenshot({path:resolve(output,slug+'-reading-desktop.png')});
    if(!baseline)for(const [width,height] of [[1366,768],[1280,720]]){
      await f.page.setViewportSize({width,height});
      assert.equal(await f.page.locator('#readingView').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),true,'Reading bị cắt thanh số câu ở laptop');
    }
    await f.page.setViewportSize({width:1366,height:768});
    if(baseline)return;
    const theme=await f.page.evaluate(()=>({font:getComputedStyle(document.body).fontFamily,bg:getComputedStyle(document.body).backgroundColor,loaded:document.fonts.check('400 18px "Source Sans 3"')}));
    assert.match(theme.font,/Source Sans 3/);assert.equal(theme.bg,'rgb(245, 246, 248)');assert.equal(theme.loaded,true);
    assert.deepEqual(await f.page.locator('.cbt-passage-body p').first().evaluate(el=>({align:getComputedStyle(el).textAlign,last:getComputedStyle(el).textAlignLast})),{align:'justify',last:'left'});
    const section=f.page.locator('.cbt-reading-section:not([hidden])');
    const sizes=await section.evaluate(el=>[...el.children].map(n=>n.getBoundingClientRect().width));
    assert(Math.abs(sizes[0]/(sizes[0]+sizes[1])-.5)<.01);
    await section.locator('.cbt-reading-questions input:visible,.cbt-reading-questions select:visible').first().evaluate(el=>{window.originalK56Field=el;el.dataset.fixtureIdentity='same-node';});
    const field=f.page.locator('[data-fixture-identity="same-node"]');
    const save=f.page.waitForResponse(response=>response.url().endsWith('/reading/draft')&&response.request().method()==='POST');
    if(await field.getAttribute('type')==='radio')await field.check();
    else if(await field.evaluate(el=>el.tagName)==='SELECT')await field.selectOption({index:1});
    else await field.fill('DRAFT');
    await save;
    const answer=await field.inputValue();
    for(const width of [981,980,979,801,800,799,390,320,844]){
      await f.page.setViewportSize({width,height:width===844?390:844});
      assert.equal(await section.locator('.cbt-reading-passage').isVisible(),true);
      assert.equal(await section.locator('.cbt-reading-questions').isVisible(),true);
      assert.equal(await f.page.locator('.k56-reading-switch').count(),0);
      assert.equal(await field.evaluate(el=>el===window.originalK56Field),true);
      assert.equal(await field.inputValue(),answer);
      if(await field.getAttribute('type')==='radio')assert.equal(await field.isChecked(),true);
      assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Trang tràn ngang ở '+width);
    }
    await f.page.setViewportSize({width:390,height:844});
    await f.page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await f.page.screenshot({path:resolve(output,slug+'-reading-mobile.png')});
    assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});
test('Reading: Note giữ nguyên khi cuộn hai vùng và reload',async()=>{
  const f=await readingPage(browser,server.base,'term-test-2-k56');
  try{
    await f.page.setViewportSize({width:390,height:844});
    const passage=f.page.locator('.cbt-reading-section:not([hidden]) .cbt-passage-body');
    await passage.locator('p').first().evaluate(el=>{
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
      while((node=walker.nextNode()))if(node.textContent.trim().length>25)break;
      const range=document.createRange();range.setStart(node,0);range.setEnd(node,25);
      const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await f.page.locator('#cbtSelectionMenu').getByRole('button',{name:'Note',exact:true}).click();
    await f.page.locator('.cbt-note-editor').fill('Ghi chú giả cần giữ qua đổi vùng và tải lại.');
    await f.page.getByRole('button',{name:'Đóng Notes',exact:true}).click();
    const marks=await passage.locator('[data-annotation-ids]').count();assert(marks>0);
    await f.page.locator('.cbt-reading-section:not([hidden]) .cbt-reading-questions').evaluate(el=>{el.scrollTop=150;});
    await passage.evaluate(el=>el.parentElement.scrollTop=120);
    assert.equal(await passage.locator('[data-annotation-ids]').count(),marks);
    await f.page.reload();await f.page.locator('#readingView').waitFor({state:'visible'});
    await f.page.locator('#readingView .cbt-notes-open').click();
    await f.page.locator('.cbt-note-list-item').first().click();
    assert.equal(await f.page.locator('.cbt-note-editor').inputValue(),'Ghi chú giả cần giữ qua đổi vùng và tải lại.');
    assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});
for(const slug of slugs)for(const mode of ['lis_first','read_first'])test(slug+'/'+mode+': phiếu giữ đủ control và thứ tự khi reflow',async()=>{
  const f=await readingPage(browser,server.base,slug,mode,'');
  try{
    const expected=slug==='term-test-1-k56'?26:slug==='term-test-2-k56'?40:13;
    const fields=f.page.locator('#readingQuestions [data-number]');
    assert.equal(await fields.count(),expected);
    const numbers=await fields.evaluateAll(nodes=>nodes.map(n=>n.dataset.number));
    assert.deepEqual(numbers,Array.from({length:expected},(_,i)=>String(i+1)));
    for(const width of [1366,390,320]){
      await f.page.setViewportSize({width,height:844});
      assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    }
    await f.page.screenshot({path:resolve(output,slug+'-paper-'+mode+'.png')});
    assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});
for(const slug of slugs)test(slug+': Writing đúng vùng đề/editor và giữ node khi đổi breakpoint',async()=>{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1366,height:768}});
  try{
    await context.route('**/*',route=>route.request().url().startsWith(server.base)?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(server.base+'term-tests/'+slug+'-computer-based/?demo=writing&class=CODEXDEMO56');
    await page.locator('#writingView').waitFor({state:'visible'});
    await page.evaluate(()=>document.fonts.ready);
    const split=page.locator('.writing-split').first();
    const ratio=await split.evaluate(el=>el.querySelector('.writing-prompt-pane').getBoundingClientRect().width/el.getBoundingClientRect().width);
    assert(Math.abs(ratio-(slug==='term-test-1-k56'?.44:.5))<.02);
    assert.equal(await page.locator('#writingView').evaluate(el=>{
      const footer=el.querySelector('.writing-editor-meta'),workspace=el.querySelector('.writing-workspace');
      return footer.getBoundingClientRect().bottom<=workspace.getBoundingClientRect().bottom+1&&workspace.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+1;
    }),true,'Dòng tự lưu/số từ bị cắt bởi khung Writing');
    const editor=page.locator('[data-writing-task]').first();
    await editor.evaluate(el=>window.originalWritingEditor=el);
    for(const [width,height] of [[1366,768],[1280,720]]){
      await page.setViewportSize({width,height});
      assert.equal(await page.locator('#writingView').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),true,'Writing bị cắt footer ở laptop');
    }
    await page.setViewportSize({width:1366,height:768});
    await page.screenshot({path:resolve(output,slug+'-writing-desktop.png')});
    for(const width of [1001,1000,999,621,620,619,390,320]){
      await page.setViewportSize({width,height:844});
      assert.equal(await editor.evaluate(el=>el===window.originalWritingEditor),true);
      if(width<=620){
        const bounds=await split.evaluate(el=>[el.querySelector('.writing-prompt-pane').getBoundingClientRect().bottom,el.querySelector('.writing-answer-pane').getBoundingClientRect().top]);
        assert(bounds[1]>=bounds[0]-1);
      }
      assert.equal(await page.locator('#writingView').evaluate(el=>el.querySelector('.writing-editor-meta').getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+1),true,'Writing không bao đủ nội dung '+width);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Writing tràn ngang '+width);
    }
    await page.screenshot({path:resolve(output,slug+'-writing-mobile.png'),fullPage:true});
  }finally{await context.close();}
});
for(const slug of slugs)test(slug+': Writing không cắt vùng xung đột dài',async()=>{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1366,height:768}});
  try{
    await context.route('**/*',r=>r.request().url().startsWith(server.base)?r.continue():r.abort());
    const page=await context.newPage();
    await page.goto(server.base+'term-tests/'+slug+'-computer-based/?demo=writing&class=CODEXDEMO56');
    await page.locator('#writingView').waitFor({state:'visible'});
    // Chỉ fixture bố cục: mở panel/controls thật và cùng cấu trúc preview của renderer.
    // Không giả một phản hồi API hoặc tuyên bố đã kiểm xử lý revision/conflict.
    await page.locator('#writingConflict').evaluate(panel=>{
      panel.hidden=false;
      const container=panel.querySelector('[id$=ConflictDrafts]');
      for(const title of ['Bản đang viết trên máy','Bản đã lưu trên hệ thống']){
        const heading=document.createElement('h4');heading.textContent=title;container.append(heading);
        for(const name of ['Bài viết','Dàn ý giữ trên máy']){
          const label=document.createElement('label');label.textContent=name;
          const text=document.createElement('textarea');text.readOnly=true;text.value=('Nội dung giả đủ dài để kiểm phần đối chiếu. ').repeat(80);
          label.append(text);container.append(label);
        }
      }
    });
    for(const [width,height] of [[1366,768],[1280,720],[390,844]]){
      await page.setViewportSize({width,height});
      const clipped=await page.locator('#writingConflict .form-actions').evaluate(el=>{
        const r=el.getBoundingClientRect();
        for(let p=el.parentElement;p;p=p.parentElement){
          if(/^(hidden|clip)$/.test(getComputedStyle(p).overflowY)){
            const a=p.getBoundingClientRect();if(r.top<a.top-1||r.bottom>a.bottom+1)return true;
          }
        }
        return false;
      });
      assert.equal(clipped,false,'Hai nút xử lý xung đột bị khung Writing cắt ở '+width);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    }
    await page.screenshot({path:resolve(output,slug+'-writing-conflict-mobile.png'),fullPage:true});
  }finally{await context.close();}
});
for(const slug of slugs)for(const delivery of ['','-computer-based'])for(const mode of ['lis_first','read_first'])test(slug+delivery+'/'+mode+': theme và kết quả cũ đúng bài, không gửi lại',async()=>{
  const sectionTotals={listening:slug==='mini-test-k56'?10:40,reading:slug==='term-test-1-k56'?26:slug==='term-test-2-k56'?40:13};
  const f=await completedPage(browser,server.base,slug+delivery,{examMode:mode,waitTimeout:15000,sectionTotals});
  try{
    assert.equal(await f.page.locator('body[data-k56-design]').count(),1);
    assert.equal(await f.page.locator('.k56-brand img').count(),1);
    assert.equal(await f.page.locator('#resultStudentName').innerText(),'Học viên giả A');
    const summary=await f.page.locator('.summary-grid').innerText();
    for(const total of Object.values(sectionTotals))assert.match(summary,new RegExp('0\\s*/\\s*'+total+'\\b'),'Hiển thị đúng tổng câu của từng bài');
    assert(!f.requests.some(url=>/\/(listening|reading|writing)$/.test(url)));
    assert.deepEqual(f.errors,[]);
    if(mode==='lis_first'&&delivery)await f.page.screenshot({path:resolve(output,slug+'-result.png')});
  }finally{await f.close();}
});
for(const slug of slugs)test(slug+': Listening qua phòng chờ, không thêm nghe lại/tua và giữ dạng câu',async()=>{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1366,height:768}});
  let page;
  try{
    // Media giả để kiểm DOM/điều khiển; không chứng minh âm thanh trên thiết bị thật.
    await context.addInitScript(()=>{
      const state=new WeakMap(),get=el=>{if(!state.has(el))state.set(el,{time:0,started:0,paused:true,src:''});return state.get(el);};
      Object.defineProperties(HTMLMediaElement.prototype,{
        duration:{get:()=>window.TERM_TEST_CONFIG?.listening?.durationSeconds||1848},readyState:{get:()=>4},ended:{get:()=>false},
        paused:{get(){return get(this).paused;}},src:{get(){return get(this).src;},set(value){get(this).src=value;}},
        currentTime:{get(){const s=get(this);return s.time+(s.paused?0:(performance.now()-s.started)/1000);},set(value){const s=get(this);s.time=Number(value);s.started=performance.now();}}
      });
      HTMLMediaElement.prototype.load=function(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));};
      HTMLMediaElement.prototype.play=async function(){const s=get(this);s.paused=false;s.started=performance.now();this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));};
      HTMLMediaElement.prototype.pause=function(){const s=get(this);s.time=this.currentTime;s.paused=true;this.dispatchEvent(new Event('pause'));};
    });
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/content.js'))return route.fulfill({contentType:'text/javascript',body:(await readFile('term-tests/'+slug+'-computer-based/content.js','utf8'))+`;window.K56_TERM_TEST_CONTENT=Object.freeze({...window.K56_TERM_TEST_CONTENT,audio:{...window.K56_TERM_TEST_CONTENT.audio,src:'/fixture-audio.mp3'}});`});
      if(/\.mp3$/.test(url.pathname))return route.fulfill({contentType:'audio/mpeg',body:Buffer.alloc(128)});
      return url.href.startsWith(server.base)?route.continue():route.abort();
    });
    page=await context.newPage();page.setDefaultTimeout(15000);
    await page.goto(server.base+'term-tests/'+slug+'-computer-based/?demo=exam&class=CODEXDEMO56');
    await page.locator('#bootstrapStudent').selectOption({index:1});await page.locator('#confirmIdentity').click();
    await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();
    const form=page.locator('#listeningView');await form.locator('.cbt-listening-section:not([hidden])').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await form.locator('[data-nav-number]').count(),slug==='mini-test-k56'?10:40);
    if(slug==='term-test-1-k56'){
      assert.equal(await form.locator('[data-number="32a"]').count(),1);assert.equal(await form.locator('[data-number="32b"]').count(),1);assert.equal(await form.locator('[data-nav-number="32"]').count(),1);
    }
    await page.screenshot({path:resolve(output,slug+'-listening-desktop.png')});
    for(const width of [1366,390,320]){
      await page.setViewportSize({width,height:844});
      for(const button of await form.locator('.cbt-part-button').all()){
        await button.click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,slug+' Listening tràn ngang '+width);
      }
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:resolve(output,slug+'-listening-mobile.png')});
  }catch(error){
    if(page){await page.screenshot({path:resolve(output,slug+'-listening-harness-error.png')}).catch(()=>{});console.error(error.message,await page.locator('body').innerText().catch(()=>''));}
    throw error;
  }finally{await context.close();}
});
