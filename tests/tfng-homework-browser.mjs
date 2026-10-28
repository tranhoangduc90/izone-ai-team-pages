// Renderer/handlers thật, API giả cách ly: kiểm đủ 42 trường, vòng sửa, lịch sử, popup và quyền chỉ xem.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.env.TFNG_EVIDENCE_DIR;
assert.ok(out);await fs.mkdir(out,{recursive:true});
if(process.env.TFNG_VIEWPORT_WIDTH)assert.ok([1440,1366,390,320,844].includes(Number(process.env.TFNG_VIEWPORT_WIDTH)),'Choose an existing viewport; an empty run must not pass.');
const content={type:'tfng',lesson:12,code:'synthetic-tfng-browser',version:'fixture-v1',title:'Bài đọc giả về sự thay đổi của một quần thể',subtitle:'Dữ liệu cách ly',instruction:'Đối chiếu đủ ba mảnh rồi kết luận toàn câu.',blankValues:[],dropdownPlaceholders:[],minimumRequired:42,paragraphs:Array.from({length:9},(_,i)=>({id:String(i+1),text:('Synthetic source evidence for a careful comparison of time, place and conditions. ').repeat(9)})),questions:[],targets:[]};
for(let q=1;q<=6;q++){
 const question={number:q,text:'Synthetic statement '+q+' compares a reported change with the supplied source and its conditions.',leader:'synthetic, conditions',sensitive:'comparison and scope',targets:{},chunks:[]};
 for(let m=1;m<=3;m++){const evidence=`q${q}.m${m}.evidence`,label=`q${q}.m${m}.label`;question.chunks.push({number:m,text:['The observed population','changed in the reported way','under the specified conditions'][m-1],evidenceTarget:evidence,labelTarget:label});question.targets['m'+m+'_evidence']=evidence;question.targets['m'+m+'_label']=label;content.targets.push({id:evidence,kind:'evidence',question:q,label:`Câu ${q} · Mảnh ${m} · Nội dung tương ứng`},{id:label,kind:'chunk_label',question:q,label:`Câu ${q} · Mảnh ${m} · T/F/NG`});}
 question.targets.conclusion=`q${q}.conclusion`;content.targets.push({id:question.targets.conclusion,kind:'conclusion',question:q,label:`Câu ${q} · Kết luận toàn câu`});content.questions.push(question);
}
const wrong=['q4.m2.evidence','q4.conclusion','q5.m1.evidence','q5.conclusion'];
function stub(content){
 const clone=v=>JSON.parse(JSON.stringify(v)),teacher=new URLSearchParams(location.search).get('teacher')==='1';
 let body={answers:{},flags:[],notes:'',annotations:[]},attempts=[],revision=0,serial=0;
 const answers=()=>Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='evidence'?'Synthetic source evidence':'TRUE']));
 const wrong=['q4.m2.evidence','q4.conclusion','q5.m1.evidence','q5.conclusion'];
 function result(snapshot,allCorrect){
  const feedback=Object.fromEntries(content.targets.map(t=>[t.id,{status:!allCorrect&&wrong.includes(t.id)?'incorrect':'correct',reason:!allCorrect&&wrong.includes(t.id)?'Em đang nhầm thông tin không được đề cập với thông tin trái ngược.':'Nội dung phù hợp với ý trong bài đọc.',modelAnswer:t.kind==='evidence'?'Synthetic source evidence':'TRUE',nextStep:!allCorrect&&wrong.includes(t.id)?'Lần sau, đối chiếu thông tin được nêu rõ trước khi kết luận.':'',sourceMeaning:'Giải thích giả dùng để kiểm giao diện.',raw:{source_paragraphs:[String(t.question)]}}]));
  return {feedback,grading:{question_explanations:content.questions.map(q=>({...q,answer:'TRUE',explanation:'Giải thích giả để kiểm bố cục, đối chiếu và giữ đầy đủ nội dung khi cuộn.',chunks:q.chunks.map(c=>({...c,expectedEvidence:'Synthetic source evidence',label:'TRUE'}))}))}};
 }
 function progress(allCorrect){return {kind:'tfng',evidenceCorrect:allCorrect?18:16,evidenceTotal:18,labelCorrect:18,labelTotal:18,conclusionCorrect:allCorrect?6:4,conclusionTotal:6,total:42,remainingCount:allCorrect?0:4,needsRepair:allCorrect?[]:wrong,allCorrect};}
 function complete(attempt){attempt.status='done';attempt.result=result(attempt.snapshot,attempt.draftRevision>1);attempt.progress=progress(attempt.draftRevision>1);return attempt;}
 if(teacher){body.answers=answers();serial=1;attempts=[complete({attemptId:'synthetic-1',runNo:1,draftRevision:2,createdAt:'2026-10-27T01:00:00Z',snapshot:clone(body),completeness:{filled_cells:42,total_cells:42}})];}
 const identity={ownerId:'synthetic-owner',courseId:'1124',name:'Học viên thử',className:'LỚP THỬ'};
 const C={identity,access:{teacher,config:{demo:true,type:'tfng',lesson:12}},initialHistory:{attempts},state:{status:'saved',savedAt:null,completeness:{filled_cells:0,total_cells:42}},runNo:1,revision:0,
  initialize:async()=>({content,identity,teacher,draft:{body:clone(body),savedAt:null},history:clone(attempts),config:{demo:true,type:'tfng',lesson:12},restored:false}),
  schedule(value){if(teacher)throw Error('Teacher attempted a write');body=clone(value);revision++;C.revision=revision;C.state.completeness.filled_cells=Object.values(body.answers).filter(Boolean).length;C.state.savedAt='2026-10-27T01:00:00Z';window.dispatchEvent(new Event('reading67:server-state'));return false;},
  flush:async()=>{},getDraft:async()=>({body:clone(body),savedAt:C.state.savedAt,runNo:1,revision}),
  async submit(){serial++;const a={attemptId:'synthetic-'+serial,runNo:1,draftRevision:serial,createdAt:'2026-10-27T01:00:00Z',status:'queued',snapshot:clone(body),completeness:{filled_cells:42,total_cells:42},result:null};attempts.unshift(a);C.initialHistory={attempts};return clone(a);},
  getAttempt:async id=>clone(attempts.find(a=>a.attemptId===id)),
  poll(id,fn){setTimeout(()=>{const a=attempts.find(a=>a.attemptId===id);complete(a);C.initialHistory={attempts};fn(clone(a));},40);},stopPoll(){},
  getHistory:async()=>clone(attempts),historyDetail:async()=>({attempts:clone(attempts),archives:[]}),changeIdentity:async()=>{},
 };
 window.ReadingServerClient=C;window.__tfngTest={body:()=>clone(body),attempts:()=>clone(attempts)};
}
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{
 for(const [width,height] of [[1440,900],[1366,600],[390,844],[320,568],[844,390]]){
  if(process.env.TFNG_VIEWPORT_WIDTH&&width!==Number(process.env.TFNG_VIEWPORT_WIDTH))continue;
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==site.origin)return route.abort();if(r.method()!=='GET'){writes.push(u.pathname);return route.abort();}if(u.pathname.endsWith('/api-config.js'))return route.fulfill({contentType:'text/javascript',body:''});if(u.pathname.endsWith('/web-client.js'))return route.fulfill({contentType:'text/javascript',body:`(${stub.toString()})(${JSON.stringify(content)});`});return route.continue();});
   const url=site.origin+'/reading-skills67/butterflies-britain-tfng/?server=1';await page.goto(url);await page.waitForSelector('[data-target]',{state:'attached'});await page.evaluate(()=>document.fonts.ready);
   const ui=await page.evaluate(()=>({profile:document.body.dataset.izoneUiProfile,input:getComputedStyle(document.querySelector('textarea[data-target]')).fontSize,select:getComputedStyle(document.querySelector('select[data-target]')).fontSize,flag:getComputedStyle(document.querySelector('[data-flag]'),'::before').maskImage}));
   assert.equal(ui.profile,'skill-homework','The real lesson entry must load its Homework profile.');assert.equal(ui.input,'18px');assert.equal(ui.select,'18px');assert.match(ui.flag,/icons\/flag\.svg/);
   assert.equal(await page.locator('[data-target]').count(),42);assert.equal(await page.locator('textarea[data-target]').count(),18);assert.equal(await page.locator('select[data-target]').count(),24);
   if(width<=800||height<=500)await page.locator('[data-pane="questions"]').click();
   if(width<=800||height<=500){
    await page.locator('[data-question="6"]').click();
    await page.waitForFunction(()=>{const q=document.querySelector('#question-6').getBoundingClientRect(),heading=document.querySelector('#pane-questions .pane-heading').getBoundingClientRect();return q.top>=heading.bottom+8&&q.top<innerHeight-100;});
   }
   for(const t of content.targets){const locator=page.locator('[data-target="'+t.id+'"]');if(t.kind==='evidence')await locator.fill(wrong.includes(t.id)?'Mistaken synthetic meaning':'Synthetic source evidence');else await locator.selectOption(wrong.includes(t.id)?'FALSE':'TRUE');}
   await page.locator('[data-flag="6"]').click();assert.deepEqual(await page.evaluate(()=>window.__tfngTest.body().flags),[6]);
   assert.match(await page.locator('#progress-label').textContent(),/42\/42/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:out+'/draft-'+width+'.png'});
   await page.locator('#grade-button').click();await page.waitForSelector('.repair-banner');await page.locator('[data-close-modal]').first().click();assert.match(await page.locator('.repair-banner').textContent(),/Còn 4 phần/);
   await page.locator('[data-action="edit"]').click();await page.waitForSelector('.repair-current');
   const oldReason=await page.locator('[data-target="q4.m2.evidence"]').locator('..').locator('.repair-previous-reason').textContent();
   for(const id of wrong){const el=page.locator('[data-target="'+id+'"]');if(id.endsWith('.evidence'))await el.fill('Synthetic source evidence');else await el.selectOption('TRUE');}
   assert.match(await page.locator('.repair-banner').textContent(),/Còn 4 phần/);assert.equal(await page.locator('[data-target="q4.m2.evidence"]').locator('..').locator('.repair-previous-reason').textContent(),oldReason);
   await page.screenshot({path:out+'/repair-'+width+'.png'});await page.locator('#grade-button').click();await page.waitForFunction(()=>document.querySelector('.repair-banner')?.textContent.includes('Đã đạt toàn bộ'));
   await page.locator('[data-close-modal]').first().click();assert.equal(await page.locator('.feedback.correct').count(),42);assert.deepEqual(await page.evaluate(()=>window.__tfngTest.attempts().map(a=>a.progress.remainingCount)),[0,4]);
   for(let q=1;q<=6;q++){const trigger=page.locator('[data-explain="q'+q+'.conclusion"]');await trigger.click();assert.match(await page.locator('#explanation-dialog-title').textContent(),new RegExp('Câu '+q));assert.equal(await page.locator('#explanation-dialog .popup-paragraph').count(),9);if(q===6){await page.screenshot({path:out+'/explanation-'+width+'.png'});assert.equal(await page.locator('[data-explain-offset="1"]').isDisabled(),true);}await page.keyboard.press('Escape');}
   await page.locator('[data-action="history"]').click();assert.equal(await page.locator('[data-server-attempt]').count(),2);await page.keyboard.press('Escape');
   await page.goto(url+'&teacher=1&attemptId=synthetic-1');await page.waitForSelector('.result-note');assert.equal(await page.locator('textarea[data-target][readonly]').count(),18);assert.equal(await page.locator('select[data-target]:disabled').count(),24);assert.equal(await page.locator('#grade-button').count(),0);
   await page.locator('#teacher').click();await page.locator('[data-materials-view="student"]').click();assert.equal(await page.locator('textarea[data-target][readonly]').count(),18);assert.equal(await page.locator('select[data-target]:disabled').count(),24);
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);records.push({width,height,outcome:'passed'});
  }catch(error){await page.screenshot({path:out+'/failure-'+width+'.png'});records.push({width,height,outcome:'failed',message:error.message,errors});}
  finally{await context.close();}
 }
}finally{await browser.close();await site.close();}
await fs.writeFile(out+'/results.json',JSON.stringify({scope:'Synthetic API fixture, actual renderer and handlers, isolated Chrome viewports; no Google/AI/learner writes.',records},null,2));
console.log(JSON.stringify(records));if(records.some(r=>r.outcome==='failed'))process.exitCode=1;
