// Actual teacher HTML/renderer with read-only synthetic API. No Google/real data.
// Checks actionable typography, long identity text, pending/error roles and retry.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.MATERIALS_TEACHER_EVIDENCE_DIR||resolve(root,'output/playwright/materials-teacher');await fs.mkdir(out,{recursive:true});
const revision=process.env.MATERIALS_TEACHER_REVISION||null,publicBase=process.env.MATERIALS_TEACHER_PUBLIC_BASE||null;assert.ok(!(revision&&publicBase));
const paths=['reading-skills67/teacher.html','reading-skills67/materials-beyond-concrete/teacher.html','reading-skills67/teacher.js','shared/master170/materials.css'],overrides=new Map();
for(const path of paths){if(revision)overrides.set('/'+path,execFileSync('git',['-C',root,'show',revision+':'+path]));if(publicBase){const response=await fetch(publicBase.replace(/\/$/,'')+'/'+path,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);overrides.set('/'+path,Buffer.from(await response.arrayBuffer()));}}
const palette={pending:{fg:'rgb(23, 66, 101)',bg:'rgb(230, 238, 245)'},error:{fg:'rgb(155, 10, 34)',bg:'rgb(253, 232, 235)'}};
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];let fatal;
try{
 for(const entry of ['root','nested'])for(const [width,height]of[[1440,1000],[1024,768],[390,844],[320,568],[844,390]])for(const names of ['normal','long']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const roster=[{studentRef:'synthetic-a',name:names==='long'?'Người học giả '+('TenKhongKhoangTrang'.repeat(6)):'Người học giả A'},{studentRef:'synthetic-b',name:names==='long'?'Người học giả có tên và thông tin rất dài để kiểm xuống dòng trong danh sách':'Người học giả B'}];let phase='ready',release;const observations=[];
  try{
   await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==site.origin)return route.abort();if(request.method()!=='GET'){writes.push(url.pathname);return route.abort();}
    if(url.pathname.endsWith('/api-config.js'))return route.fulfill({contentType:'text/javascript',body:"window.READING67_API_BASE='/__fixture_teacher_api';"});
    if(url.pathname==='/__fixture_teacher_api/config')return route.fulfill({json:{title:'Bài học giả kiểm giao diện giảng viên',demo:true}});
    if(url.pathname==='/__fixture_teacher_api/teacher/classes')return route.fulfill({json:{ok:true,classes:[{id:'synthetic-class',classCode:'LOPTHU'}]}});
    if(url.pathname.startsWith('/__fixture_teacher_api/teacher/students/')){if(phase==='pending'){await new Promise(resolve=>release=resolve);return route.fulfill({status:503,json:{ok:false,error:'FIXTURE_UNAVAILABLE'}});}return route.fulfill({json:{ok:true,students:roster}});}
    if(overrides.has(url.pathname))return route.fulfill({body:overrides.get(url.pathname),contentType:url.pathname.endsWith('.html')?'text/html; charset=utf-8':url.pathname.endsWith('.css')?'text/css':'text/javascript'});return route.continue();});
   const directory=entry==='root'?'/reading-skills67/':'/reading-skills67/materials-beyond-concrete/';await page.goto(site.origin+directory+'teacher.html');await page.locator('#teacher-class').selectOption('synthetic-class');await page.locator('#teacher-students .history-row').first().waitFor();await page.evaluate(()=>document.fonts.ready);
   const observe=async state=>{const result=await page.evaluate(()=>{const container=document.querySelector('#teacher-students'),s=getComputedStyle(container);return{font:getComputedStyle(document.body).fontFamily,overflow:document.documentElement.scrollWidth>innerWidth,selected:document.querySelector('#teacher-class').value,text:container.textContent,fg:s.color,bg:s.backgroundColor,targets:[...document.querySelectorAll('.app-header a.quiet,#teacher-students a.secondary')].map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{text:e.textContent,fontSize:parseFloat(s.fontSize),height:r.height,width:r.width,href:e.getAttribute('href')};}),names:[...document.querySelectorAll('#teacher-students strong')].map(e=>({text:e.textContent,fontSize:parseFloat(getComputedStyle(e).fontSize)}))};});result.state=state;result.checks={font:result.font.includes('Source Sans 3'),noOverflow:!result.overflow,selection:result.selected==='synthetic-class',actionType:result.targets.every(x=>x.fontSize>=16),targets:result.targets.every(x=>x.height>=43.9&&x.width>=43.9),identityType:result.names.every(x=>x.fontSize>=16)};
    if(state==='pending'||state==='error'){result.checks.roleFg=result.fg===palette[state].fg;result.checks.roleBg=result.bg===palette[state].bg;}
    if(state==='ready'||state==='recovered'){result.checks.names=result.names.length===2&&result.names.every((x,i)=>x.text===roster[i].name);const links=result.targets.filter(x=>x.href.includes('studentRef='));result.checks.links=links.length===2;result.checks.readableActions=links.every(x=>x.width>=160);}
    if((names==='normal'&&[1440,390,320].includes(width))||(names==='long'&&width===320)){result.image=`${entry}-${names}-${state}-${width}.png`;await page.screenshot({path:out+'/'+result.image,fullPage:true});}observations.push(result);return result;};
   const ready=await observe('ready');phase='pending';await page.locator('#teacher-class').selectOption('synthetic-class');await page.locator('#teacher-students').filter({hasText:'Đang đọc danh sách'}).waitFor();await observe('pending');assert.ok(release);release();await page.locator('#teacher-students').filter({hasText:'FIXTURE_UNAVAILABLE'}).waitFor();await observe('error');phase='ready';await page.locator('#teacher-class').selectOption('synthetic-class');await page.locator('#teacher-students .history-row').first().waitFor();const recovered=await observe('recovered');
   const row={entry,width,height,names,outcome:'passed',observations};try{assert.ok(observations.every(x=>Object.values(x.checks).every(Boolean)));assert.deepEqual(recovered.targets,ready.targets);assert.deepEqual(recovered.names,ready.names);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);}catch(e){row.outcome='failed';row.error=e.message;}records.push(row);
  }finally{await context.unrouteAll({behavior:'wait'});await context.close();}
 }
}catch(e){fatal=e.stack;}finally{await browser.close();await site.close();}
const sourceHashes={};for(const path of paths)sourceHashes[path]=createHash('sha256').update(overrides.get('/'+path)||await fs.readFile(resolve(root,path))).digest('hex');
const result={outcome:fatal||records.some(x=>x.outcome==='failed')?'failed':'passed',records,fatal,revision,publicBase,sourceHashes,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),businessWrites:0,scope:'Actual root/nested teacher renderer, read-only synthetic API. Public mode substitutes four deployed assets; remaining local. No actual login/shared SSO, backend, Google or real learner data.'};await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(x=>x.outcome==='failed').length,fatal}));if(result.outcome!=='passed')process.exitCode=1;
