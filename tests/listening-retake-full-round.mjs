// Full duration, actual HTMLAudio, fake learners and isolated PostgreSQL fixture.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {setTimeout as wait} from 'node:timers/promises';
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const output=process.env.RETAKE_EVIDENCE,base=(process.env.RETAKE_WEB_BASE||'http://127.0.0.1:18846')+'/izone-ai-team-pages/term-tests/ic2311-listening-retake-substitute1-k56/';
fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const cases=[];
try{
 const students=(process.env.RETAKE_FULL_STUDENTS||'1,2').split(',').map(Number);
 for(const[student,offline]of [[students[0],false],[students[1],true]]){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#student option').nth(1).waitFor({state:'attached'});await page.selectOption('#student',{index:student});await page.check('#identity-confirm');await page.click('#prepare');await page.locator('#trial[data-ready="true"]').waitFor({state:'visible',timeout:30000});
  if(offline)await context.setOffline(true);
  await page.click('#preview');await page.locator('#heard').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('heard').disabled,null,{timeout:20000});await page.check('#heard');await page.click('#start');await page.locator('#exam').waitFor({state:'visible'});
  await page.locator('[data-question="1"]').fill('fixture-one');await page.locator('#section-nav button').nth(1).click();await page.locator('[data-question="16"]').selectOption('B');
  cases.push({student,offline,context,page,errors,startedAt:Date.now(),samples:[],done:false});
 }
 console.log(JSON.stringify({event:'full_rounds_started',at:new Date().toISOString(),cases:cases.map(c=>({student:c.student,offline:c.offline}))}));
 const began=Date.now();
 while(cases.some(c=>!c.done)){
  if(Date.now()-began>36*60000)throw Error('FULL_ROUND_EXCEEDED_36_MINUTES');
  await wait(30000);
  for(const c of cases){if(c.done)continue;const v=await c.page.evaluate(()=>{const a=document.querySelector('audio');const s=JSON.parse(localStorage.getItem('izone-listening-retake:v1:current'));return {at:new Date().toISOString(),time:a.currentTime,paused:a.paused,ended:a.ended,error:a.error?.code||null,phase:s.phase,revision:s.revision,answersRetained:s.answers['1']==='fixture-one'&&s.answers['16']==='B',serverConfirmed:s.serverConfirmed,hasPending:!!s.pending};});c.samples.push(v);if(v.error)throw Error('MEDIA_ERROR_'+c.student);if(!v.answersRetained)throw Error('ANSWERS_LOST_'+c.student);
   if(v.phase==='technical_stop')throw Error('UNEXPECTED_TECHNICAL_STOP_'+c.student);
   if(v.phase==='submitted'){c.done=true;c.final=v;if(c.offline){if(!v.hasPending||v.serverConfirmed)throw Error('OFFLINE_SEAL_STATE_INVALID');await c.page.close();await c.context.setOffline(false);c.page=await c.context.newPage();await c.page.goto(base);await c.page.waitForFunction(()=>document.getElementById('finish-title').textContent==='Đã nộp thành công',null,{timeout:90000});}else await c.page.waitForFunction(()=>document.getElementById('finish-title').textContent==='Đã nộp thành công',null,{timeout:30000});c.confirmed=await c.page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('izone-listening-retake:v1:current'));return {serverConfirmed:s.serverConfirmed,pending:s.pending,receipt:s.receipt,answersRetained:s.answers['1']==='fixture-one'&&s.answers['16']==='B'};});if(!c.confirmed.serverConfirmed||!c.confirmed.answersRetained)throw Error('RECEIPT_NOT_CONFIRMED');}
  }
  const report={at:new Date().toISOString(),status:cases.every(c=>c.done)?'passed':'running',cases:cases.map(({student,offline,samples,errors,final,confirmed})=>({student,offline,samples,errors,final,confirmed}))};fs.writeFileSync(path.join(output,'full-round.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({event:'full_round_progress',elapsedSeconds:Math.round((Date.now()-began)/1000),states:cases.map(c=>({student:c.student,...c.samples.at(-1)}))}));
 }
}catch(error){fs.writeFileSync(path.join(output,'full-round-failure.json'),JSON.stringify({error:error.message,at:new Date().toISOString(),cases:cases.map(({student,offline,samples,errors})=>({student,offline,samples,errors}))},null,2));throw error;}finally{await browser.close();}
