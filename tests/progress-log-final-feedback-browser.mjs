// Chrome dùng học viên giả và chặn toàn bộ API: kiểm chữa phần cuối sau khi bài đã được chốt.
// Nhận source localhost hoặc Pages; khi lỗi, assertion chỉ rõ màn bị bỏ qua và số lần nộp.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const uid=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const items=[21,22,23,24,25,26].map((n,i)=>({itemVersionId:uid(n),itemFamilyId:uid(n+100),
  position:i+1,displayNumber:String(n),required:true,interactionType:'single_choice',
  layoutType:'matching_heading_dropdown',pedagogicalTypeCode:'matching',graderType:'exact_option',
  maxScore:1,skillCodes:['listening'],groupId:`flowchart-${i<4?'research':i===4?'analysis':'writing'}`,
  helpText:i<4?'RESEARCH':i===4?'ANALYSIS':'WRITING THE CASE STUDY',
  prompt:n===22||n===23?'Interview site 22 ............ or city 23 ............':`Test step ${n} ............`,
  options:'ABCDEFGH'.split('').map(id=>({id,label:`Test option ${id}`}))}));
const listening={blockId:uid(200),checkpoint:1,title:'Listening · Phiếu kiểm thử',instructions:'Choose A–H.',items};
const reflection={blockId:uid(201),checkpoint:1,title:'Reflection',items:[{itemVersionId:uid(1),
  itemFamilyId:uid(101),position:1,required:true,interactionType:'long_text',prompt:'Việc em đã làm'}]};
const choices=['A','B','A','B','A','A'];

for(const mode of ['one','multi','hidden','lost-receipt','reload','closed-after-submit','demo']) {
  test(`Phần cuối: ${mode} — chữa bài sau chốt, không nộp hoặc điểm danh hai lần`,{timeout:45000},async()=>{
    const server=createServer(async(req,res)=>{
      try {const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
        if(!path.startsWith(root))throw Error('Sai phạm vi');
        res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(path)]||'text/plain');
        res.end(await readFile(path));
      }catch{res.writeHead(404);res.end();}
    });
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const origin=process.env.PAGES_LIVE_ORIGIN||`http://127.0.0.1:${server.address().port}`;
    const browser=await chromium.launch({channel:'chrome',headless:true});
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    const page=await context.newPage();page.setDefaultTimeout(7000);
    const errors=[],calls=[];let received=false,draft={};const checkpoints=new Map();
    const blocks=mode==='multi'?[reflection,{...listening,checkpoint:2}]:[listening];
    const graded={answerRelease:mode==='hidden'?'hidden':'released',summary:{maxScore:6,scoreEarned:4},
      items:items.map((item,i)=>({itemVersionId:item.itemVersionId,maxScore:1,rawAnswer:choices[i],
        verdict:choices[i]==='A'?'correct':'incorrect',...(mode==='hidden'?{}:{expectedAnswer:'A'})}))};
    const saved={receipt:{message:'Đã nhận phiếu.',completeness:'complete',attendanceStatus:'self_confirmed'},result:graded};
    if(mode==='closed-after-submit')saved.submissionWindow={canSubmit:false,serverNow:'2026-10-13T16:00:00Z',effectiveClosesAt:'2026-10-13T15:00:00Z'};
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,...body})});
      if(url.pathname.endsWith('/progress-log/config.js'))return route.fulfill({contentType:'text/javascript',
        body:`window.PROGRESS_LOG_CONFIG={API_BASE_URL:'https://ducizone.ddns.net/mapping-api',DEMO_MODE:${mode==='demo'}};`});
      if(!url.pathname.includes('/api/learning/'))return route.continue();
      calls.push(url.pathname);
      if(url.pathname.endsWith('/assignments/open'))return json({assignment:{assignmentId:uid(300),publicToken:uid(300),
        sessionNumber:7,class:{id:'-99',name:'Lớp giả'},roster:[{studentRef:uid(400),name:'Học viên giả'}],
        definitionHash:'a'.repeat(64),definition:{title:'Phiếu kiểm luồng cuối',blocks},
        blockReleases:blocks.map(block=>({blockId:block.blockId,status:'open'}))}});
      if(url.pathname.endsWith('/attempts/start'))return json({attempt:{attemptToken:uid(500),draft,draftRevision:1,
        identity:{studentRef:uid(400),studentName:'Học viên giả',classId:'-99',className:'Lớp giả',sessionNumber:7},
        checkpointSubmissions:received?[]:[...checkpoints.values()]}});
      if(url.pathname.endsWith('/attempts/draft')){draft=req.postDataJSON().responses;return json({draft:{revision:req.postDataJSON().revision}});}
      if(url.pathname.endsWith('/checkpoints/submit')){
        const blockId=req.postDataJSON().blockId;
        const entry={blockId,completeness:'complete',result:blockId===listening.blockId&&mode!=='hidden'?graded:null};
        checkpoints.set(blockId,entry);return json({checkpointSubmission:entry});
      }
      if(url.pathname.endsWith('/attempts/submit')){
        received=true;
        if(mode==='lost-receipt')return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"message":"Mất phản hồi sau lưu"}'});
        return json(saved);
      }
      if(url.pathname.endsWith('/attempts/result'))return received?json(saved):route.fulfill({status:404,
        contentType:'application/json',body:'{"ok":false,"error":"RESULT_NOT_READY","message":"Chưa nộp cuối"}'});
      if(url.pathname.endsWith('/student/session-comments'))return json({comments:[]});
      return route.abort();
    });
    const selectStudent=async()=>{
      // Tải lại tab đã ghim sẽ tự khôi phục; lần đầu vẫn chọn người như trước.
      await page.locator('#identityView:visible, #formView:visible').first().waitFor();
      if(await page.locator('#formView').isVisible())return;
      await page.locator('#studentSelect').selectOption(uid(400));
      await page.locator('#chooseStudentButton').click();await page.locator('#confirmButton').click();
      await page.locator('#formView').waitFor({state:'visible'});
    };
    try{
      await page.goto(`${origin}/progress-log/index.html#assignment=${uid(300)}`);await selectStudent();
      if(mode==='multi'){
        await page.locator('#questionList textarea').fill('Nội dung kiểm thử');
        await page.locator('#nextButton').click();await page.locator('.flowchart-select').first().waitFor();
      }
      for(let i=0;i<6;i++)await page.locator('.flowchart-select').nth(i).selectOption(choices[i]);
      // Hai sự kiện liên tiếp khi request đang bay vẫn chỉ được gửi một bài.
      await page.evaluate(()=>{const form=document.querySelector('#reflectionForm');form.requestSubmit();form.requestSubmit();});
      if(mode==='hidden'){
        await page.locator('#resultView').waitFor({state:'visible'});
        assert.equal(await page.locator('#gradedResults').isVisible(),false);
        assert.equal(await page.locator('.heading-feedback').count(),0);
      }else{
        await page.locator('.checkpoint-score').filter({hasText:'4/6'}).waitFor({state:'visible'});
        assert.equal(received,true,'Chữa bài không được trì hoãn nộp cuối/điểm danh');
        assert.equal(await page.locator('#resultView').isVisible(),false,'Phải xem chữa trước biên nhận');
        assert.equal(await page.locator('.flowchart-feedback .heading-feedback').count(),6);
        assert.equal(await page.locator('.heading-feedback.is-correct').count(),4);
        assert.equal(await page.locator('.heading-feedback.is-incorrect').count(),2);
        assert.equal(await page.locator('.flowchart-select:disabled').count(),6);
        assert.equal(await page.locator('#submitButton').textContent(),'Xem xác nhận điểm danh');
        if(mode==='demo')assert.match(await page.locator('#notice').textContent(),/Không ghi điểm danh lớp thật/);
        if(mode==='reload'){
          await page.reload();await selectStudent();
          await page.locator('.checkpoint-score').filter({hasText:'4/6'}).waitFor();
          assert.equal(await page.locator('.heading-feedback').count(),6);
          assert.equal(calls.filter(path=>path.endsWith('/attempts/start')).length,1,'Tải lại bài đã chốt không mở lượt mới');
        }
        for(const width of [390,1440]){
          await page.setViewportSize({width,height:900});
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        }
        const evidence=process.env.PROGRESS_LOG_EVIDENCE_DIR;
        if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:resolve(evidence,`final-feedback-${mode}.png`),fullPage:true});}
        const before=calls.length;
        await page.locator('#submitButton').click();await page.locator('#resultView').waitFor({state:'visible'});
        assert.equal(calls.slice(before).some(path=>/attempts\/(submit|draft)|checkpoints\/submit/.test(path)),false);
        assert.equal(await page.locator('.graded-item').count(),6);
      }
      assert.equal(calls.filter(path=>path.endsWith('/attempts/submit')).length,1);
      assert.equal(calls.filter(path=>path.endsWith('/checkpoints/submit')).length,blocks.length);
      assert.deepEqual(errors,[]);
    }finally{await context.close();await browser.close();await new Promise(done=>server.close(done));}
  });
}
