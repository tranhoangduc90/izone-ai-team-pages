// Canonical exercise layout/CSS with synthetic prose and controls. No app/API/media scripts.
// Exercises the visible reading area, native scrolling and answer focus at short heights.
// The real app/API integration is a separate check; this fixture contains no exam content.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.PRACTICE_VIEWPORT_EVIDENCE_DIR||resolve(root,'output/playwright/practice-short-viewport');
await fs.mkdir(out,{recursive:true});
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];let fatal;
const cssRevision=process.env.PRACTICE_CSS_REVISION||null;
const publicCssUrl=process.env.PRACTICE_PUBLIC_CSS_URL||null;
assert.ok(!(cssRevision&&publicCssUrl),'Choose either baseline Git CSS or public CSS.');
let cssOverride=cssRevision?execFileSync('git',['-C',root,'show',cssRevision+':shared/master170/practice.css']):null;
if(publicCssUrl){const response=await fetch(publicCssUrl,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);cssOverride=Buffer.from(await response.arrayBuffer());}
const fixtureHashes=Object.fromEntries(await Promise.all(['reading','listening'].map(async kind=>[kind,createHash('sha256').update(await fs.readFile(resolve(root,`tests/fixtures/practice-short-${kind}.html`))).digest('hex')])));
const viewports=[[1440,1000],[1024,768],[390,844],[320,568],[844,390],[844,699],[844,700],[844,701]];
try{
 for(const kind of ['reading','listening'])for(const [width,height]of viewports){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET'||u.origin!==site.origin)return r.abort();if(cssOverride&&u.pathname==='/shared/master170/practice.css')return r.fulfill({contentType:'text/css',body:cssOverride});return r.continue();});
  try{
   await page.goto(site.origin+`/tests/fixtures/practice-short-${kind}.html`);await page.evaluate(()=>document.fonts.ready);
   for(const scale of [100,120])for(const pane of ['questions','passage']){
    // Fixture preconditions only: select the same layout state produced by the app.
    await page.evaluate(({scale,pane})=>{document.querySelector('#readingView').dataset.designPane=pane;document.querySelector('.cbt-content-viewport').dataset.fontSize=String(scale);document.querySelector('#font-percent').textContent=scale+'%';},{scale,pane});
    const row={kind,width,height,scale,pane,outcome:'passed'};
    try{
     row.geometry=await page.evaluate(pane=>{const e=document.querySelector('.cbt-content-viewport'),p=document.getElementById(pane==='passage'?'passage-scroll':'question-scroll');return {height:e.getBoundingClientRect().height,paneHeight:p.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth};},pane);
     assert.ok(row.geometry.height>=160&&row.geometry.paneHeight>=160,'The exercise needs enough visible space for prose and answer controls.');
     assert.equal(row.geometry.overflow,false,'No horizontal overflow of the whole page.');
     const panel=page.locator(pane==='passage'?'#passage-scroll':'#question-scroll');
     if(pane==='questions'){
      const first=panel.locator('select').first();await first.click();await page.keyboard.press('Escape');await first.selectOption('B');assert.equal(await first.inputValue(),'B');
      for(let n=0;n<11;n++){
       const focus=await page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),p=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,visible:r.top>=0&&r.bottom<=innerHeight-28,hit:p===e||e.contains(p)};});
       row.lastFocus=focus;assert.match(focus.id,/^fixture-answer-/);assert.equal(focus.visible&&focus.hit,true,'Focused answer is visible and uncovered.');await page.keyboard.press('Tab');
      }
     }else{
      await panel.evaluate(e=>e.scrollTop=0);await panel.scrollIntoViewIfNeeded();const box=await panel.boundingBox();
      await page.mouse.move(Math.max(25,box.x+30),Math.max(20,Math.min(height-45,box.y+box.height/2)));await page.mouse.wheel(0,250);
      await page.waitForFunction(()=>{const e=document.getElementById('passage-scroll');return e.scrollHeight<=e.clientHeight||e.scrollTop>0;});
     }
    }catch(e){row.outcome='failed';row.error=e.message;}
    records.push(row);
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
}catch(e){fatal=e.stack;}finally{await browser.close();await site.close();}
const result={outcome:fatal||records.some(x=>x.outcome==='failed')?'failed':'passed',records,fatal,externalWrites:0,cssRevision,publicCssUrl,fixtureHashes,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),cssSha256:createHash('sha256').update(cssOverride||await fs.readFile(resolve(root,'shared/master170/practice.css'))).digest('hex'),scope:'Actual canonical CSS in sanitized static layout fixtures; pane size/native scroll/focus only, not app/API or physical-device acceptance. Public mode downloads the deployed CSS; other assets are served from the local source.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(x=>x.outcome==='failed').length,fatal}));
if(result.outcome!=='passed')process.exitCode=1;
