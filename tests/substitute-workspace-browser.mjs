// Renderer/control thật; metadata, media và biên nhận giả. Không gọi AI/Portal.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {serve} from './helpers/result-details-browser-fixture.mjs';

if(!process.env.PLAYWRIGHT_MODULE||!process.env.SUBSTITUTE_WORKSPACE_EVIDENCE)throw Error('Cần Playwright và thư mục bằng chứng.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.SUBSTITUTE_WORKSPACE_EVIDENCE;
const revision=process.env.SUBSTITUTE_WORKSPACE_BASELINE;
if(revision&&!/^[a-f0-9]{40}$/.test(revision))throw Error('Baseline phải là SHA đầy đủ.');
if(revision&&process.argv.includes('--online'))throw Error('Không ghép baseline với online.');
fs.mkdirSync(out,{recursive:true});
const server=await serve(),base=process.argv.includes('--online')?'https://tranhoangduc90.github.io/izone-ai-team-pages/':server.base;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
const epoch='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
const variants=[{width:1366,height:768,stale:true},{width:1366,height:768,stale:'same'},{width:1366,height:768},{width:1024,height:768},{width:1440,height:900},{width:1366,height:600}];
const slugs=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'].filter(s=>!process.env.SUBSTITUTE_WORKSPACE_SLUG||s===process.env.SUBSTITUTE_WORKSPACE_SLUG);
const check=(checks,id,ok,observed)=>checks.push({id,ok:Boolean(ok),observed});
async function initial(page,skill,checks){
  await page.locator('#'+skill+'View .cbt-part-button').first().waitFor();
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
  const observed=await page.locator('#'+skill+'View').evaluate(f=>{
    const rect=e=>{if(!e)return null;const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};};
    return{selected:[...f.querySelectorAll('.cbt-part-button')].findIndex(b=>b.getAttribute('aria-current')==='true'),
      viewport:{width:innerWidth,height:innerHeight},form:rect(f),passage:rect(f.querySelector('.cbt-reading-section:not([hidden]) .cbt-reading-passage')),
      questions:rect(f.querySelector('.cbt-reading-section:not([hidden]) .cbt-reading-questions')),map:rect(f.querySelector('.cbt-question-nav')),
      submit:rect(f.querySelector('button[type=submit]:not([hidden])')),header:rect(document.querySelector('.topbar'))};
  });
  check(checks,skill+'-new-section-1',observed.selected===0,observed.selected);
  if(skill==='reading'){
    const {passage:p,questions:q,viewport:v}=observed;
    check(checks,'reading-left-half',p&&q&&Math.abs(p.width-q.width)<3&&p.width/v.width>=.47&&p.width/v.width<=.51&&Math.abs(p.y-q.y)<2,observed);
    // Native Term K67 đã đo: 557px ở1366×768; 477px ở1024×768 do toolbar xếp hàng.
    // Dung sai12px cho topbar có định danh; không lấy một tỷ lệ cứng cho mọi breakpoint.
    const reference=v.height===768?(v.width<=980?425:v.width===1366?557:v.width===1024?477:null):null;
    check(checks,'reading-usable-height',p&&(reference?p.height>=reference-12:p.height/v.height>=.65)&&p.y<=(v.width<=980?300:v.width<=1200?240:160),{...observed,referenceHeight:reference});
    check(checks,'reading-map-visible',observed.map.y>=p.y+p.height-2&&observed.map.y+observed.map.height<=v.height+1,observed);
    check(checks,'reading-submit-visible',observed.submit.x>=0&&observed.submit.x+observed.submit.width<=v.width+1&&observed.submit.y>=0&&observed.submit.y+observed.submit.height<=v.height,observed.submit);
  }
  return observed;
}

try{for(const slug of slugs)for(const variant of variants){
  if(process.env.SUBSTITUTE_WORKSPACE_FOCUSED&&variant.width!==1366)continue;
  const {width,height,stale=false}=variant,context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),checks=[],errors=[];
  let seeded=false;const startedAt=new Date().toISOString(),grades=new Map();
  await context.addInitScript(()=>{
    window.IZONE_EXAM_DEVICE_CHECKED=true;
    for(const [key,value]of [['duration',1800],['readyState',4]])Object.defineProperty(HTMLMediaElement.prototype,key,{get:()=>value,configurable:true});
    HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
    HTMLMediaElement.prototype.load=function(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));};
  });
  await context.route('**/*',async route=>{
    const request=route.request(),url=request.url(),u=new URL(url);
    if(url.startsWith(base+'shared/audio/transport.mjs'))return route.fulfill({contentType:'text/javascript',body:'export async function downloadSubstitute(){return null;}'});
    if(/\.(mp3|wav|enc|m4a)(?:\?|$)/.test(url))return route.fulfill({contentType:'audio/mpeg',body:Buffer.alloc(64)});
    if(url.startsWith(base)){
      const relative=u.pathname.replace(/^\/izone-ai-team-pages\//,'').replace(/^\//,'')+(u.pathname.endsWith('/')?'index.html':'');
      const owned=/^term-tests\/substitute-(?:shared\/exam-controls\.(?:css|js)|test-[12]-k(?:56|67)-computer-based\/(?:index\.html|bootstrap\.js|enhance\.js))$/.test(relative);
      let body=revision&&owned?execFileSync('git',['show',revision+':'+relative],{cwd:root,windowsHide:true}):null;
      if(stale&&!seeded&&relative.endsWith('/enhance.js')){
        seeded=true;
        const response=body?null:await route.fetch();
        const script=body?body.toString():await response.text();
        const prefix=`(()=>{const s=window.SUBSTITUTE_STATE;const record=s.stamp({activeSection:{listening:3,reading:1}});record._substitute.examSessionId=${JSON.stringify(stale==='same'?session:'33333333-3333-4333-8333-333333333333')};for(const store of s.storages())store.setItem(s.key('izone-test-ui:',s.resolveClass()),JSON.stringify(record));})();\n`;
        return route.fulfill({contentType:'text/javascript',body:prefix+script});
      }
      if(body)return route.fulfill({contentType:relative.endsWith('.css')?'text/css':relative.endsWith('.html')?'text/html':'text/javascript',body});
      return route.continue();
    }
    if(!url.includes('/webhook/'))return route.abort();
    const {route:api,payload={}}=request.postDataJSON();let data;
    if(api==='/api/test/history')data={testSlug:slug,historyEpoch:epoch,stateVersion:2,maintenance:false,serverNow:new Date().toISOString(),examTimingVersion:'substitute-audio-transfer-20261014-v1',classes:[{code:'DEMO',name:'DEMO'}],...(slug==='substitute-test-2-k67'?{writingVersions:{DEMO:'substitute-k67-test2-two-task-20261007-v1'}}:{})};
    else if(api==='/api/test/roster')data={students:[{ref:'fictional-01',name:'Học viên giả'}]};
    else if(api==='/api/test/writing/session')data={...payload,testSlug:slug,examVersion:'substitute-k67-test2-two-task-20261007-v1',writingSessionId:payload.clientRunId};
    else if(api==='/api/test/exam/session')data={...payload,testSlug:slug,examSessionId:session,timingVersion:'substitute-audio-transfer-20261014-v1',listeningStartedAt:startedAt,listeningDeadlineAt:'',audioEndedAt:'',transferSeconds:300,serverNow:new Date().toISOString()};
    else if(api==='/api/test/grade'){
      data={persisted:true,snapshotHash:'a'.repeat(64),submittedAt:new Date().toISOString(),section:{correct:0,total:40,band:0,typeStats:[],details:Array.from({length:40},(_,i)=>({number:i+1,studentAnswer:payload.answers?.[i+1]||'',correctAnswer:'Fixture',result:'blank'}))}};
      grades.set(payload.examId,data);
    }else if(api==='/api/test/exam/section-status')data={...payload,testSlug:slug,skill:payload.examId,persisted:false,...grades.get(payload.examId)};
    else return route.abort();
    return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(45000);page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
  const id=slug+'-'+width+'x'+height+(stale==='same'?'-same-session-old-ui':stale?'-old-ui':'-clean');
  try{
    await page.goto(base+'term-tests/'+slug+'-computer-based/?demo=exam&grading=server');
    await page.locator('#bootstrapClass').selectOption('DEMO');const student=page.locator('#bootstrapStudent option:not([value=""])').first();await student.waitFor({state:'attached'});await page.locator('#bootstrapStudent').selectOption(await student.getAttribute('value'));await page.locator('#confirmIdentity').click();await page.locator('#bootstrapPreview:enabled').click();await page.locator('#bootstrapStart:enabled').click();await page.locator('#listeningView').waitFor({state:'visible'});
    await initial(page,'listening',checks);
    const resume=!stale&&width===1366&&height===768;
    if(resume){
      await page.locator('#listeningView .cbt-part-button').first().click();await page.locator('#listeningView input[data-number="1"]').fill('Original Listening');await page.locator('#listeningView .cbt-part-button').nth(3).click();
      await page.reload();await page.locator('#bootstrapStart:enabled').click();await page.locator('#listeningView .cbt-part-button.is-active').waitFor();
      check(checks,'listening-reload-stays-section4',await page.locator('#listeningView .cbt-part-button').nth(3).getAttribute('aria-current')==='true');
      check(checks,'listening-reload-keeps-answer',await page.locator('#listeningView input[data-number="1"]').inputValue()==='Original Listening');
    }
    await page.locator('#submitListening').click();await page.locator('#listeningView').waitFor({state:'hidden'});await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
    await initial(page,'reading',checks);await page.screenshot({path:path.join(out,id+'.png'),fullPage:true});
    if(resume){
      await page.locator('#readingView .cbt-part-button').first().click();const field=page.locator('#readingView .cbt-answer-input:visible').first();const number=await field.getAttribute('data-number');await field.fill('Original Reading');await page.locator('#readingView .cbt-part-button').nth(1).click();
      const deadline=await page.evaluate(()=>window.SUBSTITUTE_STATE.timing.readingDeadlineAt);
      await page.reload();await page.locator('#readingView .cbt-part-button.is-active').waitFor();
      check(checks,'reading-reload-stays-passage2',await page.locator('#readingView .cbt-part-button').nth(1).getAttribute('aria-current')==='true');
      check(checks,'reading-reload-keeps-answer',await page.locator('#readingView [data-number="'+number+'"]').inputValue()==='Original Reading');
      check(checks,'reading-reload-does-not-extend-time',await page.evaluate(()=>window.SUBSTITUTE_STATE.timing.readingDeadlineAt)===deadline);
    }
    check(checks,'no-page-errors',errors.length===0,errors);
    results.push({id,slug,variant,status:checks.every(c=>c.ok)?'passed':'failed',checks});
    console.log(results.at(-1).status.toUpperCase()+' '+id);
  }catch(e){results.push({id,slug,variant,status:'failed',error:e.message,errors,checks});console.log('FAILED '+id+': '+e.message);}
  finally{await context.close();}
}}finally{await browser.close();await server.close();}
const report={ok:results.length>0&&results.every(r=>r.status==='passed'),revision:revision||'working-tree',results,realAI:false,portalWrites:0};
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));if(!report.ok)process.exitCode=1;
