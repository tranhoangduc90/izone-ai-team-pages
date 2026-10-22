// Nhận script public đã ghim; chạy handler thật với DOM, media và API giả cục bộ.
// Không gọi máy chủ thật. Lỗi harness được ghi riêng, không tính là lỗi sản phẩm.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceRoot=process.env.TERM_SUBMIT_SOURCE_ROOT||root;
const pages=path.join(sourceRoot,'term-tests');
const evidence=process.env.TERM_SUBMIT_EVIDENCE||path.join(root,'output/playwright/term-mini-submit');
fs.mkdirSync(evidence,{recursive:true});
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const read=p=>fs.readFileSync(path.join(pages,p),'utf8');
function fn(source,name){const start=source.indexOf('  function '+name+'(')>=0?source.indexOf('  function '+name+'('):source.indexOf('  async function '+name+'(');if(start<0)throw Error('missing '+name);const next=source.slice(start+5).search(/\n  (?:async )?function \w+\(/);if(next<0)throw Error('missing end '+name);return source.slice(start,start+5+next);}
const routes=[['term-test-1','shared','term-test-2'],['term-test-2','shared','term-test-2'],['mini-test-lesson-5','shared','term-test-2'],['term-test-1-k56','k56-shared','term-test-1-k56'],['term-test-2-k56','k56-test2-shared','term-test-2-k56'],['mini-test-k56','k56-mini-shared','mini-test-k56']];
const server=createServer((q,s)=>{const pathname=new URL(q.url,'http://local').pathname;const p=path.resolve(sourceRoot,'.'+pathname);if(p.startsWith(sourceRoot+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()){s.setHeader('Content-Type',p.endsWith('.mjs')||p.endsWith('.js')?'text/javascript':'text/html');s.end(fs.readFileSync(p));}else s.end('<html><body></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try{for(const[slug,mod,enh]of routes){for(const scenario of ['cancel','http-error','empty-200','ok','double-pending','lost-reply','zero','full']){
 const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/term-tests/shared/harness');
  await page.setContent('<form id="listeningView"><div class="cbt-semantic-stage"><div id="questions"><input value="Fixture"></div><button id="submitListening" type="submit">Nộp</button></div></form><div id="toolbar"></div><select id="studentSelect"><option value="11111111-1111-4111-8111-111111111111">Giả</option></select><div id="identityView"></div><div id="identityTitle"></div>');
  await page.evaluate(({slug,scenario})=>{
   window.SLUG=slug;window.SCENARIO=scenario;window.audit={calls:0,pauseCalls:0,playCalls:0,notices:[],stages:[],savedEvents:0,progress:0};
   let paused=false;const audio=document.createElement('audio');audio.currentTime=10;Object.defineProperties(audio,{paused:{get:()=>paused},duration:{get:()=>1800},readyState:{get:()=>4},ended:{get:()=>false}});
   audio.pause=()=>{audit.pauseCalls++;if(!paused){paused=true;audio.dispatchEvent(new Event('pause'));}};audio.play=async()=>{paused=false;audit.playCalls++;audio.dispatchEvent(new Event('play'));};
   const initial={ok:true,audioRecoveryVersion:2,audioStateRevision:0,generation:0,listeningResumeAtSeconds:10,listeningDurationSeconds:1800,listeningDeadlineAt:new Date(Date.now()+1200000).toISOString(),listeningHardDeadlineAt:new Date(Date.now()+1800000).toISOString(),serverNow:new Date().toISOString(),audioProtocolVersion:1,examSessionToken:'22222222-2222-4222-8222-222222222222'};
   window.TERM_TEST_BOOTSTRAP={officialAudioElement:audio,examSessionToken:initial.examSessionToken,studentRef:'11111111-1111-4111-8111-111111111111',audioRecoveryInitial:initial,audioVolume:1};window.initial=initial;
   window.TERM_TEST_APP_CONFIG={API_BASE_URL:'https://mock.invalid'};
   window.confirm=()=>scenario!=='cancel';
   let stored=null;
   window.fetch=async(url,opt)=>{
    if(url.endsWith('/submission-status'))return new Response(JSON.stringify(stored||{ok:true,persisted:false}));
    if(url.endsWith('/listening')){audit.calls++;if(scenario==='double-pending')await new Promise(r=>setTimeout(r,150));if(scenario==='http-error')return new Response('{"message":"Fixture save error"}',{status:502});if(scenario==='empty-200')return new Response('',{status:200});
     const body=JSON.parse(opt.body),response={ok:true,attemptToken:'33333333-3333-4333-8333-333333333333',studentName:'Giả',completed:false};
     stored={ok:true,persisted:true,receipt:{version:1,testSlug:slug,section:'listening',generation:0,examSessionToken:body.examSessionToken,clientSubmissionId:body.clientSubmissionId,attemptToken:response.attemptToken,submittedAt:new Date().toISOString(),answers:body.answers},response};
     if(scenario==='lost-reply')throw new TypeError('Fixture lost response after commit');return new Response(JSON.stringify(response),{status:201});}
    if(url.endsWith('/audio-progress')){audit.progress++;return new Response(JSON.stringify({...initial,audioStateRevision:audit.progress,serverNow:new Date().toISOString()}));}
    if(url.endsWith('/audio-incident')||url.endsWith('/audio-resume'))return new Response('{"message":"Fixture network outage"}',{status:503});
    return new Response('{"ok":true}');
   };
  },{slug,scenario});
  const app=read(mod+'/app.js'),enhance=read(enh+'-computer-based/enhance.js');
  const start=app.indexOf("  elements.listeningView.addEventListener('submit', async event => {");const end=app.indexOf('\n  async function startOrResumeReading',start);
  if(start<0||end<0)throw Error('handler boundaries');
  await page.addScriptTag({content:read(slug.endsWith('k56')?'k56-audio-recovery.js':'k67-shared/listening-controller.js')});
  const env=`
  const slug=window.SLUG,appConfig=window.TERM_TEST_APP_CONFIG,query=new URLSearchParams('class=FIXTURE'),classCode='FIXTURE',storageScope='';
  const testConfig={slug,listening:{controls:Array.from({length:slug==='mini-test-k56'?10:slug==='mini-test-lesson-5'?20:40},(_,i)=>({number:i+1}))},reading:{controls:[]}};
  const contentConfig={audio:{label:'Audio giả',durationLabel:'30:00'}};
  const uiState={audio:{volume:1,started:true,time:10}};
  const submissionStorageKey='fixture';const availableStorages=()=>[sessionStorage,localStorage];
  const elements={listeningView:document.getElementById('listeningView'),listeningQuestions:document.getElementById('questions'),submitListening:document.getElementById('submitListening'),studentSelect:document.getElementById('studentSelect')};
  const state={studentRef:'11111111-1111-4111-8111-111111111111',examSessionToken:window.initial.examSessionToken,clientSubmissionId:'44444444-4444-4444-8444-444444444444',clientSubmissionStudentRef:'11111111-1111-4111-8111-111111111111',frozenAnswers:{listening:null},drafts:{listening:{}},draftRevisions:{listening:0},draftAckRevisions:{listening:0}};
  window.auditState=state;const demoMode='',serverGradingMode=false,miniAnswerSheet=false,miniConfirmed=false,miniEpoch=0,miniPrefix='',miniGeneration=0,storageKey='fixture',paperMini=false,paperEpoch=0,paperBusy=0,paperChange=null,writingConfig=null,deferResultsUntilComplete=false,listeningOnly=false;
  const answers=Object.fromEntries(Array.from({length:window.SCENARIO==='zero'?0:window.SCENARIO==='full'?testConfig.listening.controls.length:testConfig.listening.controls.length-1},(_,i)=>[i+1,'Fixture']));
  const collectAnswers=()=>answers,updateAnswerCount=()=>Object.keys(answers).length,countAnswered=x=>Object.values(x).filter(Boolean).length;
  const saveSession=()=>{},saveUiState=()=>{},stopSectionDraftFlow=()=>{},scheduleSectionDraft=()=>{},setAnswerControlsLocked=()=>{},sendClientEvent=()=>{},applySectionDraft=()=>{},setSectionSaveStatus=()=>{},stopSectionDeadlineGuard=()=>{},startSectionDeadlineGuard=()=>{},isSectionExpired=()=>false,portalNotice=()=>'',setStage=x=>audit.stages.push(x),showNotice=x=>audit.notices.push(x);
  elements.listeningView.addEventListener('term-test:listening-submitted',()=>{audit.savedEvents++;window.K67_ACTIVE_LISTENING?.stop();});
  ${fn(app,'apiRequest')}
  ${app.includes('  async function rawApiRequest(')?fn(app,'rawApiRequest'):''}
  ${fn(app,'confirmIncomplete')}
  ${fn(app,'setBusy')}
  ${app.slice(start,end)}
  ${fn(enhance,'makeButton')}
  ${fn(enhance,'formatTime')}
  ${fn(enhance,'setupBufferedAudio')}
  if(!slug.endsWith('k56')){window.K67_ACTIVE_LISTENING=window.K67_LISTENING_PROTECTION({audio:window.TERM_TEST_BOOTSTRAP.officialAudioElement,session:window.initial,slug,apiBase:appConfig.API_BASE_URL});window.K67_ACTIVE_LISTENING.arm();}
  setupBufferedAudio({form:elements.listeningView,source:{toolbar:document.getElementById('toolbar')}});
  `;
  await page.addScriptTag({content:'(()=>{'+env+'})();'});
  if(errors.length)throw Error(errors.join('|'));
  await page.evaluate(()=>{document.getElementById('listeningView').requestSubmit();if(SCENARIO==='double-pending')document.getElementById('listeningView').dispatchEvent(new SubmitEvent('submit',{cancelable:true}));});
  await page.waitForTimeout(scenario==='double-pending'?250:100);
  const observed=await page.evaluate(()=>({...audit,paused:TERM_TEST_BOOTSTRAP.officialAudioElement.paused,held:window.K67_ACTIVE_LISTENING?.isHeld()||false,submitted:Boolean(auditState.listeningSubmitted),attemptToken:auditState.attemptToken||null,phase:window.K56_LISTENING_AUDIO?.inspect()?.phase||null}));
  const expectedFailed=['cancel','http-error','empty-200'].includes(scenario);
  const passed=expectedFailed?!observed.submitted&&!observed.paused&&(scenario!=='cancel'||observed.calls===0):observed.submitted&&Boolean(observed.attemptToken)&&observed.calls===1;
  results.push({slug,scenario,outcome:passed?'passed':'failed',...observed});console.log(JSON.stringify(results.at(-1)));
 }catch(e){results.push({slug,scenario,outcome:'harness_error',message:e.message,errors});console.log(JSON.stringify(results.at(-1)));}finally{await context.close();}
}}}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(results,null,2),'utf8');}
if(results.some(r=>r.outcome!=='passed'))process.exitCode=1;
