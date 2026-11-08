import { createOfflineRuntime } from '../k56-offline-shared/runtime.mjs?v=20261107-k56-r2-v1';
import { TERM1_PROFILE } from '../k56-offline-shared/profiles.mjs';

export const BUILD = 'term1-k56-reading-fallback-v1';
const profile = Object.freeze({ ...TERM1_PROFILE, build: BUILD, dbName: 'izone-term1-k56-reading-fallback-v1',
  localPrefix: 'term1-k56-reading-fallback:', lockPrefix: 'term1-k56-reading-fallback:', cause: 'term1_reading_fallback' });
const { ExamStore, OfflineRuntime, hash } = createOfflineRuntime(profile);

export class ReadingOffline extends OfflineRuntime {
  constructor({ apiBase, classCode, grant, grantId }) {
    super({ apiBase, classCode, store: new ExamStore(), fetchImpl(url, options) {
      const headers = new Headers(options.headers);
      headers.delete('x-term2-permit');
      headers.set('x-term1-skill-grant', grant);
      return fetch(url, { ...options, headers, cache: 'no-store' });
    } });
    this.skill = 'reading';
    this.grantId = grantId;
    this.grantHash = hash(grant);
  }

  async open() {
    await this.store.open();
    this.key = 'run:' + this.grantId;
    this.record = await this.store.get(this.key);
    if (this.record) {
      if (this.record.classCode !== this.classCode || this.record.grantHash !== await this.grantHash)
        throw Error('Link chưa khớp bài đã lưu. Hãy dùng link giảng viên đã gửi.');
      await this.claim();
      this.anchor();
    }
    window.addEventListener('online', () => { this.retryAt = 0; void this.flush(); });
    this.timer = setInterval(() => { this.drainDiagnostics(); if (navigator.onLine !== false) void this.flush(); }, 5000);
    return this;
  }

  async prepareReading(opened, identity, ownerId) {
    if (opened.grantId !== this.grantId || opened.section !== this.skill) throw Error('Máy chủ trả lượt Reading khác.');
    if (!opened.submitted && (!opened.content?.reading?.sections?.length || opened.durationMinutes !== 40))
      throw Error('Đề Reading chưa được tải đầy đủ.');
    const reading = opened.content?.reading;
    // The pinned Term 1 content uses a relative path to its original figure.
    for (const section of reading?.sections || []) {
      for (const field of ['passageHtml', 'questionsHtml']) {
        if (typeof section[field] === 'string') section[field] = section[field].replaceAll('src="assets/figures/', 'src="../term-test-1-k56-computer-based/assets/figures/');
      }
    }
    this.record = { classCode: this.classCode, studentRef: identity.studentRef, grantHash: await this.grantHash,
      prepared: { attemptToken: this.grantId, examSessionToken: this.grantId, examMode: 'read_first',
        studentName: identity.studentName, generation: Number(opened.generation) || 0, serverNow: opened.serverNow,
        offline: { ownerId, preparedAt: opened.preparedAt }, timing: { readingDurationMinutes: opened.durationMinutes },
        content: { baseTestSlug: TERM1_PROFILE.slug, reading } },
      snapshot: { studentRef: identity.studentRef, studentName: identity.studentName, className: this.classCode,
        attemptToken: this.grantId, examSessionToken: this.grantId, identityConfirmed: true, annotationRunId: this.grantId,
        drafts: { reading: opened.draft || {} }, draftRevisions: { reading: opened.revision || 0 } },
      operations: [], receipts: {}, sections: {}, ready: false, player: { position: 0, ended: false } };
    if (opened.startedAt || opened.submitted) this.record.sections.reading = { startedAt: opened.startedAt,
      deadlineAt: opened.deadlineAt, revision: opened.revision || 0, sealed: opened.submitted };
    await this.claim();
    this.anchor();
    await this.persist(true);
    await this.finishReadingPreparation();
  }

  async finishReadingPreparation() {
    await this.prepareCache();
    this.record.ready = true;
    try { await this.persist(true); }
    catch (error) { this.record.ready = false; throw error; }
  }

  order() { return [this.skill]; }

  sectionResponse() {
    const response = super.sectionResponse();
    return { ...response, completed: response.readingSubmitted };
  }

  async readResult() {
    const value = await this.post('/skill-fallback/result', { grantId: this.grantId, ownerId: this.scope.ownerId }, false);
    if (value.section !== this.skill || !value.submitted || !value.result) throw Error('Chưa có kết quả Reading đã xác nhận.');
    return { studentName: this.record.prepared.studentName, className: this.classCode,
      result: { testTitle: 'Term Test 1 · Khóa 56', reading: value.result } };
  }

  mount({ snapshot, host }) {
    if (this.panel) return;
    const panel = document.createElement('div');
    panel.className = 'writing-save-status';
    panel.setAttribute('role', 'status');
    host.append(panel);
    this.panel = panel;
    const status = document.createElement('span');
    panel.append(status);
    const show = () => { if (status.textContent !== this.message) status.textContent = this.message; };
    this.addEventListener('change', show);
    show();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-secondary';
    button.textContent = 'Tải bài làm về máy';
    document.querySelector('.topbar').append(button);
    button.addEventListener('click', async () => {
      const current = snapshot();
      try { await this.capture(current); } catch { /* Bản tải dùng được ngay cả khi bộ nhớ đã đầy. */ }
      const answers = current.drafts.reading || {};
      const escape = text => String(text ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
      const rows = profile.answerKeys.reading.map(key => `<tr><td>${key}</td><td>${escape(answers[key])}</td></tr>`).join('');
      const receipt = Object.values(this.record.receipts).find(value => value.kind === 'seal' && value.status === 'accepted');
      const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>Term Test 1 K56 · Reading</title><h1>Term Test 1 K56 · Reading</h1><p>${escape(current.studentName)} · ${escape(this.classCode)}</p><p>${receipt ? 'Biên nhận: ' + escape(receipt.receiptId) : 'Bản lưu trên thiết bị. Chưa có biên nhận nộp bài trong bản lưu này.'}</p><table><thead><tr><th>Câu</th><th>Bài làm</th></tr></thead><tbody>${rows}</tbody></table></html>`;
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Term-Test-1-K56-Reading-' + this.classCode + '.html';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  }
}
