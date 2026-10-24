// Actual nine lesson renderers with synthetic opening API; no check/final submit.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {startFixture,learners,lessons} from './fixtures/speaking-draft-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.SPEAKING_ACTIONS_EVIDENCE_DIR||resolve(root,'output/playwright/speaking-actions');await fs.mkdir(out,{recursive:true});
const revision=process.env.SPEAKING_ACTIONS_REVISION||null,publicBase=process.env.SPEAKING_ACTIONS_PUBLIC_BASE||null;assert.ok(!(revision&&publicBase));
const paths=lessons.map(x=>'speaking-homework/'+x.file).concat('shared/master170/speaking.css'),overrides=new Map();
for(const path of paths){if(revision)overrides.set('/'+path,execFileSync('git',['-C',root,'show',revision+':'+path]));if(publicBase){const response=await fetch(publicBase.replace(/\/$/,'')+'/'+path,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);overrides.set('/'+path,Buffer.from(await response.arrayBuffer()));}}
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[];let fixture,fatal;
try{for(const lesson of lessons){
 fixture=await startFixture(root,{status:'pending',seedAll:false});const context=await browser.newContext(),p=await context.newPage(),errors=[];p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));
 try{
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==fixture.origin)return route.abort();if(overrides.has(u.pathname))return route.fulfill({body:overrides.get(u.pathname),contentType:u.pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8'});return route.continue();});
  await p.goto(fixture.origin+'/speaking-homework/'+lesson.file);await p.locator('#login-screen').waitFor({state:'visible'});
  await p.selectOption('#class-select','IC2304');await p.selectOption('#student-select',learners[0]);await p.locator('#open-homework').click();await p.locator('#homework-content').waitFor({state:'visible'});
  for(const [width,height]of[[1440,1000],[390,844],[320,568],[844,390],[768,1024]]){
   await p.setViewportSize({width,height});await p.evaluate(()=>document.fonts.ready);
   const measure=()=>p.evaluate(()=>{const fallback=document.querySelector('#doctor-fallback'),style=fallback?getComputedStyle(fallback):null;return{font:getComputedStyle(document.body).fontFamily,overflow:document.documentElement.scrollWidth>innerWidth,fallback:fallback?{visible:!!fallback.getBoundingClientRect().width&&!fallback.closest('[hidden]'),text:fallback.textContent,fg:style.color,bg:style.backgroundColor,fontSize:parseFloat(style.fontSize)}:null,
    actions:[...document.querySelectorAll('.teacher-entry-link,#change-student,.share-help-button,a.text-button')].filter(e=>e.getBoundingClientRect().width&&!e.closest('[hidden]')).map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{text:e.textContent.trim(),id:e.id,classes:e.className,fontSize:parseFloat(s.fontSize),width:r.width,height:r.height,href:e.getAttribute('href')};}),
    links:[...document.querySelectorAll('#homework-content a')].map(e=>({text:e.textContent.trim(),href:e.getAttribute('href'),target:e.target})),
    values:[...document.querySelectorAll('#homework-content input,#homework-content select')].map(e=>({id:e.id,value:e.value,disabled:e.disabled})),identity:document.querySelector('#homework-content')?.textContent.match(/Hồ sơ thử \d/)?.[0]||null};});
   const before=await measure(),guides=[];if([1440,390,320].includes(width))await p.screenshot({path:`${out}/lesson-${lesson.number}-main-${width}.png`,fullPage:true});
   const helpers=p.locator('.share-help-button');const count=[1440,320].includes(width)?await helpers.count():1;
   for(let i=0;i<count;i++){
    const helper=helpers.nth(i);if(!await helper.isVisible())continue;await helper.click();await p.locator('#share-guide-dialog[open]').waitFor();
    const opened=await p.locator('#share-guide-dialog').evaluate(e=>({open:e.open,focusInside:e.contains(document.activeElement),overflow:e.scrollWidth>e.clientWidth}));
    if(i===0&&[1440,390,320].includes(width))await p.locator('#share-guide-dialog').screenshot({path:`${out}/lesson-${lesson.number}-share-${width}.png`});
    const platforms=[];if(i===0)for(const [name,id]of[['Tôi dùng iPhone','guide-iphone'],['Tôi dùng Android','guide-android']]){await p.locator('#share-guide-dialog').getByRole('button',{name,exact:true}).click();platforms.push(await p.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id,focused:e===document.activeElement,visible:r.top>=0&&r.bottom<=innerHeight&&(hit===e||e.contains(hit)),top:r.top,bottom:r.bottom};}));}
    await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#share-guide-dialog').open);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
    guides.push({...opened,platforms,returned:await helper.evaluate(e=>e===document.activeElement)});
   }
   const after=await measure(),checks={font:before.font.includes('Source Sans 3'),noOverflow:!before.overflow&&!after.overflow,actionType:before.actions.length>0&&before.actions.every(x=>x.fontSize>=16),targets:before.actions.every(x=>x.height>=43.9&&x.width>=24),guides:guides.length>0&&guides.every(x=>x.open&&x.focusInside&&!x.overflow&&x.returned),values:JSON.stringify(before.values)===JSON.stringify(after.values),links:JSON.stringify(before.links)===JSON.stringify(after.links),identity:before.identity===after.identity};
   checks.fallbackRole=!before.fallback?.visible||(before.fallback.fg==='rgb(138, 83, 0)'&&before.fallback.bg==='rgb(255, 244, 224)'&&before.fallback.fontSize>=14);checks.fallbackText=before.fallback?.text===after.fallback?.text;checks.platforms=guides.flatMap(x=>x.platforms).length===2&&guides.flatMap(x=>x.platforms).every(x=>x.focused&&x.visible);
   records.push({lesson:lesson.number,width,height,outcome:Object.values(checks).every(Boolean)?'passed':'failed',checks,before,after,guides});
  }
  assert.deepEqual(errors,[]);assert.equal(fixture.requests.some(x=>['/finish','/check','/practice/check'].includes(x.path)),false);
 }finally{await context.unrouteAll({behavior:'wait'});await context.close();await fixture.close();fixture=null;}
}}catch(e){fatal=e.stack;}finally{await browser.close();await fixture?.close();}
const sourceHashes={};for(const path of paths)sourceHashes[path]=createHash('sha256').update(overrides.get('/'+path)||await fs.readFile(resolve(root,path))).digest('hex');
const result={outcome:fatal||records.some(x=>x.outcome==='failed')?'failed':'passed',records,fatal,revision,publicBase,sourceHashes,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),externalWrites:0,scope:'Actual nine lesson renderers, synthetic opening API; no backend/SSO/AI/Docs acceptance. Public mode substitutes ten HTML/CSS assets; remaining assets local.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(x=>x.outcome==='failed').length,fatal}));if(result.outcome!=='passed')process.exitCode=1;
