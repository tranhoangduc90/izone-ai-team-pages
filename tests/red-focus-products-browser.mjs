import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/ADMIN/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const out=process.env.RED_FOCUS_ARTIFACTS,casesFile=process.env.RED_FOCUS_CONSUMERS_FILE;assert(out&&casesFile);await mkdir(out,{recursive:true});
const cases=JSON.parse(await readFile(casesFile,'utf8')),roots=Object.fromEntries(cases.map(c=>[c.repo,c.root]));
const mime=f=>({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream';
async function resource(repo,relative){const root=path.resolve(roots[repo]),file=path.resolve(root,decodeURIComponent(relative));assert(file.startsWith(root+path.sep));return{body:await readFile(file),contentType:mime(file)};}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://fixture'),parts=url.pathname.split('/');if(parts[1]!=='__repo'||!roots[parts[2]]){res.writeHead(401,{'content-type':'application/json'});res.end('{"error":"isolated_fixture","authenticated":false}');return;}let rel=parts.slice(3).join('/');if(rel.endsWith('/'))rel+='index.html';const data=await resource(parts[2],rel);res.setHeader('content-type',data.contentType);res.end(data.body);}catch{res.writeHead(404);res.end('Fixture resource unavailable')}});server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true}),results=[];let cursor=0;
const selectors='button,a[href],input:not([type=hidden]),textarea,select,summary,[contenteditable=true],[tabindex]';
async function worker(){
 while(cursor<cases.length){
  const current=cases[cursor++],context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();const assetErrors=[],pageErrors=[];let blockedWrites=0;
  page.on('pageerror',e=>pageErrors.push(e.message));
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['GET','HEAD'].includes(request.method())){blockedWrites++;return route.fulfill({status:401,contentType:'application/json',body:'{"error":"read_only_fixture"}'});}
   if(request.url().startsWith(origin+'/'))return route.continue();
   if(url.hostname==='tranhoangduc90.github.io'){
    const mappings={'izone-ai-team-pages':['pages',''],'izone-classroom-mapping-review':['mapping',''],'google-doc-sidebar-github-demo':['docs','site/']};
    const parts=url.pathname.split('/').filter(Boolean),mapping=mappings[parts[0]];
    if(mapping&&roots[mapping[0]]){try{const r=await resource(mapping[0],mapping[1]+parts.slice(1).join('/'));return route.fulfill({...r,headers:{'access-control-allow-origin':'*'}});}catch{}}
   }
   if(url.hostname==='accounts.google.com'&&url.pathname.endsWith('/gsi/client'))return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{id:{initialize(){},renderButton(e){e.textContent='Google sign-in fixture'},prompt(){},disableAutoSelect(){}}}};"});
   return route.abort();
  });
  page.on('requestfailed',r=>{if(r.url().includes('red-focus-glow'))assetErrors.push(r.failure()?.errorText)});
  const row={repo:current.repo,path:current.path,group:current.group,controls:[]};
  try{
   await page.goto(`${origin}/__repo/${current.repo}/${current.path}`,{waitUntil:'domcontentloaded',timeout:20000});
   await page.locator('.iz-red-focus-glow').waitFor({state:'attached',timeout:5000});await page.waitForTimeout(100);
   const controls=await page.locator(selectors).elementHandles();let inspected=0;
   for(const control of controls){
    const visible=await control.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return !e.disabled&&e.tabIndex>=0&&s.visibility!=='hidden'&&s.display!=='none'&&r.width>=4&&r.height>=4&&!e.closest('[hidden]')}).catch(()=>false);
    if(!visible)continue;if(inspected++>=4)break;
    await page.evaluate(()=>document.activeElement?.blur());await page.waitForTimeout(40);
    const before=await control.evaluate(e=>{
     e.focus({preventScroll:true});if(e instanceof HTMLTextAreaElement||(e instanceof HTMLInputElement&&['text','search','email','url','tel'].includes(e.type)))try{e.setSelectionRange(0,Math.min(3,e.value.length))}catch{}
     function isRed(c){const n=c.match(/[\d.]+/g)?.map(Number);return n&&n.length>=3&&n[0]>140&&n[0]>n[1]+65&&n[0]>n[2]+35&&(n.length<4||n[3]>.03);}
     function outlined(n){const s=getComputedStyle(n);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0&&isRed(s.outlineColor);}
     const s=getComputedStyle(e),colors=s.boxShadow.match(/rgba?\([^)]*\)/g)||[],eligible=[];
     if(outlined(e)||colors.some(isRed))eligible.push(e);
     if(e.matches('input')&&e.nextElementSibling&&outlined(e.nextElementSibling))eligible.push(e.nextElementSibling);
     for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement)if(outlined(p))eligible.push(p);
     const target=eligible.at(-1),r=target?.getBoundingClientRect();
     return{tag:e.tagName,id:e.id,red:!!target,focus:e===document.activeElement,value:'value'in e?e.value:null,selection:'selectionStart'in e?[e.selectionStart,e.selectionEnd]:null,styles:[s.outlineStyle,s.outlineColor,s.outlineWidth,s.outlineOffset,s.boxShadow,s.borderRadius],expected:r?{left:r.left,top:r.top,width:r.width,height:r.height}:null};
    });
    await page.waitForTimeout(60);
    const after=await control.evaluate(e=>{const s=getComputedStyle(e),ring=document.querySelector('.iz-red-focus-glow'),r=ring.getBoundingClientRect(),rs=getComputedStyle(ring);return{focus:e===document.activeElement,value:'value'in e?e.value:null,selection:'selectionStart'in e?[e.selectionStart,e.selectionEnd]:null,styles:[s.outlineStyle,s.outlineColor,s.outlineWidth,s.outlineOffset,s.boxShadow,s.borderRadius],visible:!ring.hidden&&rs.display!=='none',bounds:{left:r.left,top:r.top,width:r.width,height:r.height},radii:[rs.borderTopLeftRadius,rs.borderTopRightRadius,rs.borderBottomRightRadius,rs.borderBottomLeftRadius]}});
    if(before.focus){assert(after.focus,'Focus changed');assert.equal(after.value,before.value,'Value changed');assert.deepEqual(after.selection,before.selection,'Selection changed');}
    if(before.red&&before.focus){assert(after.visible,'Native red focus did not receive glow');assert.deepEqual(after.radii,['12px','12px','12px','12px']);assert(Object.keys(before.expected).every(k=>Math.abs(after.bounds[k]-before.expected[k])<2),'Frame mismatch');}
    else if(before.focus){assert(!after.visible,'Non-red focus was changed');assert.deepEqual(after.styles,before.styles,'Native non-red style changed');}
    row.controls.push({tag:before.tag,id:before.id,red:before.red,focused:before.focus,passed:true});
   }
   assert.deepEqual(assetErrors,[]);row.status='passed';
  }catch(error){row.status='failed';row.error=error.stack;await page.screenshot({path:path.join(out,`${current.repo}-${current.path.replace(/[^a-z0-9.-]/gi,'_')}.png`)}).catch(()=>{});}
  row.preExistingPageErrors=pageErrors;row.blockedOriginalWriteAttempts=blockedWrites;results.push(row);await context.close();
  if(results.length%20===0)console.log(JSON.stringify({checked:results.length,failed:results.filter(r=>r.status==='failed').length}));
 }
}
try{await Promise.all([worker(),worker()]);const report={status:results.every(r=>r.status==='passed')?'passed':'failed',entries:results.length,redControls:results.flatMap(r=>r.controls).filter(c=>c.red).length,nativeControls:results.flatMap(r=>r.controls).filter(c=>!c.red).length,results};await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,entries:report.entries,redControls:report.redControls,nativeControls:report.nativeControls,failures:results.filter(r=>r.status==='failed').map(r=>({path:r.repo+':'+r.path,error:r.error}))}));assert.equal(report.status,'passed');}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
