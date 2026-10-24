import { IndexedOutbox } from './outbox.mjs';
import { createRecorder,fetchTransport,observeDocument,observeAudio } from './recorder.mjs';
import {createAudioTransferObserver} from './audio-delivery.mjs?v=20261024-audio-v1';

const copy = value => JSON.parse(JSON.stringify(value));
const registryKey=Symbol.for('izone.examJournal.connections.v1');
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
  document:doc = globalThis.document,window:win = globalThis.window,onHealth = () => {},outbox:providedOutbox,fetcher = globalThis.fetch }) {
  if (!enabled) return null;
  const target = new URL(endpoint,win.location.href);
  if (!['http:','https:'].includes(target.protocol) || target.search || target.hash || target.username || target.password) throw new Error('INVALID_JOURNAL_ENDPOINT');
  const connectionKey=JSON.stringify([target.href,testSlug]),existing=win[registryKey]?.get(connectionKey);
  if(existing)return existing.adopt(getState);
  const outbox = providedOutbox || new IndexedOutbox({ name:'izone-exam-journal-v2:' + target.origin + target.pathname });
  const visitId = crypto.randomUUID(); let current = null,ownerKey = '',requesting = '',lastProjection = '',nextContextTry = 0,stopped = false,unobservedSince=performance.now(),previousFields=new Set();
  const audioStops = new Map();
  const bindingRequests=new Map(),bindingCache=new Map(),audioPending=new Set();let audioPendingBytes=0;
  const health = data => {
    if (data.pendingReauthorization && data.expiredBindingId === current?.bindingId) {current=null;nextContextTry=0;}
    try { onHealth(data); } catch {}
  };
  const recorder = createRecorder({ outbox,context:() => current,
    transport:fetchTransport(target.href + '/journal-events',fetcher),build,onHealth:health });
  const proofOf = state => ({ testSlug,classCode:String(state.classCode || state.className || ''),
    attemptToken:String(state.attemptToken || ''),examSessionToken:String(state.examSessionToken || ''),
    clientRunId:String(state.clientRunId || ''),examSessionId:String(state.examSessionId || ''),historyEpoch:String(state.historyEpoch || state._substitute?.historyEpoch || ''),
    generation:Number(state.generation || 0),pageVisitId:visitId });
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
      const fields=contentFields(state),names=new Set(fields.map(row=>row[0]));
      for(const fieldId of previousFields)if(!names.has(fieldId))recorder.content(fieldId,'',{cause:'application_field_removed'});
      for (const [fieldId,value] of fields) recorder.content(fieldId,value,{cause:'application_state'});previousFields=names;
    } catch { health({status:'degraded',errorCode:'JOURNAL_STATE_UNAVAILABLE'}); }
  }
  const observer = observeDocument({recorder,document:doc,window:win,
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
      const groupRoot=choiceCard || element.closest('#readingView,#listeningView') || element.form || doc;
      const group = element.type === 'checkbox' || element.type === 'radio'
        ? [...groupRoot.querySelectorAll('input')].filter(input => input.name === element.name && input.checked).map(input => input.value) : null;
      const text = group ? element.type === 'radio' ? String(group[0] || '') : JSON.stringify(group)
        : String(element.value ?? element.textContent ?? '');
      return {fieldId,text,stage};
    },
    resolveAction:element => ({action:String(element.dataset.action || element.id || element.getAttribute('name') || element.tagName.toLowerCase()).slice(0,120),
      label:String(element.getAttribute('aria-label') || element.textContent || element.value || '').trim().slice(0,160),stage:String(getState().stage || '')}) });
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
  }
  const mutation = new win.MutationObserver(records => {
    if (!records.some(record => [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1))) return;
    attachPlayers(); observer.snapshot('render');
  });
  mutation.observe(doc.body,{childList:true,subtree:true}); attachPlayers();
  const runtimeError = event => recorder.record('runtime_error',{errorCode:event.type === 'error' ? 'WINDOW_ERROR' : 'UNHANDLED_REJECTION',
    stack:event.type === 'error' ? {file:safeRoute(event.filename || ''),line:event.lineno || 0,column:event.colno || 0} : {},stage:String(getState().stage || '')});
  win.addEventListener('error',runtimeError);win.addEventListener('unhandledrejection',runtimeError);
  const timer = setInterval(() => { void refresh();stateChanged('periodic');void recorder.flush(); },1000);
  void refresh();
  const api={ stateChanged,recorder,
    adopt(reader){if(typeof reader==='function'){getState=reader;stateChanged('state_reader_changed');}return api;},
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
    startRequest(path,options = {}) {
      if (!current) return null;
      const captured=copy(current),requestId = crypto.randomUUID(),route = safeRoute(path),began = performance.now();
      recorder.record('request_started',{requestId,route,method:String(options.method || 'GET')},captured);
      return {requestId,done(result,error) { recorder.record(error ? 'request_failed' : 'request_finished',{
        requestId,route,durationMs:performance.now() - began,operationStatus:error ? 'client_handler_failed' : 'client_handler_returned',
        errorCode:error ? String(error.name || 'Error').slice(0,80) : '',
        ...(Number.isSafeInteger(result?.revision) ? {ackRevision:result.revision} : {}) },captured);stateChanged('request_finished'); }};
    },
    dialog(message,outcome) {
      const action = /phục hồi/i.test(message) ? 'restore' : /^Xóa/i.test(message) ? 'reset' : /nộp/i.test(message) ? 'submit' : 'confirm';
      recorder.record('dialog_observed',{action,outcome,stage:String(getState().stage || '')});
    },
    async stop() { stopped = true;clearInterval(timer);mutation.disconnect();observer.stop();for (const stop of audioStops.values()) stop();
      for(const discard of [...audioPending])discard();bindingCache.clear();win[registryKey]?.delete(connectionKey);
      if(win.EXAM_JOURNAL_AUDIO_TRANSFER===audioFactory)win.EXAM_JOURNAL_AUDIO_TRANSFER=previousAudioFactory;
      win.removeEventListener('error',runtimeError);win.removeEventListener('unhandledrejection',runtimeError);await recorder.idle();recorder.stop();await outbox.close(); }
  };
  const previousAudioFactory=win.EXAM_JOURNAL_AUDIO_TRANSFER,audioFactory=(metadata,options)=>api.startAudioTransfer(metadata,options);
  win.EXAM_JOURNAL_AUDIO_TRANSFER=audioFactory;if(!win[registryKey])win[registryKey]=new Map();win[registryKey].set(connectionKey,api);return api;
}
