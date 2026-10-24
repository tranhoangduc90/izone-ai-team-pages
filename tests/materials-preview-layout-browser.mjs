// Real preview/demo shells and native iframe; inert synthetic child content.
// Checks shell geometry, target sizes, mode/query preservation and frame scrolling.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.MATERIALS_PREVIEW_EVIDENCE_DIR||resolve(root,'output/playwright/materials-preview-layout');await fs.mkdir(out,{recursive:true});
const revision=process.env.MATERIALS_PREVIEW_REVISION||null,publicBase=process.env.MATERIALS_PREVIEW_PUBLIC_BASE||null;assert.ok(!(revision&&publicBase));
const paths=['shared/master170/materials.css','reading-skills67/preview.html','reading-skills67/demo.html'],overrides=new Map();
for(const path of paths){if(revision)overrides.set('/'+path,execFileSync('git',['-C',root,'show',revision+':'+path]));if(publicBase){const response=await fetch(publicBase.replace(/\/$/,'')+'/'+path,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);overrides.set('/'+path,Buffer.from(await response.arrayBuffer()));}}
const child='<!doctype html><html lang="vi"><meta charset="utf-8"><title>Khung giả</title><body style="margin:0;font:18px sans-serif"><h1>Khung nội dung giả</h1><p>Chỉ kiểm kích thước và cuộn iframe.</p><div style="height:1400px"></div><button id="bottom" style="height:44px">Cuối nội dung giả</button></body></html>';
const viewports=[[1440,1000],[390,844],[320,568],[844,390],[800,600],[601,700],[600,700]];
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];let fatal;
try{
 for(const product of ['preview','demo'])for(const[width,height]of viewports){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==site.origin)return route.abort();if(request.method()!=='GET'){writes.push(url.pathname);return route.abort();}if(url.pathname==='/reading-skills67/')return route.fulfill({contentType:'text/html; charset=utf-8',body:child});if(overrides.has(url.pathname))return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8',body:overrides.get(url.pathname)});return route.continue();});
   await page.goto(site.origin+`/reading-skills67/${product}.html?server=1&marker=preserve`);await page.evaluate(()=>document.fonts.ready);const frame=page.frameLocator('iframe');await frame.locator('#bottom').waitFor();const source=await page.locator('iframe').getAttribute('src');
   for(const mode of ['initial','phone','desktop']){
    if(mode==='phone')await page.locator(product==='preview'?'#phone':'#device').click();if(mode==='desktop')await page.locator(product==='preview'?'#desktop':'#device').click();
    const row={product,width,height,mode,outcome:'passed',observation:await page.evaluate(()=>{const f=document.querySelector('iframe'),r=f.getBoundingClientRect();return{frameHeight:r.height,frameWidth:r.width,phone:document.body.classList.contains('phone'),overflow:document.documentElement.scrollWidth>innerWidth,marker:new URL(location.href).searchParams.get('marker'),source:f.getAttribute('src'),targets:[...document.querySelectorAll('button,a')].filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.textContent.trim(),height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}))};})};
    await frame.locator('#bottom').scrollIntoViewIfNeeded();row.childScroll=await frame.locator('#bottom').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{visible:r.top>=-1&&r.bottom<=innerHeight+1,top:r.top,bottom:r.bottom,hit:hit===e,viewport:innerHeight};});
    row.checks={usableFrame:row.observation.frameHeight>=(width<=600?400:160),targetSizes:row.observation.targets.every(e=>e.height>=43.9&&e.width>=43.9),noHorizontalOverflow:!row.observation.overflow,mode:row.observation.phone===(mode==='phone'),marker:row.observation.marker==='preserve',source:row.observation.source===source,child:row.childScroll.visible&&row.childScroll.hit,noErrors:errors.length===0&&writes.length===0};
    try{assert.ok(Object.values(row.checks).every(Boolean),JSON.stringify(row.checks));}catch(e){row.outcome='failed';row.error=e.message;}
    if(mode==='initial'){row.image=`${product}-${width}x${height}.png`;await page.screenshot({path:out+'/'+row.image});}records.push(row);
   }
  }finally{await context.close();}
 }
}catch(e){fatal=e.stack;}finally{await browser.close();await site.close();}
const sourceHashes={};for(const path of paths)sourceHashes[path]=createHash('sha256').update(overrides.get('/'+path)||await fs.readFile(resolve(root,path))).digest('hex');
const result={outcome:fatal||records.some(r=>r.outcome==='failed')?'failed':'passed',records,fatal,revision,publicBase,sourceHashes,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),businessWrites:0,scope:'Actual shell HTML/CSS and native iframe with inert synthetic child; not actual Materials renderer, API, account, AI or physical-device acceptance.'};await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(r=>r.outcome==='failed').length,fatal}));if(result.outcome!=='passed')process.exitCode=1;
