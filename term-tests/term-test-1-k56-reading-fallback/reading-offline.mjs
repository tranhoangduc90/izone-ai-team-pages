import { createOfflineRuntime } from '../k56-offline-shared/runtime.mjs?v=20261107-k56-r2-v1';
import { TERM1_PROFILE } from '../k56-offline-shared/profiles.mjs';

export const BUILD = 'term1-k56-skill-fallback-v1';
const profile = Object.freeze({ ...TERM1_PROFILE, build: BUILD, dbName: 'izone-term1-k56-skill-fallback-v1',
  localPrefix: 'term1-k56-skill-fallback:', lockPrefix: 'term1-k56-skill-fallback:', cause: 'term1_skill_fallback' });
const { ExamStore, OfflineRuntime, hash } = createOfflineRuntime(profile);
export { ExamStore };

export class SkillOffline extends OfflineRuntime {
  constructor({ apiBase, classCode, grant, grantId, skill }) {
    super({ apiBase, classCode, store: new ExamStore(), fetchImpl(url, options) {
      const headers = new Headers(options.headers);
      headers.delete('x-term2-permit');
      headers.set('x-term1-skill-grant', grant);
      return fetch(url, { ...options, headers, cache: 'no-store' });
    } });
    this.skill = skill;
    this.label = { listening: 'Listening', reading: 'Reading', writing: 'Writing' }[skill];
    this.grantId = grantId;
    this.grantHash = hash(grant);
  }

  async open({ existingOnly = false } = {}) {
    await this.store.open();
    this.key = 'run:' + this.grantId;
    this.record = await this.store.get(this.key);
    if (existingOnly && !this.record) return this;
    if (this.record) {
      if (this.record.classCode !== this.classCode || this.record.skill !== this.skill || this.record.grantHash !== await this.grantHash)
        throw Error('Link chưa khớp bài đã lưu. Hãy dùng link giảng viên đã gửi.');
      await this.claim();
      this.anchor();
    }
    window.addEventListener('online', () => { this.retryAt = 0; void this.flush(); });
    this.timer = setInterval(() => { this.drainDiagnostics(); if (navigator.onLine !== false) void this.flush(); }, 5000);
    return this;
  }

  async prepareSkill(opened, identity, ownerId) {
    if (opened.grantId !== this.grantId || opened.section !== this.skill) throw Error('Máy chủ trả lượt khác.');
    const listening = this.skill === 'listening';
    const writing = this.skill === 'writing';
    const timing = listening ? { listeningDurationSeconds: opened.durationSeconds, listeningReviewSeconds: opened.reviewSeconds }
      : { [this.skill + 'DurationMinutes']: opened.durationMinutes };
    const timingMatches = listening ? opened.durationSeconds === 1848 && opened.reviewSeconds === 0 : opened.durationMinutes === (writing ? 55 : 40);
    const content = opened.content?.[this.skill];
    const validContent = writing ? content?.tasks?.length === 1 && content.tasks[0].id === 'task2' : content?.sections?.length;
    if ((!opened.submitted || writing) && (!validContent || !timingMatches))
      throw Error('Đề và thời lượng ' + this.label + ' chưa khớp lượt được cấp.');
    // The pinned Term 1 content uses a relative path to its original figure.
    for (const section of content?.sections || []) {
      for (const field of ['passageHtml', 'questionsHtml', 'html']) {
        if (typeof section[field] === 'string') section[field] = section[field].replaceAll('src="assets/figures/', 'src="../term-test-1-k56-computer-based/assets/figures/');
      }
    }
    this.record = { classCode: this.classCode, studentRef: identity.studentRef, skill: this.skill, grantHash: await this.grantHash,
      prepared: { attemptToken: this.grantId, examSessionToken: this.grantId, examMode: 'read_first',
        studentName: identity.studentName, generation: Number(opened.generation) || 0, serverNow: opened.serverNow,
        offline: { ownerId, preparedAt: opened.preparedAt }, timing,
        content: { baseTestSlug: TERM1_PROFILE.slug, [this.skill]: content,
          ...(listening ? { audio: { label: 'Audio Listening · Term Test 1', durationLabel: '30:48' } } : {}) } },
      snapshot: { studentRef: identity.studentRef, studentName: identity.studentName, className: this.classCode,
        attemptToken: this.grantId, examSessionToken: this.grantId, identityConfirmed: true, annotationRunId: this.grantId,
        drafts: { [this.skill]: opened.draft || {} }, draftRevisions: { [this.skill]: opened.revision || 0 },
        ...(writing ? { writingRevision: opened.revision || 0, writingAckRevision: opened.revision || 0 } : {}) },
      operations: [], receipts: {}, sections: {}, ready: false, player: { position: opened.position || 0, ended: false } };
    if (opened.startedAt || opened.submitted) this.record.sections[this.skill] = { startedAt: opened.startedAt,
      deadlineAt: opened.deadlineAt, revision: opened.revision || 0, sealed: opened.submitted };
    await this.claim();
    this.anchor();
    await this.persist(true);
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
    return { ...response, completed: Boolean(this.record.sections[this.skill]?.sealed) };
  }

  async readResult() {
    const value = await this.post('/skill-fallback/result', { grantId: this.grantId, ownerId: this.scope.ownerId, section: this.skill }, false);
    const writing = this.skill === 'writing';
    if (value.section !== this.skill || !value.submitted || !(writing ? value.writing : value.result))
      throw Error('Chưa có kết quả ' + this.label + ' đã xác nhận.');
    return { studentName: this.record.prepared.studentName, className: this.classCode,
      result: { testTitle: 'Term Test 1 · Khóa 56', ...(writing ? {} : { [this.skill]: value.result }) },
      ...(!writing && Array.isArray(value.review) ? { review: value.review } : {}),
      ...(writing ? { writing: value.writing } : {}) };
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
      const answers = current.drafts[this.skill] || {};
      const escape = text => String(text ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
      const answerBlock = this.skill === 'writing' ? `<h2>Task 2</h2><pre>${escape(answers.task2)}</pre>`
        : `<table><thead><tr><th>Câu</th><th>Bài làm</th></tr></thead><tbody>${profile.answerKeys[this.skill].map(key => `<tr><td>${key}</td><td>${escape(answers[key])}</td></tr>`).join('')}</tbody></table>`;
      const receipt = Object.values(this.record.receipts).find(value => value.kind === 'seal' && value.status === 'accepted');
      const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>Term Test 1 K56 · ${this.label}</title><h1>Term Test 1 K56 · ${this.label}</h1><p>${escape(current.studentName)} · ${escape(this.classCode)}</p><p>${receipt ? 'Biên nhận: ' + escape(receipt.receiptId) : 'Bản lưu trên thiết bị. Chưa có biên nhận nộp bài trong bản lưu này.'}</p>${answerBlock}</html>`;
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Term-Test-1-K56-' + this.label + '-' + this.classCode + '.html';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  }
}
