(function () {
  'use strict';
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
    const fetchImpl = options.fetchImpl || window.fetch.bind(window), parts = new Array(m.chunks.length);
    let loaded = 0, next = 0, whole = null, failure = null;
    const progress = () => options.onProgress?.({loaded, total: m.byteLength, complete: loaded === m.byteLength});
    const loadPart = async i => {
      options.signal?.throwIfAborted();
      const expected = m.chunks[i], id = m.assetVersion + ':' + i;
      let blob = await cached(id, expected);
      if (!blob) for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        options.signal?.addEventListener('abort', abort, {once: true});
        const timer = setTimeout(abort, 30000);
        try {
          options.signal?.throwIfAborted();
          const start = i * m.chunkSize, end = start + expected.byteLength - 1;
          const response = await fetchImpl(m.url, {headers: {Range: `bytes=${start}-${end}`}, cache: attempt ? 'reload' : 'default', signal: controller.signal});
          if (!response.ok) throw new Error('AUDIO_HTTP_' + response.status);
          const value = await response.blob();
          if (response.status === 200 && value.size === m.byteLength) {
            whole = await verify(value, m);
            for (let j = 0; j < m.chunks.length; j++) await save(m.assetVersion + ':' + j, whole.slice(j * m.chunkSize, j * m.chunkSize + m.chunks[j].byteLength));
            return;
          }
          if (response.status !== 206 || value.size !== expected.byteLength || await digest(value) !== expected.sha256) throw new Error('Phần audio tải về chưa đúng.');
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
    const blob = await verify(whole || new Blob(parts, {type: 'audio/mpeg'}), m);
    loaded = blob.size; progress();
    return blob;
  }
  window.K67_PUBLIC_AUDIO = {validManifest, download, verify};
}());
