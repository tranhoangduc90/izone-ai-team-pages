// Real Homework entries, private read-only snapshots, isolated client. No AI/Docs/API writes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const dir=process.env.READING_HOMEWORK_PRIVATE_DIR;
const mode=process.env.READING_CONCISE_CASES||'all';
if(!dir)throw Error('READING_HOMEWORK_PRIVATE_DIR_REQUIRED');
const lessons=JSON.parse(await fs.readFile(path.join(dir,'before-learning.private.json'),'utf8'));
lessons.push({...lessons.find(l=>l.route==='/'),route:'/legacy-root',data:{web_draft:[],web_attempt:[]}});
if(process.env.READING_CONCISE_LESSON)lessons.splice(0,lessons.length,...lessons.filter(l=>l.route===process.env.READING_CONCISE_LESSON));
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=path.join(dir,'concise-browser');await fs.mkdir(out,{recursive:true});
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
const slug=l=>l.route==='/'?'materials-beyond-concrete':l.route==='/lesson12'?'butterflies-britain-tfng':l.route.slice(1);
function fixture(content,body,attempt){
 const identity={ownerId:'isolated-check',courseId:'isolated-class',name:'Kiểm giao diện',className:'LỚP THỬ'};
 window.__saved=[];
 const client=window.ReadingServerClient={identity,access:{config:{demo:true}},initialHistory:{attempts:attempt?[attempt]:[]},revision:1,runNo:1,
 state:{status:'saved',completeness:{filled_cells:0,total_cells:content.targets.length}},
 initialize:async()=>({content,identity,draft:{body:structuredClone(body),revision:1},teacher:!!attempt,history:attempt?[attempt]:[],config:{demo:true},restored:false}),
 getAttempt:async()=>structuredClone(attempt),getDraft:async()=>({body:structuredClone(body),revision:1}),getHistory:async()=>({attempts:attempt?[attempt]:[]}),
 historyDetail:async()=>({attempts:attempt?[attempt]:[],archives:[]}),flush:async()=>{},stopPoll(){},poll(){},
 practice:async()=>({status:'accepted'}),
 schedule(state){window.__saved.push(structuredClone(state));client.state.status='dirty';window.dispatchEvent(new CustomEvent('reading67:server-state'));return true;}};
}
async function open(lesson,body,attempt,width){
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[],writes=[];
 page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}if(url.origin!==site.origin)return route.abort();
  if(url.pathname.endsWith('/api-config.js'))return route.fulfill({contentType:'text/javascript',body:''});
  if(url.pathname.endsWith('/web-client.js'))return route.fulfill({contentType:'text/javascript',body:`(${fixture.toString()})(${JSON.stringify(lesson.content)},${JSON.stringify(body)},${JSON.stringify(attempt||null)});`});return route.continue();});
 await page.goto(site.origin+'/reading-skills67/'+(lesson.route==='/legacy-root'?'':slug(lesson)+'/')+'?server=1'+(attempt?'&teacher=1&attemptId='+attempt.attemptId:''));
 await page.waitForSelector('[data-target]',{state:'attached'});
 if(lesson.content.type==='matching_headings'&&!attempt)await page.waitForFunction(()=>document.querySelector('.reading-practice-gate')?.dataset.locked==='false');
 return {context,page,errors,writes};
}
const read=page=>page.locator('[data-target]').evaluateAll(cs=>Object.fromEntries(cs.map(c=>[c.dataset.target,'value' in c?c.value:c.textContent.trim()==='Chưa chọn'?'':c.textContent.trim()])));
try{
 for(const lesson of lessons){
  const {content,data}=lesson;
  const existing=[...data.web_draft.map((r,i)=>({id:'draft-'+i,body:r.body})),...data.web_attempt.map((r,i)=>({id:'result-'+i,body:r.snapshot,attempt:{attemptId:r.id,runNo:r.run_no,draftRevision:r.draft_revision,createdAt:r.created_at,status:data.web_job.find(j=>j.attempt_id===r.id).status,snapshot:r.snapshot,completeness:r.completeness,result:data.web_result.find(j=>j.attempt_id===r.id).data}}))];
  for(const item of mode==='states'?[]:existing){
   console.log(JSON.stringify({lesson:slug(lesson),opening:item.id}));
   const {context,page,errors,writes}=await open(lesson,item.body,item.attempt,1440);
   try{
    const actual=await read(page),expected=Object.fromEntries(Object.keys(actual).map(id=>[id,String(item.body.answers?.[id]||'')]));
    assert.deepEqual(actual,expected,'Saved answers must keep every character');
    assert.deepEqual(await page.evaluate(()=>window.__saved),[],'Opening old work must not save');
    if(item.attempt)assert.equal(await page.locator('textarea[data-target]:not([readonly]),input[data-target]:not([readonly]),select[data-target]:not(:disabled)').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);records.push({lesson:slug(lesson),case:item.id,outcome:'passed'});
   }catch(e){records.push({lesson:slug(lesson),case:item.id,outcome:'failed',error:e.message,errors});}finally{await context.close();}
  }
  if(content.type==='tfng'||mode==='existing')continue;
  for(const width of [1440,390,320]){
   console.log(JSON.stringify({lesson:slug(lesson),opening:'states-'+width}));
   const body={answers:{},notes:'',annotations:[],flags:[]},s=await open(lesson,body,null,width),{context,page,errors,writes}=s;
   try{
    assert.equal(await page.locator('[data-target]').count(),content.targets.length+(content.type==='sentence_completion'?1:0));
    assert.equal(await page.locator('.header-notes').isVisible(),false);
    assert.equal(await page.locator('#materials-role-label').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const input=page.locator('textarea[data-target]').first(),id=await input.getAttribute('data-target');
    const color=()=>input.evaluate(el=>({fill:el.closest('[data-field]').dataset.fillState,bg:getComputedStyle(el).backgroundColor}));
    assert.deepEqual(await color(),{fill:'empty',bg:'rgb(255, 255, 255)'});
    if(width<800)await page.locator('[data-pane="'+(content.type==='matching_headings'||content.type==='matching_people'?'questions':'passage')+'"]').click();
    await input.fill('   ');assert.equal((await color()).fill,'empty');
    const raw='  Ý đã viết\nGiữ nguyên dấu và khoảng trắng  ';await input.fill(raw);
    assert.deepEqual(await color(),{fill:'filled',bg:'rgb(223, 244, 233)'});
    assert.equal(await page.evaluate(id=>window.__saved.at(-1).answers[id],id),raw);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await input.focus();await input.evaluate(el=>{el.setSelectionRange(2,6);window.__inputKept=el;});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>{window.__scrollKept={x:scrollX,y:scrollY,p:document.querySelector('#scroll-passage').scrollTop,q:document.querySelector('#scroll-questions').scrollTop};});
    for(let i=0;i<3;i++){await page.evaluate(()=>window.dispatchEvent(new CustomEvent('reading67:server-state')));await page.waitForTimeout(80);}
    assert.equal(await input.evaluate(el=>el===window.__inputKept&&document.activeElement===el&&el.selectionStart===2&&el.selectionEnd===6),true,'Save events must retain the same focused input and selection');
    const positions=await page.evaluate(()=>({before:window.__scrollKept,after:{x:scrollX,y:scrollY,p:document.querySelector('#scroll-passage').scrollTop,q:document.querySelector('#scroll-questions').scrollTop}}));
    assert.equal(Object.keys(positions.before).every(k=>Math.abs(positions.before[k]-positions.after[k])<2),true,'Save events must retain the reading position: '+JSON.stringify(positions));
    await input.fill('');assert.equal((await color()).fill,'empty');
    if(await page.locator('select[data-target]').count()){
     const select=page.locator('select[data-target]').first();if(width<800)await page.locator('[data-pane="questions"]').click();
     await select.selectOption({index:1});assert.equal(await select.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(223, 244, 233)');
     await select.selectOption('');assert.equal(await select.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    }
    if(content.type==='sentence_completion')assert.match(await page.locator('#word-limit').innerText(),/ONE WORD ONLY/);
    if(content.type==='green-roofs')assert.equal(await page.locator('[data-authored-choice]').count(),10);
    if(content.type==='matching_people')assert.match(await page.locator('.people-bank').innerText(),/more than once/);
    await page.screenshot({path:path.join(out,slug(lesson)+'-'+width+'.png')});
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);records.push({lesson:slug(lesson),case:'states-'+width,outcome:'passed'});
   }catch(e){records.push({lesson:slug(lesson),case:'states-'+width,outcome:'failed',error:e.stack,errors});await page.screenshot({path:path.join(out,'FAILED-'+slug(lesson)+'-'+width+'.png')});}finally{await context.close();}
  }
 }
}finally{await browser.close();await site.close();}
await fs.writeFile(path.join(out,'results-'+mode+'.json'),JSON.stringify({scope:'Private snapshots and isolated UI; no production writes',records},null,2));
console.log(JSON.stringify({total:records.length,passed:records.filter(r=>r.outcome==='passed').length,failures:records.filter(r=>r.outcome!=='passed')}));
if(records.some(r=>r.outcome!=='passed'))process.exitCode=1;
