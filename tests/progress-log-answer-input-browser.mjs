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
async function setup(mode,{completed=false}={}){
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
  const dropdown=mode.startsWith('dropdown');
  const optionItems=[makeItem(1,{prompt,interactionType:'single_choice',layoutType:'matching_heading_dropdown',
    pedagogicalTypeCode:'choose_two',graderType:'unordered_group_slot',groupId:'test_pair',
    options:[{id:'A',label:'its widespread use'},{id:'B',label:'the fact that it is voluntary for supermarkets'}]})];
  const items=dropdown?(mode==='dropdown-pairs'?[27,28,29,30].map(n=>makeItem(n,{...optionItems[0],
    itemVersionId:uid(n),displayNumber:String(n),position:n,groupId:n<29?'test_pair_27_28':'test_pair_29_30',
    prompt:n<29?prompt:'Which TWO things are true about the participants in the study on the traffic-light system?'})):optionItems):[
    makeItem(24,{prompt:'An undesirable trait such as loss of .......... may be caused by a mutation in a tomato gene.'}),
    makeItem(25,{prompt:'By modifying one gene in a tomato plant, researchers made the tomato three times its original ..........'}),
    makeItem(26,{prompt:'A type of tomato which was not badly affected by .........., and was rich in vitamin C, was produced by a team of researchers in China.'})];
  // Sáu item riêng, một dòng có hai dropdown: bảo vệ đúng nháp, nhóm câu và vị trí ô 22–23.
  if(mode==='dropdown-flowchart') {
    const shared='Interview site 22 ............, visitors or city 23 ............';
    const texts=['Read articles and note 21 ............\nIdentify a need',shared,shared,
      'Prepare interviews\nCheck whether 24 ............ can be used',
      'Identify 25 ............\nChoose visuals','Give some background\nDo NOT end with 26 ............'];
    items.splice(0,items.length,...[21,22,23,24,25,26].map((n,i)=>makeItem(n,{...optionItems[0],
      itemVersionId:uid(n),position:i+1,displayNumber:String(n),graderType:'exact_option',
      groupId:'flowchart-'+(i<4?'research':i===4?'analysis':'writing'),
      helpText:i<4?'RESEARCH':i===4?'ANALYSIS':'WRITING THE CASE STUDY',prompt:texts[i]})));
  }
  const block={blockId:uid(200),checkpoint:1,title:dropdown?'Listening':'Reading',instructions:'',items};
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    const send=body=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,...body})});
    if(url.pathname.endsWith('/config.js'))return route.fulfill({contentType:'text/javascript',body:`window.PROGRESS_LOG_CONFIG={API_BASE_URL:'${origin}'};`});
    if(url.origin!==origin)return route.abort();
    if(!url.pathname.includes('/api/learning/'))return route.continue();
    if(url.pathname.endsWith('/assignments/open'))return send({assignment:{assignmentId:uid(300),publicToken:uid(300),
      sessionNumber:6,class:{id:'-99',name:'Lớp giả'},roster:[{studentRef:uid(400),name:'Học viên giả'}],
      definitionHash:'a'.repeat(64),definition:{title:'Phiếu thử',blocks:[block]},blockReleases:[{blockId:block.blockId,status:'open'}]}});
    if(url.pathname.endsWith('/attempts/start'))return send({attempt:{attemptToken:uid(500),
      draft:completed?Object.fromEntries(items.map((item,i)=>[item.itemVersionId,i%2?'B':'A'])):{},draftRevision:0,
      identity:{studentName:'Học viên giả',className:'Lớp giả',sessionNumber:6},
      checkpointSubmissions:completed?[{blockId:block.blockId,result:{answerRelease:'released',summary:{maxScore:4},
        items:items.map((item,i)=>({itemVersionId:item.itemVersionId,rawAnswer:i%2?'B':'A',expectedAnswer:'A',
          verdict:i%2?'incorrect':'correct',maxScore:1}))}}]:[]}});
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
test('Listening cặp TWO: một câu hỏi chung, hai dropdown sát nhau xếp dọc, số câu trước mỗi ô',{timeout:30000},async()=>{
  const s=await setup('dropdown-pairs');try{
    assert.equal(await s.page.locator('.answer-dropdown-group').count(),2);
    assert.equal(await s.page.locator('.answer-dropdown-group h3').count(),2);
    assert.equal(await s.page.getByText(s.items[0].prompt,{exact:true}).count(),1);
    assert.equal(await s.page.getByText(s.items[2].prompt,{exact:true}).count(),1);
    assert.deepEqual(await s.page.locator('.answer-dropdown-row .question-number').allTextContents(),['27','28','29','30']);
    const selects=s.page.locator('.matching-heading-select');assert.equal(await selects.count(),4);
    for(const width of [1440,768,390]){
      await s.page.setViewportSize({width,height:900});
      for(const group of await s.page.locator('.answer-dropdown-group').all()){
        const layout=await group.evaluate(el=>{
          const title=el.querySelector('h3').getBoundingClientRect(),rows=[...el.querySelectorAll('.question')];
          const a=rows[0].querySelector('select').getBoundingClientRect(),b=rows[1].querySelector('select').getBoundingClientRect();
          const number=rows[0].querySelector('.question-number').getBoundingClientRect();
          return {sameX:Math.abs(a.x-b.x)<1,stacked:b.y>=a.bottom,gap:b.y-a.bottom,
            numberBefore:number.right<=a.left,titleWidth:title.width,groupWidth:el.clientWidth};
        });
        assert.ok(layout.sameX&&layout.stacked&&layout.numberBefore,JSON.stringify(layout));
        assert.ok(layout.gap>=0&&layout.gap<=12,`Hai ô quá xa: ${layout.gap}px`);
        assert.ok(layout.titleWidth>layout.groupWidth*.8,'Câu hỏi chung bị ép hẹp');
      }
      assert.equal(await s.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await mkdir(resolve(root,'output/playwright'),{recursive:true});
      await s.page.screenshot({path:resolve(root,`output/playwright/answer-pairs-${width}.png`)});
    }
    for(let i=0;i<4;i++){
      assert.equal(await selects.nth(i).locator('option').first().textContent(),'Chọn');
      const labelledBy=await selects.nth(i).getAttribute('aria-labelledby');
      assert.ok(labelledBy.includes(`answer-number-${s.items[i].itemVersionId}`));
      await selects.nth(i).selectOption(i%2?'B':'A');
    }
    const draft=await s.page.evaluate(()=>Object.values(sessionStorage).map(v=>{try{return JSON.parse(v)}catch{return null}}).find(v=>v?.responses));
    for(let i=0;i<4;i++)assert.equal(draft.responses[s.items[i].itemVersionId],i%2?'B':'A');
    assert.deepEqual(s.errors,[]);
  }finally{await s.close();}
});
test('Listening đã nộp: nhóm chung vẫn hiện phản hồi riêng và khóa từng dropdown',{timeout:15000},async()=>{
  const s=await setup('dropdown-pairs',{completed:true});try{
    assert.equal(await s.page.locator('.answer-dropdown-group h3').count(),2);
    assert.equal(await s.page.locator('.heading-feedback.is-correct').count(),2);
    assert.equal(await s.page.locator('.heading-feedback.is-incorrect').count(),2);
    const rows=s.page.locator('.answer-dropdown-row');
    for(let i=0;i<4;i++){
      const select=rows.nth(i).locator('select');assert.ok(await select.isDisabled());
      assert.equal(await select.inputValue(),i%2?'B':'A');
      assert.match(await rows.nth(i).locator('.heading-feedback').textContent(),/Đáp án đúng: A\. its widespread use/);
    }
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

test('Listening sơ đồ: sáu dropdown nội tuyến, hai ô cùng câu và nháp đúng từng item qua reload',{timeout:30000},async()=>{
  const s=await setup('dropdown-flowchart');try{
    assert.equal(await s.page.locator('.flowchart-stage').count(),3);
    assert.equal(await s.page.locator('.flowchart-option-bank').count(),1);
    assert.equal(await s.page.locator('.flowchart-select').count(),6);
    assert.equal(await s.page.locator('textarea').count(),0);
    assert.equal(await s.page.locator('.flowchart-line').filter({hasText:'Interview site'}).count(),1);
    assert.equal(await s.page.locator('.flowchart-line').filter({hasText:'Interview site'}).locator('select').count(),2);
    await s.page.locator('#submitButton').click();
    assert.equal(await s.page.locator('#formView').isVisible(),true);
    assert.match(await s.page.locator('#notice').textContent(),/câu bắt buộc|đủ/i);
    const selects=s.page.locator('.flowchart-select');
    for(let i=0;i<6;i++){
      assert.equal(await selects.nth(i).getAttribute('required'),'');
      await selects.nth(i).selectOption(i%2?'B':'A');
    }
    const draft=await s.page.evaluate(()=>Object.values(sessionStorage).map(v=>{try{return JSON.parse(v)}catch{return null}}).find(v=>v?.responses));
    for(let i=0;i<6;i++)assert.equal(draft.responses[s.items[i].itemVersionId],i%2?'B':'A');
    for(const width of [1440,768,390]){
      await s.page.setViewportSize({width,height:1000});
      assert.equal(await s.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      for(const select of await selects.all()) assert.ok(await select.evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
    }
    await s.page.reload();await s.page.locator('#studentSelect').selectOption(uid(400));
    await s.page.locator('#chooseStudentButton').click();await s.page.locator('#confirmButton').click();
    await s.page.locator('#formView').waitFor({state:'visible'});
    for(let i=0;i<6;i++)assert.equal(await s.page.locator('.flowchart-select').nth(i).inputValue(),i%2?'B':'A');
    assert.deepEqual(s.errors,[]);
  }finally{await s.close();}
});

test('Listening sơ đồ đã nộp: khóa sáu dropdown và phản hồi chấm đúng từng số câu',{timeout:15000},async()=>{
  const s=await setup('dropdown-flowchart',{completed:true});try{
    assert.equal(await s.page.locator('.flowchart-select').count(),6);
    assert.equal(await s.page.locator('.flowchart-feedback .heading-feedback').count(),6);
    for(let i=0;i<6;i++){
      assert.ok(await s.page.locator('.flowchart-select').nth(i).isDisabled());
      assert.match(await s.page.locator('.flowchart-feedback .heading-feedback').nth(i).textContent(),new RegExp('Câu '+(21+i)+':'));
    }
    assert.deepEqual(s.errors,[]);
  }finally{await s.close();}
});
