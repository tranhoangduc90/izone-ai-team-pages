// Input: the real picker script/styles in a small synthetic Listening question.
// Checks: pointer gestures, keyboard choice, selection/clear and return focus.
// Output: JSON evidence or a nonzero exit identifying the broken interaction.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.LISTENING_PICKER_EVIDENCE_DIR||resolve(root,'output/playwright/listening-picker');await fs.mkdir(out,{recursive:true});
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];let failure;
const html=`<!doctype html><html lang="vi" data-izone-theme="master170"><head><link rel="stylesheet" href="/listening-practice/flow-options.css"><link rel="stylesheet" href="/shared/master170/theme.css"><link rel="stylesheet" href="/shared/master170/practice.css"><style>body{margin:0}#app{max-width:900px;margin:150px auto;padding:12px;box-sizing:border-box}</style></head><body class="design67" data-m170-product="practice"><main id="app"><div id="question-scroll"><div class="listening-bank"><div><strong>A</strong><span>Option alpha</span></div><div><strong>B</strong><span>Option beta</span></div></div><div class="listening-flow"><div class="flow-step"><p>Chọn một phương án <select class="cbt-select-answer" data-answer="26"><option value=""></option><option>A</option><option>B</option></select></p></div></div></div></main><script>window.fixtureWritable=true;window.fixtureChanges=[];window.ReadingInteractionBridge={writable:()=>window.fixtureWritable};document.querySelector('select').addEventListener('change',e=>fixtureChanges.push(e.target.value));</script><script defer src="/listening-practice/flow-options.js"></script></body></html>`;
try{for(const width of [1440,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:1000}}),p=await ctx.newPage();
 await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==site.origin)return r.abort();if(u.pathname==='/picker-component')return r.fulfill({contentType:'text/html',body:html});return r.continue();});
 await p.goto(site.origin+'/picker-component');await p.locator('.flow-answer-trigger').waitFor();
 for(const selector of ['.flow-bank-toggle','.flow-answer-trigger']){
  const trigger=p.locator(selector);if(!await trigger.isVisible())continue;
  const open=async()=>{await trigger.focus();await p.keyboard.press('Enter');await p.locator('.flow-option-picker').waitFor();};
  await open();let dialog=p.locator('.flow-option-picker');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);
  const box=await dialog.boundingBox(),inside={x:box.x+box.width/2,y:box.y+8},outside={x:Math.max(1,box.x-5),y:Math.max(1,box.y-5)};
  for(const [a,b]of[[inside,outside],[outside,inside]]){await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y);await p.mouse.up();assert.equal(await dialog.isVisible(),true,'Crossing the dialog edge must keep it open');}
  assert.deepEqual(await p.evaluate(()=>fixtureChanges),[]);await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
  await open();await p.mouse.click(outside.x,outside.y);await dialog.waitFor({state:'detached'});assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
  if(selector==='.flow-answer-trigger'){
   await open();await p.keyboard.press('Home');await p.keyboard.press('ArrowDown');assert.equal(await p.locator('select').inputValue(),'');await p.keyboard.press('Enter');await dialog.waitFor({state:'detached'});assert.equal(await p.locator('select').inputValue(),'B');assert.deepEqual(await p.evaluate(()=>fixtureChanges),['B']);
   await open();assert.equal(await dialog.locator('[aria-selected=true]').getAttribute('data-value'),'B');await dialog.locator('.flow-picker-clear').click();await dialog.waitFor({state:'detached'});assert.equal(await p.locator('select').inputValue(),'');assert.deepEqual(await p.evaluate(()=>fixtureChanges),['B','']);await p.evaluate(()=>fixtureChanges=[]);
  }
  records.push({width,selector,passed:true});
 }
 await p.evaluate(()=>fixtureWritable=false);await p.locator('.flow-answer-trigger').click();assert.equal(await p.locator('.flow-option-picker').count(),0);await ctx.unrouteAll({behavior:'wait'});await ctx.close();
}}catch(e){failure=e.stack;process.exitCode=1;}
finally{await browser.close();await site.close();await fs.writeFile(out+'/results.json',JSON.stringify({outcome:failure?'failed':'passed',records,error:failure,externalWrites:0,scope:'Actual picker script/CSS and native browser gestures in isolated question scaffold; engine/API tested separately.'},null,2));}
console.log(JSON.stringify({passed:records.length,error:failure}));
