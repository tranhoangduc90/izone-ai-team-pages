import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {serve} from './helpers/result-details-browser-fixture.mjs';
import {substituteListeningReportMap} from '../term-tests/substitute-shared/listening-report-maps-v1.mjs';

const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(resolve(modules,'playwright/package.json'))('playwright');

test('Substitute 1 K56 opens Listening with 4 Parts and 40 attached fields with the old enhancer blocked',async()=>{
  const server=await serve();
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1230,height:580},serviceWorkers:'block'});
    page.setDefaultTimeout(12000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let legacyRequests=0;
    const slug='substitute-test-1-k56';
    const startedAt=new Date().toISOString();
    await page.route('**/*',route=>{
      const url=route.request().url();
      if(/\/enhance(?:-submission-recovery-v1)?\.js(?:\?|$)/.test(url)){
        legacyRequests++;
        return route.abort();
      }
      if(/\.(mp3|wav|enc|m4a)(?:\?|$)/.test(url))return route.fulfill({contentType:'audio/mpeg',body:Buffer.alloc(64)});
      if(url.startsWith(server.base))return route.continue();
      if(!url.includes('/webhook/'))return route.abort();
      const {route:api,payload={}}=route.request().postDataJSON();
      let data;
      if(api==='/api/test/history')data={testSlug:slug,historyEpoch:'11111111-1111-4111-8111-111111111111',
        stateVersion:2,maintenance:false,serverNow:new Date().toISOString(),examTimingVersion:'substitute-audio-transfer-20261014-v1',
        classes:[{code:'DEMO',name:'DEMO'}]};
      else if(api==='/api/test/roster')data={students:[{ref:'fictional-01',name:'Học viên giả'}]};
      else if(api==='/api/test/exam/session')data={...payload,testSlug:slug,examSessionId:'22222222-2222-4222-8222-222222222222',
        timingVersion:'substitute-audio-transfer-20261014-v1',listeningStartedAt:startedAt,listeningDeadlineAt:'',
        audioEndedAt:'',transferSeconds:300,serverNow:new Date().toISOString()};
      else return route.abort();
      return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},json:data});
    });
    await page.addInitScript(()=>{
      window.IZONE_EXAM_DEVICE_CHECKED=true;
      for(const [key,value] of [['duration',1728.535],['readyState',4]]){
        Object.defineProperty(HTMLMediaElement.prototype,key,{get:()=>value,configurable:true});
      }
      HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
      HTMLMediaElement.prototype.load=function(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));};
      const frames=[];
      window.listeningFrames=frames;
      let last;
      new MutationObserver(()=>{
        const form=document.querySelector('#listeningView:not([hidden])');
        if(!form||!form.getClientRects().length)return;
        const fields=form.querySelectorAll('#listeningQuestions [data-number]').length;
        const sections=form.querySelectorAll('#listeningQuestions .cbt-listening-section').length;
        const value=JSON.stringify({fields,sections});
        if(value!==last){last=value;frames.push({fields,sections});}
      }).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    });
    await page.goto(server.base+'term-tests/'+slug+'-computer-based/?demo=exam&grading=server');
    await page.locator('#bootstrapClass').selectOption('DEMO');
    const rosterEntry=page.locator('#bootstrapStudent option:not([value=""])').first();
    await rosterEntry.waitFor({state:'attached'});
    await page.locator('#bootstrapStudent').selectOption(await rosterEntry.getAttribute('value'));
    await page.locator('#confirmIdentity').click();
    // This fixture exercises first-frame layout, while the production preview
    // timing is covered by the external media and startup harnesses.
    await page.evaluate(()=>{
      window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW=(_audio,_button,onReady)=>onReady();
    });
    await page.locator('#bootstrapPreview:enabled').click();
    await page.locator('#bootstrapStart:enabled').click();
    await page.locator('#listeningView .cbt-part-button').last().waitFor({state:'visible'});
    assert.deepEqual(await page.evaluate(()=>window.listeningFrames),[{fields:40,sections:4}]);
    assert.equal(legacyRequests,0);
    await page.locator('#listeningView .cbt-part-button').last().click();
    const last=page.locator('#listeningQuestions [data-number="40"]');
    const option=await last.locator('option:not([value=""])').first().getAttribute('value');
    assert.ok(option);
    await last.selectOption(option);
    assert.equal(await last.inputValue(),option);
    assert.equal(await page.locator('#listeningQuestions .cbt-content-viewport').evaluate(node=>getComputedStyle(node).overflowY),'visible');
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
    await server.close();
  }
});

const native=process.env.SUBSTITUTE_REPORT_STAGED_NATIVE;
for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
for(const examOrder of ['listening-first','reading-first']){
test(slug+' '+examOrder+' real MP3 keeps both reports bound to native continuity',{skip:!native},async()=>{
  const {SubstituteStore}=await import(pathToFileURL(resolve(native,'src/store.mjs')));
  const {TESTS}=await import(pathToFileURL(resolve(native,'src/contract.mjs')));
  const {createSubstituteListeningReportService}=await import(pathToFileURL(resolve(native,'src/listening-report.mjs')));
  const classCode=TESTS[slug].portalClass;
  const profile=substituteListeningReportMap(slug);
  const content=new URL('../term-tests/'+slug+'-computer-based/assets/private/listening-'+slug+'.mp3',import.meta.url);
  const audioBytes=await readFile(content);
  const name='Học viên giả';
  const studentRef='fictional-01';
  const roster={class:{code:classCode,name:'Lớp kiểm thử'},students:[{ref:studentRef,name}]};
  const store=new SubstituteStore({encryptionKey:randomBytes(32),listeningContinuityTests:[slug],readingFirstTests:[slug]});
  if(slug==='substitute-test-2-k67')store.configureWritingRelease(slug,'open');
  const sends=[],alerts=[],requests=[],errors=[];
  const send=async message=>{sends.push(message);return {acceptedByProvider:true,messageId:String(sends.length)};};
  send.photo=send;
  const reporter=createSubstituteListeningReportService({store,profileFor:substituteListeningReportMap,
    readRoster:async()=>roster,send,observe:event=>alerts.push(event)});
  const server=await serve();
  const browser=await chromium.launch({channel:'msedge',headless:true});
  let page;
  try{
    page=await browser.newPage({viewport:{width:1230,height:580},serviceWorkers:'block'});
    page.setDefaultTimeout(15000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>dialog.accept());
    const cors={'access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS',
      'access-control-allow-headers':'content-type'};
    await page.route('**/*',async route=>{
      const request=route.request(),url=request.url();
      if(/\/enhance(?:-submission-recovery-v1)?\.js(?:\?|$)/.test(url))return route.abort();
      if(/\.(mp3|wav)(?:\?|$)/.test(url))
        return route.fulfill({contentType:'audio/mpeg',headers:cors,body:audioBytes});
      if(url.startsWith(server.base))return route.continue();
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
      let data;
      try{
        if(url.endsWith('/substitute-listening-report-api')){
          requests.push({route:'alert',value:request.postDataJSON()});
          data=await reporter.accept(request.postDataJSON());
          await reporter.workOne();
          return route.fulfill({status:202,headers:cors,json:data});
        }
        if(!url.includes('/webhook/'))return route.abort();
        const {route:api,payload={}}=request.postDataJSON();
        requests.push({route:api,value:payload});
        if(api==='/api/test/history')data=store.historyState({testSlug:slug});
        else if(api==='/api/test/roster')data=roster;
        else if(api==='/api/test/writing/session')data=store.startWritingSession({...payload,testSlug:slug});
        else if(api==='/api/test/exam/session')data=store.startExamSession({...payload,testSlug:slug});
        else if(api==='/api/test/exam/listening/start')data=store.startListeningPhase({...payload,testSlug:slug});
        else if(api==='/api/test/exam/listening/interrupt')data=store.interruptListening({...payload,testSlug:slug});
        else if(api==='/api/test/grade'){
          const total=TESTS[slug].readingMax;
          const section={correct:0,total,band:0,typeStats:[],details:Array.from({length:total},(_,i)=>({
            number:i+1,studentAnswer:payload.answers?.[i+1]||'',correctAnswer:'Fixture',result:'blank',
          }))};
          data=store.saveSectionSubmission({...payload,testSlug:slug,skill:payload.examId,section});
        }
        else if(api==='/api/test/exam/section-status')
          data=store.readSectionSubmission({...payload,testSlug:slug,skill:payload.examId});
        else return route.abort();
        return route.fulfill({headers:cors,json:data});
      }catch(error){
        errors.push(error.code||error.message);
        return route.fulfill({status:error.status||500,headers:cors,json:{code:error.code}});
      }
    });
    await page.addInitScript(()=>{window.IZONE_EXAM_DEVICE_CHECKED=true;});
    await page.goto(server.base+'term-tests/'+slug+'-computer-based/?demo=exam&grading=server');
    await page.locator('#bootstrapClass').selectOption(classCode);
    await page.locator('#bootstrapStudent option[value="'+studentRef+'"]').waitFor({state:'attached'});
    await page.locator('#bootstrapStudent').selectOption(studentRef);
    await page.locator('#confirmIdentity').click();
    await page.evaluate(()=>{window.IZONE_CBT_AUDIO_WAIT_FOR_PREVIEW=(_audio,_button,onReady)=>onReady();});
    await page.locator('#bootstrapPreview:enabled').click();
    if(examOrder==='reading-first')await page.locator('#bootstrapOrder').selectOption(examOrder);
    await page.locator('#bootstrapStart:enabled').click();
    if(examOrder==='reading-first'){
      await page.locator('#submitReading:enabled').click();
      const handoff=page.locator('.cbt-start-listening:enabled');
      await handoff.click();
    }
    const button=page.getByRole('button',{name:'Tôi không nghe được'});
    await button.waitFor({state:'visible'});
    const seek=async time=>{
      await page.evaluate(time=>{
        const exam=window.TERM_TEST_BOOTSTRAP;
        (exam.officialAudioElement||exam.preparedListeningPlayer).currentTime=time;
      },time);
      await page.waitForFunction(time=>{
        const exam=window.TERM_TEST_BOOTSTRAP;
        const audio=exam.officialAudioElement||exam.preparedListeningPlayer;
        return !audio.seeking&&!audio.paused&&audio.currentTime>time+0.6;
      },time);
    };
    const gap=profile.readingGaps[0];
    await seek(gap.from+4);
    await button.click();
    const notice=page.locator('.substitute-listening-report');
    await notice.waitFor({state:'visible'});
    assert.equal((await notice.innerText()).replace(/sau khoảng \d+ giây/,'sau khoảng N giây'),
      'Hiện tại là khoảng im lặng trước câu hỏi '+gap.questions+' của part '+gap.part+
      ', không phải lỗi âm thanh. Audio sẽ vang lên sau khoảng N giây. Hãy tập trung đọc và phân tích đề trong lúc này.');
    const readPosition=()=>{
      const exam=window.TERM_TEST_BOOTSTRAP;
      return (exam.officialAudioElement||exam.preparedListeningPlayer).currentTime;
    };
    const elapsed=await page.evaluate(readPosition);
    await page.waitForFunction(time=>{
      const exam=window.TERM_TEST_BOOTSTRAP;
      return (exam.officialAudioElement||exam.preparedListeningPlayer).currentTime>time+0.45;
    },elapsed);
    assert.equal(alerts.length,0);
    assert.equal(requests.filter(row=>row.route==='/api/test/exam/listening/interrupt').length,0);

    const audible=profile.audibleWindows.find(([from,to])=>from>=gap.to&&to-from>=4);
    await seek(audible[0]+1);
    await button.click();
    await page.waitForEvent('response',{predicate:response=>response.url().endsWith('/substitute-listening-report-api')
      &&response.request().method()==='POST'&&response.status()===202,timeout:12000});
    assert.equal(sends.length,1);
    assert.match(sends[0].caption,/Học viên giả/);
    assert.equal(sends[0].png.readUInt32BE(16),900);
    assert.equal(sends[0].png.readUInt32BE(20),520);
    const [ack]=requests.filter(row=>row.route==='/api/test/exam/listening/interrupt');
    const [report]=requests.filter(row=>row.route==='alert');
    assert.equal(report.value.operationId,ack.value.operationId);
    assert.ok(alerts.some(event=>event.status==='sent'&&event.operationId===ack.value.operationId));
    assert.deepEqual(errors,[]);
  } catch(error){
    const state=await page?.evaluate(()=>({
      notice:document.querySelector('#bootstrapNotice')?.textContent,
      download:document.querySelector('#bootstrapDownloadStatus')?.textContent,
      order:window.TERM_TEST_BOOTSTRAP?.examOrder,
      stage:document.body.dataset.substituteStage,
      listeningStart:document.querySelector('.cbt-start-listening')?.textContent,
    }));
    throw Error(JSON.stringify({state,errors,routes:requests.map(row=>row.route)}),{cause:error});
  } finally {
    await browser.close();
    await server.close();
    store.close();
  }
});
}
}
