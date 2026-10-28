import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/ADMIN/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');

test('Homework uses current Listening type scale, independent blank feedback and safe mobile focus',async()=>{
 const site=await serveDirectory(fileURLToPath(new URL('../',import.meta.url))),browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const font=selector=>page.locator(selector).first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 try{
  await page.goto(site.origin+'/listening-homework/preview.html');await page.locator('#entry-submit').click();await page.locator('#field-D1').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await font('.dictation-line p'),18);
  for(const id of ['D1','D2','D3']){
   await page.locator('#field-'+id).fill('My answer '+id);await page.locator(`[data-flag=${id}]`).click();
   assert.equal(await page.locator(`[data-flag=${id}]`).getAttribute('aria-pressed'),'true');
  }
  await page.locator('#submit').click();
  for(const id of ['D1','D2','D3']){
   await page.locator(`[data-review=${id}]`).click();assert.match(await page.locator('#review-content').innerText(),new RegExp('My answer '+id));
   await page.keyboard.press('Escape');assert.equal(await page.locator('#explanation-dialog').evaluate(e=>e.open),false);
  }
  for(const percent of [90,100,120]){
   while(Number((await page.locator('#font-percent').innerText()).replace('%',''))!==percent){const now=Number((await page.locator('#font-percent').innerText()).replace('%',''));await page.locator(now>percent?'#font-down':'#font-up').click();}
   assert.ok(Math.abs(await font('#field-D1')-18*percent/100)<.02);
  }
  await page.locator('#font-down').click();await page.locator('#font-down').click();await page.locator('[data-chapter="1"]').click();
  assert.equal(await font('.mcq-context .cbt-choice'),18);assert.equal(await font('.mcq-context .cbt-question-heading p'),18);assert.equal(await font('.cue p'),18);assert.equal(await font('#section-title'),22);
  await page.locator('input[name=S1]').first().focus();assert.equal(await page.locator('#use-selection').isEnabled(),false,'Radio focus does not become a transcript input target');
  for(const viewport of [{width:1366,height:690},{width:1280,height:600},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.locator('[data-jump="S19"]').click();await page.locator('#field-S19quote').focus();
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
   assert.ok(await page.locator('#field-S19quote').evaluate(e=>{const r=e.getBoundingClientRect(),d=document.querySelector('.hw-question-dock').getBoundingClientRect();return r.top>=0&&r.bottom<d.top;}),'Focused last quote remains above dock '+viewport.width);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await site.close();}
});
