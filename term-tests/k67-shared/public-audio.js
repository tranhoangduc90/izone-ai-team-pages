// BEGIN optional exam journal audio entry
// Copied into native loaders by wire-audio.mjs: no static logger dependency or awaited import.
function startJournalAudioCapture(metadata,bootstrapUrl){
 try{
  const win=globalThis.window,slug=win?.TERM_TEST_CONFIG?.slug;
  if(win?.TERM_TEST_APP_CONFIG?.EXAM_JOURNAL_ENABLED!==true||!slug||!Array.from(['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56','substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']).includes(slug))return null;
  const meta={assetId:metadata?.assetId||slug,sha256:metadata?.sha256,byteLength:metadata?.byteLength,transportRevision:metadata?.transportRevision,startedAt:new Date().toISOString()};
  let observer=null,queue=[],held=0,lost=0,failed=false;
  const budgetKey=Symbol.for('izone.examJournal.audioPreloadBudget.v1'),budget=win[budgetKey]||(win[budgetKey]={bytes:0,streams:0});
  const health=code=>{win.EXAM_JOURNAL_AUDIO_HEALTH={status:'gap',errorCode:code,lostCount:lost,observedAt:new Date().toISOString()};};
  const safeReason=value=>{
   const text=typeof value==='string'?value:'';
   return /^(?:ACCESS_DENIED|ACCESS_TIMEOUT|WORKER_QUOTA_1027|PRIMARY_CIRCUIT_OPEN|PRIMARY_HASH_MISMATCH|FALLBACK_HASH_MISMATCH|WHOLE_HASH_MISMATCH|ENVELOPE_INVALID|AUDIO_CATALOG_MISMATCH|AUDIO_ORIGIN_DENIED|CACHE_UNAVAILABLE|CACHE_TIMEOUT|CACHE_FAILED|AUDIO_EMPTY|AbortError|OperationError|TypeError)$/.test(text)||/^(?:PRIMARY_HTTP|FALLBACK_HTTP|ACCESS_SOURCE|AUDIO_HTTP)_[1-5]\d{2}$/.test(text)?text:'AUDIO_SOURCE_ERROR';
  };
  const invoke=(method,data)=>{try{const work=observer?.[method]?.(data);if(work?.catch)void work.catch(()=>health('JOURNAL_AUDIO_OBSERVER_UNAVAILABLE'));}catch{health('JOURNAL_AUDIO_OBSERVER_UNAVAILABLE');}};
  const call=(method,row)=>{try{
   if(failed)return;const data={observedAt:new Date().toISOString()};
   if(method==='event'){
    if(!['cloudflare','pages','cache','cache-error','primary-error','legacy-vps','legacy-pages'].includes(row?.source))return;
    data.source=row.source;
    for(const field of ['index','status','wireBytes'])if(Number.isSafeInteger(row[field])&&row[field]>=0&&row[field]<=512*1024*1024)data[field]=row[field];
    if(row.source==='primary-error'||row.source==='cache-error')data.reason=safeReason(row.reason);
   }else if(method==='complete'){
    data.verified=row?.verified===true;data.byteLength=Number.isSafeInteger(row?.byteLength)?row.byteLength:null;
   }else data.message=safeReason(row?.name==='AbortError'?'AbortError':row?.message||row?.name);
   if(observer){invoke(method,data);return;}
   const size=JSON.stringify(data).length*2;
   if(queue.length>=256||budget.bytes+size>256*1024){lost++;health('JOURNAL_AUDIO_PRELOAD_BUDGET');return;}
   queue.push([method,data]);held+=size;budget.bytes+=size;
  }catch{health('JOURNAL_AUDIO_OBSERVER_UNAVAILABLE');}};
  if(typeof win.EXAM_JOURNAL_AUDIO_TRANSFER==='function')observer=win.EXAM_JOURNAL_AUDIO_TRANSFER(meta);
  if(!observer){
   if(budget.streams>=8){health('JOURNAL_AUDIO_PRELOAD_QUEUE_FULL');return null;}budget.streams++;
   const classCodeHint=(new URL(win.location.href).searchParams.get('class')||'').trim().toUpperCase();
   void import(bootstrapUrl).then(({connectAudioCapture})=>{
    observer=connectAudioCapture(meta,{classCodeHint});
    if(!observer){health('JOURNAL_AUDIO_PRELOAD_UNAVAILABLE');return;}
    if(lost)invoke('event',{source:'observation-gap',lostCount:lost});
    for(const [method,data]of queue)invoke(method,data);
   }).catch(()=>health('JOURNAL_AUDIO_PRELOAD_UNAVAILABLE')).finally(()=>{failed=!observer;budget.bytes-=held;held=0;queue=[];budget.streams--;});
  }
  return{event:row=>call('event',row),complete:row=>call('complete',row),fail:row=>call('fail',row)};
 }catch{return null;}
}
// END optional exam journal audio entry
(function () {
  'use strict';
  const transportUrl = new URL('../../shared/audio/transport.mjs?v=20261026-term1-replay1&journal=20261024-startup-v2&resilience=20261027-v1', document.currentScript.src).href;
  const journalUrl = new URL('../shared/exam-journal/bootstrap-capture.mjs?v=20261024-startup-v2&resilience=20261027-v1', document.currentScript.src).href;
  // Nhận metadata do VPS ghim; tải MP3 Pages từng phần, kiểm hash rồi mới cho phát.
  // Phần đúng giữ 24 giờ trong IndexedDB; lỗi mạng chỉ thử lại phần thiếu/hỏng.
  // Lỗi kho dùng RAM, lỗi hash/phiên bản ném về phòng chờ để khóa Bắt đầu.
  const memory = new Map(), database = 'izone-k67-public-audio-v1';
  const hex = b => Array.from(new Uint8Array(b), n => n.toString(16).padStart(2, '0')).join('');
  const digest = async b => hex(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()));
  function validManifest(m) {
    if (!m || m.envelopeVersion !== 'MP3' || !/^[a-f0-9]{64}$/.test(m.sha256)
      || m.assetVersion !== 'sha256-' + m.sha256 || !Number.isSafeInteger(m.byteLength) || m.byteLength < 1
      || m.encryptedByteLength !== m.byteLength || m.chunkSize !== 1048576 || !Array.isArray(m.chunks)
      || m.chunks.length !== Math.ceil(m.byteLength / m.chunkSize)) return false;
    try {
      const u = new URL(m.url);
      if (u.origin !== 'https://tranhoangduc90.github.io' || u.search || u.hash
        || !u.pathname.startsWith('/izone-ai-team-pages/term-tests/k67-audio-assets/')
        || !u.pathname.endsWith('-' + m.sha256.slice(0, 16) + '.mp3')) return false;
    } catch { return false; }
    return m.chunks.every((c, i) => c.byteLength === Math.min(m.chunkSize, m.byteLength - i * m.chunkSize)
      && /^[a-f0-9]{64}$/.test(c.sha256));
  }
  async function storage(mode, run) {
    return new Promise((resolve, reject) => {
      let db, transaction;
      const timer = setTimeout(() => { try { transaction?.abort(); db?.close(); } catch {} reject(new Error('AUDIO_STORE_TIMEOUT')); }, 2500);
      const fail = () => { clearTimeout(timer); db?.close(); reject(new Error('AUDIO_STORE_FAILED')); };
      let request;
      try { request = indexedDB.open(database, 1); } catch { fail(); return; }
      request.onupgradeneeded = () => request.result.createObjectStore('parts', {keyPath: 'id'});
      request.onerror = request.onblocked = fail;
      request.onsuccess = () => {
        db = request.result;
        try {
          let result;
          transaction = db.transaction('parts', mode);
          transaction.oncomplete = () => { clearTimeout(timer); db.close(); resolve(result); };
          transaction.onerror = transaction.onabort = fail;
          run(transaction.objectStore('parts'), value => { result = value; });
        } catch { fail(); }
      };
    });
  }
  async function cached(id, expected) {
    let record = memory.get(id);
    if (!record) try { record = await storage('readonly', (s, result) => { const r = s.get(id); r.onsuccess = () => result(r.result); }); } catch {}
    if (record?.expiresAt > Date.now() && record.blob instanceof Blob && record.blob.size === expected.byteLength
      && await digest(record.blob) === expected.sha256) return record.blob;
    memory.delete(id);
    try { await storage('readwrite', s => s.delete(id)); } catch {}
    return null;
  }
  async function save(id, blob) {
    const record = {id, blob, expiresAt: Date.now() + 86400000};
    memory.set(id, record);
    try {
      await storage('readwrite', s => {
        s.put(record);
        const r = s.openCursor();
        r.onsuccess = () => { const c = r.result; if (c) { if (c.value.expiresAt <= Date.now()) c.delete(); c.continue(); } };
      });
    } catch {} // RAM vẫn giữ phần đúng khi hết quota; không báo đã lưu bền.
  }
  async function verify(blob, m) {
    if (!validManifest(m) || blob.size !== m.byteLength || await digest(blob) !== m.sha256) throw new Error('Audio sai phiên bản hoặc tải chưa đủ. Hãy thử tải lại.');
    return blob;
  }
  async function download(m, options = {}) {
    if (!validManifest(m)) throw new Error('Định danh audio Pages không hợp lệ.');
    if (m.cloudflare?.version === 1) { const {downloadPreferred} = await import(transportUrl); const blob = await downloadPreferred(m, options); if (blob) return verify(blob, m); }
    const journal=startJournalAudioCapture({sha256:m.sha256,byteLength:m.byteLength,transportRevision:'legacy-mp3-pages'},journalUrl);
    try{
    const checked=async value=>{try{return await verify(value,m);}catch(error){journal?.event({source:'primary-error',reason:'WHOLE_HASH_MISMATCH'});throw error;}};
    const fetchImpl = options.fetchImpl || window.fetch.bind(window), parts = new Array(m.chunks.length);
    let loaded = 0, next = 0, whole = null, failure = null;
    const progress = () => options.onProgress?.({loaded, total: m.byteLength, complete: loaded === m.byteLength});
    const loadPart = async i => {
      options.signal?.throwIfAborted();
      const expected = m.chunks[i], id = m.assetVersion + ':' + i;
      let blob = await cached(id, expected);
      if(blob)journal?.event({source:'cache',index:i,wireBytes:0});
      if (!blob) for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        options.signal?.addEventListener('abort', abort, {once: true});
        const timer = setTimeout(abort, 30000);
        try {
          options.signal?.throwIfAborted();
          const start = i * m.chunkSize, end = start + expected.byteLength - 1;
          const response = await fetchImpl(m.url, {headers: {Range: `bytes=${start}-${end}`}, cache: attempt ? 'reload' : 'default', signal: controller.signal});
          if (!response.ok){journal?.event({source:'legacy-pages',index:i,status:response.status,wireBytes:0});throw new Error('AUDIO_HTTP_' + response.status);}
          const value = await response.blob();
          journal?.event({source:'legacy-pages',index:i,status:response.status,wireBytes:value.size});
          if (response.status === 200 && value.size === m.byteLength) {
            whole = await checked(value);
            for (let j = 0; j < m.chunks.length; j++) await save(m.assetVersion + ':' + j, whole.slice(j * m.chunkSize, j * m.chunkSize + m.chunks[j].byteLength));
            return;
          }
          if (response.status !== 206 || value.size !== expected.byteLength || await digest(value) !== expected.sha256){journal?.event({source:'primary-error',reason:'FALLBACK_HASH_MISMATCH'});throw new Error('Phần audio tải về chưa đúng.');}
          blob = value;
          await save(id, blob);
          break;
        } catch (error) {
          options.signal?.throwIfAborted();
          if (attempt === 1) throw error;
        } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
      }
      parts[i] = blob; loaded += blob.size; progress();
    };
    await Promise.all(Array.from({length: 2}, async () => {
      while (!whole && !failure && next < m.chunks.length) {
        try { await loadPart(next++); } catch (error) { failure = error; }
      }
    }));
    options.signal?.throwIfAborted();
    if (failure && !whole) throw failure;
    const blob = await checked(whole || new Blob(parts, {type: 'audio/mpeg'}));
    loaded = blob.size; progress();
    journal?.complete({byteLength:blob.size,verified:true});return blob;
    }catch(error){journal?.fail(error);throw error;}
  }
  window.K67_PUBLIC_AUDIO = {validManifest, download, verify};
}());
