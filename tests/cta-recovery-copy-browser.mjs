import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.CTA_RECOVERY_EVIDENCE_DIR||resolve(root,'output/playwright/cta-recovery-copy');
await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const revision=process.env.CTA_RECOVERY_REVISION||null,publicBase=process.env.CTA_RECOVERY_PUBLIC_BASE||null;
assert.ok(!(revision&&publicBase));
const assets=['cta-link-67/index.html','cta-link-67/app.js','cta-link-67/model.mjs','cta-link-67/styles.css','shared/master170/pilot.css'],overrides=new Map();
for(const path of assets){
 if(revision)overrides.set('/'+path,execFileSync('git',['-C',root,'show',revision+':'+path]));
 if(publicBase){const response=await fetch(publicBase.replace(/\/$/,'')+'/'+path,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);overrides.set('/'+path,Buffer.from(await response.arrayBuffer()));}
}
const server=createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),relative=decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''),path=resolve(root,'.'+relative);
 if(!path.startsWith(root+sep))return res.writeHead(403).end();
 try{const body=await fs.readFile(path);res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[extname(path)]||'application/octet-stream'}).end(body);}
 catch{res.writeHead(404).end();}
});
await new Promise((ok,no)=>{server.once('error',no);server.listen(35684,'127.0.0.1',ok);});
const origin='http://127.0.0.1:35684',records=[],browser=await chromium.launch({channel:'chrome',headless:true});
const docs=Array.from({length:8},(_,i)=>({docId:String.fromCharCode(65+i).repeat(28)}));
const input=docs.map(d=>'https://docs.google.com/document/d/'+d.docId+'/edit').join('\n');
const states=['queued','registered','pending','source_missing','source_ambiguous','invalid_url','duplicate','unknown'];
const payload={ok:true,results:docs.map((d,i)=>({...d,status:states[i],...(i===1?{codes:['67-reading-01','67-listening-01']}:{})}))};
try{
 for(const [width,height]of[[1440,1000],[390,844],[320,568]])for(const action of['submit','status'])for(const mode of['network','json','http503']){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(8000);const calls=[],errors=[],unexpected=[];let held;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const q=route.request(),u=new URL(q.url());
   if(u.origin===origin){if(overrides.has(u.pathname))return route.fulfill({body:overrides.get(u.pathname),contentType:u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.html')?'text/html; charset=utf-8':'text/javascript'});return route.continue();}
   if(u.hostname==='ducizone.ddns.net'&&u.pathname.startsWith('/webhook/cta-link-batch/')){
    assert.equal(q.method(),'POST');const op=u.pathname.split('/').at(-1);
    calls.push({path:u.pathname,method:q.method(),contentType:q.headers()['content-type'],body:q.postDataJSON()});
    if(op===action){held=route;return;}
    return route.fulfill({json:payload});
   }
   unexpected.push({origin:u.origin,path:u.pathname,method:q.method()});return route.abort();
  });
  const snapshot=()=>page.evaluate(()=>{const n=document.querySelector('#notice'),s=getComputedStyle(n);return{message:n.textContent,kind:n.dataset.state,bg:s.backgroundColor,fg:s.color,font:getComputedStyle(document.body).fontFamily,input:document.querySelector('#links').value,submitDisabled:document.querySelector('#submit').disabled,checkDisabled:document.querySelector('#check').disabled,rows:[...document.querySelectorAll('.result')].map(e=>({status:e.dataset.state,text:e.innerText}))};});
  try{
   await page.goto(origin+'/cta-link-67/');await page.locator('#links').fill(input);await page.locator('#submit').click();
   let previous=null;
   if(action==='status'){
    await page.waitForFunction(()=>document.querySelectorAll('.result').length===8);previous=(await snapshot()).rows;
    assert.deepEqual(previous.map(x=>x.status),states);await page.locator('#check').click();
   }
   await page.waitForFunction(()=>document.querySelector('#notice').dataset.state==='pending');
   const busy=await snapshot();assert.equal(busy.submitDisabled,true);assert.equal(busy.checkDisabled,true);assert.equal(busy.input,input);
   assert.ok(held);
   if(mode==='network')await held.abort('connectionfailed');
   else if(mode==='json')await held.fulfill({contentType:'application/json',body:'broken-json-fixture'});
   else await held.fulfill({status:503,json:{ok:false}});
   held=null;
   await page.waitForFunction(()=>document.querySelector('#notice').dataset.state==='attention');await page.evaluate(()=>document.fonts.ready);
   const ui=await snapshot();
   const baseMessage=mode==='network'?'Chưa kết nối được với hệ thống.':mode==='json'?'Chưa đọc được phản hồi của hệ thống.':'Hệ thống xử lý trả lỗi 503.';
   const expectedMessage=baseMessage+(action==='submit'?' Kiểm tra kết quả trước khi gửi lại.':' Trạng thái đang hiển thị chưa được cập nhật.');
   const checks={copy:ui.message===expectedMessage,role:ui.kind==='attention'&&ui.bg==='rgba(0, 0, 0, 0)'&&ui.fg==='rgb(138, 83, 0)',font:ui.font.includes('Source Sans 3')};
   assert.equal(ui.input,input);assert.equal(ui.submitDisabled,false);assert.equal(ui.checkDisabled,false);
   assert.equal(ui.rows.length,8);
   if(action==='submit')assert.deepEqual(ui.rows.map(x=>x.status),Array(8).fill('unknown'));
   else assert.deepEqual(ui.rows,previous);
   assert.equal(calls.length,action==='submit'?1:2);
   for(const call of calls){assert.equal(call.contentType,'text/plain');assert.deepEqual(call.body,{docs});}
   assert.deepEqual(calls.map(c=>c.path.split('/').at(-1)),action==='submit'?['submit']:['submit','status']);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
   await page.screenshot({path:out+'/'+action+'-'+mode+'-'+width+'.png',fullPage:true});
   await page.locator('#notice').screenshot({path:out+'/'+action+'-'+mode+'-'+width+'-notice.png'});
   records.push({action,mode,width,height,outcome:Object.values(checks).every(Boolean)?'passed':'failed',checks,busy,ui,calls});
  }catch(error){records.push({action,mode,width,height,outcome:'failed',error:error.stack,calls,errors,unexpected});}
  finally{if(held)await held.abort().catch(()=>{});await context.unrouteAll({behavior:'wait'});await context.close();}
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
const sources={};for(const path of [...assets,'shared/master170/theme.css'])sources[path]=createHash('sha256').update(overrides.get('/'+path)||await fs.readFile(resolve(root,path))).digest('hex');
const result={outcome:records.every(x=>x.outcome==='passed')?'passed':'failed',records,sourceHashes:sources,revision,publicBase,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),externalWrites:0,scope:'Actual CTA frontend/model, synthetic eight Doc IDs and mocked webhook responses only. Public mode substitutes five HTML/JS/CSS assets; other assets local. No Docs/Lark/AI/learner write or actual CTA registration.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(x=>x.outcome==='failed').length,errors:records.filter(x=>x.error).map(x=>({action:x.action,mode:x.mode,width:x.width,error:x.error}))}));if(result.outcome!=='passed')process.exitCode=1;
