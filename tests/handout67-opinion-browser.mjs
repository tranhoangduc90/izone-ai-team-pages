// Controller/HTML/CSS thật; API và AI giả trong RAM, không tạo phiên hoặc ghi bài production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createState} from '../writing-handouts/lesson5-demo/core.mjs';
import {AGREEMENT_LEVELS} from '../writing-handouts/shared/workflow.mjs';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.HANDOUT67_EVIDENCE_DIR||resolve(import.meta.dirname,'../output/handout13');
const lesson={activity:'lesson13',number:13,title:'Lãnh đạo trẻ hay lớn tuổi?',topic:'Directors and managers of organisations are often older people. Some people say that it is better for younger people to be leaders. To what extent do you agree or disagree?',shortTitle:'Lãnh đạo trẻ hay lớn tuổi?',classes:['fixture'],workflowMode:'whole-chain-v1',handoutMode:'two-bodies-v1',preparationMode:'ideas-first-v1',preparationKind:'opinion-v1',rosterScope:'lesson',solutionOptions:['Lãnh đạo trẻ tuổi','Lãnh đạo lớn tuổi'],description:'Chốt mức độ đồng ý và bốn idea trước.',helpTitle:'Chốt lập trường và phát triển A → X → B',helpItems:['Chọn mức đồng ý.','Thân1 không ủng hộ, thân2 ủng hộ.','Check cả chuỗi.'],bodies:[1,2].map(body=>({body,title:'Thân bài '+body,focus:body===1?'Đánh giá phương án không ủng hộ.':'Bảo vệ phương án ủng hộ.',topicInstruction:'Viết Topic từ hai idea đã chốt.',chainInstruction:'Nhập đủ A → X → B và Check chung.',comparisonInstruction:'Ý2 cần phân biệt được với ý1.'}))};
function fixture(){
 const raw={...createState(0,lesson),ref:'fixture-session',activity:'lesson13',classRef:'fixture',studentRef:'fixture-student',version:0,submittedSections:[],vocabulary:{},commentThreads:[],processing:{}};
 const calls=[],errors=[];return {raw,calls,errors,async mount(context,origin){await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
  const send=(body,status=200)=>route.fulfill({status,headers,json:structuredClone(body)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(p.startsWith('/api/handout67/v1/')){
   calls.push({p,method:req.method()});const input=req.postData()?req.postDataJSON():{};
   if(p.includes('/lessons/'))return send({ok:true,lesson});
   if(p.endsWith('/roster'))return send({ok:true,classes:[{classRef:'fixture',className:'Lớp thử cách ly',students:[{studentRef:'fixture-student',displayName:'Học viên mẫu'}]}]});
   if(p.endsWith('/responses')){assert.equal(input.baseVersion,raw.version);Object.assign(raw.responses,input.responses);raw.version++;return send({ok:true,session:raw});}
   if(p.endsWith('/checks')){const key=input.section;raw.steps[key].status='passed';raw.steps[key].history.push({number:1,status:'passed',feedback:'Nhận xét mô phỏng · Đã đạt. 👍',snapshot:{...raw.responses},jobRef:'fixture-'+key});raw.submittedSections.push(key);
    if(key.endsWith('si2'))raw.vocabulary['body'+input.bodyIndex]={status:'ready',groups:Object.fromEntries(['A1','X1','B1','A2','X2','B2'].map(k=>[k,[{phrase:'sample expression',meaningVi:'Cụm từ mẫu'},{phrase:'another expression',meaningVi:'Cụm từ khác'}]]))};
    return send({ok:true,session:raw});}
   if(p.endsWith('/idea2')){raw.bodyProgress[input.bodyIndex].idea2Open=true;return send({ok:true,session:raw});}
   if(p.endsWith('/sessions'))return send({ok:true,session:raw,token:'fixture-token'});
   if(p.endsWith('/fixture-session'))return send({ok:true,session:raw});
   throw Error('Unexpected local fixture '+p);
  }
  if(url.origin===origin)return route.continue();return route.abort();
 });}};
}
async function enter(page,origin){await page.goto(origin+'/writing-handouts/lesson13/?class=fixture');await page.locator('#remember').uncheck();await page.locator('#student-select').selectOption('fixture-student');await page.locator('#login-form button').click();await page.locator('#confirm-button').click();await page.locator('#step-outline').waitFor();}
// Chờ toast của hành trình vào bài tự hết; không che nội dung trong ảnh nghiệm thu.
async function screenshot(page,options){await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot(options);}
async function plan(page,level,side){await page.locator('#field-agreementLevel').selectOption(level);await page.locator('#field-chosenSolution').selectOption(side);if(level===AGREEMENT_LEVELS[2])await page.locator('#field-positionLimit').fill('Ưu tiên phía này khi đủ năng lực; phía còn lại phù hợp ở hoàn cảnh khác.');for(const b of [1,2])for(const i of [1,2])await page.locator('#field-body'+b+'_idea'+i).fill('Nội dung idea phân biệt '+b+i);await page.locator('[data-check="outline"]').click();await page.locator('#field-body1_topicSentence').waitFor();}
test('Lesson13 · ba mức đồng ý, hai thân bài, recap, R3 và giữ vùng đọc qua polling',async()=>{
 await mkdir(output,{recursive:true});const server=await serveDirectory(resolve(import.meta.dirname,'..')),browser=await chromium.launch({channel:'chrome',headless:true});const measurements=[];
 try{for(const [index,level,side] of [[0,AGREEMENT_LEVELS[0],lesson.solutionOptions[0]],[1,AGREEMENT_LEVELS[1],lesson.solutionOptions[1]],[2,AGREEMENT_LEVELS[2],lesson.solutionOptions[1]]]){
  const context=await browser.newContext({viewport:{width:index===1?390:1440,height:900}}),page=await context.newPage(),h=fixture();page.setDefaultTimeout(10000);page.on('pageerror',e=>h.errors.push(e.message));await h.mount(context,server.origin);
  try{await enter(page,server.origin);const formStyle=await page.locator('#step-outline').evaluate(e=>{const c=getComputedStyle(e.querySelector('h3')),t=getComputedStyle(e.querySelector('textarea')),s=getComputedStyle(e.querySelector('select'));return {heading:c.color,input:t.fontSize,inputBg:t.backgroundColor,select:s.fontSize};});assert.deepEqual(formStyle,{heading:'rgb(23, 66, 101)',input:'18px',inputBg:'rgb(255, 255, 255)',select:'18px'});if(index===1){await page.locator('#field-agreementLevel').scrollIntoViewIfNeeded();await screenshot(page,{path:resolve(output,'outline-390.png')});}await plan(page,level,side);await page.locator('#body2-title').scrollIntoViewIfNeeded();assert.match(await page.locator('#body2-title').innerText(),new RegExp(side));assert.match(await page.locator('#body1-title').innerText(),new RegExp(lesson.solutionOptions.find(x=>x!==side)));
   if(index!==2){assert.deepEqual(h.errors,[]);continue;}
   for(const b of [1,2]){await page.locator('#field-body'+b+'_topicSentence').fill('A synthetic topic sentence for body '+b);await page.locator(`[data-check="body${b}_topic"]`).click();
    for(const i of [1,2]){for(const p of ['a','x','b'])await page.locator('#field-body'+b+'_'+p+i).fill('Nội dung '+p+i+' của đoạn '+b);await page.locator(`[data-check="body${b}_si${i}"]`).click();if(i===1)await page.locator('#body'+b+'_next-idea').click();}
   }
   await page.getByRole('heading',{name:'Handout Lesson 13 đã hoàn tất',exact:true}).waitFor();assert.equal(h.calls.filter(x=>x.p.endsWith('/checks')).length,7);assert.equal(await page.locator('.handout-body .recap-table').count(),2);assert.match(await page.locator('#completion').innerText(),/hoàn tất/);
   for(const size of [{width:1440,height:900},{width:1366,height:600},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(size);await page.locator('#body2-title').scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
    const m=await page.evaluate(()=>{const e=document.querySelector('#body2-title'),c=getComputedStyle(e),input=document.querySelector('.student-field textarea'),s=input?getComputedStyle(input):null;return {viewport:{w:innerWidth,h:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth+1,font:c.fontFamily,bg:getComputedStyle(document.body).backgroundColor,contentSize:s?.fontSize,inputLine:s?.lineHeight};});measurements.push(m);assert.equal(m.overflow,false,JSON.stringify(m));assert.match(m.font,/Source Sans 3/);assert.equal(m.bg,'rgb(245, 246, 248)');if(m.contentSize)assert.equal(m.contentSize,'18px');
    await screenshot(page,{path:resolve(output,`recap-${size.width}x${size.height}.png`),fullPage:false});
   }
   await page.setViewportSize({width:1440,height:900});await page.locator('#body1-title').scrollIntoViewIfNeeded();await page.evaluate(()=>{const e=document.querySelector('#body1-title');window.__readingNode=e;const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r);window.__readingSelection=s.toString();window.__readingY=scrollY;});
   const before=h.calls.filter(x=>x.method==='GET'&&x.p.endsWith('/fixture-session')).length;await page.waitForTimeout(12800);assert.ok(h.calls.filter(x=>x.method==='GET'&&x.p.endsWith('/fixture-session')).length>=before+3);
   assert.deepEqual(await page.evaluate(()=>({node:window.__readingNode===document.querySelector('#body1-title'),selection:getSelection().toString()===window.__readingSelection,scroll:Math.abs(scrollY-window.__readingY)<2})),{node:true,selection:true,scroll:true});
   h.raw.steps.body2_topic.history[0].feedback='Nhận xét mới chỉ ở thân bài2.';await page.waitForTimeout(4500);
   assert.equal(await page.evaluate(()=>window.__readingNode===document.querySelector('#body1-title')&&getSelection().toString()===window.__readingSelection),true);
   assert.deepEqual(h.errors,[]);
  }finally{await context.close();}
 }}finally{await writeFile(resolve(output,'measurements.json'),JSON.stringify(measurements,null,2));await browser.close();await server.close();}
});
test('Lesson13 · thiếu điều kiện partial và chọn lập trường mâu thuẫn không gửi Check',async()=>{
 const server=await serveDirectory(resolve(import.meta.dirname,'..')),browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),h=fixture();
 try{await h.mount(context,server.origin);await enter(page,server.origin);await page.locator('#field-agreementLevel').selectOption(AGREEMENT_LEVELS[2]);await page.locator('#field-chosenSolution').selectOption(lesson.solutionOptions[0]);for(const b of [1,2])for(const i of [1,2])await page.locator('#field-body'+b+'_idea'+i).fill('Nội dung đã giữ '+b+i);
  await page.locator('[data-check="outline"]').click();await page.locator('#writing-check-dialog').waitFor();assert.match(await page.locator('#writing-check-dialog').innerText(),/Giới hạn hoặc điều kiện/);assert.equal(h.calls.filter(x=>x.p.endsWith('/checks')).length,0);
  await page.getByRole('button',{name:'Đến ô cần bổ sung'}).click();assert.equal(await page.locator('#field-positionLimit').evaluate(e=>document.activeElement===e),true);
  await page.locator('#field-agreementLevel').selectOption(AGREEMENT_LEVELS[1]);await page.locator('[data-check="outline"]').click();await page.locator('#writing-check-dialog').waitFor();assert.match(await page.locator('#writing-check-dialog').innerText(),/chưa khớp/);assert.equal(h.calls.filter(x=>x.p.endsWith('/checks')).length,0);
 }finally{await context.close();await browser.close();await server.close();}
});
test('Lesson13 · R3 năm trạng thái ở desktop và hai màn hẹp',async()=>{
 await mkdir(output,{recursive:true});const server=await serveDirectory(resolve(import.meta.dirname,'..')),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
 try{for(const width of [1440,390,320])for(const status of ['draft','pending','revision','passed','technical_error']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),h=fixture();page.setDefaultTimeout(10000);await h.mount(context,server.origin);
  h.raw.steps.outline.status=status;Object.assign(h.raw.responses,{agreementLevel:AGREEMENT_LEVELS[2],chosenSolution:lesson.solutionOptions[0],positionLimit:'Điều kiện có ý nghĩa ở bản mô phỏng.',body1_idea1:'Ý một',body1_idea2:'Ý hai',body2_idea1:'Ý ba',body2_idea2:'Ý bốn'});
  if(status==='revision')h.raw.steps.outline.history=[{number:1,status:'revision',feedback:'Lời nhận xét giả để xem trạng thái cần sửa.',snapshot:{...h.raw.responses}}];
  if(status==='technical_error')h.raw.processing.outline={status:'failed',tries:3,maxTries:3,createdAt:Date.now()-30000,deadlineAt:Date.now()+300000,error:'TECHNICAL_RETRIES_EXHAUSTED'};
  try{await enter(page,server.origin);if(status==='passed')await page.locator('#step-outline>summary').click();await page.locator('#step-outline').scrollIntoViewIfNeeded();
   const values=await page.locator('#step-outline').evaluate(e=>({color:getComputedStyle(e.querySelector('.step-heading h3')).color,font:getComputedStyle(e).fontFamily,overflow:document.documentElement.scrollWidth>innerWidth+1}));assert.equal(values.color,'rgb(23, 66, 101)');assert.match(values.font,/Source Sans 3/);assert.equal(values.overflow,false);
   if(!['pending','passed'].includes(status)){const field=page.locator('#field-positionLimit');await field.focus();assert.equal(await field.evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(21, 43, 78)');}
   if(status==='technical_error')assert.match(await page.locator('#step-outline').innerText(),/giữ|gián đoạn|chấm|lỗi/i);
   if((width===390&&status==='revision')||(width===320&&status==='pending')||(width===1440&&status==='technical_error'))await screenshot(page,{path:resolve(output,`${status}-${width}.png`)});
   records.push({width,status,...values});
  }finally{await context.close();}
 }}finally{await writeFile(resolve(output,'states.json'),JSON.stringify(records,null,2));await browser.close();await server.close();}
});
