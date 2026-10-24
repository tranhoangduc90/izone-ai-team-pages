import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.RECORDING_STATUS_EVIDENCE_DIR;assert(out,'Use an evidence directory outside the repository.');await fs.mkdir(out,{recursive:true});
const revision=process.env.RECORDING_STATUS_REVISION||null,publicBase=process.env.RECORDING_STATUS_PUBLIC_BASE||null;assert(!(revision&&publicBase));
const cache=new Map();
async function load(name){
 if(cache.has(name))return cache.get(name);let b;
 if(revision)b=execFileSync('git',['show',`${revision}:${name}`],{cwd:root,maxBuffer:3000000});
 else if(publicBase){const r=await fetch(new URL(name,publicBase));assert(r.ok);b=Buffer.from(await r.arrayBuffer());}
 else b=await fs.readFile(path.join(root,name));
 cache.set(name,b);return b;
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{const n=decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1);assert(n&&!n.includes('..'));const b=await load(n);res.writeHead(200,{'content-type':types[path.extname(n)]||'application/octet-stream'}).end(b);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(35691,'127.0.0.1',resolve));
const origin='http://127.0.0.1:35691',browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{for(const [width,height]of [[1440,1000],[320,568]])for(const scenario of ['loading','complete','partial','network-initial','network-cached','history-full','history-empty','history-initial']){
 const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),p=await ctx.newPage();p.setDefaultTimeout(8000);
 let fault=scenario==='network-initial',historyFault=false,release,hold=scenario==='loading';const gate=new Promise(resolve=>release=resolve),calls=[],errors=[];
 const rows=[{id:'fixture-record-A',kind:'recording',className:'IC9001',lessonNumber:5,source:'Zoom 13',account:'Zoom 13',title:'Bản ghi giả A',recordingFileId:'FILE-FAKE-A',recordingStart:'2026-10-23T11:00:00Z',recordingEnd:'2026-10-23T13:00:00Z',type:'MP4',videoId:'FAKE-VIDEO-A',youtubeStatus:'uploaded',reviewStatus:'pending',version:1}];
 const runs=[{runId:'FAKE-RUN',startedAt:'2026-10-23T03:00:00Z',finishedAt:'2026-10-23T03:05:00Z',status:'verified',deletedBytes:1024,results:[{recordId:'fixture-record-A',status:'verified',deletedBytes:1024,files:[]}]}];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),send=(json,status=200)=>route.fulfill({status,json});
   if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{id:{initialize(o){window.fixtureLogin=o.callback},renderButton(root){const b=document.createElement('button');b.textContent='Đăng nhập giả';b.onclick=()=>window.fixtureLogin({credential:'LOCAL_FIXTURE_ONLY'});root.append(b)},disableAutoSelect(){}}}};"});
   if(u.hostname==='ducizone.ddns.net'){
    const body=req.method()==='POST'?req.postDataJSON():null;
    calls.push({method:req.method(),path:u.pathname,query:u.search,action:body?.action||null,id:body?.id||null});
    if(body){
     if(body.idToken!=='LOCAL_FIXTURE_ONLY'){errors.push('Unexpected fixture identity');return send({ok:false},403);}
     if(body.action==='auth')return send({ok:true,actor:{verified:true,expiresAt:Date.now()+3600000}});
     if(body.action==='source_link')return send({status:'unknown'});
     if(body.action==='storage_history')return historyFault?send({ok:false,errorCode:'STORAGE_UNAVAILABLE'},503):send({ok:true,runs:scenario==='history-empty'?[]:runs});
     errors.push('Unexpected business mutation: '+body.action);return route.abort();
    }
    if(hold)await gate;
    if(fault)return route.abort();
    if(u.pathname.includes('recording_nightly_data'))return scenario==='partial'?send({ok:false},500):send({ok:true,snapshot:{date:'2026-10-23',scanStatus:'complete',accounts:[],records:[{id:'session:fixture-A',classSessionId:'fixture-session-A',kind:'session',className:'IC9001',lessonNumber:5,source:'Zoom 13',sessionStart:'2026-10-23T11:00:00Z'}]}});
    return send({ok:true,records:rows,yesterdayClasses:[],playlists:[],yesterdayDate:'2026-10-23',generatedAt:'2026-10-23T14:00:00Z'});
   }
   if(u.origin===origin)return route.continue();return route.abort();
  });
  await p.goto(origin+'/recordings/index.html',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Đăng nhập giả'}).waitFor();
  if(scenario==='loading')await p.locator('#liveLabel').filter({hasText:'Đang làm mới'}).waitFor();
  else if(scenario==='network-initial')await p.locator('#liveLabel').filter({hasText:'Mất kết nối'}).waitFor();
  else await p.locator('#totalCount').filter({hasText:'1'}).waitFor();
  if(scenario==='network-cached'){fault=true;await p.locator('#refreshButton').click();await p.locator('#liveLabel').filter({hasText:'Mất kết nối'}).waitFor();}
  if(scenario.startsWith('history-')){
   await p.getByRole('button',{name:'Đăng nhập giả'}).click();await p.locator('#recordingLogout').waitFor();await p.locator('#recordingStorage summary').first().click();
   if(scenario!=='history-initial'){await p.locator('#storageHistory').click();await p.waitForFunction(()=>!!document.querySelector('#storageRunResult').textContent.trim());}
   historyFault=true;await p.locator('#storageHistory').click();await p.locator('#storageStatus').filter({hasText:'Chưa kết nối được'}).waitFor();
  }
  await p.locator('#toast.show').waitFor({state:'hidden'});await p.evaluate(()=>document.fonts.ready);
  const ui=await p.evaluate(()=>{const live=document.querySelector('.live'),dot=live.querySelector('span');return{label:document.querySelector('#liveLabel').textContent,role:live.getAttribute('data-state'),bg:getComputedStyle(live).backgroundColor,fg:getComputedStyle(live).color,dot:getComputedStyle(dot).backgroundColor,count:document.querySelector('#yesterdayClassCount').textContent,message:document.querySelector('#reviewSections').textContent,historyMessage:document.querySelector('#storageStatus').textContent,history:document.querySelector('#storageRunResult').textContent};});
  const business=await p.evaluate(()=>({state:JSON.parse(JSON.stringify(state)),selected:[...selectedSessions],filters:['dateFilter','accountFilter','searchFilter'].map(id=>document.getElementById(id).value),authenticated:window.recordingAuth.isAuthenticated()}));
  const stale='bản tải trước';let copyOk=true;
  if(scenario==='loading')copyOk=ui.role==='pending'&&ui.bg==='rgb(230, 238, 245)'&&ui.dot==='rgb(23, 66, 101)';
  if(scenario==='complete')copyOk=ui.role==='success'&&ui.bg==='rgb(228, 245, 234)'&&ui.dot==='rgb(22, 101, 52)'&&ui.count==='1';
  if(scenario==='partial')copyOk=ui.role==='attention'&&ui.label==='Dữ liệu đối soát chưa đầy đủ'&&ui.bg==='rgb(255, 244, 224)'&&ui.count==='—';
  if(scenario.startsWith('network-'))copyOk=ui.role==='attention'&&ui.bg==='rgb(255, 244, 224)'&&ui.message.includes(stale)===(scenario==='network-cached');
  if(scenario.startsWith('history-'))copyOk=ui.historyMessage.includes(stale)===(scenario!=='history-initial');
  const target=p.locator(scenario.startsWith('history-')?'#storageStatus':scenario.startsWith('network-')?'#reviewSections':'.live');await target.scrollIntoViewIfNeeded();
  const geometry=await target.evaluate(e=>{const b=e.getBoundingClientRect(),h=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{top:b.top,bottom:b.bottom,height:innerHeight,uncovered:!!h&&(h===e||e.contains(h)),rootOverflow:document.documentElement.scrollWidth>innerWidth};});assert(geometry.top>=0&&geometry.bottom<=height&&geometry.uncovered&&!geometry.rootOverflow);
  await target.screenshot({path:path.join(out,`${scenario}-${width}.png`)});const beforeCalls=structuredClone(calls);
  if(scenario==='loading'){hold=false;release();await p.locator('#totalCount').filter({hasText:'1'}).waitFor();}
  if(scenario.startsWith('network-')){fault=false;await p.locator('#refreshButton').click();await p.locator('#reviewSections tbody tr').first().waitFor();}
  let recoveryUi=null;
  if(scenario.startsWith('history-')){
   await p.evaluate(()=>{window.fixtureHistoryRenderCount=0;new MutationObserver(()=>window.fixtureHistoryRenderCount++).observe(document.querySelector('#storageRunResult'),{childList:true,subtree:true});});
   historyFault=false;await p.locator('#storageHistory').click();await p.waitForFunction(()=>window.fixtureHistoryRenderCount>0);
   recoveryUi=await p.locator('#storageStatus').evaluate(e=>({message:e.textContent,error:e.classList.contains('storage-error')}));
   copyOk=copyOk&&!recoveryUi.error&&recoveryUi.message==='Đã tải lịch sử dọn file.';
   await p.locator('#storageStatus').scrollIntoViewIfNeeded();await p.locator('#storageStatus').screenshot({path:path.join(out,`${scenario}-${width}-recovered.png`)});
  }
  assert.deepEqual(errors,[]);records.push({scenario,width,height,passed:copyOk,copyOk,ui,business,recoveryUi,geometry,calls:beforeCalls,recoveryCalls:calls,errors});
 }catch(e){records.push({scenario,width,height,passed:false,error:e.message,calls,errors});}
 finally{hold=false;release();await ctx.close();}
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
const d={outcome:records.every(x=>x.passed)?'passed':'failed',records,revision,publicBase,sourceHashes:[...cache].map(([name,b])=>({name,sha256:crypto.createHash('sha256').update(b).digest('hex')})),testSha256:crypto.createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),externalWrites:0,scope:'Actual frontend; synthetic Google/API. Only auth and read-only source_link/storage_history fixture POST; no publication, approval, rename, cleanup or real external write.'};
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(d,null,2));console.log(JSON.stringify({outcome:d.outcome,cases:records.length,copyFailures:records.filter(x=>x.copyOk===false).length,errors:records.filter(x=>x.error)}));if(d.outcome!=='passed')process.exitCode=1;
