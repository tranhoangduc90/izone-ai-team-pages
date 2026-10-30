// One public-entry regression: clean browser, exact 31-code inventory, no real APIs,
// complete question/field coverage, demo-only interactions, reset and narrow layout.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.DEMO_EVIDENCE_DIR;assert.ok(out,'Set the private evidence directory.');await fs.mkdir(out,{recursive:true});
const inventory=JSON.parse(await fs.readFile(path.join(process.env.DEMO_CAPTURE_DIR,'original-inventory.json'),'utf8')).rows;
const catalog=JSON.parse(await fs.readFile(path.join(root,'homework-demo/catalog.json'),'utf8'));
assert.deepEqual(catalog.map(x=>x.code),inventory.map(x=>x.code));
const selected=process.env.DEMO_ONLY_CODES?catalog.filter(x=>process.env.DEMO_ONLY_CODES.split(',').includes(x.code)):catalog;
const baseline=process.env.DEMO_BASELINE_REF?execFileSync('git',['-C',root,'show',process.env.DEMO_BASELINE_REF+':homework-demo/reading-homework.mjs'],{encoding:'utf8'}):null;
const docsLinks=process.env.DEMO_DOC_LINKS?JSON.parse(await fs.readFile(process.env.DEMO_DOC_LINKS,'utf8')):null;
if(docsLinks){assert.equal(docsLinks.length,31);assert.deepEqual(docsLinks.map(x=>x.code),catalog.map(x=>x.code));for(const row of catalog)assert.equal(docsLinks.find(x=>x.code===row.code).url,`https://tranhoangduc90.github.io/izone-ai-team-pages/homework-demo/${row.href}`);}
const server=process.env.DEMO_PUBLIC_BASE?null:await serveDirectory(root),base=process.env.DEMO_PUBLIC_BASE||server.origin+'/';
const browser=await chromium.launch({headless:true,channel:'chrome'});const results=[];
try{
 for(const [index,row] of selected.entries()){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],missing=[],realRequests=[];
  page.setDefaultTimeout(6000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)missing.push({status:r.status(),url:r.url()});});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(/ducizone|googleapis|accounts\.google|gstatic/.test(u.hostname)){realRequests.push({url:u.origin+u.pathname,method:route.request().method()});return route.abort();}if(baseline&&u.pathname.endsWith('/homework-demo/reading-homework.mjs'))return route.fulfill({status:200,contentType:'text/javascript',body:baseline});if(row.code==='67-reading-green-roofs'&&u.pathname.endsWith('/reading-practice/authored-ui.js'))await new Promise(resolve=>setTimeout(resolve,1500));await route.continue();});
  try{
   const url=process.env.DEMO_PUBLIC_BASE&&docsLinks?docsLinks.find(x=>x.code===row.code).url:new URL('homework-demo/'+row.href,base).href;await page.goto(url,{waitUntil:'networkidle'});
   await page.locator('body[data-demo-ready="true"]').waitFor({timeout:20000});
   assert.equal(await page.locator('#login-screen:visible,#access:visible,#teacher-login:visible,#class-select:visible,#student-select:visible').count(),0,'No identity gate');
   const payload=JSON.parse(await fs.readFile(path.join(root,'homework-demo/data',row.code+'.json'),'utf8'));
   let controls=0;
   if(row.kind==='reading-homework'){
    const expected=[...payload.content.targets,...(payload.content.diagnosticTargets||[])].map(t=>t.id).sort(),actual=await page.locator('[data-target]').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.target))].sort());
    assert.deepEqual(actual,expected,'Every native homework target is rendered');controls=actual.length;
    const editable=page.locator('textarea[data-target]').first();if(await editable.count()){await editable.fill('Thao tác thử riêng của giảng viên');assert.equal(await editable.inputValue(),'Thao tác thử riêng của giảng viên');}
    if(payload.content.type==='matching_headings'){assert.equal(await page.locator('.reading-practice-overlay:visible').count(),0);assert.equal(await page.locator('.reading-practice-content[inert]').count(),0);}
    await page.locator('#grade-button').click();await page.locator('#modal[open]').waitFor();assert.match(await page.locator('#modal').innerText(),/không phải|không chấm|minh họa/i);await page.keyboard.press('Escape');
   }else if(row.kind==='speaking'){
    controls=await page.locator('#parts .task-card').count();assert.equal(controls,payload.parts.length);
    await page.locator('[data-sample]').first().click();assert.match(await page.locator('.check-result:visible').first().innerText(),/ví dụ|minh họa/i);
    await page.locator('[data-guide]').first().click();await page.locator('#demo-guide[open]').waitFor();await page.keyboard.press('Escape');
   }else if(row.kind==='practice'){
    const expected=payload.definition.groups.flatMap(g=>g.questions.map(q=>q.n)).sort((a,b)=>a-b),seen=new Set();
    const tabs=await page.locator('[data-demo-passage]').count();
    for(let i=0;i<Math.max(1,tabs);i++){if(tabs)await page.locator('[data-demo-passage]').nth(i).click();for(const n of await page.locator('[id^="q-"]').evaluateAll(nodes=>nodes.map(n=>Number(n.id.slice(2))).filter(Number.isFinite)))seen.add(n);}
    assert.deepEqual([...seen].sort((a,b)=>a-b),expected,'All questions across every passage');controls=seen.size;
    await page.locator('#demo-feedback-open').click();await page.locator('#demo-feedback[open]').waitFor();await page.keyboard.press('Escape');
   }else{
    controls=await page.locator('#question-map button').count();assert.equal(controls,payload.content.items.length);
    await page.locator('#submit').click();await page.locator('#demo-feedback[open]').waitFor();await page.keyboard.press('Escape');
   }
   await page.screenshot({path:path.join(out,`${String(index+1).padStart(2,'0')}-desktop.png`)});
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);
   assert.ok(await page.locator('main').isVisible(),'Native content remains visible on mobile');
   const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(overflow.page<=overflow.viewport+2,'No page-level horizontal overflow');
   await page.screenshot({path:path.join(out,`${String(index+1).padStart(2,'0')}-mobile.png`)});
   await page.locator('#demo-reset').click();
   if(row.kind==='reading-homework')assert.equal(await page.locator('textarea[data-target]').first().inputValue(),'');
   assert.deepEqual(errors,[],'No page errors');assert.deepEqual(missing,[],'No missing assets');assert.deepEqual(realRequests,[],'No learner, identity, AI or Docs requests');
   results.push({code:row.code,passed:true,controls,url});console.log(JSON.stringify(results.at(-1)));
  }catch(error){results.push({code:row.code,passed:false,error:error.message,errors,missing,realRequests});console.log(JSON.stringify(results.at(-1)));await page.screenshot({path:path.join(out,`${String(index+1).padStart(2,'0')}-failure.png`)}).catch(()=>{});}
  finally{await context.close();}
 }
}finally{await browser.close();await server?.close();await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));}
assert.equal(results.filter(r=>r.passed).length,selected.length,JSON.stringify(results.filter(r=>!r.passed),null,2));
