// Native Substitute presentation parity, using isolated fixture identities only.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
const require=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');
const {Client}=createRequire(path.join(process.env.RETAKE_BACKEND_ROOT,'package.json'))('pg');
const config=JSON.parse(fs.readFileSync(process.env.RETAKE_TEST_CONFIG,'utf8'));
assert.match(new URL(config.databaseUrl).pathname,/_fixture$/);
const output=process.env.RETAKE_EVIDENCE;fs.mkdirSync(output,{recursive:true});
const client=new Client({connectionString:config.databaseUrl});await client.connect();
const student=config.students[0],prior=(await client.query('SELECT max(generation) g FROM listening_retake.attempt WHERE student_ref=$1',[student.studentRef])).rows[0].g;
await client.query('INSERT INTO listening_retake.attempt(id,student_ref,student_internal_id,class_code,generation,audio_owner_id,permit_operation_id) VALUES($1,$2,$3,$4,$5,NULL,$6)',[crypto.randomUUID(),student.studentRef,student.studentInternalId,config.classCode,(prior??-1)+1,crypto.randomUUID()]);await client.end();
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const base='http://127.0.0.1:18846/izone-ai-team-pages/term-tests/';
const source=await context.newPage(),target=await context.newPage();const errors=[];target.on('pageerror',e=>errors.push(e.message));
const measure=page=>page.evaluate(()=>['body','.substitute-brandbar','.topbar','.cbt-bootstrap-shell','.cbt-lobby-header','.cbt-test-form','.cbt-toolbar','.cbt-listening-section','.cbt-section-intro','.cbt-form-row','.cbt-answer-input','.cbt-question-button'].map(selector=>{const e=document.querySelector(selector);if(!e)return {selector,missing:true};const s=getComputedStyle(e),r=e.getBoundingClientRect();return {selector,fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,color:s.color,background:s.backgroundColor,padding:s.padding,borderRadius:s.borderRadius,box:{x:r.x,y:r.y,width:r.width,height:r.height}};}));
const readState=()=>target.evaluate(()=>JSON.parse(localStorage.getItem('izone-listening-retake:v1:current')));
const report={};
try{
 await source.route('https://ducizone.ddns.net/**',r=>r.abort());
 await source.goto(base+'substitute-test-1-k56-computer-based/?demo=listening-only');await source.locator('#listeningView .cbt-listening-section').first().waitFor({state:'attached'});
 await source.evaluate(()=>{for(const e of document.querySelector('.page-shell').children)if(e.classList.contains('panel'))e.hidden=true;document.getElementById('listeningView').hidden=false;document.getElementById('notice').hidden=true;});
 await source.waitForFunction(()=>document.body.dataset.substituteWorkspace==='active');await source.evaluate(()=>document.fonts.ready);
 await source.screenshot({path:path.join(output,'reference-exam.png')});
 report.reference=await measure(source);
 let releaseLayout;const layoutReady=new Promise(resolve=>releaseLayout=resolve);await target.route('**/substitute-shared/exam-controls.js?*',async route=>{await layoutReady;await route.continue();});await target.goto(base+'ic2311-listening-retake-substitute1-k56/');await target.locator('#student option').nth(1).waitFor({state:'attached'});await target.evaluate(()=>document.fonts.ready);
 await target.screenshot({path:path.join(output,'target-lobby.png'),fullPage:true});report.lobby=await measure(target);
 assert.equal(report.lobby[0].fontFamily,report.reference[0].fontFamily);assert.equal(report.lobby[0].background,report.reference[0].background);
 await target.selectOption('#student',{index:1});await target.check('#identity-confirm');assert.equal(await target.locator('#prepare').isDisabled(),true,'essential native layout module must finish before preparation');releaseLayout();await target.locator('#prepare').waitFor({state:'visible'});await target.click('#prepare');await target.locator('#trial[data-ready="true"]').waitFor({state:'visible',timeout:30000});
 await context.setOffline(true);await target.click('#preview');await target.waitForFunction(()=>!document.getElementById('heard').disabled,null,{timeout:20000});await target.check('#heard');await target.click('#start');await target.locator('#exam').waitFor({state:'visible'});
 await target.waitForFunction(()=>document.body.dataset.substituteWorkspace==='active');await target.screenshot({path:path.join(output,'target-exam.png')});report.exam=await measure(target);
 const parity=[];
 for(const selector of ['body','.topbar','.cbt-test-form','.cbt-listening-section','.cbt-section-intro','.cbt-form-row','.cbt-answer-input','.cbt-question-button']){
  const a=report.reference.find(r=>r.selector===selector),b=report.exam.find(r=>r.selector===selector);assert.ok(a&&!a.missing&&b&&!b.missing);
  for(const property of ['fontFamily','fontSize','lineHeight','color','background','padding','borderRadius'])assert.equal(b[property],a[property],selector+' '+property);
  if(['.cbt-test-form','.cbt-section-intro','.cbt-answer-input'].includes(selector))assert.ok(Math.abs(b.box.width-a.box.width)<=2,selector+' width');
  parity.push(selector);
 }
 assert.equal(await target.locator('.cbt-question-button').count(),40);assert.equal(await target.locator('[data-question]').count(),40);
 const before=await target.locator('audio').evaluate(a=>a.currentTime);
 await target.locator('[data-question="1"]').fill('fixture-native-offline');const field=await target.locator('[data-question="1"]').elementHandle();
 await target.getByRole('button',{name:'Câu 40, chưa làm',exact:true}).click();await target.getByRole('button',{name:'Đánh dấu câu 40',exact:true}).click();
 assert.equal(await target.locator('.cbt-question-button[data-nav-number="40"]').evaluate(e=>e.classList.contains('is-flagged')),true);
 await target.getByRole('button',{name:'Tăng cỡ chữ',exact:true}).click();assert.equal(await target.locator('.cbt-content-viewport').getAttribute('data-font-size'),'110');
 await target.getByRole('button',{name:'Giảm cỡ chữ',exact:true}).click();await target.locator('#section-nav button').first().click();
 await target.locator('.cbt-listening-section').first().evaluate(e=>e.scrollTop=0);
 await target.evaluate(()=>{const text=document.querySelector('.cbt-listening-section h3').firstChild,r=document.createRange();r.setStart(text,0);r.setEnd(text,10);const selection=getSelection();selection.removeAllRanges();selection.addRange(r);document.dispatchEvent(new Event('selectionchange'));});
 await target.locator('#cbtSelectionMenu').waitFor({state:'visible'});await target.getByRole('button',{name:'Highlight',exact:true}).click();assert.ok(await target.locator('[data-annotation-ids]').count()>0);
 await target.evaluate(()=>{const text=document.querySelector('.cbt-listening-section .cbt-section-intro p').firstChild,r=document.createRange();r.setStart(text,0);r.setEnd(text,10);const selection=getSelection();selection.removeAllRanges();selection.addRange(r);document.dispatchEvent(new Event('selectionchange'));});await target.locator('#cbtSelectionMenu').waitFor({state:'visible'});await target.getByRole('button',{name:'Note',exact:true}).click();await target.getByRole('textbox',{name:'Nội dung ghi chú'}).fill('fixture-note-offline');await target.keyboard.press('Escape');await target.getByRole('button',{name:'Notes',exact:true}).click();await target.locator('#cbtNotesPanel').waitFor({state:'visible'});assert.match(await target.locator('#cbtNotesPanel').textContent(),/fixture-note-offline/);await target.keyboard.press('Escape');assert.equal(await target.locator('#cbtNotesPanel').isVisible(),false);
 await target.locator('[data-question="1"]').focus();await target.locator('.cbt-listening-section').first().evaluate(e=>e.scrollTop=250);await target.waitForFunction(()=>Math.abs(document.querySelector('.cbt-listening-section').scrollTop-250)<1);const scrollBefore=await target.locator('.cbt-listening-section').first().evaluate(e=>e.scrollTop);
 await wait(16000);assert.equal(await field.evaluate(e=>e.isConnected&&e===document.activeElement),true);assert.equal(await target.locator('.cbt-listening-section').first().evaluate(e=>e.scrollTop),scrollBefore);assert.ok(await target.locator('audio').evaluate(a=>a.currentTime)-before>15);assert.equal((await readState()).answers['1'],'fixture-native-offline');
 await target.click('#submit');await target.click('#accept-submit');await target.locator('#finished').waitFor({state:'visible'});assert.equal((await readState()).serverConfirmed,false);assert.ok((await readState()).pending);
 await context.setOffline(false);await target.reload();await target.waitForFunction(()=>document.getElementById('finish-title').textContent==='Đã nộp thành công',null,{timeout:30000});
 assert.deepEqual(errors,[]);report.result={passed:true,paritySelectors:parity,offlineTrialStartFlagsFontHighlightNotesAndSubmit:true,retainedFocusAndScroll:true,fixtureReceipt:true,originalExamWrites:false};
}catch(e){report.result={passed:false,error:e.message};throw e;}finally{fs.writeFileSync(path.join(output,'native-ui-parity.json'),JSON.stringify(report,null,2));await browser.close();}
