import { createOfflineRuntime } from '../k56-offline-shared/runtime.mjs?v=20261107-mini-v3';

export const BUILD = 'mini-k67-paper-offline-v1';
const firstSubmissionAccepted = 'EXAM_FIRST_SUBMISSION_ACCEPTED';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function openPaperRuntime({ apiBase, classCode, testConfig }) {
  if (!globalThis.isSecureContext || !navigator.locks || !navigator.serviceWorker
      || !globalThis.indexedDB || !globalThis.crypto?.subtle || !classCode) return null;

  const answerKeys = Object.fromEntries(['listening', 'reading'].map(section => [
    section, testConfig[section].controls.map(control => String(control.number))
  ]));
  const { ExamStore, OfflineRuntime, hash } = createOfflineRuntime({
    slug: 'mini-test-lesson-5', policy: BUILD, build: BUILD, paper: true,
    dbName: 'izone-mini-k67-paper-v1', localPrefix: 'mini-k67-paper:',
    lockPrefix: 'mini-k67-paper:', runPrefix: 'mini-k67-paper-',
    filePrefix: 'Mini-Test-K67-Phieu-Giay', exportTitle: 'Bài làm Mini Test Buổi 5',
    pageTitle: 'Bài làm Mini Test Buổi 5 · Khóa 67', cause: 'mini_k67_paper_offline',
    answerKeys
  });
  const latest = 'latest:' + classCode;
  const tabKey = 'mini-k67-paper:tab:' + classCode;
  let tabId = sessionStorage.getItem(tabKey);
  if (!uuid.test(tabId || '')) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem(tabKey, tabId);
  }
  class PaperStore extends ExamStore {
    async get(key) {
      if (key !== latest) return super.get(key);
      const pointer = await super.get(latest + ':' + tabId);
      if (pointer || this.skipSharedPointer) return pointer;
      return await super.get(latest + ':recent') || await super.get(latest);
    }

    async put(key, value) {
      if (key !== latest) return super.put(key, value);
      const stored = await super.put(latest + ':' + tabId, value);
      if (value.key) await super.put(latest + ':recent', value);
      return stored;
    }
  }

  class PaperRuntime extends OfflineRuntime {
    async open() {
      try {
        await super.open();
      } catch (error) {
        if (!this.record || error.message !== 'Bài đang mở ở tab khác. Hãy quay lại tab đó.') throw error;
        this.record = this.key = null;
        tabId = crypto.randomUUID();
        sessionStorage.setItem(tabKey, tabId);
        this.store.skipSharedPointer = true;
        await super.open();
      }
      if (this.record) await this.store.put(latest, { key: this.key });
      return this;
    }

    async prepareParallel(studentRef, mode) {
      const requestId = crypto.randomUUID();
      const ownerId = this.record?.studentRef === studentRef
        ? this.record.prepared.offline.ownerId : tabId;
      const endpoint = '/offline/parallel-prepare';
      this.observe('request_sent', { requestId, endpoint, timeoutMs: 8000 });
      let response, prepared, errorCode;
      try {
        response = await this.fetchImpl(apiBase + '/api/term-tests/mini-test-lesson-5' + endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-exam-journal-request-id': requestId },
          body: JSON.stringify({ classCode, studentRef, mode, ownerId, identityConfirmed: true }),
          signal: AbortSignal.timeout(8000),
        });
        prepared = await response.json().catch(() => null);
        if (response.status === 404 && (!prepared || ['NOT_FOUND', 'OFFLINE_PARALLEL_NOT_OFFERED'].includes(prepared.error))) return null;
        if (!response.ok || prepared?.ok !== true) {
          throw Object.assign(Error(prepared?.message || 'Chưa xác nhận được lượt nhập phiếu.'), { code: prepared?.error });
        }
        if (prepared.studentRef !== studentRef || prepared.examDelivery !== 'answer_sheet' || prepared.policy?.timed !== false) {
          throw Error('Thông tin lượt nhập phiếu chưa khớp.');
        }
        if (prepared.officialResultReady === true && prepared.completed && prepared.result) return prepared;
        if (!uuid.test(prepared.attemptToken || '') || prepared.attemptToken !== prepared.examSessionToken
            || !Number.isSafeInteger(prepared.generation) || prepared.generation < 0
            || !['read_first', 'lis_first'].includes(prepared.examMode) || prepared.attemptMode !== 'answer_sheet'
            || prepared.offline?.policy !== BUILD || prepared.offline.ownerId !== ownerId
            || !/^[a-f0-9]{64}$/.test(prepared.offline.permit || '')) {
          throw Error('Quyền lưu offline chưa khớp lượt nhập phiếu.');
        }
      } catch (error) {
        errorCode = error.code || 'PAPER_PREPARE_FAILED';
        throw error;
      } finally {
        this.observe('request_finished', { requestId, endpoint, httpStatus: response?.status ?? null, errorCode: errorCode ?? null });
      }

      const key = 'run:' + prepared.attemptToken;
      if (this.record && this.key !== key) await this.detachLatest();
      if (!this.record) {
        this.record = await this.store.get(key) || {
          classCode, studentRef, prepared, snapshot: null, operations: [], receipts: {}, sections: {},
          ready: false, player: { position: 0, ended: false },
        };
        this.key = key;
        await this.claim();
        this.anchor();
      }
      const previous = this.record.prepared;
      if (this.record.studentRef !== studentRef || this.record.classCode !== classCode
          || previous.offline.ownerId !== ownerId || previous.generation !== prepared.generation
          || previous.examSessionToken !== prepared.examSessionToken) {
        throw Error('Bản trên máy thuộc lượt khác. Bài đã lưu vẫn được giữ.');
      }
      this.record.prepared = prepared;
      if (this.record.review === firstSubmissionAccepted && prepared.continuationSection === this.record.operations[0]?.section) {
        delete this.record.review;
        this.retryAt = this.failures = 0;
      }
      await this.persist(true);
      await this.store.put(latest, { key });
      if (!this.record.ready) await this.finishPreparation();
      return prepared;
    }

    sectionResponse() {
      const response = super.sectionResponse();
      const remaining = this.record.prepared.continuationSection;
      if (!remaining) return response;
      const prior = remaining === 'reading' ? 'listening' : 'reading';
      const done = response[remaining + 'Submitted'] || this.record.prepared.completed;
      return { ...response, [prior + 'Submitted']: true, [remaining + 'Submitted']: Boolean(done),
        completed: Boolean(done), nextSection: done ? 'result' : remaining };
    }

    get recoveryEnabled() {
      return this.record?.prepared.offline?.submissionRecoveryVersion === 1;
    }

    get heldSubmission() {
      if (!this.recoveryEnabled) return null;
      const op = this.record.operations[0];
      const held = op && this.record.sections[op.section]?.held;
      return held?.operationId === op?.operationId && held?.expiresAt > this.now() ? held : null;
    }

    get message() {
      const held = this.heldSubmission;
      return held ? 'Máy chủ đã giữ bản để đối soát · Mã đối soát ' + held.operationId : super.message;
    }

    async rememberHold(op, held) {
      if (!held || held.payloadHash !== await hash(op)
          || !Number.isSafeInteger(held.heldAt) || !Number.isSafeInteger(held.expiresAt)
          || held.expiresAt <= held.heldAt || !this.active
          || this.record.operations[0]?.operationId !== op.operationId) return;
      const section = this.record.sections[op.section];
      if (section.held?.operationId === op.operationId && section.held.expiresAt === held.expiresAt) return;
      section.held = { ...held, operationId: op.operationId };
      await this.persist().catch(() => {});
    }

    submissionDiagnostic(type, data, run = this.record) {
      try {
        if (!this.recoveryEnabled || this.record !== run) return;
        const queue = run.submissionDiagnostics ||= [];
        if (queue.length >= 64) {
          queue.shift();
          this.record.submissionDiagnosticsLost = (this.record.submissionDiagnosticsLost || 0) + 1;
        }
        queue.push({ type, data });
        void this.persist().catch(() => {});
        this.drainDiagnostics();
      } catch {}
    }

    drainDiagnostics() {
      if (!this.recoveryEnabled) return super.drainDiagnostics();
      if (!this.active) return;
      const queue = this.record.submissionDiagnostics;
      if (!queue?.length) return;
      if (!this.journal?.recordK67Submission) {
        this.connectRecoveryJournal();
        return;
      }
      try {
        let changed = false;
        const lost = this.record.submissionDiagnosticsLost;
        if (lost && this.journal.recordK67Submission(this.scope, 'sequence_gap', {
          cause: 'submission_diagnostic_budget', lostCount: lost
        })) {
          delete this.record.submissionDiagnosticsLost;
          changed = true;
        }
        while (queue.length && this.journal.recordK67Submission(this.scope, queue[0].type, queue[0].data)) {
          queue.shift();
          changed = true;
        }
        if (changed) void this.persist().catch(() => {});
      } catch {}
    }

    connectRecoveryJournal() {
      const config = window.TERM_TEST_APP_CONFIG;
      if (config?.EXAM_JOURNAL_ENABLED !== true || navigator.onLine === false || this.journalConnecting) return;
      const endpoint = config.EXAM_JOURNAL_BASE_URL || apiBase + '/api/term-tests/mini-test-lesson-5';
      const getState = () => this.active ? { ...this.sectionResponse(), classCode: this.classCode } : {};
      try {
        const key = JSON.stringify([new URL(endpoint, location.href).href, 'mini-test-lesson-5']);
        const existing = window[Symbol.for('izone.examJournal.connections.v1')]?.get(key);
        if (existing?.recordK67Submission) {
          this.setJournal(existing.adopt(getState));
          return;
        }
      } catch {}
      this.journalConnecting = import('../shared/exam-journal/bridge-mini-k67-paper-browser-cloud-v2.mjs?v=20261112-submission-metadata-v2&miniPaper=1')
        .then(({ connectExamJournal }) => {
          if (this.active) this.setJournal(connectExamJournal({ enabled: true, endpoint, getState,
            testSlug: 'mini-test-lesson-5', build: config.EXAM_JOURNAL_BUILD || 'unknown' }));
        }).catch(() => {}).finally(() => { this.journalConnecting = null; });
    }

    async enqueue(section, kind, ...args) {
      const run = this.record;
      const op = await super.enqueue(section, kind, ...args);
      if (kind === 'seal' && this.recoveryEnabled) {
        this.submissionDiagnostic('state_observed', { cause: 'k67_offline_journey', checkpointState: {
          action: 'submission_device_saved', submissionObservationVersion: 1, delivery: 'paper',
          section, operationId: op.operationId, revision: op.revision, automatic: false,
          startedAtMs: Date.parse(op.payload.startedAt), capturedAtMs: Date.parse(op.occurredAt),
          answeredCount: Object.values(op.payload.answers).filter(Boolean).length
        } }, run);
      }
      return op;
    }

    async post(path, body, withPermit = true) {
      const run = this.record;
      const op = run?.operations[0];
      const readback = path === '/offline/status';
      if (!this.recoveryEnabled || !op || op.kind !== 'seal' || body.operationId !== op.operationId
          || (!readback && path !== '/offline/operation')) return super.post(path, body, withPermit);

      const route = '/api/term-tests/mini-test-lesson-5' + path;
      const requestId = crypto.randomUUID(), began = performance.now();
      const trace = { requestId, route, method: 'POST', checkpointState: {
        operationId: op.operationId, phase: readback ? 'readback' : 'send'
      } };
      let status;
      this.submissionDiagnostic('request_started', trace, run);
      try {
        const response = await this.fetchImpl(apiBase + route, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-exam-journal-request-id': requestId,
            'x-term2-permit': run.prepared.offline.permit },
          body: JSON.stringify(readback ? { ...body, section: op.section } : body), signal: AbortSignal.timeout(8000)
        });
        status = response.status;
        const result = await response.json();
        await this.rememberHold(op, result.held).catch(() => {});
        if (!response.ok || result.ok !== true) {
          throw Object.assign(Error(result.message || 'Máy chủ chưa nhận được bài.'), { status, code: result.error });
        }
        this.submissionDiagnostic('request_finished', { ...trace, status, durationMs: performance.now() - began }, run);
        if (result.receipt?.operationId === op.operationId && result.receipt.payloadHash === await hash(op)
            && result.receipt.examSessionToken === op.examSessionToken && result.receipt.generation === op.generation
            && result.receipt.attemptToken === op.attemptToken && result.receipt.acceptedRevision === op.revision
            && result.receipt.status === 'accepted') {
          this.submissionDiagnostic('state_observed', { cause: 'k67_offline_journey', checkpointState: {
            action: 'submission_receipt_verified', submissionObservationVersion: 1, delivery: 'paper', section: op.section,
            operationId: op.operationId, receiptId: result.receipt.receiptId, revision: op.revision, via: readback ? 'readback' : 'send'
          } }, run);
        }
        return result;
      } catch (error) {
        this.submissionDiagnostic('request_failed', { ...trace, durationMs: performance.now() - began,
          ...(Number.isInteger(status) ? { status } : {}),
          ...(/^[A-Z0-9_]{1,80}$/.test(error.code || '') ? { errorCode: error.code } : {}) }, run);
        throw error;
      }
    }

    mount({ onOfficialProgress, ...options }) {
      const mounted = Boolean(this.panel);
      super.mount(options);
      if (mounted || !this.panel) return;

      const card = document.getElementById('resultReadyView');
      const label = card.querySelector('.eyebrow');
      const heading = card.querySelector('h2');
      const detail = card.querySelector('h2 + p');
      const button = card.querySelector('#viewResult');
      const resume = document.createElement('button');
      resume.type = 'button';
      resume.textContent = 'Mở theo tiến độ chính thức';
      resume.hidden = true;
      this.panel.append(resume);
      resume.addEventListener('click', async () => {
        resume.disabled = true;
        try { await onOfficialProgress?.(); } finally { resume.disabled = false; }
      });
      const original = [label.textContent, heading.textContent, detail.textContent];
      let status = '';
      const render = () => {
        resume.hidden = !this.active || this.record.review !== firstSubmissionAccepted;
        const next = this.active && this.sectionResponse().completed && this.pending
          ? (this.record.review ? 'review' : 'pending') : '';
        const held = this.heldSubmission;
        const renderedStatus = next + (held ? held.operationId : '');
        if (renderedStatus === status) return;
        status = renderedStatus;
        const copy = next === 'review'
          ? ['Đã lưu bài làm', 'Bài làm cần được đối soát', held
            ? 'Máy chủ đã giữ bản để đối soát. Mã đối soát ' + held.operationId
            : 'Bài làm đã lưu trên thiết bị. Hãy báo giảng viên để kiểm tra.']
          : next === 'pending'
            ? ['Đã lưu bài làm', 'Bài làm đang chờ đồng bộ', 'Bài làm đã lưu trên thiết bị. Bạn có thể xem kết quả sau khi máy chủ xác nhận đã nhận bài.']
            : original;
        [label.textContent, heading.textContent, detail.textContent] = copy;
        button.disabled = Boolean(next);
      };
      this.addEventListener('change', render);
      render();
    }

    async flush() {
      if (navigator.onLine === false) return;
      return super.flush();
    }
  }
  return new PaperRuntime({ apiBase, classCode, store: new PaperStore() }).open();
}
