// Second-Check regression: real HTML/modules, isolated synthetic HTTP; no live API/AI.
// Delayed reads must not regress an acknowledged save or create false conflicts.
// Giữ ranh giới trình duyệt thật, không thêm hook/export phục vụ test vào sản phẩm.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const root=resolve(process.env.SW_READING_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const output=process.env.SW_READING_OUTPUT;
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const catalog=await fs.readFile(resolve(root,'sw-task2-writing/writing-handouts/shops-review/lesson-config.mjs'),'utf8');
const tasks=[...catalog.matchAll(/^    "slug": "([^"]+)"/gm)].map(m=>m[1]);
assert.equal(tasks.length,8);
const origin='https://tranhoangduc90.github.io',prefix='/izone-ai-team-pages';
const stamp='2026-10-27T08:00:00.000Z';
const fields=['body1_message','body1_idea1','body1_idea2','body2_message','body2_idea1','body2_idea2','body_choice','topic_sentence','idea1_a','idea1_x','idea1_b','idea2_a','idea2_x','idea2_b','draft1','draft2'];
function rawSession(task,student='fixture-student'){
 const responses=Object.fromEntries(fields.map(k=>[k,k==='body_choice'?'body1':k+' Synthetic writing content.']));
 const definitions=[['topic_sentence',['body1_message','body1_idea1','body1_idea2','body2_message','body2_idea1','body2_idea2','body_choice','topic_sentence']],['supporting_idea_1',['idea1_a','idea1_x','idea1_b']],['supporting_idea_2',['idea2_a','idea2_x','idea2_b']],['draft',['draft1','draft2']]].map(([key,inputFields])=>({key,section:key,inputFields,requiredFields:inputFields,validationMode:'all'}));
 const attempts=definitions.map(({key},i)=>({attemptRef:student+'-attempt-'+i,section:key,status:'completed',resultStatus:'passed',snapshot:responses,createdAt:stamp,completedAt:stamp}));
 return {sessionRef:student+'-session',activitySlug:task,studentRef:student,classRef:'fixture-class',draftVersion:4,updatedAt:stamp,responses,sectionDefinitions:definitions,sections:Object.fromEntries(definitions.map(d=>[d.key,{status:'passed',locked:true}])),attempts,comments:attempts.map(a=>({attemptRef:a.attemptRef,section:a.section,status:'passed',feedback:'Nhận xét tổng hợp đã lưu.',createdAt:stamp})),ui:{version:'sw-task2-lesson9-v1',data:{idea2Opened:true,draft2Open:true,editedFields:[]}},uiEvents:[],uiVocabulary:{status:'completed',groups:Object.fromEntries(['A1','X1','B1','A2','X2','B2'].map(k=>[k,[{phrase:'synthetic phrase',meaningVi:'cụm từ thử'}]]))}};
}
const blocks=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
function resultPayload(label='Bản chấm đầu',count=3){return {essays:Array.from({length:count},(_,i)=>({id:'sentence-'+i,index:i,content:blocks('Synthetic original sentence '+i),suggestedContent:blocks('Synthetic suggestion '+i),comments:['<p>'+label+' · Thẻ '+(i+1)+'. '+('Nhận xét dài để kiểm vị trí đọc. '.repeat(45))+'</p>']})),updatedAt:stamp,...(count?{}:{noCorrections:true,readbackOk:true})};}
async function fixture(browser,{task=tasks[0],teacher=false,width=1440,engine=process.env.SW_CHECK_ENGINE||'sw-task2-writing',configure=()=>{}}={}){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 const state={raw:rawSession(task),result:resultPayload(),threads:[],calls:[],errors:[],escaped:[],resultStatus:200,sessionStatus:200,resultDelay:80};
 state.raw.sections.topic_sentence={status:'needs_revision',locked:false};state.raw.attempts=state.raw.attempts.filter(a=>a.section==='topic_sentence');state.raw.attempts[0].resultStatus='needs_revision';state.raw.comments=state.raw.comments.filter(a=>a.section==='topic_sentence');state.raw.comments[0].status='needs_revision';state.holdNext=false;state.blocked=false;state.readGate=new Promise(r=>state.releaseRead=r);
 configure(state);
 await context.addInitScript(({task,engine})=>localStorage.setItem((engine==='sw-task2-writing'?'izone:sw-task2:production:'+task+':':'izone:shops-writing:production:')+'identity',JSON.stringify({id:'fixture-student',classRef:'fixture-class',sessionRef:'fixture-student-session'})),{task,engine});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;
  if(u.origin===origin){
   const file=resolve(root,'.'+p.slice(prefix.length)+(p.endsWith('/')?'index.html':''));assert(file.startsWith(root+'\\')||file.startsWith(root+'/'));
   try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
  }
  if(u.hostname!=='ducizone.ddns.net'){state.escaped.push(req.url());return route.abort();}
  state.calls.push({path:p,method:req.method()});
  if(p.includes('/restore/')||p.endsWith('/auth/session'))return route.fulfill({json:{ok:true}});
  if(p.endsWith('/shared-session'))return route.fulfill({status:401,json:{error:'FIXTURE_NO_SESSION'}});
  if(p.endsWith('/admin/me'))return route.fulfill({json:{reviewer:{role:'admin'},classes:[{classCode:'CS-FIXTURE'}]}});
  if(p.endsWith('/roster'))return route.fulfill({json:{classes:[{classRef:'fixture-class',className:'CS-FIXTURE',students:[{studentRef:'fixture-student',displayName:'Học viên thử'},{studentRef:'fixture-other',displayName:'Người thử khác'}]}]}});
  if(p.endsWith('/sw/status')||p.endsWith('/shops/status'))return route.fulfill({json:{ok:true}});
  if(p.includes('/admin/live/activities/'))return route.fulfill({json:{students:[{studentRef:'fixture-student',classRef:'fixture-class',sessionRef:state.raw.sessionRef}]}});
  if(p.endsWith('/teacher-comments'))return route.fulfill({json:{threads:state.threads}});
  if(p.endsWith('/lesson9/sessions')&&req.method()==='POST'){state.raw=rawSession(task,req.postDataJSON().studentRef);state.result=resultPayload('Người học mới',1);return route.fulfill({json:{session:state.raw}});}
  if(p.endsWith('/draft-result')){const data=structuredClone(state.result),status=state.resultStatus;await new Promise(r=>setTimeout(r,state.resultDelay));return route.fulfill({status,json:status===200?{ok:true,result:data}:{error:'FIXTURE_RESULT_UNAVAILABLE'}});}
  if(p.includes('/lesson9/sessions/')&&state.holdNext){state.holdNext=false;let snapshot=structuredClone(state.raw);state.blocked=true;await state.readGate;if(state.captureAfterGate)snapshot=structuredClone(state.raw);return route.fulfill({json:{session:snapshot}});}
  if(p.includes('/lesson9/sessions/'))return route.fulfill({status:state.sessionStatus,json:state.sessionStatus===200?{session:state.raw}:{error:'FIXTURE_SESSION_UNAVAILABLE'}});
  if(p.endsWith('/checks')&&req.method()==='POST'){if(state.checkGate)await state.checkGate;return route.fulfill({status:state.checkStatus||202,json:state.checkStatus?{error:'SERVICE_UNAVAILABLE',message:'Dịch vụ chấm đang gián đoạn. Hãy thử lại sau.'}:{ok:true}});}
  if(p.endsWith('/responses')&&req.method()==='PUT'){if(req.postDataJSON().baseVersion!==state.raw.draftVersion)return route.fulfill({status:409,json:{error:'DRAFT_VERSION_CONFLICT',message:'Bản đã lưu khác phiên bản.'}});state.raw.responses={...state.raw.responses,...req.postDataJSON().responses};state.raw.draftVersion++;if(state.holdSave){state.holdSave=false;state.saveBlocked=true;await state.saveGate;}return route.fulfill({json:{session:state.raw}});}
  state.errors.push('Unexpected fixture '+req.method()+' '+p);return route.fulfill({status:500,json:{error:'UNEXPECTED_FIXTURE'}});
 });
 page.on('pageerror',e=>state.errors.push(e.message));
 const entry=engine==='sw-task2-writing'?'/sw-task2-writing/'+(teacher?'teacher':'index')+'.html?task='+task+(teacher?'&student=fixture-student':''):'/shops-writing/writing-handouts/shops-review/'+(teacher?'connected-teacher':'connected')+'.html?student=fixture-student';
 await page.goto(origin+prefix+entry);
 try{await page.locator('[data-check="topic"]').waitFor({state:'attached',timeout:15000});}
 catch(error){console.log(JSON.stringify({engine,teacher,errors:state.errors,calls:state.calls.slice(-8),body:(await page.locator('body').innerText()).slice(-1800)}));await context.close();await browser.close();throw error;}
 if(teacher){const draft=page.locator('.teacher-draft-read');await draft.evaluate(el=>el.open=true);}
 return {context,page,state,resultCalls:()=>state.calls.filter(c=>c.path.endsWith('/draft-result')).length,sessionCalls:()=>state.calls.filter(c=>c.path.includes('/lesson9/sessions/')).length,async close(){assert.deepEqual(state.escaped,[]);assert.deepEqual(state.errors,[]);assert(state.calls.every(c=>c.method==='GET'||c.method==='PUT'&&c.path.endsWith('/responses')||c.method==='POST'&&c.path.endsWith('/lesson9/sessions')||c.method==='POST'&&c.path.endsWith('/checks')||c.path.includes('/restore/')||c.path.endsWith('/shared-session')));await context.close();}};
}

async function until(check,label){for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+label);}
test('Check after needs_revision can be sent again with the latest saved content',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{await f.page.locator('#field-topicSentence').fill('A revised synthetic topic sentence.');await f.page.locator('[data-check="topic"]').click();await until(()=>f.state.calls.some(c=>c.method==='POST'&&c.path.endsWith('/checks')),'second Check');assert.equal(f.state.raw.responses.topic_sentence,'A revised synthetic topic sentence.');}finally{await f.close();await browser.close();}
});
test('a delayed earlier refresh cannot block the next Check or overwrite later saved fields',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{
  f.state.holdNext=true;await f.page.locator('[data-action="refresh"]').first().click();await until(()=>f.state.blocked,'old read held');
  await f.page.locator('#field-topicSentence').fill('The latest synthetic topic sentence.');await until(()=>f.state.raw.draftVersion===5,'new version saved');await until(async()=>await f.page.locator('#save-state').innerText()==='✓ Đã lưu máy chủ','save completed');
  f.state.releaseRead();await f.page.waitForTimeout(250);
  await f.page.locator('#field-topicSentence').fill('The next synthetic topic sentence.');await f.page.locator('[data-check="topic"]').click();
  await until(()=>f.state.calls.some(c=>c.method==='POST'&&c.path.endsWith('/checks')),'Check after delayed poll');
  assert.equal(f.state.raw.responses.topic_sentence,'The next synthetic topic sentence.');assert.equal(await f.page.locator('[data-action="compare-conflict"]').count(),0);
 }finally{await f.close();await browser.close();}
});

test('a refresh during our pending save must not create a false conflict',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{f.state.holdSave=true;f.state.captureAfterGate=true;f.state.holdNext=true;f.state.saveGate=new Promise(r=>f.state.releaseSave=r);await f.page.locator('[data-action="refresh"]').first().click();await until(()=>f.state.blocked,'read waiting');await f.page.locator('#field-topicSentence').fill('Synthetic first change.');await until(()=>f.state.saveBlocked,'save waiting');f.state.releaseRead();await f.page.waitForTimeout(150);f.state.releaseSave();await until(async()=>await f.page.locator('#save-state').innerText()==='✓ Đã lưu máy chủ','save acknowledged');await f.page.locator('#field-topicSentence').fill('Synthetic second change.');await f.page.locator('[data-check="topic"]').click();await until(()=>f.state.calls.some(c=>c.method==='POST'&&c.path.endsWith('/checks')),'Check after pending save');assert.equal(f.state.raw.responses.topic_sentence,'Synthetic second change.');}finally{await f.close();await browser.close();}
});
test('a real server version conflict still blocks Check and keeps the learner text',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{f.state.raw.draftVersion++;await f.page.locator('#field-topicSentence').fill('Local text must survive a genuine conflict.');await f.page.locator('[data-check="topic"]').click();await f.page.locator('[data-action="compare-conflict"]').waitFor();assert.equal(f.state.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/checks')).length,0);assert.equal(await f.page.locator('#field-topicSentence').inputValue(),'Local text must survive a genuine conflict.');}finally{await f.close();await browser.close();}
});


test('missing outline fields block Check locally, identify the exact fields and focus the hidden outline',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{width:390,configure:s=>{s.raw.responses.body2_message=' \u200b ';s.raw.responses.body2_idea1='';}});
 try{
  await f.page.locator('[data-check="topic"]').click();
  const dialog=f.page.locator('#writing-check-dialog');await dialog.waitFor({timeout:5000});assert.match(await dialog.innerText(),/Thông điệp chung của thân bài 2/);assert.match(await dialog.innerText(),/Idea 1 của thân bài 2/);
  assert.equal(f.state.calls.filter(c=>c.path.endsWith('/checks')).length,0);
  await dialog.getByRole('button',{name:'Đến ô cần bổ sung'}).click();
  assert.equal(await f.page.locator('#field-body2_message').evaluate(e=>document.activeElement===e&&e.closest('details').open),true);
  assert.equal(await f.page.locator('#field-body2_message').getAttribute('aria-invalid'),'true');
  const original=await f.page.locator('#field-topicSentence').inputValue();
  await f.page.locator('#field-body2_message').fill('Thông điệp đã bổ sung.');await f.page.locator('#field-body2_idea1').fill('Ý mới đã bổ sung.');
  assert.equal(await f.page.locator('[aria-invalid="true"]').count(),0);assert.equal(await f.page.locator('#field-topicSentence').inputValue(),original);
  await f.page.locator('[data-check="topic"]').click();await until(()=>f.state.calls.some(c=>c.path.endsWith('/checks')),'Check after filling required fields');
 }finally{await f.close();await browser.close();}
});
test('server failure is visible at Check and in a modal, keeps text and allows retry',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{configure:s=>s.checkStatus=503});
 try{const field=f.page.locator('#field-topicSentence');await field.fill('Keep this synthetic answer.');await f.page.locator('[data-check="topic"]').click();await f.page.locator('#writing-check-dialog').waitFor();assert.match(await f.page.locator('#writing-check-dialog').innerText(),/Dịch vụ chấm đang gián đoạn/);assert.equal(await field.inputValue(),'Keep this synthetic answer.');await f.page.keyboard.press('Escape');assert.equal(await f.page.locator('[data-check="topic"]').evaluate(e=>document.activeElement===e&&!e.disabled),true);assert.match(await f.page.locator('.writing-check-error').innerText(),/Dịch vụ chấm/);f.state.checkStatus=0;await f.page.locator('[data-check="topic"]').click();await until(()=>f.state.calls.filter(c=>c.path.endsWith('/checks')).length===2,'retry after error');}finally{await f.close();await browser.close();}
});
test('rapid repeated Check while submitting sends once and leaves typing available',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{configure:s=>s.checkGate=new Promise(r=>s.releaseCheck=r)});
 try{await f.page.locator('[data-check="topic"]').evaluate(e=>{e.click();e.click();});await until(()=>f.state.calls.some(c=>c.path.endsWith('/checks')),'submission started');assert.equal(f.state.calls.filter(c=>c.path.endsWith('/checks')).length,1);assert.equal(await f.page.locator('[data-check="topic"]').getAttribute('aria-busy'),'true');assert.equal(await f.page.locator('#field-topicSentence').isEnabled(),true);f.state.releaseCheck();await until(async()=>!(await f.page.locator('[data-check="topic"]').isDisabled()),'button restored');}finally{await f.close();await browser.close();}
});
test('editing during save cannot silently submit an older answer',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{f.state.holdSave=true;f.state.saveGate=new Promise(r=>f.state.releaseSave=r);await f.page.locator('#field-topicSentence').fill('First synthetic change.');await f.page.locator('[data-check="topic"]').click();await until(()=>f.state.saveBlocked,'save held');await f.page.locator('#field-topicSentence').fill('Latest unsent change must survive.');f.state.releaseSave();await f.page.locator('#writing-check-dialog').waitFor();assert.equal(f.state.calls.filter(c=>c.path.endsWith('/checks')).length,0);assert.equal(await f.page.locator('#field-topicSentence').inputValue(),'Latest unsent change must survive.');await f.page.keyboard.press('Escape');await f.page.locator('[data-check="topic"]').click();await until(()=>f.state.calls.some(c=>c.path.endsWith('/checks')),'Check newest answer');assert.equal(f.state.raw.responses.topic_sentence,'Latest unsent change must survive.');}finally{await f.close();await browser.close();}
});


test('all eight SW tasks and all four Check sections list every missing required field',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});let count=0;
 try{for(const task of tasks)for(const [key,section] of Object.entries({topic:'topic_sentence',si1:'supporting_idea_1',si2:'supporting_idea_2',draft:'draft'})){
  const f=await fixture(browser,{task,width:count%2?390:1440,configure:s=>{for(const st of Object.values(s.raw.sections)){st.status='passed';st.locked=true;}s.raw.sections[section]={status:'needs_revision',locked:false};for(const field of s.raw.sectionDefinitions.find(d=>d.section===section).requiredFields)if(field!=='body_choice')s.raw.responses[field]='';}});
  try{const button=key==='draft'?f.page.locator('[data-action="grade"]'):f.page.locator(`[data-check="${key}"]`);await button.click();const dialog=f.page.locator('#writing-check-dialog');await dialog.waitFor({timeout:5000});assert.equal(await dialog.locator('li').count(),f.state.raw.sectionDefinitions.find(d=>d.section===section).requiredFields.filter(k=>k!=='body_choice').length,task+' '+key);assert.equal(f.state.calls.filter(c=>c.path.endsWith('/checks')).length,0);await dialog.getByRole('button',{name:'Đến ô cần bổ sung'}).click();assert.equal(await f.page.evaluate(()=>document.activeElement.matches('[data-field]')),true);count++;}finally{await f.close();}
 }assert.equal(count,32);}finally{await browser.close();}
});
