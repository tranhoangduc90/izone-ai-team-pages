import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.SUPPLEMENT_NOTICE_EVIDENCE_DIR||resolve(root,'output/playwright/supplement-notice');
await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const revision=process.env.SUPPLEMENT_NOTICE_REVISION||null,publicBase=process.env.SUPPLEMENT_NOTICE_PUBLIC_BASE||null;
assert.ok(!(revision&&publicBase));
const assets=['bo-tro/index.html','bo-tro/app.mjs','bo-tro/style.css','bo-tro/contract.mjs','shared/master170/pilot.css'],overrides=new Map();
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
await new Promise((ok,no)=>{server.once('error',no);server.listen(35683,'127.0.0.1',ok);});
const origin='http://127.0.0.1:35683',records=[],browser=await chromium.launch({channel:'chrome',headless:true});
const link=n=>'https://chatgpt.com/share/supplement-fixture-'+n;
try{
 for(const [width,height]of[[1440,1000],[390,844],[320,568]])for(const state of['invalid','unsupported','waiting','received','network','http503','negative-ack','limit11','dedupe10']){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(8000);const calls=[],errors=[],unexpected=[];let held;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const q=route.request(),u=new URL(q.url());
   if(u.origin===origin){if(overrides.has(u.pathname))return route.fulfill({body:overrides.get(u.pathname),contentType:u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.html')?'text/html; charset=utf-8':'text/javascript'});return route.continue();}
   if(u.hostname==='ducizone.ddns.net'&&u.pathname==='/webhook/0510dc1f-669b-4fa8-be7a-31d596f562a9'){
    assert.equal(q.method(),'POST');calls.push({path:u.pathname,method:q.method(),body:q.postDataJSON()});
    if(state==='waiting'){held=route;return;}
    if(state==='network')return route.abort('connectionfailed');
    if(state==='http503')return route.fulfill({status:503,json:{ok:false}});
    if(state==='negative-ack')return route.fulfill({json:{success:false,error:'fixture-only'}});
    return route.fulfill({json:{message:'Workflow was started'}});
   }
   unexpected.push({origin:u.origin,path:u.pathname,method:q.method()});return route.abort();
  });
  try{
   await page.goto(origin+'/bo-tro/?class='+(state==='unsupported'?'OTHER':'IC2314')+'#student='+encodeURIComponent('Học viên thử'));
   assert.equal(new URL(page.url()).hash,'');assert.equal(await page.locator('#student').inputValue(),'Học viên thử');
   let input=state==='invalid'?'https://chatgpt.com/c/private':state==='limit11'?Array.from({length:11},(_,i)=>link(i)).join('\n'):state==='dedupe10'?[...Array.from({length:10},(_,i)=>link(i)),link(0)].join('\n'):link(0);
   if(state!=='unsupported'){
    await page.locator('#links').fill(input);
    if(state==='dedupe10')assert.equal(await page.locator('#preview').innerText(),'10 link chia sẻ hợp lệ.');
    await page.locator('#send').click();
    const expected=state==='waiting'?'waiting':['received','dedupe10'].includes(state)?'received':['invalid','limit11'].includes(state)?'error':null;
    if(expected)await page.waitForFunction(x=>document.querySelector('#result').dataset.state===x,expected);
    else await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('Chưa xác nhận được bài đã nhận.'));
   }
   await page.evaluate(()=>document.fonts.ready);
   const ui=await page.evaluate(()=>{const e=document.querySelector('#result'),s=getComputedStyle(e);return{message:e.textContent,kind:e.dataset.state,bg:s.backgroundColor,fg:s.color,font:getComputedStyle(document.body).fontFamily,classCode:document.querySelector('#class').value,student:document.querySelector('#student').value,links:document.querySelector('#links').value,preview:document.querySelector('#preview').textContent,disabled:document.querySelector('#send').disabled,linksReadonly:document.querySelector('#links').readOnly,studentReadonly:document.querySelector('#student').readOnly,buttonText:document.querySelector('#send').textContent,fragment:location.hash};});
   const unknown=['network','http503','negative-ack'].includes(state);
   const expected=unknown?['attention','rgb(255, 244, 224)','rgb(138, 83, 0)']:state==='waiting'?['waiting','rgb(230, 238, 245)','rgb(23, 66, 101)']:['received','dedupe10'].includes(state)?['received','rgb(228, 245, 234)','rgb(22, 101, 52)']:['error','rgb(253, 232, 235)','rgb(155, 10, 34)'];
   const checks={role:ui.kind===expected[0]&&ui.bg===expected[1]&&ui.fg===expected[2],font:ui.font.includes('Source Sans 3')};
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(ui.disabled,['waiting','unsupported'].includes(state));
   assert.equal(ui.linksReadonly,state==='waiting');assert.equal(ui.studentReadonly,state==='waiting');
   if(['invalid','unsupported','limit11'].includes(state))assert.equal(calls.length,0);
   else{
    assert.equal(calls.length,1);const expectedLinks=state==='dedupe10'?Array.from({length:10},(_,i)=>link(i)):[link(0)];
    assert.deepEqual(calls[0].body,{records:expectedLinks.map(url=>({fields:{'Lớp':'IC2314','Học viên':'Học viên thử','Bài luyện tập':url}}))});
   }
   if(unknown){assert.equal(ui.links,input);assert.equal(ui.student,'Học viên thử');assert.match(ui.message,/kiểm tra bảng luyện tập hoặc báo giáo viên trước khi gửi lại/);}
   if(['received','dedupe10'].includes(state)){assert.equal(ui.links,'');assert.match(ui.message,/đã nhận yêu cầu gửi/);assert.match(ui.message,/Bác sĩ AI sẽ xử lý tiếp/);}
   await page.screenshot({path:out+'/'+state+'-'+width+'.png',fullPage:true});
   if(state==='waiting'){
    assert.equal(ui.links,input);await held.fulfill({json:{message:'Workflow was started'}});held=null;
    await page.waitForFunction(()=>document.querySelector('#result').dataset.state==='received');
    assert.equal(await page.locator('#links').inputValue(),'');assert.equal(await page.locator('#send').isDisabled(),false);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
   records.push({state,width,height,outcome:Object.values(checks).every(Boolean)?'passed':'failed',checks,ui,calls});
  }catch(error){records.push({state,width,height,outcome:'failed',error:error.stack,calls,errors,unexpected});}
  finally{if(held)await held.abort().catch(()=>{});await context.unrouteAll({behavior:'wait'});await context.close();}
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
const sources={};for(const path of [...assets,'shared/master170/theme.css'])sources[path]=createHash('sha256').update(overrides.get('/'+path)||await fs.readFile(resolve(root,path))).digest('hex');
const result={outcome:records.every(x=>x.outcome==='passed')?'passed':'failed',records,sourceHashes:sources,revision,publicBase,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),externalWrites:0,scope:'Actual supplement frontend and contract, mock webhook only. Public mode substitutes five HTML/JS/CSS assets; other assets local. No real learner, Docs, Lark, AI or webhook write.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(x=>x.outcome==='failed').length,errors:records.filter(x=>x.error).map(x=>({state:x.state,width:x.width,error:x.error}))}));if(result.outcome!=='passed')process.exitCode=1;
