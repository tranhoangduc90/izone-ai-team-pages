import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.GRADERS_RECOVERY_EVIDENCE_DIR;
assert(out,'Set GRADERS_RECOVERY_EVIDENCE_DIR outside the repository.');
await fs.mkdir(out,{recursive:true});
const revision=process.env.GRADERS_RECOVERY_REVISION||null,publicBase=process.env.GRADERS_RECOVERY_PUBLIC_BASE||null;
assert(!(revision&&publicBase));
const cache=new Map();
async function load(name){
 if(cache.has(name))return cache.get(name);
 let bytes;
 if(revision)bytes=execFileSync('git',['show',`${revision}:${name}`],{cwd:root,maxBuffer:3000000});
 else if(publicBase){const response=await fetch(new URL(name,publicBase));assert(response.ok,`${name}: HTTP${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}
 else bytes=await fs.readFile(path.join(root,name));
 cache.set(name,bytes);return bytes;
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try{const name=decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1);assert(name&&!name.includes('..'));const bytes=await load(name);res.writeHead(200,{'content-type':types[path.extname(name)]||'application/octet-stream'}).end(bytes);}
 catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(35687,'127.0.0.1',resolve));
const origin='http://127.0.0.1:35687',browser=await chromium.launch({channel:'chrome',headless:true});
const files=['check-now.html','check-now-56.html','vocab.html','vocab-03.html','vocab-04.html','vocab-06.html','vocab-11.html'];
const records=[];
try{
 for(const file of files)for(const [width,height]of [[1440,1000],[320,568]])for(const mode of ['start-network','start-403','status-network','status-503']){
  const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(8000);
  const posts=[],gets=[],errors=[];let recovering=false;
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await ctx.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.origin===origin){
     if(u.pathname.endsWith('-config.js')){
      const body=(await load(u.pathname.slice(1))).toString().replace(/(pollEveryMs|timeoutMs|softTimeoutMs|hardTimeoutMs):\s*\d+/g,(_,key)=>`${key}: ${key==='pollEveryMs'?40:key==='hardTimeoutMs'?1000:600}`);
      return route.fulfill({contentType:'text/javascript',body});
     }
     return route.continue();
    }
    assert.equal(u.hostname,'ducizone.ddns.net');assert(u.pathname.startsWith('/webhook/'));
    if(req.method()==='POST'){
     posts.push(req.postDataJSON());
     if(!recovering&&mode==='start-network')return route.abort();
     if(!recovering&&mode==='start-403')return route.fulfill({status:403,json:{message:'Bạn chưa có quyền đọc tài liệu thử.',retryable:false}});
     return route.fulfill({status:202,json:{job_id:'fixture-recovery-copy',stage:'reading'}});
    }
    assert.equal(req.method(),'GET');gets.push(u.searchParams.get('jobId'));
    if(!recovering&&mode==='status-network')return route.abort();
    if(!recovering&&mode==='status-503')return route.fulfill({status:503,json:{message:'Chưa đọc được tiến độ thử.',retryable:true}});
    return route.fulfill({json:{status:'done',stage:'done'}});
   });
   const doc='fixture_document_123456789012345';
   const query=file==='check-now.html'?'&assignmentCode=67-reading-02':file==='check-now-56.html'?'&assignmentCode=56-reading-02':['vocab.html','vocab-03.html'].includes(file)?'&homework=3':'';
   await page.goto(`${origin}/${file}?documentId=${doc}${query}`);
   const waiting=file==='check-now.html'&&mode.startsWith('status-');
   if(waiting)await page.waitForFunction(()=>document.querySelector('#retry-button').textContent==='Xem lại tiến độ'&&!document.querySelector('#retry-button').hidden);
   else await page.locator('#error-box').waitFor({state:'visible'});
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(posts.length,1,'Must not retry a grading POST automatically');
   assert(gets.every(x=>x==='fixture-recovery-copy'));
   const state=await page.evaluate(()=>({title:document.querySelector('#page-title').textContent,lead:document.querySelector('#lead').textContent,error:document.querySelector('#error-message').textContent,errorHidden:document.querySelector('#error-box').hidden,retryHidden:document.querySelector('#retry-button').hidden,retryText:document.querySelector('#retry-button').textContent,back:document.querySelector('#back-link').getAttribute('href'),steps:[...document.querySelectorAll('.step')].map(x=>({stage:x.dataset.stage,state:x.className})),progress:document.querySelector('#progress-fill').style.width,resultHidden:document.querySelector('#result').hidden}));
   assert.equal(state.resultHidden,true);assert.equal(state.back,`https://docs.google.com/document/d/${doc}/edit`);
   const localized=mode==='start-network'||mode==='status-network'&&!file.startsWith('check-now');
   const expected='Chưa kết nối được với hệ thống chấm bài. Hãy kiểm tra mạng rồi thử lại.';
   const copyOk=!localized||state.error===expected;
   if(mode==='start-403')assert.equal(state.error,'Bạn chưa có quyền đọc tài liệu thử.');
   if(mode==='status-503'&&!file.startsWith('check-now'))assert.equal(state.error,'Chưa đọc được tiến độ thử.');
   const notice=page.locator(waiting?'#lead':'#error-box');await notice.scrollIntoViewIfNeeded();
   const geometry=await notice.evaluate(e=>{const b=e.getBoundingClientRect(),h=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{top:b.top,bottom:b.bottom,height:innerHeight,uncovered:!!h&&(h===e||e.contains(h)),overflow:document.documentElement.scrollWidth>innerWidth};});
   assert(geometry.top>=0&&geometry.bottom<=height&&geometry.uncovered&&!geometry.overflow);
   const slug=`${file}-${mode}-${width}`;
   await notice.screenshot({path:path.join(out,slug+'-notice.png')});
   const beforeRetry=posts.map(x=>({...x,...(x.requestId?{requestId:'UUID_PRESENT'}:{})}));
   let retry;
   if(!state.retryHidden){
    recovering=true;await page.locator('#retry-button').focus();await page.keyboard.press('Enter');await page.locator('#result').waitFor({state:'visible'});
    const expectedPosts=waiting?1:2;assert.equal(posts.length,expectedPosts);
    if(expectedPosts===2){const normalize=x=>({...x,...(x.requestId?{requestId:'UUID_PRESENT'}:{})});assert.deepEqual(normalize(posts[0]),normalize(posts[1]));if(posts[0].requestId)assert.equal(posts[0].requestId,posts[1].requestId);}
    retry={posts:posts.length,done:await page.locator('#result').innerText()};
   }
   assert.deepEqual(errors,[]);
   records.push({file,mode,width,height,passed:copyOk,copyOk,localized,state,geometry,posts:beforeRetry,jobIds:[...new Set(gets)],retry,errors});
  }catch(e){records.push({file,mode,width,height,passed:false,error:e.message});}
  finally{await ctx.close();}
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
const sourceHashes=[...cache].map(([name,bytes])=>({name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
const result={outcome:records.every(x=>x.passed)?'passed':'failed',records,sourceHashes,revision,publicBase,testSha256:crypto.createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),externalWrites:0,scope:'Real seven frontends, synthetic API only; original retry policy retained, fixture config timeouts shortened. Public mode downloads static assets only, no actual grading/Docs/AI call.'};
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({outcome:result.outcome,cases:records.length,copyFailures:records.filter(x=>x.copyOk===false).length,errors:records.filter(x=>x.error)}));if(result.outcome!=='passed')process.exitCode=1;
