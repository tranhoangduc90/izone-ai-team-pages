import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/ADMIN/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');

test('Public Libraries separates the background and aligns speaker labels with dictation text',async()=>{
 const site=await serveDirectory(fileURLToPath(new URL('../',import.meta.url))),browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],rows=[],failures=[];
 const fixture=(await fs.readFile(new URL('../listening-homework/preview.mjs',import.meta.url),'utf8')).replace("fetch('./interactive-content.json')","fetch('./paper-on-public-libraries-content.json')");
 await page.route('**/listening-homework/app.mjs?*',r=>r.fulfill({contentType:'text/javascript',body:fixture}));
 await page.route('https://**',r=>r.abort());page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(site.origin+'/listening-homework/paper-on-public-libraries.html');
  await page.locator('#entry-submit').click();await page.locator('#field-D7').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.inline-blank input').count(),7);
  await page.locator('#field-D1').fill('Draft stays intact');
  for(const size of [{width:1440,height:1000},{width:1180,height:850},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(size);
   for(const percent of size.width===1440?[90,100,120]:[100]){
    while(parseInt(await page.locator('#font-percent').innerText())!==percent){const value=parseInt(await page.locator('#font-percent').innerText());await page.locator(value>percent?'#font-down':'#font-up').click();}
    const geometry=await page.evaluate(()=>{
     const glyph=(element,textOnly=false)=>{const range=document.createRange();if(textOnly){range.setStart(element.firstChild,0);range.setEnd(element.firstChild,Math.min(3,element.firstChild.length));}else range.selectNodeContents(element);const b=range.getBoundingClientRect();return{top:b.top,bottom:b.bottom,left:b.left,right:b.right};};
     const summary=document.querySelector('.hw-source-background summary'),head=document.querySelector('#exercise-content > .hw-group-heading');
     return{gap:head.getBoundingClientRect().top-summary.getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,speakers:[...document.querySelectorAll('.dictation-line')].map(line=>{const speaker=line.querySelector('.speaker'),p=line.querySelector('p');return{name:speaker.textContent,speakerFont:parseFloat(getComputedStyle(speaker).fontSize),textFont:parseFloat(getComputedStyle(p).fontSize),speaker:glyph(speaker),text:glyph(p,true)};})};
    });
    rows.push({size,percent,...geometry});
    if(geometry.gap<20)failures.push(`${size.width}/${percent}: background gap ${geometry.gap}`);
    if(geometry.overflow)failures.push(`${size.width}/${percent}: document overflow`);
    for(const s of geometry.speakers){
     if(Math.abs(s.speakerFont-s.textFont)>.02)failures.push(`${size.width}/${percent}: ${s.name} font ${s.speakerFont} vs ${s.textFont}`);
     if(size.width>600&&Math.abs(s.speaker.bottom-s.text.bottom)>1.5)failures.push(`${size.width}/${percent}: ${s.name} baseline offset ${s.speaker.bottom-s.text.bottom}`);
     if(size.width<=600&&Math.abs(s.speaker.left-s.text.left)>1)failures.push(`${size.width}/${percent}: ${s.name} stacked left edge`);
    }
    assert.equal(await page.locator('#field-D1').inputValue(),'Draft stays intact');
   }
  }
  const out=process.env.LISTENING_LAYOUT_ARTIFACTS;
  if(out){await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/geometry.json',JSON.stringify({rows,failures,errors},null,2));await page.setViewportSize({width:1440,height:1000});await page.locator('#exercise').evaluate(e=>e.scrollTop=0);await page.screenshot({path:out+'/desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.locator('#exercise').evaluate(e=>e.scrollTop=0);await page.screenshot({path:out+'/mobile.png',fullPage:true});}
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  await page.locator('.hw-source-background summary').click();assert.equal(await page.locator('.hw-source-background').evaluate(e=>e.open),true);
  await page.locator('.hw-source-background summary').click();assert.equal(await page.locator('.hw-source-background').evaluate(e=>e.open),false);
 }finally{await browser.close();await site.close();}
});
