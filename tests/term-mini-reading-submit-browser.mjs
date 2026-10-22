// DOM và API giả trên localhost; chạy nguyên handler Reading cùng adapter của bốn app.
// Kiểm hai thứ tự, lỗi/nhận bài trống/mất phản hồi và bấm lặp; không gọi production.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modules=process.env.CODEX_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(path.join(modules,'playwright/package.json')))('playwright');
const output=process.env.TERM_READING_EVIDENCE||path.join(root,'output/playwright/term-mini-reading-submit');
fs.mkdirSync(output,{recursive:true});
const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
function fn(source,name){const start=source.indexOf('  function '+name+'(')>=0?source.indexOf('  function '+name+'('):source.indexOf('  async function '+name+'(');if(start<0)throw Error('missing '+name);const next=source.slice(start+5).search(/\n  (?:async )?function \w+\(/);if(next<0)throw Error('missing end '+name);return source.slice(start,start+5+next);}
const routes=[['term-test-1','shared'],['term-test-2','shared'],['mini-test-lesson-5','shared'],['term-test-1-k56','k56-shared'],['term-test-2-k56','k56-test2-shared'],['mini-test-k56','k56-mini-shared']];
try{for(const [slug,mod]of routes)for(const mode of ['lis_first','read_first'])for(const scenario of ['cancel','http-error','empty-200','ok','double-pending','lost-reply','zero','full']){
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/term-tests/shared/harness',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture</title>'}));
  await page.goto(server.base+'term-tests/shared/harness');
  await page.setContent('<form id="readingView"><div id="questions"><input value="A"></div><button id="submitReading" type="submit">Nộp</button></form>');
  await page.evaluate(({slug,mode,scenario})=>{
   window.args={slug,mode,scenario};window.audit={calls:0,stages:[],notices:[]};window.confirm=()=>scenario!=='cancel';
   window.TERM_TEST_APP_CONFIG={API_BASE_URL:'https://fixture.invalid'};let stored=null;
   window.fetch=async(url,options)=>{
    if(url.endsWith('/submission-status'))return new Response(JSON.stringify(stored||{ok:true,persisted:false}));
    if(!url.endsWith('/reading'))throw Error('Unexpected API '+url);
    audit.calls++;if(scenario==='double-pending')await new Promise(r=>setTimeout(r,100));
    if(scenario==='http-error')return new Response('{"message":"Fixture 502"}',{status:502});
    if(scenario==='empty-200')return new Response('');
    const body=JSON.parse(options.body),response={ok:true,attemptToken:body.attemptToken,completed:mode==='lis_first',examMode:mode,readingSubmitted:true,nextSection:mode==='read_first'?'listening':'result',portalSyncStatus:'unknown'};
    stored={ok:true,persisted:true,receipt:{version:1,section:'reading',testSlug:slug,generation:0,attemptToken:body.attemptToken,submittedAt:new Date().toISOString(),answers:body.answers},response};
    if(scenario==='lost-reply')throw new TypeError('Fixture lost reply after commit');
    return new Response(JSON.stringify(response));
   };
  },{slug,mode,scenario});
  const app=fs.readFileSync(path.join(root,'term-tests',mod,'app.js'),'utf8');
  const start=app.indexOf("  elements.readingView.addEventListener('submit', async event => {");
  const end=app.indexOf('\n  });',start)+7;if(start<0||end<7)throw Error('handler boundaries');
  const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'term-tests',slug,'test-config.js'),'utf8'),sandbox);
  const testConfig=sandbox.window.TERM_TEST_CONFIG;
  await page.addScriptTag({content:`(()=>{
    const {slug,mode,scenario}=window.args;
    const testConfig=${JSON.stringify(testConfig)},appConfig=window.TERM_TEST_APP_CONFIG;
    const query=new URLSearchParams('class=FIXTURE'),classCode='FIXTURE',storageKey='fixture',storageScope='';
    const miniAnswerSheet=false,miniConfirmed=false,miniGeneration=0,miniEpoch=0,miniPrefix='',paperMini=false,paperEpoch=0,paperBusy=0,paperChange=null,demoMode='',serverGradingMode=false,writingConfig=null,readingMinutes=60;
    const state={studentRef:'11111111-1111-4111-8111-111111111111',attemptToken:'33333333-3333-4333-8333-333333333333',examSessionToken:'22222222-2222-4222-8222-222222222222',frozenAnswers:{},drafts:{},draftRevisions:{reading:0},draftAckRevisions:{reading:0}};window.auditState=state;
    const elements={readingView:document.getElementById('readingView'),readingQuestions:document.getElementById('questions'),submitReading:document.getElementById('submitReading')};
    const total=testConfig.reading.controls.length,answers=Object.fromEntries(Array.from({length:scenario==='zero'?0:scenario==='full'?total:total-1},(_,i)=>[i+1,'A']));
    const collectAnswers=()=>answers,updateAnswerCount=()=>Object.keys(answers).length,countAnswered=x=>Object.values(x).filter(Boolean).length;
    const saveSession=()=>{},stopSectionDraftFlow=()=>{},setAnswerControlsLocked=()=>{},sendClientEvent=()=>{},setSectionSaveStatus=()=>{},stopSectionDeadlineGuard=()=>{},startSectionDeadlineGuard=()=>{},scheduleSectionDraft=()=>{},isSectionExpired=()=>false;
    const showNotice=x=>audit.notices.push(x),setStage=x=>audit.stages.push(x),showSectionReady=x=>audit.stages.push(x),portalNotice=()=>'',loadResult=()=>{};
    ${fn(app,'apiRequest')}
    ${fn(app,'rawApiRequest')}
    ${fn(app,'confirmIncomplete')}
    ${fn(app,'setBusy')}
    ${app.slice(start,end)}
  })();`});
  if(errors.length)throw Error(errors.join('|'));
  await page.evaluate(()=>{readingView.requestSubmit();if(args.scenario==='double-pending')readingView.dispatchEvent(new SubmitEvent('submit',{cancelable:true}));});
  await page.waitForTimeout(scenario==='double-pending'?180:80);
  const observed=await page.evaluate(()=>({...audit,submitted:Boolean(auditState.readingSubmitted),completed:Boolean(auditState.completed),pending:Boolean(auditState.pendingSubmissions?.reading)}));
  const failed=['cancel','http-error','empty-200'].includes(scenario);
  const passed=failed?!observed.submitted&&observed.stages.length===0&&(scenario!=='cancel'||observed.calls===0):observed.submitted&&observed.calls===1&&observed.completed===(mode==='lis_first');
  results.push({slug,mode,scenario,outcome:passed?'passed':'failed',...observed,errors});
 }catch(error){results.push({slug,mode,scenario,outcome:'harness_error',message:error.message,errors});}finally{await context.close();}
}}finally{await browser.close();await server.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2),'utf8');}
console.log(JSON.stringify({cases:results.length,passed:results.filter(r=>r.outcome==='passed').length,failures:results.filter(r=>r.outcome!=='passed').slice(0,3)}));
if(results.some(r=>r.outcome!=='passed'))process.exitCode=1;
