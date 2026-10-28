// Native stylesheet chains and actual Reading renderer; no business API or account.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
import {groupsHtml} from '../reading-practice/authored-ui.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.ASSESSMENT_CONTROL_EVIDENCE_DIR;assert.ok(out);await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext(),page=await ctx.newPage(),records=[];
await ctx.route('**/*',r=>new URL(r.request().url()).origin===site.origin?r.continue():r.abort());
async function mount(file,content,working=false){const html=await fs.readFile(path.join(root,file),'utf8'),head=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>|<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('\n'),body=html.match(/<body\b([^>]*)>/i)?.[1]||'',attrs=html.match(/<html\b([^>]*)>/i)?.[1]||'';await page.goto(site.origin+'/');await page.setContent(`<html ${attrs}><head><base href="${site.origin+'/'+file}">${head}</head><body${body}>${content}</body></html>`);if(working)await page.evaluate(()=>document.body.classList.add('reading','cbt-mode','authored-reading'));await page.evaluate(()=>document.fonts.ready);}
const loginCases=[
 ['reading-practice/index.html','check-line','remember-student'],['listening-practice/index.html','check-line','remember-student'],
 ['reading-practice/teacher-progress.html','teacher-login-remember','teacher-remember'],['listening-practice/teacher-progress.html','teacher-login-remember','teacher-remember'],
 ['reading-skills67/materials-beyond-concrete/teacher.html','materials-login-remember','teacher-remember'],['reading-skills67/butterflies-britain-tfng/teacher.html','materials-login-remember','teacher-remember'],
 ['listening-homework/lesson-2.html','remember','remember-student'],['listening-homework/scandinavian-studies.html','remember','remember-student'],
 ['term-tests/index.html','teacher-login-remember','rememberTeacherLogin'],['term-tests/teacher/index.html','teacher-login-remember','rememberTeacherLogin'],
 ['term-tests/term-test-1-computer-based/index.html','checkbox-row','bootstrap-remember-student'],['term-tests/term-test-1-k56-computer-based/index.html','cbt-remember-student','bootstrapRememberStudent'],
 ['term-tests/substitute-test-1-k67-computer-based/index.html','teacher-login-remember','teacher-remember'],
 ['speaking-homework/lesson-4.html','teacher-login-remember','teacher-remember'],['progress-log/index.html','teacher-login-remember','teacher-remember'],['writing-handouts/library.html','teacher-login-remember','teacher-remember']
];
let failure;
try{
 for(const [file,className,id]of loginCases){
  if(process.env.CONTROL_SKIP_LOGIN)continue;
  try{await fs.access(path.join(root,file));}catch{records.push({file,outcome:'not_present'});continue;}
  if(process.env.CONTROL_ONLY_PRACTICE&&!['reading-practice/index.html','listening-practice/index.html'].includes(file))continue;
  for(const width of [1440,390]){
   const container=className==='check-line'?'card login-card':className==='materials-login-remember'?'materials-login-card':['checkbox-row','cbt-remember-student'].includes(className)?'cbt-bootstrap-identity':'access-card';
   await page.setViewportSize({width,height:900});await mount(file,`<main id="app"><section class="${container}" style="max-width:520px;margin:20px;padding:24px"><label class="${className}"><input id="${id}" type="checkbox" checked> Ghi nhớ tôi trên thiết bị này</label></section></main>`);
   const observation=await page.locator('label').evaluate(label=>{const input=label.querySelector('input'),text=[...label.childNodes].find(n=>n.nodeType===3&&n.textContent.trim()),range=document.createRange();range.selectNodeContents(text);const r=range.getBoundingClientRect(),b=input.getBoundingClientRect();return{height:b.height,width:b.width,delta:Math.abs((b.top+b.bottom-r.top-r.bottom)/2),overflow:document.documentElement.scrollWidth>innerWidth};});
   const passed=observation.height<=20&&observation.width<=20&&observation.delta<=3&&!observation.overflow;records.push({file,viewport:width,...observation,outcome:passed?'passed':'failed'});if(!passed||file==='reading-practice/index.html')await page.screenshot({path:path.join(out,file.replaceAll('/','-')+'-'+width+'.png')});
   const input=page.locator('input');await input.uncheck();assert.equal(await input.isChecked(),false);await input.check();assert.equal(await input.isChecked(),true);
  }
 }
 if(!process.env.CONTROL_ONLY_PRACTICE){
  const oldSource=execFileSync('git',['-C',root,'show','e3352b0:reading-practice/authored-ui.js'],{encoding:'utf8'}),oldUI=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
  const options=['TRUE','FALSE','NOT GIVEN'].map(value=>({value,text:value})),group={id:'tfng',kind:'matching',label:'True / False / Not Given',instruction:'Compare each statement with the source.',options,questions:[{n:8,text:'The first source statement remains complete.'},{n:9,text:'The second source statement remains complete.'}]};
  const content=html=>`<div id="readingView"><div class="cbt-content-viewport" style="font-size:16px"><article class="cbt-reading-questions" id="question-scroll">${html}</article></div></div>`;
  const a={answers:{8:'NOT GIVEN'},annotations:[]},flag=n=>`<button class="cbt-flag-button" data-action="flag" data-question="${n}">Flag</button>`;
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});await mount('reading-practice/index.html',content(groupsHtml([group],a,flag)),true);
   assert.equal(await page.locator('input[type=radio]').count(),6);assert.equal(await page.locator('select').count(),0);assert.equal(await page.locator('.cbt-option-bank:visible').count(),0);assert.equal(await page.locator('.cbt-question-number').count(),2);assert.equal(await page.locator('.cbt-choice-letter').count(),0);assert.equal(await page.locator('input:checked').inputValue(),'NOT GIVEN');
   await page.locator('input[data-answer="9"][value="FALSE"]').check();assert.equal(await page.locator('input[data-answer="9"][value="FALSE"]').isChecked(),true);
   const actual=await page.locator('.cbt-choice').first().evaluate(e=>{const s=getComputedStyle(e);return{font:s.fontSize,padding:s.padding,border:s.borderColor,bg:s.backgroundColor,columns:s.gridTemplateColumns.split(' ').length};});
   const actualSelected=await page.locator('.cbt-choice:has(input:checked)').first().evaluate(e=>({border:getComputedStyle(e).borderColor,bg:getComputedStyle(e).backgroundColor}));
   await page.screenshot({path:path.join(out,'tfng-'+width+'.png')});
   const native=`<section class="design-question-group"><header class="cbt-subsection-heading"><h4>Questions 8–9 · True / False / Not Given</h4></header><div class="design-question-content"><article class="cbt-question-card"><div class="cbt-question-heading"><span class="cbt-question-number">8</span><p>${group.questions[0].text}</p>${flag(8)}</div><div class="cbt-choice-list">${options.map(o=>`<label class="cbt-choice cbt-choice-single-label"><input type="radio"><span>${o.text}</span></label>`).join('')}</div></article></div></section>`;
   await mount('term-tests/term-test-1-computer-based/index.html',content(native),true);await page.locator('.cbt-choice input').last().check();const expected=await page.locator('.cbt-choice').first().evaluate(e=>{const s=getComputedStyle(e);return{font:s.fontSize,padding:s.padding,border:s.borderColor,bg:s.backgroundColor,columns:s.gridTemplateColumns.split(' ').length};});
   const expectedSelected=await page.locator('.cbt-choice:has(input:checked)').first().evaluate(e=>({border:getComputedStyle(e).borderColor,bg:getComputedStyle(e).backgroundColor}));assert.deepEqual(actualSelected,expectedSelected);
   records.push({kind:'tfng-native',width,actual,expected,outcome:'passed'});assert.deepEqual(actual,expected);
  }
  // Compare the exact old text stream. New radio labels are excluded from anchors.
  await mount('reading-practice/index.html',content(groupsHtml([group],a,flag)),true);
  const stream=await page.evaluate(oldHtml=>{const excluded='button,input,select,textarea,script,style,[contenteditable=true],.cbt-annotation-toolbar,.cbt-note-panel,.cbt-blank-number,.cbt-question-number,.cbt-choice-letter,.cbt-paragraph-label,.authored-judgment-choices';const text=root=>{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),all=[];while(w.nextNode())if(!w.currentNode.parentElement.closest(excluded))all.push(w.currentNode.data);return all.join('');};const old=document.createElement('article');old.innerHTML=oldHtml;return{before:text(old),after:text(document.querySelector('#question-scroll'))};},oldUI.groupsHtml([group],a,flag));assert.equal(stream.after,stream.before);records.push({kind:'old-annotation-text',outcome:'passed'});
 }
}catch(e){failure=e.stack;await page.screenshot({path:path.join(out,'failure.png')});}
finally{await ctx.close();await browser.close();await site.close();}
const failed=records.filter(r=>r.outcome==='failed');await fs.writeFile(path.join(out,'results.json'),JSON.stringify({outcome:failure||failed.length?'failed':'passed',failure,records},null,2));console.log(JSON.stringify({failure,cases:records.length,failed}));if(failure||failed.length)process.exitCode=1;
