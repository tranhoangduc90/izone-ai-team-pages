// Screenshot evidence from the actual gallery/renderers with fictional data.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';import {inspectDemo} from './fixtures/master170-demo-layout-probe.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.QUESTION_GALLERY_EVIDENCE_DIR;
if(!out)throw Error('QUESTION_GALLERY_EVIDENCE_DIR required');await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true});
const cases=JSON.parse(await fs.readFile(path.join(root,'design-reference/master170/cases.json'),'utf8')),ctx=await browser.newContext({viewport:{width:1542,height:1100}}),page=await ctx.newPage(),records=[];
await ctx.route('**/*',r=>new URL(r.request().url()).origin===site.origin?r.continue():r.abort());
try{
 await page.goto(site.origin+'/design-reference/master170/?approved=r3');
 for(const c of cases){
  await page.evaluate(id=>new Promise(resolve=>{const frame=document.querySelector('iframe'),select=document.querySelector('#case-select');frame.addEventListener('load',resolve,{once:true});select.value=id;select.dispatchEvent(new Event('change'));}),c.id);
  const frame=await (await page.$('iframe')).contentFrame();
  await frame.waitForFunction(()=>document.body.dataset.demoReady||document.querySelector('.study-grid')||document.querySelector('#exercise-content [data-field]'));
  await frame.evaluate(()=>document.fonts.ready);
  const observation=await frame.evaluate(({source,c})=>{const inspect=(new Function('return ('+source+')'))();return inspect(document,c);},{source:inspectDemo.toString(),c});
  if(observation.violations.length)throw Error(c.id+': '+observation.violations.join(','));
  let target;
  if(c.id==='remember')target=frame.locator('.login-card');
  else if(c.family.startsWith('homework'))target=page.locator('iframe');
  else if(c.documentNotes)target=frame.locator('#readingView .cbt-reading-section');
  else target=frame.locator('.design-question-group').first();
  const image=path.join(out,c.id+'.jpg');await target.screenshot({path:image,type:'jpeg',quality:86});
  records.push({id:c.id,title:c.title,family:c.family,criteria:c.criteria,image,observation});
 }
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({revision:'approved-r3',classification:'synthetic',records},null,2));
 console.log(JSON.stringify({cases:records.length,geometry:'all passed',directory:out}));
}finally{await ctx.close();await browser.close();await site.close();}
