(function () {
  'use strict';
  const VERSION = 2;
  const uuid = () => crypto.randomUUID();
  const ownerId = uuid();
  const leases = new Map();
  function key(identity) { return 'izone-k56-audio:v2:' + encodeURIComponent(JSON.stringify(identity)); }
  function ownerFor(bound){return leases.get(key(bound))?.ownerId||ownerId;}
  async function acquire(bound,saved=read(bound)){
    if(!navigator.locks?.request)return null;
    const name=key(bound);let lease=leases.get(name);
    if(lease?.live)return lease;
    if(lease?.pending)return lease.pending;
    lease ||= {ownerId:saved.ownerId||ownerId,live:false,unlock:null,pending:null};leases.set(name,lease);
    lease.pending=new Promise((resolve,reject)=>{
      navigator.locks.request(name,{ifAvailable:true},async lock=>{
        if(!lock){reject(Object.assign(new Error('Bài đang mở ở tab khác. Nháp được giữ; hãy quay lại hoặc đóng tab đó trước.'),{code:'AUDIO_OWNER_CONFLICT'}));return;}
        lease.live=true;resolve(lease);await new Promise(done=>{lease.unlock=done;});lease.live=false;
      }).catch(reject);
    });
    try{return await lease.pending;}finally{lease.pending=null;}
  }
  function releaseLease(bound){const lease=leases.get(key(bound));if(lease){lease.live=false;lease.unlock?.();lease.unlock=null;}}
  window.addEventListener('pagehide',()=>{for(const lease of leases.values()){lease.live=false;lease.unlock?.();lease.unlock=null;}});
  function read(identity) {
    try { const value = JSON.parse(localStorage.getItem(key(identity)) || '{}'); return value.identity && JSON.stringify(value.identity) === JSON.stringify(identity) ? value : {}; }
    catch { return {}; }
  }
  function identity(options) {
    return [options.apiBase, options.classCode, options.slug, options.studentRef, options.token, Number(options.generation) || 0];
  }
  async function prepare(options) {
    const bound = identity(options), saved = read(bound);
    await acquire(bound,saved);const preparedOwnerId=ownerFor(bound);
    if (typeof BroadcastChannel === 'function') {
      const active = await new Promise(resolve => {
        const channel = new BroadcastChannel(key(bound));
        const timer = setTimeout(() => { channel.close(); resolve(false); }, 250);
        channel.onmessage = event => {
          if (event.data?.type === 'owner-active' && event.data.ownerId !== preparedOwnerId) {
            clearTimeout(timer); channel.close(); resolve(true);
          }
        };
        channel.postMessage({ type: 'owner-probe', ownerId:preparedOwnerId });
      });
      if (active) throw new Error('Bài đang mở trên một tab khác. Nháp được giữ; hãy tiếp tục ở tab đó hoặc đóng tab đó trước khi mở lại.');
    }
    const recoveryId = saved.pending && saved.recoveryId ? saved.recoveryId : uuid();
    const value = { ...saved, identity: bound, ownerId:preparedOwnerId, recoveryId, pending: true };
    try { localStorage.setItem(key(bound), JSON.stringify(value)); } catch { /* Giữ nháp chính ở luồng lưu bài. */ }
    return { recoveryId, heardSeconds: Number.isFinite(saved.heardSeconds) ? saved.heardSeconds : undefined,
      revision: Number.isSafeInteger(saved.revision) ? saved.revision : undefined, ownerId:preparedOwnerId };
  }

  function beginLoading(options, response) {
    const bound = identity(options), saved = read(bound);
    const value = { ...saved, identity: bound, ownerId:ownerFor(bound), recoveryId: uuid(), pending: true,
      heardSeconds: response.listeningResumeAtSeconds, revision: response.audioStateRevision };
    try { localStorage.setItem(key(bound), JSON.stringify(value)); } catch { /* Nháp chính được giữ riêng. */ }
    return value;
  }

  function create(options) {
    const { audio, token, slug, studentRef, classCode, apiBase, generation, resumeButton, manualButton, render, lifecycle } = options;
    const eventScope = new AbortController();
    const listen = (target, type, handler) => target.addEventListener(type, handler, {signal: eventScope.signal});
    const pause = reason => lifecycle ? lifecycle.command('pause', reason, () => audio.pause()) : audio.pause();
    const play = reason => lifecycle ? lifecycle.command('play', reason, () => audio.play()) : audio.play();
    const retire = reason => {
      eventScope.abort();
      channel?.close();
      releaseLease(bound);
      lifecycle?.retire(reason, {releaseSource: options.releaseSource});
      if (window.K56_LISTENING_AUDIO === controller) delete window.K56_LISTENING_AUDIO;
    };
    const bound = identity(options);
    const ownerId=ownerFor(bound);
    let memory = { ...read(bound), identity: bound };
    let reportedEpisode = memory.manual ? memory.recoveryId : null;
    function observeListening(phase, incidentId, extra = {}) {
      if (!options.observeListening || !incidentId) return;
      try { options.observeListening({phase, incidentId, ...extra}); } catch {}
    }
    let phase = memory.manual ? 'technical_pause' : audio.ended ? 'ended' : audio.paused ? 'awaiting_user' : 'playing';
    let lastBucket = -1, timer = 0, queue = Promise.resolve(), recoveryPromise = null;
    let disposed = false, destroyed = false, navigating = false;
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(key(bound)) : null;
    if (channel) channel.onmessage = event => {
      if (event.data?.type === 'owner-probe' && event.data.ownerId !== ownerId
          && !disposed && !navigating && !['submitting', 'submitted', 'ended'].includes(phase)
          && read(bound).ownerId === ownerId) channel.postMessage({ type: 'owner-active', ownerId });
    };
    let retryCount = 0, nextRetryAt = 0, retryable = true;
    let revision = Number(options.initial.audioStateRevision) || 0;
    let deadline = Date.parse(options.initial.listeningDeadlineAt);
    let hardDeadline = Date.parse(options.initial.listeningHardDeadlineAt);
    let offset = (window.IZONE_EXAM_CLOCK?.offset(options.initial.serverNow) ?? (Date.parse(options.initial.serverNow) - Date.now()));
    const phaseOffset = Array.from(token).reduce((h, c) => ((h * 33) ^ c.charCodeAt(0)) >>> 0, 5381) % 5000;
    function terminal() { return disposed || destroyed || ['submitting', 'submission_pending', 'submitted', 'ended'].includes(phase); }
    function save() {
      const latest = read(bound);
      if (latest.ownerId && latest.ownerId !== ownerId) return;
      memory.ownerId = ownerId;
      // Blob lỗi có thể làm browser đưa currentTime về 0 trước sự kiện error.
      // Giữ mốc đã nghe của đúng phiên để lần tải lại không gửi mốc cũ.
      memory.heardSeconds = Math.max(0, Number(memory.heardSeconds) || 0, Number(audio.currentTime) || 0);
      memory.revision = revision;
      try { localStorage.setItem(key(bound), JSON.stringify(memory)); } catch { /* Không làm dừng audio. */ }
    }
    function notice(text) {
      render(text, audio.currentTime, audio.duration);
      resumeButton.hidden = !['technical_pause', 'awaiting_user', 'sync_failed'].includes(phase);
      manualButton.disabled = ['submitting', 'submission_pending', 'submitted', 'ended'].includes(phase);
    }
    function emit(event, extra = {}) {
      const payload = { examSessionToken: token, event, section: 'listening', build: '20261113-mini-online-pending-seal-v1',
        online: navigator.onLine, occurredAt: new Date().toISOString(), revision,
        navigationType: performance.getEntriesByType('navigation')[0]?.type || 'navigate',
        heardSeconds: Math.max(0, Number(audio.currentTime) || 0), ...extra };
      fetch(`${apiBase}/api/term-tests/${slug}/client-event`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) }).catch(() => null);
    }
    function apply(payload) {
      if (terminal() || navigating) return payload;
      if (payload.audioRecoveryVersion !== VERSION || !Number.isSafeInteger(payload.audioStateRevision)
          || !Number.isFinite(payload.listeningResumeAtSeconds) || !Number.isFinite(Date.parse(payload.listeningDeadlineAt))
          || !Number.isFinite(Date.parse(payload.listeningHardDeadlineAt))
          || Number(payload.generation) !== (Number(generation) || 0)) {
        throw Object.assign(new Error('Không thể đối soát phiên bản phục hồi audio.'), { code: 'AUDIO_CONTRACT_MISMATCH' });
      }
      if (payload.audioStateRevision < revision) throw Object.assign(new Error('Phản hồi audio đã cũ.'), { code: 'AUDIO_RESPONSE_STALE' });
      revision = payload.audioStateRevision;
      memory.ackedHeard = payload.listeningResumeAtSeconds;
      deadline = Date.parse(payload.listeningDeadlineAt); hardDeadline = Date.parse(payload.listeningHardDeadlineAt);
      if (Number.isFinite(Date.parse(payload.serverNow))) offset = (window.IZONE_EXAM_CLOCK?.offset(payload.serverNow) ?? (Date.parse(payload.serverNow) - Date.now()));
      window.dispatchEvent(new CustomEvent('term-test:listening-timing-updated', { detail: {
        ...payload, examSessionToken: token, studentRef, classCode, testSlug: slug, apiBase, generation: Number(generation) || 0
      } }));
      save();
      return payload;
    }
    function send(state, keepalive = false, manualReport = null) {
      const snapshot = { examSessionToken: token, heardSeconds: Math.max(0, Number(memory.heardSeconds) || 0, Number(audio.currentTime) || 0),
        state, recoveryId: memory.recoveryId || uuid() };
      const episodeAtSend = memory.recoveryId;
      const stillCurrent = () => !terminal() && !navigating && memory.recoveryId === episodeAtSend;
      const manualRecovery = state === 'recovered' && snapshot.recoveryId === reportedEpisode;
      let trace;
      const execute = async () => {
        if (!keepalive && !stillCurrent()) return null;
        if (state === 'playing' && memory.pending) return null;
        if (state === 'playing' && snapshot.heardSeconds + 0.25 < (Number(memory.ackedHeard) || 0)) return null;
        if (manualRecovery && options.observeListening) {
          trace = {requestId:uuid(),requestRevision:revision,generation:Number(generation)||0,
            requestedSeconds:snapshot.heardSeconds};
          observeListening('recovery_sent', snapshot.recoveryId, trace);
        }
        const response = await fetch(`${apiBase}/api/term-tests/${slug}/session/audio-progress`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(trace?{'x-exam-journal-request-id':trace.requestId}:{}) }, body: JSON.stringify({ ...snapshot,
            audioStateRevision: revision, generation: Number(generation) || 0, audioOwnerId: ownerId,
            ...(manualReport?{manualListeningReport:manualReport.position}:{}) }),
          signal: AbortSignal.timeout(8000), keepalive
        });
        const payload = await response.json();
        if (!stillCurrent()) return null;
        if (!response.ok || !payload.ok) throw Object.assign(new Error(payload.message || 'Chưa đồng bộ được mốc nghe.'),
          { code: payload.error || 'AUDIO_SYNC_FAILED', retryable: response.status >= 500 || response.status === 429 });
        const applied = apply(payload);
        if(manualReport&&applied.miniListeningReportGrant){
          try{options.onManualReportAccepted?.(manualReport,applied.miniListeningReportGrant);}catch{}
        }
        if (manualRecovery && !terminal() && !navigating) {
          observeListening('recovery_ack', snapshot.recoveryId, {
            ...trace, serverRevision:applied.audioStateRevision, checkpointSeconds:applied.listeningResumeAtSeconds,
            grantedRecoverySeconds: applied.grantedRecoverySeconds,
            totalRecoverySeconds: applied.listeningRecoverySeconds
          });
        }
        return applied;
      };
      const work = keepalive ? execute() : queue.catch(() => null).then(execute);
      const operation = manualRecovery && options.observeListening ? work.catch(error => {
        if (trace && !terminal() && !navigating) observeListening('recovery_failed', snapshot.recoveryId,
          {...trace,errorCode:typeof error.code==='string'?error.code:'AUDIO_NETWORK_ERROR'});
        throw error;
      }) : work;
      queue = operation.catch(() => null);
      return operation;
    }
    function episode(reason, manual = false) {
      if (!memory.pending) memory.recoveryId = uuid();
      memory.pending = true; memory.manual = manual; memory.reason = reason;
      save();
    }
    function failed(error) {
      if (terminal()) return;
      episode(memory.reason || 'network', memory.manual);
      phase = 'sync_failed';
      if (error.code === 'AUDIO_OWNER_CONFLICT' && !audio.paused) pause('owner_conflict');
      retryable = error.retryable !== false && !String(error.code || '').match(/STALE|CONFLICT|EXPIRED|MISMATCH|LOCKED/);
      nextRetryAt = performance.now() + Math.min(30000, 1000 * 2 ** retryCount++);
      notice(error.code === 'AUDIO_RECOVERY_EXPIRED' ? 'Đã hết thời gian phục hồi Listening.' : `${error.message} Bản lưu trên máy vẫn được giữ.`);
      emit('audio_sync_failed', { errorCode: String(error.code || 'AUDIO_NETWORK_ERROR').slice(0, 80), recoveryId: memory.recoveryId });
    }
    async function recover(reason, { force = false, keepPaused = false } = {}) {
      if (terminal() || navigating || (audio.paused && reason !== 'user')) return;
      if (recoveryPromise) return recoveryPromise;
      if (phase === 'awaiting_user' && !force) return;
      if (memory.manual && !force) return;
      episode(reason, memory.manual && keepPaused);
      const episodeId = memory.recoveryId;
      const awaitingUser = phase === 'awaiting_user';
      const wasPaused = audio.paused;
      phase = 'recovering'; notice('Đang khôi phục audio...');
      recoveryPromise = (async () => {
        await acquire(bound);
        const payload = await send('recovered');
        if (!payload || terminal() || navigating || memory.recoveryId !== episodeId) return null;
        retryCount = 0;
        if ((window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) >= Date.parse(payload.listeningHardDeadlineAt)) {
          phase = 'sync_failed'; notice('Đã hết mức bù thời gian Listening.'); return payload;
        }
        if (wasPaused) {
          if (payload.listeningResumeAtSeconds > audio.currentTime + 0.25) {
            throw Object.assign(new Error('Mốc nghe thuộc một tab khác; chưa thể tự tua audio.'), { code: 'AUDIO_PROGRESS_STALE' });
          }
          audio.currentTime = Math.min(Math.max(0, payload.listeningResumeAtSeconds), audio.duration);
        }
        memory.pending = false; memory.manual = false; save();
        if (audio.ended || audio.currentTime >= audio.duration) { phase = 'ended'; stopWatch(); notice('Đã phát xong audio'); return payload; }
        if (keepPaused) {
          episode(awaitingUser ? 'autoplay' : 'manual', !awaitingUser); phase = awaitingUser ? 'awaiting_user' : 'technical_pause';
          await send('pause'); notice(awaitingUser ? 'Trình duyệt chưa cho phát · nhấn Nghe tiếp' : 'Audio đang dừng do sự cố. Nhấn Nghe tiếp khi nghe được.');
        } else {
          try {
            if (wasPaused) await play('explicit_recovery');
            if (terminal() || navigating || memory.recoveryId !== episodeId) { if (!audio.paused && !destroyed) pause('recovery_superseded'); return null; }
            phase = 'playing';
            notice(payload.recoveryLimitReached ? 'Đang phát · đã hết mức bù 15 phút' : 'Đang phát bài thi');
          } catch (error) {
            if (terminal() || navigating || memory.recoveryId !== episodeId) return null;
            if (error?.name !== 'NotAllowedError') throw Object.assign(new Error('Chưa đọc được audio. Hãy tải lại trang để lấy lại audio; nháp và mốc nghe được giữ.'), { code: 'AUDIO_BLOB_UNAVAILABLE', retryable: false });
            episode('autoplay'); phase = 'awaiting_user';
            await send('pause').catch(() => null); notice('Trình duyệt chưa cho phát · nhấn Nghe tiếp');
          }
        }
        emit('audio_recovery', { recoveryId: episodeId });
        return payload;
      })().catch(error => { if (memory.recoveryId === episodeId && !navigating && !disposed) failed(error); return null; }).finally(() => { recoveryPromise = null; });
      return recoveryPromise;
    }
    function awaitLearnerAfterPause() {
      if (terminal() || navigating || !audio.paused || audio.ended
          || ['awaiting_user', 'technical_pause', 'sync_failed'].includes(phase)) return;
      if (recoveryPromise) memory.recoveryId = uuid();
      episode('media_pause');
      phase = 'awaiting_user';
      notice('Audio đang bị gián đoạn · nhấn Nghe tiếp');
      send('pause').catch(error => {
        if (phase === 'awaiting_user' && error.code === 'AUDIO_OWNER_CONFLICT') failed(error);
      });
    }
    function tick() {
      if (audio.paused) { awaitLearnerAfterPause(); return; }
      if (!disposed && !navigating && phase === 'sync_failed' && retryable && !memory.manual
          && retryCount <= 5 && performance.now() >= nextRetryAt) { recover('retry', { force: true }); return; }
      if (disposed || navigating || phase !== 'playing' || audio.ended) return;
      if (memory.pending) recover('online');
    }
    function startWatch() { if (!timer) timer = window.setInterval(tick, 500); }
    function stopWatch() { if (timer) window.clearInterval(timer); timer = 0; }
    listen(audio, 'timeupdate', () => {
      if (terminal() || navigating) return;
      save();
      if (phase !== 'playing') return;
      notice('Đang phát bài thi');
      const bucket = Math.floor((audio.currentTime * 1000 + phaseOffset) / 5000);
      if (bucket > lastBucket && !memory.pending) { lastBucket = bucket; send('playing').catch(failed); }
    });
    listen(audio, 'pause', awaitLearnerAfterPause);
    listen(audio, 'error', () => { if (!terminal() && !navigating) { episode('blob'); retryable = false; phase = 'sync_failed'; notice('Không thể đọc audio. Hãy nhấn Nghe tiếp để tải lại đúng mốc.'); } });
    listen(audio, 'ended', () => { if (terminal() || navigating) return; memory.pending = false; memory.manual = false; phase = 'ended'; save(); stopWatch(); notice('Đã phát xong audio'); });
    listen(manualButton, 'click', () => {
      if (terminal() || navigating) return;
      let manualReport;
      try{manualReport=options.takeManualReport?.(Date.now()+offset);}catch{}
      if (recoveryPromise) memory.recoveryId = uuid();
      episode('manual', true); phase = 'technical_pause'; pause('confirmed_audio_report');
      reportedEpisode = memory.recoveryId;
      observeListening('manual_pause', reportedEpisode);
      send('pause',false,manualReport).catch(failed); notice('Audio đang dừng do sự cố. Nhấn Nghe tiếp khi nghe được.');
      emit('audio_manual_pause', { recoveryId: memory.recoveryId });
    });
    listen(resumeButton, 'click', () => {
      if (terminal() || navigating) return;
      if (audio.error || audio.readyState === 0) { save(); window.location.reload(); return; }
      recover('user', { force: true });
    });
    listen(window, 'online', () => { retryCount = 0; if (memory.pending && !memory.manual && phase !== 'awaiting_user' && retryable) recover('online', { force: true }); });
    listen(window, 'pagehide', event => {
      if (disposed || destroyed) return;
      if (recoveryPromise) memory.recoveryId = uuid();
      if (['submitting', 'submission_pending', 'submitted', 'ended'].includes(phase)) return;
      episode('pagehide', memory.manual); navigating = true; stopWatch();
      send('pagehide', true).catch(() => null);
      emit('audio_pagehide', { persisted: event.persisted, recoveryId: memory.recoveryId });
      if (!event.persisted || lifecycle) controller.dispose('pagehide');
    });
    listen(window, 'pageshow', event => {
      if (!event.persisted || terminal()) return;
      disposed = false; navigating = false; startWatch();
      emit('audio_pageshow', { persisted: true, recoveryId: memory.recoveryId });
      if (audio.paused) awaitLearnerAfterPause();
      else if (!memory.manual) recover('pageshow', { force: true });
      window.dispatchEvent(new CustomEvent('term-test:listening-resumed'));
    });
    const controller = {
      async beforeAutoSubmit() {
        if (['submitted','submitting'].includes(phase) || destroyed) return { submit: false };
        if (phase === 'ended' && (window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) >= hardDeadline) return { submit: true };
        if (phase === 'ended') return { submit: (window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) >= deadline, deadlineChanged: (window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) < deadline };
        if (memory.pending || recoveryPromise) await recover('deadline', { force: true, keepPaused: memory.manual || phase === 'awaiting_user' });
        if (['submitted','submitting'].includes(phase) || destroyed) return { submit: false };
        return { submit: false, deadlineChanged: true };
      },
      acquireForSubmission() { return acquire(bound); },
      submitting() {
        if (recoveryPromise) memory.recoveryId = uuid();
        phase = 'submitting';
        stopWatch(); pause('early_submit_confirmed'); save(); notice('Đang lưu Listening…');
      },
      submitFailed(pending) {
        if (phase !== 'submitting') return;
        if (pending) {
          phase = 'submission_pending';
          notice('Bản nộp chưa được xác nhận · nhấn Nộp bài Listening để đối soát');
          return;
        }
        if (audio.ended || Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration) {
          phase = 'ended'; memory.pending = false; memory.manual = false; stopWatch(); save(); notice('Đã phát xong audio'); return;
        }
        phase = 'awaiting_user'; startWatch();
        notice('Bản nộp chưa được xác nhận · nhấn Nộp bài Listening để đối soát');
      },
      finish() {
        phase = 'submitted'; memory.pending = false; memory.manual = false;
        stopWatch(); save();
        if (!lifecycle && !audio.paused) pause('submission_finished');
        retire('submission_finished');
      },
      dispose(reason = 'left_listening') {
        if (destroyed) return;
        disposed = true; destroyed = true; stopWatch(); save();
        if (!lifecycle && !audio.paused) pause(reason);
        retire(reason);
      },
      inspect() { return { phase, pending: !!memory.pending, revision, watchdogActive: !!timer, deadline, hardDeadline, disposed }; }
    };
    window.K56_LISTENING_AUDIO = controller;
    apply(options.initial);
    save();
    if (memory.manual) { if (!audio.paused) pause('restored_manual_pause'); notice('Audio đang dừng do sự cố. Nhấn Nghe tiếp khi nghe được.'); }
    else if (phase === 'awaiting_user') notice('Trình duyệt chưa cho phát · nhấn Nghe tiếp');
    else notice('Đang phát bài thi');
    startWatch();
    if (memory.pending && !memory.manual && phase === 'playing') recover('ready');
    return controller;
  }
  async function acquireForSubmission(options) {
    await acquire(identity(options));
  }
  function journalObserver(owner,audio,mode) {
    const config=window.TERM_TEST_APP_CONFIG,slug=window.TERM_TEST_CONFIG?.slug;
    if(config?.EXAM_JOURNAL_ENABLED!==true||!['term-test-1-k56','term-test-2-k56'].includes(slug))return undefined;
    try {
      const endpoint=config.EXAM_JOURNAL_BASE_URL||config.API_BASE_URL+'/api/term-tests/'+slug;
      const key=JSON.stringify([new URL(endpoint,window.location.href).href,slug]);
      return detail=>window[Symbol.for('izone.examJournal.connections.v1')]?.get(key)?.recordK56Listening?.(owner,{
        ...detail,mode,positionSeconds:audio.currentTime,durationSeconds:audio.duration,
        paused:audio.paused,ended:audio.ended,volume:audio.volume,muted:audio.muted
      });
    } catch { return undefined; }
  }
  window.K56AudioRecovery = Object.freeze({ version: VERSION, onlineProtectionVersion:1, ownerId, prepare, beginLoading, create, journalObserver, acquireForSubmission });
}());
