// Dữ liệu giả trên localhost: kiểm độ rộng câu hỏi và ô điền ngay trong câu.
// API được chặn hoàn toàn; kiểm nháp giữ chuỗi đơn và bố cục ở ba cỡ màn hình.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const uid=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const makeItem=(n,overrides)=>({itemVersionId:uid(n),itemFamilyId:uid(n+100),position:n,
  displayNumber:String(n),required:true,prompt:'Câu hỏi thử',helpText:'',interactionConfig:{},
  interactionType:'short_text',layoutType:'plain_prompt',pedagogicalTypeCode:'sentence_completion',...overrides});
async function setup(mode){
  const server=createServer(async(req,res)=>{
    try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
      if(!path.startsWith(root))throw Error('Sai phạm vi');
      res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(path)]||'text/plain');
      res.end(await readFile(path));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();page.setDefaultTimeout(6000);
  const responses=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  const prompt='Which TWO things surprised the students about the traffic-light system for nutritional labels?';
  const items=mode==='dropdown'?[makeItem(1,{prompt,interactionType:'single_choice',layoutType:'matching_heading_dropdown',
    pedagogicalTypeCode:'choose_two',graderType:'unordered_group_slot',groupId:'test_pair',
    options:[{id:'A',label:'its widespread use'},{id:'B',label:'the fact that it is voluntary for supermarkets'}]})]:[
    makeItem(24,{prompt:'An undesirable trait such as loss of .......... may be caused by a mutation in a tomato gene.'}),
    makeItem(25,{prompt:'By modifying one gene in a tomato plant, researchers made the tomato three times its original ..........'}),
    makeItem(26,{prompt:'A type of tomato which was not badly affected by .........., and was rich in vitamin C, was produced by a team of researchers in China.'})];
  const block={blockId:uid(200),checkpoint:1,title:mode==='dropdown'?'Listening':'Reading',instructions:'',items};
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    const send=body=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,...body})});
    if(url.pathname.endsWith('/config.js'))return route.fulfill({contentType:'text/javascript',body:`window.PROGRESS_LOG_CONFIG={API_BASE_URL:'${origin}'};`});
    if(url.origin!==origin)return route.abort();
    if(!url.pathname.includes('/api/learning/'))return route.continue();
    if(url.pathname.endsWith('/assignments/open'))return send({assignment:{assignmentId:uid(300),publicToken:uid(300),
      sessionNumber:6,class:{id:'-99',name:'Lớp giả'},roster:[{studentRef:uid(400),name:'Học viên giả'}],
      definitionHash:'a'.repeat(64),definition:{title:'Phiếu thử',blocks:[block]},blockReleases:[{blockId:block.blockId,status:'open'}]}});
    if(url.pathname.endsWith('/attempts/start'))return send({attempt:{attemptToken:uid(500),draft:{},draftRevision:0,
      identity:{studentName:'Học viên giả',className:'Lớp giả',sessionNumber:6},checkpointSubmissions:[]}});
    if(url.pathname.endsWith('/attempts/draft')){responses.push(req.postDataJSON().responses);return send({draft:{revision:req.postDataJSON().revision}});}
    if(url.pathname.endsWith('/student/session-comments'))return send({comments:[]});
    if(url.pathname.endsWith('/checkpoints/submit'))return send({checkpointSubmission:{blockId:block.blockId,completeness:'complete'}});
    return send({});
  });
  await page.goto(`${origin}/progress-log/index.html#assignment=${uid(300)}`);
  await page.locator('#studentSelect').selectOption(uid(400));
  await page.locator('#chooseStudentButton').click();await page.locator('#confirmButton').click();
  await page.locator('#formView').waitFor({state:'visible'});
  return {page,responses,errors,items,close:async()=>{await browser.close();await new Promise(done=>server.close(done));}};
}
test('Listening chọn TWO: câu hỏi trải hết chiều ngang và nhãn dropdown chỉ là Chọn',{timeout:30000},async()=>{
  const s=await setup('dropdown');try{
    for(const width of [1440,768,390]){
      await s.page.setViewportSize({width,height:900});
      const ratio=await s.page.locator('.question-content').evaluate(el=>el.querySelector('h3').getBoundingClientRect().width/el.getBoundingClientRect().width);
      assert.ok(ratio>.95,`Câu hỏi bị ép hẹp ở ${width}px: ${ratio}`);
      assert.equal(await s.page.locator('select.matching-heading-select option').first().textContent(),'Chọn');
      assert.equal(await s.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await mkdir(resolve(root,'output/playwright'),{recursive:true});
      await s.page.screenshot({path:resolve(root,`output/playwright/answer-dropdown-${width}.png`)});
    }
    await s.page.locator('.matching-heading-select').selectOption('B');
    assert.match(await s.page.locator('.heading-choice-preview').textContent(),/voluntary for supermarkets/);
    assert.deepEqual(s.errors,[]);
  }finally{await s.close();}
});
test('Reading: nguyên câu bao quanh ô điền, bắt buộc trả lời và nháp giữ chuỗi đơn',{timeout:30000},async()=>{
  const s=await setup('reading');try{
    assert.equal(await s.page.locator('h3.sentence-text textarea.sentence-blank').count(),3);
    await s.page.locator('#submitButton').click();assert.equal(await s.page.locator('#formView').isVisible(),true);
    const input=s.page.locator('h3.sentence-text textarea').first();
    const surroundings=await input.evaluate(el=>({before:el.previousSibling.textContent,after:el.nextSibling.textContent,required:el.required}));
    assert.equal(surroundings.before,'An undesirable trait such as loss of ');
    assert.equal(surroundings.after,' may be caused by a mutation in a tomato gene.');assert.ok(surroundings.required);
    await input.fill('Câu trả lời có dấu để kiểm tra ô tự tăng chiều ngang và xuống dòng khi cần');
    const draft=await s.page.evaluate(()=>Object.values(sessionStorage).map(v=>{try{return JSON.parse(v)}catch{return null}}).find(v=>v?.responses));
    assert.equal(typeof draft.responses[s.items[0].itemVersionId],'string');
    for(const width of [1440,768,390]){
      await s.page.setViewportSize({width,height:900});
      await s.page.waitForFunction(()=>[...document.querySelectorAll('textarea.sentence-blank')].every(el=>el.clientHeight>=el.scrollHeight-3));
      assert.equal(await s.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const box=await input.evaluate(el=>({h:el.clientHeight,scroll:el.scrollHeight}));assert.ok(box.h>=box.scroll-3);
      await mkdir(resolve(root,'output/playwright'),{recursive:true});
      await s.page.screenshot({path:resolve(root,`output/playwright/answer-gapfill-${width}.png`)});
    }
    assert.deepEqual(s.errors,[]);
  }finally{await s.close();}
});
