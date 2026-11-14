import { IndexedOutbox } from './outbox.mjs';
import { createRecorder,fetchTransport,observeDocument,observeAudio,viewportSnapshot } from './recorder.mjs?v=20261109-term1-writing-v1';
import {createAudioTransferObserver} from './audio-delivery.mjs?v=20261024-startup-v2';

const copy = value => JSON.parse(JSON.stringify(value));
const registryKey=Symbol.for('izone.examJournal.connections.v1');
const listeningEndDecisions=new Set(['metadata_unavailable','duration_mismatch','position_outside_end','review_started','review_confirmed',
  'eof_storage_failed','review_restored','eof_sync_failed']);
const listeningEndClocks=new Set(['saved_end','media_end_sample','media_end_estimate','server_ack']);
const listeningStartPhases=new Set(['start_requested','play_requested','play_resolved','start_rejected',
  'start_discarded','answers_unlocked']);
const listeningStartReasons=new Set(['phase_or_player_unavailable','play_not_allowed','play_failed',
  'scope_changed_before_play','scope_changed_after_play']);
const listeningEndNumber=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=86400;
const listeningEndTime=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value));
export function safeRoute(path) {
  try { return new URL(path,globalThis.location?.href || 'https://fixture.invalid').pathname
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,':id').slice(0,240); } catch { return 'unknown'; }
}
export function projectState(state) {
  const result = {};
  for (const key of ['stage','examMode','nextSection','completed','readingSubmitted','listeningSubmitted','writingSubmitted',
    'writingStarted','writingRevision','writingAckRevision','draftRevisions','draftAckRevisions','listeningDeadlineAt','readingDeadlineAt','writingDeadlineAt'])
    if (state[key] !== undefined) result[key] = state[key];
  result.pendingSubmissions = Object.fromEntries(Object.entries(state.pendingSubmissions || {}).map(([key,value]) => [key,
    {clientSubmissionId:value?.clientSubmissionId || '',phase:value?.phase || '',revision:value?.revision ?? null}]));
  return copy(result);
}
export function contentFields(state) {
  const fields = [];
  for (const section of ['listening','reading']) for (const [question,value] of Object.entries(state.drafts?.[section] || {}))
    fields.push([section + ':q' + question,Array.isArray(value) ? JSON.stringify(value) : String(value ?? '')]);
  for (const [task,value] of Object.entries(state.drafts?.writing || {})) {
    if (typeof value === 'string') fields.push(['writing:' + task,value]);
    else if (task === 'outlines' && value && typeof value === 'object')
      for (const [id,text] of Object.entries(value)) fields.push(['writing:outline:' + id,String(text ?? '')]);
  }
  return fields;
}

// Nhận state qua callback chỉ đọc. Không thay fetch/confirm toàn cục, timer hoặc điều khiển bài thi.
export function connectExamJournal({ enabled = false,endpoint,getState,testSlug,build = 'unknown',
  document:doc = globalThis.document,window:win = globalThis.window,onHealth = () => {},outbox:providedOutbox,fetcher = globalThis.fetch,adoptExistingState=true,submissionMetadataOnly=false,substituteStartTrace=false }) {
  if (!enabled || win?.IZONE_EXAM_DEVICE_BLOCKED) return null;
  const target = new URL(endpoint,win.location.href);
  if (!['http:','https:'].includes(target.protocol) || target.search || target.hash || target.username || target.password) throw new Error('INVALID_JOURNAL_ENDPOINT');
  const connectionKey=JSON.stringify([target.href,testSlug]),existing=win[registryKey]?.get(connectionKey);
  const k67Metadata=['term-test-1','term-test-2','mini-test-lesson-5'].includes(testSlug)
    &&win.location.pathname.split('/').some(segment=>segment===testSlug||segment===testSlug+'-computer-based');
  const path = new URL(win.location.href).pathname.split('/');
  const fallbackSkill = testSlug==='term-test-1-k56' && target.pathname.endsWith('/skill-fallback')
    ? path.map(segment=>/^term-test-1-k56-(listening|reading|writing)-fallback$/.exec(segment)?.[1]).find(Boolean) : null;
  const scopedK56=Boolean(fallbackSkill)||['term-test-1-k56','term-test-2-k56','mini-test-k56'].includes(testSlug)
    &&path.some(segment=>segment===testSlug+'-computer-based'||segment===testSlug);
  const scopedSubstitute=/^substitute-test-[12]-k(?:56|67)$/.test(testSlug)
    && win.location.pathname.split('/').includes(testSlug+'-computer-based');
  const metadataOnly=k67Metadata||((scopedK56||scopedSubstitute)&&submissionMetadataOnly===true);
  if(existing&&(!metadataOnly||existing.metadataOnlySubmission)&&(!scopedK56||existing.recordK56Submission)
    &&(!substituteStartTrace||existing.substituteStartTraceVersion===2))
    return adoptExistingState?existing.adopt(getState):existing;
  if(existing)void existing.stop().catch(()=>{});
  const outbox = providedOutbox || new IndexedOutbox({ name:'izone-exam-journal-v2:' + target.origin + target.pathname
    + (metadataOnly?':submission-metadata-v1':'') });
  const visitId = crypto.randomUUID(); let current = null,ownerKey = '',requesting = '',lastProjection = '',nextContextTry = 0,stopped = false,unobservedSince=performance.now(),previousFields=new Set();
  const sampleTerm1Writing = testSlug === 'term-test-1-k56'
    && /\/term-test-1-k56-computer-based(?:\/|$)/.test(win.location.pathname);
  const sampleWritingInput = fieldId => sampleTerm1Writing && fieldId === 'writing:task2';
  const audioStops = new Map();
  let stopOfficialDiagnostics = null;
  let diagnosticPlayer = null, diagnosticOwner = null;
  const recordedListeningEnds=new WeakMap();
  const bindingRequests=new Map(),bindingCache=new Map(),audioPending=new Set();let audioPendingBytes=0;
  const health = data => {
    if (data.pendingReauthorization && data.expiredBindingId === current?.bindingId) {current=null;nextContextTry=0;}
    try { onHealth(data); } catch {}
  };
  const recorder = createRecorder({ outbox,context:() => current,
    transport:fetchTransport(target.href + '/journal-events',fetcher),build:String(build).slice(0,80)+'+startup-20261024-v2',onHealth:health });
  const proofOf = state => ({ testSlug,classCode:String(state.classCode || state.className || ''),
    attemptToken:String(metadataOnly&&state.examSessionToken?'':state.attemptToken || ''),examSessionToken:String(state.examSessionToken || ''),
    clientRunId:String(state.clientRunId || ''),examSessionId:String(state.examSessionId || ''),historyEpoch:String(state.historyEpoch || state._substitute?.historyEpoch || ''),
    generation:Number(state.generation || 0),pageVisitId:visitId,...(fallbackSkill?{skillFallback:fallbackSkill}:{}) });
  const capturedBinding=context=>({bindingId:context.bindingId,auth:{ticket:context.ticket,ticketId:context.ticketId,issuedAt:context.issuedAt,expiresAt:context.expiresAt},versions:context.versions||{}});
  const audioRecord=(type,data,binding)=>{try{const work=recorder.record(type,data,binding);if(work?.catch)void work.catch(()=>health({status:'gap',errorCode:'JOURNAL_AUDIO_RECORD_FAILED'}));}catch{health({status:'gap',errorCode:'JOURNAL_AUDIO_RECORD_FAILED'});}};
  async function loadBinding(proof){
    if(stopped)throw Error('JOURNAL_STOPPED');const key=JSON.stringify(proof),cached=bindingCache.get(key);
    if(cached&&Number(cached.expiresAt)>Date.now()+5000)return cached;
    if(bindingRequests.has(key))return bindingRequests.get(key);
    if(bindingRequests.size>=8)throw Error('JOURNAL_CONTEXT_QUEUE_FULL');
    const work=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1500);
      try{
        const response=await fetcher(target.href+'/journal-context',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(proof),credentials:'omit',cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error('JOURNAL_CONTEXT_UNAVAILABLE');const context=await response.json();
        if(stopped)throw Error('JOURNAL_STOPPED');
        if(!context.ok||!/^[a-f0-9]{64}$/.test(context.bindingId||'')||typeof context.ticket!=='string'||!context.ticketId)throw Error('JOURNAL_CONTEXT_INVALID');
        // Native authority comes from the API. Slow local ticket storage must not hide
        // observations; IndexedDB serializes renewal before subsequent writes.
        try{void Promise.resolve(outbox.renewBinding(context.bindingId,{ticket:context.ticket,ticketId:context.ticketId,issuedAt:context.issuedAt,expiresAt:context.expiresAt}))
          .catch(()=>health({status:'degraded',errorCode:'JOURNAL_OUTBOX_CONTEXT_UNAVAILABLE'}));}
        catch{health({status:'degraded',errorCode:'JOURNAL_OUTBOX_CONTEXT_UNAVAILABLE'});}
        bindingCache.set(key,context);if(bindingCache.size>16)bindingCache.delete(bindingCache.keys().next().value);return context;
      }finally{clearTimeout(timer);}
    })().finally(()=>bindingRequests.delete(key));bindingRequests.set(key,work);return work;
  }
  async function refresh() {
    if (stopped) return;
    let state,proof,key;
    try { state = getState(); proof = proofOf(state); key = JSON.stringify(proof); } catch { return; }
    if (key !== ownerKey) { ownerKey = key; current = null;lastProjection = '';previousFields=new Set();unobservedSince=performance.now(); }
    if (current || requesting === key || Date.now() < nextContextTry) return;
    requesting = key;
    try {
      const context = await loadBinding(proof);
      if (stopped || key !== JSON.stringify(proofOf(getState())) || key !== ownerKey) return;
      current = capturedBinding(context);
      recorder.record('sequence_gap',{cause:'context_initializing_or_identity_changed',durationMs:performance.now()-unobservedSince,
        checkpointState:{eventCountKnown:false}});
      recorder.record('page_opened',{navigationType:win.performance?.getEntriesByType('navigation')?.[0]?.type || 'unknown',cause:'context_ready'});
      observer.environment();
      attachPlayers();for(const stop of audioStops.values())stop.snapshot('context_ready');
      recorder.record('identity_observed',{identityConfirmed:context.identityConfirmed === true,generation:proof.generation});
      const owner=win.TERM_TEST_BOOTSTRAP;
      if(scopedSubstitute&&owner?.listeningContinuityVersion===1&&owner.continuityReview)
        api.recordListeningEnd(owner,{checkpointState:{telemetryVersion:1,assetId:testSlug,
          decision:'review_restored',clockSource:'saved_end',reviewStartedAt:owner.audioEndedAt,
          reviewDeadlineAt:owner.listeningDeadlineAt}});
      observer.snapshot('context_ready'); stateChanged('context_ready');
      void recorder.flush({force:true});
    } catch { if (ownerKey === key) { nextContextTry = Date.now() + 5000; health({status:'degraded',errorCode:'JOURNAL_CONTEXT_UNAVAILABLE'}); } }
    finally { if (requesting === key) requesting = ''; }
  }
  function stateChanged(cause = 'application_state') {
    try {
      const state = getState(), key = JSON.stringify(proofOf(state));
      if (key !== ownerKey) { current = null;ownerKey = key;lastProjection = '';previousFields=new Set();unobservedSince=performance.now();void refresh();return; }
      if (!current) { void refresh();return; }
      const projected = projectState(state), text = JSON.stringify(projected);
      if (text !== lastProjection) {
        lastProjection = text;recorder.record('state_observed',{cause,checkpointState:projected});
      }
      if(metadataOnly)return;
      const fields=contentFields(state).filter(([fieldId])=>!sampleWritingInput(fieldId));
      const names=new Set(fields.map(row=>row[0]));
      for(const fieldId of previousFields)if(!names.has(fieldId))recorder.content(fieldId,'',{cause:'application_field_removed'});
      for (const [fieldId,value] of fields) recorder.content(fieldId,value,{cause:'application_state'});
      previousFields=names;
    } catch { health({status:'degraded',errorCode:'JOURNAL_STATE_UNAVAILABLE'}); }
  }
  const observer = observeDocument({recorder:metadataOnly?{...recorder,content:()=>{}}:recorder,
    document:doc,window:win,sampleInput:sampleWritingInput,
    resolveField:element => {
      if (!element.matches?.('input,textarea,select,[contenteditable="true"]')) return null;
      const stage = getState().stage || '';
      let fieldId,choiceCard;
      if (element.dataset.writingTask) fieldId = 'writing:' + element.dataset.writingTask;
      else if (element.dataset.writingOutline) fieldId = 'writing:outline:' + element.dataset.writingOutline;
      else {
        const section=element.closest('#readingView') ? 'reading' : element.closest('#listeningView') ? 'listening' : stage;
        const question = /^question-(\d+)$/.exec(element.name || '');
        if (question) fieldId = section + ':q' + question[1];
        else if (['radio','checkbox'].includes(element.type) && (choiceCard=element.closest('[data-question-number]'))) {
          const numbers=[...new Set([...choiceCard.querySelectorAll('[data-number]')].map(field=>field.dataset.number).filter(value=>/^\d+$/.test(value)))].sort((a,b)=>Number(a)-Number(b));
          if (!numbers.length && /^\d+$/.test(choiceCard.dataset.questionNumber || '')) numbers.push(choiceCard.dataset.questionNumber);
          if(numbers.length)fieldId=section+(numbers.length===1?':q'+numbers[0]:':group:'+numbers.map(number=>'q'+number).join(','));
        }
        else if (['studentSelect','bootstrapStudent','studentName','classCode'].includes(element.id)) fieldId = 'identity:' + element.id;
        else if (element.matches('textarea.cbt-note-editor')) fieldId = 'annotations:editor';
      }
      if (!fieldId) return null;
      if(metadataOnly)return {fieldId,stage};
      const groupRoot=choiceCard || element.closest('#readingView,#listeningView') || element.form || doc;
      const group = element.type === 'checkbox' || element.type === 'radio'
        ? [...groupRoot.querySelectorAll('input')].filter(input => input.name === element.name && input.checked).map(input => input.value) : null;
      const text = group ? element.type === 'radio' ? String(group[0] || '') : JSON.stringify(group)
        : String(element.value ?? element.textContent ?? '');
      return {fieldId,text,stage};
    },
    resolveAction:element => {
      const state=getState();
      if(current && element.matches?.('#k67ReportAudio,.cbt-audio-incident') && JSON.stringify(proofOf(state))===ownerKey){
        const official=win.TERM_TEST_BOOTSTRAP?.officialAudioElement;
        audioStops.get(official)?.snapshot('reported_unheard');
      }
      return {action:String(element.dataset.action || element.id || element.getAttribute('name') || element.tagName.toLowerCase()).slice(0,120),
        ...!metadataOnly&&{label:String(element.getAttribute('aria-label') || element.textContent || element.value || '').trim().slice(0,160)},
        stage:String(state.stage || '')};
    } });
  function attachPlayers() {
    const players=new Set(doc.querySelectorAll('audio'));
    // Native CBT may retain its official player after moving/removing its UI.
    // Keep observing that exact object while the application still owns it.
    const official=win.TERM_TEST_BOOTSTRAP?.officialAudioElement;
    if(official?.addEventListener)players.add(official);
    for (const audio of players) if (!audioStops.has(audio)) {
      const stop=observeAudio({recorder,audio});audioStops.set(audio,stop);stop.snapshot('attached');
    }
    for (const [audio,stop] of audioStops) if (!players.has(audio)) { stop();audioStops.delete(audio); }
    const owner=win.TERM_TEST_BOOTSTRAP;
    const player=substituteStartTrace&&scopedSubstitute&&owner?.listeningContinuityVersion===1
      ?official||owner.preparedListeningPlayer:null;
    if(player===diagnosticPlayer&&owner===diagnosticOwner)return;
    stopOfficialDiagnostics?.();
    diagnosticPlayer=player;diagnosticOwner=owner;
    stopOfficialDiagnostics=player?.addEventListener?observeOfficialDiagnostics(player,owner):null;
  }
  function observeOfficialDiagnostics(audio,owner) {
    let lastProgress=null, episodeOpen=false, episode=0, pauseCommand=null;
    const lastReported=new Map();
    const faults=new Set(['pause','waiting','stalled','error']);
    const pauseReasons=new Set(['early_submit','learner_report','stale_start']);
    const onPauseCommand=event=>{
      if(event.detail?.audio!==audio||owner!==win.TERM_TEST_BOOTSTRAP||!pauseReasons.has(event.detail?.reason))return;
      pauseCommand={reason:event.detail.reason,at:performance.now()};
    };
    const onMedia=event=>{
      try{
        if(stopped||!current||owner!==win.TERM_TEST_BOOTSTRAP||win.SUBSTITUTE_STATE?.blocked)return;
        if(!owner.examSessionId)return;
        if(!listeningEndNumber(audio.currentTime))return;
        const now=performance.now(),type=event.type;
        if(type==='playing'||type==='timeupdate'){
          if(type==='playing')pauseCommand=null;
          if(episodeOpen&&lastProgress&&audio.currentTime>lastProgress.position+0.05){
            report('position_advanced',now);
            episodeOpen=false;
          }
          if(type==='playing'||!lastProgress||audio.currentTime>lastProgress.position+0.05)
            lastProgress={position:audio.currentTime,at:now};
          return;
        }
        if(!lastProgress||audio.ended)return;
        if(type==='pause'){
          const reason=pauseCommand&&now-pauseCommand.at<3000?pauseCommand.reason:'unknown';
          pauseCommand=null;
          if(reason!=='unknown'){report('pause',now,reason);return;}
        }
        if(!episodeOpen)episode++;
        episodeOpen=true;
        report(type,now);
      }catch{/* Measurements must not affect playback. */}
    };
    function report(phase,now,pauseReason) {
      const key=pauseReason||phase;
      if(now-(lastReported.get(key)??-Infinity)<15_000)return;
      const proof=proofOf(getState()),context=bindingCache.get(ownerKey);
      if(proof.examSessionId!==owner.examSessionId||proof.clientRunId!==owner.clientRunId
        ||JSON.stringify(proof)!==ownerKey||context?.identityConfirmed!==true||context.bindingId!==current.bindingId)return;
      lastReported.set(key,now);
      recorder.record('audio_observed',{action:'substitute_media_diagnostic',
        positionSeconds:audio.currentTime,paused:audio.paused,ended:audio.ended,
        readyState:audio.readyState,networkState:audio.networkState,mediaErrorCode:audio.error?.code||null,
        checkpointState:{telemetryVersion:1,phase,episode,assetId:testSlug,observedElapsedMs:Math.round(now),
          ...(phase==='pause'?{pauseReason:pauseReason||'unknown'}:{}),
          priorPositionSeconds:lastProgress.position,priorPositionAgeMs:Math.round(now-lastProgress.at),
          visibility:doc.hidden?'hidden':'visible',online:win.navigator?.onLine===true}},current);
    }
    const types=['playing','timeupdate',...faults];
    for(const type of types)audio.addEventListener(type,onMedia);
    win.addEventListener('substitute:listening-pause-command',onPauseCommand);
    return ()=>{
      for(const type of types)audio.removeEventListener(type,onMedia);
      win.removeEventListener('substitute:listening-pause-command',onPauseCommand);
    };
  }
  const mutation = new win.MutationObserver(records => {
    if (!records.some(record => [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1))) return;
    attachPlayers(); observer.snapshot('render');
  });
  mutation.observe(doc.body||doc.documentElement,{childList:true,subtree:true}); attachPlayers();
  const runtimeError = event => recorder.record('runtime_error',{errorCode:event.type === 'error' ? 'WINDOW_ERROR' : 'UNHANDLED_REJECTION',
    stack:event.type === 'error' ? {file:safeRoute(event.filename || ''),line:event.lineno || 0,column:event.colno || 0} : {},stage:String(getState().stage || '')});
  win.addEventListener('error',runtimeError);win.addEventListener('unhandledrejection',runtimeError);
  const timer = setInterval(() => {
    void refresh();stateChanged('periodic');
    try {
      if (sampleTerm1Writing && current) {
        const state=getState();
        if (state.stage==='writing' && JSON.stringify(proofOf(state))===ownerKey) {
          const target=doc.querySelector('textarea[data-writing-task="task2"]');
          if (target && !target.closest('[hidden]')) observer.sampleContent(target);
        }
      }
    } catch { health({status:'degraded',errorCode:'JOURNAL_STATE_UNAVAILABLE'}); }
    void recorder.flush();
  },1000);
  void refresh();
  function recordScopedSubmission(owner,type,data){
    if(stopped||!current)return false;
    const proof=proofOf(getState()),context=bindingCache.get(ownerKey);
    if(!owner?.examSessionToken||proof.examSessionToken!==owner.examSessionToken||proof.generation!==owner.generation
        ||JSON.stringify(proof)!==ownerKey||context?.identityConfirmed!==true||context.bindingId!==current.bindingId)return false;
    return Boolean(recorder.record(type,data,current));
  }
  const api={ stateChanged,recorder,metadataOnlySubmission:metadataOnly,substituteStartTraceVersion:2,
    adopt(reader){if(typeof reader==='function'){getState=reader;stateChanged('state_reader_changed');}return api;},
    recordK67Submission(owner,type,data){return k67Metadata&&recordScopedSubmission(owner,type,data);},
    recordK56Submission(owner,type,data){return scopedK56&&recordScopedSubmission(owner,type,data);},
    prepareInitialization({classCode='' }={}) {
      // Warm only the page scope. Never borrow an adopted native learner proof.
      return loadBinding(proofOf({classCode,generation:0}));
    },
    recordInitializationNow(rows,{classCode='',lostCount=0}={}) {
      if(stopped)return false;
      const context=bindingCache.get(JSON.stringify(proofOf({classCode,generation:0})));
      if(!context||Number(context.expiresAt)<=Date.now()+5000)return false;
      if(context.identityConfirmed!==false)throw Error('JOURNAL_INITIALIZATION_SCOPE_INVALID');
      const binding=capturedBinding(context);
      if(lostCount)recorder.record('sequence_gap',{cause:'initialization_buffer_budget',lostCount,
        checkpointState:{attribution:'unconfirmed',gapScope:'page_initialization'}},binding);
      for(const row of rows){
        if(!metadataOnly){recorder.record(row.type,row.data,binding);continue;}
        const {label,value,text,checkpointState,...data}=row.data;
        const {selected,previous,...state}=checkpointState||{};
        recorder.record(row.type,{...data,checkpointState:state},binding);
      }
      return true;
    },
    async recordInitialization(rows,{classCode='',lostCount=0}={}) {
      if(stopped)throw Error('JOURNAL_STOPPED');
      // UI choices describe intent. Only native API proof can establish learner authority.
      await api.prepareInitialization({classCode});
      if(!api.recordInitializationNow(rows,{classCode,lostCount}))throw Error('JOURNAL_INITIALIZATION_SCOPE_UNAVAILABLE');
      // The existing periodic/exit flush owns transport cadence and retry backoff.
    },
    startAudioTransfer(metadata,{forceUnconfirmed=false,classCodeHint}={}) {
      try {
        if(stopped)return null;const state=getState(),proof=proofOf(state),key=JSON.stringify(proof);
        const nativeProof=Boolean(proof.attemptToken||proof.examSessionToken||proof.clientRunId||proof.examSessionId);
        let captured=!forceUnconfirmed&&current&&key===ownerKey?copy(current):null;
        const unconfirmed=forceUnconfirmed||!captured||!nativeProof;
        const requestId=crypto.randomUUID(),buffer=[];let heldBytes=0,lost=0,discarded=false;
        const discard=()=>{discarded=true;audioPendingBytes-=heldBytes;heldBytes=0;buffer.length=0;audioPending.delete(discard);};
        const observer=createAudioTransferObserver({metadata:{...metadata,assetId:metadata?.assetId||testSlug},onHealth:health,record:data=>{
          if(stopped||discarded)return;
          const event={...data,requestId,checkpointState:{...data.checkpointState,bindingAtStart:unconfirmed?'unconfirmed':'native'}};
          if(captured)return audioRecord('audio_observed',event,captured);
          const bytes=JSON.stringify(event).length*2;
          if(buffer.length>=256||audioPendingBytes+bytes>256*1024){lost++;health({status:'gap',errorCode:'JOURNAL_AUDIO_BUFFER_FULL',lostCount:lost});return;}
          buffer.push(event);heldBytes+=bytes;audioPendingBytes+=bytes;
        }});
        if(!observer)return null;
        if(!captured){
          if(audioPending.size>=8){discard();health({status:'gap',errorCode:'JOURNAL_AUDIO_CONTEXT_QUEUE_FULL'});return observer;}
          audioPending.add(discard);
          const earlyClass=/^[A-Z0-9_-]{1,60}$/.test(classCodeHint||'')?classCodeHint:proof.classCode;
          // A delayed preload has no learner authority. Mint only an unconfirmed page scope.
          const early=proofOf({classCode:earlyClass,generation:0});
          void loadBinding(early).then(context=>{
            if(stopped||discarded){discard();return;}captured=capturedBinding(context);
            if(lost)audioRecord('sequence_gap',{cause:'audio_context_buffer_budget',lostCount:lost,checkpointState:{attribution:'unconfirmed'}},captured);
            for(const event of buffer)audioRecord('audio_observed',event,captured);
            audioPendingBytes-=heldBytes;heldBytes=0;buffer.length=0;audioPending.delete(discard);
          }).catch(()=>{discard();health({status:'gap',errorCode:'JOURNAL_AUDIO_CONTEXT_UNAVAILABLE'});});
        }
        return observer;
      }catch{return null;}
    },
    recordK67ListeningEof(owner,detail) {
      if(stopped||!current||!['term-test-1','term-test-2','mini-test-lesson-5'].includes(testSlug)
        ||!owner?.examSessionToken||owner!==win.TERM_TEST_BOOTSTRAP)return false;
      const proof=proofOf(getState()),context=bindingCache.get(ownerKey);
      if(proof.examSessionToken!==owner.examSessionToken||proof.generation!==Number(owner.sessionState?.generation||0)
        ||JSON.stringify(proof)!==ownerKey||context?.identityConfirmed!==true||context.bindingId!==current.bindingId)return false;
      const {phase,mode}=detail||{};
      if(!['online','offline'].includes(mode)||!['event_unverified','media_not_finished','playback_rate_invalid',
        'duration_unavailable','position_short','playback_incomplete','eof_accepted',
        'review_local','review_restored','review_server'].includes(phase))return false;
      const metadata={telemetryVersion:1,assetId:testSlug,mode,phase};
      if(phase.startsWith('review_')){
        if((phase==='review_server')!==(mode==='online')||!listeningEndTime(detail.reviewStartedAt)
          ||!listeningEndTime(detail.reviewDeadlineAt)||Date.parse(detail.reviewDeadlineAt)<Date.parse(detail.reviewStartedAt))return false;
        Object.assign(metadata,{reviewStartedAt:detail.reviewStartedAt,reviewDeadlineAt:detail.reviewDeadlineAt});
      }
      for(const field of ['anchorSeconds','reviewSeconds','configuredDurationSeconds'])
        if(listeningEndNumber(detail[field]))metadata[field]=detail[field];
      const measurements={};
      for(const field of ['durationSeconds','positionSeconds','playbackRate'])
        if(listeningEndNumber(detail[field]))measurements[field]=detail[field];
      if(typeof detail.ended==='boolean')measurements.ended=detail.ended;
      return Boolean(recorder.record('audio_observed',{action:'k67_listening_eof',...measurements,checkpointState:metadata},current));
    },
    recordMiniListening(owner,detail) {
      return testSlug==='mini-test-k56'&&api.recordK56Listening(owner,detail);
    },
    recordK56Listening(owner,detail) {
      const mini=testSlug==='mini-test-k56';
      if(stopped||!current||!(mini||['term-test-1-k56','term-test-2-k56'].includes(testSlug))
        ||!owner?.examSessionToken||owner!==win.TERM_TEST_BOOTSTRAP)return false;
      const proof=proofOf(getState()),context=bindingCache.get(ownerKey);
      if(proof.examSessionToken!==owner.examSessionToken||proof.generation!==owner.generation
        ||JSON.stringify(proof)!==ownerKey||context?.identityConfirmed!==true||context.bindingId!==current.bindingId)return false;
      const phases=detail?.mode==='offline'
        ? ['manual_pause','local_resumed','eof_untrusted','eof_media_state','eof_duration_mismatch','eof_position_short','eof_accepted']
        : detail?.mode==='online' ? ['manual_pause','recovery_sent','recovery_ack','recovery_failed'] : [];
      if(!phases.includes(detail?.phase))return false;
      const metadata={telemetryVersion:1,mode:detail.mode,phase:detail.phase};
      let requestId;
      if(!mini)metadata.assetId=testSlug;
      if(typeof detail.incidentId==='string'&&/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(detail.incidentId))
        metadata.incidentId=detail.incidentId;
      if((detail.phase==='manual_pause'||detail.phase==='local_resumed'||detail.mode==='online')&&!metadata.incidentId)return false;
      if(listeningEndNumber(detail.configuredDurationSeconds))metadata.configuredDurationSeconds=detail.configuredDurationSeconds;
      if(!mini&&detail.mode==='online'&&detail.phase!=='manual_pause'){
        if(typeof detail.requestId==='string'&&/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(detail.requestId))
          requestId=detail.requestId;
        for(const field of ['requestRevision','serverRevision','generation'])
          if(Number.isSafeInteger(detail[field])&&detail[field]>=0)metadata[field]=detail[field];
        for(const field of ['requestedSeconds','checkpointSeconds'])
          if(listeningEndNumber(detail[field])&&detail[field]<=7200)metadata[field]=detail[field];
        if(detail.phase==='recovery_failed'&&['AUDIO_OWNER_CONFLICT','AUDIO_PROGRESS_STALE','AUDIO_GENERATION_STALE',
          'AUDIO_RESPONSE_STALE','AUDIO_PROGRESS_LOCKED','AUDIO_RECOVERY_CONFLICT','AUDIO_RECOVERY_EXPIRED',
          'AUDIO_CONTRACT_MISMATCH','INVALID_AUDIO_PROGRESS','AUDIO_SYNC_FAILED','AUDIO_NETWORK_ERROR'].includes(detail.errorCode))
          metadata.errorCode=detail.errorCode;
      }
      if(detail.phase==='recovery_ack'){
        for(const field of ['grantedRecoverySeconds','totalRecoverySeconds'])
          if(listeningEndNumber(detail[field])&&detail[field]<=900)metadata[field]=detail[field];
      }
      const measurements={};
      for(const field of ['durationSeconds','positionSeconds'])if(listeningEndNumber(detail[field]))measurements[field]=detail[field];
      for(const field of ['paused','ended','muted'])if(typeof detail[field]==='boolean')measurements[field]=detail[field];
      if(typeof detail.volume==='number'&&detail.volume>=0&&detail.volume<=1)measurements.volume=detail.volume;
      const action=mini?'mini_listening_diagnostic':'term_k56_listening_diagnostic';
      return Boolean(recorder.record('audio_observed',{action,...measurements,...requestId?{requestId}:{},checkpointState:metadata},current));
    },
    recordSubstituteListening(owner,detail) {
      if(stopped||!current||!/^substitute-test-[12]-k(?:56|67)$/.test(testSlug)
        ||owner?.listeningContinuityVersion!==1||owner!==win.TERM_TEST_BOOTSTRAP)return false;
      const proof=proofOf(getState()),context=bindingCache.get(ownerKey);
      if(proof.clientRunId!==owner.clientRunId||proof.examSessionId!==owner.examSessionId
        ||JSON.stringify(proof)!==ownerKey||context?.identityConfirmed!==true||context.bindingId!==current.bindingId)return false;
      const phases=['download_verified','player_ready','started','ended','early_confirmed','interrupted_local','interrupted_ack','submission_local','submission_ack'];
      const startTrace=listeningStartPhases.has(detail?.phase);
      if(!startTrace&&!phases.includes(detail?.phase))return false;
      const metadata={telemetryVersion:startTrace?2:1,phase:detail.phase,assetId:testSlug};
      if(startTrace){
        if(!Number.isSafeInteger(detail.commandSequence)||detail.commandSequence<1)return false;
        if(!Number.isSafeInteger(detail.commandStep)||detail.commandStep<1||detail.commandStep>5)return false;
        metadata.commandSequence=detail.commandSequence;
        metadata.commandStep=detail.commandStep;
        if(Number.isSafeInteger(detail.observedElapsedMs)&&detail.observedElapsedMs>=0)
          metadata.observedElapsedMs=detail.observedElapsedMs;
        if(['reading-first','listening-first'].includes(owner.examOrder))metadata.examOrder=owner.examOrder;
        if(listeningStartReasons.has(detail.reason))metadata.reason=detail.reason;
        if(Number.isInteger(detail.readyState)&&detail.readyState>=0&&detail.readyState<=4)
          metadata.readyState=detail.readyState;
        if(typeof detail.paused==='boolean')metadata.paused=detail.paused;
      }
      if(Number.isSafeInteger(detail.byteLength)&&detail.byteLength>0&&detail.byteLength<=512*1024*1024)
        metadata.byteLength=detail.byteLength;
      if(typeof detail.elapsedMs==='number'&&detail.elapsedMs>=0&&detail.elapsedMs<=120_000)
        metadata.elapsedMs=Math.round(detail.elapsedMs);
      if(['learner_report','reload'].includes(detail.reason))metadata.reason=detail.reason;
      if(typeof detail.operationId==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(detail.operationId))
        metadata.operationId=detail.operationId;
      const measures={};
      if(listeningEndNumber(detail.positionSeconds))measures.positionSeconds=detail.positionSeconds;
      return Boolean(recorder.record('audio_observed',{action:'substitute_listening_continuity',...measures,checkpointState:metadata},current));
    },
    recordListeningEnd(owner,data) {
      if(stopped||!current||!owner?.examSessionId||owner!==win.TERM_TEST_BOOTSTRAP)return false;
      const state=getState(),proof=proofOf(state),context=bindingCache.get(ownerKey),detail=data?.checkpointState;
      if(!/^substitute-test-[12]-k(?:56|67)$/.test(testSlug)||detail?.assetId!==testSlug
        ||!listeningEndDecisions.has(detail.decision)||detail.telemetryVersion!==1
        ||!proof.clientRunId||proof.clientRunId!==owner.clientRunId||proof.examSessionId!==owner.examSessionId
        ||JSON.stringify(proof)!==ownerKey||context?.identityConfirmed!==true||context.bindingId!==current.bindingId)return false;
      const seen=recordedListeningEnds.get(owner)||new Set();
      if(seen.has(detail.decision))return false;
      const metadata={telemetryVersion:1,assetId:testSlug,decision:detail.decision};
      if(listeningEndNumber(detail.configuredDurationSeconds))metadata.configuredDurationSeconds=detail.configuredDurationSeconds;
      if(detail.decision==='eof_sync_failed'&&Number.isInteger(detail.httpStatus)&&detail.httpStatus>=400&&detail.httpStatus<=599)
        metadata.httpStatus=detail.httpStatus;
      if(['review_started','review_confirmed','review_restored'].includes(detail.decision)){
        if(!listeningEndClocks.has(detail.clockSource)||((detail.clockSource==='server_ack')!==(detail.decision==='review_confirmed'))
          ||!listeningEndTime(detail.reviewStartedAt)||!listeningEndTime(detail.reviewDeadlineAt)
          ||Date.parse(detail.reviewDeadlineAt)<Date.parse(detail.reviewStartedAt))return false;
        Object.assign(metadata,{clockSource:detail.clockSource,reviewStartedAt:detail.reviewStartedAt,reviewDeadlineAt:detail.reviewDeadlineAt});
      }
      const measurements={};
      for(const field of ['durationSeconds','positionSeconds','playbackRate'])
        if(listeningEndNumber(data[field]))measurements[field]=data[field];
      if(typeof data.ended==='boolean')measurements.ended=data.ended;
      const id=recorder.record('audio_observed',{action:'listening_end_decision',...measurements,checkpointState:metadata},current);
      if(!id)return false;
      seen.add(detail.decision);recordedListeningEnds.set(owner,seen);return true;
    },
    startRequest(path,options = {},trace) {
      const proof=proofOf(getState()),proofKey=JSON.stringify(proof);
      const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      const traced=trace&&uuid.test(trace.operationId)&&['single','send','readback'].includes(trace.phase);
      const captured=current&&proofKey===ownerKey?copy(current):null;
      if(!captured&&!(scopedSubstitute&&metadataOnly&&traced&&proof.clientRunId))return null;
      // A sealed request may race Journal authorization after reload. Record only in the original confirmed scope.
      const binding=captured?null:loadBinding(proof).then(context=>
        !stopped&&context.identityConfirmed===true&&proofKey===JSON.stringify(proofOf(getState()))
          ? capturedBinding(context):null).catch(()=>null);
      const record=(type,data)=>{
        if(captured){recorder.record(type,data,captured);return;}
        void binding.then(confirmed=>{if(confirmed&&!stopped)recorder.record(type,data,confirmed);}).catch(()=>{});
      };
      const requestId=traced&&uuid.test(trace.requestId||'')?trace.requestId:crypto.randomUUID();
      const route=safeRoute(path),began=performance.now(),method=String(options.method||'GET');
      const details=traced?{checkpointState:{operationId:trace.operationId,phase:trace.phase}}:{};
      record('request_started',{requestId,route,method,...details});
      let finished=false;
      return {requestId,done(result,error,status) {
        if(finished)return;
        finished=true;
        record(error?'request_failed':'request_finished',{
          requestId,route,method,durationMs:performance.now()-began,...details,
          operationStatus:error?'client_handler_failed':'client_handler_returned',
          ...(Number.isInteger(status)&&status>=100&&status<=599?{status}:{}),
          errorCode:error?String(error.name||'Error').slice(0,80):'',
          ...(Number.isSafeInteger(result?.revision)?{ackRevision:result.revision}:{})});
        stateChanged('request_finished');
      }};
    },
    dialog(message,outcome) {
      const state=getState();
      if(!current || JSON.stringify(proofOf(state))!==ownerKey)return;
      const action = /phục hồi/i.test(message) ? 'restore' : /^Xóa/i.test(message) ? 'reset' : /nộp/i.test(message) ? 'submit' : 'confirm';
      recorder.record('dialog_observed',{action,outcome,stage:String(state.stage || ''),viewport:viewportSnapshot(win),
        checkpointState:{presentation:'browser_confirm',visibility:'unknown'}});
    },
    async stop() { stopped = true;clearInterval(timer);mutation.disconnect();observer.stop();stopOfficialDiagnostics?.();for (const stop of audioStops.values()) stop();
      for(const discard of [...audioPending])discard();bindingCache.clear();win[registryKey]?.delete(connectionKey);
      if(win.EXAM_JOURNAL_AUDIO_TRANSFER===audioFactory)win.EXAM_JOURNAL_AUDIO_TRANSFER=previousAudioFactory;
      win.removeEventListener('error',runtimeError);win.removeEventListener('unhandledrejection',runtimeError);await recorder.idle();recorder.stop();await outbox.close(); }
  };
  const previousAudioFactory=win.EXAM_JOURNAL_AUDIO_TRANSFER,audioFactory=(metadata,options)=>api.startAudioTransfer(metadata,options);
  win.EXAM_JOURNAL_AUDIO_TRANSFER=audioFactory;if(!win[registryKey])win[registryKey]=new Map();win[registryKey].set(connectionKey,api);return api;
}
