(function () {
  'use strict';
  // Kho riêng K67 chỉ giữ ciphertext và metadata; không nhận/lưu khóa hoặc audio rõ.
  // Chờ transaction hoàn tất và đọc lại trước khi báo đã lưu. Lỗi quota/storage trả về cho UI dùng RAM.
  const database = 'izone-k67-encrypted-audio-v1', store = 'audio';
  const fields = ['assetVersion', 'sha256', 'byteLength', 'encryptedByteLength', 'envelopeVersion'];
  const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
  const digest = async blob => hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const identity = scope => JSON.stringify([scope.apiBase, scope.slug, scope.examSessionToken, scope.generation]);
  const validManifest = m => m && /^sha256-[a-f0-9]{64}$/.test(m.assetVersion) && /^[a-f0-9]{64}$/.test(m.sha256)
    && m.assetVersion === 'sha256-' + m.sha256 && Number.isSafeInteger(m.byteLength) && m.byteLength > 0
    && m.encryptedByteLength === m.byteLength + 33 && m.envelopeVersion === 'IZTT1';

  async function connect() {
    return new Promise((resolve, reject) => {
      let request, settled = false;
      const timer = setTimeout(() => { settled = true; reject(new Error('AUDIO_STORE_TIMEOUT')); }, 2500);
      try { request = indexedDB.open(database, 1); }
      catch (error) { clearTimeout(timer); reject(error); return; }
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, {keyPath: 'id'}); };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (settled) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close(); resolve(request.result);
      };
      request.onerror = () => { clearTimeout(timer); reject(request.error); };
      request.onblocked = () => { clearTimeout(timer); settled = true; reject(new Error('AUDIO_STORE_BLOCKED')); };
    });
  }
  async function transact(mode, run) {
    const db = await connect();
    try {
      return await new Promise((resolve, reject) => {
        let result, transaction;
        const timer = setTimeout(() => { try { transaction?.abort(); } catch {} reject(new Error('AUDIO_STORE_TIMEOUT')); }, 2500);
        try {
          transaction = db.transaction(store, mode);
          transaction.oncomplete = () => { clearTimeout(timer); resolve(result); };
          transaction.onabort = transaction.onerror = () => { clearTimeout(timer); reject(transaction.error || new Error('AUDIO_STORE_FAILED')); };
          run(transaction.objectStore(store), value => { result = value; });
        } catch (error) { clearTimeout(timer); try { transaction?.abort(); } catch {} reject(error); }
      });
    } finally { db.close(); }
  }
  const remove = scope => transact('readwrite', s => s.delete(identity(scope)));
  async function get(scope, manifest, serverNow) {
    if (!validManifest(manifest)) throw new Error('AUDIO_MANIFEST_INVALID');
    const record = await transact('readonly', (s, result) => { const r = s.get(identity(scope)); r.onsuccess = () => result(r.result); });
    if (!record) return null;
    const valid = record.complete === true && record.id === identity(scope) && fields.every(f => record.manifest?.[f] === manifest[f])
      && Number.isFinite(Date.parse(record.expiresAt)) && Date.parse(record.expiresAt) > Date.parse(serverNow)
      && record.blob instanceof Blob && record.blob.size === manifest.encryptedByteLength
      && record.checksum === await digest(record.blob);
    if (!valid) { await remove(scope); return null; }
    return record.blob;
  }
  async function put(scope, manifest, blob, expiresAt, serverNow) {
    if (!validManifest(manifest) || blob.size !== manifest.encryptedByteLength || Date.parse(expiresAt) <= Date.parse(serverNow)) throw new Error('AUDIO_CACHE_INVALID');
    const record = {id: identity(scope), manifest: Object.fromEntries(fields.map(f => [f, manifest[f]])),
      blob, checksum: await digest(blob), expiresAt, complete: true};
    await transact('readwrite', s => {
      // Dọn bản hết hạn trong kho này; không chạm localStorage hoặc cache sản phẩm khác.
      const r = s.openCursor(); r.onsuccess = () => { const c = r.result; if (c) { if (Date.parse(c.value.expiresAt) <= Date.parse(serverNow)) c.delete(); c.continue(); } };
      s.put(record);
    });
    if (!(await get(scope, manifest, serverNow))) throw new Error('AUDIO_CACHE_READBACK_FAILED');
  }
  window.K67_AUDIO_STORE = {get, put, remove, validManifest};
}());
