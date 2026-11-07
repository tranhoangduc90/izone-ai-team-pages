import { createOfflineRuntime } from '../k56-offline-shared/runtime.mjs?v=20261107-mini-v3';

const version = 'mini-k67-cbt-seal-v1';
const { ExamStore, OfflineRuntime } = createOfflineRuntime({ dbName: 'izone-mini-k67-cbt-v1', localPrefix: 'mini-k67-cbt:', build: 'mini-k67-cbt-shell-v1' });
const prefix = '/api/term-tests/mini-test-lesson-5/cbt-offline/';
const ordered = answers => Object.fromEntries(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)));
const offline = () => Object.assign(new Error('Bài đã lưu trên máy · Chờ đồng bộ'), { code: 'CBT_OFFLINE_PENDING' });
const escape = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const scopeKey = scope => JSON.stringify([scope.classCode, scope.studentRef, scope.examSessionToken, scope.generation]);

export async function restoreOfflineSection(scope, section) {
  const store = await new ExamStore().open();
  const key = scopeKey(scope);
  const record = await store.get(key);
  const cached = await store.get(key + ':' + section + '-entry');
  if (!cached || !record?.grants?.[section]) return null;
  const { entry, content } = cached;
  if (entry.examSessionToken !== scope.examSessionToken || entry.studentRef !== scope.studentRef
      || (entry.attemptToken || '') !== (scope.attemptToken || '') || entry.generation !== scope.generation) return null;
  return { entry, content };
}

async function payloadHash(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function openCbtResilience({ scope, request, current, clock, notify, onQueued = () => {} }) {
  if (!navigator.locks || !crypto.subtle || !current()) return null;
  const key = scopeKey(scope);
  const ownership = await new Promise((resolve, reject) => {
    navigator.locks.request('mini-k67-cbt:' + key, { ifAvailable: true }, lock => {
      if (!lock) { resolve(null); return; }
      return new Promise(release => resolve(release));
    }).catch(reject);
  });
  if (!ownership) return null;
  let store, record;
  try {
    store = await new ExamStore().open();
    record = await store.get(key) || { grants: {}, pending: {}, drafts: {}, revisions: {} };
  } catch (error) { ownership(); throw error; }
  const grants = {};
  const unsupported = new Set();
  const active = {};
  const persisting = {};
  let shell;
  const base = (section, attemptToken) => ({ examSessionToken: scope.examSessionToken,
    ...(attemptToken ? { attemptToken } : {}), section, generation: scope.generation });
  const save = () => store.put(key, record);
  const send = (path, value, permit) => request(prefix + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(permit ? { 'x-term2-permit': permit } : {}) }, body: JSON.stringify(value) });
  function valid() {
    if (!current()) throw Object.assign(new Error('Bản đã lưu thuộc lượt khác.'), { code: 'SUBMISSION_OWNER_CHANGED' });
  }
  function grant(section, attemptToken) {
    if (record.grants[section] || navigator.onLine === false || unsupported.has(section)) return Promise.resolve(record.grants[section]);
    grants[section] ||= (async () => {
      const value = await send('grant', { ...base(section, attemptToken), classCode: scope.classCode, studentRef: scope.studentRef });
      valid();
      if (value.version !== version || value.examSessionToken !== scope.examSessionToken || value.generation !== scope.generation
          || value.section !== section || typeof value.permit !== 'string') return null;
      record.grants[section] = value;
      try { await save(); } catch (error) { delete record.grants[section]; throw error; }
      return value;
    })().catch(error => {
      if (error.status === 404 || error.code === 'OFFLINE_NEW_DISABLED') unsupported.add(section);
      return null;
    }).finally(() => { delete grants[section]; });
    return grants[section];
  }

  async function submit(section, data, automatic, deadline) {
    valid();
    if (!record.grants[section] && !record.pending[section]) return undefined;
    if (!record.pending[section]) {
      const captured = automatic && Number.isFinite(Date.parse(deadline)) ? Date.parse(deadline) : clock();
      if (!Number.isFinite(captured)) throw new Error('Chưa đối chiếu được giờ thi. Nháp vẫn được giữ trên máy.');
      const payload = { ...base(section, data.attemptToken), operationId: crypto.randomUUID(),
        capturedAt: new Date(captured).toISOString(),
        revision: Number(data.draftRevision) || 0, automatic, answers: ordered(data.answers || {}) };
      record.pending[section] = payload;
      persisting[section] = save().catch(error => { delete record.pending[section]; throw error; })
        .finally(() => { delete persisting[section]; });
      await persisting[section];
      valid();
      onQueued(section);
      notify('Đã lưu trên máy · Chờ đồng bộ');
    }
    if (persisting[section]) await persisting[section];
    if (navigator.onLine === false) throw offline();
    active[section] ||= sync(section).finally(() => { delete active[section]; });
    return active[section];
  }

  async function sync(section) {
    const payload = record.pending[section];
    const permit = record.grants[section]?.permit;
    if (!permit) throw offline();
    const statusBody = { ...base(section, payload.attemptToken), operationId: payload.operationId };
    try {
      const status = await send('status', statusBody, permit);
      valid();
      let result = status;
      if (!status.persisted) {
        try { result = await send('seal', payload, permit); }
        catch (error) {
          if (error.status && error.status < 500) throw error;
          valid();
          result = await send('status', statusBody, permit);
          if (!result.persisted) throw error;
        }
      }
      valid();
      const receipt = result.receipt;
      if (result.persisted !== true || receipt?.version !== version || receipt.operationId !== payload.operationId
          || receipt.examSessionToken !== scope.examSessionToken || receipt.section !== section || receipt.generation !== scope.generation
          || typeof receipt.completed !== 'boolean' || !/^[0-9a-f-]{36}$/i.test(receipt.attemptToken || '')
          || receipt.revision !== payload.revision || receipt.payloadHash !== await payloadHash(payload)) throw offline();
      valid();
      // The normal form handler must apply this receipt before clearing the local snapshot.
      return { ...receipt, ok: true, cbtOfflineReceipt: true, portalSyncStatus: 'not_applicable' };
    } catch (error) {
      if (error.code === 'SUBMISSION_OWNER_CHANGED') throw error;
      if ([400, 401, 403, 409, 422].includes(error.status) && error.code !== 'AUDIO_END_NOT_CONFIRMED') {
        record.review = section;
        await save().catch(() => {});
        notify('Bài vẫn lưu trên máy · Cần giảng viên đối soát');
      }
      throw offline();
    }
  }

  return {
    close: ownership,
    grant,
    async prepareSection(section, entry, content) {
      if (!record.grants[section] || !content || !entry[section + 'StartedAt']) return;
      if (record[section + 'Entry'] || shell) return shell;
      shell = (async () => {
        await new OfflineRuntime({}).prepareCache();
        valid();
        await store.put(key + ':' + section + '-entry', { entry, content });
        record[section + 'Entry'] = true;
        try { await save(); }
        catch (error) { delete record[section + 'Entry']; throw error; }
        notify(section === 'reading' ? 'Có thể mở lại Reading trên thiết bị này khi mất mạng' : 'Có thể mở lại bản nháp Listening khi mất mạng');
      })().catch(() => notify('Chưa chuẩn bị được trang mở lại offline · Nháp vẫn được lưu trên máy')).finally(() => { shell = null; });
      return shell;
    },
    submit,
    syncPending: async section => record.pending[section] ? sync(section) : null,
    pending: section => record.pending[section] || null,
    reconcile: async section => {
      const payload = record.pending[section];
      if (!payload || navigator.onLine === false) return false;
      const status = await send('status', { ...base(section, payload.attemptToken), operationId: payload.operationId }, record.grants[section]?.permit);
      valid();
      const receipt = status.receipt;
      return status.persisted === true && receipt?.version === version && receipt.operationId === payload.operationId
        && receipt.payloadHash === await payloadHash(payload);
    },
    shouldRetry: section => Boolean(record.pending[section] && record.review !== section && !active[section]),
    restored: () => structuredClone({ drafts: record.drafts, revisions: record.revisions }),
    async saveDrafts(drafts, revisions) {
      valid();
      const next = { listening: drafts.listening || {}, reading: drafts.reading || {} };
      const rev = { listening: revisions.listening || 0, reading: revisions.reading || 0 };
      if (JSON.stringify(next) === JSON.stringify(record.drafts) && JSON.stringify(rev) === JSON.stringify(record.revisions)) return;
      record.drafts = structuredClone(next);
      record.revisions = rev;
      try { await save(); } catch { notify('Chưa lưu được trên thiết bị · Hãy tải bài làm về máy'); }
    },
    async applied(section) {
      delete record.pending[section];
      await save().catch(() => {});
      notify('Máy chủ đã xác nhận nhận bài');
    },
    download(studentName, liveDrafts) {
      const groups = ['listening', 'reading'].map(section => {
        const draft = record.pending[section]?.answers || liveDrafts[section] || record.drafts[section] || {};
        const items = Object.entries(draft).map(([question, value]) => `<dt>${escape(question)}</dt><dd>${escape(value)}</dd>`).join('');
        return `<h2>${section === 'listening' ? 'Listening' : 'Reading'}</h2><dl>${items}</dl>`;
      });
      const html = '<!doctype html><html lang="vi"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'">'
        + `<title>Bài làm Mini Test K67</title><h1>Bài làm Mini Test K67</h1><p>${escape(studentName)} · ${escape(scope.classCode)}</p>`
        + '<p>Bản lưu trên thiết bị. Trạng thái nộp xem trong bài thi.</p>' + groups.join('') + '</html>';
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `Mini-Test-K67-${scope.classCode}.html`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  };
}
