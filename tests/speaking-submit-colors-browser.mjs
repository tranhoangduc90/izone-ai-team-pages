// Real lesson pages and submit-status component; synthetic opening API and phases.
// This checks presentation, never drives a production Check/finish operation.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {startFixture,learners,lessons} from './fixtures/speaking-draft-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.SPEAKING_SUBMIT_EVIDENCE_DIR||resolve(root,'output/playwright/speaking-submit-colors');
await fs.mkdir(out,{recursive:true});
const revision=process.env.SPEAKING_SUBMIT_REVISION||null,publicBase=process.env.SPEAKING_SUBMIT_PUBLIC_BASE||null;
assert.ok(!(revision&&publicBase));
const paths=lessons.map(x=>'speaking-homework/'+x.file).concat('shared/master170/speaking.css'),overrides=new Map();
for(const path of paths){
 if(revision)overrides.set('/'+path,execFileSync('git',['-C',root,'show',revision+':'+path]));
 if(publicBase){const r=await fetch(publicBase.replace(/\/$/,'')+'/'+path,{headers:{'Cache-Control':'no-cache'}});assert.equal(r.status,200);overrides.set('/'+path,Buffer.from(await r.arrayBuffer()));}
}
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[];let fixture,fatal;
try{for(const lesson of lessons){
 fixture=await startFixture(root,{status:'pending',seedAll:false,port:34679});
 const context=await browser.newContext({reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
 p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));
 try{
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==fixture.origin)return route.abort();if(overrides.has(u.pathname))return route.fulfill({body:overrides.get(u.pathname),contentType:u.pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8'});return route.continue();});
  await p.goto(fixture.origin+'/speaking-homework/'+lesson.file);
  await p.selectOption('#class-select','IC2304');await p.selectOption('#student-select',learners[0]);await p.locator('#open-homework').click();
  await p.locator('#homework-content').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('#change-student').disabled);await p.evaluate(()=>document.fonts.ready);
  const business=()=>p.evaluate(()=>({values:[...document.querySelectorAll('#homework-content input,#homework-content select')].map(e=>({id:e.id,value:e.value,disabled:e.disabled})),links:[...document.querySelectorAll('#homework-content a')].map(e=>({text:e.textContent,href:e.getAttribute('href')}))}));
  const before=await business();
  for(const [width,height]of[[1440,1000],[390,844],[320,568]])for(const phase of ['sending','verifying','waiting','failed']){
   await p.setViewportSize({width,height});
   await p.evaluate(async phase=>{const {updateSubmitControl}=await import('./check-feedback.js');updateSubmitControl({ready:true,submitted:false,phase,error:phase==='failed'?'Phần cuối cần xác minh lại.':'',onSubmit(){throw new Error('Component color test must not submit');}});},phase);
   const actual=await p.locator('#ready-submit-card').evaluate(e=>{const s=getComputedStyle(e),h=e.querySelector('h2'),p=e.querySelector('p'),b=e.querySelector('button'),success=document.querySelector('#completion-card');return{bg:s.backgroundColor,fg:s.color,title:h.textContent,message:p.textContent,titleColor:getComputedStyle(h).color,messageColor:getComputedStyle(p).color,busy:e.getAttribute('aria-busy'),button:{text:b.textContent,hidden:b.hidden,disabled:b.disabled},successBg:getComputedStyle(success).backgroundColor,successFg:getComputedStyle(success.querySelector('h2')).color,overflow:document.documentElement.scrollWidth>innerWidth,supportsHas:CSS.supports('selector(:has(*))')};});
   const fg=phase==='failed'?'rgb(138, 83, 0)':'rgb(23, 66, 101)',bg=phase==='failed'?'rgb(255, 244, 224)':'rgb(230, 238, 245)';
   const checks={role:actual.fg===fg&&actual.bg===bg&&actual.titleColor===fg&&actual.messageColor===fg,busy:actual.busy===String(['sending','verifying'].includes(phase)),retry:actual.button.hidden===(phase!=='failed')&&actual.button.disabled===(phase!=='failed'),success:actual.successBg==='rgb(228, 245, 234)'&&actual.successFg==='rgb(22, 101, 52)',noOverflow:!actual.overflow,supported:actual.supportsHas,data:JSON.stringify(before)===JSON.stringify(await business())};
   await p.locator('#ready-submit-card').screenshot({path:`${out}/lesson-${lesson.number}-${width}-${phase}.png`});
   records.push({lesson:lesson.number,width,height,phase,outcome:Object.values(checks).every(Boolean)?'passed':'failed',checks,actual});
  }
  assert.deepEqual(errors,[]);assert.equal(fixture.requests.some(x=>['/check','/finish','/practice/check'].includes(x.path)),false);
 }finally{await context.unrouteAll({behavior:'wait'});await context.close();await fixture.close();fixture=null;}
}}catch(e){fatal=e.stack;}finally{await browser.close();await fixture?.close();}
const sourceHashes={};for(const path of paths)sourceHashes[path]=createHash('sha256').update(overrides.get('/'+path)||await fs.readFile(resolve(root,path))).digest('hex');
const result={outcome:fatal||records.some(x=>x.outcome==='failed')?'failed':'passed',records,fatal,revision,publicBase,sourceHashes,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),externalWrites:0,scope:'Nine actual lesson pages with synthetic opening API; exported submit-status renderer receives synthetic phase props. Component color/flags/data checks, not auto-submit, server transaction, AI, SSO or Docs acceptance. Public mode substitutes ten HTML/CSS assets only.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(x=>x.outcome==='failed').length,fatal}));if(result.outcome!=='passed')process.exitCode=1;
