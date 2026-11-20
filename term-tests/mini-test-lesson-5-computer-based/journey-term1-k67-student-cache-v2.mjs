import { createOfflineRuntime } from '../k56-offline-shared/runtime-term2-k67-recovery-v1.mjs?v=20261107-mini-v3';
import { downloadTermAudio } from '../k56-offline-shared/whole-audio-terms-cbt-audio-status-v1.mjs?v=20261111-audio-milestones-v2';
import { mountOfflineListeningPlayer, prepareContinuityAudio, mountContinuityListeningPlayer } from '../k67-shared/offline-journey-ui-term2-report-v1.mjs';
import { mountContinuityListeningPlayer as mountTerm1ListeningPlayer } from '../k67-shared/continuity-player-term1-report-v1.mjs';
import { attachListeningReportChoices } from '../k67-shared/listening-report-choices-v1.mjs';
import {createListeningReportOutbox,sendListeningReport} from '../k67-shared/listening-report-k67-v1.mjs';

const miniSlug='mini-test-lesson-5';
const term1Slug='term-test-1';
const term2Slug='term-test-2';
const journeyProfiles=new Map([
  [miniSlug,{version:'mini-k67-cbt-journey-v1',dbName:'izone-mini-k67-journey-v1',build:'mini-k67-cbt-shell-v1',title:'Mini K67'}],
  [term1Slug,{version:'term1-k67-cbt-journey-v1',dbName:'izone-term1-k67-journey-v1',build:'term1-k67-cbt-shell-v1',title:'Term 1 K67',writing:true}],
  [term2Slug,{version:'term2-k67-cbt-journey-v1',dbName:'izone-term2-k67-journey-v1',build:'term2-k67-cbt-shell-v1',title:'Term 2 K67',writing:true}],
  [term1Slug+'-paper',{version:'term1-k67-paper-journey-v1',dbName:'izone-term1-k67-paper-v1',build:'term1-k67-paper-shell-v1',title:'Term 1 K67 · Phiếu giấy',paper:true,slug:term1Slug}],
  [term2Slug+'-paper',{version:'term2-k67-paper-journey-v1',dbName:'izone-term2-k67-paper-v1',build:'term2-k67-paper-shell-v1',title:'Term 2 K67 · Phiếu giấy',paper:true,slug:term2Slug}]
].map(([slug,profile])=>[slug,{...profile,endpoint:`/api/term-tests/${profile.slug||slug}/${profile.paper?'paper':'cbt'}-journey/`,
  ...createOfflineRuntime({...profile,localPrefix:profile.version+':'})}]));
const keyOf = ({classCode,studentRef,examSessionToken,generation}) => [classCode,studentRef,examSessionToken,generation].join(':');
const hex = value => [...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const hash = async value => hex(await crypto.subtle.digest('SHA-256', value));
const text = new TextEncoder();
const ordered = answers => Object.fromEntries(Object.entries(answers).sort(([a],[b])=>a.localeCompare(b)));
const id = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
const nameKey = value => String(value||'').normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');

function demoResetSignal(classCode,studentRef,slug){
  if(classCode!=='CODEXDEMO806'||slug.endsWith('-paper'))return '';
  try{return localStorage.getItem(`izone-demo-reset:student:${classCode}:${studentRef}:${slug}`)||'';}
  catch{return '';}
}

function currentDemoRecord(record,classCode,slug,studentRef=record.package?.studentRef){
  return (record.demoResetSignal||'')===demoResetSignal(classCode,studentRef,slug);
}

async function cacheShell(OfflineRuntime,slug) {
  const runtime=new OfflineRuntime({});
  if(slug==='term-test-1')runtime.workerPath='./offline-worker-student-cache-v2.js';
  return runtime.prepareCache();
}

export async function miniJourneyRecovery(classCode,mode,slug=miniSlug){
  if(!navigator.locks||!crypto.subtle)return null;
  const {ExamStore,version}=journeyProfiles.get(slug);
  const store=await new ExamStore().open();
  const candidates=[];
  for(const key of await store.keys(classCode+':')){
    if(key.endsWith(':audio'))continue;
    const record=await store.get(key).catch(()=>null);
    const bundle=record?.package;
    if(!record?.ready||!currentDemoRecord(record,classCode,slug)||!record.activatedAt||bundle?.version!==version||!id(bundle.studentRef)||!id(bundle.examSessionToken)
        ||(mode&&bundle.examMode!==mode)||keyOf({...bundle,classCode})!==key)continue;
    candidates.push({bundle,activatedAt:record.activatedAt});
  }
  if(!candidates.length)return null;
  return studentName=>{
    const matches=candidates.filter(({bundle})=>nameKey(bundle.studentName)===nameKey(studentName));
    if(new Set(matches.map(({bundle})=>bundle.studentRef)).size!==1)return null;
    return matches.sort((a,b)=>b.activatedAt-a.activatedAt)[0].bundle;
  };
}

export function termPaperRecovery(classCode,slug) {return miniJourneyRecovery(classCode,null,slug+'-paper');}

export async function findMiniJourney(scope,slug=miniSlug) {
  if (!navigator.locks || !crypto.subtle || !id(scope.examSessionToken) || !id(scope.studentRef)) return null;
  const {ExamStore,version}=journeyProfiles.get(slug);
  const store = await new ExamStore().open();
  const key = keyOf(scope);
  const record = await store.get(key);
  if (!record?.ready || !currentDemoRecord(record,scope.classCode,slug) || record.package?.version !== version || record.package.examSessionToken !== scope.examSessionToken
      || record.package.studentRef !== scope.studentRef || record.package.generation !== scope.generation) return null;
  return { store,key,record };
}

export async function openTermPaperJourney({slug,classCode,studentRef,mode,request,prepare=false}) {
  if(!navigator.locks||!navigator.serviceWorker||!globalThis.indexedDB||!crypto.subtle||!classCode||!id(studentRef))return null;
  const profile=slug+'-paper';
  const {ExamStore,OfflineRuntime,version,endpoint}=journeyProfiles.get(profile);
  const store=await new ExamStore().open();
  const key=`paper-owner:${classCode}:${studentRef}`;
  const scope=await navigator.locks.request(version+':'+key,async()=>{
    let owner=await store.get(key);
    if(owner?.scope?.classCode===classCode&&owner.scope.studentRef===studentRef){
      const saved=await store.get(keyOf(owner.scope));
      const bundle=saved?.package;
      if(saved?.ready&&bundle?.version===version&&bundle.studentRef===studentRef
          &&bundle.examSessionToken===owner.scope.examSessionToken&&bundle.generation===owner.scope.generation)return owner.scope;
    }
    if(!prepare||navigator.onLine===false)return null;
    if(!owner){
      let offer;
      try{offer=await request(endpoint+'availability');}catch{return null;}
      if(!offer.enabled)return null;
      try{await cacheShell(OfflineRuntime,slug);}catch{return null;}
      owner={deviceProof:hex(crypto.getRandomValues(new Uint8Array(32)))};
      await store.put(key,owner);
    }
    let bundle;
    try{
      bundle=await request(endpoint+'prepare',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({classCode,studentRef,deviceProof:owner.deviceProof,examMode:mode,identityConfirmed:true})});
    }catch(error){if(error.status===404||error.code==='OFFLINE_NEW_DISABLED')return null;throw error;}
    if(bundle.version!==version||bundle.studentRef!==studentRef||!id(bundle.attemptToken)||!id(bundle.examSessionToken)
        ||!Number.isSafeInteger(bundle.generation)||!Number.isSafeInteger(bundle.activatedAt)||!Number.isSafeInteger(bundle.serverNow)
        ||!Number.isFinite(bundle.timing?.readingDurationMinutes)||!['read_first','lis_first'].includes(bundle.examMode)
        ||!(/^[a-f0-9]{64}$/.test(bundle.permit)))throw new Error('Quyền lưu phiếu chưa khớp lượt.');
    const scope={classCode,studentRef,examSessionToken:bundle.examSessionToken,generation:bundle.generation};
    if(!await store.get(keyOf(scope)))await store.put(keyOf(scope),{deviceProof:owner.deviceProof,package:bundle,ready:true,
      activatedAt:bundle.activatedAt,clock:{epoch:bundle.serverNow,wall:Date.now()},sections:{},drafts:{},revisions:{},pending:[],receipts:{}});
    await store.put(key,{...owner,scope});
    return scope;
  });
  if(!scope)return null;
  return openMiniJourney({scope,request,slug:profile,existing:{store}});
}

export async function openMiniJourney({scope,request,existing,prepare=false,confirmProgress=false,slug=miniSlug,pagesOnly=false,onProgress,onPhase}) {
  if (!navigator.locks || !crypto.subtle || !id(scope.examSessionToken) || !id(scope.studentRef)) return null;
  const {ExamStore,OfflineRuntime,version,endpoint,title,writing,paper}=journeyProfiles.get(slug);
  const store = existing?.store || await new ExamStore().open();
  const key = keyOf(scope);
  const canFork = slug===term1Slug && Boolean(existing);
  // A reload may still be releasing its own lease. Give it a short chance to finish
  // before opening a separate session for another tab.
  const acquire = canFork ? {signal:AbortSignal.timeout(600)} : {ifAvailable:true};
  const release = await new Promise((resolve,reject)=>{
    navigator.locks.request(version+':'+key,acquire,lock=>{
      if(!lock){resolve(null);return;}
      return new Promise(done=>resolve(done));
    }).catch(error => canFork && acquire.signal.aborted ? resolve(null) : reject(error));
  });
  if (!release) {
    const error = new Error('Bài đang mở ở tab khác. Hãy trở lại tab đang giữ bài.');
    if (canFork) error.code='TERM1_TAB_SCOPE_BUSY';
    throw error;
  }
  let record;
  const changed = new EventTarget();
  let busy=false, retryAt=0, message='', stopped=false, timer;
  let playing=null, preparedPlayer=null, preparingPlayer=null, verifiedBlob=null, savingOperation=false;
  let journal, listeningStartIntent, stopJournalReconnect;
  const diagnostics=[];
  const continuationSection=()=>record.package?.continuationSection;
  const needsAudio=()=>!continuationSection()||continuationSection()==='listening';
  const continuity=()=>!paper&&needsAudio()&&record.package.listeningContinuityVersion===1;
  function drainDiagnostics(persistChanges=true) {
    while(journal?.recorder&&diagnostics.length){
      try{
        if(!journal.recorder.record('state_observed',{cause:'k67_offline_journey',checkpointState:diagnostics[0]}))return;
        diagnostics.shift();
      }catch{return;}
    }
    if(!journal?.recordK67Submission||!record?.submissionDiagnostics?.length)return;
    try{
      let changed=false;
      if(record.submissionDiagnosticsLost&&journal.recordK67Submission(owner,'sequence_gap',{
        cause:'submission_diagnostic_budget',lostCount:record.submissionDiagnosticsLost
      })){
        delete record.submissionDiagnosticsLost;
        changed=true;
      }
      while(record.submissionDiagnostics.length){
        const {type,data}=record.submissionDiagnostics[0];
        if(!journal.recordK67Submission(owner,type,data))break;
        record.submissionDiagnostics.shift();changed=true;
      }
      if(changed&&persistChanges)void persist().catch(()=>{});
    }catch{}
  }
  function observe(action,details={}){
    if(action==='audio_playing'&&listeningStartIntent!==undefined){
      details={...details,elapsedMs:performance.now()-listeningStartIntent};
    }
    if(diagnostics.length>=32)diagnostics.shift();
    diagnostics.push({offlineVersion:1,action,observedAt:new Date().toISOString(),...details});
    drainDiagnostics();
  }
  function observeReport(phase,fields={}){
    if(paper||slug!=='term-test-1')return;
    saveSubmissionDiagnostic('state_observed',{cause:'k67_offline_journey',checkpointState:{
      action:'k67_listening_reporting',productSlug:slug,section:'listening',reportVersion:1,phase,mode:'journey',...fields
    }});
  }
  function setJournal(value){journal=value;drainDiagnostics();}
  function observeListeningDecision(phase, fields = {}) {
    if (paper || slug !== term1Slug || globalThis.TERM_TEST_APP_CONFIG?.EXAM_JOURNAL_ENABLED !== true) return;
    try {
      return saveSubmissionDiagnostic('state_observed', {cause:'k67_offline_journey', checkpointState:{
        offlineVersion:1, action:'term1_listening_decision', phase, section:'listening',
        elapsedPageMs:Math.round(performance.now()), ...fields
      }});
    } catch { /* Media and review remain independent of the journal. */ }
  }
  function connectJournal({endpoint,build,getState,onConnected}){
    let key;
    try{key=JSON.stringify([new URL(endpoint,location.href).href,slug]);}catch{return;}
    let inFlight,timer;
    function attach(value){
      if(!value||journal||stopped)return;
      stopJournalReconnect();
      setJournal(value);
      onConnected(value);
    }
    function reconnect(){
      if(stopped||journal||navigator.onLine===false)return;
      try{
        const started=window[Symbol.for('izone.examJournal.connections.v1')]?.get(key);
        if(started?.recordK67Submission){attach(started.adopt(getState));return;}
      }catch{}
      if(inFlight)return;
      inFlight=import('../shared/exam-journal/bridge-recovery-v1-log-renewal-v1.mjs?v=20261112-submission-metadata-v2&submissionReconnect=1')
        .then(({connectExamJournal})=>{
          if(!journal&&!stopped)attach(connectExamJournal({enabled:true,endpoint,testSlug:slug,build,getState}));
        }).catch(()=>{}).finally(()=>{inFlight=null;});
    }
    const restore=event=>{if(event.persisted)reconnect();};
    stopJournalReconnect=()=>{
      clearInterval(timer);
      window.removeEventListener('online',reconnect);
      window.removeEventListener('pageshow',restore);
    };
    window.addEventListener('online',reconnect);
    window.addEventListener('pageshow',restore);
    timer=setInterval(reconnect,5_000);
    reconnect();
  }
  function markListeningStart(){
    listeningStartIntent=performance.now();
    observeListeningDecision('start_requested');
  }
  function onOnline(){retryAt=0;void flush();}
  const owner = {examSessionToken:scope.examSessionToken,generation:scope.generation};
  const save = () => store.put(key,record);
  const notify = value=>{if(value!==message){message=value;changed.dispatchEvent(new Event('change'));}};
  const order = () => {
    if(continuationSection())return [continuationSection()];
    const sections=record.package.examMode==='read_first'?['reading','listening']:['listening','reading'];
    if(writing)sections.push('writing');
    return sections;
  };
  const next = () => order().find(section=>!record.sections[section]?.operationId)||'result';
  function saveSubmissionDiagnostic(type,data,persistNow=true){
    try{
      const queue=record.submissionDiagnostics||=[];
      if(queue.length>=64){queue.shift();record.submissionDiagnosticsLost=(record.submissionDiagnosticsLost||0)+1;}
      // Store identical JSON metadata in localStorage and IndexedDB.
      const event={type,data:{...data,checkpointState:{...data.checkpointState,
        observationId:crypto.randomUUID(),observedAt:new Date().toISOString()}}};
      queue.push(JSON.parse(JSON.stringify(event)));
      if(persistNow){
        drainDiagnostics(false);
        void persist().catch(()=>{});
      }
    }catch{}
  }

  async function send(path,body,permit=record?.package?.permit) {
    const options={method:'POST',headers:{'Content-Type':'application/json',...(permit?{'x-term2-permit':permit}:{})},
      body:JSON.stringify({...owner,deviceProof:record.deviceProof,...body})};
    let trace,began;
    if ((writing||record.package?.readingDeadlineReviewVersion===1) && body.operationId) {
      try {
        const requestId=crypto.randomUUID();
        options.headers['x-exam-journal-request-id']=requestId;
        began=performance.now();
        trace={requestId,route:endpoint+path,method:options.method,
          checkpointState:{operationId:body.operationId,phase:path==='status'?'readback':'send'}};
        saveSubmissionDiagnostic('request_started',trace);
      } catch {}
    }
    try {
      const result=await request(endpoint+path,options);
      if(trace)saveSubmissionDiagnostic('request_finished',{...trace,status:200,durationMs:performance.now()-began});
      return result;
    } catch (error) {
      if(trace)saveSubmissionDiagnostic('request_failed',{...trace,durationMs:performance.now()-began,
        ...Number.isInteger(error?.status)&&{status:error.status},
        .../^[A-Z0-9_]{1,80}$/.test(error?.code||'')&&{errorCode:error.code}});
      throw error;
    }
  }

  function observeSubmission(action,payload,details={},persistNow=true) {
    if (!submissionReadback) return;
    try {
      saveSubmissionDiagnostic('state_observed',{cause:'k67_offline_journey',checkpointState:{action,
        submissionObservationVersion:1,section:payload.section,operationId:payload.operationId,
        revision:payload.revision,startedAtMs:payload.startedAt,capturedAtMs:payload.capturedAt,
        deadlineAtMs:record.sections[payload.section]?.deadline,automatic:payload.automatic,
        ...(payload.section==='writing'
          ?{task1Length:(payload.answers.task1||'').length,task2Length:(payload.answers.task2||'').length}
          :{answeredCount:Object.values(payload.answers).filter(Boolean).length}),
        ...payload.section==='listening'&&!paper&&{
          audioAssetHash:record.package.audioManifest?.sha256,
          audioEofAtMs:payload.eofAt??undefined,heardMs:Math.round(payload.heardSeconds*1_000)
        },...details}},persistNow);
    } catch {}
  }
  let reportOutbox;
  async function close(){
    if(stopped)return;
    reportOutbox?.close();
    stopped=true;clearInterval(timer);window.removeEventListener('online',onOnline);
    stopJournalReconnect?.();
    if(playing?.checkpoint)await playing.checkpoint().catch(()=>{});
    playing?.stop();
    preparedPlayer?.release();
    release();
  }

  try {
    record=await store.get(key);
    if(record&&!currentDemoRecord(record,scope.classCode,slug,scope.studentRef)){await close();return null;}
    const wasReady = Boolean(record?.ready);
    if (!record?.ready) {
      if(!prepare || navigator.onLine===false){await close();return null;}
      record ||= {deviceProof:hex(crypto.getRandomValues(new Uint8Array(32))),sections:{},drafts:{},revisions:{},pending:[],receipts:{},
        ...(scope.classCode==='CODEXDEMO806'?{demoResetSignal:demoResetSignal(scope.classCode,scope.studentRef,slug)}:{})};
      await save();
      let value;
      try {value=await send('prepare',{classCode:scope.classCode,studentRef:scope.studentRef},null);}
      catch(error){if(error.status===404||error.code==='OFFLINE_NEW_DISABLED'){await close();return null;}throw error;}
      if(value.version!==version||value.examSessionToken!==scope.examSessionToken||value.studentRef!==scope.studentRef
          ||value.generation!==scope.generation||!id(value.attemptToken)||value.activatedAt!==null)throw new Error('Bản đề chưa khớp lượt được cấp.');
      if(value.continuationSection!==scope.continuationSection
          ||(value.continuationSection&&(slug!==term1Slug||!['listening','reading','writing'].includes(value.continuationSection)))){
        throw new Error('Bản đề chưa khớp phần thi được cấp.');
      }
      const {audioDownload,...bundle}=value;
      const manifest=bundle.audioManifest;
      const refresh=writing&&!pagesOnly?async()=>{
        let renewed;
        try{renewed=await send('prepare',{classCode:scope.classCode,studentRef:scope.studentRef},null);}
        catch(error){if(!error.status||error.status>=500)error.audioRefreshUnavailable=true;throw error;}
        if(renewed.version!==version||renewed.examSessionToken!==scope.examSessionToken||renewed.generation!==scope.generation
            ||renewed.studentRef!==scope.studentRef||renewed.audioManifest?.sha256!==manifest.sha256){
          throw Object.assign(new Error('Quyền tải audio đã thay đổi.'),{status:403});
        }
        return {manifest:renewed.audioManifest,download:renewed.audioDownload};
      }:undefined;
      if(!bundle.continuationSection||bundle.continuationSection==='listening'){
        const blob=await downloadTermAudio(slug,{pagesUrl:manifest.url,sha256:manifest.sha256,bytes:manifest.byteLength},
        {audioDownload:pagesOnly?undefined:audioDownload,refresh,onProgress,onPhase});
        onPhase?.('Đang kiểm tra bản audio đã lưu trên thiết bị…');
        await store.put(key+':audio',{blob});
        const stored=await store.get(key+':audio');
        if (!(stored?.blob instanceof Blob) || stored.blob.size!==manifest.byteLength || await hash(await stored.blob.arrayBuffer())!==manifest.sha256) {
          throw new Error('Không đọc lại được audio trên thiết bị.');
        }
        verifiedBlob=stored.blob;
        if(!paper&&bundle.listeningContinuityVersion===1){
          observe('audio_download_verified',{byteLength:stored.blob.size});
          onPhase?.('Đang chuẩn bị trình phát…');
          preparedPlayer=prepareContinuityAudio(stored.blob,observe);
        }
      }
      onPhase?.('Đang kiểm tra khả năng làm bài khi mất mạng…');
      await cacheShell(OfflineRuntime,slug);
      if(!currentDemoRecord(record,scope.classCode,slug,scope.studentRef)){
        throw new Error('Lượt demo vừa được đặt lại. Hãy mở lại bài từ danh sách.');
      }
      record.package=bundle;record.ready=true;
      await save();
    } else if (slug===term1Slug && scope.continuationSection && !continuationSection() && navigator.onLine!==false) {
      const original = record.package;
      const section = original.examMode==='read_first' ? 'reading' : 'listening';
      const pending = pendingHead();
      const rejected = confirmProgress && pending && record.officialConflict===pending.operationId;
      if (!original.term1ParallelEntry || scope.continuationSection!==section
          || (pending && !rejected) || Object.keys(record.receipts).length) {
        throw new Error('Bản đã lưu chưa khớp phần thi còn mở. Bài làm vẫn được giữ trên thiết bị.');
      }
      const updated = await send('prepare',{classCode:scope.classCode,studentRef:scope.studentRef},null);
      if (updated.version!==version || updated.examSessionToken!==scope.examSessionToken
          || updated.generation!==scope.generation || updated.studentRef!==scope.studentRef
          || updated.attemptToken!==original.attemptToken || updated.continuationSection!==section
          || updated.activatedAt!==(record.activatedAt??null) || updated.audioManifest?.sha256!==original.audioManifest?.sha256) {
        throw new Error('Máy chủ chưa xác nhận lại đúng bản đề và đồng hồ. Nháp trên thiết bị vẫn được giữ.');
      }
      record.package = {...original,continuationSection:section,examMode:updated.examMode,permit:updated.permit};
      if (rejected) {
        const archived = [...record.pending,...record.readingReview?[record.readingReview]:[]];
        (record.archivedRejectedOperations ||= []).push(...archived);
        for (const item of archived) {
          const snapshot = record.sections[item.section];
          if (snapshot?.operationId===item.operationId) delete snapshot.operationId;
        }
        record.pending = [];
        delete record.readingReview;
        delete record.officialConflict;
        delete record.review;
      }
      await save();
    }
    if (wasReady && slug===term1Slug && !pagesOnly && navigator.onLine!==false
        && !navigator.serviceWorker?.controller?.scriptURL.includes('/offline-worker-student-cache-v2.js?')) {
      // Keep the verified draft and clock usable while the browser checks the new shell.
      void cacheShell(OfflineRuntime,slug).catch(()=>{
        observe('offline_shell_update_failed',{errorCode:'OFFLINE_SHELL_UPDATE_FAILED'});
      });
    } else if (wasReady && pagesOnly && navigator.onLine!==false && !navigator.serviceWorker?.controller) {
      // A native attempt already prepared from the primary link can also enter from the rescue link.
      // Keep the verified attempt accessible even if this route's secondary shell cannot be installed now.
      await cacheShell(OfflineRuntime,slug).catch(()=>{});
    }
    window.addEventListener('online',onOnline);
    timer=setInterval(flush,5_000);
  } catch(error){await close();throw error;}

  let mono=performance.now();
  let epoch=record.clock?.epoch??record.package.serverNow;
  if(record.clock){
    const passed=Date.now()-record.clock.wall;
    if(passed<0||passed>72*60*60*1_000)record.clockInvalid=true;
    else epoch+=passed;
  }
  const now = () => Math.floor(epoch+Math.max(0,performance.now()-mono));
  const persist = () => {record.clock={epoch:now(),wall:Date.now()};return save();};
  const readingDeadlineReview=record.package.readingDeadlineReviewVersion===1;
  const submissionReadback=writing||readingDeadlineReview;
  let durableReadingEvidence=record.readingEvidence;
  const tracksDeadline=section=>section==='writing'?writing:section==='reading'&&readingDeadlineReview;

  function pendingHead(){
    const first=record.pending[0];
    return record.readingReview&&(!first||first.section==='writing'||record.package.examMode==='read_first')?record.readingReview:first;
  }

  function view(){
    const p=record.package;
    const l=record.sections.listening,r=record.sections.reading,w=record.sections.writing;
    const listeningInterrupted=Boolean(l?.interrupted||p.listeningInterrupted);
    const listeningSubmitted=!listeningInterrupted&&(Boolean(l?.operationId)||['reading','writing'].includes(p.continuationSection));
    const readingSubmitted=Boolean(r?.operationId)||['listening','writing'].includes(p.continuationSection);
    return {ok:true,studentName:p.studentName,...(paper?{className:p.className,examDelivery:'answer_sheet'}:{}),
      examSessionToken:p.examSessionToken,attemptToken:p.attemptToken,generation:p.generation,
      examMode:p.examMode,nextSection:next(),listeningSubmitted,
      ...(p.term1ParallelEntry?{term1ParallelEntry:true}:{}),
      ...(p.continuationSection?{continuationSection:p.continuationSection}:{}),
      listeningInterrupted,needsListeningAcknowledgment:Boolean(l?.interrupted&&!l.acknowledged),
      readingSubmitted,completed:(listeningSubmitted||listeningInterrupted)&&readingSubmitted,
      ...(writing?{writingStarted:Boolean(w?.startedAt),writingSubmitted:Boolean(w?.operationId),
        writingDeadlineAt:w?.deadline?new Date(w.deadline).toISOString():null}:{}),
      readingStartedAt:r?.startedAt?new Date(r.startedAt).toISOString():null,readingDeadlineAt:r?.deadline?new Date(r.deadline).toISOString():null,
      listeningStartedAt:l?.startedAt?new Date(l.startedAt).toISOString():null,listeningDeadlineAt:l?.deadline?new Date(l.deadline).toISOString():null,
      readingDraft:record.drafts.reading||{},readingDraftRevision:record.revisions.reading||0,
      serverNow:new Date(now()).toISOString(),portalSyncStatus:'not_applicable',localOnly:Boolean(pendingHead())};
  }

  async function begin(){
    if(record.activatedAt)return view();
    const result=await send('begin',{});
    if(result.version!==version||result.examSessionToken!==scope.examSessionToken||result.generation!==scope.generation
        ||!Number.isSafeInteger(result.activatedAt))throw new Error('Chưa xác nhận được mốc mở bài.');
    record.activatedAt=result.activatedAt;epoch=Math.max(result.activatedAt,result.serverNow||0);mono=performance.now();
    // The first skill's clock starts at the server activation, even after a lost reply.
    await start(order()[0],record.activatedAt);
    return view();
  }

  async function start(section,at=now()){
    if(!record.activatedAt||next()!==section||view().needsListeningAcknowledgment)throw new Error('Hãy hoàn thành phần trước.');
    if(!record.sections[section]){
      record.sections[section]={startedAt:at,...(section==='listening'?{position:0,playbackConfirmed:false}:
        {deadline:at+record.package.timing[section+'DurationMinutes']*60_000})};
      await persist();
      if (tracksDeadline(section)) {
        await saveDeadlineEvidence(section,record.drafts[section]||{},record.revisions[section]||0);
      }
    }
    return view();
  }

  async function saveDeadlineEvidence(skill, draft, revision){
    const savedAt=now(), section=record.sections[skill];
    if (!section || section.operationId || record.clockInvalid || savedAt>section.deadline) return;
    if ((record.revisions[skill]||0)!==revision) return;
    const key=skill+'Evidence';
    const previous=record[key];
    const evidence={revision,savedAt,answers:structuredClone(draft)};
    record[key]=evidence;
    try{
      await persist();
      if(skill==='reading')durableReadingEvidence=evidence;
    }catch{
      if (record[key]===evidence) record[key]=previous;
    }
  }

  async function saveDrafts(drafts,revisions){
    if(stopped)return;
    const section=next();
    if(section==='result'||!record.sections[section])return;
    const draft=drafts[section]||{};
    const revision=Number(revisions[section])||0;
    if(revision < (record.revisions[section]||0) || (revision===(record.revisions[section]||0)&&JSON.stringify(draft)===JSON.stringify(record.drafts[section]||{})))return;
    const prior=record.drafts[section],priorRevision=record.revisions[section];
    const saved=structuredClone(draft);
    record.drafts[section]=saved;record.revisions[section]=revision;
    try{await persist();}catch(error){
      if(record.drafts[section]===saved){
        if(prior===undefined)delete record.drafts[section];else record.drafts[section]=prior;
        if(priorRevision===undefined)delete record.revisions[section];else record.revisions[section]=priorRevision;
      }
      throw error;
    }
    if (tracksDeadline(section) && record.drafts[section]===saved) {
      await saveDeadlineEvidence(section,saved,revision);
    }
    if(paper&&!record.pending.length)notify('Đã lưu nháp trên máy');
    return true;
  }

  async function seal(section,answers,revision,automatic){
    const s=record.sections[section];
    if(s?.interrupted||view().needsListeningAcknowledgment)throw new Error('Hãy xác nhận Listening đã gián đoạn.');
    if(s?.operationId)return view();
    if(savingOperation)throw new Error('Đang lưu kết quả của lượt.');
    if(stopped||next()!==section||!s?.startedAt)throw new Error('Chưa bắt đầu phần này.');
    if(record.clockInvalid)throw new Error('Chưa xác nhận được giờ thi. Nháp vẫn được giữ trên máy.');
    const captured=now();
    if(automatic && (!s.deadline||captured<s.deadline||(section==='listening'&&(!s.eofAt||!playing?.reviewComplete())))) {
      throw new Error('Chưa đủ điều kiện tự nộp bài.');
    }
    const evidence=section==='reading'?durableReadingEvidence:record.writingEvidence;
    const timedAuto=tracksDeadline(section)&&automatic;
    const proven=timedAuto&&evidence&&Number.isSafeInteger(evidence.revision)
      &&Number.isSafeInteger(evidence.savedAt)&&evidence.savedAt>=s.startedAt&&evidence.savedAt<=s.deadline;
    const reviewReading=timedAuto&&section==='reading'&&!proven;
    if (timedAuto && section==='writing' && !proven && captured===s.deadline) {
      throw new Error('Chưa có bản Writing xác nhận lưu trước hạn. Đang giữ bài để đối soát.');
    }
    const preceding=order()[order().indexOf(section)-1];
    const payload={...owner,operationId:crypto.randomUUID(),section,previousOperationId:preceding?record.sections[preceding].operationId:null,
      startedAt:s.startedAt,capturedAt:automatic&&(!timedAuto||proven)?s.deadline:captured,
      revision:proven?evidence.revision:Number(revision)||0,automatic,
      eofAt:section==='listening'?s.eofAt||null:null,heardSeconds:section==='listening'?s.position||0:0,
      answers:ordered(proven?evidence.answers:answers||{})};
    if (proven && JSON.stringify(payload.answers)!==JSON.stringify(ordered(answers||{}))) {
      record[section+'UnverifiedDraft']={answers:structuredClone(answers||{}),revision:Number(revision)||0,observedAt:captured};
    }
    if (timedAuto) observeSubmission(section+(proven?'_deadline_revision_verified':'_deadline_revision_unproven'),payload,
      {observedAtMs:captured,...proven&&{draftSavedAtMs:evidence.savedAt}});
    if(section==='listening'&&continuity()&&!automatic){
      observe('listening_early_submit_confirmed',{operationId:payload.operationId});
      playing?.pauseForSubmit?.();
    }
    await storeOperation(s,payload,reviewReading);
    if(section==='listening'){
      if(continuity())observe('listening_local_collected',{operationId:payload.operationId});
      playing?.stop();playing=null;
    }
    notify(pendingMessage());void flush();return view();
  }

  async function storeOperation(section,payload,reviewReading=false,reportId){
    const {section:skill}=payload;
    const previousDraft=record.drafts[skill], previousRevision=record.revisions[skill];
    const interrupted=payload.outcome==='interrupted';
    savingOperation=true;
    section.operationId=payload.operationId;
    if(interrupted)section.interrupted=true;
    if(reportId)section.reportId=reportId;
    // Older clients only send entries in pending. Keep this snapshot out of that queue.
    if(reviewReading)record.readingReview=payload;
    else record.pending.push(payload);
    if(!interrupted){
      record.drafts[skill]=payload.answers;
      record.revisions[skill]=payload.revision;
    }
    observeSubmission('submission_sealed',payload,{},false);
    try{
      await persist();
      observeSubmission('submission_device_saved',payload);
    }
    catch(error){
      if(reviewReading)delete record.readingReview;
      else record.pending.splice(record.pending.indexOf(payload),1);
      delete section.operationId;
      if(reportId)delete section.reportId;
      if(interrupted)delete section.interrupted;
      else {
        if(previousDraft===undefined)delete record.drafts[skill];else record.drafts[skill]=previousDraft;
        if(previousRevision===undefined)delete record.revisions[skill];else record.revisions[skill]=previousRevision;
      }
      observeSubmission('submission_device_save_failed',payload);
      throw error;
    }finally{savingOperation=false;}
  }

  async function interrupt(reason,report){
    const section=record.sections.listening;
    if(section?.interrupted)return view();
    if(!continuity()||savingOperation||!section?.startedAt||section.operationId||section.eofAt||next()!=='listening')
      throw new Error('Listening đã có kết quả.');
    const preceding=order()[order().indexOf('listening')-1];
    const reportId=reason==='learner_report'?report?.reportId:undefined;
    const payload={...owner,operationId:reportId??crypto.randomUUID(),section:'listening',
      previousOperationId:preceding?record.sections[preceding].operationId:null,
      startedAt:section.startedAt,capturedAt:now(),revision:record.revisions.listening||0,
      automatic:false,eofAt:null,heardSeconds:0,answers:{},outcome:'interrupted'};
    await storeOperation(section,payload,false,reportId);
    observe('listening_interrupted',{operationId:payload.operationId,reason});
    if(reportId){
      observeReport('report_interruption_device_saved',{reportVersion:2,reportId,operationId:payload.operationId});
      if(report.evidence)void reportOutbox?.add(payload.operationId,report.evidence);
    }
    playing?.stop();playing=null;
    preparedPlayer?.release();preparedPlayer=null;
    notify('Listening gián đoạn đã lưu trên máy · Chờ đồng bộ');
    void flush();
    return view();
  }

  async function acknowledgeInterruption(){
    const section=record.sections.listening;
    if(!section?.interrupted)throw new Error('Chưa lưu được trạng thái gián đoạn.');
    section.acknowledged=true;
    try{await persist();}
    catch(error){delete section.acknowledged;throw error;}
    return view();
  }

  function hasSubmissionHold(pending){
    if(!submissionReadback||!pending)return false;
    const held=pending.section==='writing'?record.writingHold:record.lrHolds?.[pending.section];
    return held?.expiresAt>now()&&held.operationId===pending.operationId;
  }

  async function rememberSubmissionHold(pending, held, payloadHash){
    if (!submissionReadback || held?.payloadHash!==payloadHash
        || !Number.isSafeInteger(held.heldAt) || !Number.isSafeInteger(held.expiresAt) || held.expiresAt<=held.heldAt) return false;
    const metadata={...held,operationId:pending.operationId};
    if(pending.section==='writing')record.writingHold=metadata;
    else (record.lrHolds||={})[pending.section]=metadata;
    await persist().catch(()=>{});
    return true;
  }

  function pendingMessage(){
    const pending=submissionReadback?pendingHead():null;
    if (record.officialConflict && pending?.operationId===record.officialConflict) {
      return 'Máy chủ đã có tiến độ chính thức. Bản trên thiết bị vẫn được giữ.';
    }
    const review=record.review||Boolean(record.readingReview&&pending===record.readingReview);
    const reference=review&&pending?` · Mã đối soát ${pending.operationId}`:'';
    if (hasSubmissionHold(pending)) return 'Máy chủ đã giữ bản để đối soát'+reference;
    return review?'Bài vẫn lưu trên máy · Cần đối soát'+reference:'Đã lưu trên máy · Chờ đồng bộ';
  }

  async function flush(){
    if(stopped||savingOperation)return;
    drainDiagnostics();
    if(busy||!pendingHead())return;
    const reviewReadback=record.review&&submissionReadback;
    if(record.review)notify(pendingMessage());
    if(navigator.onLine===false||performance.now()<retryAt||(record.review&&!reviewReadback))return;
    busy=true;
    try{
      while(!stopped&&!savingOperation&&pendingHead()){
        const pending=pendingHead();
        const readingReview=pending===record.readingReview;
        const payloadHash=await hash(text.encode(JSON.stringify(pending)));
        const checked=(submissionReadback||paper)?await send('status',{section:pending.section,operationId:pending.operationId}):null;
        if (checked?.held && await rememberSubmissionHold(pending,checked.held,payloadHash)) {
          notify(pendingMessage());
          if(readingReview){
            retryAt=performance.now()+60_000;
            return;
          }
        }
        if (record.review && !checked?.persisted) {
          retryAt=performance.now()+60_000;
          return;
        }
        let result;
        try {
          result=checked?.persisted?checked:await send(readingReview?'reading-review':pending.outcome==='interrupted'?'interrupt':'seal',pending);
        } catch (error) {
          if(error.held)await rememberSubmissionHold(pending,error.held,payloadHash);
          const retryKey=pending.section==='writing'?'writingRetry':'lrRetry';
          const priorRetries=record[retryKey]?.operationId===pending.operationId?record[retryKey].count:0;
          if (!readingReview && error.status===409 && error.reasonCode==='SERVER_BEFORE_DEADLINE' && Number.isSafeInteger(error.retryAfterMs)
              && error.retryAfterMs>0 && error.retryAfterMs<=3_000 && priorRetries<3) {
            record[retryKey]={operationId:pending.operationId,count:priorRetries+1};
            await persist().catch(()=>{});
            retryAt=performance.now()+error.retryAfterMs;
            notify(pendingMessage());
            return;
          }
          throw error;
        }
        const receipt=result.receipt;
        if(stopped)return;
        if(receipt?.version!==version||receipt.examSessionToken!==scope.examSessionToken||receipt.generation!==scope.generation
            ||receipt.section!==pending.section||receipt.operationId!==pending.operationId||receipt.outcome!==pending.outcome||!id(receipt.attemptToken)
            ||receipt.payloadHash!==payloadHash)throw new Error('Biên nhận không khớp bản đã lưu.');
        record.receipts[pending.section]=receipt;
        if(readingReview)delete record.readingReview;
        else record.pending.shift();
        const wasReview=record.review;
        const officialConflict=record.officialConflict;
        if(wasReview)delete record.review;
        if (officialConflict===pending.operationId) delete record.officialConflict;
        try{await persist();}catch(error){
          if(readingReview)record.readingReview=pending;
          else record.pending.unshift(pending);
          delete record.receipts[pending.section];
          if(wasReview)record.review=wasReview;
          if(officialConflict) record.officialConflict=officialConflict;
          throw error;
        }
        observeSubmission('submission_receipt_verified',pending,{via:checked?.persisted?'readback':'send'});
        if(continuity()&&pending.section==='listening')
          observe('listening_server_received',{operationId:pending.operationId,outcome:pending.outcome||'submitted'});
        if(pending.outcome==='interrupted'&&record.sections.listening?.reportId===pending.operationId)
          observeReport('report_interruption_server_received',{reportVersion:2,reportId:pending.operationId,
            operationId:pending.operationId,payloadHash:receipt.payloadHash,
            ...(receipt.receiptId?{receiptId:receipt.receiptId}:{})});
        if(pendingHead())notify(pendingMessage());
      }
      if(!pendingHead())notify('Máy chủ đã xác nhận nhận bài');
    }catch(error){
      const reviewRouteMissing=error.status===404&&record.readingReview&&record.readingReview===pendingHead();
      retryAt=performance.now()+(reviewReadback||reviewRouteMissing?60_000:10_000);
      if([400,401,403,409,422].includes(error.status)){
        if (record.package.term1ParallelEntry && error.code==='EXAM_FIRST_SUBMISSION_ACCEPTED' && pendingHead()) {
          record.officialConflict=pendingHead().operationId;
        }
        record.review=true;await persist().catch(()=>{});
      }
      notify(pendingMessage());
    }finally{busy=false;}
  }

  async function verifiedAudio(){
    if(verifiedBlob)return verifiedBlob;
    const stored=await store.get(key+':audio');
    const manifest=record.package.audioManifest;
    if (!(stored?.blob instanceof Blob)||stored.blob.size!==manifest.byteLength||await hash(await stored.blob.arrayBuffer())!==manifest.sha256) {
      throw new Error('Audio trên máy chưa khớp. Bài vẫn được giữ.');
    }
    verifiedBlob=stored.blob;
    if(continuity())observe('audio_download_verified',{byteLength:verifiedBlob.size});
    return verifiedBlob;
  }

  async function preparePlayer(){
    if(preparedPlayer)return preparedPlayer;
    if(!preparingPlayer)preparingPlayer=verifiedAudio().then(blob=>{
      if(stopped)throw new Error('Đã đóng lượt Listening.');
      preparedPlayer=prepareContinuityAudio(blob,observe);
      return preparedPlayer;
    }).finally(()=>{preparingPlayer=null;});
    return preparingPlayer;
  }

  async function mountPlayer({autoplay=false,...options}){
    const section=record.sections.listening;
    if(playing||next()!=='listening'||!section)return;
    const timing=record.package.timing;
    const mountContinuity=reportOutbox?mountTerm1ListeningPlayer:mountContinuityListeningPlayer;
    const player=continuity()
      ? mountContinuity({...options,attachReport:reportOutbox?options=>attachListeningReportChoices({slug,...options,assetHash:record.package.audioManifest?.sha256,observe:observeReport}):undefined,section,timing,now,persist,observe,
          observeDecision:observeListeningDecision,
          onPlaying:() => {
            section.playbackConfirmed=true;
            void persist().catch(() => observe('audio_diagnostic',{event:'playback_marker_save_failed'}));
            options.onPlaying?.();
          },
          entry:section.eofAt?null:await preparePlayer()})
      : await mountOfflineListeningPlayer({...options,section,timing,verifiedAudio,now,persist});
    if(!player)return;
    playing=player;
    if(autoplay)playing.playFromStart();
  }

  async function download(liveDraft=null){
    const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const pendingOperations=[...record.pending,...record.readingReview?[record.readingReview]:[]];
    const pendingHashes=submissionReadback?new Map(await Promise.all(pendingOperations.map(async item=>[
      item.operationId,await hash(text.encode(JSON.stringify(item))).catch(()=>null)
    ]))):null;
    const body=order().map(section=>{
      const progress=record.sections[section];
      const pending=pendingOperations.find(item=>item.section===section);
      const receipt=record.receipts[section];
      const status=progress?.interrupted
        ? (record.receipts[section]?'Listening gián đoạn · Máy chủ đã nhận':'Listening gián đoạn · Chờ đồng bộ')
        : receipt?'Máy chủ đã nhận':hasSubmissionHold(pending)?'Máy chủ đã giữ bản để đối soát':
        pending&&(pending===record.readingReview||(pending===pendingHead()&&record.review))?'Đã lưu trên máy · Cần đối soát':
        progress?.operationId?'Đã lưu trên máy · Chờ đồng bộ':
        progress?'Đang làm':'Chưa bắt đầu';
      const started=progress?.startedAt?` · Bắt đầu ${new Date(progress.startedAt).toISOString()}`:'';
      const operation=pending||receipt;
      const reference=submissionReadback&&operation?` · Mã đối soát ${escape(operation.operationId)} · Giờ chốt ${new Date(operation.capturedAt).toISOString()}`:'';
      const digest=submissionReadback&&(receipt?.payloadHash||pendingHashes.get(pending?.operationId));
      const answers=paper&&liveDraft&&next()===section?liveDraft:record.drafts[section]||{};
      return `<h2>${section}</h2><dl>`+Object.entries(answers).map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')+
        `</dl><p>${status}${started}${reference}${digest?' · SHA-256 '+escape(digest):''}</p>`;
    }).join('');
    const extra=['Reading','Writing'].map(skill=>{
      const unverified=submissionReadback&&record[skill.toLowerCase()+'UnverifiedDraft'];
      return unverified?'<h2>Bản '+skill+' giữ thêm để đối soát</h2><dl>'+Object.entries(unverified.answers)
        .map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')+'</dl>':'';
    }).join('');
    const rejected = (record.archivedRejectedOperations || []).map(item =>
      `<h2>Bản ${escape(item.section)} đã gửi trước khi đồng bộ</h2><p>Mã đối soát ${escape(item.operationId)}</p><dl>`
      + Object.entries(item.answers).map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')+'</dl>').join('');
    const html='<!doctype html><html lang="vi"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><title>Bài làm '+title+'</title><h1>Bài làm '+title+'</h1>'+body+extra+rejected+'</html>';
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=title.replaceAll(' ','-')+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),30_000);
  }
  const continuationReceipt=()=>record.receipts[continuationSection()]||null;
  const resultToken=()=>continuationSection()?null:(record.receipts[order().at(-1)]?.attemptToken||null);
  const hasReceipt = paper ? Boolean(resultToken()) : Object.keys(record.receipts).length > 0;
  if (record.review || pendingHead()) notify(pendingMessage());
  else if (hasReceipt) notify('Máy chủ đã xác nhận nhận bài');
  else if (paper) notify('Tự lưu trên thiết bị');
  void flush();
  if(slug==='term-test-1'&&!paper)reportOutbox=createListeningReportOutbox({slug,mode:'journey',
    sessionId:scope.examSessionToken,generation:scope.generation,observe:observeReport,
    send:input=>sendListeningReport({apiBase:globalThis.TERM_TEST_APP_CONFIG.API_BASE_URL,slug,
      body:{...input,deviceProof:record.deviceProof},permit:record.package.permit})});
  return {content:record.package.content,paper,view,start,begin,observeReport,saveDrafts,seal,mountPlayer,verifiedAudio,download,resultToken,continuationReceipt,needsAudio,now,
    officialConflict:()=>Boolean(record.officialConflict && pendingHead()?.operationId===record.officialConflict),
    activated:()=>Boolean(record.activatedAt),drafts:()=>structuredClone(record.drafts),revisions:()=>({...record.revisions}),close,changed,
    message:()=>message,reviewComplete:()=>playing?.reviewComplete()===true,
    continuity,preparePlayer,interrupt,acknowledgeInterruption,setJournal,connectJournal,markListeningStart,
    listeningPlaybackConfirmed:()=>record.sections.listening?.playbackConfirmed!==false,
    listeningReviewStarted:()=>Boolean(record.sections.listening?.eofAt)};
}
