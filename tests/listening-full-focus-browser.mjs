import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';

// Compare the real stylesheet chains with Term 1; no exam API or learner data.
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
let site,browser;const records=[];
before(async()=>{site=await serveDirectory(root);browser=await chromium.launch({channel:'chrome',headless:true});});
after(async()=>{if(process.env.LISTENING_FOCUS_EVIDENCE_DIR){await fs.mkdir(process.env.LISTENING_FOCUS_EVIDENCE_DIR,{recursive:true});await fs.writeFile(path.join(process.env.LISTENING_FOCUS_EVIDENCE_DIR,'focus.json'),JSON.stringify(records,null,2));}await browser?.close();await site?.close();});
async function field(ctx,kind,type,scale){
 const file=kind==='term'?'term-tests/term-test-1-computer-based/index.html':'listening-practice/index.html';
 const html=await fs.readFile(path.join(root,file),'utf8'),links=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(m=>m[0]);
 const page=await ctx.newPage();await page.goto(site.origin+'/');
 await page.setContent(`<html ${kind==='listening'?'data-izone-theme="master170"':''}><head><base href="${site.origin+'/'+file}">${links.join('')}</head><body class="design67 reading cbt-mode ${kind==='listening'?'listening-full-test':''}" ${kind==='listening'?'data-m170-product="practice"':''}><div id="app"><div id="readingView"><div class="cbt-content-viewport" data-font-size="${scale}" style="font-size:${16*scale/100}px"><span class="cbt-inline-answer"><span class="cbt-blank-number">33</span><span data-answer-slot><input class="cbt-answer-input" aria-label="Question 33"></span></span><span class="cbt-select-answer"><select class="cbt-answer-select" aria-label="Question 17"><option>Nhấn để chọn</option></select></span><button>Next</button></div></div></div></body></html>`);
 await page.evaluate(()=>document.fonts.ready);const el=page.locator(type);return{page,el};
}
const metrics=el=>el.evaluate(e=>{const c=getComputedStyle(e);return{font:c.fontSize,height:e.getBoundingClientRect().height,padding:c.padding,outlineStyle:c.outlineStyle,outlineWidth:c.outlineWidth,border:c.borderColor,shadow:c.boxShadow,focused:e===document.activeElement};});
for(const width of [1359,390])for(const type of ['input','select'])test(`${width}px ${type}: compact height and Term 1 keyboard/mouse focus`,async()=>{
 const ctx=await browser.newContext({viewport:{width,height:844}});await ctx.route('**/*',r=>new URL(r.request().url()).origin===site.origin?r.continue():r.abort());
 try{for(const scale of [90,100,110,120]){const a=await field(ctx,'term',type,scale),b=await field(ctx,'listening',type,scale);
 for(const mode of ['click','keyboard']){for(const f of [a,b]){if(mode==='click')await f.el.click();else{await f.page.locator('button').focus();await f.page.keyboard.press('Shift+Tab');if(type==='input')await f.page.keyboard.press('Shift+Tab');}}
 const expected=await metrics(a.el),actual=await metrics(b.el);assert.equal(actual.focused,true);assert.equal(expected.focused,true);assert.equal(actual.font,expected.font);assert.ok(Math.abs(actual.height-expected.height)<1);assert.equal(actual.padding,expected.padding);assert.equal(actual.outlineStyle,'none');assert.equal(actual.outlineWidth,'0px');assert.equal(actual.border,expected.border);assert.equal(actual.shadow,expected.shadow);records.push({width,type,scale,mode,expected,actual});}
 await a.page.locator('button').focus();await b.page.locator('button').focus();
 const ring=p=>p.locator('button').evaluate(e=>{const c=getComputedStyle(e);return{outline:c.outline,offset:c.outlineOffset};});
 assert.deepEqual(await ring(b.page),await ring(a.page));
 await a.page.close();await b.page.close();}}finally{await ctx.close();}
});
