import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {ASSETS} from '../shared/audio/catalog.mjs';

// Production renderer, adapters, native loaders and decoder. Remote permissions
// and result data are synthetic HTTP boundaries; no learner attempt is written.
const root=process.env.SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const out=process.env.TEST_REPLAY_EVIDENCE_DIR||path.join(root,'output/playwright/test-replay');
const base='https://tranhoangduc90.github.io/izone-ai-team-pages';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
let browser;const records=[],baseline=new Map();
before(async()=>{
  await fs.mkdir(out,{recursive:true});
  if(process.env.TEST_REPLAY_BASE_REVISION)for(const file of ['shared/audio/transport.mjs','term-tests/k67-shared/answer-explanations.js','term-tests/k67-shared/review-audio.js','term-tests/k67-shared/public-audio.js','term-tests/substitute-test-1-k67-computer-based/audio-loader.js'])
    baseline.set(file,execFileSync('git',['-C',root,'show',process.env.TEST_REPLAY_BASE_REVISION+':'+file]));
  browser=await chromium.launch({channel:'chrome',headless:true});
});
after(async()=>{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(records,null,2)+'\n');await browser?.close();});
const runs=text=>[[{text}]];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fixture(t,{slug='term-test-2',teacher=false,completed=true,grantDelay=0,mediaDelay=0,denied=false,nativeContext,textOnlySlug}={}){
  const asset=ASSETS[slug],relative=new URL(asset.url).pathname.replace('/izone-ai-team-pages/','');
  const bytes=await fs.readFile(path.join(root,relative));
  const ctx=nativeContext||await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();
  t.after(()=>nativeContext?page.close():ctx.close());page.setDefaultTimeout(12000);
  const errors=[],requests=[],unexpected=[];page.on('pageerror',e=>errors.push(e.message));
  let grants=0,transfers=0,workerAccess=0,deny=denied,delay=grantDelay,mediaWait=mediaDelay;
  const identity={testSlug:textOnlySlug||slug,classCode:'DEMO',studentRef:'fixture-student',attemptToken:'fixture-attempt'};
  const result=Object.fromEntries(['listening','reading'].map(skill=>[skill,{details:[1,2].map(number=>({number,studentAnswer:'A',correctAnswer:'A',result:'correct'}))}]));
  const clip=(id,option='A')=>({id,startMs:1000,endMs:1400,label:'Dẫn chứng '+option});
  const entries=skill=>Object.fromEntries([1,2].map(n=>[n,{number:n,section:0,type:skill+' - Multiple Choice',answers:['A'],
    prompt:runs('Câu hỏi giả'),evidence:runs('Dẫn chứng chính'),replay:skill==='Listening'?[clip('clip-'+n)]:undefined,
    blocks:[{analysis:runs('Giải thích minh họa'),evidence:runs('Dẫn chứng chính'),replay:skill==='Listening'?[clip('clip-'+n)]:[]},
      {analysis:runs('Loại phương án B'),evidence:runs('Dẫn chứng phụ'),replay:skill==='Listening'?[clip('wrong-'+n,'B')]:[]}]}]));
  const review={identity,result,content:{listening:{sections:[{label:'Part 1',title:'Audio kiểm thử',transcript:runs('Dẫn chứng chính. Dẫn chứng phụ.')} ]},
    reading:{sections:[{label:'Passage 1',title:'Bài đọc kiểm thử',passageHtml:'<p>Dẫn chứng chính. Dẫn chứng phụ.</p>'}]}},
    bundle:{testSlug:textOnlySlug||slug,skills:{listening:{entries:entries('Listening')},reading:{entries:entries('Reading')}}}};
  const scripts=['term-tests/k67-shared/review-audio.js','term-tests/k67-shared/answer-explanations.js',
    'term-tests/k67-shared/public-audio.js','term-tests/substitute-test-1-k67-computer-based/audio-loader.js','term-tests/substitute-shared/answer-explanation-adapter.js'];
  const tables=['Listening','Reading'].map(skill=>`<details class="detail-block" data-skill="${skill}" open><summary>${skill}</summary><table><thead><tr><th>Câu</th><th>Đáp án</th></tr></thead><tbody>${[1,2].map(n=>`<tr><td>${n}</td><td>A</td></tr>`).join('')}</tbody></table></details>`).join('');
  const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${base}/term-tests/k67-shared/answer-explanations.css"><style>body{font-family:Arial}table{border-collapse:collapse}td,th{padding:10px}button{padding:9px}</style></head><body><main id="result"><h1>Kết quả kiểm thử</h1><div id="details">${tables}</div></main><script>window.SUBSTITUTE_STATE={track:()=>()=>{}};document.addEventListener('click',e=>{if(e.target.closest('[data-k67-replay]'))window.__clickAt=performance.now();},true);document.addEventListener('playing',e=>{if(e.target.matches('audio[data-k67-review-audio]'))window.__latency=performance.now()-window.__clickAt;},true);</script>${scripts.map(s=>`<script src="${base}/${s}?fixture-replay=1"></script>`).join('')}</body></html>`;
  await ctx.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.hostname.endsWith('.workers.dev')){workerAccess++;return route.fulfill({status:503,body:'fixture source failure'});}
    if(u.pathname==='/fixture-api/explanations'||u.pathname==='/substitute-teacher-api/review/explanations'){
      grants++;requests.push({path:u.pathname,method:req.method()});
      const response=structuredClone({review}),status=deny?403:200;if(delay)await pause(delay);
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?response:{error:'Fixture access denied'})}).catch(()=>{});
    }
    if(u.origin!==new URL(base).origin){unexpected.push(req.url());return route.abort();}
    if(u.pathname.endsWith('/replay-fixture/'))return route.fulfill({contentType:'text/html',body:html});
    if(u.pathname===new URL(asset.url).pathname){
      if(!u.searchParams.has('probe'))transfers++;
      if(mediaWait&&!u.searchParams.has('probe'))await pause(mediaWait);
      const range=/bytes=(\d+)-(\d+)/.exec(req.headers().range||'');
      return route.fulfill({status:range?206:200,contentType:'audio/mpeg',headers:{'Access-Control-Allow-Origin':'*'},body:range?bytes.subarray(+range[1],+range[2]+1):bytes}).catch(()=>{});
    }
    const file=u.pathname.replace('/izone-ai-team-pages/','');
    assert.ok(!file.includes('..'));
    try{return await route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',body:baseline.get(file)||await fs.readFile(path.join(root,file))});}
    catch{unexpected.push(file);return route.abort();}
  });
  await page.goto(base+'/term-tests/replay-fixture/');await page.bringToFront();
  const durationMs=await page.evaluate(async source=>{
    const audio=new Audio();audio.preload='metadata';audio.src=source+'?probe=1';
    await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=reject;audio.load();});
    const duration=Math.round(audio.duration*1000);audio.removeAttribute('src');audio.load();return duration;
  },asset.url);
  if(!textOnlySlug)review.bundle.reviewAudio={asset:slug==='term-test-2'?path.basename(relative):'substitute-test-1-k67.mp3',sha256:asset.sha256,durationMs};
  else for(const entry of Object.values(review.bundle.skills.listening.entries)){delete entry.replay;entry.blocks.forEach(block=>delete block.replay);}
  const manifest={...asset,envelopeVersion:'MP3',assetVersion:'sha256-'+asset.sha256,encryptedByteLength:asset.byteLength,chunkSize:1048576,
    chunks:Array.from({length:Math.ceil(bytes.length/1048576)},(_,i)=>({byteLength:Math.min(1048576,bytes.length-i*1048576),sha256:''})),cloudflare:{version:1,policy:'public-mp3-v1'}};
  // Native manifest uses 1 MiB descriptors; compute their independent hashes.
  const {createHash}=await import('node:crypto');manifest.chunks.forEach((c,i)=>c.sha256=createHash('sha256').update(bytes.subarray(i*1048576,i*1048576+c.byteLength)).digest('hex'));
  async function attach(){
    await page.evaluate(({slug,teacher,completed,identity,result})=>{
      const container=document.querySelector('#details'),title='Kết quả kiểm thử';
      const request=async(_path,options={})=>{const response=await fetch('/fixture-api/explanations',options);if(!response.ok)throw Error('Fixture access denied');return response.json();};
      if(slug==='substitute-test-1-k67'){
        if(teacher)window.SUBSTITUTE_ANSWER_EXPLANATIONS.attachTeacher({container,identity,title,source:Object.fromEntries(['listening','reading'].map(skill=>[skill,{availability:'available',section:result[skill]}])),loadReview:()=>request()});
        else window.SUBSTITUTE_ANSWER_EXPLANATIONS.attachStudent({container,payload:{completed,result},identity,title});
      }else window.K67_ANSWER_EXPLANATIONS.attach({container,payload:{completed,result},attemptToken:teacher?undefined:identity.attemptToken,
        reviewKey:JSON.stringify(identity),testSlug:slug,title,request,loadReview:teacher?()=>request():undefined});
    },{slug:textOnlySlug||slug,teacher,completed,identity,result});
  }
  return{page,ctx,review,errors,unexpected,requests,attach,counts:()=>({grants,transfers,workerAccess}),set denied(v){deny=v;},set delay(v){delay=v;},set mediaDelay(v){mediaWait=v;},
    async seed(){await page.evaluate(async({slug,manifest})=>{
      if(slug==='term-test-2')await window.K67_PUBLIC_AUDIO.download(manifest);
      else await window.TERM_TEST_AUDIO_LOADER.downloadAudio(manifest.url);
    },{slug,manifest});},
    async ready(){await page.waitForFunction(()=>document.querySelector('audio[data-k67-review-audio]')?.readyState>=1);},
    async open(n=1,skill='Listening'){await page.getByRole('button',{name:`${skill} câu ${n}: Xem giải thích`,exact:true}).click();await page.locator('#explanation-dialog[open]').waitFor();},
    async play(selector='[data-k67-replay]'){
      await page.locator('#explanation-dialog '+selector).first().click();
      await page.waitForFunction(()=>{const a=document.querySelector('audio[data-k67-review-audio]');return a&&!a.paused&&a.currentTime>1.01;});
      return page.evaluate(()=>window.__latency);
    }};
}

for(const slug of ['term-test-2','substitute-test-1-k67'])for(const teacher of [false,true]){
  test(`${slug} ${teacher?'teacher':'student'} prepares at completed result and starts the first clip promptly`,async t=>{
    const f=await fixture(t,{slug,teacher});if(!teacher)await f.seed();const before=f.counts().transfers;
    await f.attach();await f.page.waitForTimeout(450);const beforeClick=f.counts().grants;
    if(beforeClick)await f.ready();
    const hasAudio=await f.page.locator('audio[data-k67-review-audio]').count();
    if(hasAudio)assert.equal(await f.page.locator('audio[data-k67-review-audio]').evaluate(a=>a.paused),true);
    await f.open();const first=await f.play();
    await f.page.waitForFunction(()=>document.querySelector('audio[data-k67-review-audio]').paused);
    assert.ok(await f.page.locator('audio[data-k67-review-audio]').evaluate(a=>a.currentTime>=1.4&&a.currentTime<1.65));
    const samples=[first];
    for(let i=0;i<9;i++){samples.push(await f.play());await f.page.locator('#explanation-dialog [data-k67-replay]').first().click();}
    await f.page.locator('#explanation-dialog .explanation-option-quote summary').click();
    await f.play('[data-k67-replay^="wrong-"]');await f.page.locator('#explanation-dialog [data-k67-replay^="wrong-"]').click();
    await f.page.locator('[data-explanation-next]').click();await f.play();await f.page.locator('[data-explanation-close]').click();
    assert.equal(await f.page.locator('audio[data-k67-review-audio]').evaluate(a=>a.paused),true);
    await f.attach();assert.equal(f.counts().grants,1,'Result re-render must not start another review request');
    await f.open(1,'Reading');assert.equal(await f.page.locator('#explanation-dialog [data-k67-replay]').count(),0);
    await f.page.locator('[data-explanation-close]').click();await f.open();
    await f.page.setViewportSize({width:390,height:844});await f.page.screenshot({path:path.join(out,slug+'-'+(teacher?'teacher':'student')+'.png'),fullPage:true});
    const sorted=[...samples].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];
    records.push({slug,teacher,beforeClick,first,p95,samples,counts:f.counts(),errors:f.errors});
    assert.equal(beforeClick,1,'Authorized review and audio preparation must begin before a replay click');
    if(!teacher)assert.equal(f.counts().transfers,before,'Review should reuse native audio without another media transfer');
    assert.ok(p95<300);assert.deepEqual(f.errors,[]);assert.deepEqual(f.unexpected,[]);
  });
}
for(const slug of ['term-test-2','substitute-test-1-k67'])test(`${slug} incomplete test does not request explanations or review audio`,async t=>{
  const f=await fixture(t,{slug,completed:false});await f.attach();await f.page.waitForTimeout(200);
  assert.equal(f.counts().grants,0);assert.equal(f.counts().transfers,0);
  assert.equal(await f.page.locator('.explanation-open').count(),0);
});
for(const textOnlySlug of ['term-test-1','mini-test-lesson-5'])test(`${textOnlySlug} text-only explanations remain lazy and never prepare audio`,async t=>{
  const f=await fixture(t,{textOnlySlug});await f.attach();await f.page.waitForTimeout(200);
  assert.equal(f.counts().grants,0);await f.open();assert.equal(f.counts().grants,1);
  assert.equal(f.counts().transfers,0);assert.equal(await f.page.locator('audio[data-k67-review-audio]').count(),0);
  assert.equal(await f.page.locator('#explanation-dialog [data-k67-replay]').count(),0);assert.deepEqual(f.errors,[]);
});
test('reset during a delayed grant prevents late audio and a later result can prepare again',async t=>{
  const f=await fixture(t,{grantDelay:450});await f.attach();await f.page.waitForTimeout(50);
  await f.page.evaluate(()=>window.K67_ANSWER_EXPLANATIONS.reset());await f.page.waitForTimeout(550);
  assert.equal(await f.page.locator('audio[data-k67-review-audio]').count(),0);
  f.delay=0;await f.attach();await f.ready();await f.open();await f.play();
  assert.equal(await f.page.locator('.detail-block').first().locator('thead th').count(),3);
  assert.equal(f.counts().grants,2);assert.deepEqual(f.errors,[]);
});
test('a denied early review leaves the result readable and can retry through the same permission API',async t=>{
  const f=await fixture(t,{denied:true});await f.attach();await f.page.waitForTimeout(200);
  assert.equal(f.counts().transfers,0);assert.equal(await f.page.getByRole('heading',{name:'Kết quả kiểm thử'}).count(),1);
  f.denied=false;await f.open();await f.play();assert.equal(f.counts().grants,2);assert.deepEqual(f.errors,[]);
});
test('clip changes while loading keep one download and never play the previous clip',async t=>{
  const f=await fixture(t,{mediaDelay:150});await f.attach();await f.open();
  await f.page.locator('#explanation-dialog [data-k67-replay]').first().click();await f.page.locator('[data-explanation-next]').click();
  await f.ready();assert.equal(await f.page.locator('audio[data-k67-review-audio]').evaluate(a=>a.paused),true);
  await f.play();assert.equal(f.counts().grants,1);assert.deepEqual(f.errors,[]);
});
test('explicit replay cancellation stops background preparation until another click',async t=>{
  const f=await fixture(t,{mediaDelay:150});await f.attach();await f.open();
  const button=f.page.locator('#explanation-dialog [data-k67-replay]').first();await button.click();await button.click();
  await f.page.waitForTimeout(300);assert.equal(await f.page.locator('audio[data-k67-review-audio]').getAttribute('src'),null);
  f.mediaDelay=0;await f.play();assert.equal(f.counts().grants,1);assert.deepEqual(f.errors,[]);
});
test('a mismatched audio hash never becomes playable',async t=>{
  const f=await fixture(t);f.review.bundle.reviewAudio.sha256='f'.repeat(64);
  await f.attach();await f.open();await f.page.locator('#explanation-dialog [data-k67-replay]').first().click();
  await f.page.waitForFunction(()=>[...document.querySelectorAll('.explanation-replay-status')].some(n=>n.textContent.includes('Không phát được')));
  assert.equal(await f.page.locator('audio[data-k67-review-audio]').getAttribute('src'),null);assert.deepEqual(f.errors,[]);
});
test('real background visibility stops the test replay without autoplay on return',{skip:!process.env.TEST_REPLAY_NATIVE_CDP_URL},async t=>{
  const native=await chromium.connectOverCDP(process.env.TEST_REPLAY_NATIVE_CDP_URL,{noDefaults:true});
  try{
    const f=await fixture(t,{nativeContext:native.contexts()[0]});await f.attach();await f.ready();await f.open();await f.play();
    const other=await f.ctx.newPage();await other.goto('about:blank');await other.bringToFront();
    await f.page.waitForFunction(()=>document.hidden===true,{},{timeout:4000});
    assert.equal(await f.page.locator('audio[data-k67-review-audio]').evaluate(a=>a.paused),true);
    await f.page.bringToFront();await f.page.waitForTimeout(100);
    assert.equal(await f.page.locator('audio[data-k67-review-audio]').evaluate(a=>a.paused),true);
  }finally{await native.close();}
});
