// Actual SW/legacy Shops pages, with synthetic HTTP/Google. No production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(process.env.TEACHER_STARTUP_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.TEACHER_STARTUP_OUTPUT;
assert(out,'Choose an evidence folder outside Git.');await fs.mkdir(out,{recursive:true});
const {chromium}=createRequire(pathToFileURL(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')))('playwright');
const catalog=await fs.readFile(resolve(root,'sw-task2-writing/writing-handouts/shops-review/lesson-config.mjs'),'utf8');
const tasks=[...catalog.matchAll(/^    "slug": "([^"]+)"/gm)].map(m=>m[1]);assert.equal(tasks.length,8);
const origin='https://tranhoangduc90.github.io',prefix='/izone-ai-team-pages';
const classes=[{classRef:'fixture-class',className:'CS-FIXTURE',students:[{studentRef:'fixture-student',displayName:'Học viên thử'}]}];
const gis="window.google={accounts:{id:{initialize(o){this.cb=o.callback},renderButton(el){const b=document.createElement('button');b.textContent='Google thử';el.replaceChildren(b)},disableAutoSelect(){}}}};";
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{
 for(const width of process.env.STARTUP_WIDTH?[Number(process.env.STARTUP_WIDTH)]:[1440,390])for(const [engine,task,scenario] of [
  ...tasks.map(t=>['sw-task2-writing',t,'active']),
  ...['missing','forbidden','offline','api-denied','expired-product','data-mismatch'].map(s=>['sw-task2-writing',tasks[0],s]),
  ['shops-writing',tasks[0],'active']
 ]){
  if(process.env.STARTUP_SCENARIO&&scenario!==process.env.STARTUP_SCENARIO)continue;
  let mode=scenario;const calls=[],errors=[],escaped=[];
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(()=>{
   window.__loginFrames=[];
   const watch=()=>{const n=document.querySelector('#google-signin');if(n&&n.getBoundingClientRect().height)window.__loginFrames.push(performance.now());requestAnimationFrame(watch);};requestAnimationFrame(watch);
  });
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;
   if(u.origin===origin){
    const file=resolve(root,'.'+p.slice(prefix.length)+(p.endsWith('/')?'index.html':''));
    assert(file.startsWith(root+'\\')||file.startsWith(root+'/'));
    try{if(p.endsWith('/connected-app.mjs'))await new Promise(r=>setTimeout(r,200));return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
   }
   if(u.hostname==='accounts.google.com'){calls.push({path:p,method:req.method(),google:true});return route.fulfill({contentType:'text/javascript',body:gis});}
   if(u.hostname!=='ducizone.ddns.net'){escaped.push(req.url());return route.abort();}
   calls.push({path:p,method:req.method()});await new Promise(r=>setTimeout(r,40));
   if(p.includes('/restore/'))return route.fulfill({status:({missing:401,forbidden:403,offline:503})[mode]||200,json:{ok:!['missing','forbidden','offline'].includes(mode)}});
   if(p.endsWith('/shared-session'))return route.fulfill({status:401,json:{error:'FIXTURE_NO_SESSION'}});
   if(p.endsWith('/auth/session'))return route.fulfill({status:['missing','expired-product'].includes(mode)?401:200,json:{ok:true}});
   if(p.endsWith('/auth/config'))return route.fulfill({json:{googleClientId:'fixture-google',sharedSession:true}});
   if(p.endsWith('/admin/me'))return route.fulfill({status:mode==='api-denied'?403:200,json:{reviewer:{role:'admin'},classes:[{classCode:'CS-FIXTURE'}]}});
   if(p.includes('/admin/lesson9/sessions/'))return route.fulfill({json:{session:{activitySlug:task,studentRef:'different-student',classRef:'fixture-class'}}});
   if(p.endsWith('/teacher-comments'))return route.fulfill({json:{threads:[]}});
   if(p.includes('/admin/live/activities/'))return route.fulfill({json:{students:[{studentRef:'fixture-student',classRef:'fixture-class',...(mode==='data-mismatch'?{sessionRef:'mismatched-session'}:{})}]}});
   if(p.endsWith('/roster'))return route.fulfill({json:{classes}});
   if(p.endsWith('/sw/status')||p.endsWith('/shops/status'))return route.fulfill({json:{ok:true}});
   errors.push('Unexpected fixture '+req.method()+' '+p);return route.fulfill({status:500,json:{error:'UNEXPECTED_FIXTURE'}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const entry=engine==='sw-task2-writing'?'/sw-task2-writing/teacher.html?task='+task:'/shops-writing/writing-handouts/shops-review/connected-teacher.html';
  await page.goto(origin+prefix+entry);
  try{
   if(scenario==='data-mismatch'){
    await page.locator('.teacher-heading').waitFor({state:'visible',timeout:12000});
    await page.locator('#notice').filter({hasText:'SESSION_OWNER_MISMATCH'}).waitFor();
    assert.equal(await page.locator('.teacher-student-card').count(),0,'Mismatched record must not render');
    assert.equal(await page.getByRole('button',{name:'Cập nhật',exact:true}).isVisible(),true);
   }
   else if(['missing','expired-product'].includes(scenario))await page.getByRole('button',{name:'Google thử',exact:true}).waitFor({timeout:12000});
   else if(['forbidden','offline','api-denied'].includes(scenario)){
    await page.getByRole('button',{name:'Thử lại',exact:true}).waitFor({timeout:12000});
    assert.equal(await page.locator('#google-signin').count(),0);assert.equal(await page.locator('.teacher-student-card').count(),0);
    if(scenario==='offline'){mode='active';await page.getByRole('button',{name:'Thử lại',exact:true}).click();await page.locator('.teacher-student-card').first().waitFor({timeout:12000});}
   }else await page.locator('.teacher-student-card').first().waitFor({timeout:12000});
   if(!['missing','expired-product'].includes(scenario)){
    assert.equal((await page.evaluate(()=>window.__loginFrames)).length,0,'Form flashed');
    assert.equal(calls.filter(c=>c.google).length,0,'Restored/failed session loaded Google');
   }
   if(scenario==='active')assert.equal(calls.filter(c=>c.path.includes('/restore/shops')).length,1,'Duplicate restore');
   assert.deepEqual(errors,[]);assert.deepEqual(escaped,[]);
   assert(calls.every(c=>c.method==='GET'||c.path.includes('/restore/')||c.path.endsWith('/shared-session')),'Unexpected write');
   if(task===tasks[0])await page.screenshot({path:resolve(out,engine+'-'+scenario+'-'+width+'.png'),fullPage:true});
   records.push({engine,task,scenario,width,passed:true,restores:calls.filter(c=>c.path.includes('/restore/')).length,google:calls.filter(c=>c.google).length});
  }catch(error){console.log(JSON.stringify({engine,task,scenario,width,calls,errors,body:(await page.locator('body').innerText()).slice(0,2000)}));throw error;}
  finally{await context.close();}
 }
}finally{await browser.close();}
await fs.writeFile(resolve(out,'results.json'),JSON.stringify(records,null,2));console.log(JSON.stringify({passed:records.length}));
