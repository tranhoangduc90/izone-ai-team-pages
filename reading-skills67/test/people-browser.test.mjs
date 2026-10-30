// Trình duyệt thật, API cách ly: kiểm vai trò, sửa/nộp, reload và quyền chỉ xem.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.MATERIALS_SITE_ROOT||resolve(fileURLToPath(new URL('../../',import.meta.url)));
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const site='https://tranhoangduc90.github.io/izone-ai-team-pages',entry=site+'/reading-skills67/materials-beyond-concrete-matching-people/',api='/reading67-materials/api/reading-skills67/materials-beyond-concrete-matching-people';
const person={ownerId:'11111111-1111-4111-8111-111111111111',courseId:'1293',name:'Người học thử',className:'LOPTHU'};
function publicFixture(){
 const people=[['A','Người thử A',2],['B','Người thử B',1],['C','Người thử C',1],['D','Người thử D',1]].map(([id,name,count])=>({id,name,analyses:Array.from({length:count},(_,index)=>({index,targets:Object.fromEntries(['paragraph_location','compressed_statement','matching_sentence'].map(k=>[k,`p${id}.a${index}.${k}`]))}))}));
 const questions=[9,10,11,12,13].map(number=>({number,text:'Câu hỏi giả dùng để kiểm giao diện '+number,targets:{compressed_level_1:`q${number}.compressed_level_1`,answer:`q${number}.answer`}}));
 const targets=[...questions.flatMap(q=>Object.entries(q.targets).map(([kind,id])=>({id,kind,question:q.number,label:'Câu '+q.number+' '+kind}))),...people.flatMap(p=>p.analyses.flatMap(a=>Object.entries(a.targets).map(([kind,id])=>({id,kind,person:p.id,analysis:a.index,label:p.name+' '+kind}))))];
 return {code:'67-reading-fixture-matching-people',version:'fixture',type:'matching_people',lesson:8,title:'Bài Matching People thử',subtitle:'Dữ liệu giả',instruction:'Chọn người và nén lời phát biểu.',minimumRequired:20,blankValues:[],dropdownPlaceholders:[],paragraphs:[...'ABCDEFGH'].map(id=>({id,text:'Đoạn văn giả '+id+' dùng để kiểm Highlight, Note và popup.'})),people,questions,targets};
}
const content=process.env.PEOPLE_PRIVATE_DIR?JSON.parse(await fs.readFile(resolve(process.env.PEOPLE_PRIVATE_DIR,'content.private.json'),'utf8')):publicFixture();
function answers(){return Object.fromEntries(content.targets.map(t=>[t.id,t.kind==='answer'?'C Anna Surgenor':t.kind==='paragraph_location'?'B':t.kind==='matching_sentence'?'Câu 13':'Nội dung tự viết ban đầu']));}
function attempt(id,body,correct=false,revision=1){return {attemptId:id,runNo:1,status:'done',draftRevision:revision,createdAt:'2026-10-25T01:00:00.000Z',snapshot:structuredClone(body),completeness:{filled_cells:25},
 result:{feedback:Object.fromEntries(content.targets.map((t,i)=>[t.id,{status:correct||i>0?'correct':'partial',modelAnswer:'Đáp án thử',reason:'Cần giữ ý chính.',sourceMeaning:'Ý nguồn',nextStep:'Sửa bản nén.'}]))}};}
async function fixture(browser,width,teacher=false,options={}){
 const learner=options.identity||person,lesson=options.lesson||content;
 const context=await browser.newContext({viewport:{width,height:options.height||900},locale:'vi-VN',storageState:options.storageState}),page=await context.newPage();page.setDefaultTimeout(6000);
 const state={teacher,revision:1,body:{answers:answers(),notes:'Ghi chú giữ nguyên',flags:[],annotations:[]},attempts:[],writes:0,submits:0,errors:[],reads:[]};
 if(options.history){
  const old=attempt('old',state.body,options.allCorrect);
  if(options.repairIds)for(const t of content.targets)old.result.feedback[t.id].status=options.repairIds.includes(t.id)?(t.kind==='section'?'incorrect':t.id==='p.C'?'blank':'partial'):'correct';
  if(options.longFeedback)for(const feedback of Object.values(old.result.feedback)){feedback.reason='Cần bổ sung mối quan hệ giữa điều kiện, nguyên nhân và kết quả thay vì chỉ nêu chủ đề chung. '.repeat(5);feedback.nextStep='Đọc lại nguồn, đối chiếu giới hạn và tự viết bản nén chính xác hơn. '.repeat(5);}
  state.attempts=[old];
 }
 page.on('pageerror',e=>state.errors.push(e.message));
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url()),reply=(json,status=200)=>route.fulfill({json,status});
  if(u.href.startsWith('https://accounts.google.com/gsi/client'))return route.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(v){window.fixtureGoogleCallback=v.callback},renderButton(root){const b=document.createElement('button');b.textContent='Google thử cách ly';b.onclick=()=>window.fixtureGoogleCallback({credential:'fixture-google-only'});root.append(b)}}}};`});
  if(u.origin===new URL(site).origin&&u.pathname.startsWith('/izone-ai-team-pages/')){
   let file=resolve(root,decodeURIComponent(u.pathname.slice('/izone-ai-team-pages/'.length)));if(u.pathname.endsWith('/'))file=resolve(file,'index.html');
   if(!file.startsWith(root))return route.abort();
   try{return route.fulfill({body:await fs.readFile(file),contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'}[extname(file)]||'application/octet-stream'});}catch{return reply({},404);}
  }
  if(u.origin!=='https://ducizone.ddns.net')return route.abort();
  if(u.pathname.startsWith('/teacher-session-api/v1/restore/'))return reply({ok:state.teacher},state.teacher?200:401);
  if(u.pathname.endsWith('/shared-session'))return reply({ok:state.teacher},state.teacher?200:401);
  const path=u.pathname.slice(api.length);
  state.reads.push(path);
  if(path==='/config')return reply({code:content.code,title:content.title,type:content.type,lesson:8,autoRole:true,studentsOpen:true,homeworkEnabled:true,googleClientId:'fixture.apps.googleusercontent.com'});
  if(path==='/teacher/login'){state.teacher=true;return reply({ok:true});}
  if(path==='/teacher/classes')return reply({classes:[{id:'1293',classCode:'LOPTHU'}]},state.teacher?200:401);
  if(path.startsWith('/teacher/work/')){
   if(!state.teacher)return reply({error:'TEACHER_LOGIN_REQUIRED'},401);
   if(options.denied||state.denied)return reply({error:'ACCESS_DENIED'},403);
   if(path.includes('/attempts/')){const found=state.attempts.find(a=>a.attemptId===path.split('/').at(-1));return reply(found||{},found?200:404);}
   return reply({identity:learner,content:lesson,draft:{body:state.body,revision:state.revision,runNo:1},attempts:state.attempts,archives:[],readonly:true});
  }
  if(path==='/classes')return reply({classes:[{id:'1293',classCode:'LOPTHU'}]});
  if(path==='/classes/1293/students')return reply({students:[{studentRef:learner.ownerId,name:learner.name}]});
  if(path==='/identity/resolve')return reply({ok:true,status:'unique',identity:{authority:'erp-contact',id:'12345'},aliases:[{studentRef:learner.ownerId,classId:'1293',classCode:'LOPTHU',studentName:learner.name}]});
  if(path==='/student/login')return reply({identity:learner,token:'fixture-token'});
  if(path==='/lesson')return reply({identity:learner,content:lesson});
  if(path==='/draft'){
   if(request.method()==='PUT'){const value=request.postDataJSON();assert.equal(value.baseRevision,state.revision);state.body=value.body;state.revision++;state.writes++;}
   return reply({body:state.body,revision:state.revision,runNo:1,completeness:{filled_cells:25},savedAt:'2026-10-25T02:00:00.000Z'});
  }
  if(path==='/attempts')return reply({attempts:state.attempts,archives:[]});
  if(path.startsWith('/attempts/'))return reply(state.attempts.find(a=>a.attemptId===path.split('/').at(-1))||{},state.attempts.some(a=>a.attemptId===path.split('/').at(-1))?200:404);
  if(path==='/submit'){state.submits++;const a=attempt('sent-'+state.submits,state.body,state.submits>1,state.revision);state.attempts.unshift(a);return reply(a,202);}
  if(path==='/homework')return reply({status:'verified',cta:'verified',jobs:[]});
  return reply({error:'UNKNOWN_FIXTURE_ROUTE'},404);
 });
 await page.goto(options.url||entry+(teacher?'?server=1&teacher=1&classId=1293&studentRef='+learner.ownerId:'?server=1'));
 if(options.cold){await page.locator('#entry-class').waitFor();return {context,page,state};}
 if(!teacher&&!options.remembered){await page.locator('#entry-class').selectOption('1293');await page.locator('#entry-student').selectOption(learner.ownerId);await page.getByRole('button',{name:'Vào bài',exact:true}).click();}
 await page.locator('.lesson-head').waitFor();
 return {context,page,state};
}

for(const width of [1440,390])test(`Sửa, lưu/reload, popup, nộp lại đủ25 mục · ${width}px`,async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const {page,state}=await fixture(browser,width);if(width<=800)await page.locator('[data-pane="questions"]').click();
  assert.equal(await page.locator('[data-target]').count(),25);
  await page.getByRole('button',{name:'Nộp bài',exact:true}).click();await page.getByRole('heading',{name:'Còn 1 phần cần sửa',exact:true}).waitFor();
  await page.locator('#modal').getByRole('button',{name:'Tôi sẽ sửa',exact:true}).click();
  await page.locator('[data-target="q9.compressed_level_1"]').fill('Nội dung đã được sửa');await page.getByText('Đã sửa — chờ chấm lại',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('#save-state')?.dataset.saveStatus==='saved');
  await page.reload();await page.locator('.repair-banner').waitFor();assert.equal(await page.locator('[data-target="q9.compressed_level_1"]').inputValue(),'Nội dung đã được sửa');
  await page.locator('.repair-field-note').getByRole('button',{name:'Xem giải thích lần chấm trước'}).click();await page.locator('#explanation-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#explanation-dialog .answer-copy').textContent(),'Nội dung tự viết ban đầu');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Nộp lại bài',exact:true}).click();await page.getByRole('heading',{name:'Chúc mừng! Bạn đã sửa đúng toàn bộ bài.',exact:true}).waitFor();assert.equal(state.attempts.length,2);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
for(const width of [1440,390])test(`GV lồng đúng bài,25 ô chỉ đọc; sửa/Trước/Tiếp tới mọi ô · ${width}px`,async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const {page,state}=await fixture(browser,width,true,{history:true,repairIds:content.targets.map(t=>t.id),url:entry+'?server=1&teacher=1&classId=1293&studentRef='+person.ownerId+'&attemptId=old'});
  await page.locator('.repair-banner').waitFor();assert.equal(await page.locator('[data-target]').count(),25);assert.equal(await page.locator('[data-target]:not([readonly]):not([disabled])').count(),0);assert.equal(await page.locator('#grade-button').count(),0);
  await page.getByRole('button',{name:'Giảng viên',exact:true}).click();await page.getByRole('button',{name:'Xem như học viên · Chỉ xem'}).click();assert.equal(state.writes,0);assert.equal(state.submits,0);
  await page.locator('[data-action="repair-start"]').click();
  for(let i=0;i<25;i++){
   const id=content.targets[i].id;await page.waitForFunction(id=>document.querySelector('[data-repair-target]')?.dataset.repairTarget===id&&(document.activeElement?.dataset.target||document.activeElement?.querySelector('[data-target]')?.dataset.target)===id,id);
   const active=await page.evaluate(()=>document.activeElement?.dataset.target||document.activeElement?.querySelector('[data-target]')?.dataset.target);assert.equal(active,id);
   if(i<24)await page.locator('[data-repair-direction="1"]').click();
  }
  assert.equal(await page.locator('[data-repair-direction="1"]').isDisabled(),true);assert.equal(state.writes,0);assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
test('Ba lần đọc kết quả không đổi giữ node/focus/bôi chọn/cuộn và popup',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const {page,state}=await fixture(browser,1440,true,{history:true,url:entry+'?server=1&teacher=1&classId=1293&studentRef='+person.ownerId+'&attemptId=old'});
  await page.locator('.attempt-context').waitFor();
  await page.locator('[data-explain="q9.compressed_level_1"]').click();await page.locator('#explanation-dialog').waitFor({state:'visible'});
  await page.evaluate(()=>{window.proofNodes={app:document.querySelector('.people-work'),popup:document.querySelector('.explanation-dialog-detail-scroll'),button:document.activeElement};window.proofNodes.popup.scrollTop=80;const p=document.querySelector('.explanation-dialog-detail-scroll p');const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);window.proofSelection=getSelection().toString();});
  const initial=state.reads.filter(r=>r.endsWith('/attempts/old')).length;
  for(let i=0;i<3;i++)await page.evaluate(async()=>trackServerAttempt(await window.ReadingServerClient.getAttempt('old')));
  assert.ok(state.reads.filter(r=>r.endsWith('/attempts/old')).length>=initial+3);
  assert.equal(await page.evaluate(()=>window.proofNodes.app===document.querySelector('.people-work')&&window.proofNodes.popup===document.querySelector('.explanation-dialog-detail-scroll')&&window.proofNodes.button===document.activeElement&&window.proofSelection===getSelection().toString()),true);
  assert.equal(state.writes,0);assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);
 }finally{await browser.close();}
});
