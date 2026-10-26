import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {serveDirectory} from './fixtures/static-ui-server.mjs';

// Real app, decoder and public-audio loader. Only the remote API/media boundary
// is a fixture; every external request is blocked and all answers are synthetic.
const root=process.env.LISTENING_SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url));
const out=process.env.LISTENING_REVIEW_EVIDENCE_DIR||path.join(root,'output/playwright/listening-review');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
let browser,site;const records=[];
const baseline=new Map();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const paragraph=text=>({runs:[{text}]});
before(async()=>{
  if(process.env.LISTENING_BASE_REVISION)for(const file of ['index.html','teacher.html','app.js','audio-delivery.mjs','explanation-review.js','review-audio.js']){
    baseline.set('/listening-practice/'+file,execFileSync('git',['-C',root,'show',process.env.LISTENING_BASE_REVISION+':listening-practice/'+file]));
  }
  await fs.mkdir(out,{recursive:true});site=await serveDirectory(root);browser=await chromium.launch({channel:'chrome',headless:true});
});
after(async()=>{await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify(records,null,2));await browser?.close();await site?.close();});

async function fixture(t,{lessonNumber=8,teacher=false,delay=0,denied=false,submitted=true,nativeContext}={}){
  const file=lessonNumber===8?'science-experiment-0454a5b56ce8e764.mp3':'inclusive-design-b0220f6be93db9e2.mp3';
  const bytes=await fs.readFile(path.join(root,'listening-practice/audio-assets',file)),sha256=hash(bytes);
  const code=lessonNumber===8?'67-practice-listening_mcq_flowchart':'67-practice-listening_c20_t3_p4_inclusive_design';
  const ids=Array.from({length:10},(_,i)=>i+(lessonNumber===8?21:31));
  const lesson=lessonNumber===10?{authored:true,code,lesson:10,title:'Inclusive design',book:20,test:3,part:4,
    questionIds:ids.map(String),audioMs:486322,reviewMs:120000,totalMs:606322,
    groups:[{id:'notes',kind:'completion',label:'Note Completion',start:31,end:40,instruction:'ONE WORD ONLY'}]}:undefined;
  const manifest={envelopeVersion:'MP3',assetVersion:'sha256-'+sha256,sha256,byteLength:bytes.length,
    encryptedByteLength:bytes.length,chunkSize:1048576,
    url:`https://tranhoangduc90.github.io/izone-ai-team-pages/listening-practice/audio-assets/${file}`,
    chunks:Array.from({length:Math.ceil(bytes.length/1048576)},(_,i)=>{const part=bytes.subarray(i*1048576,(i+1)*1048576);return{byteLength:part.length,sha256:hash(part)};})};
  const attempt={id:'fixture-attempt',submissionId:'fixture-submission',no:1,status:submitted?'submitted':'paused',finalScore:10,
    startedAt:'2026-10-26T00:00:00Z',completedAt:'2026-10-26T00:10:00Z',method:'manual',remainingMs:0,
    flags:[],annotations:[],highlighted:[],scroll:{passage:0,questions:{}},phase:'listening',audioPosition:0,sequence:0,
    answers:Object.fromEntries(ids.map(n=>[n,'A'])),notes:'',result:{rows:ids.map(number=>({number,state:'correct'}))}};
  const identity={bindingId:'fixture-binding',studentRef:'fixture-student',classCode:'DEMO',name:'Học viên kiểm thử',entryMode:'shared'};
  const key=Object.fromEntries(ids.map(n=>[n,['A']]));
  const entries=Object.fromEntries(ids.map(n=>[n,{number:n,kind:lessonNumber===8?(n<=25?'mcq':'flowchart'):'completion',
    answer:['A'],prompt:paragraph('Câu hỏi minh họa'),reason:[paragraph('Giải thích minh họa')],evidence:[paragraph('Dẫn chứng giả')],
    options:lessonNumber===8&&n<=25?['A','B','C'].map(letter=>({letter,correct:letter==='A',label:paragraph('Lựa chọn '+letter),
      reason:[paragraph('Lý do minh họa')],evidence:[paragraph('Dẫn chứng giả')]})):undefined}]));
  const segment=(n,id)=>({id,question:n,startMs:1000,endMs:1400,wordStart:0,wordEnd:1,marks:{},paragraphs:[paragraph('Dẫn chứng minh họa')],option:'A'});
  const questions=Object.fromEntries(ids.map(n=>[n,{replay:[segment(n,'clip-'+n)],optionReplay:lessonNumber===8&&n<=25?{B:[{...segment(n,'wrong-'+n),option:'B'}]}:{}}]));
  const review={audioSha256:sha256,audioDurationMs:lessonNumber===8?459207:486322,contentVersion:'fixture-v1',
    words:[{word:'Transcript minh họa',start:1,end:1.4}],segments:[{id:'s1',start:1,wordStart:0,wordEnd:1}],questions};
  const state={identity,attempts:[attempt],events:[{type:'completed',attempt:1,docs:'verified'}],firstCompleted:1,lesson};
  const result={...state,attempt,contentVersion:'fixture-v1',key,review,
    reviewAudioUrl:(teacher?'teacher/':'')+'review-audio/'+(teacher?attempt.submissionId:attempt.id),
    definition:{authored:lessonNumber===10,audio:{sha256},lesson,
      mcq:ids.filter(n=>n<=25).map(n=>({n,text:'Câu hỏi giả',options:['Một','Hai','Ba']})),bank:[['A','Lựa chọn A']],flow:[],
      groups:lesson?.groups.map(g=>({...g,questions:ids.map(n=>({n,text:'Câu hỏi giả'}))}))},explanations:{entries}};
  const ctx=nativeContext||await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();
  t.after(()=>nativeContext?page.close():ctx.close());page.setDefaultTimeout(10000);const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  let grants=0,transfers=0,status=denied?403:200,grantDelay=delay,revoked=false;
  await ctx.addInitScript(({code})=>{
    history.replaceState({izoneCourseStudentIdentityV1:{product:'listening-practice',entry:'lesson:'+code,studentRef:'fixture-student'}},'');
    sessionStorage.setItem('listening-practice67-session:lesson:'+code,'fixture-token');
    document.addEventListener('click',event=>{if(event.target.closest('[data-replay]'))window.__replayClick=performance.now();},true);
  },{code});
  await ctx.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.origin===site.origin&&u.pathname.startsWith('/api/')){
      requests.push({path:u.pathname,method:req.method()});
      if(revoked&&u.pathname.includes('/result/'))return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'TEACHER_LOGIN_REQUIRED',message:'Fixture logout'}})});
      if(u.pathname.includes('/review-audio/')||u.pathname.startsWith('/api/audio/')){
        grants++;const grantStatus=status;if(grantDelay)await new Promise(r=>setTimeout(r,grantDelay));
        return route.fulfill({status:grantStatus,contentType:'application/json',body:JSON.stringify(grantStatus===200?{audioManifest:manifest}:{error:{code:'ACCESS_DENIED',message:'Fixture denied'}})}).catch(()=>{});
      }
      const value=u.pathname.includes('/result/')?result:u.pathname==='/api/state'?state:
        u.pathname==='/api/config'?{googleClientId:''}:u.pathname==='/api/teacher/logout'?{ok:true}:u.pathname.endsWith('/classes/1')?{students:[]}:
        u.pathname.startsWith('/api/library/')?{lesson,classes:[{id:'1',classCode:'DEMO'}]}:null;
      if(value)return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
      throw Error('Unexpected API request: '+req.method()+' '+u.pathname);
    }
    if(req.url()===manifest.url){
      transfers++;const range=/bytes=(\d+)-(\d+)/.exec(req.headers().range||'');
      assert.ok(range);return route.fulfill({status:206,contentType:'audio/mpeg',headers:{'Access-Control-Allow-Origin':'*'},body:bytes.subarray(+range[1],+range[2]+1)});
    }
    if(u.origin!==site.origin)return route.abort();
    if(baseline.has(u.pathname))return route.fulfill({contentType:u.pathname.endsWith('.html')?'text/html':'text/javascript',body:baseline.get(u.pathname)});
    return route.continue();
  });
  await page.goto(site.origin+`/listening-practice/${teacher?'teacher.html':''}?lesson=${code}${teacher?'#submission=fixture-submission':''}`);
  await page.bringToFront();
  if(!teacher)await page.locator(submitted?'[data-action="show-result"]':'.resume-card').waitFor().catch(async error=>{
    throw new Error(error.message+'; page errors: '+JSON.stringify(errors)+'; screen: '+(await page.locator('#app').innerText()).slice(0,700));
  });
  return {page,ctx,result,errors,requests,
    counts:()=>({grants,transfers}),set denied(v){status=v?403:200;},set delay(v){grantDelay=v;},set revoked(v){revoked=v;},
    async enter(){if(!teacher)await page.locator('[data-action="show-result"]').click();await page.locator('.score-box strong, .teacher-banner').first().waitFor();},
    async ready(){await page.waitForFunction(()=>{const a=document.querySelector('#review-audio');return a.readyState>=1&&!!a.getAttribute('src');});},
    async open(n=ids[0]){await page.locator(`[data-action="explanation-toggle"][data-question="${n}"]`).click();await page.locator('#explanation-dialog[open]').waitFor();},
    async play(selector='[data-replay]'){
      await page.evaluate(()=>{const a=document.querySelector('#review-audio');a.addEventListener('playing',()=>{window.__replayLatency=performance.now()-window.__replayClick;},{once:true});});
      await page.locator(selector).first().click();
      await page.waitForFunction(()=>window.ListeningReview.debug().player?.state==='playing');
      await page.waitForFunction(()=>document.querySelector('#review-audio').currentTime>1.01);
      return page.evaluate(()=>window.__replayLatency);
    }};
}

for(const lessonNumber of [8,10])for(const teacher of [false,true]){
  test(`lesson ${lessonNumber} ${teacher?'teacher':'student'} prepares before first click; real decoder, clips and latency`,async t=>{
    const f=await fixture(t,{lessonNumber,teacher});
    if(!teacher){
      assert.deepEqual(f.counts(),{grants:0,transfers:0},'Opening prep must not load review audio');
      // Seed the real playback adapter as if the exam file was already loaded.
      await f.page.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(x=>x.name.includes('/audio-delivery.mjs')).name;
        const m=await import(url);await m.fetchListeningAudio('/api/audio/fixture-attempt');});
    }
    const transfersBefore=f.counts().transfers;
    await f.enter();
    await f.page.waitForTimeout(500);
    const beforeClick=f.counts().grants;
    // On the old source the first click still works: record that latency before
    // the independent assertion proves preparation was deferred until click.
    if(beforeClick>(teacher?0:1))await f.ready();
    assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused),true);
    await f.open();const first=await f.play();
    await f.page.waitForFunction(()=>document.querySelector('#review-audio').paused);
    const stopped=await f.page.locator('#review-audio').evaluate(a=>a.currentTime);
    assert.ok(stopped>=1.4&&stopped<1.65,'Segment must stop at its original end');
    const latencies=[first];
    for(let i=0;i<19;i++){latencies.push(await f.play());await f.page.locator('[data-replay]').first().click();}
    if(lessonNumber===8){
      const details=f.page.locator('#explanation-dialog .explanation-option-evidence summary');
      if(await details.count())await details.first().click();
      await f.play('[data-replay^="wrong-"]');await f.page.locator('[data-replay^="wrong-"]').first().click();
    }
    await f.page.locator('[data-review-next]').click();await f.play();
    await f.page.locator('[data-review-close]').click();
    assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused),true);
    await f.open();assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused),true);
    await f.page.setViewportSize({width:390,height:844});
    await f.page.screenshot({path:path.join(out,`lesson-${lessonNumber}-${teacher?'teacher':'student'}.png`),fullPage:true});
    const sorted=[...latencies].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];
    records.push({lessonNumber,teacher,beforeClick,first,p95,latencies,counts:f.counts(),errors:f.errors});
    assert.equal(beforeClick,teacher?1:2,'Review API grant must happen before the first replay click');
    if(!teacher)assert.equal(f.counts().transfers,transfersBefore,'Same-tab review must not redownload the exam file');
    assert.equal(f.counts().grants,teacher?1:2,'All question changes share one authorized preparation');
    assert.ok(p95<300,`Prepared playback p95 ${p95} ms exceeds 300 ms`);
    assert.deepEqual(f.errors,[]);
    assert.ok(f.requests.every(r=>r.method==='GET'),'Viewing results must not mutate attempts');
  });
}
test('click during background load joins it; changing question discards the old play intent',async t=>{
  const f=await fixture(t,{delay:450});await f.enter();await f.open();
  await f.page.locator('[data-replay]').first().click();
  await f.page.locator('[data-review-next]').click();await f.ready();
  assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused),true);
  await f.play();assert.equal(f.counts().grants,1);assert.deepEqual(f.errors,[]);
});
test('cancel pending replay stops preparation; a later explicit click can retry',async t=>{
  const f=await fixture(t,{delay:450});await f.enter();await f.open();
  const button=f.page.locator('[data-replay]').first();await button.click();await button.click();
  await f.page.waitForTimeout(600);
  assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused&&!a.getAttribute('src')),true);
  assert.equal(f.counts().grants,1);f.delay=0;await f.play();assert.equal(f.counts().grants,2);
});
test('revoked grant never attaches cached media; the result and transcript remain readable',async t=>{
  const f=await fixture(t,{denied:true});await f.enter();await f.open();
  await f.page.locator('[data-replay]').first().click();
  await f.page.locator('.replay-status.is-error').first().waitFor();
  assert.equal(f.counts().transfers,0);
  assert.equal(await f.page.locator('#review-audio').getAttribute('src'),null);
  assert.match(await f.page.locator('#explanation-dialog').innerText(),/Transcript minh họa/);
  f.denied=false;await f.play();assert.deepEqual(f.errors,[]);
});
test('changing learner while a grant is pending discards late media and stays on login',async t=>{
  const f=await fixture(t,{delay:450});await f.enter();
  await f.page.locator('[data-action="change-student"]').first().click();
  await f.page.waitForTimeout(650);
  assert.equal(await f.page.locator('#review-audio').getAttribute('src'),null);
  assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused),true);
  assert.match(f.page.url(),/#login$/);assert.deepEqual(f.errors,[]);
});
for(const logoutKey of ['listening-teacher-logout','izone:teacher-sso-logout'])test(`teacher logout ${logoutKey} cancels pending preparation without attaching late audio`,async t=>{
  const f=await fixture(t,{teacher:true,delay:450});await f.enter();
  f.revoked=true;
  await f.page.evaluate(key=>window.dispatchEvent(new StorageEvent('storage',{key,newValue:'fixture-logout'})),logoutKey);
  await f.page.waitForTimeout(650);
  assert.equal(await f.page.locator('#review-audio').getAttribute('src'),null);
  assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused),true);
});
test('unsubmitted learner history never prepares or exposes review audio',async t=>{
  const f=await fixture(t,{submitted:false});
  await f.page.evaluate(()=>{location.hash='#result?attempt=1';});
  await f.page.getByRole('heading',{name:'Lịch sử làm bài'}).waitFor();
  await f.page.waitForTimeout(250);assert.deepEqual(f.counts(),{grants:0,transfers:0});
  assert.equal(await f.page.locator('.explanation-button').count(),0);assert.deepEqual(f.errors,[]);
});
test('a real background tab stops replay and does not autoplay on return',{skip:!process.env.LISTENING_NATIVE_CDP_URL},async t=>{
  // Playwright's normal contexts force focus emulation. A separate Chrome
  // profile and noDefaults on its default context preserve native visibility.
  let native;
  try{
    native=await chromium.connectOverCDP(process.env.LISTENING_NATIVE_CDP_URL,{noDefaults:true});
    const f=await fixture(t,{nativeContext:native.contexts()[0]});await f.enter();await f.ready();await f.open();await f.play();
    const other=await f.ctx.newPage();await other.goto('about:blank');await other.bringToFront();
    await f.page.waitForFunction(()=>document.hidden===true,{},{timeout:4000});
    assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused),true);
    await f.page.bringToFront();await f.page.waitForTimeout(100);
    assert.equal(await f.page.locator('#review-audio').evaluate(a=>a.paused),true);
  }finally{await native?.close();}
});
