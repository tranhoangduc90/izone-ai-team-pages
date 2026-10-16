import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const baseUrl=new URL(process.env.K67_PREVIEW_URL||'http://127.0.0.1:8877');
assert.equal(baseUrl.hostname,'127.0.0.1');assert.equal(baseUrl.protocol,'http:');
const base=baseUrl.origin;
const out=process.env.K67_ORDER_EVIDENCE_DIR||'E:/Codex-Data/k67-reading-first-plan-20261014/preview-evidence';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:process.env.K67_BROWSER_HEADED!=='true',...(process.env.K67_BROWSER_CHANNEL?{channel:process.env.K67_BROWSER_CHANNEL}:{executablePath:process.env.CHROME_BIN||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'})});
const ref=process.env.K67_TEST_STUDENT_REF||'11111111-1111-4111-8111-111111111111',classCode=process.env.K67_TEST_CLASS||'IC2304';
const results=[];
// Trình duyệt và API thật trên localhost. Chặn mọi kết nối ra ngoài để không nhận/gửi bài thật.
// Mỗi ca có kho riêng; nút reset chỉ xóa PostgreSQL nhúng của tiến trình bản thử.
async function context(){const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());return ctx;}
async function answer(page,skill){const fields=page.locator(`#${skill}View [data-number]`);
  const first=fields.first();await first.waitFor({state:'attached'});
  if(!await first.isVisible()) {
    const number=await first.getAttribute('data-number');
    await page.locator(`#${skill}View input[aria-label^="Câu ${number}, đáp án"], #${skill}View input[aria-label^="Câu ${number}–"]`).first().check();return;
  }
  if(await first.evaluate(el=>el.tagName)==='SELECT'){const value=await first.locator('option').nth(1).getAttribute('value');await first.selectOption(value);}
  else await first.fill('A');}
async function listening(page,cbt,file){if(cbt){await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();}
  if(cbt&&process.env.K67_START_RESPONSE_LOSS==='true'){
    // Start thật đã commit rồi mất response: giữ bài trước retry và đi tiếp đến kết quả cuối.
    await page.locator('#bootstrapNotice').filter({hasText:'Mất phản hồi start mô phỏng'}).waitFor();
    const data=await page.evaluate(()=>({examSessionToken:window.K67_AUDIO_OWNER.token,...window.K67_AUDIO_OWNER.fields()}));
    const response=await page.context().request.post(base+`/api/term-tests/${new URL(page.url()).pathname.split('/').filter(Boolean).at(-1).replace('-computer-based','')}/session/audio-access`,{data});
    assert.equal(response.status(),200);const held=await response.json();assert.ok(held.listeningStartedAt);assert.ok(held.activeIncident?.startup);
    await page.waitForTimeout(1500);await page.locator('#bootstrapStart').click();
  }
  await page.locator('#listeningView').waitFor({state:'visible'});await answer(page,'listening');
  if(cbt&&process.env.K67_AUDIO_ACCEPTANCE==='true'){
    // Đi bằng nút thật: giữ bài, đóng/mở lại trang, nghe thử, xác nhận rồi mới nộp.
    const field=page.locator('#listeningQuestions [data-number]').first(),value=await field.inputValue();
    const number=await field.getAttribute('data-number');await page.locator('#k67ReportAudio').click();
    await page.waitForFunction(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident);
    const before=await page.evaluate(()=>{const s=window.K67_ACTIVE_LISTENING.getSnapshot();return{incident:s.activeIncident.incidentId,anchor:s.activeIncident.anchorSeconds,recovery:s.listeningRecoverySeconds};});
    assert.equal(await page.locator('#submitListening').isDisabled(),true);await page.waitForTimeout(1500);
    await page.reload();await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
    assert.equal(await page.locator(`#listeningQuestions [data-number="${number}"]`).first().inputValue(),value);
    assert.equal(await page.evaluate(()=>window.K67_ACTIVE_LISTENING.getSnapshot().activeIncident.incidentId),before.incident);
    await page.locator('#k67TestSound').click();await page.locator('#k67ResumeAudio').click();await page.waitForFunction(()=>!window.K67_ACTIVE_LISTENING.isHeld());
    const after=await page.evaluate(()=>{const s=window.K67_ACTIVE_LISTENING.getSnapshot();return{recovery:s.listeningRecoverySeconds,position:window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime};});
    assert.ok(after.recovery>=before.recovery+1);assert.ok(Math.abs(after.position-before.anchor)<3);
  }
  if(cbt&&process.env.K67_WAIT_AUDIO_END==='true')await page.waitForFunction(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.ended,null,{timeout:120000});
  if(file)await page.screenshot({path:path.join(out,file),fullPage:true});
  await page.locator('#submitListening').click();}
async function reading(page,file){await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
  await answer(page,'reading');if(file)await page.screenshot({path:path.join(out,file),fullPage:true});await page.locator('#submitReading').click();}
try{
  const ctx=await context(),page=await ctx.newPage();await page.goto(base+'/term-tests/');
  for(const width of [390,699,700,701,1280]){
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`landing ${width}`);
    const cols=await page.locator('.landing-actions-three').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(cols,width<=700?1:3);
    if(width===390||width===1280)await page.screenshot({path:path.join(out,`landing-${width}.png`),fullPage:true});
  }
  await page.locator('[data-exam-mode="read_first"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-exam-mode="read_first"]').getAttribute('aria-pressed'),'true');
  await page.locator('#classCode').fill(classCode);
  for(const mode of ['read_first','lis_first'])for(const target of ['term-test-1-computer-based','term-test-2-computer-based','mini-test-lesson-5-computer-based','term-test-1','term-test-2','mini-test-lesson-5']){
    await page.goto(base+'/term-tests/');await page.locator('#classCode').fill(classCode);await page.locator(`[data-exam-mode="${mode}"]`).click();
    await page.locator(`[data-test="${target}"]`).click();await page.waitForURL(url=>url.pathname.includes(target));assert.equal(new URL(page.url()).searchParams.get('mode'),mode);
  }
  await ctx.close();results.push({case:'landing: 5 kích thước, bàn phím, 12 link',status:'passed'});
  for(const mode of ['read_first','lis_first'])for(const slug of ['term-test-1','term-test-2','mini-test-lesson-5'])for(const delivery of ['cbt','answer_sheet']){
    if(process.env.K67_CBT_ONLY==='true'&&delivery!=='cbt')continue;
    const name=`${slug}-${delivery}-${mode}`;if(process.env.K67_BROWSER_CASE&&!name.includes(process.env.K67_BROWSER_CASE))continue;
    const reset=await fetch(new URL('/preview/reset',base),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal((await reset.json()).fixtureOnly,true);
    const ctx=await context(),page=await ctx.newPage(),errors=[];
    if(delivery==='cbt'&&process.env.K67_START_RESPONSE_LOSS==='true'){
      let lost=false;await page.route('**/session/start',async route=>{
        if(lost)return route.continue();lost=true;const response=await route.fetch();assert.equal(response.status(),200);
        return route.fulfill({status:500,contentType:'application/json',body:'{"ok":false,"error":"START_RESPONSE_LOST","message":"Mất phản hồi start mô phỏng"}'});
      });
    }
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    try{
      const cbt=delivery==='cbt',mini=slug==='mini-test-lesson-5'&&!cbt;
      if(mini&&mode==='read_first')await page.setViewportSize({width:390,height:844});
      await page.goto(`${base}/term-tests/${slug}${cbt?'-computer-based':''}/?class=${classCode}&mode=${mode}`);
      if(cbt){await page.locator('#bootstrapStudent').selectOption(ref);await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();}
      else {if(mini)await page.locator('#miniClass').selectOption(classCode);await page.locator('#studentSelect').selectOption(ref);if(mini)await page.locator('#miniEnter').click();await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();}
      if(mode==='read_first'){
        await page.locator('#listeningSavedView').waitFor({state:'visible'});assert.match(await page.locator('#listeningSavedView').innerText(),/Reading/);
        assert.equal(await page.locator('[data-progress="reading"]').getAttribute('class'),'progress-step active');
        assert.equal(await page.locator('[data-progress="listening"]').evaluate(el=>el.classList.contains('done')),false);
        assert.match(await page.locator('.progress-step').first().innerText(),/^1\. Reading/);
        await reading(page,slug==='term-test-1'&&cbt?'term1-reading-first.png':mini?'mini-paper-reading-first-mobile.png':null);
        if(cbt)await page.locator('#bootstrapPreview').waitFor({state:'visible'});
        await listening(page,cbt,slug==='term-test-1'&&cbt?'term1-listening-second.png':null);
      }else {await listening(page,cbt);await page.locator('#listeningSavedView').waitFor({state:'visible'});await reading(page);}
      if(cbt&&slug!=='mini-test-lesson-5'){
        await page.locator('#writingPrepView').waitFor({state:'visible'});
        await page.locator('#startWriting').click();await page.locator('#writingView').waitFor({state:'visible'});
        if(slug==='term-test-1'&&mode==='read_first')await page.screenshot({path:path.join(out,'term1-writing-after-lr.png'),fullPage:true});
        const editors=await page.locator('textarea[data-writing-task]').all();
        for(let index=0;index<editors.length;index++){
          await page.locator('.writing-task-tab').nth(index).click();
          await editors[index].fill('This is a synthetic preview answer.');
        }
        await page.locator('#submitWriting').click();await page.locator('#resultView').waitFor({state:'visible'});
      }else await page.locator('#resultReadyView').waitFor({state:'visible'});
      if(await page.locator('#viewResult').isVisible())await page.locator('#viewResult').click();
      await page.locator('#resultView').waitFor({state:'visible'});
      if(process.env.K67_AUDIO_ACCEPTANCE==='true'){
        const token=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}').attemptToken,`izone-test:${slug}:${classCode}`);
        const response=await ctx.request.post(base+'/api/term-tests/result',{data:{attemptToken:token,orderClientVersion:1}});assert.equal(response.status(),200);
        const result=await response.json();assert.equal(result.completed,true);assert.ok(result.result?.listening);assert.ok(result.result?.reading);
        if(slug!=='mini-test-lesson-5')assert.equal(result.writing?.submitted,true);
        await page.screenshot({path:path.join(out,name+'-result.png'),fullPage:true});
      }
      assert.deepEqual(errors,[]);
      await page.reload();
      if(mini){await page.locator('#studentSelect').selectOption(ref);await page.locator('#miniEnter').click();await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();await page.locator('#resultView').waitFor({state:'visible'});}
      else await page.locator('#resultReadyView:visible, #resultView:visible').first().waitFor({state:'visible'});
      assert.deepEqual(errors,[]);results.push({case:name,status:'passed'});console.log('Đạt:',name);
    }catch(e){await page.screenshot({path:path.join(out,name+'-failure.png'),fullPage:true});await writeFile(path.join(out,name+'-failure.html'),await page.content(),'utf8');results.push({case:name,status:'failed',error:e.message,pageErrors:errors});throw e;}
    finally{await ctx.close();}
  }
}finally{await writeFile(path.join(out,'browser-results.json'),JSON.stringify(results,null,2),'utf8');await browser.close();}
