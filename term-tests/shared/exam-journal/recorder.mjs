// Adapters provide only explicit semantic fields/actions and a server-issued binding.
// This module neither intercepts fetch nor changes submit, audio or exam navigation.
export function textEdit(before, after) {
  let start = 0, tail = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (tail < before.length - start && tail < after.length - start
    && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  return { start, deleteCount: before.length - start - tail, insert: after.slice(start, after.length - tail) };
}
const copy = value => JSON.parse(JSON.stringify(value));
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const forbidden = /^(?:authorization|cookie|password|secret|accessToken|refreshToken|idToken|attemptToken|examSessionToken|apiKey)$/i;
function safeDetails(value, depth = 0) {
  if (depth > 6) throw new Error('DETAIL_TOO_DEEP');
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (forbidden.test(key)) throw new Error('FORBIDDEN_DETAIL_KEY'); safeDetails(item, depth + 1);
    }
  }
}
function assertAcknowledged(current,batch,reply){
  const ids=batch.map(event=>event.id),ack=reply?.acknowledgedIds;
  if(reply?.ok!==true||reply.persisted!==true||reply.scopeId!==current.bindingId
    ||!Array.isArray(ack)||ack.length!==ids.length||new Set(ack).size!==ids.length
    ||!ids.every(id=>ack.includes(id)))throw new Error('JOURNAL_ACK_INVALID');
  return ack;
}

export function createRecorder({ outbox, context, transport, build, onHealth = () => {},
  uuid = () => crypto.randomUUID(), clock = () => Date.now(), monotonic = () => performance.now(),
  maxPending = 128, maxMemoryBytes = 1024 * 1024 }) {
  const pageVisitId = uuid(), started = monotonic(), fields = new Map(), sequences = new Map(), fallback = [],losses=new Map(),writes=[];
    let sequence = 0, serial = Promise.resolve(), queued = 0, activeWrites=[],draining = false, flushing = false,liveFlushing=false,exitFlushing=false,memoryBytes = 0,
    lost = 0, nextTry = 0, failures = 0, stopped = false, lastBinding = '',storageReported=false,exitBytes=0,exitRequests=0;
  const exitPending=new Set();
  const health = data => { try { onHealth(data); } catch { /* Observability must not interrupt exams. */ } };
  const scope = () => {
    try {
      const current = context();
      if (!current || !/^[a-f0-9]{64}$/.test(current.bindingId || '') || !current.auth) return null;
      return { bindingId: current.bindingId, auth: copy(current.auth),versions:copy(current.versions || {}) };
    } catch { health({ status: 'degraded', errorCode: 'CONTEXT_UNAVAILABLE' }); return null; }
  };
  function markLost(captured,cause){
    lost++;const old=losses.get(captured.bindingId);
    if(old)old.count++;else if(losses.size<128)losses.set(captured.bindingId,{captured:copy(captured),cause,count:1});
  }
  function reserve(binding, event, auth) {
    const bytes = size(event);
    if (memoryBytes + bytes <= maxMemoryBytes) { fallback.push({ binding, event, bytes, auth }); memoryBytes += bytes; }
    else { markLost({bindingId:binding,auth,versions:event.data.versions || {}},'local_storage_or_queue_budget'); health({ status: 'gap', errorCode: 'MEMORY_BUDGET_REACHED', lostCount: lost, lastSequence: event.sequence }); }
  }
  function drainWrites(){
    if(draining)return;draining=true;
    serial=(async()=>{
      while(writes.length){
        const batch=activeWrites=writes.splice(0,32);
        try {
          if(typeof outbox.putMany==='function')await outbox.putMany(batch);
          else for(const row of batch)await outbox.put(row.binding,row.event,row.auth);
        } catch {
          for(const row of batch)if(!row.serverConfirmed)reserve(row.binding,row.event,row.auth);health({status:'degraded',errorCode:'OUTBOX_UNAVAILABLE'});
          if(!storageReported){storageReported=true;record('storage_degraded',{errorCode:'OUTBOX_UNAVAILABLE',saveState:'memory_only'},batch[0].captured);}
        } finally {queued-=batch.length;activeWrites=[];}
      }
    })().finally(()=>{draining=false;if(writes.length)drainWrites();});
  }
  function record(type, data = {}, captured = scope()) {
    if (stopped || !captured) return null;
    try {
      const details = copy({versions:captured.versions || {},...data}); safeDetails(details);
      sequence = (sequences.get(captured.bindingId) || 0) + 1; sequences.set(captured.bindingId, sequence);
      const event = { id: uuid(), pageVisitId, sequence, schemaVersion: 1, eventVersion: 1,
        type, occurredAt: new Date(clock()).toISOString(), elapsedMs: Math.max(0, monotonic() - started), build, data: details };
      if (size(event) > 94 * 1024) { markLost(captured,'event_too_large'); health({ status: 'gap', errorCode: 'EVENT_TOO_LARGE', lostCount: lost }); return null; }
      if (queued >= maxPending) { reserve(captured.bindingId, event,captured.auth); health({ status: 'degraded', errorCode: 'LOCAL_QUEUE_BUSY' }); return event.id; }
      queued++;
      writes.push({binding:captured.bindingId,event,auth:captured.auth,captured});
      drainWrites();
      return event.id;
    } catch { health({ status: 'degraded', errorCode: 'INVALID_EVENT_DETAILS' }); return null; }
  }
  function content(fieldId, text, details = {}, checkpoint = false) {
    const current = scope(); if (!current || typeof text !== 'string') return;
    if (text.length > 40_000) { markLost(current,'content_too_long'); health({ status: 'gap', errorCode: 'CONTENT_TOO_LONG', lostCount: lost }); return; }
    const key = current.bindingId + ':' + fieldId, previous = fields.get(key);
    if (previous?.text === text && (!checkpoint || previous.changes === 0)) return;
    if (!previous || checkpoint || previous.changes >= 40) {
      const revision = previous ? previous.revision + Number(previous.text !== text) : 0;
      if (record('content_checkpoint', { ...details, fieldId, text, revision }, current))
        fields.set(key, { text, revision, changes: 0 });
      return;
    }
    if (previous.text === text) return;
    const revision = previous.revision + 1;
    if (record('content_changed', { ...details, fieldId, baseRevision: previous.revision, revision,
      beforeLength: previous.text.length, afterLength: text.length, edit: textEdit(previous.text, text) }, current))
      fields.set(key, { text, revision, changes: previous.changes + 1 });
  }
  async function recoverMemory() {
    while (fallback.length) {
      const row = fallback[0]; await outbox.put(row.binding, row.event,row.auth);
      const index=fallback.indexOf(row);
      if(index>=0){fallback.splice(index,1);memoryBytes-=row.bytes;}
    }
    if (lost) {
      const pendingLosses=[...losses.values()];losses.clear();lost=0;
      for(const loss of pendingLosses)record('sequence_gap',{lostCount:loss.count,cause:loss.cause},loss.captured);
    }
  }
  function removeMemory(binding,ids){
    const known=new Set(ids);
    for(let index=fallback.length-1;index>=0;index--)if(fallback[index].binding===binding&&known.has(fallback[index].event.id)){
      memoryBytes-=fallback[index].bytes;fallback.splice(index,1);
    }
  }
  // Local I/O must not hold network delivery hostage. Keep the durable copy until
  // its usual ACK/replay; server event IDs make a later duplicate harmless.
  function flushPending(keepalive){
    if(!keepalive&&liveFlushing)return null;
    const rows=[...activeWrites,...writes,...fallback],active=scope();
    if(keepalive&&(exitFlushing||exitRequests)&&!rows.some(row=>
      ['page_hidden','page_visibility'].includes(row.event.type)&&!row.serverConfirmed&&!row.blocked&&row.auth&&!exitPending.has(row.event.id)))return null;
    if(keepalive)rows.sort((a,b)=>Number(['page_hidden','page_visibility'].includes(b.event.type))-Number(['page_hidden','page_visibility'].includes(a.event.type)));
    for(const row of rows)if(active&&row.binding===active.bindingId&&row.auth?.ticketId!==active.auth?.ticketId){row.auth=active.auth;row.blocked=false;}
    const groups=new Map();let bytes=0,count=0;
    // Leave room under the browser's shared 64 KiB keepalive budget for a later
    // pagehide after visibilitychange. Only new IDs enter concurrent tail sends.
    const maxBytes=keepalive?Math.min(46*1024,60*1024-exitBytes):256*1024,maxGroups=keepalive?4-exitRequests:1;
    for(const row of rows){
      if(count>=100)break;
      if(row.serverConfirmed||row.blocked||!row.auth||(keepalive&&exitPending.has(row.event.id)))continue;
      const key=JSON.stringify([row.binding,row.auth]);let group=groups.get(key);
      if(!group){
        if(groups.size>=maxGroups)continue;
        const body={schemaVersion:1,bindingId:row.binding,auth:row.auth,events:[]},headerBytes=size(body);
        if(bytes+headerBytes+size(row.event)>maxBytes)continue;
        bytes+=headerBytes;group={body,selected:[]};groups.set(key,group);
      }
      const added=size(row.event)+(group.selected.length?1:0);
      if(bytes+added>maxBytes)break;
      bytes+=added;count++;group.selected.push(row);group.body.events.push(row.event);
    }
    if(!count)return null;
    if(keepalive){
      exitBytes+=bytes;exitRequests+=groups.size;
      for(const {selected} of groups.values())for(const row of selected)exitPending.add(row.event.id);
    }else liveFlushing=true;
    return (async()=>{
      try{
        // Start bounded exit requests together, before awaiting any local operation.
        const results=await Promise.all([...groups.values()].map(async({body,selected})=>{
          const current={bindingId:body.bindingId,auth:body.auth};
          try{
            const reply=await transport(body,{keepalive}),ack=assertAcknowledged(current,body.events,reply);
            for(const row of selected)row.serverConfirmed=true;
            removeMemory(current.bindingId,ack);return {status:'server_confirmed',acknowledgedCount:ack.length};
          }catch(error){
            if(['JOURNAL_TICKET_EXPIRED','JOURNAL_TICKET_INVALID'].includes(error.code)&&current.auth?.ticketId){
              for(const row of [...activeWrites,...writes,...fallback])if(row.binding===current.bindingId&&row.auth?.ticketId===current.auth.ticketId)row.blocked=true;
              try{void Promise.resolve(outbox.blockContext?.(current.bindingId,current.auth.ticketId)).catch(()=>{});}catch{}
              health({status:'degraded',errorCode:error.code,expiredBindingId:current.bindingId,pendingReauthorization:true});
              return {status:'pending_reauthorization',acknowledgedCount:0};
            }
            health({status:'degraded',errorCode:/^[A-Z0-9_]{1,80}$/.test(error.message||'')?error.message:'JOURNAL_UNAVAILABLE',memoryBytes,lostCount:lost});
            return {status:'degraded',acknowledgedCount:0};
          }
        }));
        const failed=results.find(result=>result.status!=='server_confirmed');
        if(failed){failures++;nextTry=clock()+Math.min(60_000,1000*2**Math.min(6,failures-1));}
        else{failures=0;nextTry=0;health({status:'degraded',saveState:'server_confirmed_local_pending',memoryBytes,lostCount:lost});}
        return {status:failed?.status||'server_confirmed',acknowledgedCount:results.reduce((sum,row)=>sum+row.acknowledgedCount,0)};
      }finally{
        if(keepalive){exitBytes-=bytes;exitRequests-=groups.size;
          for(const {selected} of groups.values())for(const row of selected)exitPending.delete(row.event.id);
        }else liveFlushing=false;
      }
    })();
  }
  async function flush({ force = false, keepalive = false } = {}) {
    if (stopped || (!force && clock() < nextTry)) return { status: 'deferred' };
    if(keepalive&&(exitFlushing||exitRequests))return flushPending(true)||{status:'deferred'};
    if(keepalive||draining||flushing){const live=flushPending(keepalive);if(live)return live;}
    if(flushing)return {status:'deferred'};
    if(keepalive)exitFlushing=true;
    let current = scope(),exitReservation=0,exitReservedIds=[];
    flushing = true;
    try {
      await serial;
      // Drain durable events first: a full disk outbox must be able to make space.
      const options = { maxCount:100,maxBytes:keepalive ? 46 * 1024 : 256 * 1024 };
      let batch=[],fromMemory=false,storageUnavailable=false;
      try {
        const durable = outbox.nextBatch ? await outbox.nextBatch(options) : null;
        if (durable) current = durable;
        if (current) batch = durable?.events || await outbox.list(current.bindingId, options);
      } catch {storageUnavailable=true;}
      if (!batch.length && fallback.length) {
        const active=scope();
        if(active)for(const row of fallback)if(row.binding===active.bindingId && row.auth?.ticketId!==active.auth?.ticketId){row.auth=active.auth;row.blocked=false;}
        const first=fallback.find(row=>!row.blocked && row.auth);
        if(first){
          current={bindingId:first.binding,auth:first.auth};let bytes=0;fromMemory=true;
          batch=fallback.filter(row=>!row.blocked && row.binding===first.binding && JSON.stringify(row.auth)===JSON.stringify(first.auth))
            .filter(row=>{if(bytes+row.bytes>options.maxBytes)return false;bytes+=row.bytes;return true;}).slice(0,options.maxCount).map(row=>row.event);
        }
      }
      if (!current) return { status:'no_identity' };
      if(keepalive){
        let bytes=size({schemaVersion:1,bindingId:current.bindingId,auth:current.auth,events:[]}),count=0;
        for(const event of batch){const added=size(event)+(count?1:0);if(count>=100||bytes+added>Math.min(46*1024,60*1024-exitBytes))break;bytes+=added;count++;}
        batch=batch.slice(0,count);
      }
      if (batch.length) {
        const body={schemaVersion:1,bindingId:current.bindingId,auth:current.auth,events:batch};
        if(keepalive){
          if(exitRequests>=4)return {status:'deferred'};
          exitReservation=size(body);exitBytes+=exitReservation;exitRequests++;
          exitReservedIds=batch.map(event=>event.id);for(const id of exitReservedIds)exitPending.add(id);
        }
        const reply = await transport(body, { keepalive });
        const ack=assertAcknowledged(current,batch,reply);
        if (fromMemory) {
          removeMemory(current.bindingId,ack);
          try {await outbox.acknowledge(current.bindingId,ack);}catch {storageUnavailable=true;}
        } else await outbox.acknowledge(current.bindingId, ack);
      }
      if (!storageUnavailable) await recoverMemory(); failures = 0; nextTry = 0;
      let queueBytes=null;try {queueBytes=await outbox.size();}catch {storageUnavailable=true;}
      health({ status: storageUnavailable?'degraded':'ok',...(storageUnavailable?{errorCode:'OUTBOX_UNAVAILABLE',saveState:'memory_only'}:{}),queueBytes, memoryBytes, lostCount: lost });
      return { status: storageUnavailable?'memory_only':'ok', acknowledgedCount: batch.length };
    } catch (error) {
      if (['JOURNAL_TICKET_EXPIRED','JOURNAL_TICKET_INVALID'].includes(error.code) && current?.auth?.ticketId && outbox.blockContext) {
        try {await outbox.blockContext(current.bindingId,current.auth.ticketId);}catch {}
        for(const row of fallback)if(row.binding===current.bindingId && row.auth?.ticketId===current.auth.ticketId)row.blocked=true;
        failures=0;nextTry=0;
        health({status:'degraded',errorCode:error.code,expiredBindingId:current.bindingId,pendingReauthorization:true});
        return {status:'pending_reauthorization'};
      }
      failures++; nextTry = clock() + Math.min(60_000, 1000 * 2 ** Math.min(6, failures - 1));
      health({ status: 'degraded', errorCode: /^[A-Z0-9_]{1,80}$/.test(error.message || '')?error.message:'JOURNAL_UNAVAILABLE', memoryBytes, lostCount: lost });
      return { status: 'degraded' };
    } finally { flushing = false;if(keepalive){exitFlushing=false;
      if(exitReservation){exitBytes-=exitReservation;exitRequests--;for(const id of exitReservedIds)exitPending.delete(id);}
    } }
  }
  function identity(details = {}) {
    const current = scope(); if (!current || current.bindingId === lastBinding) return;
    lastBinding = current.bindingId;
    record('identity_observed', { ...details, identityConfirmed: true }, current);
  }
  return { record, content, flush, identity, idle: async () => {let observed;do{observed=serial;await observed;}while(observed!==serial);},
    status: () => ({ pageVisitId, lastSequence: sequence, queued, memoryBytes, lostCount: lost }),
    stop: () => { stopped = true; } };
}

export function fetchTransport(endpoint, fetcher = globalThis.fetch) {
  const target = new URL(endpoint, globalThis.location?.href);
  if (target.search || target.hash || target.username || target.password
    || !['https:', 'http:'].includes(target.protocol)) throw new Error('INVALID_JOURNAL_ENDPOINT');
  return async (body, { keepalive = false } = {}) => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetcher(target.href, { method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal, keepalive });
      if (!response.ok) {
        let code;try {const body = await response.json();if (/^JOURNAL_TICKET_(EXPIRED|INVALID)$/.test(body?.error || '')) code = body.error;}catch {}
        const error = new Error(code || 'JOURNAL_HTTP_' + response.status);error.code = code;throw error;
      }
      return await response.json();
    } finally { clearTimeout(timeout); }
  };
}

export function observeDocument({ recorder, document: doc = globalThis.document, window: win = globalThis.window,
  resolveField, resolveAction }) {
  let lastNavigation = { cause: 'unknown', at: 0 };
  const remove = [], listen = (target, type, handler, options) => {
    const safe = event => { try { handler(event); } catch { /* Never change exam behavior. */ } };
    target.addEventListener(type, safe, options); remove.push(() => target.removeEventListener(type, safe, options));
  };
  const field = target => {
    if (!target || target.type === 'password') return null;
    const value = resolveField(target); return value?.fieldId ? value : null;
  };
  const snapshot = cause => {
    for (const target of doc.querySelectorAll('input,textarea,select,[contenteditable="true"]')) {
      const value = field(target); if (!value) continue;
      recorder.content(value.fieldId, value.text, { cause, stage: value.stage || '' }, true);
    }
  };
  listen(doc, 'keydown', event => {
    if (!['Tab', 'Escape', 'Enter'].includes(event.key)) return;
    lastNavigation = { cause: 'keyboard_' + event.key.toLowerCase(), at: Date.now() };
    const value = field(event.target);
    if (value) recorder.record('navigation_observed', { fieldId: value.fieldId, action: lastNavigation.cause, outcome: 'requested', trusted: event.isTrusted });
  }, true);
  listen(doc, 'pointerdown', () => { lastNavigation = { cause: 'pointer', at: Date.now() }; }, true);
  listen(doc, 'focusin', event => {
    const value = field(event.target); if (!value) return;
    recorder.content(value.fieldId, value.text, { cause: 'focus' });
    recorder.record('field_focused', { fieldId: value.fieldId, relatedFieldId: field(event.relatedTarget)?.fieldId || '', trusted: event.isTrusted });
  }, true);
  listen(doc, 'focusout', event => {
    const value = field(event.target); if (!value) return;
    recorder.content(value.fieldId, value.text, { cause: 'blur' }, true);
    recorder.record('field_blurred', { fieldId: value.fieldId, relatedFieldId: field(event.relatedTarget)?.fieldId || '',
      cause: Date.now() - lastNavigation.at < 1000 ? lastNavigation.cause : 'programmatic_or_unknown', trusted: event.isTrusted });
  }, true);
  for (const type of ['input', 'change', 'compositionend']) listen(doc, type, event => {
    const value = field(event.target); if (!value) return;
    recorder.content(value.fieldId, value.text, { inputType: event.inputType || type,
      composing: Boolean(event.isComposing), trusted: event.isTrusted });
  }, true);
  listen(doc, 'click', event => {
    const clickedField = field(event.target);
    if (clickedField) recorder.record('field_clicked', { fieldId: clickedField.fieldId, trusted: event.isTrusted });
    const target = event.target?.closest?.('button,a,input[type=button],input[type=submit],[role=button],[data-journal-action]');
    const action = target && resolveAction(target); if (!action) return;
    snapshot('before_action');
    recorder.record('button_clicked', { action: action.action,label:action.label || '', stage: action.stage || '',
      disabled: Boolean(target.disabled), trusted: event.isTrusted });
  }, true);
  listen(doc, 'select', event => {
    const value = field(event.target); if (!value) return;
    recorder.record('selection_changed', { fieldId: value.fieldId,
      selectionStart: event.target.selectionStart, selectionEnd: event.target.selectionEnd });
  }, true);
  listen(doc, 'visibilitychange', () => { snapshot('visibility'); recorder.record('page_visibility', { visibility: doc.visibilityState }); });
  for (const type of ['focus', 'blur']) listen(win, type, () => recorder.record('page_focus', { action: type }));
  listen(win, 'pagehide', event => { snapshot('pagehide'); recorder.record('page_hidden', { persisted: event.persisted }); void recorder.flush({ force: true, keepalive: true }); });
  listen(win, 'pageshow', event => recorder.record('page_shown', { persisted: event.persisted }));
  for (const type of ['online', 'offline']) listen(win, type, () => {
    recorder.record('network_observed', { online: type === 'online' }); if (type === 'online') void recorder.flush({ force: true });
  });
  recorder.record('page_opened', { navigationType: win.performance?.getEntriesByType('navigation')?.[0]?.type || 'unknown' });
  function environment() { recorder.record('environment_observed', { browser: String(win.navigator.userAgent).slice(0, 1000),
    platform: String(win.navigator.userAgentData?.platform || win.navigator.platform || '').slice(0, 160),
    languages: [...(win.navigator.languages || [])].slice(0, 10), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: { width: win.innerWidth, height: win.innerHeight, dpr: win.devicePixelRatio },
    screen: { width: win.screen.width, height: win.screen.height }, online: win.navigator.onLine,
    capabilities: { indexedDB: Boolean(win.indexedDB), serviceWorkerControlled: Boolean(win.navigator.serviceWorker?.controller) } }); }
  environment();
  snapshot('mount');
  return { snapshot,environment, stop: () => remove.forEach(stop => stop()) };
}

export function observeAudio({ recorder, audio, fieldId = 'listening:audio', intervalMs = 5000 }) {
  const listeners = []; let lastTimeUpdate = -Infinity;
  const snapshot = action => {
    try {
      recorder.record('audio_observed', { fieldId, action, positionSeconds: audio.currentTime,
        durationSeconds: Number.isFinite(audio.duration) ? audio.duration : null,
        bufferedUntil: audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0,
        paused: audio.paused, ended: audio.ended, seeking: audio.seeking, readyState: audio.readyState,
        networkState: audio.networkState, playbackRate: audio.playbackRate, volume: audio.volume,
        muted: audio.muted, mediaErrorCode: audio.error?.code || null });
    } catch { /* Reading an unavailable player must not interrupt the exam. */ }
  };
  for (const type of ['play', 'playing', 'pause', 'waiting', 'stalled', 'seeking', 'seeked', 'error', 'ended',
    'volumechange', 'ratechange', 'loadedmetadata', 'timeupdate']) {
    const listener = () => {
      try {
        if (type === 'timeupdate' && performance.now() - lastTimeUpdate < intervalMs) return;
        if (type === 'timeupdate') lastTimeUpdate = performance.now();
        snapshot(type);
      } catch { /* A detached player must not interrupt the exam. */ }
    };
    audio.addEventListener(type, listener); listeners.push(() => audio.removeEventListener(type, listener));
  }
  const stop = () => listeners.forEach(remove => remove());
  stop.snapshot = snapshot; return stop;
}
