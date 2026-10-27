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
    const { audio, token, slug, studentRef, classCode, apiBase, generation, resumeButton, manualButton, render } = options;
    const bound = identity(options);
    const ownerId=ownerFor(bound);
    let memory = { ...read(bound), identity: bound };
    let phase = memory.manual ? 'technical_pause' : options.initial.audioAutoplayBlocked ? 'awaiting_user' : 'playing';
    let lastAdvance = performance.now(), observed = audio.currentTime || 0;
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
    function terminal() { return disposed || destroyed || ['submitting', 'submitted', 'ended'].includes(phase); }
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
      manualButton.disabled = ['submitting', 'submitted', 'ended'].includes(phase);
    }
    function emit(event, extra = {}) {
      const payload = { examSessionToken: token, event, section: 'listening', build: '20261014-audio-terminal-v1',
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
    function send(state, keepalive = false) {
      const snapshot = { examSessionToken: token, heardSeconds: Math.max(0, Number(memory.heardSeconds) || 0, Number(audio.currentTime) || 0),
        state, recoveryId: memory.recoveryId || uuid() };
      const execute = async () => {
        if (state === 'playing' && memory.pending) return null;
        if (state === 'playing' && snapshot.heardSeconds + 0.25 < (Number(memory.ackedHeard) || 0)) return null;
        const response = await fetch(`${apiBase}/api/term-tests/${slug}/session/audio-progress`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...snapshot,
            audioStateRevision: revision, generation: Number(generation) || 0, audioOwnerId: ownerId }),
          signal: AbortSignal.timeout(8000), keepalive
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw Object.assign(new Error(payload.message || 'Chưa đồng bộ được mốc nghe.'),
          { code: payload.error || 'AUDIO_SYNC_FAILED', retryable: response.status >= 500 || response.status === 429 });
        return apply(payload);
      };
      const operation = keepalive ? execute() : queue.catch(() => null).then(execute);
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
      if (error.code === 'AUDIO_OWNER_CONFLICT') audio.pause();
      retryable = error.retryable !== false && !String(error.code || '').match(/STALE|CONFLICT|EXPIRED|MISMATCH|LOCKED/);
      nextRetryAt = performance.now() + Math.min(30000, 1000 * 2 ** retryCount++);
      notice(error.code === 'AUDIO_RECOVERY_EXPIRED' ? 'Đã hết thời gian phục hồi Listening.' : `${error.message} Bản lưu trên máy vẫn được giữ.`);
      emit('audio_sync_failed', { errorCode: String(error.code || 'AUDIO_NETWORK_ERROR').slice(0, 80), recoveryId: memory.recoveryId });
    }
    async function recover(reason, { force = false, keepPaused = false } = {}) {
      if (terminal() || navigating) return;
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
        if (terminal() || navigating || memory.recoveryId !== episodeId) return null;
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
          await send('pause'); notice(awaitingUser ? 'Trình duyệt chưa cho phát · nhấn Tiếp tục audio' : 'Audio đang dừng do sự cố. Nhấn Tiếp tục audio khi nghe được.');
        } else {
          try {
            if (wasPaused) await audio.play();
            if (terminal() || navigating || memory.recoveryId !== episodeId) { audio.pause(); return null; }
            phase = 'playing'; observed = audio.currentTime; lastAdvance = performance.now();
            notice(payload.recoveryLimitReached ? 'Đang phát · đã hết mức bù 15 phút' : 'Đang phát bài thi');
          } catch (error) {
            if (terminal() || navigating || memory.recoveryId !== episodeId) return null;
            if (error?.name !== 'NotAllowedError') throw Object.assign(new Error('Chưa đọc được audio. Hãy tải lại trang để lấy lại audio; nháp và mốc nghe được giữ.'), { code: 'AUDIO_BLOB_UNAVAILABLE', retryable: false });
            episode('autoplay'); phase = 'awaiting_user';
            await send('pause').catch(() => null); notice('Trình duyệt chưa cho phát · nhấn Tiếp tục audio');
          }
        }
        emit('audio_recovery', { recoveryId: episodeId });
        return payload;
      })().catch(error => { if (memory.recoveryId === episodeId && !navigating && !disposed) failed(error); return null; }).finally(() => { recoveryPromise = null; });
      return recoveryPromise;
    }
    function tick() {
      if (!disposed && !navigating && phase === 'sync_failed' && retryable && !memory.manual
          && retryCount <= 5 && performance.now() >= nextRetryAt) { recover('retry', { force: true }); return; }
      if (disposed || navigating || phase !== 'playing' || audio.ended) return;
      const current = Number(audio.currentTime) || 0;
      if (current > observed + 0.05) { observed = current; lastAdvance = performance.now(); }
      else if (audio.paused || performance.now() - lastAdvance >= 1800) recover(audio.paused ? 'pause' : 'stalled');
      if (memory.pending) recover('online');
    }
    function startWatch() { if (!timer) timer = window.setInterval(tick, 500); }
    function stopWatch() { if (timer) window.clearInterval(timer); timer = 0; }
    audio.addEventListener('timeupdate', () => {
      if (terminal() || navigating) return;
      save();
      if (phase !== 'playing') return;
      notice('Đang phát bài thi');
      const bucket = Math.floor((audio.currentTime * 1000 + phaseOffset) / 5000);
      if (bucket > lastBucket && !memory.pending) { lastBucket = bucket; send('playing').catch(failed); }
    });
    audio.addEventListener('pause', () => { if (phase === 'playing' && !navigating && !audio.ended) recover('pause'); });
    audio.addEventListener('waiting', () => { if (phase === 'playing') window.setTimeout(tick, 1800); });
    audio.addEventListener('stalled', tick);
    audio.addEventListener('error', () => { if (!terminal() && !navigating) { episode('blob'); retryable = false; phase = 'sync_failed'; notice('Không thể đọc audio. Hãy nhấn Tiếp tục audio để tải lại đúng mốc.'); } });
    audio.addEventListener('ended', () => { if (terminal() || navigating) return; memory.pending = false; memory.manual = false; phase = 'ended'; save(); stopWatch(); notice('Đã phát xong audio'); });
    manualButton.addEventListener('click', () => {
      if (terminal() || navigating) return;
      if (recoveryPromise) memory.recoveryId = uuid();
      episode('manual', true); phase = 'technical_pause'; audio.pause();
      send('pause').catch(failed); notice('Audio đang dừng do sự cố. Nhấn Tiếp tục audio khi nghe được.');
      emit('audio_manual_pause', { recoveryId: memory.recoveryId });
    });
    resumeButton.addEventListener('click', () => {
      if (terminal() || navigating) return;
      if (audio.error || audio.readyState === 0) { save(); window.location.reload(); return; }
      recover('user', { force: true });
    });
    window.addEventListener('online', () => { retryCount = 0; if (memory.pending && !memory.manual && phase !== 'awaiting_user' && retryable) recover('online', { force: true }); });
    window.addEventListener('pagehide', event => {
      if (disposed || destroyed) return;
      if (recoveryPromise) memory.recoveryId = uuid();
      if (['submitted', 'ended'].includes(phase)) return;
      episode('pagehide', memory.manual); navigating = true; stopWatch();
      send('pagehide', true).catch(() => null);
      emit('audio_pagehide', { persisted: event.persisted, recoveryId: memory.recoveryId });
      if (!event.persisted) disposed = true;
    });
    window.addEventListener('pageshow', event => {
      if (!event.persisted || destroyed || ['submitted','submitting','ended'].includes(phase)) return;
      if (audio.error || audio.readyState === 0) { save(); window.location.reload(); return; }
      disposed = false; navigating = false; startWatch();
      emit('audio_pageshow', { persisted: true, recoveryId: memory.recoveryId });
      if (!memory.manual) recover('pageshow', { force: true });
      window.dispatchEvent(new CustomEvent('term-test:listening-resumed'));
    });
    const controller = {
      async beforeAutoSubmit() {
        if (['submitted','submitting'].includes(phase) || destroyed) return { submit: false };
        if ((window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) >= hardDeadline) return { submit: true };
        if (phase === 'ended') return { submit: (window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) >= deadline, deadlineChanged: (window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) < deadline };
        if (memory.pending || recoveryPromise) await recover('deadline', { force: true, keepPaused: memory.manual || phase === 'awaiting_user' });
        if (['submitted','submitting'].includes(phase) || destroyed) return { submit: false };
        return { submit: !memory.pending && (window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) >= deadline, deadlineChanged: (window.IZONE_EXAM_CLOCK?.now(offset) ?? (Date.now() + offset)) < deadline };
      },
      submitting() { phase = 'submitting'; stopWatch(); audio.pause(); save(); },
      submitFailed() {
        if (phase !== 'submitting') return;
        if (audio.ended || Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration) {
          phase = 'ended'; memory.pending = false; memory.manual = false; stopWatch(); save(); notice('Đã phát xong audio'); return;
        }
        phase = memory.manual ? 'technical_pause' : 'playing'; startWatch();
        if (!memory.manual) recover('submit-failed', { force: true });
      },
      finish() { phase = 'submitted'; memory.pending = false; memory.manual = false; stopWatch(); audio.pause(); save(); releaseLease(bound); },
      dispose() {
        if (disposed) return;
        if (terminal()) { disposed = true; destroyed = true; stopWatch(); audio.pause(); channel?.close(); releaseLease(bound); return; }
        if (recoveryPromise) memory.recoveryId = uuid();
        episode('load-error', memory.manual); phase = 'sync_failed'; stopWatch(); audio.pause();
        send('pause').catch(() => null); disposed = true; destroyed = true; channel?.close(); releaseLease(bound);
      },
      inspect() { return { phase, pending: !!memory.pending, revision, watchdogActive: !!timer, deadline, hardDeadline, disposed }; }
    };
    window.K56_LISTENING_AUDIO = controller;
    apply(options.initial);
    save();
    if (memory.manual) { audio.pause(); notice('Audio đang dừng do sự cố. Nhấn Tiếp tục audio khi nghe được.'); }
    else if (phase === 'awaiting_user') notice('Trình duyệt chưa cho phát · nhấn Tiếp tục audio');
    else notice('Đang phát bài thi');
    startWatch();
    if (memory.pending && !memory.manual && phase !== 'awaiting_user') recover('ready');
    return controller;
  }
  window.K56AudioRecovery = Object.freeze({ version: VERSION, ownerId, prepare, beginLoading, create });
}());
