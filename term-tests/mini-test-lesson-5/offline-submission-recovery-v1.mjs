import { createOfflineRuntime } from '../k56-offline-shared/runtime.mjs?v=20261107-mini-v3';

export const BUILD = 'mini-k67-paper-offline-v1';

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
  class PaperRuntime extends OfflineRuntime {
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
      this.journalConnecting = import('../shared/exam-journal/bridge-k67-paper-v1.mjs?v=20261112-submission-metadata-v2&miniPaper=1')
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

    mount(options) {
      const mounted = Boolean(this.panel);
      super.mount(options);
      if (mounted || !this.panel) return;

      const card = document.getElementById('resultReadyView');
      const label = card.querySelector('.eyebrow');
      const heading = card.querySelector('h2');
      const detail = card.querySelector('h2 + p');
      const button = card.querySelector('#viewResult');
      const original = [label.textContent, heading.textContent, detail.textContent];
      let status = '';
      const render = () => {
        const { listening, reading } = this.record.sections;
        const next = listening?.sealed && reading?.sealed && this.pending
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
  return new PaperRuntime({ apiBase, classCode, store: new ExamStore() }).open();
}
