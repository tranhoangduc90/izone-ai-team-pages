// Ca hồi quy của SW: HTML/module thật, HTTP giả cách ly; không gọi API/AI thật.
// Bắt lỗi dựng lại vùng đang đọc sau polling; các test startup cũ chỉ mở workspace.
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
 const definitions=[['topic_sentence',['topic_sentence','body1_idea1','body1_idea2','body_choice']],['supporting_idea_1',['idea1_a','idea1_x','idea1_b']],['supporting_idea_2',['idea2_a','idea2_x','idea2_b']],['draft',['draft1','draft2']]].map(([key,inputFields])=>({key,inputFields}));
 const attempts=definitions.map(({key},i)=>({attemptRef:student+'-attempt-'+i,section:key,status:'completed',resultStatus:'passed',snapshot:responses,createdAt:stamp,completedAt:stamp}));
 return {sessionRef:student+'-session',activitySlug:task,studentRef:student,classRef:'fixture-class',draftVersion:4,updatedAt:stamp,responses,sectionDefinitions:definitions,sections:Object.fromEntries(definitions.map(d=>[d.key,{status:'passed',locked:true}])),attempts,comments:attempts.map(a=>({attemptRef:a.attemptRef,section:a.section,status:'passed',feedback:'Nhận xét tổng hợp đã lưu.',createdAt:stamp})),ui:{version:'sw-task2-lesson9-v1',data:{idea2Opened:true,draft2Open:true,editedFields:[]}},uiEvents:[],uiVocabulary:{status:'completed',groups:Object.fromEntries(['A1','X1','B1','A2','X2','B2'].map(k=>[k,[{phrase:'synthetic phrase',meaningVi:'cụm từ thử'}]]))}};
}
const blocks=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
function resultPayload(label='Bản chấm đầu',count=3){return {essays:Array.from({length:count},(_,i)=>({id:'sentence-'+i,index:i,content:blocks('Synthetic original sentence '+i),suggestedContent:blocks('Synthetic suggestion '+i),comments:['<p>'+label+' · Thẻ '+(i+1)+'. '+('Nhận xét dài để kiểm vị trí đọc. '.repeat(45))+'</p>']})),updatedAt:stamp,...(count?{}:{noCorrections:true,readbackOk:true})};}
async function fixture(browser,{task=tasks[0],teacher=false,width=1440,engine='sw-task2-writing'}={}){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 const state={raw:rawSession(task),result:resultPayload(),threads:[],calls:[],errors:[],escaped:[],resultStatus:200,sessionStatus:200,resultDelay:80};
 await context.addInitScript(({task})=>localStorage.setItem('izone:sw-task2:production:'+task+':identity',JSON.stringify({id:'fixture-student',classRef:'fixture-class',sessionRef:'fixture-student-session'})),{task});
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
  if(p.includes('/lesson9/sessions/'))return route.fulfill({status:state.sessionStatus,json:state.sessionStatus===200?{session:state.raw}:{error:'FIXTURE_SESSION_UNAVAILABLE'}});
  if(p.endsWith('/responses')&&req.method()==='PUT'){state.raw.responses={...state.raw.responses,...req.postDataJSON().responses};state.raw.draftVersion++;return route.fulfill({json:{session:state.raw}});}
  state.errors.push('Unexpected fixture '+req.method()+' '+p);return route.fulfill({status:500,json:{error:'UNEXPECTED_FIXTURE'}});
 });
 page.on('pageerror',e=>state.errors.push(e.message));
 const entry=engine==='sw-task2-writing'?'/sw-task2-writing/'+(teacher?'teacher':'index')+'.html?task='+task+(teacher?'&student=fixture-student':''):'/shops-writing/writing-handouts/shops-review/connected-teacher.html?student=fixture-student';
 await page.goto(origin+prefix+entry);
 try{await page.locator('#connected-draft-result .lms-page-status').waitFor({state:'attached',timeout:15000});}
 catch(error){console.log(JSON.stringify({engine,teacher,errors:state.errors,calls:state.calls.slice(-8),body:(await page.locator('body').innerText()).slice(-1800)}));throw error;}
 if(teacher){const draft=page.locator('.teacher-draft-read');await draft.evaluate(el=>el.open=true);}
 return {context,page,state,resultCalls:()=>state.calls.filter(c=>c.path.endsWith('/draft-result')).length,sessionCalls:()=>state.calls.filter(c=>c.path.includes('/lesson9/sessions/')).length,async close(){assert.deepEqual(state.escaped,[]);assert.deepEqual(state.errors,[]);assert(state.calls.every(c=>c.method==='GET'||c.method==='PUT'&&c.path.endsWith('/responses')||c.method==='POST'&&c.path.endsWith('/lesson9/sessions')||c.path.includes('/restore/')||c.path.endsWith('/shared-session')));await context.close();}};
}
async function rememberReading(page){
 await page.locator('#connected-draft-result .lms-page-button').last().click();
 return page.evaluate(()=>{
  const result=document.querySelector('#connected-draft-result'),card=result.querySelector('.lms-sentence-card:not([hidden])');
  card.scrollIntoView({block:'start'});const paragraph=card.querySelector('.lms-sentence-review-body p');
  const range=document.createRange();range.selectNodeContents(paragraph);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  window.__reading={result,card,focus:document.activeElement,selection:selection.toString(),top:card.getBoundingClientRect().top,scrollY,scrollTop:document.querySelector('#detail')?.scrollTop,loading:0};
  window.__reading.observer=new MutationObserver(()=>{if(/Đang đọc kết quả/.test(document.querySelector('#connected-draft-result')?.innerText||''))window.__reading.loading++;});window.__reading.observer.observe(document.querySelector('#app'),{subtree:true,childList:true});
 });
}
async function assertReading(page){
 const snapshot=await page.evaluate(()=>{const r=window.__reading;r.observer.disconnect();return {same:r.result===document.querySelector('#connected-draft-result'),card:r.card===document.querySelector('.lms-sentence-card:not([hidden])'),focus:r.focus===document.activeElement,selection:r.selection===getSelection().toString(),position:Math.abs(r.top-r.card.getBoundingClientRect().top)<2,loading:r.loading};});
 assert.deepEqual(snapshot,{same:true,card:true,focus:true,selection:true,position:true,loading:0},'Polling phải giữ nguyên vùng đọc/thẻ/focus/bôi chọn/vị trí trên màn hình và không chớp loading');
}

test('SW học viên và GV: giữ vùng đọc qua 35 giây cập nhật nền thật',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const [teacher,engine] of [[false,'sw-task2-writing'],[true,'sw-task2-writing'],[true,'shops-writing']]){if(process.env.SW_READING_ENGINE&&engine!==process.env.SW_READING_ENGINE)continue;const f=await fixture(browser,{teacher,engine});try{
  await rememberReading(f.page);const before=f.sessionCalls();await f.page.waitForTimeout(35000);
  assert(f.sessionCalls()-before>=3,'Phải thực sự đi qua ít nhất ba nhịp GET');await assertReading(f.page);
  assert(f.resultCalls()>=3,'Vẫn kiểm HTTP để nhận sửa kết quả cùng lượt, nhưng không dựng lại khi nội dung không đổi');
  if(output){await fs.mkdir(output,{recursive:true});await f.page.screenshot({path:resolve(output,engine+'-'+(teacher?'teacher':'student')+'-stable.png'),fullPage:true});}
 }finally{await f.close();}}}finally{await browser.close();}
});

test('SW: trao đổi mới vẫn cập nhật, kết quả cũ giữ nguyên; lượt chấm mới thay đúng thẻ',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const f=await fixture(browser);
 try{
  await rememberReading(f.page);f.state.threads=[{threadRef:'fixture-thread',fieldKey:'topic_sentence',status:'open',anchor:{quote:'topic_sentence',detached:false},messages:[{authorRole:'teacher',body:'Góp ý mới phải xuất hiện',createdAt:stamp}]}];
  await f.page.getByText('Góp ý mới phải xuất hiện',{exact:true}).first().waitFor({state:'attached',timeout:12000});await assertReading(f.page);
  f.state.raw.attempts.unshift({...f.state.raw.attempts.find(a=>a.section==='draft'),attemptRef:'new-draft-attempt',status:'leased',resultStatus:null,completedAt:null});f.state.raw.sections.draft={status:'queued',locked:false};
  await f.page.getByRole('button',{name:'Đang chấm…',exact:true}).waitFor({timeout:12000});assert.equal(await f.page.locator('#connected-draft-result').count(),0);
  Object.assign(f.state.raw.attempts[0],{status:'completed',resultStatus:'passed',completedAt:'2026-10-27T08:01:00.000Z'});f.state.raw.sections.draft={status:'passed',locked:true};f.state.result=resultPayload('Bản chấm mới',1);
  await f.page.locator('#connected-draft-result').filter({hasText:'Bản chấm mới'}).waitFor({timeout:12000});
  assert.equal(await f.page.locator('#connected-draft-result .lms-sentence-card').count(),1);
  f.state.raw.attempts.unshift({...f.state.raw.attempts[0],attemptRef:'clean-draft-attempt'});f.state.result=resultPayload('Sạch',0);
  await f.page.getByText('Đã chấm xong. Không có câu nào cần chỉnh sửa trong lần chấm này.',{exact:true}).waitFor({timeout:12000});
 }finally{await f.close();await browser.close();}
});

test('SW: cập nhật trong cùng lượt, lỗi kết quả tạm, 403 và phục hồi đúng thẻ',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{
  await rememberReading(f.page);f.state.result=resultPayload('Sửa nhận xét cùng lượt',3);
  await f.page.locator('#connected-draft-result').filter({hasText:'Sửa nhận xét cùng lượt'}).waitFor({timeout:12000});
  assert.equal(await f.page.locator('.lms-page-status').innerText(),'Thẻ 2 / 3');
  await rememberReading(f.page);f.state.resultStatus=503;
  await f.page.locator('#notice').filter({hasText:'Chưa đọc được cập nhật kết quả'}).waitFor({timeout:12000});await assertReading(f.page);
  f.state.resultStatus=403;await f.page.locator('#connected-draft-result').filter({hasText:'FIXTURE_RESULT_UNAVAILABLE'}).waitFor({timeout:12000});
  assert.equal(await f.page.locator('.lms-sentence-card').count(),0,'403 phải khóa kết quả cũ');
  f.state.resultStatus=200;await f.page.locator('.lms-page-status').waitFor({timeout:12000});assert.equal(await f.page.locator('.lms-page-status').innerText(),'Thẻ 3 / 3');
 }finally{await f.close();await browser.close();}
});

test('SW: response kết quả muộn không gắn sang người mới; autosave giữ chữ',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser);
 try{
  const draft=f.page.locator('#field-draft2');await draft.fill('Nội dung mới của học viên thử');
  await f.page.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='✓ Đã lưu máy chủ');
  assert.equal(await draft.inputValue(),'Nội dung mới của học viên thử');assert(f.state.calls.some(c=>c.method==='PUT'));
  f.state.resultDelay=3000;f.state.result=resultPayload('Kết quả cũ tới muộn',3);
  const pending=f.page.waitForRequest(request=>request.url().endsWith('/draft-result'),{timeout:12000});
  await f.page.getByRole('button',{name:'Đọc cập nhật',exact:true}).click();await pending;
  await f.page.getByRole('button',{name:'Đổi người học',exact:true}).click();
  await f.page.locator('#identity-person').selectOption('fixture-other');await f.page.getByRole('button',{name:/Tiếp tục/}).click();await f.page.locator('#confirm-button').click();
  await f.page.locator('#connected-draft-result').filter({hasText:'Người học mới'}).waitFor({timeout:12000});
  assert.equal(await f.page.locator('#learner-label').innerText(),'Người thử khác');assert.equal(await f.page.getByText(/Kết quả cũ tới muộn/).count(),0);
  assert.equal(await f.page.locator('.lms-page-status').innerText(),'Thẻ 1 / 1');
  f.state.raw.previewReadOnly=true;await f.page.getByRole('button',{name:'Đọc cập nhật',exact:true}).click();
  await f.page.waitForFunction(()=>document.querySelector('#field-draft2')?.disabled===true,null,{timeout:12000});
 }finally{await f.close();await browser.close();}
});

test('SW: đủ tám cấu hình trên mobile và lỗi đọc tạm không xóa kết quả',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const task of tasks){const f=await fixture(browser,{task,width:390});try{
  await rememberReading(f.page);f.state.sessionStatus=503;await f.page.locator('#notice').filter({hasText:'FIXTURE_SESSION_UNAVAILABLE'}).waitFor({timeout:12000});await assertReading(f.page);
  f.state.sessionStatus=200;await f.page.getByRole('button',{name:'Đọc cập nhật',exact:true}).click();
  assert.equal(await f.page.locator('#connected-draft-result .lms-page-status').innerText(),'Thẻ 2 / 3');
  assert(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Không tràn ngang');
 }finally{await f.close();}}}finally{await browser.close();}
});

test('SW y tế: danh sách đếm đúng trao đổi mở và đưa bài vào nhóm cần hỗ trợ',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),f=await fixture(browser,{teacher:true,task:'writing-task2-public-health-spending'});
 try{
  const original=JSON.stringify(f.state.raw);
  f.state.threads=Array.from({length:5},(_,i)=>({threadRef:'health-thread-'+i,fieldKey:'topic_sentence',status:'open',anchor:{quote:'topic_sentence',detached:false},messages:[{authorRole:'teacher',body:'Góp ý y tế '+i,createdAt:stamp}]}));
  const card=f.page.locator('[data-student="fixture-student"]');
  await card.filter({hasText:'5 trao đổi mở'}).waitFor({state:'attached',timeout:12000});
  assert.equal(await card.getAttribute('data-state'),'support');
  assert.match(await f.page.locator('#detail').innerText(),/5 trao đổi mở/);
  for(const t of f.state.threads)t.status='addressed';
  await card.filter({hasText:'0 trao đổi mở'}).waitFor({state:'attached',timeout:12000});
  assert.equal(await card.getAttribute('data-state'),'complete');
  assert.equal(JSON.stringify(f.state.raw),original,'Đếm/lọc trao đổi không ghi lại bài hoặc lịch sử');
 }finally{await f.close();await browser.close();}
});

test('SW y tế: cả HV và GV dùng nhãn Giảng viên trên trao đổi thật',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const teacher of [false,true]){const f=await fixture(browser,{teacher,task:'writing-task2-public-health-spending'});try{
  const original=JSON.stringify(f.state.raw);
  f.state.threads=[{threadRef:'health-author',fieldKey:'topic_sentence',status:'open',anchor:{quote:'topic_sentence',detached:false},messages:[{authorRole:'teacher',body:'Nhận xét giảng viên của bài y tế',createdAt:stamp}]}];
  if(teacher)await f.page.locator('#detail [data-action="refresh"]').click();else await f.page.locator('[data-action="refresh"]').click();
  await f.page.getByText('Nhận xét giảng viên của bài y tế',{exact:true}).first().waitFor({state:'attached'});
  const text=await f.page.locator('#app').textContent();
  assert.match(text,/Nhận xét giảng viên của bài y tế/);
  assert.equal(text.includes('Giảng viên mẫu'),false,'Không ghi nhãn mẫu lên nhận xét thật');
  assert.match(text,/GV · Giảng viên/);
  assert.equal(JSON.stringify(f.state.raw),original);
 }finally{await f.close();}}}finally{await browser.close();}
});
