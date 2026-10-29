// HTML/SSO client thật, dữ liệu và Google giả; mọi request ngoài fixture bị chặn.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.PORTAL_TEACHER_TEST_OUTPUT;
assert(out);await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const origin='https://tranhoangduc90.github.io',prefix='/izone-ai-team-pages',id='10000000-0000-4000-8000-000000000001';
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{
 for(const width of [1440,390])for(const scenario of ['active','missing','forbidden','offline','expired','account-change']){
  const context=await browser.newContext({viewport:{width,height:900}}),calls=[],errors=[];let mode=scenario==='account-change'?'active':scenario,account='a',late=false;
  await context.addInitScript(()=>{window.__formFrames=0;function watch(){const n=document.getElementById('google-panel');if(n&&!n.hidden&&n.getBoundingClientRect().height)window.__formFrames++;requestAnimationFrame(watch);}requestAnimationFrame(watch);});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;calls.push({path:p,method:req.method()});
   if(u.origin===origin){const file=resolve(root,'.'+p.slice(prefix.length)+(p.endsWith('/')?'index.html':''));assert(file.startsWith(root));try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}}
   if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{id:{initialize(o){window.__google=o.callback},renderButton(el){el.textContent='Google fixture'},disableAutoSelect(){}}}}"});
   assert.equal(u.hostname,'ducizone.ddns.net','Escaped fixture request');
   if(p.endsWith('/logout')){mode='missing';return route.fulfill({json:{ok:true}});}
   if(p.includes('/login/portal_sync')){assert.equal(req.method(),'POST');calls.at(-1).remember=JSON.parse(req.postData()).remember;mode='active';return route.fulfill({json:{ok:true}});}
   if(p.includes('/restore/'))return route.fulfill({status:({missing:401,forbidden:403,offline:503})[mode]||200,json:{ok:true}});
   if(p.endsWith('/shared-session'))return route.fulfill({status:401,json:{error:'NO_FIXTURE_SESSION'}});
   if(p.endsWith('/teacher/config'))return route.fulfill({json:{googleClientId:'fixture-public'}});
   if(p.endsWith('/auth/session'))return route.fulfill({status:['missing','expired'].includes(mode)?401:mode==='forbidden'?403:200,json:{ok:true,reviewer:{email:account+'@example.invalid',role:'teacher'},classes:[{id:'12',name:'Fixture class'}]}});
   if(p.endsWith('/teacher/status'))return route.fulfill({json:{gate:{paused:false},counts:[{state:'observed',count:1}]}});
   if(p.endsWith('/teacher/requests')){
    if(late){const old=account;await new Promise(r=>setTimeout(r,500));return route.fulfill({json:{items:[{id,event_id:'late-'+old,source:'progress_log_observer_trial',state:'observed',created_at:'2026-10-01T00:00:00Z'}]}});}
    return route.fulfill({json:{items:[{id,event_id:'event-'+account,source:'progress_log_observer_trial',state:'observed',created_at:'2026-10-01T00:00:00Z'}]}});
   }
   if(p.endsWith('/audit'))return route.fulfill({json:{items:[{action:'observed',metadata:{},created_at:'2026-10-01T00:00:00Z'}]}});
   if(p.endsWith('/'+id))return route.fulfill({json:{id,event_id:'event-'+account,source:'progress_log_observer_trial',state:'observed',payload:{mode:'observe',classId:'12',studentId:'23',targetId:'45'},observed_json:{message:'fixture '.repeat(500)},commands:[]}});
   errors.push('Unexpected '+p);return route.fulfill({status:500,json:{error:'UNEXPECTED_FIXTURE'}});
  });
  const page=await context.newPage();await page.clock.install();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+prefix+'/portal-sync/');
  if(['missing','expired'].includes(scenario)){
   await page.locator('#google-panel').waitFor({state:'visible'});assert.equal(await page.locator('#workspace').isVisible(),false);
   for(const remember of [false,true]){await page.locator('#remember').setChecked(remember);await page.evaluate(()=>window.__google({credential:'synthetic-google'}));await page.locator('.request').waitFor();const login=calls.filter(c=>c.path.includes('/login/portal_sync'));assert.equal(login.at(-1).remember,remember);if(!remember){await page.locator('#logout').click();await page.locator('#google-panel').waitFor({state:'visible'});}}
  }else if(['forbidden','offline'].includes(scenario)){
   await page.locator('#auth-retry').waitFor({state:'visible'});assert.equal(await page.locator('#workspace').isVisible(),false);assert.equal(calls.filter(c=>c.path==='/gsi/client').length,0);
   mode='active';await page.locator('#auth-retry').click();await page.locator('.request').waitFor();
  }else{
   await page.locator('.request').waitFor();assert.equal(await page.evaluate(()=>window.__formFrames),0);assert.equal(calls.filter(c=>c.path==='/gsi/client').length,0);
   assert.equal(calls.filter(c=>c.path.endsWith('/restore/portal_sync')).length,1);
  }
  assert.equal(await page.locator('#pause').isVisible(),false);
  if(scenario==='active'){
   await page.locator('.request').click();await page.locator('#detail pre').waitFor();
   await page.evaluate(()=>{window.__row=document.querySelector('.request');window.__detail=document.querySelector('#detail pre');window.__detail.scrollTop=100;const range=document.createRange();range.selectNodeContents(window.__detail);getSelection().removeAllRanges();getSelection().addRange(range);});
   const polls=calls.filter(c=>c.path.endsWith('/teacher/requests')).length;for(let i=0;i<3;i++){await page.clock.fastForward(5001);await new Promise(r=>setTimeout(r,200));}
   assert(calls.filter(c=>c.path.endsWith('/teacher/requests')).length>=polls+3);
   assert.equal(await page.evaluate(()=>window.__row===document.querySelector('.request')&&window.__detail===document.querySelector('#detail pre')&&getSelection().toString().length>0),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(out,'teacher-'+width+'.png'),fullPage:true});
  }
  if(scenario==='account-change'){
   late=true;await page.locator('#refresh').click();account='b';mode='forbidden';await page.evaluate(()=>dispatchEvent(new StorageEvent('storage',{key:'izone:teacher-sso-login',newValue:'new'})));await page.locator('#auth-retry').waitFor({state:'visible'});await page.waitForTimeout(650);assert.equal(await page.locator('.request').count(),0);assert.equal(await page.locator('#who').textContent(),'');
  }
  assert.deepEqual(errors,[]);records.push({width,scenario,result:'passed',restoreCount:calls.filter(c=>c.path.endsWith('/restore/portal_sync')).length});await context.close();
 }
 await fs.writeFile(resolve(out,'browser.json'),JSON.stringify({fixture:true,records},null,2));console.log(JSON.stringify({passed:records.length,fixture:true}));
}finally{await browser.close();}
